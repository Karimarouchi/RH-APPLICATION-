import { clientService } from '../api/clientService';
import { mediaPlanAssignmentService } from '../api/mediaPlanAssignmentService';
import { projetService } from '../api/projetService';

export type MediaPlanClient = { id: number; nom: string };

/**
 * Clients whose media plan the user may open: every client for those who see all media plans
 * (VIEW_TOUS_MEDIA_PLAN), otherwise the clients they are assigned to plus the clients of their projects.
 */
export async function loadMediaPlanClients(employeId: number, permissions: string[]): Promise<MediaPlanClient[]> {
  const byId = new Map<number, string>();

  if (permissions.includes('VIEW_TOUS_MEDIA_PLAN')) {
    try {
      const response = await clientService.getAllClients();
      (response.data.data || []).forEach((client) => byId.set(client.id, client.nom));
      if (byId.size > 0) return sortClients(byId);
    } catch {
      // no right to list every client: fall back to assignments and projects
    }
  }

  const [assignments, projets] = await Promise.all([
    mediaPlanAssignmentService.getByEmploye(employeId).then((r) => r.data.data || []).catch(() => []),
    projetService.getByEmploye(employeId).then((r) => r.data.data || []).catch(() => []),
  ]);
  assignments.forEach((a: any) => { if (a.clientId) byId.set(a.clientId, a.clientNom || `Client #${a.clientId}`); });
  projets.forEach((p: any) => { if (p.clientId && !byId.has(p.clientId)) byId.set(p.clientId, p.clientNom || `Client #${p.clientId}`); });
  return sortClients(byId);
}

const sortClients = (byId: Map<number, string>): MediaPlanClient[] =>
  Array.from(byId, ([id, nom]) => ({ id, nom })).sort((a, b) => a.nom.localeCompare(b.nom));
