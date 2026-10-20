import React, { useState, useEffect } from 'react';
import {
  HiOutlinePlus,
  HiOutlineSearch,
  HiOutlinePencil,
  HiOutlineTrash,
  HiOutlineCollection,
  HiOutlineTag,
} from 'react-icons/hi';
import { referentielService } from '../api/referentielService';
import { TypeReferentiel, TypeReferentielLabels, Referentiel } from '../types';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import DataTable from '../components/ui/DataTable';
import Badge from '../components/ui/Badge';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { useConfirm } from '../hooks/useConfirm';

const ALL_TYPES = Object.values(TypeReferentiel);

const PLACEHOLDERS: Record<string, { libelle: string; description: string }> = {
  [TypeReferentiel.DEPARTEMENT]: { libelle: 'Ex: IT, Finance, Ressources Humaines...', description: 'Décrivez le département...' },
  [TypeReferentiel.TYPE_CONTRAT]: { libelle: 'Ex: CDI, CDD, Stage, Freelance...', description: 'Décrivez le type de contrat...' },
  [TypeReferentiel.SITE_ETABLISSEMENT]: { libelle: 'Ex: Siège Casablanca, Agence Rabat...', description: 'Décrivez le site ou établissement...' },
  [TypeReferentiel.POSTE]: { libelle: 'Ex: Développeur, Chef de projet, RH...', description: 'Décrivez le poste...' },
  [TypeReferentiel.NIVEAU_HIERARCHIQUE]: { libelle: 'Ex: Junior, Senior, Manager, Directeur...', description: 'Décrivez le niveau hiérarchique...' },
  [TypeReferentiel.TYPE_CONGE]: { libelle: 'Ex: Annuel, Maladie, Maternité...', description: 'Décrivez le type de congé...' },
  [TypeReferentiel.TYPE_DEMANDE]: { libelle: 'Ex: Attestation de travail, Ordre de mission...', description: 'Décrivez le type de demande...' },
  [TypeReferentiel.GENRE]: { libelle: 'Ex: Masculin, Féminin...', description: 'Décrivez le genre...' },
  [TypeReferentiel.PARAMETRE_SYSTEME]: { libelle: 'Ex: Solde congé initial, Délai validation...', description: 'Décrivez le paramètre système...' },
};

const ReferentielsPage: React.FC = () => {
  const { confirmState, confirm, handleConfirm, handleCancel } = useConfirm();
  const [referentiels, setReferentiels] = useState<Referentiel[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState<TypeReferentiel>(ALL_TYPES[0]);
  const [showModal, setShowModal] = useState(false);
  const [editingRef, setEditingRef] = useState<Referentiel | null>(null);
  const [refForm, setRefForm] = useState({ libelle: '', description: '', typeReferentiel: ALL_TYPES[0] as string, valeur: '' });

  useEffect(() => {
    loadReferentiels();
  }, []);

  const loadReferentiels = async () => {
    try {
      const response = await referentielService.getAll();
      setReferentiels(response.data.data || []);
    } catch (err) {
      console.error('Erreur chargement référentiels:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      if (editingRef) {
        await referentielService.update(editingRef.id, refForm);
      } else {
        await referentielService.create(refForm);
      }
      setShowModal(false);
      setEditingRef(null);
      resetForm();
      loadReferentiels();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Erreur lors de la sauvegarde');
    }
  };

  const handleEdit = (ref: Referentiel) => {
    setEditingRef(ref);
    setRefForm({
      libelle: ref.libelle,
      description: ref.description || '',
      typeReferentiel: ref.typeReferentiel,
      valeur: ref.valeur || '',
    });
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    confirm('Êtes-vous sûr de vouloir supprimer ce référentiel ?', async () => {
      try {
        await referentielService.delete(id);
        loadReferentiels();
      } catch (err: any) {
        alert(err.response?.data?.message || 'Erreur lors de la suppression');
      }
    }, 'Supprimer le référentiel');
  };

  const handleToggleActif = async (id: number) => {
    try {
      await referentielService.toggleActif(id);
      loadReferentiels();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Erreur lors du changement de statut');
    }
  };

  const resetForm = () => {
    setRefForm({ libelle: '', description: '', typeReferentiel: selectedType, valeur: '' });
  };

  const filteredRefs = referentiels.filter((r) => {
    const matchType = r.typeReferentiel === selectedType;
    const matchSearch =
      r.libelle.toLowerCase().includes(search.toLowerCase()) ||
      (r.description && r.description.toLowerCase().includes(search.toLowerCase()));
    return matchType && matchSearch;
  });

  const countByType = (type: TypeReferentiel) =>
    referentiels.filter((r) => r.typeReferentiel === type).length;

  const isTypeConge = selectedType === TypeReferentiel.TYPE_CONGE;

  const columns = [
    {
      key: 'libelle',
      label: 'Libellé',
      render: (item: Referentiel) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-brand-50 text-brand-500 dark:bg-brand-500/[0.12] dark:text-brand-400 flex items-center justify-center">
            <HiOutlineTag size={16} />
          </div>
          <span className="font-medium text-gray-800 dark:text-white">{item.libelle}</span>
        </div>
      ),
    },
    { key: 'description', label: 'Description' },
    ...(selectedType === TypeReferentiel.PARAMETRE_SYSTEME
      ? [
          {
            key: 'valeur',
            label: 'Valeur',
            render: (item: Referentiel) => {
              if (!item.valeur) return <span className="text-gray-400">—</span>;
              const lib = item.libelle.toUpperCase();
              let unit = '';
              if (lib.includes('MINUTE')) unit = 'minutes';
              else if (lib.includes('HEURE')) unit = 'heures';
              else if (lib.includes('CONGE') || lib.includes('JOUR') || lib.includes('SOLDE')) unit = 'jours';
              return (
                <span className="font-mono text-theme-sm text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-500/10 px-2 py-0.5 rounded">
                  {item.valeur}{unit ? ` ${unit}` : ''}
                </span>
              );
            },
          },
        ]
      : []),
    {
      key: 'actif',
      label: 'Statut',
      render: (item: Referentiel) => (
        <button onClick={() => handleToggleActif(item.id)} className="cursor-pointer" title="Cliquer pour changer le statut">
          <Badge text={item.actif ? 'Actif' : 'Inactif'} variant={item.actif ? 'success' : 'danger'} />
        </button>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (item: Referentiel) => (
        <div className="flex gap-2">
          {!isTypeConge && (
            <>
              <button onClick={() => handleEdit(item)} className="p-1.5 rounded-lg hover:bg-brand-50 text-brand-500 transition-colors" title="Modifier">
                <HiOutlinePencil size={16} />
              </button>
              <button onClick={() => handleDelete(item.id)} className="p-1.5 rounded-lg hover:bg-error-50 text-error-500 transition-colors" title="Supprimer">
                <HiOutlineTrash size={16} />
              </button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-title-sm font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-gray-900 to-[#683b77] dark:from-white dark:to-[#ab78c3]">Référentiels</h1>
        <p className="text-theme-sm text-gray-500 dark:text-gray-400 mt-1">
          Gérer les valeurs de référence par catégorie
        </p>
      </div>

      <div className="flex gap-6">
        {/* Sidebar - Fixed types */}
        <div className="w-64 shrink-0">
          <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] p-2">
            <p className="px-3 py-2 text-theme-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
              Types
            </p>
            <nav className="space-y-0.5">
              {ALL_TYPES.map((type) => (
                <button
                  key={type}
                  onClick={() => { setSelectedType(type); setSearch(''); }}
                  className={`w-full flex items-center justify-between rounded-lg px-3 py-2.5 text-theme-sm font-medium transition-colors ${
                    selectedType === type
                      ? 'bg-brand-50 text-brand-600 dark:bg-brand-500/[0.12] dark:text-brand-400'
                      : 'text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-white/[0.03]'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <HiOutlineCollection size={16} />
                    {TypeReferentielLabels[type]}
                  </span>
                  <span className={`text-theme-xs rounded-full px-2 py-0.5 ${
                    selectedType === type
                      ? 'bg-brand-100 text-brand-600 dark:bg-brand-500/20 dark:text-brand-400'
                      : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500'
                  }`}>
                    {countByType(type)}
                  </span>
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="relative max-w-md flex-1">
              <HiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={`Rechercher dans ${TypeReferentielLabels[selectedType]}...`}
                className="h-11 w-full rounded-lg border border-gray-300 bg-transparent pl-10 pr-4 text-theme-sm text-gray-700 focus:border-brand-300 focus:outline-none focus:ring focus:ring-brand-500/10 dark:border-gray-600 dark:text-gray-300"
              />
            </div>
            <Button onClick={() => { setEditingRef(null); setRefForm({ libelle: '', description: '', typeReferentiel: selectedType, valeur: '' }); setShowModal(true); }} disabled={isTypeConge}>
              <HiOutlinePlus size={18} /> Ajouter
            </Button>
          </div>

          {loading ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">Chargement...</div>
          ) : filteredRefs.length === 0 ? (
            <div className="text-center py-12">
              <HiOutlineTag className="mx-auto text-gray-300 dark:text-gray-600" size={48} />
              <p className="mt-3 text-gray-500 dark:text-gray-400">
                Aucun référentiel pour « {TypeReferentielLabels[selectedType]} »
              </p>
              {!isTypeConge && (
                <Button
                  variant="ghost"
                  className="mt-4"
                  onClick={() => { setEditingRef(null); setRefForm({ libelle: '', description: '', typeReferentiel: selectedType, valeur: '' }); setShowModal(true); }}
                >
                  <HiOutlinePlus size={16} /> Créer le premier
                </Button>
              )}
            </div>
          ) : (
            <DataTable columns={columns} data={filteredRefs} />
          )}
        </div>
      </div>

      {/* Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingRef ? 'Modifier le référentiel' : `Nouveau référentiel — ${TypeReferentielLabels[refForm.typeReferentiel as TypeReferentiel] || ''}`}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-theme-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Libellé *</label>
            <input
              type="text"
              value={refForm.libelle}
              onChange={(e) => setRefForm({ ...refForm, libelle: e.target.value })}
              placeholder={PLACEHOLDERS[refForm.typeReferentiel]?.libelle || 'Libellé du référentiel...'}
              className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 text-theme-sm text-gray-700 focus:border-brand-300 focus:outline-none focus:ring focus:ring-brand-500/10 dark:border-gray-600 dark:text-gray-300"
            />
          </div>
          <div>
            <label className="block text-theme-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
            <textarea
              value={refForm.description}
              onChange={(e) => setRefForm({ ...refForm, description: e.target.value })}
              placeholder={PLACEHOLDERS[refForm.typeReferentiel]?.description || 'Description du référentiel...'}
              rows={3}
              className="w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-theme-sm text-gray-700 focus:border-brand-300 focus:outline-none focus:ring focus:ring-brand-500/10 dark:border-gray-600 dark:text-gray-300"
            />
          </div>
          {(refForm.typeReferentiel === TypeReferentiel.PARAMETRE_SYSTEME
            || refForm.typeReferentiel === TypeReferentiel.FORMAT_MEDIA_PLAN) && (
            <div>
              <label className="block text-theme-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {refForm.typeReferentiel === TypeReferentiel.FORMAT_MEDIA_PLAN
                  ? 'Département responsable'
                  : 'Valeur *'}
              </label>
              <input
                type="text"
                value={refForm.valeur}
                onChange={(e) => setRefForm({ ...refForm, valeur: e.target.value })}
                placeholder={refForm.typeReferentiel === TypeReferentiel.FORMAT_MEDIA_PLAN
                  ? 'Libellé exact du département (ex: Production)'
                  : 'Ex: 120, 30...'}
                className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 text-theme-sm text-gray-700 focus:border-brand-300 focus:outline-none focus:ring focus:ring-brand-500/10 dark:border-gray-600 dark:text-gray-300"
              />
              {refForm.typeReferentiel === TypeReferentiel.FORMAT_MEDIA_PLAN && (
                <p className="text-theme-xs text-gray-400 mt-1">
                  Le manager de ce département valide les lignes de ce format. Laissez vide s'il n'y a pas de chef dédié.
                </p>
              )}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="ghost" onClick={() => setShowModal(false)}>Annuler</Button>
          <Button onClick={handleSave} disabled={!refForm.libelle.trim() || !refForm.typeReferentiel}>
            {editingRef ? 'Modifier' : 'Créer'}
          </Button>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={confirmState.isOpen}
        title={confirmState.title}
        message={confirmState.message}
        confirmLabel="Supprimer"
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </div>
  );
};

export default ReferentielsPage;
