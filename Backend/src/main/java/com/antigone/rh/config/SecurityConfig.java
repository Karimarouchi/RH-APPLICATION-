package com.antigone.rh.config;

import com.antigone.rh.security.ClientAccessFilter;
import com.antigone.rh.security.JwtAuthenticationFilter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

        private static final String ADMIN = "ROLE_ADMIN";


        private final JwtAuthenticationFilter jwtAuthenticationFilter;
        private final ClientAccessFilter clientAccessFilter;

        public SecurityConfig(JwtAuthenticationFilter jwtAuthenticationFilter, ClientAccessFilter clientAccessFilter) {
                this.jwtAuthenticationFilter = jwtAuthenticationFilter;
                this.clientAccessFilter = clientAccessFilter;
        }

        @Bean
        public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
                http
                                .cors(cors -> {
                                })
                                .csrf(AbstractHttpConfigurer::disable)

                                .exceptionHandling(exceptions -> exceptions
                                                .authenticationEntryPoint(
                                                                new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED))
                                                // Connecte mais sans droit : 403 (et non 401, qui deconnecte l'utilisateur)
                                                .accessDeniedHandler((request, response, ex) -> {
                                                        response.setStatus(HttpStatus.FORBIDDEN.value());
                                                        response.setContentType("application/json;charset=UTF-8");
                                                        response.getWriter().write(
                                                                        "{\"success\":false,\"message\":\"Accès refusé : droits insuffisants\",\"data\":null}");
                                                }))

                                .sessionManagement(session -> session
                                                .sessionCreationPolicy(SessionCreationPolicy.STATELESS))

                                .authorizeHttpRequests(auth -> auth

                                                // Autoriser les requêtes CORS preflight
                                                .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()

                                                // Routes publiques d'authentification
                                                .requestMatchers(HttpMethod.POST,
                                                                "/api/auth/login",
                                                                "/api/auth/client-login",
                                                                "/api/auth/forgot-password",
                                                                "/api/auth/reset-password")
                                                .permitAll()

                                                // Routes publiques GET
                                                .requestMatchers(HttpMethod.GET,
                                                                "/api/agent/download",
                                                                "/api/media-plans/google-drive/callback",
                                                                "/api/clients/*/logo",
                                                                "/uploads/**")
                                                .permitAll()

                                                // Routes authentifiées
                                                .requestMatchers(
                                                                HttpMethod.PUT,
                                                                "/api/comptes/*/password")
                                                .authenticated()

                                                // Routes avec permissions spécifiques
                                                // NOTE: doit venir avant la règle plus générale /api/comptes/**
                                                // ci-dessous,
                                                // car Spring Security applique la première règle qui correspond.
                                                .requestMatchers(HttpMethod.GET, "/api/comptes")
                                                .hasAnyAuthority(
                                                                "ROLE_ADMIN",
                                                                "VIEW_COMPTES",
                                                                "VIEW_MES_PROJETS",
                                                                "VIEW_PROJETS",
                                                                "MANAGE_ALL_PROJETS",
                                                                "VIEW_TOUS_PROJETS")

                                                .requestMatchers(HttpMethod.POST, "/api/comptes/test-email")
                                                .hasAuthority("ROLE_ADMIN")

                                                .requestMatchers(HttpMethod.DELETE, "/api/comptes/*")
                                                .hasAnyAuthority("ROLE_ADMIN", "DELETE_COMPTE")

                                                .requestMatchers("/api/comptes/**")
                                                .hasAnyAuthority(
                                                                "ROLE_ADMIN",
                                                                "VIEW_COMPTES")

                                                // lecture seule de la liste des roles : formulaires employes / comptes
                                                .requestMatchers(HttpMethod.GET, "/api/roles", "/api/roles/**")
                                                .hasAnyAuthority(ADMIN, "VIEW_ROLES", "VIEW_EMPLOYES", "VIEW_COMPTES")
                                                .requestMatchers("/api/roles/**")
                                                .hasAnyAuthority(
                                                                "ROLE_ADMIN",
                                                                "VIEW_ROLES")

                                                .requestMatchers(
                                                                HttpMethod.GET,
                                                                "/api/referentiels/**")
                                                .authenticated()

                                                .requestMatchers("/api/referentiels/**")
                                                .hasAnyAuthority(
                                                                "ROLE_ADMIN",
                                                                "VIEW_REFERENTIELS")

                                                // ============================================================
                                                // Droits d'ecriture par domaine (miroir des permissions de l'interface)
                                                // ============================================================

                                                // --- Projets ---
                                                .requestMatchers(HttpMethod.POST, "/api/projets")
                                                .hasAnyAuthority(ADMIN, "MANAGE_ALL_PROJETS")
                                                .requestMatchers(HttpMethod.DELETE, "/api/projets/*")
                                                .hasAnyAuthority(ADMIN, "DELETE_PROJET")
                                                .requestMatchers(HttpMethod.PUT, "/api/projets/*")
                                                .hasAnyAuthority(ADMIN, "MANAGE_ALL_PROJETS", "VIEW_PROJETS_CREATE_TACHES")
                                                .requestMatchers(HttpMethod.PATCH, "/api/projets/*/statut")
                                                .hasAnyAuthority(ADMIN, "MANAGE_ALL_PROJETS", "VIEW_PROJETS_CREATE_TACHES")

                                                // --- Taches (un employe peut changer / mettre a jour SES taches) ---
                                                .requestMatchers(HttpMethod.PATCH, "/api/taches/*/statut")
                                                .hasAnyAuthority(ADMIN, "MANAGE_ALL_PROJETS", "VIEW_PROJETS_CREATE_TACHES",
                                                                "VIEW_MES_PROJETS", "VIEW_PROJETS")
                                                .requestMatchers(HttpMethod.PUT, "/api/taches/*")
                                                .hasAnyAuthority(ADMIN, "MANAGE_ALL_PROJETS", "VIEW_PROJETS_CREATE_TACHES",
                                                                "VIEW_MES_PROJETS", "VIEW_PROJETS")
                                                .requestMatchers(HttpMethod.POST, "/api/taches/*/livrables")
                                                .hasAnyAuthority(ADMIN, "MANAGE_ALL_PROJETS", "VIEW_PROJETS_CREATE_TACHES",
                                                                "VIEW_MES_PROJETS", "VIEW_PROJETS")
                                                .requestMatchers(HttpMethod.POST, "/api/taches/**")
                                                .hasAnyAuthority(ADMIN, "MANAGE_ALL_PROJETS", "VIEW_PROJETS_CREATE_TACHES")
                                                .requestMatchers(HttpMethod.PUT, "/api/taches/**")
                                                .hasAnyAuthority(ADMIN, "MANAGE_ALL_PROJETS", "VIEW_PROJETS_CREATE_TACHES")
                                                .requestMatchers(HttpMethod.PATCH, "/api/taches/**")
                                                .hasAnyAuthority(ADMIN, "MANAGE_ALL_PROJETS", "VIEW_PROJETS_CREATE_TACHES")
                                                .requestMatchers(HttpMethod.DELETE, "/api/taches/**")
                                                .hasAnyAuthority(ADMIN, "DELETE_TACHE")

                                                // --- Equipes, taches obligatoires ---
                                                .requestMatchers(HttpMethod.POST, "/api/equipes", "/api/equipes/**", "/api/taches-obligatoires")
                                                .hasAnyAuthority(ADMIN, "MANAGE_ALL_PROJETS", "VIEW_PROJETS_CREATE_TACHES", "VIEW_EQUIPES")
                                                .requestMatchers(HttpMethod.PUT, "/api/equipes/**")
                                                .hasAnyAuthority(ADMIN, "MANAGE_ALL_PROJETS", "VIEW_PROJETS_CREATE_TACHES", "VIEW_EQUIPES")
                                                .requestMatchers(HttpMethod.PATCH, "/api/equipes/**")
                                                .hasAnyAuthority(ADMIN, "MANAGE_ALL_PROJETS", "VIEW_PROJETS_CREATE_TACHES", "VIEW_EQUIPES")
                                                .requestMatchers(HttpMethod.DELETE, "/api/equipes/**", "/api/taches-obligatoires/**")
                                                .hasAnyAuthority(ADMIN, "MANAGE_ALL_PROJETS", "VIEW_PROJETS_CREATE_TACHES", "VIEW_EQUIPES")

                                                // --- Clients (ecriture) ---
                                                .requestMatchers(HttpMethod.POST, "/api/clients")
                                                .hasAnyAuthority(ADMIN, "MANAGE_CLIENTS")
                                                .requestMatchers(HttpMethod.PUT, "/api/clients/*")
                                                .hasAnyAuthority(ADMIN, "MANAGE_CLIENTS")
                                                .requestMatchers(HttpMethod.DELETE, "/api/clients/*")
                                                .hasAnyAuthority(ADMIN, "DELETE_CLIENT")

                                                // --- Media plans : actions du client ---
                                                .requestMatchers(HttpMethod.PATCH, "/api/media-plans/*/client-approve",
                                                                "/api/media-plans/*/client-disapprove", "/api/media-plans/*/rectifs")
                                                .hasAnyAuthority(ADMIN, "ROLE_CLIENT", "VIEW_MEDIA_PLAN", "VIEW_TOUS_MEDIA_PLAN")
                                                .requestMatchers(HttpMethod.POST, "/api/media-plans/client-approve-all")
                                                .hasAnyAuthority(ADMIN, "ROLE_CLIENT", "VIEW_MEDIA_PLAN", "VIEW_TOUS_MEDIA_PLAN")
                                                // --- Media plans : validation interne reservee aux managers ---
                                                .requestMatchers(HttpMethod.PATCH, "/api/media-plans/*/approve",
                                                                "/api/media-plans/*/disapprove")
                                                .hasAnyAuthority(ADMIN, "ROLE_MANAGER", "VIEW_TOUS_MEDIA_PLAN")
                                                // --- Media plans : ecriture interne ---
                                                .requestMatchers(HttpMethod.POST, "/api/media-plans", "/api/media-plans/**")
                                                .hasAnyAuthority(ADMIN, "VIEW_MEDIA_PLAN", "VIEW_TOUS_MEDIA_PLAN")
                                                .requestMatchers(HttpMethod.PUT, "/api/media-plans/**")
                                                .hasAnyAuthority(ADMIN, "VIEW_MEDIA_PLAN", "VIEW_TOUS_MEDIA_PLAN")
                                                .requestMatchers(HttpMethod.PATCH, "/api/media-plans/**")
                                                .hasAnyAuthority(ADMIN, "VIEW_MEDIA_PLAN", "VIEW_TOUS_MEDIA_PLAN")
                                                .requestMatchers(HttpMethod.DELETE, "/api/media-plans/**")
                                                .hasAnyAuthority(ADMIN, "VIEW_MEDIA_PLAN", "VIEW_TOUS_MEDIA_PLAN")
                                                .requestMatchers(HttpMethod.POST, "/api/media-plan-assignments")
                                                .hasAnyAuthority(ADMIN, "VIEW_TOUS_MEDIA_PLAN")
                                                .requestMatchers(HttpMethod.DELETE, "/api/media-plan-assignments/*")
                                                .hasAnyAuthority(ADMIN, "VIEW_TOUS_MEDIA_PLAN")
                                                // commentaires et rectifs : equipe interne et clients
                                                .requestMatchers(HttpMethod.POST, "/api/mediaplan-comments", "/api/reactifs/**")
                                                .hasAnyAuthority(ADMIN, "ROLE_CLIENT", "VIEW_MEDIA_PLAN", "VIEW_TOUS_MEDIA_PLAN",
                                                                "VIEW_PROJETS", "VIEW_MES_PROJETS", "MANAGE_ALL_PROJETS",
                                                                "VIEW_PROJETS_CREATE_TACHES")
                                                .requestMatchers(HttpMethod.DELETE, "/api/mediaplan-comments/*")
                                                .hasAnyAuthority(ADMIN, "ROLE_CLIENT", "VIEW_MEDIA_PLAN", "VIEW_TOUS_MEDIA_PLAN",
                                                                "VIEW_PROJETS", "VIEW_MES_PROJETS", "MANAGE_ALL_PROJETS",
                                                                "VIEW_PROJETS_CREATE_TACHES")

                                                // --- Employes, competences, documents (donnees RH) ---
                                                .requestMatchers(HttpMethod.POST, "/api/employes/*/image")
                                                .authenticated()
                                                .requestMatchers(HttpMethod.PATCH, "/api/employes/*/lien-drive")
                                                .authenticated()
                                                .requestMatchers(HttpMethod.POST, "/api/employes")
                                                .hasAnyAuthority(ADMIN, "VIEW_EMPLOYES")
                                                .requestMatchers(HttpMethod.PUT, "/api/employes/**")
                                                .hasAnyAuthority(ADMIN, "VIEW_EMPLOYES")
                                                .requestMatchers(HttpMethod.PATCH, "/api/employes/**")
                                                .hasAnyAuthority(ADMIN, "VIEW_EMPLOYES")
                                                .requestMatchers(HttpMethod.DELETE, "/api/employes/*/definitif")
                                                .hasAnyAuthority(ADMIN, "DELETE_EMPLOYE")
                                                .requestMatchers(HttpMethod.DELETE, "/api/employes/**")
                                                .hasAnyAuthority(ADMIN, "VIEW_EMPLOYES")
                                                .requestMatchers(HttpMethod.POST, "/api/competences")
                                                .hasAnyAuthority(ADMIN, "VIEW_EMPLOYES")
                                                .requestMatchers(HttpMethod.PUT, "/api/competences/*")
                                                .hasAnyAuthority(ADMIN, "VIEW_EMPLOYES")
                                                .requestMatchers(HttpMethod.DELETE, "/api/competences/*")
                                                .hasAnyAuthority(ADMIN, "VIEW_EMPLOYES")
                                                .requestMatchers(HttpMethod.POST, "/api/documents-employe", "/api/documents-employe/**")
                                                .hasAnyAuthority(ADMIN, "VIEW_EMPLOYES")
                                                .requestMatchers(HttpMethod.PUT, "/api/documents-employe/*")
                                                .hasAnyAuthority(ADMIN, "VIEW_EMPLOYES")
                                                .requestMatchers(HttpMethod.DELETE, "/api/documents-employe/*")
                                                .hasAnyAuthority(ADMIN, "VIEW_EMPLOYES")

                                                // --- Conges : decisions reservees aux validateurs ---
                                                .requestMatchers(HttpMethod.PATCH, "/api/demandes/*/approve", "/api/demandes/*/refuse",
                                                                "/api/demandes/batch/approve", "/api/demandes/batch/refuse")
                                                .hasAnyAuthority(ADMIN, "VIEW_VALIDATIONS", "VIEW_DEMANDES")
                                                .requestMatchers(HttpMethod.PATCH, "/api/demandes-papier/*/accept")
                                                .hasAnyAuthority(ADMIN, "VIEW_VALIDATIONS", "VIEW_DEMANDES")
                                                .requestMatchers(HttpMethod.POST, "/api/validations")
                                                .hasAnyAuthority(ADMIN, "VIEW_VALIDATIONS", "VIEW_DEMANDES")
                                                .requestMatchers(HttpMethod.PATCH, "/api/validations/*/approve",
                                                                "/api/validations/*/refuse")
                                                .hasAnyAuthority(ADMIN, "VIEW_VALIDATIONS", "VIEW_DEMANDES")

                                                // --- Calendriers, reunions ---
                                                .requestMatchers(HttpMethod.POST, "/api/calendrier/**")
                                                .hasAnyAuthority(ADMIN, "VIEW_CALENDRIER", "VIEW_RESTRICTION_CONGE", "VIEW_EMPLOYES")
                                                .requestMatchers(HttpMethod.PUT, "/api/calendrier/**")
                                                .hasAnyAuthority(ADMIN, "VIEW_CALENDRIER", "VIEW_RESTRICTION_CONGE", "VIEW_EMPLOYES")
                                                .requestMatchers(HttpMethod.DELETE, "/api/calendrier/**")
                                                .hasAnyAuthority(ADMIN, "VIEW_CALENDRIER", "VIEW_RESTRICTION_CONGE", "VIEW_EMPLOYES")
                                                .requestMatchers(HttpMethod.POST, "/api/calendrier-projets/**")
                                                .hasAnyAuthority(ADMIN, "VIEW_CALENDRIER_PROJETS", "VIEW_DEADLINES", "VIEW_REUNIONS",
                                                                "MANAGE_ALL_PROJETS")
                                                .requestMatchers(HttpMethod.PUT, "/api/calendrier-projets/**")
                                                .hasAnyAuthority(ADMIN, "VIEW_CALENDRIER_PROJETS", "VIEW_DEADLINES", "VIEW_REUNIONS",
                                                                "MANAGE_ALL_PROJETS")
                                                .requestMatchers(HttpMethod.DELETE, "/api/calendrier-projets/**")
                                                .hasAnyAuthority(ADMIN, "VIEW_CALENDRIER_PROJETS", "VIEW_DEADLINES", "VIEW_REUNIONS",
                                                                "MANAGE_ALL_PROJETS")
                                                .requestMatchers(HttpMethod.POST, "/api/reunions")
                                                .hasAnyAuthority(ADMIN, "VIEW_REUNIONS")
                                                .requestMatchers(HttpMethod.DELETE, "/api/reunions/*")
                                                .hasAnyAuthority(ADMIN, "VIEW_REUNIONS")

                                                // --- Tableaux de bord et suivi des presences ---
                                                .requestMatchers("/api/admin/dashboard/**")
                                                .hasAnyAuthority(ADMIN, "VIEW_TOUS_PROJETS", "MANAGE_ALL_PROJETS", "VIEW_DASHBOARD")
                                                .requestMatchers(HttpMethod.POST, "/api/agent/heartbeat", "/api/agent/event",
                                                                "/api/agent/presence-confirm")
                                                .authenticated()
                                                .requestMatchers(HttpMethod.GET, "/api/agent/config")
                                                .authenticated()
                                                // statut de SON agent (barre laterale) : controle de proprietaire dans le controleur
                                                .requestMatchers(HttpMethod.GET, "/api/agent/status/*")
                                                .authenticated()
                                                .requestMatchers("/api/agent/**")
                                                .hasAnyAuthority(ADMIN, "VIEW_MONITORING", "VIEW_DASHBOARD")

                                                // Toutes les autres routes nécessitent un JWT valide
                                                .anyRequest()
                                                .authenticated())

                                .addFilterBefore(
                                                jwtAuthenticationFilter,
                                                UsernamePasswordAuthenticationFilter.class)
                                .addFilterAfter(clientAccessFilter, JwtAuthenticationFilter.class);

                return http.build();
        }

        @Bean
        public PasswordEncoder passwordEncoder() {
                return new BCryptPasswordEncoder();
        }
}
