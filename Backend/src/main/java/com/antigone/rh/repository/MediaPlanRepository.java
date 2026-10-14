package com.antigone.rh.repository;

import com.antigone.rh.entity.MediaPlan;
import com.antigone.rh.enums.StatutMediaPlan;
import com.antigone.rh.enums.StatutShooting;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MediaPlanRepository extends JpaRepository<MediaPlan, Long> {
    List<MediaPlan> findByClientId(Long clientId);

    List<MediaPlan> findByCreateurId(Long createurId);

    List<MediaPlan> findByStatut(StatutMediaPlan statut);

    List<MediaPlan> findByShootingStatus(StatutShooting shootingStatus);

    List<MediaPlan> findByClientIdIn(List<Long> clientIds);
}
