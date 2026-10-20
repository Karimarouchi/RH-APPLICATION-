import React, { useEffect } from 'react';
import { relayAuthSnapshotForSwitch } from '../utils/authStorage';
import { PROJECTS_APP_URL } from '../config/apps';

const LoginPage: React.FC = () => {
  useEffect(() => {
    const loginUrl = PROJECTS_APP_URL ? `${PROJECTS_APP_URL}/login` : null;
    if (loginUrl) {
      relayAuthSnapshotForSwitch();
      window.location.replace(loginUrl);
    }
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
      <p className="text-gray-400 text-sm">Redirection vers la page de connexion...</p>
    </div>
  );
};

export default LoginPage;
