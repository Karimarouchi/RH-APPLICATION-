package com.antigone.rh.controller;

import com.antigone.rh.dto.ApiResponse;
import com.antigone.rh.dto.ClientDTO;
import com.antigone.rh.service.ClientService;
import com.antigone.rh.service.ClientViewerDriveService;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.Resource;
import org.springframework.http.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;

import com.antigone.rh.service.GoogleDriveService;
import org.springframework.http.MediaType;

@RestController
@RequestMapping("/api/clients")
@RequiredArgsConstructor
public class ClientController {

    private final ClientService clientService;
    private final GoogleDriveService googleDriveService;
    private final ClientViewerDriveService clientViewerDriveService;

    @GetMapping
    @PreAuthorize("hasAnyAuthority('VIEW_CLIENTS', 'MANAGE_CLIENTS')")
    public ResponseEntity<ApiResponse<List<ClientDTO>>> getAll() {
        return ResponseEntity.ok(ApiResponse.ok("Clients récupérés", clientService.getAll()));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyAuthority('VIEW_CLIENTS', 'MANAGE_CLIENTS')")
    public ResponseEntity<ApiResponse<ClientDTO>> getById(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok("Client récupéré", clientService.getById(id)));
    }

    @GetMapping("/{id}/drive-link")
    @PreAuthorize("hasAnyAuthority('VIEW_CLIENTS', 'MANAGE_CLIENTS')")
    public ResponseEntity<ApiResponse<String>> getDriveLink(@PathVariable Long id) {
        ClientDTO dto = clientService.getById(id);
        String link = googleDriveService.getClientFolderLink(dto.getNom());
        if (link != null) {
            return ResponseEntity.ok(ApiResponse.ok("Lien Drive récupéré", link));
        }
        return ResponseEntity.ok(ApiResponse.ok("Dossier Drive non trouvé", null));
    }

    /**
     * Returns the client's root Drive folder link using the viewer-only service
     * account.
     * Used by the client portal so clients can view their folder without edit
     * access.
     */
    @GetMapping("/{id}/client-portal-drive-link")
    public ResponseEntity<ApiResponse<String>> getClientPortalDriveLink(@PathVariable Long id) {
        ClientDTO dto = clientService.getById(id);
        String link = clientViewerDriveService.getClientFolderLink(dto.getNom());
        if (link != null) {
            return ResponseEntity.ok(ApiResponse.ok("Lien Drive récupéré", link));
        }
        return ResponseEntity.ok(ApiResponse.ok("Dossier Drive non trouvé", null));
    }

    /**
     * Returns all files inside the client's Drive folder grouped by month.
     * Used by the client portal "Mes Fichiers" page.
     */
    @GetMapping("/{id}/drive-files")
    public ResponseEntity<ApiResponse<java.util.List<com.antigone.rh.dto.MonthFilesDTO>>> getDriveFiles(
            @PathVariable Long id) {
        ClientDTO dto = clientService.getById(id);
        java.util.List<com.antigone.rh.dto.MonthFilesDTO> grouped = clientViewerDriveService
                .getClientFilesGroupedByMonth(dto.getNom());
        return ResponseEntity.ok(ApiResponse.ok("Fichiers Drive récupérés", grouped));
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAuthority('MANAGE_CLIENTS')")
    public ResponseEntity<ApiResponse<ClientDTO>> create(
            @RequestParam("nom") String nom,
            @RequestParam(value = "email", required = false) String email,
            @RequestParam(value = "telephone", required = false) String telephone,
            @RequestParam(value = "adresse", required = false) String adresse,
            @RequestParam(value = "notes", required = false) String notes,
            @RequestParam(value = "logoFile", required = false) MultipartFile logoFile,
            @RequestParam(value = "contactNom", required = false) String contactNom,
            @RequestParam(value = "contactPoste", required = false) String contactPoste,
            @RequestParam(value = "contactEmail", required = false) String contactEmail,
            @RequestParam(value = "contactTelephone", required = false) String contactTelephone,
            @RequestParam(value = "createAccount", defaultValue = "false") boolean createAccount,
            @RequestParam(value = "clientPages", required = false) String clientPages,
            @RequestParam(value = "file", required = false) MultipartFile file) {
        try {
            ClientDTO dto = clientService.create(nom, email, telephone, adresse, notes,
                    logoFile, contactNom, contactPoste, contactEmail, contactTelephone,
                    createAccount, clientPages, file);
            return ResponseEntity.ok(ApiResponse.ok("Client créé", dto));
        } catch (IOException e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(ApiResponse.error("Erreur upload: " + e.getMessage()));
        }
    }

    @PutMapping(value = "/{id}", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAuthority('MANAGE_CLIENTS')")
    public ResponseEntity<ApiResponse<ClientDTO>> update(
            @PathVariable Long id,
            @RequestParam(value = "nom", required = false) String nom,
            @RequestParam(value = "email", required = false) String email,
            @RequestParam(value = "telephone", required = false) String telephone,
            @RequestParam(value = "adresse", required = false) String adresse,
            @RequestParam(value = "notes", required = false) String notes,
            @RequestParam(value = "logoFile", required = false) MultipartFile logoFile,
            @RequestParam(value = "contactNom", required = false) String contactNom,
            @RequestParam(value = "contactPoste", required = false) String contactPoste,
            @RequestParam(value = "contactEmail", required = false) String contactEmail,
            @RequestParam(value = "contactTelephone", required = false) String contactTelephone,
            @RequestParam(value = "regeneratePassword", defaultValue = "false") boolean regeneratePassword,
            @RequestParam(value = "clientPages", required = false) String clientPages,
            @RequestParam(value = "file", required = false) MultipartFile file) {
        try {
            ClientDTO dto = clientService.update(id, nom, email, telephone, adresse, notes,
                    logoFile, contactNom, contactPoste, contactEmail, contactTelephone,
                    regeneratePassword, clientPages, file);
            return ResponseEntity.ok(ApiResponse.ok("Client modifié", dto));
        } catch (IOException e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(ApiResponse.error("Erreur upload: " + e.getMessage()));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(e.getMessage()));
        }
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyAuthority('DELETE_CLIENT', 'ROLE_ADMIN')")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable Long id) {
        try {
            clientService.delete(id);
            return ResponseEntity.ok(ApiResponse.ok("Client supprimé", null));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(e.getMessage()));
        }
    }

    // ── File download/preview ─────────────────────────────────────────────────
    @GetMapping("/{id}/file")
    public ResponseEntity<Resource> downloadFile(@PathVariable Long id) {
        try {
            Resource resource = clientService.loadFile(id);
            String filename = resource.getFilename();
            MediaType mediaType = MediaType.APPLICATION_OCTET_STREAM;
            if (filename != null) {
                if (filename.endsWith(".pdf"))
                    mediaType = MediaType.APPLICATION_PDF;
                else if (filename.endsWith(".png"))
                    mediaType = MediaType.IMAGE_PNG;
                else if (filename.endsWith(".jpg") || filename.endsWith(".jpeg"))
                    mediaType = MediaType.IMAGE_JPEG;
            }
            return ResponseEntity.ok()
                    .contentType(mediaType)
                    .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + filename + "\"")
                    .body(resource);
        } catch (Exception e) {
            return ResponseEntity.notFound().build();
        }
    }

    @GetMapping("/{id}/logo")
    public ResponseEntity<Resource> downloadLogo(@PathVariable Long id) {
        try {
            Resource resource = clientService.loadLogo(id);
            String filename = resource.getFilename();
            MediaType mediaType = MediaType.APPLICATION_OCTET_STREAM;
            if (filename != null) {
                if (filename.endsWith(".png"))
                    mediaType = MediaType.IMAGE_PNG;
                else if (filename.endsWith(".jpg") || filename.endsWith(".jpeg"))
                    mediaType = MediaType.IMAGE_JPEG;
                else if (filename.endsWith(".svg"))
                    mediaType = MediaType.valueOf("image/svg+xml");
                else if (filename.endsWith(".webp"))
                    mediaType = MediaType.valueOf("image/webp");
            }
            return ResponseEntity.ok()
                    .contentType(mediaType)
                    .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + filename + "\"")
                    .body(resource);
        } catch (Exception e) {
            return ResponseEntity.notFound().build();
        }
    }
}
