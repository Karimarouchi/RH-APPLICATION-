import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { HiOutlineBell, HiOutlineLogout, HiOutlineMenu, HiOutlineLockClosed, HiOutlineUser, HiOutlineCheckCircle, HiOutlineXCircle, HiOutlineUserAdd, HiOutlinePencilAlt, HiOutlineTrash, HiOutlineDocumentText, HiOutlineStar, HiOutlinePhotograph, HiOutlineCalendar, HiOutlineInformationCircle } from 'react-icons/hi';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../hooks/useTheme';
import AnimatedThemeToggler from '../ui/AnimatedThemeToggler';
import { useSidebar } from '../../hooks/useSidebar';
import { notificationService } from '../../api/notificationService';
import { NotificationResponse } from '../../types';
import { API_BASE } from '../../api/axios';
import { relayAuthSnapshotForSwitch } from '../../utils/authStorage';
import { getNotificationTarget, shouldDisplayNotification } from '../../utils/notificationRules';
import { APP_KIND, PROJECTS_APP_URL, RH_APP_URL } from '../../config/apps';

const Header: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { toggleSidebar, toggleMobileSidebar } = useSidebar();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<NotificationResponse[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const notifMenuRef = useRef<HTMLDivElement>(null);
  const appKind = APP_KIND;
  const rhAppUrl = RH_APP_URL;
  const projectsAppUrl = PROJECTS_APP_URL;

  const switchToApp = useCallback((target: 'rh' | 'projects', targetPath: string, fallbackPath: string) => {
    const targetUrl = target === 'rh' ? rhAppUrl : projectsAppUrl;
    if (targetUrl) {
      const url = new URL(targetPath, targetUrl);
      relayAuthSnapshotForSwitch();
      window.location.assign(url.toString());
      return;
    }

    navigate(fallbackPath);
  }, [navigate, projectsAppUrl, rhAppUrl]);

  const fetchNotifications = useCallback(async () => {
    if (!user?.employeId) return;
    try {
      const notifRes = await notificationService.getByEmploye(user.employeId);
      const raw = notifRes.data.data || [];
      const filtered = raw.filter(shouldDisplayNotification);
      setNotifications(filtered);
      setUnreadCount(filtered.filter((notif) => !notif.lu).length);
    } catch {
      // Silently fail
    }
  }, [user?.employeId]);

  // Fetch notifications on mount and poll every 30s
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Refresh when dropdown opens
  useEffect(() => {
    if (showNotifications) fetchNotifications();
  }, [showNotifications, fetchNotifications]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
      if (notifMenuRef.current && !notifMenuRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleMarkAsRead = async (id: number) => {
    try {
      await notificationService.markAsRead(id);
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, lu: true } : n)));
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {
      // ignore
    }
  };

  const handleMarkAllRead = async () => {
    if (!user?.employeId) return;
    try {
      await notificationService.markAllAsRead(user.employeId);
      setNotifications((prev) => prev.map((n) => ({ ...n, lu: true })));
      setUnreadCount(0);
    } catch {
      // ignore
    }
  };

  const handleNotifClick = (notif: NotificationResponse) => {
    if (!notif.lu) handleMarkAsRead(notif.id);

    const target = getNotificationTarget(notif);

    if (appKind === 'rh') {
      if (target.kind === 'projects') {
        switchToApp('projects', target.path, '/dashboard');
      } else {
        navigate(target.path);
      }
      setShowNotifications(false);
      return;
    }

    if (target.kind === 'projects') {
      navigate(target.path);
    } else {
      switchToApp('rh', target.path, '/projets');
    }

    setShowNotifications(false);
  };

  const getNotifIcon = (titre: string) => {
    if (titre.includes('réunion') || titre.includes('Réunion'))
      return { icon: HiOutlineCalendar, bg: 'bg-indigo-50 dark:bg-indigo-500/10', color: 'text-indigo-500' };
    if (titre.includes('Nouvel employé') || titre.includes('Nouveau subordonné'))
      return { icon: HiOutlineUserAdd, bg: 'bg-brand-50 dark:bg-brand-500/10', color: 'text-brand-500' };
    if (titre.includes('modifiÃ©') || titre.includes('mis Ã  jour') || titre.includes('mise Ã  jour'))
      return { icon: HiOutlinePencilAlt, bg: 'bg-warning-50 dark:bg-warning-500/10', color: 'text-warning-500' };
    if (titre.includes('supprimÃ©') || titre.includes('retir') || titre.includes('rÃ©affectÃ©'))
      return { icon: HiOutlineTrash, bg: 'bg-error-50 dark:bg-error-500/10', color: 'text-error-500' };
    if (titre.includes('document') || titre.includes('Document'))
      return { icon: HiOutlineDocumentText, bg: 'bg-info-50 dark:bg-blue-500/10', color: 'text-blue-500' };
    if (titre.includes('compÃ©tence') || titre.includes('CompÃ©tence'))
      return { icon: HiOutlineStar, bg: 'bg-purple-50 dark:bg-purple-500/10', color: 'text-purple-500' };
    if (titre.includes('Photo'))
      return { icon: HiOutlinePhotograph, bg: 'bg-cyan-50 dark:bg-cyan-500/10', color: 'text-cyan-500' };
    if (titre.includes('Solde') || titre.includes('congÃ©'))
      return { icon: HiOutlineCalendar, bg: 'bg-teal-50 dark:bg-teal-500/10', color: 'text-teal-500' };
    if (titre.includes('refusÃ©e'))
      return { icon: HiOutlineXCircle, bg: 'bg-error-50 dark:bg-error-500/10', color: 'text-error-500' };
    if (titre.includes('approuvÃ©e') || titre.includes('acceptÃ©e'))
      return { icon: HiOutlineCheckCircle, bg: 'bg-success-50 dark:bg-success-500/10', color: 'text-success-500' };
    if (titre.includes('expirÃ©') || titre.includes('bientÃ´t'))
      return { icon: HiOutlineInformationCircle, bg: 'bg-brand- dark:bg-brand-/10', color: 'text-brand-' };
    return { icon: HiOutlineInformationCircle, bg: 'bg-gray-50 dark:bg-gray-500/10', color: 'text-gray-500' };
  };

  const formatTimeAgo = (dateStr: string) => {
    const now = new Date();
    const d = new Date(dateStr);
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "Ã€ l'instant";
    if (diffMin < 60) return `Il y a ${diffMin}min`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `Il y a ${diffH}h`;
    const diffD = Math.floor(diffH / 24);
    if (diffD === 1) return 'Hier';
    return `Il y a ${diffD}j`;
  };

  return (
    <header className="sticky top-0 z-99 flex h-[68px] w-full border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
      <div className="flex flex-1 items-center justify-between px-4 md:px-6">
        {/* Left: Hamburger + Search */}
        <div className="flex items-center gap-3">
          {/* Mobile hamburger */}
          <button
            onClick={toggleMobileSidebar}
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 lg:hidden dark:text-gray-400 dark:hover:bg-gray-800"
          >
            <HiOutlineMenu size={22} />
          </button>

          {/* Desktop toggle */}
          <button
            onClick={toggleSidebar}
            className="hidden rounded-lg p-2 text-gray-500 hover:bg-gray-100 lg:block dark:text-gray-400 dark:hover:bg-gray-800"
          >
            <HiOutlineMenu size={22} />
          </button>
        </div>

        {/* Right: Theme toggler + Notifications + User dropdown */}
        <div className="flex items-center gap-2">
          {/* Theme toggle */}
          <AnimatedThemeToggler />

          {/* Notifications */}
          <div className="relative" ref={notifMenuRef}>
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative rounded-full p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
            >
              <HiOutlineBell size={20} />
              {unreadCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-error-500 text-[10px] font-bold text-white">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
            {showNotifications && (
              <div className="absolute right-0 mt-2 w-[380px] rounded-2xl border border-gray-200 bg-white shadow-theme-lg dark:border-gray-700 dark:bg-gray-800">
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
                        onClick={() => handleNotifClick(notif)}
                        className={`flex w-full items-start gap-3 px-5 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${
                          !notif.lu ? 'bg-brand-50/50 dark:bg-brand-500/5' : ''
                        }`}
                      >
                        {(() => {
                          const { icon: Icon, bg, color } = getNotifIcon(notif.titre);
                          return (
                            <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${bg}`}>
                              <Icon className={color} size={16} />
                            </div>
                          );
                        })()}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className={`text-theme-sm ${!notif.lu ? 'font-semibold text-gray-800 dark:text-white' : 'text-gray-700 dark:text-gray-300'}`}>
                              {notif.titre}
                            </p>
                            {!notif.lu && (
                              <span className="h-1.5 w-1.5 rounded-full bg-brand-500 shrink-0" />
                            )}
                          </div>
                          <p className="text-theme-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2 whitespace-pre-line">
                            {notif.message}
                          </p>
                          <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">
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
                        if (appKind === 'rh') {
                          navigate('/mes-demandes');
                        } else {
                          navigate('/projets');
                        }
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

          {/* User menu */}
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 rounded-full pl-2 pr-1 py-1 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              {user?.imageUrl ? (
                <img src={`${API_BASE}${user.imageUrl}`} alt="" className="h-9 w-9 rounded-full object-cover" />
              ) : (
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary-500 text-white text-sm font-semibold">
                  {user?.prenom?.[0]}{user?.nom?.[0]}
                </div>
              )}
              <div className="hidden text-left md:block">
                <p className="text-theme-sm font-medium text-gray-700 dark:text-gray-200">
                  {user?.prenom} {user?.nom}
                </p>
                <p className="text-theme-xs text-gray-500 dark:text-gray-400">
                  {user?.roles?.[0] || 'EmployÃ©'}
                </p>
              </div>
            </button>
            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-[220px] rounded-2xl border border-gray-200 bg-white p-2 shadow-theme-lg dark:border-gray-700 dark:bg-gray-800">
                <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700 mb-1">
                  <p className="text-theme-sm font-medium text-gray-700 dark:text-gray-200">
                    {user?.prenom} {user?.nom}
                  </p>
                  <p className="text-theme-xs text-gray-500 dark:text-gray-400">
                    {user?.email}
                  </p>
                </div>
                <button
                  onClick={() => { setShowUserMenu(false); navigate('/mon-profil'); }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-theme-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5"
                >
                  <HiOutlineUser size={18} />
                  Mon profil
                </button>
                <button
                  onClick={logout}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-theme-sm text-error-500 hover:bg-gray-100 dark:hover:bg-white/5"
                >
                  <HiOutlineLogout size={18} />
                  Déconnexion
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;

