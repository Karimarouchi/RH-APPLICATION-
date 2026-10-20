import axios from 'axios';
import { clearAuthSnapshot, getAccessToken } from '../utils/authStorage';

// Auto-detect API base:
//  1. Use VITE_API_URL env var if explicitly set
//  2. If running on localhost/127.0.0.1 → assume backend is on :8080
//  3. Otherwise → use relative path /api (Nginx will proxy to backend)
const envUrl = (import.meta.env.VITE_API_URL as string)?.trim();
export const API_BASE = envUrl
  ? envUrl
  : (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? `http://localhost:8080`
    : '';

const api = axios.create({
  baseURL: `${API_BASE}/api`,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

const isAuthRequest = (url?: string) =>
  !!url && /\/auth\/(login|client-login|forgot-password|reset-password)/.test(url);

api.interceptors.request.use(
  (config) => {
    const accessToken = getAccessToken();
    if (accessToken && !isAuthRequest(config.url)) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !isAuthRequest(error.config?.url)) {
      clearAuthSnapshot();
      if (window.location.pathname !== '/login') {
        window.location.assign('/login');
      }
    }
    return Promise.reject(error);
  }
);

export default api;
