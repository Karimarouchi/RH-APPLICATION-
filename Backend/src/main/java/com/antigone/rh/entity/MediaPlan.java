package com.antigone.rh.entity;

import com.antigone.rh.enums.EtatPublication;
import com.antigone.rh.enums.StatutMediaPlan;
import com.antigone.rh.enums.StatutShooting;
import com.antigone.rh.enums.TypeContenuShooting;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "media_plans")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MediaPlan {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private LocalDate datePublication;

    /** 24h format string, e.g. "09:00", "14:00" */
    private String heure;

    /** Value from Referentiel FORMAT_MEDIA_PLAN (Reel, Video, Carrousel, Story) */
    private String format;

    /** Value from Referentiel TYPE_MEDIA_PLAN */
    private String type;

    @Column(nullable = false)
    private String titre;

    @Column(columnDefinition = "TEXT")
    private String texteSurVisuel;

    @Column(columnDefinition = "TEXT")
    private String inspiration;

    @Column(columnDefinition = "TEXT")
    private String autresElements;

    /** Value from Referentiel PLATFORME_MEDIA_PLAN */
    private String platforme;

    /** Manual Google Drive link */
    private String lienDrive;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    private EtatPublication etatPublication = EtatPublication.PAS_ENCORE;

    @Column(columnDefinition = "TEXT")
    private String rectifs;

    @Column(columnDefinition = "TEXT")
    private String remarques;

    // =====================
    // SHOOTING (Calendrier de tournage)
    // =====================

    @Builder.Default
    @Column(nullable = false, columnDefinition = "boolean default false")
    private boolean isShooting = false;

    @Column(columnDefinition = "TEXT")
    private String shootingDescription;

    private String shootingLocalisation;

    private LocalDate shootingDate;

    /** Date limite. La date exacte est posée ensuite par le manager du département Production. */
    private LocalDate shootingAuPlusTard;

    /** Si vrai, le client doit accepter la date proposée. Sinon elle est validée dès qu'elle est posée. */
    @Builder.Default
    @Column(columnDefinition = "boolean default false")
    private Boolean clientDoitValiderDate = false;

    /** Champs que le client a le droit de voir, séparés par des virgules. */
    @Column(columnDefinition = "TEXT")
    private String champsVisiblesClient;

    @Enumerated(EnumType.STRING)
    private TypeContenuShooting shootingTypeDeContenu;

    @Enumerated(EnumType.STRING)
    private StatutShooting shootingStatus;

    @Column(columnDefinition = "TEXT")
    private String shootingStatusReason;

    @OneToOne(mappedBy = "mediaPlanLigne", fetch = FetchType.LAZY)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private CalendrierProjet calendrierProjet;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private StatutMediaPlan statut = StatutMediaPlan.EN_ATTENTE;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "client_id", nullable = false)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private Client client;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "createur_id", nullable = false)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private Employe createur;

    @Column(nullable = false)
    private LocalDateTime dateCreation;

    @PrePersist
    protected void onCreate() {
        this.dateCreation = LocalDateTime.now();
    }
}
