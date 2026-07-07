import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import MainLayout from './components/layout/MainLayout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import EmployesPage from './pages/EmployesPage';
import OrganigrammePage from './pages/OrganigrammePage';
import DemandesPage from './pages/DemandesPage';
import NewDemandePage from './pages/NewDemandePage';
import DemandesPapierPage from './pages/DemandesPapierPage';
import ValidationsPage from './pages/ValidationsPage';
import ReferentielsPage from './pages/ReferentielsPage';
import CalendrierPage from './pages/CalendrierPage';
import RestrictionsCongesPage from './pages/RestrictionsCongesPage';
import ComptesPage from './pages/ComptesPage';
import RolesPage from './pages/RolesPage';
import ChangePasswordPage from './pages/ChangePasswordPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import MonProfilPage from './pages/MonProfilPage';
import MonCalendrierPage from './pages/MonCalendrierPage';
import MesDemandesPage from './pages/MesDemandesPage';
import MesDemandesPapierPage from './pages/MesDemandesPapierPage';
import SuiviTempsReelPage from './pages/SuiviTempsReelPage';
import RapportsInactivitePage from './pages/RapportsInactivitePage';
import HistoriqueAgentPage from './pages/HistoriqueAgentPage';
import DashboardRHPage from './pages/DashboardRHPage';
import DepartementsPage from './pages/DepartementsPage';
import ArchivesPage from './pages/ArchivesPage';
import { NotificationProvider } from './context/NotificationContext';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) {
    const projectsAppUrl = (import.meta.env.VITE_PROJECTS_APP_URL as string | undefined)?.trim();
    if (projectsAppUrl) {
      window.location.replace(`${projectsAppUrl}/login`);
      return <div className="min-h-screen flex items-center justify-center bg-gray-900"><p className="text-gray-400 text-sm">Redirection vers la page de connexion...</p></div>;
    }
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

const PermissionRoute: React.FC<{ permission: string; children: React.ReactNode }> = ({ permission, children }) => {
  const { user } = useAuth();
  const hasPermission = user?.permissions?.includes(permission);
  if (!hasPermission) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
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
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="employes" element={<PermissionRoute permission="VIEW_EMPLOYES"><EmployesPage /></PermissionRoute>} />
          <Route path="employes/archives" element={<PermissionRoute permission="VIEW_EMPLOYES"><ArchivesPage /></PermissionRoute>} />
          <Route path="organigramme" element={<PermissionRoute permission="VIEW_EMPLOYES"><OrganigrammePage /></PermissionRoute>} />
          <Route path="demandes" element={<PermissionRoute permission="VIEW_DEMANDES"><DemandesPage /></PermissionRoute>} />
          <Route path="demandes/new" element={<PermissionRoute permission="VIEW_DEMANDES"><NewDemandePage /></PermissionRoute>} />
          <Route path="demandes/edit/:id" element={<NewDemandePage />} />
          <Route path="demandes/liste-papier" element={<PermissionRoute permission="VIEW_VALIDATIONS"><DemandesPapierPage /></PermissionRoute>} />
          <Route path="mes-demandes" element={<MesDemandesPage />} />
          <Route path="mes-demandes/papier" element={<PermissionRoute permission="VIEW_MES_DEMANDES"><MesDemandesPapierPage /></PermissionRoute>} />
          <Route path="mes-demandes-papier" element={<PermissionRoute permission="VIEW_MES_DEMANDES"><MesDemandesPapierPage /></PermissionRoute>} />
          <Route path="validations" element={<PermissionRoute permission="VIEW_VALIDATIONS"><ValidationsPage /></PermissionRoute>} />
          <Route path="referentiels" element={<PermissionRoute permission="VIEW_REFERENTIELS"><ReferentielsPage /></PermissionRoute>} />
          <Route path="calendrier" element={<PermissionRoute permission="VIEW_CALENDRIER"><CalendrierPage /></PermissionRoute>} />
          <Route path="restrictions-conges" element={<PermissionRoute permission="VIEW_RESTRICTION_CONGE"><RestrictionsCongesPage /></PermissionRoute>} />
          <Route path="mon-calendrier" element={<MonCalendrierPage />} />
          <Route path="comptes" element={<PermissionRoute permission="VIEW_COMPTES"><ComptesPage /></PermissionRoute>} />
          <Route path="roles" element={<PermissionRoute permission="VIEW_ROLES"><RolesPage /></PermissionRoute>} />
          <Route path="mon-profil" element={<MonProfilPage />} />
          <Route path="suivi-temps-reel" element={<PermissionRoute permission="VIEW_MONITORING"><SuiviTempsReelPage /></PermissionRoute>} />
          <Route path="rapports-inactivite" element={<PermissionRoute permission="VIEW_MONITORING"><RapportsInactivitePage /></PermissionRoute>} />
          <Route path="historique-agent" element={<PermissionRoute permission="VIEW_MONITORING"><HistoriqueAgentPage /></PermissionRoute>} />
          <Route path="dashboard-rh" element={<PermissionRoute permission="VIEW_DASHBOARD"><DashboardRHPage /></PermissionRoute>} />
          <Route path="admin/departements" element={<PermissionRoute permission="VIEW_EMPLOYES"><DepartementsPage /></PermissionRoute>} />

        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </NotificationProvider>
  );
};

export default App;
