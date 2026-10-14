package com.antigone.rh.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.Set;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CompteDTO {
    private Long id;
    private String username;
    private Boolean enabled;
    private Boolean mustChangePassword;
    private LocalDateTime lastLogin;
    private LocalDateTime createdAt;
    private Long employeId;
    private String employeNom;
    private String employePrenom;
    private String employeEmail;
    private String employePoste;
    private Set<RoleDTO> roles;
    private Set<Long> permissionsAjouteesIds;
    private Set<Long> permissionsRetireesIds;
    private Set<String> permissionsEffectives;
    private String generatedPassword; // Only set on creation
}
