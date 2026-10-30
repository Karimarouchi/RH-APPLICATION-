package com.antigone.rh.dto;

import com.antigone.rh.enums.StatutDemande;
import com.antigone.rh.enums.TypeDemande;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DemandeResponse {
    private Long id;
    private TypeDemande type;
    private LocalDateTime dateCreation;
    private StatutDemande statut;
    private String raison;
    private String motifRefus;
    private Long employeId;
    private String employeNom;

    /** Chef de département qui valide en premier (null si la demande va directement au RH). */
    private Long chefValidateurId;
    private String chefValidateurNom;
    /** Décision du chef : EN_ATTENTE, APPROUVEE (transmise au RH) ou REFUSEE. */
    private String decisionChef;
    /** Le chef attendu est en congé aujourd'hui : le RH peut décider à sa place. */
    private Boolean chefEnConge;

    // For Conge
    private String typeConge;
    private String typeCongeLabel;
    private Integer nombreJours;
    private Integer joursOuvrables;
    private LocalDate dateDebut;
    private LocalDate dateFin;
    private String justificatifPath;

    // For Autorisation
    private LocalDate date;
    private LocalTime heureDebut;
    private LocalTime heureFin;
    private Long dureeMinutes;

    // For Teletravail (uses dateDebut/dateFin above)
}
