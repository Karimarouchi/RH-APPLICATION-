import React, { useState, useEffect } from 'react';
import { HiOutlineSearch, HiOutlineEye, HiOutlineRefresh, HiOutlineCalendar, HiOutlineViewGrid, HiOutlineTable } from 'react-icons/hi';
import { motion } from 'framer-motion';
import { employeService } from '../api/employeService';
import { Employe } from '../types';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import DataTable from '../components/ui/DataTable';
import Badge from '../components/ui/Badge';
import { API_BASE } from '../api/axios';
import { useConfirm } from '../hooks/useConfirm';

const ArchivesPage: React.FC = () => {
  const { confirmState, confirm, handleConfirm, handleCancel } = useConfirm();
  const [archivedEmployes, setArchivedEmployes] = useState<Employe[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [viewingEmploye, setViewingEmploye] = useState<Employe | null>(null);

  useEffect(() => {
    loadArchived();
  }, []);

  const loadArchived = async () => {
    setLoading(true);
    try {
      const res = await employeService.getArchived();
      setArchivedEmployes(res.data.data || []);
    } catch (err) {
      console.error('Erreur chargement archives:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (id: number) => {
    confirm(
      'Êtes-vous sûr de vouloir restaurer cet employé ? Son compte utilisateur restera désactivé par défaut mais son profil sera de nouveau actif.',
      async () => {
        try {
          await employeService.unarchive(id);
          loadArchived();
        } catch (err: any) {
          const msg = err?.response?.data?.message || 'Impossible de restaurer cet employé.';
          alert(msg);
          console.error('Erreur restauration:', err);
        }
      },
      'Restaurer l\'employé'
    );
  };

  // Filter archived employees based on search term
  const filteredEmployes = archivedEmployes.filter(emp => {
    const searchLower = searchTerm.toLowerCase();
    return (
      emp.nom.toLowerCase().includes(searchLower) ||
      emp.prenom.toLowerCase().includes(searchLower) ||
      emp.matricule.toLowerCase().includes(searchLower) ||
      (emp.poste && emp.poste.toLowerCase().includes(searchLower)) ||
      (emp.departement && emp.departement.toLowerCase().includes(searchLower))
    );
  });

  const columns = [
    {
      key: 'photo',
      label: 'Photo',
      render: (item: Employe) => (
        <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0 bg-gray-100 dark:bg-gray-800">
          {item.imageUrl ? (
            <img src={`${API_BASE}${item.imageUrl}`} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-brand-100 dark:bg-brand-500/20 text-brand-600 dark:text-brand-400 flex items-center justify-center font-bold text-sm">
              {item.nom[0]}{item.prenom[0]}
            </div>
          )}
        </div>
      ),
    },
    { key: 'matricule', label: 'Matricule' },
    {
      key: 'nom',
      label: 'Nom Complet',
      render: (item: Employe) => (
        <span className="font-semibold text-gray-800 dark:text-gray-200">
          {item.nom} {item.prenom}
        </span>
      ),
    },
    { key: 'poste', label: 'Poste', render: (item: Employe) => item.poste || '—' },
    { key: 'departement', label: 'Département', render: (item: Employe) => item.departement || '—' },
    {
      key: 'archivedAt',
      label: 'Date d\'archivage',
      render: (item: Employe) => {
        if (!item.archivedAt) return '—';
        try {
          const date = new Date(item.archivedAt);
          return date.toLocaleDateString('fr-FR', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          });
        } catch {
          return item.archivedAt;
        }
      },
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (item: Employe) => (
        <div className="flex gap-2">
          <button
            onClick={() => setViewingEmploye(item)}
            className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-500 dark:hover:bg-blue-500/10 transition-colors"
            title="Voir les détails"
          >
            <HiOutlineEye size={16} />
          </button>
          <button
            onClick={() => handleRestore(item.id)}
            className="p-1.5 rounded-lg hover:bg-green-50 text-green-600 dark:hover:bg-green-500/10 transition-colors"
            title="Restaurer l'employé"
          >
            <HiOutlineRefresh size={16} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-title-sm font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-gray-900 to-[#683b77] dark:from-white dark:to-[#ab78c3]">
            Espace Archives
          </h1>
          <p className="text-theme-sm text-gray-500 dark:text-gray-400 mt-1">
            Consulter et restaurer la liste des employés archivés.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative w-full md:w-72">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400">
              <HiOutlineSearch size={18} />
            </span>
            <input
              type="text"
              placeholder="Rechercher un employé..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="h-11 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 pl-10 pr-4 text-theme-sm text-gray-700 dark:text-gray-200 focus:border-brand-300 focus:outline-none focus:ring focus:ring-brand-500/10"
            />
          </div>

          <div className="flex items-center rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400' : 'text-gray-400 hover:text-gray-500 dark:hover:text-gray-300'}`}
              title="Vue en grille"
            >
              <HiOutlineViewGrid size={18} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-md transition-colors ${viewMode === 'list' ? 'bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400' : 'text-gray-400 hover:text-gray-500 dark:hover:text-gray-300'}`}
              title="Vue en liste"
            >
              <HiOutlineTable size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Loading state */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <div className="w-12 h-12 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-theme-sm text-gray-500 dark:text-gray-400">Chargement des archives...</p>
        </div>
      ) : filteredEmployes.length === 0 ? (
        <div className="text-center py-16 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800/50">
          <HiOutlineCalendar className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" />
          <h3 className="mt-2 text-theme-sm font-semibold text-gray-900 dark:text-white">Aucun employé archivé</h3>
          <p className="mt-1 text-theme-xs text-gray-500 dark:text-gray-400">
            {searchTerm ? 'Aucun résultat ne correspond à votre recherche.' : 'La liste des archives est actuellement vide.'}
          </p>
        </div>
      ) : viewMode === 'grid' ? (
        /* Grid Layout */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filteredEmployes.map((emp, index) => {
            const initials = emp.nom.split(' ').map(n => n[0]).join('').slice(0, 2);
            return (
              <motion.div
                key={emp.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                className="group relative rounded-2xl border border-gray-200 dark:border-gray-700/50 bg-white dark:bg-gray-900 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden"
              >
                <div className="p-5 flex flex-col items-center text-center">
                  {/* Photo Container */}
                  <div className="relative mb-4">
                    <div className="w-20 h-20 rounded-2xl overflow-hidden border-2 border-gray-100 dark:border-gray-800 shadow-sm flex items-center justify-center">
                      {emp.imageUrl ? (
                        <img src={`${API_BASE}${emp.imageUrl}`} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-brand-100 dark:bg-brand-500/20 text-brand-600 dark:text-brand-400 flex items-center justify-center text-xl font-bold">
                          {initials}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Text details */}
                  <h3 className="text-theme-sm font-bold text-gray-900 dark:text-white leading-tight mb-1">
                    {emp.nom} {emp.prenom}
                  </h3>
                  <p className="text-theme-xs text-brand-500 font-medium mb-2">{emp.poste || '—'}</p>
                  <p className="text-theme-xs text-gray-400 mb-1">{emp.departement || '—'}</p>
                  <p className="text-theme-xs text-gray-500">Matricule: {emp.matricule}</p>

                  {/* Archived date badge */}
                  {emp.archivedAt && (
                    <div className="mt-4 px-3 py-1 rounded-full bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-medium flex items-center gap-1">
                      <HiOutlineCalendar size={12} />
                      Archivé le {new Date(emp.archivedAt).toLocaleDateString()}
                    </div>
                  )}

                  {/* Actions hover */}
                  <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-all z-20">
                    <button
                      onClick={() => setViewingEmploye(emp)}
                      className="p-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-blue-500 transition-all"
                    >
                      <HiOutlineEye size={15} />
                    </button>
                    <button
                      onClick={() => handleRestore(emp.id)}
                      className="p-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-green-600 transition-all"
                      title="Restaurer l'employé"
                    >
                      <HiOutlineRefresh size={15} />
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      ) : (
        /* List Layout */
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden shadow-sm">
          <DataTable columns={columns} data={filteredEmployes} />
        </div>
      )}

      {/* Details Modal */}
      <Modal isOpen={!!viewingEmploye} onClose={() => setViewingEmploye(null)} title="Détails de l'employé archivé">
        {viewingEmploye && (
          <div className="space-y-6">
            <div className="flex items-center gap-4 p-4 rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
              <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 bg-gray-100 dark:bg-gray-800">
                {viewingEmploye.imageUrl ? (
                  <img src={`${API_BASE}${viewingEmploye.imageUrl}`} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-brand-100 dark:bg-brand-500/20 text-brand-600 dark:text-brand-400 flex items-center justify-center text-lg font-bold">
                    {viewingEmploye.nom[0]}{viewingEmploye.prenom[0]}
                  </div>
                )}
              </div>
              <div>
                <h4 className="text-theme-base font-bold text-gray-900 dark:text-white">
                  {viewingEmploye.nom} {viewingEmploye.prenom}
                </h4>
                <p className="text-theme-sm text-brand-500 font-medium">{viewingEmploye.poste || '—'}</p>
                <p className="text-theme-xs text-gray-400">{viewingEmploye.departement || '—'}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <span className="text-theme-xs font-semibold text-gray-400 dark:text-gray-500 block">Matricule</span>
                <span className="text-theme-sm text-gray-700 dark:text-gray-300 font-medium">{viewingEmploye.matricule}</span>
              </div>
              <div className="space-y-1">
                <span className="text-theme-xs font-semibold text-gray-400 dark:text-gray-500 block">Email</span>
                <span className="text-theme-sm text-gray-700 dark:text-gray-300 font-medium">{viewingEmploye.email}</span>
              </div>
              <div className="space-y-1">
                <span className="text-theme-xs font-semibold text-gray-400 dark:text-gray-500 block">Téléphone</span>
                <span className="text-theme-sm text-gray-700 dark:text-gray-300 font-medium">{viewingEmploye.telephone || '—'}</span>
              </div>
              <div className="space-y-1">
                <span className="text-theme-xs font-semibold text-gray-400 dark:text-gray-500 block">Date d'embauche</span>
                <span className="text-theme-sm text-gray-700 dark:text-gray-300 font-medium">{viewingEmploye.dateEmbauche || '—'}</span>
              </div>
              <div className="space-y-1">
                <span className="text-theme-xs font-semibold text-gray-400 dark:text-gray-500 block">Archivé le</span>
                <span className="text-theme-sm text-amber-600 dark:text-amber-400 font-medium">
                  {viewingEmploye.archivedAt ? new Date(viewingEmploye.archivedAt).toLocaleString('fr-FR') : '—'}
                </span>
              </div>
              <div className="space-y-1">
                <span className="text-theme-xs font-semibold text-gray-400 dark:text-gray-500 block">Type contrat</span>
                <span className="text-theme-sm text-gray-700 dark:text-gray-300 font-medium">{viewingEmploye.typeContrat || '—'}</span>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
              <Button variant="ghost" onClick={() => setViewingEmploye(null)}>Fermer</Button>
              <Button variant="primary" onClick={() => { handleRestore(viewingEmploye.id); setViewingEmploye(null); }}>
                Restaurer l'employé
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Confirmation dialog */}
      <ConfirmDialog {...confirmState} onConfirm={handleConfirm} onCancel={handleCancel} />
    </div>
  );
};

export default ArchivesPage;
