import React, { useState, useEffect } from 'react';
import {
  HiOutlineChevronLeft, HiOutlineChevronRight,
  HiOutlineX, HiOutlineClock, HiOutlineExclamation,
  HiOutlineCheckCircle, HiOutlineCollection,
} from 'react-icons/hi';
import { useAuth } from '../context/AuthContext';
import { projetService } from '../api/projetService';
import { tacheService } from '../api/tacheService';
import { Projet, Tache } from '../types';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const MONTHS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
const DAYS_FR = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];

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

function daysUntil(dateStr: string): number {
  const now = new Date(); now.setHours(0,0,0,0);
  const target = new Date(dateStr); target.setHours(0,0,0,0);
  return Math.ceil((target.getTime() - now.getTime()) / (1000*60*60*24));
}

const DeadlinesCalendar: React.FC = () => {
  const { user } = useAuth();
  const permissions: string[] = (user as any)?.permissions || [];
  const employeId = (user as any)?.employeId;

  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [projets, setProjets] = useState<Projet[]>([]);
  const [loading, setLoading] = useState(false);
  const [drillProjet, setDrillProjet] = useState<Projet | null>(null);
  const [drillTaches, setDrillTaches] = useState<Tache[]>([]);
  const [drillLoading, setDrillLoading] = useState(false);
  const [taches, setTaches] = useState<Tache[]>([]);

  // Determine user role level
  const isAdmin = permissions.includes('VIEW_TOUS_PROJETS') || permissions.includes('MANAGE_ALL_PROJETS');
  const isManager = Boolean(user?.managerDepartement && user?.departement);

  useEffect(() => {
    if (!employeId) return;
    setLoading(true);
    const fetchProjets = async () => {
      try {
        let res;
        if (isAdmin) {
          // Admin/DG → tous les projets
          res = await projetService.getAll();
        } else if (isManager && (user as any)?.departement) {
          // Manager département → projets du département
          res = await projetService.getByDepartement((user as any).departement);
        } else {
          // Employé simple → uniquement les projets auxquels il est affecté
          res = await projetService.getByEmploye(employeId);
        }
        setProjets(res.data?.data || []);
      } catch (e) {
        console.error('Erreur chargement projets', e);
      }
      setLoading(false);
    };
    fetchProjets();
  }, [isAdmin, isManager, employeId]);

  // Echeances des taches : chargees pour tous les projets visibles.
  // Un employe simple ne voit que les taches qui lui sont assignees.
  useEffect(() => {
    if (projets.length === 0) { setTaches([]); return; }
    let cancelled = false;
    Promise.all(projets.map(p => tacheService.getByProjet(p.id).then(r => (r.data?.data || []) as Tache[]).catch(() => [] as Tache[])))
      .then(lists => {
        if (cancelled) return;
        const all = lists.flat().filter(t => t.dateEcheance);
        setTaches(isAdmin || isManager ? all : all.filter(t => t.assigneeId === employeId));
      });
    return () => { cancelled = true; };
  }, [projets, isAdmin, isManager, employeId]);

  const projetById: Record<number, Projet> = {};
  projets.forEach(p => { projetById[p.id] = p; });

  // Build a map: date -> tasks with deadline on that date
  const tacheMap: Record<string, Tache[]> = {};
  taches.forEach(t => {
    if (!tacheMap[t.dateEcheance]) tacheMap[t.dateEcheance] = [];
    tacheMap[t.dateEcheance].push(t);
  });

  const tacheCls = (t: Tache) => {
    if (t.statut === 'DONE') return 'bg-emerald-100 dark:bg-emerald-900/40 border-emerald-200 text-emerald-700';
    const du = daysUntil(t.dateEcheance);
    if (du < 0) return 'bg-red-100 dark:bg-red-900/40 border-red-200 text-red-700';
    if (du <= 3) return 'bg-amber-100 dark:bg-amber-900/40 border-amber-200 text-amber-700';
    return 'bg-violet-100 dark:bg-violet-900/40 border-violet-200 text-violet-700';
  };

  // Build a map: date -> projects with deadline on that date
  const deadlineMap: Record<string, Projet[]> = {};
  projets.forEach(p => {
    if (p.dateFin && p.typeProjet !== 'INDETERMINE') {
      const key = p.dateFin;
      if (!deadlineMap[key]) deadlineMap[key] = [];
      deadlineMap[key].push(p);
    }
  });

  // Also build a map for tasks of INDETERMINE projects (loaded on demand)
  const today = fmt(new Date());
  const days = getDaysInMonth(calYear, calMonth);
  const startBlank = startDow(calYear, calMonth);

  const prevMonth = () => calMonth === 0 ? (setCalMonth(11), setCalYear(y=>y-1)) : setCalMonth(m=>m-1);
  const nextMonth = () => calMonth === 11 ? (setCalMonth(0), setCalYear(y=>y+1)) : setCalMonth(m=>m+1);

  const handleProjetClick = async (projet: Projet) => {
    setDrillProjet(projet);
    setDrillLoading(true);
    try {
      const res = await tacheService.getByProjet(projet.id);
      setDrillTaches(res.data?.data || []);
    } catch (e) {
      console.error('Erreur chargement tâches', e);
    }
    setDrillLoading(false);
  };

  // Count stats
  const monthPrefix = `${calYear}-${String(calMonth+1).padStart(2,'0')}`;
  const deadlinesThisMonth = Object.entries(deadlineMap)
    .filter(([d]) => d.startsWith(monthPrefix))
    .reduce((acc, [, ps]) => acc + ps.length, 0);
  const tachesThisMonth = taches.filter(t => t.dateEcheance.startsWith(monthPrefix));
  const overdueCount = projets.filter(p => p.dateFin && daysUntil(p.dateFin) < 0 && p.statut !== 'CLOTURE' && p.statut !== 'ANNULE').length
    + taches.filter(t => t.statut !== 'DONE' && daysUntil(t.dateEcheance) < 0).length;
  const indetermineCount = projets.filter(p => p.typeProjet === 'INDETERMINE').length;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-900 p-4 lg:p-6">
      <div className="max-w-6xl mx-auto space-y-5">

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
              <HiOutlineClock size={20} className="text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{deadlinesThisMonth + tachesThisMonth.length}</p>
              <p className="text-xs text-gray-400">Deadlines ce mois</p>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
              <HiOutlineExclamation size={20} className="text-red-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{overdueCount}</p>
              <p className="text-xs text-gray-400">En retard</p>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
              <HiOutlineCollection size={20} className="text-gray-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{indetermineCount}</p>
              <p className="text-xs text-gray-400">Sans deadline</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">

          {/* Sidebar: Légende + projets sans deadline */}
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-4">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Légende</p>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-sm bg-emerald-100 border border-emerald-300 inline-block shrink-0"/>
                  <span className="text-xs text-gray-500 dark:text-gray-400">À temps (&gt;7j)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-sm bg-amber-100 border border-amber-300 inline-block shrink-0"/>
                  <span className="text-xs text-gray-500 dark:text-gray-400">Proche (≤7j)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-sm bg-red-100 border border-red-300 inline-block shrink-0"/>
                  <span className="text-xs text-gray-500 dark:text-gray-400">En retard</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-sm bg-violet-100 border border-violet-300 inline-block shrink-0"/>
                  <span className="text-xs text-gray-500 dark:text-gray-400">Tâche (✓)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-blue-500 inline-block shrink-0"/>
                  <span className="text-xs text-gray-500 dark:text-gray-400">Aujourd'hui</span>
                </div>
              </div>
            </div>

            {/* Projets INDETERMINE */}
            {indetermineCount > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-4">
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Projets sans deadline</p>
                <div className="space-y-2 max-h-52 overflow-y-auto">
                  {projets.filter(p => p.typeProjet === 'INDETERMINE').map(p => (
                    <button
                      key={p.id}
                      onClick={() => handleProjetClick(p)}
                      className="w-full text-left flex items-start gap-2 p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-100 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                    >
                      <HiOutlineCollection size={13} className="text-gray-400 mt-0.5 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-gray-700 dark:text-gray-200 truncate">{p.nom}</p>
                        <p className="text-[10px] text-gray-400">Cliquer pour voir les tâches</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* All deadlines this month */}
            {deadlinesThisMonth > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-4">
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Deadlines du mois</p>
                <div className="space-y-2 max-h-52 overflow-y-auto">
                  {Object.entries(deadlineMap)
                    .filter(([d]) => d.startsWith(monthPrefix))
                    .sort(([a], [b]) => a.localeCompare(b))
                    .flatMap(([, ps]) => ps)
                    .map(p => {
                      const du = daysUntil(p.dateFin!);
                      const cls = du < 0 ? 'bg-red-50 border-red-100 text-red-700'
                        : du <= 7 ? 'bg-amber-50 border-amber-100 text-amber-700'
                        : 'bg-emerald-50 border-emerald-100 text-emerald-700';
                      return (
                        <button
                          key={p.id}
                          onClick={() => handleProjetClick(p)}
                          className={`w-full text-left flex items-start gap-2 p-2 rounded-lg border transition hover:opacity-80 ${cls}`}
                        >
                          <HiOutlineClock size={13} className="mt-0.5 shrink-0 opacity-60" />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium truncate">{p.nom}</p>
                            <p className="text-[10px] opacity-70">{p.dateFin} • {du < 0 ? `${Math.abs(du)}j retard` : `${du}j restants`}</p>
                          </div>
                        </button>
                      );
                    })}
                </div>
              </div>
            )}

            {/* Task deadlines this month */}
            {tachesThisMonth.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-4">
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Tâches du mois ({tachesThisMonth.length})</p>
                <div className="space-y-2 max-h-52 overflow-y-auto">
                  {[...tachesThisMonth].sort((a, b) => a.dateEcheance.localeCompare(b.dateEcheance)).map(t => {
                    const pr = projetById[t.projetId];
                    return (
                      <button
                        key={t.id}
                        onClick={() => pr && handleProjetClick(pr)}
                        className={`w-full text-left flex items-start gap-2 p-2 rounded-lg border transition hover:opacity-80 ${tacheCls(t)}`}
                      >
                        <HiOutlineCheckCircle size={13} className="mt-0.5 shrink-0 opacity-60" />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium truncate">{t.titre}</p>
                          <p className="text-[10px] opacity-70 truncate">{t.dateEcheance}{pr ? ` • ${pr.nom}` : ''}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Calendar */}
          <div className="lg:col-span-3 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">

            {/* Navigation */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700">
              <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 transition-colors">
                <HiOutlineChevronLeft size={18}/>
              </button>
              <div className="text-center">
                <p className="font-semibold text-gray-900 dark:text-white">{MONTHS_FR[calMonth]} {calYear}</p>
                <p className="text-xs text-gray-400 mt-0.5">Cliquez sur un projet ou une tâche pour voir les tâches du projet</p>
              </div>
              <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 transition-colors">
                <HiOutlineChevronRight size={18}/>
              </button>
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-7 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/60">
              {DAYS_FR.map(d => (
                <div key={d} className="py-2.5 text-center text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{d}</div>
              ))}
            </div>

            {/* Grid */}
            {loading ? (
              <div className="flex items-center justify-center py-20 text-gray-400">Chargement...</div>
            ) : (
              <div className="grid grid-cols-7">
                {Array.from({ length: startBlank }).map((_, i) => (
                  <div key={`b${i}`} className="min-h-[90px] border-r border-b border-gray-50 dark:border-gray-700 bg-slate-50 dark:bg-gray-900/50" />
                ))}

                {days.map(date => {
                  const key = fmt(date);
                  const isToday = key === today;
                  const deadlines = deadlineMap[key] || [];
                  const dayTaches = tacheMap[key] || [];

                  return (
                    <div
                      key={key}
                      className={`min-h-[90px] border-r border-b border-gray-100 dark:border-gray-700 p-1.5 transition-all relative
                        ${deadlines.length + dayTaches.length > 0 ? 'bg-blue-50/30 dark:bg-blue-900/10' : 'bg-white dark:bg-gray-800'}`}
                    >
                      <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-semibold
                        ${isToday ? 'bg-blue-500 text-white' : 'text-gray-600 dark:text-gray-400'}`}>
                        {date.getDate()}
                      </span>

                      <div className="mt-0.5 space-y-0.5 overflow-hidden">
                        {deadlines.slice(0, 3).map(p => {
                          const du = daysUntil(p.dateFin!);
                          const cls = du < 0
                            ? 'bg-red-100 dark:bg-red-900/40 border-red-200 text-red-700'
                            : du <= 7
                              ? 'bg-amber-100 dark:bg-amber-900/40 border-amber-200 text-amber-700'
                              : 'bg-emerald-100 dark:bg-emerald-900/40 border-emerald-200 text-emerald-700';
                          return (
                            <button
                              key={p.id}
                              onClick={() => handleProjetClick(p)}
                              className={`w-full text-left rounded px-1 py-0.5 border ${cls} hover:opacity-80 transition cursor-pointer`}
                            >
                              <p className="text-[9px] font-semibold truncate leading-tight">{p.nom}</p>
                            </button>
                          );
                        })}
                        {deadlines.length > 3 && (
                          <p className="text-[9px] text-gray-400 pl-1">+{deadlines.length - 3} autre(s)</p>
                        )}
                        {dayTaches.slice(0, Math.max(0, 4 - Math.min(deadlines.length, 3))).map(t => (
                          <button
                            key={`t${t.id}`}
                            onClick={() => projetById[t.projetId] && handleProjetClick(projetById[t.projetId])}
                            title={`${t.titre}${projetById[t.projetId] ? ' — ' + projetById[t.projetId].nom : ''}`}
                            className={`w-full text-left rounded px-1 py-0.5 border ${tacheCls(t)} hover:opacity-80 transition cursor-pointer`}
                          >
                            <p className="text-[9px] font-semibold truncate leading-tight">✓ {t.titre}</p>
                          </button>
                        ))}
                        {dayTaches.length > Math.max(0, 4 - Math.min(deadlines.length, 3)) && (
                          <p className="text-[9px] text-gray-400 pl-1">+{dayTaches.length - Math.max(0, 4 - Math.min(deadlines.length, 3))} tâche(s)</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Drill-down Modal */}
      {drillProjet && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white">{drillProjet.nom}</h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  {drillProjet.typeProjet === 'INDETERMINE' ? 'Deadline indéterminée' : `Deadline: ${drillProjet.dateFin}`}
                  {' • '}{drillProjet.statut}
                </p>
              </div>
              <button onClick={() => setDrillProjet(null)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400">
                <HiOutlineX size={17} />
              </button>
            </div>

            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Tâches ({drillTaches.length})
            </p>

            {drillLoading ? (
              <div className="text-center py-8 text-gray-400 text-sm">Chargement...</div>
            ) : drillTaches.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-sm">Aucune tâche pour ce projet</div>
            ) : (
              <div className="space-y-2">
                {drillTaches.map(t => {
                  const du = t.dateEcheance ? daysUntil(t.dateEcheance) : null;
                  const statusCls = t.statut === 'DONE'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                    : du !== null && du < 0
                      ? 'bg-red-50 border-red-200 text-red-700'
                      : du !== null && du <= 3
                        ? 'bg-amber-50 border-amber-200 text-amber-700'
                        : 'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200';
                  return (
                    <div key={t.id} className={`p-3 rounded-xl border ${statusCls}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{t.titre}</p>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-[10px] opacity-70">
                              {t.dateEcheance || 'Pas de deadline'}
                            </span>
                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full
                              ${t.statut === 'DONE' ? 'bg-emerald-100 text-emerald-600' :
                                t.statut === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-600' :
                                'bg-gray-100 text-gray-500'}`}>
                              {t.statut === 'DONE' ? 'Terminée' : t.statut === 'IN_PROGRESS' ? 'En cours' : 'À faire'}
                            </span>
                            {t.urgente && <span className="text-[10px]">🔴 Urgent</span>}
                          </div>
                        </div>
                        {t.statut === 'DONE' && <HiOutlineCheckCircle size={18} className="text-emerald-500 shrink-0" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default DeadlinesCalendar;
