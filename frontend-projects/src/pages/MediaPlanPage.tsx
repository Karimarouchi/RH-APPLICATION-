import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
    HiOutlineTrash,
    HiOutlineCheck,
    HiOutlineSearch,
    HiOutlinePlus,
    HiOutlineX,
    HiOutlineRefresh,
    HiOutlineChevronDown,
    HiOutlineChevronRight,
    HiOutlineDownload,
    HiOutlineChatAlt,
    HiOutlineShieldCheck,
    HiChevronLeft,
    HiChevronRight,
} from 'react-icons/hi';
import { SiGoogledrive } from 'react-icons/si';
import { useAuth } from '../context/AuthContext';
import { mediaPlanService } from '../api/mediaPlanService';
import { referentielService } from '../api/referentielService';
import { mediaPlanAssignmentService } from '../api/mediaPlanAssignmentService';
import { mediaPlanCommentService, MediaPlanCommentDTO } from '../api/mediaPlanCommentService';
import { employeService } from '../api/employeService';
import { clientService } from '../api/clientService';
import { calendrierProjetService } from '../api/calendrierProjetService';
import {
    MediaPlan,
    MediaPlanRequest,
    Referentiel,
    EtatPublication,
    EtatPublicationLabels,
    StatutMediaPlanLabels,
    TypeContenuShooting,
    TypeContenuShootingLabels,
    StatutShooting,
    MediaPlanAssignment,
} from '../types';
import Badge from '../components/ui/Badge';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { useConfirm } from '../hooks/useConfirm';

const HOURS = ['', ...Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`)];
const MONTH_NAMES = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
const MIN_ROWS = 1;
const PAGE_SIZE = 8;

const COLUMNS = [
    { key: 'datePublication', label: 'Date Pub.', defaultWidth: 128 },
    { key: 'heure', label: 'Heure', defaultWidth: 88 },
    { key: 'format', label: 'Format', defaultWidth: 120 },
    { key: 'type', label: 'Type', defaultWidth: 110 },
    { key: 'titre', label: 'Titre', defaultWidth: 180 },
    { key: 'texteSurVisuel', label: 'Texte/Visuel', defaultWidth: 160 },
    { key: 'inspiration', label: 'Inspiration', defaultWidth: 140 },
    { key: 'autresElements', label: 'Autres', defaultWidth: 120 },
    { key: 'platforme', label: 'Plateforme', defaultWidth: 120 },
    { key: 'lienDrive', label: 'Lien Drive', defaultWidth: 140 },
    { key: 'etatPublication', label: 'État Pub.', defaultWidth: 130 },
    { key: 'rectifs', label: 'Rectifs', defaultWidth: 120 },
    { key: 'remarques', label: 'Remarques', defaultWidth: 130 },
    { key: 'shooting', label: 'Shooting', defaultWidth: 88 },
    { key: 'statut', label: 'Statut', defaultWidth: 110 },
    { key: 'actions', label: 'Actions', defaultWidth: 88 },
];

const rowMatchesSearch = (obj: object, query: string) =>
    !query || Object.values(obj).some((v) => typeof v === 'string' && v.toLowerCase().includes(query.toLowerCase()));

const TablePager: React.FC<{ page: number; pageCount: number; total: number; onPage: (page: number) => void }> = ({
    page, pageCount, total, onPage,
}) => {
    if (total === 0) return null;
    return (
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-t border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-800/60">
            <p className="text-xs text-gray-500 dark:text-gray-400">
                {total} ligne{total > 1 ? 's' : ''}
            </p>
            <div className="flex items-center gap-2">
                <button type="button" disabled={page <= 0} onClick={() => onPage(page - 1)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 disabled:opacity-40 hover:bg-white dark:hover:bg-gray-700">
                    <HiChevronLeft size={16} />
                </button>
                <span className="text-xs font-medium text-gray-600 dark:text-gray-300 min-w-[72px] text-center">
                    {page + 1} / {pageCount}
                </span>
                <button type="button" disabled={page >= pageCount - 1} onClick={() => onPage(page + 1)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 disabled:opacity-40 hover:bg-white dark:hover:bg-gray-700">
                    <HiChevronRight size={16} />
                </button>
            </div>
        </div>
    );
};

// ── Draft row ──
interface DraftRow {
    _draft: true;
    _key: string;
    datePublication: string;
    heure: string;
    format: string;
    type: string;
    titre: string;
    texteSurVisuel: string;
    inspiration: string;
    autresElements: string;
    platforme: string;
    lienDrive: string;
    etatPublication: string;
    rectifs: string;
    remarques: string;
    isShooting: boolean;
    shootingDescription: string;
    shootingLocalisation: string;
    shootingDate: string;
    shootingAuPlusTard: string;
    clientDoitValiderDate: boolean;
    shootingTypeDeContenu: TypeContenuShooting | '';
}

const emptyDraft = (): DraftRow => ({
    _draft: true,
    _key: `draft-${Date.now()}-${Math.random()}`,
    datePublication: '',
    heure: '',
    format: '',
    type: '',
    titre: '',
    texteSurVisuel: '',
    inspiration: '',
    autresElements: '',
    platforme: '',
    lienDrive: '',
    etatPublication: '',
    rectifs: '',
    remarques: '',
    isShooting: false,
    shootingDescription: '',
    shootingLocalisation: '',
    shootingDate: '',
    shootingAuPlusTard: '',
    clientDoitValiderDate: false,
    shootingTypeDeContenu: '',
});

// ── Cell formatting ──
interface CellFormat {
    bold?: boolean;
    fontSize?: number;
    textColor?: string;
    fillColor?: string;
}

// datePublication is excluded because it's always pre-filled with the month's first day
const isDraftFilled = (d: DraftRow) => !!(
    d.titre || d.heure || d.format || d.type || d.texteSurVisuel || d.inspiration || d.autresElements ||
    d.platforme || d.lienDrive || d.etatPublication || d.rectifs || d.remarques ||
    d.isShooting || d.shootingDescription || d.shootingLocalisation || d.shootingAuPlusTard || d.shootingDate || d.shootingTypeDeContenu
);

// ── Expanded cell overlay ──
const ExpandedCell: React.FC<{
    value: string;
    readOnly?: boolean;
    onConfirm: (text: string) => void;
    onCancel: () => void;
}> = ({ value, readOnly, onConfirm, onCancel }) => {
    const [text, setText] = useState(value);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (!readOnly) onConfirm(text); else onCancel();
        }
        if (e.key === 'Escape') onCancel();
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center" onClick={onCancel}>
            <div className="absolute inset-0 bg-gray-900/40" />
            <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between px-4 pt-4 pb-2">
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-300">{readOnly ? 'Aperçu' : 'Modifier'}</span>
                    <button onClick={onCancel} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                        <HiOutlineX size={18} className="text-gray-500" />
                    </button>
                </div>
                <div className="px-4">
                    <textarea autoFocus value={readOnly ? value : text} readOnly={readOnly}
                        onChange={e => setText(e.target.value)} onKeyDown={handleKeyDown}
                        className={`w-full h-40 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-sm text-gray-800 dark:text-gray-200 resize-none focus:outline-none focus:ring-2 focus:ring-brand-500 ${readOnly ? 'cursor-default opacity-80' : ''}`}
                    />
                </div>
                {!readOnly && (
                    <div className="flex justify-end gap-2 px-4 pb-4 pt-2">
                        <button onClick={onCancel} className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">Annuler</button>
                        <button onClick={() => onConfirm(text)} className="px-3 py-1.5 text-sm rounded-lg bg-brand-500 text-white hover:bg-brand-600 transition-colors">Confirmer</button>
                    </div>
                )}
            </div>
        </div>
    );
};

// ── Detect links ──
const renderCellValue = (value: string | null) => {
    if (!value) return '-';
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    if (urlRegex.test(value)) {
        return value.split(/(https?:\/\/[^\s]+)/g).map((part, i) =>
            /^https?:\/\//.test(part) ? (
                <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-brand-500 underline hover:text-brand-600 break-all" onClick={e => e.stopPropagation()}>
                    {part.length > 25 ? part.substring(0, 25) + '…' : part}
                </a>
            ) : <span key={i}>{part}</span>
        );
    }
    return value;
};

// ── Month key helper ──
const getMonthKey = (year: number, month: number) => `${year}-${String(month + 1).padStart(2, '0')}`;
const parseMonthKey = (key: string) => {
    const [y, m] = key.split('-').map(Number);
    return { year: y, month: m - 1 };
};

const fmtDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const getAllDatesInMonth = (year: number, month: number): string[] => {
    const dates: string[] = [];
    const d = new Date(year, month, 1);
    while (d.getMonth() === month) {
        dates.push(fmtDate(d));
        d.setDate(d.getDate() + 1);
    }
    return dates;
};

// ── LocalStorage helpers ──
const DRAFT_STORAGE_PREFIX = 'mp_drafts_';
const getDraftStorageKey = (clientId: number, monthKey: string) => `${DRAFT_STORAGE_PREFIX}${clientId}_${monthKey}`;

const saveDraftsToStorage = (clientId: number, monthKey: string, drafts: DraftRow[]) => {
    try {
        const filled = drafts.filter(isDraftFilled);
        if (filled.length > 0) {
            localStorage.setItem(getDraftStorageKey(clientId, monthKey), JSON.stringify(filled));
        } else {
            localStorage.removeItem(getDraftStorageKey(clientId, monthKey));
        }
    } catch (e) { /* */ }
};

const loadDraftsFromStorage = (clientId: number, monthKey: string): DraftRow[] => {
    try {
        const raw = localStorage.getItem(getDraftStorageKey(clientId, monthKey));
        if (raw) {
            const parsed = JSON.parse(raw) as DraftRow[];
            return parsed.map(d => ({ ...d, _key: d._key || `draft-${Date.now()}-${Math.random()}` }));
        }
    } catch (e) { /* */ }
    return [];
};

const clearDraftsFromStorage = (clientId: number, monthKey: string) => {
    try { localStorage.removeItem(getDraftStorageKey(clientId, monthKey)); } catch (e) { /* */ }
};

// ── Column resize styles ──
const resizeHandleStyle: React.CSSProperties = {
    position: 'absolute', right: 0, top: 0, bottom: 0, width: '6px',
    cursor: 'col-resize', zIndex: 10, borderRight: '2px solid transparent', transition: 'border-color 0.15s',
};
const resizeHandleHoverStyle: React.CSSProperties = {
    ...resizeHandleStyle, borderRight: '2px solid var(--color-brand-500, #6366f1)',
};

// ── Get status label and color for accordion header ──
const getStatusInfo = (plans: MediaPlan[]) => {
    if (plans.length === 0) return { label: 'Vide', color: 'gray' };
    if (plans.every(p => p.statut === 'APPROUVE')) return { label: 'Approuvé', color: 'green' };
    if (plans.some(p => p.statut === 'DESAPPROUVE')) return { label: 'Désapprouvé', color: 'red' };
    if (plans.some(p => p.statut === 'EN_ATTENTE')) return { label: 'En attente', color: 'warning' };
    return { label: 'Brouillon', color: 'brand' };
};

const statusColorClasses: Record<string, string> = {
    green: 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800 text-green-700 dark:text-green-400',
    red: 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800 text-red-700 dark:text-red-400',
    warning: 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800 text-yellow-700 dark:text-yellow-400',
    brand: 'bg-brand-50 border-brand-200 dark:bg-brand-900/20 dark:border-brand-800 text-brand-700 dark:text-brand-400',
    gray: 'bg-gray-50 border-gray-200 dark:bg-gray-800 dark:border-gray-700 text-gray-600 dark:text-gray-400',
};

// ══════════════════════════════════════════════════
// ── MAIN COMPONENT ──
// ══════════════════════════════════════════════════
const MediaPlanPage: React.FC = () => {
    const { user } = useAuth();
    const { clientId: clientIdParam } = useParams<{ clientId: string }>();
    const selectedClientId = clientIdParam ? Number(clientIdParam) : null;
    const { confirm, confirmState, handleConfirm, handleCancel } = useConfirm();

    const [mediaPlans, setMediaPlans] = useState<MediaPlan[]>([]);
    const [assignments, setAssignments] = useState<MediaPlanAssignment[]>([]);
    const [clientLabel, setClientLabel] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [isForbidden, setIsForbidden] = useState(false);
    const [draftRows, setDraftRows] = useState<DraftRow[]>([]);
    const [tablePage, setTablePage] = useState(0);

    // Expanded cell
    const [expandedCell, setExpandedCell] = useState<{
        value: string; readOnly: boolean; onSave: (v: string) => void;
    } | null>(null);

    // Month navigation
    const now = new Date();
    const [selectedMonth, setSelectedMonth] = useState(getMonthKey(now.getFullYear(), now.getMonth()));

    // Accordion states: track which batch accordions are open by batch key
    const [openBatches, setOpenBatches] = useState<Set<string>>(new Set());
    const [newPlanOpen, setNewPlanOpen] = useState(false);
    const [isGoogleAuthorized, setIsGoogleAuthorized] = useState<boolean | null>(null);

    const toggleBatch = (batchKey: string) => {
        setOpenBatches(prev => {
            const next = new Set(prev);
            if (next.has(batchKey)) next.delete(batchKey); else next.add(batchKey);
            return next;
        });
    };

    // Column widths
    const [colWidths, setColWidths] = useState<number[]>(COLUMNS.map(c => c.defaultWidth));
    const [resizingCol, setResizingCol] = useState<number | null>(null);
    const [hoveredHandle, setHoveredHandle] = useState<number | null>(null);
    const resizeStartX = useRef(0);
    const resizeStartW = useRef(0);

    // ── Cell formatting ──
    const [cellFormats, setCellFormats] = useState<Record<string, CellFormat>>({});
    const [selectedCellKey, setSelectedCellKey] = useState<string | null>(null);
    const selectedFormat = selectedCellKey ? (cellFormats[selectedCellKey] || {}) : {};

    const updateFormat = (update: Partial<CellFormat>) => {
        if (!selectedCellKey) return;
        setCellFormats(prev => ({ ...prev, [selectedCellKey]: { ...(prev[selectedCellKey] || {}), ...update } }));
    };

    // ── Search ──
    const [searchQuery, setSearchQuery] = useState('');

    // ── Row heights ──
    const DEFAULT_ROW_HEIGHT = 48;
    const [rowHeights, setRowHeights] = useState<Record<string, number>>({});
    const rowResizeStart = useRef<{ key: string; startY: number; startH: number } | null>(null);

    const startRowResize = (key: string, currentH: number, e: React.MouseEvent) => {
        e.preventDefault();
        rowResizeStart.current = { key, startY: e.clientY, startH: currentH };
        const onMove = (ev: MouseEvent) => {
            if (!rowResizeStart.current) return;
            const delta = ev.clientY - rowResizeStart.current.startY;
            const newH = Math.max(44, rowResizeStart.current.startH + delta);
            setRowHeights(prev => ({ ...prev, [rowResizeStart.current!.key]: newH }));
        };
        const onUp = () => {
            rowResizeStart.current = null;
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
        document.body.style.cursor = 'row-resize';
        document.body.style.userSelect = 'none';
    };

    // ── Comments ──
    const [comments, setComments] = useState<MediaPlanCommentDTO[]>([]);
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; cellKey: string; rowId: string; columnKey: string; mediaPlanId?: number; draftKey?: string } | null>(null);
    const [commentModal, setCommentModal] = useState<{ cellKey: string; columnKey: string; mediaPlanId?: number; draftKey?: string } | null>(null);
    const [commentText, setCommentText] = useState('');
    const [commentTooltip, setCommentTooltip] = useState<{ cellKey: string; x: number; y: number } | null>(null);

    const getCommentsForCell = useCallback((cellKey: string) => {
        // cellKey format: mp-{id}-{col} or {draftKey}-{col}
        return comments.filter(c => {
            const parts = cellKey.split('-');
            if (cellKey.startsWith('mp-')) {
                const mpId = Number(parts[1]);
                const col = parts.slice(2).join('-');
                return c.mediaPlanId === mpId && c.columnKey === col;
            } else {
                const dKey = parts.slice(0, -1).join('-');
                const col = parts[parts.length - 1];
                return c.draftKey === dKey && c.columnKey === col;
            }
        });
    }, [comments]);

    // ── Export CSV ──
    const exportToCSV = () => {
        const headers = COLUMNS.filter(c => c.key !== 'actions').map(c => c.label);
        const escape = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
        const rows = [
            headers.join(','),
            ...monthMediaPlans.map(mp =>
                [mp.datePublication, mp.heure, mp.format, mp.type, mp.titre, mp.texteSurVisuel,
                mp.inspiration, mp.autresElements, mp.platforme, mp.lienDrive,
                mp.etatPublication, mp.rectifs, mp.remarques, mp.isShooting ? 'Oui' : 'Non', mp.statut].map(escape).join(',')
            ),
            ...draftRows.filter(isDraftFilled).map(d =>
                [d.datePublication, d.heure, d.format, d.type, d.titre, d.texteSurVisuel,
                d.inspiration, d.autresElements, d.platforme, d.lienDrive,
                d.etatPublication, d.rectifs, d.remarques, d.isShooting ? 'Oui' : 'Non', 'Brouillon'].map(escape).join(',')
            ),
        ].join('\n');
        const blob = new Blob([rows], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `MediaPlan_${selectedMonth}.csv`;
        a.click(); URL.revokeObjectURL(url);
    };

    // Close context menu on outside click
    useEffect(() => {
        const handler = () => setContextMenu(null);
        window.addEventListener('click', handler);
        return () => window.removeEventListener('click', handler);
    }, []);

    // Referentiels
    const [formats, setFormats] = useState<Referentiel[]>([]);
    const [types, setTypes] = useState<Referentiel[]>([]);
    const [platformes, setPlateformes] = useState<Referentiel[]>([]);

    // Shooting availability (dates dispo)
    const [headProdId, setHeadProdId] = useState<number | null>(null);
    const [availableShootingDates, setAvailableShootingDates] = useState<string[]>([]);
    const [isAvailabilityRestricted, setIsAvailabilityRestricted] = useState(false);
    const [availabilityLoading, setAvailabilityLoading] = useState(false);

    const shootingMonthRange = useMemo(() => {
        const { year, month } = parseMonthKey(selectedMonth);
        const start = `${year}-${String(month + 1).padStart(2, '0')}-01`;
        const endD = new Date(year, month + 1, 0);
        const end = `${year}-${String(month + 1).padStart(2, '0')}-${String(endD.getDate()).padStart(2, '0')}`;
        return { start, end };
    }, [selectedMonth]);

    useEffect(() => { loadReferentiels(); checkGoogleAuth(); }, []);
    useEffect(() => { loadData(); }, [selectedClientId]);

    useEffect(() => {
        if (!selectedClientId) {
            setClientLabel(null);
            return;
        }
        clientService.getClientById(selectedClientId)
            .then((res) => setClientLabel(res.data.data?.nom || null))
            .catch(() => setClientLabel(null));
    }, [selectedClientId]);

    useEffect(() => {
        const fetchHeadProd = async () => {
            try {
                const res = await employeService.getByPermission('VALIDATE_SHOOTING', true)
                    .catch(() => ({ data: { data: [] } } as any));
                const unique = res.data?.data || [];
                setHeadProdId(unique.length > 0 ? unique[0].id : null);
            } catch (e) {
                setHeadProdId(null);
            }
        };
        fetchHeadProd();
    }, []);

    useEffect(() => {
        const fetchAvailableDates = async () => {
            if (!headProdId) {
                setIsAvailabilityRestricted(false);
                setAvailabilityLoading(false);
                setAvailableShootingDates([]);
                return;
            }
            setIsAvailabilityRestricted(true);
            setAvailabilityLoading(true);
            try {
                const { year, month } = parseMonthKey(selectedMonth);
                const allDates = getAllDatesInMonth(year, month);

                const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
                const endD = new Date(year, month + 1, 0);
                const endDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(endD.getDate()).padStart(2, '0')}`;

                const slots: any[] = await calendrierProjetService.getManagerSlotsBetween(headProdId, startDate, endDate);
                const occupied = new Set((slots || []).map(s => s.dateSlot));
                setAvailableShootingDates(allDates.filter(d => !occupied.has(d)));
            } catch (e) {
                // If calendrier endpoint fails, fall back to not restricting choices
                setIsAvailabilityRestricted(false);
                setAvailableShootingDates([]);
            } finally {
                setAvailabilityLoading(false);
            }
        };

        fetchAvailableDates();
    }, [headProdId, selectedMonth]);

    // Fetch comments when month or client changes
    useEffect(() => {
        if (!selectedClientId || !user) return;
        const fetchComments = async () => {
            try {
                const res = await mediaPlanCommentService.getByClientIdAndMonthKey(selectedClientId, selectedMonth);
                setComments(res);
            } catch (e) {
                console.error('Failed to fetch comments', e);
            }
        };
        fetchComments();
    }, [selectedClientId, selectedMonth, user]);

    // ── Column resize ──
    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (resizingCol === null) return;
        const delta = e.clientX - resizeStartX.current;
        const newWidth = Math.max(50, resizeStartW.current + delta);
        setColWidths(prev => { const next = [...prev]; next[resizingCol] = newWidth; return next; });
    }, [resizingCol]);

    const handleMouseUp = useCallback(() => {
        setResizingCol(null);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
    }, []);

    useEffect(() => {
        if (resizingCol !== null) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
        }
        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [resizingCol, handleMouseMove, handleMouseUp]);

    const startResize = (colIndex: number, e: React.MouseEvent) => {
        e.preventDefault();
        resizeStartX.current = e.clientX;
        resizeStartW.current = colWidths[colIndex];
        setResizingCol(colIndex);
    };

    const checkGoogleAuth = async () => {
        try {
            const statusRes = await mediaPlanService.getGoogleAuthStatus();
            setIsGoogleAuthorized(!!statusRes.data.data);
        } catch (e) { console.error(e); }
    };

    const loadData = async () => {
        try {
            setLoading(true);
            setIsForbidden(false);
            if (!user?.employeId) return;

            const isAdmin = (user?.permissions || []).includes('VIEW_TOUS_MEDIA_PLAN');

            if (selectedClientId) {
                if (!isAdmin) {
                    const assignRes = await mediaPlanAssignmentService.getByEmploye(user.employeId);
                    setAssignments(assignRes.data.data || []);
                    const hasAccess = (assignRes.data.data || []).some((a: MediaPlanAssignment) => a.clientId === selectedClientId);
                    if (!hasAccess) {
                        setIsForbidden(true);
                        setLoading(false);
                        return;
                    }
                }
                const mpRes = await mediaPlanService.getByClient(selectedClientId);
                setMediaPlans(mpRes.data.data || []);
            } else {
                const [mpRes, assignRes] = await Promise.all([
                    mediaPlanService.getByEmploye(user.employeId),
                    mediaPlanAssignmentService.getByEmploye(user.employeId),
                ]);
                setMediaPlans(mpRes.data.data || []);
                setAssignments(assignRes.data.data || []);
            }
        } catch (e) {
            console.error('Error loading:', e);
        } finally {
            setLoading(false);
        }
    };

    const loadReferentiels = async () => {
        try {
            const [fRes, tRes, pRes] = await Promise.all([
                referentielService.getActiveByType('FORMAT_MEDIA_PLAN'),
                referentielService.getActiveByType('TYPE_MEDIA_PLAN'),
                referentielService.getActiveByType('PLATFORME_MEDIA_PLAN'),
            ]);
            setFormats(fRes.data.data || []);
            setTypes(tRes.data.data || []);
            setPlateformes(pRes.data.data || []);
        } catch (e) { console.error(e); }
    };

    const clientName = useMemo(() => {
        if (!selectedClientId) return null;
        if (clientLabel) return clientLabel;
        const fromPlan = mediaPlans.find(mp => mp.clientId === selectedClientId);
        if (fromPlan?.clientNom) return fromPlan.clientNom;
        const fromAssign = assignments.find(a => a.clientId === selectedClientId);
        return fromAssign?.clientNom || `Client #${selectedClientId}`;
    }, [selectedClientId, clientLabel, mediaPlans, assignments]);

    // ── Month list ──
    const monthList = useMemo(() => {
        const months: { key: string; label: string; year: number; month: number }[] = [];
        for (let offset = -6; offset <= 6; offset++) {
            const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
            months.push({
                key: getMonthKey(d.getFullYear(), d.getMonth()),
                label: `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`,
                year: d.getFullYear(), month: d.getMonth(),
            });
        }
        return months;
    }, []);

    // ── Filter media plans by selected month ──
    const monthMediaPlans = useMemo(() => {
        const { year, month } = parseMonthKey(selectedMonth);
        return mediaPlans.filter(mp => {
            if (!mp.datePublication) return false;
            const d = new Date(mp.datePublication);
            return d.getFullYear() === year && d.getMonth() === month;
        });
    }, [mediaPlans, selectedMonth]);

    // ── Check if month has sent plans ──
    const isMonthSent = useMemo(() => {
        return monthMediaPlans.some(mp => mp.statut === 'EN_ATTENTE' || mp.statut === 'APPROUVE');
    }, [monthMediaPlans]);

    // ── Group sent plans into batches by dateCreation time gap (>5s gap = new batch) ──
    const sentBatches = useMemo(() => {
        if (!isMonthSent) return [];
        const sorted = [...monthMediaPlans].sort((a, b) => {
            const da = a.dateCreation ? new Date(a.dateCreation).getTime() : 0;
            const db = b.dateCreation ? new Date(b.dateCreation).getTime() : 0;
            return da - db;
        });
        const batches: { key: string; plans: MediaPlan[] }[] = [];
        let currentBatch: MediaPlan[] = [];
        let lastTime = 0;
        for (const mp of sorted) {
            const t = mp.dateCreation ? new Date(mp.dateCreation).getTime() : 0;
            // Within a submission, consecutive API calls are <1s apart
            // Between submissions, there's always 10+ seconds of user interaction
            if (currentBatch.length === 0 || (t - lastTime) < 5000) {
                currentBatch.push(mp);
            } else {
                batches.push({ key: `batch-${batches.length}`, plans: currentBatch });
                currentBatch = [mp];
            }
            lastTime = t;
        }
        if (currentBatch.length > 0) {
            batches.push({ key: `batch-${batches.length}`, plans: currentBatch });
        }
        return batches;
    }, [monthMediaPlans, isMonthSent]);

    const pagedUnsent = useMemo(() => {
        const existing = monthMediaPlans.filter((mp) => rowMatchesSearch(mp, searchQuery));
        const drafts = draftRows.filter((d) => rowMatchesSearch(d, searchQuery));
        const total = existing.length + drafts.length;
        const pageCount = Math.max(1, Math.ceil(Math.max(total, 1) / PAGE_SIZE));
        const page = Math.min(tablePage, pageCount - 1);
        const start = page * PAGE_SIZE;
        const end = start + PAGE_SIZE;
        const existingSlice = existing.slice(start, end);
        const draftStart = Math.max(0, start - existing.length);
        const draftEnd = Math.max(0, end - existing.length);
        return {
            existingSlice,
            draftSlice: drafts.slice(draftStart, draftEnd),
            total,
            pageCount,
            page,
        };
    }, [monthMediaPlans, draftRows, searchQuery, tablePage]);

    const pagedNewPlanDrafts = useMemo(() => {
        const drafts = draftRows.filter((d) => rowMatchesSearch(d, searchQuery));
        const pageCount = Math.max(1, Math.ceil(Math.max(drafts.length, 1) / PAGE_SIZE));
        const page = Math.min(tablePage, pageCount - 1);
        const start = page * PAGE_SIZE;
        return {
            draftSlice: drafts.slice(start, start + PAGE_SIZE),
            total: drafts.length,
            pageCount,
            page,
        };
    }, [draftRows, searchQuery, tablePage]);

    const selectedMonthIndex = monthList.findIndex((m) => m.key === selectedMonth);

    // ── Load drafts ──
    useEffect(() => {
        if (!selectedClientId) return;
        if (isMonthSent && !newPlanOpen) {
            setDraftRows([]);
            return;
        }
        const saved = loadDraftsFromStorage(selectedClientId, selectedMonth);
        if (saved.length > 0) {
            setDraftRows(saved);
            return;
        }
        const { year, month } = parseMonthKey(selectedMonth);
        const d = emptyDraft();
        d.datePublication = `${year}-${String(month + 1).padStart(2, '0')}-01`;
        setDraftRows([d]);
    }, [selectedMonth, monthMediaPlans.length, selectedClientId, isMonthSent, newPlanOpen]);

    useEffect(() => {
        setOpenBatches(new Set());
        setNewPlanOpen(false);
        setTablePage(0);
    }, [selectedMonth]);

    useEffect(() => {
        setTablePage(0);
    }, [searchQuery]);

    // ── Month status for tab coloring ──
    const getMonthStatus = (monthKey: string): 'approved' | 'declined' | 'pending' | 'empty' => {
        const { year, month } = parseMonthKey(monthKey);
        const mps = mediaPlans.filter(mp => {
            if (!mp.datePublication) return false;
            const d = new Date(mp.datePublication);
            return d.getFullYear() === year && d.getMonth() === month;
        });
        if (mps.length === 0) return 'empty';
        if (mps.some(mp => mp.statut === 'DESAPPROUVE')) return 'declined';
        if (mps.every(mp => mp.statut === 'APPROUVE')) return 'approved';
        if (mps.some(mp => mp.statut === 'EN_ATTENTE' || mp.statut === 'APPROUVE')) return 'pending';
        return 'empty';
    };

    const monthTabClass = (monthKey: string) => {
        const status = getMonthStatus(monthKey);
        const base = 'px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-all duration-200 cursor-pointer border ';
        if (monthKey === selectedMonth) {
            if (status === 'approved') return base + 'bg-green-500 text-white border-green-600 shadow-md';
            if (status === 'declined') return base + 'bg-red-500 text-white border-red-600 shadow-md';
            if (status === 'pending') return base + 'bg-warning-500 text-white border-warning-600 shadow-md';
            return base + 'bg-brand-500 text-white border-brand-600 shadow-md';
        }
        if (status === 'approved') return base + 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800 hover:bg-green-100';
        if (status === 'declined') return base + 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800 hover:bg-red-100';
        if (status === 'pending') return base + 'bg-warning-50 text-warning-700 border-warning-200 dark:bg-warning-900/20 dark:text-warning-400 dark:border-warning-800 hover:bg-warning-100';
        return base + 'bg-white text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700';
    };

    const handleGoogleAuth = async () => {
        try {
            const res = await mediaPlanService.getGoogleAuthUrl();
            if (res.data.data) {
                const url = res.data.data as string;
                window.open(url, '_blank');
                // Poll for status change
                const interval = setInterval(async () => {
                    const status = await mediaPlanService.getGoogleAuthStatus();
                    if (status.data.data) {
                        setIsGoogleAuthorized(true);
                        clearInterval(interval);
                    }
                }, 3000);
                setTimeout(() => clearInterval(interval), 60000);
            }
        } catch (e: any) {
            alert('Erreur lors de la récupération de l\'URL d\'autorisation');
        }
    };

    // ===== CELL EDIT =====
    const handleCellChange = async (mp: MediaPlan, field: string, value: any) => {
        if (mp.statut === 'EN_ATTENTE' || mp.statut === 'APPROUVE') return;
        try {
            await mediaPlanService.update(mp.id, { [field]: value } as any);
            setMediaPlans(prev => prev.map(p => {
                if (p.id !== mp.id) return p;
                if (field === 'isShooting' && value === false) {
                    return {
                        ...p,
                        isShooting: false,
                        shootingDescription: null,
                        shootingLocalisation: null,
                        shootingDate: null,
                        shootingTypeDeContenu: null,
                        shootingStatus: null,
                        shootingStatusReason: null,
                        calendrierProjetId: null,
                    };
                }
                return { ...p, [field]: value } as any;
            }));
        } catch (e: any) { console.error(e); }
    };

    const openExpanded = (value: string, readOnly: boolean, onSave: (v: string) => void) => {
        setExpandedCell({ value, readOnly, onSave });
    };

    // ===== ADD ROW =====
    const handleAddRow = () => {
        const { year, month } = parseMonthKey(selectedMonth);
        const draft = emptyDraft();
        draft.datePublication = `${year}-${String(month + 1).padStart(2, '0')}-01`;
        setDraftRows(prev => {
            const next = [...prev, draft];
            if (selectedClientId) saveDraftsToStorage(selectedClientId, selectedMonth, next);
            setTablePage(Math.floor((monthMediaPlans.filter((mp) => rowMatchesSearch(mp, searchQuery)).length + next.length - 1) / PAGE_SIZE));
            return next;
        });
    };

    const handleDraftChange = (index: number, field: keyof DraftRow, value: any) => {
        setDraftRows(prev => {
            const updated = [...prev];
            (updated[index] as any)[field] = value;
            if (field === 'isShooting' && value === false) {
                updated[index] = {
                    ...(updated[index] as any),
                    isShooting: false,
                    shootingDescription: '',
                    shootingLocalisation: '',
                    shootingDate: '',
                    shootingAuPlusTard: '',
                    clientDoitValiderDate: false,
                    shootingTypeDeContenu: '',
                };
            }
            if (selectedClientId) saveDraftsToStorage(selectedClientId, selectedMonth, updated);
            return updated;
        });
    };

    // ===== BULK CONFIRM =====
    const handleBulkConfirm = async () => {
        if (!selectedClientId) return alert('Sélectionnez un client');
        const filledDrafts = draftRows.filter(isDraftFilled);
        const resubmittableExisting = monthMediaPlans.filter(mp => mp.statut === 'DESAPPROUVE' && !mp.retourManager);

        if (filledDrafts.length === 0 && resubmittableExisting.length === 0) {
            return alert('Aucune ligne à envoyer');
        }

        const invalidShooting = filledDrafts.find(d => d.isShooting && !d.shootingAuPlusTard);
        if (invalidShooting) {
            return alert('Indiquez la date au plus tard pour chaque ligne Shooting.');
        }

        const invalidShootingExisting = resubmittableExisting.find(mp => mp.isShooting && !mp.shootingAuPlusTard);
        if (invalidShootingExisting) {
            return alert('Indiquez la date au plus tard pour les lignes Shooting désapprouvées.');
        }

        const confirmMessage =
            filledDrafts.length > 0 && resubmittableExisting.length > 0
                ? `Confirmer et envoyer ${filledDrafts.length} ligne(s) remplie(s) et renvoyer ${resubmittableExisting.length} ligne(s) désapprouvée(s) au manager ?`
                : filledDrafts.length > 0
                    ? `Confirmer et envoyer ${filledDrafts.length} ligne(s) remplie(s) au manager ?`
                    : `Confirmer et envoyer ${resubmittableExisting.length} ligne(s) désapprouvée(s) au manager ?`;

        confirm(confirmMessage, async () => {
            try {
                if (filledDrafts.length > 0) {
                    const requests: MediaPlanRequest[] = filledDrafts.map(draft => ({
                        titre: draft.titre || 'Sans titre',
                        datePublication: draft.datePublication || undefined,
                        heure: draft.heure || undefined,
                        format: draft.format || undefined,
                        type: draft.type || undefined,
                        texteSurVisuel: draft.texteSurVisuel || undefined,
                        inspiration: draft.inspiration || undefined,
                        autresElements: draft.autresElements || undefined,
                        platforme: draft.platforme || undefined,
                        lienDrive: draft.lienDrive || undefined,
                        etatPublication: draft.etatPublication || undefined,
                        rectifs: draft.rectifs || undefined,
                        remarques: draft.remarques || undefined,
                        isShooting: draft.isShooting,
                        shootingDescription: draft.isShooting ? (draft.shootingDescription || undefined) : undefined,
                        shootingLocalisation: draft.isShooting ? (draft.shootingLocalisation || undefined) : undefined,
                        shootingAuPlusTard: draft.isShooting ? (draft.shootingAuPlusTard || undefined) : undefined,
                        clientDoitValiderDate: draft.isShooting ? draft.clientDoitValiderDate : false,
                        shootingTypeDeContenu: draft.isShooting ? ((draft.shootingTypeDeContenu || undefined) as any) : undefined,
                        clientId: selectedClientId,
                        createurId: user?.employeId || 0,
                    }));

                    await mediaPlanService.createBulk(requests);

                    if (selectedClientId) clearDraftsFromStorage(selectedClientId, selectedMonth);
                    setNewPlanOpen(false);
                }

                if (resubmittableExisting.length > 0) {
                    for (const mp of resubmittableExisting) {
                        await mediaPlanService.resubmit(mp.id);
                    }
                }

                await loadData();
            } catch (e: any) {
                alert(e.response?.data?.message || 'Erreur');
            }
        });
    };

    const handleResubmit = (mp: MediaPlan) => {
        if (mp.statut !== 'DESAPPROUVE') return;

        if (mp.isShooting && !mp.shootingAuPlusTard) {
            alert('Indiquez la date au plus tard avant de confirmer et envoyer.');
            return;
        }

        confirm('Confirmer et envoyer cette ligne au manager ?', async () => {
            try {
                await mediaPlanService.resubmit(mp.id);
                await loadData();
            } catch (e: any) {
                alert(e.response?.data?.message || 'Erreur');
            }
        });
    };

    const handleBatchResubmit = (plans: MediaPlan[]) => {
        const disapprovedLines = plans.filter(p => p.statut === 'DESAPPROUVE' && !p.retourManager);
        if (disapprovedLines.length === 0) return;

        const invalidShootingExisting = disapprovedLines.find(mp => mp.isShooting && !mp.shootingAuPlusTard);
        if (invalidShootingExisting) {
            alert('Indiquez la date au plus tard pour les lignes Shooting désapprouvées.');
            return;
        }

        confirm(`Confirmer et envoyer ${disapprovedLines.length} ligne(s) désapprouvée(s) au manager ?`, async () => {
            try {
                for (const mp of disapprovedLines) {
                    await mediaPlanService.resubmit(mp.id);
                }
                await loadData();
            } catch (e: any) {
                alert(e.response?.data?.message || 'Erreur');
            }
        });
    };

    // ===== CLEAR ROW =====
    const handleClearRow = async (mp: MediaPlan) => {
        if (mp.statut === 'EN_ATTENTE' || mp.statut === 'APPROUVE') return;
        try {
            await mediaPlanService.update(mp.id, {
                titre: mp.titre, heure: '', format: '', type: '', texteSurVisuel: '',
                inspiration: '', autresElements: '', platforme: '', lienDrive: '',
                etatPublication: '', rectifs: '', remarques: '',
            } as any);
            setMediaPlans(prev => prev.map(p => p.id === mp.id ? {
                ...p, heure: null, format: null, type: null, texteSurVisuel: null,
                inspiration: null, autresElements: null, platforme: null, lienDrive: null,
                etatPublication: null, rectifs: null, remarques: null,
            } : p));
        } catch (e: any) { console.error(e); }
    };

    const removeDraft = (index: number) => {
        setDraftRows(prev => {
            const updated = prev.filter((_, i) => i !== index);
            if (selectedClientId) saveDraftsToStorage(selectedClientId, selectedMonth, updated);
            return updated;
        });
    };

    const getStatusBadge = (statut: string) => {
        const variants: Record<string, string> = { EN_ATTENTE: 'warning', APPROUVE: 'success', DESAPPROUVE: 'danger' };
        return <Badge variant={(variants[statut] || 'neutral') as any}>{StatutMediaPlanLabels[statut as keyof typeof StatutMediaPlanLabels] || statut}</Badge>;
    };

    const getShootingStatusBadge = (statut: StatutShooting | null) => {
        if (!statut) return null;
        const variants: Record<string, string> = { EN_ATTENTE: 'warning', VALIDE: 'success', REJETE: 'danger' };
        const labels: Record<string, string> = { EN_ATTENTE: 'En attente', VALIDE: 'Validé', REJETE: 'Rejeté' };
        return <Badge variant={(variants[statut] || 'neutral') as any}>{labels[statut] || statut}</Badge>;
    };

    const isReadOnly = (mp: MediaPlan) => mp.statut !== 'DESAPPROUVE' || !!mp.retourManager;

    const inputClass = (ro?: boolean) =>
        `w-full bg-transparent border-0 text-sm text-gray-700 dark:text-gray-300 px-1 py-2.5 focus:outline-none focus:ring-1 focus:ring-brand-500 rounded ${ro ? 'cursor-default opacity-70' : 'hover:bg-gray-50 dark:hover:bg-gray-800 cursor-text'}`;

    const selectClass = (ro?: boolean) =>
        `w-full bg-transparent border-0 text-sm text-gray-700 dark:text-gray-300 px-0 py-2.5 focus:outline-none focus:ring-1 focus:ring-brand-500 rounded ${ro ? 'cursor-default opacity-70 pointer-events-none' : 'hover:bg-gray-50 dark:hover:bg-gray-800'}`;

    // ── Text cell with formatting + right-click comment support ──
    const TextCell: React.FC<{
        cellKey: string;
        value: string; readOnly?: boolean; placeholder?: string; className?: string;
        rowId: string; columnKey: string; mediaPlanId?: number; draftKey?: string;
        onSave: (v: string) => void;
    }> = ({ cellKey, value, readOnly, placeholder, className = '', onSave, rowId, columnKey, mediaPlanId, draftKey }) => {
        const cellValue = value || '';
        const hasLink = cellValue && /(https?:\/\/[^\s]+)/.test(cellValue);
        const fmt = cellFormats[cellKey] || {};
        const cellStyle: React.CSSProperties = {
            fontWeight: fmt.bold ? 'bold' : undefined,
            fontSize: fmt.fontSize ? fmt.fontSize : undefined,
            color: fmt.textColor || undefined,
            backgroundColor: fmt.fillColor || undefined,
        };
        const isSelected = selectedCellKey === cellKey;
        const cellComments = getCommentsForCell(cellKey);
        const hasComments = cellComments.length > 0;

        return (
            <div
                className={`relative ${className}`}
                style={cellStyle}
                onClick={() => setSelectedCellKey(cellKey)}
                onDoubleClick={() => { if (readOnly) openExpanded(cellValue, true, () => { }); }}
                onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setContextMenu({ x: e.clientX, y: e.clientY, cellKey, rowId, columnKey, mediaPlanId, draftKey });
                }}
                onMouseEnter={(e) => { if (hasComments) setCommentTooltip({ cellKey, x: e.clientX, y: e.clientY }); }}
                onMouseLeave={() => setCommentTooltip(null)}
            >
                {readOnly ? (
                    <div
                        className={`${inputClass(true)} cursor-pointer overflow-hidden`}
                        style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', whiteSpace: 'normal', wordBreak: 'break-word', ...cellStyle }}
                        title="Double-cliquez pour voir"
                    >
                        {hasLink ? renderCellValue(cellValue) : (cellValue || '-')}
                    </div>
                ) : (
                    <div
                        onClick={() => openExpanded(cellValue, false, onSave)}
                        className={`${inputClass(false)} overflow-hidden cursor-text ${isSelected ? 'ring-2 ring-brand-500' : ''}`}
                        style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', whiteSpace: 'normal', wordBreak: 'break-word', ...cellStyle, height: "100%" }}
                    >
                        {cellValue || <span className="text-gray-400">{placeholder}</span>}
                    </div>
                )}
                {/* Comment indicator dot */}
                {hasComments && (
                    <div className="absolute top-0 right-0 w-2.5 h-2.5 rounded-bl-sm bg-amber-400" title={`${cellComments.length} commentaire(s)`} />
                )}
            </div>
        );
    };

    // ── Open new plan section ──
    const handleOpenNewPlan = () => {
        setNewPlanOpen(true);
        // Load or create draft rows for the new plan
        if (!selectedClientId) return;
        const saved = loadDraftsFromStorage(selectedClientId, selectedMonth);
        if (saved.length > 0) {
            setDraftRows(saved);
            return;
        }
        const { year, month } = parseMonthKey(selectedMonth);
        const d = emptyDraft();
        d.datePublication = `${year}-${String(month + 1).padStart(2, '0')}-01`;
        setDraftRows([d]);
    };

    // ══════════════════════════════════════════════════
    // ── RENDER TABLE (reusable for both sent & drafts) ──
    // ══════════════════════════════════════════════════
    const renderTableHeader = () => (
        <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0 z-20 shadow-sm">
            <tr>
                {COLUMNS.map((col, ci) => (
                    <th key={col.key}
                        className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 whitespace-nowrap border-r border-gray-200 dark:border-gray-700 relative select-none"
                        style={{ width: colWidths[ci], minWidth: 50, overflow: 'hidden' }}>
                        {col.label}
                        {ci < COLUMNS.length - 1 && (
                            <div style={hoveredHandle === ci || resizingCol === ci ? resizeHandleHoverStyle : resizeHandleStyle}
                                onMouseDown={e => startResize(ci, e)}
                                onMouseEnter={() => setHoveredHandle(ci)}
                                onMouseLeave={() => setHoveredHandle(null)} />
                        )}
                    </th>
                ))}
            </tr>
        </thead>
    );

    const renderExistingRow = (mp: MediaPlan) => {
        const ro = isReadOnly(mp);
        const rowH = rowHeights[`mp-${mp.id}`] || DEFAULT_ROW_HEIGHT;
        return (
            <React.Fragment key={mp.id}>
                <tr className={`transition-colors relative ${ro ? 'bg-gray-50/50 dark:bg-gray-800/30' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'}`} style={{ height: rowH }}>
                    <td className="px-2 py-1 h-[1px] border-r border-gray-100 dark:border-gray-800 overflow-hidden" style={{ width: colWidths[0] }}><input type="date" value={mp.datePublication || ''} readOnly={ro} onChange={e => handleCellChange(mp, 'datePublication', e.target.value)} className={inputClass(ro)} /></td>
                    <td className="px-2 py-1 h-[1px] border-r border-gray-100 dark:border-gray-800 overflow-hidden" style={{ width: colWidths[1] }}>
                        <select value={mp.heure || ''} disabled={ro} onChange={e => handleCellChange(mp, 'heure', e.target.value)} className={selectClass(ro)}>
                            {HOURS.map(h => <option key={h} value={h}>{h || '-'}</option>)}
                        </select>
                    </td>
                    <td className="px-2 py-1 h-[1px] border-r border-gray-100 dark:border-gray-800 overflow-hidden" style={{ width: colWidths[2] }}>
                        <select value={mp.format || ''} disabled={ro} onChange={e => handleCellChange(mp, 'format', e.target.value)} className={selectClass(ro)}>
                            <option value="">-</option>
                            {formats.map(f => <option key={f.id} value={f.libelle}>{f.libelle}</option>)}
                        </select>
                    </td>
                    <td className="px-2 py-1 h-[1px] border-r border-gray-100 dark:border-gray-800 overflow-hidden" style={{ width: colWidths[3] }}>
                        <select value={mp.type || ''} disabled={ro} onChange={e => handleCellChange(mp, 'type', e.target.value)} className={selectClass(ro)}>
                            <option value="">-</option>
                            {types.map(t => <option key={t.id} value={t.libelle}>{t.libelle}</option>)}
                        </select>
                    </td>
                    <td className="px-2 py-1 h-[1px] border-r border-gray-100 dark:border-gray-800 overflow-hidden" style={{ width: colWidths[4] }}><TextCell cellKey={`mp-${mp.id}-titre`} rowId={`mp-${mp.id}`} columnKey="titre" mediaPlanId={mp.id} value={mp.titre} readOnly={ro} onSave={v => handleCellChange(mp, 'titre', v)} className="font-medium" /></td>
                    <td className="px-2 py-1 h-[1px] border-r border-gray-100 dark:border-gray-800 overflow-hidden" style={{ width: colWidths[5] }}><TextCell cellKey={`mp-${mp.id}-texte`} rowId={`mp-${mp.id}`} columnKey="texte" mediaPlanId={mp.id} value={mp.texteSurVisuel || ''} readOnly={ro} onSave={v => handleCellChange(mp, 'texteSurVisuel', v)} /></td>
                    <td className="px-2 py-1 h-[1px] border-r border-gray-100 dark:border-gray-800 overflow-hidden" style={{ width: colWidths[6] }}><TextCell cellKey={`mp-${mp.id}-inspiration`} rowId={`mp-${mp.id}`} columnKey="inspiration" mediaPlanId={mp.id} value={mp.inspiration || ''} readOnly={ro} onSave={v => handleCellChange(mp, 'inspiration', v)} /></td>
                    <td className="px-2 py-1 h-[1px] border-r border-gray-100 dark:border-gray-800 overflow-hidden" style={{ width: colWidths[7] }}><TextCell cellKey={`mp-${mp.id}-autres`} rowId={`mp-${mp.id}`} columnKey="autres" mediaPlanId={mp.id} value={mp.autresElements || ''} readOnly={ro} onSave={v => handleCellChange(mp, 'autresElements', v)} /></td>
                    <td className="px-2 py-1 h-[1px] border-r border-gray-100 dark:border-gray-800 overflow-hidden" style={{ width: colWidths[8] }}>
                        <select value={mp.platforme || ''} disabled={ro} onChange={e => handleCellChange(mp, 'platforme', e.target.value)} className={selectClass(ro)}>
                            <option value="">-</option>
                            {platformes.map(p => <option key={p.id} value={p.libelle}>{p.libelle}</option>)}
                        </select>
                    </td>
                    <td className="px-2 py-1 h-[1px] border-r border-gray-100 dark:border-gray-800 overflow-hidden" style={{ width: colWidths[9] }}><TextCell cellKey={`mp-${mp.id}-lien`} rowId={`mp-${mp.id}`} columnKey="lien" mediaPlanId={mp.id} value={mp.lienDrive || ''} readOnly={ro} onSave={v => handleCellChange(mp, 'lienDrive', v)} /></td>
                    <td className="px-2 py-1 h-[1px] border-r border-gray-100 dark:border-gray-800 overflow-hidden" style={{ width: colWidths[10] }}>
                        <select value={mp.etatPublication || ''} disabled={ro} onChange={e => handleCellChange(mp, 'etatPublication', e.target.value)} className={selectClass(ro)}>
                            <option value="">-</option>
                            {Object.values(EtatPublication).map(ep => <option key={ep} value={ep}>{EtatPublicationLabels[ep]}</option>)}
                        </select>
                    </td>
                    <td className="px-2 py-1 h-[1px] border-r border-gray-100 dark:border-gray-800 overflow-hidden" style={{ width: colWidths[11] }}><TextCell cellKey={`mp-${mp.id}-rectifs`} rowId={`mp-${mp.id}`} columnKey="rectifs" mediaPlanId={mp.id} value={mp.rectifs || ''} readOnly={ro} onSave={v => handleCellChange(mp, 'rectifs', v)} /></td>
                    <td className="px-2 py-1 h-[1px] border-r border-gray-100 dark:border-gray-800 overflow-hidden" style={{ width: colWidths[12] }}><TextCell cellKey={`mp-${mp.id}-remarques`} rowId={`mp-${mp.id}`} columnKey="remarques" mediaPlanId={mp.id} value={mp.remarques || ''} readOnly={ro} onSave={v => handleCellChange(mp, 'remarques', v)} /></td>
                    <td className="px-2 py-1 h-[1px] border-r border-gray-100 dark:border-gray-800 overflow-hidden" style={{ width: colWidths[13] }}>
                        <div className="flex items-center justify-center">
                            <input
                                type="checkbox"
                                checked={!!mp.isShooting}
                                disabled={ro}
                                onChange={e => handleCellChange(mp, 'isShooting', e.target.checked)}
                                className="h-4 w-4 accent-brand-500"
                            />
                        </div>
                    </td>
                    <td className="px-2 py-1 h-[1px] border-r border-gray-100 dark:border-gray-800 overflow-hidden" style={{ width: colWidths[14] }}>
                        {getStatusBadge(mp.statut)}
                        {mp.retourManager && <div className="mt-1 text-[10px] font-semibold text-amber-600">Chez le manager</div>}
                    </td>
                    <td className="px-2 py-1 h-[1px] overflow-hidden" style={{ width: colWidths[15] }}>
                        {!ro && (
                            <div className="flex gap-1">
                                {mp.statut === 'DESAPPROUVE' && (
                                    <button
                                        onClick={() => handleResubmit(mp)}
                                        className="p-1 rounded text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
                                        title="Confirmer et envoyer"
                                    >
                                        <HiOutlineCheck size={15} />
                                    </button>
                                )}
                                <button onClick={() => handleClearRow(mp)} className="p-1 rounded text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors" title="Vider la ligne">
                                    <HiOutlineTrash size={15} />
                                </button>
                            </div>
                        )}
                    </td>
                </tr>

                {mp.isShooting && (
                    <tr className="bg-brand-50/20 dark:bg-brand-900/10">
                        <td colSpan={COLUMNS.length} className="px-3 py-3 border-b border-gray-100 dark:border-gray-800">
                            <div className="text-xs font-semibold text-gray-600 dark:text-gray-300">SHOOTING</div>
                            {ro ? (
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-2 text-sm text-gray-700 dark:text-gray-200">
                                    <div>
                                        <div className="text-[11px] text-gray-400 dark:text-gray-500">Description</div>
                                        <div className="mt-0.5 whitespace-pre-wrap">{mp.shootingDescription || '-'}</div>
                                    </div>
                                    <div>
                                        <div className="text-[11px] text-gray-400 dark:text-gray-500">Localisation</div>
                                        <div className="mt-0.5">{mp.shootingLocalisation || '-'}</div>
                                    </div>
                                    <div>
                                        <div className="text-[11px] text-gray-400 dark:text-gray-500">Au plus tard</div>
                                        <div className="mt-0.5">{mp.shootingAuPlusTard || '-'}</div>
                                        <div className="mt-1 text-[11px] text-gray-400">{mp.clientDoitValiderDate ? 'Le client valide la date' : 'Date validée sans le client'}</div>
                                    </div>
                                    <div>
                                        <div className="text-[11px] text-gray-400 dark:text-gray-500">Type de contenu</div>
                                        <div className="mt-0.5">{mp.shootingTypeDeContenu ? TypeContenuShootingLabels[mp.shootingTypeDeContenu] : '-'}</div>
                                    </div>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-2">
                                    <div>
                                        <label className="block text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">Description</label>
                                        <textarea
                                            value={mp.shootingDescription || ''}
                                            onChange={e => handleCellChange(mp, 'shootingDescription', e.target.value)}
                                            className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
                                            rows={2}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">Localisation</label>
                                        <input
                                            value={mp.shootingLocalisation || ''}
                                            onChange={e => handleCellChange(mp, 'shootingLocalisation', e.target.value)}
                                            className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">Au plus tard</label>
                                        <input
                                            type="date"
                                            value={mp.shootingAuPlusTard || ''}
                                            onChange={e => handleCellChange(mp, 'shootingAuPlusTard', e.target.value)}
                                            className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
                                        />
                                        <label className="mt-2 flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                                            <input type="checkbox" checked={!!mp.clientDoitValiderDate} onChange={e => handleCellChange(mp, 'clientDoitValiderDate', e.target.checked)} />
                                            Le client doit valider la date
                                        </label>
                                        {mp.shootingDate && <p className="mt-1 text-[11px] text-gray-500">Date posée : {mp.shootingDate}</p>}
                                        {mp.shootingStatus === 'EN_ATTENTE_CLIENT_DATE' && (
                                            <div className="mt-2 flex gap-2">
                                                <button type="button" onClick={() => mediaPlanService.confirmShootingDate(mp.id, true).then(() => loadData())} className="text-xs px-2 py-1 rounded bg-green-600 text-white">Le client accepte</button>
                                                <button type="button" onClick={() => mediaPlanService.confirmShootingDate(mp.id, false).then(() => loadData())} className="text-xs px-2 py-1 rounded bg-red-600 text-white">Le client refuse</button>
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">Type de contenu</label>
                                        <select
                                            value={mp.shootingTypeDeContenu || ''}
                                            onChange={e => handleCellChange(mp, 'shootingTypeDeContenu', e.target.value)}
                                            className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
                                        >
                                            <option value="">-</option>
                                            <option value={TypeContenuShooting.PHOTO}>Photo</option>
                                            <option value={TypeContenuShooting.VIDEO}>Vidéo</option>
                                            <option value={TypeContenuShooting.BOTH}>Vidéo + photos</option>
                                        </select>
                                    </div>
                                </div>
                            )}

                            {(mp.shootingStatus || mp.shootingStatusReason) && (
                                <div className="mt-3 flex items-center gap-2">
                                    <span className="text-[11px] text-gray-400 dark:text-gray-500">Statut shooting</span>
                                    {getShootingStatusBadge(mp.shootingStatus)}
                                    {mp.shootingStatus === StatutShooting.REJETE && mp.shootingStatusReason && (
                                        <span className="text-xs text-red-600 dark:text-red-400">({mp.shootingStatusReason})</span>
                                    )}
                                </div>
                            )}
                        </td>
                    </tr>
                )}

                {/* ── Row resize strip ── */}
                <tr>
                    <td colSpan={COLUMNS.length}
                        style={{ height: '5px', padding: 0, cursor: 'row-resize', backgroundColor: 'transparent', borderBottom: '1px solid transparent' }}
                        className="hover:bg-brand-400/30 transition-colors"
                        onMouseDown={e => startRowResize(`mp-${mp.id}`, rowH, e)}
                        title="Faire glisser pour redimensionner la ligne"
                    />
                </tr>
            </React.Fragment>
        );
    };

    const renderDraftRow = (draft: DraftRow) => {
        const idx = draftRows.findIndex((row) => row._key === draft._key);
        if (idx < 0) return null;
        const rowH = rowHeights[draft._key] || DEFAULT_ROW_HEIGHT;
        return (
            <React.Fragment key={draft._key}>
                <tr className="bg-brand-50/30 dark:bg-brand-900/5 hover:bg-brand-50/60 dark:hover:bg-brand-900/10 transition-colors" style={{ height: rowH }}>
                    <td className="px-2 py-1 h-[1px] border-r border-gray-100 dark:border-gray-800 overflow-hidden" style={{ width: colWidths[0] }}><input type="date" value={draft.datePublication} onChange={e => handleDraftChange(idx, 'datePublication', e.target.value)} className={inputClass()} /></td>
                    <td className="px-2 py-1 h-[1px] border-r border-gray-100 dark:border-gray-800 overflow-hidden" style={{ width: colWidths[1] }}>
                        <select value={draft.heure} onChange={e => handleDraftChange(idx, 'heure', e.target.value)} className={selectClass()}>
                            {HOURS.map(h => <option key={h} value={h}>{h || '-'}</option>)}
                        </select>
                    </td>
                    <td className="px-2 py-1 h-[1px] border-r border-gray-100 dark:border-gray-800 overflow-hidden" style={{ width: colWidths[2] }}>
                        <select value={draft.format} onChange={e => handleDraftChange(idx, 'format', e.target.value)} className={selectClass()}>
                            <option value="">-</option>
                            {formats.map(f => <option key={f.id} value={f.libelle}>{f.libelle}</option>)}
                        </select>
                    </td>
                    <td className="px-2 py-1 h-[1px] border-r border-gray-100 dark:border-gray-800 overflow-hidden" style={{ width: colWidths[3] }}>
                        <select value={draft.type} onChange={e => handleDraftChange(idx, 'type', e.target.value)} className={selectClass()}>
                            <option value="">-</option>
                            {types.map(t => <option key={t.id} value={t.libelle}>{t.libelle}</option>)}
                        </select>
                    </td>
                    <td className="px-2 py-1 h-[1px] border-r border-gray-100 dark:border-gray-800 overflow-hidden" style={{ width: colWidths[4] }}><TextCell cellKey={`${draft._key}-titre`} rowId={draft._key} columnKey="titre" draftKey={draft._key} value={draft.titre} placeholder="Titre..." onSave={v => handleDraftChange(idx, 'titre', v)} className="font-medium" /></td>
                    <td className="px-2 py-1 h-[1px] border-r border-gray-100 dark:border-gray-800 overflow-hidden" style={{ width: colWidths[5] }}><TextCell cellKey={`${draft._key}-texte`} rowId={draft._key} columnKey="texte" draftKey={draft._key} value={draft.texteSurVisuel} placeholder="..." onSave={v => handleDraftChange(idx, 'texteSurVisuel', v)} /></td>
                    <td className="px-2 py-1 h-[1px] border-r border-gray-100 dark:border-gray-800 overflow-hidden" style={{ width: colWidths[6] }}><TextCell cellKey={`${draft._key}-inspiration`} rowId={draft._key} columnKey="inspiration" draftKey={draft._key} value={draft.inspiration} placeholder="..." onSave={v => handleDraftChange(idx, 'inspiration', v)} /></td>
                    <td className="px-2 py-1 h-[1px] border-r border-gray-100 dark:border-gray-800 overflow-hidden" style={{ width: colWidths[7] }}><TextCell cellKey={`${draft._key}-autres`} rowId={draft._key} columnKey="autres" draftKey={draft._key} value={draft.autresElements} placeholder="..." onSave={v => handleDraftChange(idx, 'autresElements', v)} /></td>
                    <td className="px-2 py-1 h-[1px] border-r border-gray-100 dark:border-gray-800 overflow-hidden" style={{ width: colWidths[8] }}>
                        <select value={draft.platforme} onChange={e => handleDraftChange(idx, 'platforme', e.target.value)} className={selectClass()}>
                            <option value="">-</option>
                            {platformes.map(p => <option key={p.id} value={p.libelle}>{p.libelle}</option>)}
                        </select>
                    </td>
                    <td className="px-2 py-1 h-[1px] border-r border-gray-100 dark:border-gray-800 overflow-hidden" style={{ width: colWidths[9] }}><TextCell cellKey={`${draft._key}-lien`} rowId={draft._key} columnKey="lien" draftKey={draft._key} value={draft.lienDrive} placeholder="https://..." onSave={v => handleDraftChange(idx, 'lienDrive', v)} /></td>
                    <td className="px-2 py-1 h-[1px] border-r border-gray-100 dark:border-gray-800 overflow-hidden" style={{ width: colWidths[10] }}>
                        <select value={draft.etatPublication} onChange={e => handleDraftChange(idx, 'etatPublication', e.target.value)} className={selectClass()}>
                            <option value="">-</option>
                            {Object.values(EtatPublication).map(ep => <option key={ep} value={ep}>{EtatPublicationLabels[ep]}</option>)}
                        </select>
                    </td>
                    <td className="px-2 py-1 h-[1px] border-r border-gray-100 dark:border-gray-800 overflow-hidden" style={{ width: colWidths[11] }}><TextCell cellKey={`${draft._key}-rectifs`} rowId={draft._key} columnKey="rectifs" draftKey={draft._key} value={draft.rectifs} placeholder="..." onSave={v => handleDraftChange(idx, 'rectifs', v)} /></td>
                    <td className="px-2 py-1 h-[1px] border-r border-gray-100 dark:border-gray-800 overflow-hidden" style={{ width: colWidths[12] }}><TextCell cellKey={`${draft._key}-remarques`} rowId={draft._key} columnKey="remarques" draftKey={draft._key} value={draft.remarques} placeholder="..." onSave={v => handleDraftChange(idx, 'remarques', v)} /></td>
                    <td className="px-2 py-1 h-[1px] border-r border-gray-100 dark:border-gray-800 overflow-hidden" style={{ width: colWidths[13] }}>
                        <div className="flex items-center justify-center">
                            <input
                                type="checkbox"
                                checked={!!draft.isShooting}
                                onChange={e => handleDraftChange(idx, 'isShooting', e.target.checked)}
                                className="h-4 w-4 accent-brand-500"
                            />
                        </div>
                    </td>
                    <td className="px-2 py-1 h-[1px] border-r border-gray-100 dark:border-gray-800 overflow-hidden" style={{ width: colWidths[14] }}><Badge variant="light">Brouillon</Badge></td>
                    <td className="px-2 py-1 h-[1px] overflow-hidden" style={{ width: colWidths[15] }}>
                        <div className="flex gap-1">
                            <button onClick={() => {
                                const { year, month } = parseMonthKey(selectedMonth);
                                setDraftRows(prev => {
                                    const updated = [...prev];
                                    updated[idx] = { ...emptyDraft(), datePublication: `${year}-${String(month + 1).padStart(2, '0')}-01` };
                                    if (selectedClientId) saveDraftsToStorage(selectedClientId, selectedMonth, updated);
                                    return updated;
                                });
                            }} className="p-1 rounded text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors" title="Vider les champs">
                                <HiOutlineRefresh size={15} />
                            </button>
                            <button onClick={() => removeDraft(idx)} className="p-1 rounded text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors" title="Supprimer la ligne">
                                <HiOutlineTrash size={15} />
                            </button>
                        </div>
                    </td>
                </tr>

                {draft.isShooting && (
                    <tr className="bg-brand-50/20 dark:bg-brand-900/10">
                        <td colSpan={COLUMNS.length} className="px-3 py-3 border-b border-gray-100 dark:border-gray-800">
                            <div className="text-xs font-semibold text-gray-600 dark:text-gray-300">SHOOTING</div>
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-2">
                                <div>
                                    <label className="block text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">Description</label>
                                    <textarea
                                        value={draft.shootingDescription}
                                        onChange={e => handleDraftChange(idx, 'shootingDescription', e.target.value)}
                                        className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
                                        rows={2}
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">Localisation</label>
                                    <input
                                        value={draft.shootingLocalisation}
                                        onChange={e => handleDraftChange(idx, 'shootingLocalisation', e.target.value)}
                                        className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">Au plus tard</label>
                                    <input
                                        type="date"
                                        value={draft.shootingAuPlusTard}
                                        onChange={e => handleDraftChange(idx, 'shootingAuPlusTard', e.target.value)}
                                        className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
                                    />
                                    <label className="mt-2 flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                                        <input type="checkbox" checked={draft.clientDoitValiderDate} onChange={e => handleDraftChange(idx, 'clientDoitValiderDate', e.target.checked)} />
                                        Le client doit valider la date
                                    </label>
                                </div>
                                <div>
                                    <label className="block text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">Type de contenu</label>
                                    <select
                                        value={draft.shootingTypeDeContenu}
                                        onChange={e => handleDraftChange(idx, 'shootingTypeDeContenu', e.target.value as any)}
                                        className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
                                    >
                                        <option value="">-</option>
                                        <option value={TypeContenuShooting.PHOTO}>Photo</option>
                                        <option value={TypeContenuShooting.VIDEO}>Vidéo</option>
                                            <option value={TypeContenuShooting.BOTH}>Vidéo + photos</option>
                                    </select>
                                </div>
                            </div>
                        </td>
                    </tr>
                )}

                {/* ── Draft row resize strip ── */}
                <tr>
                    <td colSpan={COLUMNS.length}
                        style={{ height: '5px', padding: 0, cursor: 'row-resize', backgroundColor: 'transparent', borderBottom: '1px solid transparent' }}
                        className="hover:bg-brand-400/30 transition-colors"
                        onMouseDown={e => startRowResize(draft._key, rowH, e)}
                        title="Faire glisser pour redimensionner la ligne"
                    />
                </tr>
            </React.Fragment>
        );
    };

    const tableWidth = colWidths.reduce((s, w) => s + w, 0);

    // ══════════════════════════════════════════════════
    // ── RENDER ──
    // ══════════════════════════════════════════════════

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand-500"></div>
            </div>
        );
    }

    if (!selectedClientId) {
        return (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400 dark:text-gray-500">
                <HiOutlineSearch size={48} className="mb-4 opacity-50" />
                <p className="text-lg font-medium">Sélectionnez un client</p>
                <p className="text-sm mt-1">Choisissez un client dans le menu latéral sous "Media Plan"</p>
            </div>
        );
    }

    const sentStatus = getStatusInfo(monthMediaPlans);

    if (isForbidden) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-center h-[60vh] bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                <HiOutlineShieldCheck size={64} className="text-red-500 mb-4" />
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Accès Refusé</h2>
                <p className="text-gray-500 dark:text-gray-400 max-w-sm mt-2">Vous n'êtes pas autorisé à consulter le Media Plan de ce client car vous n'y êtes pas assigné.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Media Plan</h1>
                    <div className="flex items-center gap-4 mt-1">
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Client : <span className="text-brand-500 font-medium">{clientName}</span>
                        </p>
                        <div
                            className={`text-xs flex items-center gap-1.5 px-2 py-1 rounded ${isGoogleAuthorized
                                ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                                : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                                }`}
                        >
                            <SiGoogledrive size={14} className={isGoogleAuthorized ? 'text-green-600' : 'text-brand-500'} />
                            {isGoogleAuthorized === null ? 'Vérification...' : isGoogleAuthorized ? 'Drive (Bot Connecté)' : 'Drive (Non configuré)'}
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Month tabs ── */}
            <div className="flex items-center gap-2 rounded-xl bg-gray-100 dark:bg-gray-800 p-2">
                <button type="button"
                    disabled={selectedMonthIndex <= 0}
                    onClick={() => selectedMonthIndex > 0 && setSelectedMonth(monthList[selectedMonthIndex - 1].key)}
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-600">
                    <HiChevronLeft size={18} />
                </button>
                <div className="flex gap-2 overflow-x-auto flex-1 pb-0.5 scrollbar-hide">
                    {monthList.map(m => (
                        <button key={m.key} onClick={() => setSelectedMonth(m.key)} className={monthTabClass(m.key)}>
                            {m.label}
                        </button>
                    ))}
                </div>
                <button type="button"
                    disabled={selectedMonthIndex < 0 || selectedMonthIndex >= monthList.length - 1}
                    onClick={() => selectedMonthIndex < monthList.length - 1 && setSelectedMonth(monthList[selectedMonthIndex + 1].key)}
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-600">
                    <HiChevronRight size={18} />
                </button>
            </div>

            {/* ══════════════════════════════════════════════════ */}
            {/* CASE 1: Month has sent plans → collapsible accordion + "add new" button */}
            {/* ══════════════════════════════════════════════════ */}
            {isMonthSent && (
                <>
                    {/* ── Sent plans accordions — one per batch ── */}
                    {sentBatches.map((batch, batchIdx) => {
                        const batchStatus = getStatusInfo(batch.plans);
                        const isOpen = openBatches.has(batch.key);
                        const hasDisapproved = batch.plans.some(p => p.statut === 'DESAPPROUVE');
                        return (
                            <div key={batch.key} className={`rounded-xl border-2 overflow-hidden transition-all duration-300 ${statusColorClasses[batchStatus.color]}`}>
                                <div
                                    role="button"
                                    tabIndex={0}
                                    onClick={() => toggleBatch(batch.key)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault();
                                            toggleBatch(batch.key);
                                        }
                                    }}
                                    className="w-full flex items-center justify-between px-5 py-4 text-left hover:opacity-80 transition-opacity"
                                >
                                    <div className="flex items-center gap-3">
                                        {isOpen
                                            ? <HiOutlineChevronDown size={20} className="transition-transform" />
                                            : <HiOutlineChevronRight size={20} className="transition-transform" />}
                                        <span className="text-base font-semibold">{batchStatus.label}</span>
                                        <span className="text-sm opacity-70">— {batch.plans.length} ligne(s)</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {hasDisapproved && (
                                            <>
                                                <button
                                                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleOpenNewPlan(); }}
                                                    className="flex items-center gap-1 rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-600 transition-colors"
                                                    title="Ajouter une ligne"
                                                >
                                                    <HiOutlinePlus size={14} /> Ajouter ligne
                                                </button>
                                                <button
                                                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleBatchResubmit(batch.plans); }}
                                                    className="flex items-center gap-1 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 transition-colors"
                                                    title="Confirmer et envoyer"
                                                >
                                                    <HiOutlineCheck size={14} /> Confirmer et envoyer
                                                </button>
                                            </>
                                        )}
                                        <Badge variant={
                                            batchStatus.color === 'green' ? 'success' :
                                                batchStatus.color === 'red' ? 'danger' :
                                                    batchStatus.color === 'warning' ? 'warning' : 'neutral' as any
                                        }>{batchStatus.label}</Badge>
                                    </div>
                                </div>

                                {isOpen && (
                                    <div className="overflow-auto max-h-[min(60vh,560px)] border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
                                        <table className="divide-y divide-gray-200 dark:divide-gray-700" style={{ tableLayout: 'fixed', width: tableWidth }}>
                                            {renderTableHeader()}
                                            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                                {batch.plans.map(mp => renderExistingRow(mp))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {/* ── "Add new plan" button ── */}
                    {!newPlanOpen && (
                        <button onClick={handleOpenNewPlan}
                            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-brand-300 dark:border-brand-700 text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-colors font-medium text-sm">
                            <HiOutlinePlus size={18} />
                            Ajouter un nouveau plan média pour ce mois
                        </button>
                    )}

                    {/* ── New plan accordion (draft table) ── */}
                    {newPlanOpen && (
                        <div className="rounded-xl border-2 border-brand-200 dark:border-brand-800 overflow-hidden">
                            <div className="flex items-center justify-between px-5 py-3 bg-brand-50 dark:bg-brand-900/20 border-b border-brand-200 dark:border-brand-800">
                                <div className="flex items-center gap-3">
                                    <HiOutlineChevronDown size={20} className="text-brand-500" />
                                    <span className="text-base font-semibold text-brand-700 dark:text-brand-400">Nouveau plan média</span>
                                    <Badge variant="light">Brouillon</Badge>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={handleAddRow}
                                        className="flex items-center gap-1 rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-600 transition-colors">
                                        <HiOutlinePlus size={14} /> Ajouter ligne
                                    </button>
                                    <button onClick={handleBulkConfirm}
                                        className="flex items-center gap-1 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 transition-colors">
                                        <HiOutlineCheck size={14} /> Confirmer et envoyer
                                    </button>
                                    <button onClick={() => { setNewPlanOpen(false); setDraftRows([]); }}
                                        className="flex items-center gap-1 rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                                        <HiOutlineX size={14} /> Fermer
                                    </button>
                                </div>
                            </div>
                            {/* ── Excel toolbar + Search ── */}
                            <div className="flex flex-wrap items-center gap-3 px-4 py-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                                {/* Bold */}
                                <button
                                    onClick={() => updateFormat({ bold: !selectedFormat.bold })}
                                    title="Gras"
                                    className={`flex items-center justify-center w-7 h-7 rounded font-bold text-sm border transition-colors ${selectedFormat.bold
                                        ? 'bg-brand-500 text-white border-brand-500'
                                        : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                                        }`}
                                >B</button>
                                {/* Font size */}
                                <div className="flex items-center gap-1">
                                    <button onClick={() => updateFormat({ fontSize: Math.max(8, (selectedFormat.fontSize || 14) - 1) })} className="w-5 h-5 flex items-center justify-center rounded border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 text-xs">-</button>
                                    <span className="w-7 text-center text-xs font-medium text-gray-700 dark:text-gray-300">{selectedFormat.fontSize || 14}</span>
                                    <button onClick={() => updateFormat({ fontSize: Math.min(32, (selectedFormat.fontSize || 14) + 1) })} className="w-5 h-5 flex items-center justify-center rounded border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 text-xs">+</button>
                                </div>
                                {/* Text color */}
                                <label className="flex items-center gap-1 cursor-pointer" title="Couleur du texte">
                                    <span className="text-xs font-medium text-gray-600 dark:text-gray-400" style={{ color: selectedFormat.textColor || undefined }}>A</span>
                                    <input type="color" value={selectedFormat.textColor || '#374151'} onChange={e => updateFormat({ textColor: e.target.value })} className="w-6 h-6 rounded cursor-pointer border-0 p-0" />
                                </label>
                                {/* Fill color */}
                                <label className="flex items-center gap-1 cursor-pointer" title="Couleur de fond">
                                    <span className="text-xs font-medium text-gray-600 dark:text-gray-400">🎨</span>
                                    <input type="color" value={selectedFormat.fillColor || '#ffffff'} onChange={e => updateFormat({ fillColor: e.target.value })} className="w-6 h-6 rounded cursor-pointer border-0 p-0" />
                                </label>
                                {/* Clear formatting */}
                                {selectedCellKey && (
                                    <button onClick={() => { if (selectedCellKey) setCellFormats(prev => { const n = { ...prev }; delete n[selectedCellKey]; return n; }); }} className="text-xs text-gray-500 hover:text-red-500 dark:text-gray-400 px-2 py-1 rounded border border-gray-200 dark:border-gray-600 hover:border-red-300 transition-colors" title="Effacer la mise en forme">✕</button>
                                )}
                                <div className="w-px h-5 bg-gray-300 dark:bg-gray-600" />

                                <div className="flex items-center gap-3 ml-auto">
                                    {/* Export */}
                                    <button
                                        onClick={exportToCSV}
                                        className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-gray-700 dark:text-gray-300 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/20 rounded transition-colors border border-transparent hover:border-brand-200 dark:hover:border-brand-800"
                                    >
                                        <HiOutlineDownload size={14} /> Exporter
                                    </button>

                                    <div className="w-px h-5 bg-gray-300 dark:bg-gray-600" />

                                    {/* Search */}
                                    <div className="flex items-center gap-1.5">
                                        <HiOutlineSearch size={14} className="text-gray-400" />
                                        <input
                                            type="text"
                                            placeholder="Rechercher..."
                                            value={searchQuery}
                                            onChange={e => setSearchQuery(e.target.value)}
                                            className="h-7 w-40 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-2 text-xs text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-brand-500"
                                        />
                                        {searchQuery && <button onClick={() => setSearchQuery('')} className="text-gray-400 hover:text-gray-600"><HiOutlineX size={12} /></button>}
                                    </div>
                                </div>
                            </div>
                            <div className="overflow-auto max-h-[min(62vh,620px)] bg-white dark:bg-gray-900">
                                <table className="divide-y divide-gray-200 dark:divide-gray-700" style={{ tableLayout: 'fixed', width: tableWidth }}>
                                    {renderTableHeader()}
                                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                        {pagedNewPlanDrafts.draftSlice.map((draft) => renderDraftRow(draft))}
                                    </tbody>
                                </table>
                            </div>
                            <TablePager
                                page={pagedNewPlanDrafts.page}
                                pageCount={pagedNewPlanDrafts.pageCount}
                                total={pagedNewPlanDrafts.total}
                                onPage={setTablePage}
                            />
                        </div>
                    )}
                </>
            )}

            {/* ══════════════════════════════════════════════════ */}
            {/* CASE 2: Month not sent yet → original table with drafts */}
            {/* ══════════════════════════════════════════════════ */}
            {!isMonthSent && (
                <>
                    {/* ── Excel toolbar + Search ── */}
                    <div className="flex flex-wrap items-center gap-3 px-4 py-2 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                        {/* Bold */}
                        <button
                            onClick={() => updateFormat({ bold: !selectedFormat.bold })}
                            title="Gras"
                            className={`flex items-center justify-center w-7 h-7 rounded font-bold text-sm border transition-colors ${selectedFormat.bold
                                ? 'bg-brand-500 text-white border-brand-500'
                                : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                                }`}
                        >B</button>
                        {/* Font size */}
                        <div className="flex items-center gap-1">
                            <button onClick={() => updateFormat({ fontSize: Math.max(8, (selectedFormat.fontSize || 14) - 1) })} className="w-5 h-5 flex items-center justify-center rounded border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 text-xs">-</button>
                            <span className="w-7 text-center text-xs font-medium text-gray-700 dark:text-gray-300">{selectedFormat.fontSize || 14}</span>
                            <button onClick={() => updateFormat({ fontSize: Math.min(32, (selectedFormat.fontSize || 14) + 1) })} className="w-5 h-5 flex items-center justify-center rounded border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 text-xs">+</button>
                        </div>
                        {/* Text color */}
                        <label className="flex items-center gap-1 cursor-pointer" title="Couleur du texte">
                            <span className="text-xs font-medium text-gray-600 dark:text-gray-400" style={{ color: selectedFormat.textColor || undefined }}>A</span>
                            <input type="color" value={selectedFormat.textColor || '#374151'} onChange={e => updateFormat({ textColor: e.target.value })} className="w-6 h-6 rounded cursor-pointer border-0 p-0" />
                        </label>
                        {/* Fill color */}
                        <label className="flex items-center gap-1 cursor-pointer" title="Couleur de fond">
                            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">🎨</span>
                            <input type="color" value={selectedFormat.fillColor || '#ffffff'} onChange={e => updateFormat({ fillColor: e.target.value })} className="w-6 h-6 rounded cursor-pointer border-0 p-0" />
                        </label>
                        {/* Clear formatting */}
                        {selectedCellKey && (
                            <button onClick={() => { if (selectedCellKey) setCellFormats(prev => { const n = { ...prev }; delete n[selectedCellKey]; return n; }); }} className="text-xs text-gray-500 hover:text-red-500 dark:text-gray-400 px-2 py-1 rounded border border-gray-200 dark:border-gray-600 hover:border-red-300 transition-colors" title="Effacer la mise en forme">✕</button>
                        )}
                        <div className="w-px h-5 bg-gray-300 dark:bg-gray-600" />

                        <div className="flex items-center gap-3 ml-auto">
                            {/* Export */}
                            <button
                                onClick={exportToCSV}
                                className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-gray-700 dark:text-gray-300 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/20 rounded transition-colors border border-transparent hover:border-brand-200 dark:hover:border-brand-800"
                            >
                                <HiOutlineDownload size={14} /> Exporter
                            </button>

                            <div className="w-px h-5 bg-gray-300 dark:bg-gray-600" />

                            {/* Search */}
                            <div className="flex items-center gap-1.5">
                                <HiOutlineSearch size={14} className="text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Rechercher..."
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    className="h-7 w-44 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-2 text-xs text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-brand-500"
                                />
                                {searchQuery && <button onClick={() => setSearchQuery('')} className="text-gray-400 hover:text-gray-600"><HiOutlineX size={12} /></button>}
                            </div>
                        </div>
                    </div>
                    {/* ── Action buttons ── */}
                    <div className="flex gap-2 items-center justify-end">
                        <button onClick={handleAddRow}
                            className="flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-600 transition-colors">
                            <HiOutlinePlus size={16} /> Ajouter ligne
                        </button>
                        <button onClick={handleBulkConfirm}
                            className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-green-700 transition-colors">
                            <HiOutlineCheck size={16} /> Confirmer et envoyer
                        </button>
                    </div>

                    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm overflow-hidden">
                        <div className="overflow-auto max-h-[min(62vh,640px)]">
                            <table className="divide-y divide-gray-200 dark:divide-gray-700" style={{ tableLayout: 'fixed', width: tableWidth }}>
                                {renderTableHeader()}
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                    {pagedUnsent.existingSlice.map(mp => renderExistingRow(mp))}
                                    {pagedUnsent.draftSlice.map((draft) => renderDraftRow(draft))}
                                </tbody>
                            </table>
                        </div>
                        <TablePager
                            page={pagedUnsent.page}
                            pageCount={pagedUnsent.pageCount}
                            total={pagedUnsent.total}
                            onPage={setTablePage}
                        />
                    </div>
                </>
            )}

            {/* Expanded cell overlay */}
            {expandedCell && (
                <ExpandedCell
                    value={expandedCell.value}
                    readOnly={expandedCell.readOnly}
                    onConfirm={(text) => {
                        if (!expandedCell.readOnly) expandedCell.onSave(text);
                        setExpandedCell(null);
                    }}
                    onCancel={() => setExpandedCell(null)}
                />
            )}

            {/* ── Comment Context Menu ── */}
            {contextMenu && (
                <div
                    className="fixed z-[300] bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 py-1 min-w-[160px]"
                    style={{ left: Math.min(contextMenu.x, window.innerWidth - 180), top: Math.min(contextMenu.y, window.innerHeight - 60) }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <button
                        onClick={() => {
                            setCommentModal(contextMenu);
                            setContextMenu(null);
                        }}
                        className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm flex items-center gap-2"
                    >
                        <HiOutlineChatAlt size={16} /> Ajouter un commentaire
                    </button>
                </div>
            )}

            {/* ── Comment Modal ── */}
            {commentModal && (
                <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-gray-900/40" onClick={() => setCommentModal(null)}>
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-md p-4" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-3">
                            <h3 className="font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
                                <HiOutlineChatAlt className="text-brand-500" />
                                {getCommentsForCell(commentModal.cellKey).length > 0 ? 'Commentaires' : 'Nouveau commentaire'}
                            </h3>
                            <button onClick={() => setCommentModal(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                                <HiOutlineX size={18} />
                            </button>
                        </div>
                        <div className="max-h-64 overflow-y-auto mb-4 space-y-2 pr-1">
                            {getCommentsForCell(commentModal.cellKey).map(c => (
                                <div key={c.id} className="text-sm bg-gray-50 dark:bg-gray-900/50 p-2.5 rounded-lg">
                                    <div className="flex justify-between items-start mb-1">
                                        <span className="font-semibold text-brand-600 dark:text-brand-400 text-xs">{c.auteurPrenom} {c.auteurNom}</span>
                                        <div className="flex gap-2 items-center">
                                            <span className="text-[10px] text-gray-400">{new Date(c.createdAt).toLocaleString()}</span>
                                            {c.auteurId === user?.employeId && (
                                                <button onClick={async () => {
                                                    try {
                                                        await mediaPlanCommentService.delete(c.id);
                                                        setComments(prev => prev.filter(x => x.id !== c.id));
                                                    } catch (e) { console.error(e); }
                                                }} className="text-gray-400 hover:text-red-500"><HiOutlineTrash size={12} /></button>
                                            )}
                                        </div>
                                    </div>
                                    <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{c.content}</p>
                                </div>
                            ))}
                        </div>
                        <textarea
                            value={commentText} onChange={e => setCommentText(e.target.value)}
                            placeholder="Écrire un commentaire..." autoFocus
                            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none h-20 mb-3"
                        />
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setCommentModal(null)} className="px-3 py-1.5 text-sm rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-50">Annuler</button>
                            <button disabled={!commentText.trim()} onClick={async () => {
                                try {
                                    const res = await mediaPlanCommentService.create({
                                        mediaPlanId: commentModal.mediaPlanId,
                                        draftKey: commentModal.draftKey,
                                        columnKey: commentModal.columnKey,
                                        auteurId: user!.employeId,
                                        content: commentText.trim(),
                                        clientId: selectedClientId || 0,
                                        monthKey: selectedMonth
                                    });
                                    const newComment = res;
                                    setComments(prev => [...prev, newComment]);
                                    setCommentText('');
                                } catch (e) { console.error(e); }
                            }} className="px-3 py-1.5 text-sm bg-brand-500 text-white rounded hover:bg-brand-600 disabled:opacity-50">Envoyer</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Comment Hover Tooltip ── */}
            {commentTooltip && (
                <div style={{ left: commentTooltip.x + 15, top: commentTooltip.y + 15 }} className="fixed z-[250] bg-white dark:bg-gray-800 rounded shadow-lg border border-gray-200 dark:border-gray-700 max-w-[250px] p-2 pointer-events-none">
                    <div className="space-y-2">
                        {getCommentsForCell(commentTooltip.cellKey).slice(-3).map(c => (
                            <div key={c.id} className="text-xs">
                                <span className="font-semibold text-brand-600 dark:text-brand-400 block">{c.auteurPrenom} {c.auteurNom}:</span>
                                <span className="text-gray-700 dark:text-gray-300 line-clamp-2">{c.content}</span>
                            </div>
                        ))}
                        {getCommentsForCell(commentTooltip.cellKey).length > 3 && (
                            <div className="text-[10px] text-gray-500 italic mt-1">+ {getCommentsForCell(commentTooltip.cellKey).length - 3} autre(s)</div>
                        )}
                    </div>
                </div>
            )}

            <ConfirmDialog {...confirmState} onConfirm={handleConfirm} onCancel={handleCancel} />
        </div>
    );
};

export default MediaPlanPage;
