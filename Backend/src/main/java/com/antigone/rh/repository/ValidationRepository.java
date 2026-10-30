package com.antigone.rh.repository;

import com.antigone.rh.entity.Validation;
import com.antigone.rh.enums.DecisionValidation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ValidationRepository extends JpaRepository<Validation, Long> {
    List<Validation> findByDemandeId(Long demandeId);
    List<Validation> findByValidateurId(Long validateurId);
    List<Validation> findByDemandeIdOrderByOrdreAsc(Long demandeId);
    List<Validation> findByValidateurIdAndDecision(Long validateurId, DecisionValidation decision);
    List<Validation> findByOrdreAndDecision(Integer ordre, DecisionValidation decision);
}
