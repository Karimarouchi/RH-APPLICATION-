package com.antigone.rh.service;

import com.antigone.rh.dto.EmployeDTO;
import com.antigone.rh.dto.EmployeStatsDTO;
import com.antigone.rh.dto.SoldeCongeInfo;
import com.antigone.rh.entity.Calendrier;
import com.antigone.rh.entity.Conge;
import com.antigone.rh.entity.Employe;
import com.antigone.rh.entity.HoraireTravail;
import com.antigone.rh.entity.Referentiel;
import com.antigone.rh.enums.StatutDemande;
import com.antigone.rh.enums.TypeConge;
import com.antigone.rh.enums.TypeJour;
import com.antigone.rh.enums.TypeReferentiel;
import com.antigone.rh.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.Period;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional
public class EmployeService {

    private final EmployeRepository employeRepository;
    private final ReferentielRepository referentielRepository;
    private final CongeRepository congeRepository;
    private final NotificationRepository notificationRepository;
    private final ValidationRepository validationRepository;
    private final TacheRepository tacheRepository;
    private final AffectationHoraireRepository affectationHoraireRepository;
    private final ProjetRepository projetRepository;
    private final EquipeRepository equipeRepository;
    private final CompteRepository compteRepository;
    private final DemandeRepository demandeRepository;
    private final HistoriqueStatutRepository historiqueStatutRepository;
    private final AccessLogRepository accessLogRepository;
    private final PeriodeBloqueeRepository periodeBloqueeRepository;
    private final CalendrierRepository calendrierRepository;
    private final HoraireTravailRepository horaireTravailRepository;
    private final NotificationService notificationService;
    private final PointageRepository pointageRepository;
    private final HeartbeatRepository heartbeatRepository;
    private final PresenceConfirmationRepository presenceConfirmationRepository;
    private final DocumentEmployeRepository documentEmployeRepository;
    private final CompetenceRepository competenceRepository;
    private final AutorisationRepository autorisationRepository;
    private final RapportInactiviteRepository rapportInactiviteRepository;
    private final TeletravailRepository teletravailRepository;
    private final TacheObligatoireRepository tacheObligatoireRepository;
    private final MediaPlanAssignmentRepository mediaPlanAssignmentRepository;
    private final ReunionRepository reunionRepository;
    private final CalendrierProjetRepository calendrierProjetRepository;
    private final ReactifInternRepository reactifInternRepository;

    private static final SecureRandom RANDOM = new SecureRandom();

    // Mapping DayOfWeek → French day names used in HoraireTravail.joursTravail
    private static final Map<DayOfWeek, String> DOW_TO_FRENCH = Map.of(
            DayOfWeek.MONDAY, "LUNDI",
            DayOfWeek.TUESDAY, "MARDI",
            DayOfWeek.WEDNESDAY, "MERCREDI",
            DayOfWeek.THURSDAY, "JEUDI",
            DayOfWeek.FRIDAY, "VENDREDI",
            DayOfWeek.SATURDAY, "SAMEDI",
            DayOfWeek.SUNDAY, "DIMANCHE");

    public List<EmployeDTO> findAll() {
        return employeRepository.findAllByArchivedFalse().stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    public List<EmployeDTO> findByRoleName(String roleName) {
        return employeRepository.findByRoleName(roleName).stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    public EmployeDTO findById(Long id) {
        Employe employe = employeRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Employé non trouvé avec l'id: " + id));
        return toDTO(employe);
    }

    public EmployeDTO findByMatricule(String matricule) {
        Employe employe = employeRepository.findByMatricule(matricule)
                .orElseThrow(() -> new RuntimeException("Employé non trouvé avec le matricule: " + matricule));
        return toDTO(employe);
    }

    public EmployeDTO findByEmail(String email) {
        Employe employe = employeRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("Employé non trouvé avec l'email: " + email));
        return toDTO(employe);
    }

    public List<EmployeDTO> findSubordinates(Long managerId) {
        return employeRepository.findByManagerId(managerId).stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    private void normalizeEmptyStrings(EmployeDTO dto) {
        if (dto.getCin() != null && dto.getCin().trim().isEmpty())
            dto.setCin(null);
        if (dto.getCnss() != null && dto.getCnss().trim().isEmpty())
            dto.setCnss(null);
        if (dto.getRibBancaire() != null && dto.getRibBancaire().trim().isEmpty())
            dto.setRibBancaire(null);
        if (dto.getGenre() != null && dto.getGenre().trim().isEmpty())
            dto.setGenre(null);
        if (dto.getGenre() != null)
            dto.setGenre(dto.getGenre().trim().toUpperCase());
        if (dto.getPoste() != null && dto.getPoste().trim().isEmpty())
            dto.setPoste(null);
        if (dto.getTypeContrat() != null && dto.getTypeContrat().trim().isEmpty())
            dto.setTypeContrat(null);
        if (dto.getDepartement() != null && dto.getDepartement().trim().isEmpty())
            dto.setDepartement(null);
        if (dto.getTelephone() != null && dto.getTelephone().trim().isEmpty())
            dto.setTelephone(null);
        if (dto.getTelephonePro() != null && dto.getTelephonePro().trim().isEmpty())
            dto.setTelephonePro(null);
    }

    public EmployeDTO create(EmployeDTO dto) {
        normalizeEmptyStrings(dto);

        validateFields(dto);

        // Check for duplicates before saving
        if (dto.getEmail() != null && employeRepository.existsByEmail(dto.getEmail())) {
            throw new RuntimeException("Cette adresse email existe déjà");
        }
        if (dto.getCin() != null && employeRepository.existsByCin(dto.getCin())) {
            throw new RuntimeException("Ce numéro CIN existe déjà");
        }

        Employe employe = toEntity(dto);
        // Auto-generate matricule from département (3 first letters + 4 random digits)
        employe.setMatricule(generateMatricule(dto.getDepartement()));
        if (dto.getManagerId() != null) {
            Employe manager = employeRepository.findById(dto.getManagerId())
                    .orElseThrow(() -> new RuntimeException("Manager non trouvé"));
            employe.setManager(manager);
        }
        Employe saved = employeRepository.save(employe);

        if (Boolean.TRUE.equals(dto.getUseInitialSolde()) && dto.getSoldeCongeInitial() != null) {
            // Solde congé initial saisi manuellement — on ne recalcule pas
            saved.setSoldeCongeInitial(dto.getSoldeCongeInitial());
            saved.setSoldeConge(dto.getSoldeCongeInitial());
            employeRepository.save(saved);
        } else {
            // Auto-calculate solde congé from dateEmbauche
            if (saved.getDateEmbauche() != null) {
                SoldeCongeInfo info = getSoldeCongeInfo(saved.getId());
                saved.setSoldeConge(info.getSoldeDisponible());
                employeRepository.save(saved);
            }
        }

        // --- Notifications ---
        // Notifications de création désactivées à la demande de l'utilisateur
        /*
        String nomComplet = saved.getNom() + " " + saved.getPrenom();
        notifyAdmins("Nouvel employé",
                "Un nouvel employé a été ajouté : " + nomComplet
                        + " (" + saved.getMatricule() + ")"
                        + (saved.getDepartement() != null ? " - Département : " + saved.getDepartement() : "")
                        + (saved.getPoste() != null ? " - Poste : " + saved.getPoste() : ""));

        if (saved.getManager() != null) {
            notificationService.create(saved.getManager(),
                    "Nouveau subordonné",
                    "Un nouvel employé vous a été affecté : " + nomComplet
                            + " (" + saved.getMatricule() + ")"
                            + (saved.getPoste() != null ? " - Poste : " + saved.getPoste() : ""),
                    null);
        }
        */

        return toDTO(saved);
    }

    private void validateFields(EmployeDTO dto) {
        if (dto.getCin() != null && !dto.getCin().matches("^[0-9]{8}$")) {
            throw new RuntimeException("Le CIN doit contenir exactement 8 chiffres");
        }
        if (dto.getCnss() != null && !dto.getCnss().matches("^[0-9]{1,12}(-[0-9]+)*$")) {
            throw new RuntimeException("Le CNSS doit contenir des chiffres (tirets autorisés)");
        }
        if (dto.getRibBancaire() != null && !dto.getRibBancaire().matches("^[0-9]{20}$")) {
            throw new RuntimeException("Le RIB doit contenir exactement 20 chiffres");
        }
        if (dto.getTelephonePro() != null && !dto.getTelephonePro().matches("^[0-9]+$")) {
            throw new RuntimeException("Le téléphone professionnel doit contenir uniquement des chiffres");
        }
    }

    /**
     * Génère un matricule unique : 3 premières lettres du département + 4 chiffres
     * aléatoires.
     * Le matricule sert aussi de login pour se connecter.
     */
    private String generateMatricule(String departement) {
        String prefix;
        if (departement != null && !departement.isEmpty()) {
            String cleaned = departement.toUpperCase().replaceAll("[^A-Z]", "");
            if (cleaned.length() >= 3) {
                prefix = cleaned.substring(0, 3);
            } else {
                prefix = String.format("%-3s", cleaned).replace(' ', 'X');
            }
        } else {
            prefix = "EMP";
        }

        String matricule;
        do {
            int number = 1000 + RANDOM.nextInt(9000); // 4 chiffres
            matricule = prefix + number;
        } while (employeRepository.existsByMatricule(matricule));

        return matricule;
    }

    public EmployeDTO update(Long id, EmployeDTO dto) {
        normalizeEmptyStrings(dto);
        validateFields(dto);
        Employe employe = employeRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Employé non trouvé avec l'id: " + id));
        // Le matricule ne change pas (généré automatiquement)
        employe.setCin(dto.getCin());
        employe.setCnss(dto.getCnss());
        employe.setNom(dto.getNom());
        employe.setPrenom(dto.getPrenom());
        employe.setEmail(dto.getEmail());
        employe.setTelephone(dto.getTelephone());
        employe.setTelephonePro(dto.getTelephonePro());
        employe.setSalaire(dto.getSalaire());
        employe.setDateEmbauche(dto.getDateEmbauche());
        employe.setSoldeConge(dto.getSoldeConge());
        employe.setPoste(dto.getPoste());
        employe.setTypeContrat(dto.getTypeContrat());
        employe.setDateFinContrat(dto.getDateFinContrat());
        employe.setGenre(dto.getGenre());
        employe.setDepartement(dto.getDepartement());
        employe.setRibBancaire(dto.getRibBancaire());
        employe.setImageUrl(dto.getImageUrl());
        employe.setLienDrive(dto.getLienDrive());
        Employe ancienManager = employe.getManager();
        if (dto.getManagerId() != null) {
            Employe manager = employeRepository.findById(dto.getManagerId())
                    .orElseThrow(() -> new RuntimeException("Manager non trouvé"));
            employe.setManager(manager);
        } else {
            employe.setManager(null);
        }

        // Handle initial solde toggle
        if (Boolean.TRUE.equals(dto.getUseInitialSolde()) && dto.getSoldeCongeInitial() != null) {
            employe.setSoldeCongeInitial(dto.getSoldeCongeInitial());
            employe.setSoldeConge(dto.getSoldeCongeInitial());
        } else if (Boolean.FALSE.equals(dto.getUseInitialSolde())) {
            // User unchecked — clear initial balance, re-enable auto-calculation
            employe.setSoldeCongeInitial(null);
        }

        Employe saved = employeRepository.save(employe);

        // Auto-recalculate for employees without initial balance
        if (saved.getSoldeCongeInitial() == null && saved.getDateEmbauche() != null) {
            SoldeCongeInfo info = getSoldeCongeInfo(saved.getId());
            saved.setSoldeConge(info.getSoldeDisponible());
            employeRepository.save(saved);
        }

        // --- Notifications ---
        String nomComplet = saved.getNom() + " " + saved.getPrenom();

        // Notify the employee about profile update
        notificationService.create(saved,
                "Profil mis à jour",
                "Votre profil a été modifié. Veuillez vérifier les informations mises à jour.",
                null);

        // Notify admins about the update
        notifyAdmins("Employé modifié",
                "Le profil de l'employé " + nomComplet + " (" + saved.getMatricule() + ") a été modifié.");

        // Notify new manager if manager changed
        Employe nouveauManager = saved.getManager();
        if (nouveauManager != null
                && (ancienManager == null || !ancienManager.getId().equals(nouveauManager.getId()))) {
            notificationService.create(nouveauManager,
                    "Nouveau subordonné",
                    "L'employé " + nomComplet + " (" + saved.getMatricule() + ") vous a été affecté.",
                    null);
        }
        // Notify old manager if they lost a subordinate
        if (ancienManager != null
                && (nouveauManager == null || !ancienManager.getId().equals(nouveauManager.getId()))) {
            notificationService.create(ancienManager,
                    "Subordonné réaffecté",
                    "L'employé " + nomComplet + " (" + saved.getMatricule() + ") ne fait plus partie de votre équipe.",
                    null);
        }

        return toDTO(saved);
    }

    public void delete(Long id) {
        Employe employe = employeRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Employé non trouvé avec l'id: " + id));

        String nomComplet = employe.getNom() + " " + employe.getPrenom();
        String matricule = employe.getMatricule();
        Employe manager = employe.getManager();

        // Notify admins about deletion
        notifyAdmins("Employé supprimé",
                "L'employé " + nomComplet + " (" + matricule + ")"
                        + (employe.getDepartement() != null ? " - " + employe.getDepartement() : "")
                        + " a été supprimé du système.");

        // Notify the manager about subordinate removal
        if (manager != null) {
            notificationService.create(manager,
                    "Subordonné supprimé",
                    "L'employé " + nomComplet + " (" + matricule + ") a été supprimé du système.",
                    null);
        }

        // Détacher l'employé des équipes (requête native pour éviter les membres
        // fantômes)
        equipeRepository.removeEmployeFromAllEquipes(employe.getId());

        // Détacher les subordonnés
        for (Employe sub : employe.getSubordonnes()) {
            sub.setManager(null);
        }

        // Détacher des projets : membres et chefs (requêtes natives pour éviter les
        // proxies fantômes)
        projetRepository.removeEmployeFromAllProjetsMembers(employe.getId());
        projetRepository.removeEmployeFromAllProjetsChefs(employe.getId());

        // Détacher des projets (chef de projet — relation ManyToOne simple)
        projetRepository.findByChefDeProjetId(employe.getId())
                .forEach(p -> p.setChefDeProjet(null));

        // Détacher les tâches assignées
        tacheRepository.findAll().stream()
                .filter(t -> employe.equals(t.getAssignee()))
                .forEach(t -> t.setAssignee(null));

        // Supprimer les notifications
        notificationRepository.deleteAll(notificationRepository.findByEmployeId(employe.getId()));

        // Supprimer les validations
        validationRepository.deleteAll(validationRepository.findByValidateurId(employe.getId()));

        // Supprimer les affectations horaires
        affectationHoraireRepository.deleteAll(affectationHoraireRepository.findByEmployeId(employe.getId()));

        // Supprimer historique statut lié
        historiqueStatutRepository.deleteAll(historiqueStatutRepository.findByModifieParId(employe.getId()));

        // Détacher des périodes bloquées créées par cet employé
        periodeBloqueeRepository.findAll().stream()
                .filter(p -> employe.equals(p.getCreePar()))
                .forEach(p -> p.setCreePar(null));

        // Supprimer les demandes (cascade supprime validations/historique liés)
        demandeRepository.deleteAll(demandeRepository.findByEmployeId(employe.getId()));

        // Supprimer les congés
        congeRepository.deleteAll(congeRepository.findByEmployeId(employe.getId()));

        // Supprimer les pointages
        pointageRepository.deleteAll(pointageRepository.findByEmployeId(employe.getId()));

        // Supprimer les heartbeats
        heartbeatRepository.deleteAll(heartbeatRepository.findByEmployeId(employe.getId()));

        // Supprimer les confirmations de présence
        presenceConfirmationRepository.deleteAll(presenceConfirmationRepository.findByEmployeId(employe.getId()));

        // Supprimer les documents
        documentEmployeRepository.deleteAll(documentEmployeRepository.findByEmployeId(employe.getId()));

        // Supprimer les compétences
        competenceRepository.deleteAll(competenceRepository.findByEmployeId(employe.getId()));

        // Supprimer les autorisations
        autorisationRepository.deleteAll(autorisationRepository.findByEmployeId(employe.getId()));

        // Supprimer les rapports d'inactivité
        rapportInactiviteRepository.deleteAll(rapportInactiviteRepository.findByEmployeId(employe.getId()));

        // Supprimer les télétravail
        teletravailRepository.deleteAll(teletravailRepository.findByEmployeId(employe.getId()));

        // Supprimer les tâches obligatoires
        tacheObligatoireRepository.deleteAll(tacheObligatoireRepository.findByEmployeId(employe.getId()));

        // Supprimer les assignments de médiaplan
        mediaPlanAssignmentRepository.deleteAll(mediaPlanAssignmentRepository.findByEmployeId(employe.getId()));

        // Supprimer les réunions (initiateur ou participant)
        reunionRepository.deleteAll(reunionRepository.findByEmploye(employe.getId()));

        // Supprimer les entrées calendrier_projet où l'employé est manager ou
        // social_manager
        calendrierProjetRepository.deleteAll(calendrierProjetRepository.findByManagerId(employe.getId()));
        calendrierProjetRepository.deleteAll(calendrierProjetRepository.findBySocialManagerId(employe.getId()));

        // Supprimer les réactifs internes liés à l'employé (comme auteur ou assigné)
        reactifInternRepository.deleteAll(reactifInternRepository.findByEmployeId(employe.getId()));
        reactifInternRepository.deleteAll(reactifInternRepository.findByManagerId(employe.getId()));

        // Supprimer les access logs et le compte
        if (employe.getCompte() != null) {
            accessLogRepository.deleteAll(
                    accessLogRepository.findByCompteIdOrderByDateAccesDesc(employe.getCompte().getId()));
            compteRepository.delete(employe.getCompte());
        }

        employeRepository.delete(employe);
    }

    public void updateSoldeConge(Long id, Double solde) {
        Employe employe = employeRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Employé non trouvé"));
        Double ancienSolde = employe.getSoldeConge();
        employe.setSoldeConge(solde);
        employeRepository.save(employe);

        // Notify employee about leave balance change
        notificationService.create(employe,
                "Solde congé modifié",
                "Votre solde de congé a été mis à jour."
                        + (ancienSolde != null ? " Ancien solde : " + ancienSolde + " jours." : "")
                        + " Nouveau solde : " + solde + " jours.",
                null);
    }

    public EmployeDTO updateLienDrive(Long id, String lienDrive) {
        Employe employe = employeRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Employé non trouvé"));
        employe.setLienDrive(lienDrive != null && !lienDrive.trim().isEmpty() ? lienDrive.trim() : null);
        return toDTO(employeRepository.save(employe));
    }

    public EmployeDTO updateImage(Long id, String imageUrl) {
        Employe employe = employeRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Employé non trouvé"));
        employe.setImageUrl(imageUrl);
        Employe saved = employeRepository.save(employe);

        // Notify employee about photo change
        notificationService.create(saved,
                "Photo de profil modifiée",
                "Votre photo de profil a été mise à jour.",
                null);

        return toDTO(saved);
    }

    /**
     * Notify all ADMIN and RH users.
     */
    private void notifyAdmins(String titre, String message) {
        List<Employe> admins = employeRepository.findByRoleName("ADMIN");
        List<Employe> rhs = employeRepository.findByRoleName("RH");
        Set<Long> notifiedIds = new HashSet<>();
        for (Employe admin : admins) {
            if (notifiedIds.add(admin.getId())) {
                notificationService.create(admin, titre, message, null);
            }
        }
        for (Employe rh : rhs) {
            if (notifiedIds.add(rh.getId())) {
                notificationService.create(rh, titre, message, null);
            }
        }
    }

    // =========================================
    // SOLDE CONGÉ — CALCUL BASÉ SUR L'ANCIENNETÉ
    // =========================================

    /**
     * Compute solde congé info dynamically from dateEmbauche.
     *
     * Rules:
     * - 1ère année : 18 jours/an (1.5 jours/mois)
     * - À partir de la 2ème année : 24 jours/an (2 jours/mois)
     * - Le solde est proratisé selon les mois travaillés dans l'année de congé en
     * cours
     * - L'année de congé va d'anniversaire d'embauche à anniversaire d'embauche
     */
    public SoldeCongeInfo getSoldeCongeInfo(Long employeId) {
        Employe employe = employeRepository.findById(employeId)
                .orElseThrow(() -> new RuntimeException("Employé non trouvé"));

        if (employe.getDateEmbauche() == null) {
            return SoldeCongeInfo.builder()
                    .employeId(employe.getId())
                    .employeNom(employe.getNom() + " " + employe.getPrenom())
                    .soldeDisponible(employe.getSoldeConge() != null ? employe.getSoldeConge() : 0)
                    .build();
        }

        LocalDate today = LocalDate.now();
        LocalDate dateEmbauche = employe.getDateEmbauche();

        // Compute seniority
        Period anciennete = Period.between(dateEmbauche, today);
        int ancienneteAnnees = anciennete.getYears();
        int ancienneteMois = anciennete.getYears() * 12 + anciennete.getMonths();

        // Get rates from referentiels
        double droitAn1 = getRefValue("SOLDE_CONGE_AN1", 18.0);
        double droitAn2Plus = getRefValue("SOLDE_CONGE_AN2_PLUS", 24.0);
        double tauxAn1 = getRefValue("TAUX_MENSUEL_AN1", 1.5);
        double tauxAn2Plus = getRefValue("TAUX_MENSUEL_AN2_PLUS", 2.0);

        // Determine current congé year boundaries (anniversary-based)
        LocalDate debutAnneeConge;
        LocalDate finAnneeConge;
        if (ancienneteAnnees < 1) {
            debutAnneeConge = dateEmbauche;
            finAnneeConge = dateEmbauche.plusYears(1).minusDays(1);
        } else {
            debutAnneeConge = dateEmbauche.plusYears(ancienneteAnnees);
            finAnneeConge = debutAnneeConge.plusYears(1).minusDays(1);
        }

        // Determine rate and annual right
        boolean isFirstYear = ancienneteAnnees < 1;
        double droitAnnuel = isFirstYear ? droitAn1 : droitAn2Plus;
        double tauxMensuel = isFirstYear ? tauxAn1 : tauxAn2Plus;

        // Months worked in current congé year
        int moisTravailles;
        if (today.isBefore(debutAnneeConge)) {
            moisTravailles = 0;
        } else {
            Period p = Period.between(debutAnneeConge, today);
            moisTravailles = p.getYears() * 12 + p.getMonths();
            // Count partial month if >= 15 calendar days
            if (p.getDays() >= 15) {
                moisTravailles++;
            }
        }
        moisTravailles = Math.min(moisTravailles, 12);

        // ── Règlement 7.2.1 : "pour chaque mois travaillé" ──
        // Si un salarié a un congé sans solde couvrant la totalité des jours
        // ouvrables d'un mois, ce mois ne compte pas pour l'acquisition.
        List<Conge> congeSansSoldeApprouves = congeRepository.findOverlappingByTypeCongeAndStatut(
                employeId, TypeConge.CONGE_SANS_SOLDE, StatutDemande.APPROUVEE,
                debutAnneeConge, today.isBefore(finAnneeConge) ? today : finAnneeConge);

        int moisNonTravailles = 0;
        for (int m = 0; m < moisTravailles; m++) {
            LocalDate moisDebut = debutAnneeConge.plusMonths(m);
            LocalDate moisFin = debutAnneeConge.plusMonths(m + 1).minusDays(1);
            if (moisFin.isAfter(today))
                moisFin = today;

            int joursOuvMois = countWorkingDaysInPeriod(moisDebut, moisFin);
            if (joursOuvMois == 0)
                continue;

            // Count congé sans solde working days overlapping this month
            int joursCssDansMois = 0;
            for (Conge css : congeSansSoldeApprouves) {
                LocalDate overlapStart = css.getDateDebut().isBefore(moisDebut) ? moisDebut : css.getDateDebut();
                LocalDate overlapEnd = css.getDateFin().isAfter(moisFin) ? moisFin : css.getDateFin();
                if (!overlapStart.isAfter(overlapEnd)) {
                    joursCssDansMois += countWorkingDaysInPeriod(overlapStart, overlapEnd);
                }
            }

            if (joursCssDansMois >= joursOuvMois) {
                moisNonTravailles++;
            }
        }
        moisTravailles = Math.max(0, moisTravailles - moisNonTravailles);

        // Days acquired this year
        double joursAcquis = Math.min(moisTravailles * tauxMensuel, droitAnnuel);

        // ── Carry-over from previous year (max MAX_REPORT_CONGE) ──
        double joursReportes = 0;
        double maxReport = getRefValue("MAX_REPORT_CONGE", 5.0);
        if (ancienneteAnnees >= 1) {
            // Previous congé year boundaries
            LocalDate debutAnneePrecedente = dateEmbauche.plusYears(ancienneteAnnees - 1);
            LocalDate finAnneePrecedente = debutAnneePrecedente.plusYears(1).minusDays(1);

            // Rate for previous year
            boolean prevIsFirstYear = (ancienneteAnnees - 1) < 1;
            double prevDroit = prevIsFirstYear ? droitAn1 : droitAn2Plus;
            double prevTaux = prevIsFirstYear ? tauxAn1 : tauxAn2Plus;

            // For the first year, compute actual months worked (may be < 12)
            int prevMoisTravailles;
            if (prevIsFirstYear) {
                Period pp = Period.between(debutAnneePrecedente, finAnneePrecedente.plusDays(1));
                prevMoisTravailles = Math.min(pp.getYears() * 12 + pp.getMonths() + (pp.getDays() >= 15 ? 1 : 0), 12);
            } else {
                prevMoisTravailles = 12;
            }
            double prevAcquis = Math.min(prevMoisTravailles * prevTaux, prevDroit);

            // Consumed in previous year
            List<Conge> prevApprouves = congeRepository.findByEmployeIdAndTypeCongeAndStatutAndDateDebutBetween(
                    employeId, TypeConge.CONGE_PAYE, StatutDemande.APPROUVEE,
                    debutAnneePrecedente, finAnneePrecedente);
            double prevConsommes = prevApprouves.stream()
                    .mapToDouble(c -> c.getNombreJours() != null ? c.getNombreJours() : 0)
                    .sum();

            double reliquat = Math.max(0, prevAcquis - prevConsommes);
            joursReportes = Math.min(reliquat, maxReport);
        }

        // Total available = acquired this year + carry-over - consumed this year
        joursAcquis += joursReportes;

        // Consumed congés payés (APPROUVEE) this congé year — use nombreJours (jours
        // effectifs)
        List<Conge> approuves = congeRepository.findByEmployeIdAndTypeCongeAndStatutAndDateDebutBetween(
                employeId, TypeConge.CONGE_PAYE, StatutDemande.APPROUVEE,
                debutAnneeConge, finAnneeConge);
        double joursConsommes = approuves.stream()
                .mapToDouble(c -> c.getNombreJours() != null ? c.getNombreJours() : 0)
                .sum();

        // Pending congés payés (EN_ATTENTE) this congé year — use nombreJours (jours
        // effectifs)
        List<Conge> enAttente = congeRepository.findByEmployeIdAndTypeCongeAndStatutAndDateDebutBetween(
                employeId, TypeConge.CONGE_PAYE, StatutDemande.EN_ATTENTE,
                debutAnneeConge, finAnneeConge);
        double joursEnAttente = enAttente.stream()
                .mapToDouble(c -> c.getNombreJours() != null ? c.getNombreJours() : 0)
                .sum();

        double soldeDisponible;
        double soldePrevisionnel;

        if (employe.getSoldeCongeInitial() != null) {
            // Solde géré manuellement — on utilise la valeur stockée
            soldeDisponible = employe.getSoldeConge() != null ? employe.getSoldeConge() : 0;
            soldePrevisionnel = Math.max(0, soldeDisponible - joursEnAttente);
        } else {
            soldeDisponible = Math.max(0, joursAcquis - joursConsommes);
            soldePrevisionnel = Math.max(0, joursAcquis - joursConsommes - joursEnAttente);

            // Also update the stored soldeConge to keep it in sync
            employe.setSoldeConge(soldeDisponible);
            employeRepository.save(employe);
        }

        return SoldeCongeInfo.builder()
                .employeId(employe.getId())
                .employeNom(employe.getNom() + " " + employe.getPrenom())
                .dateEmbauche(dateEmbauche)
                .ancienneteAnnees(ancienneteAnnees)
                .ancienneteMois(ancienneteMois)
                .droitAnnuel(droitAnnuel)
                .tauxMensuel(tauxMensuel)
                .joursAcquis(joursAcquis)
                .moisTravaillesAnneeEnCours(moisTravailles)
                .joursReportes(joursReportes)
                .joursConsommes(joursConsommes)
                .joursEnAttente(joursEnAttente)
                .soldeDisponible(soldeDisponible)
                .soldePrevisionnel(soldePrevisionnel)
                .debutAnneeConge(debutAnneeConge)
                .finAnneeConge(finAnneeConge)
                .build();
    }

    /**
     * Count working days based on HoraireTravail (not hardcoded Sat/Sun) excluding
     * holidays.
     */
    private int countWorkingDaysInPeriod(LocalDate start, LocalDate end) {
        Set<LocalDate> holidays = calendrierRepository
                .findByTypeJourAndDateJourBetween(TypeJour.FERIE, start, end)
                .stream()
                .map(Calendrier::getDateJour)
                .collect(Collectors.toSet());

        HoraireTravail horaire = getDefaultHoraire();
        Set<String> joursTravail = Arrays.stream(horaire.getJoursTravail().split(","))
                .map(String::trim).map(String::toUpperCase).collect(Collectors.toSet());

        int count = 0;
        LocalDate d = start;
        while (!d.isAfter(end)) {
            String jourFr = DOW_TO_FRENCH.get(d.getDayOfWeek());
            if (joursTravail.contains(jourFr) && !holidays.contains(d)) {
                count++;
            }
            d = d.plusDays(1);
        }
        return count;
    }

    /**
     * Get the default (first) HoraireTravail, or a sensible fallback.
     */
    private HoraireTravail getDefaultHoraire() {
        return horaireTravailRepository.findAll().stream().findFirst()
                .orElseGet(() -> {
                    HoraireTravail fallback = new HoraireTravail();
                    fallback.setNom("Défaut");
                    fallback.setHeureDebut(LocalTime.of(9, 0));
                    fallback.setHeureFin(LocalTime.of(18, 0));
                    fallback.setJoursTravail("LUNDI,MARDI,MERCREDI,JEUDI,VENDREDI");
                    return fallback;
                });
    }

    /**
     * Get a double value from referentiels by libelle.
     */
    private double getRefValue(String libelle, double defaultValue) {
        return referentielRepository
                .findByLibelleAndTypeReferentiel(libelle, TypeReferentiel.PARAMETRE_SYSTEME)
                .map(ref -> {
                    try {
                        return Double.parseDouble(ref.getValeur());
                    } catch (NumberFormatException e) {
                        return defaultValue;
                    }
                })
                .orElse(defaultValue);
    }

    // =========================================
    // MÉTIERS AVANCÉS
    // =========================================

    public EmployeStatsDTO getStatistics() {
        List<Employe> all = employeRepository.findAllByArchivedFalse();
        LocalDate now = LocalDate.now();

        long total = all.size();
        long nouveauxCeMois = all.stream()
                .filter(e -> e.getDateEmbauche() != null
                        && e.getDateEmbauche().getMonth() == now.getMonth()
                        && e.getDateEmbauche().getYear() == now.getYear())
                .count();

        double masseSalariale = all.stream()
                .filter(e -> e.getSalaire() != null)
                .mapToDouble(Employe::getSalaire)
                .sum();

        double moyenneSalaire = all.stream()
                .filter(e -> e.getSalaire() != null)
                .mapToDouble(Employe::getSalaire)
                .average()
                .orElse(0);

        double moyenneAnciennete = all.stream()
                .filter(e -> e.getDateEmbauche() != null)
                .mapToLong(e -> ChronoUnit.MONTHS.between(e.getDateEmbauche(), now))
                .average()
                .orElse(0) / 12.0;

        Map<String, Long> parDepartement = all.stream()
                .filter(e -> e.getDepartement() != null && !e.getDepartement().isEmpty())
                .collect(Collectors.groupingBy(Employe::getDepartement, Collectors.counting()));

        Map<String, Long> parTypeContrat = all.stream()
                .filter(e -> e.getTypeContrat() != null && !e.getTypeContrat().isEmpty())
                .collect(Collectors.groupingBy(Employe::getTypeContrat, Collectors.counting()));

        Map<String, Long> parGenre = all.stream()
                .filter(e -> e.getGenre() != null && !e.getGenre().isEmpty())
                .collect(Collectors.groupingBy(Employe::getGenre, Collectors.counting()));

        Map<String, Long> parPoste = all.stream()
                .filter(e -> e.getPoste() != null && !e.getPoste().isEmpty())
                .collect(Collectors.groupingBy(Employe::getPoste, Collectors.counting()));

        // Embauches par mois (12 derniers mois)
        Map<String, Long> embaucheParMois = new LinkedHashMap<>();
        DateTimeFormatter fmt = DateTimeFormatter.ofPattern("yyyy-MM");
        for (int i = 11; i >= 0; i--) {
            LocalDate month = now.minusMonths(i).withDayOfMonth(1);
            String key = month.format(fmt);
            long count = all.stream()
                    .filter(e -> e.getDateEmbauche() != null
                            && e.getDateEmbauche().getMonth() == month.getMonth()
                            && e.getDateEmbauche().getYear() == month.getYear())
                    .count();
            embaucheParMois.put(key, count);
        }

        return EmployeStatsDTO.builder()
                .totalEmployes(total)
                .employesActifs(total)
                .nouveauxCeMois(nouveauxCeMois)
                .masseSalariale(masseSalariale)
                .moyenneSalaire(Math.round(moyenneSalaire * 100.0) / 100.0)
                .moyenneAnciennete(Math.round(moyenneAnciennete * 10.0) / 10.0)
                .parDepartement(parDepartement)
                .parTypeContrat(parTypeContrat)
                .parGenre(parGenre)
                .parPoste(parPoste)
                .embaucheParMois(embaucheParMois)
                .build();
    }

    public List<EmployeDTO> advancedSearch(String departement, String typeContrat, String genre,
            String poste, String dateEmbaucheFrom, String dateEmbaucheTo,
            Double salaireMin, Double salaireMax, Long managerId, String q) {
        List<Employe> all = employeRepository.findAllByArchivedFalse();
        return all.stream()
                .filter(e -> departement == null || departement.isEmpty() || departement.equals(e.getDepartement()))
                .filter(e -> typeContrat == null || typeContrat.isEmpty() || typeContrat.equals(e.getTypeContrat()))
                .filter(e -> genre == null || genre.isEmpty() || genre.equalsIgnoreCase(e.getGenre()))
                .filter(e -> poste == null || poste.isEmpty() || poste.equals(e.getPoste()))
                .filter(e -> {
                    if (dateEmbaucheFrom == null || dateEmbaucheFrom.isEmpty())
                        return true;
                    if (e.getDateEmbauche() == null)
                        return false;
                    return !e.getDateEmbauche().isBefore(LocalDate.parse(dateEmbaucheFrom));
                })
                .filter(e -> {
                    if (dateEmbaucheTo == null || dateEmbaucheTo.isEmpty())
                        return true;
                    if (e.getDateEmbauche() == null)
                        return false;
                    return !e.getDateEmbauche().isAfter(LocalDate.parse(dateEmbaucheTo));
                })
                .filter(e -> salaireMin == null || (e.getSalaire() != null && e.getSalaire() >= salaireMin))
                .filter(e -> salaireMax == null || (e.getSalaire() != null && e.getSalaire() <= salaireMax))
                .filter(e -> managerId == null || (e.getManager() != null && e.getManager().getId().equals(managerId)))
                .filter(e -> {
                    if (q == null || q.isEmpty())
                        return true;
                    String lower = q.toLowerCase();
                    return (e.getNom() != null && e.getNom().toLowerCase().contains(lower))
                            || (e.getPrenom() != null && e.getPrenom().toLowerCase().contains(lower))
                            || (e.getMatricule() != null && e.getMatricule().toLowerCase().contains(lower))
                            || (e.getEmail() != null && e.getEmail().toLowerCase().contains(lower));
                })
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    public byte[] exportToCsv() {
        List<Employe> all = employeRepository.findAllByArchivedFalse();
        StringBuilder sb = new StringBuilder();
        // BOM for Excel UTF-8
        sb.append('\uFEFF');
        sb.append(
                "Matricule;Nom;Prénom;Email;Genre;CIN;CNSS;Téléphone;Téléphone Pro;Poste;Département;Type Contrat;Date Embauche;Salaire;Solde Congé;Manager;RIB\n");
        for (Employe e : all) {
            sb.append(csvField(e.getMatricule())).append(';');
            sb.append(csvField(e.getNom())).append(';');
            sb.append(csvField(e.getPrenom())).append(';');
            sb.append(csvField(e.getEmail())).append(';');
            sb.append(csvField(e.getGenre())).append(';');
            sb.append(csvField(e.getCin())).append(';');
            sb.append(csvField(e.getCnss())).append(';');
            sb.append(csvField(e.getTelephone())).append(';');
            sb.append(csvField(e.getTelephonePro())).append(';');
            sb.append(csvField(e.getPoste())).append(';');
            sb.append(csvField(e.getDepartement())).append(';');
            sb.append(csvField(e.getTypeContrat())).append(';');
            sb.append(e.getDateEmbauche() != null ? e.getDateEmbauche().toString() : "").append(';');
            sb.append(e.getSalaire() != null ? e.getSalaire().toString() : "").append(';');
            sb.append(e.getSoldeConge() != null ? e.getSoldeConge().toString() : "").append(';');
            sb.append(e.getManager() != null ? e.getManager().getNom() + " " + e.getManager().getPrenom() : "")
                    .append(';');
            sb.append(csvField(e.getRibBancaire()));
            sb.append('\n');
        }
        return sb.toString().getBytes(StandardCharsets.UTF_8);
    }

    private String csvField(String value) {
        if (value == null)
            return "";
        if (value.contains(";") || value.contains("\"") || value.contains("\n")) {
            return "\"" + value.replace("\"", "\"\"") + "\"";
        }
        return value;
    }

    public List<Map<String, Object>> getOrganigramme() {
        // Build tree from root employees (no manager)
        List<Employe> roots = employeRepository.findByManagerIsNullAndArchivedFalse();
        return roots.stream()
                .map(this::buildOrgNode)
                .collect(Collectors.toList());
    }

    private Map<String, Object> buildOrgNode(Employe employe) {
        Map<String, Object> node = new LinkedHashMap<>();
        node.put("id", employe.getId());
        node.put("nom", employe.getNom() + " " + employe.getPrenom());
        node.put("matricule", employe.getMatricule());
        node.put("poste", employe.getPoste());
        node.put("departement", employe.getDepartement());
        node.put("imageUrl", employe.getImageUrl());
        node.put("email", employe.getEmail());
        List<Map<String, Object>> children = employe.getSubordonnes().stream()
                .filter(sub -> !Boolean.TRUE.equals(sub.getArchived()))
                .map(this::buildOrgNode)
                .collect(Collectors.toList());
        node.put("children", children);
        return node;
    }

    /**
     * Salaire, RIB, CIN et CNSS ne sont visibles que par l'employe lui-meme, un admin ou un
     * utilisateur ayant VIEW_EMPLOYES. Hors requete authentifiee (taches planifiees), pas de masquage.
     */
    private boolean canSeeSensitiveData(Employe employe) {
        if (org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication() == null) {
            return true;
        }
        Long me = com.antigone.rh.security.SecurityUtils.currentEmployeIdOrNull();
        if (me != null && me.equals(employe.getId())) {
            return true;
        }
        return com.antigone.rh.security.SecurityUtils.isAdmin()
                || com.antigone.rh.security.SecurityUtils.hasAnyAuthority("VIEW_EMPLOYES");
    }

    public EmployeDTO toDTO(Employe employe) {
        boolean sensitive = canSeeSensitiveData(employe);
        return EmployeDTO.builder()
                .id(employe.getId())
                .matricule(employe.getMatricule())
                .cin(sensitive ? employe.getCin() : null)
                .cnss(sensitive ? employe.getCnss() : null)
                .nom(employe.getNom())
                .prenom(employe.getPrenom())
                .email(employe.getEmail())
                .telephone(employe.getTelephone())
                .telephonePro(employe.getTelephonePro())
                .salaire(sensitive ? employe.getSalaire() : null)
                .dateEmbauche(employe.getDateEmbauche())
                .soldeConge(employe.getSoldeConge())
                .soldeCongeInitial(employe.getSoldeCongeInitial())
                .poste(employe.getPoste())
                .typeContrat(employe.getTypeContrat())
                .dateFinContrat(employe.getDateFinContrat())
                .genre(employe.getGenre())
                .departement(employe.getDepartement())
                .ribBancaire(sensitive ? employe.getRibBancaire() : null)
                .managerId(employe.getManager() != null ? employe.getManager().getId() : null)
                .managerNom(employe.getManager() != null
                        ? employe.getManager().getNom() + " " + employe.getManager().getPrenom()
                        : null)
                .imageUrl(employe.getImageUrl())
                .lienDrive(employe.getLienDrive())
                .archived(employe.getArchived())
                .archivedAt(employe.getArchivedAt())
                .build();
    }

    private Employe toEntity(EmployeDTO dto) {
        return Employe.builder()
                .matricule(dto.getMatricule())
                .cin(dto.getCin())
                .cnss(dto.getCnss())
                .nom(dto.getNom())
                .prenom(dto.getPrenom())
                .email(dto.getEmail())
                .telephone(dto.getTelephone())
                .telephonePro(dto.getTelephonePro())
                .salaire(dto.getSalaire())
                .dateEmbauche(dto.getDateEmbauche())
                .soldeConge(dto.getSoldeConge() != null ? dto.getSoldeConge() : 0.0)
                .soldeCongeInitial(dto.getSoldeCongeInitial())
                .poste(dto.getPoste())
                .typeContrat(dto.getTypeContrat())
                .dateFinContrat(dto.getDateFinContrat())
                .genre(dto.getGenre())
                .departement(dto.getDepartement())
                .ribBancaire(dto.getRibBancaire())
                .imageUrl(dto.getImageUrl())
                .lienDrive(dto.getLienDrive())
                .archived(dto.getArchived() != null ? dto.getArchived() : false)
                .archivedAt(dto.getArchivedAt())
                .build();
    }

    public void archive(Long id) {
        Employe employe = employeRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Employé non trouvé avec l'id: " + id));
        employe.setArchived(true);
        employe.setArchivedAt(LocalDateTime.now());
        
        if (employe.getCompte() != null) {
            employe.getCompte().setEnabled(false);
        }
        
        employeRepository.save(employe);
        
        String nomComplet = employe.getNom() + " " + employe.getPrenom();
        notifyAdmins("Employé archivé", "L'employé " + nomComplet + " (" + employe.getMatricule() + ") a été archivé.");
        if (employe.getManager() != null) {
            notificationService.create(employe.getManager(), "Subordonné archivé", "L'employé " + nomComplet + " a été archivé.", null);
        }
    }

    public void unarchive(Long id) {
        Employe employe = employeRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Employé non trouvé avec l'id: " + id));
        employe.setArchived(false);
        employe.setArchivedAt(null);
	if (employe.getCompte() != null && !Boolean.TRUE.equals(employe.getCompte().getEnabled())) {
            employe.getCompte().setEnabled(true);
        }
        employeRepository.save(employe);
        
        String nomComplet = employe.getNom() + " " + employe.getPrenom();
        notifyAdmins("Employé restauré", "L'employé " + nomComplet + " (" + employe.getMatricule() + ") a été restauré de l'archive.");
    }

    public List<EmployeDTO> findAllArchived() {
        return employeRepository.findAllByArchivedTrue().stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
    }
}
