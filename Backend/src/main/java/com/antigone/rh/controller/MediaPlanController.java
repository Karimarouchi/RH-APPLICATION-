package com.antigone.rh.controller;

import com.antigone.rh.dto.ApiResponse;
import com.antigone.rh.dto.MediaPlanDTO;
import com.antigone.rh.dto.MediaPlanRequest;
import com.antigone.rh.service.MediaPlanService;
import com.antigone.rh.security.SecurityUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/media-plans")
@RequiredArgsConstructor
public class MediaPlanController {

    private final MediaPlanService mediaPlanService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<MediaPlanDTO>>> getAll() {
        return ResponseEntity.ok(ApiResponse.ok(mediaPlanService.findAll()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<MediaPlanDTO>> getById(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(mediaPlanService.findById(id)));
    }

    @GetMapping("/client/{clientId}")
    public ResponseEntity<ApiResponse<List<MediaPlanDTO>>> getByClient(@PathVariable Long clientId) {
        return ResponseEntity.ok(ApiResponse.ok(mediaPlanService.findByClientId(clientId)));
    }

    @GetMapping("/employe/{employeId}")
    public ResponseEntity<ApiResponse<List<MediaPlanDTO>>> getByEmploye(@PathVariable Long employeId) {
        return ResponseEntity.ok(ApiResponse.ok(mediaPlanService.findByAssignedEmploye(employeId)));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<MediaPlanDTO>> create(@RequestBody MediaPlanRequest request) {
        return ResponseEntity.ok(ApiResponse.ok("Media plan créé", mediaPlanService.create(request)));
    }

    @PostMapping("/bulk")
    public ResponseEntity<ApiResponse<List<MediaPlanDTO>>> createBulk(@RequestBody List<MediaPlanRequest> requests) {
        return ResponseEntity.ok(ApiResponse.ok("Media plans créés", mediaPlanService.createBulk(requests)));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<MediaPlanDTO>> update(@PathVariable Long id,
            @RequestBody MediaPlanRequest request) {
        return ResponseEntity.ok(ApiResponse.ok("Media plan mis à jour", mediaPlanService.update(id, request)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable Long id) {
        mediaPlanService.delete(id);
        return ResponseEntity.ok(ApiResponse.ok("Media plan supprimé", null));
    }

    @PatchMapping("/{id}/approve")
    public ResponseEntity<ApiResponse<MediaPlanDTO>> approve(@PathVariable Long id,
            @RequestParam(required = false) Long managerId) {
        // l'approbateur est l'utilisateur connecte, jamais l'identifiant fourni dans la requete
        Long approver = SecurityUtils.currentEmployeIdOrNull() != null ? SecurityUtils.currentEmployeIdOrNull() : managerId;
        return ResponseEntity.ok(ApiResponse.ok("Media plan approuvé", mediaPlanService.approve(id, approver)));
    }

    @PatchMapping("/{id}/disapprove")
    public ResponseEntity<ApiResponse<MediaPlanDTO>> disapprove(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok("Media plan désapprouvé", mediaPlanService.disapprove(id)));
    }

    @PatchMapping("/{id}/accept")
    public ResponseEntity<ApiResponse<MediaPlanDTO>> accept(@PathVariable Long id,
            @RequestBody java.util.Map<String, Object> body) {
        Long approver = SecurityUtils.currentEmployeIdOrNull();
        @SuppressWarnings("unchecked")
        java.util.List<String> champs = body.get("champs") instanceof java.util.List
                ? (java.util.List<String>) body.get("champs")
                : java.util.List.of();
        return ResponseEntity.ok(ApiResponse.ok("Ligne acceptée", mediaPlanService.accept(id, champs, approver)));
    }

    @PatchMapping("/{id}/refuse")
    public ResponseEntity<ApiResponse<MediaPlanDTO>> refuse(@PathVariable Long id,
            @RequestBody java.util.Map<String, String> body) {
        return ResponseEntity.ok(ApiResponse.ok("Ligne refusée", mediaPlanService.refuse(id, body.get("rectifs"))));
    }

    @PatchMapping("/{id}/renvoyer-employe")
    public ResponseEntity<ApiResponse<MediaPlanDTO>> renvoyerEmploye(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok("Ligne renvoyée à l'employé", mediaPlanService.renvoyerEmploye(id)));
    }

    @GetMapping("/shootings/a-dater")
    public ResponseEntity<ApiResponse<List<MediaPlanDTO>>> shootingsADater() {
        return ResponseEntity.ok(ApiResponse.ok(mediaPlanService.shootingsEnAttenteDate()));
    }

    @PatchMapping("/{id}/shooting-date")
    public ResponseEntity<ApiResponse<MediaPlanDTO>> shootingDate(@PathVariable Long id,
            @RequestBody java.util.Map<String, String> body) {
        return ResponseEntity.ok(ApiResponse.ok("Date de shooting posée",
                mediaPlanService.placeShootingDate(id, body.get("date"), SecurityUtils.currentEmployeIdOrNull())));
    }

    @PatchMapping("/{id}/shooting-date-confirm")
    public ResponseEntity<ApiResponse<MediaPlanDTO>> confirmShootingDate(@PathVariable Long id,
            @RequestBody java.util.Map<String, Boolean> body) {
        boolean accepte = Boolean.TRUE.equals(body.get("accepte"));
        return ResponseEntity.ok(ApiResponse.ok(accepte ? "Date acceptée" : "Date refusée",
                mediaPlanService.confirmShootingDate(id, accepte, SecurityUtils.currentEmployeIdOrNull())));
    }

    @PatchMapping("/{id}/resubmit")
    public ResponseEntity<ApiResponse<MediaPlanDTO>> resubmit(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok("Media plan renvoyé", mediaPlanService.resubmit(id)));
    }

    @PatchMapping("/{id}/request-client-validation")
    public ResponseEntity<ApiResponse<MediaPlanDTO>> requestClientValidation(@PathVariable Long id) {
        return ResponseEntity
                .ok(ApiResponse.ok("En attente de validation client", mediaPlanService.requestClientValidation(id)));
    }

    @PatchMapping("/{id}/client-approve")
    public ResponseEntity<ApiResponse<MediaPlanDTO>> clientApprove(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok("Approuvé par le client", mediaPlanService.clientApprove(id)));
    }

    @PostMapping("/client-approve-all")
    public ResponseEntity<ApiResponse<List<MediaPlanDTO>>> clientApproveAll(@RequestBody List<Long> ids) {
        return ResponseEntity
                .ok(ApiResponse.ok("Batch approuvé par le client", mediaPlanService.clientApproveAll(ids)));
    }

    @PatchMapping("/{id}/client-disapprove")
    public ResponseEntity<ApiResponse<MediaPlanDTO>> clientDisapprove(@PathVariable Long id,
            @RequestBody(required = false) java.util.Map<String, String> body) {
        String rectifs = body != null ? body.get("rectifs") : null;
        return ResponseEntity.ok(ApiResponse.ok("Désapprouvé par le client", mediaPlanService.clientDisapprove(id, rectifs)));
    }

    @PatchMapping("/{id}/rectifs")
    public ResponseEntity<ApiResponse<MediaPlanDTO>> updateRectifs(
            @PathVariable Long id,
            @RequestBody java.util.Map<String, String> body) {
        return ResponseEntity.ok(ApiResponse.ok("Rectifs mis à jour",
                mediaPlanService.updateRectifs(id, body.get("rectifs"))));
    }

    // ── Google Drive Auth ────────────────────────────────────────────────────
    @GetMapping("/google-drive/auth-url")
    public ResponseEntity<ApiResponse<String>> getGoogleAuthUrl() throws java.io.IOException {
        return ResponseEntity.ok(ApiResponse.ok(mediaPlanService.getGoogleAuthUrl()));
    }

    @GetMapping("/google-drive/callback")
    public ResponseEntity<String> googleCallback(@RequestParam("code") String code) throws java.io.IOException {
        mediaPlanService.storeGoogleToken(code);
        return ResponseEntity.ok("Autorisation Google Drive réussie ! Vous pouvez fermer cet onglet.");
    }

    @GetMapping("/google-drive/status")
    public ResponseEntity<ApiResponse<Boolean>> getGoogleAuthStatus() {
        return ResponseEntity.ok(ApiResponse.ok(mediaPlanService.isGoogleAuthorized()));
    }
}
