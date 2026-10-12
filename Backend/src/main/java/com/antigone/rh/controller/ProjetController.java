package com.antigone.rh.controller;

import com.antigone.rh.dto.ApiResponse;
import com.antigone.rh.dto.ProjetDTO;
import com.antigone.rh.dto.ProjetRequest;
import com.antigone.rh.enums.StatutProjet;
import com.antigone.rh.service.ProjetService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/projets")
@RequiredArgsConstructor
public class ProjetController {

    private final ProjetService projetService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<ProjetDTO>>> getAll() {
        return ResponseEntity.ok(ApiResponse.ok(projetService.findAll()));
    }

    @GetMapping("/by-employe/{employeId}")
    public ResponseEntity<ApiResponse<List<ProjetDTO>>> getByEmploye(@PathVariable Long employeId) {
        return ResponseEntity.ok(ApiResponse.ok(projetService.findByEmploye(employeId)));
    }

    @GetMapping("/by-client/{clientId}")
    public ResponseEntity<ApiResponse<List<ProjetDTO>>> getByClient(@PathVariable Long clientId) {
        return ResponseEntity.ok(ApiResponse.ok(projetService.findByClient(clientId)));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<ProjetDTO>> getById(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(projetService.findById(id)));
    }

    @GetMapping("/statut/{statut}")
    public ResponseEntity<ApiResponse<List<ProjetDTO>>> getByStatut(@PathVariable String statut) {
        return ResponseEntity.ok(ApiResponse.ok(projetService.findByStatut(StatutProjet.valueOf(statut))));
    }

    @GetMapping("/by-departement/{dept}")
    public ResponseEntity<ApiResponse<List<ProjetDTO>>> getByDepartement(@PathVariable String dept) {
        return ResponseEntity.ok(ApiResponse.ok(projetService.findByDepartement(dept)));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<ProjetDTO>> create(@RequestBody ProjetRequest request) {
        return ResponseEntity.ok(ApiResponse.ok("Projet créé", projetService.create(request)));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<ProjetDTO>> update(@PathVariable Long id, @RequestBody ProjetRequest request) {
        return ResponseEntity.ok(ApiResponse.ok("Projet mis à jour", projetService.update(id, request)));
    }

    @PatchMapping("/{id}/statut")
    public ResponseEntity<ApiResponse<ProjetDTO>> changeStatut(@PathVariable Long id,
            @RequestParam String statut,
            @RequestParam(required = false, defaultValue = "false") boolean force) {
        try {
            StatutProjet statutEnum = StatutProjet.valueOf(statut.toUpperCase());
            return ResponseEntity
                    .ok(ApiResponse.ok("Statut mis à jour", projetService.changeStatut(id, statutEnum, force)));
        } catch (IllegalStateException e) {
            // CORRECTION 3: Return structured error for closure with open tasks
            return ResponseEntity.status(409).body(ApiResponse.error(e.getMessage()));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(ApiResponse.error("Statut invalide: " + statut));
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable Long id) {
        try {
            projetService.delete(id);
            return ResponseEntity.ok(ApiResponse.ok("Projet supprimé", null));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(
                    "Impossible de supprimer le projet : " + (e.getMessage() == null ? "erreur inattendue" : e.getMessage())));
        }
    }
}
