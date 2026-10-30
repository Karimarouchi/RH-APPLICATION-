import { NotificationResponse } from '../types';

type NotificationTarget = { kind: 'rh' | 'projects'; path: string };

const normalizeText = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const CRUD_ACTIONS = [
  'ajout',
  'ajoute',
  'ajouter',
  'creation',
  'cree',
  'creee',
  'nouveau',
  'nouvel',
  'modif',
  'modifier',
  'modifie',
  'mise a jour',
  'mis a jour',
  'supprime',
  'supprimer',
  'suppression',
  'retire',
  'retirer',
  'reaffecte',
  'reaffecter',
];

const CRUD_ENTITIES = [
  'employe',
  'subordonne',
  'profil',
  'competence',
  'document',
  'photo',
  'compte',
  'client',
];

const USEFUL_KEYWORDS = [
  'demande',
  'conge',
  'validation',
  'reunion',
  'calendrier',
  'planification',
  'contrat',
  'civp',
  'solde',
];

// Media plan / shooting notifications belong to the projects app, even though
// their text mentions "validation" or "refus" like RH requests do.
const getMediaPlanTarget = (notif: NotificationResponse, text: string): NotificationTarget | null => {
  const titre = (notif.titre || '').toUpperCase();

  if (titre.startsWith('SHOOTING')) return { kind: 'projects', path: '/admin/calendrier-projets' };
  // Refusals / client rectifs go back to the employee who wrote the line
  if (titre === 'MEDIA_PLAN_REFUS' || titre === 'MEDIA_PLAN_RECTIF') return { kind: 'projects', path: '/media-plan' };
  // MEDIA_PLAN is sent to validators: lines waiting for their decision
  if (titre === 'MEDIA_PLAN') return { kind: 'projects', path: '/admin/media-plans' };

  if (text.includes('shooting')) return { kind: 'projects', path: '/admin/calendrier-projets' };
  if (text.includes('media plan') || text.includes('mediaplan')) {
    return { kind: 'projects', path: text.includes('pour validation') ? '/admin/media-plans' : '/media-plan' };
  }

  return null;
};

const isCrudNotificationText = (text: string) => {
  const hasEntity = CRUD_ENTITIES.some((entity) => text.includes(entity));
  const hasAction = CRUD_ACTIONS.some((action) => text.includes(action));

  if (hasEntity && hasAction) return true;

  if (text.includes('employe') && hasAction) return true;
  if (text.includes('employe') && text.includes('nouvel')) return true;
  if (text.includes('employe') && text.includes('nouveau')) return true;
  if (text.includes('employe') && text.includes('modif')) return true;
  if (text.includes('employe') && text.includes('mise a jour')) return true;
  if (text.includes('employe') && text.includes('mis a jour')) return true;
  if (text.includes('employe') && text.includes('ajout')) return true;
  if (text.includes('employe') && text.includes('supprime')) return true;

  return false;
};

export const shouldDisplayNotification = (notif: NotificationResponse) => {
  const text = normalizeText(`${notif.titre || ''} ${notif.message || ''}`);
  if (getMediaPlanTarget(notif, text)) return true;
  if (isCrudNotificationText(text)) return false;
  if (notif.demandeId || notif.reunionId) return true;
  return USEFUL_KEYWORDS.some((keyword) => text.includes(keyword));
};

export const getNotificationTarget = (notif: NotificationResponse): NotificationTarget => {
  const text = normalizeText(`${notif.titre || ''} ${notif.message || ''}`);

  const mediaPlanTarget = getMediaPlanTarget(notif, text);
  if (mediaPlanTarget) return mediaPlanTarget;

  const isReunion =
    Boolean(notif.reunionId) ||
    text.includes('reunion') ||
    text.includes('calendrier') ||
    text.includes('planification');

  if (isReunion) {
    return {
      kind: 'projects',
      path: notif.reunionId ? '/admin/calendrier-projets?tab=reunions' : '/admin/calendrier-projets',
    };
  }

  const isDemande =
    Boolean(notif.demandeId) ||
    text.includes('demande') ||
    text.includes('conge');

  const isValidation =
    text.includes('validation') ||
    text.includes('a valider') ||
    text.includes('en attente') ||
    text.includes('approuv') ||
    text.includes('refus');

  if (isDemande && isValidation) return { kind: 'rh', path: '/validations' };
  if (isDemande) return { kind: 'rh', path: '/mes-demandes' };
  if (isValidation) return { kind: 'rh', path: '/validations' };

  if (text.includes('contrat') || text.includes('civp') || text.includes('solde')) {
    return { kind: 'rh', path: '/employes' };
  }

  return { kind: 'projects', path: '/accueil' };
};
