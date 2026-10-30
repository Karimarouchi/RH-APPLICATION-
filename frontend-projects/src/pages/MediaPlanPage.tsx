import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useParams } from 'react-router-dom';
import {
    HiOutlineTrash,
    HiOutlineSearch,
    HiOutlinePlus,
    HiOutlineX,
    HiOutlineRefresh,
    HiOutlineChevronDown,
    HiOutlineChevronRight,
    HiOutlineDownload,
    HiOutlineChatAlt,
    HiOutlineShieldCheck,
    HiOutlineDotsHorizontal,
    HiOutlineCalendar,
    HiOutlinePaperAirplane,
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
import './MediaPlanGrid.css';

const HOURS = ['', ...Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`)];
const MONTH_NAMES = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
const MIN_ROWS = 1;
const EMPTY_PAD = 5;
const PAGE_SIZE_OPTIONS = [5, 10, 15, 20];

const COLUMNS = [
    { key: 'select', label: '', defaultWidth: 44, sortable: false },
    { key: 'datePublication', label: 'Date pub.', defaultWidth: 150, sortable: true },
    { key: 'titre', label: 'Titre', defaultWidth: 200, sortable: true },
    { key: 'texteSurVisuel', label: 'Texte / Visuel', defaultWidth: 190, sortable: true },
    { key: 'inspiration', label: 'Inspiration', defaultWidth: 170, sortable: true },
    { key: 'platforme', label: 'Plateforme', defaultWidth: 168, sortable: true },
    { key: 'etatPublication', label: 'État pub.', defaultWidth: 150, sortable: true },
    { key: 'statut', label: 'Statut', defaultWidth: 130, sortable: false },
    { key: 'actions', label: '', defaultWidth: 140, sortable: false },
];

type PlatKind = 'ig' | 'fb' | 'tt' | 'li' | 'yt' | 'x' | 'gads' | 'web' | 'default';

const platformMeta = (name?: string | null): { cls: string; kind: PlatKind } => {
    const n = (name || '').toLowerCase();
    if (n.includes('insta')) return { cls: 'mp-plat-ig', kind: 'ig' };
    if (n.includes('face')) return { cls: 'mp-plat-fb', kind: 'fb' };
    if (n.includes('tik')) return { cls: 'mp-plat-tt', kind: 'tt' };
    if (n.includes('link')) return { cls: 'mp-plat-li', kind: 'li' };
    if (n.includes('you') || n.includes('tube')) return { cls: 'mp-plat-yt', kind: 'yt' };
    if (n === 'x' || n.includes('twitter')) return { cls: 'mp-plat-x', kind: 'x' };
    if (n.includes('google') || n.includes('ads')) return { cls: 'mp-plat-gads', kind: 'gads' };
    if (n.includes('web') || n.includes('site')) return { cls: 'mp-plat-web', kind: 'web' };
    return { cls: 'mp-plat-default', kind: 'default' };
};

const PlatMark: React.FC<{ kind: PlatKind; letter?: string }> = ({ kind, letter }) => {
    if (kind === 'ig') return (
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" aria-hidden>
            <rect x="3.2" y="3.2" width="17.6" height="17.6" rx="5" stroke="currentColor" strokeWidth="2" />
            <circle cx="12" cy="12" r="4.1" stroke="currentColor" strokeWidth="2" />
            <circle cx="17.15" cy="6.85" r="1.15" fill="currentColor" />
        </svg>
    );
    if (kind === 'fb') return (
        <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden>
            <path d="M14.2 21v-7.2h2.4l.36-2.8h-2.76V9.2c0-.8.22-1.36 1.38-1.36H17V5.32A18.4 18.4 0 0 0 14.7 5c-2.3 0-3.88 1.4-3.88 4v1.98H8.4v2.8h2.42V21h3.38Z" />
        </svg>
    );
    if (kind === 'tt') return (
        <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" aria-hidden>
            <path d="M14.4 4c.34 2.28 1.7 3.78 3.9 4.02v2.3c-1.34.12-2.56-.32-3.7-1.16v5.5c0 3.7-2.5 6.14-6.02 6.14A5.7 5.7 0 0 1 4 15.4c0-3.2 2.56-5.56 5.86-5.56.34 0 .86.06 1.12.12v2.5a3.4 3.4 0 0 0-1.12-.18c-1.62 0-2.86 1.26-2.86 3.08 0 1.8 1.2 3 2.9 3 1.72 0 2.9-1.2 2.9-3.28V4h1.6Z" />
        </svg>
    );
    if (kind === 'li') return (
        <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden>
            <path d="M6.54 9.3H3.9V20h2.64V9.3ZM5.2 4C4.3 4 3.6 4.7 3.6 5.58c0 .86.7 1.58 1.62 1.58.9 0 1.62-.72 1.62-1.58C6.84 4.7 6.12 4 5.2 4ZM20.1 13.16c0-3.3-1.76-4.84-4.12-4.84-1.9 0-2.74 1.04-3.22 1.78h-.06V9.3H10.1V20h2.64v-5.94c0-1.56.3-3.08 2.24-3.08 1.92 0 1.94 1.8 1.94 3.18V20H19.6v-6.84Z" />
        </svg>
    );
    if (kind === 'yt') return (
        <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" aria-hidden>
            <path d="M21.6 8.2a2.7 2.7 0 0 0-1.9-1.92C18.1 5.8 12 5.8 12 5.8s-6.1 0-7.7.48A2.7 2.7 0 0 0 2.4 8.2 28.4 28.4 0 0 0 2 12a28.4 28.4 0 0 0 .4 3.8 2.7 2.7 0 0 0 1.9 1.92c1.6.48 7.7.48 7.7.48s6.1 0 7.7-.48a2.7 2.7 0 0 0 1.9-1.92A28.4 28.4 0 0 0 22 12a28.4 28.4 0 0 0-.4-3.8ZM10.2 15.05V8.95L15.4 12l-5.2 3.05Z" />
        </svg>
    );
    if (kind === 'x') return (
        <svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor" aria-hidden>
            <path d="M14.7 10.4 21.2 3h-1.54l-5.64 6.44L9.5 3H3.3l6.82 9.72L3.3 21h1.54l5.96-6.82L14.5 21h6.2l-6-10.6Zm-2.1 2.42-.7-1-5.5-7.7h2.36l4.44 6.22.7 1 5.76 8.08h-2.36l-4.7-6.6Z" />
        </svg>
    );
    if (kind === 'gads') return (
        <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden>
            <path d="M7.6 16.8 12 7.2l4.4 9.6H7.6Z" fill="#fbbc04" />
            <path d="M4 18.4 8.4 8.8l3.2 7 2.2 4.8-2.6-2.2H4Z" fill="#4285f4" />
            <path d="M20 18.4h-7.2l-2.2-4.8 3.8-8.4L20 18.4Z" fill="#34a853" />
        </svg>
    );
    if (kind === 'web') return (
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
            <circle cx="12" cy="12" r="8" />
            <path d="M4.4 12h15.2M12 4c2.4 2.4 3.6 5.2 3.6 8s-1.2 5.6-3.6 8c-2.4-2.4-3.6-5.2-3.6-8s1.2-5.6 3.6-8Z" />
        </svg>
    );
    return <span>{letter || '?'}</span>;
};

const PlatformLogo: React.FC<{ name?: string | null }> = ({ name }) => {
    const meta = platformMeta(name);
    return (
        <span className={`mp-plat-ico ${meta.cls}`} aria-hidden>
            <PlatMark kind={meta.kind} letter={(name?.[0] || '?').toUpperCase()} />
        </span>
    );
};

interface ChipOption {
    value: string;
    label: string;
    icon?: React.ReactNode;
}

const ChipSelect: React.FC<{
    value: string;
    options: ChipOption[];
    placeholder?: string;
    disabled?: boolean;
    className?: string;
    onChange: (value: string) => void;
}> = ({ value, options, placeholder = '', disabled, className, onChange }) => {
    const [open, setOpen] = useState(false);
    const btnRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const [pos, setPos] = useState({ top: 0, left: 0, width: 200 });
    const selected = options.find((o) => o.value === value)
        || (value ? { value, label: value, icon: <PlatformLogo name={value} /> } : undefined);

    useEffect(() => {
        if (!open) return;
        const place = () => {
            const r = btnRef.current?.getBoundingClientRect();
            if (!r) return;
            const width = Math.max(r.width, 220);
            const menuH = Math.min(320, (options.length + 1) * 40 + 14);
            let top = r.bottom + 6;
            let left = r.left;
            if (left + width > window.innerWidth - 8) left = Math.max(8, window.innerWidth - width - 8);
            if (top + menuH > window.innerHeight - 8) top = Math.max(8, r.top - 6 - menuH);
            setPos({ top, left, width });
        };
        place();
        const onDown = (e: MouseEvent) => {
            const t = e.target as Node;
            if (btnRef.current?.contains(t) || menuRef.current?.contains(t)) return;
            setOpen(false);
        };
        const onReposition = () => setOpen(false);
        window.addEventListener('mousedown', onDown);
        window.addEventListener('scroll', onReposition, true);
        window.addEventListener('resize', onReposition);
        return () => {
            window.removeEventListener('mousedown', onDown);
            window.removeEventListener('scroll', onReposition, true);
            window.removeEventListener('resize', onReposition);
        };
    }, [open, options.length]);

    return (
        <>
            <button
                ref={btnRef}
                type="button"
                disabled={disabled}
                className={className}
                onClick={() => { if (!disabled) setOpen((o) => !o); }}
            >
                {selected ? (
                    <>
                        {selected.icon}
                        <span className="mp-selectchip-label">{selected.label}</span>
                    </>
                ) : (
                    <span className="mp-selectchip-placeholder">{placeholder}</span>
                )}
            </button>
            {open && createPortal(
                <div ref={menuRef} className="mp-chipmenu" style={{ top: pos.top, left: pos.left, minWidth: pos.width }}>
                    <button type="button" className={!value ? 'active' : ''} onClick={() => { onChange(''); setOpen(false); }}>
                        <span className="mp-plat-ico mp-plat-empty" />
                        {placeholder}
                    </button>
                    {options.map((o) => (
                        <button
                            key={o.value}
                            type="button"
                            className={o.value === value ? 'active' : ''}
                            onClick={() => { onChange(o.value); setOpen(false); }}
                        >
                            {o.icon}
                            {o.label}
                        </button>
                    ))}
                </div>,
                document.body,
            )}
        </>
    );
};

const etatDot = (etat?: string | null) => {
    if (etat === 'PUBLIEE' || etat === 'EN_COURS') return 'mp-dot';
    if (etat === 'SM') return 'mp-dot orange';
    if (etat === 'PAS_ENCORE') return 'mp-dot gray';
    return 'mp-dot gray';
};

const rowMatchesSearch = (obj: object, query: string) =>
    !query || Object.values(obj).some((v) => typeof v === 'string' && v.toLowerCase().includes(query.toLowerCase()));

const TablePager: React.FC<{
    page: number; pageCount: number; total: number; pageSize: number;
    onPage: (page: number) => void; onPageSize: (size: number) => void;
}> = ({ page, pageCount, total, pageSize, onPage, onPageSize }) => (
    <div className="mp-pager">
        <p>{total} ligne{total > 1 ? 's' : ''} au total</p>
        <div className="mp-pager-right">
            <span>Lignes par page</span>
            <select value={pageSize} onChange={(e) => onPageSize(Number(e.target.value))}>
                {PAGE_SIZE_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            <span>{page + 1} / {Math.max(pageCount, 1)}</span>
            <button type="button" disabled={page <= 0} onClick={() => onPage(page - 1)} className="mp-pager-btn">
                <HiChevronLeft size={16} />
            </button>
            <button type="button" disabled={page >= pageCount - 1} onClick={() => onPage(page + 1)} className="mp-pager-btn">
                <HiChevronRight size={16} />
            </button>
        </div>
    </div>
);

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
    etatPublication: string;
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
    etatPublication: '',
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
    d.platforme || d.etatPublication || d.remarques ||
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

// A line refused by the manager comes back to its author with a "motif de refus".
// While the client's feedback is with the manager (retourManager), it is not shown yet.
const hasRefusalMotif = (mp: MediaPlan) => mp.statut === 'DESAPPROUVE' && !mp.retourManager && !!mp.rectifs?.trim();

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
    const [pageSize, setPageSize] = useState(10);
    const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
    const [expandedRowKey, setExpandedRowKey] = useState<string | null>(null);
    const [rowMenuKey, setRowMenuKey] = useState<string | null>(null);
    const [focusedRowKey, setFocusedRowKey] = useState<string | null>(null);
    const [sortKey, setSortKey] = useState<string | null>(null);
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

    // Expanded cell
    const [expandedCell, setExpandedCell] = useState<{
        value: string; readOnly: boolean; onSave: (v: string) => void;
    } | null>(null);

    // Month navigation
    const now = new Date();
    const [selectedMonth, setSelectedMonth] = useState(getMonthKey(now.getFullYear(), now.getMonth()));

    const [isGoogleAuthorized, setIsGoogleAuthorized] = useState<boolean | null>(null);

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
    const DEFAULT_ROW_HEIGHT = 56;
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
        const headers = ['Date pub.', 'Heure', 'Format', 'Type', 'Titre', 'Texte / Visuel', 'Inspiration', 'Autres',
            'Plateforme', 'Lien Drive', 'État pub.', 'Motif de refus', 'Remarques', 'Shooting', 'Statut'];
        const escape = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
        const rows = [
            headers.join(','),
            ...monthMediaPlans.map(mp =>
                [mp.datePublication, mp.heure, mp.format, mp.type, mp.titre, mp.texteSurVisuel,
                mp.inspiration, mp.autresElements, mp.platforme, mp.lienDrive,
                mp.etatPublication, hasRefusalMotif(mp) ? mp.rectifs : '', mp.remarques, mp.isShooting ? 'Oui' : 'Non', mp.statut].map(escape).join(',')
            ),
            ...draftRows.filter(isDraftFilled).map(d =>
                [d.datePublication, d.heure, d.format, d.type, d.titre, d.texteSurVisuel,
                d.inspiration, d.autresElements, d.platforme, '',
                d.etatPublication, '', d.remarques, d.isShooting ? 'Oui' : 'Non', 'Brouillon'].map(escape).join(',')
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
        if (!selectedClientId) setClientLabel(null);
    }, [selectedClientId]);

    useEffect(() => {
        if (!(user?.permissions || []).includes('VALIDATE_SHOOTING')) {
            setHeadProdId(null);
            return;
        }
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
    }, [user?.permissions]);

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

    const platformOptions = useMemo<ChipOption[]>(() => (
        platformes.map((p) => ({ value: p.libelle, label: p.libelle, icon: <PlatformLogo name={p.libelle} /> }))
    ), [platformes]);

    const etatOptions = useMemo<ChipOption[]>(() => (
        Object.values(EtatPublication).map((ep) => ({
            value: ep,
            label: EtatPublicationLabels[ep],
            icon: <span className={etatDot(ep)} />,
        }))
    ), []);

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

    // ── Status summary for the month card ──
    const monthCounts = useMemo(() => ({
        pending: monthMediaPlans.filter(mp => mp.statut === 'EN_ATTENTE' || mp.retourManager).length,
        client: monthMediaPlans.filter(mp => mp.statut === 'EN_ATTENTE_CLIENT').length,
        approved: monthMediaPlans.filter(mp => mp.statut === 'APPROUVE').length,
        refused: monthMediaPlans.filter(mp => mp.statut === 'DESAPPROUVE' && !mp.retourManager).length,
    }), [monthMediaPlans]);

    // All lines of the month (sent + drafts) live in a single table
    const pagedRows = useMemo(() => {
        const existing = monthMediaPlans
            .filter((mp) => rowMatchesSearch(mp, searchQuery))
            .sort((a, b) => (a.datePublication || '').localeCompare(b.datePublication || '') || a.id - b.id);
        const drafts = draftRows.filter((d) => rowMatchesSearch(d, searchQuery));
        const total = existing.length + drafts.length;
        const pageCount = Math.max(1, Math.ceil(Math.max(total, 1) / pageSize));
        const page = Math.min(tablePage, pageCount - 1);
        const start = page * pageSize;
        const end = start + pageSize;
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
    }, [monthMediaPlans, draftRows, searchQuery, tablePage, pageSize]);

    const selectedMonthIndex = monthList.findIndex((m) => m.key === selectedMonth);

    // ── Load drafts ── (an empty month starts with one blank line)
    useEffect(() => {
        if (!selectedClientId) return;
        const saved = loadDraftsFromStorage(selectedClientId, selectedMonth);
        if (saved.length > 0) {
            setDraftRows(saved);
            return;
        }
        if (monthMediaPlans.length > 0) {
            setDraftRows([]);
            return;
        }
        const { year, month } = parseMonthKey(selectedMonth);
        const d = emptyDraft();
        d.datePublication = `${year}-${String(month + 1).padStart(2, '0')}-01`;
        setDraftRows([d]);
    }, [selectedMonth, monthMediaPlans.length, selectedClientId]);

    useEffect(() => {
        setTablePage(0);
        setExpandedRowKey(null);
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
        const active = monthKey === selectedMonth;
        if (active) {
            if (status === 'approved') return 'mp-month-pill active-ok';
            if (status === 'declined') return 'mp-month-pill active-bad';
            if (status === 'pending') return 'mp-month-pill active-warn';
            return 'mp-month-pill active';
        }
        if (status === 'approved') return 'mp-month-pill ok';
        if (status === 'declined') return 'mp-month-pill bad';
        if (status === 'pending') return 'mp-month-pill warn';
        return 'mp-month-pill';
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
            setTablePage(Math.floor((monthMediaPlans.filter((mp) => rowMatchesSearch(mp, searchQuery)).length + next.length - 1) / pageSize));
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
                        // lienDrive is set by the backend (client/month Drive folder)
                        etatPublication: draft.etatPublication || undefined,
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
                    setDraftRows([]);
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

    // ===== CLEAR ROW =====
    // Keeps the Drive link (automatic) and the manager's motif de refus
    const handleClearRow = async (mp: MediaPlan) => {
        if (mp.statut === 'EN_ATTENTE' || mp.statut === 'APPROUVE') return;
        try {
            await mediaPlanService.update(mp.id, {
                titre: mp.titre, heure: '', format: '', type: '', texteSurVisuel: '',
                inspiration: '', autresElements: '', platforme: '',
                etatPublication: '', remarques: '',
            } as any);
            setMediaPlans(prev => prev.map(p => p.id === mp.id ? {
                ...p, heure: null, format: null, type: null, texteSurVisuel: null,
                inspiration: null, autresElements: null, platforme: null,
                etatPublication: null, remarques: null,
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

    const getStatusBadge = (mp: MediaPlan) => {
        // Client feedback is with the manager: the line is not back to the employee yet
        if (mp.retourManager) return <Badge variant="warning">Chez le manager</Badge>;
        const variants: Record<string, string> = { EN_ATTENTE: 'warning', EN_ATTENTE_CLIENT: 'info', APPROUVE: 'success', DESAPPROUVE: 'danger' };
        return <Badge variant={(variants[mp.statut] || 'neutral') as any}>{StatutMediaPlanLabels[mp.statut as keyof typeof StatutMediaPlanLabels] || mp.statut}</Badge>;
    };

    const getShootingStatusBadge = (statut: StatutShooting | null) => {
        if (!statut) return null;
        const variants: Record<string, string> = { EN_ATTENTE: 'warning', VALIDE: 'success', REJETE: 'danger' };
        const labels: Record<string, string> = { EN_ATTENTE: 'En attente', VALIDE: 'Validé', REJETE: 'Rejeté' };
        return <Badge variant={(variants[statut] || 'neutral') as any}>{labels[statut] || statut}</Badge>;
    };

    const isReadOnly = (mp: MediaPlan) => mp.statut !== 'DESAPPROUVE' || !!mp.retourManager;

    const inputClass = (ro?: boolean) => `mp-field ${ro ? 'mp-field-ro' : ''}`;
    const selectClass = (ro?: boolean) => `mp-field ${ro ? 'mp-field-ro pointer-events-none' : ''}`;

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
                onDoubleClick={() => openExpanded(cellValue, !!readOnly, onSave)}
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
                        className={`mp-textcell cursor-pointer overflow-hidden${!cellValue && placeholder !== 'Aucun' ? ' ghost' : ''}`}
                        style={cellStyle}
                        title="Double-cliquez pour voir"
                    >
                        {hasLink ? renderCellValue(cellValue) : (cellValue || <span className="mp-placeholder">{placeholder || ''}</span>)}
                    </div>
                ) : (
                    <input
                        className={`mp-field ${isSelected ? 'selected' : ''}`}
                        style={cellStyle}
                        defaultValue={cellValue}
                        key={`${cellKey}:${cellValue}`}
                        placeholder={placeholder || ''}
                        onBlur={(e) => { if (e.target.value !== cellValue) onSave(e.target.value); }}
                        onKeyDown={(e) => { if (e.key === 'Enter') { (e.target as HTMLInputElement).blur(); } }}
                    />
                )}
                {hasComments && (
                    <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-amber-400" title={`${cellComments.length} commentaire(s)`} />
                )}
            </div>
        );
    };

    // "Suivant" opens the second group of fields of a line (heure, format, type, …)
    const renderNextButton = (rowKey: string, expanded: boolean, readOnly?: boolean) => (
        <button
            type="button"
            className={`mp-next-btn${expanded ? ' open' : ''}`}
            onClick={(e) => { e.stopPropagation(); setExpandedRowKey(expanded ? null : rowKey); setRowMenuKey(null); }}
            aria-expanded={expanded}
            title={readOnly ? 'Voir les autres champs' : 'Remplir les autres champs de la ligne'}
        >
            {expanded ? 'Réduire' : readOnly ? 'Détails' : 'Suivant'}
            {expanded ? <HiOutlineChevronDown size={14} /> : <HiOutlineChevronRight size={14} />}
        </button>
    );

    // ══════════════════════════════════════════════════
    // ── RENDER TABLE (reusable for both sent & drafts) ──
    // ══════════════════════════════════════════════════
    const toggleSelect = (key: string) => {
        setSelectedKeys(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key); else next.add(key);
            return next;
        });
    };

    const toggleSort = (key: string) => {
        if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        else { setSortKey(key); setSortDir('asc'); }
    };

    const renderTableHeader = (rowKeys: string[] = []) => {
        const allSelected = rowKeys.length > 0 && rowKeys.every((k) => selectedKeys.has(k));
        return (
            <thead>
                <tr>
                    {COLUMNS.map((col, ci) => (
                        <th key={col.key} className={ci === 0 ? 'mp-td-sticky' : ''} style={{ width: colWidths[ci], minWidth: ci === 0 ? 36 : 80 }}>
                            {col.key === 'select' ? (
                                <input
                                    type="checkbox"
                                    className="mp-check"
                                    checked={allSelected}
                                    onChange={() => {
                                        setSelectedKeys((prev) => {
                                            if (allSelected) return new Set([...prev].filter((k) => !rowKeys.includes(k)));
                                            return new Set([...prev, ...rowKeys]);
                                        });
                                    }}
                                />
                            ) : col.sortable ? (
                                <button type="button" className="mp-th-sort" onClick={() => toggleSort(col.key)}>
                                    {col.label}
                                    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M2 3.6 5 1.4 8 3.6M2 6.4 5 8.6 8 6.4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
                                </button>
                            ) : col.label}
                            {ci > 0 && ci < COLUMNS.length - 1 && (
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
    };

    const renderGhostRow = (i: number) => (
        <tr key={`ghost-${i}`} className="mp-row mp-row-empty" onClick={handleAddRow}>
            <td><input type="checkbox" className="mp-check" disabled /></td>
            {COLUMNS.slice(1, -1).map((col) => (
                <td key={col.key}><div className={col.key === 'datePublication' ? 'mp-date ghost' : 'mp-field ghost'} /></td>
            ))}
            <td><button type="button" className="mp-icon-btn" tabIndex={-1}><HiOutlineDotsHorizontal size={18} /></button></td>
        </tr>
    );

    const renderExistingRow = (mp: MediaPlan) => {
        const ro = isReadOnly(mp);
        const rowH = rowHeights[`mp-${mp.id}`] || DEFAULT_ROW_HEIGHT;
        const rowKey = `mp-${mp.id}`;
        const expanded = expandedRowKey === rowKey;
        return (
            <React.Fragment key={mp.id}>
                <tr className={`mp-row ${ro ? 'mp-row-locked' : ''}`}>
                    <td className="mp-td-sticky">
                        <input type="checkbox" className="mp-check" checked={selectedKeys.has(rowKey)} onChange={() => toggleSelect(rowKey)} />
                    </td>
                    <td>
                        <div className={`mp-date${mp.datePublication ? '' : ' ghost'}`}>
                            <HiOutlineCalendar size={16} />
                            <input type="date" value={mp.datePublication || ''} readOnly={ro} onChange={e => handleCellChange(mp, 'datePublication', e.target.value)} />
                        </div>
                    </td>
                    <td><TextCell cellKey={`${rowKey}-titre`} rowId={rowKey} columnKey="titre" mediaPlanId={mp.id} value={mp.titre} readOnly={ro} onSave={v => handleCellChange(mp, 'titre', v)} /></td>
                    <td><TextCell cellKey={`${rowKey}-texte`} rowId={rowKey} columnKey="texte" mediaPlanId={mp.id} value={mp.texteSurVisuel || ''} readOnly={ro} onSave={v => handleCellChange(mp, 'texteSurVisuel', v)} /></td>
                    <td><TextCell cellKey={`${rowKey}-inspiration`} rowId={rowKey} columnKey="inspiration" mediaPlanId={mp.id} value={mp.inspiration || ''} readOnly={ro} onSave={v => handleCellChange(mp, 'inspiration', v)} /></td>
                    <td>
                        <ChipSelect
                            className={`mp-selectchip${mp.platforme ? '' : ' ghost'}`}
                            value={mp.platforme || ''}
                            options={platformOptions}
                            placeholder="Plateforme"
                            disabled={ro}
                            onChange={(v) => handleCellChange(mp, 'platforme', v)}
                        />
                    </td>
                    <td>
                        <ChipSelect
                            className={`mp-status${mp.etatPublication ? '' : ' ghost'}`}
                            value={mp.etatPublication || ''}
                            options={etatOptions}
                            placeholder="État"
                            disabled={ro}
                            onChange={(v) => handleCellChange(mp, 'etatPublication', v)}
                        />
                    </td>
                    <td>{getStatusBadge(mp)}</td>
                    <td className="relative">
                        <div className="mp-row-actions">
                            {renderNextButton(rowKey, expanded, ro)}
                            {!ro && (
                                <button type="button" className="mp-icon-btn" onClick={() => setRowMenuKey(rowMenuKey === rowKey ? null : rowKey)}>
                                    <HiOutlineDotsHorizontal size={18} />
                                </button>
                            )}
                        </div>
                        {rowMenuKey === rowKey && !ro && (
                            <div className="mp-menu">
                                <button type="button" onClick={() => { setRowMenuKey(null); handleResubmit(mp); }}>Confirmer et envoyer</button>
                                <button type="button" onClick={() => { setRowMenuKey(null); handleClearRow(mp); }}>Vider la ligne</button>
                            </div>
                        )}
                    </td>
                </tr>
                {hasRefusalMotif(mp) && (
                    <tr>
                        <td colSpan={COLUMNS.length} className="!p-0 !bg-transparent border-0">
                            <div className="mp-refusal" role="note">
                                <span className="mp-refusal-label">Motif de refus</span>
                                <p>{mp.rectifs}</p>
                            </div>
                        </td>
                    </tr>
                )}
                {expanded && (
                    <tr>
                        <td colSpan={COLUMNS.length} className="!p-0 !bg-transparent border-0">
                            <div className="mp-details">
                                <div>
                                    <label>Heure</label>
                                    <select value={mp.heure || ''} disabled={ro} onChange={e => handleCellChange(mp, 'heure', e.target.value)} className={selectClass(ro)}>
                                        {HOURS.map(h => <option key={h} value={h}>{h || '-'}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label>Format</label>
                                    <select value={mp.format || ''} disabled={ro} onChange={e => handleCellChange(mp, 'format', e.target.value)} className={selectClass(ro)}>
                                        <option value="">-</option>
                                        {formats.map(f => <option key={f.id} value={f.libelle}>{f.libelle}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label>Type</label>
                                    <select value={mp.type || ''} disabled={ro} onChange={e => handleCellChange(mp, 'type', e.target.value)} className={selectClass(ro)}>
                                        <option value="">-</option>
                                        {types.map(t => <option key={t.id} value={t.libelle}>{t.libelle}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label>Autres</label>
                                    <TextCell cellKey={`${rowKey}-autres`} rowId={rowKey} columnKey="autres" mediaPlanId={mp.id} value={mp.autresElements || ''} readOnly={ro} onSave={v => handleCellChange(mp, 'autresElements', v)} />
                                </div>
                                <div>
                                    <label>Remarques</label>
                                    <TextCell cellKey={`${rowKey}-remarques`} rowId={rowKey} columnKey="remarques" mediaPlanId={mp.id} value={mp.remarques || ''} readOnly={ro} onSave={v => handleCellChange(mp, 'remarques', v)} />
                                </div>
                                <div>
                                    <label>Shooting</label>
                                    <input type="checkbox" className="mp-check" checked={!!mp.isShooting} disabled={ro} onChange={e => handleCellChange(mp, 'isShooting', e.target.checked)} />
                                </div>
                                <div>
                                    <label>Lien Drive</label>
                                    <div className="mp-drive-link">
                                        <SiGoogledrive size={14} />
                                        {mp.lienDrive
                                            ? <a href={mp.lienDrive} target="_blank" rel="noopener noreferrer">Ouvrir le dossier</a>
                                            : <span>Généré automatiquement</span>}
                                    </div>
                                </div>
                            </div>
                        </td>
                    </tr>
                )}

                {mp.isShooting && (
                    <tr>
                        <td colSpan={COLUMNS.length} className="!p-2 !bg-transparent border-0">
                            <div className="mp-shooting-panel">
                            <div className="text-xs font-semibold tracking-wider text-[var(--text-2)]">SHOOTING</div>
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
                            </div>
                        </td>
                    </tr>
                )}

                <tr className="mp-row-resizer">
                    <td colSpan={COLUMNS.length}
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
        const expanded = expandedRowKey === draft._key;
        return (
            <React.Fragment key={draft._key}>
                <tr className="mp-row" onClick={() => setFocusedRowKey(draft._key)}>
                    <td className="mp-td-sticky">
                        <input type="checkbox" className="mp-check" checked={selectedKeys.has(draft._key)} onChange={() => toggleSelect(draft._key)} />
                    </td>
                    <td>
                        <div className={`mp-date${!draft.datePublication ? ' ghost' : ''}`}>
                            <HiOutlineCalendar size={16} />
                            <input type="date" value={draft.datePublication} onChange={e => handleDraftChange(idx, 'datePublication', e.target.value)} />
                        </div>
                    </td>
                    <td><TextCell cellKey={`${draft._key}-titre`} rowId={draft._key} columnKey="titre" draftKey={draft._key} value={draft.titre} placeholder="Nom du post" onSave={v => handleDraftChange(idx, 'titre', v)} /></td>
                    <td><TextCell cellKey={`${draft._key}-texte`} rowId={draft._key} columnKey="texte" draftKey={draft._key} value={draft.texteSurVisuel} placeholder="Texte visuel" onSave={v => handleDraftChange(idx, 'texteSurVisuel', v)} /></td>
                    <td><TextCell cellKey={`${draft._key}-inspiration`} rowId={draft._key} columnKey="inspiration" draftKey={draft._key} value={draft.inspiration} placeholder="Référence" onSave={v => handleDraftChange(idx, 'inspiration', v)} /></td>
                    <td>
                        <ChipSelect
                            className={`mp-selectchip${draft.platforme ? '' : ' ghost'}`}
                            value={draft.platforme}
                            options={platformOptions}
                            placeholder="Plateforme"
                            onChange={(v) => handleDraftChange(idx, 'platforme', v)}
                        />
                    </td>
                    <td>
                        <ChipSelect
                            className={`mp-status${draft.etatPublication ? '' : ' ghost'}`}
                            value={draft.etatPublication}
                            options={etatOptions}
                            placeholder="État"
                            onChange={(v) => handleDraftChange(idx, 'etatPublication', v)}
                        />
                    </td>
                    <td><Badge variant="light">Brouillon</Badge></td>
                    <td className="relative">
                        <div className="mp-row-actions">
                            {renderNextButton(draft._key, expanded)}
                            <button type="button" className="mp-icon-btn" onClick={(e) => { e.stopPropagation(); setRowMenuKey(rowMenuKey === draft._key ? null : draft._key); }}>
                                <HiOutlineDotsHorizontal size={18} />
                            </button>
                        </div>
                        {rowMenuKey === draft._key && (
                            <div className="mp-menu">
                                <button type="button" onClick={() => {
                                    const { year, month } = parseMonthKey(selectedMonth);
                                    setDraftRows(prev => {
                                        const updated = [...prev];
                                        updated[idx] = { ...emptyDraft(), datePublication: `${year}-${String(month + 1).padStart(2, '0')}-01` };
                                        if (selectedClientId) saveDraftsToStorage(selectedClientId, selectedMonth, updated);
                                        return updated;
                                    });
                                    setRowMenuKey(null);
                                }}>Vider les champs</button>
                                <button type="button" onClick={() => { setRowMenuKey(null); removeDraft(idx); }}>Supprimer la ligne</button>
                            </div>
                        )}
                    </td>
                </tr>
                {expanded && (
                    <tr>
                        <td colSpan={COLUMNS.length} className="!p-0 !bg-transparent border-0">
                            <div className="mp-details">
                                <div>
                                    <label>Heure</label>
                                    <select value={draft.heure} onChange={e => handleDraftChange(idx, 'heure', e.target.value)} className={selectClass()}>
                                        {HOURS.map(h => <option key={h} value={h}>{h || '-'}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label>Format</label>
                                    <select value={draft.format} onChange={e => handleDraftChange(idx, 'format', e.target.value)} className={selectClass()}>
                                        <option value="">-</option>
                                        {formats.map(f => <option key={f.id} value={f.libelle}>{f.libelle}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label>Type</label>
                                    <select value={draft.type} onChange={e => handleDraftChange(idx, 'type', e.target.value)} className={selectClass()}>
                                        <option value="">-</option>
                                        {types.map(t => <option key={t.id} value={t.libelle}>{t.libelle}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label>Autres</label>
                                    <TextCell cellKey={`${draft._key}-autres`} rowId={draft._key} columnKey="autres" draftKey={draft._key} value={draft.autresElements} onSave={v => handleDraftChange(idx, 'autresElements', v)} />
                                </div>
                                <div>
                                    <label>Remarques</label>
                                    <TextCell cellKey={`${draft._key}-remarques`} rowId={draft._key} columnKey="remarques" draftKey={draft._key} value={draft.remarques} onSave={v => handleDraftChange(idx, 'remarques', v)} />
                                </div>
                                <div>
                                    <label>Shooting</label>
                                    <input type="checkbox" className="mp-check" checked={!!draft.isShooting} onChange={e => handleDraftChange(idx, 'isShooting', e.target.checked)} />
                                </div>
                                <div>
                                    <label>Lien Drive</label>
                                    <div className="mp-drive-link">
                                        <SiGoogledrive size={14} />
                                        <span>Généré automatiquement à l'envoi</span>
                                    </div>
                                </div>
                            </div>
                        </td>
                    </tr>
                )}

                {draft.isShooting && (
                    <tr>
                        <td colSpan={COLUMNS.length} className="!p-2 !bg-transparent border-0">
                            <div className="mp-shooting-panel">
                            <div className="text-xs font-semibold tracking-wider text-[var(--text-2)]">SHOOTING</div>
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
                            </div>
                        </td>
                    </tr>
                )}

                <tr className="mp-row-resizer">
                    <td colSpan={COLUMNS.length}
                        onMouseDown={e => startRowResize(draft._key, rowH, e)}
                        title="Faire glisser pour redimensionner la ligne"
                    />
                </tr>
            </React.Fragment>
        );
    };

    const tableWidth = colWidths.reduce((s, w) => s + w, 0);

    const renderFormatToolbar = (actions?: React.ReactNode) => (
        <div className="mp-toolbar">
            <input type="checkbox" className="mp-check" readOnly tabIndex={-1} />
            <div className="mp-size">
                <button type="button" onClick={() => updateFormat({ fontSize: Math.max(8, (selectedFormat.fontSize || 14) - 1) })}>−</button>
                <span>{selectedFormat.fontSize || 14}</span>
                <button type="button" onClick={() => updateFormat({ fontSize: Math.min(32, (selectedFormat.fontSize || 14) + 1) })}>+</button>
            </div>
            <label className="mp-tool relative overflow-hidden" title="Couleur du texte">
                <span style={{ color: selectedFormat.textColor || undefined, fontWeight: 800 }}>A</span>
                <input type="color" value={selectedFormat.textColor || '#374151'} onChange={e => updateFormat({ textColor: e.target.value })} className="absolute inset-0 opacity-0 cursor-pointer" />
            </label>
            <label className="mp-tool relative overflow-hidden" title="Couleur de fond">
                <span className="w-3.5 h-3.5 rounded-sm border border-gray-200" style={{ background: selectedFormat.fillColor || '#fff' }} />
                <input type="color" value={selectedFormat.fillColor || '#ffffff'} onChange={e => updateFormat({ fillColor: e.target.value })} className="absolute inset-0 opacity-0 cursor-pointer" />
            </label>
            <button type="button" onClick={exportToCSV} className="mp-export">
                <HiOutlineDownload size={15} /> Exporter <HiOutlineChevronDown size={14} />
            </button>
            <div className="mp-search">
                <HiOutlineSearch size={15} className="text-[#9ca3af]" />
                <input type="text" placeholder="Rechercher une ligne…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                {searchQuery && <button type="button" onClick={() => setSearchQuery('')} className="text-[#9ca3af]"><HiOutlineX size={12} /></button>}
            </div>
            {actions && <div className="mp-actions">{actions}</div>}
        </div>
    );

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
        <div className="mp-page">
            <div className="mp-hero">
                <h1>Media Plan</h1>
                <div className="mp-hero-meta">
                    <span className="mp-chip mp-chip-brand">Client : {clientName}</span>
                    <span className={`mp-chip ${isGoogleAuthorized ? 'mp-chip-ok' : 'mp-chip-warn'}`}>
                        <SiGoogledrive size={13} />
                        {isGoogleAuthorized === null ? 'Vérification Drive…' : isGoogleAuthorized ? 'Drive connecté' : 'Drive non configuré'}
                    </span>
                </div>
            </div>

            <div className="mp-months">
                <button type="button"
                    disabled={selectedMonthIndex <= 0}
                    onClick={() => selectedMonthIndex > 0 && setSelectedMonth(monthList[selectedMonthIndex - 1].key)}
                    className="mp-month-nav">
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
                    className="mp-month-nav">
                    <HiChevronRight size={18} />
                </button>
            </div>

            {/* All lines of the month (sent + drafts) in a single card */}
            <div className="mp-shell">
                {monthMediaPlans.length > 0 && (
                    <div className="mp-summary">
                        <span className="mp-summary-title">{monthList[selectedMonthIndex]?.label} · {monthMediaPlans.length} ligne{monthMediaPlans.length > 1 ? 's' : ''} envoyée{monthMediaPlans.length > 1 ? 's' : ''}</span>
                        {monthCounts.pending > 0 && <Badge variant="warning">{monthCounts.pending} chez le manager</Badge>}
                        {monthCounts.client > 0 && <Badge variant="info">{monthCounts.client} chez le client</Badge>}
                        {monthCounts.approved > 0 && <Badge variant="success">{monthCounts.approved} approuvée{monthCounts.approved > 1 ? 's' : ''}</Badge>}
                        {monthCounts.refused > 0 && <Badge variant="danger">{monthCounts.refused} à corriger</Badge>}
                    </div>
                )}
                {renderFormatToolbar(
                    <>
                        <button type="button" onClick={handleAddRow} className="mp-btn mp-btn-brand">
                            <HiOutlinePlus size={16} /> Ajouter ligne
                        </button>
                        <button type="button" onClick={handleBulkConfirm} className="mp-btn mp-btn-ok">
                            <HiOutlinePaperAirplane size={16} /> Confirmer et envoyer
                        </button>
                    </>
                )}
                <div className="mp-scroll">
                    <table className="mp-table" style={{ tableLayout: 'fixed', width: tableWidth }}>
                        {renderTableHeader([
                            ...pagedRows.existingSlice.map((mp) => `mp-${mp.id}`),
                            ...pagedRows.draftSlice.map((d) => d._key),
                        ])}
                        <tbody>
                            {pagedRows.existingSlice.map(mp => renderExistingRow(mp))}
                            {pagedRows.draftSlice.map((draft) => renderDraftRow(draft))}
                            {Array.from({ length: Math.max(0, EMPTY_PAD - pagedRows.existingSlice.length - pagedRows.draftSlice.length) }, (_, i) => renderGhostRow(i))}
                        </tbody>
                    </table>
                </div>
                <TablePager
                    page={pagedRows.page}
                    pageCount={pagedRows.pageCount}
                    total={pagedRows.total}
                    pageSize={pageSize}
                    onPage={setTablePage}
                    onPageSize={(n) => { setPageSize(n); setTablePage(0); }}
                />
            </div>

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
