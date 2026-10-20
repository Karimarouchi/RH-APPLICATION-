import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
    HiOutlineTrash,
    HiOutlineSearch,
    HiOutlineCheck,
    HiOutlineX,
    HiOutlineUserAdd,
    HiOutlineChevronDown,
    HiOutlineChevronRight,
    HiOutlineBriefcase,
    HiOutlineArrowLeft,
} from 'react-icons/hi';
import { useAuth } from '../context/AuthContext';
import { mediaPlanService } from '../api/mediaPlanService';
import { mediaPlanAssignmentService } from '../api/mediaPlanAssignmentService';
import { referentielService } from '../api/referentielService';
import { reactifService } from '../api/reactifService';
import { clientService, ClientDTO } from '../api/clientService';
import {
    MediaPlan,
    MediaPlanAssignment,
    Referentiel,
    EtatPublicationLabels,
    StatutMediaPlanLabels,
    StatutShooting,
    TypeContenuShootingLabels,
} from '../types';
import Modal from '../components/ui/Modal';
import Badge from '../components/ui/Badge';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { useConfirm } from '../hooks/useConfirm';

const MONTH_NAMES = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

const COLUMNS = [
    { key: 'datePublication', label: 'Date Pub.', defaultWidth: 130 },
    { key: 'heure', label: 'Heure', defaultWidth: 90 },
    { key: 'format', label: 'Format', defaultWidth: 110 },
    { key: 'type', label: 'Type', defaultWidth: 110 },
    { key: 'titre', label: 'Titre', defaultWidth: 140 },
    { key: 'texteSurVisuel', label: 'Texte/Visuel', defaultWidth: 130 },
    { key: 'inspiration', label: 'Inspiration', defaultWidth: 120 },
    { key: 'autresElements', label: 'Autres', defaultWidth: 110 },
    { key: 'platforme', label: 'Platforme', defaultWidth: 110 },
    { key: 'lienDrive', label: 'Lien Drive', defaultWidth: 120 },
    { key: 'etatPublication', label: 'État Pub.', defaultWidth: 110 },
    { key: 'rectifs', label: 'Rectifs', defaultWidth: 110 },
    { key: 'remarques', label: 'Remarques', defaultWidth: 120 },
    { key: 'shooting', label: 'Shooting', defaultWidth: 90 },
    { key: 'statut', label: 'Statut', defaultWidth: 100 },
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

const getStatusInfo = (plans: MediaPlan[]) => {
    if (plans.length === 0) return { label: 'Vide', color: 'gray' };
    if (plans.some(p => p.isShooting && p.shootingStatus === StatutShooting.REJETE)) return { label: 'Désapprouvé', color: 'red' };
    if (plans.every(p => p.statut === 'APPROUVE')) return { label: 'Approuvé', color: 'green' };
    if (plans.some(p => p.statut === 'DESAPPROUVE')) return { label: 'Désapprouvé', color: 'red' };
    if (plans.some(p => p.statut === 'EN_ATTENTE')) return { label: 'En attente', color: 'warning' };
    return { label: 'Brouillon', color: 'brand' };
};

interface PlanBatch {
    key: string;
    plans: MediaPlan[];
    monthLabel: string;
    employeeName: string;
    sentDate: string;
}

const getBatchLabel = (batch: PlanBatch) => {
    return `media plan de ${batch.monthLabel} ___a été envoyé par : ${batch.employeeName}  à ${batch.sentDate}`;
};

const TousLesMediaPlanPage: React.FC = () => {
    const { user } = useAuth();
    const canValidateMediaPlans = (user?.permissions ?? []).includes('VALIDATE_MEDIA_PLAN');
    const { confirm, confirmState, handleConfirm, handleCancel } = useConfirm();

    const [clients, setClients] = useState<ClientDTO[]>([]);
    const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
    const [mediaPlans, setMediaPlans] = useState<MediaPlan[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filterStatut, setFilterStatut] = useState('');

    const [formats, setFormats] = useState<Referentiel[]>([]);
    const [types, setTypes] = useState<Referentiel[]>([]);
    const [platformes, setPlateformes] = useState<Referentiel[]>([]);

    const [viewState, setViewState] = useState<'CLIENTS' | 'BATCHES' | 'BATCH_DETAILS'>('CLIENTS');
    const [selectedBatchKey, setSelectedBatchKey] = useState<string | null>(null);
    const [selectedMonthLabel, setSelectedMonthLabel] = useState<string | null>(null);

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

    const [showAssignModal, setShowAssignModal] = useState(false);
    const [socialMediaEmployees, setSocialMediaEmployees] = useState<{ id: number; nom: string; prenom: string; departement: string; email: string }[]>([]);
    const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<number[]>([]);
    const [existingAssignments, setExistingAssignments] = useState<MediaPlanAssignment[]>([]);

    const [colWidths, setColWidths] = useState<number[]>(COLUMNS.map(c => c.defaultWidth));
    const [resizingCol, setResizingCol] = useState<number | null>(null);
    const [hoveredHandle, setHoveredHandle] = useState<number | null>(null);
    const resizeStartX = useRef(0);
    const resizeStartW = useRef(0);

    useEffect(() => { loadClients(); loadReferentiels(); }, []);
    useEffect(() => {
        if (selectedClientId) {
            setSelectedMonthLabel(null);
            loadMediaPlans(selectedClientId);
            loadAssignments(selectedClientId);
        }
    }, [selectedClientId]);

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

    const loadClients = async () => {
        try {
            const res = await clientService.getAllClients();
            const list = res.data.data || [];
            setClients(list);
            if (list.length > 0) setSelectedClientId(list[0].id);
        } catch (e) { console.error('Error loading clients:', e); }
        finally { setLoading(false); }
    };

    const loadMediaPlans = async (clientId: number) => {
        try {
            const res = await mediaPlanService.getByClient(clientId);
            setMediaPlans(res.data.data || []);
        } catch (e) { console.error('Error loading media plans:', e); }
    };

    const loadAssignments = async (clientId: number) => {
        try {
            const res = await mediaPlanAssignmentService.getByClient(clientId);
            setExistingAssignments(res.data.data || []);
        } catch (e) { console.error('Error loading assignments:', e); }
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

    const createBatch = (index: number, plans: MediaPlan[]): PlanBatch => {
        const first = plans[0];
        let monthLabel = '';
        if (first.datePublication) {
            const d = new Date(first.datePublication);
            monthLabel = `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
        }
        const employeeName = `${first.createurPrenom || ''} ${first.createurNom || ''}`.trim() || 'Inconnu';
        let sentDate = '';
        if (first.dateCreation) {
            const d = new Date(first.dateCreation);
            sentDate = `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        }
        return { key: `batch-${index}`, plans, monthLabel, employeeName, sentDate };
    };

    const batches = useMemo((): PlanBatch[] => {
        let filtered = mediaPlans;
        if (filterStatut) {
            filtered = filtered.filter(mp => {
                if (filterStatut === 'DESAPPROUVE') {
                    return mp.statut === 'DESAPPROUVE' || (mp.isShooting && mp.shootingStatus === StatutShooting.REJETE);
                }
                return mp.statut === filterStatut;
            });
        }
        if (search) {
            const s = search.toLowerCase();
            filtered = filtered.filter(mp =>
                mp.titre?.toLowerCase().includes(s) ||
                mp.createurNom?.toLowerCase().includes(s) ||
                mp.createurPrenom?.toLowerCase().includes(s) ||
                mp.format?.toLowerCase().includes(s)
            );
        }

        if (selectedMonthLabel) {
            filtered = filtered.filter(mp => {
                if (!mp.datePublication) return selectedMonthLabel === 'Indéterminé';
                const d = new Date(mp.datePublication);
                return `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}` === selectedMonthLabel;
            });
        }

        const sorted = [...filtered].sort((a, b) => {
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
                groups.push(createBatch(groups.length, currentBatch));
                currentBatch = [mp];
            }
            lastTime = t;
        }
        if (currentBatch.length > 0) {
            groups.push(createBatch(groups.length, currentBatch));
        }
        return groups.reverse();
    }, [mediaPlans, filterStatut, search, selectedMonthLabel]);

    const handleApproveBatch = async (batch: PlanBatch) => {
        confirm(`Approuver les ${batch.plans.length} ligne(s) de ce plan ?`, async () => {
            try {
                for (const mp of batch.plans) {
                    if (mp.statut !== 'APPROUVE') {
                        await mediaPlanService.approve(mp.id, user?.employeId || 0);
                    }
                }
                if (selectedClientId) loadMediaPlans(selectedClientId);
            } catch (e: any) {
                alert(e.response?.data?.message || 'Erreur lors de l\'approbation');
            }
        });
    };

    const handleDisapproveBatch = async (batch: PlanBatch) => {
        setReactifContenu('');
        setReactifError(null);
        setDisapproveBatchData(batch);
    };


    const [disapproveBatchData, setDisapproveBatchData] = useState<PlanBatch | null>(null);
    const [reactifContenu, setReactifContenu] = useState('');
    const [reactifLoading, setReactifLoading] = useState(false);
    const [reactifError, setReactifError] = useState<string | null>(null);

    const handleConfirmDisapprove = async () => {
        if (!disapproveBatchData || !user?.employeId) return;
        if (!reactifContenu.trim()) { setReactifError('Les rectifs sont obligatoires'); return; }

        setReactifLoading(true);
        try {
            for (const mp of disapproveBatchData.plans) {
                if (mp.statut !== 'DESAPPROUVE') {
                    await mediaPlanService.disapprove(mp.id);
                    await reactifService.createForMediaPlanIntern(mp.id, user.employeId, reactifContenu.trim());
                }
            }
            if (selectedClientId) loadMediaPlans(selectedClientId);
            setDisapproveBatchData(null);
            setReactifContenu('');
            setReactifError(null);
        } catch (e: any) {
            setReactifError(e.response?.data?.message || 'Erreur');
        } finally {
            setReactifLoading(false);
        }
    };

    const openAssignModal = async () => {
        try {
            const res = await mediaPlanAssignmentService.getSocialMediaEmployees();
            setSocialMediaEmployees(res.data.data || []);
            setSelectedEmployeeIds([]);
            setShowAssignModal(true);
        } catch (e) { console.error('Error loading SM employees:', e); }
    };

    const toggleEmployee = (id: number) => {
        setSelectedEmployeeIds(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    };

    const handleAssign = async () => {
        if (!selectedClientId || selectedEmployeeIds.length === 0) return;
        try {
            await mediaPlanAssignmentService.assign({ clientId: selectedClientId, employeIds: selectedEmployeeIds });
            setShowAssignModal(false);
            loadAssignments(selectedClientId);
        } catch (e: any) { alert(e.response?.data?.message || 'Erreur'); }
    };

    const handleRemoveAssignment = (assignmentId: number) => {
        confirm('Retirer cet employé de ce client ?', async () => {
            try {
                await mediaPlanAssignmentService.remove(assignmentId);
                if (selectedClientId) loadAssignments(selectedClientId);
            } catch (e: any) { alert(e.response?.data?.message || 'Erreur'); }
        });
    };

    const getStatusBadge = (mp: MediaPlan) => {
        const displayStatut = (mp.isShooting && mp.shootingStatus === StatutShooting.REJETE) ? 'DESAPPROUVE' : mp.statut;
        const colors: Record<string, string> = { EN_ATTENTE: 'warning', APPROUVE: 'success', DESAPPROUVE: 'danger' };
        return <Badge variant={(colors[displayStatut] || 'neutral') as any}>{StatutMediaPlanLabels[displayStatut as keyof typeof StatutMediaPlanLabels] || displayStatut}</Badge>;
    };

    const getShootingStatusBadge = (statut: StatutShooting | null) => {
        if (!statut) return null;
        const colors: Record<string, string> = { EN_ATTENTE: 'warning', VALIDE: 'success', REJETE: 'danger' };
        const labels: Record<string, string> = { EN_ATTENTE: 'En attente', VALIDE: 'Validé', REJETE: 'Rejeté' };
        return <Badge variant={(colors[statut] || 'neutral') as any}>{labels[statut] || statut}</Badge>;
    };

    const inputClass = 'w-full bg-transparent border-0 text-sm text-gray-700 dark:text-gray-300 px-1 py-2.5 cursor-default opacity-70';
    const tableWidth = colWidths.reduce((s, w) => s + w, 0);

    const renderTableHeader = () => (
        <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
                {COLUMNS.map((col, ci) => (
                    <th key={col.key}
                        className="px-2 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 whitespace-nowrap border-r border-gray-200 dark:border-gray-700 relative select-none"
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

    const renderRow = (mp: MediaPlan) => (
        <React.Fragment key={mp.id}>
            <tr className="transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50" style={{ height: '104px' }}>
                <td className="px-2 py-1 border-r border-gray-100 dark:border-gray-800 overflow-hidden" style={{ width: colWidths[0] }}>
                    <span className={inputClass}>{mp.datePublication || '-'}</span>
                </td>
                <td className="px-2 py-1 border-r border-gray-100 dark:border-gray-800 overflow-hidden" style={{ width: colWidths[1] }}>
                    <span className={inputClass}>{mp.heure || '-'}</span>
                </td>
                <td className="px-2 py-1 border-r border-gray-100 dark:border-gray-800 overflow-hidden" style={{ width: colWidths[2] }}>
                    <span className={inputClass}>{mp.format || '-'}</span>
                </td>
                <td className="px-2 py-1 border-r border-gray-100 dark:border-gray-800 overflow-hidden" style={{ width: colWidths[3] }}>
                    <span className={inputClass}>{mp.type || '-'}</span>
                </td>
                <td className="px-2 py-1 border-r border-gray-100 dark:border-gray-800 overflow-hidden" style={{ width: colWidths[4] }}>
                    <span className={`${inputClass} font-medium truncate block`}>{mp.titre || '-'}</span>
                </td>
                <td className="px-2 py-1 border-r border-gray-100 dark:border-gray-800 overflow-hidden" style={{ width: colWidths[5] }}>
                    <span className={`${inputClass} truncate block`}>{renderCellValue(mp.texteSurVisuel)}</span>
                </td >
                <td className="px-2 py-1 border-r border-gray-100 dark:border-gray-800 overflow-hidden" style={{ width: colWidths[6] }}>
                    <span className={`${inputClass} truncate block`}>{renderCellValue(mp.inspiration)}</span>
                </td >
                <td className="px-2 py-1 border-r border-gray-100 dark:border-gray-800 overflow-hidden" style={{ width: colWidths[7] }}>
                    <span className={`${inputClass} truncate block`}>{renderCellValue(mp.autresElements)}</span>
                </td >
                <td className="px-2 py-1 border-r border-gray-100 dark:border-gray-800 overflow-hidden" style={{ width: colWidths[8] }}>
                    <span className={inputClass}>{mp.platforme || '-'}</span>
                </td>
                <td className="px-2 py-1 border-r border-gray-100 dark:border-gray-800 overflow-hidden" style={{ width: colWidths[9] }}>
                    <span className={`${inputClass} truncate block`}>{renderCellValue(mp.lienDrive)}</span>
                </td >
                <td className="px-2 py-1 border-r border-gray-100 dark:border-gray-800 overflow-hidden" style={{ width: colWidths[10] }}>
                    <Badge variant="neutral">{EtatPublicationLabels[mp.etatPublication as keyof typeof EtatPublicationLabels] || mp.etatPublication || '-'}</Badge>
                </td>
                <td className="px-2 py-1 border-r border-gray-100 dark:border-gray-800 overflow-hidden" style={{ width: colWidths[11] }}>
                    <span className={`${inputClass} truncate block`}>{renderCellValue(mp.rectifs)}</span>
                </td >
                <td className="px-2 py-1 border-r border-gray-100 dark:border-gray-800 overflow-hidden" style={{ width: colWidths[12] }}>
                    <span className={`${inputClass} truncate block`}>{renderCellValue(mp.remarques)}</span>
                </td >
                <td className="px-2 py-1 border-r border-gray-100 dark:border-gray-800 overflow-hidden" style={{ width: colWidths[13] }}>
                    <div className="flex items-center justify-center">
                        <input type="checkbox" checked={!!mp.isShooting} disabled className="h-4 w-4 accent-brand-500" />
                    </div>
                </td>
                <td className="px-2 py-1 overflow-hidden" style={{ width: colWidths[14] }}>
                    {getStatusBadge(mp)}
                </td>
            </tr >

            {mp.isShooting && (
                <tr className="bg-brand-50/20 dark:bg-brand-900/10">
                    <td colSpan={COLUMNS.length} className="px-3 py-3 border-b border-gray-100 dark:border-gray-800">
                        <div className="text-xs font-semibold text-gray-600 dark:text-gray-300">SHOOTING</div>
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
                                <div className="text-[11px] text-gray-400 dark:text-gray-500">Date</div>
                                <div className="mt-0.5">{mp.shootingDate || '-'}</div>
                            </div>
                            <div>
                                <div className="text-[11px] text-gray-400 dark:text-gray-500">Type de contenu</div>
                                <div className="mt-0.5">{mp.shootingTypeDeContenu ? TypeContenuShootingLabels[mp.shootingTypeDeContenu] : '-'}</div>
                            </div>
                        </div>

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
        </React.Fragment>
    );

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand-500"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* ── CLIENTS VIEW ── */}
            {viewState === 'CLIENTS' && (
                <div className="space-y-6">
                    <div>
                        <h1 className="text-2xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-gray-900 to-[#683b77] dark:from-white dark:to-[#ab78c3]">Tous les Media Plans</h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Sélectionnez un client pour gérer ses media plans</p>
                    </div>

                    {clients.length === 0 ? (
                        <div className="py-12 text-center text-gray-400 dark:text-gray-500 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700">
                            Aucun client disponible.
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                            {clients.map(c => (
                                <div
                                    key={c.id}
                                    onClick={() => { setSelectedClientId(c.id); setViewState('BATCHES'); }}
                                    className="group cursor-pointer rounded-2xl border border-gray-200 bg-white p-5 hover:border-brand-300 hover:shadow-md transition-all dark:border-gray-700 dark:bg-gray-800 dark:hover:border-brand-500/50"
                                >
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
                                            <HiOutlineBriefcase size={20} />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-bold text-gray-900 dark:text-white line-clamp-1">{c.nom}</h3>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-1">{c.description || 'Projets internes / Non assignés'}</p>
                                        </div>
                                    </div>
                                    <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-4 dark:border-gray-700/50">
                                        <span className="text-[11px] font-bold uppercase tracking-widest text-brand-600 dark:text-brand-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                            Gérer les media plans →
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ── BATCHES VIEW ── */}
            {viewState === 'BATCHES' && selectedClientId && (
                <div className="space-y-6">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                            <button
                                onClick={() => setViewState('CLIENTS')}
                                className="mb-4 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-gray-500 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                            >
                                <HiOutlineArrowLeft size={14} /> Retour aux clients
                            </button>
                            <h1 className="text-2xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-gray-900 to-[#683b77] dark:from-white dark:to-[#ab78c3]">
                                {clients.find(c => c.id === selectedClientId)?.nom || 'Client Inconnu'}
                            </h1>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Groupes de la ligne de temps</p>
                        </div>
                        <button onClick={openAssignModal}
                            className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600 transition-colors">
                            <HiOutlineUserAdd size={18} /> Assigner Employé
                        </button>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        <div className="lg:col-span-3">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Employés assignés au client</label>
                            <div className="flex flex-wrap gap-2">
                                {existingAssignments.length === 0 ? (
                                    <span className="text-sm text-gray-400 italic">Aucun employé assigné</span>
                                ) : existingAssignments.map(a => (
                                    <span key={a.id} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300 text-xs font-semibold">
                                        {a.employePrenom} {a.employeNom}
                                        <button onClick={() => handleRemoveAssignment(a.id)} className="ml-1 hover:text-red-500 transition-colors" title="Retirer">
                                            <HiOutlineX size={14} />
                                        </button>
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Filters */}
                    <div className="flex flex-wrap gap-3">
                        <div className="relative flex-1 min-w-[200px]">
                            <HiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                            <input type="text" placeholder="Rechercher par titre, créateur, format..."
                                value={search} onChange={e => setSearch(e.target.value)}
                                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 pl-10 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-brand-500 dark:text-white" />
                        </div>
                        <select value={filterStatut} onChange={e => setFilterStatut(e.target.value)}
                            className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm dark:text-white">
                            <option value="">Tous les statuts</option>
                            <option value="EN_ATTENTE">En attente</option>
                            <option value="APPROUVE">Approuvé</option>
                            <option value="DESAPPROUVE">Désapprouvé</option>
                        </select>
                    </div>

                    {/* Month Tabs */}
                    {availableMonths.length > 0 && (
                        <div className="flex overflow-x-auto pb-2 scrollbar-hide gap-2">
                            {availableMonths.map(m => (
                                <button
                                    key={m}
                                    onClick={() => setSelectedMonthLabel(m)}
                                    className={`shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${selectedMonthLabel === m
                                        ? 'bg-green-500 text-white shadow'
                                        : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
                                        }`}
                                >
                                    {m}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Batch Cards Grid */}
                    {batches.length === 0 ? (
                        <div className="py-12 text-center bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 px-6">
                            <p className="text-gray-700 dark:text-gray-200 font-medium">Aucun media plan enregistré pour ce client</p>
                            <p className="mt-2 text-sm text-gray-400 dark:text-gray-500 max-w-md mx-auto">
                                Assigner un employé ne crée pas de lignes. Les plans apparaissent ici une fois saisis et enregistrés depuis Media Plan.
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-2">
                            {batches.map(batch => {
                                const batchStatus = getStatusInfo(batch.plans);
                                return (
                                    <div key={batch.key} onClick={() => { setSelectedBatchKey(batch.key); setViewState('BATCH_DETAILS'); }}
                                        className="group relative flex h-full cursor-pointer flex-col overflow-hidden rounded-[20px] border border-gray-200 bg-white p-5 shadow-sm transition-all hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:shadow-xl dark:hover:border-brand-500/50">
                                        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                                            <h3 className="line-clamp-2 flex-1 text-base font-semibold leading-snug text-gray-900 dark:text-gray-100">
                                                {getBatchLabel(batch)}
                                            </h3>
                                            <Badge variant={
                                                batchStatus.color === 'green' ? 'success' :
                                                    batchStatus.color === 'red' ? 'danger' :
                                                        batchStatus.color === 'warning' ? 'warning' : 'neutral' as any
                                            }>{batchStatus.label}</Badge>
                                        </div>

                                        <div className="flex-1 text-sm text-gray-500 dark:text-gray-400 mb-4">
                                            {batch.plans.length} ligne(s) dans ce lot.
                                        </div>

                                        <div className="mt-auto flex items-center justify-between border-t border-gray-100 pt-4 dark:border-gray-700/50">
                                            <span className="text-[11px] font-bold uppercase tracking-widest text-brand-600 dark:text-brand-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                                Voir Détails →
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* ── BATCH DETAILS VIEW ── */}
            {viewState === 'BATCH_DETAILS' && selectedBatchKey && (
                <div className="space-y-6">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                            <button
                                onClick={() => setViewState('BATCHES')}
                                className="mb-4 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-gray-500 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                            >
                                <HiOutlineArrowLeft size={14} /> Retour aux groupes
                            </button>
                            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                                {getBatchLabel(batches.find(b => b.key === selectedBatchKey)!)}
                            </h1>
                        </div>
                        <div className="flex items-center gap-2">
                            {(() => {
                                const activeBatch = batches.find(b => b.key === selectedBatchKey);
                                if (!activeBatch) return null;
                                const allApproved = activeBatch.plans.every(p => p.statut === 'APPROUVE');
                                const allDisapproved = activeBatch.plans.every(p => p.statut === 'DESAPPROUVE');

                                return (
                                    <>
                                        {canValidateMediaPlans && !allApproved && (
                                            <button onClick={() => handleApproveBatch(activeBatch)}
                                                className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg border border-gray-300 bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors">
                                                <HiOutlineCheck size={16} className="text-green-500" /> Approuver
                                            </button>
                                        )}
                                        {canValidateMediaPlans && !allDisapproved && (
                                            <button onClick={() => handleDisapproveBatch(activeBatch)}
                                                className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg border border-red-200 bg-red-50 text-red-600 text-sm font-medium dark:bg-red-900/10 dark:border-red-900/50 dark:text-red-400 hover:bg-red-100 transition-colors">
                                                <HiOutlineX size={16} /> Désapprouver
                                            </button>
                                        )}
                                    </>
                                );
                            })()}
                        </div>
                    </div>

                    <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm">
                        <table className="divide-y divide-gray-200 dark:divide-gray-700" style={{ tableLayout: 'fixed', width: tableWidth }}>
                            {renderTableHeader()}
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                {batches.find(b => b.key === selectedBatchKey)?.plans.map(mp => renderRow(mp))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}


            {/* Reactif Modal for Disapproval */}
            <Modal isOpen={!!disapproveBatchData} onClose={() => setDisapproveBatchData(null)} title="Désapprouver le lot" size="md">
                <div className="space-y-4">
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-400">
                        Vous êtes sur le point de désapprouver {disapproveBatchData?.plans.length} ligne(s).
                    </div>
                    <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Rectifs (Raison du refus) *</label>
                        <textarea
                            value={reactifContenu}
                            onChange={e => setReactifContenu(e.target.value)}
                            rows={4}
                            placeholder="Décrivez pourquoi ce lot est désapprouvé..."
                            className="w-full rounded-lg border border-gray-300 bg-transparent px-4 py-3 text-sm text-gray-700 focus:border-brand-500 focus:outline-none focus:ring focus:ring-brand-500/20 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-300"
                        />
                    </div>
                    {reactifError && <p className="text-sm text-red-500">{reactifError}</p>}
                    <div className="flex justify-end gap-3 pt-2">
                        <button onClick={() => setDisapproveBatchData(null)} className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">Annuler</button>
                        <button onClick={handleConfirmDisapprove} disabled={reactifLoading} className="px-4 py-2 rounded-lg bg-red-600 text-sm font-medium text-white hover:bg-red-700 transition-colors flex items-center gap-2">
                            {reactifLoading ? 'Envoi...' : <><HiOutlineX size={16} /> Confirmer la Désapprobation</>}
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Assign Employee Modal */}
            <Modal isOpen={showAssignModal} onClose={() => setShowAssignModal(false)} title="Assigner des employés Social Media" size="md">
                <div className="space-y-3 max-h-[50vh] overflow-y-auto">
                    {socialMediaEmployees.length === 0 ? (
                        <p className="text-sm text-gray-400 text-center py-4">Aucun employé trouvé dans le département Social Media</p>
                    ) : socialMediaEmployees.map(emp => {
                        const alreadyAssigned = existingAssignments.some(a => a.employeId === emp.id);
                        return (
                            <label key={emp.id}
                                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${alreadyAssigned
                                    ? 'border-green-300 bg-green-50 dark:bg-green-900/10 dark:border-green-700'
                                    : selectedEmployeeIds.includes(emp.id)
                                        ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/10'
                                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                                    }`}>
                                <input type="checkbox" checked={alreadyAssigned || selectedEmployeeIds.includes(emp.id)}
                                    disabled={alreadyAssigned} onChange={() => !alreadyAssigned && toggleEmployee(emp.id)}
                                    className="rounded border-gray-300 text-brand-500 focus:ring-brand-500" />
                                <div className="flex-1">
                                    <p className="text-sm font-medium text-gray-900 dark:text-white">{emp.prenom} {emp.nom}</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">{emp.email}</p>
                                </div>
                                {alreadyAssigned && <Badge variant="success">Assigné</Badge>}
                            </label>
                        );
                    })}
                </div>
                <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <button onClick={() => setShowAssignModal(false)} className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">Annuler</button>
                    <button onClick={handleAssign} disabled={selectedEmployeeIds.length === 0}
                        className="px-4 py-2 rounded-lg bg-brand-500 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                        Assigner ({selectedEmployeeIds.length})
                    </button>
                </div>
            </Modal >

            <ConfirmDialog {...confirmState} onConfirm={handleConfirm} onCancel={handleCancel} />
        </div >
    );
};

export default TousLesMediaPlanPage;
