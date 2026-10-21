import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import AppSwitchButton from '../ui/AppSwitchButton';
import OnboardingTour from '../onboarding/OnboardingTour';
import { useSidebar } from '../../hooks/useSidebar';

class RouteErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-800">
          <h2 className="mb-2 text-lg font-semibold">Impossible d’afficher cette page</h2>
          <p className="mb-4 text-sm">{this.state.error.message}</p>
          <button
            type="button"
            className="rounded-lg bg-red-600 px-3 py-1.5 text-sm text-white"
            onClick={() => this.setState({ error: null })}
          >
            Réessayer
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const MainLayout: React.FC = () => {
  const { isRailVisible } = useSidebar();
  return (
    <div className="min-h-screen bg-[var(--bg)] dark:bg-gray-950">
      <RouteErrorBoundary>
        <Sidebar />
      </RouteErrorBoundary>
      <div className={`transition-all duration-300 ease-in-out ${isRailVisible ? 'lg:ml-[var(--sidebar-w)]' : 'lg:ml-0'}`}>
        <main className="mx-auto max-w-(--breakpoint-2xl) p-4 md:p-6">
          <RouteErrorBoundary>
            <Outlet />
          </RouteErrorBoundary>
        </main>
      </div>
      <AppSwitchButton />
      <RouteErrorBoundary>
        <OnboardingTour />
      </RouteErrorBoundary>
    </div>
  );
};

export default MainLayout;
