import React, { useState, useEffect } from 'react';
import { HiOutlinePlus, HiOutlinePencil, HiOutlineTrash, HiOutlineShieldCheck, HiOutlineCheck } from 'react-icons/hi';
import { roleService } from '../api/roleService';
import { RoleDTO, PermissionDTO } from '../types';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import DataTable from '../components/ui/DataTable';
import Badge from '../components/ui/Badge';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { useConfirm } from '../hooks/useConfirm';

const RolesPage: React.FC = () => {
  const { confirmState, confirm, handleConfirm, handleCancel } = useConfirm();
  const [roles, setRoles] = useState<RoleDTO[]>([]);
  const [allPermissions, setAllPermissions] = useState<PermissionDTO[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleDTO | null>(null);
  const [loading, setLoading] = useState(true);

  const [formNom, setFormNom] = useState('');
  const [selectedPermissionIds, setSelectedPermissionIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [rolesRes, permsRes] = await Promise.all([
        roleService.getAll(),
        roleService.getAllPermissions(),
      ]);
      setRoles(rolesRes.data.data || []);
      const filteredPermissions = (permsRes.data.data || []).filter((perm) => {
        const permissionCode = perm.permission?.toLowerCase?.() || '';
        const permissionLabel = perm.label?.toLowerCase?.() || '';
        return !permissionCode.includes('papier') && !permissionLabel.includes('papier');
      });
      setAllPermissions(filteredPermissions);
    } catch (err) {
      console.error('Erreur chargement:', err);
    } finally {
      setLoading(false);
    }
  };

  const PERMISSION_GROUPS: { label: string; color: string; codes: string[] }[] = [
    {
      label: 'RH Administration',
      color: '#683b77',
      codes: ['VIEW_DASHBOARD', 'VIEW_EMPLOYES', 'DELETE_EMPLOYE', 'VIEW_DEMANDES', 'VIEW_VALIDATIONS', 'VIEW_REFERENTIELS', 'VIEW_COMPTES', 'DELETE_COMPTE', 'VIEW_ROLES', 'VIEW_MONITORING'],
    },
    {
      label: 'Calendriers',
      color: '#0891b2',
      codes: ['VIEW_CALENDRIER', 'VIEW_RESTRICTION_CONGE', 'VIEW_CALENDRIER_PROJETS', 'VIEW_DEADLINES', 'VIEW_REUNIONS'],
    },
    {
      label: 'Projets',
      color: '#059669',
      codes: ['VIEW_PROJETS', 'MANAGE_ALL_PROJETS', 'VIEW_PROJETS_CREATE_TACHES', 'DELETE_PROJET', 'DELETE_TACHE'],
    },
    {
      label: 'Clients',
      color: '#d97706',
      codes: ['VIEW_CLIENTS', 'MANAGE_CLIENTS', 'DELETE_CLIENT'],
    },
    {
      label: 'Média Plan',
      color: '#dc2626',
      codes: ['VIEW_MEDIA_PLAN', 'VIEW_TOUS_MEDIA_PLAN'],
    },
    {
      label: 'Espace personnel (employé)',
      color: '#6366f1',
      codes: ['VIEW_DASHBOARD_RH', 'VIEW_MES_DEMANDES', 'VIEW_MES_PROJETS', 'VIEW_MON_CALENDRIER'],
    },
  ];

  const getPermByCode = (code: string) => allPermissions.find(p => p.permission === code);

  const openCreate = () => {
    setEditingRole(null);
    setFormNom('');
    setSelectedPermissionIds(new Set());
    setShowModal(true);
  };

  const openEdit = (role: RoleDTO) => {
    setEditingRole(role);
    setFormNom(role.nom);
    setSelectedPermissionIds(new Set(role.permissions.map((p) => p.id)));
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formNom.trim()) return;
    try {
      const request = {
        nom: formNom,
        permissionIds: Array.from(selectedPermissionIds),
      };

      if (editingRole) {
        await roleService.update(editingRole.id, request);
      } else {
        await roleService.create(request);
      }
      setShowModal(false);
      loadData();
    } catch (err) {
      console.error('Erreur sauvegarde:', err);
    }
  };

  const handleDelete = async (id: number) => {
    confirm('Êtes-vous sûr de vouloir supprimer ce rôle ?', async () => {
      try {
        await roleService.delete(id);
        loadData();
      } catch (err: unknown) {
        const error = err as { response?: { data?: { message?: string } } };
        alert(error.response?.data?.message || 'Erreur lors de la suppression');
      }
    }, 'Supprimer le rôle');
  };

  const togglePermission = (permId: number) => {
    setSelectedPermissionIds((prev) => {
      const next = new Set(prev);
      if (next.has(permId)) {
        next.delete(permId);
      } else {
        next.add(permId);
      }
      return next;
    });
  };

  const selectAll = () => {
    if (selectedPermissionIds.size === allPermissions.length) {
      setSelectedPermissionIds(new Set());
    } else {
      setSelectedPermissionIds(new Set(allPermissions.map((p) => p.id)));
    }
  };

  const columns = [
    {
      key: 'nom',
      label: 'Nom du rôle',
      render: (item: RoleDTO) => (
        <div className="flex items-center gap-2">
          <HiOutlineShieldCheck size={18} className="text-brand-500" />
          <span className="font-semibold text-gray-800 dark:text-white">{item.nom}</span>
        </div>
      ),
    },
    {
      key: 'permissions',
      label: 'Permissions',
      render: (item: RoleDTO) => (
        <div className="flex flex-wrap gap-1 max-w-md">
          {item.permissions?.length > 0 ? (
            item.permissions.map((p) => {
              const dashIdx = p.label?.indexOf('—') ?? -1;
              const shortName = dashIdx > -1 ? p.label.slice(0, dashIdx).trim() : (p.label || p.permission);
              return (
<span key={p.id} title={p.label}>
  <Badge variant="light" color="primary">{shortName}</Badge>
</span>              );
            })
          ) : (
            <span className="text-gray-400 text-theme-sm">Aucune permission</span>
          )}
        </div>
      ),
    },
    {
      key: 'nbPermissions',
      label: 'Nb permissions',
      render: (item: RoleDTO) => (
        <span className="text-theme-sm text-gray-600 dark:text-gray-300">
          {item.permissions?.length || 0} / {allPermissions.length}
        </span>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (item: RoleDTO) => (
        <div className="flex gap-2">
          <button onClick={() => openEdit(item)} className="p-1.5 rounded-lg hover:bg-brand-50 text-brand-500 transition-colors" title="Modifier">
            <HiOutlinePencil size={16} />
          </button>
          <button onClick={() => handleDelete(item.id)} className="p-1.5 rounded-lg hover:bg-error-50 text-error-500 transition-colors" title="Supprimer">
            <HiOutlineTrash size={16} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-title-sm font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-gray-900 to-[#683b77] dark:from-white dark:to-[#ab78c3]">Gestion des Rôles</h1>
          <p className="text-theme-sm text-gray-500 dark:text-gray-400 mt-1">Définir les rôles et leurs permissions d'accès aux vues</p>
        </div>
        <Button onClick={openCreate}>
          <HiOutlinePlus size={18} /> Nouveau rôle
        </Button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">Chargement...</div>
      ) : (
        <DataTable columns={columns} data={roles} />
      )}

      {/* Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingRole ? 'Modifier le rôle' : 'Nouveau rôle'}
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowModal(false)}>Annuler</Button>
            <Button onClick={handleSave} disabled={!formNom.trim()}>
              {editingRole ? 'Modifier' : 'Créer'}
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          {/* Role name */}
          <div>
            <label className="block text-theme-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nom du rôle</label>
            <input
              type="text"
              value={formNom}
              onChange={(e) => setFormNom(e.target.value)}
              placeholder="Ex: ADMIN, MANAGER, EMPLOYE..."
              className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 text-theme-sm text-gray-700 focus:border-brand-300 focus:outline-none focus:ring focus:ring-brand-500/10 dark:border-gray-600 dark:text-gray-300"
            />
          </div>

          {/* Permissions checkboxes */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-theme-sm font-medium text-gray-700 dark:text-gray-300">Permissions (vues accessibles)</label>
              <button
                type="button"
                onClick={selectAll}
                className="text-theme-xs text-brand-500 hover:text-brand-600 transition-colors"
              >
                {selectedPermissionIds.size === allPermissions.length ? 'Tout désélectionner' : 'Tout sélectionner'}
              </button>
            </div>
            <div className="space-y-4 max-h-[420px] overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700 p-3">
              {PERMISSION_GROUPS.map((group) => {
                const groupPerms = group.codes.map(getPermByCode).filter(Boolean) as typeof allPermissions;
                if (groupPerms.length === 0) return null;
                const allSelected = groupPerms.every(p => selectedPermissionIds.has(p.id));
                const someSelected = groupPerms.some(p => selectedPermissionIds.has(p.id));
                return (
                  <div key={group.label}>
                    {/* Group header */}
                    <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-gray-100 dark:border-gray-700">
                      <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: group.color }}>
                        {group.label}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedPermissionIds(prev => {
                            const next = new Set(prev);
                            if (allSelected) {
                              groupPerms.forEach(p => next.delete(p.id));
                            } else {
                              groupPerms.forEach(p => next.add(p.id));
                            }
                            return next;
                          });
                        }}
                        className="text-[10px] font-medium transition-colors hover:opacity-75"
                        style={{ color: group.color }}
                      >
                        {allSelected ? 'Tout retirer' : someSelected ? 'Tout ajouter' : 'Sélectionner tout'}
                      </button>
                    </div>
                    {/* Permissions in group */}
                    <div className="space-y-1">
                      {groupPerms.map((perm) => {
                        const isChecked = selectedPermissionIds.has(perm.id);
                        // Split label at "—" to show code name + description
                        const dashIdx = perm.label.indexOf('—');
                        const shortName = dashIdx > -1 ? perm.label.slice(0, dashIdx).trim() : perm.label;
                        const description = dashIdx > -1 ? perm.label.slice(dashIdx + 1).trim() : '';
                        return (
                          <div
                            key={perm.id}
                            onClick={() => togglePermission(perm.id)}
                            className={`flex items-start gap-3 p-2.5 rounded-lg cursor-pointer transition-all border ${
                              isChecked
                                ? 'border-transparent bg-opacity-10'
                                : 'border-transparent hover:bg-gray-50 dark:hover:bg-gray-800'
                            }`}
                            style={isChecked ? { backgroundColor: `${group.color}12`, borderColor: `${group.color}30` } : {}}
                          >
                            {/* Custom checkbox */}
                            <div
                              className="mt-0.5 shrink-0 w-[18px] h-[18px] rounded flex items-center justify-center border-2 transition-all"
                              style={isChecked
                                ? { backgroundColor: group.color, borderColor: group.color }
                                : { borderColor: '#d1d5db' }}
                            >
                              {isChecked && <HiOutlineCheck size={11} className="text-white" />}
                            </div>
                            <div className="min-w-0">
                              <div className="text-theme-sm font-semibold text-gray-800 dark:text-white leading-tight">
                                {shortName}
                              </div>
                              {description && (
                                <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 leading-snug">
                                  {description}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              {/* Permissions not in any group */}
              {(() => {
                const allGroupedCodes = PERMISSION_GROUPS.flatMap(g => g.codes);
                const ungrouped = allPermissions.filter(p => !allGroupedCodes.includes(p.permission));
                if (ungrouped.length === 0) return null;
                return (
                  <div>
                    <div className="mb-2 pb-1.5 border-b border-gray-100 dark:border-gray-700">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Autres</span>
                    </div>
                    <div className="space-y-1">
                      {ungrouped.map(perm => (
                        <div key={perm.id} onClick={() => togglePermission(perm.id)} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer">
                          <div className={`shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${selectedPermissionIds.has(perm.id) ? 'bg-brand-500 border-brand-500' : 'border-gray-300'}`}>
                            {selectedPermissionIds.has(perm.id) && <HiOutlineCheck size={10} className="text-white" />}
                          </div>
                          <span className="text-theme-sm text-gray-700 dark:text-gray-300">{perm.label}</span>
                          <span className="text-theme-xs text-gray-400">({perm.permission})</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
            <p className="text-theme-xs text-gray-400 mt-1">
              {selectedPermissionIds.size} permission(s) sélectionnée(s) sur {allPermissions.length}
            </p>
          </div>
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

export default RolesPage;
