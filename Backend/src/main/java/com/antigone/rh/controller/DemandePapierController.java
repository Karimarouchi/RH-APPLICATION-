package com.antigone.rh.controller;

import com.antigone.rh.dto.ApiResponse;
import com.antigone.rh.dto.DemandePapierRequest;
import com.antigone.rh.dto.DemandeResponse;
import com.antigone.rh.service.DemandePapierService;
import com.antigone.rh.security.SecurityUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/demandes-papier")
@RequiredArgsConstructor
public class DemandePapierController {

    private final DemandePapierService demandePapierService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<DemandeResponse>>> getAll() {
        return ResponseEntity.ok(ApiResponse.ok(demandePapierService.findAll()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<DemandeResponse>> getById(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(demandePapierService.findById(id)));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<DemandeResponse>> create(@RequestBody DemandePapierRequest request) {
        if (request.getEmployeId() == null) {
            request.setEmployeId(SecurityUtils.currentEmployeIdOrNull());
        }
        SecurityUtils.requireSelfOrAny(request.getEmployeId(), "VIEW_VALIDATIONS", "VIEW_DEMANDES");
        return ResponseEntity.ok(ApiResponse.ok("Demande papier créée", demandePapierService.create(request)));
    }

    @PatchMapping("/{id}/accept")
    public ResponseEntity<ApiResponse<DemandeResponse>> accept(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok("Demande papier acceptée", demandePapierService.accept(id)));
    }

    @PatchMapping("/{id}/cancel")
    public ResponseEntity<ApiResponse<DemandeResponse>> cancel(
            @PathVariable Long id,
            @RequestBody(required = false) DemandePapierRequest request) {
        String motif = request != null ? request.getMotifAnnulation() : null;
        return ResponseEntity.ok(ApiResponse.ok("Demande papier annulée", demandePapierService.cancel(id, motif)));
    }
}
