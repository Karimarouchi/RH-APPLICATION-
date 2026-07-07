// ...existing code...

import React, { useState, useEffect, useRef } from 'react';
import { HiOutlinePlus, HiOutlineSearch, HiOutlinePencil, HiOutlineTrash, HiOutlinePhotograph, HiOutlineEye, HiOutlineDownload, HiOutlineFilter, HiOutlineChartBar, HiOutlineX, HiOutlineAcademicCap, HiOutlineDocumentText, HiOutlineUpload, HiOutlineExternalLink, HiOutlineCheck, HiOutlineChevronDown, HiOutlineChevronLeft, HiOutlineChevronRight, HiOutlineCalendar, HiOutlineViewGrid, HiOutlineTable, HiOutlineArchive } from 'react-icons/hi';
import { motion } from 'framer-motion';

// ─── Custom styled select ───────────────────────────────────────────────────
interface SelectOption { value: string; label: string; }
interface FormSelectProps {
  value: string;
  onChange: (val: string) => void;
  options: SelectOption[];
  placeholder?: string;
  error?: boolean;
  className?: string;
}
const FormSelect: React.FC<FormSelectProps> = ({ value, onChange, options, placeholder = 'Sélectionner', error, className = '' }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find(o => o.value === value);

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`h-11 w-full flex items-center justify-between gap-2 rounded-lg border px-4 text-theme-sm transition-all
          ${error
            ? 'border-error-500 focus:ring-error-500/10 text-gray-700 dark:text-gray-300'
            : 'border-gray-300 dark:border-gray-600 focus:border-brand-300 focus:ring focus:ring-brand-500/10 text-gray-700 dark:text-gray-300'}
          bg-white dark:bg-gray-800 hover:border-gray-400 dark:hover:border-gray-500`}
      >
        <span className={selected ? 'text-gray-700 dark:text-gray-200' : 'text-gray-400 dark:text-gray-500'}>
          {selected ? selected.label : placeholder}
        </span>
        <HiOutlineChevronDown size={16} className={`text-gray-400 transition-transform flex-shrink-0 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-xl overflow-hidden">
          <div className="max-h-52 overflow-y-auto py-1">
            {placeholder && (
              <button
                type="button"
                onClick={() => { onChange(''); setOpen(false); }}
                className={`w-full text-left px-4 py-2.5 text-theme-sm transition-colors
                  ${!value ? 'bg-brand-50 dark:bg-brand-500/10 text-brand-600 dark:text-brand-400 font-medium' : 'text-gray-400 dark:text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
              >
                {placeholder}
              </button>
            )}
            {options.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => { onChange(opt.value); setOpen(false); }}
                className={`w-full text-left px-4 py-2.5 text-theme-sm transition-colors
                  ${value === opt.value
                    ? 'bg-brand-50 dark:bg-brand-500/10 text-brand-600 dark:text-brand-400 font-medium'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
// ────────────────────────────────────────────────────────────────────────────

// ─── Custom styled date picker ───────────────────────────────────────────────
const WEEK_DAYS = ['lu', 'ma', 'me', 'je', 've', 'sa', 'di'];
const MONTH_NAMES = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

interface FormDatePickerProps {
  value: string;
  onChange: (val: string) => void;
  max?: string;
  min?: string;
  readOnly?: boolean;
  error?: boolean;
  className?: string;
}
const FormDatePicker: React.FC<FormDatePickerProps> = ({ value, onChange, max, min, readOnly, error, className = '' }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const today = new Date();
  const todayYMD = [today.getFullYear(), String(today.getMonth() + 1).padStart(2, '0'), String(today.getDate()).padStart(2, '0')].join('-');
  const init = value ? new Date(value + 'T00:00:00') : today;
  const [viewYear, setViewYear] = useState(init.getFullYear());
  const [viewMonth, setViewMonth] = useState(init.getMonth());

  useEffect(() => {
    if (value) {
      const d = new Date(value + 'T00:00:00');
      setViewYear(d.getFullYear());
      setViewMonth(d.getMonth());
    }
  }, [value]);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const toYMD = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const formatDisplay = (val: string) => {
    if (!val) return '';
    const [y, m, d] = val.split('-');
    return `${d}/${m}/${y}`;
  };

  const getDays = () => {
    let startDow = new Date(viewYear, viewMonth, 1).getDay();
    startDow = startDow === 0 ? 6 : startDow - 1; // Mon = 0
    const days: { date: Date; current: boolean }[] = [];
    for (let i = startDow - 1; i >= 0; i--) days.push({ date: new Date(viewYear, viewMonth, -i), current: false });
    const total = new Date(viewYear, viewMonth + 1, 0).getDate();
    for (let i = 1; i <= total; i++) days.push({ date: new Date(viewYear, viewMonth, i), current: true });
    let nx = 1;
    while (days.length % 7 !== 0 || days.length < 35) days.push({ date: new Date(viewYear, viewMonth + 1, nx++), current: false });
    return days;
  };

  const isDisabled = (d: Date) => {
    const ymd = toYMD(d);
    if (max && ymd > max) return true;
    if (min && ymd < min) return true;
    return false;
  };

  const prevMonth = () => { if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); } else setViewMonth(m => m - 1); };
  const nextMonth = () => { if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); } else setViewMonth(m => m + 1); };

  const days = getDays();

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => !readOnly && setOpen(o => !o)}
        className={`h-11 w-full flex items-center gap-2 rounded-lg border px-4 text-theme-sm transition-all text-left
          ${error ? 'border-error-500 focus:ring-error-500/10' : 'border-gray-300 dark:border-gray-600 focus:border-brand-300 focus:ring focus:ring-brand-500/10'}
          ${readOnly ? 'bg-gray-50 dark:bg-gray-800/50 cursor-default' : 'bg-white dark:bg-gray-800 hover:border-gray-400 dark:hover:border-gray-500 cursor-pointer'}`}
      >
        <HiOutlineCalendar size={16} className="text-gray-400 flex-shrink-0" />
        <span className={value ? 'text-gray-700 dark:text-gray-200' : 'text-gray-400 dark:text-gray-500'}>
          {value ? formatDisplay(value) : 'jj/mm/aaaa'}
        </span>
      </button>

      {open && !readOnly && (
        <div className="absolute z-50 mt-1 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-2xl p-3 w-64">
          {/* Navigation header */}
          <div className="flex items-center justify-between mb-3">
            <button type="button" onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 transition-colors">
              <HiOutlineChevronLeft size={16} />
            </button>
            <span className="text-theme-sm font-semibold text-gray-800 dark:text-white">
              {MONTH_NAMES[viewMonth]} {viewYear} ▾
            </span>
            <button type="button" onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 transition-colors">
              <HiOutlineChevronRight size={16} />
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 mb-1">
            {WEEK_DAYS.map(d => (
              <div key={d} className="text-center text-theme-xs font-medium text-gray-400 dark:text-gray-500 py-1">{d}</div>
            ))}
          </div>

          {/* Days grid */}
          <div className="grid grid-cols-7 gap-y-0.5">
            {days.map((item, idx) => {
              const ymd = toYMD(item.date);
              const sel = ymd === value;
              const tod = ymd === todayYMD;
              const dis = isDisabled(item.date);
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => { if (!dis) { onChange(ymd); setOpen(false); } }}
                  disabled={dis}
                  className={`h-8 w-full flex items-center justify-center text-theme-xs rounded-lg transition-colors
                    ${sel
                      ? 'bg-brand-500 text-white font-semibold'
                      : tod
                        ? 'ring-1 ring-brand-400 text-brand-600 dark:text-brand-400 font-semibold hover:bg-brand-50 dark:hover:bg-brand-500/10'
                        : item.current
                          ? 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                          : 'text-gray-300 dark:text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800'}
                    ${dis ? 'opacity-30 cursor-not-allowed pointer-events-none' : ''}`}
                >
                  {item.date.getDate()}
                </button>
              );
            })}
          </div>

          {/* Footer */}
          <div className="flex justify-between mt-3 pt-2 border-t border-gray-100 dark:border-gray-700">
            <button type="button" onClick={() => { onChange(''); setOpen(false); }} className="text-theme-xs text-brand-500 hover:text-brand-600 font-medium px-2 py-1 rounded hover:bg-brand-50 dark:hover:bg-brand-500/10 transition-colors">
              Effacer
            </button>
            <button
              type="button"
              onClick={() => { if (!isDisabled(today)) { onChange(todayYMD); setOpen(false); } }}
              className={`text-theme-xs font-medium px-2 py-1 rounded transition-colors ${isDisabled(today) ? 'text-gray-300 cursor-not-allowed' : 'text-brand-500 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-500/10'}`}
            >
              Aujourd'hui
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
// ────────────────────────────────────────────────────────────────────────────
import { employeService } from '../api/employeService';
import { competenceService } from '../api/competenceService';
import { documentEmployeService } from '../api/documentEmployeService';
import { referentielService } from '../api/referentielService';
import { roleService } from '../api/roleService';
import { compteService } from '../api/compteService';
import { Employe, Referentiel, RoleDTO, EmployeStatsDTO, CompetenceDTO, DocumentEmployeDTO } from '../types';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import DataTable from '../components/ui/DataTable';
import Badge from '../components/ui/Badge';
import { API_BASE } from '../api/axios';
import { useConfirm } from '../hooks/useConfirm';



const EmployesPage: React.FC = () => {
  const { confirmState, confirm, handleConfirm, handleCancel } = useConfirm();
  // CIVP contract end notifications
  const [employes, setEmployes] = useState<Employe[]>([]);
    const [civpNotifications, setCivpNotifications] = useState<{ employe: Employe; daysLeft: number }[]>([]);

    // CIVP browser notifications
    useEffect(() => {
      if (!('Notification' in window)) return;
      if (civpNotifications.length === 0) return;
      civpNotifications.forEach(({ employe, daysLeft }) => {
        if ((daysLeft === 7 || daysLeft === 30) && Notification.permission === 'granted') {
          const body = daysLeft === 30
            ? `Le contrat CIVP de ${employe.prenom} ${employe.nom} se termine dans 1 mois.`
            : `Le contrat CIVP de ${employe.prenom} ${employe.nom} se termine dans 1 semaine.`;
          new Notification('Fin de contrat CIVP', { body });
        }
      });
    }, [civpNotifications]);

    // Ask for notification permission on mount
    useEffect(() => {
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
      }
    }, []);
  

 useEffect(() => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const civpList = employes
    .filter(e => e.typeContrat?.toUpperCase() === 'CIVP' && e.dateFinContrat)
    .map(e => {
      const endDate = new Date(e.dateFinContrat as string);
      endDate.setHours(0, 0, 0, 0);
      const daysLeft = Math.round((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return { employe: e, daysLeft };
    })
    // ✅ Seulement les contrats futurs dans les 30 prochains jours
    // ✅ Exclut les contrats expirés (daysLeft < 0)
    .filter((item): item is { employe: Employe; daysLeft: number } =>
      item.daysLeft >= 0 && item.daysLeft <= 30
    );

  setCivpNotifications(civpList);
}, [employes]);
  // (removed duplicate)
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingEmploye, setEditingEmploye] = useState<Employe | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewingEmploye, setViewingEmploye] = useState<Employe | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'card'>('card');
   const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(6);
 
  // Referentiel lists
  const [departements, setDepartements] = useState<Referentiel[]>([]);
  const [postes, setPostes] = useState<Referentiel[]>([]);
  const [typesContrat, setTypesContrat] = useState<Referentiel[]>([]);
  const [genres, setGenres] = useState<Referentiel[]>([]);
  const [roles, setRoles] = useState<RoleDTO[]>([]);
  const [managers, setManagers] = useState<Employe[]>([]);

  const [formData, setFormData] = useState({
    cin: '', cnss: '', nom: '', prenom: '', email: '', telephone: '',
    telephonePro: '', salaire: '' as string | number,
    dateEmbauche: '', soldeConge: 0, poste: '', typeContrat: '', dateFinContrat: '', genre: '',
    departement: '', ribBancaire: '', managerId: null as number | null,
    useInitialSolde: false, soldeCongeInitial: '' as string | number,
  });

  // Form submission state – errors shown only after the user clicks "Créer"
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);

  // Compte creation (only for new employee)
  const [createCompte, setCreateCompte] = useState(false);
  const [selectedRoleIds, setSelectedRoleIds] = useState<number[]>([]);
  const [showCredentialsModal, setShowCredentialsModal] = useState(false);
  const [credentials, setCredentials] = useState<{ username: string; password: string; email: string } | null>(null);

  // Image upload
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Advanced features
  const [stats, setStats] = useState<EmployeStatsDTO | null>(null);
  const [showStats, setShowStats] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    departement: '', typeContrat: '', genre: '', poste: '',
    dateEmbaucheFrom: '', dateEmbaucheTo: '',
    salaireMin: '', salaireMax: '', managerId: '',
  });
  const [activeTab, setActiveTab] = useState<'info' | 'competences' | 'documents'>('info');

  // Competences
  const [competences, setCompetences] = useState<CompetenceDTO[]>([]);
  const [showCompetenceModal, setShowCompetenceModal] = useState(false);
  const [editingCompetence, setEditingCompetence] = useState<CompetenceDTO | null>(null);
  const [competenceForm, setCompetenceForm] = useState({ nom: '', categorie: '', niveau: 3 });

  // Documents
  const [documents, setDocuments] = useState<DocumentEmployeDTO[]>([]);
  const [showDocumentModal, setShowDocumentModal] = useState(false);
  const [editingDocument, setEditingDocument] = useState<DocumentEmployeDTO | null>(null);
  const [documentForm, setDocumentForm] = useState({ nom: '', type: 'CONTRAT', dateExpiration: '' });
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const docFileInputRef = useRef<HTMLInputElement>(null);

  // Drive link
  const [editingDriveLink, setEditingDriveLink] = useState(false);
  const [driveLinkValue, setDriveLinkValue] = useState('');

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    try {
      const [empRes, depRes, postRes, contratRes, genreRes, rolesRes] = await Promise.all([
        employeService.getAll(),
        referentielService.getByType('DEPARTEMENT'),
        referentielService.getByType('POSTE'),
        referentielService.getByType('TYPE_CONTRAT'),
        referentielService.getByType('GENRE'),
        roleService.getAll(),
      ]);
      setEmployes(empRes.data.data || []);
      setDepartements((depRes.data.data || []).filter((r: Referentiel) => r.actif));
      setPostes((postRes.data.data || []).filter((r: Referentiel) => r.actif));
      setTypesContrat((contratRes.data.data || []).filter((r: Referentiel) => r.actif));
      setGenres((genreRes.data.data || []).filter((r: Referentiel) => r.actif));
      setRoles(rolesRes.data.data || []);
      try {
        const managersRes = await employeService.getByRole('MANAGER');
        setManagers(managersRes.data.data || []);
      } catch { setManagers([]); }
      // Load stats
      try {
        const statsRes = await employeService.getStats();
        setStats(statsRes.data.data);
      } catch { /* ignore */ }
    } catch (err) {
      console.error('Erreur chargement:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSubmitted(true);
    if (hasErrors) return;
    setSaving(true);
    try {

      // Clean empty strings to null for backend
      const payload: any = { ...formData };
      if (!payload.dateEmbauche) payload.dateEmbauche = null;
      if (!payload.genre) payload.genre = null;
      if (!payload.cin) payload.cin = null;
      if (!payload.cnss) payload.cnss = null;
      if (!payload.telephone) payload.telephone = null;
      if (!payload.telephonePro) payload.telephonePro = null;
      if (payload.salaire === '' || payload.salaire === null) payload.salaire = null; else payload.salaire = Number(payload.salaire);
      if (!payload.poste) payload.poste = null;
      if (!payload.typeContrat) payload.typeContrat = null;
      if (!payload.dateFinContrat) payload.dateFinContrat = null;
      if (!payload.departement) payload.departement = null;
      if (!payload.ribBancaire) payload.ribBancaire = null;

      // Initial solde congé
      if (payload.useInitialSolde && payload.soldeCongeInitial !== '' && payload.soldeCongeInitial !== null) {
        payload.soldeCongeInitial = Number(payload.soldeCongeInitial);
      } else {
        payload.soldeCongeInitial = null;
        payload.useInitialSolde = false;
      }

      if (editingEmploye) {
        await employeService.update(editingEmploye.id, payload);
        // Upload image if selected
        if (imageFile) {
          await employeService.uploadImage(editingEmploye.id, imageFile);
        }
      } else {
        // Create employee
        const res = await employeService.create(payload);
        const newEmploye = res.data.data;

        // Upload image if selected
        if (imageFile && newEmploye?.id) {
          await employeService.uploadImage(newEmploye.id, imageFile);
        }

        // If "create account" is checked, create a compte + assign role
        if (createCompte && selectedRoleIds.length > 0 && newEmploye?.id) {
          try {
            const compteRes = await compteService.create({ employeId: newEmploye.id, roleIds: selectedRoleIds });
            const newCompte = compteRes.data.data;
            if (newCompte) {
              setCredentials({
                username: newCompte.username,
                password: newCompte.generatedPassword || '(envoyé par email)',
                email: newCompte.employeEmail,
              });
              setShowCredentialsModal(true);
            }
          } catch (compteErr) {
            console.error('Employé créé mais erreur création compte:', compteErr);
          }
        }
      }
      setShowModal(false);
      setEditingEmploye(null);
      resetForm();
      loadAll();
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Erreur inconnue';
      console.error('Erreur sauvegarde:', msg, err?.response?.data);
      alert('Erreur : ' + msg);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (employe: Employe) => {
    setEditingEmploye(employe);
    setFormData({
      cin: employe.cin || '', cnss: employe.cnss || '',
      nom: employe.nom, prenom: employe.prenom, email: employe.email,
      telephone: employe.telephone || '', telephonePro: employe.telephonePro || '',
      salaire: employe.salaire ?? '',
      dateEmbauche: employe.dateEmbauche || '',
      soldeConge: employe.soldeConge, poste: employe.poste || '',
      typeContrat: employe.typeContrat || '', dateFinContrat: employe.dateFinContrat || '', genre: employe.genre || '',
      departement: employe.departement || '', ribBancaire: employe.ribBancaire || '',
      managerId: employe.managerId,
      useInitialSolde: employe.soldeCongeInitial != null, soldeCongeInitial: employe.soldeCongeInitial ?? '',
    });
    setCreateCompte(false);
    setSelectedRoleIds([]);
    setShowModal(true);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        alert('Veuillez sélectionner une image');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        alert("L'image ne doit pas dépasser 5 Mo");
        return;
      }
      setImageFile(file);
      const reader = new FileReader();
      reader.onload = (ev) => setImagePreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleArchive = async (id: number) => {
    confirm('Êtes-vous sûr de vouloir archiver cet employé ?', async () => {
      try {
        await employeService.archive(id);
        loadAll();
      } catch (err: any) {
        const msg = err?.response?.data?.message || 'Impossible d\'archiver cet employé.';
        alert(msg);
        console.error('Erreur archivage:', err);
      }
    }, 'Archiver l\'employé');
  };

  const resetForm = () => {
    setFormData({
      cin: '', cnss: '', nom: '', prenom: '', email: '', telephone: '',
      telephonePro: '', salaire: '',
      dateEmbauche: '', soldeConge: 0, poste: '', typeContrat: '', dateFinContrat: '', genre: '',
      departement: '', ribBancaire: '', managerId: null,
      useInitialSolde: false, soldeCongeInitial: '',
    });
    setCreateCompte(false);
    setSelectedRoleIds([]);
    setImageFile(null);
    setImagePreview(null);
    setSubmitted(false);
  };

  const hasActiveFilters = Object.values(filters).some(v => v !== '');

  const clearFilters = () => {
    setFilters({
      departement: '', typeContrat: '', genre: '', poste: '',
      dateEmbaucheFrom: '', dateEmbaucheTo: '',
      salaireMin: '', salaireMax: '', managerId: '',
    });
  };

  const handleExportCsv = async () => {
    try {
      const response = await employeService.exportCsv();
      const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'employes.csv';
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Erreur export CSV:', err);
      alert('Erreur lors de l\'exportation');
    }
  };

  const loadCompetences = async (employeId: number) => {
    try {
      const res = await competenceService.getByEmploye(employeId);
      setCompetences(res.data.data || []);
    } catch { setCompetences([]); }
  };

  const loadDocuments = async (employeId: number) => {
    try {
      const res = await documentEmployeService.getByEmploye(employeId);
      setDocuments(res.data.data || []);
    } catch { setDocuments([]); }
  };

  const handleViewDetails = (item: Employe) => {
    setViewingEmploye(item);
    setActiveTab('info');
    setEditingDriveLink(false);
    loadCompetences(item.id);
    loadDocuments(item.id);
  };

  const handleSaveCompetence = async () => {
    if (!viewingEmploye) return;
    try {
      if (editingCompetence) {
        await competenceService.update(editingCompetence.id, { ...competenceForm, employeId: viewingEmploye.id } as any);
      } else {
        await competenceService.create({ ...competenceForm, employeId: viewingEmploye.id } as any);
      }
      loadCompetences(viewingEmploye.id);
      setShowCompetenceModal(false);
      setEditingCompetence(null);
      setCompetenceForm({ nom: '', categorie: '', niveau: 3 });
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Erreur');
    }
  };

  const handleDeleteCompetence = async (id: number) => {
    if (!viewingEmploye) return;
    confirm('Supprimer cette compétence ?', async () => {
      try {
        await competenceService.delete(id);
        loadCompetences(viewingEmploye.id);
      } catch { /* ignore */ }
    }, 'Supprimer la compétence');
  };

  const handleSaveDocument = async () => {
    if (!viewingEmploye) return;
    try {
      let doc: DocumentEmployeDTO;
      if (editingDocument) {
        const res = await documentEmployeService.update(editingDocument.id, {
          nom: documentForm.nom,
          type: documentForm.type,
          dateExpiration: documentForm.dateExpiration || null,
        });
        doc = res.data.data;
      } else {
        const res = await documentEmployeService.create({
          nom: documentForm.nom,
          type: documentForm.type,
          dateExpiration: documentForm.dateExpiration || null,
          employeId: viewingEmploye.id,
        });
        doc = res.data.data;
      }
      if (documentFile && doc?.id) {
        await documentEmployeService.uploadFichier(doc.id, documentFile);
      }
      loadDocuments(viewingEmploye.id);
      setShowDocumentModal(false);
      setEditingDocument(null);
      setDocumentForm({ nom: '', type: 'CONTRAT', dateExpiration: '' });
      setDocumentFile(null);
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Erreur');
    }
  };

  const handleDeleteDocument = async (id: number) => {
    if (!viewingEmploye) return;
    confirm('Supprimer ce document ?', async () => {
      try {
        await documentEmployeService.delete(id);
        loadDocuments(viewingEmploye.id);
      } catch { /* ignore */ }
    }, 'Supprimer le document');
  };

  const handleSaveDriveLink = async () => {
    if (!viewingEmploye) return;
    try {
      const newLien = driveLinkValue.trim() || null;
      await employeService.updateLienDrive(viewingEmploye.id, newLien);
      setViewingEmploye({ ...viewingEmploye, lienDrive: newLien });
      setEmployes((prev: Employe[]) => prev.map((e: Employe) => e.id === viewingEmploye.id ? { ...e, lienDrive: newLien } : e));
      setEditingDriveLink(false);
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Erreur lors de la sauvegarde du lien Drive');
    }
  };

  const niveauLabels = ['', 'Débutant', 'Junior', 'Intermédiaire', 'Avancé', 'Expert'];
  const niveauColors = ['', 'bg-gray-200', 'bg-blue-200', 'bg-yellow-200', 'bg-green-200', 'bg-purple-200'];
  const docTypes = ['CONTRAT', 'ATTESTATION', 'CERTIFICAT', 'DIPLOME', 'AUTRE'];

  const filteredEmployes = employes.filter(
    (e: Employe) => {
      const matchSearch = e.nom.toLowerCase().includes(search.toLowerCase()) ||
        e.prenom.toLowerCase().includes(search.toLowerCase()) ||
        e.matricule.toLowerCase().includes(search.toLowerCase()) ||
        e.email.toLowerCase().includes(search.toLowerCase()) ||
        (e.poste && e.poste.toLowerCase().includes(search.toLowerCase())) ||
        (e.departement && e.departement.toLowerCase().includes(search.toLowerCase()));
      if (!matchSearch) return false;

      if (filters.departement && e.departement !== filters.departement) return false;
      if (filters.typeContrat && e.typeContrat !== filters.typeContrat) return false;
      if (filters.genre && e.genre !== filters.genre) return false;
      if (filters.poste && e.poste !== filters.poste) return false;
      if (filters.dateEmbaucheFrom && (!e.dateEmbauche || e.dateEmbauche < filters.dateEmbaucheFrom)) return false;
      if (filters.dateEmbaucheTo && (!e.dateEmbauche || e.dateEmbauche > filters.dateEmbaucheTo)) return false;
      if (filters.salaireMin && (e.salaire == null || e.salaire < Number(filters.salaireMin))) return false;
      if (filters.salaireMax && (e.salaire == null || e.salaire > Number(filters.salaireMax))) return false;
      if (filters.managerId && e.managerId !== Number(filters.managerId)) return false;
      return true;
    }
  );
 const totalPages = Math.ceil(filteredEmployes.length / pageSize);
  const paginatedEmployes = filteredEmployes.slice((page - 1) * pageSize, page * pageSize);

  const columns = [
    { key: 'matricule', label: 'Matricule' },
    {
      key: 'nom',
      label: 'Nom complet',
      render: (item: Employe) => (
        <div className="flex items-center gap-3">
          {item.imageUrl ? (
            <img 
              src={`${API_BASE}${item.imageUrl}`} 
              alt="" 
              className="w-8 h-8 rounded-full object-cover" 
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                const parent = e.currentTarget.parentElement;
                if (parent && !parent.querySelector('.fallback-avatar')) {
                  parent.insertAdjacentHTML('afterbegin', `<div class="fallback-avatar w-8 h-8 rounded-full bg-secondary-50 text-secondary-500 dark:bg-secondary-500/[0.12] dark:text-secondary-400 flex items-center justify-center text-xs font-semibold">${item.prenom[0]}${item.nom[0]}</div>`);
                }
              }}
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-secondary-50 text-secondary-500 dark:bg-secondary-500/[0.12] dark:text-secondary-400 flex items-center justify-center text-xs font-semibold">
              {item.prenom[0]}{item.nom[0]}
            </div>
          )}
          <div>
            <span className="font-medium">{item.prenom} {item.nom}</span>
            {item.genre && <span className="text-theme-xs text-gray-400 ml-1">({item.genre})</span>}
          </div>
        </div>
      ),
    },
    { key: 'email', label: 'Email' },
    { key: 'poste', label: 'Poste', render: (item: Employe) => item.poste || '—' },
    { key: 'departement', label: 'Département', render: (item: Employe) => item.departement || '—' },
    {
      key: 'typeContrat',
      label: 'Contrat',
      render: (item: Employe) => item.typeContrat ? (
        <div>
          <Badge variant="light" color="primary">{item.typeContrat}</Badge>
        </div>
      ) : <span>—</span>,
    },
    { key: 'soldeConge', label: 'Solde congé', render: (item: Employe) => <span>{item.soldeConge} jours</span> },
    {
      key: 'actions',
      label: 'Actions',
      render: (item: Employe) => (
        <div className="flex gap-2">
          <button onClick={() => handleViewDetails(item)} className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-500 dark:hover:bg-blue-500/10 transition-colors" title="Voir les détails">
            <HiOutlineEye size={16} />
          </button>
          <button onClick={() => handleEdit(item)} className="p-1.5 rounded-lg hover:bg-brand-50 text-brand-500 transition-colors">
            <HiOutlinePencil size={16} />
          </button>
          <button onClick={() => handleArchive(item.id)} className="p-1.5 rounded-lg hover:bg-warning-50 text-warning-600 transition-colors" title="Archiver l'employé">
            <HiOutlineArchive size={16} />
          </button>
        </div>
      ),
    },
  ];

  const inputClass = "h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 text-theme-sm text-gray-700 focus:border-brand-300 focus:outline-none focus:ring focus:ring-brand-500/10 dark:border-gray-600 dark:text-gray-300";
  const inputErrorClass = "h-11 w-full rounded-lg border border-error-500 bg-transparent px-4 text-theme-sm text-gray-700 focus:border-error-300 focus:outline-none focus:ring focus:ring-error-500/10 dark:border-error-500 dark:text-gray-300";
  const selectClass = inputClass + " dark:bg-gray-800";

  // Validation helpers
  const onlyDigits = (value: string) => value.replace(/[^0-9]/g, '');
  const onlyLetters = (value: string) => value.replace(/[^a-zA-ZÀ-ÿ\s'-]/g, '');
  const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);
  const isValidEmail = (email: string) => !email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const isValidTunisianPhone = (phone: string) => !phone || /^[259]\d{7}$/.test(phone);
  const todayStr = new Date().toISOString().split('T')[0];

  const formErrors = {
    cin: !formData.cin.trim() || formData.cin.length !== 8,
    cnss: !!formData.cnss && !/^[0-9]{1,12}(-[0-9]+)*$/.test(formData.cnss),
    genre: !formData.genre,
    prenom: !formData.prenom.trim(),
    nom: !formData.nom.trim(),
    email: !formData.email.trim() || !isValidEmail(formData.email),
    telephone: !formData.telephone.trim() || !isValidTunisianPhone(formData.telephone),
    telephonePro: !!formData.telephonePro && !isValidTunisianPhone(formData.telephonePro),
    poste: !formData.poste,
    departement: !formData.departement,
    typeContrat: !formData.typeContrat,
    salaire: formData.salaire === '' || formData.salaire === null || Number(formData.salaire) < 0,
    dateEmbauche: !formData.dateEmbauche || formData.dateEmbauche > todayStr,
    ribBancaire: !!formData.ribBancaire && formData.ribBancaire.length !== 20,
  };
  const hasErrors = Object.values(formErrors).some(Boolean);

  return (
    <div className="space-y-6">
      {/* CIVP contract notifications: only 3 days and less as visible message */}
    {civpNotifications.length > 0 && (
  <div className="mb-4 space-y-2">
    {civpNotifications.map(({ employe, daysLeft }) => {
      // Urgence selon le seuil
      const isUrgent = daysLeft <= 3;
      const isSoon   = daysLeft <= 7 && daysLeft > 3;
      // Les notifs à 30j sont silencieuses (pas de bandeau, déjà envoyées par le scheduler)
      if (!isUrgent && !isSoon) return null;

      return (
        <div
          key={employe.id}
          className={`p-3 rounded-lg border flex items-center gap-3 ${
            isUrgent
              ? 'border-error-500 bg-error-50 dark:bg-error-500/10'
              : 'border-warning-400 bg-warning-50 dark:bg-warning-500/10'
          }`}
        >
          <span className={`font-bold ${isUrgent ? 'text-error-600 dark:text-error-400' : 'text-warning-600 dark:text-warning-400'}`}>
            ⚠️ Attention ! {employe.prenom} {employe.nom} (CIVP) : Fin de contrat dans{' '}
            {daysLeft === 0 ? "aujourd'hui" : `${daysLeft} jour${daysLeft > 1 ? 's' : ''}`}
          </span>
          <span className="ml-auto text-theme-xs text-gray-500">
            Date fin : {employe.dateFinContrat}
          </span>
        </div>
      );
    })}
  </div>
)}
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-title-sm font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-gray-900 to-[#683b77] dark:from-white dark:to-[#ab78c3]">Employés</h1>
          <p className="text-theme-sm text-gray-500 dark:text-gray-400 mt-1">Gérer les employés de l'agence</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={() => setShowStats(!showStats)} title="Statistiques">
            <HiOutlineChartBar size={18} /> Statistiques
          </Button>
          <Button variant="ghost" onClick={handleExportCsv} title="Exporter CSV">
            <HiOutlineDownload size={18} /> Exporter
          </Button>
          {/* View mode toggle */}
          <div className="flex items-center rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              title="Vue tableau"
              className={`flex items-center justify-center h-9 w-9 transition-colors ${
                viewMode === 'table'
                  ? 'bg-[#683b77] text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              <HiOutlineTable size={17} />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('card')}
              title="Vue cartes"
              className={`flex items-center justify-center h-9 w-9 transition-colors ${
                viewMode === 'card'
                  ? 'bg-[#683b77] text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              <HiOutlineViewGrid size={17} />
            </button>
          </div>
          <Button onClick={() => { resetForm(); setEditingEmploye(null); setShowModal(true); }}>
            <HiOutlinePlus size={18} /> Ajouter un employé
          </Button>
        </div>
      </div>

      {/* Stats Dashboard */}
      {showStats && stats && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <StatBox label="Total employés" value={stats.totalEmployes} color="brand" />
            <StatBox label="Nouveaux ce mois" value={stats.nouveauxCeMois} color="green" />
            <StatBox label="Salaire moyen" value={`${stats.moyenneSalaire.toFixed(0)} DT`} color="purple" />
            <StatBox label="Ancienneté moy." value={`${stats.moyenneAnciennete} ans`} color="orange" />
            <StatBox label="Départements" value={Object.keys(stats.parDepartement).length} color="cyan" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <DistributionCard title="Par département" data={stats.parDepartement} />
            <DistributionCard title="Par type de contrat" data={stats.parTypeContrat} />
            <DistributionCard title="Par genre" data={stats.parGenre} />
          </div>
        </div>
      )}

      {/* Search + Filters */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <HiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un employé..."
              className="h-11 w-full rounded-lg border border-gray-300 bg-transparent pl-10 pr-4 text-theme-sm text-gray-700 focus:border-brand-300 focus:outline-none focus:ring focus:ring-brand-500/10 dark:border-gray-600 dark:text-gray-300"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 h-11 rounded-lg border text-theme-sm font-medium transition-colors ${hasActiveFilters ? 'border-brand-500 bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400' : 'border-gray-300 text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800'}`}
          >
            <HiOutlineFilter size={16} />
            Filtres {hasActiveFilters && `(${Object.values(filters).filter(v => v !== '').length})`}
          </button>
          {hasActiveFilters && (
            <button onClick={clearFilters} className="flex items-center gap-1 px-3 h-11 rounded-lg text-theme-sm text-error-500 hover:bg-error-50 dark:hover:bg-error-500/10 transition-colors">
              <HiOutlineX size={14} /> Réinitialiser
            </button>
          )}
          <span className="text-theme-sm text-gray-400">{filteredEmployes.length} résultat(s)</span>
        </div>

        {showFilters && (
          <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-theme-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Département</label>
              <FormSelect
                value={filters.departement}
                onChange={val => setFilters({ ...filters, departement: val })}
                options={departements.map((d: Referentiel) => ({ value: d.libelle, label: d.libelle }))}
                placeholder="Tous"
              />
            </div>
            <div>
              <label className="block text-theme-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Type contrat</label>
              <FormSelect
                value={filters.typeContrat}
                onChange={val => setFilters({ ...filters, typeContrat: val })}
                options={typesContrat.map((t: Referentiel) => ({ value: t.libelle, label: t.libelle }))}
                placeholder="Tous"
              />
            </div>
            <div>
              <label className="block text-theme-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Genre</label>
              <FormSelect
                value={filters.genre}
                onChange={val => setFilters({ ...filters, genre: val })}
                options={genres.map((g: Referentiel) => ({ value: g.libelle, label: g.libelle }))}
                placeholder="Tous"
              />
            </div>
            <div>
              <label className="block text-theme-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Poste</label>
              <FormSelect
                value={filters.poste}
                onChange={val => setFilters({ ...filters, poste: val })}
                options={postes.map((p: Referentiel) => ({ value: p.libelle, label: p.libelle }))}
                placeholder="Tous"
              />
            </div>
            <div>
              <label className="block text-theme-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Embauché depuis</label>
              <FormDatePicker value={filters.dateEmbaucheFrom} onChange={val => setFilters({ ...filters, dateEmbaucheFrom: val })} />
            </div>
            <div>
              <label className="block text-theme-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Embauché jusqu'à</label>
              <FormDatePicker value={filters.dateEmbaucheTo} onChange={val => setFilters({ ...filters, dateEmbaucheTo: val })} min={filters.dateEmbaucheFrom} />
            </div>
            <div>
              <label className="block text-theme-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Salaire min</label>
              <input type="number" value={filters.salaireMin} onChange={e => setFilters({ ...filters, salaireMin: e.target.value })} placeholder="Min" className={inputClass} />
            </div>
            <div>
              <label className="block text-theme-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Salaire max</label>
              <input type="number" value={filters.salaireMax} onChange={e => setFilters({ ...filters, salaireMax: e.target.value })} placeholder="Max" className={inputClass} />
            </div>
          </div>
        )}
      </div>

      {/* Table / Card */}
      {loading ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">Chargement...</div>
      ) : viewMode === 'card' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 pt-12">
          {paginatedEmployes.map((emp, idx) => {
            const avatarBgs = ['bg-violet-500', 'bg-purple-500', 'bg-fuchsia-600', 'bg-indigo-500', 'bg-pink-500'];
            const avatarBg = avatarBgs[(emp.nom?.length ?? 0) % avatarBgs.length];
            return (
              <motion.div
                key={emp.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: idx * 0.04, ease: 'easeOut' }}
                className="group mt-11 [perspective:1000px]"
              >
                <div
                  className="relative flex flex-col rounded-[20px] bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-md [transform-style:preserve-3d] transition-all duration-500 ease-in-out group-hover:[box-shadow:0_20px_60px_-10px_rgba(104,59,119,0.45),0_8px_24px_-4px_rgba(104,59,119,0.25)] group-hover:[transform:rotate3d(1,1,0,12deg)]"
                  style={{ willChange: 'transform' }}
                >
                  {/* Avatar */}
                  <div className="absolute -top-11 left-1/2 -translate-x-1/2 w-[88px] h-[88px] rounded-full overflow-hidden border-4 border-white dark:border-gray-900 shadow-md z-10">
                    {emp.imageUrl ? (
                      <img
                        src={`${API_BASE}${emp.imageUrl}`}
                        alt=""
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                          const p = e.currentTarget.parentElement;
                          if (p) {
                            p.className += ` ${avatarBg}`;
                            p.innerHTML = `<span class="text-white text-[30px] font-medium flex items-center justify-center w-full h-full">${(emp.prenom?.charAt(0) ?? emp.nom?.charAt(0) ?? '?').toUpperCase()}</span>`;
                          }
                        }}
                      />
                    ) : (
                      <div className={`w-full h-full flex items-center justify-center text-white text-[30px] font-medium ${avatarBg}`}>
                        {(emp.prenom?.charAt(0) ?? emp.nom?.charAt(0) ?? '?').toUpperCase()}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col px-5 pt-14 pb-5 gap-4">
                    {/* Name + poste */}
                    <div className="text-center">
                      <h3 className="text-[17px] font-bold text-gray-900 dark:text-white">{emp.prenom} {emp.nom}</h3>
                      <p className="text-[12px] text-gray-500 dark:text-gray-400 mt-0.5">{emp.poste || emp.departement || 'Employé'}</p>
                    </div>

                    {/* Stats row */}
                    <div className="flex rounded-[14px] bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 overflow-hidden">
                      <div className="flex-1 py-3 px-1 text-center border-r border-gray-200 dark:border-gray-700">
                        <div className="text-[12px] font-bold text-gray-900 dark:text-white truncate leading-tight px-1">{emp.departement || '—'}</div>
                        <div className="text-[10px] text-gray-400 mt-0.5">Département</div>
                      </div>
                      <div className="flex-1 py-3 px-1 text-center border-r border-gray-200 dark:border-gray-700">
                        <div className="text-[12px] font-bold text-gray-900 dark:text-white truncate leading-tight px-1">{emp.typeContrat || '—'}</div>
                        <div className="text-[10px] text-gray-400 mt-0.5">Contrat</div>
                      </div>
                      <div className="flex-1 py-3 px-1 text-center">
                        <div className="text-[13px] font-bold text-[#683b77]">{emp.soldeConge ?? 0}j</div>
                        <div className="text-[10px] text-gray-400 mt-0.5">Congés</div>
                      </div>
                    </div>
                  </div>

                  {/* Hover actions */}
                  <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-all z-20">
                    <button
                      onClick={() => handleViewDetails(emp)}
                      className="p-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-blue-500 transition-all duration-300 group-hover:scale-110 group-hover:-translate-y-1"
                      style={{ transitionDelay: '50ms' }}
                    >
                      <HiOutlineEye size={15} />
                    </button>
                    <button
                      onClick={() => handleEdit(emp)}
                      className="p-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-[#683b77] transition-all duration-300 group-hover:scale-110 group-hover:-translate-y-1"
                      style={{ transitionDelay: '100ms' }}
                    >
                      <HiOutlinePencil size={15} />
                    </button>
                    <button
                      onClick={() => handleArchive(emp.id)}
                      className="p-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-warning-600 transition-all duration-300 group-hover:scale-110 group-hover:-translate-y-1"
                      style={{ transitionDelay: '150ms' }}
                      title="Archiver l'employé"
                    >
                      <HiOutlineArchive size={15} />
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      ) : (
        <DataTable columns={columns} data={paginatedEmployes} />
      )}

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm dark:border-gray-700 dark:bg-gray-800 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Affichage de{' '}
            <span className="font-medium text-gray-700 dark:text-gray-200">{(page - 1) * pageSize + 1}</span>
            {' '}à{' '}
            <span className="font-medium text-gray-700 dark:text-gray-200">{Math.min(page * pageSize, filteredEmployes.length)}</span>
            {' '}sur{' '}
            <span className="font-medium text-gray-700 dark:text-gray-200">{filteredEmployes.length}</span> employé{filteredEmployes.length > 1 ? 's' : ''}
          </p>
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              <HiOutlineChevronLeft size={16} />
              Précédent
            </button>
            <span className="min-w-[78px] text-center text-sm font-medium text-gray-700 dark:text-gray-200">
              Page {page} / {Math.max(1, totalPages)}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages || totalPages === 0}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              Suivant
              <HiOutlineChevronRight size={16} />
            </button>
            <select
              className="ml-2 rounded-lg border border-gray-300 px-2 py-2 text-sm text-gray-600 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300"
              value={pageSize}
              onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}
            >
              {[6, 10, 20, 50, 100].map(size => (
                <option key={size} value={size}>{size} / page</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editingEmploye ? "Modifier l'employé" : 'Nouvel employé'} size="lg">
        {/* Image Upload */}
        <div className="flex items-center gap-5 mb-6 p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <div
            onClick={() => fileInputRef.current?.click()}
            className="relative w-20 h-20 rounded-2xl overflow-hidden cursor-pointer group shrink-0 border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-brand-400 transition-colors"
          >
            {imagePreview || editingEmploye?.imageUrl ? (
              <img
                src={imagePreview || `${API_BASE}${editingEmploye?.imageUrl}`}
                alt="Photo"
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  const parent = e.currentTarget.parentElement;
                  if (parent && !parent.querySelector('.fallback-icon')) {
                    parent.insertAdjacentHTML('beforeend', '<div class="fallback-icon w-full h-full flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-700"><svg stroke="currentColor" fill="none" stroke-width="2" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round" class="text-gray-400" height="24" width="24" xmlns="http://www.w3.org/2000/svg"><path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg></div>');
                  }
                }}
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-700">
                <HiOutlinePhotograph className="text-gray-400" size={24} />
              </div>
            )}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <HiOutlinePhotograph className="text-white" size={22} />
            </div>
          </div>
          <div>
            <p className="text-theme-sm font-medium text-gray-700 dark:text-gray-300">Photo de l'employé</p>
            <p className="text-theme-xs text-gray-400 mt-0.5">JPG, PNG — Max 5 Mo</p>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="mt-2 text-theme-xs text-brand-500 hover:text-brand-600 font-medium"
            >
              {imagePreview || editingEmploye?.imageUrl ? 'Changer la photo' : 'Ajouter une photo'}
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageSelect}
            className="hidden"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          {editingEmploye && (
            <div>
              <label className="block text-theme-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Matricule (login)</label>
              <input type="text" value={editingEmploye.matricule} disabled className={inputClass + ' bg-gray-100 dark:bg-gray-700 cursor-not-allowed'} />
            </div>
          )}
          <div>
            <label className="block text-theme-sm font-medium text-gray-700 dark:text-gray-300 mb-1">CIN *</label>
            <input type="text" value={formData.cin} onChange={(e) => setFormData({ ...formData, cin: onlyDigits(e.target.value).slice(0, 8) })} placeholder="8 chiffres" maxLength={8} className={submitted && formErrors.cin ? inputErrorClass : inputClass} />
            {submitted && formErrors.cin && <p className="text-theme-xs text-error-500 mt-1">Le CIN doit contenir exactement 8 chiffres</p>}
          </div>
          <div>
            <label className="block text-theme-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Genre *</label>
            <FormSelect
              value={formData.genre}
              onChange={val => setFormData({ ...formData, genre: val })}
              options={genres.map((g: Referentiel) => ({ value: g.libelle, label: g.libelle }))}
              placeholder="Sélectionner"
              error={!!(submitted && formErrors.genre)}
            />
            {submitted && formErrors.genre && <p className="text-theme-xs text-error-500 mt-1">Le genre est obligatoire</p>}
          </div>
          <div>
            <label className="block text-theme-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Prénom *</label>
            <input type="text" value={formData.prenom} onChange={(e) => setFormData({ ...formData, prenom: capitalize(onlyLetters(e.target.value)) })} placeholder="Lettres uniquement" className={submitted && formErrors.prenom ? inputErrorClass : inputClass} />
            {submitted && formErrors.prenom && <p className="text-theme-xs text-error-500 mt-1">Le prénom est obligatoire</p>}
          </div>
          <div>
            <label className="block text-theme-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nom *</label>
            <input type="text" value={formData.nom} onChange={(e) => setFormData({ ...formData, nom: capitalize(onlyLetters(e.target.value)) })} placeholder="Lettres uniquement" className={submitted && formErrors.nom ? inputErrorClass : inputClass} />
            {submitted && formErrors.nom && <p className="text-theme-xs text-error-500 mt-1">Le nom est obligatoire</p>}
          </div>
          <div>
            <label className="block text-theme-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email *</label>
            <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="exemple@email.com" className={submitted && formErrors.email ? inputErrorClass : inputClass} />
            {submitted && formErrors.email && <p className="text-theme-xs text-error-500 mt-1">{!formData.email.trim() ? "L'email est obligatoire" : 'Format email invalide'}</p>}
          </div>
          <div>
            <label className="block text-theme-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Téléphone *</label>
            <input type="text" value={formData.telephone} onChange={(e) => setFormData({ ...formData, telephone: onlyDigits(e.target.value).slice(0, 8) })} placeholder="8 chiffres (commence par 2, 5 ou 9)" maxLength={8} className={submitted && formErrors.telephone ? inputErrorClass : inputClass} />
            {submitted && formErrors.telephone && <p className="text-theme-xs text-error-500 mt-1">{!formData.telephone.trim() ? 'Le téléphone est obligatoire' : 'Format tunisien invalide (8 chiffres, commence par 2, 5 ou 9)'}</p>}
          </div>
          <div>
            <label className="block text-theme-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Téléphone professionnel</label>
            <input type="text" value={formData.telephonePro} onChange={(e) => setFormData({ ...formData, telephonePro: onlyDigits(e.target.value).slice(0, 8) })} placeholder="8 chiffres (commence par 2, 5 ou 9)" maxLength={8} className={submitted && formErrors.telephonePro ? inputErrorClass : inputClass} />
            {submitted && formErrors.telephonePro && <p className="text-theme-xs text-error-500 mt-1">Format tunisien invalide (8 chiffres, commence par 2, 5 ou 9)</p>}
          </div>
          <div>
            <label className="block text-theme-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Poste *</label>
            <FormSelect
              value={formData.poste}
              onChange={val => setFormData({ ...formData, poste: val })}
              options={postes.map((p: Referentiel) => ({ value: p.libelle, label: p.libelle }))}
              placeholder="Sélectionner un poste"
              error={!!(submitted && formErrors.poste)}
            />
            {submitted && formErrors.poste && <p className="text-theme-xs text-error-500 mt-1">Le poste est obligatoire</p>}
          </div>
          <div>
            <label className="block text-theme-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Département *</label>
            <FormSelect
              value={formData.departement}
              onChange={val => setFormData({ ...formData, departement: val })}
              options={departements.map((d: Referentiel) => ({ value: d.libelle, label: d.libelle }))}
              placeholder="Sélectionner un département"
              error={!!(submitted && formErrors.departement)}
            />
            {submitted && formErrors.departement && <p className="text-theme-xs text-error-500 mt-1">Le département est obligatoire</p>}
          </div>
          <div>
            <label className="block text-theme-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Type contrat *</label>
            <FormSelect
              value={formData.typeContrat}
              onChange={val => setFormData({ ...formData, typeContrat: val })}
              options={typesContrat.map((t: Referentiel) => ({ value: t.libelle, label: t.libelle }))}
              placeholder="Sélectionner un type"
              error={!!(submitted && formErrors.typeContrat)}
            />
            {/* Ajout CIVP: durée automatique */}
            {formData.typeContrat && formData.typeContrat.toUpperCase() === 'CIVP' && formData.dateEmbauche && (() => {
              const embauche = new Date(formData.dateEmbauche);
              const dateFin = new Date(embauche);
              dateFin.setFullYear(dateFin.getFullYear() + 1);
              const dateFinStr = dateFin.toISOString().split('T')[0];
              if (formData.dateFinContrat !== dateFinStr) {
                setFormData({ ...formData, dateFinContrat: dateFinStr });
              }
              return null;
            })()}
            {submitted && formErrors.typeContrat && <p className="text-theme-xs text-error-500 mt-1">Le type de contrat est obligatoire</p>}
          </div>

           {formData.typeContrat && formData.typeContrat.toUpperCase() === 'CDI' && (
          <div>
            <label className="block text-theme-sm font-medium text-gray-700 dark:text-gray-300 mb-1">CNSS</label>
            <input type="text" value={formData.cnss} onChange={(e) => setFormData({ ...formData, cnss: e.target.value.replace(/[^0-9-]/g, '') })} placeholder="Ex: 1234-567890" maxLength={20} className={submitted && formErrors.cnss ? inputErrorClass : inputClass} />
            {submitted && formErrors.cnss && <p className="text-theme-xs text-error-500 mt-1">Le CNSS doit contenir des chiffres (tirets autorisés)</p>}
          </div>
          )}
          <div>
            <label className="block text-theme-sm font-medium text-gray-700 dark:text-gray-300 mb-1">RIB Bancaire</label>
            <input type="text" value={formData.ribBancaire} onChange={(e) => setFormData({ ...formData, ribBancaire: onlyDigits(e.target.value).slice(0, 20) })} placeholder="20 chiffres" maxLength={20} className={submitted && formErrors.ribBancaire ? inputErrorClass : inputClass} />
            {submitted && formErrors.ribBancaire && <p className="text-theme-xs text-error-500 mt-1">Le RIB doit contenir exactement 20 chiffres</p>}
          </div>
          <div>
            <label className="block text-theme-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date d'embauche *</label>
            <FormDatePicker value={formData.dateEmbauche} onChange={val => setFormData({ ...formData, dateEmbauche: val })} max={todayStr} error={!!(submitted && formErrors.dateEmbauche)} />
            {submitted && formErrors.dateEmbauche && <p className="text-theme-xs text-error-500 mt-1">{!formData.dateEmbauche ? "La date d'embauche est obligatoire" : "La date d'embauche ne peut pas être dans le futur"}</p>}
            {/* Champ date de fin de contrat CIVP sous date d'embauche */}
            {formData.typeContrat && formData.typeContrat.toUpperCase() === 'CIVP' && formData.dateEmbauche && (
              <div className="mt-2">
                <label className="block text-theme-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date fin de contrat (CIVP)</label>
                {(() => {
                  const embauche = new Date(formData.dateEmbauche);
                  const dateFin = new Date(embauche);
                  dateFin.setFullYear(dateFin.getFullYear() + 1);
                  const dateFinStr = dateFin.toISOString().split('T')[0];
                  if (formData.dateFinContrat !== dateFinStr) {
                    setFormData({ ...formData, dateFinContrat: dateFinStr });
                  }
                  return (
                    <FormDatePicker value={dateFinStr} onChange={() => {}} readOnly />
                  );
                })()}
              </div>
            )}
          </div>

          <div>
            <label className="block text-theme-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Salaire *</label>
            <input type="number" min="0" step="0.01" value={formData.salaire} onChange={(e) => setFormData({ ...formData, salaire: e.target.value })} placeholder="Montant en DT" className={submitted && formErrors.salaire ? inputErrorClass : inputClass} />
            {submitted && formErrors.salaire && <p className="text-theme-xs text-error-500 mt-1">{formData.salaire === '' || formData.salaire === null ? 'Le salaire est obligatoire' : 'Le salaire doit être positif'}</p>}
          </div>
          <div>
            <label className="block text-theme-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Manager</label>
            <FormSelect
              value={formData.managerId != null ? String(formData.managerId) : ''}
              onChange={val => setFormData({ ...formData, managerId: val ? Number(val) : null })}
              options={managers.filter((m: Employe) => m.id !== editingEmploye?.id).map((m: Employe) => ({ value: String(m.id), label: `${m.prenom} ${m.nom}` }))}
              placeholder="Aucun manager"
            />
          </div>
        </div>

        {/* Solde congé initial */}
        <div className="mt-5 p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.useInitialSolde}
                onChange={(e) => {
                  setFormData({ ...formData, useInitialSolde: e.target.checked, soldeCongeInitial: e.target.checked ? formData.soldeCongeInitial : '' });
                }}
                className="h-4 w-4 rounded border-gray-300 text-brand-500 focus:ring-brand-500 dark:border-gray-600"
              />
              <span className="text-theme-sm font-medium text-gray-700 dark:text-gray-300">
                Définir le solde congé manuellement
              </span>
            </label>
            {formData.useInitialSolde && (
              <div className="mt-3">
                <label className="block text-theme-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Solde congé actuel (jours)</label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={formData.soldeCongeInitial}
                  onChange={(e) => setFormData({ ...formData, soldeCongeInitial: e.target.value })}
                  placeholder="Ex: 10"
                  className={inputClass}
                />
                <p className="text-theme-xs text-gray-400 mt-1">
                  Saisissez le solde congé actuel de l'employé. Le calcul automatique basé sur la date d'embauche sera désactivé.
                </p>
              </div>
            )}
          </div>

        {/* Compte + Role assignment (only for new employee) */}
        {!editingEmploye && (
          <div className="mt-5 p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={createCompte}
                onChange={(e) => { setCreateCompte(e.target.checked); if (!e.target.checked) setSelectedRoleIds([]); }}
                className="h-4 w-4 rounded border-gray-300 text-brand-500 focus:ring-brand-500 dark:border-gray-600"
              />
              <span className="text-theme-sm font-medium text-gray-700 dark:text-gray-300">
                Créer un compte utilisateur et lui affecter des rôles
              </span>
            </label>
            {createCompte && (
              <div className="mt-3">
                <label className="block text-theme-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Rôles à affecter *</label>
                <div className="space-y-2 max-h-48 overflow-y-auto p-2 border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-800">
                  {roles.map((r: RoleDTO) => (
                    <label key={r.id} className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="checkbox"
                        checked={selectedRoleIds.includes(r.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedRoleIds(prev => [...prev, r.id]);
                          } else {
                            setSelectedRoleIds(prev => prev.filter(id => id !== r.id));
                          }
                        }}
                        className="h-4 w-4 rounded text-brand-500 focus:ring-brand-500 border-gray-300"
                      />
                      <span className="text-theme-sm text-gray-700 dark:text-gray-300">{r.nom}</span>
                    </label>
                  ))}
                </div>
                <p className="text-theme-xs text-gray-400 mt-1">
                  Le matricule (généré automatiquement à partir du département) sera utilisé comme login. Le mot de passe sera généré et envoyé par email.
                </p>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end gap-3 mt-6">
          <Button variant="ghost" onClick={() => setShowModal(false)}>Annuler</Button>
          <Button onClick={handleSave} disabled={(submitted && hasErrors) || (createCompte && selectedRoleIds.length === 0) || saving}>
            {saving ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-5 w-5 text-brand-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                Enregistrement...
              </span>
            ) : (
              editingEmploye ? 'Modifier' : 'Créer'
            )}
          </Button>
        </div>
      </Modal>

      {/* View Details Modal */}
      <Modal isOpen={!!viewingEmploye} onClose={() => setViewingEmploye(null)} title="Détails de l'employé" size="lg">
        {viewingEmploye && (
          <div className="space-y-6">
            {/* Header with photo */}
            <div className="flex items-center gap-4 p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
              {viewingEmploye.imageUrl ? (
                <img 
                  src={`${API_BASE}${viewingEmploye.imageUrl}`} 
                  alt="" 
                  className="w-20 h-20 rounded-2xl object-cover shrink-0" 
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    const parent = e.currentTarget.parentElement;
                    if (parent && !parent.querySelector('.fallback-details')) {
                      parent.insertAdjacentHTML('afterbegin', `<div class="fallback-details w-20 h-20 rounded-2xl bg-secondary-50 text-secondary-500 dark:bg-secondary-500/[0.12] dark:text-secondary-400 flex items-center justify-center text-3xl font-semibold shrink-0">${viewingEmploye.prenom[0]}${viewingEmploye.nom[0]}</div>`);
                    }
                  }}
                />
              ) : (
                <div className="w-20 h-20 rounded-2xl bg-secondary-50 text-secondary-500 dark:bg-secondary-500/[0.12] dark:text-secondary-400 flex items-center justify-center text-2xl font-semibold">
                  {viewingEmploye.prenom[0]}{viewingEmploye.nom[0]}
                </div>
              )}
              <div>
                <h3 className="text-lg font-bold text-gray-800 dark:text-white">{viewingEmploye.prenom} {viewingEmploye.nom}</h3>
                <p className="text-theme-sm text-gray-500 dark:text-gray-400">{viewingEmploye.matricule}</p>
                {viewingEmploye.genre && <p className="text-theme-xs text-gray-400 mt-0.5">{viewingEmploye.genre}</p>}
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200 dark:border-gray-700">
              <button onClick={() => setActiveTab('info')} className={`px-4 py-2 text-theme-sm font-medium border-b-2 transition-colors ${activeTab === 'info' ? 'border-brand-500 text-brand-600 dark:text-brand-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}>
                Informations
              </button>
              <button onClick={() => setActiveTab('competences')} className={`px-4 py-2 text-theme-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${activeTab === 'competences' ? 'border-brand-500 text-brand-600 dark:text-brand-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}>
                <HiOutlineAcademicCap size={16} /> Compétences ({competences.length})
              </button>
              <button onClick={() => setActiveTab('documents')} className={`px-4 py-2 text-theme-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${activeTab === 'documents' ? 'border-brand-500 text-brand-600 dark:text-brand-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}>
                <HiOutlineDocumentText size={16} /> Documents ({documents.length})
              </button>
            </div>

            {/* Tab: Info */}
            {activeTab === 'info' && (
              <div className="grid grid-cols-2 gap-x-8 gap-y-3">
                <div className="col-span-2 mb-1">
                  <h4 className="text-theme-sm font-semibold text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700 pb-1">Informations personnelles</h4>
                </div>
                <InfoRow label="CIN" value={viewingEmploye.cin} />
                <InfoRow label="CNSS" value={viewingEmploye.cnss} />
                <InfoRow label="Email" value={viewingEmploye.email} />
                <InfoRow label="Téléphone" value={viewingEmploye.telephone} />
                <InfoRow label="Téléphone professionnel" value={viewingEmploye.telephonePro} />
                <InfoRow label="RIB Bancaire" value={viewingEmploye.ribBancaire} />
                <div className="col-span-2 mb-1 mt-3">
                  <h4 className="text-theme-sm font-semibold text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700 pb-1">Informations professionnelles</h4>
                </div>
                <InfoRow label="Poste" value={viewingEmploye.poste} />
                <InfoRow label="Département" value={viewingEmploye.departement} />
                <InfoRow label="Type de contrat" value={viewingEmploye.typeContrat} />
                <InfoRow label="Date d'embauche" value={viewingEmploye.dateEmbauche} />
                <InfoRow label="Salaire" value={viewingEmploye.salaire != null ? `${viewingEmploye.salaire} DT` : null} />
                <InfoRow label="Solde congé" value={`${viewingEmploye.soldeConge} jours`} />
                <InfoRow label="Manager" value={viewingEmploye.managerNom} />
              </div>
            )}

            {/* Tab: Competences */}
            {activeTab === 'competences' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="text-theme-sm font-semibold text-gray-700 dark:text-gray-300">Compétences de l'employé</h4>
                  <Button size="sm" onClick={() => { setEditingCompetence(null); setCompetenceForm({ nom: '', categorie: '', niveau: 3 }); setShowCompetenceModal(true); }}>
                    <HiOutlinePlus size={14} /> Ajouter
                  </Button>
                </div>
                {competences.length === 0 ? (
                  <p className="text-center text-gray-400 dark:text-gray-500 py-8">Aucune compétence enregistrée</p>
                ) : (
                  <div className="space-y-2">
                    {competences.map((comp: CompetenceDTO) => (
                      <div key={comp.id} className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold ${niveauColors[comp.niveau]} dark:opacity-80`}>
                            {comp.niveau}
                          </div>
                          <div>
                            <p className="text-theme-sm font-medium text-gray-800 dark:text-gray-200">{comp.nom}</p>
                            <div className="flex items-center gap-2">
                              {comp.categorie && <span className="text-theme-xs text-gray-400">{comp.categorie}</span>}
                              <span className="text-theme-xs text-gray-400">• {niveauLabels[comp.niveau]}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex gap-1">
                            {[1, 2, 3, 4, 5].map(n => (
                              <div key={n} className={`w-2.5 h-2.5 rounded-full ${n <= comp.niveau ? 'bg-brand-500' : 'bg-gray-200 dark:bg-gray-600'}`} />
                            ))}
                          </div>
                          <button onClick={() => { setEditingCompetence(comp); setCompetenceForm({ nom: comp.nom, categorie: comp.categorie || '', niveau: comp.niveau }); setShowCompetenceModal(true); }} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400">
                            <HiOutlinePencil size={14} />
                          </button>
                          <button onClick={() => handleDeleteCompetence(comp.id)} className="p-1 rounded hover:bg-error-50 dark:hover:bg-error-500/10 text-error-400">
                            <HiOutlineTrash size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Tab: Documents */}
            {activeTab === 'documents' && (
              <div className="space-y-4">
                {/* Lien Drive */}
                <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-theme-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71L12 2z" fill="currentColor" opacity="0.6"/>
                        <path d="M7.71 3.5L1.5 15l3.5 6h13l3.5-6L15.29 3.5H7.71zM12 17.5L5.5 15l2.8-5.5h7.4L18.5 15 12 17.5z" fill="currentColor"/>
                      </svg>
                      Dossier Google Drive
                    </h4>
                    {!editingDriveLink && (
                      <button
                        onClick={() => { setDriveLinkValue(viewingEmploye.lienDrive || ''); setEditingDriveLink(true); }}
                        className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 transition-colors"
                        title="Modifier le lien Drive"
                      >
                        <HiOutlinePencil size={14} />
                      </button>
                    )}
                  </div>
                  {editingDriveLink ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="url"
                        value={driveLinkValue}
                        onChange={(e) => setDriveLinkValue(e.target.value)}
                        placeholder="https://drive.google.com/drive/folders/..."
                        className="h-9 flex-1 rounded-lg border border-gray-300 bg-white px-3 text-theme-sm text-gray-700 focus:border-brand-300 focus:outline-none focus:ring focus:ring-brand-500/10 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
                      />
                      <button
                        onClick={handleSaveDriveLink}
                        className="p-1.5 rounded-lg bg-brand-500 text-white hover:bg-brand-600 transition-colors"
                        title="Enregistrer"
                      >
                        <HiOutlineCheck size={16} />
                      </button>
                      <button
                        onClick={() => setEditingDriveLink(false)}
                        className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 transition-colors"
                        title="Annuler"
                      >
                        <HiOutlineX size={16} />
                      </button>
                    </div>
                  ) : viewingEmploye.lienDrive ? (
                    <a
                      href={viewingEmploye.lienDrive}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-500/10 dark:text-blue-400 dark:hover:bg-blue-500/20 text-theme-sm font-medium transition-colors"
                    >
                      <HiOutlineExternalLink size={16} />
                      Ouvrir le dossier Drive
                    </a>
                  ) : (
                    <p className="text-theme-xs text-gray-400">Aucun lien Drive configuré. Cliquez sur le crayon pour en ajouter un.</p>
                  )}
                </div>

                <div className="flex justify-between items-center">
                  <h4 className="text-theme-sm font-semibold text-gray-700 dark:text-gray-300">Documents de l'employé</h4>
                  <Button size="sm" onClick={() => { setEditingDocument(null); setDocumentForm({ nom: '', type: 'CONTRAT', dateExpiration: '' }); setDocumentFile(null); setShowDocumentModal(true); }}>
                    <HiOutlinePlus size={14} /> Ajouter
                  </Button>
                </div>
                {documents.length === 0 ? (
                  <p className="text-center text-gray-400 dark:text-gray-500 py-8">Aucun document enregistré</p>
                ) : (
                  <div className="space-y-2">
                    {documents.map((doc: DocumentEmployeDTO) => (
                      <div key={doc.id} className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center">
                            <HiOutlineDocumentText className="text-blue-500" size={16} />
                          </div>
                          <div>
                            <p className="text-theme-sm font-medium text-gray-800 dark:text-gray-200">{doc.nom}</p>
                            <div className="flex items-center gap-2">
                              <Badge variant="light" color="primary">{doc.type}</Badge>
                              {doc.dateExpiration && (
                                <span className={`text-theme-xs ${new Date(doc.dateExpiration) < new Date() ? 'text-error-500' : 'text-gray-400'}`}>
                                  Expire: {doc.dateExpiration}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {doc.fichierUrl && (
                            <a href={`${API_BASE}${doc.fichierUrl}`} target="_blank" rel="noopener noreferrer" className="p-1 rounded hover:bg-green-50 dark:hover:bg-green-500/10 text-green-500" title="Télécharger">
                              <HiOutlineDownload size={14} />
                            </a>
                          )}
                          <button onClick={() => { setEditingDocument(doc); setDocumentForm({ nom: doc.nom, type: doc.type, dateExpiration: doc.dateExpiration || '' }); setDocumentFile(null); setShowDocumentModal(true); }} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400">
                            <HiOutlinePencil size={14} />
                          </button>
                          <button onClick={() => handleDeleteDocument(doc.id)} className="p-1 rounded hover:bg-error-50 dark:hover:bg-error-500/10 text-error-400">
                            <HiOutlineTrash size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end">
              <Button variant="ghost" onClick={() => setViewingEmploye(null)}>Fermer</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Competence Modal */}
      <Modal isOpen={showCompetenceModal} onClose={() => setShowCompetenceModal(false)} title={editingCompetence ? 'Modifier la compétence' : 'Ajouter une compétence'} size="md">
        <div className="space-y-4">
          <div>
            <label className="block text-theme-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nom *</label>
            <input type="text" value={competenceForm.nom} onChange={e => setCompetenceForm({ ...competenceForm, nom: e.target.value })} placeholder="Ex: Java, React, Gestion de projet" className={inputClass} />
          </div>
          <div>
            <label className="block text-theme-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Catégorie</label>
            <input type="text" value={competenceForm.categorie} onChange={e => setCompetenceForm({ ...competenceForm, categorie: e.target.value })} placeholder="Ex: Technique, Management, Langue" className={inputClass} />
          </div>
          <div>
            <label className="block text-theme-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Niveau (1-5)</label>
            <div className="flex items-center gap-4">
              <input type="range" min={1} max={5} value={competenceForm.niveau} onChange={e => setCompetenceForm({ ...competenceForm, niveau: Number(e.target.value) })} className="flex-1" />
              <span className="text-theme-sm font-medium text-gray-700 dark:text-gray-300 w-24">{competenceForm.niveau} - {niveauLabels[competenceForm.niveau]}</span>
            </div>
            <div className="flex justify-between mt-1 px-1">
              {[1, 2, 3, 4, 5].map(n => (
                <div key={n} className={`w-3 h-3 rounded-full cursor-pointer ${n <= competenceForm.niveau ? 'bg-brand-500' : 'bg-gray-200 dark:bg-gray-600'}`} onClick={() => setCompetenceForm({ ...competenceForm, niveau: n })} />
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <Button variant="ghost" onClick={() => setShowCompetenceModal(false)}>Annuler</Button>
            <Button onClick={handleSaveCompetence} disabled={!competenceForm.nom.trim()}>{editingCompetence ? 'Modifier' : 'Ajouter'}</Button>
          </div>
        </div>
      </Modal>

      {/* Document Modal */}
      <Modal isOpen={showDocumentModal} onClose={() => setShowDocumentModal(false)} title={editingDocument ? 'Modifier le document' : 'Ajouter un document'} size="md">
        <div className="space-y-4">
          <div>
            <label className="block text-theme-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nom *</label>
            <input type="text" value={documentForm.nom} onChange={e => setDocumentForm({ ...documentForm, nom: e.target.value })} placeholder="Ex: Contrat CDI, Attestation de travail" className={inputClass} />
          </div>
          <div>
            <label className="block text-theme-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Type</label>
            <FormSelect
              value={documentForm.type}
              onChange={val => setDocumentForm({ ...documentForm, type: val })}
              options={docTypes.map(t => ({ value: t, label: t }))}
            />
          </div>
          <div>
            <label className="block text-theme-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date d'expiration</label>
            <FormDatePicker value={documentForm.dateExpiration} onChange={val => setDocumentForm({ ...documentForm, dateExpiration: val })} />
          </div>
          <div>
            <label className="block text-theme-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Fichier</label>
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => docFileInputRef.current?.click()} className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-theme-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                <HiOutlineUpload size={16} /> {documentFile ? documentFile.name : 'Choisir un fichier'}
              </button>
              <input ref={docFileInputRef} type="file" onChange={e => setDocumentFile(e.target.files?.[0] || null)} className="hidden" />
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <Button variant="ghost" onClick={() => setShowDocumentModal(false)}>Annuler</Button>
            <Button onClick={handleSaveDocument} disabled={!documentForm.nom.trim()}>{editingDocument ? 'Modifier' : 'Ajouter'}</Button>
          </div>
        </div>
      </Modal>

      {/* Credentials Modal */}
      <Modal isOpen={showCredentialsModal} onClose={() => setShowCredentialsModal(false)} title="✅ Compte créé avec succès" size="md">
        {credentials && (
          <div className="space-y-4">
            <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <p className="text-theme-sm text-green-800 dark:text-green-300 font-medium mb-3">
                Les identifiants de connexion ont été générés :
              </p>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-theme-sm text-gray-600 dark:text-gray-400 w-32">Login (matricule) :</span>
                  <code className="px-2 py-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-sm font-mono font-bold text-brand-600 dark:text-brand-400">
                    {credentials.username}
                  </code>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-theme-sm text-gray-600 dark:text-gray-400 w-32">Mot de passe :</span>
                  <code className="px-2 py-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-sm font-mono font-bold text-brand-600 dark:text-brand-400">
                    {credentials.password}
                  </code>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-theme-sm text-gray-600 dark:text-gray-400 w-32">Email :</span>
                  <span className="text-theme-sm text-gray-700 dark:text-gray-300">{credentials.email}</span>
                </div>
              </div>
            </div>
            <p className="text-theme-xs text-gray-500 dark:text-gray-400">
              ⚠️ Ces identifiants ont été envoyés par email à l'employé. Notez-les si nécessaire, ils ne seront plus visibles après fermeture.
            </p>
            <div className="flex justify-end">
              <Button onClick={() => setShowCredentialsModal(false)}>Fermer</Button>
            </div>
          </div>
        )}
      </Modal>

    <ConfirmDialog
      isOpen={confirmState.isOpen}
      title={confirmState.title}
      message={confirmState.message}
      confirmLabel="Archiver"
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
    </div>
  );
};

const InfoRow: React.FC<{ label: string; value: string | number | null | undefined }> = ({ label, value }: { label: string; value: string | number | null | undefined }) => (
  <div>
    <span className="text-theme-xs text-gray-400 dark:text-gray-500">{label}</span>
    <p className="text-theme-sm font-medium text-gray-800 dark:text-gray-200">{value || '—'}</p>
  </div>
);

const colorMap: Record<string, string> = {
  brand: 'bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400',
  green: 'bg-green-50 text-green-600 dark:bg-green-500/10 dark:text-green-400',
  blue: 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400',
  purple: 'bg-purple-50 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400',
  orange: 'bg-brand- text-brand- dark:bg-brand-/10 dark:text-brand-',
  cyan: 'bg-cyan-50 text-cyan-600 dark:bg-cyan-500/10 dark:text-cyan-400',
};

const StatBox: React.FC<{ label: string; value: string | number; color: string }> = ({ label, value, color }: { label: string; value: string | number; color: string }) => (
  <div className={`rounded-xl p-4 ${colorMap[color] || colorMap.brand}`}>
    <p className="text-2xl font-bold">{value}</p>
    <p className="text-theme-xs opacity-80 mt-1">{label}</p>
  </div>
);

const barColors = [
  'bg-brand-500', 'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-brand-',
  'bg-cyan-500', 'bg-pink-500', 'bg-yellow-500', 'bg-red-500', 'bg-indigo-500',
];

const DistributionCard: React.FC<{ title: string; data: Record<string, number> }> = ({ title, data }: { title: string; data: Record<string, number> }) => {
  const entries: [string, number][] = Object.entries(data).sort((a, b) => b[1] - a[1]);
  const max = Math.max(...entries.map(([, v]) => v), 1);
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-800">
      <h4 className="text-theme-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">{title}</h4>
      {entries.length === 0 ? (
        <p className="text-theme-xs text-gray-400">Aucune donnée</p>
      ) : (
        <div className="space-y-2">
          {entries.map(([key, val], i) => (
            <div key={key} className="space-y-1">
              <div className="flex justify-between text-theme-xs">
                <span className="text-gray-600 dark:text-gray-400">{key}</span>
                <span className="font-medium text-gray-700 dark:text-gray-300">{val as number}</span>
              </div>
              <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${barColors[i % barColors.length]}`}
                  style={{ width: `${((val as number) / max) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};


export default EmployesPage;
