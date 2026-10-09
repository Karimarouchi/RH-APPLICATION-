// Contenu du guide de premiere connexion (guide interactif sur la vraie interface).
//
// Chaque etape peut cibler un element reel du menu de gauche :
//   - { rail: 'Projets' }     bouton de la barre d'icones (libelle du bouton)
//   - { panel: 'Mes projets' } entree du panneau qui s'ouvre a droite de la barre
//   - { selector: '...' }     element libre
// `open` = bouton de la barre a ouvrir avant d'afficher l'etape (le panneau s'ouvre et la page correspondante s'affiche).
// `click` = clique sur le bouton cible (pour les boutons qui ouvrent directement une page).
//
// Les etapes affichees dependent des PERMISSIONS de la personne (pas du nom de son role) :
// un role cree plus tard par un administrateur obtient donc automatiquement le bon guide.

export type AppKind = 'rh' | 'projects';

export type Target = { rail: string } | { panel: string } | { selector: string };

export interface TourStep {
  id: string;
  icon: string;
  title: string;
  body: string;
  points?: string[];
  /** Montree seulement si la personne a AU MOINS UNE de ces permissions (vide = pour tout le monde) */
  any?: string[];
  /** Element reel a mettre en surbrillance. Sans cible : carte au centre de l'ecran. */
  target?: Target;
  /** Bouton de la barre a ouvrir avant l'etape (ouvre le panneau + la page) */
  open?: string;
  /** Clique sur la cible (bouton qui ouvre directement une page) */
  click?: boolean;
  /** Page a afficher avant l'etape (le guide « entre » dans la page) */
  go?: string;
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

// ---------------------------------------------------------------- etapes communes
const SHARED_END: TourStep[] = [
  {
    id: 'notifications',
    icon: '🔔',
    title: 'Les notifications',
    body: 'La cloche vous prévient dès que quelque chose change pour vous : demande approuvée ou refusée, tâche assignée, média plan à valider…',
    target: { rail: 'Notifications' },
  },
  {
    id: 'compte',
    icon: '👤',
    title: 'Votre compte',
    body: 'Cliquez sur vos initiales pour ouvrir votre profil, changer de thème (clair ou sombre), choisir la police et la taille du texte, ou vous déconnecter.',
    target: { selector: '.pc-avatar-btn' },
  },
  {
    id: 'bascule',
    icon: '🔀',
    title: 'Passer de Projets à RH',
    body: 'Ce bouton vous fait passer d’une application à l’autre sans vous reconnecter : Projets pour le travail avec les clients, RH pour vos congés et votre profil.',
    target: { selector: '[data-tour="app-switch"]' },
  },
  {
    id: 'aide',
    icon: '❓',
    title: 'Besoin d’aide plus tard ?',
    body: 'Ce bouton « ? » relance ce guide à tout moment.',
    target: { selector: '[data-tour="help"]' },
  },
];

const FINAL: TourStep = {
  id: 'fin',
  icon: '🚀',
  title: 'Vous êtes prêt !',
  body: 'Vous connaissez maintenant l’essentiel. Bon travail !',
};

// ---------------------------------------------------------------- application RH
const RH_STEPS: TourStep[] = [
  {
    id: 'accueil',
    icon: '🏠',
    title: 'Accueil',
    body: 'Votre page d’accueil : un résumé de votre situation.',
    points: ['Votre solde de congés', 'Vos dernières demandes et leur statut', 'Ce qui demande votre attention'],
    target: { rail: 'Accueil' },
    click: true,
  },
  // ---- Mon espace
  {
    id: 'mon-espace',
    icon: '🧑‍💼',
    title: 'Mon Espace',
    body: 'Tout ce qui vous concerne personnellement : vos demandes et votre calendrier. Cliquez sur « Suivant » : nous ouvrons cette section.',
    any: ['VIEW_MON_CALENDRIER', 'VIEW_MES_DEMANDES'],
    target: { rail: 'Mon Espace' },
  },
  {
    id: 'mes-demandes',
    icon: '📝',
    title: 'Mes demandes',
    body: 'Congé, autorisation d’absence ou télétravail : tout se demande ici, sans papier.',
    points: [
      'Choisissez le type et les dates ; l’application calcule vos jours et indique la date au plus tôt.',
      'Suivez le statut : En attente, puis Approuvée ou Refusée. Vous pouvez annuler tant que c’est en attente.',
      'Les demandes de papiers (attestation…) se trouvent dans le sous-menu.',
    ],
    any: ['VIEW_MES_DEMANDES'],
    open: 'Mon Espace',
    target: { panel: 'Mes demandes' },
  },
  {
    id: 'mon-calendrier',
    icon: '📅',
    title: 'Mon calendrier',
    body: 'Votre agenda personnel : vos congés, les jours fériés de l’entreprise et vos réunions au même endroit.',
    any: ['VIEW_MON_CALENDRIER'],
    open: 'Mon Espace',
    target: { panel: 'Mon calendrier' },
  },
  {
    id: 'agent',
    icon: '🖥️',
    title: 'L’agent de pointage',
    body: 'Un petit programme Windows enregistre vos heures d’arrivée et de départ. Vous l’installez depuis ce bouton.',
    points: [
      'Il vous demande parfois de confirmer que vous êtes présent : un clic suffit.',
      'Vos congés, jours fériés, télétravail et autorisations validés sont pris en compte : pas de retard compté à tort.',
    ],
    any: ['VIEW_MON_CALENDRIER', 'VIEW_MES_DEMANDES'],
    open: 'Mon Espace',
    target: { panel: 'Installer l\'Agent' },
  },
  // ---- Gestion RH
  {
    id: 'gestion-rh',
    icon: '👥',
    title: 'Gestion RH',
    body: 'Les outils des ressources humaines : employés, validations et chiffres clés. Cliquez sur « Suivant » pour entrer dans cette section.',
    any: ['VIEW_EMPLOYES', 'VIEW_VALIDATIONS', 'VIEW_DASHBOARD'],
    target: { rail: 'Gestion RH' },
  },
  {
    id: 'employes',
    icon: '🧾',
    title: 'Employés',
    body: 'La base de tous les collaborateurs.',
    points: [
      'Créez et modifiez les fiches : contrat, poste, département, documents, compétences.',
      'Le sous-menu contient la liste, l’organigramme (qui dépend de qui) et les archives (départs).',
      'Salaire, RIB et CIN ne sont visibles que par les personnes autorisées, comme vous.',
    ],
    any: ['VIEW_EMPLOYES'],
    open: 'Gestion RH',
    target: { panel: 'Employes' },
  },
  {
    id: 'validations',
    icon: '✅',
    title: 'Validation des demandes',
    body: 'Les demandes de congé et de papiers de votre équipe arrivent ici.',
    points: [
      'Ouvrez une demande, puis Approuvez ou Refusez (avec un commentaire si besoin).',
      'Le solde de congé est mis à jour à l’approbation et l’employé est prévenu.',
      'Vous ne pouvez pas valider vos propres demandes.',
    ],
    any: ['VIEW_VALIDATIONS', 'VIEW_DEMANDES'],
    open: 'Gestion RH',
    target: { panel: 'Validation demandes' },
  },
  {
    id: 'dashboard-rh',
    icon: '📊',
    title: 'Dashboard RH',
    body: 'Les chiffres clés en un coup d’œil : présences du jour, absences, demandes en attente, alertes.',
    any: ['VIEW_DASHBOARD'],
    open: 'Gestion RH',
    target: { panel: 'Dashboard RH' },
  },
  {
    id: 'departements',
    icon: '🏢',
    title: 'Départements',
    body: 'La répartition des employés par département, et les responsables de chacun.',
    any: ['VIEW_EMPLOYES'],
    open: 'Gestion RH',
    target: { panel: 'Departements' },
  },
  // ---- Administration
  {
    id: 'administration',
    icon: '🛠️',
    title: 'Administration',
    body: 'Les réglages de l’application : comptes, rôles, listes et calendrier. Cliquez sur « Suivant » pour entrer dans cette section.',
    any: ['VIEW_COMPTES', 'VIEW_ROLES', 'VIEW_REFERENTIELS', 'VIEW_CALENDRIER', 'VIEW_RESTRICTION_CONGE'],
    target: { rail: 'Administration' },
  },
  {
    id: 'comptes',
    icon: '🔑',
    title: 'Comptes',
    body: 'Un compte permet à un employé de se connecter.',
    points: [
      'Créez un compte pour un employé et choisissez son ou ses rôles.',
      'Un mot de passe provisoire est généré : la personne devra le changer à sa première connexion.',
      'Vous pouvez désactiver un compte à tout moment (départ, suspension).',
    ],
    any: ['VIEW_COMPTES'],
    open: 'Administration',
    target: { panel: 'Comptes' },
  },
  {
    id: 'roles',
    icon: '🛡️',
    title: 'Rôles',
    body: 'Un rôle est une liste de permissions : chaque personne ne voit que les pages que son rôle autorise.',
    points: [
      'Créez un rôle, cochez ce qu’il a le droit de faire, puis attribuez-le dans « Comptes ».',
      'Ce guide s’adapte tout seul : une personne qui reçoit un nouveau rôle ne voit que les explications des pages qu’elle peut utiliser.',
    ],
    any: ['VIEW_ROLES'],
    open: 'Administration',
    target: { panel: 'Roles' },
  },
  {
    id: 'referentiels',
    icon: '⚙️',
    title: 'Référentiels',
    body: 'Les listes et paramètres utilisés partout dans l’application.',
    points: [
      'Listes : départements, postes, types de contrat, formats de média plan…',
      'Paramètres système : horaires, règles de congés, réseau de l’entreprise pour l’agent.',
      'Serveur d’e-mails (SMTP) : renseignez-le ici pour envoyer identifiants et réinitialisations de mot de passe par e-mail.',
    ],
    any: ['VIEW_REFERENTIELS'],
    open: 'Administration',
    target: { panel: 'Referentiels' },
  },
  {
    id: 'calendrier-entreprise',
    icon: '🗓️',
    title: 'Calendrier entreprise',
    body: 'Les jours fériés et les horaires de l’entreprise. Un employé qui pointe un jour férié n’est jamais compté en retard.',
    any: ['VIEW_CALENDRIER'],
    open: 'Administration',
    target: { panel: 'Calendrier entreprise' },
  },
  {
    id: 'restrictions',
    icon: '⛔',
    title: 'Restrictions de congés',
    body: 'Bloquez des périodes où personne ne peut poser de congé (clôture, forte activité).',
    any: ['VIEW_RESTRICTION_CONGE'],
    open: 'Administration',
    target: { panel: 'Restrictions de congés' },
  },
  // ---- Monitoring
  {
    id: 'monitoring',
    icon: '📡',
    title: 'Monitoring',
    body: 'Voyez qui est présent grâce à l’agent installé sur les postes. Cliquez sur « Suivant » pour entrer dans cette section.',
    any: ['VIEW_MONITORING'],
    target: { rail: 'Monitoring' },
  },
  {
    id: 'temps-reel',
    icon: '🟢',
    title: 'Suivi temps réel',
    body: 'Qui est connecté et actif en ce moment, avec le dernier signe de vie de chaque poste.',
    any: ['VIEW_MONITORING'],
    open: 'Monitoring',
    target: { panel: 'Suivi temps reel' },
  },
  {
    id: 'rapports-inactivite',
    icon: '📑',
    title: 'Rapports',
    body: 'Les périodes d’inactivité détectées : à valider ou à refuser.',
    any: ['VIEW_MONITORING'],
    open: 'Monitoring',
    target: { panel: 'Rapports' },
  },
  {
    id: 'historique-agent',
    icon: '🕒',
    title: 'Historique agent',
    body: 'Les arrivées, départs et retards jour par jour, pour chaque employé.',
    any: ['VIEW_MONITORING'],
    open: 'Monitoring',
    target: { panel: 'Historique agent' },
  },
];

// ---------------------------------------------------------------- application Projets
const PROJECT_STEPS: TourStep[] = [
  {
    id: 'accueil',
    icon: '🏠',
    title: 'Accueil',
    body: 'Votre page d’accueil : vos projets en cours, vos prochaines échéances et vos notifications.',
    target: { rail: 'Accueil' },
    click: true,
  },
  // ---- Projets
  {
    id: 'projets',
    icon: '📁',
    title: 'Projets',
    body: 'Le cœur de l’application : un projet regroupe un client, une équipe et des tâches. Cliquez sur « Suivant » : nous entrons dans cette section.',
    any: ['VIEW_PROJETS', 'VIEW_MES_PROJETS'],
    target: { rail: 'Projets' },
  },
  {
    id: 'projets-liste',
    icon: '🗂️',
    title: 'Projets',
    body: 'Tous les projets, regroupés par client.',
    points: [
      'Créez un projet : client, dates, chefs de projet et membres.',
      'Ajoutez des tâches et assignez-les : une tâche ne démarre que si quelqu’un en est responsable.',
      'Démarrez puis clôturez le projet. Si des tâches sont ouvertes, l’application vous les liste avant de vous laisser forcer la clôture.',
    ],
    any: ['MANAGE_ALL_PROJETS', 'VIEW_PROJETS_CREATE_TACHES'],
    open: 'Projets',
    target: { panel: 'Projets' },
  },
  {
    id: 'mes-projets',
    icon: '✔️',
    title: 'Mes projets',
    body: 'Vos projets et vos tâches.',
    points: [
      'Faites avancer chaque tâche : À faire, En cours, puis Terminée.',
      'Vous ne modifiez que vos propres tâches ; votre responsable voit votre avancement.',
    ],
    any: ['VIEW_MES_PROJETS'],
    open: 'Projets',
    target: { panel: 'Mes projets' },
  },
  // ---- Calendrier
  {
    id: 'calendrier',
    icon: '📅',
    title: 'Calendrier',
    body: 'Organisez le temps de l’équipe. Cliquez sur « Suivant » : nous ouvrons cette section.',
    any: ['VIEW_CALENDRIER_PROJETS', 'VIEW_DEADLINES', 'VIEW_REUNIONS'],
    target: { rail: 'Calendrier' },
  },
  {
    id: 'calendrier-projets',
    icon: '🗓️',
    title: 'Calendrier Projets',
    body: 'Trois vues dans un seul calendrier : les échéances, les réunions et les tournages.',
    any: ['VIEW_CALENDRIER_PROJETS', 'VIEW_DEADLINES', 'VIEW_REUNIONS'],
    open: 'Calendrier',
    target: { panel: 'Calendrier Projets' },
  },
  {
    id: 'deadlines',
    icon: '⏰',
    title: 'Deadlines',
    body: 'Les échéances des tâches et des projets, pour ne rien laisser passer.',
    any: ['VIEW_DEADLINES', 'VIEW_CALENDRIER_PROJETS'],
    open: 'Calendrier',
    target: { panel: 'Deadlines' },
  },
  {
    id: 'reunions',
    icon: '🤝',
    title: 'Réunions',
    body: 'Planifiez une réunion et invitez vos collègues ou un client ; chacun peut accepter ou refuser.',
    any: ['VIEW_REUNIONS', 'VIEW_CALENDRIER_PROJETS'],
    open: 'Calendrier',
    target: { panel: 'Réunions' },
  },
  {
    id: 'tournage',
    icon: '🎬',
    title: 'Tournage',
    body: 'Réservez les créneaux de shooting sans conflit entre les équipes.',
    any: ['VIEW_CALENDRIER_PROJETS'],
    open: 'Calendrier',
    target: { panel: 'Tournage' },
  },
  // ---- Media plan
  {
    id: 'media-plan-rail',
    icon: '📱',
    title: 'Media Plan',
    body: 'La planification des publications sur les réseaux sociaux. Cliquez sur « Suivant » : nous entrons dans cette section.',
    any: ['VIEW_MEDIA_PLAN'],
    target: { rail: 'Media Plan' },
  },
  {
    id: 'media-plan',
    icon: '🗒️',
    title: 'Media Plan',
    body: 'Planifiez les publications de chaque client.',
    points: [
      'Une ligne = une publication : date, heure, plateforme, format, visuel, texte.',
      'Étape 1 : un manager l’approuve en interne. Étape 2 : le client la valide sur son portail.',
      'Si le client demande des modifications (rectifs), elles s’affichent ici.',
    ],
    any: ['VIEW_MEDIA_PLAN'],
    open: 'Media Plan',
    target: { panel: 'Media Plan' },
  },
  {
    id: 'tous-media-plans',
    icon: '🗂️',
    title: 'Tous les Media Plan',
    body: 'La vue d’ensemble des responsables.',
    points: [
      'Approuvez ou refusez les publications préparées par l’équipe.',
      'Affectez les clients à vos collaborateurs.',
      'Une publication avec tournage prévient automatiquement le Head Prod.',
    ],
    any: ['VIEW_TOUS_MEDIA_PLAN'],
    open: 'Media Plan',
    target: { panel: 'Tous les Media Plan' },
  },
  // ---- Rapports
  {
    id: 'rapports',
    icon: '📈',
    title: 'Rapports',
    body: 'Analysez et améliorez la qualité du travail. Cliquez sur « Suivant » : nous ouvrons cette section.',
    any: ['VIEW_PROJETS'],
    target: { rail: 'Rapports' },
  },
  {
    id: 'dashboard-projets',
    icon: '📊',
    title: 'Dashboard Projets',
    body: 'L’état de santé de tous les projets : avancement, retards, alertes, charge par personne. Cliquez sur un projet pour voir son détail.',
    any: ['VIEW_TOUS_PROJETS'],
    open: 'Rapports',
    target: { panel: 'Dashboard Projets' },
  },
  {
    id: 'rapport-cycle',
    icon: '⏱️',
    title: 'Rapport Cycle de Vie',
    body: 'La durée réelle de chaque projet et de ses étapes, du démarrage à la clôture.',
    any: ['VIEW_PROJETS'],
    open: 'Rapports',
    target: { panel: 'Rapport Cycle de Vie' },
  },
  {
    id: 'rectifs',
    icon: '✏️',
    title: 'Rectifs',
    body: 'Les corrections demandées par l’équipe (internes) ou par le client (externes), et combien de fois elles reviennent.',
    any: ['VIEW_PROJETS'],
    open: 'Rapports',
    target: { panel: 'Rectifs' },
  },
  // ---- Clients
  {
    id: 'clients',
    icon: '🏢',
    title: 'Clients',
    body: 'La fiche de chaque client et tout ce qui le concerne.',
    points: [
      'Ajoutez un client avec ses contacts et son logo.',
      'Créez-lui un accès « portail client » : il valide lui-même ses publications.',
      'Un dossier Google Drive est préparé automatiquement pour ses fichiers.',
    ],
    any: ['VIEW_CLIENTS', 'MANAGE_CLIENTS'],
    target: { rail: 'Clients' },
    click: true,
  },
];

// ---------------------------------------------------------------- portail client (barre du haut, sans menu de gauche)
const CLIENT_STEPS: TourStep[] = [
  {
    id: 'client-logo',
    icon: '🏠',
    title: 'Votre espace client',
    body: 'Ce logo vous ramène à tout moment à l’accueil de votre portail.',
    target: { selector: '[data-tour="client-home"]' },
    go: '/client/accueil',
  },
  {
    id: 'carte-media-plans',
    icon: '📱',
    title: 'Media Plans',
    body: 'Vos publications sur les réseaux sociaux. Cliquez sur « Suivant » : nous ouvrons cette page.',
    any: ['MEDIA_PLANS'],
    target: { selector: '[data-tour="client-card-media-plans"]' },
    go: '/client/accueil',
  },
  {
    id: 'page-media-plans',
    icon: '📱',
    title: 'Valider vos publications',
    body: 'Les publications préparées pour vous attendent votre accord.',
    points: [
      'Approuvez une publication, ou refusez-la.',
      'Besoin d’un changement ? Écrivez-le dans « Rectifs » : l’équipe est prévenue et vous renvoie une nouvelle version.',
      'Vous pouvez aussi tout approuver d’un coup.',
    ],
    any: ['MEDIA_PLANS'],
    go: '/client/media-plans',
  },
  {
    id: 'carte-projets',
    icon: '📁',
    title: 'Projets',
    body: 'L’avancement de vos projets. Cliquez sur « Suivant » : nous ouvrons cette page.',
    any: ['PROJETS'],
    target: { selector: '[data-tour="client-card-projets"]' },
    go: '/client/accueil',
  },
  {
    id: 'page-projets',
    icon: '📁',
    title: 'Suivre vos projets',
    body: 'Chaque projet avec son avancement et ses tâches, en temps réel : vous savez toujours où en est le travail.',
    any: ['PROJETS'],
    go: '/client/projets',
  },
  {
    id: 'carte-fichiers',
    icon: '🗃️',
    title: 'Fichiers',
    body: 'Les visuels et documents qui vous sont livrés. Cliquez sur « Suivant » : nous ouvrons cette page.',
    any: ['FICHIERS'],
    target: { selector: '[data-tour="client-card-fichiers"]' },
    go: '/client/accueil',
  },
  {
    id: 'page-fichiers',
    icon: '🗃️',
    title: 'Vos fichiers',
    body: 'Retrouvez les visuels et documents livrés, classés par mois, ou ouvrez directement votre dossier Drive.',
    any: ['FICHIERS'],
    go: '/client/fichiers',
  },
  {
    id: 'client-compte',
    icon: '👤',
    title: 'Votre compte',
    body: 'Votre nom ouvre le menu du compte : c’est ici que vous vous déconnectez.',
    target: { selector: '[data-tour="client-account"]' },
    go: '/client/accueil',
  },
  {
    id: 'client-theme',
    icon: '🌙',
    title: 'Thème clair ou sombre',
    body: 'Changez l’apparence du portail selon votre confort.',
    target: { selector: '[aria-label="Changer le thème"]' },
  },
  {
    id: 'aide',
    icon: '❓',
    title: 'Besoin d’aide plus tard ?',
    body: 'Ce bouton « ? » relance ce guide à tout moment.',
    target: { selector: '[data-tour="help"]' },
  },
];

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
      body: 'Bienvenue sur votre portail. Ce guide de moins d’une minute vous montre à quoi sert chaque partie.',
    };
    return [
      welcome,
      ...CLIENT_STEPS.filter((s) => hasAny(allowed, s.any)),
      { ...FINAL, body: 'Vous savez tout ce qu’il faut. Le bouton « ? » relance ce guide à tout moment.' },
    ];
  }

  const name = (user.prenom || user.nom || '').trim();
  const roles = (user.roles ?? []).filter(Boolean);
  const welcome: TourStep = {
    id: 'bienvenue',
    icon: '👋',
    title: name ? `Bienvenue ${name} !` : 'Bienvenue !',
    body:
      kind === 'rh'
        ? 'Voici l’application RH. Ce guide de moins d’une minute vous montre, dans le menu de gauche, à quoi sert chaque partie selon votre rôle.'
        : 'Voici l’application Projets. Ce guide de moins d’une minute vous montre, dans le menu de gauche, à quoi sert chaque partie selon votre rôle.',
    points: [...(roles.length ? [`Votre rôle : ${roles.join(', ')}`] : []), ...roleSummary(user)],
  };
  const owned = user.permissions ?? [];
  const catalog = kind === 'rh' ? RH_STEPS : PROJECT_STEPS;
  return [welcome, ...catalog.filter((s) => hasAny(owned, s.any)), ...SHARED_END, FINAL];
};
