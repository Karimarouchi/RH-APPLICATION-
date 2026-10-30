package com.antigone.rh.entity;

import com.antigone.rh.enums.TypeConge;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;

@Entity
@Table(name = "conges")
@Data
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(callSuper = true)
@ToString(callSuper = true)
public class Conge extends Demande {

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TypeConge typeConge;

    @Column(nullable = false)
    private LocalDate dateDebut;

    @Column(nullable = false)
    private LocalDate dateFin;

    @Column(nullable = false)
    private Integer nombreJours;

    @Column
    private Integer joursOuvrables = 0;

    private String justificatifPath;

    /** Chef de département en congé : l'employé qui valide les demandes du département à sa place. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "delegue_id")
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private Employe delegue;

    /** Le chef a signalé son retour : l'intérim est terminé et il reprend ses droits de validation. */
    private Boolean retourSignale = false;
}
