package com.antigone.rh.controller;

import com.antigone.rh.dto.ApiResponse;
import com.antigone.rh.dto.ClientLoginRequest;
import com.antigone.rh.dto.ClientLoginResponse;
import com.antigone.rh.dto.ForgotPasswordRequest;
import com.antigone.rh.dto.LoginRequest;
import com.antigone.rh.dto.LoginResponse;
import com.antigone.rh.dto.ResetPasswordRequest;
import com.antigone.rh.service.ClientService;
import com.antigone.rh.service.CompteService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final CompteService compteService;
    private final ClientService clientService;
    private final com.antigone.rh.security.LoginThrottle loginThrottle;

    @PostMapping("/login")
    public ResponseEntity<ApiResponse<LoginResponse>> login(
            @RequestBody LoginRequest request,
            HttpServletRequest httpRequest) {
        String ipAddress = httpRequest.getRemoteAddr();
        long blocked = loginThrottle.minutesBlocked(request.getUsername(), ipAddress);
        if (blocked > 0) {
            return tooManyAttempts(blocked);
        }
        try {
            LoginResponse response = compteService.login(request, ipAddress);
            loginThrottle.recordSuccess(request.getUsername(), ipAddress);
            return ResponseEntity.ok(ApiResponse.ok("Connexion réussie", response));
        } catch (RuntimeException e) {
            if (!"Compte désactivé".equals(e.getMessage())) {
                loginThrottle.recordFailure(request.getUsername(), ipAddress);
            }
            return ResponseEntity.badRequest().body(ApiResponse.error(e.getMessage()));
        }
    }

    /** Le guide de premiere connexion a ete vu : memorise pour le compte connecte. */
    @PostMapping("/tour-vu")
    public ResponseEntity<ApiResponse<Void>> tourVu(@RequestParam String app) {
        Long accountId = com.antigone.rh.security.SecurityUtils.getCurrentPrincipal().getAccountId();
        if (accountId == null || com.antigone.rh.security.SecurityUtils.currentEmployeIdOrNull() == null) {
            return ResponseEntity.ok(ApiResponse.ok("Ignoré (compte client)", null));
        }
        compteService.markTourSeen(accountId, app);
        return ResponseEntity.ok(ApiResponse.ok("Guide marqué comme vu", null));
    }

    @PostMapping("/client-login")
    public ResponseEntity<ApiResponse<ClientLoginResponse>> clientLogin(
            @RequestBody ClientLoginRequest request,
            HttpServletRequest httpRequest) {
        String ipAddress = httpRequest.getRemoteAddr();
        String key = "client:" + request.getLoginClient();
        long blocked = loginThrottle.minutesBlocked(key, ipAddress);
        if (blocked > 0) {
            return tooManyAttempts(blocked);
        }
        try {
            ClientLoginResponse response = clientService.loginClient(
                    request.getLoginClient(), request.getPasswordClient());
            loginThrottle.recordSuccess(key, ipAddress);
            return ResponseEntity.ok(ApiResponse.ok("Connexion client réussie", response));
        } catch (RuntimeException e) {
            loginThrottle.recordFailure(key, ipAddress);
            return ResponseEntity.badRequest().body(ApiResponse.error(e.getMessage()));
        }
    }

    @PostMapping("/forgot-password")
    public ResponseEntity<ApiResponse<Void>> forgotPassword(@RequestBody ForgotPasswordRequest request) {
        try {
            compteService.forgotPassword(request.getEmail());
            return ResponseEntity.ok(ApiResponse.ok(
                    "Si un compte est associé à cet email, un lien de réinitialisation a été envoyé.", null));
        } catch (Exception e) {
            return ResponseEntity.ok(ApiResponse.ok(
                    "Si un compte est associé à cet email, un lien de réinitialisation a été envoyé.", null));
        }
    }

    @PostMapping("/reset-password")
    public ResponseEntity<ApiResponse<Void>> resetPassword(@RequestBody ResetPasswordRequest request) {
        try {
            compteService.resetPassword(request.getToken(), request.getNewPassword());
            return ResponseEntity.ok(ApiResponse.ok("Mot de passe réinitialisé avec succès", null));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(e.getMessage()));
        }
    }
    private <T> ResponseEntity<ApiResponse<T>> tooManyAttempts(long minutes) {
        return ResponseEntity.status(429).body(ApiResponse.error(
                "Trop de tentatives de connexion. Réessayez dans " + minutes + " minute(s)."));
    }
}
