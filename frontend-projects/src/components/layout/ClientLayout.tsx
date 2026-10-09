import React, { useState, useEffect, useRef } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../hooks/useTheme';
import { API_BASE } from '../../api/axios';
import OnboardingTour from '../onboarding/OnboardingTour';
import {
  HiOutlineLogout,
  HiOutlineMoon,
  HiOutlineSun,
  HiOutlinePhotograph,
  HiOutlineBriefcase,
  HiOutlineCollection,
  HiOutlineChevronDown,
  HiOutlineHome
} from 'react-icons/hi';

const ClientLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);

  const isClient = !!user?.isClient;
  const clientPages: string[] = user?.clientPages ?? [];
  const hasClientPage = (key: string) => !clientPages.length || clientPages.includes(key);

  const userInitials = `${user?.prenom?.[0] ?? ''}${user?.nom?.[0] ?? ''}`.toUpperCase() || 'CL';
  const clientNom = user?.nom || 'Mon Espace';

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (accountMenuRef.current && !accountMenuRef.current.contains(event.target as Node)) {
        setShowAccountMenu(false);
      }
    };
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShowAccountMenu(false);
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleEscapeKey);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (!isClient) {
    // If not a client, fallback to login (should be caught by Route guards anyway)
    return null;
  }

  return (
    <div className="min-h-screen bg-[#f8f9fa] dark:bg-gray-950 flex flex-col font-sans transition-colors duration-300">
      {/* ── Premium Top Header (Vitrine) ── */}
      <header className="sticky top-0 z-50 w-full bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200/50 dark:border-gray-800/50 shadow-sm transition-all duration-300">
        <div className="mx-auto max-w-(--breakpoint-2xl) px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            {/* Logo & Brand (Clickable to Home) */}
            <NavLink to="/client/accueil" data-tour="client-home" className="flex items-center gap-3 transition-transform hover:scale-105">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-lg shadow-brand-500/20">
                <span className="text-xl font-bold font-heading">A</span>
              </div>
              <span className="text-lg font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent dark:from-white dark:to-gray-400 font-heading">
                Antigone <span className="font-light opacity-60"></span> Client
              </span>
            </NavLink>

            {/* Right Controls (Theme & Profile) */}
            <div className="flex items-center gap-3">
              <button
                onClick={toggleTheme}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-50 text-gray-600 transition-colors hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                aria-label="Changer le thème"
              >
                {theme === 'dark' ? <HiOutlineSun size={20} /> : <HiOutlineMoon size={20} />}
              </button>

              <div className="relative" ref={accountMenuRef}>
                <button
                  data-tour="client-account"
                  onClick={() => setShowAccountMenu(!showAccountMenu)}
                  className="flex items-center gap-2 rounded-full border border-gray-200 bg-white p-1 pr-3 transition-all hover:border-brand-300 hover:shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:hover:border-brand-500"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700 dark:bg-brand-900/30 dark:text-brand-400 overflow-hidden">
                    {user?.imageUrl ? (
                      <img src={`${API_BASE}${user.imageUrl}`} alt="Logo" className="h-full w-full object-cover" />
                    ) : (
                      userInitials
                    )}
                  </div>
                  <span className="hidden text-sm font-semibold text-gray-700 sm:block dark:text-gray-200 max-w-[120px] truncate">
                    {clientNom}
                  </span>
                  <HiOutlineChevronDown size={14} className="text-gray-400" />
                </button>

                {/* Dropdown Profile */}
                {showAccountMenu && (
                  <div className="absolute right-0 mt-2 w-56 origin-top-right rounded-2xl border border-gray-200 bg-white py-2 shadow-xl ring-1 ring-black ring-opacity-5 focus:outline-none dark:border-gray-700 dark:bg-gray-800 animate-in fade-in zoom-in duration-200">
                    <div className="border-b border-gray-100 px-4 py-3 dark:border-gray-700">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{user?.prenom} {user?.nom}</p>
                      <p className="truncate text-xs text-gray-500 dark:text-gray-400">{user?.email}</p>
                    </div>
                    <div className="py-1">
                      <button
                        onClick={handleLogout}
                        className="flex w-full items-center gap-3 px-4 py-2 text-sm text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/10"
                      >
                        <HiOutlineLogout size={18} />
                        Déconnexion
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ── Main Content Area ── */}
      <main className="flex-1 w-full mx-auto max-w-(--breakpoint-2xl) p-4 sm:p-6 lg:p-8 animate-in fade-in duration-500">
        <Outlet />
      </main>
      <OnboardingTour />
    </div>
  );
};

export default ClientLayout;
