import React, { useState, useEffect, useMemo } from 'react';
import {
  HiOutlineSearch, HiOutlineEye, HiOutlineXCircle, HiOutlineCheck, HiOutlineX,
  HiOutlineChartBar, HiOutlineCalendar, HiOutlineClock,
  HiOutlineCheckCircle, HiOutlineChevronDown, HiOutlineChevronUp,
} from 'react-icons/hi';
import { demandeService } from '../api/demandeService';
import { DemandeResponse, StatutDemande, StatutDemandeLabels, HistoriqueStatut } from '../types';
import Badge from '../components/ui/Badge';
import DataTable from '../components/ui/DataTable';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';
import { useAuth } from '../context/AuthContext';

const statutBadgeMap: Record<string, 'primary' | 'success' | 'danger' | 'warning' | 'secondary' | 'neutral'> = {
  EN_ATTENTE: 'warning',
  APPROUVEE: 'success',
  REFUSEE: 'danger',
  ANNULEE: 'neutral',
};

const typeBadgeMap: Record<string, 'primary' | 'secondary' | 'success' | 'warning'> = {
  CONGE: 'primary',
  AUTORISATION: 'secondary',
  TELETRAVAIL: 'success',
  ADMINISTRATION: 'warning',
};

// ─── Statistics Component ──────────────────────────────────
const StatsCards: React.FC<{ demandes: DemandeResponse[] }> = ({ demandes }) => {
  const stats = useMemo(() => {
    const total = demandes.length;
    const enAttente = demandes.filter((d) => d.statut === 'EN_ATTENTE').length;
    const approuvees = demandes.filter((d) => d.statut === 'APPROUVEE').length;
    const refusees = demandes.filter((d) => d.statut === 'REFUSEE').length;
    const tauxApprobation = total > 0 ? Math.round((approuvees / (approuvees + refusees || 1)) * 100) : 0;
    return { total, enAttente, approuvees, refusees, tauxApprobation };
  }, [demandes]);

  const cards = [
    { label: 'En attente', value: stats.enAttente, icon: HiOutlineClock, color: 'text-warning-500', bg: 'bg-warning-50 dark:bg-warning-500/10' },
    { label: 'Approuvées', value: stats.approuvees, icon: HiOutlineCheckCircle, color: 'text-success-500', bg: 'bg-success-50 dark:bg-success-500/10' },
    { label: 'Refusées', value: stats.refusees, icon: HiOutlineX, color: 'text-error-500', bg: 'bg-error-50 dark:bg-error-500/10' },
    { label: "Taux d'approbation", value: `${stats.tauxApprobation}%`, icon: HiOutlineChartBar, color: 'text-brand-500', bg: 'bg-brand-50 dark:bg-brand-500/10' },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((c) => (
        <div key={c.label} className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-dark">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg ${c.bg} flex items-center justify-center`}>
              <c.icon className={c.color} size={20} />
            </div>
            <div>
              <p className="text-title-sm font-bold text-gray-800 dark:text-white">{c.value}</p>
              <p className="text-theme-xs text-gray-500 dark:text-gray-400">{c.label}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

// ─── Team Calendar Component ──────────────────────────────
const TeamCalendar: React.FC<{ demandes: DemandeResponse[] }> = ({ demandes }) => {
  const today = new Date();
  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const approvedLeaves = useMemo(() => {
    return demandes.filter((d) => d.statut === 'APPROUVEE' && d.type === 'CONGE' && d.dateDebut && d.dateFin);
  }, [demandes]);

  const firstDay = new Date(year, month, 1);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();

  const days: (number | null)[] = [];
  for (let i = 0; i < startOffset; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(d);

  const getEmployeesOnDate = (dateStr: string) => {
    return approvedLeaves.filter((d) => d.dateDebut! <= dateStr && d.dateFin! >= dateStr);
  };

  const monthName = viewDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1));

  const employeeColors: Record<string, string> = {};
  const colorPalette = [
    'bg-brand-200 dark:bg-brand-500/30',
    'bg-success-200 dark:bg-success-500/30',
    'bg-warning-200 dark:bg-warning-500/30',
    'bg-error-200 dark:bg-error-500/30',
    'bg-secondary-200 dark:bg-secondary-500/30',
  ];
  approvedLeaves.forEach((d) => {
    if (!employeeColors[d.employeNom]) {
      employeeColors[d.employeNom] = colorPalette[Object.keys(employeeColors).length % colorPalette.length];
    }
  });

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-dark">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-theme-sm font-semibold text-gray-800 dark:text-white flex items-center gap-2">
          <HiOutlineCalendar size={18} /> Calendrier équipe
        </h3>
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500">
            <HiOutlineChevronDown size={16} className="rotate-90" />
          </button>
          <span className="text-theme-sm font-medium text-gray-700 dark:text-gray-300 capitalize min-w-[140px] text-center">{monthName}</span>
          <button onClick={nextMonth} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500">
            <HiOutlineChevronUp size={16} className="rotate-90" />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-center">
        {['Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa', 'Di'].map((d) => (
          <div key={d} className="text-theme-xs font-medium text-gray-400 dark:text-gray-500 py-1">{d}</div>
        ))}
        {days.map((day, i) => {
          if (day === null) return <div key={`empty-${i}`} />;
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const onLeave = getEmployeesOnDate(dateStr);
          const isToday = dateStr === today.toISOString().slice(0, 10);

          return (
            <div
              key={dateStr}
              className={`min-h-[36px] rounded-md text-theme-xs p-0.5 relative ${isToday ? 'ring-2 ring-brand-400' : ''}`}
              title={onLeave.map((d) => d.employeNom).join(', ')}
            >
              <span className="text-gray-600 dark:text-gray-400">{day}</span>
              {onLeave.length > 0 && (
                <div className="flex flex-wrap gap-0.5 mt-0.5 justify-center">
                  {onLeave.slice(0, 2).map((d) => (
                    <div
                      key={d.id}
                      className={`w-2 h-2 rounded-full ${employeeColors[d.employeNom] || 'bg-brand-200'}`}
                      title={d.employeNom}
                    />
                  ))}
                  {onLeave.length > 2 && (
                    <span className="text-[9px] text-gray-400">+{onLeave.length - 2}</span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {Object.keys(employeeColors).length > 0 && (
        <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
          {Object.entries(employeeColors).map(([nom, color]) => (
            <div key={nom} className="flex items-center gap-1.5 text-theme-xs text-gray-500 dark:text-gray-400">
              <div className={`w-3 h-3 rounded-full ${color}`} />
              {nom}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Historique Timeline Component ──────────────────────────
const HistoriqueTimeline: React.FC<{ demandeId: number }> = ({ demandeId }) => {
  const [historique, setHistorique] = useState<HistoriqueStatut[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await demandeService.getHistorique(demandeId);
        setHistorique(res.data.data || []);
      } catch (err) {
        console.error('Erreur chargement historique:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [demandeId]);

  if (loading) return <p className="text-theme-xs text-gray-400 py-2">Chargement...</p>;
  if (historique.length === 0) return <p className="text-theme-xs text-gray-400 py-2">Aucun historique</p>;

  const statutIcon = (statut: string) => {
    switch (statut) {
      case 'APPROUVEE': return <HiOutlineCheckCircle className="text-success-500" size={16} />;
      case 'REFUSEE': return <HiOutlineX className="text-error-500" size={16} />;
      case 'ANNULEE': return <HiOutlineXCircle className="text-gray-400" size={16} />;
      default: return <HiOutlineClock className="text-warning-500" size={16} />;
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-theme-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Historique</p>
      <div className="relative pl-6 space-y-4">
        <div className="absolute left-2 top-1 bottom-1 w-0.5 bg-gray-200 dark:bg-gray-700" />
        {historique.map((h) => (
          <div key={h.id} className="relative">
            <div className="absolute -left-6 top-0.5 w-5 h-5 flex items-center justify-center bg-white dark:bg-gray-dark rounded-full">
              {statutIcon(h.nouveauStatut)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <Badge
                  text={StatutDemandeLabels[h.nouveauStatut as StatutDemande] || h.nouveauStatut}
                  variant={statutBadgeMap[h.nouveauStatut] || 'neutral'}
                />
                <span className="text-theme-xs text-gray-400">
                  {new Date(h.dateChangement).toLocaleDateString('fr-FR', {
                    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
                  })}
                </span>
              </div>
              {h.modifieParNom && (
                <p className="text-theme-xs text-gray-500 dark:text-gray-400 mt-0.5">par {h.modifieParNom}</p>
              )}
              {h.commentaire && (
                <p className="text-theme-xs text-gray-600 dark:text-gray-300 mt-1 italic">&laquo; {h.commentaire} &raquo;</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Main Page ──────────────────────────────────────────────
const DemandesPage: React.FC = () => {
  const { user } = useAuth();
  const [demandes, setDemandes] = useState<DemandeResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatut, setFilterStatut] = useState<string>('');
  const [selectedDemande, setSelectedDemande] = useState<DemandeResponse | null>(null);
  const [refuseModalOpen, setRefuseModalOpen] = useState(false);
  const [refuseTarget, setRefuseTarget] = useState<DemandeResponse | null>(null);
  const [refuseComment, setRefuseComment] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [showStats, setShowStats] = useState(true);
  const [showCalendar, setShowCalendar] = useState(false);

  // Batch selection
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [batchRefuseOpen, setBatchRefuseOpen] = useState(false);
  const [batchRefuseComment, setBatchRefuseComment] = useState('');

  const canViewDemandes = user?.permissions?.includes('VIEW_DEMANDES');

  useEffect(() => {
    loadDemandes();
  }, []);

  const loadDemandes = async () => {
    try {
      let response;
      if (canViewDemandes) {
        response = await demandeService.getAll();
      } else if (user) {
        response = await demandeService.getByEmploye(user.employeId);
      }
      setDemandes(response?.data?.data || []);
    } catch (err) {
      console.error('Erreur chargement demandes:', err);
    } finally {
      setLoading(false);
    }
  };

  /** Le chef du département décide d'abord ; la demande n'arrive au RH qu'après son accord. */
  const renderChefWaiting = (item: DemandeResponse) => {
    if (!item.chefValidateurNom || !item.decisionChef) return null;
    if (item.decisionChef === 'REFUSEE') {
      return <span className="text-theme-xs text-error-500">Refusée par le chef : {item.chefValidateurNom}</span>;
    }
    if (item.statut !== 'EN_ATTENTE') return null;
    if (item.decisionChef === 'APPROUVEE') {
      return <span className="text-theme-xs text-success-600 dark:text-success-400">Validée par le chef ({item.chefValidateurNom}) · à valider par le RH</span>;
    }
    if (item.chefEnConge) {
      return <span className="text-theme-xs text-warning-600 dark:text-warning-400">Chef en congé ({item.chefValidateurNom}) · à valider par le RH</span>;
    }
    return <span className="text-theme-xs text-gray-500 dark:text-gray-400">En attente du chef : {item.chefValidateurNom}</span>;
  };

  /** Tant que le chef n'a pas décidé, seul lui peut approuver ou refuser (sauf s'il est en congé : le RH tranche). */
  const canDecide = (item: DemandeResponse) =>
    item.statut === 'EN_ATTENTE'
    && (item.decisionChef !== 'EN_ATTENTE' || !!item.chefEnConge || item.chefValidateurId === user?.employeId);

  const handleApprove = async (id: number) => {
    if (!user) return;
    setActionLoading(true);
    try {
      await demandeService.approve(id, user.employeId);
      loadDemandes();
      setSelectedDemande(null);
    } catch (err: any) {
      alert(err.response?.data?.message || "Erreur lors de l'approbation");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRefuse = async () => {
    if (!user || !refuseTarget) return;
    setActionLoading(true);
    try {
      await demandeService.refuse(refuseTarget.id, user.employeId, refuseComment || undefined);
      setRefuseModalOpen(false);
      setRefuseTarget(null);
      setRefuseComment('');
      loadDemandes();
      setSelectedDemande(null);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Erreur lors du refus');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async (id: number) => {
    try {
      await demandeService.cancel(id);
      loadDemandes();
    } catch (err: any) {
      alert(err.response?.data?.message || "Erreur lors de l'annulation");
    }
  };

  const openRefuseModal = (demande: DemandeResponse) => {
    setRefuseTarget(demande);
    setRefuseComment('');
    setRefuseModalOpen(true);
  };

  // ─── Batch Actions ──────
  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    const pendingIds = filtered.filter(canDecide).map((d) => d.id);
    setSelectedIds(new Set(pendingIds));
  };

  const deselectAll = () => setSelectedIds(new Set());

  const handleBatchApprove = async () => {
    if (!user || selectedIds.size === 0) return;
    setActionLoading(true);
    try {
      await demandeService.batchApprove(Array.from(selectedIds), user.employeId);
      setSelectedIds(new Set());
      loadDemandes();
    } catch (err: any) {
      alert(err.response?.data?.message || "Erreur lors de l'approbation en lot");
    } finally {
      setActionLoading(false);
    }
  };

  const handleBatchRefuse = async () => {
    if (!user || selectedIds.size === 0) return;
    setActionLoading(true);
    try {
      await demandeService.batchRefuse(Array.from(selectedIds), user.employeId, batchRefuseComment || undefined);
      setSelectedIds(new Set());
      setBatchRefuseOpen(false);
      setBatchRefuseComment('');
      loadDemandes();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Erreur lors du refus en lot');
    } finally {
      setActionLoading(false);
    }
  };

  const filtered = demandes.filter((d) => {
    const matchSearch =
      d.employeNom?.toLowerCase().includes(search.toLowerCase()) ||
      d.type.toLowerCase().includes(search.toLowerCase()) ||
      d.raison?.toLowerCase().includes(search.toLowerCase()) ||
      d.typeCongeLabel?.toLowerCase().includes(search.toLowerCase());
    const matchStatut = filterStatut ? d.statut === filterStatut : true;
    return matchSearch && matchStatut;
  });

  const pendingCount = demandes.filter((d) => d.statut === 'EN_ATTENTE').length;

  const formatDates = (d: DemandeResponse) => {
    if (d.dateDebut && d.dateFin) return `${d.dateDebut} → ${d.dateFin}`;
    if (d.date) {
      const time = d.heureDebut && d.heureFin ? ` (${d.heureDebut} - ${d.heureFin})` : '';
      return `${d.date}${time}`;
    }
    return '-';
  };

  const columns = [
    // Checkbox column for admin batch selection
    ...(canViewDemandes
      ? [
          {
            key: 'select',
            label: (
              <input
                type="checkbox"
                checked={selectedIds.size > 0 && filtered.filter(canDecide).every((d) => selectedIds.has(d.id))}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => (e.target.checked ? selectAll() : deselectAll())}
                className="rounded border-gray-300 text-brand-500 focus:ring-brand-500"
              />
            ) as any,
            render: (item: DemandeResponse) =>
              canDecide(item) ? (
                <input
                  type="checkbox"
                  checked={selectedIds.has(item.id)}
                  onChange={() => toggleSelect(item.id)}
                  className="rounded border-gray-300 text-brand-500 focus:ring-brand-500"
                />
              ) : null,
          },
        ]
      : []),
    { key: 'id', label: '#' },
    {
      key: 'type',
      label: 'Type',
      render: (item: DemandeResponse) => (
        <div>
          <div className="flex items-center gap-1.5">
            <Badge text={item.type} variant={typeBadgeMap[item.type] || 'neutral'} />
            {item.justificatifPath && (
              <svg className="h-4 w-4 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <title>Justificatif joint</title>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
            )}
          </div>
          {item.typeCongeLabel && (
            <span className="block text-theme-xs text-gray-500 mt-0.5">{item.typeCongeLabel}</span>
          )}
        </div>
      ),
    },
    { key: 'employeNom', label: 'Employé' },
    {
      key: 'dates',
      label: 'Période',
      render: (d: DemandeResponse) => (
        <div className="text-theme-xs text-gray-600 dark:text-gray-400">
          <span>{formatDates(d)}</span>
          {d.nombreJours && <span className="block text-gray-500">{d.nombreJours} jour(s)</span>}
          {d.dureeMinutes != null && (
            <span className="block text-gray-500">
              {Math.floor(d.dureeMinutes / 60)}h{String(d.dureeMinutes % 60).padStart(2, '0')}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'statut',
      label: 'Statut',
      render: (item: DemandeResponse) => (
        <div className="flex flex-col items-start gap-1">
          <Badge text={StatutDemandeLabels[item.statut] || item.statut} variant={statutBadgeMap[item.statut] || 'neutral'} />
          {renderChefWaiting(item)}
        </div>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (item: DemandeResponse) => (
        <div className="flex gap-1">
          <button
            onClick={() => setSelectedDemande(item)}
            className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
            title="Voir détails"
          >
            <HiOutlineEye size={16} />
          </button>
          {canViewDemandes && canDecide(item) && (
            <>
              <button
                onClick={() => handleApprove(item.id)}
                className="rounded-lg p-1.5 text-success-500 hover:bg-success-50 dark:hover:bg-success-500/10"
                title="Approuver"
              >
                <HiOutlineCheck size={16} />
              </button>
              <button
                onClick={() => openRefuseModal(item)}
                className="rounded-lg p-1.5 text-error-500 hover:bg-error-50 dark:hover:bg-error-500/10"
                title="Refuser"
              >
                <HiOutlineX size={16} />
              </button>
            </>
          )}
          {!canViewDemandes && item.statut === 'EN_ATTENTE' && item.employeId === user?.employeId && (
            <button
              onClick={() => handleCancel(item.id)}
              className="rounded-lg p-1.5 text-error-500 hover:bg-error-50 dark:hover:bg-error-500/10"
              title="Annuler"
            >
              <HiOutlineXCircle size={16} />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-title-sm font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-gray-900 to-[#683b77] dark:from-white dark:to-[#ab78c3]">
            {canViewDemandes ? 'Gestion des demandes' : 'Mes demandes'}
            {canViewDemandes && pendingCount > 0 && (
              <span className="ml-2 inline-flex items-center justify-center w-6 h-6 rounded-full bg-warning-500 text-white text-theme-xs font-semibold">
                {pendingCount}
              </span>
            )}
          </h1>
          <p className="text-theme-sm text-gray-500 dark:text-gray-400 mt-1">
            {canViewDemandes
              ? 'Approuver ou refuser les demandes de congé, autorisation et télétravail'
              : 'Suivre vos demandes de congé, autorisation et télétravail'}
          </p>
        </div>
        {canViewDemandes && (
          <div className="flex gap-2">
            <Button variant={showStats ? 'primary' : 'outline'} onClick={() => setShowStats(!showStats)}>
              <HiOutlineChartBar size={16} /> Stats
            </Button>
            <Button variant={showCalendar ? 'primary' : 'outline'} onClick={() => setShowCalendar(!showCalendar)}>
              <HiOutlineCalendar size={16} /> Équipe
            </Button>
          </div>
        )}
      </div>

      {/* Statistics */}
      {canViewDemandes && showStats && <StatsCards demandes={demandes} />}

      {/* Team Calendar */}
      {canViewDemandes && showCalendar && <TeamCalendar demandes={demandes} />}

      {/* Batch Actions Bar */}
      {canViewDemandes && selectedIds.size > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-brand-200 bg-brand-50 p-3 dark:border-brand-500/30 dark:bg-brand-500/10">
          <span className="text-theme-sm font-medium text-brand-700 dark:text-brand-300">
            {selectedIds.size} demande(s) sélectionnée(s)
          </span>
          <div className="ml-auto flex gap-2">
            <Button onClick={handleBatchApprove} disabled={actionLoading}>
              <HiOutlineCheck size={16} /> Approuver tout
            </Button>
            <Button variant="outline" onClick={() => { setBatchRefuseComment(''); setBatchRefuseOpen(true); }} disabled={actionLoading}>
              <HiOutlineX size={16} /> Refuser tout
            </Button>
            <Button variant="ghost" onClick={deselectAll}>
              Désélectionner
            </Button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <HiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher..."
            className="h-11 w-full rounded-lg border border-gray-300 bg-transparent pl-10 pr-4 text-theme-sm text-gray-700 focus:border-brand-300 focus:outline-none focus:ring focus:ring-brand-500/10 dark:border-gray-600 dark:text-gray-300"
          />
        </div>
        <select
          value={filterStatut}
          onChange={(e) => setFilterStatut(e.target.value)}
          className="h-11 rounded-lg border border-gray-300 bg-transparent px-4 text-theme-sm text-gray-700 focus:border-brand-300 focus:outline-none focus:ring focus:ring-brand-500/10 dark:border-gray-600 dark:text-gray-300"
        >
          <option value="">Tous les statuts</option>
          {Object.values(StatutDemande).map((s) => (
            <option key={s} value={s}>
              {StatutDemandeLabels[s]}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="py-12 text-center text-gray-500 dark:text-gray-400">Chargement...</div>
      ) : filtered.length === 0 ? (
        <div className="py-12 text-center text-gray-500 dark:text-gray-400">Aucune demande trouvée</div>
      ) : (
        <DataTable columns={columns} data={filtered} />
      )}

      {/* Detail Modal with Historique */}
      <Modal isOpen={!!selectedDemande} onClose={() => setSelectedDemande(null)} title="Détails de la demande" size="lg">
        {selectedDemande && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-theme-xs text-gray-500 dark:text-gray-400">Type</p>
                <p className="text-theme-sm font-medium text-gray-800 dark:text-white">{selectedDemande.type}</p>
                {selectedDemande.typeCongeLabel && (
                  <p className="text-theme-xs text-gray-500">{selectedDemande.typeCongeLabel}</p>
                )}
              </div>
              <div>
                <p className="text-theme-xs text-gray-500 dark:text-gray-400">Statut</p>
                <Badge
                  text={StatutDemandeLabels[selectedDemande.statut] || selectedDemande.statut}
                  variant={statutBadgeMap[selectedDemande.statut] || 'neutral'}
                />
                <div className="mt-1">{renderChefWaiting(selectedDemande)}</div>
              </div>
              <div>
                <p className="text-theme-xs text-gray-500 dark:text-gray-400">Employé</p>
                <p className="text-theme-sm font-medium text-gray-800 dark:text-white">{selectedDemande.employeNom}</p>
              </div>
              <div>
                <p className="text-theme-xs text-gray-500 dark:text-gray-400">Date de création</p>
                <p className="text-theme-sm font-medium text-gray-800 dark:text-white">
                  {new Date(selectedDemande.dateCreation).toLocaleDateString('fr-FR')}
                </p>
              </div>
              {selectedDemande.dateDebut && (
                <div>
                  <p className="text-theme-xs text-gray-500 dark:text-gray-400">Date début</p>
                  <p className="text-theme-sm font-medium text-gray-800 dark:text-white">{selectedDemande.dateDebut}</p>
                </div>
              )}
              {selectedDemande.dateFin && (
                <div>
                  <p className="text-theme-xs text-gray-500 dark:text-gray-400">Date fin</p>
                  <p className="text-theme-sm font-medium text-gray-800 dark:text-white">{selectedDemande.dateFin}</p>
                </div>
              )}
              {selectedDemande.nombreJours && (
                <div>
                  <p className="text-theme-xs text-gray-500 dark:text-gray-400">Nombre de jours</p>
                  <p className="text-theme-sm font-medium text-gray-800 dark:text-white">{selectedDemande.nombreJours} jour(s)</p>
                </div>
              )}
              {selectedDemande.date && (
                <div>
                  <p className="text-theme-xs text-gray-500 dark:text-gray-400">Date</p>
                  <p className="text-theme-sm font-medium text-gray-800 dark:text-white">{selectedDemande.date}</p>
                </div>
              )}
              {selectedDemande.heureDebut && selectedDemande.heureFin && (
                <div>
                  <p className="text-theme-xs text-gray-500 dark:text-gray-400">Horaire</p>
                  <p className="text-theme-sm font-medium text-gray-800 dark:text-white">
                    {selectedDemande.heureDebut} - {selectedDemande.heureFin}
                    {selectedDemande.dureeMinutes != null && (
                      <span className="text-gray-500 ml-1">
                        ({Math.floor(selectedDemande.dureeMinutes / 60)}h
                        {String(selectedDemande.dureeMinutes % 60).padStart(2, '0')})
                      </span>
                    )}
                  </p>
                </div>
              )}
            </div>
            {selectedDemande.raison && (
              <div>
                <p className="text-theme-xs text-gray-500 dark:text-gray-400">Motif</p>
                <p className="text-theme-sm text-gray-700 dark:text-gray-300 mt-1">{selectedDemande.raison}</p>
              </div>
            )}
            {selectedDemande.justificatifPath && (
              <div>
                <p className="text-theme-xs text-gray-500 dark:text-gray-400">Pièce jointe</p>
                <a
                  href={demandeService.getFileUrl(selectedDemande.justificatifPath)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 mt-1 text-theme-sm text-brand-500 hover:text-brand-600 dark:text-brand-400"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                  </svg>
                  Télécharger le justificatif
                </a>
              </div>
            )}

            {/* Historique Timeline */}
            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <HistoriqueTimeline demandeId={selectedDemande.id} />
            </div>

            {/* Admin actions in modal */}
            {canViewDemandes && canDecide(selectedDemande) && (
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <Button
                  variant="outline"
                  onClick={() => openRefuseModal(selectedDemande)}
                  disabled={actionLoading}
                >
                  Refuser
                </Button>
                <Button onClick={() => handleApprove(selectedDemande.id)} disabled={actionLoading}>
                  {actionLoading ? 'Traitement...' : 'Approuver'}
                </Button>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Refuse Modal */}
      <Modal isOpen={refuseModalOpen} onClose={() => setRefuseModalOpen(false)} title="Refuser la demande">
        <div className="space-y-4">
          <p className="text-theme-sm text-gray-600 dark:text-gray-400">
            Êtes-vous sûr de vouloir refuser cette demande ?
          </p>
          <div>
            <label className="mb-1.5 block text-theme-sm font-medium text-gray-700 dark:text-gray-300">
              Commentaire (optionnel)
            </label>
            <textarea
              value={refuseComment}
              onChange={(e) => setRefuseComment(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-gray-300 bg-transparent px-4 py-3 text-theme-sm text-gray-700 focus:border-brand-300 focus:outline-none focus:ring focus:ring-brand-500/10 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-300"
              placeholder="Motif du refus..."
            />
          </div>
          <div className="flex items-center justify-end gap-3">
            <Button variant="outline" onClick={() => setRefuseModalOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleRefuse} disabled={actionLoading}>
              {actionLoading ? 'Traitement...' : 'Confirmer le refus'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Batch Refuse Modal */}
      <Modal isOpen={batchRefuseOpen} onClose={() => setBatchRefuseOpen(false)} title="Refuser en lot">
        <div className="space-y-4">
          <p className="text-theme-sm text-gray-600 dark:text-gray-400">
            Refuser {selectedIds.size} demande(s) sélectionnée(s) ?
          </p>
          <div>
            <label className="mb-1.5 block text-theme-sm font-medium text-gray-700 dark:text-gray-300">
              Commentaire (optionnel)
            </label>
            <textarea
              value={batchRefuseComment}
              onChange={(e) => setBatchRefuseComment(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-gray-300 bg-transparent px-4 py-3 text-theme-sm text-gray-700 focus:border-brand-300 focus:outline-none focus:ring focus:ring-brand-500/10 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-300"
              placeholder="Motif du refus..."
            />
          </div>
          <div className="flex items-center justify-end gap-3">
            <Button variant="outline" onClick={() => setBatchRefuseOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleBatchRefuse} disabled={actionLoading}>
              {actionLoading ? 'Traitement...' : `Refuser ${selectedIds.size} demande(s)`}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default DemandesPage;
