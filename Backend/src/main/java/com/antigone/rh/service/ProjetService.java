package com.antigone.rh.service;

import com.antigone.rh.dto.ProjetDTO;
import com.antigone.rh.dto.ProjetRequest;
import com.antigone.rh.entity.Client;
import com.antigone.rh.entity.Employe;
import com.antigone.rh.entity.Projet;
import com.antigone.rh.entity.Equipe;
import com.antigone.rh.enums.StatutProjet;
import com.antigone.rh.repository.ClientRepository;
import com.antigone.rh.repository.EmployeRepository;
import com.antigone.rh.repository.ProjetRepository;
import com.antigone.rh.repository.EquipeRepository;
import com.antigone.rh.repository.TacheRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional
@Slf4j
public class ProjetService {

    private final ProjetRepository projetRepository;
    private final EmployeRepository employeRepository;
    private final EquipeRepository equipeRepository;
    private final ClientRepository clientRepository;
    private final EmployeService employeService;
    private final TacheRepository tacheRepository;
    private final com.antigone.rh.repository.ReactifInternRepository reactifInternRepository;

    public List<ProjetDTO> findAll() {
        return projetRepository.findAll().stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    public Projet findEntityById(Long id) {
        return projetRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Projet non trouvé avec l'id: " + id));
    }

    public ProjetDTO findById(Long id) {
        return toDTO(findEntityById(id));
    }

    public List<ProjetDTO> findByStatut(StatutProjet statut) {
        return projetRepository.findByStatut(statut).stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    public List<ProjetDTO> findByEmploye(Long employeId) {
        // Projects created by this user, where they are chef de projet, or selected as
        // a member
        List<Projet> parCreateur = projetRepository.findByCreateurId(employeId);
        List<Projet> parChef = projetRepository.findByChefDeProjetId(employeId);
        List<Projet> parChefs = projetRepository.findByChefsDeProjetId(employeId);
        List<Projet> parMembre = projetRepository.findByMembreId(employeId);

        return java.util.stream.Stream.of(parCreateur, parChef, parChefs, parMembre)
                .flatMap(List::stream)
                .collect(java.util.stream.Collectors.toMap(
                        Projet::getId,
                        p -> p,
                        (existing, dup) -> existing,
                        java.util.LinkedHashMap::new))
                .values().stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    public List<ProjetDTO> findByDepartement(String departement) {
        return projetRepository.findByDepartement(departement).stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    public List<ProjetDTO> findByClient(Long clientId) {
        return projetRepository.findByClientId(clientId).stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    public ProjetDTO create(ProjetRequest request) {
        String type = request.getTypeProjet() != null ? request.getTypeProjet() : "DETERMINE";
        boolean isIndetermine = "INDETERMINE".equalsIgnoreCase(type);
        validateDates(request.getDateDebut(), isIndetermine ? null : request.getDateFin(), true);

        Projet projet = new Projet();
        projet.setNom(request.getNom());
        projet.setDateDebut(request.getDateDebut());
        projet.setDateFin(isIndetermine ? null : request.getDateFin());
        projet.setTypeProjet(type);
        projet.setDescription(request.getDescription());
        projet.setIsMediaPlanProject(Boolean.TRUE.equals(request.getIsMediaPlanProject()));
        projet.setMediaPlanLigneId(request.getMediaPlanLigneId());
        projet.setStatut(StatutProjet.PLANIFIE);

        // Primary chef de projet (first in chefDeProjetIds or legacy single field)
        List<Long> chefIds = request.getChefDeProjetIds();
        if (chefIds != null && !chefIds.isEmpty()) {
            Employe primaryChef = employeRepository.findById(chefIds.get(0))
                    .orElseThrow(() -> new RuntimeException("Chef de projet introuvable: " + chefIds.get(0)));
            projet.setChefDeProjet(primaryChef);
            List<Employe> chefs = employeRepository.findAllById(chefIds);
            projet.getChefsDeProjet().clear();
            projet.getChefsDeProjet().addAll(chefs);
            projet.setDateAffectationChef(LocalDateTime.now());
        } else if (request.getChefDeProjetId() != null) {
            Employe chef = employeRepository.findById(request.getChefDeProjetId())
                    .orElseThrow(
                            () -> new RuntimeException("Chef de projet introuvable: " + request.getChefDeProjetId()));
            projet.setChefDeProjet(chef);
            projet.getChefsDeProjet().add(chef);
            projet.setDateAffectationChef(LocalDateTime.now());
        }

        // Linked validated client (optional)
        if (request.getClientId() != null) {
            Client client = clientRepository.findById(request.getClientId())
                    .orElseThrow(() -> new RuntimeException("Client introuvable: " + request.getClientId()));
            projet.setClient(client);
        }

        // Createur
        if (request.getCreateurId() != null) {
            Employe createur = employeRepository.findById(request.getCreateurId())
                    .orElseThrow(() -> new RuntimeException("Créateur introuvable: " + request.getCreateurId()));
            projet.setCreateur(createur);
        }

        Projet savedProjet = projetRepository.save(projet);

        // Team assignment
        if (request.getEquipeIds() != null && !request.getEquipeIds().isEmpty()) {
            for (Long equipeId : request.getEquipeIds()) {
                Equipe equipe = equipeRepository.findById(equipeId)
                        .orElseThrow(() -> new RuntimeException("Équipe non trouvée: " + equipeId));
                if (equipe.getProjet() != null && !equipe.getProjet().getId().equals(savedProjet.getId())) {
                    throw new IllegalArgumentException("L'équipe \"" + equipe.getNom() + "\" est déjà assignée.");
                }
                equipe.setProjet(savedProjet);
                equipeRepository.save(equipe);
            }
        }

        // Member assignment
        if (request.getMembreIds() != null && !request.getMembreIds().isEmpty()) {
            List<Employe> membres = employeRepository.findAllById(request.getMembreIds());
            savedProjet.getMembres().clear();
            savedProjet.getMembres().addAll(membres);
            projetRepository.save(savedProjet);
        } else {
            savedProjet.getMembres().clear();
        }

        return toDTO(savedProjet);
    }

    public ProjetDTO update(Long id, ProjetRequest request) {
        String type = request.getTypeProjet() != null ? request.getTypeProjet() : "DETERMINE";
        boolean isIndetermine = "INDETERMINE".equalsIgnoreCase(type);
        validateDates(request.getDateDebut(), isIndetermine ? null : request.getDateFin(), false);

        Projet projet = findEntityById(id);
        projet.setNom(request.getNom());
        projet.setDateDebut(request.getDateDebut());
        projet.setDateFin(isIndetermine ? null : request.getDateFin());
        projet.setTypeProjet(type);
        projet.setDescription(request.getDescription());
        if (request.getIsMediaPlanProject() != null)
            projet.setIsMediaPlanProject(request.getIsMediaPlanProject());
        if (request.getMediaPlanLigneId() != null)
            projet.setMediaPlanLigneId(request.getMediaPlanLigneId());

        if (request.getStatut() != null && !request.getStatut().isBlank()) {
            try {
                projet.setStatut(StatutProjet.valueOf(request.getStatut()));
            } catch (IllegalArgumentException ignored) {
            }
        }

        // Chefs de projet (multiple)
        List<Long> chefIds = request.getChefDeProjetIds();
        if (chefIds != null) {
            boolean hadChefBefore = projet.getChefDeProjet() != null;
            projet.getChefsDeProjet().clear();
            if (!chefIds.isEmpty()) {
                List<Employe> chefs = employeRepository.findAllById(chefIds);
                projet.getChefsDeProjet().addAll(chefs);
                projet.setChefDeProjet(chefs.get(0));
                if (!hadChefBefore || projet.getDateAffectationChef() == null) {
                    projet.setDateAffectationChef(LocalDateTime.now());
                }
            } else {
                projet.setChefDeProjet(null);
            }
        } else if (request.getChefDeProjetId() != null) {
            boolean hadChefBefore = projet.getChefDeProjet() != null;
            Employe chef = employeRepository.findById(request.getChefDeProjetId()).orElseThrow();
            projet.setChefDeProjet(chef);
            if (!projet.getChefsDeProjet().contains(chef))
                projet.getChefsDeProjet().add(chef);
            if (!hadChefBefore || projet.getDateAffectationChef() == null) {
                projet.setDateAffectationChef(LocalDateTime.now());
            }
        } else {
            projet.setChefDeProjet(null);
            projet.getChefsDeProjet().clear();
        }

        // Linked client
        if (request.getClientId() != null) {
            projet.setClient(clientRepository.findById(request.getClientId()).orElseThrow());
        } else {
            projet.setClient(null);
        }

        Projet savedProjet = projetRepository.save(projet);

        // Team assignments
        List<Equipe> currentEquipes = equipeRepository.findByProjetId(savedProjet.getId());
        List<Long> newEquipeIds = request.getEquipeIds() != null ? request.getEquipeIds() : Collections.emptyList();
        for (Equipe eq : currentEquipes) {
            if (!newEquipeIds.contains(eq.getId())) {
                eq.setProjet(null);
                equipeRepository.save(eq);
            }
        }
        for (Long equipeId : newEquipeIds) {
            Equipe equipe = equipeRepository.findById(equipeId)
                    .orElseThrow(() -> new RuntimeException("Équipe introuvable: " + equipeId));
            if (equipe.getProjet() != null && !equipe.getProjet().getId().equals(savedProjet.getId()))
                throw new IllegalArgumentException("L'équipe \"" + equipe.getNom() + "\" est déjà assignée.");
            equipe.setProjet(savedProjet);
            equipeRepository.save(equipe);
        }

        // Members
        if (request.getMembreIds() != null) {
            List<Employe> newMembres = request.getMembreIds().isEmpty()
                    ? Collections.emptyList()
                    : employeRepository.findAllById(request.getMembreIds());
            savedProjet.getMembres().clear();
            savedProjet.getMembres().addAll(newMembres);

            // Auto-assign tasks for Media Plan Projects
            if (Boolean.TRUE.equals(savedProjet.getIsMediaPlanProject()) && !savedProjet.getMembres().isEmpty()) {
                Employe targetAssignee = savedProjet.getMembres().get(0);
                List<com.antigone.rh.entity.Tache> tasks = tacheRepository.findByProjetId(savedProjet.getId());
                if (tasks != null) {
                    for (com.antigone.rh.entity.Tache t : tasks) {
                        if (t.getAssignee() == null) {
                            t.setAssignee(targetAssignee);
                            tacheRepository.save(t);
                        }
                    }
                }
            }
        }

        return toDTO(projetRepository.save(savedProjet));
    }

    public void delete(Long id) {
        if (!projetRepository.existsById(id)) {
            throw new RuntimeException("Projet introuvable");
        }
        // Les rectifs pointent vers les taches (cle etrangere) : a supprimer avant les taches.
        for (com.antigone.rh.entity.Tache t : tacheRepository.findByProjetId(id)) {
            reactifInternRepository.deleteAll(reactifInternRepository.findByTache_IdOrderByDateReactifDesc(t.getId()));
        }
        reactifInternRepository.flush();
        List<Equipe> equipes = equipeRepository.findByProjetId(id);
        for (Equipe eq : equipes) {
            eq.setProjet(null);
            equipeRepository.save(eq);
        }
        projetRepository.deleteById(id);
    }

    /**
     * CORRECTION 3 — Check for open tasks before closure.
     * CORRECTION 5 — Distinguish CLOTURE from CLOTURE_INCOMPLET.
     *
     * @param forceClosure if true, force closure even with open tasks
     */
    public ProjetDTO changeStatut(Long id, StatutProjet statut) {
        return changeStatut(id, statut, false);
    }

    public ProjetDTO changeStatut(Long id, StatutProjet statut, boolean forceClosure) {
        Projet projet = findEntityById(id);

        // ── CORRECTION 3: Check open tasks before closure ────────────────
        if (statut == StatutProjet.CLOTURE || statut == StatutProjet.CLOTURE_INCOMPLET) {
            List<com.antigone.rh.entity.Tache> taches = tacheRepository.findByProjetId(id);
            long openTasks = taches.stream()
                    .filter(t -> t.getStatut() != com.antigone.rh.enums.StatutTache.DONE)
                    .count();

            if (openTasks > 0 && !forceClosure) {
                // Return error with details about open tasks for frontend modal
                List<String> openTaskDetails = taches.stream()
                        .filter(t -> t.getStatut() != com.antigone.rh.enums.StatutTache.DONE)
                        .map(t -> {
                            String emp = "Non assigné";
                            try {
                                if (t.getAssignee() != null)
                                    emp = t.getAssignee().getPrenom() + " " + t.getAssignee().getNom();
                            } catch (Exception ignored) {
                            }
                            return t.getTitre() + " → " + t.getStatut() + " → " + emp;
                        })
                        .collect(Collectors.toList());

                throw new IllegalStateException(
                        "CLOTURE_INCOMPLETE:" + openTasks + ":"
                                + String.join("|", openTaskDetails));
            }

            projet.setDateCloture(LocalDateTime.now());

            if (openTasks > 0) {
                // Forced closure with open tasks → CLOTURE_INCOMPLET
                projet.setStatut(StatutProjet.CLOTURE_INCOMPLET);
                projet.setClotureForcee(true);
                projet.setTachesAbandonnees((int) openTasks);
                log.warn("⚠ Projet #{} clôturé avec {} tâches non terminées (clôture forcée)", id, openTasks);
            } else {
                // All tasks done → clean CLOTURE
                projet.setStatut(StatutProjet.CLOTURE);
                projet.setClotureForcee(false);
                projet.setTachesAbandonnees(0);
                log.info("✅ Projet #{} clôturé proprement — 100% des tâches terminées", id);
            }
        } else {
            projet.setStatut(statut);
        }

        return toDTO(projetRepository.save(projet));
    }

    public ProjetDTO toDTO(Projet projet) {
        List<Equipe> equipes;
        try {
            equipes = equipeRepository.findByProjetId(projet.getId());
        } catch (Exception e) {
            equipes = Collections.emptyList();
        }
        List<Long> equipeIds = equipes.stream().map(Equipe::getId).collect(Collectors.toList());

        List<com.antigone.rh.dto.EmployeDTO> membresDTO;
        try {
            membresDTO = projet.getMembres() != null
                    ? projet.getMembres().stream().map(employeService::toDTO).collect(Collectors.toList())
                    : Collections.emptyList();
        } catch (Exception e) {
            membresDTO = Collections.emptyList();
        }

        List<com.antigone.rh.dto.EmployeDTO> chefsDTO;
        try {
            chefsDTO = projet.getChefsDeProjet() != null
                    ? projet.getChefsDeProjet().stream().map(employeService::toDTO).collect(Collectors.toList())
                    : Collections.emptyList();
        } catch (Exception e) {
            chefsDTO = Collections.emptyList();
        }

        Long clientId = null;
        String clientNom = null;
        try {
            if (projet.getClient() != null) {
                clientId = projet.getClient().getId();
                clientNom = projet.getClient().getNom();
            }
        } catch (Exception e) {
            /* client column missing - ignore until backend restarts */ }

        Long createurId = null;
        String createurNom = null;
        try {
            if (projet.getCreateur() != null) {
                createurId = projet.getCreateur().getId();
                createurNom = projet.getCreateur().getPrenom() + " " + projet.getCreateur().getNom();
            }
        } catch (Exception e) {
            /* ignore */ }

        com.antigone.rh.dto.EmployeDTO chefDTO = null;
        try {
            if (projet.getChefDeProjet() != null) {
                chefDTO = employeService.toDTO(projet.getChefDeProjet());
            }
        } catch (Exception e) {
            /* ignore */ }

        return ProjetDTO.builder()
                .id(projet.getId())
                .nom(projet.getNom())
                .statut(projet.getStatut())
                .dateDebut(projet.getDateDebut())
                .dateFin(projet.getDateFin())
                .typeProjet(projet.getTypeProjet() != null ? projet.getTypeProjet() : "DETERMINE")
                .description(projet.getDescription())
                .isMediaPlanProject(projet.getIsMediaPlanProject())
                .mediaPlanLigneId(projet.getMediaPlanLigneId())
                .chefDeProjet(chefDTO)
                .chefsDeProjet(chefsDTO)
                .createurId(createurId)
                .createurNom(createurNom)
                .equipeId(equipes != null && !equipes.isEmpty() ? equipes.get(0).getId() : null)
                .equipeIds(equipeIds)
                .equipeNoms(equipes != null
                        ? equipes.stream().map(Equipe::getNom).collect(Collectors.toList())
                        : Collections.emptyList())
                .membres(membresDTO)
                .clientId(clientId)
                .clientNom(clientNom)
                .clotureForcee(projet.getClotureForcee())
                .tachesAbandonnees(projet.getTachesAbandonnees())
                .build();
    }

    private void validateDates(LocalDate dateDebut, LocalDate dateFin, boolean isNew) {
        if (isNew && dateDebut != null && dateDebut.isBefore(LocalDate.now())) {
            throw new IllegalArgumentException("La date de début doit être aujourd'hui ou plus tard");
        }
        // dateFin is null for INDETERMINE projects — skip validation in that case
        if (dateDebut != null && dateFin != null && !dateFin.isAfter(dateDebut)) {
            throw new IllegalArgumentException("La date de fin doit être après la date de début");
        }
    }
}
