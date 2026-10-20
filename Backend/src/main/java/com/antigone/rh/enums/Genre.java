package com.antigone.rh.enums;

import java.text.Normalizer;
import java.util.Locale;

public enum Genre {
    HOMME,
    FEMME;

    public static Genre from(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        String normalized = Normalizer.normalize(value.trim(), Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "")
                .toUpperCase(Locale.ROOT);
        return switch (normalized) {
            case "HOMME", "MASCULIN", "MALE", "M", "H" -> HOMME;
            case "FEMME", "FEMININ", "FEMALE", "F" -> FEMME;
            default -> null;
        };
    }

    public static boolean isFemme(String value) {
        return from(value) == FEMME;
    }

    public static boolean isHomme(String value) {
        return from(value) == HOMME;
    }
}
