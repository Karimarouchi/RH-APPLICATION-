package com.antigone.rh.controller;

import com.antigone.rh.dto.ApiResponse;
import com.antigone.rh.dto.NotificationResponse;
import com.antigone.rh.service.NotificationService;
import com.antigone.rh.security.SecurityUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/notifications")
@RequiredArgsConstructor
public class NotificationController {

    private final NotificationService notificationService;

    @GetMapping("/employe/{employeId}")
    public ResponseEntity<ApiResponse<List<NotificationResponse>>> getByEmploye(@PathVariable Long employeId) {
        SecurityUtils.requireSelfOrAny(employeId);
        return ResponseEntity.ok(ApiResponse.ok(notificationService.getByEmploye(employeId)));
    }

    @GetMapping("/employe/{employeId}/unread")
    public ResponseEntity<ApiResponse<List<NotificationResponse>>> getUnread(@PathVariable Long employeId) {
        SecurityUtils.requireSelfOrAny(employeId);
        return ResponseEntity.ok(ApiResponse.ok(notificationService.getUnreadByEmploye(employeId)));
    }

    @GetMapping("/employe/{employeId}/unread-count")
    public ResponseEntity<ApiResponse<Map<String, Long>>> getUnreadCount(@PathVariable Long employeId) {
        SecurityUtils.requireSelfOrAny(employeId);
        long count = notificationService.countUnread(employeId);
        return ResponseEntity.ok(ApiResponse.ok(Map.of("count", count)));
    }

    @PatchMapping("/{id}/read")
    public ResponseEntity<ApiResponse<NotificationResponse>> markAsRead(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(notificationService.markAsRead(id)));
    }

    @PatchMapping("/employe/{employeId}/read-all")
    public ResponseEntity<ApiResponse<Void>> markAllAsRead(@PathVariable Long employeId) {
        SecurityUtils.requireSelfOrAny(employeId);
        notificationService.markAllAsRead(employeId);
        return ResponseEntity.ok(ApiResponse.ok("Toutes les notifications marquées comme lues", null));
    }
}
