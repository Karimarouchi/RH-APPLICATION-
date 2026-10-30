package com.antigone.rh.service;

import com.antigone.rh.dto.ValidationRequest;
import com.antigone.rh.entity.Demande;
import com.antigone.rh.entity.Employe;
import com.antigone.rh.entity.Validation;
import com.antigone.rh.enums.DecisionValidation;
import com.antigone.rh.enums.StatutDemande;
import com.antigone.rh.repository.DemandeRepository;
import com.antigone.rh.repository.EmployeRepository;
import com.antigone.rh.repository.ValidationRepository;
import com.antigone.rh.security.SecurityUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional
public class ValidationService {

    private final ValidationRepository validationRepository;
    private final DemandeRepository demandeRepository;
    private final EmployeRepository employeRepository;
    private final DemandeService demandeService;

    public List<Validation> findByDemande(Long demandeId) {
        return validationRepository.findByDemandeIdOrderByOrdreAsc(demandeId);
    }

    public List<Validation> findByValidateur(Long validateurId) {
        return validationRepository.findByValidateurId(validateurId);
    }

    public List<Validation> findPendingByValidateur(Long validateurId) {
        return validationRepository.findByValidateurIdAndDecision(validateurId, DecisionValidation.EN_ATTENTE);
    }

    public Validation createValidationStep(ValidationRequest request) {
        Demande demande = demandeRepository.findById(request.getDemandeId())
                .orElseThrow(() -> new RuntimeException("Demande non trouvée"));
        Employe validateur = employeRepository.findById(request.getValidateurId())
                .orElseThrow(() -> new RuntimeException("Validateur non trouvé"));

        Validation validation = Validation.builder()
                .demande(demande)
                .validateur(validateur)
                .ordre(request.getOrdre())
                .decision(DecisionValidation.EN_ATTENTE)
                .build();

        if (demande.getStatut() == StatutDemande.EN_ATTENTE) {
            // Demande is already in EN_ATTENTE state
            demandeRepository.save(demande);
        }

        return validationRepository.save(validation);
    }

    /** Le chef décide via sa page : même traitement que le RH (solde, historique, notification). */
    public Validation approve(Long validationId, String commentaire) {
        Validation validation = findOwnPendingStep(validationId);
        demandeService.approve(validation.getDemande().getId(), validation.getValidateur().getId());
        if (commentaire != null && !commentaire.isBlank()) {
            validation.setCommentaire(commentaire);
        }
        return validationRepository.save(validation);
    }

    public Validation refuse(Long validationId, String commentaire) {
        Validation validation = findOwnPendingStep(validationId);
        demandeService.refuse(validation.getDemande().getId(), validation.getValidateur().getId(), commentaire);
        return validation;
    }

    private Validation findOwnPendingStep(Long validationId) {
        Validation validation = validationRepository.findById(validationId)
                .orElseThrow(() -> new RuntimeException("Validation non trouvée"));
        if (!SecurityUtils.isAdmin()
                && !validation.getValidateur().getId().equals(SecurityUtils.currentEmployeIdOrNull())) {
            throw new org.springframework.security.access.AccessDeniedException("Vous n'etes pas le validateur designe");
        }
        if (validation.getDecision() != DecisionValidation.EN_ATTENTE) {
            throw new RuntimeException("Cette validation a déjà été traitée");
        }
        return validation;
    }
}
