import api from './axios';
import { ApiResponse, Employe, EmployeHoraire, EmployeStatsDTO, OrgNode, SoldeCongeInfo } from '../types';

export const employeService = {
  getAll: () => api.get<ApiResponse<Employe[]>>('/employes'),
  getById: (id: number) => api.get<ApiResponse<Employe>>(`/employes/${id}`),
  getByMatricule: (matricule: string) => api.get<ApiResponse<Employe>>(`/employes/matricule/${matricule}`),
  getSubordinates: (id: number) => api.get<ApiResponse<Employe[]>>(`/employes/${id}/subordinates`),
  getByRole: (roleName: string) => api.get<ApiResponse<Employe[]>>(`/employes/by-role/${roleName}`),
  create: (data: Partial<Employe>) => api.post<ApiResponse<Employe>>('/employes', data),
  update: (id: number, data: Partial<Employe>) => api.put<ApiResponse<Employe>>(`/employes/${id}`, data),
  delete: (id: number) => api.delete<ApiResponse<void>>(`/employes/${id}`),
  archive: (id: number) => api.put<ApiResponse<void>>(`/employes/${id}/archive`),
  unarchive: (id: number) => api.put<ApiResponse<void>>(`/employes/${id}/unarchive`),
  getArchived: () => api.get<ApiResponse<Employe[]>>('/employes/archived'),
  updateSoldeConge: (id: number, solde: number) => api.patch<ApiResponse<void>>(`/employes/${id}/solde-conge?solde=${solde}`),
  updateLienDrive: (id: number, lienDrive: string | null) => api.patch<ApiResponse<Employe>>(`/employes/${id}/lien-drive`, { lienDrive }),
  uploadImage: (id: number, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post<ApiResponse<Employe>>(`/employes/${id}/image`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  getSoldeInfo: (id: number) => api.get<ApiResponse<SoldeCongeInfo>>(`/employes/${id}/solde-info`),
  getHoraireEntreprise: () => api.get<ApiResponse<EmployeHoraire>>('/employes/horaire-entreprise'),

  // Métiers avancés
  getStats: () => api.get<ApiResponse<EmployeStatsDTO>>('/employes/stats'),
  advancedSearch: (params: Record<string, string | number | undefined>) => {
    const query = Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== '' && v !== null)
      .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
      .join('&');
    return api.get<ApiResponse<Employe[]>>(`/employes/search?${query}`);
  },
  exportCsv: () => api.get('/employes/export/csv', { responseType: 'blob' }),
  getOrganigramme: () => api.get<ApiResponse<OrgNode[]>>('/employes/organigramme'),
  getOnLeaveToday: () => api.get<ApiResponse<number[]>>('/employes/on-leave-today'),
};
