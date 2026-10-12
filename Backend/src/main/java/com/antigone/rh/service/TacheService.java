package com.antigone.rh.service;

import com.antigone.rh.dto.TacheDetailDTO;
import com.antigone.rh.entity.Employe;
import com.antigone.rh.entity.Projet;
import com.antigone.rh.entity.Tache;
import com.antigone.rh.enums.StatutTache;
import com.antigone.rh.repository.EmployeRepository;
import com.antigone.rh.repository.ProjetRepository;
import com.antigone.rh.repository.TacheRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional
@Slf4j
public class TacheService {

    private final TacheRepository tacheRepository;
    private final ProjetRepository projetRepository;
    private final EmployeRepository employeRepository;
    private final NotificationService notificationService;
    private final GoogleDriveService googleDriveService;

    public List<Tache> findAll() {
        return tacheRepository.findAll();
    }

    public Tache findById(Long id) {
        return tacheRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Tâche non trouvée avec l'id: " + id));
    }

    public List<Tache> findByProjet(Long projetId) {
        return tacheRepository.findByProjetIdAndArchivedFalse(projetId);
    }

    public List<Tache> findByAssignee(Long employeId) {
        return tacheRepository.findByAssigneeIdAndArchivedFalse(employeId);
    }

    public List<TacheDetailDTO> findDetailByAssignee(Long employeId) {
        List<Tache> taches = tacheRepository.findByAssigneeIdAndArchivedFalse(employeId);
        return taches.stream().map(this::toDetailDTO).collect(Collectors.toList());
    }

    public List<Tache> findArchiveByProjet(Long projetId) {
        return tacheRepository.findByProjetIdAndArchivedTrue(projetId);
    }

    public List<Tache> findByProjetAndStatut(Long projetId, StatutTache statut) {
        return tacheRepository.findByProjetIdAndStatutAndArchivedFalse(projetId, statut);
    }

    /** Normalise "Video, Post ,Video" -> "Video,Post" (ordre conserve, sans doublon ni vide). */
    private static String normalizeTypes(String raw) {
        if (raw == null) return "";
        java.util.LinkedHashSet<String> set = new java.util.LinkedHashSet<>();
        for (String t : raw.split(",")) {
            if (!t.trim().isEmpty()) set.add(t.trim());
        }
        return String.join(",", set);
    }

    /** Cree (si besoin) un dossier Drive par type et renseigne driveLink (meme ordre que typeDrive). */
    private void applyDriveFolders(Tache tache, Projet projet) throws java.io.IOException {
        String types = normalizeTypes(tache.getTypeDrive());
        tache.setTypeDrive(types.isEmpty() ? null : types);
        if (types.isEmpty()) {
            return;
        }
        LocalDate folderDate = tache.getDateEcheance() != null ? tache.getDateEcheance() : LocalDate.now();
        String clientName = (projet.getClient() != null && projet.getClient().getNom() != null)
                ? projet.getClient().getNom()
                : (projet.getNom() != null ? projet.getNom() : "Inconnu");
        java.util.List<String> links = new java.util.ArrayList<>();
        for (String type : types.split(",")) {
            String link = googleDriveService.getOrCreateTacheTypeFolder(clientName, folderDate, type);
            links.add(link);
            log.info("Drive folder ready for tache '{}' type '{}': {}", tache.getTitre(), type, link);
        }
        tache.setDriveLink(String.join(",", links));
    }

    public Tache create(Long projetId, Tache tache) {
        Projet projet = projetRepository.findById(projetId)
                .orElseThrow(() -> new RuntimeException("Projet non trouvé"));

        tache.setProjet(projet);
        validateTacheDate(tache, projet);
        tache.setStatut(StatutTache.TODO);
        tache.setDriveLink(null); // jamais fourni par le client : uniquement genere via typeDrive

        // Auto-create Drive folder(s) when typeDrive is provided (comma-separated e.g. "Post,Documentation")
        try {
            applyDriveFolders(tache, projet);
        } catch (Exception e) {
            log.error("Failed to create Drive folder for tache: {}", e.getMessage());
            // Don't block creation — the type can be re-saved from the edit form to retry.
        }

        Tache saved = tacheRepository.save(tache);

        // Notify assignee of the new task
        if (saved.getAssignee() != null) {
            notificationService.create(
                    saved.getAssignee(),
                    "Nouvelle tâche assignée",
                    "Une nouvelle tâche \"" + saved.getTitre() + "\" vous a été assignée"
                            + (projet.getNom() != null ? " dans le projet \"" + projet.getNom() + "\"." : "."),
                    null);
        }

        return saved;
    }

    private String resolveLivrableFolderId(Tache tache, String type) {
        if (tache.getDriveLink() == null || tache.getDriveLink().isBlank()) {
            throw new RuntimeException("Aucun dossier Drive n'est associé à cette tâche");
        }
        String[] links = tache.getDriveLink().split(",");
        String[] types = tache.getTypeDrive() == null ? new String[0] : tache.getTypeDrive().split(",");
        int idx = 0;
        if (type != null && !type.isBlank()) {
            for (int i = 0; i < types.length; i++) {
                if (types[i].trim().equalsIgnoreCase(type.trim())) idx = i;
            }
        }
        String folderId = GoogleDriveService.folderIdFromLink(links[Math.min(idx, links.length - 1)].trim());
        if (folderId == null) throw new RuntimeException("Lien Drive de la tâche invalide");
        return folderId;
    }

    private static java.util.Map<String, Object> toLivrable(com.google.api.services.drive.model.File f) {
        java.util.Map<String, Object> m = new java.util.LinkedHashMap<>();
        m.put("id", f.getId());
        m.put("name", f.getName());
        m.put("mimeType", f.getMimeType());
        m.put("size", f.getSize());
        m.put("webViewLink", f.getWebViewLink());
        m.put("thumbnailLink", f.getThumbnailLink());
        m.put("createdTime", f.getCreatedTime() == null ? null : f.getCreatedTime().toStringRfc3339());
        return m;
    }

    public java.util.List<java.util.Map<String, Object>> listLivrables(Long tacheId) {
        Tache tache = findById(tacheId);
        if (tache.getDriveLink() == null || tache.getDriveLink().isBlank()) return java.util.List.of();
        try {
            java.util.List<java.util.Map<String, Object>> out = new java.util.ArrayList<>();
            for (String link : tache.getDriveLink().split(",")) {
                String folderId = GoogleDriveService.folderIdFromLink(link.trim());
                if (folderId == null) continue;
                // Le dossier Drive est partage par mois : on ne garde que les fichiers prefixes par cette tache.
                for (var f : googleDriveService.listFiles(folderId)) {
                    if (f.getName() != null && f.getName().startsWith("T" + tacheId + "_")) out.add(toLivrable(f));
                }
            }
            return out;
        } catch (java.io.IOException e) {
            throw new RuntimeException("Impossible de lire les fichiers Drive : " + e.getMessage());
        }
    }

    public java.util.Map<String, Object> uploadLivrable(Long tacheId,
            org.springframework.web.multipart.MultipartFile file, String type) {
        if (file == null || file.isEmpty()) throw new RuntimeException("Aucun fichier reçu");
        Tache tache = findById(tacheId);
        com.antigone.rh.security.UploadPolicy.requireExtension(file.getOriginalFilename(),
                com.antigone.rh.security.UploadPolicy.LIVRABLES);
        String folderId = resolveLivrableFolderId(tache, type);
        String safeName = file.getOriginalFilename().replaceAll("[\\\\/:*?\"<>|]", "_");
        String mime = file.getContentType() != null ? file.getContentType() : "application/octet-stream";
        try (java.io.InputStream in = file.getInputStream()) {
            var created = googleDriveService.uploadFile(folderId, "T" + tacheId + "_" + safeName, mime, in,
                    file.getSize());
            return toLivrable(created);
        } catch (java.io.IOException e) {
            throw new RuntimeException("Échec de l'envoi vers Drive : " + e.getMessage());
        }
    }

    public Tache assign(Long tacheId, Long employeId) {
        Tache tache = findById(tacheId);
        Employe employe = employeRepository.findById(employeId)
                .orElseThrow(() -> new RuntimeException("Employé non trouvé"));

        tache.setAssignee(employe);
        tache.setDateAssignation(LocalDateTime.now());
        Tache saved = tacheRepository.save(tache);

        // Notify the newly assigned employee
        notificationService.create(
                employe,
                "Nouvelle tâche assignée",
                "La tâche \"" + tache.getTitre() + "\" vous a été assignée.",
                null);

        return saved;
    }

    /**
     * CORRECTION 1 — Capture timestamps automatically on each status change.
     * CORRECTION 2 — Block status change to IN_PROGRESS/DONE if no assignee.
     */
    public Tache changeStatut(Long tacheId, StatutTache statut) {
        Tache tache = findById(tacheId);

        // ── CORRECTION 2: Block IN_PROGRESS / DONE without assignee ──────────
        if ((statut == StatutTache.IN_PROGRESS || statut == StatutTache.DONE)
                && tache.getAssignee() == null) {
            throw new IllegalStateException(
                    "⛔ Impossible de changer le statut — aucun employé assigné. "
                            + "Veuillez d'abord assigner un responsable à la tâche \"" + tache.getTitre() + "\".");
        }

        tache.setStatut(statut);

        // ── CORRECTION 1: Record lifecycle timestamps precisely ──────────────
        LocalDateTime now = LocalDateTime.now();
        if (statut == StatutTache.IN_PROGRESS) {
            if (tache.getDateDebutExecution() == null) {
                tache.setDateDebutExecution(now);
                log.info("✅ Correction 1 — started_at enregistré pour tâche #{}: {}", tacheId, now);
            }
        } else if (statut == StatutTache.DONE) {
            // If task skipped IN_PROGRESS, record start now
            if (tache.getDateDebutExecution() == null) {
                tache.setDateDebutExecution(now);
                log.warn("⚠ Tâche #{} passée directement à DONE sans IN_PROGRESS — started_at forcé", tacheId);
            }
            tache.setDateFinExecution(now);
            log.info("✅ Correction 1 — completed_at enregistré pour tâche #{}: {}", tacheId, now);
        } else if (statut == StatutTache.TODO) {
            // Reset timestamps if moved back to TODO
            tache.setDateDebutExecution(null);
            tache.setDateFinExecution(null);
        }

        Tache saved = tacheRepository.save(tache);

        // Notify chef de projet when task is marked as DONE
        if (statut == StatutTache.DONE && tache.getProjet() != null
                && tache.getProjet().getChefDeProjet() != null) {
            Employe chef = tache.getProjet().getChefDeProjet();
            notificationService.create(
                    chef,
                    "Tâche terminée",
                    "La tâche \"" + tache.getTitre() + "\" du projet \""
                            + tache.getProjet().getNom() + "\" a été marquée comme terminée.",
                    null);
        }

        return saved;
    }

    public Tache update(Long id, Tache tacheDetails) {
        Tache tache = findById(id);
        tache.setTitre(tacheDetails.getTitre());
        tache.setDateEcheance(tacheDetails.getDateEcheance());
        tache.setUrgente(tacheDetails.isUrgente());
        if (tacheDetails.getDureePrevueJours() != null) {
            tache.setDureePrevueJours(tacheDetails.getDureePrevueJours());
        }
        if (tacheDetails.getDescription() != null) {
            tache.setDescription(tacheDetails.getDescription());
        }
        if (tacheDetails.getStatut() != null) {
            tache.setStatut(tacheDetails.getStatut());
        }
        validateTacheDate(tache, tache.getProjet());

        // Type de tache (Drive) : (re)cree les dossiers si le type change ou si le dossier n'existe pas encore.
        String newTypes = normalizeTypes(tacheDetails.getTypeDrive());
        if (!newTypes.isEmpty()
                && (!newTypes.equals(normalizeTypes(tache.getTypeDrive()))
                        || tache.getDriveLink() == null || tache.getDriveLink().isBlank())) {
            tache.setTypeDrive(newTypes);
            try {
                applyDriveFolders(tache, tache.getProjet());
            } catch (Exception e) {
                log.error("Drive folder creation failed for tache #{}: {}", id, e.getMessage());
                throw new RuntimeException("Impossible de créer le dossier Drive : " + e.getMessage());
            }
        }
        return tacheRepository.save(tache);
    }

    private void validateTacheDate(Tache tache, Projet projet) {
        if (tache.getDateEcheance() == null)
            return;
        if (projet.getDateDebut() != null && tache.getDateEcheance().isBefore(projet.getDateDebut())) {
            throw new IllegalArgumentException(
                    "La date de l'échéance ne peut pas être avant la date de début du projet (" + projet.getDateDebut()
                            + ")");
        }
        if (projet.getDateFin() != null && tache.getDateEcheance().isAfter(projet.getDateFin())) {
            throw new IllegalArgumentException("La date de l'échéance ne peut pas être après la date de fin du projet ("
                    + projet.getDateFin() + ")");
        }
    }

    /**
     * Sends a reminder notification to the employee assigned to a late task.
     */
    public void relancerEmploye(Long tacheId) {
        Tache tache = findById(tacheId);
        if (tache.getAssignee() == null) {
            throw new RuntimeException("Aucun employé assigné à cette tâche");
        }

        String projetNom = tache.getProjet() != null ? tache.getProjet().getNom() : "Inconnu";
        notificationService.createUrgent(
                tache.getAssignee(),
                "⚠ Relance — Tâche en retard",
                "La tâche \"" + tache.getTitre() + "\" du projet \"" + projetNom
                        + "\" nécessite votre attention urgente."
                        + (tache.getDateEcheance() != null
                                ? " Deadline : " + tache.getDateEcheance() + "."
                                : ""),
                null);
        log.info("Relance envoyée à l'employé {} pour la tâche #{}", tache.getAssignee().getId(), tacheId);
    }

    /**
     * Updates the deadline of a task and notifies the assignee.
     */
    public Tache updateDeadline(Long tacheId, LocalDate newDeadline) {
        Tache tache = findById(tacheId);
        LocalDate oldDeadline = tache.getDateEcheance();
        tache.setDateEcheance(newDeadline);

        // Validate against project dates
        if (tache.getProjet() != null) {
            validateTacheDate(tache, tache.getProjet());
        }

        Tache saved = tacheRepository.save(tache);

        // Notify assignee about deadline change
        if (tache.getAssignee() != null) {
            String projetNom = tache.getProjet() != null ? tache.getProjet().getNom() : "Inconnu";
            notificationService.createSimple(
                    tache.getAssignee(),
                    "📅 Deadline modifiée",
                    "La deadline de la tâche \"" + tache.getTitre() + "\" (projet \"" + projetNom
                            + "\") a été modifiée"
                            + (oldDeadline != null ? " du " + oldDeadline : "")
                            + " au " + newDeadline + ".");
        }

        log.info("Deadline de la tâche #{} modifiée : {} → {}", tacheId, oldDeadline, newDeadline);
        return saved;
    }

    public void delete(Long id) {
        tacheRepository.deleteById(id);
    }

    public Tache unarchive(Long tacheId) {
        Tache tache = findById(tacheId);
        tache.setArchived(false);
        // Reset dateFinExecution to now so it doesn't get immediately re-archived on
        // the next cron run
        if (tache.getStatut() == StatutTache.DONE) {
            tache.setDateFinExecution(LocalDateTime.now());
        }
        return tacheRepository.save(tache);
    }

    private TacheDetailDTO toDetailDTO(Tache tache) {
        Projet projet = tache.getProjet();
        String chefNom = null;
        Long chefId = null;
        if (projet != null && projet.getChefDeProjet() != null) {
            Employe chef = projet.getChefDeProjet();
            chefNom = chef.getPrenom() + " " + chef.getNom();
            chefId = chef.getId();
        }

        // Build flat member list: chef first, then selected subordinates
        java.util.List<TacheDetailDTO.MembreInfoDTO> membresProjet = new java.util.ArrayList<>();
        if (projet != null) {
            if (projet.getChefDeProjet() != null) {
                Employe chef = projet.getChefDeProjet();
                membresProjet.add(TacheDetailDTO.MembreInfoDTO.builder()
                        .id(chef.getId()).nom(chef.getNom()).prenom(chef.getPrenom())
                        .telephone(chef.getTelephone()).telephonePro(chef.getTelephonePro())
                        .departement(chef.getDepartement()).email(chef.getEmail())
                        .build());
            }
            for (Employe m : projet.getMembres()) {
                if (membresProjet.stream().anyMatch(x -> x.getId().equals(m.getId())))
                    continue;
                membresProjet.add(TacheDetailDTO.MembreInfoDTO.builder()
                        .id(m.getId()).nom(m.getNom()).prenom(m.getPrenom())
                        .telephone(m.getTelephone()).telephonePro(m.getTelephonePro())
                        .departement(m.getDepartement()).email(m.getEmail())
                        .build());
            }
        }

        return TacheDetailDTO.builder()
                .id(tache.getId())
                .titre(tache.getTitre())
                .statut(tache.getStatut())
                .dateEcheance(tache.getDateEcheance())
                .projetId(projet != null ? projet.getId() : null)
                .projetNom(projet != null ? projet.getNom() : null)
                .projetDateFin(projet != null ? projet.getDateFin() : null)
                .chefDeProjetNom(chefNom)
                .chefDeProjetId(chefId)
                .projetStatut(projet != null ? projet.getStatut() : null)
                .urgente(tache.isUrgente())
                .typeDrive(tache.getTypeDrive())
                .driveLink(tache.getDriveLink())
                .assigneeId(tache.getAssignee() != null ? tache.getAssignee().getId() : null)
                .membresProjet(membresProjet)
                .build();
    }
}
