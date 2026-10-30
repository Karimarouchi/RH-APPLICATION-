import React, { useState, useEffect, useMemo } from 'react';
import {
    HiOutlineSearch,
    HiOutlineCheck,
    HiOutlineX,
    HiOutlineUserAdd,
    HiOutlineBriefcase,
    HiOutlineArrowLeft,
    HiOutlineUserGroup,
    HiOutlineShieldCheck,
    HiOutlinePlus,
} from 'react-icons/hi';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { mediaPlanService } from '../api/mediaPlanService';
import { clientService, ClientDTO } from '../api/clientService';
import { mediaPlanAssignmentService } from '../api/mediaPlanAssignmentService';
import {
    MediaPlan,
    MediaPlanAssignment,
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
const UNDATED_MONTH = 'Indéterminé';

const CLIENT_FIELDS: Array<[string, string]> = [
    ['datePublication', 'Date'],
    ['heure', 'Heure'],
    ['format', 'Format'],
    ['type', 'Type'],
    ['titre', 'Titre'],
    ['texteSurVisuel', 'Texte / visuel'],
    ['inspiration', 'Inspiration'],
    ['autresElements', 'Autres éléments'],
    ['platforme', 'Plateforme'],
    ['lienDrive', 'Lien Drive'],
    ['etatPublication', 'État de publication'],
];
const ALL_CLIENT_FIELDS = CLIENT_FIELDS.map(([key]) => key);

type ValidationMode = 'MANAGER_CLIENT' | 'MANAGER';

const monthLabelOf = (mp: MediaPlan) => {
    if (!mp.datePublication) return UNDATED_MONTH;
    const d = new Date(mp.datePublication);
    return `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
};

const monthSortValue = (mp: MediaPlan) => {
    if (!mp.datePublication) return Number.MAX_SAFE_INTEGER;
    const d = new Date(mp.datePublication);
    return d.getFullYear() * 12 + d.getMonth();
};

const renderCellValue = (value: string | null) => {
    if (!value) return <span className="text-gray-300 dark:text-gray-600">—</span>;
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

const isRefused = (mp: MediaPlan) => mp.statut === 'DESAPPROUVE' || (mp.isShooting && mp.shootingStatus === StatutShooting.REJETE);
/** Lines the manager still has to decide on: freshly sent, or sent back by the client. */
const awaitsManager = (mp: MediaPlan) => mp.statut === 'EN_ATTENTE' || !!mp.retourManager;

const TousLesMediaPlanPage: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const canValidateMediaPlans = (user?.permissions ?? []).includes('VALIDATE_MEDIA_PLAN');
    const { confirm, confirmState, handleConfirm, handleCancel } = useConfirm();

    const [clients, setClients] = useState<ClientDTO[]>([]);
    const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
    const [mediaPlans, setMediaPlans] = useState<MediaPlan[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filterStatut, setFilterStatut] = useState('');

    const [viewState, setViewState] = useState<'CLIENTS' | 'PLAN'>('CLIENTS');
    const [selectedMonthLabel, setSelectedMonthLabel] = useState<string | null>(null);
    const [selectedIds, setSelectedIds] = useState<number[]>([]);

    const [showAssignModal, setShowAssignModal] = useState(false);
    const [socialMediaEmployees, setSocialMediaEmployees] = useState<{ id: number; nom: string; prenom: string; departement: string; email: string }[]>([]);
    const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<number[]>([]);
    const [existingAssignments, setExistingAssignments] = useState<MediaPlanAssignment[]>([]);

    // Accept / refuse dialogs work on a list of target lines (one line or a selection)
    const [acceptTargets, setAcceptTargets] = useState<MediaPlan[] | null>(null);
    const [validationMode, setValidationMode] = useState<ValidationMode>('MANAGER_CLIENT');
    const [acceptFields, setAcceptFields] = useState<string[]>(ALL_CLIENT_FIELDS);
    const [refuseTargets, setRefuseTargets] = useState<MediaPlan[] | null>(null);
    const [refuseText, setRefuseText] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [dialogError, setDialogError] = useState<string | null>(null);

    const [fixLine, setFixLine] = useState<MediaPlan | null>(null);
    const [fixTitre, setFixTitre] = useState('');
    const [fixTexte, setFixTexte] = useState('');

    useEffect(() => { loadClients(); }, []);
    useEffect(() => {
        if (selectedClientId) {
            setSelectedMonthLabel(null);
            setSelectedIds([]);
            loadMediaPlans(selectedClientId);
            loadAssignments(selectedClientId);
        }
    }, [selectedClientId]);

    const loadClients = async () => {
        try {
            const res = await clientService.getAllClients();
            setClients(res.data.data || []);
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

    const reload = () => { if (selectedClientId) loadMediaPlans(selectedClientId); };

    // ── Months (chronological) ──
    const availableMonths = useMemo(() => {
        const months = new Map<string, number>();
        for (const mp of mediaPlans) months.set(monthLabelOf(mp), monthSortValue(mp));
        return Array.from(months.entries()).sort((a, b) => a[1] - b[1]).map(([label]) => label);
    }, [mediaPlans]);

    useEffect(() => {
        if (availableMonths.length === 0) return;
        if (selectedMonthLabel && availableMonths.includes(selectedMonthLabel)) return;
        // Default to the first month that still has lines waiting for a decision
        const firstPending = availableMonths.find(m => mediaPlans.some(mp => monthLabelOf(mp) === m && awaitsManager(mp)));
        setSelectedMonthLabel(firstPending || availableMonths[availableMonths.length - 1]);
    }, [availableMonths, selectedMonthLabel, mediaPlans]);

    useEffect(() => { setSelectedIds([]); }, [selectedMonthLabel, filterStatut, search]);

    const monthPlans = useMemo(() => (
        mediaPlans
            .filter(mp => monthLabelOf(mp) === selectedMonthLabel)
            .sort((a, b) => (a.datePublication || '').localeCompare(b.datePublication || '') || a.id - b.id)
    ), [mediaPlans, selectedMonthLabel]);

    const visiblePlans = useMemo(() => {
        let filtered = monthPlans;
        if (filterStatut) {
            filtered = filtered.filter(mp => filterStatut === 'DESAPPROUVE' ? isRefused(mp) : mp.statut === filterStatut);
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
        return filtered;
    }, [monthPlans, filterStatut, search]);

    const counts = useMemo(() => ({
        pending: monthPlans.filter(awaitsManager).length,
        client: monthPlans.filter(mp => mp.statut === 'EN_ATTENTE_CLIENT').length,
        approved: monthPlans.filter(mp => mp.statut === 'APPROUVE' && !isRefused(mp)).length,
        refused: monthPlans.filter(mp => isRefused(mp) && !mp.retourManager).length,
    }), [monthPlans]);

    const authors = useMemo(() => {
        const names = new Set(monthPlans.map(mp => `${mp.createurPrenom || ''} ${mp.createurNom || ''}`.trim()).filter(Boolean));
        return Array.from(names).join(', ');
    }, [monthPlans]);

    // Motif de refus column only when at least one visible line was refused
    const showRefusalColumn = visiblePlans.some(mp => isRefused(mp) && (mp.rectifs || mp.shootingStatusReason));

    const selectablePlans = visiblePlans.filter(awaitsManager);
    const selectedPlans = visiblePlans.filter(mp => selectedIds.includes(mp.id));
    const allSelected = selectablePlans.length > 0 && selectablePlans.every(mp => selectedIds.includes(mp.id));

    const toggleSelected = (id: number) => setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    const toggleAll = () => setSelectedIds(allSelected ? [] : selectablePlans.map(mp => mp.id));

    // ── Accept ──
    const openAccept = (targets: MediaPlan[]) => {
        const decidable = targets.filter(awaitsManager);
        if (decidable.length === 0) return;
        setAcceptTargets(decidable);
        setValidationMode('MANAGER_CLIENT');
        setAcceptFields(ALL_CLIENT_FIELDS);
        setDialogError(null);
    };

    const submitAccept = async () => {
        if (!acceptTargets || acceptFields.length === 0) return;
        setSubmitting(true);
        setDialogError(null);
        try {
            for (const mp of acceptTargets) {
                await mediaPlanService.accept(mp.id, acceptFields, validationMode === 'MANAGER_CLIENT');
            }
            setAcceptTargets(null);
            setSelectedIds([]);
            reload();
        } catch (e: any) {
            setDialogError(e.response?.data?.message || 'Erreur lors de la validation');
        } finally {
            setSubmitting(false);
        }
    };

    // ── Refuse ──
    const openRefuse = (targets: MediaPlan[]) => {
        const refusable = targets.filter(mp => mp.statut === 'EN_ATTENTE');
        if (refusable.length === 0) return;
        setRefuseTargets(refusable);
        setRefuseText('');
        setDialogError(null);
    };

    const submitRefuse = async () => {
        if (!refuseTargets || !refuseText.trim()) return;
        setSubmitting(true);
        setDialogError(null);
        try {
            for (const mp of refuseTargets) {
                await mediaPlanService.refuse(mp.id, refuseText.trim());
            }
            setRefuseTargets(null);
            setRefuseText('');
            setSelectedIds([]);
            reload();
        } catch (e: any) {
            setDialogError(e.response?.data?.message || 'Erreur');
        } finally {
            setSubmitting(false);
        }
    };

    // ── Client feedback handling ──
    const submitFix = async () => {
        if (!fixLine || !fixTitre.trim()) return;
        try {
            await mediaPlanService.update(fixLine.id, { titre: fixTitre.trim(), texteSurVisuel: fixTexte });
            await mediaPlanService.accept(fixLine.id, ALL_CLIENT_FIELDS, true);
            setFixLine(null);
            reload();
        } catch (e: any) {
            alert(e.response?.data?.message || 'Erreur');
        }
    };

    const handleRenvoyerEmploye = async (mp: MediaPlan) => {
        try {
            await mediaPlanService.renvoyerEmploye(mp.id);
            reload();
        } catch (e: any) {
            alert(e.response?.data?.message || 'Erreur');
        }
    };

    // ── Assignments ──
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

    // ── Badges ──
    const getStatusBadge = (mp: MediaPlan) => {
        if (mp.retourManager) {
            return <span className="inline-flex items-center rounded-full bg-amber-50 dark:bg-amber-900/20 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-300">Retour client</span>;
        }
        const displayStatut = isRefused(mp) ? 'DESAPPROUVE' : mp.statut;
        if (displayStatut === 'EN_ATTENTE_CLIENT') {
            return <span className="inline-flex items-center rounded-full bg-purple-50 dark:bg-purple-900/20 px-2.5 py-0.5 text-xs font-semibold text-purple-700 dark:text-purple-300">En attente client</span>;
        }
        const colors: Record<string, string> = { EN_ATTENTE: 'warning', APPROUVE: 'success', DESAPPROUVE: 'danger' };
        return <Badge variant={(colors[displayStatut] || 'neutral') as any}>{StatutMediaPlanLabels[displayStatut] || displayStatut}</Badge>;
    };

    const getShootingStatusBadge = (statut: StatutShooting | null) => {
        if (!statut) return null;
        const colors: Record<string, string> = { EN_ATTENTE: 'warning', VALIDE: 'success', REJETE: 'danger' };
        const labels: Record<string, string> = { EN_ATTENTE: 'En attente', VALIDE: 'Validé', REJETE: 'Rejeté' };
        return <Badge variant={(colors[statut] || 'neutral') as any}>{labels[statut] || statut}</Badge>;
    };

    // ── Table ──
    const th = 'px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 whitespace-nowrap';
    const td = 'px-3 py-3 align-top text-sm text-gray-700 dark:text-gray-300';
    const clip = 'block max-w-[220px] truncate';
    const columnCount = 15 + (showRefusalColumn ? 1 : 0) + (canValidateMediaPlans ? 2 : 0);

    const renderRow = (mp: MediaPlan) => {
        const selectable = canValidateMediaPlans && awaitsManager(mp);
        const selected = selectedIds.includes(mp.id);
        return (
            <React.Fragment key={mp.id}>
                <tr className={`transition-colors ${selected ? 'bg-brand-50/60 dark:bg-brand-500/10' : isRefused(mp) ? 'bg-red-50/50 dark:bg-red-900/10' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'}`}>
                    {canValidateMediaPlans && (
                        <td className={`${td} w-10`}>
                            {selectable && (
                                <input type="checkbox" className="h-4 w-4 accent-brand-500" checked={selected} onChange={() => toggleSelected(mp.id)} aria-label={`Sélectionner ${mp.titre}`} />
                            )}
                        </td>
                    )}
                    <td className={`${td} whitespace-nowrap`}>{mp.datePublication || '—'}</td>
                    <td className={`${td} whitespace-nowrap`}>{mp.heure || '—'}</td>
                    <td className={`${td} whitespace-nowrap`}>{mp.format || '—'}</td>
                    <td className={`${td} whitespace-nowrap`}>{mp.type || '—'}</td>
                    <td className={td}><span className={`${clip} font-semibold text-gray-900 dark:text-white`} title={mp.titre}>{mp.titre || '—'}</span></td>
                    <td className={td}><span className={clip} title={mp.texteSurVisuel || ''}>{renderCellValue(mp.texteSurVisuel)}</span></td>
                    <td className={td}><span className={clip} title={mp.inspiration || ''}>{renderCellValue(mp.inspiration)}</span></td>
                    <td className={td}><span className={clip} title={mp.autresElements || ''}>{renderCellValue(mp.autresElements)}</span></td>
                    <td className={`${td} whitespace-nowrap`}>{mp.platforme || '—'}</td>
                    <td className={td}><span className={clip}>{renderCellValue(mp.lienDrive)}</span></td>
                    <td className={`${td} whitespace-nowrap`}>
                        {mp.etatPublication ? <Badge variant="neutral">{EtatPublicationLabels[mp.etatPublication as keyof typeof EtatPublicationLabels] || mp.etatPublication}</Badge> : '—'}
                    </td>
                    <td className={td}><span className={clip} title={mp.remarques || ''}>{renderCellValue(mp.remarques)}</span></td>
                    <td className={`${td} text-center`}>{mp.isShooting ? <Badge variant="primary">Oui</Badge> : <span className="text-gray-300 dark:text-gray-600">—</span>}</td>
                    <td className={`${td} whitespace-nowrap`}>{`${mp.createurPrenom || ''} ${mp.createurNom || ''}`.trim() || '—'}</td>
                    <td className={`${td} whitespace-nowrap`}>{getStatusBadge(mp)}</td>
                    {showRefusalColumn && (
                        <td className={td}>
                            {isRefused(mp) && (mp.rectifs || mp.shootingStatusReason) ? (
                                <span className="block max-w-[240px] whitespace-pre-wrap text-xs font-medium text-red-600 dark:text-red-400">{mp.rectifs || mp.shootingStatusReason}</span>
                            ) : null}
                        </td>
                    )}
                    {canValidateMediaPlans && (
                        <td className={`${td} whitespace-nowrap`}>
                            {mp.statut === 'EN_ATTENTE' && (
                                <div className="flex items-center gap-1.5">
                                    <button type="button" onClick={() => openAccept([mp])} className="inline-flex items-center gap-1 rounded-lg bg-green-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-green-700">
                                        <HiOutlineCheck size={14} /> Valider
                                    </button>
                                    <button type="button" onClick={() => openRefuse([mp])} className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 dark:border-red-900/50 dark:bg-transparent dark:text-red-400 dark:hover:bg-red-900/20">
                                        <HiOutlineX size={14} /> Refuser
                                    </button>
                                </div>
                            )}
                            {mp.retourManager && (
                                <div className="flex items-center gap-1.5">
                                    <button type="button" onClick={() => { setFixLine(mp); setFixTitre(mp.titre || ''); setFixTexte(mp.texteSurVisuel || ''); }} className="rounded-lg bg-green-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-green-700">Corriger moi-même</button>
                                    <button type="button" onClick={() => handleRenvoyerEmploye(mp)} className="rounded-lg bg-amber-500 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-amber-600">Renvoyer à l'employé</button>
                                </div>
                            )}
                        </td>
                    )}
                </tr>

                {mp.isShooting && (
                    <tr className="bg-gray-50/70 dark:bg-gray-800/30">
                        <td colSpan={columnCount} className="px-3 pb-3 pt-0">
                            <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-900">
                                <div className="flex items-center gap-2">
                                    <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Shooting · {mp.titre}</span>
                                    {getShootingStatusBadge(mp.shootingStatus)}
                                </div>
                                <div className="mt-2 grid grid-cols-1 gap-3 text-sm text-gray-700 dark:text-gray-200 md:grid-cols-4">
                                    <div>
                                        <div className="text-[11px] text-gray-400 dark:text-gray-500">Description</div>
                                        <div className="mt-0.5 whitespace-pre-wrap">{mp.shootingDescription || '—'}</div>
                                    </div>
                                    <div>
                                        <div className="text-[11px] text-gray-400 dark:text-gray-500">Localisation</div>
                                        <div className="mt-0.5">{mp.shootingLocalisation || '—'}</div>
                                    </div>
                                    <div>
                                        <div className="text-[11px] text-gray-400 dark:text-gray-500">Date</div>
                                        <div className="mt-0.5">{mp.shootingDate || (mp.shootingAuPlusTard ? `Au plus tard ${mp.shootingAuPlusTard}` : '—')}</div>
                                    </div>
                                    <div>
                                        <div className="text-[11px] text-gray-400 dark:text-gray-500">Type de contenu</div>
                                        <div className="mt-0.5">{mp.shootingTypeDeContenu ? TypeContenuShootingLabels[mp.shootingTypeDeContenu] : '—'}</div>
                                    </div>
                                </div>
                            </div>
                        </td>
                    </tr>
                )}
            </React.Fragment>
        );
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand-500"></div>
            </div>
        );
    }

    const clientName = clients.find(c => c.id === selectedClientId)?.nom || 'Client inconnu';
    const acceptCount = acceptTargets?.length || 0;

    return (
        <div className="space-y-6">
            {/* ── CLIENTS VIEW ── */}
            {viewState === 'CLIENTS' && (
                <div className="space-y-6">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Tous les Media Plans</h1>
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
                                    onClick={() => { setSelectedClientId(c.id); setViewState('PLAN'); }}
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

            {/* ── PLAN VIEW: all lines of the month in a single table ── */}
            {viewState === 'PLAN' && selectedClientId && (
                <div className="space-y-5">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
                        <div>
                            <button
                                onClick={() => setViewState('CLIENTS')}
                                className="mb-4 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-gray-500 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                            >
                                <HiOutlineArrowLeft size={14} /> Retour aux clients
                            </button>
                            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{clientName}</h1>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                                <span className="text-xs text-gray-500 dark:text-gray-400">Employés assignés :</span>
                                {existingAssignments.length === 0 ? (
                                    <span className="text-xs text-gray-400 italic">Aucun</span>
                                ) : existingAssignments.map(a => (
                                    <span key={a.id} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300 text-xs font-semibold">
                                        {a.employePrenom} {a.employeNom}
                                        {canValidateMediaPlans && (
                                            <button onClick={() => handleRemoveAssignment(a.id)} className="ml-0.5 hover:text-red-500 transition-colors" title="Retirer">
                                                <HiOutlineX size={12} />
                                            </button>
                                        )}
                                    </span>
                                ))}
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {/* Ouvre la saisie du media plan de ce client (ajout de lignes) */}
                            <button onClick={() => navigate(`/media-plan/${selectedClientId}`)}
                                className="inline-flex items-center gap-2 rounded-lg border border-brand-500 px-4 py-2.5 text-sm font-medium text-brand-600 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-500/10 transition-colors">
                                <HiOutlinePlus size={18} /> Ajouter des lignes
                            </button>
                            {canValidateMediaPlans && (
                                <button onClick={openAssignModal}
                                    className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600 transition-colors">
                                    <HiOutlineUserAdd size={18} /> Assigner Employé
                                </button>
                            )}
                        </div>
                    </div>

                    {mediaPlans.length === 0 ? (
                        <div className="py-12 text-center bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 px-6">
                            <p className="text-gray-700 dark:text-gray-200 font-medium">Aucun media plan enregistré pour ce client</p>
                            <p className="mt-2 text-sm text-gray-400 dark:text-gray-500 max-w-md mx-auto">
                                Assigner un employé ne crée pas de lignes. Les plans apparaissent ici une fois saisis et enregistrés depuis Media Plan.
                            </p>
                            <button
                                type="button"
                                onClick={() => navigate(`/media-plan/${selectedClientId}`)}
                                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600"
                            >
                                Ouvrir Media Plan
                            </button>
                        </div>
                    ) : (
                        <>
                            {/* Month tabs */}
                            <div className="flex overflow-x-auto pb-1 scrollbar-hide gap-2">
                                {availableMonths.map(m => {
                                    const pendingInMonth = mediaPlans.filter(mp => monthLabelOf(mp) === m && awaitsManager(mp)).length;
                                    return (
                                        <button
                                            key={m}
                                            onClick={() => setSelectedMonthLabel(m)}
                                            className={`shrink-0 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors ${selectedMonthLabel === m
                                                ? 'bg-brand-500 text-white shadow'
                                                : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
                                                }`}
                                        >
                                            {m}
                                            {pendingInMonth > 0 && (
                                                <span className={`rounded-full px-1.5 text-[11px] font-bold ${selectedMonthLabel === m ? 'bg-white/25 text-white' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'}`}>{pendingInMonth}</span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>

                            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
                                {/* Card header: summary + actions */}
                                <div className="flex flex-col gap-4 border-b border-gray-200 px-5 py-4 dark:border-gray-700 lg:flex-row lg:items-center lg:justify-between">
                                    <div>
                                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Media plan — {selectedMonthLabel}</h2>
                                        <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                                            {monthPlans.length} ligne(s){authors ? ` · rédigé par ${authors}` : ''}
                                        </p>
                                        <div className="mt-2 flex flex-wrap gap-2 text-xs">
                                            {counts.pending > 0 && <Badge variant="warning">{counts.pending} à valider</Badge>}
                                            {counts.client > 0 && <span className="inline-flex items-center rounded-full bg-purple-50 px-2.5 py-0.5 font-medium text-purple-700 dark:bg-purple-900/20 dark:text-purple-300">{counts.client} chez le client</span>}
                                            {counts.approved > 0 && <Badge variant="success">{counts.approved} approuvée(s)</Badge>}
                                            {counts.refused > 0 && <Badge variant="danger">{counts.refused} refusée(s)</Badge>}
                                        </div>
                                    </div>
                                    {canValidateMediaPlans && (
                                        <div className="flex flex-wrap items-center gap-2">
                                            {selectedPlans.length > 0 ? (
                                                <>
                                                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{selectedPlans.length} sélectionnée(s)</span>
                                                    <button onClick={() => openAccept(selectedPlans)}
                                                        className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700">
                                                        <HiOutlineCheck size={16} /> Valider la sélection
                                                    </button>
                                                    {selectedPlans.some(mp => mp.statut === 'EN_ATTENTE') && (
                                                        <button onClick={() => openRefuse(selectedPlans)}
                                                            className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-100 dark:border-red-900/50 dark:bg-red-900/10 dark:text-red-400">
                                                            <HiOutlineX size={16} /> Refuser la sélection
                                                        </button>
                                                    )}
                                                </>
                                            ) : counts.pending > 0 ? (
                                                <button onClick={() => openAccept(monthPlans)}
                                                    className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700">
                                                    <HiOutlineCheck size={16} /> Tout valider ({counts.pending})
                                                </button>
                                            ) : null}
                                        </div>
                                    )}
                                </div>

                                {/* Filters */}
                                <div className="flex flex-wrap gap-3 border-b border-gray-100 px-5 py-3 dark:border-gray-800">
                                    <div className="relative min-w-[200px] flex-1">
                                        <HiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                        <input type="text" placeholder="Rechercher par titre, créateur, format..."
                                            value={search} onChange={e => setSearch(e.target.value)}
                                            className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-9 pr-4 text-sm focus:ring-2 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
                                    </div>
                                    <select value={filterStatut} onChange={e => setFilterStatut(e.target.value)}
                                        className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white">
                                        <option value="">Tous les statuts</option>
                                        <option value="EN_ATTENTE">En attente</option>
                                        <option value="EN_ATTENTE_CLIENT">En attente client</option>
                                        <option value="APPROUVE">Approuvé</option>
                                        <option value="DESAPPROUVE">Désapprouvé</option>
                                    </select>
                                </div>

                                {visiblePlans.length === 0 ? (
                                    <div className="py-10 text-center text-sm text-gray-400 dark:text-gray-500">Aucune ligne ne correspond aux filtres.</div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                            <thead className="bg-gray-50 dark:bg-gray-800/60">
                                                <tr>
                                                    {canValidateMediaPlans && (
                                                        <th className={`${th} w-10`}>
                                                            {selectablePlans.length > 0 && (
                                                                <input type="checkbox" className="h-4 w-4 accent-brand-500" checked={allSelected} onChange={toggleAll} aria-label="Tout sélectionner" />
                                                            )}
                                                        </th>
                                                    )}
                                                    <th className={th}>Date pub.</th>
                                                    <th className={th}>Heure</th>
                                                    <th className={th}>Format</th>
                                                    <th className={th}>Type</th>
                                                    <th className={th}>Titre</th>
                                                    <th className={th}>Texte / visuel</th>
                                                    <th className={th}>Inspiration</th>
                                                    <th className={th}>Autres</th>
                                                    <th className={th}>Plateforme</th>
                                                    <th className={th}>Lien Drive</th>
                                                    <th className={th}>État pub.</th>
                                                    <th className={th}>Remarques</th>
                                                    <th className={th}>Shooting</th>
                                                    <th className={th}>Rédigé par</th>
                                                    <th className={th}>Statut</th>
                                                    {showRefusalColumn && <th className={th}>Motif de refus</th>}
                                                    {canValidateMediaPlans && <th className={th}>Décision</th>}
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                                {visiblePlans.map(mp => renderRow(mp))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* ── Accept dialog: choose the validation circuit ── */}
            <Modal
                isOpen={!!acceptTargets}
                onClose={() => setAcceptTargets(null)}
                title={acceptCount > 1 ? `Valider ${acceptCount} lignes` : `Valider « ${acceptTargets?.[0]?.titre || 'la ligne'} »`}
                size="lg"
            >
                <div className="space-y-5">
                    <div>
                        <p className="mb-2 text-sm font-semibold text-gray-800 dark:text-gray-100">Qui valide ce media plan ?</p>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            {([
                                ['MANAGER_CLIENT', HiOutlineUserGroup, 'Manager + Client', 'Votre validation envoie la ligne au client, qui donne la validation finale.'],
                                ['MANAGER', HiOutlineShieldCheck, 'Manager seul', 'La ligne est approuvée directement, sans passer par le client.'],
                            ] as const).map(([mode, Icon, label, description]) => {
                                const active = validationMode === mode;
                                return (
                                    <button
                                        key={mode}
                                        type="button"
                                        onClick={() => setValidationMode(mode)}
                                        aria-pressed={active}
                                        className={`flex items-start gap-3 rounded-xl border-2 p-4 text-left transition-colors ${active
                                            ? 'border-brand-500 bg-brand-50 dark:bg-brand-500/10'
                                            : 'border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600'}`}
                                    >
                                        <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${active ? 'bg-brand-500 text-white' : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-300'}`}>
                                            <Icon size={18} />
                                        </span>
                                        <span>
                                            <span className="block text-sm font-semibold text-gray-900 dark:text-white">{label}</span>
                                            <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">{description}</span>
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div>
                        <div className="mb-2 flex items-center justify-between">
                            <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">Champs visibles par le client</p>
                            <button
                                type="button"
                                onClick={() => setAcceptFields(acceptFields.length === ALL_CLIENT_FIELDS.length ? [] : ALL_CLIENT_FIELDS)}
                                className="text-xs font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400"
                            >
                                {acceptFields.length === ALL_CLIENT_FIELDS.length ? 'Tout décocher' : 'Tout cocher'}
                            </button>
                        </div>
                        <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
                            {validationMode === 'MANAGER_CLIENT'
                                ? 'Le client verra ces champs pour valider ou demander des rectifs.'
                                : 'Le client verra ces champs dans ses media plans approuvés.'}
                        </p>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                            {CLIENT_FIELDS.map(([key, label]) => (
                                <label key={key} className="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800">
                                    <input type="checkbox" className="h-4 w-4 accent-brand-500" checked={acceptFields.includes(key)} onChange={() => setAcceptFields(prev => prev.includes(key) ? prev.filter(x => x !== key) : [...prev, key])} />
                                    {label}
                                </label>
                            ))}
                        </div>
                        {acceptFields.length === 0 && <p className="mt-2 text-xs text-red-500">Choisissez au moins un champ.</p>}
                    </div>

                    {dialogError && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">{dialogError}</div>}

                    <div className="flex justify-end gap-2 border-t border-gray-100 pt-4 dark:border-gray-700">
                        <button type="button" onClick={() => setAcceptTargets(null)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700">Annuler</button>
                        <button type="button" onClick={submitAccept} disabled={acceptFields.length === 0 || submitting} className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50">
                            {submitting ? 'Validation…' : validationMode === 'MANAGER_CLIENT' ? 'Valider et envoyer au client' : 'Approuver'}
                        </button>
                    </div>
                </div>
            </Modal>

            {/* ── Refuse dialog: motif de refus ── */}
            <Modal
                isOpen={!!refuseTargets}
                onClose={() => setRefuseTargets(null)}
                title={(refuseTargets?.length || 0) > 1 ? `Refuser ${refuseTargets?.length} lignes` : `Refuser « ${refuseTargets?.[0]?.titre || 'la ligne'} »`}
                size="md"
            >
                <div className="space-y-3">
                    <p className="text-sm text-gray-600 dark:text-gray-300">Le motif de refus sera visible par l'employé, qui pourra corriger et renvoyer la ligne.</p>
                    <textarea value={refuseText} onChange={e => setRefuseText(e.target.value)} rows={4} autoFocus placeholder="Ex : le visuel ne correspond pas à la charte graphique…" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:bg-gray-900 dark:border-gray-600 dark:text-white" />
                    {dialogError && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">{dialogError}</div>}
                    <div className="flex justify-end gap-2">
                        <button type="button" onClick={() => setRefuseTargets(null)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700">Annuler</button>
                        <button type="button" onClick={submitRefuse} disabled={!refuseText.trim() || submitting} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50">
                            {submitting ? 'Envoi…' : 'Confirmer le refus'}
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
                                    ? 'border-green-300 bg-green-50 dark:bg-green-900/10 dark:border-green-700 hover:border-red-300 hover:bg-red-50 dark:hover:bg-red-900/10 dark:hover:border-red-700'
                                    : selectedEmployeeIds.includes(emp.id)
                                        ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/10'
                                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                                    }`}>
                                <input type="checkbox" checked={alreadyAssigned || selectedEmployeeIds.includes(emp.id)}
                                    onChange={() => {
                                        if (alreadyAssigned) {
                                            const assignment = existingAssignments.find(a => a.employeId === emp.id);
                                            if (assignment) {
                                                setShowAssignModal(false);
                                                handleRemoveAssignment(assignment.id);
                                            }
                                        } else {
                                            toggleEmployee(emp.id);
                                        }
                                    }}
                                    className={`rounded border-gray-300 focus:ring-brand-500 ${alreadyAssigned ? 'text-green-500 cursor-pointer' : 'text-brand-500'}`} />
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
            </Modal>

            <Modal isOpen={!!fixLine} onClose={() => setFixLine(null)} title="Corriger la ligne puis la renvoyer au client" size="md">
                <div className="space-y-3">
                    {fixLine?.rectifs && (
                        <div className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
                            <span className="font-semibold">Rectifs du client :</span> {fixLine.rectifs}
                        </div>
                    )}
                    <input value={fixTitre} onChange={e => setFixTitre(e.target.value)} placeholder="Titre" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:bg-gray-900 dark:border-gray-600 dark:text-white" />
                    <textarea value={fixTexte} onChange={e => setFixTexte(e.target.value)} rows={4} placeholder="Texte / visuel" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:bg-gray-900 dark:border-gray-600 dark:text-white" />
                    <div className="flex justify-end gap-2">
                        <button type="button" onClick={() => setFixLine(null)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 dark:border-gray-600 dark:text-gray-300">Annuler</button>
                        <button type="button" onClick={submitFix} disabled={!fixTitre.trim()} className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">Corriger et renvoyer au client</button>
                    </div>
                </div>
            </Modal>

            <ConfirmDialog {...confirmState} onConfirm={handleConfirm} onCancel={handleCancel} />
        </div>
    );
};

export default TousLesMediaPlanPage;
