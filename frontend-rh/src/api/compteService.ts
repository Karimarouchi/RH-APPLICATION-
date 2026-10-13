import api from './axios';
import { ApiResponse, CompteDTO, CompteRequest, AccessLogDTO, ChangePasswordRequest } from '../types';

export const compteService = {
  getAll: () => api.get<ApiResponse<CompteDTO[]>>('/comptes'),
  getById: (id: number) => api.get<ApiResponse<CompteDTO>>(`/comptes/${id}`),
  create: (data: CompteRequest) => api.post<ApiResponse<CompteDTO>>('/comptes', data),
  update: (id: number, data: CompteRequest) => api.put<ApiResponse<CompteDTO>>(`/comptes/${id}`, data),
  toggleEnabled: (id: number) => api.patch<ApiResponse<CompteDTO>>(`/comptes/${id}/toggle`),
  changePassword: (id: number, data: ChangePasswordRequest) => api.put<ApiResponse<void>>(`/comptes/${id}/password`, data),
  delete: (id: number) => api.delete<ApiResponse<void>>(`/comptes/${id}`),
  getAccessLogs: (id: number) => api.get<ApiResponse<AccessLogDTO[]>>(`/comptes/${id}/logs`),
};
