package com.antigone.rh.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "employes")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Employe {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String matricule;

    @Column(unique = true)
    @jakarta.validation.constraints.Pattern(regexp = "^[0-9]{8}$", message = "Le CIN doit contenir exactement 8 chiffres")
    @com.fasterxml.jackson.annotation.JsonIgnore
    private String cin;

    @jakarta.validation.constraints.Pattern(regexp = "^[0-9]{1,12}(-[0-9]+)*$", message = "Le CNSS doit contenir des chiffres (tirets autorisés)")
    @com.fasterxml.jackson.annotation.JsonIgnore
    private String cnss;

    @Column(nullable = false)
    private String nom;

    @Column(nullable = false)
    private String prenom;

    @Column(unique = true, nullable = false)
    private String email;

    private String telephone;

    private String telephonePro;

    @com.fasterxml.jackson.annotation.JsonIgnore
    private Double salaire;

    private LocalDate dateEmbauche;

    @Column(columnDefinition = "double precision default 30")
    @Builder.Default
    private Double soldeConge = 0.0;

    /**
     * Solde congé initial saisi manuellement lors de la première utilisation de l'application.
     * Si non null, le calcul automatique du solde est désactivé pour cet employé.
     */
    private Double soldeCongeInitial;

    private String poste;

    private String typeContrat;

    private LocalDate dateFinContrat;

    private String genre;

    private String departement;

    @jakarta.validation.constraints.Pattern(regexp = "^[0-9]{20}$", message = "Le RIB doit contenir exactement 20 chiffres")
    @com.fasterxml.jackson.annotation.JsonIgnore
    private String ribBancaire;

    private String imageUrl;

    private String lienDrive;

    @Column(nullable = false)
    @Builder.Default
    private Boolean archived = false;

    private LocalDateTime archivedAt;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "manager_id")
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private Employe manager;

    @OneToMany(mappedBy = "manager", fetch = FetchType.LAZY)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    @Builder.Default
    private List<Employe> subordonnes = new ArrayList<>();

    @OneToOne(mappedBy = "employe", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private Compte compte;

    @OneToMany(mappedBy = "employe", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    @Builder.Default
    private List<Demande> demandes = new ArrayList<>();

    @ManyToMany(mappedBy = "membres", fetch = FetchType.LAZY)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    @Builder.Default
    private List<Equipe> equipes = new ArrayList<>();

    @OneToMany(mappedBy = "employe", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    @Builder.Default
    private List<Competence> competences = new ArrayList<>();

    @OneToMany(mappedBy = "employe", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    @Builder.Default
    private List<DocumentEmploye> documents = new ArrayList<>();
}
