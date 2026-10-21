import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import MainLayout from './components/layout/MainLayout';
import LoginPage from './pages/LoginPage';
import AccueilProjetsPage from './pages/AccueilProjetsPage';
import ProjetsPage from './pages/ProjetsPage';
import EquipesPage from './pages/EquipesPage';
import ChangePasswordPage from './pages/ChangePasswordPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import MonProfilPage from './pages/MonProfilPage';
import MesTachesPage from './pages/MesTachesPage';
import ProjetTachesPage from './pages/ProjetTachesPage';
import AdminProjetTachesPage from './pages/AdminProjetTachesPage';
import CalendrierProjetsAdminPage from './pages/CalendrierProjetsAdminPage';
import ClientsPage from './pages/ClientsPage';
const MediaPlanPage = React.lazy(() => import('./pages/MediaPlanPage'));
import TousLesMediaPlanPage from './pages/TousLesMediaPlanPage';
import RapportProjetPage from './pages/RapportProjetPage';
import AdminProjectDashboardPage from './pages/AdminProjectDashboardPage';
import AdminProjectDetailPage from './pages/AdminProjectDetailPage';
import ClientMediaPlansPage from './pages/ClientMediaPlansPage';
import ClientProjectsDashboardPage from './pages/ClientProjectsDashboardPage';
import ClientDriveFilesPage from './pages/ClientDriveFilesPage';
import ClientAccueilPage from './pages/ClientAccueilPage';
import ClientLayout from './components/layout/ClientLayout';
import ReactifInternPage from './pages/ReactifInternPage';
import ReactifExternPage from './pages/ReactifExternPage';
import { NotificationProvider } from './context/NotificationContext';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

const PermissionRoute: React.FC<{ permission: string; children: React.ReactNode }> = ({ permission, children }) => {
  const { user } = useAuth();
  const hasPermission = user?.permissions?.includes(permission);
  if (!hasPermission) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
};

const AnyPermissionRoute: React.FC<{ permissions: string[]; children: React.ReactNode }> = ({ permissions, children }) => {
  const { user } = useAuth();
  const hasAny = permissions.some(p => user?.permissions?.includes(p));
  if (!hasAny) return <Navigate to="/accueil" replace />;
  return <>{children}</>;
};

/** Only accessible to clients (isClient === true) who have permission for this pageKey */
const ClientRoute: React.FC<{ children: React.ReactNode; pageKey?: string }> = ({ children, pageKey }) => {
  const { user, isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!user?.isClient) return <Navigate to="/projets" replace />;
  // If a specific pageKey is required, check the client's allowed pages
  if (pageKey) {
    const allowed = user?.clientPages ?? [];
    if (allowed.length > 0 && !allowed.includes(pageKey)) {
      // Redirect to accueil instead of the first allowed page, as accueil is always available
      return <Navigate to="/client/accueil" replace />;
    }
  }
  return <>{children}</>;
};

/** Redirect root "/" to the right home page depending on user type */
const SmartRedirect: React.FC = () => {
  const { user } = useAuth();
  if (user?.isClient) {
    return <Navigate to="/client/accueil" replace />;
  }
  return <Navigate to="/projets" replace />;
};

const App: React.FC = () => {
  return (
    <NotificationProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/change-password" element={<ProtectedRoute><ChangePasswordPage /></ProtectedRoute>} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/accueil" replace />} />
          <Route path="dashboard" element={<Navigate to="/accueil" replace />} />
          <Route path="accueil" element={<AccueilProjetsPage />} />
          <Route path="projets" element={<PermissionRoute permission="VIEW_PROJETS"><ProjetsPage /></PermissionRoute>} />
          <Route path="equipes" element={<PermissionRoute permission="VIEW_EQUIPES"><EquipesPage /></PermissionRoute>} />
          <Route path="mon-profil" element={<MonProfilPage />} />
          <Route path="mes-taches" element={<MesTachesPage />} />
          <Route path="projets/:projetId/taches" element={<PermissionRoute permission="VIEW_PROJETS"><ProjetTachesPage /></PermissionRoute>} />
          <Route path="admin/calendrier-projets" element={<AnyPermissionRoute permissions={['VIEW_CALENDRIER_PROJETS', 'VIEW_DEADLINES', 'VIEW_REUNIONS']}><CalendrierProjetsAdminPage /></AnyPermissionRoute>} />
          <Route path="admin/projets/:projetId/taches" element={<PermissionRoute permission="VIEW_TOUS_PROJETS"><AdminProjetTachesPage /></PermissionRoute>} />
          <Route path="admin/clients" element={<PermissionRoute permission="VIEW_CLIENTS"><ClientsPage /></PermissionRoute>} />
          <Route path="media-plan" element={<PermissionRoute permission="VIEW_MEDIA_PLAN"><React.Suspense fallback={<div className="p-8 text-sm text-gray-400">Chargement…</div>}><MediaPlanPage /></React.Suspense></PermissionRoute>} />
          <Route path="media-plan/:clientId" element={<PermissionRoute permission="VIEW_MEDIA_PLAN"><React.Suspense fallback={<div className="p-8 text-sm text-gray-400">Chargement…</div>}><MediaPlanPage /></React.Suspense></PermissionRoute>} />
          <Route path="admin/media-plans" element={<PermissionRoute permission="VIEW_TOUS_MEDIA_PLAN"><TousLesMediaPlanPage /></PermissionRoute>} />
          <Route path="rapport-projet" element={<PermissionRoute permission="VIEW_PROJETS"><RapportProjetPage /></PermissionRoute>} />
          <Route path="admin/dashboard-projets" element={<PermissionRoute permission="VIEW_TOUS_PROJETS"><AdminProjectDashboardPage /></PermissionRoute>} />
          <Route path="admin/dashboard-projets/:projetId" element={<PermissionRoute permission="VIEW_TOUS_PROJETS"><AdminProjectDetailPage /></PermissionRoute>} />
          <Route path="reactifs/intern" element={<PermissionRoute permission="VIEW_PROJETS"><ReactifInternPage /></PermissionRoute>} />
          <Route path="reactifs/extern" element={<PermissionRoute permission="VIEW_PROJETS"><ReactifExternPage /></PermissionRoute>} />
        </Route>
        
        {/* ── Client Portal ── */}
        <Route
          path="/client"
          element={
            <ProtectedRoute>
              <ClientLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/client/accueil" replace />} />
          <Route path="accueil" element={<ClientRoute><ClientAccueilPage /></ClientRoute>} />
          <Route path="media-plans" element={<ClientRoute pageKey="MEDIA_PLANS"><ClientMediaPlansPage /></ClientRoute>} />
          <Route path="projets" element={<ClientRoute pageKey="PROJETS"><ClientProjectsDashboardPage /></ClientRoute>} />
          <Route path="fichiers" element={<ClientRoute pageKey="FICHIERS"><ClientDriveFilesPage /></ClientRoute>} />
        </Route>

        <Route path="*" element={<Navigate to="/accueil" replace />} />
      </Routes>
    </NotificationProvider>
  );
};

export default App;
