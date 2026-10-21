import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  HiChevronLeft,
  HiChevronRight,
  HiOutlineBell,
  HiOutlineCalendar,
  HiOutlineChartBar,
  HiOutlineChevronDown,
  HiOutlineClipboardCheck,
  HiOutlineClipboardList,
  HiOutlineCheckCircle,
  HiOutlineCollection,
  HiOutlineDesktopComputer,
  HiOutlineDocumentReport,
  HiOutlineDownload,
  HiOutlineHome,
  HiOutlineInformationCircle,
  HiOutlineKey,
  HiOutlineLogout,
  HiOutlineMoon,
  HiOutlinePencilAlt,
  HiOutlinePhotograph,
  HiOutlineShieldCheck,
  HiOutlineStar,
  HiOutlineSun,
  HiOutlineTrash,
  HiOutlineUser,
  HiOutlineUserAdd,
  HiOutlineUserGroup,
  HiOutlineUsers,
  HiOutlineXCircle,
  HiOutlineExclamation,
  HiX,
} from 'react-icons/hi';
import { API_BASE } from '../../api/axios';
import { notificationService } from '../../api/notificationService';
import { demandeService } from '../../api/demandeService';
import { agentDashboardService } from '../../api/agentDashboardService';
import { useSidebar } from '../../hooks/useSidebar';
import { useAuth } from '../../context/AuthContext';
import { useTheme, AppFont, AppFontSize, setSharedCookie } from '../../hooks/useTheme';
import { NotificationResponse } from '../../types';
import { getRhNotificationPath, shouldDisplayNotification } from '../../utils/notificationRules';
import './SidebarCanva.css';

interface NavItemDef {
  key: string;
  label: string;
  path: string;
  icon: React.ReactNode;
  permission?: string;
  permissions?: string[];
  badge?: number;
  children?: { label: string; path: string }[];
}

interface RailItemDef {
  key: string;
  label: string;
  icon: React.ReactNode;
  path: string;
  permission?: string;
  permissions?: string[];
  badge?: string;
  matchPrefixes?: string[];
  action?: 'navigate' | 'panel';
  panelMode?: 'mon-espace' | 'gestion-rh' | 'administration' | 'monitoring';
}

const panelGroupsTemplate: Array<{ title: string; items: NavItemDef[]; modes: Array<'mon-espace' | 'gestion-rh' | 'administration' | 'monitoring'> }> = [
  {
    title: 'MON ESPACE',
    modes: ['mon-espace'],
    items: [
      {
        key: 'mon-calendrier',
        label: 'Mon calendrier',
        path: '/mon-calendrier',
        icon: <HiOutlineCalendar size={18} />,
        permission: 'VIEW_MON_CALENDRIER',
      },
      {
        key: 'mes-demandes',
        label: 'Mes demandes',
        path: '/mes-demandes',
        icon: <HiOutlineClipboardList size={18} />,
        permission: 'VIEW_MES_DEMANDES',
        children: [
          { label: 'Demandes conges', path: '/mes-demandes' },
          { label: 'Demandes papiers', path: '/mes-demandes-papier' },
        ],
      },
    ],
  },
  {
    title: 'GESTION RH',
    modes: ['gestion-rh'],
    items: [
      {
        key: 'employes',
        label: 'Employes',
        path: '/employes',
        icon: <HiOutlineUsers size={18} />,
        permission: 'VIEW_EMPLOYES',
        children: [
          { label: 'Liste des employes', path: '/employes' },
          { label: 'Organigramme', path: '/organigramme' },
	  { label: 'Archives', path: '/employes/archives' },
        ],
      },
      {
        key: 'validations',
        label: 'Validation demandes',
        path: '/validations',
        icon: <HiOutlineClipboardCheck size={18} />,
        permission: 'VIEW_VALIDATIONS',
        children: [
          { label: 'Demandes conges', path: '/demandes' },
          { label: 'Demandes papiers', path: '/demandes/liste-papier' },
        ],
      },
      { key: 'dashboard-rh', label: 'Dashboard RH', path: '/dashboard-rh', icon: <HiOutlineChartBar size={18} />, permission: 'VIEW_DASHBOARD' },
      { key: 'departements', label: 'Departements', path: '/admin/departements', icon: <HiOutlineUserGroup size={18} />, permission: 'VIEW_EMPLOYES' },
    ],
  },
  {
    title: 'ADMINISTRATION',
    modes: ['administration'],
    items: [
      { key: 'comptes', label: 'Comptes', path: '/comptes', icon: <HiOutlineKey size={18} />, permission: 'VIEW_COMPTES' },
      { key: 'roles', label: 'Roles', path: '/roles', icon: <HiOutlineShieldCheck size={18} />, permission: 'VIEW_ROLES' },
      { key: 'referentiels', label: 'Referentiels', path: '/referentiels', icon: <HiOutlineCollection size={18} />, permission: 'VIEW_REFERENTIELS' },
      { key: 'calendrier', label: 'Calendrier entreprise', path: '/calendrier', icon: <HiOutlineCalendar size={18} />, permission: 'VIEW_CALENDRIER' },
      { key: 'restrictions-conges', label: 'Restrictions de congés', path: '/restrictions-conges', icon: <HiOutlineExclamation size={18} />, permission: 'VIEW_RESTRICTION_CONGE' },

    ],
  },
  {
    title: 'MONITORING',
    modes: ['monitoring'],
    items: [
      { key: 'suivi-temps-reel', label: 'Suivi temps reel', path: '/suivi-temps-reel', icon: <HiOutlineDesktopComputer size={18} />, permission: 'VIEW_MONITORING' },
      { key: 'rapports-inactivite', label: 'Rapports', path: '/rapports-inactivite', icon: <HiOutlineDocumentReport size={18} />, permission: 'VIEW_MONITORING' },
      { key: 'historique-agent', label: 'Historique agent', path: '/historique-agent', icon: <HiOutlineClipboardList size={18} />, permission: 'VIEW_MONITORING' },
    ],
  },
];

const railMainItems: RailItemDef[] = [
  {
    key: 'accueil',
    label: 'Accueil',
    icon: <HiOutlineHome size={20} />,
    path: '/dashboard',
    matchPrefixes: ['/dashboard'],
    action: 'navigate',
  },
  {
    key: 'mon-espace',
    label: 'Mon Espace',
    icon: <HiOutlineUser size={20} />,
    path: '/mon-calendrier',
    permissions: ['VIEW_MON_CALENDRIER', 'VIEW_MES_DEMANDES'],
    matchPrefixes: ['/mon-calendrier', '/mes-demandes', '/mes-demandes-papier'],
    action: 'panel',
    panelMode: 'mon-espace',
  },
  {
    key: 'gestion-rh',
    label: 'Gestion RH',
    icon: <HiOutlineUsers size={20} />,
    path: '/employes',
    permissions: ['VIEW_EMPLOYES', 'VIEW_VALIDATIONS', 'VIEW_DASHBOARD'],
    matchPrefixes: ['/employes', '/organigramme', '/validations', '/demandes', '/dashboard-rh', '/admin/departements'],
    action: 'panel',
    panelMode: 'gestion-rh',
  },
];

const railSecondaryItems: RailItemDef[] = [
  {
    key: 'administration',
    label: 'Administration',
    icon: <HiOutlineShieldCheck size={20} />,
    path: '/comptes',
    permissions: ['VIEW_COMPTES', 'VIEW_ROLES', 'VIEW_REFERENTIELS', 'VIEW_CALENDRIER', 'VIEW_RESTRICTION_CONGE'],
    matchPrefixes: ['/comptes', '/roles', '/referentiels', '/calendrier', '/rectifs', '/restrictions-conges'],
    action: 'panel',
    panelMode: 'administration',
  },
  {
    key: 'monitoring',
    label: 'Monitoring',
    icon: <HiOutlineDesktopComputer size={20} />,
    path: '/suivi-temps-reel',
    permission: 'VIEW_MONITORING',
    matchPrefixes: ['/suivi-temps-reel', '/rapports-inactivite', '/historique-agent'],
    action: 'panel',
    panelMode: 'monitoring',
  },
];

const pathMatches = (currentPath: string, targetPrefix: string) =>
  currentPath === targetPrefix || currentPath.startsWith(`${targetPrefix}/`);

const panelRouteMatches = (currentPath: string, currentSearch: string, targetPath: string, exact = false) => {
  const [targetPathname, targetQuery = ''] = targetPath.split('?');
  const pathMatch = exact ? currentPath === targetPathname : pathMatches(currentPath, targetPathname);
  if (!pathMatch) return false;
  if (!targetQuery) return true;

  const currentParams = new URLSearchParams(currentSearch);
  const targetParams = new URLSearchParams(targetQuery);
  for (const [key, value] of targetParams.entries()) {
    if (currentParams.get(key) !== value) return false;
  }

  return true;
};

const normalizePermission = (permission: string) => permission.trim().toUpperCase();

const itemHasAccess = (item: { permission?: string; permissions?: string[] }, userPermissions: string[]) => {
  if (item.permissions) return item.permissions.some((permission) => userPermissions.includes(normalizePermission(permission)));
  return !item.permission || userPermissions.includes(normalizePermission(item.permission));
};

const isRailItemActive = (item: RailItemDef, pathname: string) => {
  const prefixes = item.matchPrefixes?.length ? item.matchPrefixes : [item.path.split('#')[0]];
  return prefixes.some((prefix) => pathMatches(pathname, prefix));
};

// Bouton de thème avec animation View Transition (cercle qui s'expanse)
const ThemeAnimatedBtn: React.FC<{
  targetTheme: 'light' | 'dark';
  current: string;
  setTheme: (t: 'light' | 'dark') => void;
  children: React.ReactNode;
}> = ({ targetTheme, current, setTheme, children }) => {
  const btnRef = useRef<HTMLButtonElement>(null);

  const handleClick = useCallback(async () => {
    if (current === targetTheme) return;
    if (!btnRef.current) return;

    const applyTheme = () => {
      flushSync(() => {
        // Manipuler le DOM directement pour que startViewTransition capture le changement
        document.documentElement.classList.toggle('dark', targetTheme === 'dark');
        localStorage.setItem('theme', targetTheme);
        setSharedCookie('theme', targetTheme); // sync cross-port (RH ↔ Projects)
        setTheme(targetTheme);
      });
    };

    if (!document.startViewTransition) {
      applyTheme();
      return;
    }

    await document.startViewTransition(applyTheme).ready;

    const { left, top, width, height } = btnRef.current.getBoundingClientRect();
    const centerX = left + width / 2;
    const centerY = top + height / 2;
    const maxDistance = Math.hypot(
      Math.max(centerX, window.innerWidth - centerX),
      Math.max(centerY, window.innerHeight - centerY)
    );

    document.documentElement.animate(
      {
        clipPath: [
          `circle(0px at ${centerX}px ${centerY}px)`,
          `circle(${maxDistance}px at ${centerX}px ${centerY}px)`,
        ],
      },
      {
        duration: 700,
        easing: 'ease-in-out',
        pseudoElement: '::view-transition-new(root)',
      }
    );
  }, [current, targetTheme, setTheme]);

  return (
    <button
      ref={btnRef}
      onClick={handleClick}
      className={`pc-account-popup-theme-btn ${current === targetTheme ? 'active' : ''}`}
      title={targetTheme === 'light' ? 'Mode clair' : 'Mode sombre'}
    >
      {children}
    </button>
  );
};

const resolvePhotoUrl = (url?: string | null) => {
  if (!url) return null;
  if (/^(https?:|data:|blob:)/i.test(url)) return url;
  return `${API_BASE}${url.startsWith('/') ? '' : '/'}${url}`;
};

const Sidebar: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [photoBroken, setPhotoBroken] = useState(false);
  const { theme, toggleTheme, setTheme, font, setFont, fontSize, setFontSize } = useTheme();
  const {
    isExpanded,
    isMobileOpen,
    isRailVisible,
    openSubmenu,
    setOpenSubmenu,
    toggleSidebar,
    toggleMobileSidebar,
    toggleRail,
  } = useSidebar();

  const userPermissions = useMemo(
    () => (user?.permissions ?? []).map((permission) => normalizePermission(permission)),
    [user?.permissions],
  );

  const [pendingCount, setPendingCount] = useState(0);
  const [agentActive, setAgentActive] = useState(true);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [notifications, setNotifications] = useState<NotificationResponse[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [activePanelMode, setActivePanelMode] = useState<'mon-espace' | 'gestion-rh' | 'administration' | 'monitoring' | null>(null);
  const lastAutoSubmenuKey = useRef<string | null>(null);
  const notifMenuRef = useRef<HTMLDivElement>(null);
  const accountMenuRef = useRef<HTMLDivElement>(null);

  const canViewValidations = userPermissions.includes('VIEW_VALIDATIONS');

  useEffect(() => {
    if (!canViewValidations) return;
    const fetchPending = async () => {
      try {
        const res = await demandeService.getByStatut('EN_ATTENTE' as never);
        setPendingCount((res.data.data || []).length);
      } catch {
        // ignore
      }
    };
    fetchPending();
    const interval = setInterval(fetchPending, 30000);
    return () => clearInterval(interval);
  }, [canViewValidations]);

  useEffect(() => {
    if (!user?.employeId) return;
    const checkAgent = async () => {
      try {
        const res = await agentDashboardService.checkAgentActive(user.employeId);
        setAgentActive(res.data.data.active);
      } catch {
        // Si le backend est inaccessible, on ne sait pas si l'agent est installé
        // → on garde agentActive=true pour ne pas afficher inutilement le bouton d'installation
        setAgentActive(true);
      }
    };
    checkAgent();
    const interval = setInterval(checkAgent, 60000);
    return () => clearInterval(interval);
  }, [user?.employeId]);

  const fetchNotifications = async () => {
    if (!user?.employeId) return;
    try {
      const notifRes = await notificationService.getByEmploye(user.employeId);
      const raw = notifRes.data.data || [];
      const filtered = raw.filter(shouldDisplayNotification);
      setNotifications(filtered);
      setUnreadCount(filtered.filter((notif) => !notif.lu).length);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [user?.employeId]);

  useEffect(() => {
    if (showNotifications) fetchNotifications();
  }, [showNotifications, user?.employeId]);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (notifMenuRef.current && !notifMenuRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
      if (accountMenuRef.current && !accountMenuRef.current.contains(event.target as Node)) {
        setShowAccountMenu(false);
      }
    };

    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowNotifications(false);
        setShowAccountMenu(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleEscapeKey);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, []);

  const visibleRailMain = useMemo(
    () => railMainItems.filter((item) => itemHasAccess(item, userPermissions)),
    [userPermissions],
  );

  const visibleRailSecondary = useMemo(
    () => railSecondaryItems.filter((item) => itemHasAccess(item, userPermissions)),
    [userPermissions],
  );

  const filteredPanelGroups = useMemo(() => {
    const groups = panelGroupsTemplate
      .filter((group) => !activePanelMode || group.modes.includes(activePanelMode))
      .map((group) => ({
        ...group,
        items: group.items
          .filter((item) => itemHasAccess(item, userPermissions))
          .map((item) => {
            if (item.key === 'validations' && canViewValidations && pendingCount > 0) {
              return { ...item, badge: pendingCount };
            }
            return item;
          }),
      }))
      .filter((group) => group.items.length > 0);

    return groups;
  }, [activePanelMode, canViewValidations, pendingCount, userPermissions]);

  const panelTitle = useMemo(() => {
    if (activePanelMode === 'mon-espace') return 'Mon Espace';
    if (activePanelMode === 'gestion-rh') return 'Gestion RH';
    if (activePanelMode === 'administration') return 'Administration';
    if (activePanelMode === 'monitoring') return 'Monitoring';

    const allRailItems = [...visibleRailMain, ...visibleRailSecondary];
    const activeItem = allRailItems.find((item) => isRailItemActive(item, location.pathname));
    return activeItem?.key === 'accueil' ? 'Antigone RH' : activeItem?.label || 'Antigone RH';
  }, [activePanelMode, location.pathname, visibleRailMain, visibleRailSecondary]);

  useEffect(() => {
    const matchKey = panelGroupsTemplate
      .filter((group) => !activePanelMode || group.modes.includes(activePanelMode))
      .flatMap((group) => group.items)
      .find((item) =>
        item.children?.some((child) =>
          panelRouteMatches(location.pathname, location.search, child.path),
        ),
      )?.key ?? null;

    if (matchKey && matchKey !== lastAutoSubmenuKey.current) {
      setOpenSubmenu(matchKey);
    }
    lastAutoSubmenuKey.current = matchKey;
  }, [activePanelMode, location.pathname, location.search, setOpenSubmenu]);

  const userInitials = `${user?.prenom?.[0] ?? ''}${user?.nom?.[0] ?? ''}`.toUpperCase() || 'RH';
  const photoSrc = resolvePhotoUrl(user?.imageUrl);

  useEffect(() => {
    setPhotoBroken(false);
  }, [user?.imageUrl]);

  const openPanelIfNeeded = () => {
    if (!isExpanded) toggleSidebar();
  };

  const closeAllPanels = () => {
    if (isExpanded) toggleSidebar();
    if (isMobileOpen) toggleMobileSidebar();
    setActivePanelMode(null);
    setOpenSubmenu(null);
    setShowNotifications(false);
    setShowAccountMenu(false);
  };

  const handleRailClick = (item: RailItemDef) => {
    setShowNotifications(false);
    setShowAccountMenu(false);

    if (item.action === 'panel' && item.panelMode) {
      if (activePanelMode === item.panelMode && isExpanded) {
        closeAllPanels();
        return;
      }
      setActivePanelMode(item.panelMode);
      openPanelIfNeeded();
      setOpenSubmenu(null);
      return;
    }

    setActivePanelMode(null);
    closeAllPanels();
    navigate(item.path);
  };

  const handleMarkAsRead = async (id: number) => {
    try {
      await notificationService.markAsRead(id);
      setNotifications((prev) => prev.map((notif) => (notif.id === id ? { ...notif, lu: true } : notif)));
      setUnreadCount((count) => Math.max(0, count - 1));
    } catch {
      // ignore
    }
  };

  const handleMarkAllRead = async () => {
    if (!user?.employeId) return;
    try {
      await notificationService.markAllAsRead(user.employeId);
      setNotifications((prev) => prev.map((notif) => ({ ...notif, lu: true })));
      setUnreadCount(0);
    } catch {
      // ignore
    }
  };

  const handleNotificationClick = (notif: NotificationResponse) => {
    if (!notif.lu) handleMarkAsRead(notif.id);

    navigate(getRhNotificationPath(notif));

    setShowNotifications(false);
  };

  const getNotificationIcon = (title: string) => {
    const value = title.toLowerCase();

    if (value.includes('reunion')) {
      return { icon: HiOutlineCalendar, bg: 'bg-indigo-50 dark:bg-indigo-500/10', color: 'text-indigo-500' };
    }
    if (value.includes('nouvel employe') || value.includes('nouveau subordonne')) {
      return { icon: HiOutlineUserAdd, bg: 'bg-brand-50 dark:bg-brand-500/10', color: 'text-brand-500' };
    }
    if (value.includes('mise a jour') || value.includes('mis a jour')) {
      return { icon: HiOutlinePencilAlt, bg: 'bg-warning-50 dark:bg-warning-500/10', color: 'text-warning-500' };
    }
    if (value.includes('supprime') || value.includes('retir') || value.includes('reaffecte')) {
      return { icon: HiOutlineTrash, bg: 'bg-error-50 dark:bg-error-500/10', color: 'text-error-500' };
    }
    if (value.includes('document')) {
      return { icon: HiOutlineDocumentReport, bg: 'bg-blue-50 dark:bg-blue-500/10', color: 'text-blue-500' };
    }
    if (value.includes('competence')) {
      return { icon: HiOutlineStar, bg: 'bg-purple-50 dark:bg-purple-500/10', color: 'text-purple-500' };
    }
    if (value.includes('photo')) {
      return { icon: HiOutlinePhotograph, bg: 'bg-cyan-50 dark:bg-cyan-500/10', color: 'text-cyan-500' };
    }
    if (value.includes('conge') || value.includes('solde')) {
      return { icon: HiOutlineCalendar, bg: 'bg-teal-50 dark:bg-teal-500/10', color: 'text-teal-500' };
    }
    if (value.includes('refuse')) {
      return { icon: HiOutlineXCircle, bg: 'bg-error-50 dark:bg-error-500/10', color: 'text-error-500' };
    }
    if (value.includes('approuve') || value.includes('acceptee')) {
      return { icon: HiOutlineCheckCircle, bg: 'bg-success-50 dark:bg-success-500/10', color: 'text-success-500' };
    }

    return { icon: HiOutlineInformationCircle, bg: 'bg-gray-50 dark:bg-gray-500/10', color: 'text-gray-500' };
  };

  const formatTimeAgo = (dateValue: string) => {
    const now = new Date();
    const date = new Date(dateValue);
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);

    if (diffMin < 1) return "A l'instant";
    if (diffMin < 60) return `Il y a ${diffMin} min`;

    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `Il y a ${diffHours} h`;

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return 'Hier';
    return `Il y a ${diffDays} j`;
  };

  return (
    <>
      <aside className={`pc-icon-rail-shell ${isMobileOpen ? 'is-mobile-open' : ''} ${!isRailVisible ? 'rail-hidden' : ''}`}>
        <button
          type="button"
          className="pc-logo-btn"
          onClick={() => {
            setActivePanelMode(null);
            closeAllPanels();
            navigate('/dashboard');
          }}
          aria-label="Ouvrir l'accueil"
        >
          <img src={`${import.meta.env.BASE_URL}antigone-icon.svg`} alt="Antigone" className="h-8 w-8 object-contain" />
        </button>

        <div className="pc-rail-divider" />

        <div className="pc-rail-list">
          {visibleRailMain.map((item) => {
            const active = activePanelMode && isExpanded
              ? item.panelMode === activePanelMode
              : isRailItemActive(item, location.pathname);
            return (
              <button
                key={item.key}
                type="button"
                className={`pc-icon-btn ${active ? 'active' : ''}`}
                onClick={() => handleRailClick(item)}
                aria-label={item.label}
              >
                <span className="pc-icon-wrapper">{item.icon}</span>
                <span className="iconLabel">{item.label}</span>
                {item.badge && <span className="pc-icon-badge">{item.badge}</span>}
              </button>
            );
          })}
        </div>

        <div className="pc-rail-divider" />

        <div className="pc-rail-list">
          {visibleRailSecondary.map((item) => {
            const active = activePanelMode && isExpanded
              ? item.panelMode === activePanelMode
              : isRailItemActive(item, location.pathname);
            return (
              <button
                key={item.key}
                type="button"
                className={`pc-icon-btn ${active ? 'active' : ''}`}
                onClick={() => handleRailClick(item)}
                aria-label={item.label}
              >
                <span className="pc-icon-wrapper">{item.icon}</span>
                <span className="iconLabel">{item.label}</span>
              </button>
            );
          })}
        </div>

        <div className="pc-rail-spacer" />

        <div className="pc-bottom-controls">
          {/* Empty for now - only avatar button below */}
        </div>

        <div className="pc-rail-notif-wrap" ref={notifMenuRef}>
          <button
            type="button"
            className={`pc-icon-btn ${showNotifications ? 'active' : ''}`}
            onClick={() => {
              setShowAccountMenu(false);
              setShowNotifications((prev) => !prev);
            }}
            aria-label="Notifications"
          >
            <span className="pc-icon-wrapper"><HiOutlineBell size={20} /></span>
            <span className="iconLabel">Notifications</span>
            {unreadCount > 0 && <span className="pc-icon-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>}
          </button>

          {showNotifications && (
            <div className="pc-sidebar-notif-popover rounded-2xl border border-gray-200 bg-white shadow-theme-lg dark:border-gray-700 dark:bg-gray-800">
              <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3 dark:border-gray-700">
                <h4 className="text-theme-sm font-semibold text-gray-800 dark:text-white">
                  Notifications {unreadCount > 0 && <span className="text-brand-500">({unreadCount})</span>}
                </h4>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="text-theme-xs text-brand-500 hover:text-brand-600 dark:text-brand-400"
                  >
                    Tout marquer lu
                  </button>
                )}
              </div>

              <div className="max-h-[320px] overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-4 text-center text-theme-sm text-gray-500 dark:text-gray-400">
                    Aucune notification
                  </div>
                ) : (
                  notifications.slice(0, 10).map((notif) => (
                    <button
                      key={notif.id}
                      onClick={() => handleNotificationClick(notif)}
                      className={`flex w-full items-start gap-3 px-5 py-3 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50 ${!notif.lu ? 'bg-brand-50/50 dark:bg-brand-500/5' : ''
                        }`}
                    >
                      {(() => {
                        const { icon: Icon, bg, color } = getNotificationIcon(notif.titre || '');
                        return (
                          <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${bg}`}>
                            <Icon className={color} size={16} />
                          </div>
                        );
                      })()}

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className={`text-theme-sm ${!notif.lu ? 'font-semibold text-gray-800 dark:text-white' : 'text-gray-700 dark:text-gray-300'}`}>
                            {notif.titre}
                          </p>
                          {!notif.lu && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />}
                        </div>
                        <p className="mt-0.5 line-clamp-2 whitespace-pre-line text-theme-xs text-gray-500 dark:text-gray-400">
                          {notif.message}
                        </p>
                        <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">
                          {formatTimeAgo(notif.dateCreation)}
                        </p>
                      </div>
                    </button>
                  ))
                )}
              </div>

              {notifications.length > 10 && (
                <div className="border-t border-gray-200 px-5 py-2.5 dark:border-gray-700">
                  <button
                    onClick={() => {
                      navigate('/dashboard');
                      setShowNotifications(false);
                    }}
                    className="w-full text-center text-theme-xs text-brand-500 hover:text-brand-600"
                  >
                    Voir toutes les notifications
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="pc-account-menu-wrap" ref={accountMenuRef}>
          <button
            type="button"
            className="pc-avatar-btn"
            title={`${user?.prenom ?? ''} ${user?.nom ?? ''}`}
            onClick={() => {
              setShowNotifications(false);
              setShowAccountMenu((prev) => !prev);
            }}
            aria-label="Compte utilisateur"
          >
            <div className={`pc-avatar-chip${photoSrc && !photoBroken ? ' has-photo' : ''}`}>
              {photoSrc && !photoBroken ? (
                <img src={photoSrc} alt="" onError={() => setPhotoBroken(true)} />
              ) : (
                userInitials
              )}
            </div>
          </button>

          {showAccountMenu && (
            <div className="pc-account-popup">
              <div className="pc-account-popup-header">
                <div className="flex flex-1 items-center gap-3">
                  {photoSrc && !photoBroken ? (
                    <img src={photoSrc} alt="" className="h-11 w-11 shrink-0 rounded-full object-cover" />
                  ) : (
                    <div
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                      style={{ background: 'linear-gradient(135deg, #683b77, #ab78c3)' }}
                    >
                      {userInitials}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="pc-account-name">{user?.prenom} {user?.nom}</p>
                    <p className="pc-account-email">{user?.email}</p>
                    <span className="pc-account-role-badge">{user?.roles?.[0] || 'Employe'}</span>
                  </div>
                </div>
              </div>

              <div className="pc-account-popup-divider" />

              <button
                onClick={() => {
                  setShowAccountMenu(false);
                  navigate('/mon-profil');
                }}
                className="pc-account-popup-item"
              >
                <HiOutlineUser size={18} />
                <span>Mon profil</span>
              </button>

              <div className="pc-account-popup-divider" />

              <div className="pc-account-popup-section-label">Theme</div>

              <div className="pc-account-popup-theme-options">
                <ThemeAnimatedBtn targetTheme={theme === 'dark' ? 'light' : 'dark'} current={theme} setTheme={setTheme}>
                  {theme === 'dark' ? <HiOutlineSun size={18} /> : <HiOutlineMoon size={18} />}
                  <span>{theme === 'dark' ? 'Léger' : 'Sombre'}</span>
                </ThemeAnimatedBtn>
              </div>

              <div className="pc-account-popup-divider" />

              <div className="pc-account-popup-section-label">Police d'écriture</div>
              <div className="pc-account-popup-theme-options" style={{ flexWrap: 'wrap', gap: '8px', padding: '8px 12px' }}>
                {(['Inter', 'Poppins'] as AppFont[]).map(f => (
                  <button
                    key={f}
                    onClick={() => setFont(f)}
                    className={`pc-account-popup-theme-btn ${font === f ? 'active' : ''}`}
                    title={f}
                    style={{ fontFamily: f, fontSize: '11px', padding: '4px 12px', height: 'auto', minHeight: 'unset' }}
                  >
                    {f}
                  </button>
                ))}
              </div>

              <div className="pc-account-popup-section-label" style={{ marginTop: '4px' }}>Taille du texte</div>
              <div style={{ padding: '4px 12px 10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '10px', color: 'var(--text-3)', minWidth: '16px' }}>A</span>
                  <input
                    type="range"
                    min={0}
                    max={3}
                    value={(['13px', '14px', '15px', '16px'] as AppFontSize[]).indexOf(fontSize)}
                    onChange={e => setFontSize((['13px', '14px', '15px', '16px'] as AppFontSize[])[Number(e.target.value)])}
                    style={{ flex: 1, accentColor: 'var(--brand)', cursor: 'pointer', height: '4px' }}
                  />
                  <span style={{ fontSize: '14px', color: 'var(--text-3)', minWidth: '16px', textAlign: 'right' }}>A</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                  {(['13px', '14px', '15px', '16px'] as AppFontSize[]).map(s => (
                    <button
                      key={s}
                      onClick={() => setFontSize(s)}
                      style={{
                        fontSize: '10px',
                        padding: '2px 6px',
                        borderRadius: '6px',
                        border: fontSize === s ? '1px solid var(--brand)' : '1px solid transparent',
                        background: fontSize === s ? 'var(--brand-light)' : 'transparent',
                        color: fontSize === s ? 'var(--brand)' : 'var(--text-3)',
                        cursor: 'pointer',
                        fontWeight: fontSize === s ? 600 : 400,
                        transition: 'all 0.15s',
                      }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pc-account-popup-divider" />

              <button
                onClick={() => {
                  setShowAccountMenu(false);
                  logout();
                }}
                className="pc-account-popup-item pc-account-popup-item-logout"
              >
                <HiOutlineLogout size={18} />
                <span>Se deconnecter</span>
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Bouton toggle intégré au bord droit de la rail */}
      <button
        type="button"
        className={`pc-rail-toggle-btn ${!isRailVisible ? 'rail-hidden' : ''}`}
        onClick={toggleRail}
        aria-label={isRailVisible ? 'Fermer la barre' : 'Ouvrir la barre'}
      >
        {isRailVisible ? <HiChevronLeft size={12} /> : <HiChevronRight size={12} />}
      </button>

      {isExpanded && isRailVisible && <button type="button" className="pc-panel-overlay" onClick={closeAllPanels} aria-label="Fermer le panel" />}

      <section className={`pc-secondary-panel ${isExpanded && isRailVisible ? 'open' : ''}`} aria-hidden={!isExpanded || !isRailVisible}>
        <header className="pc-secondary-header">
          <div>
            <p className="pc-secondary-title">{panelTitle}</p>
          </div>
        </header>

        <div className="pc-secondary-content custom-scrollbar">
          {filteredPanelGroups.map((group) => (
            <div key={group.title} className="pc-panel-group">
              <p className="pc-panel-group-title">{group.title}</p>
              <ul className="pc-panel-list">
                {group.items.map((item) => (
                  <PanelItem
                    key={item.key}
                    item={item}
                    currentPath={location.pathname}
                    currentSearch={location.search}
                    openSubmenu={openSubmenu}
                    setOpenSubmenu={setOpenSubmenu}
                    onNavigate={closeAllPanels}
                  />
                ))}
              </ul>
            </div>
          ))}

          {!agentActive && (
            <div className="pc-panel-group">
              <p className="pc-panel-group-title">OUTILS</p>
              <a href={`${API_BASE}/api/agent/download`} download className="pc-panel-item is-active">
                <span className="pc-panel-item-icon"><HiOutlineDownload size={18} /></span>
                <span className="pc-panel-item-label">Installer l'Agent</span>
              </a>
            </div>
          )}
        </div>
      </section>
    </>
  );
};

const PanelItem: React.FC<{
  item: NavItemDef;
  currentPath: string;
  currentSearch: string;
  openSubmenu: string | null;
  setOpenSubmenu: (submenu: string | null) => void;
  onNavigate: () => void;
}> = ({ item, currentPath, currentSearch, openSubmenu, setOpenSubmenu, onNavigate }) => {
  const navigate = useNavigate();
  const active = panelRouteMatches(currentPath, currentSearch, item.path);
  const childActive = item.children?.some((child) => panelRouteMatches(currentPath, currentSearch, child.path)) ?? false;
  const isOpen = openSubmenu === item.key;

  if (item.children && item.children.length > 0) {
    return (
      <li>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            setOpenSubmenu(isOpen ? null : item.key);
            if (!isOpen) navigate(item.path);
          }}
          className={`pc-panel-item ${active || childActive ? 'is-active' : ''}`}
        >
          <span className="pc-panel-item-icon">{item.icon}</span>
          <span className="pc-panel-item-label">{item.label}</span>
          <HiOutlineChevronDown size={16} className={`pc-chevron ${isOpen ? 'open' : ''}`} />
        </button>

        <div className="pc-panel-children" style={{ maxHeight: isOpen ? '420px' : '0px' }}>
          <ul className="pc-panel-child-list">
            {item.children.map((child) => (
              <li key={child.path}>
                <NavLink
                  to={child.path}
                  end
                  onClick={(event) => { event.stopPropagation(); onNavigate(); }}
                  className={`pc-panel-child ${panelRouteMatches(currentPath, currentSearch, child.path, true) ? 'is-active' : ''}`}
                >
                  {child.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      </li>
    );
  }

  return (
    <li>
      <NavLink
        to={item.path}
        onClick={(event) => { event.stopPropagation(); onNavigate(); }}
        className={({ isActive }) => `pc-panel-item ${isActive ? 'is-active' : ''}`}
      >
        <span className="pc-panel-item-icon">{item.icon}</span>
        <span className="pc-panel-item-label">{item.label}</span>
      </NavLink>
    </li>
  );
};

export default Sidebar;
