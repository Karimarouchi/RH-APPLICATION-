// =====================
// ENUMS
// =====================
export enum StatutDemande {
  EN_ATTENTE = 'EN_ATTENTE',
  APPROUVEE = 'APPROUVEE',
  REFUSEE = 'REFUSEE',
  ANNULEE = 'ANNULEE',
}

export enum TypeDemande {
  CONGE = 'CONGE',
  AUTORISATION = 'AUTORISATION',
  TELETRAVAIL = 'TELETRAVAIL',
  ADMINISTRATION = 'ADMINISTRATION',
}

export enum TypeConge {
  CONGE_PAYE = 'CONGE_PAYE',
  CONGE_MALADIE = 'CONGE_MALADIE',
  CONGE_MATERNITE = 'CONGE_MATERNITE',
  CONGE_PATERNITE = 'CONGE_PATERNITE',
  CONGE_SANS_SOLDE = 'CONGE_SANS_SOLDE',
  CONGE_EXCEPTIONNEL = 'CONGE_EXCEPTIONNEL',
  CONGE_FORMATION = 'CONGE_FORMATION',
  CONGE_RECUPERATION = 'CONGE_RECUPERATION',
  CONGE_ADMINISTRATIF = 'CONGE_ADMINISTRATIF',
  CONGE_REGLES = 'CONGE_REGLES',
  CONGE_DECES_PROCHE = 'CONGE_DECES_PROCHE',
  CONGE_DECES_FAMILLE = 'CONGE_DECES_FAMILLE',
}

export const TypeCongeLabels: Record<TypeConge, string> = {
  [TypeConge.CONGE_PAYE]: 'Congé payé',
  [TypeConge.CONGE_MALADIE]: 'Congé maladie',
  [TypeConge.CONGE_MATERNITE]: 'Congé maternité',
  [TypeConge.CONGE_PATERNITE]: 'Congé paternité',
  [TypeConge.CONGE_SANS_SOLDE]: 'Congé sans solde',
  [TypeConge.CONGE_EXCEPTIONNEL]: 'Congé exceptionnel',
  [TypeConge.CONGE_FORMATION]: 'Congé formation',
  [TypeConge.CONGE_RECUPERATION]: 'Congé récupération',
  [TypeConge.CONGE_ADMINISTRATIF]: 'Congé administratif',
  [TypeConge.CONGE_REGLES]: 'Congé règles',
  [TypeConge.CONGE_DECES_PROCHE]: 'Congé décès (proche)',
  [TypeConge.CONGE_DECES_FAMILLE]: 'Congé décès (famille)',
};

export const StatutDemandeLabels: Record<StatutDemande, string> = {
  [StatutDemande.EN_ATTENTE]: 'En attente',
  [StatutDemande.APPROUVEE]: 'Approuvée',
  [StatutDemande.REFUSEE]: 'Refusée',
  [StatutDemande.ANNULEE]: 'Annulée',
};

export enum DecisionValidation {
  EN_ATTENTE = 'EN_ATTENTE',
  APPROUVEE = 'APPROUVEE',
  REFUSEE = 'REFUSEE',
}

export enum StatutProjet {
  PLANIFIE = 'PLANIFIE',
  EN_COURS = 'EN_COURS',
  CLOTURE = 'CLOTURE',
  CLOTURE_INCOMPLET = 'CLOTURE_INCOMPLET',
  ANNULE = 'ANNULE',
}

export enum StatutTache {
  TODO = 'TODO',
  IN_PROGRESS = 'IN_PROGRESS',
  DONE = 'DONE',
}

export enum TypeJour {
  OUVRABLE = 'OUVRABLE',
  FERIE = 'FERIE',
  CONGE_PAYE = 'CONGE_PAYE',
  CONGE_NON_PAYE = 'CONGE_NON_PAYE',
  TELETRAVAIL = 'TELETRAVAIL',
}

export enum OrigineJour {
  NATIONAL = 'NATIONAL',
  INTERNATIONAL = 'INTERNATIONAL',
}

// =====================
// INTERFACES
// =====================
export interface Employe {
  id: number;
  matricule: string;
  cin: string;
  cnss: string;
  nom: string;
  prenom: string;
  email: string;
  telephone: string;
  telephonePro: string;
  salaire: number | null;
  dateEmbauche: string;
  soldeConge: number;
  soldeCongeInitial: number | null;
  poste: string;
  typeContrat: string;
  dateFinContrat: string | null;
  genre: string;
  departement: string;
  managerDepartement?: boolean;
  ribBancaire: string;
  managerId: number | null;
  managerNom: string | null;
  imageUrl: string | null;
  lienDrive: string | null;
  archived?: boolean;
  archivedAt?: string | null;
}

export interface PermissionDTO {
  id: number;
  permission: string;
  label: string;
}

export interface RoleDTO {
  id: number;
  nom: string;
  accesTotal?: boolean;
  permissions: PermissionDTO[];
}

export interface RoleRequest {
  nom: string;
  permissionIds: number[];
  accesTotal?: boolean;
}

export interface CompteDTO {
  id: number;
  username: string;
  enabled: boolean;
  mustChangePassword: boolean;
  lastLogin: string | null;
  createdAt: string | null;
  employeId: number;
  employeNom: string;
  employePrenom: string;
  employeEmail: string;
  employePoste: string;
  roles: RoleDTO[];
  permissionsAjouteesIds?: number[];
  permissionsRetireesIds?: number[];
  permissionsEffectives?: string[];
  generatedPassword?: string;
}

export interface CompteRequest {
  employeId: number;
  roleIds: number[];
  permissionIdsAjoutees?: number[];
  permissionIdsRetirees?: number[];
}

export interface AccessLogDTO {
  id: number;
  compteId: number;
  username: string;
  dateAcces: string;
  adresseIp: string;
  action: string;
}

export interface ChangePasswordRequest {
  oldPassword: string;
  newPassword: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}

export interface Compte {
  id: number;
  username: string;
  enabled: boolean;
  employeId: number;
  roles: string[];
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  compteId: number;
  employeId: number;
  username: string;
  nom: string;
  prenom: string;
  email: string;
  roles: string[];
  permissions: string[];
  superAdmin?: boolean;
  departement?: string | null;
  managerDepartement?: boolean;
  mustChangePassword: boolean;
  genre: string | null;
  message: string;
  imageUrl: string | null;
  token?: string;
  tokenExpiresAt?: string;
  /** Guides de premiere connexion deja vus ("rh", "projets") */
  toursVus?: string[];
  /** Present when a client account (not an employee) is logged in */
  isClient?: boolean;
  /** ID of the logged-in client (only present when isClient === true) */
  clientId?: number;
  /** Page keys accessible to this client: ['MEDIA_PLANS','PROJETS','FICHIERS'] */
  clientPages?: string[];
}

export interface DemandeRequest {
  type: TypeDemande;
  raison: string;
  employeId: number;
  typeConge?: string;
  dateDebut?: string;
  dateFin?: string;
  date?: string;
  heureDebut?: string;
  heureFin?: string;
  /** Chef de département : l'employé qui validera à sa place pendant ce congé. */
  delegueId?: number;
}

export interface DemandeResponse {
  id: number;
  type: TypeDemande;
  dateCreation: string;
  statut: StatutDemande;
  raison: string;
  motifRefus?: string;
  employeId: number;
  employeNom: string;
  /** Chef de département qui valide en premier (absent si la demande va directement au RH). */
  chefValidateurId?: number;
  chefValidateurNom?: string;
  /** Décision du chef : EN_ATTENTE, APPROUVEE (transmise au RH) ou REFUSEE. */
  decisionChef?: 'EN_ATTENTE' | 'APPROUVEE' | 'REFUSEE';
  /** Le chef attendu est en congé aujourd'hui : le RH peut décider à sa place. */
  chefEnConge?: boolean;
  /** La demande est chez un intérimaire : nom du chef de département qu'il remplace. */
  interimDe?: string;
  /** Congé d'un chef de département : son intérimaire et le retour signalé. */
  delegueId?: number;
  delegueNom?: string;
  retourSignale?: boolean;
  typeConge?: string;
  typeCongeLabel?: string;
  nombreJours?: number;
  joursOuvrables?: number;
  dateDebut?: string;
  dateFin?: string;
  justificatifPath?: string;
  date?: string;
  heureDebut?: string;
  heureFin?: string;
  dureeMinutes?: number;
}

export interface Validation {
  id: number;
  ordre: number;
  decision: DecisionValidation;
  dateValidation: string | null;
  commentaire: string | null;
  demandeId: number;
  validateurId: number;
}

export interface ValidationRequest {
  demandeId: number;
  validateurId: number;
  ordre: number;
  decision: DecisionValidation;
  commentaire: string;
}

export interface Projet {
  id: number;
  nom: string;
  statut: StatutProjet;
  dateDebut: string;
  dateFin: string | null;
  /** 'DETERMINE' | 'INDETERMINE' */
  typeProjet?: string;
  description?: string;
  isMediaPlanProject?: boolean;
  mediaPlanLigneId?: number;
  chefDeProjet?: Employe | null;
  /** All chefs de projet (managers) */
  chefsDeProjet?: Employe[];
  createurId?: number;
  createurNom?: string;
  equipeId?: number | null;
  equipeIds?: number[];
  equipeNoms?: string[];
  membres?: Employe[];
  clientId?: number | null;
  clientNom?: string | null;
}

export interface Equipe {
  id: number;
  nom: string;
  projetId: number;
  membres: Employe[];
}

export interface EquipeCreateRequest {
  nom: string;
  projetId: number | null;
  memberIds: number[];
}

export interface Tache {
  id: number;
  titre: string;
  statut: StatutTache;
  dateEcheance: string;
  projetId: number;
  assigneeId: number | null;
  urgente?: boolean;
  archived?: boolean;
  description?: string;
}

export interface TacheMembreInfo {
  id: number;
  nom: string;
  prenom: string;
  telephone: string;
  telephonePro?: string;
  departement: string;
  email?: string;
  managerNom?: string;
  poste?: string;
  isChef?: boolean;
}

export interface TacheEquipeInfo {
  id: number;
  nom: string;
  membres: TacheMembreInfo[];
}

export interface TacheDetail {
  id: number;
  titre: string;
  statut: StatutTache;
  dateEcheance: string | null;
  projetId: number | null;
  projetNom: string | null;
  projetDateFin: string | null;
  projetStatut: string | null;
  chefDeProjetNom: string | null;
  chefDeProjetId: number | null;
  chefsDeProjetIds?: number[];
  assigneeId: number | null;
  urgente?: boolean;
  membresProjet?: TacheMembreInfo[];
}

export interface ApiResponse<T> {
  success: boolean;
  message: string | null;
  data: T;
}

// =====================
// REFERENTIELS
// =====================
export enum TypeReferentiel {
  DEPARTEMENT = 'DEPARTEMENT',
  TYPE_CONTRAT = 'TYPE_CONTRAT',
  SITE_ETABLISSEMENT = 'SITE_ETABLISSEMENT',
  POSTE = 'POSTE',
  NIVEAU_HIERARCHIQUE = 'NIVEAU_HIERARCHIQUE',
  TYPE_CONGE = 'TYPE_CONGE',
  TYPE_DEMANDE = 'TYPE_DEMANDE',
  GENRE = 'GENRE',
  PARAMETRE_SYSTEME = 'PARAMETRE_SYSTEME',
  FORMAT_MEDIA_PLAN = 'FORMAT_MEDIA_PLAN',
  TYPE_MEDIA_PLAN = 'TYPE_MEDIA_PLAN',
  PLATFORME_MEDIA_PLAN = 'PLATFORME_MEDIA_PLAN',
}

export const TypeReferentielLabels: Record<TypeReferentiel, string> = {
  [TypeReferentiel.DEPARTEMENT]: 'Département',
  [TypeReferentiel.TYPE_CONTRAT]: 'Type contrat',
  [TypeReferentiel.SITE_ETABLISSEMENT]: 'Site / Établissement',
  [TypeReferentiel.POSTE]: 'Poste',
  [TypeReferentiel.NIVEAU_HIERARCHIQUE]: 'Niveau hiérarchique',
  [TypeReferentiel.TYPE_CONGE]: 'Type congé',
  [TypeReferentiel.TYPE_DEMANDE]: 'Type demande',
  [TypeReferentiel.GENRE]: 'Genre',
  [TypeReferentiel.PARAMETRE_SYSTEME]: 'Paramètre système',
  [TypeReferentiel.FORMAT_MEDIA_PLAN]: 'Format Media Plan',
  [TypeReferentiel.TYPE_MEDIA_PLAN]: 'Type Media Plan',
  [TypeReferentiel.PLATFORME_MEDIA_PLAN]: 'Platforme Media Plan',
};

export interface Referentiel {
  id: number;
  libelle: string;
  description: string;
  actif: boolean;
  typeReferentiel: string;
  typeReferentielLabel: string;
  valeur?: string;
}

export interface ReferentielRequest {
  libelle: string;
  description: string;
  typeReferentiel: string;
  valeur?: string;
}

// =====================
// CALENDRIER
// =====================
export interface CalendrierJour {
  id: number;
  dateJour: string;
  nomJour: string;
  typeJour: TypeJour;
  origine: OrigineJour | null;
  description: string | null;
  estPaye: boolean;
}

export interface CalendrierRequest {
  dateJour: string;
  nomJour: string;
  typeJour: TypeJour;
  origine: OrigineJour | null;
  description: string;
  estPaye: boolean;
}

export interface HoraireTravail {
  id: number;
  nom: string;
  heureDebut: string;
  heureFin: string;
  pauseDebutMidi: string | null;
  pauseFinMidi: string | null;
  joursTravail: string;
  joursTeletravail: string | null;
  dateDebut: string | null;
  dateFin: string | null;
}

export interface EmployeHoraire {
  heureDebut: string;
  heureFin: string;
  joursTravail: string;
  maxAutorisationMinutes: string;
}

export interface HoraireTravailRequest {
  nom: string;
  heureDebut: string;
  heureFin: string;
  pauseDebutMidi: string | null;
  pauseFinMidi: string | null;
  joursTravail: string;
  joursTeletravail: string | null;
  dateDebut: string | null;
  dateFin: string | null;
}

export interface SidebarItem {
  label: string;
  icon: React.ReactNode;
  path: string;
  children?: SidebarItem[];
}

export interface HistoriqueStatut {
  id: number;
  ancienStatut: string;
  nouveauStatut: string;
  dateChangement: string;
  modifieParNom: string | null;
  commentaire: string | null;
}

export interface NotificationResponse {
  id: number;
  titre: string;
  message: string;
  lu: boolean;
  dateCreation: string;
  demandeId: number | null;
  reunionId: number | null;
}

export interface CalculateDaysResult {
  nombreJours: number;
  joursOuvrables: number;
  details: string;
  dateDebutEffective: string;
  dateFinEffective: string;
}

export interface SoldeCongeInfo {
  employeId: number;
  employeNom: string;
  dateEmbauche: string | null;
  ancienneteAnnees: number;
  ancienneteMois: number;
  droitAnnuel: number;
  tauxMensuel: number;
  joursAcquis: number;
  moisTravaillesAnneeEnCours: number;
  joursReportes: number;
  joursConsommes: number;
  joursEnAttente: number;
  soldeDisponible: number;
  soldePrevisionnel: number;
  debutAnneeConge: string;
  finAnneeConge: string;
}

// =====================
// COMPÉTENCES
// =====================
export interface CompetenceDTO {
  id: number;
  nom: string;
  categorie: string;
  niveau: number;
  employeId: number;
  employeNom: string;
}

// =====================
// DOCUMENTS EMPLOYÉ
// =====================
export interface DocumentEmployeDTO {
  id: number;
  nom: string;
  type: string;
  fichierUrl: string | null;
  dateExpiration: string | null;
  employeId: number;
  employeNom: string;
}

// =====================
// STATISTIQUES RH
// =====================
export interface EmployeStatsDTO {
  totalEmployes: number;
  employesActifs: number;
  nouveauxCeMois: number;
  masseSalariale: number;
  moyenneSalaire: number;
  moyenneAnciennete: number;
  parDepartement: Record<string, number>;
  parTypeContrat: Record<string, number>;
  parGenre: Record<string, number>;
  parPoste: Record<string, number>;
  embaucheParMois: Record<string, number>;
}

// =====================
// ORGANIGRAMME
// =====================
export interface OrgNode {
  id: number;
  nom: string;
  matricule: string;
  poste: string | null;
  departement: string | null;
  imageUrl: string | null;
  email: string;
  children: OrgNode[];
}

// =====================
// MONITORING - DASHBOARD TEMPS RÉEL
// =====================
export interface DashboardEmployeStatus {
  employeId: number;
  nom: string;
  prenom: string;
  poste: string;
  departement: string;
  imageUrl: string | null;
  statut: string;
  heureEntree: string | null;
  heureSortie: string | null;
  retardMinutes: number;
  scoreJournalier: number;
  agentActif: boolean;
  ssidConnecte: string | null;
  surReseauEntreprise: boolean;
  tempsActifMinutes: number;
  tempsInactifMinutes: number;
}

// =====================
// MONITORING - RAPPORTS INACTIVITÉ
// =====================
export interface RapportInactivite {
  id: number;
  employeId: number;
  employeNom: string;
  employePrenom: string;
  employeMatricule: string;
  semaineDebut: string;
  semaineFin: string;
  totalInactiviteMinutes: number;
  toleranceMinutes: number;
  inactiviteExcedentaire: number;
  retardCumule: number;
  montantDeduction: number;
  decision: string;
  decideParNom: string | null;
  commentaire: string | null;
  dateDecision: string | null;
  dateGeneration: string | null;
}

// =====================
// MONITORING - HISTORIQUE AGENT
// =====================
export interface JourDetail {
  date: string;
  statut: string;
  heureEntree: string | null;
  heureSortie: string | null;
  retardMinutes: number;
  tempsActifMinutes: number;
  tempsInactifMinutes: number;
  ssid: string | null;
  surReseauEntreprise: boolean;
  teletravail: boolean | null;
}

export interface HistoriqueEmploye {
  employeId: number;
  nom: string;
  prenom: string;
  poste: string;
  departement: string;
  imageUrl: string | null;
  jours: JourDetail[];
}

// =====================
// MEDIA PLAN
// =====================
export enum StatutMediaPlan {
  EN_ATTENTE = 'EN_ATTENTE',
  APPROUVE = 'APPROUVE',
  DESAPPROUVE = 'DESAPPROUVE',
}

export enum EtatPublication {
  SM = 'SM',
  PUBLIEE = 'PUBLIEE',
  EN_COURS = 'EN_COURS',
  PAS_ENCORE = 'PAS_ENCORE',
}

export const EtatPublicationLabels: Record<EtatPublication, string> = {
  [EtatPublication.SM]: 'SM',
  [EtatPublication.PUBLIEE]: 'Publiée',
  [EtatPublication.EN_COURS]: 'En cours',
  [EtatPublication.PAS_ENCORE]: 'Pas encore',
};

export const StatutMediaPlanLabels: Record<StatutMediaPlan, string> = {
  [StatutMediaPlan.EN_ATTENTE]: 'En attente',
  [StatutMediaPlan.APPROUVE]: 'Approuvé',
  [StatutMediaPlan.DESAPPROUVE]: 'Désapprouvé',
};

export enum TypeContenuShooting {
  PHOTO = 'PHOTO',
  VIDEO = 'VIDEO',
  BOTH = 'BOTH',
}

export const TypeContenuShootingLabels: Record<TypeContenuShooting, string> = {
  [TypeContenuShooting.PHOTO]: 'Photo',
  [TypeContenuShooting.VIDEO]: 'Vidéo',
  [TypeContenuShooting.BOTH]: 'Vidéo + photos',
};

export enum StatutShooting {
  EN_ATTENTE = 'EN_ATTENTE',
  VALIDE = 'VALIDE',
  REJETE = 'REJETE',
}

export interface MediaPlan {
  id: number;
  datePublication: string | null;
  heure: string | null;
  format: string | null;
  type: string | null;
  titre: string;
  texteSurVisuel: string | null;
  inspiration: string | null;
  autresElements: string | null;
  platforme: string | null;
  lienDrive: string | null;
  etatPublication: string | null;
  rectifs: string | null;
  remarques: string | null;
  isShooting: boolean;
  shootingDescription: string | null;
  shootingLocalisation: string | null;
  shootingDate: string | null;
  shootingTypeDeContenu: TypeContenuShooting | null;
  shootingStatus: StatutShooting | null;
  shootingStatusReason: string | null;
  /** Shooting refusé : une autre date peut être planifiée. */
  shootingReplanifiable?: boolean;
  calendrierProjetId: number | null;
  statut: string;
  clientId: number;
  clientNom: string | null;
  createurId: number;
  createurNom: string | null;
  createurPrenom: string | null;
  dateCreation: string | null;
}

export interface MediaPlanRequest {
  datePublication?: string;
  heure?: string;
  format?: string;
  type?: string;
  titre: string;
  texteSurVisuel?: string;
  inspiration?: string;
  autresElements?: string;
  platforme?: string;
  lienDrive?: string;
  etatPublication?: string;
  rectifs?: string;
  remarques?: string;
  isShooting?: boolean;
  shootingDescription?: string;
  shootingLocalisation?: string;
  shootingDate?: string;
  shootingTypeDeContenu?: TypeContenuShooting;
  clientId: number;
  createurId: number;
}

export interface MediaPlanAssignment {
  id: number;
  employeId: number;
  employeNom: string;
  employePrenom: string;
  employeDepartement: string;
  clientId: number;
  clientNom: string;
  dateAssignment: string | null;
}

export interface MediaPlanAssignmentRequest {
  clientId: number;
  employeIds: number[];
}

// =====================
// RÉUNIONS
// =====================
export enum TypeReunion {
  PRESENTIEL = 'PRESENTIEL',
  EN_LIGNE = 'EN_LIGNE',
}

export enum StatutReunion {
  EN_ATTENTE = 'EN_ATTENTE',
  ACCEPTEE = 'ACCEPTEE',
  REFUSEE = 'REFUSEE',
}

export interface Reunion {
  id: number;
  titre: string;
  dateReunion: string;
  heureDebut: string;
  heureFin: string | null;
  typeReunion: TypeReunion;
  plateforme: string | null;
  lienReunion: string | null;
  lieu: string | null;
  statut: StatutReunion;
  initiateurId: number;
  initiateurNom: string;
  initiateurPrenom: string;
  participantId: number | null;
  participantNom: string | null;
  participantPrenom: string | null;
  clientParticipantId: number | null;
  clientParticipantNom: string | null;
  dateCreation: string;
}

export interface ReunionRequest {
  titre: string;
  dateReunion: string;
  heureDebut: string;
  heureFin?: string;
  typeReunion: TypeReunion;
  plateforme?: string;
  lienReunion?: string;
  lieu?: string;
  participantId?: number;
  clientParticipantId?: number;
}
