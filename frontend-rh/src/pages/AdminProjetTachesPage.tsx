import TypeDrivePicker from '../components/taches/TypeDrivePicker';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { HiOutlinePlus, HiOutlinePencil, HiOutlineTrash, HiOutlineArrowLeft } from 'react-icons/hi';
import { tacheService } from '../api/tacheService';
import { projetService } from '../api/projetService';
import { Tache, Projet, Employe, StatutTache } from '../types';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { useConfirm } from '../hooks/useConfirm';
import { useAuth } from '../context/AuthContext';

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

const AdminProjetTachesPage: React.FC = () => {
    const { projetId } = useParams<{ projetId: string }>();
    const navigate = useNavigate();
    const { confirmState, confirm, handleConfirm, handleCancel } = useConfirm();
    const { user } = useAuth();

    const [projet, setProjet] = useState<Projet | null>(null);
    const [taches, setTaches] = useState<Tache[]>([]);
    const [projectMembers, setProjectMembers] = useState<Employe[]>([]);
    const [loading, setLoading] = useState(true);

    // Drag state
    const dragTacheId = useRef<number | null>(null);
    const [dragOverCol, setDragOverCol] = useState<string | null>(null);

    // Create modal
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

            // Admin view: include ALL chefs + ALL members — no restrictions
            const memberMap = new Map<number, Employe>();
            if (p?.chefDeProjet) memberMap.set(p.chefDeProjet.id, p.chefDeProjet as Employe);
            if (p?.chefsDeProjet && p.chefsDeProjet.length > 0) {
                p.chefsDeProjet.forEach(c => { if (!memberMap.has(c.id)) memberMap.set(c.id, c as Employe); });
            }
            for (const m of (p?.membres ?? [])) {
                if (!memberMap.has(m.id)) memberMap.set(m.id, m);
            }
            setProjectMembers(Array.from(memberMap.values()));
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
        setTaches(prev => prev.map(t => t.id === tache.id ? { ...t, statut: colStatut } : t));
        try {
            await tacheService.changeStatut(tache.id, colStatut);
        } catch {
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
                alert((err as any)?.response?.data?.message || 'Suppression impossible (droits insuffisants ou erreur serveur).');
            }
        }, 'Supprimer la tâche');
    };

    const getMemberNom = (id: number | null) => {
        if (!id) return 'Non assigné';
        const m = projectMembers.find(e => e.id === id);
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
            {/* Header — back goes to admin/projets */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate('/admin/projets')}
                        className="flex items-center gap-1.5 rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                    >
                        <HiOutlineArrowLeft size={20} />
                    </button>
                    <div>
                        <h1 className="text-title-sm font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-gray-900 to-[#683b77] dark:from-white dark:to-[#ab78c3]">
                            Tâches — {projet.nom}
                        </h1>
                        <p className="text-theme-sm text-gray-500 dark:text-gray-400 mt-0.5">
                            {taches.length} tâche{taches.length > 1 ? 's' : ''}
                            {projet.chefDeProjet && ` · Chef : ${projet.chefDeProjet.prenom} ${projet.chefDeProjet.nom}`}
                            {projectMembers.length > 0 && ` · ${projectMembers.length} membre${projectMembers.length > 1 ? 's' : ''}`}
                        </p>
                    </div>
                </div>
                <Button onClick={() => { setShowCreate(true); setTaskForms([emptyForm()]); setCreateError(null); }}>
                    <HiOutlinePlus size={18} /> Nouvelles tâches
                </Button>
            </div>

            {/* Hint */}
            <p className="text-theme-xs text-gray-400 italic">
                💡 Glissez-déposez les cartes pour changer leur statut
            </p>

            {/* Kanban */}
            {taches.length === 0 ? (
                <div className="rounded-2xl border border-gray-200 bg-white p-16 text-center dark:border-gray-800 dark:bg-gray-dark">
                    <p className="text-gray-400">Aucune tâche pour ce projet.</p>
                    <Button className="mt-4" onClick={() => setShowCreate(true)}>
                        <HiOutlinePlus size={16} /> Créer la première tâche
                    </Button>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                    {(['TODO', 'IN_PROGRESS', 'DONE'] as const).map(colStatut => (
                        <div
                            key={colStatut}
                            onDragOver={e => handleDragOver(e, colStatut)}
                            onDrop={e => handleDrop(e, colStatut as StatutTache)}
                            onDragLeave={handleDragLeave}
                            className={`rounded-2xl border-2 bg-white transition-colors dark:bg-gray-dark ${dragOverCol === colStatut ? 'border-brand-400 bg-brand-50/30 dark:bg-brand-500/5' : columnColors[colStatut]}`}
                        >
                            <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3 dark:border-gray-700">
                                <Badge text={statutLabels[colStatut]} variant={statutBadgeMap[colStatut]} />
                                <span className="text-theme-xs text-gray-400">{grouped[colStatut].length}</span>
                            </div>
                            <div className="min-h-[120px] space-y-2 p-3">
                                {grouped[colStatut].length === 0 ? (
                                    <div className={`flex items-center justify-center rounded-xl border-2 border-dashed py-8 transition-colors ${dragOverCol === colStatut ? 'border-brand-300 text-brand-400' : 'border-gray-200 text-gray-300 dark:border-gray-700'}`}>
                                        <p className="text-theme-xs">Déposer ici</p>
                                    </div>
                                ) : (
                                    grouped[colStatut].map(tache => (
                                        <div
                                            key={tache.id}
                                            draggable
                                            onDragStart={e => handleDragStart(e, tache.id)}
                                            className={`cursor-grab rounded-xl border-2 bg-gray-50 px-3 py-2.5 shadow-sm transition-shadow active:cursor-grabbing active:shadow-md dark:bg-gray-800 ${tache.urgente ? 'border-error-400 dark:border-error-500' : 'border-gray-100 dark:border-gray-700'}`}
                                        >
                                            <div className="mb-1.5 flex items-start justify-between gap-2">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-1.5">
                                                        {tache.urgente && (
                                                            <span className="shrink-0 rounded-full bg-error-50 px-1.5 py-0.5 text-[10px] font-bold text-error-600 dark:bg-error-500/10 dark:text-error-400">🚨 Urgent</span>
                                                        )}
                                                        <p className="truncate text-theme-sm font-medium text-gray-800 dark:text-white">
                                                            {tache.titre}
                                                        </p>
                                                    </div>
                                                    <p className="mt-0.5 text-theme-xs text-gray-500">
                                                        👤 {getMemberNom(tache.assigneeId)}
                                                    </p>
                                                    {tache.dateEcheance && (
                                                        <p className="text-theme-xs text-gray-400">⏰ {tache.dateEcheance}</p>
                                                    )}
                                                </div>
                                                <div className="flex gap-1 flex-shrink-0">
                                                    <button
                                                        onClick={() => setViewingTache(tache)}
                                                        className="rounded p-1 text-gray-400 hover:text-brand-500 hover:bg-brand-50"
                                                        title="Voir"
                                                        onMouseDown={e => e.stopPropagation()}
                                                    >
                                                        <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                        </svg>
                                                    </button>
                                                    <button
                                                        onClick={() => openEdit(tache)}
                                                        className="rounded p-1 text-gray-400 hover:text-brand-500 hover:bg-brand-50"
                                                        title="Modifier"
                                                        onMouseDown={e => e.stopPropagation()}
                                                    >
                                                        <HiOutlinePencil size={13} />
                                                    </button>
{(user?.permissions ?? []).includes('DELETE_TACHE') && (
                                                    <button
                                                        onClick={() => handleDelete(tache.id)}
                                                        className="rounded p-1 text-gray-400 hover:text-error-500 hover:bg-error-50"
                                                        title="Supprimer"
                                                        onMouseDown={e => e.stopPropagation()}
                                                    >
                                                        <HiOutlineTrash size={13} />
                                                    </button>
)}
                                                </div>
                                            </div>
                                            <div className="flex justify-center opacity-20">
                                                <svg width="16" height="8" viewBox="0 0 16 8" fill="currentColor" className="text-gray-400">
                                                    <circle cx="2" cy="2" r="1.5" /><circle cx="8" cy="2" r="1.5" /><circle cx="14" cy="2" r="1.5" />
                                                    <circle cx="2" cy="6" r="1.5" /><circle cx="8" cy="6" r="1.5" /><circle cx="14" cy="6" r="1.5" />
                                                </svg>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

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
                                    className={`flex w-full items-center justify-center gap-2 rounded-lg border-2 py-2 text-theme-sm font-medium transition-colors ${
                                        form.urgente
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
                            className={`flex w-full items-center justify-center gap-2 rounded-lg border-2 py-2 text-theme-sm font-medium transition-colors ${
                                editForm.urgente
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

export default AdminProjetTachesPage;
