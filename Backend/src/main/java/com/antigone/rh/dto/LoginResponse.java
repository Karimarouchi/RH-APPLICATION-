package com.antigone.rh.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Set;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LoginResponse {
    private Long compteId;
    private Long employeId;
    private String username;
    private String nom;
    private String prenom;
    private String email;
    private Set<String> roles;
    private Set<String> permissions;
    /** True si un des rôles du compte a l'accès total. */
    private Boolean superAdmin;
    private String departement;
    private Boolean managerDepartement;
    private Boolean mustChangePassword;
    private String genre;
    private String message;
    private String imageUrl;
    private String token;
    private String tokenExpiresAt;
    private java.util.List<String> toursVus;
}
