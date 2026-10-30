import api from './axios';
import { ApiResponse, CalculateDaysResult, DemandeRequest, DemandeResponse, HistoriqueStatut, StatutDemande } from '../types';

export interface InterimaireOption { id: number; nom: string; poste?: string | null }
export interface InterimEnCours { congeId: number; chefNom: string; departement: string; dateDebut: string; dateFin: string }

export const demandeService = {
  getAll: () => api.get<ApiResponse<DemandeResponse[]>>('/demandes'),
  getById: (id: number) => api.get<ApiResponse<DemandeResponse>>(`/demandes/${id}`),
  getByEmploye: (employeId: number) => api.get<ApiResponse<DemandeResponse[]>>(`/demandes/employe/${employeId}`),
  getByStatut: (statut: StatutDemande) => api.get<ApiResponse<DemandeResponse[]>>(`/demandes/statut/${statut}`),
  create: (data: DemandeRequest) => api.post<ApiResponse<DemandeResponse>>('/demandes', data),
  createWithFile: (data: DemandeRequest, justificatif?: File) => {
    const formData = new FormData();
    formData.append('demande', new Blob([JSON.stringify(data)], { type: 'application/json' }));
    if (justificatif) {
      formData.append('justificatif', justificatif);
    }
    return api.post<ApiResponse<DemandeResponse>>('/demandes/with-file', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  update: (id: number, data: DemandeRequest) => api.put<ApiResponse<DemandeResponse>>(`/demandes/${id}`, data),
  updateWithFile: (id: number, data: DemandeRequest, justificatif?: File) => {
    const formData = new FormData();
    formData.append('demande', new Blob([JSON.stringify(data)], { type: 'application/json' }));
    if (justificatif) {
      formData.append('justificatif', justificatif);
    }
    return api.put<ApiResponse<DemandeResponse>>(`/demandes/${id}/with-file`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  getFileUrl: (filename: string) => `/api/demandes/fichier/${filename}`,
  approve: (id: number, adminEmployeId: number) =>
    api.patch<ApiResponse<DemandeResponse>>(`/demandes/${id}/approve?adminEmployeId=${adminEmployeId}`),
  refuse: (id: number, adminEmployeId: number, commentaire?: string) =>
    api.patch<ApiResponse<DemandeResponse>>(
      `/demandes/${id}/refuse?adminEmployeId=${adminEmployeId}${commentaire ? `&commentaire=${encodeURIComponent(commentaire)}` : ''}`
    ),
  cancel: (id: number) => api.patch<ApiResponse<DemandeResponse>>(`/demandes/${id}/cancel`),
  batchApprove: (ids: number[], adminEmployeId: number) =>
    api.patch<ApiResponse<DemandeResponse[]>>(`/demandes/batch/approve?adminEmployeId=${adminEmployeId}`, ids),
  batchRefuse: (ids: number[], adminEmployeId: number, commentaire?: string) =>
    api.patch<ApiResponse<DemandeResponse[]>>(
      `/demandes/batch/refuse?adminEmployeId=${adminEmployeId}${commentaire ? `&commentaire=${encodeURIComponent(commentaire)}` : ''}`,
      ids
    ),
  /** Chef de département : employés qu'il peut désigner comme intérimaire pendant son congé. */
  getInterimaires: () => api.get<ApiResponse<InterimaireOption[]>>('/demandes/interimaires'),
  /** Intérims de chef de département confiés à l'utilisateur connecté. */
  getMonInterim: () => api.get<ApiResponse<InterimEnCours[]>>('/demandes/mon-interim'),
  /** Le chef de retour de congé reprend ses droits de validation. */
  signalerRetour: (id: number) => api.patch<ApiResponse<DemandeResponse>>(`/demandes/${id}/retour`),
  getHistorique: (id: number) => api.get<ApiResponse<HistoriqueStatut[]>>(`/demandes/${id}/historique`),
  calculateDays: (dateDebut: string, dateFin: string, typeConge?: string) =>
    api.get<ApiResponse<CalculateDaysResult>>(`/demandes/calculate-days`, {
      params: { dateDebut, dateFin, typeConge: typeConge || 'CONGE_PAYE' },
    }),
};
