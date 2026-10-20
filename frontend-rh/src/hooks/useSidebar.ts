import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';

interface SidebarContextType {
  isExpanded: boolean;
  isMobileOpen: boolean;
  isHovered: boolean;
  isRailVisible: boolean;
  openSubmenu: string | null;
  toggleSidebar: () => void;
  toggleMobileSidebar: () => void;
  toggleRail: () => void;
  setIsHovered: (hovered: boolean) => void;
  setOpenSubmenu: (submenu: string | null) => void;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export const SidebarProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isRailVisible, setIsRailVisible] = useState(true);
  const [openSubmenu, setOpenSubmenuState] = useState<string | null>(null);

  const toggleSidebar = useCallback(() => setIsExpanded((prev) => !prev), []);
  const toggleMobileSidebar = useCallback(() => setIsMobileOpen((prev) => !prev), []);
  const toggleRail = useCallback(() => {
    setIsRailVisible((prev) => !prev);
    setIsExpanded(false); // fermer le panel secondaire aussi
  }, []);

  const setOpenSubmenu = useCallback((submenu: string | null) => {
    setOpenSubmenuState(submenu);
  }, []);

  // Auto-collapse on small screens
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setIsExpanded(false);
        setIsMobileOpen(false);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return React.createElement(SidebarContext.Provider, {
    value: {
      isExpanded,
      isMobileOpen,
      isHovered,
      isRailVisible,
      openSubmenu,
      toggleSidebar,
      toggleMobileSidebar,
      toggleRail,
      setIsHovered,
      setOpenSubmenu,
    },
    children,
  });
};

export const useSidebar = () => {
  const context = useContext(SidebarContext);
  if (!context) throw new Error('useSidebar must be used within SidebarProvider');
  return context;
};
