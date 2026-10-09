import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { LoginResponse } from '../types';
import { clearAuthSnapshot, getAuthSnapshot, saveAuthSnapshot, updateAuthUser } from '../utils/authStorage';

interface AuthContextType {
  user: LoginResponse | null;
  login: (userData: LoginResponse) => void;
  updateUser: (patch: Partial<LoginResponse>) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<LoginResponse | null>(() => getAuthSnapshot()?.user ?? null);

  const logout = useCallback(() => {
    setUser(null);
    clearAuthSnapshot();
  }, []);

  // Re-sync auth state periodically (token/session expiry or cross-app updates).
  useEffect(() => {
    const interval = setInterval(() => {
      const snapshot = getAuthSnapshot();
      setUser((current) => {
        if (!snapshot) return current ? null : current;
        if (!current) return snapshot.user;
        if (
          current.compteId === snapshot.user.compteId &&
          current.mustChangePassword === snapshot.user.mustChangePassword
        ) {
          return current;
        }
        return snapshot.user;
      });
    }, 60_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key && event.key !== 'user' && event.key !== 'loginTime') {
        return;
      }
      const snapshot = getAuthSnapshot();
      setUser(snapshot?.user ?? null);
    };

    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const login = useCallback((userData: LoginResponse) => {
    setUser(userData);
    saveAuthSnapshot(userData);
  }, []);

  const updateUser = useCallback((patch: Partial<LoginResponse>) => {
    setUser((current) => {
      if (!current) return current;
      const next = { ...current, ...patch };
      updateAuthUser(next);
      return next;
    });
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, updateUser, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
