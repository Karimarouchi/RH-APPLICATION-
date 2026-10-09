package com.antigone.rh.security;

import java.util.Locale;
import java.util.Set;

/**
 * Liste blanche des extensions de fichiers envoyes par les utilisateurs.
 * Interdit notamment .html, .svg, .js, .exe : servis depuis le meme domaine que l'application,
 * ils permettraient de voler la session d'un autre utilisateur (XSS).
 */
public final class UploadPolicy {

    public static final Set<String> IMAGES = Set.of(".png", ".jpg", ".jpeg", ".gif", ".webp");

    public static final Set<String> DOCUMENTS = Set.of(".png", ".jpg", ".jpeg", ".gif", ".webp", ".pdf", ".doc",
            ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".txt", ".csv", ".zip");

    private UploadPolicy() {
    }

    /** Retourne l'extension (avec le point, en minuscules) ou leve une erreur si elle n'est pas autorisee. */
    public static String requireExtension(String originalFilename, Set<String> allowed) {
        String name = originalFilename == null ? "" : originalFilename;
        int dot = name.lastIndexOf('.');
        String ext = dot >= 0 ? name.substring(dot).toLowerCase(Locale.ROOT) : "";
        if (!allowed.contains(ext)) {
            throw new RuntimeException("Type de fichier non autorisé (" + (ext.isEmpty() ? "sans extension" : ext)
                    + "). Formats acceptés : " + String.join(", ", new java.util.TreeSet<>(allowed)));
        }
        return ext;
    }
}
