package com.antigone.rh.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.security.Keys;
import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Collection;
import java.util.Date;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;

@Service
public class JwtService {

    @Value("${app.jwt.secret:change-me-in-production-please-change-me-in-production}")
    private String rawSecret;

    @Value("${app.jwt.expiration-hours:12}")
    private long expirationHours;

    private SecretKey signingKey;

    @PostConstruct
    void init() {
        byte[] secretBytes = rawSecret.getBytes(StandardCharsets.UTF_8);
        if (secretBytes.length < 32) {
            byte[] padded = new byte[32];
            System.arraycopy(secretBytes, 0, padded, 0, Math.min(secretBytes.length, padded.length));
            secretBytes = padded;
        }
        signingKey = Keys.hmacShaKeyFor(secretBytes);
    }

    public String generateToken(AuthPrincipal principal) {
        Instant now = Instant.now();
        Instant expiresAt = now.plus(expirationHours, ChronoUnit.HOURS);

        return Jwts.builder()
                .subject(principal.getUsername())
                .issuedAt(Date.from(now))
                .expiration(Date.from(expiresAt))
                .claim("principalType", principal.getPrincipalType())
                .claim("accountId", principal.getAccountId())
                .claim("employeId", principal.getEmployeId())
                .claim("clientId", principal.getClientId())
                .claim("roles", principal.getRoles())
                .claim("permissions", principal.getPermissions())
                .claim("superAdmin", principal.isSuperAdmin())
                .signWith(signingKey, SignatureAlgorithm.HS256)
                .compact();
    }

    public Instant getExpiryInstant() {
        return Instant.now().plus(expirationHours, ChronoUnit.HOURS);
    }

    public AuthPrincipal parseToken(String token) {
        Claims claims = Jwts.parser()
                .verifyWith(signingKey)
                .build()
                .parseSignedClaims(token)
                .getPayload();

        return AuthPrincipal.builder()
                .principalType(claims.get("principalType", String.class))
                .accountId(readLong(claims, "accountId"))
                .employeId(readLong(claims, "employeId"))
                .clientId(readLong(claims, "clientId"))
                .username(claims.getSubject())
                .roles(readStringSet(claims.get("roles")))
                .permissions(readStringSet(claims.get("permissions")))
                .superAdmin(Boolean.TRUE.equals(claims.get("superAdmin", Boolean.class)))
                .build();
    }

    private Long readLong(Claims claims, String key) {
        Object value = claims.get(key);
        if (value instanceof Number number) {
            return number.longValue();
        }
        if (value instanceof String text && !text.isBlank()) {
            return Long.parseLong(text);
        }
        return null;
    }

    private Set<String> readStringSet(Object value) {
        if (value instanceof Collection<?> collection) {
            Set<String> result = new LinkedHashSet<>();
            for (Object item : collection) {
                if (item != null) {
                    result.add(String.valueOf(item));
                }
            }
            return result;
        }
        if (value instanceof String text && !text.isBlank()) {
            return new HashSet<>(Set.of(text));
        }
        return Set.of();
    }
}