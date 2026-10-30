import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { demandeService } from '../api/demandeService';
import { referentielService } from '../api/referentielService';
import { calendrierService } from '../api/calendrierService';
import { employeService } from '../api/employeService';
import { TypeDemande, TypeConge, TypeCongeLabels, Referentiel, CalendrierJour, HoraireTravail, CalculateDaysResult, SoldeCongeInfo, EmployeHoraire } from '../types';
import Button from '../components/ui/Button';
import { useAuth } from '../context/AuthContext';
import type { InterimaireOption } from '../api/demandeService';
import { HiOutlineChevronLeft, HiOutlineChevronRight, HiOutlineCheckCircle } from 'react-icons/hi';
import { useTachesObligatoires } from '../hooks/useTachesObligatoires';
import { normalizeGenre } from '../utils/genre';

// Map JS Date.getDay() (0=Sunday) to French day names used in joursTravail
const DOW_TO_JOUR: Record<number, string> = {
  0: 'DIMANCHE',
  1: 'LUNDI',
  2: 'MARDI',
  3: 'MERCREDI',
  4: 'JEUDI',
  5: 'VENDREDI',
  6: 'SAMEDI',
};

const JOUR_TO_SHORT: Record<string, string> = {
  DIMANCHE: 'Dimanche',
  LUNDI: 'Lundi',
  MARDI: 'Mardi',
  MERCREDI: 'Mercredi',
  JEUDI: 'Jeudi',
  VENDREDI: 'Vendredi',
  SAMEDI: 'Samedi',
};

const buildFallbackCongeTypes = (): Referentiel[] =>
  Object.values(TypeConge).map((value, index) => ({
    id: -(index + 1),
    libelle: value,
    description: TypeCongeLabels[value],
    actif: true,
    typeReferentiel: 'TYPE_CONGE',
    typeReferentielLabel: 'Type congé',
  }));

/**
 * Find the applicable horaire for a given date string (YYYY-MM-DD).
 * Priority: period-specific horaire (dateDebut/dateFin set) > year-round (no dates).
 */
function getHoraireForDate(horaires: HoraireTravail[], dateStr: string): HoraireTravail | null {
  // First try to find a period-specific horaire covering this date
  const specific = horaires.find((h) => {
    if (!h.dateDebut && !h.dateFin) return false;
    const from = h.dateDebut || '0000-01-01';
    const to = h.dateFin || '9999-12-31';
    return dateStr >= from && dateStr <= to;
  });
  if (specific) return specific;
  // Fallback to year-round horaire
  const yearRound = horaires.find((h) => !h.dateDebut && !h.dateFin);
  if (yearRound) return yearRound;
  // Last resort: first horaire
  return horaires.length > 0 ? horaires[0] : null;
}

function isOffDay(horaires: HoraireTravail[], dateStr: string, jourName: string): boolean {
  const h = getHoraireForDate(horaires, dateStr);
  if (!h) return false;
  const jours = h.joursTravail.split(',').map((j) => j.trim().toUpperCase()).filter(Boolean);
  return !jours.includes(jourName);
}

// ─── Mini Calendar Component ───────────────────────────────────────────
interface MiniCalendarProps {
  holidays: CalendrierJour[];
  dateDebut: string;
  dateFin: string;
  horaires: HoraireTravail[];
  blockedDates?: Set<string>;
  onDateClick?: (dateStr: string) => void;
}

const MiniCalendar: React.FC<MiniCalendarProps> = ({ holidays, dateDebut, dateFin, horaires, blockedDates = new Set(), onDateClick }) => {
  const [viewDate, setViewDate] = useState(() => {
    if (dateDebut) return new Date(dateDebut + 'T00:00:00');
    return new Date();
  });

  useEffect(() => {
    if (dateDebut) setViewDate(new Date(dateDebut + 'T00:00:00'));
  }, [dateDebut]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const holidaySet = useMemo(() => {
    const set = new Map<string, CalendrierJour>();
    holidays.forEach((h) => set.set(h.dateJour, h));
    return set;
  }, [holidays]);

  const selectedRange = useMemo(() => {
    if (!dateDebut || !dateFin) return new Set<string>();
    const set = new Set<string>();
    const start = new Date(dateDebut + 'T00:00:00');
    const end = new Date(dateFin + 'T00:00:00');
    const cur = new Date(start);
    while (cur <= end) {
      const y = cur.getFullYear();
      const m = String(cur.getMonth() + 1).padStart(2, '0');
      const d = String(cur.getDate()).padStart(2, '0');
      set.add(`${y}-${m}-${d}`);
      cur.setDate(cur.getDate() + 1);
    }
    return set;
  }, [dateDebut, dateFin]);

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startOffset = (firstDay.getDay() + 6) % 7; // Monday = 0
  const daysInMonth = lastDay.getDate();

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1));

  const monthName = viewDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

  const days: (number | null)[] = [];
  for (let i = 0; i < startOffset; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(d);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
      <div className="flex items-center justify-between mb-3">
        <button type="button" onClick={prevMonth} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800">
          <HiOutlineChevronLeft size={16} />
        </button>
        <span className="text-theme-sm font-semibold text-gray-800 dark:text-white capitalize">{monthName}</span>
        <button type="button" onClick={nextMonth} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800">
          <HiOutlineChevronRight size={16} />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-center">
        {['Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa', 'Di'].map((d) => (
          <div key={d} className="text-theme-xs font-medium text-gray-400 dark:text-gray-500 py-1">{d}</div>
        ))}
        {days.map((day, i) => {
          if (day === null) return <div key={`empty-${i}`} />;
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const dt = new Date(year, month, day);
          const dow = dt.getDay();
          const jourName = DOW_TO_JOUR[dow];
          const off = isOffDay(horaires, dateStr, jourName);
          const holiday = holidaySet.get(dateStr);
          const isSelected = selectedRange.has(dateStr);

          const isBlocked = blockedDates.has(dateStr);

          let bg = '';
          let textColor = 'text-gray-700 dark:text-gray-300';
          let title = '';

          if (isBlocked) {
            bg = 'bg-yellow-100 dark:bg-yellow-500/20';
            textColor = 'text-yellow-700 dark:text-yellow-400 font-semibold';
            title = 'Tâche obligatoire — congé non autorisé';
          }

          if (holiday) {
            bg = 'bg-error-100 dark:bg-error-500/20';
            textColor = 'text-error-600 dark:text-error-400 font-semibold';
            title = `${holiday.nomJour}${holiday.description ? ' — ' + holiday.description : ''}`;
          } else if (off) {
            bg = 'bg-gray-100 dark:bg-gray-800';
            textColor = 'text-gray-400 dark:text-gray-600';
            title = `${JOUR_TO_SHORT[jourName] || jourName} (repos)`;
          }

          if (isSelected && !holiday && !off) {
            bg = 'bg-brand-100 dark:bg-brand-500/20';
            textColor = 'text-brand-600 dark:text-brand-400 font-semibold';
          } else if (isSelected && (holiday || off)) {
            bg += ' ring-2 ring-brand-400';
          }

          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const isPast = dt < today;
          const clickable = onDateClick && !isPast;

          return (
            <div
              key={dateStr}
              title={title}
              onClick={() => clickable && onDateClick(dateStr)}
              className={`w-8 h-8 mx-auto flex items-center justify-center rounded-md text-theme-xs ${clickable ? 'cursor-pointer hover:ring-2 hover:ring-brand-300' : 'cursor-default'} ${isPast ? 'opacity-40' : ''} ${bg} ${textColor}`}
            >
              {day}
            </div>
          );
        })}
      </div>
      {/* Legend */}
      <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-1.5 text-theme-xs text-gray-500">
          <div className="w-3 h-3 rounded bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700" />
          Repos
        </div>
        <div className="flex items-center gap-1.5 text-theme-xs text-gray-500">
          <div className="w-3 h-3 rounded bg-error-100 dark:bg-error-500/20 border border-error-200 dark:border-error-500/30" />
          Jour férié
        </div>
        <div className="flex items-center gap-1.5 text-theme-xs text-gray-500">
          <div className="w-3 h-3 rounded bg-brand-100 dark:bg-brand-500/20 border border-brand-200 dark:border-brand-500/30" />
          Sélection
        </div>
        <div className="flex items-center gap-1.5 text-theme-xs text-gray-500">
          <div className="w-3 h-3 rounded bg-yellow-100 dark:bg-yellow-500/20 border border-yellow-200 dark:border-yellow-500/30" />
          Tâche obligatoire
        </div>
      </div>
      {/* Show holidays list for current view */}
      {holidays.filter((h) => {
        const d = new Date(h.dateJour + 'T00:00:00');
        return d.getMonth() === month && d.getFullYear() === year;
      }).length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 space-y-1.5">
            <p className="text-theme-xs font-medium text-gray-500 dark:text-gray-400">Jours fériés ce mois :</p>
            {holidays
              .filter((h) => {
                const d = new Date(h.dateJour + 'T00:00:00');
                return d.getMonth() === month && d.getFullYear() === year;
              })
              .map((h) => (
                <div key={h.id} className="flex items-center gap-2 text-theme-xs">
                  <span className="text-error-500 font-medium">{new Date(h.dateJour + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span>
                  <span className="text-gray-600 dark:text-gray-400">{h.nomJour}</span>
                </div>
              ))}
          </div>
        )}
    </div>
  );
};

// ─── Main Page ──────────────────────────────────────────────────────────
const NewDemandePage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { id: editId } = useParams<{ id?: string }>();
  const isEditMode = !!editId;
  const { blockedDates } = useTachesObligatoires(user?.employeId);
  const [type, setType] = useState<TypeDemande>(TypeDemande.CONGE);
  const [typeConge, setTypeConge] = useState('');
  const [congeTypes, setCongeTypes] = useState<Referentiel[]>([]);
  const [holidays, setHolidays] = useState<CalendrierJour[]>([]);
  const [allHoraires, setAllHoraires] = useState<HoraireTravail[]>([]);
  const [raison, setRaison] = useState('');
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');
  const [date, setDate] = useState('');
  const [heureDebut, setHeureDebut] = useState('');
  const [heureFin, setHeureFin] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [justificatif, setJustificatif] = useState<File | null>(null);
  const [calcResult, setCalcResult] = useState<CalculateDaysResult | null>(null);
  const [calcLoading, setCalcLoading] = useState(false);
  const [soldeInfo, setSoldeInfo] = useState<SoldeCongeInfo | null>(null);
  const [employeHoraire, setEmployeHoraire] = useState<EmployeHoraire | null>(null);
  const [autorisationWarnings, setAutorisationWarnings] = useState<string[]>([]);
  // Chef de département : l'employé qui validera à sa place pendant son congé
  const isChefDepartement = !!(user?.managerDepartement && user?.departement);
  const [delegueId, setDelegueId] = useState('');
  const [interimaires, setInterimaires] = useState<InterimaireOption[]>([]);

  useEffect(() => {
    if (!isChefDepartement) return;
    demandeService.getInterimaires()
      .then((res) => setInterimaires(res.data.data || []))
      .catch(() => setInterimaires([]));
  }, [isChefDepartement]);

  // Load existing demande for edit mode
  useEffect(() => {
    if (!editId) return;
    const loadDemande = async () => {
      setEditLoading(true);
      try {
        const res = await demandeService.getById(Number(editId));
        const d = res.data.data;
        if (!d) throw new Error('Demande introuvable');
        if (d.statut !== 'EN_ATTENTE') {
          setError('Seules les demandes en attente peuvent être modifiées');
          return;
        }
        setType(d.type as TypeDemande);
        setRaison(d.raison || '');
        if (d.type === 'CONGE') {
          setTypeConge(d.typeConge || '');
          setDelegueId(d.delegueId ? String(d.delegueId) : '');
          setDateDebut(d.dateDebut || '');
          setDateFin(d.dateFin || '');
        } else if (d.type === 'TELETRAVAIL') {
          setDateDebut(d.dateDebut || '');
          setDateFin(d.dateFin || '');
        } else if (d.type === 'AUTORISATION') {
          setDate(d.date || '');
          setHeureDebut(d.heureDebut || '');
          setHeureFin(d.heureFin || '');
        }
      } catch (err: any) {
        setError(err.response?.data?.message || err.message || 'Erreur lors du chargement de la demande');
      } finally {
        setEditLoading(false);
      }
    };
    loadDemande();
  }, [editId]);

  // Types requiring mandatory justificatif
  const TYPES_REQUIRING_JUSTIFICATIF = [
    'CONGE_MALADIE',
    'CONGE_DECES_PROCHE',
    'CONGE_DECES_FAMILLE',
    'CONGE_MATERNITE',
  ];

  // Types where nombre de jours is fixed (not user-chosen)
  const FIXED_DAYS_TYPES: Record<string, number> = {
    CONGE_DECES_PROCHE: 5,
    CONGE_DECES_FAMILLE: 1,
  };

  const isFixedDays = typeConge in FIXED_DAYS_TYPES;

  const needsJustificatif = type === TypeDemande.CONGE && TYPES_REQUIRING_JUSTIFICATIF.includes(typeConge);

  // Call backend to compute effective days when dates change
  const computeDays = useCallback(async (debut: string, fin: string, tc: string) => {
    if (!debut || !fin) {
      setCalcResult(null);
      return;
    }
    setCalcLoading(true);
    try {
      const res = await demandeService.calculateDays(debut, fin, tc || 'CONGE_PAYE');
      setCalcResult(res.data.data);
    } catch {
      setCalcResult(null);
    } finally {
      setCalcLoading(false);
    }
  }, []);

  // When dates or type change, auto-compute effective days
  useEffect(() => {
    if (type !== TypeDemande.CONGE || isFixedDays) return;
    const timer = setTimeout(() => {
      computeDays(dateDebut, dateFin, typeConge);
    }, 300);
    return () => clearTimeout(timer);
  }, [dateDebut, dateFin, typeConge, type, isFixedDays, computeDays]);

  // For single-day leave, auto-match dateFin to dateDebut
  useEffect(() => {
    if (type === TypeDemande.CONGE && dateDebut && !dateFin) {
      setDateFin(dateDebut);
    }
  }, [dateDebut, type]);

  // Effective nombre de jours (from API or fixed)
  const effectiveNombreJours = isFixedDays
    ? FIXED_DAYS_TYPES[typeConge]
    : calcResult?.nombreJours ?? 0;

  // 3× rule: la demande doit être faite 3 × nombre_de_jours jours à l'avance
  const delaiMinJours = effectiveNombreJours * 3;
  const rule3xWarning = useMemo(() => {
    if (effectiveNombreJours <= 0 || !dateDebut) return null;
    if (typeConge !== 'CONGE_PAYE') return null;
    const today = new Date();
    const limit = new Date();
    limit.setDate(limit.getDate() + delaiMinJours);
    const debutDate = new Date(dateDebut + 'T00:00:00');
    if (debutDate < limit) {
      return `Selon le règlement, cette demande de ${effectiveNombreJours} jour(s) effectif(s) doit être faite au moins ${delaiMinJours} jours à l'avance (3 × ${effectiveNombreJours}). Date début au plus tôt : ${limit.toLocaleDateString('fr-FR')}`;
    }
    return null;
  }, [effectiveNombreJours, delaiMinJours, dateDebut, typeConge]);

  // ─── Autorisation: fetch company horaire once on mount ───
  useEffect(() => {
    if (type !== TypeDemande.AUTORISATION) {
      return;
    }
    const fetchHoraire = async () => {
      try {
        const res = await employeService.getHoraireEntreprise();
        setEmployeHoraire(res.data.data || null);
      } catch {
        setEmployeHoraire(null);
      }
    };
    fetchHoraire();
  }, [type]);

  // ─── Autorisation: validate times against horaire ───
  useEffect(() => {
    if (type !== TypeDemande.AUTORISATION) {
      setAutorisationWarnings([]);
      return;
    }
    const warnings: string[] = [];

    if (employeHoraire && date) {
      // Check if the day is a working day
      const DOW_MAP: Record<number, string> = {
        0: 'DIMANCHE', 1: 'LUNDI', 2: 'MARDI', 3: 'MERCREDI',
        4: 'JEUDI', 5: 'VENDREDI', 6: 'SAMEDI',
      };
      const dayOfWeek = new Date(date + 'T00:00:00').getDay();
      const jourName = DOW_MAP[dayOfWeek];
      const joursTravail = employeHoraire.joursTravail.split(',').map((j) => j.trim().toUpperCase());
      if (!joursTravail.includes(jourName)) {
        warnings.push(`Vous ne travaillez pas le ${jourName.charAt(0) + jourName.slice(1).toLowerCase()}. Jours de travail : ${joursTravail.join(', ')}`);
      }

      // Check times within working hours
      if (heureDebut && heureDebut < employeHoraire.heureDebut) {
        warnings.push(`L'heure de début (${heureDebut}) est avant le début du travail (${employeHoraire.heureDebut})`);
      }
      if (heureFin && heureFin > employeHoraire.heureFin) {
        warnings.push(`L'heure de fin (${heureFin}) est après la fin du travail (${employeHoraire.heureFin})`);
      }
    }

    // Check duration (max from referentiels — MAX_AUTORISATION_MINUTES)
    const maxMinutes = employeHoraire ? parseInt(employeHoraire.maxAutorisationMinutes, 10) || 120 : 120;
    if (heureDebut && heureFin && heureFin > heureDebut) {
      const [hd, md] = heureDebut.split(':').map(Number);
      const [hf, mf] = heureFin.split(':').map(Number);
      const dureeMin = (hf * 60 + mf) - (hd * 60 + md);
      if (dureeMin > maxMinutes) {
        const maxH = Math.floor(maxMinutes / 60);
        const maxM = maxMinutes % 60;
        warnings.push(`La durée (${Math.floor(dureeMin / 60)}h${String(dureeMin % 60).padStart(2, '0')}) dépasse le maximum autorisé de ${maxH}h${String(maxM).padStart(2, '0')}`);
      }
    }

    if (heureDebut && heureFin && heureFin <= heureDebut) {
      warnings.push("L'heure de fin doit être après l'heure de début");
    }

    setAutorisationWarnings(warnings);
  }, [type, date, heureDebut, heureFin, employeHoraire]);

  // Load active congé types from referentiels + solde info
  useEffect(() => {
    const loadData = async () => {
      try {
        const [congeRes, calRes, horairesRes] = await Promise.all([
          referentielService.getActiveByType('TYPE_CONGE'),
          calendrierService.getAllJours(),
          calendrierService.getAllHoraires(),
        ]);
        if (user?.employeId) {
          try {
            const soldeRes = await employeService.getSoldeInfo(user.employeId);
            setSoldeInfo(soldeRes.data.data || null);
          } catch { /* ignore */ }
        }
        let types: Referentiel[] = congeRes.data.data || [];
        if (types.length === 0) {
          types = buildFallbackCongeTypes();
        }

        // Gender-based filtering
        const genre = normalizeGenre(user?.genre);
        if (genre === 'HOMME') {
          types = types.filter((t) => t.libelle !== 'CONGE_MATERNITE' && t.libelle !== 'CONGE_REGLES');
        } else if (genre === 'FEMME') {
          types = types.filter((t) => t.libelle !== 'CONGE_PATERNITE');
        }

        setCongeTypes(types);
        if (types.length > 0 && !typeConge) {
          setTypeConge(types[0].libelle);
        }
        setHolidays((calRes.data.data || []).filter((j: CalendrierJour) => j.typeJour === 'FERIE'));
        setAllHoraires(horairesRes.data.data || []);
      } catch (err) {
        console.error('Erreur chargement données:', err);
        const fallbackTypes = buildFallbackCongeTypes();
        setCongeTypes(fallbackTypes);
        if (fallbackTypes.length > 0 && !typeConge) {
          setTypeConge(fallbackTypes[0].libelle);
        }
      }
    };
    loadData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setError('');

    // Block submission if any selected date falls on a tache obligatoire
    if (type === TypeDemande.CONGE && dateDebut) {
      const rangeDates = dateFin ? (() => {
        const dates: string[] = [];
        const cur = new Date(dateDebut + 'T00:00:00');
        const last = new Date(dateFin + 'T00:00:00');
        while (cur <= last) {
          const y = cur.getFullYear();
          const m = String(cur.getMonth() + 1).padStart(2, '0');
          const d = String(cur.getDate()).padStart(2, '0');
          dates.push(`${y}-${m}-${d}`);
          cur.setDate(cur.getDate() + 1);
        }
        return dates;
      })() : [dateDebut];
      const conflict = rangeDates.find((d) => blockedDates.has(d));
      if (conflict) {
        setError(`Vous avez une tâche obligatoire le ${conflict}. Le congé n'est pas autorisé ce jour-là.`);
        return;
      }
    }

    if (type === TypeDemande.CONGE && isChefDepartement && !delegueId) {
      setError('Choisissez l\'employé qui validera les demandes de votre département pendant votre congé.');
      return;
    }

    // Validate justificatif
    if (needsJustificatif && !justificatif) {
      const docNames: Record<string, string> = {
        CONGE_MALADIE: 'certificat médical',
        CONGE_DECES_PROCHE: 'attestation de décès',
        CONGE_DECES_FAMILLE: 'attestation de décès',
        CONGE_MATERNITE: "certificat médical / attestation d'accouchement",
      };
      setError(`Un ${docNames[typeConge] || 'justificatif'} est obligatoire pour ce type de congé`);
      return;
    }

    setLoading(true);

    try {
      const data: Record<string, unknown> = {
        type,
        raison,
        employeId: user.employeId,
      };

      if (type === TypeDemande.CONGE) {
        data.typeConge = typeConge;
        data.dateDebut = dateDebut;
        data.dateFin = dateFin || dateDebut;
        if (isChefDepartement) data.delegueId = Number(delegueId);
      } else if (type === TypeDemande.TELETRAVAIL) {
        data.dateDebut = dateDebut;
        data.dateFin = dateFin;
      } else if (type === TypeDemande.AUTORISATION) {
        data.date = date;
        data.heureDebut = heureDebut;
        data.heureFin = heureFin;
      }

      if (isEditMode) {
        // Update existing demande
        if (justificatif) {
          await demandeService.updateWithFile(Number(editId), data as any, justificatif);
        } else {
          await demandeService.update(Number(editId), data as any);
        }
        setSuccess('Demande modifiée avec succès');
        setTimeout(() => navigate('/mes-demandes'), 1200);
      } else if (justificatif) {
        await demandeService.createWithFile(data as any, justificatif);
        navigate('/mes-demandes');
      } else {
        await demandeService.create(data as any);
        navigate('/mes-demandes');
      }
    } catch (err: any) {
      setSuccess('');
      setError(err.response?.data?.message || (isEditMode ? 'Erreur lors de la modification' : 'Erreur lors de la création'));
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    'h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 text-theme-sm text-gray-700 focus:border-brand-300 focus:outline-none focus:ring focus:ring-brand-500/10 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-300';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-title-sm font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-gray-900 to-[#683b77] dark:from-white dark:to-[#ab78c3]">
          {isEditMode ? 'Modifier la demande' : 'Nouvelle demande'}
        </h1>
        <p className="text-theme-sm text-gray-500 dark:text-gray-400 mt-1">
          {isEditMode ? 'Modifier votre demande en attente' : 'Créer une nouvelle demande de congé, autorisation ou télétravail'}
        </p>
      </div>

      {/* Success message */}
      {success && (
        <div className="flex items-center gap-3 rounded-lg border border-success-200 bg-success-50 px-4 py-3 dark:border-success-500/30 dark:bg-success-500/10">
          <HiOutlineCheckCircle className="text-success-500 shrink-0" size={20} />
          <p className="text-theme-sm text-success-700 dark:text-success-400">{success}</p>
          <button
            onClick={() => navigate('/mes-demandes')}
            className="ml-auto text-theme-sm font-medium text-brand-500 hover:text-brand-600"
          >
            Voir mes demandes →
          </button>
        </div>
      )}

      {editLoading ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">Chargement de la demande...</div>
      ) : (

        <div className={type === TypeDemande.CONGE ? 'flex gap-6' : ''}>
          {/* Form */}
          <div className={`rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-dark ${type === TypeDemande.CONGE ? 'flex-1' : ''}`}>
            {error && (
              <div className="mb-4 rounded-lg border border-error-200 bg-error-50 p-3 text-theme-sm text-error-600 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-400">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Type de demande */}
              <div>
                <label className="mb-1.5 block text-theme-sm font-medium text-gray-700 dark:text-gray-300">
                  Type de demande
                </label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as TypeDemande)}
                  className={inputClass}
                  disabled={isEditMode}
                >
                  <option value={TypeDemande.CONGE}>Congé</option>
                  <option value={TypeDemande.AUTORISATION}>Autorisation</option>
                  <option value={TypeDemande.TELETRAVAIL}>Télétravail</option>
                </select>
              </div>

              {/* Type de congé - fetched from DB */}
              {type === TypeDemande.CONGE && (
                <div>
                  <label className="mb-1.5 block text-theme-sm font-medium text-gray-700 dark:text-gray-300">
                    Type de congé
                  </label>
                  <select
                    value={typeConge}
                    onChange={(e) => setTypeConge(e.target.value)}
                    className={inputClass}
                  >
                    {congeTypes.length === 0 && (
                      <option value="">Chargement...</option>
                    )}
                    {congeTypes.map((tc) => (
                      <option key={tc.id} value={tc.libelle}>
                        {tc.description || tc.libelle}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Date fields for CONGE */}
              {type === TypeDemande.CONGE && (
                <div className="space-y-4">
                  {isFixedDays && (
                    <div>
                      <label className="mb-1.5 block text-theme-sm font-medium text-gray-700 dark:text-gray-300">
                        Nombre de jours
                      </label>
                      <div className="h-11 flex items-center px-4 rounded-lg border border-gray-200 bg-gray-50 text-theme-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
                        {FIXED_DAYS_TYPES[typeConge]} jour(s) <span className="text-theme-xs text-gray-400 ml-2">(fixé par le règlement)</span>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-theme-sm font-medium text-gray-700 dark:text-gray-300">
                        Date début
                      </label>
                      <input
                        type="date"
                        value={dateDebut}
                        onChange={(e) => setDateDebut(e.target.value)}
                        min={new Date().toISOString().slice(0, 10)}
                        className={inputClass}
                        required
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-theme-sm font-medium text-gray-700 dark:text-gray-300">
                        Date fin
                      </label>
                      <input
                        type="date"
                        value={dateFin}
                        onChange={(e) => setDateFin(e.target.value)}
                        min={dateDebut || undefined}
                        className={inputClass}
                        required
                      />
                    </div>
                  </div>

                  {/* Computed effective days info */}
                  {!isFixedDays && dateDebut && dateFin && (
                    <div className={`rounded-lg border p-3 text-theme-sm ${calcLoading
                      ? 'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800'
                      : calcResult && calcResult.nombreJours > 0
                        ? 'border-brand-200 bg-brand-50 dark:border-brand-500/30 dark:bg-brand-500/10'
                        : 'border-error-200 bg-error-50 dark:border-error-500/30 dark:bg-error-500/10'
                      }`}>
                      {calcLoading ? (
                        <p className="text-gray-500 dark:text-gray-400">Calcul en cours...</p>
                      ) : calcResult ? (
                        <div className="space-y-1">
                          <p className="font-semibold text-gray-800 dark:text-white">
                            {calcResult.nombreJours} jour(s) effectif(s) seront décomptés
                          </p>
                          <p className="text-theme-xs text-gray-600 dark:text-gray-400">
                            {calcResult.details}
                          </p>
                          {calcResult.dateDebutEffective !== dateDebut || calcResult.dateFinEffective !== dateFin ? (
                            <p className="text-theme-xs text-warning-600 dark:text-warning-400">
                              Période effective étendue : {new Date(calcResult.dateDebutEffective + 'T00:00:00').toLocaleDateString('fr-FR')} → {new Date(calcResult.dateFinEffective + 'T00:00:00').toLocaleDateString('fr-FR')}
                              {' '}(inclut weekends/jours fériés adjacents)
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  )}

                  {/* Congé règles: 1 jour max */}
                  {typeConge === 'CONGE_REGLES' && calcResult && calcResult.joursOuvrables > 1 && (
                    <div className="rounded-lg border border-error-200 bg-error-50 p-3 dark:border-error-500/30 dark:bg-error-500/10">
                      <p className="text-theme-xs text-error-600 dark:text-error-400 flex items-center gap-1.5">
                        <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                        </svg>
                        Le congé règles est limité à 1 jour ouvrable uniquement.
                      </p>
                    </div>
                  )}

                  {/* Congé maladie max 2 jours */}
                  {typeConge === 'CONGE_MALADIE' && calcResult && calcResult.joursOuvrables > 2 && (
                    <div className="rounded-lg border border-error-200 bg-error-50 p-3 dark:border-error-500/30 dark:bg-error-500/10">
                      <p className="text-theme-xs text-error-600 dark:text-error-400 flex items-center gap-1.5">
                        <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                        </svg>
                        Le congé maladie est limité à 2 jours ouvrables maximum ({calcResult.joursOuvrables} sélectionné{calcResult.joursOuvrables > 1 ? 's' : ''}).
                      </p>
                    </div>
                  )}
                  {typeConge === 'CONGE_MALADIE' && (!calcResult || calcResult.joursOuvrables <= 2) && (
                    <p className="text-theme-xs text-gray-500 dark:text-gray-400">
                      Le congé maladie est limité à 2 jours ouvrables. Au-delà, l'accord du responsable est requis.
                    </p>
                  )}

                  {/* 3× rule warning */}
                  {rule3xWarning && (
                    <div className="rounded-lg border border-warning-200 bg-warning-50 p-3 dark:border-warning-500/30 dark:bg-warning-500/10">
                      <p className="text-theme-xs text-warning-600 dark:text-warning-400 flex items-center gap-1.5">
                        <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                        </svg>
                        {rule3xWarning}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Date fields for TELETRAVAIL */}
              {type === TypeDemande.TELETRAVAIL && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-theme-sm font-medium text-gray-700 dark:text-gray-300">
                      Date début
                    </label>
                    <input
                      type="date"
                      value={dateDebut}
                      onChange={(e) => setDateDebut(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                      className={inputClass}
                      required
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-theme-sm font-medium text-gray-700 dark:text-gray-300">
                      Date fin
                    </label>
                    <input
                      type="date"
                      value={dateFin}
                      onChange={(e) => setDateFin(e.target.value)}
                      min={dateDebut || new Date().toISOString().split('T')[0]}
                      className={inputClass}
                      required
                    />
                  </div>
                </div>
              )}

              {/* Date/Time fields for AUTORISATION */}
              {type === TypeDemande.AUTORISATION && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <label className="mb-1.5 block text-theme-sm font-medium text-gray-700 dark:text-gray-300">
                      Date
                    </label>
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                      className={inputClass}
                      required
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-theme-sm font-medium text-gray-700 dark:text-gray-300">
                      Heure début
                    </label>
                    <input
                      type="time"
                      value={heureDebut}
                      onChange={(e) => setHeureDebut(e.target.value)}
                      className={inputClass}
                      required
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-theme-sm font-medium text-gray-700 dark:text-gray-300">
                      Heure fin
                    </label>
                    <input
                      type="time"
                      value={heureFin}
                      onChange={(e) => setHeureFin(e.target.value)}
                      className={inputClass}
                      required
                    />
                  </div>
                </div>
              )}

              {/* Autorisation: horaire info + warnings */}
              {type === TypeDemande.AUTORISATION && employeHoraire && (
                <div className="rounded-lg border border-brand-200 bg-brand-50 px-4 py-3 text-theme-sm dark:border-brand-500/30 dark:bg-brand-500/10">
                  <p className="font-medium text-brand-700 dark:text-brand-300">
                    🕐 Horaire de l'entreprise
                  </p>
                  <p className="mt-1 text-gray-600 dark:text-gray-400">
                    {employeHoraire.heureDebut} — {employeHoraire.heureFin}
                    {employeHoraire.joursTravail && (
                      <span className="ml-2">
                        ({employeHoraire.joursTravail.split(',').map(j => j.trim().charAt(0) + j.trim().slice(1).toLowerCase()).join(', ')})
                      </span>
                    )}
                    <span className="ml-2">• Max autorisation : {Math.floor(parseInt(employeHoraire.maxAutorisationMinutes) / 60)}h{String(parseInt(employeHoraire.maxAutorisationMinutes) % 60).padStart(2, '0')}/mois</span>
                  </p>
                </div>
              )}

              {type === TypeDemande.AUTORISATION && autorisationWarnings.length > 0 && (
                <div className="rounded-lg border border-error-300 bg-error-50 px-4 py-3 dark:border-error-500/30 dark:bg-error-500/10">
                  {autorisationWarnings.map((w, i) => (
                    <p key={i} className="text-theme-sm text-error-600 dark:text-error-400">
                      ⚠ {w}
                    </p>
                  ))}
                </div>
              )}

              {/* Intérim : un chef de département confie ses validations pendant son congé */}
              {type === TypeDemande.CONGE && isChefDepartement && (
                <div className="rounded-xl border border-brand-200 bg-brand-50/60 p-4 dark:border-brand-500/30 dark:bg-brand-500/10">
                  <label className="mb-1.5 block text-theme-sm font-medium text-gray-700 dark:text-gray-300">
                    Qui valide les demandes de votre département pendant votre congé ? <span className="text-error-500">*</span>
                  </label>
                  <select value={delegueId} onChange={(e) => setDelegueId(e.target.value)} className={inputClass}>
                    <option value="">Choisir un employé</option>
                    {interimaires.map((emp) => (
                      <option key={emp.id} value={emp.id}>{emp.nom}{emp.poste ? ` — ${emp.poste}` : ''}</option>
                    ))}
                  </select>
                  <p className="mt-1.5 text-theme-xs text-gray-500 dark:text-gray-400">
                    Dès le début de votre congé, cette personne reçoit vos demandes à valider. Vous reprenez vos droits en signalant votre retour depuis « Mes demandes ».
                  </p>
                </div>
              )}

              {/* Pièce jointe / Justificatif */}
              {type === TypeDemande.CONGE && (
                <div>
                  <label className="mb-1.5 block text-theme-sm font-medium text-gray-700 dark:text-gray-300">
                    Pièce jointe {needsJustificatif && <span className="text-error-500">*</span>}
                  </label>
                  {needsJustificatif && (
                    <p className="mb-2 text-theme-xs text-warning-500">
                      {typeConge === 'CONGE_MALADIE' && 'Certificat médical obligatoire'}
                      {(typeConge === 'CONGE_DECES_PROCHE' || typeConge === 'CONGE_DECES_FAMILLE') && 'Attestation de décès obligatoire'}
                      {typeConge === 'CONGE_MATERNITE' && "Certificat médical / Attestation d'accouchement obligatoire"}
                    </p>
                  )}
                  <div className="relative">
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                      onChange={(e) => setJustificatif(e.target.files?.[0] || null)}
                      className="block w-full text-theme-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-theme-sm file:font-medium file:bg-brand-50 file:text-brand-600 hover:file:bg-brand-100 dark:text-gray-400 dark:file:bg-brand-500/10 dark:file:text-brand-400 dark:hover:file:bg-brand-500/20 cursor-pointer"
                    />
                    {justificatif && (
                      <div className="mt-2 flex items-center gap-2 text-theme-xs text-gray-600 dark:text-gray-400">
                        <svg className="h-4 w-4 text-success-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>{justificatif.name}</span>
                        <span className="text-gray-400">({(justificatif.size / 1024).toFixed(0)} Ko)</span>
                        <button
                          type="button"
                          onClick={() => setJustificatif(null)}
                          className="ml-1 text-error-500 hover:text-error-600"
                        >
                          ✕
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Raison */}
              <div>
                <label className="mb-1.5 block text-theme-sm font-medium text-gray-700 dark:text-gray-300">
                  Motif
                </label>
                <textarea
                  value={raison}
                  onChange={(e) => setRaison(e.target.value)}
                  rows={4}
                  className="w-full rounded-lg border border-gray-300 bg-transparent px-4 py-3 text-theme-sm text-gray-700 focus:border-brand-300 focus:outline-none focus:ring focus:ring-brand-500/10 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-300"
                  placeholder="Décrivez le motif de votre demande..."
                  required
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <Button variant="outline" type="button" onClick={() => navigate('/mes-demandes')}>
                  {isEditMode ? 'Retour' : 'Annuler'}
                </Button>
                {/* Solde insuffisant warning */}
                {type === TypeDemande.CONGE && typeConge === 'CONGE_PAYE' && soldeInfo && calcResult && calcResult.nombreJours > soldeInfo.soldeDisponible && (
                  <div className="flex-1 rounded-lg border border-error-300 bg-error-50 px-4 py-2 text-theme-sm text-error-600 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-400">
                    Solde congé insuffisant. Disponible : {soldeInfo.soldeDisponible}j, Demandé : {calcResult.nombreJours}j effectif(s)
                  </div>
                )}
                <Button type="submit" disabled={loading || !!rule3xWarning || (typeConge === 'CONGE_MALADIE' && !!calcResult && calcResult.joursOuvrables > 2) || (typeConge === 'CONGE_REGLES' && !!calcResult && calcResult.joursOuvrables > 1) || (typeConge === 'CONGE_PAYE' && !!soldeInfo && !!calcResult && calcResult.nombreJours > soldeInfo.soldeDisponible) || (type === TypeDemande.AUTORISATION && autorisationWarnings.length > 0)}>
                  {loading ? (isEditMode ? 'Modification...' : 'Création...') : (isEditMode ? 'Modifier la demande' : 'Soumettre la demande')}
                </Button>
              </div>
            </form>
          </div>

          {/* Calendar sidebar for CONGE */}
          {type === TypeDemande.CONGE && (
            <div className="w-72 shrink-0 space-y-4">
              <h3 className="text-theme-sm font-semibold text-gray-700 dark:text-gray-300">Calendrier entreprise</h3>
              <MiniCalendar
                holidays={holidays}
                dateDebut={dateDebut}
                dateFin={dateFin}
                horaires={allHoraires}
                blockedDates={blockedDates}
                onDateClick={(dateStr) => {
                  if (!dateDebut || (dateDebut && dateFin && dateDebut !== dateFin)) {
                    // No start yet, or range already complete → start new selection
                    setDateDebut(dateStr);
                    setDateFin(dateStr);
                  } else {
                    // First click was done (dateDebut === dateFin) → set end date
                    if (dateStr < dateDebut) {
                      setDateFin(dateDebut);
                      setDateDebut(dateStr);
                    } else {
                      setDateFin(dateStr);
                    }
                  }
                }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NewDemandePage;
