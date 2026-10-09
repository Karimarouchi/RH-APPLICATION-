package com.antigone.rh.controller;

import com.antigone.rh.dto.ApiResponse;
import com.antigone.rh.dto.DocumentEmployeDTO;
import com.antigone.rh.service.DocumentEmployeService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/documents-employe")
@RequiredArgsConstructor
public class DocumentEmployeController {

    private final DocumentEmployeService documentService;

    @GetMapping("/employe/{employeId}")
    public ResponseEntity<ApiResponse<List<DocumentEmployeDTO>>> getByEmploye(@PathVariable Long employeId) {
        return ResponseEntity.ok(ApiResponse.ok(documentService.findByEmployeId(employeId)));
    }

    @GetMapping("/expiring")
    public ResponseEntity<ApiResponse<List<DocumentEmployeDTO>>> getExpiringSoon(@RequestParam(defaultValue = "30") int days) {
        return ResponseEntity.ok(ApiResponse.ok(documentService.findExpiringSoon(days)));
    }

    @GetMapping("/expired")
    public ResponseEntity<ApiResponse<List<DocumentEmployeDTO>>> getExpired() {
        return ResponseEntity.ok(ApiResponse.ok(documentService.findExpired()));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<DocumentEmployeDTO>> create(@RequestBody DocumentEmployeDTO dto) {
        return ResponseEntity.ok(ApiResponse.ok("Document ajouté", documentService.create(dto)));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<DocumentEmployeDTO>> update(@PathVariable Long id, @RequestBody DocumentEmployeDTO dto) {
        return ResponseEntity.ok(ApiResponse.ok("Document mis à jour", documentService.update(id, dto)));
    }

    @PostMapping("/{id}/upload")
    public ResponseEntity<ApiResponse<DocumentEmployeDTO>> uploadFichier(
            @PathVariable Long id,
            @RequestParam("file") MultipartFile file) {
        try {
            if (file.isEmpty()) {
                return ResponseEntity.badRequest().body(ApiResponse.error("Le fichier est vide"));
            }
            if (file.getSize() > 10 * 1024 * 1024) {
                return ResponseEntity.badRequest().body(ApiResponse.error("Le fichier ne doit pas dépasser 10 Mo"));
            }

            String uploadDir = System.getProperty("user.dir") + "/uploads/documents";
            Path uploadPath = Paths.get(uploadDir);
            if (!Files.exists(uploadPath)) {
                Files.createDirectories(uploadPath);
            }

            String originalFilename = file.getOriginalFilename();
            String extension = com.antigone.rh.security.UploadPolicy.requireExtension(
                    originalFilename, com.antigone.rh.security.UploadPolicy.DOCUMENTS);
            String filename = UUID.randomUUID() + extension;

            Path filePath = uploadPath.resolve(filename);
            Files.copy(file.getInputStream(), filePath);

            String fichierUrl = "/uploads/documents/" + filename;
            DocumentEmployeDTO updated = documentService.updateFichier(id, fichierUrl);

            return ResponseEntity.ok(ApiResponse.ok("Fichier uploadé", updated));
        } catch (IOException e) {
            return ResponseEntity.internalServerError().body(ApiResponse.error("Erreur lors de l'upload: " + e.getMessage()));
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable Long id) {
        documentService.delete(id);
        return ResponseEntity.ok(ApiResponse.ok("Document supprimé", null));
    }
}
