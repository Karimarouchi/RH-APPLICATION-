# Diagrammes UML — Antigone RH (partie RH)

Ce dossier contient les diagrammes UML de la **partie Ressources Humaines** de l'application
Antigone RH (la partie « Projets » n'est pas couverte).

Chaque diagramme existe en deux versions, avec le même nom :
- **`.png`** : l'image, prête à insérer dans un rapport ou une présentation ;
- **`.puml`** : le texte source (format **PlantUML**), à modifier si vous voulez changer le diagramme.
  Voir la section « Comment régénérer les images » plus bas.

---

## 1. Les acteurs

| Acteur | Qui est-ce ? | Ce qu'il peut faire |
|---|---|---|
| **Employé** | Toute personne qui a un compte | Son tableau de bord, son calendrier, ses demandes (congé, autorisation, télétravail, document), son profil, ses notifications |
| **Chef de département** | Un employé coché « chef de département » sur sa fiche (et qui a la permission « Validations ») | Tout ce que fait l'employé + valider ou refuser les demandes des membres de **son** département |
| **Responsable RH** | Compte avec le rôle « RH » | Tout ce que fait l'employé + gestion des employés, traitement de **toutes** les demandes, paramétrage (calendrier, horaires, référentiels, restrictions), monitoring de la présence, tableau de bord RH |
| **Administrateur** | Compte avec un rôle à « accès total » | **Tout** ce que fait le Responsable RH + comptes utilisateurs, rôles et permissions, suppressions définitives |
| *Agent Desktop* (système) | Petit logiciel installé sur le poste de l'employé | Pointe automatiquement l'arrivée et le départ, envoie un signal d'activité chaque minute |
| *Planificateur* (système) | Tâches automatiques du serveur | Alerte de fin de contrat (chaque jour à 8 h), clôture d'un pointage oublié |
| *Service e-mail* (système) | Messagerie | Envoie les identifiants d'un nouveau compte et les liens « mot de passe oublié » |

> **Authentification.** Toutes les actions demandent d'être connecté. Pour ne pas surcharger les
> diagrammes, cela est indiqué par une **note** et non par un lien vers chaque cas d'utilisation.
> Seul le diagramme `02_cas_utilisation_authentification` détaille la connexion.

### Les rôles sont configurables

L'application ne vérifie pas le **nom** du rôle mais les **permissions** qu'il contient.
L'administrateur peut créer d'autres rôles (par exemple « Manager ») en cochant des permissions.
Il peut aussi **ajouter ou retirer** une permission à un seul compte, sans toucher à son rôle.

**Permissions effectives d'un compte = permissions de ses rôles + permissions ajoutées − permissions retirées.**

### Qui a quelle permission (partie RH, rôles créés par défaut)

| Permission | Ce qu'elle ouvre | Employé | RH | Manager | Admin |
|---|---|:-:|:-:|:-:|:-:|
| Mon tableau de bord | Vue personnelle (solde, demandes, activité) | ✔ | ✔ | ✔ | ✔ |
| Mes demandes | Soumettre et suivre ses demandes | ✔ | ✔ | ✔ | ✔ |
| Mon calendrier | Agenda personnel | ✔ | ✔ | ✔ | ✔ |
| Tableau de bord RH | Indicateurs et alertes RH | | ✔ | | ✔ |
| Employés | Fiches employés, organigramme, départements, archives | | ✔ | | ✔ |
| Demandes RH | Voir et traiter **toutes** les demandes | | ✔ | | ✔ |
| Validations | Approuver / refuser des demandes | | ✔ | ✔ | ✔ |
| Référentiels | Listes de valeurs et paramètres système | | ✔ | | ✔ |
| Calendrier d'entreprise | Jours fériés et horaires | | ✔ | ✔ | ✔ |
| Restrictions de congés | Jours où des collaborateurs ne peuvent pas partir | | ✔ | | ✔ |
| Monitoring | Présence en temps réel, rapports, historique | | ✔ | | ✔ |
| Comptes utilisateurs | Créer et gérer les accès | | | | ✔ |
| Rôles & permissions | Définir les droits | | | | ✔ |
| Supprimer des employés | Suppression définitive d'un employé archivé | | | | ✔ |
| Supprimer des comptes | Suppression définitive d'un compte | | | | ✔ |

*« Employé » = les permissions de l'espace personnel, présentes dans tous les rôles.*

---

## 2. Liste des diagrammes

### 1-cas-utilisation — *Qui fait quoi ?*
| Fichier | Contenu |
|---|---|
| `01_cas_utilisation_global` | Vue d'ensemble : les 4 acteurs et les grandes fonctionnalités |
| `02_cas_utilisation_authentification` | Connexion, changement et réinitialisation du mot de passe |
| `03_cas_utilisation_employe` | Espace personnel de l'employé |
| `04_cas_utilisation_validation_demandes` | Traitement des demandes (RH et chef de département) |
| `05_cas_utilisation_gestion_personnel` | Gestion des employés, documents, départements, alertes de contrat |
| `06_cas_utilisation_parametrage` | Calendrier, horaires, référentiels, restrictions de congés |
| `07_cas_utilisation_monitoring` | Suivi de la présence et rapports d'inactivité |
| `08_cas_utilisation_administration` | Comptes, rôles et permissions |
| `09_raffinement_cas_utilisation_employe` | Raffinement — rôle Employé (accueil, demandes, documents, profil, présence) |
| `10_raffinement_cas_utilisation_rh` | Raffinement — rôle Responsable RH (employés, demandes, organisation du travail, présence, tableau de bord) |
| `11_raffinement_cas_utilisation_admin` | Raffinement — rôle Administrateur (comptes, rôles, actions réservées) |

### 2-classes — *Quelles informations l'application garde ?*
| Fichier | Contenu |
|---|---|
| `01_classes_vue_globale` | Toutes les classes RH et leurs liens (sans détail) |
| `02_classes_personnel_et_acces` | Employé, compte, rôle, permission, documents, notifications |
| `03_classes_demandes` | Demande et ses types (congé, autorisation, télétravail), validation, historique |
| `04_classes_calendrier_et_parametrage` | Jours fériés, horaires, référentiels, restrictions de congés |
| `05_classes_presence_et_monitoring` | Pointage, signaux d'activité, rapports d'inactivité |

### 3-sequences — *Dans quel ordre les choses se passent ?*
| Fichier | Contenu |
|---|---|
| `01_sequence_authentification` | Se connecter |
| `02_sequence_mot_de_passe_oublie` | Réinitialiser un mot de passe oublié |
| `03_sequence_demande_conge` | Soumettre une demande de congé |
| `04_sequence_traiter_demande` | Approuver ou refuser une demande |
| `05_sequence_modifier_annuler_demande` | Modifier ou annuler une demande en attente |
| `06_sequence_demande_document` | Demander un document (attestation, fiche de paie…) et son traitement |
| `07_sequence_ajouter_employe_et_compte` | Ajouter un employé puis lui créer un compte |
| `08_sequence_pointage_agent` | Pointage automatique par l'agent desktop |
| `09_sequence_rapport_inactivite` | Générer et traiter un rapport d'inactivité |
| `10_sequence_roles_permissions` | Créer un rôle et l'attribuer à un compte |
| `11_sequence_restriction_conges` | Définir une restriction de congés et son effet |
| `12_sequence_alerte_fin_contrat` | Alerte automatique de fin de contrat (CDD / CIVP) |

### 4-activites — *Quelles règles sont appliquées ?*
| Fichier | Contenu |
|---|---|
| `01_activite_cycle_demande_conge` | Le parcours complet d'une demande de congé (employé → système → validateur) |
| `02_activite_regles_conge` | Toutes les vérifications faites avant d'accepter une demande de congé |
| `03_activite_regles_autorisation` | Vérifications d'une autorisation de sortie (durée, horaires, quota mensuel) |
| `04_activite_calcul_solde_conge` | Comment le solde de congé est calculé |
| `05_activite_statut_pointage` | Comment le statut du jour est choisi (présent, retard, congé…) |

### 5-etats — *Par quels statuts passe un élément ?*
| Fichier | Contenu |
|---|---|
| `01_etats_demande` | En attente → Approuvée / Refusée / Annulée |
| `02_etats_demande_document` | En attente → Validée / Annulée |
| `03_etats_employe_et_compte` | Employé actif / archivé ; compte provisoire / actif / désactivé |
| `04_etats_rapport_inactivite` | En attente → Déduit / Annulé |

### 6-deploiement — *Où tourne l'application ?*
| Fichier | Contenu |
|---|---|
| `01_deploiement` | Poste utilisateur, serveur, base de données, service e-mail |

---

## 3. Comment régénérer les images (après une modification)

**Option A — en ligne (le plus simple)**
1. Ouvrir <https://www.planttext.com> (ou <https://www.plantuml.com/plantuml>).
2. Copier tout le contenu d'un fichier `.puml` et le coller dans l'éditeur.
3. Télécharger l'image en **PNG** (pour Word) ou **SVG** (meilleure qualité).

**Option B — dans VS Code**
1. Installer l'extension **PlantUML** (auteur : jebbs). Java doit être installé.
2. Ouvrir un fichier `.puml` puis appuyer sur `Alt + D` pour l'aperçu.
3. Clic droit → *Export Current Diagram* pour enregistrer l'image.

> La ligne `!pragma layout smetana` en haut de certains fichiers permet d'afficher le diagramme
> **sans installer Graphviz**. Si Graphviz est installé, vous pouvez supprimer cette ligne :
> la disposition sera parfois plus soignée.

**Modifier un diagramme** : les textes entre guillemets et après les `:` sont les libellés.
Vous pouvez les changer librement, puis régénérer l'image.

---

## 4. Remarques

- Les diagrammes suivent **le code actuel** de l'application. Sur un point, le code diffère de
  l'ancienne documentation (`DOCUMENTATION_CONGE.md`) : le **délai de prévenance d'un congé payé**
  est de **3 × le nombre de jours** (et non 4 ×), et une demande trop tardive est **refusée**.
- Une **demande de document** (« demande papier ») est techniquement une demande de type
  « Administration ». Dans la base, son état initial s'appelle « Brouillon », mais il est affiché comme
  « en attente » de traitement par le RH.
- Les **restrictions de congés** sont enregistrées sous le nom technique `TacheObligatoire`
  (jours où la présence du collaborateur est obligatoire).
