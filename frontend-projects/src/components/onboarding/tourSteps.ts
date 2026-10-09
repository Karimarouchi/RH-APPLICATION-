// Contenu du guide de premiere connexion.
// Les etapes affichees dependent des PERMISSIONS de la personne (pas du nom de son role) :
// un role cree plus tard par un administrateur obtient donc automatiquement le bon guide.

export type AppKind = 'rh' | 'projects';

export interface TourStep {
  id: string;
  icon: string;
  title: string;
  /** Nom de l'entree du menu a gauche, pour la retrouver */
  menu?: string;
  body: string;
  points?: string[];
  /** L'etape n'est montree que si la personne a AU MOINS UNE de ces permissions (vide = pour tout le monde) */
  any?: string[];
}

export interface TourUser {
  prenom?: string;
  nom?: string;
  roles?: string[];
  permissions?: string[];
  isClient?: boolean;
  clientPages?: string[];
}

export const getAppKind = (): AppKind =>
  ((import.meta.env.VITE_APP_KIND as string | undefined)?.trim().toLowerCase() === 'rh' ? 'rh' : 'projects');

/** Nom de l'application cote serveur ("rh" | "projets") */
export const serverAppName = (kind: AppKind) => (kind === 'rh' ? 'rh' : 'projets');

const FINAL_RH: TourStep = {
  id: 'fin',
  icon: '🚀',
  title: 'Vous êtes prêt !',
  body: 'Vous connaissez maintenant l’essentiel. Quelques astuces pour finir :',
  points: [
    'Le bouton « Projets / RH » en bas à droite vous fait passer d’une application à l’autre, sans vous reconnecter.',
    'La cloche en haut vous prévient dès qu’une demande change de statut.',
    'Un doute plus tard ? Le bouton « ? » en bas à droite relance ce guide à tout moment.',
  ],
};

const FINAL_PROJECTS: TourStep = {
  id: 'fin',
  icon: '🚀',
  title: 'Vous êtes prêt !',
  body: 'Vous connaissez maintenant l’essentiel. Quelques astuces pour finir :',
  points: [
    'Le bouton « Projets / RH » en bas à droite vous fait passer à l’application RH (congés, profil) sans vous reconnecter.',
    'La cloche vous prévient quand une tâche vous est assignée ou qu’un média plan change de statut.',
    'Un doute plus tard ? Le bouton « ? » en bas à droite relance ce guide à tout moment.',
  ],
};

const RH_STEPS: TourStep[] = [
  {
    id: 'accueil',
    icon: '🏠',
    title: 'Votre accueil',
    menu: 'Accueil',
    body: 'C’est la première page que vous voyez en vous connectant : un résumé de votre situation.',
    points: ['Votre solde de congés', 'Vos dernières demandes et leur statut', 'Vos notifications et ce qui demande votre attention'],
  },
  {
    id: 'mes-demandes',
    icon: '📝',
    title: 'Faire une demande',
    menu: 'Mon Espace › Mes demandes',
    any: ['VIEW_MES_DEMANDES', 'VIEW_DEMANDES'],
    body: 'Congé, autorisation d’absence ou télétravail : tout se demande ici, sans papier.',
    points: [
      'Choisissez le type, les dates, et ajoutez un justificatif si c’est demandé.',
      'L’application vous indique la date au plus tôt possible (le préavis dépend de la durée) et calcule vos jours.',
      'Suivez le statut : En attente, puis Approuvée ou Refusée. Vous pouvez annuler tant que c’est en attente.',
    ],
  },
  {
    id: 'mon-calendrier',
    icon: '📅',
    title: 'Votre calendrier',
    menu: 'Mon Espace › Mon calendrier',
    any: ['VIEW_MON_CALENDRIER'],
    body: 'Votre agenda personnel : vos congés, les jours fériés de l’entreprise et vos réunions au même endroit.',
  },
  {
    id: 'agent',
    icon: '🖥️',
    title: 'L’agent de pointage',
    body: 'Un petit programme Windows enregistre vos heures d’arrivée et de départ. Vous le téléchargez depuis le menu, en bas à gauche.',
    points: [
      'Il vous demande parfois de confirmer que vous êtes bien présent : un simple clic suffit.',
      'Vos congés, jours fériés, télétravail et autorisations validés sont pris en compte automatiquement : pas de retard compté à tort.',
    ],
  },
  {
    id: 'employes',
    icon: '👥',
    title: 'Les employés',
    menu: 'Gestion RH › Liste des employés',
    any: ['VIEW_EMPLOYES'],
    body: 'La base de tous les collaborateurs de l’entreprise.',
    points: [
      'Créez et modifiez les fiches : contrat, poste, département, documents, compétences.',
      'L’organigramme montre qui dépend de qui ; les départs vont dans les archives.',
      'Les informations sensibles (salaire, RIB, CIN) ne sont visibles que par les personnes autorisées, comme vous.',
    ],
  },
  {
    id: 'validations',
    icon: '✅',
    title: 'Valider les demandes',
    menu: 'Validation demandes',
    any: ['VIEW_VALIDATIONS', 'VIEW_DEMANDES'],
    body: 'Les demandes de congé et de papiers de votre équipe arrivent ici.',
    points: [
      'Ouvrez une demande, puis Approuvez ou Refusez (avec un commentaire si besoin).',
      'Le solde de congé est mis à jour automatiquement à l’approbation, et l’employé est prévenu.',
      'Pour garder les décisions fiables, vous ne pouvez pas valider vos propres demandes.',
    ],
  },
  {
    id: 'dashboard-rh',
    icon: '📊',
    title: 'Le tableau de bord RH',
    menu: 'Gestion RH › Dashboard RH',
    any: ['VIEW_DASHBOARD'],
    body: 'Les chiffres clés des ressources humaines en un coup d’œil : présences du jour, absences, demandes en attente, alertes.',
  },
  {
    id: 'calendrier',
    icon: '🗓️',
    title: 'Calendrier et restrictions',
    menu: 'Administration › Calendrier entreprise',
    any: ['VIEW_CALENDRIER', 'VIEW_RESTRICTION_CONGE'],
    body: 'Définissez les règles du temps de travail pour toute l’entreprise.',
    points: [
      'Jours fériés : un employé qui pointe un jour férié n’est jamais compté en retard.',
      'Restrictions de congés : bloquez des périodes où personne ne peut partir (clôture, forte activité).',
    ],
  },
  {
    id: 'comptes',
    icon: '🔑',
    title: 'Les comptes d’accès',
    menu: 'Administration › Comptes',
    any: ['VIEW_COMPTES'],
    body: 'Un compte permet à un employé de se connecter.',
    points: [
      'Créez un compte pour un employé et choisissez son ou ses rôles.',
      'Un mot de passe provisoire est généré : la personne devra le changer à sa première connexion.',
      'Vous pouvez désactiver un compte à tout moment (départ, suspension).',
    ],
  },
  {
    id: 'roles',
    icon: '🛡️',
    title: 'Les rôles et permissions',
    menu: 'Administration › Rôles',
    any: ['VIEW_ROLES'],
    body: 'Un rôle est une liste de permissions : chaque personne ne voit que les pages que son rôle autorise.',
    points: [
      'Créez un rôle, cochez ce qu’il a le droit de faire, puis attribuez-le dans « Comptes ».',
      'Ce guide s’adapte tout seul : une personne qui reçoit un nouveau rôle voit uniquement les explications des pages qu’elle peut utiliser.',
      'Attention : donner une permission de gestion donne aussi le droit de modifier ou supprimer les données concernées.',
    ],
  },
  {
    id: 'referentiels',
    icon: '⚙️',
    title: 'Les référentiels et réglages',
    menu: 'Administration › Référentiels',
    any: ['VIEW_REFERENTIELS'],
    body: 'Les listes et paramètres utilisés partout dans l’application.',
    points: [
      'Listes : départements, postes, types de contrat, formats de média plan…',
      'Paramètres système : horaires, règles de congés, réseau de l’entreprise pour l’agent.',
      'Serveur d’e-mails (SMTP, Gmail, OVH…) : renseignez-le ici pour que les identifiants et réinitialisations de mot de passe partent par e-mail.',
    ],
  },
  {
    id: 'monitoring',
    icon: '📡',
    title: 'Suivi des présences',
    menu: 'Monitoring › Suivi temps réel',
    any: ['VIEW_MONITORING'],
    body: 'Voyez qui est présent grâce à l’agent installé sur les postes.',
    points: [
      'Suivi temps réel : qui est connecté et actif en ce moment.',
      'Rapports : les périodes d’inactivité à valider ou à refuser.',
      'Historique agent : les arrivées, départs et retards jour par jour.',
    ],
  },
];

const PROJECT_STEPS: TourStep[] = [
  {
    id: 'accueil',
    icon: '🏠',
    title: 'Votre accueil',
    menu: 'Accueil',
    body: 'Un résumé de votre activité : vos projets en cours, vos prochaines échéances et vos notifications.',
  },
  {
    id: 'projets',
    icon: '📁',
    title: 'Les projets',
    menu: 'Projets',
    any: ['MANAGE_ALL_PROJETS', 'VIEW_PROJETS_CREATE_TACHES'],
    body: 'Le cœur de l’application : un projet regroupe un client, une équipe et des tâches.',
    points: [
      'Créez un projet : choisissez le client, les dates, les chefs de projet et les membres.',
      'Ajoutez des tâches et assignez-les : une tâche ne peut démarrer que si quelqu’un en est responsable.',
      'Démarrez puis clôturez le projet. Si des tâches sont encore ouvertes, l’application vous les liste avant de vous laisser forcer la clôture.',
    ],
  },
  {
    id: 'mes-projets',
    icon: '✔️',
    title: 'Mes projets et mes tâches',
    menu: 'Mes projets',
    any: ['VIEW_MES_PROJETS'],
    body: 'Les projets dont vous faites partie et les tâches qui vous sont assignées.',
    points: [
      'Faites avancer chaque tâche : À faire, En cours, puis Terminée.',
      'Vous ne modifiez que vos propres tâches ; votre responsable voit votre avancement.',
    ],
  },
  {
    id: 'equipes',
    icon: '🤝',
    title: 'Les équipes',
    menu: 'Équipes',
    any: ['VIEW_EQUIPES'],
    body: 'Regroupez des collaborateurs en équipes pour les affecter plus vite aux projets.',
  },
  {
    id: 'clients',
    icon: '🏢',
    title: 'Les clients',
    menu: 'Clients',
    any: ['VIEW_CLIENTS', 'MANAGE_CLIENTS'],
    body: 'La fiche de chaque client et tout ce qui le concerne.',
    points: [
      'Ajoutez un client avec ses contacts et son logo.',
      'Vous pouvez lui créer un accès « portail client » : il valide lui-même ses publications.',
      'Un dossier Google Drive est préparé automatiquement pour ses fichiers.',
    ],
  },
  {
    id: 'media-plan',
    icon: '📱',
    title: 'Les média plans',
    menu: 'Social media › Media Plan',
    any: ['VIEW_MEDIA_PLAN'],
    body: 'Planifiez les publications des réseaux sociaux de chaque client.',
    points: [
      'Une ligne = une publication : date, heure, plateforme, format, visuel, texte.',
      'Étape 1 : un manager l’approuve en interne. Étape 2 : le client la valide sur son portail.',
      'Si le client demande des modifications (rectifs), ils s’affichent ici pour être traités.',
    ],
  },
  {
    id: 'tous-media-plans',
    icon: '🗂️',
    title: 'Tous les média plans',
    menu: 'Social media › Tous les Media Plan',
    any: ['VIEW_TOUS_MEDIA_PLAN'],
    body: 'La vue d’ensemble pour les responsables.',
    points: [
      'Approuvez ou refusez les publications préparées par l’équipe.',
      'Affectez les clients à vos collaborateurs.',
      'Une publication avec tournage prévient automatiquement le Head Prod pour planifier le shooting.',
    ],
  },
  {
    id: 'calendrier-projets',
    icon: '🎬',
    title: 'Calendrier des projets',
    menu: 'Calendrier › Deadlines, Réunions, Tournage',
    any: ['VIEW_CALENDRIER_PROJETS', 'VIEW_DEADLINES', 'VIEW_REUNIONS'],
    body: 'Trois vues pour organiser le temps de l’équipe.',
    points: [
      'Deadlines : les échéances des tâches et des projets.',
      'Réunions : planifiez et invitez vos collègues ou un client.',
      'Tournage : réservez les créneaux de shooting sans conflit.',
    ],
  },
  {
    id: 'dashboard-projets',
    icon: '📊',
    title: 'Dashboard des projets',
    menu: 'Rapports › Dashboard Projets',
    any: ['VIEW_TOUS_PROJETS'],
    body: 'L’état de santé de tous les projets : avancement, retards, alertes, charge par personne. Cliquez sur un projet pour voir le détail.',
  },
  {
    id: 'rapports',
    icon: '📈',
    title: 'Rapports et rectifs',
    menu: 'Rapports › Rapport Cycle de Vie / Rectifs',
    any: ['VIEW_PROJETS'],
    body: 'Analysez et améliorez la qualité du travail.',
    points: [
      'Rapport cycle de vie : la durée réelle de chaque projet et de ses étapes.',
      'Rectifs internes et externes : les corrections demandées par l’équipe ou par le client, et combien de fois elles reviennent.',
    ],
  },
];

const CLIENT_STEPS: TourStep[] = [
  {
    id: 'accueil',
    icon: '🏠',
    title: 'Votre espace client',
    menu: 'Accueil',
    body: 'Bienvenue sur votre portail. Vous y suivez le travail réalisé pour vous et vous validez vos publications.',
  },
  {
    id: 'client-media-plans',
    icon: '📱',
    title: 'Valider vos publications',
    menu: 'Mes Media Plans',
    any: ['MEDIA_PLANS'],
    body: 'Les publications préparées pour vous attendent votre accord.',
    points: [
      'Approuvez une publication, ou refusez-la.',
      'Besoin d’un changement ? Écrivez-le dans « Rectifs » : l’équipe est prévenue et vous renvoie une nouvelle version.',
      'Vous pouvez aussi tout approuver d’un coup.',
    ],
  },
  {
    id: 'client-projets',
    icon: '📁',
    title: 'Suivre vos projets',
    menu: 'Mes Projets',
    any: ['PROJETS'],
    body: 'L’avancement de chaque projet et de ses tâches, en temps réel.',
  },
  {
    id: 'client-fichiers',
    icon: '🗃️',
    title: 'Vos fichiers',
    menu: 'Mes Fichiers',
    any: ['FICHIERS'],
    body: 'Retrouvez les visuels et documents livrés, classés par mois, ou ouvrez directement votre dossier Drive.',
  },
];

const FINAL_CLIENT: TourStep = {
  id: 'fin',
  icon: '🚀',
  title: 'C’est tout !',
  body: 'Vous savez tout ce qu’il faut. Le bouton « ? » en bas à droite relance ce guide à tout moment.',
};

const hasAny = (owned: string[], wanted?: string[]) => !wanted || wanted.length === 0 || wanted.some((p) => owned.includes(p));

const roleSummary = (u: TourUser): string[] => {
  const p = u.permissions ?? [];
  const lines: string[] = [];
  if (p.some((x) => ['VIEW_ROLES', 'VIEW_COMPTES', 'VIEW_REFERENTIELS'].includes(x))) {
    lines.push('Vous administrez l’application : comptes, rôles et réglages.');
  }
  if (p.some((x) => ['VIEW_EMPLOYES', 'VIEW_DEMANDES', 'VIEW_DASHBOARD'].includes(x))) {
    lines.push('Vous gérez les ressources humaines : employés, congés et présences.');
  }
  if (p.some((x) => ['MANAGE_ALL_PROJETS', 'VIEW_PROJETS_CREATE_TACHES', 'VIEW_TOUS_PROJETS'].includes(x))) {
    lines.push('Vous pilotez des projets, des équipes et leurs tâches.');
  }
  if (p.some((x) => ['VIEW_MEDIA_PLAN', 'VIEW_TOUS_MEDIA_PLAN'].includes(x))) {
    lines.push('Vous travaillez sur les média plans des clients.');
  }
  if (lines.length === 0) lines.push('Vous disposez de votre espace personnel : vos demandes, vos tâches, votre calendrier.');
  return lines;
};

export const buildSteps = (user: TourUser, kind: AppKind): TourStep[] => {
  if (user.isClient) {
    const pages = user.clientPages ?? [];
    const allowed = pages.length > 0 ? pages : ['MEDIA_PLANS', 'PROJETS', 'FICHIERS'];
    const welcome: TourStep = {
      id: 'bienvenue',
      icon: '👋',
      title: user.nom ? `Bonjour ${user.nom} !` : 'Bonjour !',
      body: 'Ce petit guide de moins d’une minute vous montre à quoi sert chaque partie de votre portail.',
    };
    return [welcome, ...CLIENT_STEPS.filter((s) => hasAny(allowed, s.any)), FINAL_CLIENT];
  }

  const name = (user.prenom || user.nom || '').trim();
  const roles = (user.roles ?? []).filter(Boolean);
  const welcome: TourStep = {
    id: 'bienvenue',
    icon: '👋',
    title: name ? `Bienvenue ${name} !` : 'Bienvenue !',
    body:
      kind === 'rh'
        ? 'Voici l’application RH. Ce guide de moins d’une minute vous montre à quoi sert chaque partie, selon votre rôle.'
        : 'Voici l’application Projets. Ce guide de moins d’une minute vous montre à quoi sert chaque partie, selon votre rôle.',
    points: [...(roles.length ? [`Votre rôle : ${roles.join(', ')}`] : []), ...roleSummary(user)],
  };
  const owned = user.permissions ?? [];
  const catalog = kind === 'rh' ? RH_STEPS : PROJECT_STEPS;
  return [welcome, ...catalog.filter((s) => hasAny(owned, s.any)), kind === 'rh' ? FINAL_RH : FINAL_PROJECTS];
};
