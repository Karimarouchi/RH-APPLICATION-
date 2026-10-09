package com.antigone.rh.controller;

import com.antigone.rh.dto.ApiResponse;
import com.antigone.rh.dto.ValidationRequest;
import com.antigone.rh.entity.Validation;
import com.antigone.rh.service.ValidationService;
import com.antigone.rh.security.SecurityUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/validations")
@RequiredArgsConstructor
public class ValidationController {

    private final ValidationService validationService;

    @GetMapping("/demande/{demandeId}")
    public ResponseEntity<ApiResponse<List<Validation>>> getByDemande(@PathVariable Long demandeId) {
        return ResponseEntity.ok(ApiResponse.ok(validationService.findByDemande(demandeId)));
    }

    @GetMapping("/validateur/{validateurId}")
    public ResponseEntity<ApiResponse<List<Validation>>> getByValidateur(@PathVariable Long validateurId) {
        SecurityUtils.requireSelfOrAny(validateurId, "VIEW_DEMANDES");
        return ResponseEntity.ok(ApiResponse.ok(validationService.findByValidateur(validateurId)));
    }

    @GetMapping("/validateur/{validateurId}/pending")
    public ResponseEntity<ApiResponse<List<Validation>>> getPendingByValidateur(@PathVariable Long validateurId) {
        SecurityUtils.requireSelfOrAny(validateurId, "VIEW_DEMANDES");
        return ResponseEntity.ok(ApiResponse.ok(validationService.findPendingByValidateur(validateurId)));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<Validation>> create(@RequestBody ValidationRequest request) {
        return ResponseEntity.ok(ApiResponse.ok("Étape de validation créée", validationService.createValidationStep(request)));
    }

    @PatchMapping("/{id}/approve")
    public ResponseEntity<ApiResponse<Validation>> approve(@PathVariable Long id, @RequestParam(required = false) String commentaire) {
        return ResponseEntity.ok(ApiResponse.ok("Validation approuvée", validationService.approve(id, commentaire)));
    }

    @PatchMapping("/{id}/refuse")
    public ResponseEntity<ApiResponse<Validation>> refuse(@PathVariable Long id, @RequestParam(required = false) String commentaire) {
        return ResponseEntity.ok(ApiResponse.ok("Validation refusée", validationService.refuse(id, commentaire)));
    }
}
