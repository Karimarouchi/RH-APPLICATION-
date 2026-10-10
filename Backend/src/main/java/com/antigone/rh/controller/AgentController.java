package com.antigone.rh.controller;

import com.antigone.rh.dto.*;
import com.antigone.rh.entity.Heartbeat;
import com.antigone.rh.repository.HeartbeatRepository;
import com.antigone.rh.security.SecurityUtils;
import com.antigone.rh.service.AgentService;
import com.antigone.rh.service.RapportInactiviteService;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/agent")
@RequiredArgsConstructor
public class AgentController {

    private final AgentService agentService;
    private final RapportInactiviteService rapportInactiviteService;
    private final HeartbeatRepository heartbeatRepository;

    // ========================================
    // ENDPOINTS APPELÉS PAR L'AGENT DESKTOP
    // ========================================

    @GetMapping("/config")
    public ResponseEntity<ApiResponse<AgentConfigDTO>> getConfig() {
        AgentConfigDTO config = agentService.getAgentConfig();
        return ResponseEntity.ok(ApiResponse.ok(config));
    }

    @PostMapping("/heartbeat")
    public ResponseEntity<ApiResponse<String>> heartbeat(@RequestBody HeartbeatRequest request) {
        request.setEmployeId(SecurityUtils.requireEmployeId());
        agentService.processHeartbeat(request);
        return ResponseEntity.ok(ApiResponse.ok("OK", "heartbeat reçu"));
    }

    @PostMapping("/event")
    public ResponseEntity<ApiResponse<String>> event(@RequestBody AgentEventRequest request) {
        request.setEmployeId(SecurityUtils.requireEmployeId());
        agentService.processEvent(request);
        return ResponseEntity.ok(ApiResponse.ok("OK", "event traité"));
    }

    @PostMapping("/presence-confirm")
    public ResponseEntity<ApiResponse<String>> presenceConfirm(@RequestBody PresenceConfirmRequest request) {
        request.setEmployeId(SecurityUtils.requireEmployeId());
        agentService.processPresenceConfirm(request);
        return ResponseEntity.ok(ApiResponse.ok("OK", "confirmation reçue"));
    }

    // ========================================
    // DASHBOARD TEMPS REEL (frontend)
    // ========================================

    @GetMapping("/dashboard")
    public ResponseEntity<ApiResponse<List<DashboardEmployeStatusDTO>>> getDashboard() {
        List<DashboardEmployeStatusDTO> status = agentService.getDashboardStatus();
        return ResponseEntity.ok(ApiResponse.ok(status));
    }

    // ========================================
    // RAPPORTS D'INACTIVITE (frontend)
    // ========================================

    @GetMapping("/rapports")
    public ResponseEntity<ApiResponse<List<RapportInactiviteDTO>>> getRapports() {
        List<RapportInactiviteDTO> rapports = rapportInactiviteService.getAll();
        return ResponseEntity.ok(ApiResponse.ok(rapports));
    }

    @PostMapping("/rapports/generer")
    public ResponseEntity<ApiResponse<List<RapportInactiviteDTO>>> genererRapports() {
        List<RapportInactiviteDTO> rapports = rapportInactiviteService.genererSemaineCourante();
        return ResponseEntity.ok(ApiResponse.ok("Rapports générés", rapports));
    }

    @PostMapping("/rapports/generer-periode")
    public ResponseEntity<ApiResponse<List<RapportInactiviteDTO>>> genererPeriode(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate debut,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fin) {
        List<RapportInactiviteDTO> rapports = rapportInactiviteService.genererPeriode(debut, fin);
        return ResponseEntity.ok(ApiResponse.ok("Rapports générés", rapports));
    }

    @PutMapping("/rapports/{id}/decision")
    public ResponseEntity<ApiResponse<RapportInactiviteDTO>> decider(
            @PathVariable Long id,
            @RequestBody RapportDecisionRequest request) {
        RapportInactiviteDTO rapport = rapportInactiviteService.decider(id, request);
        return ResponseEntity.ok(ApiResponse.ok("Décision enregistrée", rapport));
    }

    // ========================================
    // STATUT AGENT & TÉLÉCHARGEMENT
    // ========================================

    @GetMapping("/historique/{employeId}")
    public ResponseEntity<ApiResponse<HistoriqueEmployeDTO>> getHistorique(
            @PathVariable Long employeId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate debut,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fin) {
        HistoriqueEmployeDTO historique = agentService.getHistorique(employeId, debut, fin);
        return ResponseEntity.ok(ApiResponse.ok(historique));
    }

    @GetMapping("/historique")
    public ResponseEntity<ApiResponse<List<HistoriqueEmployeDTO>>> getHistoriqueTous(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate debut,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fin) {
        List<HistoriqueEmployeDTO> historiques = agentService.getHistoriqueTous(debut, fin);
        return ResponseEntity.ok(ApiResponse.ok(historiques));
    }

    @GetMapping("/status/{employeId}")
    public ResponseEntity<ApiResponse<Map<String, Boolean>>> getAgentStatus(@PathVariable Long employeId) {
        com.antigone.rh.security.SecurityUtils.requireSelfOrAny(employeId, "VIEW_MONITORING", "VIEW_DASHBOARD");
        Heartbeat last = heartbeatRepository.findLastByEmployeId(employeId);
        // L'agent est considéré installé s'il a envoyé un heartbeat dans les 30
        // derniers jours
        boolean active = last != null && last.getTimestamp().isAfter(LocalDateTime.now().minusDays(30));
        return ResponseEntity.ok(ApiResponse.ok(Map.of("active", active)));
    }

    @GetMapping("/download")
    public ResponseEntity<Resource> downloadAgent() {
        try {
            // Try environment variable first, fallback to relative path
            String uploadDir = System.getenv("AGENT_UPLOADS_DIR");
            Path filePath;
            
            // Try multiple possible paths
            String[] possiblePaths = {
                // dossier du depot (AgentDesktop/release), monte dans le conteneur : un simple "git pull" met l'agent a jour
                "/app/agent-release/AgentDesktop-Setup.exe",
                "/var/www/solutions-web/rh-application/Backend/uploads/agent/AgentDesktop-Setup.exe",
                "uploads/agent/AgentDesktop-Setup.exe"
            };
            
            filePath = null;
            for (String path : possiblePaths) {
                Path candidate = Paths.get(path).toAbsolutePath().normalize();
                if (Files.exists(candidate)) {
                    filePath = candidate;
                    break;
                }
            }
            
            if (filePath == null) {
                return ResponseEntity.notFound().build();
            }            Resource resource = new UrlResource(filePath.toUri());
            return ResponseEntity.ok()
                    .contentType(MediaType.APPLICATION_OCTET_STREAM)
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"AgentDesktop-Setup.exe\"")
                    .body(resource);
        } catch (Exception e) {
            return ResponseEntity.internalServerError().build();
        }
    }
}
