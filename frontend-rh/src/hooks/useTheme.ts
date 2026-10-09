import { peekRelayPrefs } from '../utils/authStorage';
import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

type Theme = 'light' | 'dark';
export type AppFont = 'Inter' | 'Poppins';
export type AppFontSize = '13px' | '14px' | '15px' | '16px';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
  font: AppFont;
  setFont: (font: AppFont) => void;
  fontSize: AppFontSize;
  setFontSize: (size: AppFontSize) => void;
}

// Cookies partagés entre tous les ports du même domaine (contrairement à localStorage)
export const getSharedCookie = (name: string): string | null => {
  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const eqIdx = cookie.indexOf('=');
    if (eqIdx === -1) continue;
    const key = cookie.slice(0, eqIdx).trim();
    if (key === name) {
      return decodeURIComponent(cookie.slice(eqIdx + 1).trim());
    }
  }
  return null;
};

// Domaine parent (ex: .antigoneinterne.agency) pour partager le cookie entre rh.* et project.*
const getCookieDomain = (): string | null => {
  const host = window.location.hostname;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) return null;
  const parts = host.split('.');
  if (parts.length < 2) return null;
  return '.' + parts.slice(-2).join('.');
};

export const setSharedCookie = (name: string, value: string) => {
  const expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toUTCString();
  const base = `${name}=${encodeURIComponent(value)};expires=${expires};path=/;SameSite=Lax`;
  const domain = getCookieDomain();
  if (domain) {
    // Supprime l'ancien cookie limite a cet hote, qui masquerait la valeur partagee
    document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
    document.cookie = `${base};domain=${domain}`;
    if (getSharedCookie(name) === value) return;
  }
  document.cookie = base;
};

const VALID_FONTS: AppFont[] = ['Inter', 'Poppins'];
const VALID_SIZES: AppFontSize[] = ['13px', '14px', '15px', '16px'];

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>(() => {
    // Priorité : cookie (partagé entre ports) > localStorage > préférence système
    const stored = (peekRelayPrefs()?.theme || getSharedCookie('theme') || localStorage.getItem('theme')) as Theme | null;
    if (stored === 'dark' || stored === 'light') return stored;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  const [font, setFontState] = useState<AppFont>(() => {
    const stored = (peekRelayPrefs()?.font || getSharedCookie('app-font') || localStorage.getItem('app-font')) as AppFont | null;
    if (stored && VALID_FONTS.includes(stored as AppFont)) return stored as AppFont;
    return 'Inter';
  });

  const [fontSize, setFontSizeState] = useState<AppFontSize>(() => {
    const stored = (peekRelayPrefs()?.fontSize || getSharedCookie('app-font-size') || localStorage.getItem('app-font-size')) as AppFontSize | null;
    if (stored && VALID_SIZES.includes(stored as AppFontSize)) return stored as AppFontSize;
    return '14px';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
    setSharedCookie('theme', theme);
  }, [theme]);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--app-font', `"${font}", sans-serif`);
    localStorage.setItem('app-font', font);
    setSharedCookie('app-font', font);
  }, [font]);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--app-font-size', fontSize);
    root.style.fontSize = fontSize;
    localStorage.setItem('app-font-size', fontSize);
    setSharedCookie('app-font-size', fontSize);
  }, [fontSize]);

  // Re-sync depuis le cookie quand l'onglet redevient visible (ex: retour depuis l'autre app)
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      const newTheme = (getSharedCookie('theme') || localStorage.getItem('theme')) as Theme | null;
      if (newTheme === 'dark' || newTheme === 'light') {
        setThemeState(newTheme);
      }
      const newFont = (getSharedCookie('app-font') || localStorage.getItem('app-font')) as AppFont | null;
      if (newFont && VALID_FONTS.includes(newFont as AppFont)) {
        setFontState(newFont as AppFont);
      }
      const newSize = (getSharedCookie('app-font-size') || localStorage.getItem('app-font-size')) as AppFontSize | null;
      if (newSize && VALID_SIZES.includes(newSize as AppFontSize)) {
        setFontSizeState(newSize as AppFontSize);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => (prev === 'light' ? 'dark' : 'light'));
  }, []);

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
  }, []);

  const setFont = useCallback((newFont: AppFont) => {
    setFontState(newFont);
  }, []);

  const setFontSize = useCallback((newSize: AppFontSize) => {
    setFontSizeState(newSize);
  }, []);

  return React.createElement(ThemeContext.Provider, {
    value: { theme, toggleTheme, setTheme, font, setFont, fontSize, setFontSize },
    children,
  });
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
};
