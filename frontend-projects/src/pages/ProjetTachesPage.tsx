import TypeDrivePicker from '../components/taches/TypeDrivePicker';
import LivrablesSection from '../components/taches/LivrablesSection';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { HiOutlinePlus, HiOutlinePencil, HiOutlineTrash, HiOutlineArrowLeft, HiOutlineCalendar, HiOutlineClock, HiOutlineCheckCircle, HiOutlineChartBar, HiDotsHorizontal } from 'react-icons/hi';
import { tacheService } from '../api/tacheService';
import { projetService } from '../api/projetService';
import { employeService } from '../api/employeService';
import { mediaPlanService } from '../api/mediaPlanService';
import { Tache, Projet, Employe, StatutTache, MediaPlan } from '../types';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { useConfirm } from '../hooks/useConfirm';
import { useAuth } from '../context/AuthContext';
import { HiOutlineChatAlt2 } from 'react-icons/hi';
import { reactifService } from '../api/reactifService';

const statutBadgeMap: Record<string, 'neutral' | 'primary' | 'success'> = {
    TODO: 'neutral',
    IN_PROGRESS: 'primary',
    DONE: 'success',
};

const statutLabels: Record<string, string> = {
    TODO: 'À faire',
    IN_PROGRESS: 'En cours',
    DONE: 'Terminée',
};

const columnColors: Record<string, string> = {
    TODO: 'border-gray-300 dark:border-gray-700',
    IN_PROGRESS: 'border-brand-300 dark:border-brand-700',
    DONE: 'border-success-300 dark:border-success-700',
};

const inputClass =
    'h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 text-theme-sm text-gray-700 focus:border-brand-300 focus:outline-none focus:ring focus:ring-brand-500/10 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-300';

interface TacheForm {
    titre: string;
    dateEcheance: string;
    statut: StatutTache;
    assigneeIds: string[];
    urgente: boolean;
    typeDrive: string[];
}

const emptyForm = (): TacheForm => ({
    titre: '',
    dateEcheance: '',
    statut: StatutTache.TODO,
    assigneeIds: [],
    urgente: false,
    typeDrive: [],
});

const ProjetTachesPage: React.FC = () => {
    const { projetId } = useParams<{ projetId: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();
    const { confirmState, confirm, handleConfirm, handleCancel } = useConfirm();

    const [projet, setProjet] = useState<Projet | null>(null);
    const [taches, setTaches] = useState<Tache[]>([]);
    const [projectMembers, setProjectMembers] = useState<Employe[]>([]); // restricted list for assignment
    const [allMembers, setAllMembers] = useState<Employe[]>([]);         // full list for name display
    const [loading, setLoading] = useState(true);

    // Drag state
    const dragTacheId = useRef<number | null>(null);
    const [dragOverCol, setDragOverCol] = useState<string | null>(null);

    // Create modal — supports multiple tasks queued
    const [showCreate, setShowCreate] = useState(false);
    const [taskForms, setTaskForms] = useState<TacheForm[]>([emptyForm()]);
    const [createError, setCreateError] = useState<string | null>(null);
    const [createLoading, setCreateLoading] = useState(false);

    // Edit modal
    const [editingTache, setEditingTache] = useState<Tache | null>(null);
    const [editForm, setEditForm] = useState<TacheForm>(emptyForm());
    const [editError, setEditError] = useState<string | null>(null);
    const [editLoading, setEditLoading] = useState(false);

    // View modal
    const [viewingTache, setViewingTache] = useState<Tache | null>(null);
    const [mediaPlanDetails, setMediaPlanDetails] = useState<MediaPlan | null>(null);

    // Reactif modal
    const [reactifTache, setReactifTache] = useState<Tache | null>(null);
    const [reactifContenu, setReactifContenu] = useState('');
    const [reactifLoading, setReactifLoading] = useState(false);
    const [reactifError, setReactifError] = useState<string | null>(null);

    const handleReactif = async () => {
        if (!reactifTache || !reactifContenu.trim()) { setReactifError('Le reactif est obligatoire'); return; }
        if (!user?.employeId) { setReactifError('Utilisateur non identifie'); return; }
        setReactifLoading(true);
        try {
            await reactifService.createForTache(reactifTache.id, user.employeId, reactifContenu.trim());
            setReactifTache(null); setReactifContenu(''); setReactifError(null);
            loadData();
        } catch { setReactifError('Erreur enregistrement reactif'); }
        finally { setReactifLoading(false); }
    };

    const pid = Number(projetId);

    useEffect(() => {
        loadData();
    }, [projetId]);

    const loadData = useCallback(async () => {
        if (!pid) return;
        setLoading(true);
        try {
            const [pRes, tRes] = await Promise.all([
                projetService.getById(pid),
                tacheService.getByProjet(pid),
            ]);
            const p: Projet = pRes.data.data;
            setProjet(p);
            setTaches(tRes.data.data || []);

            if (p.isMediaPlanProject && p.mediaPlanLigneId) {
                mediaPlanService.getById(p.mediaPlanLigneId)
                    .then(r => setMediaPlanDetails(r.data.data))
                    .catch(e => console.error(e));
            } else {
                setMediaPlanDetails(null);
            }

            // Build the full member map (all chefs + all membres) for display purposes
            const allMemberMap = new Map<number, Employe>();
            if (p?.chefDeProjet) allMemberMap.set(p.chefDeProjet.id, p.chefDeProjet as Employe);
            if (p?.chefsDeProjet && p.chefsDeProjet.length > 0) {
                p.chefsDeProjet.forEach(c => { if (!allMemberMap.has(c.id)) allMemberMap.set(c.id, c as Employe); });
            }
            for (const m of (p?.membres ?? [])) {
                if (!allMemberMap.has(m.id)) allMemberMap.set(m.id, m);
            }

            // Determine if the current user is a chef (manager) on this project
            const allMembersArr = Array.from(allMemberMap.values());
            setAllMembers(allMembersArr);
            const currentUserId = user?.employeId;
            const isChef = currentUserId && (
                p?.chefDeProjet?.id === currentUserId ||
                (p?.chefsDeProjet ?? []).some(c => c.id === currentUserId)
            );

            if (isChef && currentUserId) {
                // Manager: can only assign to themselves + their own subordinates who are project members
                try {
                    const subRes = await employeService.getSubordinates(currentUserId);
                    const subordinateIds = new Set(((subRes.data.data || subRes.data || []) as any[]).map((s: any) => s.id));
                    const filtered = Array.from(allMemberMap.values()).filter(
                        m => m.id === currentUserId || subordinateIds.has(m.id)
                    );
                    setProjectMembers(filtered);
                } catch {
                    // Fallback: show only themselves
                    const self = allMemberMap.get(currentUserId);
                    setProjectMembers(self ? [self] : []);
                }
            } else {
                // Non-chef user: show all members (shouldn't normally reach here but safe fallback)
                setProjectMembers(Array.from(allMemberMap.values()));
            }
        } catch (err) {
            console.error('Erreur chargement:', err);
        } finally {
            setLoading(false);
        }
    }, [pid]);

    // ── Drag and Drop ─────────────────────────────────────────

    const handleDragStart = (e: React.DragEvent, tacheId: number) => {
        dragTacheId.current = tacheId;
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e: React.DragEvent, colStatut: string) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setDragOverCol(colStatut);
    };

    const handleDrop = async (e: React.DragEvent, colStatut: StatutTache) => {
        e.preventDefault();
        setDragOverCol(null);
        if (dragTacheId.current === null) return;
        const tache = taches.find(t => t.id === dragTacheId.current);
        if (!tache || tache.statut === colStatut) return;
        dragTacheId.current = null;
        // Optimistic update
        setTaches(prev => prev.map(t => t.id === tache.id ? { ...t, statut: colStatut } : t));
        try {
            await tacheService.changeStatut(tache.id, colStatut);
        } catch {
            // Revert on failure
            loadData();
        }
    };

    const handleDragLeave = () => setDragOverCol(null);

    // ── Multi-task creation ────────────────────────────────────

    const addTaskForm = () => setTaskForms(prev => [...prev, emptyForm()]);
    const removeTaskForm = (idx: number) => setTaskForms(prev => prev.filter((_, i) => i !== idx));

    const updateTaskForm = <K extends keyof TacheForm>(idx: number, field: K, value: TacheForm[K]) =>
        setTaskForms(prev => prev.map((f, i) => i === idx ? { ...f, [field]: value } : f));

    const toggleTaskAssignee = (idx: number, memberId: string) => {
        setTaskForms(prev => prev.map((f, i) => {
            if (i !== idx) return f;
            const ids = f.assigneeIds.includes(memberId)
                ? f.assigneeIds.filter(id => id !== memberId)
                : [...f.assigneeIds, memberId];
            return { ...f, assigneeIds: ids };
        }));
    };

    const handleCreateAll = async () => {
        if (taskForms.some(f => f.typeDrive.length === 0)) {
            setCreateError('Choisissez un type de tâche (Post, Vidéo ou Documentation) pour chaque tâche');
            return;
        }
        if (taskForms.some(f => !f.titre.trim())) {
            setCreateError('Tous les titres sont obligatoires');
            return;
        }
        setCreateLoading(true);
        setCreateError(null);
        try {
            for (const form of taskForms) {
                if (form.assigneeIds.length <= 1) {
                    // Single or no assignee → one task
                    const created = await tacheService.create(pid, {
                        titre: form.titre,
                        statut: form.statut,
                        dateEcheance: form.dateEcheance || undefined,
                        urgente: form.urgente,
                        typeDrive: form.typeDrive.join(','),
                    } as any);
                    if (form.assigneeIds[0]) {
                        await tacheService.assign(created.data.data.id, Number(form.assigneeIds[0]));
                    }
                } else {
                    // Multiple assignees → one task per member
                    for (const memberId of form.assigneeIds) {
                        const created = await tacheService.create(pid, {
                            titre: form.titre,
                            statut: form.statut,
                            dateEcheance: form.dateEcheance || undefined,
                            urgente: form.urgente,
                            typeDrive: form.typeDrive.join(','),
                        } as any);
                        await tacheService.assign(created.data.data.id, Number(memberId));
                    }
                }
            }
            setShowCreate(false);
            setTaskForms([emptyForm()]);
            loadData();
        } catch (err: any) {
            setCreateError(err?.response?.data?.message || 'Erreur lors de la création');
        } finally {
            setCreateLoading(false);
        }
    };

    // ── Edit ───────────────────────────────────────────────────

    const openEdit = (tache: Tache) => {
        setEditingTache(tache);
        setEditForm({
            titre: tache.titre,
            dateEcheance: tache.dateEcheance || '',
            statut: tache.statut,
            assigneeIds: tache.assigneeId ? [String(tache.assigneeId)] : [],
            urgente: tache.urgente ?? false,
            typeDrive: ((tache as any).typeDrive ? String((tache as any).typeDrive).split(',').map((t: string) => t.trim()).filter(Boolean) : []),
        });
        setEditError(null);
    };

    const handleEditSave = async () => {
        if (!editingTache) return;
        setEditLoading(true);
        setEditError(null);
        try {
            await tacheService.update(editingTache.id, {
                titre: editForm.titre,
                dateEcheance: editForm.dateEcheance || undefined,
                statut: editForm.statut,
                urgente: editForm.urgente,
                typeDrive: editForm.typeDrive.join(',') || undefined,
            } as any);
            // Assign the first selected member (or clear)
            if (editForm.assigneeIds[0]) {
                await tacheService.assign(editingTache.id, Number(editForm.assigneeIds[0]));
            }
            setEditingTache(null);
            loadData();
        } catch (err: any) {
            setEditError(err?.response?.data?.message || 'Erreur lors de la modification');
        } finally {
            setEditLoading(false);
        }
    };

    const toggleEditAssignee = (memberId: string) => {
        setEditForm(f => {
            const ids = f.assigneeIds.includes(memberId)
                ? f.assigneeIds.filter(id => id !== memberId)
                : [...f.assigneeIds, memberId];
            return { ...f, assigneeIds: ids };
        });
    };


    // ── Delete ─────────────────────────────────────────────────

    const handleDelete = async (id: number) => {
        confirm('Supprimer cette tâche ?', async () => {
            try {
                await tacheService.delete(id);
                setTaches(prev => prev.filter(t => t.id !== id));
            } catch (err) {
                console.error('Erreur suppression:', err);
            }
        }, 'Supprimer la tâche');
    };

    const getMemberNom = (id: number | null) => {
        if (!id) return 'Non assigné';
        const m = allMembers.find(e => e.id === id);
        return m ? `${m.prenom} ${m.nom}` : '-';
    };

    const grouped: Record<'TODO' | 'IN_PROGRESS' | 'DONE', Tache[]> = {
        TODO: [...taches.filter(t => t.statut === 'TODO')].sort((a, b) => (b.urgente ? 1 : 0) - (a.urgente ? 1 : 0)),
        IN_PROGRESS: [...taches.filter(t => t.statut === 'IN_PROGRESS')].sort((a, b) => (b.urgente ? 1 : 0) - (a.urgente ? 1 : 0)),
        DONE: [...taches.filter(t => t.statut === 'DONE')].sort((a, b) => (b.urgente ? 1 : 0) - (a.urgente ? 1 : 0)),
    };

    const MemberCheckList: React.FC<{
        selectedIds: string[];
        onToggle: (id: string) => void;
        label?: string;
    }> = ({ selectedIds, onToggle, label }) => (
        <div>
            {label && (
                <label className="mb-1.5 block text-theme-sm font-medium text-gray-700 dark:text-gray-300">
                    {label}
                    {selectedIds.length > 0 && (
                        <span className="ml-1 text-theme-xs text-brand-500">({selectedIds.length} sélectionné{selectedIds.length > 1 ? 's' : ''})</span>
                    )}
                </label>
            )}
            {projectMembers.length === 0 ? (
                <p className="text-theme-xs text-gray-400 italic">Aucun membre assigné à ce projet.</p>
            ) : (
                <div className="max-h-36 overflow-y-auto rounded-lg border border-gray-300 dark:border-gray-600">
                    {projectMembers.map(m => (
                        <label
                            key={m.id}
                            className={`flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 ${selectedIds.includes(String(m.id)) ? 'bg-brand-50 dark:bg-brand-500/10' : ''}`}
                        >
                            <input
                                type="checkbox"
                                checked={selectedIds.includes(String(m.id))}
                                onChange={() => onToggle(String(m.id))}
                                className="h-4 w-4 rounded text-brand-500"
                            />
                            <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-secondary-100 text-secondary-600 text-[10px] font-bold dark:bg-secondary-500/20">
                                {m.prenom?.[0]}{m.nom?.[0]}
                            </div>
                            <span className="text-theme-sm text-gray-700 dark:text-gray-300">{m.prenom} {m.nom}</span>
                        </label>
                    ))}
                </div>
            )}
        </div>
    );

    if (loading) return <div className="py-16 text-center text-gray-500">Chargement...</div>;
    if (!projet) return <div className="py-16 text-center text-error-500">Projet introuvable.</div>;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate('/projets')}
                        className="flex items-center gap-1.5 rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                    >
                        <HiOutlineArrowLeft size={20} />
                    </button>
                    <div>
                        <h1 className="text-title-sm font-bold text-gray-800 dark:text-white">
                            Tâches — {projet.nom}
                        </h1>
                        <p className="text-theme-sm text-gray-500 dark:text-gray-400 mt-0.5">
                            {taches.length} tâche{taches.length > 1 ? 's' : ''}
                            {projet.chefDeProjet && ` · Chef : ${projet.chefDeProjet.prenom} ${projet.chefDeProjet.nom}`}
                            {projectMembers.length > 0 && ` · ${projectMembers.length} membre${projectMembers.length > 1 ? 's' : ''}`}
                        </p>
                    </div>
                </div>
                {!projet?.isMediaPlanProject && (
                    <Button onClick={() => { setShowCreate(true); setTaskForms([emptyForm()]); setCreateError(null); }}>
                        <HiOutlinePlus size={18} /> Nouvelles tâches
                    </Button>
                )}
            </div>

            {/* Hint */}
            <p className="text-theme-xs text-gray-400 italic">
                💡 Glissez-déposez les cartes pour changer leur statut
            </p>

            {/* Kanban */}
            {taches.length === 0 ? (
                <div className="rounded-2xl border border-gray-200 bg-white p-16 text-center dark:border-gray-800 dark:bg-gray-dark">
                    <p className="text-gray-400">Aucune tâche pour ce projet.</p>
                    {!projet?.isMediaPlanProject && (
                        <Button className="mt-4" onClick={() => setShowCreate(true)}>
                            <HiOutlinePlus size={16} /> Créer la première tâche
                        </Button>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                    {(['TODO', 'IN_PROGRESS', 'DONE'] as const).map(colStatut => (
                        <div
                            key={colStatut}
                            onDragOver={e => handleDragOver(e, colStatut)}
                            onDrop={e => handleDrop(e, colStatut as StatutTache)}
                            onDragLeave={handleDragLeave}
                            className={`rounded-2xl transition-colors dark:bg-[#13161f] bg-gray-50 border border-gray-200 dark:border-transparent ${dragOverCol === colStatut ? 'ring-2 ring-brand-500/50' : ''}`}
                        >
                            <div className="flex items-center justify-between px-5 pt-5 pb-3">
                                <div className="flex items-center gap-2">
                                    <span className="text-[11px] font-extrabold uppercase tracking-widest text-gray-800 dark:text-white">
                                        {colStatut === 'TODO' ? 'TO DO' : colStatut === 'IN_PROGRESS' ? 'IN PROGRESS' : 'DONE'}
                                    </span>
                                    <span className="flex h-5 items-center justify-center rounded-md bg-gray-200 px-2 text-[10px] font-bold text-gray-600 dark:bg-[#24283b] dark:text-[#565f89]">
                                        {grouped[colStatut].length}
                                    </span>
                                </div>
                                <button className="text-gray-400 transition-colors hover:text-gray-600 dark:hover:text-gray-300">
                                    <HiDotsHorizontal size={16} />
                                </button>
                            </div>
                            <div className="min-h-[120px] space-y-3 p-3">
                                {grouped[colStatut].length === 0 ? (
                                    <div className={`flex items-center justify-center rounded-xl border-2 border-dashed py-8 transition-colors ${dragOverCol === colStatut ? 'border-brand-300 text-brand-400' : 'border-gray-200 text-gray-300 dark:border-gray-700'}`}>
                                        <p className="text-theme-xs">Déposer ici</p>
                                    </div>
                                ) : (
                                    grouped[colStatut].map(tache => {
                                        let typeText = "TÂCHE";
                                        if ((tache as any).typeDrive) {
                                            const typesArr = ((tache as any).typeDrive as string).split(',');
                                            if (typesArr.length > 0 && typesArr[0]) typeText = typesArr[0].toUpperCase();
                                        }
                                        if (projet?.isMediaPlanProject) typeText = "MEDIA PLAN";

                                        let topRight = null;
                                        if (tache.statut === 'DONE' && !tache.dateEcheance) {
                                            topRight = <span className="flex items-center gap-1 text-[11px] font-semibold text-success-600 dark:text-[#9ece6a]"><HiOutlineCheckCircle size={14} /> Terminé</span>;
                                        } else if (tache.statut === 'IN_PROGRESS' && !tache.dateEcheance) {
                                            topRight = <span className="flex items-center gap-1 text-[11px] font-semibold text-warning-600 dark:text-[#e0af68]"><HiOutlineClock size={14} /> En cours</span>;
                                        } else if (tache.dateEcheance) {
                                            topRight = <span className="flex items-center gap-1 text-[11px] font-semibold text-gray-500 dark:text-[#565f89]"><HiOutlineCalendar size={14} /> {tache.dateEcheance.substring(5).replace('-', '/')}</span>;
                                        } else {
                                            topRight = <span className="flex items-center gap-1 text-[11px] font-semibold text-gray-400 dark:text-[#565f89]">--</span>;
                                        }

                                        let assigneeInitials = "U";
                                        let assigneeName = getMemberNom(tache.assigneeId);
                                        if (assigneeName && assigneeName.trim() !== '-') {
                                            const parts = assigneeName.split(' ');
                                            if (parts.length >= 2) {
                                                assigneeInitials = (parts[0][0] + parts[1][0]).toUpperCase();
                                            } else {
                                                assigneeInitials = parts[0].substring(0, 2).toUpperCase();
                                            }
                                        }

                                        return (
                                            <div
                                                key={tache.id}
                                                draggable
                                                onClick={() => setViewingTache(tache)}
                                                onDragStart={e => handleDragStart(e, tache.id)}
                                                className={`cursor-pointer cursor-grab active:cursor-grabbing rounded-2xl border bg-white p-4 shadow-sm transition-all hover:shadow-md dark:bg-[#1a1b26] ${tache.urgente ? 'border-error-300 dark:border-[#f7768e]/50 hover:border-error-400 dark:hover:border-[#f7768e]' : 'border-gray-200 dark:border-[#292e42] hover:border-brand-300 dark:hover:border-[#3b4261]'}`}
                                            >
                                                <div className="mb-3 flex items-start justify-between gap-2">
                                                    <span className="rounded bg-gray-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-gray-500 dark:bg-[#292e42] dark:text-gray-300">
                                                        {typeText}
                                                    </span>
                                                    {topRight}
                                                </div>
                                                <p className="mb-4 text-[13px] font-bold leading-relaxed text-gray-800 line-clamp-3 dark:text-gray-100">
                                                    {tache.titre}
                                                </p>
                                                <div className="flex items-center justify-between">
                                                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-100 text-[10px] font-bold text-brand-600 shadow-sm ring-2 ring-white dark:bg-[#3d59a1] dark:text-white dark:ring-[#1a1b26]" title={assigneeName}>
                                                        {assigneeInitials}
                                                    </div>
                                                    <div className={`flex items-center gap-1 text-[10px] font-bold ${tache.urgente ? 'text-error-600 dark:text-[#f7768e]' : 'text-success-600 dark:text-[#9ece6a]'}`}>
                                                        {tache.urgente ? (
                                                            <span className="flex items-center gap-0.5"><span className="text-[12px]">!</span> High</span>
                                                        ) : (
                                                            <span className="flex items-center gap-0.5"><HiOutlineChartBar size={12} /> Normal</span>
                                                        )}
                                                    </div>
                                                </div>
                                                {tache.statut === 'DONE' && (
                                                    <button
                                                        onClick={e => { e.stopPropagation(); setReactifTache(tache); setReactifContenu(''); setReactifError(null); }}
                                                        className="mt-2 w-full flex items-center justify-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 py-1.5 text-[11px] font-semibold text-amber-600 hover:bg-amber-100 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400"
                                                        title="Reactif"
                                                    >
                                                        <HiOutlineChatAlt2 size={12} />
                                                        Reactif
                                                    </button>
                                                )}
                                            </div>
                                        )
                                    })
                                )}
                                {/* For "TO DO" column, add the NEW TASK button if no media plan */}
                                {colStatut === 'TODO' && !projet?.isMediaPlanProject && (
                                    <button
                                        onClick={() => setShowCreate(true)}
                                        className="mt-3 flex w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-300 py-6 text-gray-400 transition-colors hover:border-brand-400 hover:text-brand-500 hover:bg-brand-50 dark:border-[#292e42] dark:bg-transparent dark:text-[#565f89] dark:hover:border-[#3b4261] dark:hover:text-gray-300 dark:hover:bg-[#1a1b26]/50"
                                    >
                                        <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-inherit mb-2">
                                            <HiOutlinePlus size={16} />
                                        </div>
                                        <span className="text-[11px] font-bold uppercase tracking-widest text-inherit">NEW TASK</span>
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Reactif Modal */}
            <Modal
                isOpen={!!reactifTache}
                onClose={() => { setReactifTache(null); setReactifContenu(''); setReactifError(null); }}
                title="Ajouter un reactif"
                size="md"
            >
                <div className="space-y-4">
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-theme-sm text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400">
                        Cette tache sera remise A faire et l'assigne recevra votre reactif.
                    </div>
                    <div>
                        <label className="mb-1 block text-theme-sm font-medium text-gray-700 dark:text-gray-300">Reactif (raison / correction)</label>
                        <textarea
                            value={reactifContenu}
                            onChange={e => setReactifContenu(e.target.value)}
                            rows={4}
                            placeholder="Decrivez ce qui doit etre corrige..."
                            className="w-full rounded-lg border border-gray-300 bg-transparent px-4 py-3 text-theme-sm text-gray-700 focus:border-amber-300 focus:outline-none focus:ring focus:ring-amber-500/10 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-300"
                        />
                    </div>
                    {reactifError && <p className="text-theme-xs text-error-500">{reactifError}</p>}
                    <div className="flex justify-end gap-3">
                        <Button variant="outline" onClick={() => setReactifTache(null)}>Annuler</Button>
                        <Button onClick={handleReactif} disabled={reactifLoading}>
                            {reactifLoading ? 'Envoi...' : 'Envoyer le reactif'}
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* ── Create Modal ─────────────────────────────────────── */}
            <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Créer des tâches" size="lg">
                <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
                    {taskForms.map((form, idx) => (
                        <div key={idx} className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
                            <div className="mb-2 flex items-center justify-between">
                                <span className="text-theme-xs font-semibold text-gray-600 dark:text-gray-300">Tâche {idx + 1}</span>
                                {taskForms.length > 1 && (
                                    <button onClick={() => removeTaskForm(idx)} className="text-error-400 hover:text-error-600">
                                        <HiOutlineTrash size={14} />
                                    </button>
                                )}
                            </div>
                            <div className="space-y-3">
                                <input
                                    type="text"
                                    value={form.titre}
                                    onChange={e => updateTaskForm(idx, 'titre', e.target.value)}
                                    placeholder="Titre de la tâche *"
                                    className={inputClass}
                                />
                                <div className="grid grid-cols-2 gap-3">
                                    <input
                                        type="date"
                                        value={form.dateEcheance}
                                        onChange={e => updateTaskForm(idx, 'dateEcheance', e.target.value)}
                                        className={inputClass}
                                        title="Date d'échéance"
                                    />
                                    <select
                                        value={form.statut}
                                        onChange={e => updateTaskForm(idx, 'statut', e.target.value as StatutTache)}
                                        className={inputClass}
                                    >
                                        {Object.entries(statutLabels).map(([k, v]) => (
                                            <option key={k} value={k}>{v}</option>
                                        ))}
                                    </select>
                                </div>
                                <TypeDrivePicker value={form.typeDrive} onChange={v => updateTaskForm(idx, 'typeDrive', v)} />
                                <MemberCheckList
                                    selectedIds={form.assigneeIds}
                                    onToggle={id => toggleTaskAssignee(idx, id)}
                                    label={`Assigner à${form.assigneeIds.length > 1 ? ' (crée une tâche par membre)' : ''}`}
                                />

                                <button
                                    type="button"
                                    onClick={() => updateTaskForm(idx, 'urgente', !form.urgente)}
                                    className={`flex w-full items-center justify-center gap-2 rounded-lg border-2 py-2 text-theme-sm font-medium transition-colors ${form.urgente
                                        ? 'border-error-500 bg-error-50 text-error-600 dark:bg-error-500/10 dark:text-error-400'
                                        : 'border-gray-300 text-gray-400 hover:border-error-300 hover:text-error-500 dark:border-gray-600'
                                        }`}
                                >
                                    🚨 {form.urgente ? 'Tâche urgente (actif)' : 'Marquer comme urgente'}
                                </button>
                            </div>
                        </div>
                    ))}

                    <button
                        type="button"
                        onClick={addTaskForm}
                        className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-brand-300 py-3 text-theme-sm text-brand-500 hover:border-brand-400 hover:bg-brand-50 dark:border-brand-600 dark:hover:bg-brand-500/5"
                    >
                        <HiOutlinePlus size={16} />
                        Ajouter une autre tâche
                    </button>
                </div>

                {createError && (
                    <div className="mt-3 rounded-lg bg-error-50 px-4 py-2 text-theme-sm text-error-600 dark:bg-error-500/10 dark:text-error-400">
                        {createError}
                    </div>
                )}
                <div className="mt-4 flex items-center justify-between">
                    <span className="text-theme-xs text-gray-400">{taskForms.length} tâche{taskForms.length > 1 ? 's' : ''} en attente</span>
                    <div className="flex gap-3">
                        <Button variant="outline" onClick={() => setShowCreate(false)}>Annuler</Button>
                        <Button onClick={handleCreateAll} disabled={createLoading}>
                            {createLoading ? 'Création...' : `Créer ${taskForms.length > 1 ? `les ${taskForms.length} tâches` : 'la tâche'}`}
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* ── Edit Modal ────────────────────────────────────────── */}
            <Modal isOpen={!!editingTache} onClose={() => setEditingTache(null)} title="Modifier la tâche">
                {editingTache && (
                    <div className="space-y-4">
                        <div>
                            <label className="mb-1.5 block text-theme-sm font-medium text-gray-700 dark:text-gray-300">Titre</label>
                            <input type="text" value={editForm.titre} onChange={e => setEditForm({ ...editForm, titre: e.target.value })} className={inputClass} />
                        </div>
                        <div>
                            <label className="mb-1.5 block text-theme-sm font-medium text-gray-700 dark:text-gray-300">Date d'échéance</label>
                            <input type="date" value={editForm.dateEcheance} onChange={e => setEditForm({ ...editForm, dateEcheance: e.target.value })} className={inputClass} />
                        </div>
                        <div>
                            <label className="mb-1.5 block text-theme-sm font-medium text-gray-700 dark:text-gray-300">Statut</label>
                            <select value={editForm.statut} onChange={e => setEditForm({ ...editForm, statut: e.target.value as StatutTache })} className={inputClass}>
                                {Object.entries(statutLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                            </select>
                        </div>
                        <TypeDrivePicker value={editForm.typeDrive} onChange={v => setEditForm(f => ({ ...f, typeDrive: v }))} />
                        <MemberCheckList
                            selectedIds={editForm.assigneeIds}
                            onToggle={toggleEditAssignee}
                            label="Assigner à (1 membre assigné)"
                        />
                        <button
                            type="button"
                            onClick={() => setEditForm(f => ({ ...f, urgente: !f.urgente }))}
                            className={`flex w-full items-center justify-center gap-2 rounded-lg border-2 py-2 text-theme-sm font-medium transition-colors ${editForm.urgente
                                ? 'border-error-500 bg-error-50 text-error-600 dark:bg-error-500/10 dark:text-error-400'
                                : 'border-gray-300 text-gray-400 hover:border-error-300 hover:text-error-500 dark:border-gray-600'
                                }`}
                        >
                            🚨 {editForm.urgente ? 'Tâche urgente (actif)' : 'Marquer comme urgente'}
                        </button>
                        {editError && <div className="rounded-lg bg-error-50 px-4 py-2 text-theme-sm text-error-600 dark:bg-error-500/10 dark:text-error-400">{editError}</div>}
                        <div className="flex justify-end gap-3 pt-2">
                            <Button variant="outline" onClick={() => setEditingTache(null)}>Annuler</Button>
                            <Button onClick={handleEditSave} disabled={editLoading}>{editLoading ? 'Enregistrement...' : 'Enregistrer'}</Button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* ── View Modal ────────────────────────────────────────── */}
            <Modal isOpen={!!viewingTache} onClose={() => setViewingTache(null)} title="Détails de la tâche">
                {viewingTache && (
                    <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-theme-xs text-gray-500">Titre</p>
                                <p className="text-theme-sm font-semibold text-gray-800 dark:text-white">{viewingTache.titre}</p>
                            </div>
                            <div>
                                <p className="text-theme-xs text-gray-500">Statut</p>
                                <Badge text={statutLabels[viewingTache.statut]} variant={statutBadgeMap[viewingTache.statut]} />
                            </div>
                            <div>
                                <p className="text-theme-xs text-gray-500">Assigné à</p>
                                <p className="text-theme-sm text-gray-700 dark:text-gray-300">{getMemberNom(viewingTache.assigneeId)}</p>
                            </div>
                            <div>
                                <p className="text-theme-xs text-gray-500">Date d'échéance</p>
                                <p className="text-theme-sm text-gray-700 dark:text-gray-300">{viewingTache.dateEcheance || '-'}</p>
                            </div>
                        </div>
                        {/* Drive link */}
                        {(viewingTache as any).driveLink && (
                            <div className="rounded-lg border border-brand-200 bg-brand-50 px-4 py-3 dark:border-brand-500/30 dark:bg-brand-500/10">
                                <p className="text-theme-xs font-medium text-brand-600 dark:text-brand-400 mb-1">
                                    📁 Dossier Drive — {(viewingTache as any).typeDrive}
                                </p>
                                <a
                                    href={(viewingTache as any).driveLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-theme-sm text-brand-600 underline hover:text-brand-700 dark:text-brand-400 break-all"
                                >
                                    Ouvrir le dossier Drive ↗
                                </a>
                            </div>
                        )}
                        {(viewingTache as any).driveLink && (
                            <LivrablesSection tacheId={viewingTache.id as number} typeDrive={(viewingTache as any).typeDrive} canUpload />
                        )}
                        {/* Media Plan details if available */}
                        {projet?.isMediaPlanProject && mediaPlanDetails && (
                            <div className="rounded-xl border border-brand-200 bg-brand-50 p-4 dark:border-brand-500/30 dark:bg-brand-500/10 mt-4">
                                <h4 className="mb-3 text-[12px] font-bold uppercase tracking-widest text-brand-600 dark:text-brand-400 flex items-center gap-2">
                                    Détails Media Plan
                                </h4>
                                <div className="grid grid-cols-2 gap-y-4 gap-x-6">
                                    <div><span className="block text-[10px] font-bold uppercase text-gray-500">Format</span>
                                        <span className="text-theme-sm font-medium text-gray-900 dark:text-gray-100">{mediaPlanDetails.format}</span></div>
                                    <div><span className="block text-[10px] font-bold uppercase text-gray-500">Type</span>
                                        <span className="text-theme-sm font-medium text-gray-900 dark:text-gray-100">{mediaPlanDetails.type || '-'}</span></div>
                                    <div className="col-span-2"><span className="block text-[10px] font-bold uppercase text-gray-500">Texte sur Visuel</span>
                                        <p className="mt-0.5 text-theme-xs text-gray-700 dark:text-gray-300">{mediaPlanDetails.texteSurVisuel || '-'}</p></div>
                                    <div className="col-span-2"><span className="block text-[10px] font-bold uppercase text-gray-500">Inspiration / Autres</span>
                                        <div className="mt-0.5 flex flex-wrap gap-2 text-theme-xs text-gray-700 dark:text-gray-300">
                                            {mediaPlanDetails.inspiration ? (
                                                mediaPlanDetails.inspiration.startsWith('http') || mediaPlanDetails.inspiration.startsWith('www') ?
                                                    <a href={mediaPlanDetails.inspiration.startsWith('http') ? mediaPlanDetails.inspiration : `https://${mediaPlanDetails.inspiration}`} target="_blank" rel="noreferrer" className="text-brand-600 hover:underline dark:text-brand-400">Inspiration (Lien)</a>
                                                    : <span>{mediaPlanDetails.inspiration}</span>
                                            ) : '-'}
                                            {mediaPlanDetails.autresElements && <span className="border-l border-gray-300 pl-2 dark:border-gray-700">{mediaPlanDetails.autresElements}</span>}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                        <div className="flex justify-end pt-2 gap-3">
                            <Button variant="outline" onClick={() => { setViewingTache(null); openEdit(viewingTache); }}>Modifier</Button>
                            <Button onClick={() => setViewingTache(null)}>Fermer</Button>
                        </div>
                    </div>
                )}
            </Modal>

            <ConfirmDialog
                isOpen={confirmState.isOpen}
                title={confirmState.title}
                message={confirmState.message}
                confirmLabel="Supprimer"
                onConfirm={handleConfirm}
                onCancel={handleCancel}
            />
        </div>
    );
};

export default ProjetTachesPage;
