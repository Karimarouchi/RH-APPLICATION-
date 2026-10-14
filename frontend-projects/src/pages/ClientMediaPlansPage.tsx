import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
    HiOutlineChevronDown,
    HiOutlineSearch,
    HiOutlinePhotograph,
    HiOutlineExternalLink,
    HiOutlineCheck,
    HiOutlineX,
    HiOutlineClock,
} from 'react-icons/hi';
import { useAuth } from '../context/AuthContext';
import { mediaPlanService } from '../api/mediaPlanService';
import { clientService } from '../api/clientService';
import { reactifService } from '../api/reactifService';
import Modal from '../components/ui/Modal';
import {
    MediaPlan,
    EtatPublicationLabels,
    StatutMediaPlanLabels,
    StatutShooting,
    TypeContenuShootingLabels,
} from '../types';
import Badge from '../components/ui/Badge';

const MONTH_NAMES = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

const COLUMNS = [
    { key: 'datePublication', label: 'Date Pub.', defaultWidth: 130 },
    { key: 'heure', label: 'Heure', defaultWidth: 90 },
    { key: 'format', label: 'Format', defaultWidth: 110 },
    { key: 'type', label: 'Type', defaultWidth: 110 },
    { key: 'titre', label: 'Titre', defaultWidth: 150 },
    { key: 'texteSurVisuel', label: 'Texte/Visuel', defaultWidth: 130 },
    { key: 'inspiration', label: 'Inspiration', defaultWidth: 120 },
    { key: 'platforme', label: 'Platforme', defaultWidth: 110 },
    { key: 'lienDrive', label: 'Lien Drive', defaultWidth: 120 },
    { key: 'etatPublication', label: 'État Pub.', defaultWidth: 110 },
    { key: 'statut', label: 'Statut', defaultWidth: 110 },
    { key: 'rectifs', label: 'RECTIFS', defaultWidth: 180 },
    { key: 'actions', label: 'Actions client', defaultWidth: 160 },
];

const APPROVED_COLUMNS = [
    { key: 'datePublication', label: 'Date Pub.', defaultWidth: 130 },
    { key: 'heure', label: 'Heure', defaultWidth: 90 },
    { key: 'format', label: 'Format', defaultWidth: 110 },
    { key: 'type', label: 'Type', defaultWidth: 110 },
    { key: 'titre', label: 'Titre', defaultWidth: 150 },
    { key: 'texteSurVisuel', label: 'Texte/Visuel', defaultWidth: 130 },
    { key: 'inspiration', label: 'Inspiration', defaultWidth: 120 },
    { key: 'platforme', label: 'Platforme', defaultWidth: 110 },
    { key: 'lienDrive', label: 'Lien Drive', defaultWidth: 120 },
    { key: 'etatPublication', label: 'État Pub.', defaultWidth: 110 },
    { key: 'statut', label: 'Statut', defaultWidth: 110 },
    { key: 'rectifs', label: 'RECTIFS', defaultWidth: 180 },
];

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

const resizeHandleStyle: React.CSSProperties = {
    position: 'absolute', right: 0, top: 0, bottom: 0, width: '6px',
    cursor: 'col-resize', zIndex: 10, borderRight: '2px solid transparent', transition: 'border-color 0.15s',
};
const resizeHandleHoverStyle: React.CSSProperties = {
    ...resizeHandleStyle, borderRight: '2px solid var(--color-brand-500, #6366f1)',
};

interface PlanBatch {
    key: string;
    plans: MediaPlan[];
    monthLabel: string;
    sentDate: string;
    isPendingClient: boolean;
}

const ClientMediaPlansPage: React.FC = () => {
    const { user } = useAuth();
    const clientId = user?.clientId;
    const clientNom = user?.nom || 'Mon espace';

    const [mediaPlans, setMediaPlans] = useState<MediaPlan[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<number | null>(null);
    const [driveLink, setDriveLink] = useState<string | null>(null);
    const [driveLoading, setDriveLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [selectedMonthLabel, setSelectedMonthLabel] = useState<string | null>(null);
    const [selectedBatchKey, setSelectedBatchKey] = useState<string | null>(null);
    const [viewState, setViewState] = useState<'BATCHES' | 'BATCH_DETAILS'>('BATCHES');

    const see = (mp: MediaPlan, key: string, value: React.ReactNode) => {
        if (!mp.champsVisiblesClient) return value;
        return mp.champsVisiblesClient.split(',').includes(key) ? value : '—';
    };

    // Real KPIs
    const [totalPlansCount, setTotalPlansCount] = useState(0);
    const [lastUpdateDate, setLastUpdateDate] = useState<string | null>(null);

    const [colWidths, setColWidths] = useState<number[]>(COLUMNS.map(c => c.defaultWidth));
    const [approvedColWidths, setApprovedColWidths] = useState<number[]>(APPROVED_COLUMNS.map(c => c.defaultWidth));
    const [resizingCol, setResizingCol] = useState<number | null>(null);
    const [resizingApproved, setResizingApproved] = useState(false);
    const [hoveredHandle, setHoveredHandle] = useState<number | null>(null);
    const resizeStartX = useRef(0);
    const resizeStartW = useRef(0);

    const loadPlans = async () => {
        if (!clientId) return;
        try {
            const res = await mediaPlanService.getByClient(clientId);
            const all = res.data.data || [];
            
            // Set real KPIs before filtering
            setTotalPlansCount(all.length);
            const dates = all
                .map(m => m.dateCreation ? new Date(m.dateCreation).getTime() : 0)
                .filter(t => t > 0);
            if (dates.length > 0) {
                setLastUpdateDate(new Date(Math.max(...dates)).toLocaleDateString('fr-FR'));
            } else {
                setLastUpdateDate('—');
            }

            // Show approved AND pending-client plans
            setMediaPlans(all.filter(mp => mp.statut === 'APPROUVE' || mp.statut === 'EN_ATTENTE_CLIENT' || mp.statut === 'DESAPPROUVE'));
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    useEffect(() => {
        loadPlans();
    }, [clientId]);

    useEffect(() => {
        if (!clientId) return;
        setDriveLoading(true);
        clientService.getClientPortalDriveLink(clientId)
            .then(res => {
                const link = (res as any)?.data?.data ?? (res as any)?.data ?? null;
                setDriveLink(typeof link === 'string' ? link : null);
            })
            .catch(() => setDriveLink(null))
            .finally(() => setDriveLoading(false));
    }, [clientId]);

    const availableMonths = useMemo(() => {
        const months = new Set<string>();
        for (const mp of mediaPlans) {
            if (mp.datePublication) {
                const d = new Date(mp.datePublication);
                months.add(`${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`);
            } else {
                months.add('Indéterminé');
            }
        }
        return Array.from(months);
    }, [mediaPlans]);

    useEffect(() => {
        if (availableMonths.length > 0 && (!selectedMonthLabel || !availableMonths.includes(selectedMonthLabel))) {
            setSelectedMonthLabel(availableMonths[0]);
        }
    }, [availableMonths, selectedMonthLabel]);

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (resizingCol === null) return;
        const delta = e.clientX - resizeStartX.current;
        const newWidth = Math.max(50, resizeStartW.current + delta);
        if (resizingApproved) {
            setApprovedColWidths(prev => { const next = [...prev]; next[resizingCol] = newWidth; return next; });
        } else {
            setColWidths(prev => { const next = [...prev]; next[resizingCol] = newWidth; return next; });
        }
    }, [resizingCol, resizingApproved]);

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

    const startResize = (colIndex: number, isApproved: boolean, e: React.MouseEvent) => {
        e.preventDefault();
        resizeStartX.current = e.clientX;
        resizeStartW.current = isApproved ? approvedColWidths[colIndex] : colWidths[colIndex];
        setResizingApproved(isApproved);
        setResizingCol(colIndex);
    };

    // Group plans into batches by creation time proximity
    const buildBatches = (plans: MediaPlan[]): PlanBatch[] => {
        const sorted = [...plans].sort((a, b) => {
            const da = a.dateCreation ? new Date(a.dateCreation).getTime() : 0;
            const db = b.dateCreation ? new Date(b.dateCreation).getTime() : 0;
            return da - db;
        });
        const groups: PlanBatch[] = [];
        let currentBatch: MediaPlan[] = [];
        let lastTime = 0;

        for (const mp of sorted) {
            const t = mp.dateCreation ? new Date(mp.dateCreation).getTime() : 0;
            if (currentBatch.length === 0 || (t - lastTime) < 5000) {
                currentBatch.push(mp);
            } else {
                groups.push(makeBatch(groups.length, currentBatch));
                currentBatch = [mp];
            }
            lastTime = t;
        }
        if (currentBatch.length > 0) groups.push(makeBatch(groups.length, currentBatch));
        return groups.reverse();
    };

    const makeBatch = (idx: number, plans: MediaPlan[]): PlanBatch => {
        const first = plans[0];
        let monthLabel = '';
        if (first.datePublication) {
            const d = new Date(first.datePublication);
            monthLabel = `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
        }
        let sentDate = '';
        if (first.dateCreation) {
            const d = new Date(first.dateCreation);
            sentDate = `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        }
        const isPendingClient = plans.some(p => p.statut === 'EN_ATTENTE_CLIENT');
        return { key: `batch-${idx}`, plans, monthLabel, sentDate, isPendingClient };
    };

    const pendingClientPlans = useMemo(() =>
        mediaPlans.filter(mp => mp.statut === 'EN_ATTENTE_CLIENT'),
        [mediaPlans]
    );

    const approvedPlans = useMemo(() =>
        mediaPlans.filter(mp => mp.statut === 'APPROUVE'),
        [mediaPlans]
    );

    const filteredApproved = useMemo(() => {
        let filtered = approvedPlans;
        if (search) {
            const s = search.toLowerCase();
            filtered = filtered.filter(mp =>
                mp.titre?.toLowerCase().includes(s) || mp.format?.toLowerCase().includes(s)
            );
        }
        if (selectedMonthLabel) {
            filtered = filtered.filter(mp => {
                if (!mp.datePublication) return selectedMonthLabel === 'Indéterminé';
                const d = new Date(mp.datePublication);
                return `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}` === selectedMonthLabel;
            });
        }
        return filtered;
    }, [approvedPlans, search, selectedMonthLabel]);

    const approvedBatches = useMemo(() => buildBatches(filteredApproved), [filteredApproved]);

    const pendingBatches = useMemo(() => {
        // Group pending-client plans into batches by date proximity
        return buildBatches(pendingClientPlans);
    }, [pendingClientPlans]);

    const tableWidth = colWidths.reduce((s, w) => s + w, 0);
    const approvedTableWidth = approvedColWidths.reduce((s, w) => s + w, 0);
    const inputClass = 'w-full bg-transparent border-0 text-sm text-gray-700 dark:text-gray-300 px-1 py-2.5 cursor-default opacity-70';

    // ── Client actions ─────────────────────────────────────────────────────────

    const handleClientApprove = async (mp: MediaPlan) => {
        setActionLoading(mp.id);
        try {
            await mediaPlanService.clientApprove(mp.id);
            await loadPlans();
        } catch (e: any) {
            alert(e.response?.data?.message || 'Erreur');
        } finally {
            setActionLoading(null);
        }
    };

    const handleClientDisapprove = async (mp: MediaPlan) => {
        if (!clientId) return;
        const rectifs = mp.rectifs?.trim() || '';
        if (!rectifs) {
            alert(`Le motif de refus (colonne RECTIFS) est obligatoire pour refuser la ligne.`);
            return;
        }
        setActionLoading(mp.id);
        try {
            await mediaPlanService.clientDisapprove(mp.id);
            await reactifService.createForMediaPlanExtern(mp.id, clientId, rectifs);
            await mediaPlanService.updateRectifs(mp.id, rectifs);

            await loadPlans();
        } catch (e: any) {
            alert(e.response?.data?.message || 'Erreur lors du refus');
        } finally {
            setActionLoading(null);
        }
    };

    const handleClientApproveAll = async (batch: PlanBatch) => {
        const pendingIds = batch.plans
            .filter(p => p.statut === 'EN_ATTENTE_CLIENT')
            .map(p => p.id);
        if (pendingIds.length === 0) return;
        setActionLoading(-1);
        try {
            await mediaPlanService.clientApproveAll(pendingIds);
            await loadPlans();
        } catch (e: any) {
            alert(e.response?.data?.message || 'Erreur lors de l\'approbation');
        } finally {
            setActionLoading(null);
        }
    };

    const handleClientDisapproveAll = async (batch: PlanBatch) => {
        if (!clientId) return;
        const pending = batch.plans.filter(p => p.statut === 'EN_ATTENTE_CLIENT');
        if (pending.length === 0) return;

        for (const mp of pending) {
            if (!mp.rectifs?.trim()) {
                alert(`Veuillez spécifier un motif de refus (colonne RECTIFS) pour toutes les lignes que vous souhaitez refuser.`);
                return;
            }
        }

        setActionLoading(-1);
        try {
            for (const mp of pending) {
                const rectifs = mp.rectifs?.trim() || '';
                await mediaPlanService.clientDisapprove(mp.id);
                await reactifService.createForMediaPlanExtern(mp.id, clientId, rectifs);
                await mediaPlanService.updateRectifs(mp.id, rectifs);
            }
            await loadPlans();
        } catch (e: any) {
            alert(e.response?.data?.message || 'Erreur lors du refus groupé');
        } finally {
            setActionLoading(null);
        }
    };

    const handleSaveRectifs = async (mp: MediaPlan, value: string) => {
        setMediaPlans(prev => prev.map(p => p.id === mp.id ? { ...p, rectifs: value } : p));
        try {
            await mediaPlanService.updateRectifs(mp.id, value);
        } catch (e: any) {
            alert(e.response?.data?.message || 'Erreur lors de la sauvegarde des rectifs');
        }
    };

    // ── Render helpers ─────────────────────────────────────────────────────────


    const getStatusBadge = (mp: MediaPlan) => {
        const displayStatut = (mp.isShooting && mp.shootingStatus === StatutShooting.REJETE) ? 'DESAPPROUVE' : mp.statut;
        if (displayStatut === 'EN_ATTENTE_CLIENT') {
            return <span className="inline-flex items-center rounded-full bg-purple-50 dark:bg-purple-900/20 px-2.5 py-0.5 text-xs font-semibold text-purple-700 dark:text-purple-300">En attente</span>;
        }
        const colors: Record<string, string> = { EN_ATTENTE: 'warning', APPROUVE: 'success', DESAPPROUVE: 'danger' };
        return <Badge variant={(colors[displayStatut] || 'neutral') as any}>{StatutMediaPlanLabels[displayStatut] || displayStatut}</Badge>;
    };

    const renderPendingTableHeader = () => (
        <thead className="bg-yellow-50 dark:bg-yellow-900/10">
            <tr>
                {COLUMNS.map((col, ci) => (
                    <th key={col.key}
                        className="px-2 py-3 text-left text-xs font-semibold uppercase tracking-wider text-yellow-700 dark:text-yellow-400 whitespace-nowrap border-r border-yellow-200 dark:border-yellow-800 relative select-none"
                        style={{ width: colWidths[ci], minWidth: 50, overflow: 'hidden' }}>
                        {col.label}
                        {ci < COLUMNS.length - 1 && (
                            <div style={hoveredHandle === ci || resizingCol === ci ? resizeHandleHoverStyle : resizeHandleStyle}
                                onMouseDown={e => startResize(ci, false, e)}
                                onMouseEnter={() => setHoveredHandle(ci)}
                                onMouseLeave={() => setHoveredHandle(null)} />
                        )}
                    </th>
                ))}
            </tr>
        </thead>
    );

    const renderApprovedTableHeader = () => (
        <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
                {APPROVED_COLUMNS.map((col, ci) => (
                    <th key={col.key}
                        className="px-2 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 whitespace-nowrap border-r border-gray-200 dark:border-gray-700 relative select-none"
                        style={{ width: approvedColWidths[ci], minWidth: 50, overflow: 'hidden' }}>
                        {col.label}
                        {ci < APPROVED_COLUMNS.length - 1 && (
                            <div style={hoveredHandle === ci + 100 || resizingCol === ci ? resizeHandleHoverStyle : resizeHandleStyle}
                                onMouseDown={e => startResize(ci, true, e)}
                                onMouseEnter={() => setHoveredHandle(ci + 100)}
                                onMouseLeave={() => setHoveredHandle(null)} />
                        )}
                    </th>
                ))}
            </tr>
        </thead>
    );

    const renderPendingRow = (mp: MediaPlan) => {
        const isDisapproved = mp.statut === 'DESAPPROUVE';
        const isLoading = actionLoading === mp.id;
        return (
            <tr key={mp.id}
                className={`transition-colors ${isDisapproved ? 'bg-red-50 dark:bg-red-900/10 hover:bg-red-100 dark:hover:bg-red-900/20' : 'hover:bg-yellow-50 dark:hover:bg-yellow-900/5'}`}
                style={{ height: '80px' }}>
                <td className="px-2 py-1 border-r border-gray-100 dark:border-gray-800" style={{ width: colWidths[0] }}><span className={inputClass}>{see(mp, 'datePublication', mp.datePublication || '-')}</span></td>
                <td className="px-2 py-1 border-r border-gray-100 dark:border-gray-800" style={{ width: colWidths[1] }}><span className={inputClass}>{see(mp, 'heure', mp.heure || '-')}</span></td>
                <td className="px-2 py-1 border-r border-gray-100 dark:border-gray-800" style={{ width: colWidths[2] }}><span className={inputClass}>{see(mp, 'format', mp.format || '-')}</span></td>
                <td className="px-2 py-1 border-r border-gray-100 dark:border-gray-800" style={{ width: colWidths[3] }}><span className={inputClass}>{see(mp, 'type', mp.type || '-')}</span></td>
                <td className="px-2 py-1 border-r border-gray-100 dark:border-gray-800" style={{ width: colWidths[4] }}><span className={`${inputClass} font-medium truncate block`}>{see(mp, 'titre', mp.titre || '-')}</span></td>
                <td className="px-2 py-1 border-r border-gray-100 dark:border-gray-800" style={{ width: colWidths[5] }}><span className={`${inputClass} truncate block`}>{see(mp, 'texteSurVisuel', renderCellValue(mp.texteSurVisuel))}</span></td>
                <td className="px-2 py-1 border-r border-gray-100 dark:border-gray-800" style={{ width: colWidths[6] }}><span className={`${inputClass} truncate block`}>{see(mp, 'inspiration', renderCellValue(mp.inspiration))}</span></td>
                <td className="px-2 py-1 border-r border-gray-100 dark:border-gray-800" style={{ width: colWidths[7] }}><span className={inputClass}>{see(mp, 'platforme', mp.platforme || '-')}</span></td>
                <td className="px-2 py-1 border-r border-gray-100 dark:border-gray-800" style={{ width: colWidths[8] }}><span className={`${inputClass} truncate block`}>{see(mp, 'lienDrive', renderCellValue(mp.lienDrive))}</span></td>
                <td className="px-2 py-1 border-r border-gray-100 dark:border-gray-800" style={{ width: colWidths[9] }}>
                    {see(mp, 'etatPublication', <Badge variant="neutral">{EtatPublicationLabels[mp.etatPublication as keyof typeof EtatPublicationLabels] || mp.etatPublication || '-'}</Badge>)}
                </td>
                <td className="px-2 py-1 border-r border-gray-100 dark:border-gray-800" style={{ width: colWidths[10] }}>{getStatusBadge(mp)}</td>
                {/* RECTIFS — editable for pending, read-only otherwise */}
                <td className="px-2 py-1 border-r border-gray-100 dark:border-gray-800" style={{ width: colWidths[11] }}>
                    {mp.statut === 'EN_ATTENTE_CLIENT' ? (
                        <textarea
                            defaultValue={mp.rectifs || ''}
                            onBlur={e => {
                                const newVal = e.currentTarget.value;
                                if (newVal !== (mp.rectifs || '')) handleSaveRectifs(mp, newVal);
                            }}
                            rows={3}
                            placeholder="Saisir vos rectifications..."
                            className="w-full resize-none text-xs rounded-md border border-yellow-300 dark:border-yellow-700 bg-yellow-50 dark:bg-yellow-900/20 text-gray-800 dark:text-gray-200 px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-yellow-400 placeholder-gray-400 dark:placeholder-gray-500 transition-colors"
                            style={{ minHeight: 60 }}
                            onClick={e => e.stopPropagation()}
                        />
                    ) : (
                        <span className="text-xs text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{mp.rectifs || '-'}</span>
                    )}
                </td>
                <td className="px-2 py-1" style={{ width: colWidths[12] }}>
                    {mp.statut === 'EN_ATTENTE_CLIENT' && (
                        <div className="flex gap-1.5">
                            <button
                                disabled={isLoading}
                                onClick={() => handleClientApprove(mp)}
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-green-50 border border-green-200 text-green-700 text-xs font-semibold hover:bg-green-100 disabled:opacity-50 transition-colors dark:bg-green-900/10 dark:border-green-800 dark:text-green-300"
                                title="Approuver cette ligne"
                            >
                                <HiOutlineCheck size={13} /> Approuver
                            </button>
                            <button
                                disabled={isLoading}
                                onClick={() => handleClientDisapprove(mp)}
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-semibold hover:bg-red-100 disabled:opacity-50 transition-colors dark:bg-red-900/10 dark:border-red-800 dark:text-red-300"
                                title="Désapprouver cette ligne"
                            >
                                <HiOutlineX size={13} /> Refuser
                            </button>
                        </div>
                    )}
                    {mp.statut === 'DESAPPROUVE' && (
                        <span className="text-xs text-red-600 dark:text-red-400 font-semibold">Refusé</span>
                    )}
                </td>
            </tr>
        );
    };

    const renderApprovedRow = (mp: MediaPlan) => (
        <tr key={mp.id} className="transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50" style={{ height: '80px' }}>
            <td className="px-2 py-1 border-r border-gray-100 dark:border-gray-800" style={{ width: approvedColWidths[0] }}><span className={inputClass}>{see(mp, 'datePublication', mp.datePublication || '-')}</span></td>
            <td className="px-2 py-1 border-r border-gray-100 dark:border-gray-800" style={{ width: approvedColWidths[1] }}><span className={inputClass}>{see(mp, 'heure', mp.heure || '-')}</span></td>
            <td className="px-2 py-1 border-r border-gray-100 dark:border-gray-800" style={{ width: approvedColWidths[2] }}><span className={inputClass}>{see(mp, 'format', mp.format || '-')}</span></td>
            <td className="px-2 py-1 border-r border-gray-100 dark:border-gray-800" style={{ width: approvedColWidths[3] }}><span className={inputClass}>{see(mp, 'type', mp.type || '-')}</span></td>
            <td className="px-2 py-1 border-r border-gray-100 dark:border-gray-800" style={{ width: approvedColWidths[4] }}><span className={`${inputClass} font-medium truncate block`}>{see(mp, 'titre', mp.titre || '-')}</span></td>
            <td className="px-2 py-1 border-r border-gray-100 dark:border-gray-800" style={{ width: approvedColWidths[5] }}><span className={`${inputClass} truncate block`}>{see(mp, 'texteSurVisuel', renderCellValue(mp.texteSurVisuel))}</span></td>
            <td className="px-2 py-1 border-r border-gray-100 dark:border-gray-800" style={{ width: approvedColWidths[6] }}><span className={`${inputClass} truncate block`}>{see(mp, 'inspiration', renderCellValue(mp.inspiration))}</span></td>
            <td className="px-2 py-1 border-r border-gray-100 dark:border-gray-800" style={{ width: approvedColWidths[7] }}><span className={inputClass}>{see(mp, 'platforme', mp.platforme || '-')}</span></td>
            <td className="px-2 py-1 border-r border-gray-100 dark:border-gray-800" style={{ width: approvedColWidths[8] }}><span className={`${inputClass} truncate block`}>{see(mp, 'lienDrive', renderCellValue(mp.lienDrive))}</span></td>
            <td className="px-2 py-1 border-r border-gray-100 dark:border-gray-800" style={{ width: approvedColWidths[9] }}>
                {see(mp, 'etatPublication', <Badge variant="neutral">{EtatPublicationLabels[mp.etatPublication as keyof typeof EtatPublicationLabels] || mp.etatPublication || '-'}</Badge>)}
            </td>
            <td className="px-2 py-1 border-r border-gray-100 dark:border-gray-800" style={{ width: approvedColWidths[10] }}>{getStatusBadge(mp)}</td>
            <td className="px-2 py-1" style={{ width: approvedColWidths[11] }}>
                <span className="text-xs text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{mp.rectifs || '-'}</span>
            </td>
        </tr>
    );

    if (loading) return (
        <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand-500" />
        </div>
    );

    const activeBatch = (approvedBatches as PlanBatch[]).find(b => b.key === selectedBatchKey);

    return (
        <div className="space-y-8 bg-[#F5F4F1] dark:bg-gray-950 min-h-screen p-2 sm:p-4 -m-4 sm:-m-6 lg:-m-8">
            {/* Header / Hero Zone */}
            <div className="flex flex-col gap-6">
                <div className="flex items-center justify-between mb-1">
                    <div className="flex flex-col justify-center">
                        <h1 className="text-2xl font-medium text-gray-900 dark:text-white tracking-tight">Mes Media Plans</h1>
                        <div className="flex items-center gap-2 mt-1.5">
                            <span className="text-[13px] font-medium text-[#E8521A] bg-[#E8521A]/10 px-2.5 py-0.5 rounded-[6px]">
                                {clientNom}
                            </span>
                            <span className="text-gray-300">•</span>
                            <p className="text-[13px] text-gray-500 dark:text-gray-400">Consultez le déroulement de vos campagnes</p>
                        </div>
                    </div>
                    {driveLoading ? (
                        <div className="flex h-10 w-10 items-center justify-center">
                            <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
                        </div>
                    ) : driveLink ? (
                        <a
                            href={driveLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Ouvrir mon dossier Google Drive"
                            className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm transition-all hover:border-brand-400 hover:bg-brand-50 hover:text-brand-700 hover:shadow dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:border-brand-500 dark:hover:bg-brand-500/10 dark:hover:text-brand-400"
                        >
                            <svg viewBox="0 0 87.3 78" className="h-5 w-5" xmlns="http://www.w3.org/2000/svg">
                                <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da" />
                                <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0 -1.2 4.5h27.5z" fill="#00ac47" />
                                <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" fill="#ea4335" />
                                <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d" />
                                <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc" />
                                <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00" />
                            </svg>
                            Mon Drive
                            <HiOutlineExternalLink size={14} className="opacity-60" />
                        </a>
                    ) : null}
                </div>

                {/* Metrics Row */}
                <div className="flex items-center gap-4">
                    <div className="flex-1 bg-white dark:bg-gray-800 rounded-[12px] border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
                        <p className="text-xs text-gray-500 dark:text-gray-400">Total de plans</p>
                        <p className="text-lg font-medium text-gray-900 dark:text-white">{totalPlansCount}</p>
                    </div>
                    <div className="flex-1 bg-white dark:bg-gray-800 rounded-[12px] border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
                        <p className="text-xs text-gray-500 dark:text-gray-400">Plans approuvés</p>
                        <p className="text-lg font-medium text-gray-900 dark:text-white">{approvedPlans.length}</p>
                    </div>
                    <div className="flex-1 bg-white dark:bg-gray-800 rounded-[12px] border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
                        <p className="text-xs text-gray-500 dark:text-gray-400">Dernière mise à jour</p>
                        <p className="text-lg font-medium text-gray-900 dark:text-white">{lastUpdateDate || '—'}</p>
                    </div>
                </div>
            </div>

            {/* ══ SECTION : En attente de votre approbation ══════════════════════════ */}
            {pendingBatches.length > 0 && (
                <div className="space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-yellow-100 dark:bg-yellow-900/20">
                            <HiOutlineClock size={18} className="text-yellow-600 dark:text-yellow-400" />
                        </div>
                        <div>
                            <h2 className="text-lg font-medium text-gray-900 dark:text-white">En attente de votre approbation</h2>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Veuillez approuver ou refuser chaque ligne ci-dessous.</p>
                        </div>
                    </div>

                    {pendingBatches.map(batch => {
                        const allDecided = batch.plans.every(p => p.statut === 'APPROUVE' || p.statut === 'DESAPPROUVE');
                        const hasDisapproved = batch.plans.some(p => p.statut === 'DESAPPROUVE');
                        return (
                            <div key={batch.key} className="rounded-xl border-2 border-yellow-300 dark:border-yellow-700/50 bg-white dark:bg-gray-900 shadow-sm overflow-hidden">
                                <div className="flex items-center justify-between px-5 py-3 bg-yellow-50 dark:bg-yellow-900/10 border-b border-yellow-200 dark:border-yellow-800">
                                    <div className="flex items-center gap-3 flex-wrap">
                                        <div>
                                            <span className="font-medium text-yellow-800 dark:text-yellow-300 text-sm">
                                                {batch.monthLabel || 'Indéterminé'} · {batch.plans.length} ligne{batch.plans.length > 1 ? 's' : ''}
                                            </span>
                                            <span className="ml-3 text-xs text-yellow-600 dark:text-yellow-500">Envoyé le {batch.sentDate}</span>
                                        </div>
                                        {!allDecided && (
                                            <div className="flex gap-2 ml-auto">
                                                <button
                                                    disabled={actionLoading !== null}
                                                    onClick={() => handleClientApproveAll(batch)}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1D9E75] text-white text-xs font-medium hover:bg-green-700 disabled:opacity-50 transition-colors shadow-sm"
                                                >
                                                    {actionLoading === -1 ? (
                                                        <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                                    ) : (
                                                        <HiOutlineCheck size={13} />
                                                    )}
                                                    Approuver tout
                                                </button>
                                                <button
                                                    disabled={actionLoading !== null}
                                                    onClick={() => handleClientDisapproveAll(batch)}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500 text-white text-xs font-medium hover:bg-red-600 disabled:opacity-50 transition-colors shadow-sm"
                                                >
                                                    <HiOutlineX size={13} /> Refuser tout
                                                </button>
                                            </div>
                                        )}
                                        {allDecided && (
                                            <span className={`ml-auto text-xs font-medium px-3 py-1 rounded-[20px] ${hasDisapproved ? 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-300' : 'bg-[#1D9E75]/10 text-[#1D9E75] dark:bg-green-900/20 dark:text-green-300'}`}>
                                                {hasDisapproved ? '❌ Contient des refus' : '✅ Tout approuvé'}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="divide-y divide-gray-200 dark:divide-gray-700" style={{ tableLayout: 'fixed', width: tableWidth }}>
                                        {renderPendingTableHeader()}
                                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                            {batch.plans.map(mp => renderPendingRow(mp))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ══ SECTION : Media plans approuvés ═══════════════════════════════════ */}
            <div className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <h2 className="text-lg font-medium text-gray-900 dark:text-white">Mes media plans approuvés</h2>

                    {/* Month tabs */}
                    {availableMonths.length > 0 && viewState === 'BATCHES' && (
                        <div className="flex overflow-x-auto scrollbar-hide gap-2">
                            {availableMonths.map(m => (
                                <button key={m} onClick={() => setSelectedMonthLabel(m)}
                                    className={`shrink-0 rounded-[20px] px-4 py-1.5 text-sm font-medium transition-colors border ${selectedMonthLabel === m
                                        ? 'bg-[#E8521A] text-white border-[#E8521A]' 
                                        : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300'}`}>
                                    {m}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {viewState === 'BATCHES' && (
                    <div className="space-y-4">
                        {/* Search */}
                        <div className="relative max-w-md group mb-6">
                            <HiOutlineSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                            <input type="text" placeholder="Rechercher par titre, format…"
                                value={search} onChange={e => setSearch(e.target.value)}
                                className="w-full rounded-[20px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 pl-10 pr-4 py-2.5 text-sm font-medium focus:ring-1 focus:ring-gray-300 focus:border-gray-300 dark:text-white outline-none transition-all shadow-sm" />
                        </div>

                        {approvedBatches.length === 0 ? (
                            <div className="py-12 text-center text-gray-400 dark:text-gray-500 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700">
                                Aucun media plan approuvé pour le moment.
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                                {approvedBatches.map(batch => {
                                    const isApproved = !batch.isPendingClient;
                                    return (
                                    <div key={batch.key}
                                        onClick={() => { setSelectedBatchKey(batch.key); setViewState('BATCH_DETAILS'); }}
                                        className="cursor-pointer flex flex-col rounded-[12px] border border-gray-200 bg-white shadow-sm overflow-hidden dark:border-gray-700 dark:bg-gray-800">
                                        
                                        {/* Card Header */}
                                        <div className="p-4 pb-3 flex flex-col">
                                            <div className="flex items-start justify-between gap-4 mb-3">
                                                <div className="flex items-center gap-3">
                                                    <HiOutlinePhotograph size={20} className="text-gray-400" />
                                                    <div>
                                                        <h3 className="text-sm font-medium text-gray-900 dark:text-white leading-tight">
                                                            {batch.monthLabel || 'Indéterminé'}
                                                        </h3>
                                                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mt-0.5">
                                                            {batch.plans.length} ligne{batch.plans.length > 1 ? 's' : ''}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className={`shrink-0 px-2 py-0.5 rounded-[20px] text-[11px] font-medium ${isApproved ? 'bg-[#1D9E75]/10 text-[#1D9E75]' : 'bg-orange-50 text-orange-600'}`}>
                                                    {isApproved ? 'Approuvé' : 'En attente'}
                                                </div>
                                            </div>
                                            {/* Progress bar */}
                                            <div className="w-full h-1 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden mt-1">
                                                <div className={`h-full ${isApproved ? 'bg-[#1D9E75]' : 'bg-orange-400'}`} style={{ width: '100%' }}></div>
                                            </div>
                                        </div>
                                        
                                        {/* Separator */}
                                        <div className="h-px bg-gray-100 dark:bg-gray-700"></div>

                                        {/* Card Footer */}
                                        <div className="flex items-center justify-between p-4 pt-3">
                                            <p className="text-xs text-gray-400 dark:text-gray-500">
                                                Envoyé le {batch.sentDate || '—'}
                                            </p>
                                            <div className="flex items-center gap-1 text-[13px] font-medium text-[#E8521A]">
                                                <span>Voir</span>
                                                <span>→</span>
                                            </div>
                                        </div>
                                    </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {viewState === 'BATCH_DETAILS' && activeBatch && (
                    <div className="space-y-4">
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setViewState('BATCHES')}
                                className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                            >
                                ← Retour
                            </button>
                            <h2 className="text-lg font-medium text-gray-900 dark:text-white">
                                {activeBatch.monthLabel || 'Indéterminé'} · {activeBatch.plans.length} ligne{activeBatch.plans.length > 1 ? 's' : ''}
                            </h2>
                        </div>
                        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm">
                            <table className="divide-y divide-gray-200 dark:divide-gray-700" style={{ tableLayout: 'fixed', width: approvedTableWidth }}>
                                {renderApprovedTableHeader()}
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                    {activeBatch.plans.map(mp => renderApprovedRow(mp))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ClientMediaPlansPage;
