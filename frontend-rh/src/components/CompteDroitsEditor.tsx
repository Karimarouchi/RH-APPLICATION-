import React from 'react';
import { PermissionDTO, RoleDTO } from '../types';

interface Props {
  roles: RoleDTO[];
  allPermissions: PermissionDTO[];
  roleIds: number[];
  onRoleIds: (ids: number[]) => void;
  ajoutees: number[];
  onAjoutees: (ids: number[]) => void;
  retirees: number[];
  onRetirees: (ids: number[]) => void;
}

/** Rôle commun, puis permissions ajoutées ou retirées pour ce compte seulement. */
const CompteDroitsEditor: React.FC<Props> = ({
  roles, allPermissions, roleIds, onRoleIds, ajoutees, onAjoutees, retirees, onRetirees,
}) => {
  const base = new Set(
    roles.filter(r => roleIds.includes(r.id)).flatMap(r => (r.permissions || []).map(p => p.id))
  );
  const checked = (id: number) => (base.has(id) && !retirees.includes(id)) || ajoutees.includes(id);

  const toggleRole = (id: number, on: boolean) => {
    const nextRoles = on ? [...roleIds, id] : roleIds.filter(x => x !== id);
    const nextBase = new Set(
      roles.filter(r => nextRoles.includes(r.id)).flatMap(r => (r.permissions || []).map(p => p.id))
    );
    onRoleIds(nextRoles);
    onAjoutees(ajoutees.filter(idPerm => !nextBase.has(idPerm)));
    onRetirees(retirees.filter(idPerm => nextBase.has(idPerm)));
  };

  const togglePermission = (id: number) => {
    if (base.has(id)) {
      onAjoutees(ajoutees.filter(x => x !== id));
      onRetirees(retirees.includes(id) ? retirees.filter(x => x !== id) : [...retirees, id]);
    } else {
      onRetirees(retirees.filter(x => x !== id));
      onAjoutees(ajoutees.includes(id) ? ajoutees.filter(x => x !== id) : [...ajoutees, id]);
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-theme-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Rôles</label>
        <div className="space-y-2 max-h-40 overflow-y-auto p-2 border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-800">
          {roles.map(r => (
            <label key={r.id} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={roleIds.includes(r.id)}
                onChange={e => toggleRole(r.id, e.target.checked)}
                className="h-4 w-4 rounded text-brand-500 focus:ring-brand-500 border-gray-300"
              />
              <span className="text-theme-sm text-gray-700 dark:text-gray-300">{r.nom}</span>
            </label>
          ))}
        </div>
        <p className="text-theme-xs text-gray-400 mt-1">Le rôle MANAGER est le socle commun. Les cases ci-dessous ne changent que ce compte.</p>
      </div>
      <div>
        <label className="block text-theme-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Permissions de ce compte</label>
        <div className="space-y-1 max-h-56 overflow-y-auto p-2 border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-800">
          {allPermissions.map(p => (
            <label key={p.id} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={checked(p.id)}
                onChange={() => togglePermission(p.id)}
                className="h-4 w-4 rounded text-brand-500 focus:ring-brand-500 border-gray-300"
              />
              <span className="text-theme-xs text-gray-700 dark:text-gray-300">{p.label || p.permission}</span>
              {ajoutees.includes(p.id) && <span className="text-[10px] text-green-600">ajoutée</span>}
              {retirees.includes(p.id) && <span className="text-[10px] text-red-600">retirée</span>}
            </label>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CompteDroitsEditor;
