import React, { useState, useEffect as useEffectHook } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  HiOutlineChevronLeft, HiOutlineChevronRight,
  HiOutlineUser, HiOutlineUserGroup,
  HiOutlineCheck, HiOutlineX, HiOutlineTrash,
  HiOutlineLockClosed, HiOutlineBriefcase,
  HiOutlineShieldExclamation,
  HiOutlineClock, HiOutlineCalendar,
} from 'react-icons/hi';
import { useAuth } from '../context/AuthContext';
import { employeService } from '../api/employeService';
import { calendrierProjetService } from '../api/calendrierProjetService';
import { projetService } from '../api/projetService';
import { tacheService } from '../api/tacheService';
import { useEffect } from 'react';
import { StatutProjet, StatutTache, TypeContenuShooting, TypeContenuShootingLabels, MediaPlan } from '../types';
import { mediaPlanService } from '../api/mediaPlanService';
import DeadlinesCalendar from './DeadlinesCalendar';
import ReunionsCalendar from './ReunionsCalendar';

// ─── Types ────────────────────────────────────────────────────────────────────
interface BusySlot {
  id?: number;
  date: string;
  managerId: number;
  projectName: string;
  urgent?: boolean;
}
interface BookedSlot {
  id?: number;
  date: string;
  managerId: number;
  projectName: string;
  urgent?: boolean;
  statut?: string;
  // Shooting-linked slot details (optional)
  description?: string;
  localisation?: string;
  typeDeContenu?: string;
  mediaPlanLigneId?: number;
  titre?: string;
  clientId?: number;
  clientNom?: string;
}
interface ManagerDef {
  id: number;
  name: string;
  avatar: string;
  color: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTHS_FR = [
  'Janvier','Février','Mars','Avril','Mai','Juin',
  'Juillet','Août','Septembre','Octobre','Novembre','Décembre',
];
const DAYS_FR = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];

// ─── Helpers ─────────────────────────────────────────────────────────────────
function getDaysInMonth(y: number, m: number): Date[] {
  const days: Date[] = [];
  const d = new Date(y, m, 1);
  while (d.getMonth() === m) { days.push(new Date(d)); d.setDate(d.getDate() + 1); }
  return days;
}
function startDow(y: number, m: number): number {
  const d = new Date(y, m, 1).getDay();
  return d === 0 ? 6 : d - 1;
}
function fmt(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function todayFmt(): string { return fmt(new Date()); }

// ─── Permissions constants ────────────────────────────────────────────────────
const PERM_ACCESS  = 'VIEW_CALENDRIER_PROJETS';
const PERM_MANAGER = 'VIEW_CALENDRIER_PROJETS';
const PERM_SOCIAL  = 'VIEW_CALENDRIER_PROJETS';

// ─── Access Denied ────────────────────────────────────────────────────────────
const AccessDenied: React.FC = () => (
  <div className="min-h-[60vh] flex items-center justify-center p-6">
    <div className="bg-white rounded-2xl border border-red-100 shadow-sm p-10 text-center max-w-sm">
      <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
        <HiOutlineShieldExclamation size={28} className="text-red-500" />
      </div>
      <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Accès refusé</h2>
      <p className="text-sm text-gray-400 dark:text-gray-500 dark:text-gray-400">
        Vous n'avez pas les droits nécessaires pour accéder à cette page.
        Contactez votre administrateur.
      </p>
    </div>
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────
const CalendrierProjetsAdminPage: React.FC = () => {
  const { user } = useAuth();

  const permissions: string[] = (user as any)?.permissions || [];

  const hasAccess      = permissions.includes(PERM_ACCESS);
  const hasDeadlines   = permissions.includes('VIEW_DEADLINES');
  const hasReunions    = permissions.includes('VIEW_REUNIONS');
  const canManagerMode = permissions.includes('VALIDATE_SHOOTING');
  const canSocialMode  = permissions.includes('VIEW_CALENDRIER_PROJETS');
  const canSwitch      = canManagerMode && canSocialMode;

  // Determine which tabs are available
  const tabs: { key: string; label: string; icon: React.ReactNode }[] = [];
  if (hasAccess) tabs.push({ key: 'tournage', label: 'Tournage', icon: <HiOutlineBriefcase size={16}/> });
  if (hasDeadlines) tabs.push({ key: 'deadlines', label: 'Deadlines', icon: <HiOutlineClock size={16}/> });
  if (hasReunions) tabs.push({ key: 'reunions', label: 'Réunions', icon: <HiOutlineCalendar size={16}/> });

  // Read tab from URL query string (?tab=reunions)
  const [searchParams, setSearchParams] = useSearchParams();
  const urlTab = searchParams.get('tab');
  const defaultTab = (urlTab && tabs.some(t => t.key === urlTab)) ? urlTab : (tabs.length > 0 ? tabs[0].key : '');
  const [activeTab, setActiveTabState] = useState(defaultTab);

  const setActiveTab = (key: string) => {
    setActiveTabState(key);
    setSearchParams(key === tabs[0]?.key ? {} : { tab: key }, { replace: true });
  };

  // Sync if URL changes externally (e.g. notification click)
  useEffectHook(() => {
    if (urlTab && tabs.some(t => t.key === urlTab) && urlTab !== activeTab) {
      setActiveTabState(urlTab);
    }
  }, [urlTab]);

  if (tabs.length === 0) return <AccessDenied />;

  const defaultMode: 'manager' | 'social' = canManagerMode ? 'manager' : 'social';

  const roleBadge = canSwitch
    ? { label: 'Administrateur',         cls: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 border-blue-200' }
    : canManagerMode
      ? { label: 'Responsable tournage', cls: 'bg-violet-50 text-violet-700 border-violet-200' }
      : { label: 'Média plan', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' };

  return (
    <div>
      {/* ── Tab Content ── */}
      {activeTab === 'tournage' && hasAccess && (
        <CalendrierCore
          canManagerMode={canManagerMode}
          canSocialMode={canSocialMode}
          canSwitch={canSwitch}
          defaultMode={defaultMode}
          roleBadge={roleBadge}
        />
      )}
      {activeTab === 'deadlines' && hasDeadlines && <DeadlinesCalendar />}
      {activeTab === 'reunions' && hasReunions && <ReunionsCalendar />}
    </div>
  );
};

// ─── Core Calendar ────────────────────────────────────────────────────────────
interface CoreProps {
  canManagerMode: boolean;
  canSocialMode: boolean;
  canSwitch: boolean;
  defaultMode: 'manager' | 'social';
  roleBadge: { label: string; cls: string };
}

const CalendrierCore: React.FC<CoreProps> = ({
  canManagerMode, canSocialMode, canSwitch, defaultMode, roleBadge,
}) => {
  const [role, setRole]           = useState<'manager'|'social'>(defaultMode);
  const [managerId, setManagerId] = useState(1);
  const [calYear, setCalYear]     = useState(new Date().getFullYear());
  const [calMonth, setCalMonth]   = useState(new Date().getMonth());
  const [busySlots, setBusySlots] = useState<BusySlot[]>([]);
  const [bookedSlots, setBookedSlots] = useState<BookedSlot[]>([]);
  const [modalDate, setModalDate] = useState<string|null>(null);
  const [modalMode, setModalMode] = useState<'busy'|'book'>('busy');
  const [inputName, setInputName] = useState('');
  const [inputUrgent, setInputUrgent] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<string|null>(null);
  const [assignTarget, setAssignTarget] = useState<BusySlot | BookedSlot | null>(null);
  const [subordinates, setSubordinates] = useState<any[]>([]);
  const [assignForm, setAssignForm] = useState<{employeId: number | '', urgente: boolean}>({ employeId: '', urgente: false });
  const [validateTarget, setValidateTarget] = useState<BookedSlot | null>(null);
  const [toast, setToast] = useState<{msg:string;type:'success'|'error'}|null>(null);

  const [managers, setManagers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [shootingsADater, setShootingsADater] = useState<MediaPlan[]>([]);
  const [dateDrafts, setDateDrafts] = useState<Record<number, string>>({});
  const { user } = useAuth();

  const loadShootingsADater = () => {
    mediaPlanService.shootingsADater().then(res => setShootingsADater(res.data.data || [])).catch(() => setShootingsADater([]));
  };
  useEffect(() => { loadShootingsADater(); }, []);

  useEffect(() => {
    employeService.getByPermission('VALIDATE_SHOOTING', true)
      .then(res => {
        const uniqueManagers = res.data?.data || [];
        const mappers = uniqueManagers.map((m: any) => ({
          id: m.id,
          name: `${m.nom || ''} ${m.prenom || ''}`.trim(),
          avatar: `${m.nom?.[0] || ''}${m.prenom?.[0] || ''}`.toUpperCase() || '?',
          color: 'bg-violet-500'
        }));
        setManagers(mappers);
        if (mappers.length > 0) setManagerId(mappers[0].id);
      }).catch(() => setManagers([]));
  }, []);

  useEffect(() => {
    if (!managerId) return;
    const sDate = `${calYear}-${String(calMonth+1).padStart(2,'0')}-01`;
    const eD = new Date(calYear, calMonth+1, 0);
    const eDate = `${eD.getFullYear()}-${String(eD.getMonth()+1).padStart(2,'0')}-${String(eD.getDate()).padStart(2,'0')}`;
    
    setLoading(true);
    calendrierProjetService.getManagerSlotsBetween(managerId, sDate, eDate).then(res => {
      const busy = res.filter((r: any) => r.type === 'BUSY').map((r: any) => ({...r, date: r.dateSlot}));
      const booked = res.filter((r: any) => r.type === 'BOOKED').map((r: any) => ({...r, date: r.dateSlot}));
      setBusySlots(busy);
      setBookedSlots(booked);
      setLoading(false);
    });
  }, [managerId, calYear, calMonth]);

  useEffect(() => {
    if (managerId) {
      employeService.getSubordinates(managerId).then(res => {
        setSubordinates(res.data?.data || []);
      }).catch(e => console.error('Erreur lors du chargement des sous-employés', e));
    }
  }, [managerId]);

  const manager = managers.find((m: any) => m.id === managerId) || {id:0, name:'', avatar:'', color:''};
  const today      = todayFmt();
  const days       = getDaysInMonth(calYear, calMonth);
  const startBlank = startDow(calYear, calMonth);

  const prevMonth = () => calMonth === 0  ? (setCalMonth(11), setCalYear(y=>y-1)) : setCalMonth(m=>m-1);
  const nextMonth = () => calMonth === 11 ? (setCalMonth(0),  setCalYear(y=>y+1)) : setCalMonth(m=>m+1);

  const busyMap   = Object.fromEntries(busySlots.filter(s=>s.managerId===managerId).map(s=>[s.date,s]));
  const bookedMap = Object.fromEntries(bookedSlots.filter(s=>s.managerId===managerId).map(s=>[s.date,s]));
  const isAvailable = (key: string) => !busyMap[key];

  // ── Actions ──
  const handleManagerDayClick = (key: string) => {
    if (!canManagerMode) return;
    const booked = bookedMap[key];
    if (booked) {
      if (booked.statut === 'EN_ATTENTE') {
        setValidateTarget(booked);
      } else {
        setAssignForm({ employeId: '', urgente: !!booked.urgent });
        setAssignTarget(booked);
      }
      return;
    }
    const busy = busyMap[key];
    if (busy) {
      setAssignForm({ employeId: '', urgente: !!busy.urgent });
      setAssignTarget(busy);
      return; 
    }
    
    // Empty slot
    if (!booked) {
      setModalDate(key); setModalMode('busy'); setInputName(''); setInputUrgent(false);
    }
  };

  const handleSocialDayClick = (key: string) => {
    if (!canSocialMode) return;
    if (!isAvailable(key) || bookedMap[key]) return;
    setModalDate(key); setModalMode('book'); setInputName(''); setInputUrgent(false);
  };

  const confirmModal = async () => {
    if (!inputName.trim() || !modalDate) { showToast('Veuillez saisir un nom.','error'); return; }
    
    try {
      if (modalMode === 'busy') {
        const slot = await calendrierProjetService.createBusySlot({
          managerId,
          dateSlot: modalDate,
          projectName: inputName.trim(),
          urgent: inputUrgent,
          type: 'BUSY',
          statut: 'VALIDE'
        });
        setBusySlots(p=>[...p,{...slot, date: slot.dateSlot}]);
        showToast(`Jour ${modalDate} marqué occupé : "${inputName}"`, 'success');
      } else {
        const slot = await calendrierProjetService.createBookedSlot({
          managerId,
          socialManagerId: user?.employeId,
          dateSlot: modalDate,
          projectName: inputName.trim(),
          urgent: inputUrgent,
          type: 'BOOKED',
          statut: 'EN_ATTENTE'
        });
        setBookedSlots(p=>[...p,{...slot, date: slot.dateSlot}]);
        showToast(
          inputUrgent
            ? `Urgent "${inputName}" planifié ! (notif)`
            : `"${inputName}" planifié avec succès !`,
          'success'
        );
      }
      setModalDate(null); setInputUrgent(false);
    } catch(e) {
      showToast('Erreur lors de la planification', 'error');
    }
  };

  const handleValidate = async (accepter: boolean) => {
    if (!validateTarget || !validateTarget.id) return;
    try {
      if (accepter) {
        await calendrierProjetService.updateSlotStatus(validateTarget.id, 'VALIDE');
        setBookedSlots(p => p.map(s => s.id === validateTarget.id ? { ...s, statut: 'VALIDE' } : s));
        showToast('Projet validé !', 'success');
      } else {
        // Shooting slots should be rejected (tracked) instead of deleted.
        if (validateTarget.mediaPlanLigneId) {
          await calendrierProjetService.updateSlotStatus(validateTarget.id, 'REJETE');
        } else {
          await calendrierProjetService.deleteSlot(validateTarget.id);
        }
        setBookedSlots(p => p.filter(s => s.id !== validateTarget.id));
        showToast('Projet refusé', 'success');
      }
    } catch(e) {
      showToast('Erreur lors de la validation', 'error');
    }
    setValidateTarget(null);
  };

  const confirmRemove = async () => {
    if (!removeTarget) return;
    const targetBusy = busySlots.find(s=>s.date===removeTarget && s.managerId===managerId) as any;
    const targetBooked = bookedSlots.find(s=>s.date===removeTarget && s.managerId===managerId) as any;
    const targetSlot = targetBusy || targetBooked;
    
    try {
      if(targetSlot && targetSlot.id) {
        await calendrierProjetService.deleteSlot(targetSlot.id);
      }
      setBusySlots(p=>p.filter(s=>!(s.date===removeTarget && s.managerId===managerId)));
      setBookedSlots(p=>p.filter(s=>!(s.date===removeTarget && s.managerId===managerId)));
      setRemoveTarget(null);
      showToast('Créneau supprimé, jour à nouveau disponible.','success');
    } catch(e) {
      showToast('Erreur lors de la suppression', 'error');
    }
  };

  const showToast = (msg: string, type: 'success'|'error') => {
    setToast({msg,type}); setTimeout(()=>setToast(null), 3500);
  };

  const handleAssignSubmit = async () => {
    if (!assignTarget || !assignForm.employeId) {
      showToast('Veuillez sélectionner un employé', 'error');
      return;
    }
    try {
      // 1. Fetch projects to find if one with projectName exists
      const res = await projetService.getAll();
      const projects = res.data?.data || [];
      let mappedProjId = projects.find((p: any) => p.nom === assignTarget.projectName)?.id;

      // 2. Create if not exists
      if (!mappedProjId) {
        const createRes = await projetService.create({
          nom: assignTarget.projectName,
          statut: 'PLANIFIE' as StatutProjet,
          dateDebut: assignTarget.date,
          typeProjet: 'INDETERMINE',
          chefsDeProjetIds: [managerId]
        } as any);
        mappedProjId = createRes.data?.data?.id;
      }

      // 3. Create Task
      if (mappedProjId) {
        const resTask = await tacheService.create(mappedProjId, {
          titre: `Tâche: ${assignTarget.projectName}`,
          dateEcheance: assignTarget.date,
          statut: 'TODO' as StatutTache,
          urgente: assignForm.urgente
        });
        
        const newTache = resTask.data?.data;
        if (newTache?.id) {
          await tacheService.assign(newTache.id, assignForm.employeId as number);
        }
        
        showToast('Tâche affectée avec succès à l\'employé !', 'success');
        setAssignTarget(null);
      }
    } catch(e: any) {
      console.error(e);
      const errorMessage = e.response?.data?.error || e.response?.data?.message || 'Erreur lors de l\'affectation de la tâche';
      showToast(errorMessage, 'error');
    }
  };

  const monthPrefix = `${calYear}-${String(calMonth+1).padStart(2,'0')}`;
  const busyCount   = busySlots.filter(s=>s.managerId===managerId && s.date.startsWith(monthPrefix)).length;
  const availCount  = days.length - busyCount;
  const bookedCount = bookedSlots.filter(s=>s.managerId===managerId && s.date.startsWith(monthPrefix)).length;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-900 p-4 lg:p-6">
      <div className="max-w-6xl mx-auto space-y-5">
        {shootingsADater.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-4 space-y-3">
            <p className="text-sm font-semibold text-gray-800 dark:text-white">Shootings à dater</p>
            {shootingsADater.map(mp => (
              <div key={mp.id} className="flex flex-wrap items-center gap-3 text-sm">
                <span className="font-medium text-gray-800 dark:text-gray-100">{mp.titre}</span>
                <span className="text-gray-500">au plus tard le {mp.shootingAuPlusTard || '-'}</span>
                <input type="date" max={mp.shootingAuPlusTard || undefined} value={dateDrafts[mp.id] || ''} onChange={e => setDateDrafts(prev => ({ ...prev, [mp.id]: e.target.value }))} className="rounded border px-2 py-1 dark:bg-gray-900" />
                <button type="button" className="px-3 py-1 rounded bg-brand-500 text-white" onClick={async () => {
                  if (!dateDrafts[mp.id]) return;
                  try {
                    await mediaPlanService.placeShootingDate(mp.id, dateDrafts[mp.id]);
                    showToast('Date enregistrée', 'success');
                    loadShootingsADater();
                  } catch (e: any) {
                    showToast(e.response?.data?.message || 'Date refusée', 'error');
                  }
                }}>Poser la date</button>
              </div>
            ))}
          </div>
        )}

        {/* Legacy Header Removed */}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">

          {/* ── Sidebar ── */}
          <div className="lg:col-span-1 space-y-4">

            {/* Liste managers */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-4">
              <p className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Responsables tournage</p>
              <div className="space-y-2">
                {managers.map(m=>(
                  <button
                    key={m.id}
                    onClick={()=>setManagerId(m.id)}
                    className={`w-full flex items-center gap-3 p-2.5 rounded-xl border transition-all text-left
                      ${managerId===m.id ? 'border-blue-200 bg-blue-50 dark:bg-blue-900/20' : 'border-transparent hover:bg-gray-50'}`}
                  >
                    <div className={`w-9 h-9 rounded-full ${m.color} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
                      {m.avatar}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{m.name}</p>
                      <p className="text-[11px] text-gray-400 dark:text-gray-500 dark:text-gray-400">
                        {busySlots.filter(s=>s.managerId===m.id).length} occupé(s)
                      </p>
                    </div>
                    {managerId===m.id && <HiOutlineCheck size={14} className="text-blue-500 shrink-0"/>}
                  </button>
                ))}
              </div>
            </div>

            {/* Stats du mois */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-4">
              <p className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
                {MONTHS_FR[calMonth]}
              </p>
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500 dark:text-gray-400">Jours disponibles</span>
                  <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">{availCount}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500 dark:text-gray-400">Jours occupés</span>
                  <span className="text-xs font-bold text-orange-500 bg-orange-50 px-2 py-0.5 rounded-full">{busyCount}</span>
                </div>
                {(role==='social' || !canManagerMode) && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500 dark:text-gray-400">Projets planifiés</span>
                    <span className="text-xs font-bold text-blue-600 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded-full">{bookedCount}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Légende */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-4">
              <p className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Légende</p>
              <div className="space-y-2">
                {role==='manager' ? (
                  <>
                    <LegendRow color="bg-orange-100 border border-orange-300" label="Occupé (projet)"/>
                    <LegendRow color="bg-white border border-gray-200" label="Disponible"/>
                    <LegendRow color="bg-blue-500 dark:bg-blue-900/500" label="Aujourd'hui" round/>
                  </>
                ) : (
                  <>
                    <LegendRow color="bg-emerald-100 border border-emerald-300" label="Disponible"/>
                    <LegendRow color="bg-blue-100 border border-blue-300" label="Projet planifié"/>
                    <LegendRow color="bg-orange-100 border border-orange-300" label="Occupé (indispo)"/>
                  </>
                )}
              </div>
            </div>

            {/* Mes projets occupés (mode manager) */}
            {role==='manager' && busySlots.filter(s=>s.managerId===managerId).length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-4">
                <p className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Mes projets</p>
                <div className="space-y-2 max-h-52 overflow-y-auto">
                  {busySlots.filter(s=>s.managerId===managerId).map((s,i)=>(
                    <div key={i} className="flex items-start gap-2 p-2 bg-orange-50 rounded-lg border border-orange-100">
                      <HiOutlineBriefcase size={13} className="text-orange-400 mt-0.5 shrink-0"/>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-orange-800 truncate">{s.projectName}</p>
                        <p className="text-[10px] text-orange-400">{s.date}{s.urgent ? ' 🔴' : ''}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Projets planifiés (mode social) */}
            {role==='social' && bookedSlots.filter(s=>s.managerId===managerId).length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-4">
                <p className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Projets planifiés</p>
                <div className="space-y-2 max-h-52 overflow-y-auto">
                  {bookedSlots.filter(s=>s.managerId===managerId).map((s,i)=>(
                    <div key={i} className="flex items-start gap-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100">
                      <HiOutlineCheck size={13} className="text-blue-400 mt-0.5 shrink-0"/>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-blue-800 truncate">{s.projectName}</p>
                        <p className="text-[10px] text-blue-400">{s.date}{s.urgent ? ' 🔴' : ''}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── Calendrier ── */}
          <div className="lg:col-span-3 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">

            {/* Navigation */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700">
              <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 dark:text-gray-400 transition-colors">
                <HiOutlineChevronLeft size={18}/>
              </button>
              <div className="text-center">
                <p className="font-semibold text-gray-900 dark:text-white">{MONTHS_FR[calMonth]} {calYear}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 dark:text-gray-400 mt-0.5">
                  {role==='manager'
                    ? 'Cliquez sur un jour pour marquer vos projets / indisponibilités'
                    : `Sélectionnez une date disponible de ${manager.name}`}
                </p>
              </div>
              <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 dark:text-gray-400 transition-colors">
                <HiOutlineChevronRight size={18}/>
              </button>
            </div>

            {/* En-têtes jours */}
            <div className="grid grid-cols-7 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/60">
              {DAYS_FR.map(d=>(
                <div key={d} className="py-2.5 text-center text-[11px] font-semibold text-gray-400 dark:text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {d}
                </div>
              ))}
            </div>

            {/* Grille */}
            <div className="grid grid-cols-7">
              {Array.from({length:startBlank}).map((_,i)=>(
                <div key={`b${i}`} className="min-h-[85px] border-r border-b border-gray-50 bg-slate-50 dark:bg-gray-900/50"/>
              ))}

              {days.map(date=>{
                const key     = fmt(date);
                const isToday = key === today;
                const busy    = busyMap[key];
                const booked  = bookedMap[key];
                const avail   = isAvailable(key);

                // ── Vue Head Prod ──
                if (role==='manager') {
                  const isAttente = booked && booked.statut === 'EN_ATTENTE';
                  const isValide = booked && booked.statut === 'VALIDE';
                  const isClickable = canManagerMode && (!busy || busyMap[key]) && (!booked || isAttente);

                  return (
                    <div
                      key={key}
                      onClick={()=>handleManagerDayClick(key)}
                      className={`min-h-[85px] border-r border-b border-gray-100 dark:border-gray-700 p-2 transition-all duration-150 relative group
                        ${isClickable ? 'cursor-pointer' : 'cursor-default'}
                        ${isAttente ? 'bg-yellow-50 dark:bg-yellow-900/20 hover:bg-yellow-100 dark:hover:bg-yellow-900/40' :
                           isValide ? 'bg-blue-50 dark:bg-blue-900/20' :
                           busy ? 'bg-orange-50 dark:bg-orange-900/20 hover:bg-orange-100 dark:hover:bg-orange-900/40' : 'bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50'}`}
                    >
                      <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold
                        ${isToday ? 'bg-blue-500 dark:bg-blue-900/200 text-white' : 
                          isAttente ? 'text-yellow-600' :
                          isValide ? 'text-blue-600' :
                          busy ? 'text-orange-600' : 'text-gray-600'}`}>
                        {date.getDate()}
                      </span>
                      
                      {busy && (
                        <div className="mt-1.5 space-y-0.5">
                          <div className="bg-orange-100 dark:bg-orange-900/40 border-orange-200 dark:border-orange-800 rounded px-1.5 py-0.5">
                            <p className="text-[10px] font-semibold text-orange-700 truncate leading-tight">{busy.projectName}</p>
                          </div>
                          {busy.urgent && <p className="text-[9px] text-red-400 font-medium pl-0.5">🔴 Urgent</p>}
                        </div>
                      )}

                      {booked && (
                        <div className="mt-1.5 space-y-0.5">
                          <div className={`border rounded px-1.5 py-0.5 
                            ${isAttente ? 'bg-yellow-100 dark:bg-yellow-900/40 border-yellow-200 dark:border-yellow-800' : 'bg-blue-100 border-blue-200'}`}>
                            <p className={`text-[10px] font-semibold truncate leading-tight
                              ${isAttente ? 'text-yellow-700' : 'text-blue-700'}`}>
                              {booked.projectName} {isAttente ? '(En attente)' : '(Validé)'}
                            </p>
                          </div>
                          {booked.urgent && <p className="text-[9px] text-red-400 font-medium pl-0.5">🔴 Urgent</p>}
                        </div>
                      )}

                      {canManagerMode && (
                        <div className="absolute bottom-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                          <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full
                            ${isAttente ? 'bg-yellow-100 text-yellow-600' :
                              busy ? 'bg-red-100 text-red-500' : 'bg-blue-100 text-blue-500'}`}>
                            {isAttente ? 'Valider ?' : busy ? 'Supprimer' : '+ Projet'}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                }

                // ── Vue Social Media ──
                const canBook = avail && !booked && canSocialMode;
                return (
                  <div
                    key={key}
                    onClick={()=>canBook ? handleSocialDayClick(key) : undefined}
                    className={`min-h-[85px] border-r border-b border-gray-100 dark:border-gray-700 p-2 transition-all duration-150 relative group
                      ${booked  ? 'bg-blue-50 dark:bg-blue-900/20' :
                        busy    ? 'bg-orange-50 opacity-70' :
                        canBook ? 'bg-emerald-50 dark:bg-emerald-900/20 cursor-pointer hover:bg-emerald-100 dark:hover:bg-emerald-900/40' :
                                  'bg-white dark:bg-gray-800'}`}
                  >
                    <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold
                      ${isToday  ? 'bg-blue-50 dark:bg-blue-900/200 text-white'  :
                        booked   ? 'text-blue-600'           :
                        busy     ? 'text-orange-500'         :
                        avail    ? 'text-emerald-700'        : 'text-gray-400 dark:text-gray-500 dark:text-gray-400'}`}>
                      {date.getDate()}
                    </span>

                    {booked && (
                      <div className="mt-1.5 bg-blue-100 dark:bg-blue-900/40 border border-blue-200 dark:border-blue-800 rounded px-1.5 py-0.5">
                        <p className="text-[10px] font-semibold text-blue-700 truncate">{booked.projectName}</p>
                        {booked.urgent && <p className="text-[9px] text-red-400 font-medium">🔴 Urgent</p>}
                      </div>
                    )}
                    {busy && !booked && (
                      <div className="mt-1.5 flex items-center gap-1">
                        <HiOutlineLockClosed size={10} className="text-orange-400"/>
                        <span className="text-[10px] text-orange-500 font-medium">Occupé</span>
                      </div>
                    )}
                    {avail && !booked && !busy && (
                      <div className="mt-1.5 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block"/>
                        <span className="text-[10px] text-emerald-600 font-medium">Dispo</span>
                      </div>
                    )}
                    {canBook && (
                      <div className="absolute bottom-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                        <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-600">
                          + Planifier
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── Modale Ajout / Planification ── */}
      {modalDate && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-bold text-gray-900 dark:text-white">
                {modalMode==='busy' ? 'Marquer comme occupé' : 'Planifier un projet'}
              </h3>
              <button onClick={()=>setModalDate(null)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 dark:text-gray-500 dark:text-gray-400">
                <HiOutlineX size={17}/>
              </button>
            </div>

            <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3 mb-4">
              <div className={`w-9 h-9 rounded-full ${manager.color} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
                {manager.avatar}
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{manager.name}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 dark:text-gray-400">{modalDate}</p>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">
                {modalMode==='busy' ? 'Nom du projet / raison' : 'Nom du projet'}
              </label>
              <input
                autoFocus
                type="text"
                value={inputName}
                onChange={e=>setInputName(e.target.value)}
                onKeyDown={e=>e.key==='Enter' && confirmModal()}
                placeholder={modalMode==='busy' ? 'Ex: Audit interne Q2' : 'Ex: Campagne Social Media Q2'}
                className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-800 dark:text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition"
              />
            </div>

            <label className="flex items-center gap-2.5 mb-5 cursor-pointer select-none">
              <div
                onClick={()=>setInputUrgent(v=>!v)}
                className={`w-10 h-5 rounded-full transition-colors relative shrink-0 ${inputUrgent ? 'bg-red-400' : 'bg-gray-200'}`}
              >
                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${inputUrgent ? 'left-5' : 'left-0.5'}`}/>
              </div>
              <span className={`text-sm font-medium ${inputUrgent ? 'text-red-500' : 'text-gray-500 dark:text-gray-400'}`}>
                {modalMode==='busy' ? 'Priorité urgente' : 'Projet urgent (notif + mail)'}
              </span>
            </label>

            <div className="flex gap-2">
              <button
                onClick={()=>{ setModalDate(null); setInputUrgent(false); }}
                className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={confirmModal}
                className={`flex-1 px-4 py-2.5 rounded-xl text-white text-sm font-medium shadow-sm transition-colors
                  ${modalMode==='busy' ? 'bg-orange-500 hover:bg-orange-600' : 'bg-blue-600 hover:bg-blue-700'}`}
              >
                {modalMode==='busy' ? 'Marquer occupé' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modale Validation ── */}
      {validateTarget && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
            <h3 className="text-base font-bold text-gray-900 dark:text-white mb-1">Validation de planification</h3>
            <p className="text-sm text-gray-600 mb-6">
              {validateTarget.mediaPlanLigneId ? (
                <>Demande de shooting pour <strong>{validateTarget.clientNom || 'Client'}</strong> : <strong>{validateTarget.titre || validateTarget.projectName}</strong> le <strong>{validateTarget.date}</strong>.<br/></>
              ) : (
                <>Le Social Media Manager a planifié le projet <strong>{validateTarget.projectName}</strong> le <strong>{validateTarget.date}</strong>.<br/></>
              )}
              Souhaitez-vous le valider ?
            </p>

            {validateTarget.mediaPlanLigneId && (
              <div className="text-left bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-100 dark:border-gray-700 p-3 mb-5">
                <p className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Détails shooting</p>
                <div className="space-y-1 text-sm text-gray-700 dark:text-gray-200">
                  <div><span className="text-gray-400 dark:text-gray-500 dark:text-gray-400">Type :</span> {(() => {
                    const raw = validateTarget.typeDeContenu;
                    if (!raw) return '-';
                    const normalized = raw.toUpperCase();
                    if (normalized === 'PHOTO' || normalized === 'VIDEO' || normalized === 'BOTH') {
                      return TypeContenuShootingLabels[normalized as TypeContenuShooting];
                    }
                    return raw;
                  })()}</div>
                  <div><span className="text-gray-400 dark:text-gray-500 dark:text-gray-400">Localisation :</span> {validateTarget.localisation || '-'}</div>
                  <div className="whitespace-pre-wrap"><span className="text-gray-400 dark:text-gray-500 dark:text-gray-400">Description :</span> {validateTarget.description || '-'}</div>
                </div>
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={() => setValidateTarget(null)} className="flex-1 bg-black-100 text-gray-700 dark:text-gray-200 py-2.5 hover:bg-gray-700 py-2.5 rounded-xl font-medium shadow-sm shadow-blue-200">Annuler</button>
              <button onClick={() => handleValidate(false)} className="flex-1 bg-red-50 text-red-600 hover:bg-red-100 py-2.5 rounded-xl font-medium">Refuser</button>
              <button onClick={() => handleValidate(true)} className="flex-1 bg-blue-600 text-white hover:bg-blue-700 py-2.5 rounded-xl font-medium shadow-sm shadow-blue-200">Accepter</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modale Suppression ── */}
      {/* ── Remove Modal ── */}
      {removeTarget && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-xs p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-3">
              <HiOutlineTrash size={22} className="text-red-500"/>
            </div>
            <h3 className="text-base font-bold text-gray-900 dark:text-white mb-1">Supprimer ce créneau ?</h3>
            <p className="text-xs text-gray-400 dark:text-gray-500 dark:text-gray-400 mb-5">
              Le jour <strong>{removeTarget}</strong> redeviendra disponible.
            </p>
            <div className="flex gap-2">
              <button
                onClick={()=>setRemoveTarget(null)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Annuler
              </button>
              <button
                onClick={confirmRemove}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-500 text-white text-sm font-medium hover:bg-red-600"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Assign Task Modal ── */}
      {assignTarget && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-bold text-gray-900 dark:text-white">
                Action sur : {assignTarget.projectName}
              </h3>
              <button onClick={() => setAssignTarget(null)} className="text-gray-400 dark:text-gray-500 dark:text-gray-400 hover:text-gray-600">
                <HiOutlineX size={20} />
              </button>
            </div>

            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Le jour <strong>{assignTarget.date}</strong> est assigné à ce projet. Vous pouvez soit l'affecter comme tâche à vos collaborateurs, soit le retirer du calendrier.
            </p>

            <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-xl mb-6">
              <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-3">Affecter comme Tâche</h4>
              
              <div className="mb-3">
                <label className="block text-xs font-medium text-gray-600 mb-1">Employé subordonné</label>
                <select 
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  value={assignForm.employeId}
                  onChange={e => setAssignForm({...assignForm, employeId: e.target.value === '' ? '' : Number(e.target.value)})}
                >
                  <option value="">Sélectionner un employé...</option>
                  {subordinates.map(sub => (
                    <option key={sub.id} value={sub.id}>{sub.nom} {sub.prenom}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2 mb-4">
                <input 
                  type="checkbox" 
                  id="urgente_task" 
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300"
                  checked={assignForm.urgente} 
                  onChange={e => setAssignForm({...assignForm, urgente: e.target.checked})} 
                />
                <label htmlFor="urgente_task" className="text-sm font-medium text-red-600">
                  Marquer comme urgent
                </label>
              </div>

              <button
                onClick={handleAssignSubmit}
                className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Créer et Affecter la Tâche
              </button>
            </div>

            <div className="border-t border-gray-100 pt-4 flex justify-between items-center">
              <span className="text-xs text-gray-400 dark:text-gray-500 dark:text-gray-400">Ou libérer ce créneau</span>
              <button
                onClick={() => {
                  setRemoveTarget(assignTarget.date);
                  setAssignTarget(null);
                }}
                className="px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 text-sm font-medium rounded-lg transition-colors"
             >
               Supprimer le créneau
             </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast ── */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg text-sm font-medium
          ${toast.type==='success' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'}`}>
          {toast.type==='success' ? <HiOutlineCheck size={15}/> : <HiOutlineX size={15}/>}
          {toast.msg}
        </div>
      )}
    </div>
  );
};

// ─── Legend Row ───────────────────────────────────────────────────────────────
const LegendRow: React.FC<{color:string; label:string; round?:boolean}> = ({color,label,round}) => (
  <div className="flex items-center gap-2">
    <span className={`w-3 h-3 ${round?'rounded-full':'rounded-sm'} ${color} inline-block shrink-0`}/>
    <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
  </div>
);

export default CalendrierProjetsAdminPage;
