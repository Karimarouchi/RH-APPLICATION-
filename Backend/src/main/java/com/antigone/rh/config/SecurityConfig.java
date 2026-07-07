package com.antigone.rh.config;

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

        private final JwtAuthenticationFilter jwtAuthenticationFilter;

        public SecurityConfig(JwtAuthenticationFilter jwtAuthenticationFilter) {
                this.jwtAuthenticationFilter = jwtAuthenticationFilter;
        }

        @Bean
        public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
                http
                                .cors(cors -> {
                                })
                                .csrf(AbstractHttpConfigurer::disable)

                                .exceptionHandling(exceptions -> exceptions
                                                .authenticationEntryPoint(
                                                                new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED)))

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

                                                .requestMatchers("/api/comptes/**")
                                                .hasAnyAuthority(
                                                                "ROLE_ADMIN",
                                                                "VIEW_COMPTES")

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

                                                .requestMatchers("/api/agent/**")
                                                .authenticated()

                                                // Toutes les autres routes nécessitent un JWT valide
                                                .anyRequest()
                                                .authenticated())

                                .addFilterBefore(
                                                jwtAuthenticationFilter,
                                                UsernamePasswordAuthenticationFilter.class);

                return http.build();
        }

        @Bean
        public PasswordEncoder passwordEncoder() {
                return new BCryptPasswordEncoder();
        }
}
