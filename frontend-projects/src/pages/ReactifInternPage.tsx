import React, { useState, useEffect, useMemo } from 'react';
import { HiOutlineSearch, HiOutlineRefresh, HiOutlineChatAlt2, HiOutlineClipboardList, HiOutlineFilm } from 'react-icons/hi';
import { reactifService, ReactifInternDTO } from '../api/reactifService';

// ── KPI Card (reusable) ───────────────────────────────────────────────────────
const KpiCard: React.FC<{
    label: string; value: string | number; icon: string;
    sub?: string; gradient: string; border: string;
}> = ({ label, value, icon, sub, gradient, border }) => (
    <div className={`relative overflow-hidden rounded-2xl border ${border} bg-gradient-to-br ${gradient} p-5`}>
        <div className="flex items-center justify-between mb-3">
            <span className="text-2xl">{icon}</span>
            <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{label}</span>
        </div>
        <p className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">{value}</p>
        {sub && <p className="text-[11px] text-gray-400 mt-2">{sub}</p>}
    </div>
);

// ── Main ─────────────────────────────────────────────────────────────────────
const ReactifInternPage: React.FC = () => {
    const [tab, setTab] = useState<'taches' | 'mediaplans'>('taches');
    const [tacheReactifs, setTacheReactifs] = useState<ReactifInternDTO[]>([]);
    const [mpReactifs, setMpReactifs] = useState<ReactifInternDTO[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [expandedTaches, setExpandedTaches] = useState<Set<number>>(new Set());
    // MP accordion state (must be at component top level)
    const [expandedClients, setExpandedClients] = useState<Set<number>>(new Set());
    const [expandedBatches, setExpandedBatches] = useState<Set<number>>(new Set());

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                const [trRes, mpRes] = await Promise.all([
                    reactifService.getAllTacheReactifs(),
                    reactifService.getAllMediaPlanInternReactifs(),
                ]);
                setTacheReactifs(trRes);
                setMpReactifs(mpRes);
            } catch (e) { console.error(e); }
            finally { setLoading(false); }
        };
        load();
    }, []);

    // KPI stats for tasks
    const uniqueTaches = useMemo(() => new Set(tacheReactifs.map(r => r.tacheId)).size, [tacheReactifs]);
    const uniqueManagers = useMemo(() => new Set(tacheReactifs.map(r => r.managerId)).size, [tacheReactifs]);
    const uniqueEmployes = useMemo(() => new Set(tacheReactifs.map(r => r.employeId)).size, [tacheReactifs]);
    const uniqueMpManagers = useMemo(() => new Set(mpReactifs.map(r => r.managerId)).size, [mpReactifs]);

    // Filtered lists
    const filteredTaches = useMemo(() => {
        const q = search.toLowerCase();
        if (!q) return tacheReactifs;
        return tacheReactifs.filter(r =>
            r.tacheTitre?.toLowerCase().includes(q) ||
            r.projetNom?.toLowerCase().includes(q) ||
            r.clientNom?.toLowerCase().includes(q) ||
            r.employeNom?.toLowerCase().includes(q) ||
            r.managerNom?.toLowerCase().includes(q)
        );
    }, [tacheReactifs, search]);

    const filteredMp = useMemo(() => {
        const q = search.toLowerCase();
        if (!q) return mpReactifs;
        return mpReactifs.filter(r =>
            r.mediaPlanTitre?.toLowerCase().includes(q) ||
            r.clientNom?.toLowerCase().includes(q) ||
            r.managerNom?.toLowerCase().includes(q) ||
            r.employeNom?.toLowerCase().includes(q)
        );
    }, [mpReactifs, search]);


    const groupedTaches = useMemo(() => {
        const sorted = [...filteredTaches].sort((a, b) => new Date(b.dateReactif).getTime() - new Date(a.dateReactif).getTime());
        const map = new Map<number, ReactifInternDTO[]>();
        for (const r of sorted) {
            if (r.tacheId) {
                if (!map.has(r.tacheId)) map.set(r.tacheId, []);
                map.get(r.tacheId)!.push(r);
            }
        }
        return Array.from(map.values());
    }, [filteredTaches]);

    const toggleTacheRow = (tacheId: number) => {
        setExpandedTaches(prev => {
            const next = new Set(prev);
            if (next.has(tacheId)) next.delete(tacheId);
            else next.add(tacheId);
            return next;
        });
    };

    const toggleClient = (id: number) => setExpandedClients(prev => {
        const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n;
    });
    const toggleBatch = (id: number) => setExpandedBatches(prev => {
        const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n;
    });

    const MP_MONTH_NAMES = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
        'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

    const buildBatches = (reactifs: ReactifInternDTO[]) => {
        // Group by month first, then by refusal time window (60s) within each month
        // This means 3 lines refused together at the same time = 1 "Mediaplan de Juin 1"
        const TIME_WINDOW_MS = 60_000; // 60 seconds

        // Sort by month then by dateReactif ascending
        const sorted = [...reactifs].sort((a, b) => {
            const moisCmp = (a.mediaPlanMois || '').localeCompare(b.mediaPlanMois || '');
            if (moisCmp !== 0) return moisCmp;
            return new Date(a.dateReactif).getTime() - new Date(b.dateReactif).getTime();
        });

        // Group into "refusal events": same month + dateReactif within 60s of the first in the group
        type RefusalEvent = { mois: string; lines: ReactifInternDTO[] };
        const events: RefusalEvent[] = [];

        for (const r of sorted) {
            const mois = r.mediaPlanMois || '';
            const t = new Date(r.dateReactif).getTime();
            // Find existing event: same month, current r's time within 60s of event's LAST item
            const last = events.length > 0 ? events[events.length - 1] : null;
            if (
                last &&
                last.mois === mois &&
                t - new Date(last.lines[last.lines.length - 1].dateReactif).getTime() <= TIME_WINDOW_MS
            ) {
                last.lines.push(r);
            } else {
                events.push({ mois, lines: [r] });
            }
        }

        const monthCounters: Record<string, number> = {};
        return events.map(event => {
            const mois = event.mois;
            let monthLabel = mois;
            if (/^\d{4}-\d{2}$/.test(mois)) {
                const [, m] = mois.split('-').map(Number);
                monthLabel = MP_MONTH_NAMES[m - 1] || mois;
            }
            monthCounters[monthLabel] = (monthCounters[monthLabel] || 0) + 1;
            const batchId = event.lines[0].mediaPlanId || Math.random(); // unique key per event
            const first = event.lines[0];
            return {
                mpId: batchId,
                monthLabel: `Mediaplan de ${monthLabel || '?'} ${monthCounters[monthLabel]}`,
                employeNom: `${first.employePrenom || ''} ${first.employeNom || ''}`.trim() || '—',
                // Each "refusal event" = one entry in history with count of lines refused
                reactifs: event.lines,
                nbLignes: event.lines.length,
            };
        });
    };

    // Build client map for mp accordion
    const mpByClient = useMemo(() => {
        const map = new Map<number, { clientNom: string; reactifs: ReactifInternDTO[] }>();
        for (const r of filteredMp) {
            const cid = r.clientId || 0;
            if (!map.has(cid)) map.set(cid, { clientNom: r.clientNom || 'Client inconnu', reactifs: [] });
            map.get(cid)!.reactifs.push(r);
        }
        return Array.from(map.entries());
    }, [filteredMp]);

    const fmt = (d?: string) => d ? new Date(d).toLocaleDateString('fr-FR') : '—';
    const fmtDt = (d?: string) => d ? new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';

    return (
        <div className="space-y-8 max-w-[1400px] mx-auto">

            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
                        <HiOutlineChatAlt2 size={26} className="text-brand-500" />
                        Réactifs Internes
                    </h1>
                    <p className="text-sm text-gray-400 mt-1">Suivi des corrections et retours des managers</p>
                </div>
            </div>

            {/* KPI Row */}
            {tab === 'taches' ? (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <KpiCard label="Total rectifs" value={tacheReactifs.length} icon="💬"
                        gradient="from-brand-500/10 to-violet-500/10 dark:from-brand-500/5 dark:to-violet-500/5"
                        border="border-brand-200/50 dark:border-brand-500/20" />
                    <KpiCard label="Tâches touchées" value={uniqueTaches} icon="📋"
                        gradient="from-amber-500/10 to-orange-500/10 dark:from-amber-500/5 dark:to-orange-500/5"
                        border="border-amber-200/50 dark:border-amber-500/20" />
                    <KpiCard label="Managers actifs" value={uniqueManagers} icon="👔"
                        gradient="from-emerald-500/10 to-teal-500/10 dark:from-emerald-500/5 dark:to-teal-500/5"
                        border="border-emerald-200/50 dark:border-emerald-500/20" />
                    <KpiCard label="Employés concernés" value={uniqueEmployes} icon="👤"
                        gradient="from-red-500/10 to-rose-500/10 dark:from-red-500/5 dark:to-rose-500/5"
                        border="border-red-200/50 dark:border-red-500/20" />
                </div>
            ) : (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <KpiCard label="Total rectifs MP" value={mpReactifs.length} icon="🎬"
                        gradient="from-violet-500/10 to-purple-500/10 dark:from-violet-500/5 dark:to-purple-500/5"
                        border="border-violet-200/50 dark:border-violet-500/20" />
                    <KpiCard label="Media Plans refusés" value={new Set(mpReactifs.map(r => r.mediaPlanId)).size} icon="🚫"
                        gradient="from-red-500/10 to-rose-500/10 dark:from-red-500/5 dark:to-rose-500/5"
                        border="border-red-200/50 dark:border-red-500/20" />
                    <KpiCard label="Managers déclineurs" value={uniqueMpManagers} icon="👔"
                        gradient="from-amber-500/10 to-orange-500/10 dark:from-amber-500/5 dark:to-orange-500/5"
                        border="border-amber-200/50 dark:border-amber-500/20" />
                    <KpiCard label="Clients impactés" value={new Set(mpReactifs.map(r => r.clientId)).size} icon="🏢"
                        gradient="from-brand-500/10 to-sky-500/10 dark:from-brand-500/5 dark:to-sky-500/5"
                        border="border-brand-200/50 dark:border-brand-500/20" />
                </div>
            )}

            {/* Tabs + Search */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex gap-1 rounded-xl border border-gray-200 dark:border-gray-700 p-1 bg-gray-50 dark:bg-gray-800/50">
                    <button
                        onClick={() => { setTab('taches'); setSearch(''); }}
                        className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition-all ${tab === 'taches' ? 'bg-white dark:bg-gray-dark shadow text-brand-600 dark:text-brand-400' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                    >
                        <HiOutlineClipboardList size={16} /> Tâches
                    </button>
                    <button
                        onClick={() => { setTab('mediaplans'); setSearch(''); }}
                        className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition-all ${tab === 'mediaplans' ? 'bg-white dark:bg-gray-dark shadow text-brand-600 dark:text-brand-400' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                    >
                        <HiOutlineFilm size={16} /> Media Plans
                    </button>
                </div>
                <div className="relative max-w-xs w-full">
                    <HiOutlineSearch size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        value={search} onChange={e => setSearch(e.target.value)}
                        placeholder="Rechercher…"
                        className="h-10 w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-dark pl-10 pr-4 text-sm focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-500/10"
                    />
                </div>
            </div>

            {/* Table */}
            {loading ? (
                <div className="flex items-center justify-center py-24">
                    <div className="h-10 w-10 rounded-full border-4 border-gray-200 border-t-brand-500 animate-spin dark:border-gray-700" />
                </div>
            ) : tab === 'taches' ? (
                <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-dark overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-800/40">
                                    {['Employé', 'Manager', 'Tâche', 'Projet', 'Client', 'Rectifs', '# Fois', 'Créé le', 'Échéance', 'Terminé réel', 'Date rectifs'].map(h => (
                                        <th key={h} className="px-5 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-gray-500 max-w-[200px] border-r border-gray-100 dark:border-gray-800 last:border-r-0 dark:text-gray-400">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                                {groupedTaches.length === 0 ? (
                                    <tr><td colSpan={11} className="py-16 text-center text-gray-400 text-sm">Aucun rectif tâche trouvé</td></tr>
                                ) : groupedTaches.map((group, gIdx) => {
                                    const latest = group[0];
                                    const hasHistory = group.length > 1;
                                    const isExpanded = latest.tacheId ? expandedTaches.has(latest.tacheId) : false;

                                    return (
                                        <React.Fragment key={latest.id || `group-${gIdx}`}>
                                            <tr
                                                onClick={() => hasHistory && latest.tacheId && toggleTacheRow(latest.tacheId)}
                                                className={`transition-colors ${hasHistory ? 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800' : 'hover:bg-gray-50/50 dark:hover:bg-gray-800/30'} ${isExpanded ? 'bg-brand-50/10 dark:bg-brand-900/5' : ''}`}
                                            >
                                                <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-200 whitespace-nowrap">
                                                    {latest.employePrenom} {latest.employeNom}
                                                </td>
                                                <td className="px-4 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                                                    {latest.managerPrenom} {latest.managerNom}
                                                </td>
                                                <td className="px-4 py-3 max-w-[160px]">
                                                    <span className="text-gray-800 dark:text-gray-200 font-medium line-clamp-1 flex items-center gap-2">
                                                        {hasHistory && (
                                                            <span className={`text-brand-500 transition-transform ${isExpanded ? 'rotate-90' : ''}`}>▶</span>
                                                        )}
                                                        {latest.tacheTitre || '—'}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">{latest.projetNom || '—'}</td>
                                                <td className="px-4 py-3">
                                                    {latest.clientNom
                                                        ? <span className="inline-flex rounded-full bg-brand-50 px-2.5 py-0.5 text-[11px] font-semibold text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">{latest.clientNom}</span>
                                                        : <span className="text-gray-400">—</span>}
                                                </td>
                                                <td className="px-4 py-3 max-w-[220px]">
                                                    <p className="text-gray-700 dark:text-gray-300 text-xs italic line-clamp-2">"{latest.contenu}"</p>
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${latest.nombreFois >= 3 ? 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400' : latest.nombreFois === 2 ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'}`}>
                                                        {latest.nombreFois}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">{fmt(latest.tacheDateCreation)}</td>
                                                <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">{fmt(latest.tacheDateEcheance)}</td>
                                                <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">{fmtDt(latest.tacheDateFinExecution)}</td>
                                                <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">{fmtDt(latest.dateReactif)}</td>
                                            </tr>
                                            {isExpanded && group.slice(1).map((r, i) => (
                                                <tr key={r.id || `hist-${i}`} className="bg-gray-50 border-none dark:bg-gray-800/40 opacity-80 scale-y-95 origin-top transition-all">
                                                    <td colSpan={5} className="px-4 py-2 border-l-4 border-brand-300 dark:border-brand-600 text-right">
                                                        <span className="text-[10px] uppercase text-gray-400 tracking-wider">Rectifs Précédents (Fois #{r.nombreFois}) →</span>
                                                        <span className="text-[11px] font-medium text-gray-700 dark:text-gray-300">"{r.contenu}"</span>
                                                    </td>
                                                    <td className="px-4 py-2 max-w-[220px] opacity-75">
                                                        <p className="text-gray-600 dark:text-gray-400 text-xs italic line-clamp-2">"{r.contenu}"</p>
                                                    </td>
                                                    <td colSpan={4}></td>
                                                    <td className="px-4 py-2 text-xs text-gray-400 whitespace-nowrap">{fmtDt(r.dateReactif)}</td>
                                                </tr>
                                            ))}
                                        </React.Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                // ── MEDIA PLANS TAB: Client → Batch → History accordion ──
                <div className="space-y-3">
                    {mpByClient.length === 0 ? (
                        <div className="py-16 text-center text-gray-400 text-sm border border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
                            Aucun rectif media plan trouvé
                        </div>
                    ) : mpByClient.map(([clientId, { clientNom, reactifs }]) => {
                        const isClientOpen = expandedClients.has(clientId);
                        const batches = buildBatches(reactifs);
                        const refusCount = reactifs.length;
                        const batchCount = batches.length;
                        return (
                            <div key={clientId} className="rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden bg-white dark:bg-gray-dark shadow-sm">
                                {/* Client header */}
                                <button
                                    onClick={() => toggleClient(clientId)}
                                    className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="h-9 w-9 rounded-full bg-gradient-to-br from-brand-400 to-violet-500 flex items-center justify-center text-white text-sm font-bold shrink-0">
                                            {clientNom.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="text-left">
                                            <p className="font-semibold text-gray-900 dark:text-white">{clientNom}</p>
                                            <p className="text-xs text-gray-400">{batchCount} media plan{batchCount > 1 ? 's' : ''} refusé{batchCount > 1 ? 's' : ''} · {refusCount} refus au total</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className={`inline-flex h-7 min-w-[28px] px-2 items-center justify-center rounded-full text-xs font-bold ${refusCount >= 5 ? 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400' : refusCount >= 2 ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'}`}>{refusCount}</span>
                                        <span className={`text-brand-500 transition-transform duration-200 ${isClientOpen ? 'rotate-90' : ''}`}>▶</span>
                                    </div>
                                </button>

                                {/* Batches list */}
                                {isClientOpen && (
                                    <div className="border-t border-gray-100 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800">
                                        {batches.map(batch => {
                                            const isBatchOpen = expandedBatches.has(batch.mpId);
                                            const latest = batch.reactifs[0];
                                            return (
                                                <div key={batch.mpId}>
                                                    {/* Batch header */}
                                                    <button
                                                        onClick={() => toggleBatch(batch.mpId)}
                                                        className="w-full flex items-center justify-between px-6 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors"
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <span className={`inline-flex h-2 w-2 rounded-full ${(batch as any).nbLignes >= 3 ? 'bg-red-500' : (batch as any).nbLignes >= 2 ? 'bg-amber-400' : 'bg-gray-300'}`} />
                                                            <div className="text-left">
                                                                <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{batch.monthLabel}</p>
                                                                <p className="text-[11px] text-gray-400">Par {batch.employeNom} · {(batch as any).nbLignes || 1} ligne{(batch as any).nbLignes > 1 ? 's' : ''} refusée{(batch as any).nbLignes > 1 ? 's' : ''} · {fmtDt(latest?.dateReactif)}</p>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <span className={`inline-flex h-6 min-w-[24px] px-1.5 items-center justify-center rounded-full text-xs font-bold ${(batch as any).nbLignes >= 3 ? 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400' : (batch as any).nbLignes >= 2 ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'}`}>{(batch as any).nbLignes || 1} ligne{(batch as any).nbLignes > 1 ? 's' : ''}</span>
                                                        </div>
                                                    </button>

                                                    {isBatchOpen && (
                                                        <div className="px-6 pb-4 pt-1 space-y-2">
                                                            {batch.reactifs.map((r, idx) => (
                                                                <div key={r.id || idx} className="rounded-xl p-3 border text-sm bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800">
                                                                    <div className="flex items-center justify-between gap-2 mb-1">
                                                                        <span className="text-[12px] font-bold text-gray-800 dark:text-gray-200">{r.mediaPlanTitre || 'Ligne'}</span>
                                                                        <span className="text-[11px] text-gray-500 whitespace-nowrap">{fmtDt(r.dateReactif)} · fois {r.nombreFois}</span>
                                                                    </div>
                                                                    <p className="italic text-gray-700 dark:text-gray-300">"{r.contenu}"</p>
                                                                    <p className="text-[11px] text-gray-500 mt-1">Par {r.managerPrenom || '—'} {r.managerNom || ''} · employé {r.employePrenom || ''} {r.employeNom || ''}</p>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default ReactifInternPage;
