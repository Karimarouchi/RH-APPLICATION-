package com.antigone.rh.service;

import com.antigone.rh.dto.CalendrierProjetDTO;
import com.antigone.rh.entity.CalendrierProjet;
import com.antigone.rh.entity.Employe;
import com.antigone.rh.enums.TypeContenuShooting;
import com.antigone.rh.repository.CalendrierProjetRepository;
import com.antigone.rh.repository.EmployeRepository;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CalendrierProjetService {

    private final CalendrierProjetRepository repository;
    private final EmployeRepository employeRepository;
    private final NotificationService notificationService;
    private final EmailService emailService;
    private final MediaPlanShootingWorkflowService mediaPlanShootingWorkflowService;

    public List<CalendrierProjetDTO> getSlotsBetween(LocalDate start, LocalDate end) {
        List<CalendrierProjet.SlotStatus> visible = List.of(CalendrierProjet.SlotStatus.EN_ATTENTE, CalendrierProjet.SlotStatus.VALIDE);
        return repository.findByDateSlotBetweenAndStatutIn(start, end, visible).stream().map(this::toDTO).collect(Collectors.toList());
    }

    public List<CalendrierProjetDTO> getManagerSlotsBetween(Long managerId, LocalDate start, LocalDate end) {
        List<CalendrierProjet.SlotStatus> visible = List.of(CalendrierProjet.SlotStatus.EN_ATTENTE, CalendrierProjet.SlotStatus.VALIDE);
        return repository.findByManagerIdAndDateSlotBetweenAndStatutIn(managerId, start, end, visible).stream().map(this::toDTO).collect(Collectors.toList());
    }

    @Transactional
    public CalendrierProjetDTO createBusySlot(CalendrierProjetDTO dto) {
        Employe manager = employeRepository.findById(dto.getManagerId())
                .orElseThrow(() -> new RuntimeException("Manager introuvable"));

        CalendrierProjet slot = CalendrierProjet.builder()
                .dateSlot(dto.getDateSlot())
                .manager(manager)
                .socialManager(null)
                .projectName(dto.getProjectName())
            .description(dto.getDescription())
            .localisation(dto.getLocalisation())
            .typeDeContenu(parseTypeContenuOrNull(dto.getTypeDeContenu()))
                .urgent(dto.isUrgent())
                .type(CalendrierProjet.SlotType.BUSY)
                .statut(CalendrierProjet.SlotStatus.VALIDE)
                .build();
                
        return toDTO(repository.save(slot));
    }

    @Transactional
    public CalendrierProjetDTO createBookedSlot(CalendrierProjetDTO dto) {
        Employe manager = employeRepository.findById(dto.getManagerId())
                .orElseThrow(() -> new RuntimeException("Manager introuvable"));
        
        Employe socialManager = null;
        if(dto.getSocialManagerId() != null) {
            socialManager = employeRepository.findById(dto.getSocialManagerId()).orElse(null);
        }
        
        CalendrierProjet slot = CalendrierProjet.builder()
                .dateSlot(dto.getDateSlot())
                .manager(manager)
                .socialManager(socialManager)
                .projectName(dto.getProjectName())
            .description(dto.getDescription())
            .localisation(dto.getLocalisation())
            .typeDeContenu(parseTypeContenuOrNull(dto.getTypeDeContenu()))
                .urgent(dto.isUrgent())
                .type(CalendrierProjet.SlotType.BOOKED)
                .statut(CalendrierProjet.SlotStatus.EN_ATTENTE)
                .build();
                
        slot = repository.save(slot);

        // Envoyer une notification au manager
        String socialManagerName = socialManager != null ? socialManager.getPrenom() + " " + socialManager.getNom() : "Un Social Media Manager";
        String message = socialManagerName + " a planifié le projet '" + dto.getProjectName() + "' le " + dto.getDateSlot() + ". Veuillez valider.";
        if (dto.isUrgent()) {
            notificationService.createUrgent(manager, "PLANIFICATION_PROJET", message, null);
        } else {
            notificationService.create(manager, "PLANIFICATION_PROJET", message, null);
        }
        
        if(dto.isUrgent()) {
            // Optionnel: On peut envoyer un email ici si EmailService est mis à jour
        }
        
        return toDTO(slot);
    }

    @Transactional
    public CalendrierProjetDTO updateSlotStatus(Long id, String newStatus) {
        CalendrierProjet slot = repository.findById(id).orElseThrow(() -> new RuntimeException("Créneau introuvable"));
        slot.setStatut(CalendrierProjet.SlotStatus.valueOf(newStatus));
        
        slot = repository.save(slot);

        // If this slot is linked to a MediaPlan shooting line, propagate status and trigger project creation.
        mediaPlanShootingWorkflowService.onCalendrierSlotStatusUpdated(slot);

        // Un shooting refusé a déjà sa propre notification (avec l'invitation à replanifier).
        boolean shootingRefuse = slot.getMediaPlanLigne() != null
                && slot.getStatut() == CalendrierProjet.SlotStatus.REJETE;
        if(slot.getSocialManager() != null && !shootingRefuse) {
            String message = "La planification pour le projet '" + slot.getProjectName() + "' a été " + newStatus;
            notificationService.create(slot.getSocialManager(), "REPONSE_PLANIFICATION", message, null);
        }

        return toDTO(slot);
    }

    @Transactional
    public void deleteSlot(Long id) {
        CalendrierProjet slot = repository.findById(id).orElse(null);
        if (slot == null) {
            repository.deleteById(id);
            return;
        }

        // For shooting slots linked to a MediaPlan line, a refusal should be tracked,
        // not hard-deleted.
        if (slot.getMediaPlanLigne() != null) {
            slot.setStatut(CalendrierProjet.SlotStatus.REJETE);
            slot = repository.save(slot);
            mediaPlanShootingWorkflowService.onCalendrierSlotStatusUpdated(slot);
            return;
        }

        repository.deleteById(id);
    }

    private CalendrierProjetDTO toDTO(CalendrierProjet entity) {
        CalendrierProjetDTO dto = new CalendrierProjetDTO();
        dto.setId(entity.getId());
        dto.setDateSlot(entity.getDateSlot());
        dto.setManagerId(entity.getManager().getId());
        if(entity.getSocialManager() != null) dto.setSocialManagerId(entity.getSocialManager().getId());
        dto.setProjectName(entity.getProjectName());
        dto.setDescription(entity.getDescription());
        dto.setLocalisation(entity.getLocalisation());
        dto.setTypeDeContenu(entity.getTypeDeContenu() != null ? entity.getTypeDeContenu().name() : null);
        if (entity.getMediaPlanLigne() != null) {
            dto.setMediaPlanLigneId(entity.getMediaPlanLigne().getId());
            dto.setTitre(entity.getMediaPlanLigne().getTitre());
            if (entity.getMediaPlanLigne().getClient() != null) {
                dto.setClientId(entity.getMediaPlanLigne().getClient().getId());
                dto.setClientNom(entity.getMediaPlanLigne().getClient().getNom());
            }
        }
        dto.setUrgent(entity.isUrgent());
        dto.setType(entity.getType().name());
        dto.setStatut(entity.getStatut().name());
        return dto;
    }

    private TypeContenuShooting parseTypeContenuOrNull(String value) {
        if (value == null) return null;
        String v = value.trim();
        if (v.isBlank()) return null;

        String normalized = v.toUpperCase();
        if ("PHOTO".equals(normalized)) return TypeContenuShooting.PHOTO;
        if ("VIDEO".equals(normalized)) return TypeContenuShooting.VIDEO;
        if ("BOTH".equals(normalized)) return TypeContenuShooting.BOTH;

        throw new RuntimeException("Type de contenu invalide: '" + value + "' (attendu: PHOTO, VIDEO, BOTH)");
    }
}