package com.antigone.rh.repository;

import com.antigone.rh.entity.Compte;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface CompteRepository extends JpaRepository<Compte, Long> {
    Optional<Compte> findByUsername(String username);
    Optional<Compte> findByUsernameIgnoreCase(String username);
    Optional<Compte> findByEmployeId(Long employeId);
    Optional<Compte> findByResetToken(String resetToken);
    Optional<Compte> findByEmployeEmail(String email);
    Optional<Compte> findByEmploye_EmailIgnoreCase(String email);
    Optional<Compte> findByEmploye_MatriculeIgnoreCase(String matricule);
    boolean existsByUsername(String username);
}
