package com.antigone.rh.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;
import java.time.LocalDate;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EmployeDTO {
    private Long id;
    private String matricule;
    @jakarta.validation.constraints.Pattern(regexp = "^[0-9]{8}$", message = "Le CIN doit contenir exactement 8 chiffres")
    private String cin;
    @jakarta.validation.constraints.Pattern(regexp = "^[0-9]{1,12}(-[0-9]+)*$", message = "Le CNSS doit contenir des chiffres (tirets autorisés)")
    private String cnss;
    private String nom;
    private String prenom;
    private String email;
    private String telephone;
    private String telephonePro;
    private Double salaire;
    private LocalDate dateEmbauche;
    private Double soldeConge;
    private Double soldeCongeInitial;
    private Boolean useInitialSolde;
    private String poste;
    private String typeContrat;
    private LocalDate dateFinContrat;
    private String genre;
    private String departement;
    @jakarta.validation.constraints.Pattern(regexp = "^[0-9]{20}$", message = "Le RIB doit contenir exactement 20 chiffres")
    private String ribBancaire;
    private Long managerId;
    private String managerNom;
    private String imageUrl;
    private String lienDrive;
    private Boolean archived;
    private LocalDateTime archivedAt;
}
