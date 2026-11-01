package com.antigone.rh.service;

import com.antigone.rh.dto.ProjetDTO;
import com.antigone.rh.dto.ProjetRequest;
import com.antigone.rh.entity.CalendrierProjet;
import com.antigone.rh.entity.Employe;
import com.antigone.rh.entity.MediaPlan;
import com.antigone.rh.entity.Projet;
import com.antigone.rh.entity.Tache;
import com.antigone.rh.enums.StatutMediaPlan;
import com.antigone.rh.enums.StatutShooting;
import com.antigone.rh.enums.StatutTache;
import com.antigone.rh.repository.CalendrierProjetRepository;
import com.antigone.rh.repository.EmployeRepository;
import com.antigone.rh.repository.MediaPlanRepository;
import com.antigone.rh.repository.ProjetRepository;
import com.antigone.rh.repository.TacheRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@Transactional
public class MediaPlanShootingWorkflowService {

    private final CalendrierProjetRepository calendrierProjetRepository;
    private final EmployeRepository employeRepository;
    private final MediaPlanRepository mediaPlanRepository;
    private final NotificationService notificationService;
    private final ProjetService projetService;
    private final ProjetRepository projetRepository;
    private final TacheRepository tacheRepository;

    public void onMediaPlanApproved(MediaPlan mp) {
        if (mp == null || !mp.isShooting()) {
            return;
        }
        if (mp.getShootingAuPlusTard() == null && mp.getShootingDate() != null) {
            mp.setShootingAuPlusTard(mp.getShootingDate());
            mp.setShootingDate(null);
        }
        if (mp.getShootingAuPlusTard() == null) {
            throw new RuntimeException("La date au plus tard du shooting est obligatoire");
        }

        List<Employe> validators = findShootingValidators();
        mp.setShootingStatus(StatutShooting.EN_ATTENTE_DATE);
        mp.setShootingStatusReason(null);
        mediaPlanRepository.save(mp);

        String creatorName = mp.getCreateur() != null
                ? ((nullToEmpty(mp.getCreateur().getPrenom()) + " " + nullToEmpty(mp.getCreateur().getNom())).trim())
                : "Un employé";
        String message = creatorName + " a demandé un shooting '" + nullToEmpty(mp.getTitre())
                + "' au plus tard le " + mp.getShootingAuPlusTard() + ". Posez la date dans le calendrier.";
        for (Employe validator : validators) {
            notificationService.create(validator, "SHOOTING_DATE", message, null);
        }
    }

    public void placeShootingDate(MediaPlan mp, LocalDate date, Long actorId) {
        if (mp == null || !mp.isShooting()) {
            throw new RuntimeException("Cette ligne n'est pas un shooting");
        }
        if (mp.getShootingStatus() != StatutShooting.EN_ATTENTE_DATE) {
            throw new RuntimeException("Ce shooting n'attend pas de date");
        }
        if (date == null) {
            throw new RuntimeException("Date de shooting obligatoire");
        }
        if (mp.getShootingAuPlusTard() != null && date.isAfter(mp.getShootingAuPlusTard())) {
            throw new RuntimeException("La date doit être au plus tard le " + mp.getShootingAuPlusTard());
        }

        requireShootingValidator();
        Employe prod = resolveShootingCalendarOwner(actorId);

        CalendrierProjet slot = calendrierProjetRepository.findByMediaPlanLigneId(mp.getId()).orElse(null);
        Long ignoreSlotId = slot != null ? slot.getId() : null;
        ensureDateAvailable(prod.getId(), date, ignoreSlotId);
        if (slot == null) {
            slot = new CalendrierProjet();
        }
        slot.setDateSlot(date);
        slot.setManager(prod);
        slot.setSocialManager(mp.getCreateur());
        slot.setProjectName(buildProjectName(mp));
        slot.setDescription(mp.getShootingDescription());
        slot.setLocalisation(mp.getShootingLocalisation());
        slot.setTypeDeContenu(mp.getShootingTypeDeContenu());
        slot.setUrgent(false);
        slot.setType(CalendrierProjet.SlotType.BOOKED);
        slot.setMediaPlanLigne(mp);
        mp.setShootingDate(date);
        mp.setCalendrierProjet(slot);

        if (Boolean.TRUE.equals(mp.getClientDoitValiderDate())) {
            slot.setStatut(CalendrierProjet.SlotStatus.EN_ATTENTE);
            mp.setShootingStatus(StatutShooting.EN_ATTENTE_CLIENT_DATE);
            mp.setShootingStatusReason(null);
            calendrierProjetRepository.save(slot);
            mediaPlanRepository.save(mp);
            String msg = "La Production propose le " + date + " pour le shooting '" + nullToEmpty(mp.getTitre())
                    + "'. Vérifiez avec le client si cette date lui convient.";
            if (mp.getCreateur() != null) {
                notificationService.create(mp.getCreateur(), "SHOOTING_DATE_CLIENT", msg, null);
                if (mp.getCreateur().getManager() != null) {
                    notificationService.create(mp.getCreateur().getManager(), "SHOOTING_DATE_CLIENT", msg, null);
                }
            }
        } else {
            slot.setStatut(CalendrierProjet.SlotStatus.VALIDE);
            mp.setShootingStatus(StatutShooting.VALIDE);
            mp.setShootingStatusReason(null);
            calendrierProjetRepository.save(slot);
            mediaPlanRepository.save(mp);
            createShootingProjectIfMissing(mp, slot);
            if (mp.getCreateur() != null) {
                notificationService.create(mp.getCreateur(), "SHOOTING_DATE",
                        "La date du shooting '" + nullToEmpty(mp.getTitre()) + "' est fixée au " + date + ".", null);
            }
        }
    }

    public void confirmShootingDate(MediaPlan mp, boolean accepte, Long actorId) {
        if (mp == null || mp.getShootingStatus() != StatutShooting.EN_ATTENTE_CLIENT_DATE) {
            throw new RuntimeException("Cette date n'attend pas de confirmation");
        }
        Employe createur = mp.getCreateur();
        boolean allowed = com.antigone.rh.security.SecurityUtils.isAdmin()
                || (createur != null && actorId != null && actorId.equals(createur.getId()))
                || (createur != null && createur.getManager() != null && actorId != null
                        && actorId.equals(createur.getManager().getId()));
        if (!allowed) {
            throw new RuntimeException("Seul l'employé du média plan ou son manager peut confirmer la date");
        }
        CalendrierProjet slot = calendrierProjetRepository.findByMediaPlanLigneId(mp.getId()).orElse(null);
        if (accepte) {
            if (slot != null) {
                slot.setStatut(CalendrierProjet.SlotStatus.VALIDE);
                calendrierProjetRepository.save(slot);
                createShootingProjectIfMissing(mp, slot);
            }
            mp.setShootingStatus(StatutShooting.VALIDE);
            mp.setShootingStatusReason(null);
            mediaPlanRepository.save(mp);
            return;
        }
        if (slot != null) {
            calendrierProjetRepository.delete(slot);
        }
        mp.setShootingDate(null);
        mp.setCalendrierProjet(null);
        mp.setShootingStatus(StatutShooting.EN_ATTENTE_DATE);
        mp.setShootingStatusReason("Date refusée par le client");
        mediaPlanRepository.save(mp);
        String retryMsg = "La date proposée pour '" + nullToEmpty(mp.getTitre())
                + "' ne convient pas au client. Choisissez une autre date.";
        for (Employe validator : findShootingValidators()) {
            notificationService.create(validator, "SHOOTING_DATE", retryMsg, null);
        }
    }

    public void onCalendrierSlotStatusUpdated(CalendrierProjet slot) {
        if (slot == null || slot.getMediaPlanLigne() == null) {
            return;
        }

        MediaPlan mp = slot.getMediaPlanLigne();

        if (slot.getStatut() == CalendrierProjet.SlotStatus.VALIDE) {
            mp.setShootingStatus(StatutShooting.VALIDE);
            mp.setShootingStatusReason(null);
            createShootingProjectIfMissing(mp, slot);
        } else if (slot.getStatut() == CalendrierProjet.SlotStatus.REJETE) {
            boolean dejaRefuse = mp.getShootingStatus() == StatutShooting.REJETE;
            mp.setShootingStatus(StatutShooting.REJETE);
            mp.setShootingStatusReason("Date de shooting n'est pas validé");

            // Head Prod refusal should behave like a disapproval in manager views.
            // This mirrors the existing MediaPlan disapprove behavior.
            if (mp.getStatut() != StatutMediaPlan.DESAPPROUVE) {
                mp.setStatutAvantRefusShooting(mp.getStatut());
            }
            mp.setStatut(StatutMediaPlan.DESAPPROUVE);
            if (!dejaRefuse && mp.getCreateur() != null) {
                notificationService.create(mp.getCreateur(), "MEDIA_PLAN_REFUS",
                        "La date du shooting '" + nullToEmpty(mp.getTitre())
                                + "' a été refusée par la Production. Planifiez une autre date depuis votre media plan.",
                        null);
            }
        } else if (slot.getStatut() == CalendrierProjet.SlotStatus.EN_ATTENTE) {
            mp.setShootingStatus(StatutShooting.EN_ATTENTE);
            mp.setShootingStatusReason(null);
        }

        mediaPlanRepository.save(mp);
    }

    /** Shootings dont la date peut encore changer : refusé, ou date déjà posée (en attente du client ou validée). */
    public static boolean isDateModifiable(MediaPlan mp) {
        return mp != null && mp.isShooting() && (mp.getShootingStatus() == StatutShooting.REJETE
                || mp.getShootingStatus() == StatutShooting.EN_ATTENTE_CLIENT_DATE
                || mp.getShootingStatus() == StatutShooting.VALIDE);
    }

    /**
     * Change la date d'un shooting refusé ou déjà posé dans le calendrier.
     * L'employé (ou son manager) donne une nouvelle date au plus tard : le créneau est libéré et la
     * Production est prévenue. La Production (ou l'admin) pose directement la nouvelle date exacte :
     * l'employé, son manager et, si besoin, le client sont prévenus.
     */
    public void replanifierShooting(MediaPlan mp, LocalDate date, Long actorId) {
        if (mp == null || !mp.isShooting()) {
            throw new RuntimeException("Cette ligne n'est pas un shooting");
        }
        if (!isDateModifiable(mp)) {
            throw new RuntimeException("La date de ce shooting ne peut pas être modifiée pour le moment");
        }
        if (date == null) {
            throw new RuntimeException("La nouvelle date est obligatoire");
        }
        if (date.isBefore(LocalDate.now())) {
            throw new RuntimeException("La nouvelle date ne peut pas être dans le passé");
        }
        Employe createur = mp.getCreateur();
        boolean owner = createur != null && actorId != null
                && (actorId.equals(createur.getId())
                        || (createur.getManager() != null && actorId.equals(createur.getManager().getId())));
        boolean production = !owner && (com.antigone.rh.security.SecurityUtils.isAdmin()
                || com.antigone.rh.security.SecurityUtils.hasAnyAuthority("VALIDATE_SHOOTING"));
        if (!owner && !production) {
            throw new RuntimeException("Seul l'employé du média plan, son manager ou la Production peut changer la date");
        }

        boolean refuse = mp.getShootingStatus() == StatutShooting.REJETE;
        LocalDate ancienneDate = mp.getShootingDate();
        if (refuse) {
            mp.setStatut(mp.getStatutAvantRefusShooting() != null ? mp.getStatutAvantRefusShooting() : StatutMediaPlan.APPROUVE);
            mp.setStatutAvantRefusShooting(null);
        }
        mp.setShootingDate(null);
        mp.setShootingStatus(StatutShooting.EN_ATTENTE_DATE);
        mp.setShootingStatusReason(null);

        if (production) {
            if (mp.getShootingAuPlusTard() == null || date.isAfter(mp.getShootingAuPlusTard())) {
                mp.setShootingAuPlusTard(date);
            }
            mediaPlanRepository.save(mp);
            // Réutilise le créneau existant ; prévient l'employé (et le client si sa validation est demandée).
            placeShootingDate(mp, date, actorId);
            if (!refuse && ancienneDate != null && createur != null && createur.getManager() != null) {
                notificationService.create(createur.getManager(), "SHOOTING_DATE",
                        "La date du shooting '" + nullToEmpty(mp.getTitre()) + "' passe du " + ancienneDate
                                + " au " + date + ".", null);
            }
            return;
        }

        // L'employé redemande une date : le créneau réservé est libéré pour la Production.
        CalendrierProjet slot = calendrierProjetRepository.findByMediaPlanLigneId(mp.getId()).orElse(null);
        if (slot != null) {
            mp.setCalendrierProjet(null);
            calendrierProjetRepository.delete(slot);
        }
        mp.setShootingAuPlusTard(date);
        mediaPlanRepository.save(mp);
        Employe actor = employeRepository.findById(actorId).orElse(createur);
        String actorName = (nullToEmpty(actor.getPrenom()) + " " + nullToEmpty(actor.getNom())).trim();
        String raison = refuse ? "(date refusée)"
                : ancienneDate != null ? "(date posée : " + ancienneDate + ")" : "";
        String message = actorName + " a changé la date du shooting '" + nullToEmpty(mp.getTitre()) + "' " + raison
                + " : nouvelle date au plus tard le " + date + ". Posez la date dans le calendrier.";
        for (Employe validator : findShootingValidators()) {
            notificationService.create(validator, "SHOOTING_DATE", message, null);
        }
        if (createur != null && createur.getManager() != null && !actorId.equals(createur.getManager().getId())) {
            notificationService.create(createur.getManager(), "SHOOTING_DATE", message, null);
        }
    }

    private static void requireShootingValidator() {
        if (!com.antigone.rh.security.SecurityUtils.isAdmin()
                && !com.antigone.rh.security.SecurityUtils.hasAnyAuthority("VALIDATE_SHOOTING")) {
            throw new RuntimeException("Seul un responsable tournage peut poser la date");
        }
    }

    /**
     * Personnes désignées pour le tournage : permission VALIDATE_SHOOTING donnée
     * explicitement (pas seulement via un rôle à accès total).
     */
    private List<Employe> findShootingValidators() {
        List<Employe> explicit = employeRepository.findByPermissionExplicite("VALIDATE_SHOOTING");
        if (!explicit.isEmpty()) {
            return explicit;
        }
        List<Employe> any = employeRepository.findByPermission("VALIDATE_SHOOTING");
        if (any.isEmpty()) {
            throw new RuntimeException(
                    "Attribuez la permission « Responsable tournage » (VALIDATE_SHOOTING) à au moins un rôle");
        }
        return any;
    }

    private Employe resolveShootingCalendarOwner(Long actorId) {
        List<Employe> validators = findShootingValidators();
        if (actorId != null) {
            for (Employe validator : validators) {
                if (actorId.equals(validator.getId())) {
                    return validator;
                }
            }
        }
        return validators.get(0);
    }

    private void ensureDateAvailable(Long managerId, LocalDate date, Long ignoreSlotId) {
        if (managerId == null || date == null) {
            return;
        }

        List<CalendrierProjet.SlotStatus> blocking = List.of(
                CalendrierProjet.SlotStatus.EN_ATTENTE,
                CalendrierProjet.SlotStatus.VALIDE
        );

        List<CalendrierProjet> conflicts = calendrierProjetRepository
                .findByManagerIdAndDateSlotBetweenAndStatutIn(managerId, date, date, blocking);

        boolean hasOther = conflicts.stream().anyMatch(s -> ignoreSlotId == null || !s.getId().equals(ignoreSlotId));
        if (hasOther) {
            throw new RuntimeException("Date de shooting indisponible");
        }
    }

    private String buildProjectName(MediaPlan mp) {
        return "📸 Shooting: " + (mp.getTitre() != null ? mp.getTitre() : "Sans titre");
    }

    private void createShootingProjectIfMissing(MediaPlan mp, CalendrierProjet slot) {
        if (mp.getId() == null) {
            return;
        }

        Optional<Projet> existing = projetRepository.findFirstByMediaPlanLigneId(mp.getId());
        if (existing.isPresent()) {
            // Date de shooting changée après coup : le projet suit la nouvelle date.
            if (slot.getDateSlot() != null && !slot.getDateSlot().equals(existing.get().getDateDebut())) {
                existing.get().setDateDebut(slot.getDateSlot());
                projetRepository.save(existing.get());
            }
            return;
        }

        ProjetRequest projetReq = new ProjetRequest();
        projetReq.setNom("👉 Shooting: " + (mp.getTitre() != null ? mp.getTitre() : "Sans titre"));
        projetReq.setDateDebut(slot.getDateSlot() != null ? slot.getDateSlot() : LocalDate.now());
        projetReq.setTypeProjet("INDETERMINE");
        projetReq.setIsMediaPlanProject(true);
        projetReq.setMediaPlanLigneId(mp.getId());
        if (mp.getClient() != null) {
            projetReq.setClientId(mp.getClient().getId());
        }

        Employe chef = slot.getManager() != null ? slot.getManager() : null;
        if (chef != null) {
            projetReq.setChefDeProjetIds(List.of(chef.getId()));
            projetReq.setCreateurId(chef.getId());
        }

        ProjetDTO pDTO = projetService.create(projetReq);
        Projet createdProjet = projetRepository.findById(pDTO.getId()).orElse(null);
        if (createdProjet == null) {
            return;
        }

        String base = mp.getTitre() != null ? mp.getTitre() : "Shooting";
        String[] taskNames = {
                "Shooting - " + base,
                "Post-production - " + base,
                "Validation & Publication - " + base
        };

        for (String tName : taskNames) {
            Tache t = new Tache();
            t.setTitre(tName);
            t.setStatut(StatutTache.TODO);
            t.setProjet(createdProjet);
            t.setUrgente(false);
            tacheRepository.save(t);
        }
    }

    private String nullToEmpty(String v) {
        return v == null ? "" : v;
    }
}
