import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { clientService } from '../api/clientService';
import {
  HiOutlinePhotograph,
  HiOutlineBriefcase,
  HiOutlineCollection,
  HiOutlineArrowRight,
  HiOutlineExternalLink
} from 'react-icons/hi';

const ClientAccueilPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [driveLink, setDriveLink] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // Declencher l'animation d'entree apres un court delai
    setTimeout(() => setIsLoaded(true), 50);

    if (user?.clientId) {
      clientService.getClientPortalDriveLink(user.clientId)
        .then(res => {
          const link = (res as any)?.data?.data ?? (res as any)?.data ?? null;
          setDriveLink(typeof link === 'string' ? link : null);
        })
        .catch(() => setDriveLink(null));
    }
  }, [user?.clientId]);

  const clientPages: string[] = user?.clientPages ?? [];
  const hasPage = (key: string) => !clientPages.length || clientPages.includes(key);

  return (
    <div className={`transition-all duration-700 ease-out transform ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'} flex flex-col gap-8`}>
      {/* ── Styles personnalisés pour l'animation de fond ── */}
      <style>{`
        .bg-animated-gradient {
          background-size: 200% 200%;
          animation: gradientMove 15s ease infinite;
        }
        @keyframes gradientMove {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .glass-card {
          background: rgba(255, 255, 255, 0.6);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.4);
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.05);
        }
        .dark .glass-card {
          background: rgba(17, 24, 39, 0.6);
          border: 1px solid rgba(255, 255, 255, 0.05);
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        }
      `}</style>

      {/* ── Hero Banner ── */}
      <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#683b77] via-[#8e4a9e] to-[#4c2b57] bg-animated-gradient p-10 sm:p-14 text-white shadow-2xl">
        <div className="absolute top-0 right-0 -mt-20 -mr-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute bottom-0 left-0 -mb-20 -ml-20 h-64 w-64 rounded-full bg-brand-400/20 blur-3xl" />
        
        <div className="relative z-10 max-w-3xl">
          <h1 className="mb-4 text-4xl sm:text-5xl font-extrabold tracking-tight">
            Bienvenue dans votre <br /> <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-200 to-white">Espace</span>.
          </h1>
          <p className="text-lg sm:text-xl font-medium text-brand-100 opacity-90 max-w-xl">
            Retrouvez tous vos livrables, validez vos Media Plans et suivez l'avancée de vos projets avec une expérience fluide et sur-mesure.
          </p>
        </div>
      </div>

      {/* ── Grid d'Actions Rapides ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        
        {/* Carte Media Plans */}
        {hasPage('MEDIA_PLANS') && (
          <div  data-tour="client-card-media-plans"
            onClick={() => navigate('/client/media-plans')}
            className="glass-card group relative cursor-pointer overflow-hidden rounded-3xl p-8 transition-all hover:-translate-y-2 hover:shadow-xl dark:hover:shadow-brand-900/20"
          >
            <div className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-50 to-brand-100 text-brand-600 shadow-inner dark:from-brand-900/40 dark:to-brand-800/20 dark:text-brand-400 transition-transform group-hover:scale-110">
              <HiOutlinePhotograph size={28} />
            </div>
            <h2 className="mb-2 text-2xl font-bold text-gray-900 dark:text-white">Media Plans</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">
              Consultez vos calendriers éditoriaux et approuvez vos publications en un clic.
            </p>
            <div className="absolute bottom-8 right-8 text-brand-500 opacity-0 transition-all group-hover:opacity-100 group-hover:translate-x-1">
              <HiOutlineArrowRight size={24} />
            </div>
          </div>
        )}

        {/* Carte Projets */}
        {hasPage('PROJETS') && (
          <div  data-tour="client-card-projets"
            onClick={() => navigate('/client/projets')}
            className="glass-card group relative cursor-pointer overflow-hidden rounded-3xl p-8 transition-all hover:-translate-y-2 hover:shadow-xl dark:hover:shadow-brand-900/20"
          >
            <div className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-50 to-blue-100 text-blue-600 shadow-inner dark:from-blue-900/40 dark:to-blue-800/20 dark:text-blue-400 transition-transform group-hover:scale-110">
              <HiOutlineBriefcase size={28} />
            </div>
            <h2 className="mb-2 text-2xl font-bold text-gray-900 dark:text-white">Mes Projets</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">
              Suivez l'état d'avancement de toutes nos collaborations en cours.
            </p>
            <div className="absolute bottom-8 right-8 text-blue-500 opacity-0 transition-all group-hover:opacity-100 group-hover:translate-x-1">
              <HiOutlineArrowRight size={24} />
            </div>
          </div>
        )}

        {/* Carte Fichiers / Drive */}
        {hasPage('FICHIERS') && (
          <div data-tour="client-card-fichiers"
	    onClick={() => navigate('/client/fichiers')} 
            className="glass-card group relative cursor-pointer overflow-hidden rounded-3xl p-8 transition-all hover:-translate-y-2 hover:shadow-xl dark:hover:shadow-brand-900/20"
          >
            <div className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-green-50 to-green-100 text-green-600 shadow-inner dark:from-green-900/40 dark:to-green-800/20 dark:text-green-400 transition-transform group-hover:scale-110">
              <HiOutlineCollection size={28} />
            </div>
            <h2 className="mb-2 text-2xl font-bold text-gray-900 dark:text-white">Mes Fichiers</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">
              Accédez instantanément à votre dossier Drive sécurisé et à vos livrables.
            </p>
            <div className="absolute bottom-8 right-8 text-green-500 opacity-0 transition-all group-hover:opacity-100 group-hover:translate-x-1">
              <HiOutlineArrowRight size={24} />
            </div>
          </div>
        )}
      </div>

    </div>
  );
};

export default ClientAccueilPage;
