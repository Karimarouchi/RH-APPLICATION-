import React, { useState, useEffect, useMemo } from 'react';
import { HiOutlineSearch, HiOutlineChatAlt, HiOutlineUsers, HiOutlineCalendar, HiOutlinePencilAlt } from 'react-icons/hi';
import { reactifService, ReactifInternDTO } from '../api/reactifService';

// ── KPI Card ─────────────────────────────────────────────────────────────────
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
const ReactifExternPage: React.FC = () => {
    const [comments, setComments] = useState<ReactifInternDTO[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                const res = await reactifService.getAllMediaPlanExternReactifs();
                setComments(res || []);
            } catch (e) { console.error(e); }
            finally { setLoading(false); }
        };
        load();
    }, []);

    // KPI Stats
    const uniqueClients = useMemo(() => new Set(comments.map(c => c.clientId).filter(Boolean)).size, [comments]);
    const uniqueMediaPlans = useMemo(() => new Set(comments.map(c => c.mediaPlanId).filter(Boolean)).size, [comments]);
    const uniqueEmployes = useMemo(() => new Set(comments.map(c => c.employeId).filter(Boolean)).size, [comments]);

    // Count per mediaPlan
    const countPerPlan = useMemo(() => {
        const map: Record<string, number> = {};
        comments.forEach(c => {
            if (c.mediaPlanId) {
                map[String(c.mediaPlanId)] = (map[String(c.mediaPlanId)] || 0) + 1;
            }
        });
        return map;
    }, [comments]);

    const filtered = useMemo(() => {
        const q = search.toLowerCase();
        if (!q) return comments;
        return comments.filter(c =>
            c.contenu?.toLowerCase().includes(q) ||
            c.clientNom?.toLowerCase().includes(q) ||
            c.mediaPlanTitre?.toLowerCase().includes(q)
        );
    }, [comments, search]);

    const MP_MONTH_NAMES = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
        'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

    const buildBatches = (reactifs: ReactifInternDTO[]) => {
        const TIME_WINDOW_MS = 60_000; // 60 seconds

        const sorted = [...reactifs].sort((a, b) => {
            const moisCmp = (a.mediaPlanMois || '').localeCompare(b.mediaPlanMois || '');
            if (moisCmp !== 0) return moisCmp;
            return new Date(a.dateReactif).getTime() - new Date(b.dateReactif).getTime();
        });

        type RefusalEvent = { mois: string; lines: ReactifInternDTO[] };
        const events: RefusalEvent[] = [];

        for (const r of sorted) {
            const mois = r.mediaPlanMois || '';
            const t = new Date(r.dateReactif).getTime();
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
            const batchId = event.lines[0].mediaPlanId || Math.random();
            const first = event.lines[0];
            return {
                mpId: batchId,
                monthLabel: `Mediaplan de ${monthLabel || '?'} ${monthCounters[monthLabel]}`,
                clientNom: first.clientNom || '—',
                reactifs: event.lines,
                nbLignes: event.lines.length,
            };
        });
    };

    const mpByClient = useMemo(() => {
        const map = new Map<number, { clientNom: string; reactifs: ReactifInternDTO[] }>();
        for (const r of filtered) {
            const cid = r.clientId || 0;
            if (!map.has(cid)) map.set(cid, { clientNom: r.clientNom || 'Client inconnu', reactifs: [] });
            map.get(cid)!.reactifs.push(r);
        }
        return Array.from(map.entries());
    }, [filtered]);

    const [expandedClients, setExpandedClients] = useState<Set<number>>(new Set());
    const [expandedBatches, setExpandedBatches] = useState<Set<number>>(new Set());

    const toggleClient = (id: number) => setExpandedClients(prev => {
        const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n;
    });
    const toggleBatch = (id: number) => setExpandedBatches(prev => {
        const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n;
    });

    const fmtDt = (d?: string) => d ? new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';

    return (
        <div className="space-y-8 max-w-[1400px] mx-auto">

            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
                        <span className="flex items-center justify-center w-8 h-8 rounded-full bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400">
                            <HiOutlinePencilAlt size={18} />
                        </span>
                        Rectifs Externes (Clients)
                    </h2>
                    <p className="text-sm text-gray-400 mt-1">Retours et commentaires des clients sur les media plans</p>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard label="Total rectifs" value={comments.length} icon="💬"
                    gradient="from-violet-500/10 to-purple-500/10 dark:from-violet-500/5 dark:to-purple-500/5"
                    border="border-violet-200/50 dark:border-violet-500/20" />
                <KpiCard label="Media plans touchés" value={uniqueMediaPlans} icon="🎬"
                    gradient="from-brand-500/10 to-sky-500/10 dark:from-brand-500/5 dark:to-sky-500/5"
                    border="border-brand-200/50 dark:border-brand-500/20" />
                <KpiCard label="Auteurs (Clients)" value={uniqueClients} icon="✍️"
                    gradient="from-emerald-500/10 to-teal-500/10 dark:from-emerald-500/5 dark:to-teal-500/5"
                    border="border-emerald-200/50 dark:border-emerald-500/20" />
                <KpiCard label="Employés créateurs" value={uniqueEmployes} icon="🏢"
                    gradient="from-amber-500/10 to-orange-500/10 dark:from-amber-500/5 dark:to-orange-500/5"
                    border="border-amber-200/50 dark:border-amber-500/20" />
            </div>

            {/* Search */}
            <div className="relative max-w-xs">
                <HiOutlineSearch size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                    type="text"
                    value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Rechercher dans les rectifs…"
                    className="h-10 w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-dark pl-10 pr-4 text-sm focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-500/10"
                />
            </div>

            {/* Table / Accordion */}
            {loading ? (
                <div className="flex items-center justify-center py-24">
                    <div className="h-10 w-10 rounded-full border-4 border-gray-200 border-t-violet-500 animate-spin dark:border-gray-700" />
                </div>
            ) : (
                <div className="space-y-3">
                    {mpByClient.length === 0 ? (
                        <div className="py-16 text-center text-gray-400 text-sm border border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
                            Aucun rectif externe trouvé
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
                                                                <p className="text-[11px] text-gray-400">Par Client : {batch.clientNom} · {(batch as any).nbLignes || 1} ligne{(batch as any).nbLignes > 1 ? 's' : ''} refusée{(batch as any).nbLignes > 1 ? 's' : ''} · {fmtDt(latest?.dateReactif)}</p>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <span className={`inline-flex h-6 min-w-[24px] px-1.5 items-center justify-center rounded-full text-xs font-bold ${(batch as any).nbLignes >= 3 ? 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400' : (batch as any).nbLignes >= 2 ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'}`}>{(batch as any).nbLignes || 1} ligne{(batch as any).nbLignes > 1 ? 's' : ''}</span>
                                                        </div>
                                                    </button>

                                                    {/* Expanded preview per line */}
                                                    {isBatchOpen && batch.reactifs.length > 0 && (
                                                        <div className="px-10 pb-4 pt-1 space-y-3">
                                                            {batch.reactifs.map((r, idx) => (
                                                                <div key={r.id || idx} className="rounded-xl p-3 border text-sm bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800 relative shadow-sm">
                                                                    <div className="flex items-center justify-between mb-2">
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-red-500"></span>
                                                                            <span className="text-[12px] font-bold text-gray-800 dark:text-gray-200 tracking-wide line-clamp-1">
                                                                                Ligne : {r.mediaPlanTitre || 'Titre inconnu'}
                                                                            </span>
                                                                        </div>
                                                                        <span className="text-[10px] uppercase font-bold text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-500/20 px-2 py-0.5 rounded-full">Motif de refus</span>
                                                                    </div>
                                                                    <div className="pl-3 border-l-[3px] border-red-300 dark:border-red-700/50">
                                                                        <p className="italic text-gray-700 dark:text-gray-300 text-xs sm:text-sm">"{r.contenu}"</p>
                                                                        <p className="text-[11px] text-gray-500 mt-1">{fmtDt(r.dateReactif)} · client {r.clientNom || '—'} · employé {r.employePrenom || ''} {r.employeNom || ''} · fois {r.nombreFois}</p>
                                                                    </div>
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

export default ReactifExternPage;
