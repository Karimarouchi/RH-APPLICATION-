import React, { useState, useEffect } from 'react';
import {
  HiOutlineUsers,
  HiOutlineDocumentText,
  HiOutlineUserGroup,
  HiOutlineClock,
  HiOutlineTrendingUp,
  HiOutlineCalendar,
  HiOutlineCheckCircle,
  HiOutlineXCircle,
  HiOutlineRefresh,
  HiOutlineDesktopComputer,
  HiOutlineStatusOnline,
  HiOutlineStatusOffline,
  HiOutlineClipboardList,
  HiOutlineViewBoards,
  HiOutlineKey,
  HiOutlinePaperClip,
} from 'react-icons/hi';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, AreaChart, Area,
} from 'recharts';
import { employeService } from '../api/employeService';
import { demandeService } from '../api/demandeService';
import { equipeService } from '../api/equipeService';
import { compteService } from '../api/compteService';
import { agentDashboardService } from '../api/agentDashboardService';
import { demandePapierService } from '../api/demandePapierService';
import {
  EmployeStatsDTO, DemandeResponse, Equipe, StatutDemande,
  CompteDTO, DashboardEmployeStatus,
} from '../types';
import { formatGenreChartLabel } from '../utils/genre';

const COLORS = {
  brand: '#f36904',
  brandLight: '#ff8c3a',
  secondary: '#683B77',
  blue: '#3b82f6',
  green: '#10b981',
  red: '#ef4444',
  yellow: '#f59e0b',
  gray: '#6b7280',
  cyan: '#06b6d4',
  pink: '#ec4899',
  indigo: '#6366f1',
  teal: '#14b8a6',
};

const PIE_COLORS = [COLORS.brand, COLORS.secondary, COLORS.blue, COLORS.green, COLORS.cyan, COLORS.pink, COLORS.indigo, COLORS.teal, COLORS.yellow, COLORS.red];

const tooltipStyle = { borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' };

const DashboardRHPage: React.FC = () => {
  const [stats, setStats] = useState<EmployeStatsDTO | null>(null);
  const [demandes, setDemandes] = useState<DemandeResponse[]>([]);
  const [demandesPapier, setDemandesPapier] = useState<DemandeResponse[]>([]);
  const [equipes, setEquipes] = useState<Equipe[]>([]);
  const [comptes, setComptes] = useState<CompteDTO[]>([]);
  const [presenceData, setPresenceData] = useState<DashboardEmployeStatus[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [statsRes, demandesRes, demandesPapierRes, equipesRes, comptesRes, presenceRes] = await Promise.all([
        employeService.getStats(),
        demandeService.getAll(),
        demandePapierService.getAll().catch(() => ({ data: { data: [] } })),
        equipeService.getAll(),
        compteService.getAll().catch(() => ({ data: { data: [] } })),
        agentDashboardService.getDashboard().catch(() => ({ data: { data: [] } })),
      ]);
      setStats(statsRes.data.data);
      setDemandes(demandesRes.data.data || []);
      setDemandesPapier(demandesPapierRes.data.data || []);
      setEquipes(equipesRes.data.data || []);
      setComptes(comptesRes.data.data || []);
      setPresenceData(presenceRes.data.data || []);
    } catch (err) {
      console.error('Erreur chargement dashboard RH:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // ==================== COMPUTED DATA ====================

  // -- Demandes congés --
  const demandesEnAttente = demandes.filter(d => d.statut === StatutDemande.EN_ATTENTE).length;
  const demandesApprouvees = demandes.filter(d => d.statut === StatutDemande.APPROUVEE).length;
  const demandesRefusees = demandes.filter(d => d.statut === StatutDemande.REFUSEE).length;
  const demandesAnnulees = demandes.filter(d => d.statut === StatutDemande.ANNULEE).length;

  // -- Demandes papier --
  const papierEnAttente = demandesPapier.filter(d => d.statut === StatutDemande.EN_ATTENTE).length;
  const papierApprouvees = demandesPapier.filter(d => d.statut === StatutDemande.APPROUVEE).length;

  // -- Comptes --
  const comptesActifs = comptes.filter(c => c.enabled).length;
  const comptesInactifs = comptes.filter(c => !c.enabled).length;

  // -- Présence temps réel --
  const presentsAujourdhui = presenceData.filter(p => p.statut === 'PRESENT' || p.heureEntree).length;
  const agentsActifs = presenceData.filter(p => p.agentActif).length;
  const retardsAujourdhui = presenceData.filter(p => p.retardMinutes > 0).length;
  const surReseau = presenceData.filter(p => p.surReseauEntreprise).length;
  const tempsActifMoyen = presenceData.length > 0
    ? Math.round(presenceData.reduce((sum, p) => sum + p.tempsActifMinutes, 0) / presenceData.length)
    : 0;

  // -- Demandes par type --
  const demandesParType = demandes.reduce<Record<string, number>>((acc, d) => {
    const type = d.type || 'Autre';
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {});
  const typeLabels: Record<string, string> = {
    CONGE: 'Congé', AUTORISATION: 'Autorisation', TELETRAVAIL: 'Télétravail', ADMINISTRATION: 'Administration',
  };
  const demandesParTypeData = Object.entries(demandesParType).map(([key, value], i) => ({
    name: typeLabels[key] || key, value, color: PIE_COLORS[i % PIE_COLORS.length],
  }));

  // -- Demandes par type de congé --
  const demandesParConge = demandes.reduce<Record<string, number>>((acc, d) => {
    if (d.typeCongeLabel) {
      acc[d.typeCongeLabel] = (acc[d.typeCongeLabel] || 0) + 1;
    }
    return acc;
  }, {});
  const congeData = Object.entries(demandesParConge)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value], i) => ({ name, value, color: PIE_COLORS[i % PIE_COLORS.length] }));

  // -- Embauches par mois --
  const embauchesMoisData = stats?.embaucheParMois
    ? Object.entries(stats.embaucheParMois).map(([mois, count]) => ({ mois: mois.substring(0, 7), embauches: count }))
    : [];

  // -- Département --
  const deptData = stats?.parDepartement
    ? Object.entries(stats.parDepartement).sort((a, b) => b[1] - a[1]).map(([dep, count]) => ({ name: dep, value: count }))
    : [];

  // -- Genre --
  const genreData = stats?.parGenre
    ? Object.entries(stats.parGenre).map(([genre, count], i) => ({
        name: formatGenreChartLabel(genre),
        value: count, color: i === 0 ? COLORS.blue : COLORS.pink,
      }))
    : [];

  // -- Contrat --
  const contratData = stats?.parTypeContrat
    ? Object.entries(stats.parTypeContrat).map(([type, count], i) => ({
        name: type, value: count, color: PIE_COLORS[i % PIE_COLORS.length],
      }))
    : [];

  // -- Demandes récentes (5 dernières en attente) --
  const demandesRecentes = [...demandes]
    .filter(d => d.statut === StatutDemande.EN_ATTENTE)
    .sort((a, b) => new Date(b.dateCreation).getTime() - new Date(a.dateCreation).getTime())
    .slice(0, 6);

  // -- Taux de présence --
  const tauxPresence = stats?.totalEmployes && stats.totalEmployes > 0
    ? ((presentsAujourdhui / stats.totalEmployes) * 100).toFixed(0)
    : '0';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-brand-200 border-t-brand-500 rounded-full animate-spin" />
          <p className="text-gray-500 dark:text-gray-400">Chargement du tableau de bord...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* =========== HEADER =========== */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-gray-900 to-[#683b77] dark:from-white dark:to-[#ab78c3]">Dashboard RH</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Vue globale de toute l'activité RH</p>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-50 text-brand-600 hover:bg-brand-100 dark:bg-brand-500/10 dark:text-brand-400 dark:hover:bg-brand-500/20 transition-colors text-sm font-medium"
        >
          <HiOutlineRefresh size={18} />
          Actualiser
        </button>
      </div>

      {/* =========== SECTION 1 : KPIs PRINCIPAUX =========== */}
      <SectionTitle title="Vue d'ensemble" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <KPICard
          title="Total Employés"
          value={stats?.totalEmployes ?? 0}
          icon={<HiOutlineUsers size={22} />}
          subtitle={`+${stats?.nouveauxCeMois ?? 0} ce mois`}
          subtitleType="positive"
          iconBg="bg-brand-50 text-brand-600 dark:bg-brand-500/20 dark:text-brand-400"
        />
        <KPICard
          title="Présents aujourd'hui"
          value={presentsAujourdhui}
          icon={<HiOutlineStatusOnline size={22} />}
          subtitle={`${tauxPresence}% de présence`}
          subtitleType={Number(tauxPresence) >= 80 ? 'positive' : 'negative'}
          iconBg="bg-green-100 text-green-600 dark:bg-green-500/20 dark:text-green-400"
        />
        <KPICard
          title="Demandes en attente"
          value={demandesEnAttente + papierEnAttente}
          icon={<HiOutlineClock size={22} />}
          subtitle={`${demandesEnAttente} congés · ${papierEnAttente} papiers`}
          subtitleType={demandesEnAttente + papierEnAttente > 0 ? 'negative' : 'neutral'}
          iconBg="bg-yellow-100 text-yellow-600 dark:bg-yellow-500/20 dark:text-yellow-400"
        />
      </div>

      {/* =========== ROW 2 : Mini-cartes détaillées =========== */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MiniCard label="Comptes actifs" value={comptesActifs} icon={<HiOutlineKey size={16} />} color="text-green-600 dark:text-green-400" bg="bg-green-50 dark:bg-green-500/10" />
        <MiniCard label="Comptes inactifs" value={comptesInactifs} icon={<HiOutlineStatusOffline size={16} />} color="text-red-600 dark:text-red-400" bg="bg-red-50 dark:bg-red-500/10" />
        <MiniCard label="Équipes" value={equipes.length} icon={<HiOutlineUserGroup size={16} />} color="text-indigo-600 dark:text-indigo-400" bg="bg-indigo-50 dark:bg-indigo-500/10" />
        <MiniCard label="Retards aujourd'hui" value={retardsAujourdhui} icon={<HiOutlineClock size={16} />} color="text-brand-500 dark:text-brand-400" bg="bg-brand-50 dark:bg-brand-500/10" />
      </div>

      {/* =========== SECTION 2 : EFFECTIFS & RH =========== */}
      <SectionTitle title="Effectifs & Ressources Humaines" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <ChartCard title="Répartition par département">
            <ResponsiveContainer width="100%" height={Math.max(200, deptData.length * 38)}>
              <BarChart data={deptData} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis type="number" stroke="#9ca3af" fontSize={12} />
                <YAxis dataKey="name" type="category" stroke="#9ca3af" fontSize={11} width={130} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="value" name="Employés" fill={COLORS.secondary} radius={[0, 6, 6, 0]} barSize={22} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
        <ChartCard title="Répartition par genre">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={genreData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} dataKey="value" paddingAngle={4}
                label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`} labelLine={false}>
                {genreData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-6 mt-1">
            {genreData.map((g, i) => (
              <div key={i} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: g.color }} /> {g.name}: <strong>{g.value}</strong>
              </div>
            ))}
          </div>
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <ChartCard title="Embauches par mois (12 derniers mois)">
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={embauchesMoisData}>
                <defs>
                  <linearGradient id="gradientEmbauches" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={COLORS.secondary} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={COLORS.secondary} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="mois" stroke="#9ca3af" fontSize={11} />
                <YAxis stroke="#9ca3af" fontSize={12} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="embauches" name="Embauches" stroke={COLORS.secondary} strokeWidth={2.5} fill="url(#gradientEmbauches)" />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
        <ChartCard title="Types de contrats">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={contratData} cx="50%" cy="50%" outerRadius={85} dataKey="value" paddingAngle={3}>
                {contratData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
              <Tooltip />
              <Legend verticalAlign="bottom" iconType="circle" iconSize={10}
                formatter={(value: string) => <span className="text-xs text-gray-600 dark:text-gray-300">{value}</span>} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* -- Ancienneté & Top postes -- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Indicateurs RH clés">
          <div className="grid grid-cols-2 gap-4 py-2">
            <InfoTile label="Ancienneté moyenne" value={`${stats?.moyenneAnciennete?.toFixed(1) ?? 0} ans`} color="text-brand-600 dark:text-brand-400" />
            <InfoTile label="Employés actifs" value={String(stats?.employesActifs ?? 0)} color="text-green-600 dark:text-green-400" />
            <InfoTile label="Nouveaux ce mois" value={`+${stats?.nouveauxCeMois ?? 0}`} color="text-blue-600 dark:text-blue-400" />
            <InfoTile label="Salaire moyen" value={`${stats?.moyenneSalaire?.toFixed(0) ?? 0} DT`} color="text-purple-600 dark:text-purple-400" />
          </div>
        </ChartCard>
        <ChartCard title="Top postes">
          <div className="space-y-2.5 py-1">
            {stats?.parPoste && Object.entries(stats.parPoste).sort((a, b) => b[1] - a[1]).slice(0, 7).map(([poste, count], i) => {
              const maxCount = Math.max(...Object.values(stats.parPoste));
              const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;
              return (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-xs text-gray-600 dark:text-gray-300 w-32 truncate" title={poste}>{poste}</span>
                  <div className="flex-1 h-5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                  </div>
                  <span className="text-xs font-bold text-gray-800 dark:text-white w-6 text-right">{count}</span>
                </div>
              );
            })}
          </div>
        </ChartCard>
      </div>

      {/* =========== SECTION 3 : DEMANDES & CONGÉS =========== */}
      <SectionTitle title="Gestion des Demandes" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Statut des demandes congés */}
        <ChartCard title="Demandes de congés — Statut">
          <div className="grid grid-cols-2 gap-3 py-3">
            <StatusBlock label="En attente" count={demandesEnAttente} total={demandes.length} color="bg-yellow-500" />
            <StatusBlock label="Approuvées" count={demandesApprouvees} total={demandes.length} color="bg-green-500" />
            <StatusBlock label="Refusées" count={demandesRefusees} total={demandes.length} color="bg-red-500" />
            <StatusBlock label="Annulées" count={demandesAnnulees} total={demandes.length} color="bg-gray-400" />
          </div>
          <div className="mt-3 text-center border-t border-gray-100 dark:border-gray-700 pt-3">
            <span className="text-2xl font-bold text-gray-800 dark:text-white">{demandes.length}</span>
            <span className="text-sm text-gray-500 dark:text-gray-400 ml-2">demandes congés au total</span>
          </div>
        </ChartCard>

        {/* Demandes par type */}
        <ChartCard title="Demandes par type">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={demandesParTypeData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} />
              <YAxis stroke="#9ca3af" fontSize={12} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="value" name="Demandes" radius={[8, 8, 0, 0]} barSize={40}>
                {demandesParTypeData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Détail par type de congé */}
        {congeData.length > 0 && (
          <ChartCard title="Détail par type de congé">
            <div className="space-y-2.5 py-1">
              {congeData.slice(0, 8).map((item, i) => {
                const maxVal = congeData[0]?.value || 1;
                const pct = (item.value / maxVal) * 100;
                return (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-xs text-gray-600 dark:text-gray-300 w-36 truncate" title={item.name}>{item.name}</span>
                    <div className="flex-1 h-5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: item.color }} />
                    </div>
                    <span className="text-xs font-bold text-gray-800 dark:text-white w-6 text-right">{item.value}</span>
                  </div>
                );
              })}
            </div>
          </ChartCard>
        )}

        {/* Demandes papier */}
        <ChartCard title="Demandes de documents (papier)">
          <div className="grid grid-cols-3 gap-4 py-4">
            <StatusBlock label="En attente" count={papierEnAttente} total={demandesPapier.length} color="bg-yellow-500" />
            <StatusBlock label="Traitées" count={papierApprouvees} total={demandesPapier.length} color="bg-green-500" />
            <StatusBlock label="Total" count={demandesPapier.length} total={demandesPapier.length} color="bg-brand-500" />
          </div>
        </ChartCard>
      </div>

      {/* -- Demandes récentes en attente -- */}
      {demandesRecentes.length > 0 && (
        <ChartCard title="Dernières demandes en attente de validation">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
                  <th className="text-left py-2 font-medium">Employé</th>
                  <th className="text-left py-2 font-medium">Type</th>
                  <th className="text-left py-2 font-medium">Période</th>
                  <th className="text-left py-2 font-medium">Jours</th>
                  <th className="text-left py-2 font-medium">Date demande</th>
                </tr>
              </thead>
              <tbody>
                {demandesRecentes.map((d) => (
                  <tr key={d.id} className="border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                    <td className="py-2.5 font-medium text-gray-800 dark:text-white">{d.employeNom}</td>
                    <td className="py-2.5">
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
                        {d.typeCongeLabel || typeLabels[d.type] || d.type}
                      </span>
                    </td>
                    <td className="py-2.5 text-gray-600 dark:text-gray-300">{d.dateDebut && d.dateFin ? `${d.dateDebut} → ${d.dateFin}` : d.date || '—'}</td>
                    <td className="py-2.5 text-gray-600 dark:text-gray-300">{d.joursOuvrables ?? d.nombreJours ?? '—'}</td>
                    <td className="py-2.5 text-gray-400">{new Date(d.dateCreation).toLocaleDateString('fr-FR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartCard>
      )}

      {/* =========== SECTION 5 : MONITORING & PRÉSENCE =========== */}
      <SectionTitle title="Monitoring & Présence" />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <MiniCard label="Présents" value={presentsAujourdhui} icon={<HiOutlineStatusOnline size={16} />} color="text-green-600 dark:text-green-400" bg="bg-green-50 dark:bg-green-500/10" />
        <MiniCard label="Agents actifs" value={agentsActifs} icon={<HiOutlineDesktopComputer size={16} />} color="text-blue-600 dark:text-blue-400" bg="bg-blue-50 dark:bg-blue-500/10" />
        <MiniCard label="Sur réseau" value={surReseau} icon={<HiOutlineStatusOnline size={16} />} color="text-teal-600 dark:text-teal-400" bg="bg-teal-50 dark:bg-teal-500/10" />
        <MiniCard label="Retards" value={retardsAujourdhui} icon={<HiOutlineClock size={16} />} color="text-brand-500 dark:text-brand-400" bg="bg-brand-50 dark:bg-brand-500/10" />
        <MiniCard label="Temps actif moy." value={`${tempsActifMoyen}m`} icon={<HiOutlineViewBoards size={16} />} color="text-indigo-600 dark:text-indigo-400" bg="bg-indigo-50 dark:bg-indigo-500/10" />
      </div>

      {/* -- Top retards -- */}
      {presenceData.filter(p => p.retardMinutes > 0).length > 0 && (
        <ChartCard title="Employés en retard aujourd'hui">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
                  <th className="text-left py-2 font-medium">Employé</th>
                  <th className="text-left py-2 font-medium">Poste</th>
                  <th className="text-left py-2 font-medium">Département</th>
                  <th className="text-left py-2 font-medium">Heure d'entrée</th>
                  <th className="text-left py-2 font-medium">Retard</th>
                </tr>
              </thead>
              <tbody>
                {presenceData.filter(p => p.retardMinutes > 0).sort((a, b) => b.retardMinutes - a.retardMinutes).slice(0, 8).map((p) => (
                  <tr key={p.employeId} className="border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                    <td className="py-2.5 font-medium text-gray-800 dark:text-white">{p.prenom} {p.nom}</td>
                    <td className="py-2.5 text-gray-600 dark:text-gray-300">{p.poste || '—'}</td>
                    <td className="py-2.5 text-gray-600 dark:text-gray-300">{p.departement || '—'}</td>
                    <td className="py-2.5 text-gray-500 dark:text-gray-400">{p.heureEntree || '—'}</td>
                    <td className="py-2.5">
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400">
                        +{p.retardMinutes} min
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartCard>
      )}

      {/* =========== SECTION 6 : ACCÈS & SÉCURITÉ =========== */}
      <SectionTitle title="Comptes & Accès" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="État des comptes utilisateurs">
          <div className="flex items-center gap-8 py-6 justify-center">
            <div className="text-center">
              <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-500/20 flex items-center justify-center mx-auto mb-3">
                <span className="text-2xl font-bold text-green-600 dark:text-green-400">{comptesActifs}</span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300">Actifs</p>
            </div>
            <div className="text-center">
              <div className="w-20 h-20 rounded-full bg-red-100 dark:bg-red-500/20 flex items-center justify-center mx-auto mb-3">
                <span className="text-2xl font-bold text-red-600 dark:text-red-400">{comptesInactifs}</span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300">Désactivés</p>
            </div>
            <div className="text-center">
              <div className="w-20 h-20 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mx-auto mb-3">
                <span className="text-2xl font-bold text-gray-800 dark:text-white">{comptes.length}</span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300">Total</p>
            </div>
          </div>
        </ChartCard>

        {/* Résumé global */}
        <ChartCard title="Résumé global de l'application RH">
          <div className="grid grid-cols-2 gap-3 py-2">
            <SummaryRow icon={<HiOutlineUsers size={16} />} label="Employés" value={stats?.totalEmployes ?? 0} />
            <SummaryRow icon={<HiOutlineKey size={16} />} label="Comptes" value={comptes.length} />
            <SummaryRow icon={<HiOutlineDocumentText size={16} />} label="Demandes congés" value={demandes.length} />
            <SummaryRow icon={<HiOutlinePaperClip size={16} />} label="Demandes papier" value={demandesPapier.length} />
            <SummaryRow icon={<HiOutlineUserGroup size={16} />} label="Équipes" value={equipes.length} />
            <SummaryRow icon={<HiOutlineDesktopComputer size={16} />} label="Agents suivis" value={presenceData.length} />
          </div>
        </ChartCard>
      </div>
    </div>
  );
};

// ======================== Sub-components ========================

const SectionTitle: React.FC<{ title: string }> = ({ title }) => (
  <div className="flex items-center gap-3 pt-2">
    <div className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
    <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">{title}</h2>
    <div className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
  </div>
);

const KPICard: React.FC<{
  title: string;
  value: string | number;
  icon: React.ReactNode;
  subtitle: string;
  subtitleType: 'positive' | 'negative' | 'neutral';
  iconBg: string;
}> = ({ title, value, icon, subtitle, subtitleType, iconBg }) => (
  <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-800 hover:shadow-md transition-shadow">
    <div className="flex items-start justify-between">
      <div className="space-y-1">
        <p className="text-sm text-gray-500 dark:text-gray-400">{title}</p>
        <h3 className="text-2xl font-bold text-gray-800 dark:text-white">{value}</h3>
        <p className={`text-xs font-medium ${
          subtitleType === 'positive' ? 'text-green-600 dark:text-green-400' :
          subtitleType === 'negative' ? 'text-red-600 dark:text-red-400' :
          'text-gray-500 dark:text-gray-400'
        }`}>{subtitle}</p>
      </div>
      <div className={`rounded-xl p-3 ${iconBg}`}>{icon}</div>
    </div>
  </div>
);

const MiniCard: React.FC<{
  label: string;
  value: number | string;
  icon: React.ReactNode;
  color: string;
  bg: string;
}> = ({ label, value, icon, color, bg }) => (
  <div className={`rounded-xl ${bg} p-3.5 flex items-center gap-3`}>
    <div className={`${color}`}>{icon}</div>
    <div>
      <p className="text-lg font-bold text-gray-800 dark:text-white">{value}</p>
      <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-tight">{label}</p>
    </div>
  </div>
);

const ChartCard: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-800">
    <h3 className="text-sm font-semibold text-gray-800 dark:text-white mb-4">{title}</h3>
    {children}
  </div>
);

const StatusBlock: React.FC<{ label: string; count: number; total: number; color: string }> = ({ label, count, total, color }) => {
  const pct = total > 0 ? ((count / total) * 100).toFixed(0) : '0';
  return (
    <div className="rounded-xl bg-gray-50 dark:bg-gray-800 p-3.5 text-center">
      <div className="flex items-center justify-center gap-2 mb-1.5">
        <span className={`w-2.5 h-2.5 rounded-full ${color}`} />
        <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
      </div>
      <p className="text-xl font-bold text-gray-800 dark:text-white">{count}</p>
      <p className="text-xs text-gray-400 mt-0.5">{pct}%</p>
    </div>
  );
};

const InfoTile: React.FC<{ label: string; value: string; color: string }> = ({ label, value, color }) => (
  <div className="rounded-xl bg-gray-50 dark:bg-gray-800 p-4 text-center">
    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{label}</p>
    <p className={`text-xl font-bold ${color}`}>{value}</p>
  </div>
);

const SummaryRow: React.FC<{ icon: React.ReactNode; label: string; value: number }> = ({ icon, label, value }) => (
  <div className="flex items-center gap-3 rounded-xl bg-gray-50 dark:bg-gray-800 p-3">
    <span className="text-gray-400">{icon}</span>
    <span className="text-sm text-gray-600 dark:text-gray-300 flex-1">{label}</span>
    <span className="text-sm font-bold text-gray-800 dark:text-white">{value}</span>
  </div>
);

export default DashboardRHPage;
