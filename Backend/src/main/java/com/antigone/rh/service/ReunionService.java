package com.antigone.rh.service;

import com.antigone.rh.dto.ReunionDTO;
import com.antigone.rh.dto.ReunionRequest;
import com.antigone.rh.entity.Client;
import com.antigone.rh.entity.Employe;
import com.antigone.rh.entity.Reunion;
import com.antigone.rh.enums.StatutReunion;
import com.antigone.rh.repository.ClientRepository;
import com.antigone.rh.repository.EmployeRepository;
import com.antigone.rh.repository.ReunionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.stream.Collectors;

@Service
@Slf4j
@RequiredArgsConstructor
@Transactional
public class ReunionService {

    private final ReunionRepository reunionRepository;
    private final EmployeRepository employeRepository;
    private final ClientRepository clientRepository;
    private final NotificationService notificationService;
    private final EmailService emailService;

    public ReunionDTO create(ReunionRequest request, Long initiateurId) {
        Employe initiateur = employeRepository.findById(initiateurId)
                .orElseThrow(() -> new RuntimeException("Initiateur introuvable: " + initiateurId));

        Reunion reunion = Reunion.builder()
                .titre(request.getTitre())
                .dateReunion(request.getDateReunion())
                .heureDebut(request.getHeureDebut())
                .heureFin(request.getHeureFin())
                .typeReunion(request.getTypeReunion())
                .plateforme(request.getPlateforme())
            .lienReunion(request.getLienReunion())
                .lieu(request.getLieu())
                .statut(StatutReunion.EN_ATTENTE)
                .initiateur(initiateur)
                .build();

        // Internal participant
        if (request.getParticipantId() != null) {
            Employe participant = employeRepository.findById(request.getParticipantId())
                    .orElseThrow(() -> new RuntimeException("Participant introuvable: " + request.getParticipantId()));
            reunion.setParticipant(participant);
        }

        // External participant (client)
        if (request.getClientParticipantId() != null) {
            Client client = clientRepository.findById(request.getClientParticipantId())
                    .orElseThrow(() -> new RuntimeException("Client introuvable: " + request.getClientParticipantId()));
            reunion.setClientParticipant(client);
            // For client participants, auto-accept (the client is informed by email)
            reunion.setStatut(StatutReunion.ACCEPTEE);
        }

        Reunion saved = reunionRepository.save(reunion);

        // Send notification to internal participant after saving (so reunion has an ID)
        if (saved.getParticipant() != null) {
            String msg = String.format(
                    "%s %s vous invite à une réunion \"%s\" le %s à %s.",
                    initiateur.getPrenom(), initiateur.getNom(),
                    request.getTitre(), request.getDateReunion(), request.getHeureDebut());
            notificationService.createForReunion(saved.getParticipant(), "Demande de réunion", msg, saved);
        }

        // Client invite : envoi d'un email (le portail client n'a pas de centre de notifications).
        if (saved.getClientParticipant() != null) {
            sendClientInvitation(saved, initiateur);
        }

        return toDTO(saved);
    }

    private void sendClientInvitation(Reunion r, Employe initiateur) {
        Client c = r.getClientParticipant();
        String to = (c.getContactEmail() != null && !c.getContactEmail().isBlank()) ? c.getContactEmail() : c.getEmail();
        if (to == null || to.isBlank()) {
            log.warn("Reunion #{} : le client '{}' n'a aucune adresse email, invitation non envoyee", r.getId(), c.getNom());
            return;
        }
        final String dest = to.trim();
        final String clientNom = c.getContactNom() != null && !c.getContactNom().isBlank() ? c.getContactNom() : c.getNom();
        final String initiateurNom = initiateur.getPrenom() + " " + initiateur.getNom();
        // Hors transaction / hors requete : un SMTP lent ne doit pas bloquer la creation de la reunion.
        java.util.concurrent.CompletableFuture.runAsync(() -> {
            try {
                emailService.sendReunionInvitation(dest, clientNom, initiateurNom, r.getTitre(),
                        String.valueOf(r.getDateReunion()), String.valueOf(r.getHeureDebut()),
                        r.getHeureFin() == null ? null : String.valueOf(r.getHeureFin()),
                        r.getTypeReunion() == com.antigone.rh.enums.TypeReunion.EN_LIGNE,
                        r.getPlateforme(), r.getLienReunion(), r.getLieu());
            } catch (Exception e) {
                log.error("Invitation reunion #{} non envoyee a {}: {}", r.getId(), dest, e.getMessage());
            }
        });
    }

    public ReunionDTO respond(Long reunionId, boolean accepter) {
        Reunion reunion = reunionRepository.findById(reunionId)
                .orElseThrow(() -> new RuntimeException("Réunion introuvable: " + reunionId));

        reunion.setStatut(accepter ? StatutReunion.ACCEPTEE : StatutReunion.REFUSEE);
        Reunion saved = reunionRepository.save(reunion);

        // Notify initiateur
        try {
            Employe initiateur = reunion.getInitiateur();
            String participantName = reunion.getParticipant() != null
                    ? reunion.getParticipant().getPrenom() + " " + reunion.getParticipant().getNom()
                    : "Participant";
            String decision = accepter ? "accepté" : "refusé";
            String msg = String.format("%s a %s votre demande de réunion \"%s\" du %s.",
                    participantName, decision, reunion.getTitre(), reunion.getDateReunion());
            notificationService.createForReunion(initiateur,
                    accepter ? "Réunion acceptée" : "Réunion refusée", msg, reunion);
        } catch (Exception e) {
            // Don't fail the response if notification fails
        }

        return toDTO(saved);
    }

    public List<ReunionDTO> findByEmploye(Long employeId) {
        return reunionRepository.findByEmploye(employeId).stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    public List<ReunionDTO> findByEmployeAndBetween(Long employeId, LocalDate start, LocalDate end) {
        return reunionRepository.findByEmployeAndBetween(employeId, start, end).stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    public List<ReunionDTO> findBetween(LocalDate start, LocalDate end) {
        return reunionRepository.findBetween(start, end).stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    public void delete(Long id) {
        reunionRepository.deleteById(id);
    }

    private ReunionDTO toDTO(Reunion r) {
        ReunionDTO.ReunionDTOBuilder builder = ReunionDTO.builder()
                .id(r.getId())
                .titre(r.getTitre())
                .dateReunion(r.getDateReunion())
                .heureDebut(r.getHeureDebut())
                .heureFin(r.getHeureFin())
                .typeReunion(r.getTypeReunion())
                .plateforme(r.getPlateforme())
            .lienReunion(r.getLienReunion())
                .lieu(r.getLieu())
                .statut(r.getStatut())
                .dateCreation(r.getDateCreation());

        try {
            if (r.getInitiateur() != null) {
                builder.initiateurId(r.getInitiateur().getId())
                        .initiateurNom(r.getInitiateur().getNom())
                        .initiateurPrenom(r.getInitiateur().getPrenom());
            }
        } catch (Exception e) { /* lazy load issue */ }

        try {
            if (r.getParticipant() != null) {
                builder.participantId(r.getParticipant().getId())
                        .participantNom(r.getParticipant().getNom())
                        .participantPrenom(r.getParticipant().getPrenom());
            }
        } catch (Exception e) { /* lazy load issue */ }

        try {
            if (r.getClientParticipant() != null) {
                builder.clientParticipantId(r.getClientParticipant().getId())
                        .clientParticipantNom(r.getClientParticipant().getNom());
            }
        } catch (Exception e) { /* lazy load issue */ }

        return builder.build();
    }
}
