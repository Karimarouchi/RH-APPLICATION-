package com.antigone.rh.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import jakarta.annotation.PostConstruct;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.UUID;

@Service
public class FileStorageService {

    @Value("${app.upload.dir:uploads/justificatifs}")
    private String uploadDir;

    private Path uploadPath;

    @PostConstruct
    public void init() {
        uploadPath = Paths.get(uploadDir).toAbsolutePath().normalize();
        try {
            Files.createDirectories(uploadPath);
        } catch (IOException e) {
            throw new RuntimeException("Impossible de créer le répertoire d'upload: " + uploadDir, e);
        }
    }

    /**
     * Store a file and return its relative path (for DB storage).
     */
    public String store(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            return null;
        }

        String originalFilename = file.getOriginalFilename();
        String extension = com.antigone.rh.security.UploadPolicy.requireExtension(
                originalFilename, com.antigone.rh.security.UploadPolicy.DOCUMENTS);

        // Generate unique filename
        String storedFilename = UUID.randomUUID().toString() + extension;
        Path targetPath = uploadPath.resolve(storedFilename);

        try {
            Files.copy(file.getInputStream(), targetPath, StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException e) {
            throw new RuntimeException("Erreur lors de l'enregistrement du fichier", e);
        }

        return storedFilename;
    }

    /**
     * Get the absolute path of a stored file.
     */
    public Path getFilePath(String filename) {
        return uploadPath.resolve(filename).normalize();
    }

    /**
     * Delete a stored file.
     */
    public void delete(String filename) {
        if (filename == null || filename.isBlank()) return;
        try {
            Files.deleteIfExists(uploadPath.resolve(filename));
        } catch (IOException e) {
            // Log but don't throw
        }
    }
}
