package com.antigone.rh.controller;

import com.antigone.rh.dto.ReactifInternDTO;
import com.antigone.rh.service.ReactifInternService;
import com.antigone.rh.security.SecurityUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/reactifs")
@RequiredArgsConstructor
public class ReactifInternController {

    private final ReactifInternService reactifService;

    // ─── Create endpoints ─────────────────────────────────────────────────────

    /** Manager adds a reactif to a DONE/archived task → resets task to TODO */
    @PostMapping("/tache/{tacheId}")
    public ResponseEntity<ReactifInternDTO> createForTache(
            @PathVariable Long tacheId,
            @RequestParam Long managerId,
            @RequestBody Map<String, String> body) {
        return ResponseEntity.ok(reactifService.createForTache(tacheId, managerId, body.get("contenu")));
    }

    /** Manager adds a reactif when declining a media plan */
    @PostMapping("/mediaplan-intern/{mediaPlanId}")
    public ResponseEntity<ReactifInternDTO> createForMediaPlanIntern(
            @PathVariable Long mediaPlanId,
            @RequestParam Long managerId,
            @RequestBody Map<String, String> body) {
        return ResponseEntity.ok(reactifService.createForMediaPlanIntern(mediaPlanId, managerId, body.get("contenu")));
    }

    /** Client adds a reactif (extern) to a media plan */
    @PostMapping("/mediaplan-extern/{mediaPlanId}")
    public ResponseEntity<ReactifInternDTO> createForMediaPlanExtern(
            @PathVariable Long mediaPlanId,
            @RequestParam Long clientId,
            @RequestBody Map<String, String> body) {
        Long callerClient = SecurityUtils.currentClientIdOrNull();
        Long effectiveClientId = callerClient != null ? callerClient : clientId; // jamais l'identifiant fourni par un client
        return ResponseEntity.ok(reactifService.createForMediaPlanExtern(mediaPlanId, effectiveClientId, body.get("contenu")));
    }

    // ─── List endpoints (admin dashboard) ────────────────────────────────────

    @GetMapping("/intern/taches")
    public ResponseEntity<List<ReactifInternDTO>> getAllTacheReactifs() {
        return ResponseEntity.ok(reactifService.getAllTacheReactifs());
    }

    @GetMapping("/intern/mediaplans")
    public ResponseEntity<List<ReactifInternDTO>> getAllMediaPlanInternReactifs() {
        return ResponseEntity.ok(reactifService.getAllMediaPlanInternReactifs());
    }

    @GetMapping("/extern")
    public ResponseEntity<List<ReactifInternDTO>> getAllMediaPlanExternReactifs() {
        return ResponseEntity.ok(reactifService.getAllMediaPlanExternReactifs());
    }

    /** All reactifs for a specific task */
    @GetMapping("/by-tache/{tacheId}")
    public ResponseEntity<List<ReactifInternDTO>> getByTache(@PathVariable Long tacheId) {
        return ResponseEntity.ok(reactifService.getByTache(tacheId));
    }

    /** All reactifs for a specific media plan */
    @GetMapping("/by-mediaplan/{mediaPlanId}")
    public ResponseEntity<List<ReactifInternDTO>> getByMediaPlan(@PathVariable Long mediaPlanId) {
        return ResponseEntity.ok(reactifService.getByMediaPlan(mediaPlanId));
    }
}
