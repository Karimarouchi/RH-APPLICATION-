import React, { useState, useEffect } from 'react';
import { HiOutlinePlus, HiOutlineSearch, HiOutlinePencil, HiOutlineEye, HiOutlineBan, HiOutlineCheck, HiOutlineTrash } from 'react-icons/hi';
import { compteService } from '../api/compteService';
import { roleService } from '../api/roleService';
import { employeService } from '../api/employeService';
import { CompteDTO, RoleDTO, PermissionDTO, Employe, AccessLogDTO } from '../types';
import CompteDroitsEditor from '../components/CompteDroitsEditor';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import DataTable from '../components/ui/DataTable';
import Badge from '../components/ui/Badge';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { useConfirm } from '../hooks/useConfirm';
import { useAuth } from '../context/AuthContext';

const ComptesPage: React.FC = () => {
  const { user } = useAuth();
  const { confirmState, confirm, handleConfirm, handleCancel } = useConfirm();
  const canDelete = (user?.permissions ?? []).includes('DELETE_COMPTE');
  const [comptes, setComptes] = useState<CompteDTO[]>([]);
  const [roles, setRoles] = useState<RoleDTO[]>([]);
  const [allPermissions, setAllPermissions] = useState<PermissionDTO[]>([]);
  const [employes, setEmployes] = useState<Employe[]>([]);
  const [search, setSearch] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showLogsModal, setShowLogsModal] = useState(false);
  const [showCredentialsModal, setShowCredentialsModal] = useState(false);
  const [credentials, setCredentials] = useState<{ username: string; password: string; email: string } | null>(null);
  const [editingCompte, setEditingCompte] = useState<CompteDTO | null>(null);
  const [accessLogs, setAccessLogs] = useState<AccessLogDTO[]>([]);
  const [loading, setLoading] = useState(true);

  const [createForm, setCreateForm] = useState({ employeId: 0, roleIds: [] as number[], ajoutees: [] as number[], retirees: [] as number[] });
  const [editForm, setEditForm] = useState({ roleIds: [] as number[], ajoutees: [] as number[], retirees: [] as number[] });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [comptesRes, rolesRes, employesRes, permsRes] = await Promise.all([
        compteService.getAll(),
        roleService.getAll(),
        employeService.getAll(),
        roleService.getAllPermissions(),
      ]);
      setComptes(comptesRes.data.data || []);
      setRoles(rolesRes.data.data || []);
      setAllPermissions(permsRes.data.data || []);
      setEmployes(employesRes.data.data || []);
    } catch (err) {
      console.error('Erreur chargement:', err);
    } finally {
      setLoading(false);
    }
  };

  // Employees without accounts
  const availableEmployes = employes.filter(
    (e) => !comptes.some((c) => c.employeId === e.id)
  );

  const handleCreate = async () => {
    if (!createForm.employeId || createForm.roleIds.length === 0) return;
    try {
      const res = await compteService.create({
        employeId: createForm.employeId,
        roleIds: createForm.roleIds,
        permissionIdsAjoutees: createForm.ajoutees,
        permissionIdsRetirees: createForm.retirees,
      });
      const newCompte = res.data.data;
      setShowCreateModal(false);
      setCreateForm({ employeId: 0, roleIds: [], ajoutees: [], retirees: [] });
      // Show credentials popup
      if (newCompte) {
        setCredentials({
          username: newCompte.username,
          password: newCompte.generatedPassword || '(envoyé par email)',
          email: newCompte.employeEmail,
        });
        setShowCredentialsModal(true);
      }
      loadData();
    } catch (err) {
      console.error('Erreur création:', err);
    }
  };

  const handleEdit = (compte: CompteDTO) => {
    setEditingCompte(compte);
    setEditForm({
      roleIds: compte.roles?.map(r => r.id) || [],
      ajoutees: compte.permissionsAjouteesIds || [],
      retirees: compte.permissionsRetireesIds || [],
    });
    setShowEditModal(true);
  };

  const handleUpdate = async () => {
    if (!editingCompte) return;
    try {
      await compteService.update(editingCompte.id, {
        employeId: editingCompte.employeId,
        roleIds: editForm.roleIds,
        permissionIdsAjoutees: editForm.ajoutees,
        permissionIdsRetirees: editForm.retirees,
      });
      setShowEditModal(false);
      setEditingCompte(null);
      loadData();
    } catch (err) {
      console.error('Erreur modification:', err);
    }
  };

  const handleToggle = async (id: number) => {
    try {
      await compteService.toggleEnabled(id);
      loadData();
    } catch (err) {
      console.error('Erreur toggle:', err);
    }
  };

  const handleDelete = (compte: CompteDTO) => {
    confirm(
      `Supprimer définitivement le compte « ${compte.username} » (${compte.employePrenom} ${compte.employeNom}) ? ` +
        "Ses identifiants et son historique de connexion seront effacés. L'employé est conservé. Cette action est irréversible.",
      async () => {
        try {
          await compteService.delete(compte.id);
          loadData();
        } catch (err: any) {
          alert(err?.response?.data?.message || 'Suppression impossible.');
        }
      },
      'Supprimer le compte',
    );
  };

  const handleViewLogs = async (compte: CompteDTO) => {
    try {
      const res = await compteService.getAccessLogs(compte.id);
      setAccessLogs(res.data.data || []);
      setEditingCompte(compte);
      setShowLogsModal(true);
    } catch (err) {
      console.error('Erreur logs:', err);
    }
  };

  const filteredComptes = comptes.filter(
    (c) =>
      c.username.toLowerCase().includes(search.toLowerCase()) ||
      c.employeNom.toLowerCase().includes(search.toLowerCase()) ||
      c.employePrenom.toLowerCase().includes(search.toLowerCase()) ||
      (c.employeEmail && c.employeEmail.toLowerCase().includes(search.toLowerCase()))
  );

  const columns = [
    {
      key: 'username',
      label: "Nom d'utilisateur",
      render: (item: CompteDTO) => (
        <span className="font-mono text-brand-600 dark:text-brand-400">{item.username}</span>
      ),
    },
    {
      key: 'employe',
      label: 'Employé',
      render: (item: CompteDTO) => (
        <div>
          <div className="font-medium text-gray-800 dark:text-white">{item.employePrenom} {item.employeNom}</div>
          <div className="text-theme-xs text-gray-500">{item.employeEmail}</div>
        </div>
      ),
    },
    {
      key: 'poste',
      label: 'Poste',
      render: (item: CompteDTO) => <span>{item.employePoste || '—'}</span>,
    },
    {
      key: 'role',
      label: 'Rôle',
      render: (item: CompteDTO) => (
        <div className="flex flex-wrap gap-1">
          {item.roles?.map((r) => (
            <Badge key={r.id} variant="light" color="primary">{r.nom}</Badge>
          ))}
        </div>
      ),
    },
    {
      key: 'enabled',
      label: 'Statut',
      render: (item: CompteDTO) => (
        <Badge variant="light" color={item.enabled ? 'success' : 'error'}>
          {item.enabled ? 'Actif' : 'Désactivé'}
        </Badge>
      ),
    },
    {
      key: 'lastLogin',
      label: 'Dernière connexion',
      render: (item: CompteDTO) => (
        <span className="text-theme-sm text-gray-500">
          {item.lastLogin ? new Date(item.lastLogin).toLocaleString('fr-FR') : 'Jamais'}
        </span>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (item: CompteDTO) => (
        <div className="flex gap-1">
          <button onClick={() => handleEdit(item)} className="p-1.5 rounded-lg hover:bg-brand-50 text-brand-500 transition-colors" title="Modifier le rôle">
            <HiOutlinePencil size={16} />
          </button>
          <button onClick={() => handleToggle(item.id)} className={`p-1.5 rounded-lg transition-colors ${item.enabled ? 'hover:bg-error-50 text-error-500' : 'hover:bg-success-50 text-success-500'}`} title={item.enabled ? 'Désactiver' : 'Activer'}>
            {item.enabled ? <HiOutlineBan size={16} /> : <HiOutlineCheck size={16} />}
          </button>
          <button onClick={() => handleViewLogs(item)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors dark:hover:bg-gray-700" title="Voir les logs">
            <HiOutlineEye size={16} />
          </button>
          {canDelete && (
            <button onClick={() => handleDelete(item)} className="p-1.5 rounded-lg hover:bg-error-50 text-error-500 transition-colors" title="Supprimer définitivement">
              <HiOutlineTrash size={16} />
            </button>
          )}
        </div>
      ),
    },
  ];

  const logColumns = [
    { key: 'dateAcces', label: 'Date', render: (item: AccessLogDTO) => new Date(item.dateAcces).toLocaleString('fr-FR') },
    { key: 'action', label: 'Action', render: (item: AccessLogDTO) => (
      <Badge variant="light" color={item.action === 'CONNEXION' ? 'success' : 'error'}>{item.action}</Badge>
    )},
    { key: 'adresseIp', label: 'Adresse IP' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-title-sm font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-gray-900 to-[#683b77] dark:from-white dark:to-[#ab78c3]">Gestion des Comptes</h1>
          <p className="text-theme-sm text-gray-500 dark:text-gray-400 mt-1">Créer et gérer les comptes utilisateurs</p>
        </div>
        <Button onClick={() => { setCreateForm({ employeId: 0, roleIds: [], ajoutees: [], retirees: [] }); setShowCreateModal(true); }}>
          <HiOutlinePlus size={18} /> Créer un compte
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <HiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un compte..."
          className="h-11 w-full rounded-lg border border-gray-300 bg-transparent pl-10 pr-4 text-theme-sm text-gray-700 focus:border-brand-300 focus:outline-none focus:ring focus:ring-brand-500/10 dark:border-gray-600 dark:text-gray-300"
        />
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">Chargement...</div>
      ) : (
        <DataTable columns={columns} data={filteredComptes} />
      )}

      {/* Create Modal */}
      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="Créer un compte" size="lg">
        <p className="text-theme-sm text-gray-500 dark:text-gray-400 mb-4">
          Le nom d'utilisateur et le mot de passe seront générés automatiquement et envoyés par email à l'employé.
        </p>
        <div className="space-y-4">
          <div>
            <label className="block text-theme-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Employé</label>
            <select
              value={createForm.employeId}
              onChange={(e) => setCreateForm({ ...createForm, employeId: Number(e.target.value) })}
              className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 text-theme-sm text-gray-700 focus:border-brand-300 focus:outline-none focus:ring focus:ring-brand-500/10 dark:border-gray-600 dark:text-gray-300 dark:bg-gray-800"
            >
              <option value={0}>Sélectionner un employé</option>
              {availableEmployes.map((e) => (
                <option key={e.id} value={e.id}>{e.prenom} {e.nom} — {e.poste || 'Pas de poste'}</option>
              ))}
            </select>
          </div>
          <CompteDroitsEditor
            roles={roles}
            allPermissions={allPermissions}
            roleIds={createForm.roleIds}
            onRoleIds={ids => setCreateForm(prev => ({ ...prev, roleIds: ids }))}
            ajoutees={createForm.ajoutees}
            onAjoutees={ids => setCreateForm(prev => ({ ...prev, ajoutees: ids }))}
            retirees={createForm.retirees}
            onRetirees={ids => setCreateForm(prev => ({ ...prev, retirees: ids }))}
          />
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="ghost" onClick={() => setShowCreateModal(false)}>Annuler</Button>
          <Button onClick={handleCreate} disabled={!createForm.employeId || createForm.roleIds.length === 0}>Créer le compte</Button>
        </div>
      </Modal>

      {/* Edit Modal */}
      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="Modifier le compte" size="lg">
        {editingCompte && (
          <>
            <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <p className="text-theme-sm text-gray-600 dark:text-gray-300">
                <span className="font-medium">Compte :</span> {editingCompte.username}
              </p>
              <p className="text-theme-sm text-gray-600 dark:text-gray-300">
                <span className="font-medium">Employé :</span> {editingCompte.employePrenom} {editingCompte.employeNom}
              </p>
            </div>
            <CompteDroitsEditor
              roles={roles}
              allPermissions={allPermissions}
              roleIds={editForm.roleIds}
              onRoleIds={ids => setEditForm(prev => ({ ...prev, roleIds: ids }))}
              ajoutees={editForm.ajoutees}
              onAjoutees={ids => setEditForm(prev => ({ ...prev, ajoutees: ids }))}
              retirees={editForm.retirees}
              onRetirees={ids => setEditForm(prev => ({ ...prev, retirees: ids }))}
            />
            <div className="flex justify-end gap-3 mt-6">
              <Button variant="ghost" onClick={() => setShowEditModal(false)}>Annuler</Button>
              <Button onClick={handleUpdate}>Modifier</Button>
            </div>
          </>
        )}
      </Modal>

      {/* Access Logs Modal */}
      <Modal isOpen={showLogsModal} onClose={() => setShowLogsModal(false)} title="Logs d'accès" size="lg">
        {editingCompte && (
          <>
            <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <p className="text-theme-sm text-gray-600 dark:text-gray-300">
                <span className="font-medium">Compte :</span> {editingCompte.username} — {editingCompte.employePrenom} {editingCompte.employeNom}
              </p>
            </div>
            {accessLogs.length === 0 ? (
              <p className="text-center py-8 text-gray-500 dark:text-gray-400">Aucun log d'accès pour ce compte</p>
            ) : (
              <DataTable columns={logColumns} data={accessLogs} />
            )}
          </>
        )}
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
        confirmLabel="Supprimer"
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </div>
  );
};

export default ComptesPage;
