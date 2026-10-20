import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { HiOutlinePlus, HiOutlinePencil, HiOutlineTrash, HiOutlineClipboardList, HiOutlineDocumentText, HiOutlineDownload, HiOutlineChevronDown, HiOutlineArrowLeft, HiOutlineBriefcase, HiOutlineUserGroup, HiOutlineCalendar, HiOutlineOfficeBuilding, HiOutlineSun } from 'react-icons/hi';
import { projetService } from '../api/projetService';
import { employeService } from '../api/employeService';
import { demandeService } from '../api/demandeService';
import { clientService } from '../api/clientService';
import { mediaPlanService } from '../api/mediaPlanService';
import type { ClientDTO } from '../api/clientService';
import { useAuth } from '../context/AuthContext';
import { Projet, StatutProjet, Employe, StatutDemande, MediaPlan } from '../types';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { useConfirm } from '../hooks/useConfirm';

const statutBadgeMap: Record<string, 'neutral' | 'primary' | 'success' | 'danger'> = {
  PLANIFIE: 'neutral',
  EN_COURS: 'primary',
  CLOTURE: 'success',
  ANNULE: 'danger',
};

/* ─── Single project form data ───────────────────────────────────────────── */
interface ProjectFormRow {
  nom: string;
  typeProjet: 'DETERMINE' | 'INDETERMINE';
  dateDebut: string;
  dateFin: string;
  chefIds: number[];
  description: string;
}

const emptyRow = (today: string): ProjectFormRow => ({
  nom: '',
  typeProjet: 'DETERMINE',
  dateDebut: today,
  dateFin: '',
  chefIds: [],
  description: '',
});

/* ─── Page ──────────────────────────────────────────────────────────────── */
const ProjetsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { confirmState, confirm, handleConfirm, handleCancel } = useConfirm();
  const perms = user?.permissions ?? [];
  const canManageAllProjets = perms.includes('MANAGE_ALL_PROJETS');
  const canViewProjetsCreateTaches = perms.includes('VIEW_PROJETS_CREATE_TACHES');
  const [projets, setProjets] = useState<Projet[]>([]);
  const [allClients, setAllClients] = useState<ClientDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [managers, setManagers] = useState<Employe[]>([]);
  const [congeAujourdhuiIds, setCongeAujourdhuiIds] = useState<Set<number>>(new Set());

  type ViewState = 'CLIENTS' | 'PROJECTS' | 'PROJECT_DETAILS';
  const [viewState, setViewState] = useState<ViewState>('CLIENTS');
  const [selectedClientKey, setSelectedClientKey] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<Projet | null>(null);
  const [mediaPlanDetails, setMediaPlanDetails] = useState<MediaPlan | null>(null);
  const [loadingMediaPlan, setLoadingMediaPlan] = useState(false);

  useEffect(() => {
    if (viewState === 'PROJECT_DETAILS' && selectedProject?.isMediaPlanProject && selectedProject?.mediaPlanLigneId) {
      const fetchMp = async () => {
        setLoadingMediaPlan(true);
        try {
          const res = await mediaPlanService.getById(selectedProject.mediaPlanLigneId!);
          setMediaPlanDetails(res.data.data);
        } catch (e) {
          console.error(e);
        } finally {
          setLoadingMediaPlan(false);
        }
      };
      fetchMp();
    } else {
      setMediaPlanDetails(null);
    }
  }, [viewState, selectedProject]);

  // Multi-project creation modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createClientKey, setCreateClientKey] = useState<string>('none');
  const [createRows, setCreateRows] = useState<ProjectFormRow[]>([]);
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // Edit modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingProjet, setEditingProjet] = useState<Projet | null>(null);
  const [editForm, setEditForm] = useState({ nom: '', description: '', typeProjet: 'DETERMINE' as 'DETERMINE' | 'INDETERMINE', dateDebut: '', dateFin: '', statut: StatutProjet.PLANIFIE, clientId: null as number | null });
  const [editChefIds, setEditChefIds] = useState<number[]>([]);
  const [editDateError, setEditDateError] = useState<string | null>(null);

  // Member modal
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [memberProjet, setMemberProjet] = useState<Projet | null>(null);
  const [subordinates, setSubordinates] = useState<Employe[]>([]);
  const [selectedMembreIds, setSelectedMembreIds] = useState<number[]>([]);
  const [loadingSubordinates, setLoadingSubordinates] = useState(false);
  const [memberChefIds, setMemberChefIds] = useState<number[]>([]);

  const today = new Date().toISOString().split('T')[0];
  const inputClass = 'h-10 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-theme-sm text-gray-700 focus:border-brand-300 focus:outline-none focus:ring focus:ring-brand-500/10 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-300';

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const userId = user?.employeId;

      const [pResult, managersResult, demandesResult, clientsResult] = await Promise.allSettled([
        canManageAllProjets ? projetService.getAll() : (userId ? projetService.getByEmploye(userId) : projetService.getAll()),
        employeService.getDepartmentManagers(),
        demandeService.getByStatut(StatutDemande.APPROUVEE),
        clientService.getAllClients(),
      ]);

      if (pResult.status === 'fulfilled') setProjets(pResult.value.data.data || []);
      if (managersResult.status === 'fulfilled') setManagers(managersResult.value.data.data || []);

      if (demandesResult.status === 'fulfilled') {
        const demandes = demandesResult.value.data.data || [];
        const onConge = new Set<number>();
        demandes.forEach(d => {
          if (d.dateDebut && d.dateFin && d.employeId) {
            const debut = d.dateDebut.toString().substring(0, 10);
            const fin = d.dateFin.toString().substring(0, 10);
            if (debut <= todayStr && todayStr <= fin) onConge.add(d.employeId);
          }
        });
        setCongeAujourdhuiIds(onConge);
      }

      if (clientsResult.status === 'fulfilled') {
        const raw = clientsResult.value.data as any;
        const clients: ClientDTO[] = Array.isArray(raw) ? raw : (raw?.data ?? []);
        setAllClients(clients);
      }
    } catch (err) {
      console.error('Erreur chargement projets:', err);
    } finally {
      setLoading(false);
    }
  };

  /* ── Group projects by client ──────────────────────────────────────────── */
  const groupedByClient = useMemo(() => {
    const map = new Map<string, { client: ClientDTO | null; projects: Projet[] }>();

    allClients.forEach(c => {
      map.set(String(c.id), { client: c, projects: [] });
    });

    map.set('none', { client: null, projects: [] });

    projets.forEach(p => {
      const key = p.clientId ? String(p.clientId) : 'none';
      if (!map.has(key)) {
        map.set(key, { client: null, projects: [] });
      }
      map.get(key)!.projects.push(p);
    });

    return map;
  }, [projets, allClients]);



  /* ── Open multi-project creation modal ─────────────────────────────────── */
  const openCreateModal = (clientKey: string) => {
    setCreateClientKey(clientKey);
    setCreateRows([emptyRow(today)]);
    setCreateError(null);
    setShowCreateModal(true);
  };

  const addRow = () => {
    setCreateRows(prev => [...prev, emptyRow(today)]);
  };

  const removeRow = (idx: number) => {
    setCreateRows(prev => prev.filter((_, i) => i !== idx));
  };

  const updateRow = (idx: number, partial: Partial<ProjectFormRow>) => {
    setCreateRows(prev => prev.map((r, i) => i === idx ? { ...r, ...partial } : r));
    setCreateError(null);
  };

  const toggleRowChef = (idx: number, mgrId: number) => {
    setCreateRows(prev => prev.map((r, i) => {
      if (i !== idx) return r;
      const ids = r.chefIds.includes(mgrId) ? r.chefIds.filter(x => x !== mgrId) : [...r.chefIds, mgrId];
      return { ...r, chefIds: ids };
    }));
  };

  /* ── Save all projects ─────────────────────────────────────────────────── */
  const handleCreateAll = async () => {
    // Validate
    for (let i = 0; i < createRows.length; i++) {
      const r = createRows[i];
      if (!r.nom.trim()) { setCreateError(`Projet ${i + 1}: le nom est obligatoire.`); return; }
      if (r.typeProjet === 'DETERMINE' && r.dateFin && r.dateFin <= r.dateDebut) {
        setCreateError(`Projet ${i + 1}: la date de fin doit être après la date de début.`);
        return;
      }
    }

    setCreating(true);
    setCreateError(null);
    try {
      for (const r of createRows) {
        await projetService.create({
          nom: r.nom,
          dateDebut: r.dateDebut,
          dateFin: r.typeProjet === 'DETERMINE' ? r.dateFin : null,
          statut: StatutProjet.PLANIFIE,
          typeProjet: r.typeProjet,
          description: r.description,
          clientId: createClientKey === 'none' ? null : Number(createClientKey),
          chefDeProjetIds: r.chefIds,
          createurId: user?.employeId,
        } as any);
      }
      setShowCreateModal(false);
      loadData();
    } catch (err: any) {
      setCreateError(err?.response?.data?.message || 'Erreur lors de la création');
    } finally {
      setCreating(false);
    }
  };

  /* ── Edit modal ────────────────────────────────────────────────────────── */
  const handleEdit = (projet: Projet) => {
    setEditingProjet(projet);
    setEditForm({
      nom: projet.nom,
      description: projet.description ?? '',
      dateDebut: projet.dateDebut,
      dateFin: projet.dateFin ?? '',
      statut: projet.statut,
      typeProjet: (projet.typeProjet as any) ?? 'DETERMINE',
      clientId: projet.clientId ?? null,
    });
    setEditChefIds(
      (projet.chefsDeProjet && projet.chefsDeProjet.length > 0
        ? projet.chefsDeProjet
        : projet.chefDeProjet ? [projet.chefDeProjet] : []
      ).map(c => c.id)
    );
    setEditDateError(null);
    setShowEditModal(true);
  };

  const handleEditSave = async () => {
    if (editForm.typeProjet === 'DETERMINE' && editForm.dateFin && editForm.dateFin <= editForm.dateDebut) {
      setEditDateError('La date de fin doit être après la date de début');
      return;
    }
    try {
      await projetService.update(editingProjet!.id, {
        nom: editForm.nom,
        description: editForm.description,
        dateDebut: editForm.dateDebut,
        dateFin: editForm.typeProjet === 'DETERMINE' ? editForm.dateFin : null,
        statut: editForm.statut,
        typeProjet: editForm.typeProjet,
        chefDeProjetIds: editChefIds,
        clientId: editForm.clientId,
      } as any);
      setShowEditModal(false);
      setEditingProjet(null);
      loadData();
    } catch (err: any) {
      setEditDateError(err?.response?.data?.message || 'Erreur');
    }
  };

  /* ── Member management ─────────────────────────────────────────────────── */
  const handleAffectMembers = (projet: Projet) => {
    setMemberProjet(projet);
    setSelectedMembreIds((projet.membres ?? []).map(m => m.id));
    setMemberChefIds(
      (projet.chefsDeProjet && projet.chefsDeProjet.length > 0
        ? projet.chefsDeProjet
        : projet.chefDeProjet ? [projet.chefDeProjet] : []
      ).map(c => c.id)
    );
    setLoadingSubordinates(true);
    if (user?.employeId) {
      employeService.getSubordinates(user.employeId)
        .then(res => setSubordinates(res.data.data || []))
        .catch(console.error)
        .finally(() => setLoadingSubordinates(false));
    } else {
      setLoadingSubordinates(false);
    }
    setShowMemberModal(true);
  };

  const handleMemberSave = async () => {
    if (!memberProjet) return;
    try {
      await projetService.update(memberProjet.id, {
        nom: memberProjet.nom,
        dateDebut: memberProjet.dateDebut as any,
        dateFin: memberProjet.dateFin as any,
        statut: memberProjet.statut as any,
        typeProjet: memberProjet.typeProjet,
        chefDeProjetIds: memberChefIds,
        clientId: memberProjet.clientId,
        membreIds: selectedMembreIds,
      } as any);
      setShowMemberModal(false);
      setMemberProjet(null);
      loadData();
    } catch (err) { console.error(err); }
  };

  /* ── Other actions ─────────────────────────────────────────────────────── */
  const handleDelete = (id: number) => {
    confirm('Supprimer ce projet ?', async () => {
      try { await projetService.delete(id); loadData(); } catch (err) { console.error(err); }
    }, 'Supprimer le projet');
  };

  const handleChangeStatut = async (id: number, statut: StatutProjet) => {
    try { await projetService.changeStatut(id, statut); loadData(); } catch (err) { console.error(err); }
  };

  const getBackendBase = () =>
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
      ? 'http://localhost:8080'
      : '';

  const openFile = (c: ClientDTO) => {
    if (c.fileUrl) {
      window.open(`${getBackendBase()}${c.fileUrl}`, '_blank');
    }
  };

  const formatDate = (d: string | null | undefined) => {
    if (!d) return '—';
    const [y, m, day] = d.split('-');
    return `${day}/${m}/${y}`;
  };

  const getChefs = (p: Projet) =>
    (p.chefsDeProjet && p.chefsDeProjet.length > 0) ? p.chefsDeProjet : (p.chefDeProjet ? [p.chefDeProjet] : []);

  const getClientForKey = (key: string) => allClients.find(c => String(c.id) === key) || null;

  /* ─── RENDER ───────────────────────────────────────────────────────────── */
  if (loading) return <div className="py-20 text-center text-gray-500">Chargement...</div>;

  const sortedEntries = [...groupedByClient.entries()].sort((a, b) => {
    if (a[0] === 'none') return 1;
    if (b[0] === 'none') return -1;
    const diff = b[1].projects.length - a[1].projects.length;
    if (diff !== 0) return diff;
    return (a[1].client?.nom || '').localeCompare(b[1].client?.nom || '');
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-title-sm font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-gray-900 to-[#683b77] dark:from-white dark:to-[#ab78c3]">Tous les Projets</h1>
  
        </div>
      </div>

      {/* ── CLIENTS VIEW ── */}
      {viewState === 'CLIENTS' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedEntries.map(([key, { client, projects }]) => (
            <div
              key={key}
              onClick={() => { setSelectedClientKey(key); setViewState('PROJECTS'); }}
              className="group cursor-pointer rounded-2xl border border-gray-200 bg-white p-5 hover:border-brand-300 hover:shadow-md transition-all dark:border-gray-700 dark:bg-gray-dark dark:hover:border-brand-500/50"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
                    <HiOutlineBriefcase size={20} />
                  </div>
                  <div>
                    <h3 className="text-theme-sm font-semibold text-gray-900 dark:text-white line-clamp-1">
                      {client ? client.nom : 'Sans Client'}
                    </h3>
                    <p className="text-theme-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-1">
                      {client?.description || 'Projets internes / Non assignés'}
                    </p>
                  </div>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-4 dark:border-gray-700/50">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-medium text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
                  {projects.length} projet{projects.length !== 1 ? 's' : ''}
                </span>
                <span className="text-theme-xs font-medium text-brand-600 opacity-0 group-hover:opacity-100 transition-opacity dark:text-brand-400">
                  Voir les projets →
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── PROJECTS VIEW ── */}
      {viewState === 'PROJECTS' && (
        <div className="space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <button
                onClick={() => setViewState('CLIENTS')}
                className="mb-4 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-brand-500 transition-colors hover:text-brand-600 dark:text-brand-400 dark:hover:text-brand-300"
              >
                <HiOutlineArrowLeft size={14} />
                Retour aux clients
              </button>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                {getClientForKey(selectedClientKey || 'none')?.nom || 'Sans Client'}
              </h2>
              <p className="mt-1.5 text-[13px] text-gray-500 dark:text-gray-400">
                {(groupedByClient.get(selectedClientKey || 'none')?.projects || []).length} projets actifs pour ce client.
              </p>
            </div>

            {canManageAllProjets && (
              <button
                onClick={() => openCreateModal(selectedClientKey || 'none')}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
              >
                <HiOutlinePlus size={16} /> Nouveau Projet
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {(groupedByClient.get(selectedClientKey || 'none')?.projects || []).map(p => {
              const chefs = getChefs(p);

              let statusBadgeClass = 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700';
              if (p.statut === 'EN_COURS') statusBadgeClass = 'bg-brand-50 text-brand-600 border-brand-200 dark:bg-brand-900/20 dark:text-brand-400 dark:border-brand-800';
              else if (p.statut === 'CLOTURE') statusBadgeClass = 'bg-green-50 text-green-600 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800';
              else if (p.statut === 'ANNULE') statusBadgeClass = 'bg-red-50 text-red-600 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800';

              return (
                <div
                  key={p.id}
                  onClick={() => { setSelectedProject(p); setViewState('PROJECT_DETAILS'); }}
                  className="group relative flex h-full cursor-pointer flex-col overflow-hidden rounded-[20px] border border-gray-200 bg-white p-5 shadow-sm transition-all hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:shadow-xl dark:shadow-black/20 dark:hover:border-[#3a3e4d]"
                >
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <h3 className="line-clamp-2 flex-1 text-base font-semibold leading-snug text-gray-900 dark:text-gray-100">
                      {p.nom}
                    </h3>
                    <span className={`shrink-0 rounded-lg border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${statusBadgeClass}`}>
                      {p.statut.replace('_', ' ')}
                    </span>
                  </div>

                  <div className="mb-6 flex items-center gap-2 text-[12px] font-medium text-gray-500 dark:text-gray-400">
                    <HiOutlineCalendar size={15} className="text-gray-400 dark:text-gray-500" />
                    <span>{formatDate(p.dateDebut)} — {p.dateFin ? formatDate(p.dateFin) : 'Indéterminé'}</span>
                  </div>

                  <div className="flex-1">
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">
                      Managers
                    </p>
                    {chefs.length === 0 ? (
                      <span className="text-[12px] font-medium text-gray-400 dark:text-gray-600">-</span>
                    ) : (
                      <div className="flex -space-x-2">
                        {chefs.slice(0, 3).map((c, i) => (
                          <div key={c.id} className="relative h-7 w-7 overflow-hidden rounded-full ring-2 ring-white dark:ring-[#1a1c22]">
                            {congeAujourdhuiIds.has(c.id) && (
                              <div className="absolute right-0 top-0 h-2 w-2 rounded-full border border-[#1a1c22] bg-brand- z-10" title="En congé"></div>
                            )}
                            {c.imageUrl ? (
                              <img src={c.imageUrl} alt={c.nom} className="h-full w-full object-cover" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center bg-gray-200 dark:bg-gray-700 text-[9px] font-bold text-gray-700 dark:text-gray-300">
                                {c.prenom?.[0]}{c.nom?.[0]}
                              </div>
                            )}
                          </div>
                        ))}
                        {chefs.length > 3 && (
                          <div className="relative z-10 flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 ring-2 ring-white dark:bg-gray-700 dark:text-gray-300 dark:ring-[#1a1c22] text-[10px] font-bold">
                            +{chefs.length - 3}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="mt-6 flex items-center justify-between border-t border-gray-100 pt-4 dark:border-white/5">
                    <span className="text-[11px] font-medium text-gray-500 dark:text-gray-500">
                      {(p.membres || []).length} membres actifs
                    </span>
                    <span className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-widest text-gray-400 transition-colors group-hover:text-brand-500 dark:text-gray-500">
                      Détails <span className="text-lg leading-none translate-y-[-1px]">→</span>
                    </span>
                  </div>
                </div>
              );
            })}

            {/* Nouveau Projet Card */}
            {canManageAllProjets && (
              <div
                onClick={() => openCreateModal(selectedClientKey || 'none')}
                className="group flex min-h-[220px] cursor-pointer flex-col items-center justify-center gap-3 rounded-[20px] border-2 border-dashed border-gray-200 bg-transparent transition-all hover:border-gray-300 hover:bg-gray-50 dark:border-[#272a35] dark:hover:border-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-400 transition-colors group-hover:bg-gray-200 group-hover:text-gray-600 dark:bg-gray-100 dark:bg-gray-800 dark:text-gray-500 dark:group-hover:bg-gray-200 dark:bg-gray-700 dark:group-hover:text-gray-300">
                  <HiOutlinePlus size={20} />
                </div>
                <div className="text-center">
                  <p className="text-[14px] font-bold text-gray-900 dark:text-gray-200">Nouveau Projet</p>
                  <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-500">Lancer une nouvelle initiative pour ce client</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── PROJECT DETAILS VIEW ── */}
      {viewState === 'PROJECT_DETAILS' && selectedProject && (
        <div className="space-y-6 lg:space-y-8">
          {/* Top Header Back Button */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => setViewState('PROJECTS')}
              className="flex items-center gap-2 text-[14px] font-medium text-gray-600 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
            >
              <HiOutlineArrowLeft size={18} />
              Détails du Projet
            </button>
          </div>

          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            {/* Info Block (Left) */}
            <div className="max-w-2xl">
              <h1 className="mb-4 text-2xl font-bold text-gray-900 dark:text-white">
                {selectedProject.nom}
              </h1>
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-gray-100 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-gray-600 dark:bg-[#252834] dark:text-[#a0a8c2]">
                  {selectedProject.statut.replace('_', ' ')}
                </span>
                {selectedProject.typeProjet === 'INDETERMINE' && (
                  <span className="rounded-full bg-gray-100 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-gray-600 dark:bg-[#252834] dark:text-[#a0a8c2]">
                    Projet Indéterminé
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-[13px] font-medium text-gray-500 dark:text-gray-400">
                <HiOutlineCalendar size={16} />
                <span>{formatDate(selectedProject.dateDebut)} au {selectedProject.dateFin ? formatDate(selectedProject.dateFin) : 'Non défini'}</span>
              </div>
              {selectedProject.description && (
                <div className="mt-4 text-[13px] whitespace-pre-wrap text-gray-600 dark:text-gray-300">
                  {selectedProject.description}
                </div>
              )}
            </div>

            {/* Actions Block (Right) */}
            <div className="flex shrink-0 flex-wrap gap-3">
              {(canManageAllProjets || canViewProjetsCreateTaches) && selectedProject.statut === 'PLANIFIE' && (
                <button
                  onClick={() => {
                    handleChangeStatut(selectedProject.id, StatutProjet.EN_COURS);
                    setSelectedProject({ ...selectedProject, statut: StatutProjet.EN_COURS });
                  }}
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                >
                  Démarrer
                </button>
              )}
              {(canManageAllProjets || canViewProjetsCreateTaches) && selectedProject.statut === 'EN_COURS' && (
                <button
                  onClick={() => {
                    handleChangeStatut(selectedProject.id, StatutProjet.CLOTURE);
                    setSelectedProject({ ...selectedProject, statut: StatutProjet.CLOTURE });
                  }}
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                >
                  Clôturer
                </button>
              )}
              {(canManageAllProjets || canViewProjetsCreateTaches) && (
                <button
                  onClick={() => navigate(`/projets/${selectedProject.id}/taches`)}
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                >
                  <HiOutlineClipboardList size={16} /> Tâches
                </button>
              )}
              {(canManageAllProjets || canViewProjetsCreateTaches) && ((selectedProject.chefsDeProjet && selectedProject.chefsDeProjet.some(c => c.id === user?.employeId)) || selectedProject.chefDeProjet?.id === user?.employeId) && (
                <button
                  onClick={() => handleAffectMembers(selectedProject)}
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                >
                  <HiOutlineUserGroup size={16} /> Affecter
                </button>
              )}
              {canManageAllProjets && (
                <button
                  onClick={() => handleEdit(selectedProject)}
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                >
                  <HiOutlinePencil size={16} /> Modifier
                </button>
              )}
              {canManageAllProjets && (
                <button
                  onClick={() => handleDelete(selectedProject.id)}
                  className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 focus:outline-none dark:border-red-900/50 dark:bg-gray-800 dark:text-red-400 dark:hover:bg-gray-700"
                >
                  <HiOutlineTrash size={16} /> Supprimer
                </button>
              )}
            </div>
          </div>

          {/* Media Plan Details Panel */}
          {selectedProject.isMediaPlanProject && mediaPlanDetails && (
            <div className="mb-6 rounded-[20px] border border-brand-200 bg-brand-50 p-6 dark:border-brand-200 dark:bg-brand-900/5 dark:border-brand-900/20">
              <h4 className="mb-4 flex items-center gap-2 text-[13px] font-bold uppercase tracking-widest text-brand-600 dark:text-brand-400">
                <HiOutlineDocumentText size={16} /> Détails Media Plan
              </h4>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
                <div><span className="block text-[10px] font-bold uppercase text-gray-500">Format</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{mediaPlanDetails.format}</span></div>
                <div><span className="block text-[10px] font-bold uppercase text-gray-500">Type</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{mediaPlanDetails.type || '-'}</span></div>
                <div><span className="block text-[10px] font-bold uppercase text-gray-500">Publication</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{mediaPlanDetails.datePublication ? formatDate(mediaPlanDetails.datePublication) : '-'}</span></div>
                <div><span className="block text-[10px] font-bold uppercase text-gray-500">Lien Drive</span>
                  {mediaPlanDetails.lienDrive ? <a href={mediaPlanDetails.lienDrive} target="_blank" rel="noreferrer" className="text-sm font-medium text-brand-600 underline hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-500">Ouvrir Drive</a> : <span className="text-sm text-gray-500">-</span>}</div>
              </div>
              <div className="mt-4 border-t border-brand-200/50 pt-4 dark:border-[#2d251d]">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <span className="block text-[10px] font-bold uppercase text-gray-500">Texte sur Visuel</span>
                    <p className="mt-1 text-[13px] text-gray-700 dark:text-gray-300">{mediaPlanDetails.texteSurVisuel || '-'}</p>
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold uppercase text-gray-500">Inspiration / Autres</span>
                    <div className="mt-1 flex flex-wrap gap-2 text-[13px] text-gray-700 dark:text-gray-300">
                      {mediaPlanDetails.inspiration ? (
                        mediaPlanDetails.inspiration.startsWith('http') || mediaPlanDetails.inspiration.startsWith('www') ?
                          <a href={mediaPlanDetails.inspiration.startsWith('http') ? mediaPlanDetails.inspiration : `https://${mediaPlanDetails.inspiration}`} target="_blank" rel="noreferrer" className="text-brand-600 hover:underline dark:text-brand-400">Inspiration (Lien)</a>
                          : <span>{mediaPlanDetails.inspiration}</span>
                      ) : '-'}
                      {mediaPlanDetails.autresElements && <span className="ml-2 border-l border-gray-300 pl-2 dark:border-gray-700">{mediaPlanDetails.autresElements}</span>}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Managers Panel */}
            <div>
              <h4 className="mb-4 flex items-center gap-2 text-[13px] font-bold uppercase tracking-widest text-gray-800 dark:text-gray-100">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400"><HiOutlineUserGroup size={16} /></span>
                Department Managers
              </h4>
              <div className="rounded-[20px] border border-gray-100 bg-gray-50/50 p-6 dark:border-[#1e212b] dark:bg-[#14161d] min-h-[160px]">
                <div className="flex flex-col gap-3">
                  {getChefs(selectedProject).length === 0 ? (
                    <p className="py-4 text-center text-[13px] font-medium italic text-gray-400 dark:text-gray-500">Aucun manager assigné</p>
                  ) : (
                    getChefs(selectedProject).map(m => (
                      <div key={m.id} className="flex items-center gap-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-[#262a36] dark:bg-[#1a1c23]">
                        <div className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-50 text-[14px] font-bold text-brand-600 dark:bg-brand-500 dark:text-white">
                          {congeAujourdhuiIds.has(m.id) && (
                            <div className="absolute right-0 top-0 h-3 w-3 rounded-full border-2 border-white bg-error-500 dark:border-[#1a1c23] z-10" title="En congé"></div>
                          )}
                          {m.imageUrl ? (
                            <img src={m.imageUrl} alt={m.nom} className="h-full w-full object-cover" />
                          ) : (
                            <span>{m.prenom?.[0]}{m.nom?.[0]}</span>
                          )}
                        </div>
                        <div>
                          <p className="text-[15px] font-bold text-gray-900 dark:text-white">{m.prenom} {m.nom}</p>
                          <p className="text-[12px] font-medium text-gray-500 dark:text-gray-400">Manager</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Members Panel */}
            <div>
              <h4 className="mb-4 flex items-center gap-2 text-[13px] font-bold uppercase tracking-widest text-gray-800 dark:text-gray-100">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400"><HiOutlineUserGroup size={12} /></span>
                Membres du projet
              </h4>
              <div className="rounded-[20px] border border-gray-100 bg-gray-50/50 p-6 dark:border-[#1e212b] dark:bg-[#14161d] min-h-[160px]">
                <div className="flex flex-col gap-3">
                  {!(selectedProject.membres ?? []).length ? (
                    <p className="flex h-[80px] items-center justify-center text-[13px] font-medium italic text-gray-400 dark:text-gray-500">Aucun membre assigné</p>
                  ) : (
                    (selectedProject.membres ?? []).map(m => (
                      <div key={m.id} className="flex items-center gap-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-[#262a36] dark:bg-[#1a1c23]">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gray-100 text-[14px] font-bold text-gray-600 dark:bg-gray-700 dark:text-gray-400">
                          {m.imageUrl ? (
                            <img src={m.imageUrl} alt={m.nom} className="h-full w-full object-cover" />
                          ) : (
                            <span>{m.prenom?.[0]}{m.nom?.[0]}</span>
                          )}
                        </div>
                        <div>
                          <p className="text-[15px] font-bold text-gray-900 dark:text-white">{m.prenom} {m.nom}</p>
                          <p className="text-[12px] font-medium text-gray-500 dark:text-gray-400">{m.departement || 'Membre'}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}     {/* ══════════════════════════════════════════════════════════════════════
          MULTI-PROJECT CREATION MODAL
         ══════════════════════════════════════════════════════════════════════ */}
      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="Créer des projets" size="lg">
        <div className="space-y-5 max-h-[70vh] overflow-y-auto pr-1">
          {createRows.map((row, idx) => {
            const clientObj = getClientForKey(createClientKey);
            return (
              <div key={idx} className="relative rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-dark space-y-3">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <p className="text-theme-sm font-semibold text-gray-800 dark:text-white">Projet {idx + 1}</p>
                  {createRows.length > 1 && (
                    <button onClick={() => removeRow(idx)} className="text-error-500 hover:text-error-600 text-theme-xs font-medium">Supprimer</button>
                  )}
                </div>

                {/* Client (read-only) */}
                <div className="h-10 flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-100 px-3 text-theme-sm text-gray-600 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300">
                  <HiOutlineBriefcase className="pp-anim-float text-brand-500" size={16} />
                  <span>{clientObj ? clientObj.nom : 'Aucun client'}</span>
                </div>

                {/* Nom */}
                <input
                  type="text"
                  value={row.nom}
                  onChange={e => updateRow(idx, { nom: e.target.value })}
                  className={inputClass}
                  placeholder="Titre du projet *"
                />

                {/* Description */}
                <textarea
                  value={row.description}
                  onChange={e => updateRow(idx, { description: e.target.value })}
                  className={`${inputClass} h-20 py-2 resize-none`}
                  placeholder="Description du projet (optionnel)"
                />

                {/* Chefs de projet */}
                <div>
                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Department Manager</label>
                  <div className="max-h-32 overflow-y-auto space-y-1 rounded-lg border border-gray-200 p-2 dark:border-gray-700">
                    {managers.map(m => {
                      const sel = row.chefIds.includes(m.id);
                      return (
                        <label key={m.id} className={`flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 transition-colors ${sel ? 'bg-warning-50 dark:bg-warning-500/10' : 'hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
                          <input type="checkbox" checked={sel} onChange={() => toggleRowChef(idx, m.id)} className="h-3.5 w-3.5 rounded text-warning-500" />
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-warning-100 text-[9px] font-bold text-warning-700">{m.prenom?.[0]}{m.nom?.[0]}</span>
                          <span className="text-theme-xs font-medium text-gray-700 dark:text-gray-300 truncate">{m.prenom} {m.nom}</span>
                          {congeAujourdhuiIds.has(m.id) && <span className="text-[10px] text-warning-500 pp-anim-pulse"><HiOutlineSun size={14} /></span>}
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Type de projet */}
                <div className="flex gap-5">
                  {(['DETERMINE', 'INDETERMINE'] as const).map(type => (
                    <label key={type} className="flex cursor-pointer items-center gap-2">
                      <input type="radio" name={`createType-${idx}`} checked={row.typeProjet === type}
                        onChange={() => updateRow(idx, { typeProjet: type, dateFin: '' })}
                        className="h-4 w-4 text-brand-600 focus:ring-brand-500" />
                      <span className="text-theme-sm text-gray-700 dark:text-gray-300">
                        {type === 'DETERMINE' ? 'Déterminé' : 'Indéterminé'}
                      </span>
                    </label>
                  ))}
                </div>

                {/* Dates */}
                <div className={`grid gap-3 ${row.typeProjet === 'DETERMINE' ? 'grid-cols-2' : 'grid-cols-1'}`}>
                  <input type="date" value={row.dateDebut} min={today}
                    onChange={e => updateRow(idx, { dateDebut: e.target.value })}
                    className={inputClass} style={{ colorScheme: 'dark' }} />
                  {row.typeProjet === 'DETERMINE' && (
                    <input type="date" value={row.dateFin} min={row.dateDebut || today}
                      onChange={e => updateRow(idx, { dateFin: e.target.value })}
                      className={inputClass} style={{ colorScheme: 'dark' }} />
                  )}
                </div>
              </div>
            );
          })}

          {/* ── Add another project ── */}
          <button
            onClick={addRow}
            className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-brand- py-3 text-theme-sm font-medium text-brand- hover:bg-brand-/40 dark:border-brand-/30 dark:text-brand- dark:hover:bg-brand-/5 transition-colors"
          >
            <HiOutlinePlus size={16} /> Ajouter un autre projet
          </button>
        </div>

        {createError && <div className="mt-3 rounded-lg bg-error-50 px-4 py-2 text-theme-sm text-error-600 dark:bg-error-500/10">{createError}</div>}

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 mt-4 border-t border-gray-200 dark:border-gray-700">
          <span className="text-theme-xs text-gray-500 dark:text-gray-400">
            {createRows.length} projet{createRows.length !== 1 ? 's' : ''} en attente
          </span>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>Annuler</Button>
            <Button onClick={handleCreateAll} disabled={creating}>
              {creating ? 'Création...' : `Créer ${createRows.length > 1 ? 'les projets' : 'le projet'}`}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Edit Modal ── */}
      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="Modifier le projet" size="lg">
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-theme-sm font-medium text-gray-700 dark:text-gray-300">Nom</label>
            <input type="text" value={editForm.nom} onChange={e => setEditForm(f => ({ ...f, nom: e.target.value }))} className={inputClass} />
          </div>

          <div>
            <label className="mb-1.5 block text-theme-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
            <textarea value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} className={`${inputClass} h-20 py-2 resize-none`} />
          </div>

          <div>
            <label className="mb-2 block text-theme-sm font-medium text-gray-700 dark:text-gray-300">Chefs de projet</label>
            <div className="max-h-44 overflow-y-auto space-y-1.5 rounded-lg border border-gray-200 p-2 dark:border-gray-700">
              {managers.map(m => {
                const sel = editChefIds.includes(m.id);
                return (
                  <label key={m.id} className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 transition-colors ${sel ? 'bg-warning-50 dark:bg-warning-500/10' : 'hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
                    <input type="checkbox" checked={sel} onChange={() => setEditChefIds(prev => prev.includes(m.id) ? prev.filter(x => x !== m.id) : [...prev, m.id])} className="h-4 w-4 rounded text-warning-500" />
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-warning-100 text-[11px] font-bold text-warning-700">{m.prenom?.[0]}{m.nom?.[0]}</div>
                    <span className="text-theme-sm font-medium text-gray-800 dark:text-white truncate">{m.prenom} {m.nom}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-theme-sm font-medium text-gray-700 dark:text-gray-300">Type</label>
            <div className="flex gap-6">
              {(['DETERMINE', 'INDETERMINE'] as const).map(type => (
                <label key={type} className="flex cursor-pointer items-center gap-2">
                  <input type="radio" name="editType" value={type} checked={editForm.typeProjet === type}
                    onChange={() => setEditForm(f => ({ ...f, typeProjet: type, dateFin: '' }))}
                    className="h-4 w-4 text-brand-600 focus:ring-brand-500" />
                  <span className="text-theme-sm text-gray-700 dark:text-gray-300">{type === 'DETERMINE' ? 'Déterminé' : 'Indéterminé'}</span>
                </label>
              ))}
            </div>
          </div>

          <div className={`grid gap-4 ${editForm.typeProjet === 'DETERMINE' ? 'grid-cols-2' : 'grid-cols-1'}`}>
            <div>
              <label className="mb-1.5 block text-theme-sm font-medium text-gray-700 dark:text-gray-300">Date début</label>
              <input type="date" value={editForm.dateDebut} onChange={e => { setEditForm(f => ({ ...f, dateDebut: e.target.value })); setEditDateError(null); }} className={inputClass} style={{ colorScheme: 'dark' }} />
            </div>
            {editForm.typeProjet === 'DETERMINE' && (
              <div>
                <label className="mb-1.5 block text-theme-sm font-medium text-gray-700 dark:text-gray-300">Date fin</label>
                <input type="date" value={editForm.dateFin} min={editForm.dateDebut || today} onChange={e => { setEditForm(f => ({ ...f, dateFin: e.target.value })); setEditDateError(null); }} className={inputClass} style={{ colorScheme: 'dark' }} />
              </div>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-theme-sm font-medium text-gray-700 dark:text-gray-300">Statut</label>
            <select value={editForm.statut} onChange={e => setEditForm(f => ({ ...f, statut: e.target.value as StatutProjet }))} className={inputClass}>
              {Object.values(StatutProjet).map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {editDateError && <div className="rounded-lg bg-error-50 px-4 py-2 text-theme-sm text-error-600 dark:bg-error-500/10">{editDateError}</div>}

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setShowEditModal(false)}>Annuler</Button>
            <Button onClick={handleEditSave}>Modifier</Button>
          </div>
        </div>
      </Modal>

      {/* ── Member Modal ── */}
      <Modal isOpen={showMemberModal} onClose={() => setShowMemberModal(false)} title="Gérer les membres du projet" size="lg">
        <div className="space-y-4">
          <div className="rounded-xl border border-brand-100 bg-brand-50/60 px-4 py-3 dark:border-brand-500/20 dark:bg-brand-500/5">
            <p className="text-theme-sm font-semibold text-brand-700 dark:text-brand-300">{memberProjet?.nom}</p>
            <p className="mt-0.5 text-theme-xs text-brand-500">Sélectionnez les employés à ajouter à ce projet.</p>
          </div>
          {loadingSubordinates ? (
            <div className="py-6 text-center text-gray-400 text-theme-sm">Chargement...</div>
          ) : subordinates.length === 0 ? (
            <div className="rounded-lg bg-warning-50 px-4 py-3 text-theme-sm text-warning-600 dark:bg-warning-500/10">Aucun employé sous votre responsabilité.</div>
          ) : (
            <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
              {subordinates.map(sub => {
                const sel = selectedMembreIds.includes(sub.id);
                return (
                  <label key={sub.id} className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors ${sel ? 'border-brand-300 bg-brand-50 dark:border-brand-500/40 dark:bg-brand-500/10' : 'border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800'}`}>
                    <input type="checkbox" checked={sel} onChange={() => setSelectedMembreIds(prev => prev.includes(sub.id) ? prev.filter(x => x !== sub.id) : [...prev, sub.id])} className="h-4 w-4 rounded text-brand-500" />
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-theme-xs font-bold text-brand-600">{sub.prenom?.[0]}{sub.nom?.[0]}</div>
                    <div className="min-w-0 flex-1">
                      <p className="text-theme-sm font-semibold text-gray-800 dark:text-white truncate">{sub.prenom} {sub.nom}</p>
                      {sub.departement && <p className="text-theme-xs text-gray-400 flex items-center gap-1"><HiOutlineOfficeBuilding className="pp-anim-float" size={12} /> {sub.departement}</p>}
                    </div>
                  </label>
                );
              })}
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setShowMemberModal(false)}>Annuler</Button>
            <Button onClick={handleMemberSave}>Enregistrer ({selectedMembreIds.length} sélectionné{selectedMembreIds.length !== 1 ? 's' : ''})</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog isOpen={confirmState.isOpen} message={confirmState.message} title={confirmState.title} onConfirm={handleConfirm} onCancel={handleCancel} />
    </div>
  );
};

export default ProjetsPage;
