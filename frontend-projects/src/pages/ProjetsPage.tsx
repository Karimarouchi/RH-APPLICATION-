import React, { useState, useEffect, useMemo } from 'react';
import { DatePickerInput } from '../components/ui/DatePickerInput';
import { useNavigate } from 'react-router-dom';
import { HiOutlinePlus, HiOutlinePencil, HiOutlineTrash, HiOutlineClipboardList, HiOutlineDocumentText, HiOutlineDownload, HiOutlineChevronDown, HiOutlineArrowLeft, HiOutlineBriefcase, HiOutlineUserGroup, HiOutlineCalendar, HiOutlineOfficeBuilding, HiOutlineSun } from 'react-icons/hi';
import { projetService } from '../api/projetService';
import { employeService } from '../api/employeService';
import { demandeService } from '../api/demandeService';
import { clientService } from '../api/clientService';
import { mediaPlanService } from '../api/mediaPlanService';
import type { ClientDTO } from '../api/clientService';
import { API_BASE } from '../api/axios';
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
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [now, setNow] = useState(() => new Date());

  type ViewState = 'CLIENTS' | 'PROJECTS' | 'PROJECT_DETAILS';
  const [viewState, setViewState] = useState<ViewState>('CLIENTS');
  const [currentPage, setCurrentPage] = useState(1);
  const clientsPerPage = 6;
  const [selectedClientKey, setSelectedClientKey] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<Projet | null>(null);
  const [mediaPlanDetails, setMediaPlanDetails] = useState<MediaPlan | null>(null);
  const [loadingMediaPlan, setLoadingMediaPlan] = useState(false);

  type ClientsTab = 'TOUS' | 'ACTIFS' | 'NON_ASSIGNE' | 'RECENTS';
  const [clientsTab, setClientsTab] = useState<ClientsTab>('TOUS');
  const [clientSearch, setClientSearch] = useState('');

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

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  const formatLastUpdated = (value: Date | null, reference: Date) => {
    if (!value) return '—';
    const diffMs = Math.max(0, reference.getTime() - value.getTime());
    const diffMin = Math.floor(diffMs / 60000);

    if (diffMin < 1) return "A l'instant";
    if (diffMin < 60) return `il y a ${diffMin} min`;

    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `il y a ${diffHours} h`;

    const diffDays = Math.floor(diffHours / 24);
    return `il y a ${diffDays} j`;
  };

  const loadData = async () => {
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const userId = user?.employeId;

      const [pResult, managersResult, demandesResult, clientsResult] = await Promise.allSettled([
        canManageAllProjets ? projetService.getAll() : (userId ? projetService.getByEmploye(userId) : projetService.getAll()),
        employeService.getByRole('MANAGER'),
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

      setLastUpdatedAt(new Date());
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
      try { await projetService.delete(id); setSelectedProject(null); loadData(); } catch (err: any) { alert(err?.response?.data?.message || 'Suppression impossible (droits insuffisants ou erreur serveur).'); }
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

  const getClientInitials = (name: string) => {
    const cleaned = name
      .replace(/\(.*?\)/g, '')
      .replace(/[\/]/g, ' ')
      .trim();
    if (!cleaned) return 'CL';
    const parts = cleaned.split(/\s+/g).filter(Boolean);
    if (parts.length >= 2) return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
    return cleaned.slice(0, 2).toUpperCase();
  };

  const getClientKey = (clientName: string) => {
    const n = clientName.trim().toLowerCase();
    if (n.includes('tecnocasa')) return 'tecnocasa';
    if (n.includes('gmir')) return 'gmir';
    if (n.includes('skinlab')) return 'skinlab';
    if (n.includes('eshuji') || n.includes('client')) return 'eshuji';
    if (n.includes('shemi')) return 'shemi';
    if (n.includes('zen')) return 'zen';
    return 'default';
  };

  const getClientProgress = (clientKey: string, projects: Projet[]) => {
    if (!projects.length) return 0;

    const weights: Record<string, number> = {
      [StatutProjet.CLOTURE]: 1,
      [StatutProjet.EN_COURS]: 0.5,
      [StatutProjet.PLANIFIE]: 0.2,
      [StatutProjet.ANNULE]: 0,
    };
    const score = projects.reduce((acc, p) => acc + (weights[p.statut] ?? 0), 0);
    return Math.max(0, Math.min(100, Math.round((score / projects.length) * 100)));
  };

  const getClientPreviewMembers = (projects: Projet[]) => {
    const map = new Map<number, Employe>();
    projects.forEach(p => {
      getChefs(p).forEach(c => {
        if (c?.id != null && !map.has(c.id)) map.set(c.id, c);
      });
    });
    return [...map.values()];
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [clientsTab, clientSearch]);

  /* ─── RENDER ───────────────────────────────────────────────────────────── */
  const sortedEntries = [...groupedByClient.entries()].sort((a, b) => {
    if (a[0] === 'none') return 1;
    if (b[0] === 'none') return -1;
    const diff = b[1].projects.length - a[1].projects.length;
    if (diff !== 0) return diff;
    return (a[1].client?.nom || '').localeCompare(b[1].client?.nom || '');
  });

  const clientEntries = sortedEntries.filter(([key]) => key !== 'none');

  const filteredClientEntries = clientEntries
    .filter(([_, { client, projects }]) => {
      if (clientsTab === 'ACTIFS') return projects.length > 0;
      if (clientsTab === 'NON_ASSIGNE') return projects.length === 0;
      if (clientsTab === 'RECENTS') return projects.length > 0;
      return true;
    })
    .filter(([_, { client }]) => {
      const q = clientSearch.trim().toLowerCase();
      if (!q) return true;
      return (client?.nom || '').toLowerCase().includes(q);
    })
    .sort((a, b) => {
      if (clientsTab !== 'RECENTS') return 0;
      const lastDate = (projects: Projet[]) => {
        const dates = projects
          .map(p => p.dateDebut || p.dateFin)
          .filter(Boolean)
          .map(d => String(d).substring(0, 10));
        const sorted = dates.sort();
        return sorted.length ? sorted[sorted.length - 1] : '';
      };
      return lastDate(b[1].projects).localeCompare(lastDate(a[1].projects));
    });

  const statsClientsCount = clientEntries.length;
  const statsProjects = clientEntries.flatMap(([_, { projects }]) => projects);
  const statsTotalProjects = statsProjects.length;
  const statsNoProjectsClients = clientEntries.filter(([_, { projects }]) => projects.length === 0).length;

  const monthKey = new Date().toISOString().substring(0, 7);
  const statsNewThisMonth = statsProjects.filter(p => String(p.dateDebut || '').substring(0, 7) === monthKey).length;

  const statsPending = statsProjects.filter(p => {
    const hasChefs = (p.chefsDeProjet && p.chefsDeProjet.length > 0) || !!p.chefDeProjet;
    return !hasChefs;
  }).length;

  /* ── Pagination Logic (clients dashboard) ── */
  const totalPages = Math.max(1, Math.ceil(filteredClientEntries.length / clientsPerPage));
  const safePage = Math.min(currentPage, totalPages);

  useEffect(() => {
    setCurrentPage(prev => Math.min(prev, totalPages));
  }, [totalPages]);

  const paginatedEntries = filteredClientEntries.slice(
    (safePage - 1) * clientsPerPage,
    safePage * clientsPerPage
  );

  if (loading) return (
    <div className="flex h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-brand-500 dark:border-gray-700" />
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Chargement des projets...</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#fcfcfc] dark:bg-gray-900 p-4 lg:p-6 pb-20">
      <div className="max-w-6xl mx-auto space-y-5">
      {/* ── CLIENTS DASHBOARD (Tous les Projets) ── */}
      {viewState === 'CLIENTS' && (
        <div className="space-y-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
                Tous les <span className="text-brand-600 dark:text-brand-400">Projets</span>
              </h1>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Supervision des clients et de leurs projets</p>
            </div>

            <div className="flex items-center gap-3">
              <input
                className="px-4 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-transparent text-sm w-full sm:w-64"
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
                placeholder="Rechercher un client..."
                aria-label="Rechercher un client"
              />
              {canManageAllProjets && (
                <button
                  type="button"
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-sm font-medium whitespace-nowrap transition-all duration-300 shadow-sm hover:shadow-md"
                  onClick={() => openCreateModal('none')}
                >
                  <HiOutlinePlus size={16} /> Nouveau projet
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-5 flex flex-col gap-1 text-center sm:text-left">
              <div className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">TOTAL PROJETS</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{statsTotalProjects}</div>
              <div className="text-xs font-medium text-emerald-600">+{statsNewThisMonth} ce mois</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-5 flex flex-col gap-1 text-center sm:text-left">
              <div className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">CLIENTS ACTIFS</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{statsClientsCount}</div>
              <div className="text-xs font-medium text-brand-600">{statsNoProjectsClients} sans assigné</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-5 flex flex-col gap-1 text-center sm:text-left">
              <div className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">EN ATTENTE</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{statsPending}</div>
              <div className="text-xs font-medium text-amber-600">À assigner</div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 mb-6 border-b border-gray-100 dark:border-gray-800 pb-2" role="tablist" aria-label="Filtres">
            <button type="button" className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${clientsTab === 'TOUS' ? 'bg-brand-500 text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-300'}`} onClick={() => setClientsTab('TOUS')}>Tous</button>
            <button type="button" className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${clientsTab === 'ACTIFS' ? 'bg-brand-500 text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-300'}`} onClick={() => setClientsTab('ACTIFS')}>Actifs</button>
            <button type="button" className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${clientsTab === 'NON_ASSIGNE' ? 'bg-brand-500 text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-300'}`} onClick={() => setClientsTab('NON_ASSIGNE')}>Non assignés</button>
            <button type="button" className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${clientsTab === 'RECENTS' ? 'bg-brand-500 text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-300'}`} onClick={() => setClientsTab('RECENTS')}>Récents</button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {paginatedEntries.map(([key, { client, projects }]) => {
              const name = client?.nom || 'Client';
              const clientKey = getClientKey(name);
              const progress = getClientProgress(clientKey, projects);
              const previewMembers = getClientPreviewMembers(projects);
              const hasLogo = Boolean(client?.logoUrl);

              const mark = (() => {
                if (clientKey === 'tecnocasa') return { text: getClientInitials(name), cls: 'bg-green-500' };
                if (clientKey === 'skinlab') return { text: getClientInitials(name), cls: 'bg-pink-500' };
                if (clientKey === 'zen') return { text: getClientInitials(name), cls: 'bg-amber-500' };
                if (clientKey === 'gmir') return { text: getClientInitials(name), cls: 'bg-brand-500' };
                if (clientKey === 'eshuji') return { text: getClientInitials(name), cls: 'bg-purple-500' };
                if (clientKey === 'shemi') return { text: getClientInitials(name), cls: 'bg-rose-500' };
                return { text: getClientInitials(name), cls: 'bg-gray-500' };
              })();

            

              return (
                <div
                  key={key}
                  className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-5 hover:shadow-[0_8px_30px_rgba(255,107,0,0.12)] hover:border-brand-200 dark:hover:border-brand-800 transition-all duration-300 hover:-translate-y-1 cursor-pointer group flex flex-col block-animate"
                  onClick={() => { setSelectedClientKey(key); setViewState('PROJECTS'); }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedClientKey(key);
                      setViewState('PROJECTS');
                    }
                  }}
                >
                  <div className="flex items-center gap-4 mb-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg text-white truncate shrink-0 transition-transform duration-300 group-hover:scale-105 ${mark.cls} ${hasLogo ? 'overflow-hidden bg-transparent' : 'bg-brand-500'}`}>
                      {hasLogo ? (
                        <img src={`${API_BASE}${client!.logoUrl}`} alt={name} className="w-full h-full object-cover" />
                      ) : (
                        mark.text
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-lg font-bold text-gray-900 dark:text-white truncate transition-colors group-hover:text-brand-600">{name}</div>
                    </div>
                  </div>

                  <div className="mb-4">
                    <div className="h-2 w-full bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden mb-1.5" aria-label={`Progression ${progress}%`}>
                      <div className="h-full bg-brand-500 transition-all duration-300" style={{ width: `${progress}%` }} />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400 font-medium">
                      {projects.length === 0 ? (
                        <>
                          <span>Pas encore démarré</span>
                          <span>0%</span>
                        </>
                      ) : (
                        <>
                          <span>Progression</span>
                          <span>{progress}%</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-gray-50 dark:border-gray-700 mt-auto">
                    <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">{projects.length} projet{projects.length !== 1 ? 's' : ''}</span>
                    <div className="flex items-center gap-3">
                      {projects.length === 0 ? (
                        <button
                          type="button"
                          className="text-sm font-medium text-brand-600 dark:text-brand-400 hover:text-brand-700 transition"
                          onClick={(e) => {
                            e.stopPropagation();
                            openCreateModal(key);
                          }}
                        >
                          + Assigner
                        </button>
                      ) : (
                        <>
                          <div className="flex -space-x-2" aria-label="Membres">
                            {previewMembers.slice(0, 3).map(m => (
                              <div key={m.id} className="w-7 h-7 rounded-full border-2 border-white dark:border-gray-800 shadow-sm bg-brand-200 text-white flex items-center justify-center text-[10px] font-bold shrink-0 overflow-hidden" title={`${m.prenom} ${m.nom}`}>
                                {m.imageUrl
                                  ? <img src={m.imageUrl} alt={m.nom} className="w-full h-full object-cover" />
                                  : <>{(m.prenom?.[0] || '')}{(m.nom?.[0] || '')}</>}
                              </div>
                            ))}
                          </div>
                          <button
                            type="button"
                            className="text-sm font-medium text-brand-600 dark:text-brand-400 hover:text-brand-700 flex items-center gap-1 transition-all"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedClientKey(key);
                              setViewState('PROJECTS');
                            }}
                          >
                            Voir <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-center gap-2 mt-8" aria-label="Pagination">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={safePage === 1}
              className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              Précédent
            </button>
            <div className="flex items-center gap-1 hidden sm:flex">
              {Array.from({ length: totalPages }).map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentPage(index + 1)}
                  className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-medium transition-colors ${safePage === index + 1 ? 'bg-brand-500 text-white shadow-sm' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                >
                  {index + 1}
                </button>
              ))}
            </div>
            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={safePage === totalPages}
              className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              Suivant
            </button>
          </div>
        </div>
      )}

      {/* ── PROJECTS VIEW ── */}
      {viewState === 'PROJECTS' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <button className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand-500 hover:text-brand-600 dark:text-brand-400 dark:hover:text-brand-300 mb-3 transition-all duration-300 hover:-translate-x-1" onClick={() => setViewState('CLIENTS')}>
                <HiOutlineArrowLeft size={14} className="transition-transform group-hover:-translate-x-1" /> Retour aux clients
              </button>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
                {getClientForKey(selectedClientKey || 'none')?.nom || 'Sans Client'}
              </h2>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                {(groupedByClient.get(selectedClientKey || 'none')?.projects || []).length} projets pour ce client
              </p>
            </div>
            {canManageAllProjets && (
              <button className="flex items-center justify-center gap-2 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-sm font-medium transition-all duration-300 shadow-sm hover:shadow-md hover:-translate-y-0.5" onClick={() => openCreateModal(selectedClientKey || 'none')}>
                <HiOutlinePlus size={16} /> Nouveau Projet
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {(groupedByClient.get(selectedClientKey || 'none')?.projects || []).map((p, i) => {
              const chefs = getChefs(p);
              const statusKey = p.statut.toLowerCase().replace('_', '-');
              
              let statusBadgeClass = 'bg-gray-100 text-gray-700';
              if (p.statut === 'PLANIFIE') statusBadgeClass = 'bg-purple-100 text-purple-700 font-semibold';
              if (p.statut === 'EN_COURS') statusBadgeClass = 'bg-brand-100 text-brand-700 font-semibold';
              if (p.statut === 'CLOTURE') statusBadgeClass = 'bg-emerald-100 text-emerald-700 font-semibold';
              if (p.statut === 'ANNULE') statusBadgeClass = 'bg-red-100 text-red-700 font-semibold';

              return (
                <div
                  key={p.id}
                  onClick={() => { setSelectedProject(p); setViewState('PROJECT_DETAILS'); }}
                  className="bg-white dark:bg-gray-800 rounded-[20px] p-6 border border-gray-200 dark:border-gray-700 shadow-[0_2px_10px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgba(255,107,0,0.12)] hover:border-brand-200 dark:hover:border-brand-800 transition-all duration-300 cursor-pointer flex flex-col min-h-[160px] group hover:-translate-y-1 block-animate"
                  style={{ animationDelay: `${i * 0.05}s` }}
                >
                  <div className="flex items-start justify-between mb-4">
                    <h3 className="text-[1.15rem] font-extrabold text-gray-900 dark:text-white group-hover:text-brand-600 transition-colors pr-2 leading-tight">{p.nom}</h3>
                    <span className={`text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-full whitespace-nowrap shrink-0 ${statusBadgeClass}`}>{p.statut.replace('_', ' ')}</span>
                  </div>
                  
                  <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mb-6 font-medium">
                    <HiOutlineCalendar size={14} className="text-gray-400" />
                    <span>{formatDate(p.dateDebut)} — {p.dateFin ? formatDate(p.dateFin) : 'Indéterminé'}</span>
                  </div>

                  <div className="flex items-center justify-between mt-auto pt-2">
                    <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                      {(p.membres || []).length} membre{((p.membres || []).length !== 1) ? 's' : ''}
                    </span>
                    <div className="flex items-center gap-3">
                      {chefs.length > 0 && (
                        <div className="flex -space-x-2" aria-label="Membres">
                          {chefs.slice(0, 3).map(c => (
                            <div key={c.id} className="w-7 h-7 rounded-full border-2 border-white dark:border-gray-800 shadow-sm bg-brand-200 text-white flex items-center justify-center text-[10px] font-bold shrink-0 overflow-hidden" title={`${c.prenom} ${c.nom}`}>
                              {congeAujourdhuiIds.has(c.id) && <div className="absolute top-0 right-0 w-2 h-2 bg-amber-400 border border-white rounded-full" title="En congé" />}
                              {c.imageUrl
                                ? <img src={c.imageUrl} alt={c.nom} className="w-full h-full object-cover" />
                                : <>{c.prenom?.[0]}{c.nom?.[0]}</>}
                            </div>
                          ))}
                          {chefs.length > 3 && <div className="w-7 h-7 rounded-full border-2 border-white dark:border-gray-800 shadow-sm bg-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-600 z-10 shrink-0">+{chefs.length - 3}</div>}
                        </div>
                      )}
                      
                      <button
                        type="button"
                        className="text-sm font-medium text-brand-600 dark:text-brand-400 hover:text-brand-700 flex items-center gap-1 group-hover:underline transition-all"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedProject(p);
                          setViewState('PROJECT_DETAILS');
                        }}
                      >
                        Détails <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
            {canManageAllProjets && (
              <div onClick={() => openCreateModal(selectedClientKey || 'none')} className="bg-gray-50/50 dark:bg-gray-800/50 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-2xl flex flex-col items-center justify-center p-8 text-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 hover:border-brand-400 dark:hover:border-brand-500 transition-all min-h-[220px]">
                <div className="w-12 h-12 rounded-full bg-brand-100/50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 flex items-center justify-center mb-3"><HiOutlinePlus size={24} /></div>
                <p className="text-sm font-bold text-gray-900 dark:text-white">Nouveau Projet</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Lancer une nouvelle initiative</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── PROJECT DETAILS VIEW ── */}
      {viewState === 'PROJECT_DETAILS' && selectedProject && (
        <div className="space-y-6">
          {/* Top Header Back Button */}
          <div className="flex items-center gap-4">
            <button className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand-500 hover:text-brand-600 dark:text-brand-400 dark:hover:text-brand-300 transition-all duration-300 hover:-translate-x-1 group" onClick={() => setViewState('PROJECTS')}>
              <HiOutlineArrowLeft size={16} className="transition-transform group-hover:-translate-x-1" /> Retour
            </button>
          </div>

          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-6 lg:p-8">
            {/* Info Block (Left) */}
            <div className="max-w-2xl">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight mb-4">
                {selectedProject.isMediaPlanProject && <span className="mr-2">👉</span>}
                {selectedProject.nom}
              </h1>
              <div className="flex flex-wrap items-center gap-3">
                <span className={`text-[11px] uppercase font-bold tracking-wider px-3 py-1.5 rounded-full ${
                  selectedProject.statut === 'PLANIFIE' ? 'bg-purple-100 text-purple-700' :
                  selectedProject.statut === 'EN_COURS' ? 'bg-brand-100 text-brand-700' :
                  selectedProject.statut === 'CLOTURE' ? 'bg-emerald-100 text-emerald-700' :
                  'bg-red-100 text-red-700'
                }`}>
                  {selectedProject.statut.replace('_', ' ')}
                </span>
                {selectedProject.typeProjet === 'INDETERMINE' && (
                  <span className="text-[11px] uppercase font-bold tracking-wider px-3 py-1.5 rounded-full bg-gray-100 text-gray-700">
                    Projet Indéterminé
                  </span>
                )}
                <div className="flex items-center gap-2 text-sm text-gray-500 font-medium px-3 py-1.5 bg-gray-50 dark:bg-gray-900 rounded-lg">
                  <HiOutlineCalendar size={16} className="text-gray-400" />
                  <span>{formatDate(selectedProject.dateDebut)} au {selectedProject.dateFin ? formatDate(selectedProject.dateFin) : 'Non défini'}</span>
                </div>
              </div>
              {selectedProject.description && (
                <div className="mt-4 text-[13px] whitespace-pre-wrap text-gray-600 dark:text-gray-300">
                  {selectedProject.description}
                </div>
              )}
            </div>

            {/* Actions Block (Right) */}
            <div className="flex flex-wrap gap-2 lg:flex-col lg:items-end">
              <div className="flex flex-wrap items-center gap-2">
                {(canManageAllProjets || canViewProjetsCreateTaches) && selectedProject.statut === 'PLANIFIE' && (
                  <button className="flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition shadow-sm hover:border-brand-300 hover:text-brand-600" onClick={() => { handleChangeStatut(selectedProject.id, StatutProjet.EN_COURS); setSelectedProject({ ...selectedProject, statut: StatutProjet.EN_COURS }); }}>
                    <HiOutlineSun className="text-brand-500" size={16} /> Démarrer
                  </button>
                )}
                {(canManageAllProjets || canViewProjetsCreateTaches) && selectedProject.statut === 'EN_COURS' && (
                  <button className="flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition shadow-sm" onClick={() => { handleChangeStatut(selectedProject.id, StatutProjet.CLOTURE); setSelectedProject({ ...selectedProject, statut: StatutProjet.CLOTURE }); }}>
                    <HiOutlineClipboardList className="text-emerald-500" size={16} /> Clôturer
                  </button>
                )}
                {(canManageAllProjets || canViewProjetsCreateTaches) && (
                  <button className="flex items-center gap-1.5 px-3 py-2 bg-brand-50 dark:bg-brand-900/20 border border-brand-100 dark:border-brand-800 rounded-xl text-sm font-medium text-brand-700 dark:text-brand-400 hover:bg-brand-100 dark:hover:bg-brand-900/40 transition shadow-sm hover:-translate-y-0.5" onClick={() => navigate(`/projets/${selectedProject.id}/taches`)}>
                    <HiOutlineClipboardList size={16} /> Tâches
                  </button>
                )}
                {(canManageAllProjets || canViewProjetsCreateTaches) && ((selectedProject.chefsDeProjet && selectedProject.chefsDeProjet.some(c => c.id === user?.employeId)) || selectedProject.chefDeProjet?.id === user?.employeId) && (
                  <button className="flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition shadow-sm hover:-translate-y-0.5" onClick={() => handleAffectMembers(selectedProject)}>
                    <HiOutlineUserGroup size={16} /> Affecter
                  </button>
                )}
                {canManageAllProjets && (
                  <button className="flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition shadow-sm hover:-translate-y-0.5" onClick={() => handleEdit(selectedProject)}>
                    <HiOutlinePencil size={16} /> Modifier
                  </button>
                )}
                {perms.includes('DELETE_PROJET') && (
                  <button className="flex items-center gap-1.5 px-3 py-2 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-xl text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 transition shadow-sm hover:-translate-y-0.5" onClick={() => handleDelete(selectedProject.id)}>
                    <HiOutlineTrash size={16} /> Supprimer
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Media Plan Details Panel */}
          {selectedProject.isMediaPlanProject && mediaPlanDetails && (
            <div className="bg-brand-50 dark:bg-brand-900/20 border border-brand-100 dark:border-brand-800 rounded-2xl p-6">
              <h4 className="flex items-center gap-2 text-lg font-bold text-brand-800 dark:text-brand-300 mb-5">
                <HiOutlineDocumentText size={20} /> Détails Media Plan
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
                <div className="flex flex-col"><label className="text-[10px] font-bold uppercase text-brand-600/70 dark:text-brand-400 mb-1">Format</label><span className="text-sm font-medium text-brand-900 dark:text-brand-100">{mediaPlanDetails.format}</span></div>
                <div className="flex flex-col"><label className="text-[10px] font-bold uppercase text-brand-600/70 dark:text-brand-400 mb-1">Type</label><span className="text-sm font-medium text-brand-900 dark:text-brand-100">{mediaPlanDetails.type || '-'}</span></div>
                <div className="flex flex-col"><label className="text-[10px] font-bold uppercase text-brand-600/70 dark:text-brand-400 mb-1">Publication</label><span className="text-sm font-medium text-brand-900 dark:text-brand-100">{mediaPlanDetails.datePublication ? formatDate(mediaPlanDetails.datePublication) : '-'}</span></div>
                <div className="flex flex-col"><label className="text-[10px] font-bold uppercase text-brand-600/70 dark:text-brand-400 mb-1">Lien Drive</label>
                  {mediaPlanDetails.lienDrive ? <a href={mediaPlanDetails.lienDrive} target="_blank" rel="noreferrer" className="text-sm font-medium text-brand-600 dark:text-brand-400 hover:text-brand-700 underline transition-colors">Ouvrir Drive</a> : <span className="text-sm font-medium text-brand-900 dark:text-brand-100">-</span>}
                </div>
              </div>
              <div className="pt-5 border-t border-brand-200 dark:border-brand-800">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="flex flex-col">
                    <label className="text-[10px] font-bold uppercase text-brand-600/70 dark:text-brand-400 mb-1">Texte sur Visuel</label>
                    <span className="text-sm text-brand-900 dark:text-brand-100 leading-relaxed bg-white/50 dark:bg-gray-800/50 p-3 rounded-xl">{mediaPlanDetails.texteSurVisuel || '-'}</span>
                  </div>
                  <div className="flex flex-col">
                    <label className="text-[10px] font-bold uppercase text-brand-600/70 dark:text-brand-400 mb-1">Inspiration / Autres</label>
                    <div className="flex flex-wrap gap-2 text-sm text-brand-900 dark:text-brand-100 items-start bg-white/50 dark:bg-gray-800/50 p-3 rounded-xl h-full">
                      {mediaPlanDetails.inspiration ? (
                        mediaPlanDetails.inspiration.startsWith('http') || mediaPlanDetails.inspiration.startsWith('www') ?
                          <a href={mediaPlanDetails.inspiration.startsWith('http') ? mediaPlanDetails.inspiration : `https://${mediaPlanDetails.inspiration}`} target="_blank" rel="noreferrer">Inspiration (Lien)</a>
                          : <span>{mediaPlanDetails.inspiration}</span>
                      ) : '-'}
                      {mediaPlanDetails.autresElements && <span style={{ borderLeft: '1px solid #ffc299', paddingLeft: 8 }}>{mediaPlanDetails.autresElements}</span>}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-20">
            {/* Managers Panel */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden flex flex-col h-full">
              <h4 className="flex items-center gap-2 px-5 py-4 bg-gray-50/50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-700 text-sm font-bold text-gray-800 dark:text-gray-100 uppercase tracking-widest shrink-0">
                <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400"><HiOutlineUserGroup size={16} /></div>
                Department Managers
              </h4>
              <div className="flex-1 overflow-y-auto p-2">
                {getChefs(selectedProject).length === 0 ? (
                  <div className="h-full flex items-center justify-center p-6">
                    <p className="text-sm font-medium text-gray-400 text-center italic px-4 py-8 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-dashed border-gray-200 dark:border-gray-700 w-full">Aucun manager assigné</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {getChefs(selectedProject).map(m => (
                      <div key={m.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group">
                        <div className="relative w-10 h-10 rounded-full border border-gray-200 dark:border-gray-600 shrink-0">
                          {congeAujourdhuiIds.has(m.id) && <div className="absolute -top-1 -right-1 w-3 h-3 bg-amber-400 border-2 border-white dark:border-gray-800 rounded-full" title="En congé" />}
                          {m.imageUrl ? <img src={m.imageUrl} alt={m.nom} className="w-full h-full object-cover rounded-full" /> : <div className="w-full h-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-sm font-bold text-gray-600 dark:text-gray-300 rounded-full">{m.prenom?.[0]}{m.nom?.[0]}</div>}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-gray-900 dark:text-white truncate group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">{m.prenom} {m.nom}</p>
                          <p className="text-[11px] font-medium text-gray-500 uppercase tracking-widest mt-0.5">Manager</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Members Panel */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden flex flex-col h-full">
              <h4 className="flex items-center gap-2 px-5 py-4 bg-gray-50/50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-700 text-sm font-bold text-gray-800 dark:text-gray-100 uppercase tracking-widest shrink-0">
                <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"><HiOutlineUserGroup size={16} /></div>
                Membres du projet
              </h4>
              <div className="flex-1 overflow-y-auto p-2">
                {!(selectedProject.membres ?? []).length ? (
                  <div className="h-full flex items-center justify-center p-6">
                    <p className="text-sm font-medium text-gray-400 text-center italic px-4 py-8 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-dashed border-gray-200 dark:border-gray-700 w-full">Aucun membre assigné</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {(selectedProject.membres ?? []).map(m => (
                      <div key={m.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group">
                        <div className="w-10 h-10 rounded-full border border-gray-200 dark:border-gray-600 shrink-0">
                          {m.imageUrl ? <img src={m.imageUrl} alt={m.nom} className="w-full h-full object-cover rounded-full" /> : <div className="w-full h-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center text-sm font-bold text-brand-600 dark:text-brand-400 rounded-full">{m.prenom?.[0]}{m.nom?.[0]}</div>}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-gray-900 dark:text-white truncate group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">{m.prenom} {m.nom}</p>
                          <p className="text-[11px] font-medium text-gray-500 uppercase tracking-widest mt-0.5">{m.departement || 'Membre'}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
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
                  <HiOutlineBriefcase className="text-brand-500" size={16} />
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
                          {congeAujourdhuiIds.has(m.id) && <span className="text-[10px] text-warning-500 animate-pulse"><HiOutlineSun size={14} /></span>}
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
                  <DatePickerInput
                    value={row.dateDebut}
                    min={today}
                    onChange={v => updateRow(idx, { dateDebut: v })}
                    className={inputClass}
                    placeholder="Date début"
                  />
                  {row.typeProjet === 'DETERMINE' && (
                    <DatePickerInput
                      value={row.dateFin}
                      min={row.dateDebut || today}
                      onChange={v => updateRow(idx, { dateFin: v })}
                      className={inputClass}
                      placeholder="Date fin"
                    />
                  )}
                </div>
              </div>
            );
          })}

          {/* ── Add another project ── */}
          <button
            onClick={addRow}
            className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-orange-300 py-3 text-theme-sm font-medium text-orange-600 hover:bg-orange-50/40 dark:border-orange-500/30 dark:text-orange-400 dark:hover:bg-orange-500/5 transition-colors"
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
            <label className="mb-2 block text-theme-sm font-medium text-gray-700 dark:text-gray-300">Chefs des department</label>
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
              <DatePickerInput
                value={editForm.dateDebut}
                onChange={v => { setEditForm(f => ({ ...f, dateDebut: v })); setEditDateError(null); }}
                className={inputClass}
                placeholder="Date début"
              />
            </div>
            {editForm.typeProjet === 'DETERMINE' && (
              <div>
                <label className="mb-1.5 block text-theme-sm font-medium text-gray-700 dark:text-gray-300">Date fin</label>
                <DatePickerInput
                  value={editForm.dateFin}
                  min={editForm.dateDebut || today}
                  onChange={v => { setEditForm(f => ({ ...f, dateFin: v })); setEditDateError(null); }}
                  className={inputClass}
                  placeholder="Date fin"
                />
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
                      {sub.departement && <p className="text-theme-xs text-gray-400 flex items-center gap-1"><HiOutlineOfficeBuilding size={12} /> {sub.departement}</p>}
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
    </div>
  );
};

export default ProjetsPage;
