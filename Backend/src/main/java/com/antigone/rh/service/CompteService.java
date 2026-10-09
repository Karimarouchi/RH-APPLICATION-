package com.antigone.rh.service;

import com.antigone.rh.dto.*;
import com.antigone.rh.entity.*;
import com.antigone.rh.repository.*;
import com.antigone.rh.security.AuthPrincipal;
import com.antigone.rh.security.JwtService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional
@Slf4j
public class CompteService {

    private final CompteRepository compteRepository;
    private final EmployeRepository employeRepository;
    private final RoleRepository roleRepository;
    private final AccessLogRepository accessLogRepository;
    private final PasswordEncoder passwordEncoder;
    private final EmailService emailService;
    private final RoleService roleService;
    private final JwtService jwtService;

    @Value("${app.frontend-url}")
    private String frontendUrl;

    @Value("${app.frontend-base-url:${app.frontend-url}}")
    private String frontendBaseUrl;

    private static final SecureRandom RANDOM = new SecureRandom();
    private static final String PASSWORD_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#$%";
    private static final int RESET_TOKEN_EXPIRY_MINUTES = 30;

    // ─── Login ───────────────────────────────────────────────────
    public LoginResponse login(LoginRequest request, String ipAddress) {
        Compte compte = compteRepository.findByUsername(request.getUsername())
                .orElseThrow(() -> new RuntimeException("Identifiants invalides"));

        if (!passwordEncoder.matches(request.getPassword(), compte.getPasswordHash())) {
            logAccess(compte, ipAddress, "CONNEXION_ECHOUEE");
            throw new RuntimeException("Identifiants invalides");
        }

        if (!compte.getEnabled()) {
            throw new RuntimeException("Compte désactivé");
        }

        compte.setLastLogin(LocalDateTime.now());
        compteRepository.save(compte);

        logAccess(compte, ipAddress, "CONNEXION");

        Employe employe = compte.getEmploye();
        Set<String> roles = compte.getRoles().stream()
                .map(Role::getNom)
                .collect(Collectors.toSet());

        Set<String> permissions = compte.getRoles().stream()
                .flatMap(role -> role.getPermissions().stream())
                .map(Permission::getPermission)
                .collect(Collectors.toSet());

        AuthPrincipal principal = AuthPrincipal.builder()
                .principalType("EMPLOYEE")
                .accountId(compte.getId())
                .employeId(employe.getId())
                .username(compte.getUsername())
                .roles(roles)
                .permissions(permissions)
                .build();

        String token = jwtService.generateToken(principal);
        String tokenExpiresAt = jwtService.getExpiryInstant().toString();

        return LoginResponse.builder()
                .compteId(compte.getId())
                .employeId(employe.getId())
                .username(compte.getUsername())
                .nom(employe.getNom())
                .prenom(employe.getPrenom())
                .email(employe.getEmail())
                .roles(roles)
                .permissions(permissions)
                .mustChangePassword(compte.getMustChangePassword())
                .genre(employe.getGenre())
                .message("Connexion réussie")
                .imageUrl(employe.getImageUrl())
                .token(token)
                .tokenExpiresAt(tokenExpiresAt)
                .toursVus(parseTours(compte.getToursVus()))
                .build();
    }

    private static List<String> parseTours(String raw) {
        if (raw == null || raw.isBlank()) {
            return List.of();
        }
        return java.util.Arrays.stream(raw.split(",")).map(String::trim).filter(s -> !s.isEmpty()).collect(Collectors.toList());
    }

    /** Memorise qu'un guide de premiere connexion a ete vu (app = "rh" ou "projets"). */
    public void markTourSeen(Long compteId, String app) {
        if (!"rh".equals(app) && !"projets".equals(app)) {
            throw new RuntimeException("Application inconnue");
        }
        Compte compte = compteRepository.findById(compteId)
                .orElseThrow(() -> new RuntimeException("Compte non trouvé"));
        java.util.LinkedHashSet<String> tours = new java.util.LinkedHashSet<>(parseTours(compte.getToursVus()));
        tours.add(app);
        compte.setToursVus(String.join(",", tours));
        compteRepository.save(compte);
    }

    // ─── CRUD Comptes ────────────────────────────────────────────
    public List<CompteDTO> getAllComptes() {
        return compteRepository.findAll().stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    public CompteDTO getCompteById(Long id) {
        Compte compte = compteRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Compte non trouvé"));
        return toDTO(compte);
    }

    public CompteDTO createCompte(CompteRequest request) {
        Employe employe = employeRepository.findById(request.getEmployeId())
                .orElseThrow(() -> new RuntimeException("Employé non trouvé"));

        // Check if employee already has an account
        if (compteRepository.findByEmployeId(employe.getId()).isPresent()) {
            throw new RuntimeException("Cet employé a déjà un compte");
        }

        List<Role> rolesList = roleRepository.findAllById(request.getRoleIds());
        if (rolesList.isEmpty()) {
            throw new RuntimeException("Aucun rôle valide trouvé");
        }
        Set<Role> roles = new HashSet<>(rolesList);

        // Le matricule de l'employé est utilisé comme login
        String username = employe.getMatricule();

        // Auto-generate password
        String rawPassword = generatePassword(10);

        Compte compte = Compte.builder()
                .username(username)
                .passwordHash(passwordEncoder.encode(rawPassword))
                .enabled(true)
                .mustChangePassword(true)
                .employe(employe)
                .roles(roles)
                .build();

        Compte saved = compteRepository.save(compte);

        // Send email with credentials
        emailService.sendCredentials(
                employe.getEmail(),
                employe.getNom() + " " + employe.getPrenom(),
                username,
                rawPassword);

        log.info("Compte créé pour {} : username={}", employe.getNom(), username);

        CompteDTO dto = toDTO(saved);
        dto.setGeneratedPassword(rawPassword); // Return password only on creation
        return dto;
    }

    public CompteDTO updateCompte(Long id, CompteRequest request) {
        Compte compte = compteRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Compte non trouvé"));

        if (request.getRoleIds() != null && !request.getRoleIds().isEmpty()) {
            List<Role> rolesList = roleRepository.findAllById(request.getRoleIds());
            if (rolesList.isEmpty()) {
                throw new RuntimeException("Aucun rôle valide trouvé");
            }
            compte.getRoles().clear();
            compte.getRoles().addAll(rolesList);
        }

        return toDTO(compteRepository.save(compte));
    }
public CompteDTO toggleEnabled(Long id) {
        Compte compte = compteRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Compte non trouvé"));
        compte.setEnabled(!compte.getEnabled());
        
        if (!compte.getEnabled()) {
            Employe employe = compte.getEmploye();
            if (employe != null && !Boolean.TRUE.equals(employe.getArchived())) {
                employe.setArchived(true);
                employe.setArchivedAt(LocalDateTime.now());
                employeRepository.save(employe);
                log.info("Employé {} automatiquement archivé car son compte a été désactivé.", employe.getNom());
            }
        } else {
            Employe employe = compte.getEmploye();
            if (employe != null && Boolean.TRUE.equals(employe.getArchived())) {
                employe.setArchived(false);
                employe.setArchivedAt(null);
                employeRepository.save(employe);
                log.info("Employé {} automatiquement restauré car son compte a été activé.", employe.getNom());
            }
        }
        
        return toDTO(compteRepository.save(compte));
    }
    // ─── Change Password ─────────────────────────────────────────
    public void changePassword(Long compteId, ChangePasswordRequest request) {
        Compte compte = compteRepository.findById(compteId)
                .orElseThrow(() -> new RuntimeException("Compte non trouvé"));

        if (!passwordEncoder.matches(request.getOldPassword(), compte.getPasswordHash())) {
            throw new RuntimeException("Ancien mot de passe incorrect");
        }

        requireValidNewPassword(request.getNewPassword());
        if (passwordEncoder.matches(request.getNewPassword(), compte.getPasswordHash())) {
            throw new RuntimeException("Le nouveau mot de passe doit être différent de l'ancien");
        }
        compte.setPasswordHash(passwordEncoder.encode(request.getNewPassword()));
        compte.setMustChangePassword(false);
        compteRepository.save(compte);
    }

    private void requireValidNewPassword(String password) {
        if (password == null || password.length() < 8) {
            throw new RuntimeException("Le mot de passe doit contenir au moins 8 caractères");
        }
    }

    // ─── Forgot Password ────────────────────────────────────────
    public void forgotPassword(String email) {
        Optional<Compte> compteOpt = compteRepository.findByEmployeEmail(email);
        if (compteOpt.isEmpty()) {
            // Ne pas révéler si l'email existe ou non (sécurité)
            log.info("Tentative de réinitialisation pour un email inconnu: {}", email);
            return;
        }

        Compte compte = compteOpt.get();
        if (!compte.getEnabled()) {
            log.info("Tentative de réinitialisation pour un compte désactivé: {}", email);
            return;
        }

        String token = UUID.randomUUID().toString();
        compte.setResetToken(token);
        compte.setResetTokenExpiry(LocalDateTime.now().plusMinutes(RESET_TOKEN_EXPIRY_MINUTES));
        compteRepository.save(compte);

        String resetLink = frontendBaseUrl.split(",")[0].replaceAll("/+$", "") + "/reset-password?token=" + token;
        emailService.sendPasswordReset(
                email,
                compte.getEmploye().getNom() + " " + compte.getEmploye().getPrenom(),
                resetLink);

        log.info("Token de réinitialisation généré pour: {}", email);
    }

    public void resetPassword(String token, String newPassword) {
        Compte compte = compteRepository.findByResetToken(token)
                .orElseThrow(() -> new RuntimeException("Lien de réinitialisation invalide"));

        if (compte.getResetTokenExpiry() == null || compte.getResetTokenExpiry().isBefore(LocalDateTime.now())) {
            compte.setResetToken(null);
            compte.setResetTokenExpiry(null);
            compteRepository.save(compte);
            throw new RuntimeException("Le lien de réinitialisation a expiré. Veuillez en demander un nouveau.");
        }

        requireValidNewPassword(newPassword);
        compte.setPasswordHash(passwordEncoder.encode(newPassword));
        compte.setResetToken(null);
        compte.setResetTokenExpiry(null);
        compte.setMustChangePassword(false);
        compteRepository.save(compte);

        log.info("Mot de passe réinitialisé pour: {}", compte.getUsername());
    }

    // ─── Access Logs ─────────────────────────────────────────────
    public List<AccessLogDTO> getAccessLogs(Long compteId) {
        return accessLogRepository.findByCompteIdOrderByDateAccesDesc(compteId).stream()
                .map(this::toAccessLogDTO)
                .collect(Collectors.toList());
    }

    private void logAccess(Compte compte, String ipAddress, String action) {
        AccessLog logEntry = AccessLog.builder()
                .compte(compte)
                .adresseIp(ipAddress)
                .action(action)
                .build();
        accessLogRepository.save(logEntry);
    }

    // ─── Password Generation ────────────────────────────────────
    private String generatePassword(int length) {
        StringBuilder sb = new StringBuilder(length);
        for (int i = 0; i < length; i++) {
            sb.append(PASSWORD_CHARS.charAt(RANDOM.nextInt(PASSWORD_CHARS.length())));
        }
        return sb.toString();
    }

    // ─── Mappers ─────────────────────────────────────────────────
    private CompteDTO toDTO(Compte compte) {
        Employe employe = compte.getEmploye();
        return CompteDTO.builder()
                .id(compte.getId())
                .username(compte.getUsername())
                .enabled(compte.getEnabled())
                .mustChangePassword(compte.getMustChangePassword())
                .lastLogin(compte.getLastLogin())
                .createdAt(compte.getCreatedAt())
                .employeId(employe.getId())
                .employeNom(employe.getNom())
                .employePrenom(employe.getPrenom())
                .employeEmail(employe.getEmail())
                .employePoste(employe.getPoste())
                .roles(compte.getRoles().stream()
                        .map(roleService::toDTO)
                        .collect(Collectors.toSet()))
                .build();
    }

    private AccessLogDTO toAccessLogDTO(AccessLog logEntry) {
        return AccessLogDTO.builder()
                .id(logEntry.getId())
                .compteId(logEntry.getCompte().getId())
                .username(logEntry.getCompte().getUsername())
                .dateAcces(logEntry.getDateAcces())
                .adresseIp(logEntry.getAdresseIp())
                .action(logEntry.getAction())
                .build();
    }
}
