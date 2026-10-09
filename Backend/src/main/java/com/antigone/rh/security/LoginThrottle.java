package com.antigone.rh.security;

import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Limite les tentatives de connexion ratees (protection contre les mots de passe devines) :
 * {@value #MAX_FAILURES} echecs en {@value #WINDOW_MINUTES} minutes pour un meme identifiant depuis une meme adresse.
 */
@Component
public class LoginThrottle {

    static final int MAX_FAILURES = 10;
    static final long WINDOW_MINUTES = 15;

    private final Map<String, Deque<Instant>> failures = new ConcurrentHashMap<>();

    private static String key(String username, String ip) {
        return (username == null ? "" : username.trim().toLowerCase(Locale.ROOT)) + "|" + (ip == null ? "" : ip);
    }

    /** Minutes restantes avant de pouvoir reessayer, ou 0 si la connexion est autorisee. */
    public long minutesBlocked(String username, String ip) {
        Deque<Instant> q = failures.get(key(username, ip));
        if (q == null) {
            return 0;
        }
        synchronized (q) {
            purge(q);
            if (q.size() < MAX_FAILURES) {
                return 0;
            }
            Duration wait = Duration.between(Instant.now(), q.peekFirst().plus(Duration.ofMinutes(WINDOW_MINUTES)));
            return Math.max(1, wait.toMinutes() + 1);
        }
    }

    public void recordFailure(String username, String ip) {
        Deque<Instant> q = failures.computeIfAbsent(key(username, ip), k -> new ArrayDeque<>());
        synchronized (q) {
            purge(q);
            q.addLast(Instant.now());
        }
        if (failures.size() > 10_000) {
            failures.entrySet().removeIf(e -> {
                synchronized (e.getValue()) {
                    purge(e.getValue());
                    return e.getValue().isEmpty();
                }
            });
        }
    }

    public void recordSuccess(String username, String ip) {
        failures.remove(key(username, ip));
    }

    private static void purge(Deque<Instant> q) {
        Instant limit = Instant.now().minus(Duration.ofMinutes(WINDOW_MINUTES));
        while (!q.isEmpty() && q.peekFirst().isBefore(limit)) {
            q.pollFirst();
        }
    }
}
