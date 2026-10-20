const fromEnv = (key: string): string =>
  (import.meta.env[key] as string | undefined)?.trim() || '';

/** This package is the Projets app: default to projects if VITE_APP_KIND is missing. */
export const APP_KIND: 'rh' | 'projects' =
  fromEnv('VITE_APP_KIND').toLowerCase() === 'rh' ? 'rh' : 'projects';

export const PROJECTS_APP_URL =
  fromEnv('VITE_PROJECTS_APP_URL') || (import.meta.env.DEV ? 'http://localhost:3000' : '');

export const RH_APP_URL =
  fromEnv('VITE_RH_APP_URL') || (import.meta.env.DEV ? 'http://localhost:3001' : '');
