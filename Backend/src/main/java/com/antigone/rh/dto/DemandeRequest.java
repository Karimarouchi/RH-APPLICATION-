package com.antigone.rh.dto;

import com.antigone.rh.enums.TypeDemande;
import lombok.Data;

import java.time.LocalDate;
import java.time.LocalTime;

@Data
public class DemandeRequest {
    private TypeDemande type;
    private String raison;
    private Long employeId;

    // For Conge
    private String typeConge;
    private LocalDate dateDebut;
    private LocalDate dateFin;
    private String justificatifPath;
    /** Chef de département : l'employé qui validera à sa place pendant ce congé. */
    private Long delegueId;

    // For Teletravail
    // uses dateDebut and dateFin above

    // For Autorisation
    private LocalDate date;
    private LocalTime heureDebut;
    private LocalTime heureFin;
}
