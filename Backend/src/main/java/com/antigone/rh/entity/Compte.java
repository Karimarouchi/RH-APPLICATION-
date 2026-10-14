package com.antigone.rh.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.Set;

@Entity
@Table(name = "comptes")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Compte {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String username;

    @Column(nullable = false)
    private String passwordHash;

    @Builder.Default
    private Boolean enabled = true;

    @Builder.Default
    private Boolean mustChangePassword = true;

    private LocalDateTime lastLogin;

    /** Guides de premiere connexion deja vus, ex: "rh,projets" (null = aucun). */
    @Column(length = 100)
    private String toursVus;

    private LocalDateTime createdAt;

    private String resetToken;

    private LocalDateTime resetTokenExpiry;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "employe_id", unique = true, nullable = false)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private Employe employe;

    @ManyToMany(fetch = FetchType.EAGER)
    @JoinTable(
            name = "compte_roles",
            joinColumns = @JoinColumn(name = "compte_id"),
            inverseJoinColumns = @JoinColumn(name = "role_id")
    )
    @Builder.Default
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private Set<Role> roles = new HashSet<>();

    /** Permissions en plus de celles des rôles, pour ce compte seulement. */
    @ManyToMany(fetch = FetchType.EAGER)
    @JoinTable(
            name = "compte_permissions_ajoutees",
            joinColumns = @JoinColumn(name = "compte_id"),
            inverseJoinColumns = @JoinColumn(name = "permission_id")
    )
    @Builder.Default
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private Set<Permission> permissionsAjoutees = new HashSet<>();

    /** Permissions des rôles retirées pour ce compte seulement. */
    @ManyToMany(fetch = FetchType.EAGER)
    @JoinTable(
            name = "compte_permissions_retirees",
            joinColumns = @JoinColumn(name = "compte_id"),
            inverseJoinColumns = @JoinColumn(name = "permission_id")
    )
    @Builder.Default
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private Set<Permission> permissionsRetirees = new HashSet<>();

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
    }
}
