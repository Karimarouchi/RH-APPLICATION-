import LivrablesSection from '../components/taches/LivrablesSection';
import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { tacheService } from '../api/tacheService';
import { demandeService } from '../api/demandeService';
import { compteService } from '../api/compteService';
import { projetService } from '../api/projetService';
import { mediaPlanService } from '../api/mediaPlanService';
import { useAuth } from '../context/AuthContext';
import { TacheDetail, TacheMembreInfo, StatutTache, StatutDemande, Projet, MediaPlan } from '../types';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';
import { HiOutlinePencil, HiOutlineChevronRight, HiOutlineUsers, HiOutlineFolder, HiOutlineCalendar, HiOutlineClock, HiOutlineCheckCircle, HiOutlineChartBar, HiDotsHorizontal, HiOutlineBriefcase, HiOutlineArrowLeft } from 'react-icons/hi';

interface ProjectGroup {
    projetId: number;
    clientId?: number | null;
    clientNom?: string | null;
    projetNom: string;
    projetDateFin: string | null;
    projetStatut: string | null;
    chefDeProjetNom: string | null;
    chefsDeProjetIds: Set<number>;
    membres: TacheMembreInfo[];
    tacheCount: number;
}

interface ClientGroup {
    clientId: number | null;
    clientNom: string;
    projects: ProjectGroup[];
}

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

const inputClass =
    'h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 text-theme-sm text-gray-700 focus:border-brand-300 focus:outline-none focus:ring focus:ring-brand-500/10 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-300';

const MemberCard: React.FC<{ membre: TacheMembreInfo }> = ({ membre }) => {
    const isChef = membre.isChef;
    return (
        <div className={`flex items-start gap-3 rounded-xl border p-3.5 shadow-sm ${isChef
            ? 'border-warning-200 bg-warning-50 dark:border-warning-500/20 dark:bg-warning-500/5'
            : 'border-gray-100 bg-white dark:border-gray-700 dark:bg-gray-800'
            }`}>
            <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold text-white shadow ${isChef
                ? 'bg-gradient-to-br from-warning-400 to-warning-600'
                : 'bg-gradient-to-br from-secondary-400 to-secondary-600'
                }`}>
                {membre.prenom?.[0]}{membre.nom?.[0]}
            </div>
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                    <p className={`text-theme-sm font-semibold ${isChef ? 'text-warning-700 dark:text-warning-400' : 'text-gray-800 dark:text-white'}`}>
                        {membre.prenom} {membre.nom}
                    </p>
                    {isChef && (
                        <span className="rounded-full bg-warning-100 px-2 py-0.5 text-[10px] font-bold text-warning-600 dark:bg-warning-500/20 dark:text-warning-400">
                            Manager
                        </span>
                    )}
                </div>
                {membre.poste && (
                    <p className="mt-0.5 text-theme-xs text-gray-600 dark:text-gray-300">💼 {membre.poste}</p>
                )}
                {membre.departement && (
                    <p className="mt-0.5 text-theme-xs text-brand-500 dark:text-brand-400">🏢 {membre.departement}</p>
                )}
                {membre.managerNom && (
                    <p className="text-theme-xs text-gray-500 dark:text-gray-400">👤 Manager: {membre.managerNom}</p>
                )}
                {(membre.telephonePro || membre.telephone) && (
                    <p className="text-theme-xs text-gray-500 dark:text-gray-400">📞 {membre.telephonePro || membre.telephone}</p>
                )}
                {membre.email && (
                    <p className="text-theme-xs text-gray-500 dark:text-gray-400">✉️ {membre.email}</p>
                )}
            </div>
        </div>
    );
};

/** Fetches the client's Drive folder link from the backend and renders it. */
const DriveLinkButton: React.FC<{ clientId: number }> = ({ clientId }) => {
    const [driveLink, setDriveLink] = React.useState<string | null>(null);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        setLoading(true);
        fetch(`/api/clients/${clientId}/drive-link`, { credentials: 'include' })
            .then(r => r.json())
            .then(d => setDriveLink(d?.data ?? null))
            .catch(() => setDriveLink(null))
            .finally(() => setLoading(false));
    }, [clientId]);

    if (loading) return null;
    if (!driveLink) return null;

    return (
        <a
            href={driveLink}
            target="_blank"
            rel="noreferrer"
            className="mb-3 inline-flex items-center gap-2 rounded-xl border border-brand-200 bg-brand-50 px-4 py-2 text-theme-xs font-semibold text-brand-600 transition-colors hover:bg-brand-100 dark:border-brand-700 dark:bg-brand-500/10 dark:text-brand-400 dark:hover:bg-brand-500/20"
        >
            <HiOutlineFolder size={14} />
            Ouvrir le dossier Drive
        </a>
    );
};

const MesTachesPage: React.FC = () => {
    const { user } = useAuth();
    const location = useLocation();
    const [taches, setTaches] = useState<TacheDetail[]>([]);
    const [loading, setLoading] = useState(true);

    const [draggedTache, setDraggedTache] = useState<TacheDetail | null>(null);
    const [dragOverStatut, setDragOverStatut] = useState<string | null>(null);

    const [editingTache, setEditingTache] = useState<TacheDetail | null>(null);
    const [editForm, setEditForm] = useState({ titre: '', dateEcheance: '', statut: 'TODO' as StatutTache, urgente: false });
    const [editError, setEditError] = useState<string | null>(null);
    const [editLoading, setEditLoading] = useState(false);

    const [viewingTache, setViewingTache] = useState<TacheDetail | null>(null);
    const [mediaPlanDetails, setMediaPlanDetails] = useState<MediaPlan | null>(null);

    const [selectedProject, setSelectedProject] = useState<ProjectGroup | null>(null);
    const [selectedClientId, setSelectedClientId] = useState<number | null | undefined>(undefined);
    // Set of employeNom strings for people on congé today
    const [congeAujourdhuiNoms, setCongeAujourdhuiNoms] = useState<Set<string>>(new Set());
    // Set of employeIds that have the MANAGER role
    const [managerEmpIds, setManagerEmpIds] = useState<Set<number>>(new Set());
    // Full project details keyed by projetId (to get all chefsDeProjet)
    const [projetDetails, setProjetDetails] = useState<Map<number, Projet>>(new Map());

    useEffect(() => { loadData(); }, [user?.employeId]);

    useEffect(() => {
        if (!viewingTache || !viewingTache.projetId) {
            setMediaPlanDetails(null);
            return;
        }
        const fullProjet = projetDetails.get(viewingTache.projetId);
        if (fullProjet?.isMediaPlanProject && fullProjet?.mediaPlanLigneId) {
            mediaPlanService.getById(fullProjet.mediaPlanLigneId)
                .then(r => setMediaPlanDetails(r.data.data))
                .catch(console.error);
        } else {
            setMediaPlanDetails(null);
        }
    }, [viewingTache, projetDetails]);

    const loadData = async () => {
        if (!user?.employeId) {
            setLoading(false); // ← fix: always stop the spinner
            return;
        }
        try {
            const today = new Date().toISOString().split('T')[0];
            const [res, demandesRes, comptesRes] = await Promise.allSettled([
                tacheService.getByAssignee(user.employeId),
                demandeService.getByStatut(StatutDemande.APPROUVEE),
                compteService.getAll(),
            ]);
            if (res.status === 'fulfilled') {
                const tachesData = res.value.data.data || [];
                setTaches(tachesData);

                // Fetch full project details (to get all chefsDeProjet)
                const uniqueProjetIds = Array.from(new Set(tachesData.filter((t: any) => t.projetId).map((t: any) => t.projetId)));
                const projetResults = await Promise.allSettled(
                    uniqueProjetIds.map(id => projetService.getById(id))
                );
                const pMap = new Map<number, Projet>();
                projetResults.forEach((r, i) => {
                    if (r.status === 'fulfilled') {
                        const p = r.value.data.data;
                        if (p) pMap.set(uniqueProjetIds[i], p);
                    }
                });
                setProjetDetails(pMap);
            }
            // Build set of employeIds with the MANAGER role
            if (comptesRes.status === 'fulfilled') {
                const comptes = comptesRes.value.data.data || [];
                const mgrIds = new Set<number>();
                comptes.forEach((c: any) => {
                    const hasManagerRole = (c.roles || []).some((r: any) =>
                        r.nom?.toUpperCase() === 'MANAGER'
                    );
                    if (hasManagerRole && c.employeId) mgrIds.add(c.employeId);
                });
                setManagerEmpIds(mgrIds);
            }
            if (demandesRes.status === 'fulfilled') {
                const demandes = demandesRes.value.data.data || [];
                const onConge = new Set<string>();
                demandes.forEach(d => {
                    if (d.dateDebut && d.dateFin && d.employeNom) {
                        const debut = d.dateDebut.toString().substring(0, 10);
                        const fin = d.dateFin.toString().substring(0, 10);
                        if (debut <= today && today <= fin) {
                            onConge.add(d.employeNom);
                        }
                    }
                });
                setCongeAujourdhuiNoms(onConge);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const projectGroups: ProjectGroup[] = React.useMemo(() => {
        const map = new Map<number, ProjectGroup>();
        for (const t of taches) {
            if (!t.projetId) continue;
            if (!map.has(t.projetId)) {
                const fullProjet = projetDetails.get(t.projetId);

                // Build set of chef IDs from full project details
                const chefIds = new Set<number>();
                if (t.chefDeProjetId) chefIds.add(t.chefDeProjetId);
                if (fullProjet?.chefDeProjet) chefIds.add(fullProjet.chefDeProjet.id);
                if (fullProjet?.chefsDeProjet) fullProjet.chefsDeProjet.forEach(c => chefIds.add(c.id));
                if (t.chefsDeProjetIds) t.chefsDeProjetIds.forEach(id => chefIds.add(id));

                // Start with membresProjet from tache data
                const memberMap = new Map<number, TacheMembreInfo>();
                (t.membresProjet ?? []).forEach(m => memberMap.set(m.id, m));

                // Merge all chefs from full project details (fills in missing managers)
                if (fullProjet?.chefsDeProjet) {
                    fullProjet.chefsDeProjet.forEach(c => {
                        if (!memberMap.has(c.id)) {
                            memberMap.set(c.id, {
                                id: c.id,
                                nom: c.nom,
                                prenom: c.prenom,
                                telephone: c.telephone || '',
                                telephonePro: c.telephonePro,
                                departement: c.departement || '',
                                email: c.email,
                                managerNom: c.managerNom ?? undefined,
                                poste: c.poste ?? undefined,
                            });
                        }
                    });
                }
                if (fullProjet?.chefDeProjet) {
                    const c = fullProjet.chefDeProjet;
                    if (!memberMap.has(c.id)) {
                        memberMap.set(c.id, {
                            id: c.id,
                            nom: c.nom,
                            prenom: c.prenom,
                            telephone: c.telephone || '',
                            telephonePro: c.telephonePro,
                            departement: c.departement || '',
                            email: c.email,
                            managerNom: (c as any).managerNom ?? undefined,
                            poste: (c as any).poste ?? undefined,
                        });
                    }
                }
                // Also merge regular membres from full project
                if (fullProjet?.membres) {
                    fullProjet.membres.forEach(m => {
                        if (!memberMap.has(m.id)) {
                            memberMap.set(m.id, {
                                id: m.id,
                                nom: m.nom,
                                prenom: m.prenom,
                                telephone: m.telephone || '',
                                telephonePro: m.telephonePro,
                                departement: m.departement || '',
                                email: m.email,
                                managerNom: m.managerNom ?? undefined,
                                poste: m.poste ?? undefined,
                            });
                        }
                    });
                }

                // Mark each member: isChef if they are a project chef OR have the MANAGER role
                const enriched = Array.from(memberMap.values()).map(m => ({
                    ...m,
                    isChef: chefIds.has(m.id) || managerEmpIds.has(m.id),
                }));
                enriched.sort((a, b) => (a.isChef === b.isChef ? 0 : a.isChef ? -1 : 1));

                // Build chef names string from full project
                let chefNom = t.chefDeProjetNom;
                if (fullProjet?.chefsDeProjet && fullProjet.chefsDeProjet.length > 0) {
                    chefNom = fullProjet.chefsDeProjet.map(c => `${c.prenom} ${c.nom}`).join(', ');
                }

                map.set(t.projetId, {
                    projetId: t.projetId,
                    projetNom: t.projetNom || 'Projet sans nom',
                    clientId: fullProjet?.clientId || null,
                    clientNom: fullProjet?.clientNom || 'Projets Internes',
                    projetDateFin: t.projetDateFin,
                    projetStatut: t.projetStatut,
                    chefDeProjetNom: chefNom,
                    chefsDeProjetIds: chefIds,
                    membres: enriched,
                    tacheCount: 0,
                });
            }
            map.get(t.projetId)!.tacheCount += 1;
        }
        return Array.from(map.values());
    }, [taches, managerEmpIds, projetDetails]);

    const clientGroups: ClientGroup[] = React.useMemo(() => {
        const cMap = new Map<number | null, ClientGroup>();
        for (const pg of projectGroups) {
            const cid = pg.clientId ?? null;
            if (!cMap.has(cid)) {
                cMap.set(cid, {
                    clientId: cid,
                    clientNom: pg.clientNom || 'Projets Internes',
                    projects: [],
                });
            }
            cMap.get(cid)!.projects.push(pg);
        }
        return Array.from(cMap.values());
    }, [projectGroups]);

    useEffect(() => {
        const urlParams = new URLSearchParams(location.search);

        const projectIdFromQuery = Number(urlParams.get('projectId'));
        if (Number.isFinite(projectIdFromQuery) && projectIdFromQuery > 0) {
            const selectedFromQuery = projectGroups.find((project) => project.projetId === projectIdFromQuery);
            if (selectedFromQuery) {
                setSelectedClientId(selectedFromQuery.clientId ?? null);
                setSelectedProject(selectedFromQuery);
                return;
            }
        }

        const clientIdStr = urlParams.get('clientId');
        if (clientIdStr !== null) {
            if (clientIdStr === 'internal') {
                setSelectedClientId(null);
                setSelectedProject(null);
            } else {
                const clientIdFromQuery = Number(clientIdStr);
                if (Number.isFinite(clientIdFromQuery)) {
                    setSelectedClientId(clientIdFromQuery);
                    setSelectedProject(null);
                }
            }
        }
    }, [location.search, projectGroups]);

    const handleChangeStatut = async (id: number, statut: StatutTache) => {
        try {
            await tacheService.changeStatut(id, statut);
            setTaches(prev => prev.map(t => t.id === id ? { ...t, statut } : t));
        } catch (err) { console.error(err); }
    };

    const handleDragStart = (e: React.DragEvent, tache: TacheDetail) => {
        setDraggedTache(tache);
        e.dataTransfer.effectAllowed = 'move';
        setTimeout(() => { (e.currentTarget as HTMLElement).style.opacity = '0.4'; }, 0);
    };

    const handleDragEnd = (e: React.DragEvent) => {
        (e.currentTarget as HTMLElement).style.opacity = '1';
        setDraggedTache(null);
        setDragOverStatut(null);
    };

    const handleDrop = async (e: React.DragEvent, targetStatut: string) => {
        e.preventDefault();
        setDragOverStatut(null);
        if (!draggedTache || draggedTache.statut === targetStatut) return;
        await handleChangeStatut(draggedTache.id, targetStatut as StatutTache);
        setDraggedTache(null);
    };

    const openEdit = (tache: TacheDetail, e: React.MouseEvent) => {
        e.stopPropagation();
        setEditingTache(tache);
        setEditForm({ titre: tache.titre, dateEcheance: tache.dateEcheance || '', statut: tache.statut, urgente: tache.urgente ?? false });
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
            } as any);
            setTaches(prev =>
                prev.map(t =>
                    t.id === editingTache.id
                        ? { ...t, titre: editForm.titre, dateEcheance: editForm.dateEcheance, statut: editForm.statut, urgente: editForm.urgente }
                        : t
                )
            );
            setEditingTache(null);
        } catch (err: any) {
            setEditError(err?.response?.data?.message || 'Erreur lors de la modification');
        } finally {
            setEditLoading(false);
        }
    };

    const filteredTaches = React.useMemo(() => {
        return taches.filter(tache => {
            if (selectedProject) {
                return tache.projetId === selectedProject.projetId;
            }
            if (selectedClientId !== undefined) {
                const projInfo = projectGroups.find(p => p.projetId === tache.projetId);
                const tacheClientId = projInfo?.clientId ?? null;
                return tacheClientId === selectedClientId;
            }
            return true;
        });
    }, [taches, selectedProject, selectedClientId, projectGroups]);

    const grouped = {
        TODO: [...filteredTaches.filter(t => t.statut === 'TODO')].sort((a, b) => (b.urgente ? 1 : 0) - (a.urgente ? 1 : 0)),
        IN_PROGRESS: [...filteredTaches.filter(t => t.statut === 'IN_PROGRESS')].sort((a, b) => (b.urgente ? 1 : 0) - (a.urgente ? 1 : 0)),
        DONE: [...filteredTaches.filter(t => t.statut === 'DONE')].sort((a, b) => (b.urgente ? 1 : 0) - (a.urgente ? 1 : 0)),
    };

    return (
        <div className="space-y-0">

            {/* ══════════════════════ MES PROJETS (TOP) ══════════════════════ */}
            {projectGroups.length > 0 && (
                <div className="space-y-6 pb-10">
                    {/* Header row */}
                    <div className="flex items-center justify-between">
                        <div>
 <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
                Mes <span className="text-brand-600 dark:text-brand-400">Projets</span>
              </h1>                            <p className="text-theme-sm text-gray-500 dark:text-gray-400 mt-1">
                                Explorez vos projets et les membres de chaque projet
                            </p>
                        </div>
                        {/* Breadcrumb */}
                        {selectedClientId !== undefined && (
                            <nav className="flex items-center gap-1.5 text-theme-xs">
                                <button
                                    onClick={() => { setSelectedClientId(undefined); setSelectedProject(null); }}
                                    className="text-brand-500 hover:underline"
                                >
                                    Clients
                                </button>
                                {selectedClientId !== undefined && (
                                    <>
                                        <HiOutlineChevronRight size={12} className="text-gray-300" />
                                        <button onClick={() => setSelectedProject(null)} className="font-semibold text-gray-700 dark:text-gray-200 hover:underline">
                                            {selectedClientId === null ? 'Projets Internes' : clientGroups.find(c => c.clientId === selectedClientId)?.clientNom}
                                        </button>
                                    </>
                                )}
                                {selectedProject && (
                                    <>
                                        <HiOutlineChevronRight size={12} className="text-gray-300" />
                                        <span className="font-semibold text-gray-700 dark:text-gray-200">
                                            {selectedProject.projetNom}
                                        </span>
                                    </>
                                )}
                            </nav>
                        )}
                    </div>

                    {/* Level 1 — Client cards */}
                    {selectedClientId === undefined && (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                            {clientGroups.map(cg => (
                                <button
                                    key={cg.clientId ?? 'interne'}
                                    onClick={() => setSelectedClientId(cg.clientId)}
                                    className="group rounded-2xl border border-gray-200 bg-white p-5 text-left transition-all hover:border-brand-300 hover:shadow-md dark:border-gray-800 dark:bg-gray-dark"
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-500 dark:bg-brand-500/10">
                                            <HiOutlineBriefcase size={22} />
                                        </div>
                                        <HiOutlineChevronRight size={16} className="mt-1 text-gray-300 transition-transform group-hover:translate-x-0.5 group-hover:text-brand-400" />
                                    </div>
                                    <p className="mt-3 text-theme-sm font-semibold text-gray-800 dark:text-white">{cg.clientNom}</p>
                                    <div className="mt-3 flex gap-2">
                                        <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-theme-xs font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                                            {cg.projects.length} projet{cg.projects.length !== 1 ? 's' : ''}
                                        </span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Level 2 — Project cards for selected client */}
                    {selectedClientId !== undefined && !selectedProject && (() => {
                        const clientProjects = clientGroups.find(c => c.clientId === selectedClientId)?.projects || [];
                        return (
                            <div className="space-y-4">
                                <button
                                    onClick={() => setSelectedClientId(undefined)}
                                    className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-gray-500 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                                >
                                    <HiOutlineArrowLeft size={14} /> Retour aux clients
                                </button>
                                {selectedClientId !== null && (() => {
                                    const activeClient = clientGroups.find(c => c.clientId === selectedClientId);
                                    if (!activeClient) return null;
                                    return (
                                        <DriveLinkButton clientId={selectedClientId!} />
                                    );
                                })()}
                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                                    {clientProjects.map(pg => (
                                        <button
                                            key={pg.projetId}
                                            onClick={() => setSelectedProject(pg)}
                                            className="group rounded-2xl border border-gray-200 bg-white p-5 text-left transition-all hover:border-brand-300 hover:shadow-md dark:border-gray-800 dark:bg-gray-dark"
                                        >
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-500 dark:bg-brand-500/10">
                                                    <HiOutlineFolder size={22} />
                                                </div>
                                                <HiOutlineChevronRight size={16} className="mt-1 text-gray-300 transition-transform group-hover:translate-x-0.5 group-hover:text-brand-400" />
                                            </div>
                                            <p className="mt-3 text-theme-sm font-semibold text-gray-800 dark:text-white">{pg.projetNom}</p>
                                            {pg.projetStatut && (
                                                <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-theme-xs font-medium ${pg.projetStatut === 'EN_COURS' ? 'bg-brand-50 text-brand-600 dark:bg-brand-500/10' :
                                                    pg.projetStatut === 'CLOTURE' ? 'bg-success-50 text-success-600 dark:bg-success-500/10' :
                                                        pg.projetStatut === 'ANNULE' ? 'bg-error-50 text-error-600 dark:bg-error-500/10' :
                                                            'bg-gray-100 text-gray-600 dark:bg-gray-700'
                                                    }`}>
                                                    {pg.projetStatut}
                                                </span>
                                            )}
                                            {pg.chefDeProjetNom && (
                                                <p className="mt-0.5 text-theme-xs text-gray-500 flex items-center gap-2">
                                                    Chef : {pg.chefDeProjetNom}
                                                    {congeAujourdhuiNoms.has(pg.chefDeProjetNom) && (
                                                        <span className="rounded-full bg-warning-50 px-2 py-0.5 text-[10px] font-semibold text-warning-600 dark:bg-warning-500/10 dark:text-warning-400">
                                                            En congé
                                                        </span>
                                                    )}
                                                </p>
                                            )}
                                            {pg.projetDateFin && <p className="text-theme-xs text-warning-500">Fin : {pg.projetDateFin}</p>}
                                            <div className="mt-3 flex gap-2">
                                                <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-theme-xs font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                                                    {pg.tacheCount} tâche{pg.tacheCount > 1 ? 's' : ''}
                                                </span>
                                                <span className="rounded-full bg-secondary-50 px-2.5 py-0.5 text-theme-xs font-medium text-secondary-600 dark:bg-secondary-500/10 dark:text-secondary-400">
                                                    {pg.membres.length} membre{pg.membres.length !== 1 ? 's' : ''}
                                                </span>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        );
                    })()}

                    {/* Level 2 — Membres du projet */}
                    {selectedProject && (
                        <div className="space-y-4">
                            <div className="rounded-xl border border-brand-100 bg-brand-50/60 px-4 py-3 dark:border-brand-500/20 dark:bg-brand-500/5">
                                <p className="text-theme-sm font-semibold text-brand-700 dark:text-brand-300">{selectedProject.projetNom}</p>
                                <div className="mt-1 flex flex-wrap gap-4 text-theme-xs text-brand-600 dark:text-brand-400">
                                    {selectedProject.chefDeProjetNom && (
                                        <span className="flex items-center gap-2">
                                            👤 {selectedProject.chefDeProjetNom}
                                            {congeAujourdhuiNoms.has(selectedProject.chefDeProjetNom) && (
                                                <span className="rounded-full bg-warning-50 px-2 py-0.5 text-[10px] font-semibold text-warning-600 dark:bg-warning-500/10 dark:text-warning-400">
                                                    En congé
                                                </span>
                                            )}
                                        </span>
                                    )}
                                    {selectedProject.projetDateFin && <span>📅 Fin : {selectedProject.projetDateFin}</span>}
                                </div>
                            </div>
                            {selectedProject.membres.length === 0 ? (
                                <p className="py-6 text-center text-theme-sm text-gray-400">Aucun membre assigné à ce projet.</p>
                            ) : (
                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                                    {selectedProject.membres.map(m => <MemberCard key={m.id} membre={m} />)}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* ════════════════════════ DIVIDER ════════════════════════════ */}
            {projectGroups.length > 0 && (
                <div className="border-t border-gray-200 dark:border-gray-700" />
            )}

            {/* ══════════════════════ MES TÂCHES (BOTTOM) ══════════════════ */}
            <div className="space-y-6 pt-10">
                <div>
<h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
                Mes <span className="text-brand-600 dark:text-brand-400">Projets</span>
              </h1>
                    <p className="text-theme-sm text-gray-500 dark:text-gray-400 mt-1">
                        Glissez-déposez pour changer le statut · Cliquez ✏️ pour modifier
                    </p>
                </div>

                {loading ? (
                    <div className="py-12 text-center text-gray-500">Chargement...</div>
                ) : taches.length === 0 ? (
                    <div className="rounded-2xl border border-gray-200 bg-white p-16 text-center dark:border-gray-800 dark:bg-gray-dark">
                        <p className="text-gray-400">Aucune tâche ne vous est assignée.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                        {(['TODO', 'IN_PROGRESS', 'DONE'] as const).map(colStatut => (
                            <div
                                key={colStatut}
                                className={`rounded-2xl transition-colors duration-200 dark:bg-[#13161f] bg-gray-50 border ${dragOverStatut === colStatut
                                    ? 'border-brand-400 dark:border-transparent ring-2 ring-brand-500/50'
                                    : 'border-gray-200 dark:border-transparent'
                                    }`}
                                onDragOver={e => { e.preventDefault(); setDragOverStatut(colStatut); }}
                                onDragLeave={() => setDragOverStatut(null)}
                                onDrop={e => handleDrop(e, colStatut)}
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
                                <div className="min-h-[80px] space-y-3 p-3">
                                    {grouped[colStatut].length === 0 ? (
                                        <div className={`flex items-center justify-center rounded-xl border-2 border-dashed py-8 transition-colors ${dragOverStatut === colStatut ? 'border-brand-300 text-brand-400' : 'border-gray-200 text-gray-300 dark:border-gray-700'}`}>
                                            <p className="text-theme-xs">{dragOverStatut === colStatut ? 'Déposez ici' : 'Aucune tâche'}</p>
                                        </div>
                                    ) : (
                                        grouped[colStatut].map(tache => {
                                            const fullProjet = tache.projetId ? projetDetails.get(tache.projetId) : null;
                                            const isMediaPlan = fullProjet?.isMediaPlanProject;

                                            let typeText = "TÂCHE";
                                            if ((tache as any).typeDrive) {
                                                const typesArr = ((tache as any).typeDrive as string).split(',');
                                                if (typesArr.length > 0 && typesArr[0]) typeText = typesArr[0].toUpperCase();
                                            }
                                            if (isMediaPlan) typeText = "MEDIA PLAN";

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
                                            let assigneeName = tache.chefDeProjetNom || "User";
                                            if (assigneeName && assigneeName.trim() !== '-' && assigneeName !== 'Inconnu') {
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
                                                    onDragStart={e => handleDragStart(e, tache)}
                                                    onDragEnd={handleDragEnd}
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
                                                    {tache.projetNom && (
                                                        <p className="mb-4 mt-[-8px] truncate text-theme-xs text-brand-500 dark:text-brand-400 flex items-center gap-1.5">
                                                            {tache.projetNom}
                                                        </p>
                                                    )}
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-2">
                                                            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-100 text-[10px] font-bold text-brand-600 shadow-sm ring-2 ring-white dark:bg-[#3d59a1] dark:text-white dark:ring-[#1a1b26]" title={`Chef: ${assigneeName}`}>
                                                                {assigneeInitials}
                                                            </div>
                                                            {congeAujourdhuiNoms.has(tache.chefDeProjetNom || '') && (
                                                                <span className="rounded-full bg-warning-50 px-1.5 py-0.5 text-[9px] font-semibold text-warning-600 dark:bg-warning-500/10 dark:text-warning-400">
                                                                    En congé
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className={`flex items-center gap-1 text-[10px] font-bold ${tache.urgente ? 'text-error-600 dark:text-[#f7768e]' : 'text-success-600 dark:text-[#9ece6a]'}`}>
                                                            {tache.urgente ? (
                                                                <span className="flex items-center gap-0.5"><span className="text-[12px]">!</span> High</span>
                                                            ) : (
                                                                <span className="flex items-center gap-0.5"><HiOutlineChartBar size={12} /> Normal</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Edit Modal */}
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
                        {editError && (
                            <div className="rounded-lg bg-error-50 px-4 py-2 text-theme-sm text-error-600 dark:bg-error-500/10 dark:text-error-400">{editError}</div>
                        )}
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
                                <p className="text-theme-xs text-gray-500">Projet</p>
                                <p className="text-theme-sm text-gray-700 dark:text-gray-300">{viewingTache.projetNom || '-'}</p>
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
                        {(() => {
                            const fullProjet = viewingTache.projetId ? projetDetails.get(viewingTache.projetId) : null;
                            if (fullProjet?.isMediaPlanProject && mediaPlanDetails) {
                                return (
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
                                );
                            }
                            return null;
                        })()}

                        <div className="flex justify-end pt-2 gap-3">
                            {(() => {
                                const fullProjet = viewingTache.projetId ? projetDetails.get(viewingTache.projetId) : null;
                                return !fullProjet?.isMediaPlanProject ? (
                                    <Button variant="outline" onClick={() => {
                                        setViewingTache(null);
                                        openEdit(viewingTache, {} as React.MouseEvent);
                                    }}>Modifier</Button>
                                ) : null;
                            })()}
                            <Button onClick={() => setViewingTache(null)}>Fermer</Button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};

export default MesTachesPage;
