import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  HiOutlineSearch, HiOutlineEye, HiOutlineXCircle, HiOutlinePlus, HiOutlinePencil,
  HiOutlineClock, HiOutlineCheckCircle, HiOutlineX, HiOutlineChartBar,
} from 'react-icons/hi';
import { demandeService } from '../api/demandeService';
import { employeService } from '../api/employeService';
import { DemandeResponse, StatutDemande, StatutDemandeLabels, Employe, SoldeCongeInfo } from '../types';
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

// ─── Solde Card ──────────────────────────────────────────
const SoldeCongeCard: React.FC<{ soldeInfo: SoldeCongeInfo | null; demandes: DemandeResponse[] }> = ({ soldeInfo, demandes }) => {
  const stats = useMemo(() => {
    const totalDemandes = demandes.length;
    const approuveesCount = demandes.filter((d) => d.statut === 'APPROUVEE').length;
    const refuseesCount = demandes.filter((d) => d.statut === 'REFUSEE').length;
    const enAttenteCount = demandes.filter((d) => d.statut === 'EN_ATTENTE').length;
    return { totalDemandes, approuveesCount, refuseesCount, enAttenteCount };
  }, [demandes]);

  const soldeDisponible = soldeInfo?.soldeDisponible ?? 0;
  const soldePrevisionnel = soldeInfo?.soldePrevisionnel ?? 0;
  const joursAcquis = soldeInfo?.joursAcquis ?? 0;
  const droitAnnuel = soldeInfo?.droitAnnuel ?? 0;
  const joursConsommes = soldeInfo?.joursConsommes ?? 0;
  const joursEnAttente = soldeInfo?.joursEnAttente ?? 0;
  const ancienneteAnnees = soldeInfo?.ancienneteAnnees ?? 0;
  const tauxMensuel = soldeInfo?.tauxMensuel ?? 0;
  const joursReportes = soldeInfo?.joursReportes ?? 0;

  // Progress bar percentage (total = droitAnnuel + report)
  const totalDroit = droitAnnuel + joursReportes;
  const progressPct = totalDroit > 0 ? Math.min(100, (joursAcquis / totalDroit) * 100) : 0;
  const consumedPct = totalDroit > 0 ? Math.min(100, (joursConsommes / totalDroit) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Solde principal */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-dark">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white">Solde congé</h3>
            {soldeInfo?.dateEmbauche && (
              <p className="text-theme-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Ancienneté : {ancienneteAnnees > 0 ? `${ancienneteAnnees} an(s)` : `< 1 an`}
                {' · '}{tauxMensuel}j/mois
                {' · '}Droit annuel : {droitAnnuel}j
              </p>
            )}
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-brand-500">{soldeDisponible}j</p>
            <p className="text-theme-xs text-gray-500 dark:text-gray-400">disponible(s)</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="relative h-3 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
          <div
            className="absolute h-full rounded-full bg-brand-200 dark:bg-brand-900 transition-all"
            style={{ width: `${progressPct}%` }}
          />
          <div
            className="absolute h-full rounded-full bg-brand-500 transition-all"
            style={{ width: `${consumedPct}%` }}
          />
        </div>
        <div className="flex justify-between mt-1.5 text-theme-xs text-gray-500 dark:text-gray-400">
          <span>{joursConsommes}j consommés</span>
          <span>{joursAcquis}j acquis{joursReportes > 0 ? ` (dont ${joursReportes}j reportés)` : ''} / {droitAnnuel}j</span>
        </div>

        {joursReportes > 0 && (
          <p className="mt-1.5 text-theme-xs text-brand-500 font-medium">
            ↪ {joursReportes}j reporté(s) de l'année précédente (max 5j)
          </p>
        )}

        {joursEnAttente > 0 && (
          <p className="mt-2 text-theme-xs text-warning-500 font-medium">
            ⏳ {joursEnAttente}j en attente · Prévisionnel : {soldePrevisionnel}j
          </p>
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* En attente */}
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-dark">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-warning-50 dark:bg-warning-500/10 flex items-center justify-center">
              <HiOutlineClock className="text-warning-500" size={20} />
            </div>
            <div>
              <p className="text-title-sm font-bold text-gray-800 dark:text-white">{stats.enAttenteCount}</p>
              <p className="text-theme-xs text-gray-500 dark:text-gray-400">En attente</p>
            </div>
          </div>
        </div>

        {/* Approuvées */}
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-dark">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-success-50 dark:bg-success-500/10 flex items-center justify-center">
              <HiOutlineCheckCircle className="text-success-500" size={20} />
            </div>
            <div>
              <p className="text-title-sm font-bold text-gray-800 dark:text-white">{stats.approuveesCount}</p>
              <p className="text-theme-xs text-gray-500 dark:text-gray-400">Approuvées</p>
            </div>
          </div>
        </div>

        {/* Refusées */}
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-dark">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-error-50 dark:bg-error-500/10 flex items-center justify-center">
              <HiOutlineX className="text-error-500" size={20} />
            </div>
            <div>
              <p className="text-title-sm font-bold text-gray-800 dark:text-white">{stats.refuseesCount}</p>
              <p className="text-theme-xs text-gray-500 dark:text-gray-400">Refusées</p>
            </div>
          </div>
        </div>

        {/* Jours consommés */}
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-dark">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-secondary-100 dark:bg-secondary-500/10 flex items-center justify-center">
              <HiOutlineChartBar className="text-secondary-500" size={20} />
            </div>
            <div>
              <p className="text-title-sm font-bold text-gray-800 dark:text-white">{joursConsommes} j</p>
              <p className="text-theme-xs text-gray-500 dark:text-gray-400">Jours consommés</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Main Page ──────────────────────────────────────────
const MesDemandesPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [demandes, setDemandes] = useState<DemandeResponse[]>([]);
  const [employe, setEmploye] = useState<Employe | null>(null);
  const [soldeInfo, setSoldeInfo] = useState<SoldeCongeInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatut, setFilterStatut] = useState<string>('');
  const [selectedDemande, setSelectedDemande] = useState<DemandeResponse | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      try {
        const [demandesRes, employeRes, soldeRes] = await Promise.all([
          demandeService.getByEmploye(user.employeId),
          employeService.getById(user.employeId),
          employeService.getSoldeInfo(user.employeId),
        ]);
        setDemandes(demandesRes.data.data || []);
        setEmploye(employeRes.data.data || null);
        setSoldeInfo(soldeRes.data.data || null);
      } catch (err) {
        console.error('Erreur chargement:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user]);

  const filtered = useMemo(() => {
    return demandes
      .filter((d) => {
        if (filterStatut && d.statut !== filterStatut) return false;
        if (search) {
          const s = search.toLowerCase();
          return (
            d.type.toLowerCase().includes(s) ||
            d.typeCongeLabel?.toLowerCase().includes(s) ||
            d.statut.toLowerCase().includes(s) ||
            d.raison?.toLowerCase().includes(s)
          );
        }
        return true;
      })
      .sort((a, b) => new Date(b.dateCreation).getTime() - new Date(a.dateCreation).getTime());
  }, [demandes, search, filterStatut]);

  const formatDates = (d: DemandeResponse) => {
    if (d.dateDebut && d.dateFin) {
      if (d.dateDebut === d.dateFin) return new Date(d.dateDebut + 'T00:00:00').toLocaleDateString('fr-FR');
      return `${new Date(d.dateDebut + 'T00:00:00').toLocaleDateString('fr-FR')} → ${new Date(d.dateFin + 'T00:00:00').toLocaleDateString('fr-FR')}`;
    }
    if (d.date) return new Date(d.date + 'T00:00:00').toLocaleDateString('fr-FR');
    return '—';
  };

  /** Une fois validée par le chef (transmise au RH), la demande ne peut plus être modifiée ni annulée. */
  const canChange = (item: DemandeResponse) => item.statut === 'EN_ATTENTE' && item.decisionChef !== 'APPROUVEE';

  const handleCancel = async (id: number) => {
    setActionLoading(true);
    try {
      await demandeService.cancel(id);
      setDemandes((prev) => prev.map((d) => (d.id === id ? { ...d, statut: 'ANNULEE' as StatutDemande } : d)));
      setShowDetail(false);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Erreur lors de l\'annulation');
    } finally {
      setActionLoading(false);
    }
  };

  const columns = [
    {
      key: 'type',
      label: 'Type',
      render: (item: DemandeResponse) => (
        <div>
          <div className="flex items-center gap-1.5">
            <Badge text={item.type} variant={typeBadgeMap[item.type] || 'neutral'} />
            {item.justificatifPath && (
              <svg className="h-4 w-4 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
        <div>
          <Badge text={StatutDemandeLabels[item.statut] || item.statut} variant={statutBadgeMap[item.statut] || 'neutral'} />
          {item.statut === 'EN_ATTENTE' && item.decisionChef === 'EN_ATTENTE' && (
            <p className="text-theme-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {item.chefEnConge ? 'Votre chef est en congé · chez le RH' : 'Chez votre chef'}
            </p>
          )}
          {item.statut === 'EN_ATTENTE' && item.decisionChef === 'APPROUVEE' && (
            <p className="text-theme-xs text-success-600 dark:text-success-400 mt-0.5">Validée par votre chef · chez le RH</p>
          )}
          {item.statut === 'REFUSEE' && item.decisionChef === 'REFUSEE' && (
            <p className="text-theme-xs text-error-500 mt-0.5">Refusée par votre chef</p>
          )}
          {item.statut === 'REFUSEE' && item.motifRefus && (
            <p className="text-theme-xs text-error-500 mt-0.5 max-w-[180px] truncate" title={item.motifRefus}>
              Motif : {item.motifRefus}
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'dateCreation',
      label: 'Créée le',
      render: (item: DemandeResponse) => (
        <span className="text-theme-xs text-gray-500">
          {new Date(item.dateCreation).toLocaleDateString('fr-FR')}
        </span>
      ),
    },
    {
      key: 'actions',
      label: '',
      render: (item: DemandeResponse) => (
        <div className="flex items-center gap-1">
          <button
            onClick={() => { setSelectedDemande(item); setShowDetail(true); }}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500"
          >
            <HiOutlineEye size={16} />
          </button>
          {canChange(item) && (
            <>
              <button
                onClick={() => navigate(`/demandes/edit/${item.id}`)}
                className="p-1.5 rounded-lg hover:bg-brand-50 dark:hover:bg-brand-500/10 text-brand-500"
                title="Modifier"
              >
                <HiOutlinePencil size={16} />
              </button>
              <button
                onClick={() => handleCancel(item.id)}
                className="p-1.5 rounded-lg hover:bg-error-50 dark:hover:bg-error-500/10 text-error-500"
                title="Annuler"
              >
                <HiOutlineXCircle size={16} />
              </button>
            </>
          )}
        </div>
      ),
    },
  ];

  const inputClass =
    'h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 text-theme-sm text-gray-700 focus:border-brand-300 focus:outline-none focus:ring focus:ring-brand-500/10 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-300';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-title-sm font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-gray-900 to-[#683b77] dark:from-white dark:to-[#ab78c3]">Mes demandes de congés</h1>
          <p className="text-theme-sm text-gray-500 dark:text-gray-400 mt-1">
            Suivez l'état de vos demandes de congé, autorisation et télétravail
          </p>
        </div>
        <Button onClick={() => navigate('/demandes/new')}>
          <HiOutlinePlus size={16} className="mr-1.5" />
          Nouvelle demande
        </Button>
      </div>

      {/* Solde & stats */}
      <SoldeCongeCard soldeInfo={soldeInfo} demandes={demandes} />

      {/* Filters */}
      <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-dark">
        <div className="flex items-center gap-3 p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="relative flex-1 max-w-xs">
            <HiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Rechercher..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`${inputClass} pl-9`}
            />
          </div>
          <select
            value={filterStatut}
            onChange={(e) => setFilterStatut(e.target.value)}
            className={`${inputClass} max-w-[180px]`}
          >
            <option value="">Tous les statuts</option>
            {Object.entries(StatutDemandeLabels).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>

        {/* Table */}
        <DataTable
          data={filtered}
          columns={columns}
          emptyMessage={loading ? 'Chargement...' : 'Aucune demande trouvée'}
        />
      </div>

      {/* Detail Modal */}
      <Modal isOpen={showDetail} onClose={() => setShowDetail(false)} title="Détail de la demande">
        {selectedDemande && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Badge text={selectedDemande.type} variant={typeBadgeMap[selectedDemande.type] || 'neutral'} />
              <Badge text={StatutDemandeLabels[selectedDemande.statut] || selectedDemande.statut} variant={statutBadgeMap[selectedDemande.statut] || 'neutral'} />
              {selectedDemande.typeCongeLabel && (
                <p className="text-theme-xs text-gray-500">{selectedDemande.typeCongeLabel}</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              {selectedDemande.dateDebut && (
                <div>
                  <p className="text-theme-xs text-gray-500 dark:text-gray-400">Date début</p>
                  <p className="text-theme-sm font-medium text-gray-800 dark:text-white">
                    {new Date(selectedDemande.dateDebut + 'T00:00:00').toLocaleDateString('fr-FR')}
                  </p>
                </div>
              )}
              {selectedDemande.dateFin && selectedDemande.dateDebut !== selectedDemande.dateFin && (
                <div>
                  <p className="text-theme-xs text-gray-500 dark:text-gray-400">Date fin</p>
                  <p className="text-theme-sm font-medium text-gray-800 dark:text-white">
                    {new Date(selectedDemande.dateFin + 'T00:00:00').toLocaleDateString('fr-FR')}
                  </p>
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
                  <p className="text-theme-sm font-medium text-gray-800 dark:text-white">
                    {new Date(selectedDemande.date + 'T00:00:00').toLocaleDateString('fr-FR')}
                  </p>
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
              <div>
                <p className="text-theme-xs text-gray-500 dark:text-gray-400">Créée le</p>
                <p className="text-theme-sm font-medium text-gray-800 dark:text-white">
                  {new Date(selectedDemande.dateCreation).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              </div>
            </div>
            {selectedDemande.raison && (
              <div>
                <p className="text-theme-xs text-gray-500 dark:text-gray-400">Motif</p>
                <p className="text-theme-sm text-gray-700 dark:text-gray-300 mt-1">{selectedDemande.raison}</p>
              </div>
            )}
            {selectedDemande.statut === 'REFUSEE' && selectedDemande.motifRefus && (
              <div className="rounded-lg border border-error-200 bg-error-50 p-3 dark:border-error-500/30 dark:bg-error-500/10">
                <p className="text-theme-xs font-medium text-error-600 dark:text-error-400 mb-1">Motif de refus</p>
                <p className="text-theme-sm text-error-700 dark:text-error-300">{selectedDemande.motifRefus}</p>
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

            {/* Actions */}
            {selectedDemande.statut === 'EN_ATTENTE' && selectedDemande.decisionChef === 'APPROUVEE' && (
              <p className="text-theme-sm text-success-600 dark:text-success-400">
                Validée par votre chef ({selectedDemande.chefValidateurNom}) : elle attend la validation du RH et ne peut plus être modifiée.
              </p>
            )}
            {canChange(selectedDemande) && (
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <Button
                  variant="outline"
                  onClick={() => navigate(`/demandes/edit/${selectedDemande.id}`)}
                >
                  Modifier la demande
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleCancel(selectedDemande.id)}
                  disabled={actionLoading}
                >
                  {actionLoading ? 'Annulation...' : 'Annuler la demande'}
                </Button>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default MesDemandesPage;
