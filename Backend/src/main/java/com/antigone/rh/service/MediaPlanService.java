package com.antigone.rh.service;

import com.antigone.rh.dto.MediaPlanDTO;
import com.antigone.rh.dto.MediaPlanRequest;
import com.antigone.rh.dto.ProjetRequest;
import com.antigone.rh.entity.Client;
import com.antigone.rh.entity.Employe;
import com.antigone.rh.entity.MediaPlan;
import com.antigone.rh.entity.MediaPlanAssignment;
import com.antigone.rh.enums.EtatPublication;
import com.antigone.rh.enums.StatutMediaPlan;
import com.antigone.rh.enums.TypeContenuShooting;
import com.antigone.rh.exception.ResourceNotFoundException;
import com.antigone.rh.repository.ClientRepository;
import com.antigone.rh.repository.EmployeRepository;
import com.antigone.rh.repository.MediaPlanAssignmentRepository;
import com.antigone.rh.repository.MediaPlanRepository;
import com.antigone.rh.repository.ProjetRepository;
import com.antigone.rh.security.SecurityUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional
@Slf4j
public class MediaPlanService {

    private final MediaPlanRepository mediaPlanRepository;
    private final MediaPlanAssignmentRepository assignmentRepository;
    private final ClientRepository clientRepository;
    private final EmployeRepository employeRepository;
    private final ProjetService projetService;
    private final ProjetRepository projetRepository;
    private final com.antigone.rh.repository.TacheRepository tacheRepository;
    private final GoogleDriveService googleDriveService;
    private final MediaPlanShootingWorkflowService mediaPlanShootingWorkflowService;
    private final com.antigone.rh.repository.ReactifInternRepository reactifInternRepository;
    private final com.antigone.rh.repository.CalendrierProjetRepository calendrierProjetRepository;
    private final NotificationService notificationService;
    private final ReactifInternService reactifInternService;

    private static final List<String> CHAMPS_CLIENT = List.of(
            "datePublication", "heure", "format", "type", "titre", "texteSurVisuel",
            "inspiration", "autresElements", "platforme", "lienDrive", "etatPublication");

    // =============================================
    // QUERIES
    // =============================================

    public List<MediaPlanDTO> findAll() {
        return mediaPlanRepository.findAll().stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    public MediaPlanDTO findById(Long id) {
        MediaPlan mp = mediaPlanRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("MediaPlan", id));
        return toDTO(mp);
    }

    public List<MediaPlanDTO> findByClientId(Long clientId) {
        return mediaPlanRepository.findByClientId(clientId).stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    /**
     * Find media plans for clients assigned to the given employee.
     */
    public List<MediaPlanDTO> findByAssignedEmploye(Long employeId) {
        List<MediaPlanAssignment> assignments = assignmentRepository.findByEmployeId(employeId);
        if (assignments.isEmpty()) {
            return List.of();
        }
        List<Long> clientIds = assignments.stream()
                .map(a -> a.getClient().getId())
                .collect(Collectors.toList());
        return mediaPlanRepository.findByClientIdIn(clientIds).stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    // =============================================
    // CREATE / UPDATE / DELETE
    // =============================================

    public MediaPlanDTO create(MediaPlanRequest request) {
        Client client = clientRepository.findById(request.getClientId())
                .orElseThrow(() -> new ResourceNotFoundException("Client", request.getClientId()));
        Employe createur = employeRepository.findById(request.getCreateurId())
                .orElseThrow(() -> new ResourceNotFoundException("Employe", request.getCreateurId()));

        MediaPlan mp = MediaPlan.builder()
                .datePublication(
                        request.getDatePublication() != null ? LocalDate.parse(request.getDatePublication()) : null)
                .heure(request.getHeure())
                .format(request.getFormat())
                .type(request.getType())
                .titre(request.getTitre())
                .texteSurVisuel(request.getTexteSurVisuel())
                .inspiration(request.getInspiration())
                .autresElements(request.getAutresElements())
                .platforme(request.getPlatforme())
                .lienDrive(request.getLienDrive())
                .etatPublication(request.getEtatPublication() != null
                        ? EtatPublication.valueOf(request.getEtatPublication())
                        : EtatPublication.PAS_ENCORE)
                .rectifs(request.getRectifs())
                .remarques(request.getRemarques())
                .isShooting(Boolean.TRUE.equals(request.getIsShooting()))
                .shootingDescription(request.getShootingDescription())
                .shootingLocalisation(request.getShootingLocalisation())
                .shootingDate(parseLocalDateOrNull(request.getShootingDate()))
                .shootingAuPlusTard(parseLocalDateOrNull(request.getShootingAuPlusTard()))
                .clientDoitValiderDate(Boolean.TRUE.equals(request.getClientDoitValiderDate()))
                .shootingTypeDeContenu(parseTypeContenuOrNull(request.getShootingTypeDeContenu()))
                .statut(StatutMediaPlan.EN_ATTENTE)
                .client(client)
                .createur(createur)
                .build();

        MediaPlan saved = mediaPlanRepository.save(mp);
        notifyValidators("Le média plan '" + saved.getTitre() + "' a été envoyé pour validation.");
        return toDTO(saved);
    }

    public List<MediaPlanDTO> createBulk(List<MediaPlanRequest> requests) {
        if (requests == null || requests.isEmpty()) {
            return List.of();
        }

        String driveLink = null;
        try {
            // Get client name for folder naming
            Long firstClientId = requests.get(0).getClientId();
            if (firstClientId == null) {
                throw new RuntimeException("ClientId manquant pour le premier media plan du lot");
            }
            Client client = clientRepository.findById(firstClientId).orElse(null);
            String clientName = client != null ? client.getNom() : "Inconnu";

            // Use the publication date of the first item to determine the month folder
            // (fall back to today if no date provided)
            LocalDate folderDate = LocalDate.now();
            String firstDatePub = requests.get(0).getDatePublication();
            if (firstDatePub != null && !firstDatePub.isBlank()) {
                try {
                    folderDate = LocalDate.parse(firstDatePub);
                } catch (Exception ignored) {
                    log.warn("Could not parse datePublication '{}', using today for folder name.", firstDatePub);
                }
            }

            // Look up the pre-built Drive folder: ClientName / Year / Month / Mediaplan
            driveLink = googleDriveService.getExistingMediaPlanFolderLink(clientName, folderDate);
            if (driveLink == null) {
                log.warn("Pre-built Drive folder not found for client '{}' / date '{}'. Falling back to getOrCreate.", clientName, folderDate);
                driveLink = googleDriveService.getOrCreateClientMonthFolder(clientName, folderDate);
            }
        } catch (IOException e) {
            log.error("Failed to create Google Drive folder: {}", e.getMessage());
            throw new RuntimeException("Erreur Google Drive: " + e.getMessage());
        }

        List<MediaPlan> savedPlans = new ArrayList<>();
        for (MediaPlanRequest req : requests) {
            Client client = clientRepository.findById(req.getClientId())
                    .orElseThrow(() -> new ResourceNotFoundException("Client", req.getClientId()));
            Employe createur = employeRepository.findById(req.getCreateurId())
                    .orElseThrow(() -> new ResourceNotFoundException("Employe", req.getCreateurId()));

            // Parse date Publication safely
            LocalDate datePub = null;
            if (req.getDatePublication() != null && !req.getDatePublication().isBlank()) {
                try {
                    datePub = LocalDate.parse(req.getDatePublication());
                } catch (Exception e) {
                    throw new RuntimeException("Format de date invalide pour '"
                            + (req.getTitre() != null ? req.getTitre() : "ligne sans titre") + "': "
                            + req.getDatePublication());
                }
            }

            // Parse EtatPublication safely
            EtatPublication etatPub = EtatPublication.PAS_ENCORE;
            if (req.getEtatPublication() != null && !req.getEtatPublication().isBlank()) {
                try {
                    etatPub = EtatPublication.valueOf(req.getEtatPublication());
                } catch (IllegalArgumentException e) {
                    log.warn("Unknown EtatPublication value: {}, falling back to PAS_ENCORE", req.getEtatPublication());
                }
            }

            MediaPlan mp = MediaPlan.builder()
                    .datePublication(datePub)
                    .heure(req.getHeure())
                    .format(req.getFormat())
                    .type(req.getType())
                    .titre(req.getTitre() != null ? req.getTitre() : "Sans titre")
                    .texteSurVisuel(req.getTexteSurVisuel())
                    .inspiration(req.getInspiration())
                    .autresElements(req.getAutresElements())
                    .platforme(req.getPlatforme())
                    .lienDrive(driveLink != null ? driveLink : req.getLienDrive())
                    .etatPublication(etatPub)
                    .rectifs(req.getRectifs())
                    .remarques(req.getRemarques())
                    .isShooting(Boolean.TRUE.equals(req.getIsShooting()))
                    .shootingDescription(req.getShootingDescription())
                    .shootingLocalisation(req.getShootingLocalisation())
                    .shootingDate(parseLocalDateOrNull(req.getShootingDate()))
                    .shootingAuPlusTard(parseLocalDateOrNull(req.getShootingAuPlusTard()))
                    .clientDoitValiderDate(Boolean.TRUE.equals(req.getClientDoitValiderDate()))
                    .shootingTypeDeContenu(parseTypeContenuOrNull(req.getShootingTypeDeContenu()))
                    .statut(StatutMediaPlan.EN_ATTENTE)
                    .client(client)
                    .createur(createur)
                    .build();

            try {
                savedPlans.add(mediaPlanRepository.save(mp));
            } catch (Exception e) {
                log.error("Failed to save media plan row: {}", e.getMessage(), e);
                throw new RuntimeException("Erreur lors de la sauvegarde d'une ligne du media plan: " + e.getMessage());
            }
        }

        if (!savedPlans.isEmpty()) {
            notifyValidators(savedPlans.size() + " ligne(s) de média plan ont été envoyées pour validation.");
        }
        return savedPlans.stream().map(this::toDTO).collect(Collectors.toList());
    }

    public MediaPlanDTO update(Long id, MediaPlanRequest request) {
        MediaPlan mp = mediaPlanRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("MediaPlan", id));
        boolean validator = SecurityUtils.isAdmin() || SecurityUtils.hasAnyAuthority("VALIDATE_MEDIA_PLAN");
        if (!validator && !employeeMayEdit(mp)) {
            throw new RuntimeException("Cette ligne est déjà validée, vous ne pouvez plus la modifier");
        }

        if (request.getDatePublication() != null) {
            mp.setDatePublication(LocalDate.parse(request.getDatePublication()));
        }
        if (request.getHeure() != null)
            mp.setHeure(request.getHeure());
        if (request.getFormat() != null)
            mp.setFormat(request.getFormat());
        if (request.getType() != null)
            mp.setType(request.getType());
        if (request.getTitre() != null)
            mp.setTitre(request.getTitre());
        if (request.getTexteSurVisuel() != null)
            mp.setTexteSurVisuel(request.getTexteSurVisuel());
        if (request.getInspiration() != null)
            mp.setInspiration(request.getInspiration());
        if (request.getAutresElements() != null)
            mp.setAutresElements(request.getAutresElements());
        if (request.getPlatforme() != null)
            mp.setPlatforme(request.getPlatforme());
        if (request.getLienDrive() != null)
            mp.setLienDrive(request.getLienDrive());
        if (request.getEtatPublication() != null) {
            mp.setEtatPublication(EtatPublication.valueOf(request.getEtatPublication()));
        }
        if (request.getRectifs() != null)
            mp.setRectifs(request.getRectifs());
        if (request.getRemarques() != null)
            mp.setRemarques(request.getRemarques());

        if (request.getIsShooting() != null) {
            mp.setShooting(Boolean.TRUE.equals(request.getIsShooting()));
            if (!Boolean.TRUE.equals(request.getIsShooting())) {
                mp.setShootingDescription(null);
                mp.setShootingLocalisation(null);
                mp.setShootingDate(null);
                mp.setShootingAuPlusTard(null);
                mp.setClientDoitValiderDate(false);
                mp.setShootingTypeDeContenu(null);
                mp.setShootingStatus(null);
                mp.setShootingStatusReason(null);
            }
        }
        if (request.getShootingDescription() != null)
            mp.setShootingDescription(request.getShootingDescription());
        if (request.getShootingLocalisation() != null)
            mp.setShootingLocalisation(request.getShootingLocalisation());
        if (request.getShootingDate() != null)
            mp.setShootingDate(parseLocalDateOrNull(request.getShootingDate()));
        if (request.getShootingAuPlusTard() != null)
            mp.setShootingAuPlusTard(parseLocalDateOrNull(request.getShootingAuPlusTard()));
        if (request.getClientDoitValiderDate() != null)
            mp.setClientDoitValiderDate(Boolean.TRUE.equals(request.getClientDoitValiderDate()));
        if (request.getShootingTypeDeContenu() != null)
            mp.setShootingTypeDeContenu(parseTypeContenuOrNull(request.getShootingTypeDeContenu()));

        if (request.getClientId() != null) {
            Client client = clientRepository.findById(request.getClientId())
                    .orElseThrow(() -> new ResourceNotFoundException("Client", request.getClientId()));
            mp.setClient(client);
        }

        MediaPlan saved = mediaPlanRepository.save(mp);
        if (validator && request.getRectifs() != null && !request.getRectifs().isBlank()
                && saved.getStatut() == StatutMediaPlan.EN_ATTENTE) {
            return refuse(id, request.getRectifs());
        }
        return toDTO(saved);
    }

    public void delete(Long id) {
        if (!mediaPlanRepository.existsById(id)) {
            throw new ResourceNotFoundException("MediaPlan", id);
        }
        // Elements lies : rectifs (reactifs) et creneau de tournage
        reactifInternRepository.deleteAll(reactifInternRepository.findByMediaPlan_IdOrderByDateReactifDesc(id));
        calendrierProjetRepository.findByMediaPlanLigneId(id).ifPresent(calendrierProjetRepository::delete);
        mediaPlanRepository.deleteById(id);
    }

    // =============================================
    // APPROVAL WORKFLOW
    // =============================================

    /**
     * Approve a media plan:
     * 1. Set status = APPROUVE
     * 2. Auto-create a Projet
     * 3. Add approving manager + department-based managers as chefs de projet
     */
    public MediaPlanDTO approve(Long mediaPlanId, Long managerId) {
        MediaPlan mp = mediaPlanRepository.findById(mediaPlanId)
                .orElseThrow(() -> new ResourceNotFoundException("MediaPlan", mediaPlanId));

        mp.setStatut(StatutMediaPlan.APPROUVE);

        // Shooting lines: do NOT create project/tasks here.
        // Instead, create a calendrier_projet entry to be validated.
        if (mp.isShooting()) {
            mediaPlanRepository.save(mp);
            mediaPlanShootingWorkflowService.onMediaPlanApproved(mp);
            return toDTO(mp);
        }

        mediaPlanRepository.save(mp);

        // Check if format contains "Video" (case insensitive)
        if (mp.getFormat() != null && mp.getFormat().toLowerCase().contains("video")) {
            String projetNom = "👉 Mediaplan: " + (mp.getTitre() != null ? mp.getTitre() : "Sans titre");

            ProjetRequest projetReq = new ProjetRequest();
            projetReq.setNom(projetNom);
            projetReq.setDateDebut(LocalDate.now());
            projetReq.setTypeProjet("INDETERMINE");
            projetReq.setStatut("PLANIFIE");
            projetReq.setIsMediaPlanProject(true);
            projetReq.setMediaPlanLigneId(mp.getId());

            Long clientId = mp.getClient() != null ? mp.getClient().getId() : null;
            if (clientId != null) {
                projetReq.setClientId(clientId);
            }

            // Build chef de projet list
            List<Long> chefIds = new ArrayList<>();
            chefIds.add(managerId); // the approving manager

            // Add manager from department based on format
            Long departmentManagerId = findManagerByFormat(mp.getFormat());
            if (departmentManagerId != null && !chefIds.contains(departmentManagerId)) {
                chefIds.add(departmentManagerId);
            }

            projetReq.setChefDeProjetIds(chefIds);
            projetReq.setCreateurId(managerId);

            com.antigone.rh.dto.ProjetDTO pDTO = projetService.create(projetReq);

            // Auto-create default tasks
            com.antigone.rh.entity.Projet createdProjet = projetRepository.findById(pDTO.getId()).orElse(null);
            if (createdProjet != null) {
                String[] taskNames = {
                        "Tournage - " + (mp.getTitre() != null ? mp.getTitre() : "Vidéo"),
                        "Montage - " + (mp.getTitre() != null ? mp.getTitre() : "Vidéo"),
                        "Validation & Publication - " + (mp.getTitre() != null ? mp.getTitre() : "Vidéo")
                };
                for (String tName : taskNames) {
                    com.antigone.rh.entity.Tache t = new com.antigone.rh.entity.Tache();
                    t.setTitre(tName);
                    t.setStatut(com.antigone.rh.enums.StatutTache.TODO);
                    t.setProjet(createdProjet);
                    t.setUrgente(false);
                    tacheRepository.save(t);
                }
            }
        }

        return toDTO(mp);
    }

    public MediaPlanDTO disapprove(Long mediaPlanId) {
        MediaPlan mp = mediaPlanRepository.findById(mediaPlanId)
                .orElseThrow(() -> new ResourceNotFoundException("MediaPlan", mediaPlanId));
        mp.setStatut(StatutMediaPlan.DESAPPROUVE);
        return toDTO(mediaPlanRepository.save(mp));
    }

    /**
     * Accepte une seule ligne : elle part chez le client avec les champs choisis.
     * Un shooting part ensuite au manager du département Production pour la date exacte.
     */
    public MediaPlanDTO accept(Long id, List<String> champs, Long approverId) {
        MediaPlan mp = mediaPlanRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("MediaPlan", id));
        boolean retour = mp.getStatut() == StatutMediaPlan.DESAPPROUVE && Boolean.TRUE.equals(mp.getRetourManager());
        if (mp.getStatut() != StatutMediaPlan.EN_ATTENTE && !retour) {
            throw new RuntimeException("Seule une ligne en attente peut être acceptée");
        }
        Set<String> chosen = new LinkedHashSet<>();
        if (champs != null) {
            for (String champ : champs) {
                if (CHAMPS_CLIENT.contains(champ)) {
                    chosen.add(champ);
                }
            }
        }
        if (chosen.isEmpty()) {
            throw new RuntimeException("Choisissez au moins un champ visible par le client");
        }
        mp.setChampsVisiblesClient(String.join(",", chosen));
        mp.setRectifs(null);
        mp.setRetourManager(false);
        mp.setStatut(StatutMediaPlan.EN_ATTENTE_CLIENT);
        mediaPlanRepository.save(mp);

        if (mp.isShooting()) {
            mediaPlanShootingWorkflowService.onMediaPlanApproved(mp);
        } else if (mp.getFormat() != null && mp.getFormat().toLowerCase().contains("video")) {
            createVideoProject(mp, approverId);
        }
        return toDTO(mp);
    }

    public MediaPlanDTO refuse(Long id, String rectifs) {
        if (rectifs == null || rectifs.isBlank()) {
            throw new RuntimeException("Les rectifs sont obligatoires pour refuser une ligne");
        }
        MediaPlan mp = mediaPlanRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("MediaPlan", id));
        if (mp.getStatut() != StatutMediaPlan.EN_ATTENTE) {
            throw new RuntimeException("Seule une ligne en attente peut être refusée");
        }
        mp.setRectifs(rectifs.trim());
        mp.setRetourManager(false);
        mp.setStatut(StatutMediaPlan.DESAPPROUVE);
        mediaPlanRepository.save(mp);
        Long managerId = SecurityUtils.currentEmployeIdOrNull();
        if (managerId != null) {
            reactifInternService.createForMediaPlanIntern(mp.getId(), managerId, rectifs.trim());
        }
        if (mp.getCreateur() != null) {
            notificationService.create(mp.getCreateur(), "MEDIA_PLAN_REFUS",
                    "La ligne '" + mp.getTitre() + "' a été refusée. Rectifs : " + rectifs.trim(), null);
        }
        return toDTO(mp);
    }

    public MediaPlanDTO placeShootingDate(Long id, String date, Long actorId) {
        MediaPlan mp = mediaPlanRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("MediaPlan", id));
        mediaPlanShootingWorkflowService.placeShootingDate(mp, parseLocalDateOrNull(date), actorId);
        return toDTO(mp);
    }

    public MediaPlanDTO confirmShootingDate(Long id, boolean accepte, Long actorId) {
        MediaPlan mp = mediaPlanRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("MediaPlan", id));
        mediaPlanShootingWorkflowService.confirmShootingDate(mp, accepte, actorId);
        return toDTO(mp);
    }

    public List<MediaPlanDTO> shootingsEnAttenteDate() {
        return mediaPlanRepository.findByShootingStatus(com.antigone.rh.enums.StatutShooting.EN_ATTENTE_DATE).stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    private void notifyValidators(String message) {
        for (Employe validateur : employeRepository.findByPermission("VALIDATE_MEDIA_PLAN")) {
            notificationService.create(validateur, "MEDIA_PLAN", message, null);
        }
    }

    private void createVideoProject(MediaPlan mp, Long managerId) {
        if (managerId == null) {
            return;
        }
        if (projetRepository.findFirstByMediaPlanLigneId(mp.getId()).isPresent()) {
            return;
        }
        String projetNom = "👉 Mediaplan: " + (mp.getTitre() != null ? mp.getTitre() : "Sans titre");
        ProjetRequest projetReq = new ProjetRequest();
        projetReq.setNom(projetNom);
        projetReq.setDateDebut(LocalDate.now());
        projetReq.setTypeProjet("INDETERMINE");
        projetReq.setStatut("PLANIFIE");
        projetReq.setIsMediaPlanProject(true);
        projetReq.setMediaPlanLigneId(mp.getId());
        if (mp.getClient() != null) {
            projetReq.setClientId(mp.getClient().getId());
        }
        List<Long> chefIds = new ArrayList<>();
        chefIds.add(managerId);
        Long departmentManagerId = findManagerByFormat(mp.getFormat());
        if (departmentManagerId != null && !chefIds.contains(departmentManagerId)) {
            chefIds.add(departmentManagerId);
        }
        projetReq.setChefDeProjetIds(chefIds);
        projetReq.setCreateurId(managerId);
        com.antigone.rh.dto.ProjetDTO pDTO = projetService.create(projetReq);
        com.antigone.rh.entity.Projet createdProjet = projetRepository.findById(pDTO.getId()).orElse(null);
        if (createdProjet == null) {
            return;
        }
        String[] taskNames = {
                "Tournage - " + (mp.getTitre() != null ? mp.getTitre() : "Vidéo"),
                "Montage - " + (mp.getTitre() != null ? mp.getTitre() : "Vidéo"),
                "Validation & Publication - " + (mp.getTitre() != null ? mp.getTitre() : "Vidéo")
        };
        for (String tName : taskNames) {
            com.antigone.rh.entity.Tache t = new com.antigone.rh.entity.Tache();
            t.setTitre(tName);
            t.setStatut(com.antigone.rh.enums.StatutTache.TODO);
            t.setProjet(createdProjet);
            t.setUrgente(false);
            tacheRepository.save(t);
        }
    }

    /**
     * Re-submit a previously disapproved media plan line to the manager.
     * Sets status back to EN_ATTENTE and updates the submission timestamp.
     */
    public MediaPlanDTO resubmit(Long mediaPlanId) {
        MediaPlan mp = mediaPlanRepository.findById(mediaPlanId)
                .orElseThrow(() -> new ResourceNotFoundException("MediaPlan", mediaPlanId));

        if (mp.getStatut() != StatutMediaPlan.DESAPPROUVE || Boolean.TRUE.equals(mp.getRetourManager())) {
            throw new RuntimeException("Seuls les media plans renvoyés à l'employé peuvent être resoumis");
        }

        mp.setStatut(StatutMediaPlan.EN_ATTENTE);
        mp.setDateCreation(LocalDateTime.now());
        notifyValidators("La ligne '" + mp.getTitre() + "' a été renvoyée pour validation.");

        // Reset shooting validation state so the new submission starts clean.
        mp.setShootingStatus(null);
        mp.setShootingStatusReason(null);
        return toDTO(mediaPlanRepository.save(mp));
    }

    /**
     * Request client validation: set status = EN_ATTENTE_CLIENT.
     * The media plan will be shown to the client for approval.
     */
    public MediaPlanDTO requestClientValidation(Long mediaPlanId) {
        MediaPlan mp = mediaPlanRepository.findById(mediaPlanId)
                .orElseThrow(() -> new ResourceNotFoundException("MediaPlan", mediaPlanId));
        mp.setStatut(StatutMediaPlan.EN_ATTENTE_CLIENT);
        return toDTO(mediaPlanRepository.save(mp));
    }

    /**
     * Client approves a single ligne: sets APPROUVE, then checks if the entire
     * batch for this client is now fully decided. If no EN_ATTENTE_CLIENT lignes
     * remain for the client, project + task creation is triggered for all approved
     * video lignes that don't yet have a project.
     */
    public MediaPlanDTO clientApprove(Long mediaPlanId) {
        MediaPlan mp = mediaPlanRepository.findById(mediaPlanId)
                .orElseThrow(() -> new ResourceNotFoundException("MediaPlan", mediaPlanId));
        SecurityUtils.requireOwnClientIfClient(mp.getClient().getId());
        if (mp.getStatut() != StatutMediaPlan.EN_ATTENTE_CLIENT) {
            throw new RuntimeException("Ce media plan n'est pas en attente de validation client");
        }
        mp.setStatut(StatutMediaPlan.APPROUVE);
        mediaPlanRepository.save(mp);
        checkBatchCompletion(mp.getClient());
        return toDTO(mp);
    }

    /**
     * Client approves a full batch at once: marks all EN_ATTENTE_CLIENT lignes as
     * APPROUVE, then triggers batch completion check (project/task creation).
     */
    public List<MediaPlanDTO> clientApproveAll(List<Long> ids) {
        List<MediaPlanDTO> results = new ArrayList<>();
        com.antigone.rh.entity.Client client = null;
        for (Long id : ids) {
            MediaPlan mp = mediaPlanRepository.findById(id)
                    .orElseThrow(() -> new ResourceNotFoundException("MediaPlan", id));
            SecurityUtils.requireOwnClientIfClient(mp.getClient().getId());
            if (mp.getStatut() == StatutMediaPlan.EN_ATTENTE_CLIENT) {
                mp.setStatut(StatutMediaPlan.APPROUVE);
                mediaPlanRepository.save(mp);
            }
            if (client == null)
                client = mp.getClient();
            results.add(toDTO(mp));
        }
        // Trigger project creation if the whole batch is now complete
        checkBatchCompletion(client);
        return results;
    }

    /**
     * Client refuses a single ligne: sets DESAPPROUVE.
     * The admin can then edit and re-send it (requestClientValidation) so the
     * client only sees the modified lignes again.
     */
    public MediaPlanDTO clientDisapprove(Long mediaPlanId, String rectifs) {
        MediaPlan mp = mediaPlanRepository.findById(mediaPlanId)
                .orElseThrow(() -> new ResourceNotFoundException("MediaPlan", mediaPlanId));
        SecurityUtils.requireOwnClientIfClient(mp.getClient().getId());
        if (mp.getStatut() != StatutMediaPlan.EN_ATTENTE_CLIENT) {
            throw new RuntimeException("Ce media plan n'est pas en attente de validation client");
        }
        String text = rectifs != null && !rectifs.isBlank()
                ? rectifs.trim()
                : (mp.getRectifs() != null ? mp.getRectifs().trim() : "");
        if (text.isBlank()) {
            throw new RuntimeException("Les rectifs sont obligatoires pour refuser la ligne");
        }
        mp.setRectifs(text);
        mp.setStatut(StatutMediaPlan.DESAPPROUVE);
        mp.setRetourManager(true);
        mediaPlanRepository.save(mp);
        if (mp.getClient() != null) {
            reactifInternService.createForMediaPlanExtern(mp.getId(), mp.getClient().getId(), text);
        }
        notifyValidators("Le client a demandé des rectifs sur la ligne '" + mp.getTitre() + "' : " + text);
        return toDTO(mp);
    }

    /** Le manager renvoie au créateur une ligne revenue du client. */
    public MediaPlanDTO renvoyerEmploye(Long id) {
        if (!SecurityUtils.isAdmin() && !SecurityUtils.hasAnyAuthority("VALIDATE_MEDIA_PLAN")) {
            throw new org.springframework.security.access.AccessDeniedException("Acces refuse");
        }
        MediaPlan mp = mediaPlanRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("MediaPlan", id));
        if (!Boolean.TRUE.equals(mp.getRetourManager())) {
            throw new RuntimeException("Cette ligne n'attend pas une décision du manager");
        }
        mp.setRetourManager(false);
        mediaPlanRepository.save(mp);
        if (mp.getCreateur() != null) {
            notificationService.create(mp.getCreateur(), "MEDIA_PLAN_RECTIF",
                    "Le client demande des rectifs sur '" + mp.getTitre() + "' : " + mp.getRectifs(), null);
        }
        return toDTO(mp);
    }

    private boolean employeeMayEdit(MediaPlan mp) {
        return mp.getStatut() == StatutMediaPlan.DESAPPROUVE && !Boolean.TRUE.equals(mp.getRetourManager());
    }

    /**
     * After any client approval action, check whether all lignes for this client
     * have been decided (none left in EN_ATTENTE_CLIENT). If so, create a
     * Projet + default tasks for every APPROUVE video ligne that does not yet
     * have a project linked to it.
     */
    private void checkBatchCompletion(com.antigone.rh.entity.Client client) {
        if (client == null)
            return;

        List<MediaPlan> allPlans = mediaPlanRepository.findByClientId(client.getId());

        // If any ligne is still pending, the batch is not complete yet
        boolean anyPending = allPlans.stream()
                .anyMatch(p -> p.getStatut() == StatutMediaPlan.EN_ATTENTE_CLIENT);
        if (anyPending)
            return;

        // All decided: create projects for approved video lignes without an existing
        // project
        Long fallbackManagerId = null; // lazy-initialised below if needed
        for (MediaPlan mp : allPlans) {
            if (mp.getStatut() != StatutMediaPlan.APPROUVE)
                continue;
            if (mp.getFormat() == null || !mp.getFormat().toLowerCase().contains("video"))
                continue;
            if (mp.isShooting())
                continue;

            // Skip if a project already exists for this ligne
            if (projetRepository.findFirstByMediaPlanLigneId(mp.getId()).isPresent())
                continue;

            // Find best-matching manager
            Long managerId = findManagerByFormat(mp.getFormat());
            if (managerId == null) {
                if (fallbackManagerId == null) {
                    fallbackManagerId = employeRepository.findAll().stream()
                            .filter(e -> e.getSubordonnes() != null && !e.getSubordonnes().isEmpty())
                            .map(com.antigone.rh.entity.Employe::getId)
                            .findFirst()
                            .orElse(null);
                }
                managerId = fallbackManagerId;
            }
            if (managerId == null)
                continue;

            ProjetRequest projetReq = new ProjetRequest();
            projetReq.setNom("👉 Mediaplan: " + (mp.getTitre() != null ? mp.getTitre() : "Sans titre"));
            projetReq.setDateDebut(LocalDate.now());
            projetReq.setTypeProjet("INDETERMINE");
            projetReq.setStatut("PLANIFIE");
            projetReq.setIsMediaPlanProject(true);
            projetReq.setMediaPlanLigneId(mp.getId());
            projetReq.setClientId(client.getId());

            List<Long> chefIds = new ArrayList<>();
            chefIds.add(managerId);
            Long deptManagerId = findManagerByFormat(mp.getFormat());
            if (deptManagerId != null && !chefIds.contains(deptManagerId))
                chefIds.add(deptManagerId);
            projetReq.setChefDeProjetIds(chefIds);
            projetReq.setCreateurId(managerId);

            com.antigone.rh.dto.ProjetDTO pDTO = projetService.create(projetReq);
            com.antigone.rh.entity.Projet createdProjet = projetRepository.findById(pDTO.getId()).orElse(null);
            if (createdProjet != null) {
                String titre = mp.getTitre() != null ? mp.getTitre() : "Vidéo";
                for (String tName : new String[] {
                        "Tournage - " + titre,
                        "Montage - " + titre,
                        "Validation & Publication - " + titre }) {
                    com.antigone.rh.entity.Tache t = new com.antigone.rh.entity.Tache();
                    t.setTitre(tName);
                    t.setStatut(com.antigone.rh.enums.StatutTache.TODO);
                    t.setProjet(createdProjet);
                    t.setUrgente(false);
                    tacheRepository.save(t);
                }
            }
        }
    }

    // ── Google Drive Auth Bridges ────────────────────────────────────────────
    public String getGoogleAuthUrl() throws IOException {
        return googleDriveService.getAuthorizationUrl();
    }

    public void storeGoogleToken(String code) throws IOException {
        // This is a bit simplified, usually we'd need another step to exchange code for
        // token
        // But GoogleAuthorizationCodeFlow handled by AuthorizationCodeInstalledApp does
        // it.
        // I'll need to manually implement the exchange if I want it purely backend.
        // For now, I'll update GoogleDriveService to handle the exchange.
        googleDriveService.exchangeCodeForToken(code);
    }

    public boolean isGoogleAuthorized() {
        return googleDriveService.isAuthorized();
    }

    // =============================================
    // HELPERS
    // =============================================

    /**
     * Chef de projet du département qui correspond au format du média plan.
     * C'est l'employé coché « manager du département », pas le premier sans supérieur.
     * - Reel/Video → département contenant "prod"
     * - Carrousel → département contenant "design"
     * - Story → département contenant "social media"
     */
    private Long findManagerByFormat(String format) {
        if (format == null)
            return null;

        String departmentKeyword;
        switch (format.toLowerCase()) {
            case "reel":
            case "video":
                departmentKeyword = "prod";
                break;
            case "carrousel":
                departmentKeyword = "design";
                break;
            case "story":
                departmentKeyword = "social media";
                break;
            default:
                return null;
        }

        // Le chef de projet est la personne cochée « manager du département », pas le premier sans supérieur.
        List<Employe> allEmployees = employeRepository.findAll();
        return allEmployees.stream()
                .filter(e -> !Boolean.TRUE.equals(e.getArchived()))
                .filter(e -> Boolean.TRUE.equals(e.getManagerDepartement()))
                .filter(e -> e.getDepartement() != null
                        && e.getDepartement().toLowerCase().contains(departmentKeyword))
                .map(Employe::getId)
                .findFirst()
                .orElse(null);
    }

    /**
     * Updates the rectifs (client feedback / corrections) field for a single ligne.
     */
    public MediaPlanDTO updateRectifs(Long mediaPlanId, String rectifs) {
        MediaPlan mp = mediaPlanRepository.findById(mediaPlanId)
                .orElseThrow(() -> new ResourceNotFoundException("MediaPlan", mediaPlanId));
        SecurityUtils.requireOwnClientIfClient(mp.getClient().getId());
        mp.setRectifs(rectifs);
        return toDTO(mediaPlanRepository.save(mp));
    }

    // =============================================
    // MAPPER
    // =============================================

    private MediaPlanDTO toDTO(MediaPlan mp) {
        return MediaPlanDTO.builder()
                .id(mp.getId())
                .datePublication(mp.getDatePublication() != null ? mp.getDatePublication().toString() : null)
                .heure(mp.getHeure())
                .format(mp.getFormat())
                .type(mp.getType())
                .titre(mp.getTitre())
                .texteSurVisuel(mp.getTexteSurVisuel())
                .inspiration(mp.getInspiration())
                .autresElements(mp.getAutresElements())
                .platforme(mp.getPlatforme())
                .lienDrive(mp.getLienDrive())
                .etatPublication(mp.getEtatPublication() != null ? mp.getEtatPublication().name() : null)
                .rectifs(mp.getRectifs())
                .remarques(mp.getRemarques())
                .isShooting(mp.isShooting())
                .shootingDescription(mp.getShootingDescription())
                .shootingLocalisation(mp.getShootingLocalisation())
                .shootingDate(mp.getShootingDate() != null ? mp.getShootingDate().toString() : null)
                .shootingAuPlusTard(mp.getShootingAuPlusTard() != null ? mp.getShootingAuPlusTard().toString() : null)
                .clientDoitValiderDate(Boolean.TRUE.equals(mp.getClientDoitValiderDate()))
                .champsVisiblesClient(mp.getChampsVisiblesClient())
                .retourManager(Boolean.TRUE.equals(mp.getRetourManager()))
                .shootingTypeDeContenu(
                        mp.getShootingTypeDeContenu() != null ? mp.getShootingTypeDeContenu().name() : null)
                .shootingStatus(mp.getShootingStatus() != null ? mp.getShootingStatus().name() : null)
                .shootingStatusReason(mp.getShootingStatusReason())
                .calendrierProjetId(mp.getCalendrierProjet() != null ? mp.getCalendrierProjet().getId() : null)
                .statut(mp.getStatut().name())
                .clientId(mp.getClient() != null ? mp.getClient().getId() : null)
                .clientNom(mp.getClient() != null ? mp.getClient().getNom() : null)
                .createurId(mp.getCreateur() != null ? mp.getCreateur().getId() : null)
                .createurNom(mp.getCreateur() != null ? mp.getCreateur().getNom() : null)
                .createurPrenom(mp.getCreateur() != null ? mp.getCreateur().getPrenom() : null)
                .dateCreation(mp.getDateCreation() != null ? mp.getDateCreation().toString() : null)
                .build();
    }

    private LocalDate parseLocalDateOrNull(String value) {
        if (value == null)
            return null;
        String v = value.trim();
        if (v.isBlank())
            return null;
        try {
            return LocalDate.parse(v);
        } catch (Exception e) {
            throw new RuntimeException("Format de date invalide: '" + value + "'");
        }
    }

    private TypeContenuShooting parseTypeContenuOrNull(String value) {
        if (value == null)
            return null;
        String v = value.trim();
        if (v.isBlank())
            return null;

        String normalized = v.toUpperCase();
        if ("PHOTO".equals(normalized))
            return TypeContenuShooting.PHOTO;
        if ("VIDEO".equals(normalized))
            return TypeContenuShooting.VIDEO;
        if ("BOTH".equals(normalized))
            return TypeContenuShooting.BOTH;

        throw new RuntimeException("Type de contenu invalide: '" + value + "' (attendu: PHOTO, VIDEO, BOTH)");
    }
}
