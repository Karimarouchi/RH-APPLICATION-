package com.antigone.rh.controller;

import com.antigone.rh.dto.ApiResponse;
import com.antigone.rh.dto.DemandeRequest;
import com.antigone.rh.dto.DemandeResponse;
import com.antigone.rh.dto.HistoriqueStatutDTO;
import com.antigone.rh.enums.StatutDemande;
import com.antigone.rh.service.DemandeService;
import com.antigone.rh.security.SecurityUtils;
import com.antigone.rh.service.FileStorageService;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.format.annotation.DateTimeFormat;
import java.nio.file.Path;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/demandes")
@RequiredArgsConstructor
public class DemandeController {

    private final DemandeService demandeService;
    private final FileStorageService fileStorageService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<DemandeResponse>>> getAll() {
        return ResponseEntity.ok(ApiResponse.ok(demandeService.findAll()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<DemandeResponse>> getById(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(demandeService.findById(id)));
    }

    @GetMapping("/employe/{employeId}")
    public ResponseEntity<ApiResponse<List<DemandeResponse>>> getByEmploye(@PathVariable Long employeId) {
        SecurityUtils.requireSelfOrAny(employeId, "VIEW_DEMANDES", "VIEW_VALIDATIONS", "VIEW_EMPLOYES");
        return ResponseEntity.ok(ApiResponse.ok(demandeService.findByEmploye(employeId)));
    }

    @GetMapping("/statut/{statut}")
    public ResponseEntity<ApiResponse<List<DemandeResponse>>> getByStatut(@PathVariable StatutDemande statut) {
        return ResponseEntity.ok(ApiResponse.ok(demandeService.findByStatut(statut)));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<DemandeResponse>> create(@RequestBody DemandeRequest request) {
        bindToCaller(request);
        return ResponseEntity.ok(ApiResponse.ok("Demande créée", demandeService.create(request)));
    }

    @PostMapping(value = "/with-file", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ApiResponse<DemandeResponse>> createWithFile(
            @RequestPart("demande") DemandeRequest request,
            @RequestPart(value = "justificatif", required = false) MultipartFile justificatif) {
        bindToCaller(request);
        if (justificatif != null && !justificatif.isEmpty()) {
            String storedFilename = fileStorageService.store(justificatif);
            request.setJustificatifPath(storedFilename);
        }
        return ResponseEntity.ok(ApiResponse.ok("Demande créée", demandeService.create(request)));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<DemandeResponse>> update(
            @PathVariable Long id, @RequestBody DemandeRequest request) {
        return ResponseEntity.ok(ApiResponse.ok("Demande modifiée", demandeService.update(id, request)));
    }

    @PutMapping(value = "/{id}/with-file", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ApiResponse<DemandeResponse>> updateWithFile(
            @PathVariable Long id,
            @RequestPart("demande") DemandeRequest request,
            @RequestPart(value = "justificatif", required = false) MultipartFile justificatif) {
        if (justificatif != null && !justificatif.isEmpty()) {
            String storedFilename = fileStorageService.store(justificatif);
            request.setJustificatifPath(storedFilename);
        }
        return ResponseEntity.ok(ApiResponse.ok("Demande modifiée", demandeService.update(id, request)));
    }

    @GetMapping("/fichier/{filename}")
    public ResponseEntity<Resource> downloadFile(@PathVariable String filename) {
        try {
            Path filePath = fileStorageService.getFilePath(filename);
            Resource resource = new UrlResource(filePath.toUri());
            if (!resource.exists()) {
                return ResponseEntity.notFound().build();
            }
            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                    .body(resource);
        } catch (Exception e) {
            return ResponseEntity.notFound().build();
        }
    }

    /** Chef de département : employés qu'il peut désigner comme intérimaire pendant son congé. */
    @GetMapping("/interimaires")
    public ResponseEntity<ApiResponse<List<java.util.Map<String, Object>>>> interimaires() {
        return ResponseEntity.ok(ApiResponse.ok(demandeService.interimairesPossibles()));
    }

    /** Intérims de chef de département confiés à l'utilisateur connecté. */
    @GetMapping("/mon-interim")
    public ResponseEntity<ApiResponse<List<java.util.Map<String, Object>>>> monInterim() {
        return ResponseEntity.ok(ApiResponse.ok(demandeService.monInterim()));
    }

    /** Le chef de retour de congé reprend ses droits de validation. */
    @PatchMapping("/{id}/retour")
    public ResponseEntity<ApiResponse<DemandeResponse>> signalerRetour(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok("Retour signalé", demandeService.signalerRetour(id)));
    }

    @PatchMapping("/{id}/approve")
    public ResponseEntity<ApiResponse<DemandeResponse>> approve(
            @PathVariable Long id, @RequestParam(required = false) Long adminEmployeId) {
        return ResponseEntity.ok(ApiResponse.ok("Demande approuvée", demandeService.approve(id, SecurityUtils.requireEmployeId())));
    }

    @PatchMapping("/{id}/refuse")
    public ResponseEntity<ApiResponse<DemandeResponse>> refuse(
            @PathVariable Long id, @RequestParam(required = false) Long adminEmployeId,
            @RequestParam(required = false) String commentaire) {
        return ResponseEntity.ok(ApiResponse.ok("Demande refusée", demandeService.refuse(id, SecurityUtils.requireEmployeId(), commentaire)));
    }

    @PatchMapping("/{id}/cancel")
    public ResponseEntity<ApiResponse<DemandeResponse>> cancel(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok("Demande annulée", demandeService.cancel(id)));
    }

    @PatchMapping("/batch/approve")
    public ResponseEntity<ApiResponse<List<DemandeResponse>>> batchApprove(
            @RequestBody List<Long> ids, @RequestParam(required = false) Long adminEmployeId) {
        return ResponseEntity.ok(ApiResponse.ok("Demandes approuvées", demandeService.batchApprove(ids, SecurityUtils.requireEmployeId())));
    }

    @PatchMapping("/batch/refuse")
    public ResponseEntity<ApiResponse<List<DemandeResponse>>> batchRefuse(
            @RequestBody List<Long> ids, @RequestParam(required = false) Long adminEmployeId,
            @RequestParam(required = false) String commentaire) {
        return ResponseEntity.ok(ApiResponse.ok("Demandes refusées", demandeService.batchRefuse(ids, SecurityUtils.requireEmployeId(), commentaire)));
    }

    @GetMapping("/{id}/historique")
    public ResponseEntity<ApiResponse<List<HistoriqueStatutDTO>>> getHistorique(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(demandeService.getHistorique(id)));
    }

    @GetMapping("/calculate-days")
    public ResponseEntity<ApiResponse<Map<String, Object>>> calculateDays(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateDebut,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateFin,
            @RequestParam(required = false, defaultValue = "CONGE_PAYE") String typeConge) {
        Map<String, Object> result = demandeService.computeEffectiveDays(dateDebut, dateFin, typeConge);
        return ResponseEntity.ok(ApiResponse.ok(result));
    }
    /** Un employe ne cree une demande que pour lui-meme ; seuls RH / admin peuvent le faire pour un autre. */
    private void bindToCaller(DemandeRequest request) {
        Long me = SecurityUtils.currentEmployeIdOrNull();
        if (request.getEmployeId() == null) {
            request.setEmployeId(me);
        }
        SecurityUtils.requireSelfOrAny(request.getEmployeId(), "VIEW_DEMANDES");
    }
}
