package com.antigone.rh.exception;

import com.antigone.rh.dto.ApiResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ApiResponse<Void>> handleDataIntegrityViolation(DataIntegrityViolationException ex) {
        String rootMessage = ex.getMostSpecificCause() != null ? ex.getMostSpecificCause().getMessage() : "";
        String combined = rootMessage.toLowerCase();
        log.error("DataIntegrityViolation - root: [{}]", rootMessage);

        String userMessage;

        // Check unique constraint violations FIRST (PostgreSQL: "unique constraint" or
        // "uk_")
        if (combined.contains("unique") || combined.contains("uk_") || combined.contains("duplicate")) {
            if (combined.contains("cin")) {
                userMessage = "Ce numéro CIN existe déjà";
            } else if (combined.contains("email")) {
                userMessage = "Cette adresse email existe déjà";
            } else if (combined.contains("matricule")) {
                userMessage = "Ce matricule existe déjà";
            } else if (combined.contains("cnss")) {
                userMessage = "Ce numéro CNSS existe déjà";
            } else {
                userMessage = "Une valeur unique est déjà utilisée par un autre enregistrement";
            }
            return ResponseEntity
                    .status(HttpStatus.CONFLICT)
                    .body(ApiResponse.error(userMessage));
        }

        // NOT NULL violations (PostgreSQL: "violates not-null constraint")
        if (combined.contains("not-null") || combined.contains("not null")) {
            userMessage = "Un champ obligatoire est manquant";
            return ResponseEntity
                    .status(HttpStatus.BAD_REQUEST)
                    .body(ApiResponse.error(userMessage));
        }

        // CHECK constraint violations (PostgreSQL FR: "contrainte de vérification")
        if (combined.contains("check") || combined.contains("rification")) {
            if (combined.contains("genre")) {
                userMessage = "La valeur du genre est invalide (HOMME ou FEMME attendu)";
            } else {
                userMessage = "Une valeur ne respecte pas les contraintes";
            }
            return ResponseEntity
                    .status(HttpStatus.BAD_REQUEST)
                    .body(ApiResponse.error(userMessage));
        }

        userMessage = "Erreur d'intégrité des données";
        return ResponseEntity
                .status(HttpStatus.CONFLICT)
                .body(ApiResponse.error(userMessage));
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ApiResponse<Void>> handleAccessDenied(AccessDeniedException ex) {
        return ResponseEntity
                .status(HttpStatus.FORBIDDEN)
                .body(ApiResponse.error("Accès refusé : vous n'avez pas le droit d'effectuer cette action"));
    }

    @ExceptionHandler(MissingServletRequestParameterException.class)
    public ResponseEntity<ApiResponse<Void>> handleMissingParam(MissingServletRequestParameterException ex) {
        return ResponseEntity
                .status(HttpStatus.BAD_REQUEST)
                .body(ApiResponse.error("Paramètre obligatoire manquant : " + ex.getParameterName()));
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ApiResponse<Void>> handleTypeMismatch(MethodArgumentTypeMismatchException ex) {
        return ResponseEntity
                .status(HttpStatus.BAD_REQUEST)
                .body(ApiResponse.error("Valeur invalide pour le paramètre : " + ex.getName()));
    }

    @ExceptionHandler(RuntimeException.class)
    public ResponseEntity<ApiResponse<Void>> handleRuntimeException(RuntimeException ex) {
        log.error("RuntimeException caught: {}", ex.getMessage(), ex);
        return ResponseEntity
                .status(HttpStatus.BAD_REQUEST)
                .body(ApiResponse.error(ex.getMessage()));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<Void>> handleException(Exception ex) {
        log.error("Erreur interne non geree: {}", ex.getMessage(), ex);
        return ResponseEntity
                .status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.error("Erreur interne du serveur: " + ex.getMessage()));
    }
}
