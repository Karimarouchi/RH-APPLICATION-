package com.antigone.rh.service;

import com.antigone.rh.dto.ClientDTO;
import com.antigone.rh.dto.ClientLoginResponse;
import com.antigone.rh.entity.Client;
import com.antigone.rh.repository.ClientRepository;
import com.antigone.rh.security.AuthPrincipal;
import com.antigone.rh.security.JwtService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.net.MalformedURLException;
import java.nio.file.*;
import java.security.SecureRandom;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional
@Slf4j
public class ClientService {

    private final ClientRepository clientRepository;
    private final PasswordEncoder passwordEncoder;
    private final GoogleDriveService googleDriveService;
    private final JwtService jwtService;
    private final com.antigone.rh.repository.ProjetRepository projetRepository;
    private final com.antigone.rh.repository.MediaPlanRepository mediaPlanRepository;
    private final com.antigone.rh.repository.MediaPlanAssignmentRepository assignmentRepository;
    private final com.antigone.rh.repository.ReactifInternRepository reactifInternRepository;

    @Value("${app.upload.dir:uploads/justificatifs}")
    private String uploadDir;

    private static final String CLIENTS_SUBDIR = "clients";
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final String PASSWORD_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#$%";

    // ── CRUD ──────────────────────────────────────────────────────────────────

    public List<ClientDTO> getAll() {
        return clientRepository.findAll().stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    public ClientDTO getById(Long id) {
        return toDTO(findOrThrow(id));
    }

    // ── Client portal login ───────────────────────────────────────────────────

    public ClientLoginResponse loginClient(String loginClient, String rawPassword) {
        Client client = clientRepository.findByLoginClient(loginClient)
                .orElseThrow(() -> new RuntimeException("Identifiants invalides"));
        if (client.getPasswordClient() == null ||
                !passwordEncoder.matches(rawPassword, client.getPasswordClient())) {
            throw new RuntimeException("Identifiants invalides");
        }
        // Parse allowed pages
        List<String> pages = parsePages(client.getClientPages());
        String logoUrlStr = (client.getLogoPath() != null) ? "/api/clients/" + client.getId() + "/logo" : null;
        AuthPrincipal principal = AuthPrincipal.builder()
                .principalType("CLIENT")
                .accountId(client.getId())
                .clientId(client.getId())
                .username(client.getLoginClient())
                .roles(new LinkedHashSet<>(List.of("CLIENT")))
                .permissions(new LinkedHashSet<>(List.of("VIEW_CLIENT_PORTAL")))
                .build();

        return ClientLoginResponse.builder()
                .clientId(client.getId())
                .nom(client.getNom())
                .loginClient(client.getLoginClient())
                .email(client.getEmail())
                .isClient(true)
                .roles(java.util.List.of("CLIENT"))
                .permissions(java.util.List.of("VIEW_CLIENT_PORTAL"))
                .clientPages(pages)
                .logoUrl(logoUrlStr)
                .token(jwtService.generateToken(principal))
                .tokenExpiresAt(jwtService.getExpiryInstant().toString())
                .build();
    }

    public ClientDTO create(String nom, String email, String telephone, String adresse,
            String notes, MultipartFile logoFile, String contactNom, String contactPoste, String contactEmail,
            String contactTelephone, boolean createAccount, String clientPages,
            MultipartFile file) throws IOException {

        String filePath = null;
        String fileName = null;
        if (file != null && !file.isEmpty()) {
            fileName = file.getOriginalFilename();
            filePath = saveFile(file);
        }

        String logoPath = null;
        if (logoFile != null && !logoFile.isEmpty()) {
            logoPath = saveFile(logoFile);
        }

        // Auto-generate credentials if requested
        String rawPassword = null;
        String loginClient = null;
        String passwordHash = null;
        if (createAccount) {
            loginClient = generateLogin(nom);
            rawPassword = generatePassword(10);
            passwordHash = passwordEncoder.encode(rawPassword);
            log.info("Compte client créé - login={}", loginClient);
        }

        Client client = Client.builder()
                .nom(nom)
                .email(email)
                .telephone(telephone)
                .adresse(adresse)
                .notes(notes)
                .logoPath(logoPath)
                .contactNom(contactNom)
                .contactPoste(contactPoste)
                .contactEmail(contactEmail)
                .contactTelephone(contactTelephone)
                .loginClient(loginClient)
                .passwordClient(passwordHash)
                .clientPages(clientPages)
                .filePath(filePath)
                .fileName(fileName)
                .build();

        ClientDTO dto = toDTO(clientRepository.save(client));
        // Return raw password only at creation time
        if (rawPassword != null) {
            dto.setGeneratedPassword(rawPassword);
        }

        // Trigger Async drive hierarchy generation for current year
        googleDriveService.generateFullClientStructure(client.getNom(), java.time.LocalDate.now().getYear());

        return dto;
    }

    public ClientDTO update(Long id, String nom, String email, String telephone, String adresse,
            String notes, MultipartFile logoFile, String contactNom, String contactPoste, String contactEmail,
            String contactTelephone, boolean regeneratePassword, String clientPages,
            MultipartFile file) throws IOException {

        Client client = findOrThrow(id);

        if (nom != null && !nom.isBlank())
            client.setNom(nom);
        if (email != null)
            client.setEmail(email.isBlank() ? null : email);
        if (telephone != null)
            client.setTelephone(telephone.isBlank() ? null : telephone);
        if (adresse != null)
            client.setAdresse(adresse.isBlank() ? null : adresse);
        if (notes != null)
            client.setNotes(notes.isBlank() ? null : notes);
        if (contactNom != null)
            client.setContactNom(contactNom.isBlank() ? null : contactNom);
        if (contactPoste != null)
            client.setContactPoste(contactPoste.isBlank() ? null : contactPoste);
        if (contactEmail != null)
            client.setContactEmail(contactEmail.isBlank() ? null : contactEmail);
        if (contactTelephone != null)
            client.setContactTelephone(contactTelephone.isBlank() ? null : contactTelephone);

        // Regenerate password if requested (and account already exists)
        String rawPassword = null;
        if (regeneratePassword && client.getLoginClient() != null) {
            rawPassword = generatePassword(10);
            client.setPasswordClient(passwordEncoder.encode(rawPassword));
            log.info("Mot de passe client régénéré - login={}", client.getLoginClient());
        }

        if (file != null && !file.isEmpty()) {
            deleteFile(client.getFilePath());
            client.setFileName(file.getOriginalFilename());
            client.setFilePath(saveFile(file));
        }

        if (logoFile != null && !logoFile.isEmpty()) {
            deleteFile(client.getLogoPath());
            client.setLogoPath(saveFile(logoFile));
        }

        // Always update clientPages (even to null, allowing removal of all access)
        client.setClientPages(clientPages);

        ClientDTO dto = toDTO(clientRepository.save(client));
        if (rawPassword != null) {
            dto.setGeneratedPassword(rawPassword);
        }
        return dto;
    }

    public void delete(Long id) {
        Client client = findOrThrow(id);
        int projets = projetRepository.findByClientId(id).size();
        int plans = mediaPlanRepository.findByClientId(id).size();
        if (projets > 0 || plans > 0) {
            throw new RuntimeException("Impossible de supprimer ce client : " + projets + " projet(s) et " + plans
                    + " média plan(s) lui sont rattachés. Supprimez-les d'abord.");
        }
        // Affectations et rectifs du client : sans valeur sans lui
        assignmentRepository.deleteAll(assignmentRepository.findByClientId(id));
        reactifInternRepository.deleteAll(reactifInternRepository.findByClient_IdOrderByDateReactifDesc(id));
        String filePath = client.getFilePath();
        String logoPath = client.getLogoPath();
        clientRepository.delete(client);
        clientRepository.flush();
        // fichiers supprimes seulement si la suppression en base a reussi
        deleteFile(filePath);
        deleteFile(logoPath);
    }

    // ── File ─────────────────────────────────────────────────────────────────

    public Resource loadFile(Long id) throws MalformedURLException {
        Client client = findOrThrow(id);
        if (client.getFilePath() == null)
            throw new RuntimeException("Aucun fichier attaché.");
        Path path = Paths.get(client.getFilePath()).toAbsolutePath().normalize();
        Resource resource = new UrlResource(path.toUri());
        if (!resource.exists())
            throw new RuntimeException("Fichier introuvable.");
        return resource;
    }

    public Resource loadLogo(Long id) throws MalformedURLException {
        Client client = findOrThrow(id);
        if (client.getLogoPath() == null)
            throw new RuntimeException("Aucun logo attaché.");
        Path path = Paths.get(client.getLogoPath()).toAbsolutePath().normalize();
        Resource resource = new UrlResource(path.toUri());
        if (!resource.exists())
            throw new RuntimeException("Logo introuvable.");
        return resource;
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private String saveFile(MultipartFile file) throws IOException {
        Path dir = Paths.get(uploadDir, CLIENTS_SUBDIR).toAbsolutePath().normalize();
        Files.createDirectories(dir);
        String ext = com.antigone.rh.security.UploadPolicy.requireExtension(
                file.getOriginalFilename(), com.antigone.rh.security.UploadPolicy.DOCUMENTS);
        String uniqueName = UUID.randomUUID() + ext;
        Path target = dir.resolve(uniqueName);
        Files.copy(file.getInputStream(), target, StandardCopyOption.REPLACE_EXISTING);
        return target.toString();
    }

    private void deleteFile(String filePath) {
        if (filePath != null) {
            try {
                Files.deleteIfExists(Paths.get(filePath));
            } catch (IOException ignored) {
            }
        }
    }

    private String getExtension(String filename) {
        int dot = filename.lastIndexOf('.');
        return (dot >= 0) ? filename.substring(dot) : "";
    }

    private Client findOrThrow(Long id) {
        return clientRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Client non trouvé"));
    }

    /**
     * Generate login from client name: lowercase, alphanumeric only, max 15 chars +
     * numeric suffix if collision
     */
    private String generateLogin(String nom) {
        String cleaned = nom.toLowerCase().replaceAll("[^a-z0-9]", "");
        String base = cleaned.isEmpty() ? "client" : cleaned.substring(0, Math.min(cleaned.length(), 15));
        // Ensure uniqueness
        String candidate = base;
        int attempt = 0;
        while (clientRepository.existsByLoginClient(candidate)) {
            candidate = base + (++attempt);
        }
        return candidate;
    }

    private String generatePassword(int length) {
        StringBuilder sb = new StringBuilder(length);
        for (int i = 0; i < length; i++) {
            sb.append(PASSWORD_CHARS.charAt(RANDOM.nextInt(PASSWORD_CHARS.length())));
        }
        return sb.toString();
    }

    public ClientDTO toDTO(Client c) {
        String fileUrl = (c.getFilePath() != null) ? "/api/clients/" + c.getId() + "/file" : null;
        String logoUrlStr = (c.getLogoPath() != null) ? "/api/clients/" + c.getId() + "/logo" : null;
        return ClientDTO.builder()
                .id(c.getId())
                .nom(c.getNom())
                .email(c.getEmail())
                .telephone(c.getTelephone())
                .adresse(c.getAdresse())
                .notes(c.getNotes())
                .logoUrl(logoUrlStr)
                .contactNom(c.getContactNom())
                .contactPoste(c.getContactPoste())
                .contactEmail(c.getContactEmail())
                .contactTelephone(c.getContactTelephone())
                .hasAccount(c.getLoginClient() != null)
                .loginClient(c.getLoginClient())
                .clientPages(c.getClientPages())
                // passwordClient is hashed — never expose it in DTO except generatedPassword
                .description(c.getDescription())
                .responsable(c.getResponsable())
                .fileName(c.getFileName())
                .fileUrl(fileUrl)
                .dateCreation(c.getDateCreation())
                .build();
    }

    /** Parses "MEDIA_PLANS,PROJETS,FICHIERS" format into a List. */
    private List<String> parsePages(String clientPages) {
        if (clientPages == null || clientPages.isBlank())
            return Collections.emptyList();
        return Arrays.stream(clientPages.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .collect(Collectors.toList());
    }
}
