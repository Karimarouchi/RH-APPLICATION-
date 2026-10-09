import React, { useEffect } from 'react';
import { relayAuthSnapshotForSwitch } from '../utils/authStorage';

const LoginPage: React.FC = () => {
  const projectsAppUrl = (import.meta.env.VITE_PROJECTS_APP_URL as string | undefined)?.trim();

  useEffect(() => {
    const loginUrl = projectsAppUrl ? `${projectsAppUrl}/login` : null;
    if (loginUrl) {
      relayAuthSnapshotForSwitch();
      window.location.replace(loginUrl);
    }
  }, [projectsAppUrl]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
      <p className="text-gray-400 text-sm">Redirection vers la page de connexion...</p>
    </div>
  );
};

export default LoginPage;
