package com.antigone.rh.security;

import com.antigone.rh.repository.ProjetRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Un compte CLIENT (portail client) ne peut appeler que les routes de son portail, et uniquement
 * pour ses propres donnees. Tout le reste de l'API (employes, projets des autres clients...) lui est ferme.
 */
@Component
@RequiredArgsConstructor
public class ClientAccessFilter extends OncePerRequestFilter {

    private static final Pattern CLIENT_PORTAL = Pattern.compile(
            "^/api/clients/(\\d+)/(client-portal-drive-link|drive-files)$");
    private static final Pattern MP_BY_CLIENT = Pattern.compile("^/api/media-plans/client/(\\d+)$");
    private static final Pattern PROJETS_BY_CLIENT = Pattern.compile("^/api/projets/by-client/(\\d+)$");
    private static final Pattern TACHES_BY_PROJET = Pattern.compile("^/api/taches/projet/(\\d+)$");
    private static final Pattern MP_ACTION = Pattern.compile(
            "^/api/media-plans/\\d+/(client-approve|client-disapprove|rectifs)$");
    private static final Pattern REACTIF_EXTERN = Pattern.compile("^/api/reactifs/mediaplan-extern/\\d+$");

    private final ProjetRepository projetRepository;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !(auth.getPrincipal() instanceof AuthPrincipal principal)
                || !"CLIENT".equals(principal.getPrincipalType())) {
            chain.doFilter(request, response);
            return;
        }
        if (isAllowed(request.getMethod(), request.getRequestURI(), principal.getClientId())) {
            chain.doFilter(request, response);
            return;
        }
        response.setStatus(HttpServletResponse.SC_FORBIDDEN);
        response.setContentType("application/json;charset=UTF-8");
        response.getWriter().write("{\"success\":false,\"message\":\"Accès refusé\",\"data\":null}");
    }

    private boolean isAllowed(String method, String path, Long clientId) {
        if (clientId == null) {
            return false;
        }
        Matcher m;
        if ("GET".equals(method)) {
            if ((m = CLIENT_PORTAL.matcher(path)).matches()) {
                return clientId.equals(Long.valueOf(m.group(1)));
            }
            if ((m = MP_BY_CLIENT.matcher(path)).matches()) {
                return clientId.equals(Long.valueOf(m.group(1)));
            }
            if ((m = PROJETS_BY_CLIENT.matcher(path)).matches()) {
                return clientId.equals(Long.valueOf(m.group(1)));
            }
            if ((m = TACHES_BY_PROJET.matcher(path)).matches()) {
                return projetRepository.findById(Long.valueOf(m.group(1)))
                        .map(p -> p.getClient() != null && clientId.equals(p.getClient().getId()))
                        .orElse(false);
            }
            return false;
        }
        if ("PATCH".equals(method)) {
            return MP_ACTION.matcher(path).matches(); // propriete verifiee dans MediaPlanService
        }
        if ("POST".equals(method)) {
            return "/api/media-plans/client-approve-all".equals(path) || REACTIF_EXTERN.matcher(path).matches();
        }
        return false;
    }
}
