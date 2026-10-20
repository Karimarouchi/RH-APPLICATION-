import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import AppSwitchButton from '../ui/AppSwitchButton';
import OnboardingTour from '../onboarding/OnboardingTour';
import { useSidebar } from '../../hooks/useSidebar';

const MainLayout: React.FC = () => {
  const { isRailVisible } = useSidebar();
  return (
    <div className="min-h-screen bg-[var(--bg)] dark:bg-gray-950">
      <Sidebar />
      <div className={`transition-all duration-300 ease-in-out ${isRailVisible ? 'lg:ml-[var(--sidebar-w)]' : 'lg:ml-0'}`}>
        <main className="mx-auto max-w-(--breakpoint-2xl) p-4 md:p-6">
          <Outlet />
        </main>
      </div>
      <AppSwitchButton />
      <OnboardingTour />
    </div>
  );
};

export default MainLayout;
