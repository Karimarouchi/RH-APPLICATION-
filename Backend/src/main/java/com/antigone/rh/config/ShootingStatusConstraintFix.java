package com.antigone.rh.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Hibernate ne met pas à jour une contrainte CHECK déjà créée quand on ajoute
 * une valeur d'énumération. On la recrée avec les statuts de shooting actuels.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class ShootingStatusConstraintFix implements CommandLineRunner {

    private final JdbcTemplate jdbcTemplate;

    @Override
    public void run(String... args) {
        jdbcTemplate.execute("ALTER TABLE media_plans DROP CONSTRAINT IF EXISTS media_plans_shooting_status_check");
        jdbcTemplate.execute("""
                ALTER TABLE media_plans ADD CONSTRAINT media_plans_shooting_status_check
                CHECK (shooting_status IS NULL OR shooting_status IN (
                    'EN_ATTENTE', 'EN_ATTENTE_DATE', 'EN_ATTENTE_CLIENT_DATE', 'VALIDE', 'REJETE'))
                """);
        log.info("Contrainte shooting_status mise à jour");
    }
}
