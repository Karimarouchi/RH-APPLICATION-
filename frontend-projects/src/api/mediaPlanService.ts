import api from './axios';
import { ApiResponse, MediaPlan, MediaPlanRequest } from '../types';

export const mediaPlanService = {
    getAll: () => api.get<ApiResponse<MediaPlan[]>>('/media-plans'),
    getById: (id: number) => api.get<ApiResponse<MediaPlan>>(`/media-plans/${id}`),
    getByClient: (clientId: number) => api.get<ApiResponse<MediaPlan[]>>(`/media-plans/client/${clientId}`),
    getByEmploye: (employeId: number) => api.get<ApiResponse<MediaPlan[]>>(`/media-plans/employe/${employeId}`),
    create: (data: MediaPlanRequest) => api.post<ApiResponse<MediaPlan>>('/media-plans', data),
    createBulk: (data: MediaPlanRequest[]) => api.post<ApiResponse<MediaPlan[]>>('/media-plans/bulk', data),
    update: (id: number, data: Partial<MediaPlanRequest>) => api.put<ApiResponse<MediaPlan>>(`/media-plans/${id}`, data),
    delete: (id: number) => api.delete<ApiResponse<void>>(`/media-plans/${id}`),
    approve: (id: number, managerId: number) => api.patch<ApiResponse<MediaPlan>>(`/media-plans/${id}/approve?managerId=${managerId}`),
    disapprove: (id: number) => api.patch<ApiResponse<MediaPlan>>(`/media-plans/${id}/disapprove`),
    /** validationClient=false: the manager validates alone and the line is approved directly. */
    accept: (id: number, champs: string[], validationClient = true) =>
        api.patch<ApiResponse<MediaPlan>>(`/media-plans/${id}/accept`, { champs, validationClient }),
    refuse: (id: number, rectifs: string) => api.patch<ApiResponse<MediaPlan>>(`/media-plans/${id}/refuse`, { rectifs }),
    renvoyerEmploye: (id: number) => api.patch<ApiResponse<MediaPlan>>(`/media-plans/${id}/renvoyer-employe`),
    shootingsADater: () => api.get<ApiResponse<MediaPlan[]>>('/media-plans/shootings/a-dater'),
    placeShootingDate: (id: number, date: string) => api.patch<ApiResponse<MediaPlan>>(`/media-plans/${id}/shooting-date`, { date }),
    confirmShootingDate: (id: number, accepte: boolean) => api.patch<ApiResponse<MediaPlan>>(`/media-plans/${id}/shooting-date-confirm`, { accepte }),
    resubmit: (id: number) => api.patch<ApiResponse<MediaPlan>>(`/media-plans/${id}/resubmit`),
    requestClientValidation: (id: number) => api.patch<ApiResponse<MediaPlan>>(`/media-plans/${id}/request-client-validation`),
    clientApprove: (id: number) => api.patch<ApiResponse<MediaPlan>>(`/media-plans/${id}/client-approve`),
    clientApproveAll: (ids: number[]) => api.post<ApiResponse<MediaPlan[]>>(`/media-plans/client-approve-all`, ids),
    clientDisapprove: (id: number, rectifs?: string) => api.patch<ApiResponse<MediaPlan>>(`/media-plans/${id}/client-disapprove`, { rectifs }),
    updateRectifs: (id: number, rectifs: string) => api.patch<ApiResponse<MediaPlan>>(`/media-plans/${id}/rectifs`, { rectifs }),
    getGoogleAuthUrl: () => api.get<ApiResponse<string>>('/media-plans/google-drive/auth-url'),
    getGoogleAuthStatus: () => api.get<ApiResponse<boolean>>('/media-plans/google-drive/status'),
};
