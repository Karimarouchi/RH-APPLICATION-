package com.antigone.rh.service;

import com.antigone.rh.entity.Employe;
import com.antigone.rh.repository.EmployeRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class ContratExpirationScheduler {

    private final EmployeRepository employeRepository;
    private final NotificationService notificationService;

    /**
     * Envoie une notification aux admins et RH pour les contrats CIVP expirant dans 1 mois, 1 semaine, ou 3 jours.
     */
    @Scheduled(cron = "0 0 8 * * *")
    @Transactional
    public void checkContratsCivpExpiration() {
        LocalDate today = LocalDate.now();
        int[] daysArray = {30, 7, 3};
        for (int days : daysArray) {
            LocalDate targetDate = today.plusDays(days);
            List<Employe> civpEmployes = employeRepository.findCivpByDateFinContrat(targetDate);
            for (Employe employe : civpEmployes) {
                String nomComplet = employe.getPrenom() + " " + employe.getNom();
                String dateFin = employe.getDateFinContrat() != null ? employe.getDateFinContrat().toString() : "";
                String titre = "Fin de contrat CIVP";
                String message;
                if (days == 3) {
                    message = "⚠️ URGENT : Le contrat CIVP de " + nomComplet + " (" + employe.getMatricule() + ") se termine dans 3 jours (fin le " + dateFin + ") !";
                } else if (days == 7) {
                    message = "Le contrat CIVP de " + nomComplet + " (" + employe.getMatricule() + ") se termine dans 1 semaine (fin le " + dateFin + ").";
                } else {
                    message = "Le contrat CIVP de " + nomComplet + " (" + employe.getMatricule() + ") se termine dans 1 mois (fin le " + dateFin + ").";
                }
                notifyAdmins(titre, message);
            }
        }
    }

        /**
         * Envoie une notification aux admins et RH pour les contrats expirant dans un mois.
         */
        @Scheduled(cron = "0 0 8 * * *")
        @Transactional
        public void checkContratsCddExpiration() {
            LocalDate dateExpiration = LocalDate.now().plusMonths(1);
            List<Employe> employesExpirant = employeRepository.findByDateFinContrat(dateExpiration);

            for (Employe employe : employesExpirant) {
                String nomComplet = employe.getPrenom() + " " + employe.getNom();
                String message = "Le contrat de " + nomComplet
                    + " (" + employe.getMatricule() + ")"
                    + " se termine le " + employe.getDateFinContrat()
                    + ". Veuillez prendre les dispositions nécessaires.";
                notifyAdmins("Expiration de contrat CDD", message);
            }
        }

    /** Previent tous ceux qui gerent les fiches employes (VIEW_EMPLOYES). */
    private void notifyAdmins(String titre, String message) {
        for (Employe gestionnaire : employeRepository.findByPermission("VIEW_EMPLOYES")) {
            notificationService.create(gestionnaire, titre, message, null);
        }
    }
}
