package com.antigone.rh.service;

import com.antigone.rh.dto.MediaPlanAssignmentDTO;
import com.antigone.rh.dto.MediaPlanAssignmentRequest;
import com.antigone.rh.entity.Client;
import com.antigone.rh.entity.Employe;
import com.antigone.rh.entity.MediaPlanAssignment;
import com.antigone.rh.exception.ResourceNotFoundException;
import com.antigone.rh.repository.ClientRepository;
import com.antigone.rh.repository.EmployeRepository;
import com.antigone.rh.repository.MediaPlanAssignmentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional
public class MediaPlanAssignmentService {

    private final MediaPlanAssignmentRepository assignmentRepository;
    private final EmployeRepository employeRepository;
    private final ClientRepository clientRepository;

    /**
     * Assign multiple employees to a client.
     */
    public List<MediaPlanAssignmentDTO> assignEmployees(MediaPlanAssignmentRequest request) {
        Client client = clientRepository.findById(request.getClientId())
                .orElseThrow(() -> new ResourceNotFoundException("Client", request.getClientId()));

        List<MediaPlanAssignmentDTO> results = new ArrayList<>();

        for (Long employeId : request.getEmployeIds()) {
            if (assignmentRepository.existsByEmployeIdAndClientId(employeId, request.getClientId())) {
                continue; // skip already assigned
            }
            Employe employe = employeRepository.findById(employeId)
                    .orElseThrow(() -> new ResourceNotFoundException("Employe", employeId));

            MediaPlanAssignment assignment = MediaPlanAssignment.builder()
                    .employe(employe)
                    .client(client)
                    .build();

            results.add(toDTO(assignmentRepository.save(assignment)));
        }

        return results;
    }

    public List<MediaPlanAssignmentDTO> getByClient(Long clientId) {
        return assignmentRepository.findByClientId(clientId).stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    public List<MediaPlanAssignmentDTO> getByEmploye(Long employeId) {
        return assignmentRepository.findByEmployeId(employeId).stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    public void removeAssignment(Long id) {
        if (!assignmentRepository.existsById(id)) {
            throw new ResourceNotFoundException("MediaPlanAssignment", id);
        }
        assignmentRepository.deleteById(id);
    }

    /**
     * Employés assignables aux clients média plan : permission VIEW_MEDIA_PLAN
     * donnée explicitement (les rôles à accès total ne remplissent pas cette liste).
     */
    public List<Employe> getSocialMediaEmployees() {
        return employeRepository.findByPermissionExplicite("VIEW_MEDIA_PLAN");
    }

    private MediaPlanAssignmentDTO toDTO(MediaPlanAssignment a) {
        return MediaPlanAssignmentDTO.builder()
                .id(a.getId())
                .employeId(a.getEmploye().getId())
                .employeNom(a.getEmploye().getNom())
                .employePrenom(a.getEmploye().getPrenom())
                .employeDepartement(a.getEmploye().getDepartement())
                .clientId(a.getClient().getId())
                .clientNom(a.getClient().getNom())
                .dateAssignment(a.getDateAssignment() != null ? a.getDateAssignment().toString() : null)
                .build();
    }
}
