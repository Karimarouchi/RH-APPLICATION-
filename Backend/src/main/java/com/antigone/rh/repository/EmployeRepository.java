package com.antigone.rh.repository;

import com.antigone.rh.entity.Employe;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface EmployeRepository extends JpaRepository<Employe, Long> {
    Optional<Employe> findByMatricule(String matricule);
    boolean existsByMatricule(String matricule);
    Optional<Employe> findByEmail(String email);
    boolean existsByEmail(String email);
    Optional<Employe> findByCin(String cin);
    boolean existsByCin(String cin);
    List<Employe> findByManagerId(Long managerId);
    List<Employe> findByManagerIsNull();
    List<Employe> findAllByArchivedFalse();
    List<Employe> findAllByArchivedTrue();

    @Query("SELECT e FROM Employe e WHERE e.manager IS NULL AND e.archived = false")
    List<Employe> findByManagerIsNullAndArchivedFalse();
    @Query("SELECT e FROM Employe e JOIN e.compte c JOIN c.roles r WHERE UPPER(r.nom) = UPPER(:roleName)")
    List<Employe> findByRoleName(@Param("roleName") String roleName);

    @Query("SELECT DISTINCT e FROM Employe e JOIN e.compte c "
            + "WHERE (e.archived = false OR e.archived IS NULL) AND ("
            + "EXISTS (SELECT 1 FROM c.permissionsAjoutees pa WHERE pa.permission = :code) "
            + "OR (EXISTS (SELECT 1 FROM c.roles r JOIN r.permissions p WHERE p.permission = :code) "
            + "AND NOT EXISTS (SELECT 1 FROM c.permissionsRetirees pr WHERE pr.permission = :code)))")
    List<Employe> findByPermission(@Param("code") String code);

    @Query("SELECT e FROM Employe e WHERE e.dateFinContrat IS NOT NULL AND e.dateFinContrat = :date")
    List<Employe> findByDateFinContrat(@Param("date") LocalDate date);

    @Query("SELECT e FROM Employe e WHERE e.typeContrat = 'CIVP' AND e.dateFinContrat = :date")
    List<Employe> findCivpByDateFinContrat(@Param("date") LocalDate date);

    // ✅ Nouvelle query — cherche tous les CIVP expirant dans une plage de dates
    @Query("SELECT e FROM Employe e WHERE e.typeContrat = 'CIVP' " +
           "AND e.dateFinContrat IS NOT NULL " +
           "AND e.dateFinContrat >= :dateDebut " +
           "AND e.dateFinContrat <= :dateFin")
    List<Employe> findCivpExpiringBetween(
            @Param("dateDebut") LocalDate dateDebut,
            @Param("dateFin") LocalDate dateFin
    );
}
