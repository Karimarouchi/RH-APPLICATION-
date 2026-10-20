package com.antigone.rh.security;

import lombok.Builder;
import lombok.Getter;

import java.util.Collection;
import java.util.Set;

@Getter
@Builder
public class AuthPrincipal {
    private final String principalType;
    private final Long accountId;
    private final Long employeId;
    private final Long clientId;
    private final String username;
    private final Set<String> roles;
    private final Set<String> permissions;
    /** Un des roles du compte a l'acces total. */
    private final boolean superAdmin;

    public Collection<String> getAuthorities() {
        return permissions;
    }

    public boolean hasRole(String role) {
        return roles != null && roles.contains(role);
    }
}