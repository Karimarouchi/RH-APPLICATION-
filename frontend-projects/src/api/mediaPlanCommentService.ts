import api from './axios';

const BASE_URL = '/mediaplan-comments';

export interface MediaPlanCommentDTO {
    id: number;
    mediaPlanId?: number;
    draftKey?: string;
    columnKey: string;
    content: string;
    auteurId: number;
    auteurNom: string;
    auteurPrenom: string;
    createdAt: string;
}

export interface MediaPlanCommentRequest {
    mediaPlanId?: number;
    draftKey?: string;
    columnKey: string;
    content: string;
    auteurId: number;
    clientId: number;
    monthKey: string;
}

export const mediaPlanCommentService = {
    async create(req: MediaPlanCommentRequest): Promise<MediaPlanCommentDTO> {
        const res = await api.post(BASE_URL, req);
        return res.data;
    },
    async getByMediaPlanIds(ids: number[]): Promise<MediaPlanCommentDTO[]> {
        if (ids.length === 0) return [];
        const res = await api.get(`${BASE_URL}/by-mediaplan-ids`, { params: { ids: ids.join(',') } });
        return res.data;
    },
    async getByClientIdAndMonthKey(clientId: number, monthKey: string): Promise<MediaPlanCommentDTO[]> {
        const res = await api.get(`${BASE_URL}/by-client-month`, { params: { clientId, monthKey } });
        return res.data;
    },
    async delete(id: number): Promise<void> {
        await api.delete(`${BASE_URL}/${id}`);
    },
};
