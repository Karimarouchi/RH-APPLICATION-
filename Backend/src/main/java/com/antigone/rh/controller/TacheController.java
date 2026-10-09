package com.antigone.rh.controller;

import com.antigone.rh.dto.ApiResponse;
import com.antigone.rh.dto.TacheDetailDTO;
import com.antigone.rh.entity.Tache;
import com.antigone.rh.enums.StatutTache;
import com.antigone.rh.service.TacheService;
import com.antigone.rh.security.SecurityUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/taches")
@RequiredArgsConstructor
public class TacheController {

    private final TacheService tacheService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<Tache>>> getAll() {
        return ResponseEntity.ok(ApiResponse.ok(tacheService.findAll()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<Tache>> getById(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(tacheService.findById(id)));
    }

    @GetMapping("/projet/{projetId}")
    public ResponseEntity<ApiResponse<List<Tache>>> getByProjet(@PathVariable Long projetId) {
        return ResponseEntity.ok(ApiResponse.ok(tacheService.findByProjet(projetId)));
    }

    @GetMapping("/projet/{projetId}/archived")
    public ResponseEntity<ApiResponse<List<Tache>>> getArchivedByProjet(@PathVariable Long projetId) {
        return ResponseEntity.ok(ApiResponse.ok(tacheService.findArchiveByProjet(projetId)));
    }

    @GetMapping("/assignee/{employeId}")
    public ResponseEntity<ApiResponse<List<TacheDetailDTO>>> getByAssignee(@PathVariable Long employeId) {
        return ResponseEntity.ok(ApiResponse.ok(tacheService.findDetailByAssignee(employeId)));
    }

    @PostMapping("/projet/{projetId}")
    public ResponseEntity<ApiResponse<Tache>> create(@PathVariable Long projetId, @RequestBody Tache tache) {
        return ResponseEntity.ok(ApiResponse.ok("Tâche créée", tacheService.create(projetId, tache)));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<Tache>> update(@PathVariable Long id, @RequestBody Tache tache) {
        requireManagerOrAssignee(id);
        return ResponseEntity.ok(ApiResponse.ok("Tâche mise à jour", tacheService.update(id, tache)));
    }

    @PutMapping("/{id}/unarchive")
    public ResponseEntity<ApiResponse<Tache>> unarchive(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok("Tâche désarchivée", tacheService.unarchive(id)));
    }

    @PatchMapping("/{id}/assign/{employeId}")
    public ResponseEntity<ApiResponse<Tache>> assign(@PathVariable Long id, @PathVariable Long employeId) {
        return ResponseEntity.ok(ApiResponse.ok("Tâche assignée", tacheService.assign(id, employeId)));
    }

    @PatchMapping("/{id}/statut")
    public ResponseEntity<ApiResponse<Tache>> changeStatut(@PathVariable Long id, @RequestParam StatutTache statut) {
        requireManagerOrAssignee(id);
        try {
            return ResponseEntity.ok(ApiResponse.ok("Statut mis à jour", tacheService.changeStatut(id, statut)));
        } catch (IllegalStateException e) {
            // CORRECTION 2: blocked status change without assignee
            return ResponseEntity.status(409).body(ApiResponse.error(e.getMessage()));
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable Long id) {
        tacheService.delete(id);
        return ResponseEntity.ok(ApiResponse.ok("Tâche supprimée", null));
    }

    @PostMapping("/{id}/relance")
    public ResponseEntity<ApiResponse<Void>> relance(@PathVariable Long id) {
        tacheService.relancerEmploye(id);
        return ResponseEntity.ok(ApiResponse.ok("Relance envoyée", null));
    }

    @PatchMapping("/{id}/deadline")
    public ResponseEntity<ApiResponse<Tache>> updateDeadline(
            @PathVariable Long id,
            @RequestBody Map<String, String> body) {
        LocalDate newDeadline = LocalDate.parse(body.get("dateEcheance"));
        return ResponseEntity.ok(ApiResponse.ok("Deadline mise à jour", tacheService.updateDeadline(id, newDeadline)));
    }
    /** Gestionnaires de projet : toutes les taches. Les autres : uniquement celles qui leur sont assignees. */
    private void requireManagerOrAssignee(Long tacheId) {
        if (SecurityUtils.isAdmin()
                || SecurityUtils.hasAnyAuthority("MANAGE_ALL_PROJETS", "VIEW_PROJETS_CREATE_TACHES")) {
            return;
        }
        Tache existing = tacheService.findById(tacheId);
        Long me = SecurityUtils.currentEmployeIdOrNull();
        if (existing.getAssignee() == null || me == null || !me.equals(existing.getAssignee().getId())) {
            throw new org.springframework.security.access.AccessDeniedException("Cette tache ne vous est pas assignee");
        }
    }
}
