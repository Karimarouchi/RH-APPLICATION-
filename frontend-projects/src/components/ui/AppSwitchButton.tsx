import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HiChevronLeft, HiChevronRight } from 'react-icons/hi';
import { useAuth } from '../../context/AuthContext';
import { relayAuthSnapshotForSwitch } from '../../utils/authStorage';

const resolveAppKind = (): 'projects' | 'rh' => {
  const appKind = (import.meta.env.VITE_APP_KIND as string | undefined)?.trim().toLowerCase();
  return appKind === 'rh' ? 'rh' : 'projects';
};

type AppKind = 'projects' | 'rh';

const AppSwitchButton: React.FC = () => {
  const navigate = useNavigate();
  const [hoveredOption, setHoveredOption] = useState<AppKind | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const { isAuthenticated, user } = useAuth();

  if (!isAuthenticated) return null;
  if (user?.isClient) return null;

  const appKind = resolveAppKind();
  const targetLabel = appKind === 'projects' ? 'RH' : 'Projets';

  const switchTo = (targetApp: AppKind) => {
    if (targetApp === appKind) return;

    const targetUrl = targetApp === 'rh'
      ? (import.meta.env.VITE_RH_APP_URL as string | undefined)?.trim()
      : (import.meta.env.VITE_PROJECTS_APP_URL as string | undefined)?.trim();

    const fallbackPath = targetApp === 'rh' ? '/dashboard-rh' : '/dashboard';

    if (targetUrl) {
      relayAuthSnapshotForSwitch();
      window.location.href = targetUrl;
      return;
    }

    navigate(fallbackPath);
  };

  if (collapsed) {
    return (
      <div data-tour="app-switch" className="fixed right-0 bottom-6 z-[10000]">
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          title="Afficher le sélecteur d'application"
          className="flex items-center justify-center w-8 h-10 rounded-l-full bg-white/90 dark:bg-gray-800/90 border border-r-0 border-gray-200/90 dark:border-gray-700/90 shadow-2xl shadow-black/10 dark:shadow-black/30 backdrop-blur-xl text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
        >
          <HiChevronLeft size={16} />
        </button>
      </div>
    );
  }

  return (
    <div data-tour="app-switch" className="fixed right-6 bottom-6 z-[10000] flex items-center gap-1.5 p-1.5 rounded-full bg-white/90 dark:bg-gray-800/90 border border-gray-200/90 dark:border-gray-700/90 shadow-2xl shadow-black/10 dark:shadow-black/30 backdrop-blur-xl transition-all">
      <button
        type="button"
        onClick={() => switchTo('projects')}
        onMouseEnter={() => setHoveredOption('projects')}
        onMouseLeave={() => setHoveredOption(null)}
        disabled={appKind === 'projects'}
        title="Aller vers Projets"
        className={`min-w-[112px] h-11 rounded-full px-4 inline-flex items-center justify-center gap-2 text-[13px] font-bold tracking-wide transition-all duration-200 whitespace-nowrap ${
          appKind === 'projects'
            ? 'bg-gradient-to-r from-brand-600 to-brand-500 dark:from-brand-500 dark:to-brand-400 text-white shadow-lg shadow-brand-500/30 -translate-y-[1px] cursor-default'
            : 'bg-transparent text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white cursor-pointer'
        }`}
      >
        <span>Projets</span>
      </button>


      <button
        type="button"
        onClick={() => switchTo('rh')}
        onMouseEnter={() => setHoveredOption('rh')}
        onMouseLeave={() => setHoveredOption(null)}
        disabled={appKind === 'rh'}
        title="Aller vers RH"
        className={`min-w-[112px] h-11 rounded-full px-4 inline-flex items-center justify-center gap-2 text-[13px] font-bold tracking-wide transition-all duration-200 whitespace-nowrap ${
          appKind === 'rh'
            ? 'bg-gradient-to-r from-brand-600 to-brand-500 dark:from-brand-500 dark:to-brand-400 text-white shadow-lg shadow-brand-500/30 -translate-y-[1px] cursor-default'
            : 'bg-transparent text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white cursor-pointer'
        }`}
      >
        <span>RH</span>
      </button>


      {/* Bouton réduire */}
      <button
        type="button"
        onClick={() => setCollapsed(true)}
        title="Réduire"
        className="w-8 h-8 rounded-full inline-flex items-center justify-center text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
      >
        <HiChevronRight size={16} />
      </button>

      {/* Tooltip */}
      <div
        className={`absolute right-0 bottom-[62px] translate-y-1 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-[11px] font-semibold px-3 py-1.5 rounded-lg whitespace-nowrap pointer-events-none transition-all duration-150 shadow-lg ${hoveredOption ? 'opacity-100' : 'opacity-0'}`}
      >
        {`Aller vers ${targetLabel}`}
      </div>
    </div>
  );
};

export default AppSwitchButton;
