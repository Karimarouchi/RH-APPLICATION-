package com.antigone.rh.security;

import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

public final class SecurityUtils {

    private SecurityUtils() {
    }

    public static AuthPrincipal getCurrentPrincipal() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !(authentication.getPrincipal() instanceof AuthPrincipal principal)) {
            throw new IllegalStateException("Utilisateur authentifié introuvable");
        }
        return principal;
    }

    public static Long requireEmployeId() {
        AuthPrincipal principal = getCurrentPrincipal();
        if (principal.getEmployeId() == null) {
            throw new IllegalStateException("Compte employé requis");
        }
        return principal.getEmployeId();
    }
    /** True si l'utilisateur connecte possede au moins une de ces autorites (permission ou ROLE_xxx). */
    public static boolean hasAnyAuthority(String... wanted) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null) {
            return false;
        }
        for (GrantedAuthority granted : authentication.getAuthorities()) {
            for (String w : wanted) {
                if (w.equals(granted.getAuthority())) {
                    return true;
                }
            }
        }
        return false;
    }

    public static boolean isAdmin() {
        return hasAnyAuthority("ROLE_ADMIN");
    }

    /** Employe connecte, ou null (compte client). */
    public static Long currentEmployeIdOrNull() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.getPrincipal() instanceof AuthPrincipal principal) {
            return principal.getEmployeId();
        }
        return null;
    }

    /** Autorise l'employe lui-meme, ou un utilisateur ayant une des autorites donnees (ADMIN toujours). */
    public static void requireSelfOrAny(Long employeId, String... authorities) {
        Long me = currentEmployeIdOrNull();
        if (me != null && me.equals(employeId)) {
            return;
        }
        if (isAdmin() || hasAnyAuthority(authorities)) {
            return;
        }
        throw new AccessDeniedException("Acces refuse");
    }

    public static void requireAny(String... authorities) {
        if (isAdmin() || hasAnyAuthority(authorities)) {
            return;
        }
        throw new AccessDeniedException("Acces refuse");
    }
    /** Identifiant du client connecte (compte portail client), ou null pour un employe. */
    public static Long currentClientIdOrNull() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.getPrincipal() instanceof AuthPrincipal principal
                && "CLIENT".equals(principal.getPrincipalType())) {
            return principal.getClientId();
        }
        return null;
    }

    /** Pour un compte client : refuse l'acces a une ressource d'un autre client. */
    public static void requireOwnClientIfClient(Long ownerClientId) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.getPrincipal() instanceof AuthPrincipal principal
                && "CLIENT".equals(principal.getPrincipalType())) {
            if (principal.getClientId() == null || !principal.getClientId().equals(ownerClientId)) {
                throw new AccessDeniedException("Acces refuse");
            }
        }
    }
}