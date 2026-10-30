package com.antigone.rh.repository;

import com.antigone.rh.entity.Conge;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.antigone.rh.enums.StatutDemande;
import com.antigone.rh.enums.TypeConge;

import java.time.LocalDate;
import java.util.List;

@Repository
public interface CongeRepository extends JpaRepository<Conge, Long> {
    List<Conge> findByEmployeId(Long employeId);

    @Query("SELECT c FROM Conge c WHERE c.employe.id = :employeId AND " +
           "c.statut NOT IN (com.antigone.rh.enums.StatutDemande.REFUSEE, com.antigone.rh.enums.StatutDemande.ANNULEE) AND " +
           "((c.dateDebut BETWEEN :debut AND :fin) OR (c.dateFin BETWEEN :debut AND :fin) OR " +
           "(c.dateDebut <= :debut AND c.dateFin >= :fin))")
    List<Conge> findOverlapping(@Param("employeId") Long employeId,
                                 @Param("debut") LocalDate debut,
                                 @Param("fin") LocalDate fin);

    /**
     * Find congés by employee, type, status, and date range (for solde computation).
     */
    @Query("SELECT c FROM Conge c WHERE c.employe.id = :employeId " +
           "AND c.typeConge = :typeConge " +
           "AND c.statut = :statut " +
           "AND c.dateDebut >= :debut AND c.dateDebut <= :fin")
    List<Conge> findByEmployeIdAndTypeCongeAndStatutAndDateDebutBetween(
            @Param("employeId") Long employeId,
            @Param("typeConge") TypeConge typeConge,
            @Param("statut") StatutDemande statut,
            @Param("debut") LocalDate debut,
            @Param("fin") LocalDate fin);

    /**
     * Find congés by employee, type, statut IN list, and date range.
     */
    @Query("SELECT c FROM Conge c WHERE c.employe.id = :employeId " +
           "AND c.typeConge = :typeConge " +
           "AND c.statut IN :statuts " +
           "AND c.dateDebut >= :debut AND c.dateDebut <= :fin")
    List<Conge> findByEmployeIdAndTypeCongeAndStatutInAndDateDebutBetween(
            @Param("employeId") Long employeId,
            @Param("typeConge") TypeConge typeConge,
            @Param("statuts") List<StatutDemande> statuts,
            @Param("debut") LocalDate debut,
            @Param("fin") LocalDate fin);

    /**
     * Find congés that OVERLAP a given date range (for full-month absence check).
     * A congé overlaps [debut, fin] when congé.dateDebut <= fin AND congé.dateFin >= debut.
     */
    @Query("SELECT c FROM Conge c WHERE c.employe.id = :employeId " +
           "AND c.typeConge = :typeConge " +
           "AND c.statut = :statut " +
           "AND c.dateDebut <= :fin AND c.dateFin >= :debut")
    List<Conge> findOverlappingByTypeCongeAndStatut(
            @Param("employeId") Long employeId,
            @Param("typeConge") TypeConge typeConge,
            @Param("statut") StatutDemande statut,
            @Param("debut") LocalDate debut,
            @Param("fin") LocalDate fin);

    /**
     * Find IDs of employees currently on approved leave on a given date.
     */
    @Query("SELECT DISTINCT c.employe.id FROM Conge c WHERE c.statut = com.antigone.rh.enums.StatutDemande.APPROUVEE AND c.dateDebut <= :date AND c.dateFin >= :date")
    List<Long> findEmployeIdsOnLeave(@Param("date") LocalDate date);

    /** L'employé a-t-il un congé approuvé qui couvre cette date (et dont il n'a pas déjà signalé son retour) ? */
    @Query("SELECT COUNT(c) > 0 FROM Conge c WHERE c.employe.id = :employeId AND c.statut = com.antigone.rh.enums.StatutDemande.APPROUVEE AND c.dateDebut <= :date AND c.dateFin >= :date AND (c.retourSignale IS NULL OR c.retourSignale = false)")
    boolean isOnApprovedLeave(@Param("employeId") Long employeId, @Param("date") LocalDate date);

    /** Intérims en cours d'un chef : congé approuvé commencé, avec un intérimaire, retour pas encore signalé. */
    @Query("SELECT c FROM Conge c WHERE c.employe.id = :chefId AND c.statut = com.antigone.rh.enums.StatutDemande.APPROUVEE AND c.delegue IS NOT NULL AND c.dateDebut <= :date AND (c.retourSignale IS NULL OR c.retourSignale = false) ORDER BY c.dateDebut DESC")
    List<Conge> findActiveDelegations(@Param("chefId") Long chefId, @Param("date") LocalDate date);

    /** Intérims en cours confiés à cet employé. */
    @Query("SELECT c FROM Conge c WHERE c.delegue.id = :delegueId AND c.statut = com.antigone.rh.enums.StatutDemande.APPROUVEE AND c.dateDebut <= :date AND (c.retourSignale IS NULL OR c.retourSignale = false) ORDER BY c.dateDebut DESC")
    List<Conge> findActiveDelegationsFor(@Param("delegueId") Long delegueId, @Param("date") LocalDate date);
}
