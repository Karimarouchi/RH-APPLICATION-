package com.antigone.rh.service;

import com.antigone.rh.dto.DemandeRequest;
import com.antigone.rh.dto.DemandeResponse;
import com.antigone.rh.dto.HistoriqueStatutDTO;
import com.antigone.rh.entity.*;
import com.antigone.rh.enums.*;
import com.antigone.rh.repository.*;
import com.antigone.rh.security.SecurityUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.DayOfWeek;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional
public class DemandeService {

    private final DemandeRepository demandeRepository;
    private final EmployeRepository employeRepository;
    private final HistoriqueStatutRepository historiqueStatutRepository;
    private final CalendrierRepository calendrierRepository;
    private final CongeRepository congeRepository;
    private final AutorisationRepository autorisationRepository;
    private final ReferentielRepository referentielRepository;
    private final HoraireTravailRepository horaireTravailRepository;
    private final NotificationService notificationService;
    private final ValidationRepository validationRepository;

    private static final int DEFAULT_MAX_AUTORISATION_MINUTES = 120; // 2h par mois

    // Mapping DayOfWeek → French day names used in HoraireTravail.joursTravail
    private static final Map<DayOfWeek, String> DOW_TO_FRENCH = Map.of(
            DayOfWeek.MONDAY, "LUNDI",
            DayOfWeek.TUESDAY, "MARDI",
            DayOfWeek.WEDNESDAY, "MERCREDI",
            DayOfWeek.THURSDAY, "JEUDI",
            DayOfWeek.FRIDAY, "VENDREDI",
            DayOfWeek.SATURDAY, "SAMEDI",
            DayOfWeek.SUNDAY, "DIMANCHE");

    // =========================================
    // QUERIES
    // =========================================

    public List<DemandeResponse> findAll() {
        return demandeRepository.findAll().stream()
                // ADMINISTRATION demandes are managed exclusively via /demandes-papier —
                // exclude here
                .filter(d -> d.getType() != TypeDemande.ADMINISTRATION)
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    public DemandeResponse findById(Long id) {
        Demande demande = demandeRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Demande non trouvée avec l'id: " + id));
        return toResponse(demande);
    }

    public List<DemandeResponse> findByEmploye(Long employeId) {
        return demandeRepository.findByEmployeId(employeId).stream()
                // ADMINISTRATION demandes are managed exclusively via /demandes-papier —
                // exclude here
                .filter(d -> d.getType() != TypeDemande.ADMINISTRATION)
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    public List<DemandeResponse> findByStatut(StatutDemande statut) {
        return demandeRepository.findByStatut(statut).stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    // =========================================
    // CREATE
    // =========================================

    public DemandeResponse create(DemandeRequest request) {
        Employe employe = employeRepository.findById(request.getEmployeId())
                .orElseThrow(() -> new RuntimeException("Employé non trouvé"));

        Demande demande;

        switch (request.getType()) {
            case CONGE:
                demande = createConge(request, employe);
                break;
            case AUTORISATION:
                demande = createAutorisation(request, employe);
                break;
            case TELETRAVAIL:
                demande = createTeletravail(request, employe);
                break;
            case ADMINISTRATION:
                throw new RuntimeException("Les demandes administratives doivent être créées via /api/demandes-papier");
            default:
                throw new RuntimeException("Type de demande non supporté: " + request.getType());
        }

        demande.setType(request.getType());
        demande.setStatut(StatutDemande.EN_ATTENTE);
        demande.setDateCreation(LocalDateTime.now());
        demande.setRaison(request.getRaison());
        demande.setEmploye(employe);

        Demande saved = demandeRepository.save(demande);
        assignDepartmentHead(saved, employe);
        return toResponse(saved);
    }

    /**
     * La demande d'une personne rattachée à un département part au chef coché de ce département.
     */
    private void assignDepartmentHead(Demande saved, Employe employe) {
        Employe chef = findDepartmentHead(employe.getDepartement());
        if (chef == null || chef.getId().equals(employe.getId())) {
            return;
        }
        validationRepository.save(Validation.builder()
                .demande(saved)
                .validateur(chef)
                .ordre(1)
                .decision(DecisionValidation.EN_ATTENTE)
                .build());
        String nom = ((employe.getPrenom() != null ? employe.getPrenom() : "") + " "
                + (employe.getNom() != null ? employe.getNom() : "")).trim();
        notificationService.create(chef, "Demande à valider",
                nom + " a envoyé une demande. Vous êtes le chef de son département.", saved);
    }

    private Employe findDepartmentHead(String departement) {
        if (departement == null || departement.isBlank()) {
            return null;
        }
        String key = departement.trim().toLowerCase();
        return employeRepository.findAll().stream()
                .filter(e -> !Boolean.TRUE.equals(e.getArchived()))
                .filter(e -> Boolean.TRUE.equals(e.getManagerDepartement()))
                .filter(e -> e.getDepartement() != null && e.getDepartement().trim().toLowerCase().equals(key))
                .findFirst()
                .orElse(null);
    }

    /** Admin et RH valident tout. Sinon, seul le chef du département de l'employé. */
    private void assertDepartmentValidator(Employe cible) {
        if (SecurityUtils.isAdmin() || SecurityUtils.hasAnyAuthority("ROLE_RH")) {
            return;
        }
        if (cible.getDepartement() == null || cible.getDepartement().isBlank()) {
            return;
        }
        Long actorId = SecurityUtils.currentEmployeIdOrNull();
        Employe chef = findDepartmentHead(cible.getDepartement());
        if (chef != null && actorId != null && chef.getId().equals(actorId)) {
            return;
        }
        throw new org.springframework.security.access.AccessDeniedException(
                "Seul le chef de ce département peut valider cette demande");
    }

    private Conge createConge(DemandeRequest request, Employe employe) {
        if (request.getDateDebut() == null || request.getDateFin() == null) {
            throw new RuntimeException("Les dates de début et fin sont obligatoires pour un congé");
        }
        if (request.getDateFin().isBefore(request.getDateDebut())) {
            throw new RuntimeException("La date de fin doit être après la date de début");
        }
        if (request.getDateDebut().isBefore(LocalDate.now())) {
            throw new RuntimeException("La date de début doit être dans le futur");
        }

        TypeConge typeConge = TypeConge.CONGE_PAYE;
        if (request.getTypeConge() != null && !request.getTypeConge().isBlank()) {
            try {
                typeConge = TypeConge.valueOf(request.getTypeConge());
            } catch (IllegalArgumentException e) {
                throw new RuntimeException("Type de congé invalide: " + request.getTypeConge());
            }
        }

        // Check if this type congé is active in referentiels
        final TypeConge finalTypeConge = typeConge;
        referentielRepository.findByLibelleAndTypeReferentiel(typeConge.name(), TypeReferentiel.TYPE_CONGE)
                .ifPresent(ref -> {
                    if (!ref.getActif()) {
                        throw new RuntimeException(
                                "Le type de congé « " + finalTypeConge.getLabel() + " » est actuellement désactivé");
                    }
                });

        // ── Validation du genre pour congé maternité et congé règles (réservés aux
        // femmes) ──
        if ((typeConge == TypeConge.CONGE_MATERNITE || typeConge == TypeConge.CONGE_REGLES)
                && employe.getGenre() != null && !"FEMME".equalsIgnoreCase(employe.getGenre())) {
            String label = typeConge == TypeConge.CONGE_MATERNITE ? "maternité" : "règles";
            throw new RuntimeException("Le congé " + label + " est réservé aux salariées de genre féminin.");
        }

        // Justificatif obligatoire pour maladie, décès et maternité
        if ((typeConge == TypeConge.CONGE_MALADIE
                || typeConge == TypeConge.CONGE_DECES_PROCHE
                || typeConge == TypeConge.CONGE_DECES_FAMILLE
                || typeConge == TypeConge.CONGE_MATERNITE)
                && (request.getJustificatifPath() == null || request.getJustificatifPath().isBlank())) {
            String docName = switch (typeConge) {
                case CONGE_MALADIE -> "certificat médical";
                case CONGE_DECES_PROCHE, CONGE_DECES_FAMILLE -> "attestation de décès";
                case CONGE_MATERNITE -> "certificat médical / attestation d'accouchement";
                default -> "justificatif";
            };
            throw new RuntimeException("Un " + docName + " est obligatoire pour ce type de congé");
        }

        // Calculate effective days (includes trailing weekends/holidays + pont rule)
        Map<String, Object> calcResult = computeEffectiveDays(request.getDateDebut(), request.getDateFin(),
                typeConge.name());
        int nombreJours = (int) calcResult.get("nombreJours");
        int joursOuvrables = (int) calcResult.get("joursOuvrables");
        if (joursOuvrables == 0) {
            throw new RuntimeException("La période choisie ne contient aucun jour ouvrable (week-end ou jours fériés uniquement).");
        }

        // Congé maladie: max 2 jours ouvrables
        if (typeConge == TypeConge.CONGE_MALADIE && joursOuvrables > 2) {
            throw new RuntimeException("Le congé maladie est limité à 2 jours ouvrables maximum. "
                    + "Vous avez sélectionné " + joursOuvrables + " jour(s) ouvrable(s). "
                    + "Au-delà de 2 jours, un certificat médical prolongé et l'accord du responsable sont requis.");
        }

        // Congé règles: 1 seul jour
        if (typeConge == TypeConge.CONGE_REGLES && joursOuvrables > 1) {
            throw new RuntimeException("Le congé règles est limité à 1 jour ouvrable uniquement.");
        }

        // Congé maternité: max 2 mois (60 jours calendaires), prolongation max 1 mois
        // (90 jours total)
        if (typeConge == TypeConge.CONGE_MATERNITE) {
            long joursCal = ChronoUnit.DAYS.between(request.getDateDebut(), request.getDateFin()) + 1;
            if (joursCal > 90) {
                throw new RuntimeException("Le congé maternité est limité à 2 mois (60 jours) "
                        + "avec une prolongation exceptionnelle d'un mois maximum (90 jours au total). "
                        + "Durée demandée : " + joursCal + " jours.");
            }
        }

        // Congé décès: override nombre de jours selon le règlement
        if (typeConge == TypeConge.CONGE_DECES_PROCHE) {
            nombreJours = 5; // 5 jours pour parent, grand-parent ou enfant
        } else if (typeConge == TypeConge.CONGE_DECES_FAMILLE) {
            nombreJours = 1; // 1 jour pour autre membre de la famille
        }

        if (nombreJours == 0) {
            throw new RuntimeException("La période sélectionnée ne contient aucun jour ouvrable");
        }

        // Règle des 3× : la demande doit être faite 3 × nombre_de_jours à l'avance
        // S'applique uniquement au congé payé
        if (typeConge == TypeConge.CONGE_PAYE) {
            int delaiMinJours = nombreJours * 3;
            LocalDate dateLimite = LocalDate.now().plusDays(delaiMinJours);
            if (request.getDateDebut().isBefore(dateLimite)) {
                throw new RuntimeException("Selon le règlement, la demande de " + nombreJours
                        + " jour(s) doit être faite au moins " + delaiMinJours
                        + " jours à l'avance. Date de début au plus tôt : " + dateLimite);
            }
        }

        // Friday-only rule: congé uniquement vendredi → doit être CONGE_SANS_SOLDE
        if (typeConge == TypeConge.CONGE_PAYE && isOnlyFridays(request.getDateDebut(), request.getDateFin())) {
            throw new RuntimeException("Un congé uniquement le vendredi doit être de type 'Congé sans solde'");
        }

        // Check overlap with existing congés
        List<Conge> overlapping = congeRepository.findOverlapping(
                employe.getId(), request.getDateDebut(), request.getDateFin());
        if (!overlapping.isEmpty()) {
            throw new RuntimeException("Un congé existe déjà pour cette période");
        }

        // Check solde for paid leave (use joursOuvrables for deduction, not full
        // calendar span)
        if (typeConge == TypeConge.CONGE_PAYE) {
            double solde = employe.getSoldeConge() != null ? employe.getSoldeConge() : 0;
            if (solde < nombreJours) {
                throw new RuntimeException("Solde congé insuffisant. Solde actuel: "
                        + solde + " jours, Demandé: " + nombreJours + " jour(s) effectif(s)");
            }
        }

        Conge conge = new Conge();
        conge.setDateDebut(request.getDateDebut());
        conge.setDateFin(request.getDateFin());
        conge.setTypeConge(typeConge);
        conge.setNombreJours(nombreJours);
        conge.setJoursOuvrables(joursOuvrables);
        conge.setJustificatifPath(request.getJustificatifPath());
        return conge;
    }

    private Autorisation createAutorisation(DemandeRequest request, Employe employe) {
        if (request.getDate() == null) {
            throw new RuntimeException("La date est obligatoire pour une autorisation");
        }
        if (request.getHeureDebut() == null || request.getHeureFin() == null) {
            throw new RuntimeException("Les heures de début et fin sont obligatoires");
        }
        if (!request.getHeureFin().isAfter(request.getHeureDebut())) {
            throw new RuntimeException("L'heure de fin doit être après l'heure de début");
        }

        long dureeMinutes = Duration.between(request.getHeureDebut(), request.getHeureFin()).toMinutes();

        // Get max allowed minutes from system parameters
        int maxMinutes = getMaxAutorisationMinutes();

        // ── Validate single autorisation duration ≤ max allowed ──
        if (dureeMinutes > maxMinutes) {
            throw new RuntimeException("La durée d'une autorisation ne peut pas dépasser "
                    + (maxMinutes / 60) + "h" + String.format("%02d", maxMinutes % 60)
                    + ". Durée demandée : " + dureeMinutes + " minutes.");
        }

        // ── Validate against company working hours (from HoraireTravail) ──
        HoraireTravail horaire = getDefaultHoraire();
        String jourDemande = DOW_TO_FRENCH.get(request.getDate().getDayOfWeek());

        // Check the day is a working day
        List<String> joursTravailTrimmed = Arrays.stream(horaire.getJoursTravail().split(","))
                .map(String::trim).map(String::toUpperCase).collect(Collectors.toList());
        if (!joursTravailTrimmed.contains(jourDemande)) {
            throw new RuntimeException("Vous ne travaillez pas le " + jourDemande.toLowerCase()
                    + ". Les jours de travail sont : " + String.join(", ", joursTravailTrimmed));
        }

        // Check heureDebut and heureFin fall within company working hours
        LocalTime travailDebut = horaire.getHeureDebut();
        LocalTime travailFin = horaire.getHeureFin();

        if (request.getHeureDebut().isBefore(travailDebut)) {
            throw new RuntimeException("L'heure de début (" + request.getHeureDebut()
                    + ") est avant le début du travail (" + travailDebut + ")");
        }
        if (request.getHeureFin().isAfter(travailFin)) {
            throw new RuntimeException("L'heure de fin (" + request.getHeureFin()
                    + ") est après la fin du travail (" + travailFin + ")");
        }

        // Calculate total used this month (EN_ATTENTE + APPROUVEE)
        LocalDate premierJourMois = request.getDate().withDayOfMonth(1);
        LocalDate dernierJourMois = request.getDate().withDayOfMonth(request.getDate().lengthOfMonth());

        List<Autorisation> monthlyAuth = autorisationRepository.findByEmployeIdAndDateBetweenAndStatutIn(
                employe.getId(), premierJourMois, dernierJourMois,
                List.of(StatutDemande.EN_ATTENTE, StatutDemande.APPROUVEE));

        long totalUsedMinutes = monthlyAuth.stream()
                .mapToLong(a -> Duration.between(a.getHeureDebut(), a.getHeureFin()).toMinutes())
                .sum();

        if (totalUsedMinutes + dureeMinutes > maxMinutes) {
            long remaining = Math.max(0, maxMinutes - totalUsedMinutes);
            throw new RuntimeException("Quota d'autorisation mensuel dépassé. Restant: "
                    + remaining + " minutes (" + (remaining / 60) + "h" + String.format("%02d", remaining % 60) + ")");
        }

        Autorisation autorisation = new Autorisation();
        autorisation.setDate(request.getDate());
        autorisation.setHeureDebut(request.getHeureDebut());
        autorisation.setHeureFin(request.getHeureFin());
        return autorisation;
    }

    private Teletravail createTeletravail(DemandeRequest request, Employe employe) {
        if (request.getDateDebut() == null || request.getDateFin() == null) {
            throw new RuntimeException("Les dates de début et fin sont obligatoires pour le télétravail");
        }
        if (request.getDateFin().isBefore(request.getDateDebut())) {
            throw new RuntimeException("La date de fin doit être après la date de début");
        }

        Teletravail teletravail = new Teletravail();
        teletravail.setDateDebut(request.getDateDebut());
        teletravail.setDateFin(request.getDateFin());
        return teletravail;
    }

    // =========================================
    // UPDATE (only EN_ATTENTE)
    // =========================================

    public DemandeResponse update(Long demandeId, DemandeRequest request) {
        Demande demande = demandeRepository.findById(demandeId)
                .orElseThrow(() -> new RuntimeException("Demande non trouvée"));
        SecurityUtils.requireSelfOrAny(demande.getEmploye().getId(), "VIEW_DEMANDES");

        if (demande.getStatut() != StatutDemande.EN_ATTENTE) {
            throw new RuntimeException("Seules les demandes en attente peuvent être modifiées");
        }

        demande.setRaison(request.getRaison());

        if (demande instanceof Conge conge) {
            updateConge(conge, request, demande.getEmploye());
        } else if (demande instanceof Autorisation autorisation) {
            updateAutorisation(autorisation, request, demande.getEmploye());
        } else if (demande instanceof Teletravail teletravail) {
            updateTeletravail(teletravail, request);
        }

        Demande saved = demandeRepository.save(demande);
        return toResponse(saved);
    }

    private void updateConge(Conge conge, DemandeRequest request, Employe employe) {
        if (request.getDateDebut() == null || request.getDateFin() == null) {
            throw new RuntimeException("Les dates de début et fin sont obligatoires pour un congé");
        }
        if (request.getDateFin().isBefore(request.getDateDebut())) {
            throw new RuntimeException("La date de fin doit être après la date de début");
        }
        if (request.getDateDebut().isBefore(LocalDate.now())) {
            throw new RuntimeException("La date de début doit être dans le futur");
        }

        TypeConge typeConge = TypeConge.CONGE_PAYE;
        if (request.getTypeConge() != null && !request.getTypeConge().isBlank()) {
            typeConge = TypeConge.valueOf(request.getTypeConge());
        }

        // Justificatif obligatoire for certain types
        if ((typeConge == TypeConge.CONGE_MALADIE
                || typeConge == TypeConge.CONGE_DECES_PROCHE
                || typeConge == TypeConge.CONGE_DECES_FAMILLE
                || typeConge == TypeConge.CONGE_MATERNITE)
                && (request.getJustificatifPath() == null || request.getJustificatifPath().isBlank())
                && (conge.getJustificatifPath() == null || conge.getJustificatifPath().isBlank())) {
            throw new RuntimeException("Un justificatif est obligatoire pour ce type de congé");
        }

        Map<String, Object> calcResult = computeEffectiveDays(request.getDateDebut(), request.getDateFin(),
                typeConge.name());
        int nombreJours = (int) calcResult.get("nombreJours");
        int joursOuvrables = (int) calcResult.get("joursOuvrables");
        if (joursOuvrables == 0) {
            throw new RuntimeException("La période choisie ne contient aucun jour ouvrable (week-end ou jours fériés uniquement).");
        }

        if (typeConge == TypeConge.CONGE_DECES_PROCHE)
            nombreJours = 5;
        else if (typeConge == TypeConge.CONGE_DECES_FAMILLE)
            nombreJours = 1;

        if (nombreJours == 0) {
            throw new RuntimeException("La période sélectionnée ne contient aucun jour ouvrable");
        }

        // Check solde for paid leave (use nombreJours = jours effectifs)
        if (typeConge == TypeConge.CONGE_PAYE) {
            double solde = employe.getSoldeConge() != null ? employe.getSoldeConge() : 0;
            if (solde < nombreJours) {
                throw new RuntimeException("Solde congé insuffisant. Solde actuel: "
                        + solde + " jours, Demandé: " + nombreJours + " jour(s) effectif(s)");
            }
        }

        conge.setTypeConge(typeConge);
        conge.setDateDebut(request.getDateDebut());
        conge.setDateFin(request.getDateFin());
        conge.setNombreJours(nombreJours);
        conge.setJoursOuvrables(joursOuvrables);
        if (request.getJustificatifPath() != null && !request.getJustificatifPath().isBlank()) {
            conge.setJustificatifPath(request.getJustificatifPath());
        }
    }

    private void updateAutorisation(Autorisation autorisation, DemandeRequest request, Employe employe) {
        if (request.getDate() == null) {
            throw new RuntimeException("La date est obligatoire pour une autorisation");
        }
        if (request.getHeureDebut() == null || request.getHeureFin() == null) {
            throw new RuntimeException("Les heures de début et fin sont obligatoires");
        }
        if (!request.getHeureFin().isAfter(request.getHeureDebut())) {
            throw new RuntimeException("L'heure de fin doit être après l'heure de début");
        }

        autorisation.setDate(request.getDate());
        autorisation.setHeureDebut(request.getHeureDebut());
        autorisation.setHeureFin(request.getHeureFin());
    }

    private void updateTeletravail(Teletravail teletravail, DemandeRequest request) {
        if (request.getDateDebut() == null || request.getDateFin() == null) {
            throw new RuntimeException("Les dates de début et fin sont obligatoires pour le télétravail");
        }
        if (request.getDateFin().isBefore(request.getDateDebut())) {
            throw new RuntimeException("La date de fin doit être après la date de début");
        }

        teletravail.setDateDebut(request.getDateDebut());
        teletravail.setDateFin(request.getDateFin());
    }

    // =========================================
    // APPROVE / REFUSE / CANCEL
    // =========================================

    public DemandeResponse approve(Long demandeId, Long adminEmployeId) {
        Demande demande = demandeRepository.findById(demandeId)
                .orElseThrow(() -> new RuntimeException("Demande non trouvée"));
        Employe admin = employeRepository.findById(adminEmployeId)
                .orElseThrow(() -> new RuntimeException("Administrateur non trouvé"));

        if (demande.getStatut() != StatutDemande.EN_ATTENTE) {
            throw new RuntimeException("Seules les demandes en attente peuvent être approuvées");
        }
        assertDepartmentValidator(demande.getEmploye());
        if (!SecurityUtils.isAdmin() && demande.getEmploye().getId().equals(adminEmployeId)) {
            throw new org.springframework.security.access.AccessDeniedException("Auto-approbation interdite");
        }

        StatutDemande ancien = demande.getStatut();
        demande.setStatut(StatutDemande.APPROUVEE);
        demandeRepository.save(demande);

        // Deduct solde for paid leave (use nombreJours = jours effectifs)
        if (demande instanceof Conge conge && conge.getTypeConge() == TypeConge.CONGE_PAYE) {
            Employe employe = demande.getEmploye();
            double solde = employe.getSoldeConge() != null ? employe.getSoldeConge() : 0;
            int toDeduct = conge.getNombreJours() != null ? conge.getNombreJours() : 0;
            employe.setSoldeConge(solde - toDeduct);
            employeRepository.save(employe);
        }

        saveHistorique(demande, ancien, StatutDemande.APPROUVEE, admin);

        // Send notification to the employee
        String typeLabel = demande.getType().name();
        if (demande instanceof Conge conge) {
            typeLabel = conge.getTypeConge().getLabel();
        }
        notificationService.create(
                demande.getEmploye(),
                "Demande approuvée",
                "Votre demande de " + typeLabel + " a été approuvée par " + admin.getNom() + " " + admin.getPrenom()
                        + ".",
                demande);

        return toResponse(demande);
    }

    public DemandeResponse refuse(Long demandeId, Long adminEmployeId, String commentaire) {
        Demande demande = demandeRepository.findById(demandeId)
                .orElseThrow(() -> new RuntimeException("Demande non trouvée"));
        Employe admin = employeRepository.findById(adminEmployeId)
                .orElseThrow(() -> new RuntimeException("Administrateur non trouvé"));

        if (demande.getStatut() != StatutDemande.EN_ATTENTE) {
            throw new RuntimeException("Seules les demandes en attente peuvent être refusées");
        }
        assertDepartmentValidator(demande.getEmploye());

        StatutDemande ancien = demande.getStatut();
        demande.setStatut(StatutDemande.REFUSEE);
        demande.setMotifRefus(commentaire);
        demandeRepository.save(demande);

        saveHistorique(demande, ancien, StatutDemande.REFUSEE, admin, commentaire);

        // Send notification to the employee with motif
        String typeLabel = demande.getType().name();
        if (demande instanceof Conge conge) {
            typeLabel = conge.getTypeConge().getLabel();
        }
        String message = "Votre demande de " + typeLabel + " a été refusée par " + admin.getNom() + " "
                + admin.getPrenom() + ".";
        if (commentaire != null && !commentaire.isBlank()) {
            message += "\nMotif : " + commentaire;
        }
        notificationService.create(
                demande.getEmploye(),
                "Demande refusée",
                message,
                demande);

        return toResponse(demande);
    }

    public DemandeResponse cancel(Long demandeId) {
        Demande demande = demandeRepository.findById(demandeId)
                .orElseThrow(() -> new RuntimeException("Demande non trouvée"));
        SecurityUtils.requireSelfOrAny(demande.getEmploye().getId(), "VIEW_DEMANDES");

        if (demande.getStatut() != StatutDemande.EN_ATTENTE) {
            throw new RuntimeException("Seules les demandes en attente peuvent être annulées");
        }

        StatutDemande ancien = demande.getStatut();
        demande.setStatut(StatutDemande.ANNULEE);
        demandeRepository.save(demande);

        saveHistorique(demande, ancien, StatutDemande.ANNULEE, demande.getEmploye());
        return toResponse(demande);
    }

    // =========================================
    // BATCH ACTIONS
    // =========================================

    public List<DemandeResponse> batchApprove(List<Long> demandeIds, Long adminEmployeId) {
        return demandeIds.stream()
                .map(id -> {
                    try {
                        return approve(id, adminEmployeId);
                    } catch (RuntimeException e) {
                        return null;
                    }
                })
                .filter(r -> r != null)
                .collect(Collectors.toList());
    }

    public List<DemandeResponse> batchRefuse(List<Long> demandeIds, Long adminEmployeId, String commentaire) {
        return demandeIds.stream()
                .map(id -> {
                    try {
                        return refuse(id, adminEmployeId, commentaire);
                    } catch (RuntimeException e) {
                        return null;
                    }
                })
                .filter(r -> r != null)
                .collect(Collectors.toList());
    }

    // =========================================
    // HISTORIQUE
    // =========================================

    public List<HistoriqueStatutDTO> getHistorique(Long demandeId) {
        return historiqueStatutRepository.findByDemandeIdOrderByDateChangementDesc(demandeId)
                .stream()
                .map(h -> HistoriqueStatutDTO.builder()
                        .id(h.getId())
                        .ancienStatut(h.getAncienStatut().name())
                        .nouveauStatut(h.getNouveauStatut().name())
                        .dateChangement(h.getDateChangement())
                        .modifieParNom(h.getModifiePar() != null
                                ? h.getModifiePar().getNom() + " " + h.getModifiePar().getPrenom()
                                : null)
                        .commentaire(h.getCommentaire())
                        .build())
                .collect(Collectors.toList());
    }

    // =========================================
    // BUSINESS LOGIC HELPERS
    // =========================================

    /**
     * Check if a date is a non-working day based on HoraireTravail working days and
     * holidays.
     */
    private boolean isNonWorkingDay(LocalDate date, Set<LocalDate> holidays) {
        if (holidays.contains(date))
            return true;
        HoraireTravail horaire = getDefaultHoraire();
        String jourFr = DOW_TO_FRENCH.get(date.getDayOfWeek());
        List<String> joursTravail = Arrays.stream(horaire.getJoursTravail().split(","))
                .map(String::trim).map(String::toUpperCase).collect(Collectors.toList());
        return !joursTravail.contains(jourFr);
    }

    /**
     * Get the default (first) HoraireTravail, or build a sensible fallback.
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
     * Compute effective leave days including trailing weekends/holidays and pont
     * rule.
     *
     * Rules:
     * - Forward extension: after dateFin, include consecutive non-working days
     * (weekends+holidays)
     * e.g. Friday leave → Fri+Sat+Sun = 3 days
     * - Backward extension (pont): before dateDebut, include consecutive holidays
     * (not weekends)
     * e.g. Thursday is holiday + Friday leave → Thu+Fri+Sat+Sun = 4 days
     * - The total is the calendar days from extendedStart to extendedEnd
     */
    public Map<String, Object> computeEffectiveDays(LocalDate dateDebut, LocalDate dateFin, String typeCongeStr) {
        // Fetch holidays around the period (extra margin for extensions)
        Set<LocalDate> holidays = calendrierRepository
                .findByTypeJourAndDateJourBetween(TypeJour.FERIE,
                        dateDebut.minusDays(10), dateFin.plusDays(10))
                .stream()
                .map(Calendrier::getDateJour)
                .collect(Collectors.toSet());

        // Check that there's at least one working day in the range
        boolean hasWorkingDays = false;
        LocalDate cur = dateDebut;
        while (!cur.isAfter(dateFin)) {
            if (!isNonWorkingDay(cur, holidays)) {
                hasWorkingDays = true;
                break;
            }
            cur = cur.plusDays(1);
        }
        if (!hasWorkingDays) {
            return Map.of("nombreJours", 0, "joursOuvrables", 0, "details", "Aucun jour ouvrable dans la période",
                    "dateDebutEffective", dateDebut.toString(), "dateFinEffective", dateFin.toString());
        }

        // Count base working days
        int joursOuvrables = 0;
        cur = dateDebut;
        while (!cur.isAfter(dateFin)) {
            if (!isNonWorkingDay(cur, holidays)) {
                joursOuvrables++;
            }
            cur = cur.plusDays(1);
        }

        // ── Règlement 7.2.1 : jours fériés "sandwichés" ──
        // "Si le salarié demande des jours de congé avant et après une fête
        // nationale ou religieuse, ces derniers lui seront comptabilisés
        // dans leur quota de congés."
        // → weekday holidays between the first and last working day of the
        // leave period count as working days for deduction.
        int joursFeriesSandwiches = 0;
        LocalDate firstWorkDay = null;
        LocalDate lastWorkDay = null;
        cur = dateDebut;
        while (!cur.isAfter(dateFin)) {
            if (!isNonWorkingDay(cur, holidays)) {
                if (firstWorkDay == null)
                    firstWorkDay = cur;
                lastWorkDay = cur;
            }
            cur = cur.plusDays(1);
        }
        if (firstWorkDay != null && lastWorkDay != null && firstWorkDay.isBefore(lastWorkDay)) {
            cur = firstWorkDay.plusDays(1);
            while (cur.isBefore(lastWorkDay)) {
                DayOfWeek dow = cur.getDayOfWeek();
                if (holidays.contains(cur) && dow != DayOfWeek.SATURDAY && dow != DayOfWeek.SUNDAY) {
                    joursFeriesSandwiches++;
                }
                cur = cur.plusDays(1);
            }
        }
        joursOuvrables += joursFeriesSandwiches;

        // Forward and backward extensions are strictly removed to only count what is
        // mathematically between dateDebut and dateFin.
        LocalDate extendedStart = dateDebut;
        LocalDate extendedEnd = dateFin;

        int nombreJours = (int) ChronoUnit.DAYS.between(extendedStart, extendedEnd) + 1;

        // Build details
        List<String> detailParts = new ArrayList<>();
        detailParts.add((joursOuvrables - joursFeriesSandwiches) + " jour(s) ouvrable(s)");
        if (joursFeriesSandwiches > 0) {
            detailParts.add("+" + joursFeriesSandwiches + "j férié(s) comptabilisé(s) (règlement 7.2.1)");
        }

        int includedNonWorking = nombreJours - joursOuvrables;
        if (includedNonWorking > 0) {
            detailParts.add("+" + includedNonWorking + "j (weekends/fériés inclus)");
        }

        String details = String.join(" ", detailParts) + " = " + nombreJours + " jour(s) effectif(s)";

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("nombreJours", nombreJours);
        result.put("joursOuvrables", joursOuvrables);
        result.put("details", details);
        result.put("dateDebutEffective", extendedStart.toString());
        result.put("dateFinEffective", extendedEnd.toString());
        return result;
    }

    /**
     * Calculate working days between two dates, using HoraireTravail working days
     * and holidays.
     */
    private int calculateWorkingDays(LocalDate start, LocalDate end) {
        Set<LocalDate> holidays = calendrierRepository
                .findByTypeJourAndDateJourBetween(TypeJour.FERIE, start, end)
                .stream()
                .map(Calendrier::getDateJour)
                .collect(Collectors.toSet());

        HoraireTravail horaire = getDefaultHoraire();
        Set<String> joursTravail = Arrays.stream(horaire.getJoursTravail().split(","))
                .map(String::trim).map(String::toUpperCase).collect(Collectors.toSet());

        int workingDays = 0;
        LocalDate current = start;
        while (!current.isAfter(end)) {
            String jourFr = DOW_TO_FRENCH.get(current.getDayOfWeek());
            if (joursTravail.contains(jourFr) && !holidays.contains(current)) {
                workingDays++;
            }
            current = current.plusDays(1);
        }
        return workingDays;
    }

    /**
     * Check if all working days in the period are only Fridays.
     * Friday-only congé = must be congé sans solde.
     */
    private boolean isOnlyFridays(LocalDate start, LocalDate end) {
        Set<LocalDate> holidays = calendrierRepository
                .findByTypeJourAndDateJourBetween(TypeJour.FERIE, start, end)
                .stream()
                .map(Calendrier::getDateJour)
                .collect(Collectors.toSet());

        HoraireTravail horaire = getDefaultHoraire();
        Set<String> joursTravail = Arrays.stream(horaire.getJoursTravail().split(","))
                .map(String::trim).map(String::toUpperCase).collect(Collectors.toSet());

        LocalDate current = start;
        while (!current.isAfter(end)) {
            String jourFr = DOW_TO_FRENCH.get(current.getDayOfWeek());
            if (joursTravail.contains(jourFr) && !holidays.contains(current)) {
                if (current.getDayOfWeek() != DayOfWeek.FRIDAY) {
                    return false;
                }
            }
            current = current.plusDays(1);
        }
        return true;
    }

    /**
     * Get max autorisation minutes per month from system parameters.
     */
    private int getMaxAutorisationMinutes() {
        return referentielRepository
                .findByLibelleAndTypeReferentiel("MAX_AUTORISATION_MINUTES", TypeReferentiel.PARAMETRE_SYSTEME)
                .map(ref -> {
                    try {
                        return Integer.parseInt(ref.getValeur());
                    } catch (NumberFormatException e) {
                        return DEFAULT_MAX_AUTORISATION_MINUTES;
                    }
                })
                .orElse(DEFAULT_MAX_AUTORISATION_MINUTES);
    }

    /**
     * Get a string referentiel value, or return the default.
     */
    private String getRefStringValue(String libelle, String defaultValue) {
        return referentielRepository
                .findByLibelleAndTypeReferentiel(libelle, TypeReferentiel.PARAMETRE_SYSTEME)
                .map(ref -> ref.getValeur() != null ? ref.getValeur() : defaultValue)
                .orElse(defaultValue);
    }

    // =========================================
    // HISTORIQUE
    // =========================================

    private void saveHistorique(Demande demande, StatutDemande ancien, StatutDemande nouveau, Employe employe) {
        saveHistorique(demande, ancien, nouveau, employe, null);
    }

    private void saveHistorique(Demande demande, StatutDemande ancien, StatutDemande nouveau, Employe employe,
            String commentaire) {
        HistoriqueStatut historique = HistoriqueStatut.builder()
                .demande(demande)
                .ancienStatut(ancien)
                .nouveauStatut(nouveau)
                .dateChangement(LocalDateTime.now())
                .modifiePar(employe)
                .commentaire(commentaire)
                .build();
        historiqueStatutRepository.save(historique);
    }

    // =========================================
    // MAPPER
    // =========================================

    public DemandeResponse toResponse(Demande demande) {
        DemandeResponse.DemandeResponseBuilder builder = DemandeResponse.builder()
                .id(demande.getId())
                .type(demande.getType())
                .dateCreation(demande.getDateCreation())
                .statut(demande.getStatut())
                .raison(demande.getRaison())
                .motifRefus(demande.getMotifRefus())
                .employeId(demande.getEmploye().getId())
                .employeNom(demande.getEmploye().getNom() + " " + demande.getEmploye().getPrenom());

        if (demande instanceof Conge conge) {
            builder.dateDebut(conge.getDateDebut());
            builder.dateFin(conge.getDateFin());
            builder.typeConge(conge.getTypeConge().name());
            builder.typeCongeLabel(conge.getTypeConge().getLabel());
            builder.nombreJours(conge.getNombreJours());
            builder.joursOuvrables(conge.getJoursOuvrables());
            builder.justificatifPath(conge.getJustificatifPath());
        } else if (demande instanceof Autorisation autorisation) {
            builder.date(autorisation.getDate());
            builder.heureDebut(autorisation.getHeureDebut());
            builder.heureFin(autorisation.getHeureFin());
            builder.dureeMinutes(
                    Duration.between(autorisation.getHeureDebut(), autorisation.getHeureFin()).toMinutes());
        } else if (demande instanceof Teletravail teletravail) {
            builder.dateDebut(teletravail.getDateDebut());
            builder.dateFin(teletravail.getDateFin());
        }

        return builder.build();
    }
}
