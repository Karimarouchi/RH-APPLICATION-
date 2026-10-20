import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { employeService } from '../api/employeService';
import { Employe } from '../types';
import Badge from '../components/ui/Badge';
import { API_BASE } from '../api/axios';
import { formatGenreIcon, formatGenreLabel } from '../utils/genre';
import {
  HiOutlineUser,
  HiOutlineMail,
  HiOutlinePhone,
  HiOutlineIdentification,
  HiOutlineOfficeBuilding,
  HiOutlineBriefcase,
  HiOutlineCalendar,
  HiOutlineCreditCard,
  HiOutlinePencil,
  HiOutlineExternalLink,
  HiOutlineCheck,
  HiOutlineX,
  HiOutlineFolder,
  HiOutlineLockClosed,
} from 'react-icons/hi';

const MonProfilPage: React.FC = () => {
  const { user } = useAuth();
  const [employe, setEmploye] = useState<Employe | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingDriveLink, setEditingDriveLink] = useState(false);
  const [driveLinkValue, setDriveLinkValue] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    if (user?.employeId) {
      employeService.getById(user.employeId)
        .then((res) => setEmploye(res.data.data || null))
        .catch((err) => console.error('Erreur chargement profil:', err))
        .finally(() => setLoading(false));
    }
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin h-8 w-8 border-4 border-brand-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!employe) {
    return (
      <div className="text-center py-20 text-gray-500 dark:text-gray-400">
        Impossible de charger vos informations.
      </div>
    );
  }

  const InfoItem: React.FC<{ icon: React.ReactNode; label: string; value: string | number | null | undefined; }> = ({ icon, label, value }) => (
    <div className="flex items-start gap-3 p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700/50">
      <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-brand-50 dark:bg-brand-500/10 text-brand-500 shrink-0 mt-0.5">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-theme-xs text-gray-400 dark:text-gray-500 font-medium uppercase tracking-wide">{label}</p>
        <p className="text-theme-sm font-semibold text-gray-800 dark:text-gray-100 mt-0.5 truncate">
          {value || '—'}
        </p>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header Card */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-brand-500 to-brand-600 p-8 text-white">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4" />
        <div className="absolute bottom-0 left-0 w-40 h-40 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/4" />

        <div className="relative flex items-center gap-5">
          {employe.imageUrl ? (
            <img src={`${API_BASE}${employe.imageUrl}`} alt="" className="w-20 h-20 rounded-2xl object-cover shrink-0" />
          ) : (
            <div className="flex items-center justify-center w-20 h-20 rounded-2xl bg-white/20 backdrop-blur-sm text-3xl font-bold shrink-0">
              {employe.prenom?.[0]}{employe.nom?.[0]}
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold">{employe.prenom} {employe.nom}</h1>
            <p className="text-white/80 mt-1">{employe.poste || 'Poste non défini'}</p>
            <div className="flex items-center gap-3 mt-3">
              <span className="px-3 py-1 bg-white/20 rounded-full text-sm font-medium">{employe.matricule}</span>
              {employe.departement && (
                <span className="px-3 py-1 bg-white/20 rounded-full text-sm font-medium">{employe.departement}</span>
              )}
              {employe.typeContrat && (
                <span className="px-3 py-1 bg-white/20 rounded-full text-sm font-medium">{employe.typeContrat}</span>
              )}
            </div>
            <button
              onClick={() => navigate('/change-password')}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-lg text-sm font-medium transition-colors"
            >
              <HiOutlineLockClosed size={16} />
              Changer le mot de passe
            </button>
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5 text-center">
          <p className="text-3xl font-bold text-brand-500">{employe.soldeConge}</p>
          <p className="text-theme-sm text-gray-500 dark:text-gray-400 mt-1">Jours de congé restants</p>
        </div>
        <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5 text-center">
          <p className="text-3xl font-bold text-secondary-500">{employe.dateEmbauche || '—'}</p>
          <p className="text-theme-sm text-gray-500 dark:text-gray-400 mt-1">Date d'embauche</p>
        </div>
        <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5 text-center">
          <p className="text-3xl font-bold text-green-500">
            {formatGenreIcon(employe.genre)}
          </p>
          <p className="text-theme-sm text-gray-500 dark:text-gray-400 mt-1">
            {formatGenreLabel(employe.genre)}
          </p>
        </div>
      </div>

      {/* Info Grid */}
      <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-6">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-5">Informations personnelles</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <InfoItem icon={<HiOutlineMail size={20} />} label="Email" value={employe.email} />
          <InfoItem icon={<HiOutlinePhone size={20} />} label="Téléphone" value={employe.telephone} />
          <InfoItem icon={<HiOutlineIdentification size={20} />} label="CIN" value={employe.cin} />
          <InfoItem icon={<HiOutlineIdentification size={20} />} label="CNSS" value={employe.cnss} />
          <InfoItem icon={<HiOutlineCreditCard size={20} />} label="RIB Bancaire" value={employe.ribBancaire} />
          <InfoItem icon={<HiOutlineUser size={20} />} label="Manager" value={employe.managerNom} />
          <InfoItem icon={<HiOutlineOfficeBuilding size={20} />} label="Département" value={employe.departement} />
          <InfoItem icon={<HiOutlineBriefcase size={20} />} label="Poste" value={employe.poste} />
          <InfoItem icon={<HiOutlineCalendar size={20} />} label="Date d'embauche" value={employe.dateEmbauche} />
          <InfoItem icon={<HiOutlineUser size={20} />} label="Type de contrat" value={employe.typeContrat} />
        </div>
      </div>

      {/* Google Drive */}
      <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-white flex items-center gap-2">
            <HiOutlineFolder size={22} className="text-brand-500" />
            Dossier Google Drive
          </h2>
          {!editingDriveLink && (
            <button
              onClick={() => { setEditingDriveLink(true); setDriveLinkValue(employe.lienDrive || ''); }}
              className="p-2 text-gray-400 hover:text-brand-500 hover:bg-brand-50 dark:hover:bg-brand-500/10 rounded-lg transition-colors"
              title="Modifier le lien"
            >
              <HiOutlinePencil size={18} />
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
              className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            />
            <button
              onClick={async () => {
                if (employe) {
                  try {
                    await employeService.updateLienDrive(employe.id!, driveLinkValue || null);
                    setEmploye({ ...employe, lienDrive: driveLinkValue || null });
                    setEditingDriveLink(false);
                  } catch (err) {
                    console.error('Erreur sauvegarde lien Drive:', err);
                  }
                }
              }}
              className="p-2.5 text-white bg-green-500 hover:bg-green-600 rounded-xl transition-colors"
              title="Enregistrer"
            >
              <HiOutlineCheck size={18} />
            </button>
            <button
              onClick={() => setEditingDriveLink(false)}
              className="p-2.5 text-gray-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-colors"
              title="Annuler"
            >
              <HiOutlineX size={18} />
            </button>
          </div>
        ) : employe.lienDrive ? (
          <a
            href={employe.lienDrive}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 p-4 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-colors group"
          >
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-500 text-white shrink-0">
              <HiOutlineExternalLink size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-blue-700 dark:text-blue-300">Accéder à mon dossier Drive</p>
              <p className="text-xs text-blue-500 dark:text-blue-400 truncate mt-0.5">{employe.lienDrive}</p>
            </div>
          </a>
        ) : (
          <div className="text-center py-6 text-gray-400 dark:text-gray-500">
            <HiOutlineFolder size={32} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm">Aucun lien Drive configuré</p>
            <button
              onClick={() => { setEditingDriveLink(true); setDriveLinkValue(''); }}
              className="mt-2 text-sm text-brand-500 hover:text-brand-600 font-medium"
            >
              Ajouter un lien
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default MonProfilPage;
