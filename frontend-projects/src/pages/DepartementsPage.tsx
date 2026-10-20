import React, { useState, useEffect, useMemo } from 'react';
import {
    HiOutlineSearch,
    HiOutlineChevronDown,
    HiOutlineChevronRight,
    HiOutlineUsers,
    HiOutlineOfficeBuilding,
    HiOutlineMail,
    HiOutlinePhone,
    HiOutlineBriefcase,
} from 'react-icons/hi';
import { employeService } from '../api/employeService';
import { demandeService } from '../api/demandeService';
import { referentielService } from '../api/referentielService';
import { Employe, StatutDemande } from '../types';

const DepartementsPage: React.FC = () => {
    const [employes, setEmployes] = useState<Employe[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [expandedDept, setExpandedDept] = useState<string | null>(null);
    const [congeMap, setCongeMap] = useState<Map<number, number>>(new Map());
    // All department names from Referentiel (ensures empty depts are visible)
    const [allDeptNames, setAllDeptNames] = useState<string[]>([]);
    // Employés cochés « manager du département »
    const [managerEmpIds, setManagerEmpIds] = useState<Set<number>>(new Set());

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const today = new Date().toISOString().split('T')[0];
            const [empResult, demandeResult, deptRefResult] = await Promise.allSettled([
                employeService.getAll(),
                demandeService.getByStatut(StatutDemande.APPROUVEE),
                referentielService.getByType('DEPARTEMENT'),
            ]);

            if (empResult.status === 'fulfilled') {
                setEmployes(empResult.value.data.data || []);
            }
            if (deptRefResult.status === 'fulfilled') {
                const deptRefs: any[] = (deptRefResult.value.data.data || []).filter((r: any) => r.actif);
                setAllDeptNames(deptRefs.map((r: any) => r.libelle));
            } else {
                console.warn('Dept referentiel load failed:', (deptRefResult as any).reason);
            }

            if (empResult.status === 'fulfilled') {
                const mgrIds = new Set<number>(
                    (empResult.value.data.data || [])
                        .filter((e: Employe) => !!e.managerDepartement)
                        .map((e: Employe) => e.id)
                );
                setManagerEmpIds(mgrIds);
            }

            if (demandeResult.status === 'fulfilled') {
                const map = new Map<number, number>();
                const demandes: any[] = demandeResult.value.data.data || [];
                demandes.forEach(d => {
                    if (!d.dateDebut || !d.dateFin || !d.employeId) return;
                    const debut = d.dateDebut.toString().substring(0, 10);
                    const fin = d.dateFin.toString().substring(0, 10);
                    if (debut <= today && today <= fin) {
                        const jours = d.nombreJours
                            ?? (Math.round((new Date(fin).getTime() - new Date(debut).getTime()) / 86400000) + 1);
                        map.set(d.employeId, jours);
                    }
                });
                setCongeMap(map);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    /** Group employees by department, then merge with all referentiel departments */
    const departements = useMemo(() => {
        const map = new Map<string, Employe[]>();
        // Seed all referentiel departments (even empty ones)
        for (const name of allDeptNames) {
            if (!map.has(name)) map.set(name, []);
        }
        // Add employees to their department
        for (const emp of employes) {
            const dept = emp.departement || 'Non défini';
            if (!map.has(dept)) map.set(dept, []);
            map.get(dept)!.push(emp);
        }
        return Array.from(map.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([nom, membres]) => ({ nom, membres }));
    }, [employes, allDeptNames]);

    const filtered = useMemo(() => {
        if (!search.trim()) return departements;
        const q = search.toLowerCase();
        return departements
            .map(dept => ({
                ...dept,
                membres: dept.membres.filter(
                    m =>
                        m.nom.toLowerCase().includes(q) ||
                        m.prenom.toLowerCase().includes(q) ||
                        m.email?.toLowerCase().includes(q) ||
                        dept.nom.toLowerCase().includes(q)
                ),
            }))
            .filter(dept => dept.membres.length > 0 || dept.nom.toLowerCase().includes(q));
    }, [departements, search]);

    const getInitials = (emp: Employe) =>
        `${emp.prenom?.[0] ?? ''}${emp.nom?.[0] ?? ''}`.toUpperCase();

    const avatarColors = [
        'from-violet-400 to-violet-600',
        'from-brand-400 to-brand-600',
        'from-secondary-400 to-secondary-600',
        'from-success-400 to-success-600',
        'from-warning-400 to-warning-600',
        'from-error-400 to-error-600',
    ];

    const getDeptColor = (index: number) => avatarColors[index % avatarColors.length];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h1 className="text-title-sm font-bold text-gray-800 dark:text-white">
                        Départements
                    </h1>
                    <p className="text-theme-sm text-gray-500 dark:text-gray-400 mt-1">
                        Vue des départements et leurs employés
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <span className="rounded-full bg-brand-50 px-3 py-1 text-theme-sm font-semibold text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
                        {filtered.length} département{filtered.length !== 1 ? 's' : ''}
                    </span>
                    <span className="rounded-full bg-secondary-50 px-3 py-1 text-theme-sm font-semibold text-secondary-600 dark:bg-secondary-500/10 dark:text-secondary-400">
                        {employes.length} employé{employes.length !== 1 ? 's' : ''}
                    </span>
                </div>
            </div>

            {/* Search */}
            <div className="relative max-w-sm">
                <HiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Rechercher un département ou un employé..."
                    className="h-11 w-full rounded-lg border border-gray-300 bg-transparent pl-10 pr-4 text-theme-sm text-gray-700 focus:border-brand-300 focus:outline-none focus:ring focus:ring-brand-500/10 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-300"
                />
            </div>

            {/* Content */}
            {loading ? (
                <div className="py-20 text-center text-gray-500">Chargement...</div>
            ) : filtered.length === 0 ? (
                <div className="py-20 text-center text-gray-400">Aucun département trouvé</div>
            ) : (
                <div className="space-y-3">
                    {filtered.map((dept, idx) => {
                        const isExpanded = expandedDept === dept.nom;
                        const colorClass = getDeptColor(idx);

                        return (
                            <div
                                key={dept.nom}
                                className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-dark overflow-hidden"
                            >
                                {/* Department header — click to toggle */}
                                <button
                                    onClick={() => setExpandedDept(isExpanded ? null : dept.nom)}
                                    className="w-full flex items-center gap-4 px-5 py-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors text-left"
                                >
                                    {/* Icon */}
                                    <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${colorClass} text-white shadow-sm`}>
                                        <HiOutlineOfficeBuilding size={22} />
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <p className="text-theme-sm font-semibold text-gray-800 dark:text-white truncate">
                                            {dept.nom}
                                        </p>
                                        <div className="flex items-center gap-1.5 mt-0.5">
                                            <HiOutlineUsers size={12} className="text-gray-400 shrink-0" />
                                            <p className="text-theme-xs text-gray-400">
                                                {dept.membres.length} employé{dept.membres.length !== 1 ? 's' : ''}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Member mini-avatars */}
                                    <div className="hidden sm:flex items-center -space-x-2 mr-2">
                                        {dept.membres.slice(0, 6).map(m => (
                                            <div
                                                key={m.id}
                                                title={`${m.prenom} ${m.nom}`}
                                                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-white bg-gradient-to-br ${colorClass} text-[10px] font-bold text-white dark:border-gray-dark`}
                                            >
                                                {getInitials(m)}
                                            </div>
                                        ))}
                                        {dept.membres.length > 6 && (
                                            <div className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-gray-100 text-[10px] font-semibold text-gray-500 dark:border-gray-dark dark:bg-gray-700">
                                                +{dept.membres.length - 6}
                                            </div>
                                        )}
                                    </div>

                                    {/* Chevron */}
                                    <div className="text-gray-400 shrink-0">
                                        {isExpanded
                                            ? <HiOutlineChevronDown size={18} />
                                            : <HiOutlineChevronRight size={18} />}
                                    </div>
                                </button>

                                {/* Employees grid — expanded */}
                                {isExpanded && (
                                    <div className="border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/20 px-5 py-4">
                                        {dept.membres.length === 0 ? (
                                            <p className="py-4 text-center text-theme-sm text-gray-400 italic">
                                                Aucun employé dans ce département.
                                            </p>
                                        ) : (
                                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                                                {dept.membres.map(emp => {
                                                    const isManager = managerEmpIds.has(emp.id);
                                                    return (
                                                    <div
                                                        key={emp.id}
                                                        className={`flex items-start gap-3 rounded-xl border px-4 py-3 hover:shadow-md transition-shadow ${
                                                            isManager
                                                                ? 'border-warning-200 bg-warning-50 dark:border-warning-500/20 dark:bg-warning-500/5'
                                                                : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900'
                                                        }`}
                                                    >
                                                        {/* Avatar */}
                                                        {emp.imageUrl ? (
                                                            <img
                                                                src={emp.imageUrl}
                                                                alt={`${emp.prenom} ${emp.nom}`}
                                                                className="h-10 w-10 shrink-0 rounded-full object-cover"
                                                            />
                                                        ) : (
                                                            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${isManager ? 'from-warning-400 to-warning-600' : colorClass} text-[12px] font-bold text-white`}>
                                                                {getInitials(emp)}
                                                            </div>
                                                        )}

                                                        {/* Details */}
                                                        <div className="min-w-0 flex-1">
                                                            <div className="flex items-center gap-2">
                                                                <p className={`text-theme-sm font-semibold truncate ${isManager ? 'text-warning-700 dark:text-warning-400' : 'text-gray-800 dark:text-white'}`}>
                                                                    {emp.prenom} {emp.nom}
                                                                </p>
                                                                {isManager && (
                                                                    <span className="shrink-0 rounded-full bg-warning-100 px-2 py-0.5 text-[10px] font-bold text-warning-600 dark:bg-warning-500/20 dark:text-warning-400">
                                                                        Chef
                                                                    </span>
                                                                )}
                                                            </div>
                                                            {emp.poste && (
                                                                <div className="flex items-center gap-1 mt-0.5">
                                                                    <HiOutlineBriefcase size={11} className="text-gray-400 shrink-0" />
                                                                    <p className="text-theme-xs text-gray-400 truncate">{emp.poste}</p>
                                                                </div>
                                                            )}
                                                            {emp.email && (
                                                                <div className="flex items-center gap-1 mt-0.5">
                                                                    <HiOutlineMail size={11} className="text-gray-400 shrink-0" />
                                                                    <p className="text-theme-xs text-gray-400 truncate">{emp.email}</p>
                                                                </div>
                                                            )}
                                                            {(emp.telephonePro || emp.telephone) && (
                                                                <div className="flex items-center gap-1 mt-0.5">
                                                                    <HiOutlinePhone size={11} className="text-gray-400 shrink-0" />
                                                                    <p className="text-theme-xs text-gray-400 truncate">
                                                                        {emp.telephonePro || emp.telephone}
                                                                    </p>
                                                                </div>
                                                            )}
                                                            {/* Congé badge */}
                                                            {congeMap.has(emp.id) && (
                                                                <div className="mt-1.5">
                                                                    <span className="inline-flex items-center gap-1 rounded-full bg-warning-50 px-2 py-0.5 text-[10px] font-semibold text-warning-700 dark:bg-warning-500/10 dark:text-warning-400">
                                                                        🏖️ En congé : {congeMap.get(emp.id)} jour{(congeMap.get(emp.id) ?? 0) > 1 ? 's' : ''}
                                                                    </span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                    );
                                                })}
                                            </div>
                                        )}
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

export default DepartementsPage;
