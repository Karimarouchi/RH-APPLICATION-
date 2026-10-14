package com.antigone.rh.service;

import com.antigone.rh.dto.PermissionDTO;
import com.antigone.rh.dto.RoleDTO;
import com.antigone.rh.dto.RoleRequest;
import com.antigone.rh.entity.Permission;
import com.antigone.rh.entity.Role;
import com.antigone.rh.repository.PermissionRepository;
import com.antigone.rh.repository.RoleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional
public class RoleService {

    private final RoleRepository roleRepository;
    private final PermissionRepository permissionRepository;

    private static final Map<String, String> PERMISSION_LABELS = Map.ofEntries(
            // ── RH Administration ────────────────────────────────────────────
            Map.entry("VIEW_DASHBOARD", "Tableau de bord RH — Vue générale des indicateurs et alertes"),
            Map.entry("VIEW_EMPLOYES", "Employés — Consulter, créer et gérer les fiches employés"),
            Map.entry("DELETE_EMPLOYE", "Supprimer des employés — Supprimer définitivement un employé archivé et toutes ses données"),
            Map.entry("VIEW_DEMANDES", "Demandes RH — Voir et traiter toutes les demandes (congés, absences…)"),
            Map.entry("VIEW_VALIDATIONS", "Validations — Approuver ou refuser les demandes soumises par les employés"),
            Map.entry("VIEW_REFERENTIELS",
                    "Référentiels — Gérer les listes de valeurs (postes, contrats, départements…)"),
            Map.entry("VIEW_COMPTES", "Comptes utilisateurs — Créer et gérer les accès à l'application"),
            Map.entry("DELETE_COMPTE", "Supprimer des comptes — Supprimer définitivement un compte utilisateur (l'employé est conservé)"),
            Map.entry("VIEW_ROLES", "Rôles & Permissions — Définir les droits d'accès par rôle"),
            Map.entry("VIEW_MONITORING",
                    "Monitoring — Suivre la présence et l'activité des utilisateurs en temps réel"),
            // ── Calendriers ─────────────────────────────────────────────────
            Map.entry("VIEW_CALENDRIER", "Calendrier d'entreprise — Consulter les événements et jours fériés globaux"),
            Map.entry("VIEW_RESTRICTION_CONGE", "Restrictions de congés — Définir et gérer les restrictions de dates de congés des collaborateurs"),
            Map.entry("VIEW_CALENDRIER_PROJETS", "Calendrier de tournage — Planification des shootings et productions"),
            Map.entry("VIEW_DEADLINES", "Calendrier des deadlines — Consulter les échéances des projets et tâches"),
            Map.entry("VIEW_REUNIONS", "Réunions — Voir, créer et planifier les réunions d'équipe"),
            // ── Projets (Administration) ─────────────────────────────────────
            Map.entry("VIEW_PROJETS", "Consultation des Projets— Accéder à la liste de tous les projets"),
            Map.entry("MANAGE_ALL_PROJETS",
                    "Gestion des Projets — Administration complète : créer, modifier, supprimer les projets et les tâches et assigner aux autres employés"),
            Map.entry("VIEW_TOUS_PROJETS",
                    "Dashboard Projets — Tableau de bord global et suivi détaillé de tous les projets"),
            Map.entry("VIEW_EQUIPES", "Équipes — Consulter et gérer les équipes de projet"),
            Map.entry("VIEW_PROJETS_CREATE_TACHES",
                    "Gestion des tâches — Gérer les tâches sur les projets assignés et assignés aux autres employés"),
            Map.entry("DELETE_PROJET", "Supprimer des projets — Supprimer définitivement un projet et toutes ses tâches"),
            Map.entry("DELETE_TACHE", "Supprimer des tâches — Supprimer définitivement une tâche"),
            // ── Clients ──────────────────────────────────────────────────────
            Map.entry("VIEW_CLIENTS", "Consultation des Clients — Consulter la liste et le détail des clients"),
            Map.entry("MANAGE_CLIENTS", "Gestion des Clients — Ajouter et modifier des clients"),
            Map.entry("DELETE_CLIENT", "Supprimer des clients — Supprimer définitivement un client"),
            // ── Media Plan ──────────────────────────────────────────────────
            Map.entry("VIEW_MEDIA_PLAN", "Média Plan — Voir et gérer ses propres médias plans"),
            Map.entry("VIEW_TOUS_MEDIA_PLAN",
                    "Voir tous les médias plans — Consulter tous les médias plans et assigner les employés aux clients"),
            Map.entry("VALIDATE_MEDIA_PLAN",
                    "Valider les médias plans — Approuver ou refuser les médias plans"),
            // ── Espace personnel (employé) ───────────────────────────────────
            Map.entry("VIEW_DASHBOARD_RH", "Mon tableau de bord — Vue personnelle des congés, documents et activité"),
            Map.entry("VIEW_MES_DEMANDES", "Mes demandes — Soumettre et suivre ses propres demandes de congé/absence"),
            Map.entry("VIEW_MES_PROJETS",
                    "Mes projets — Voir uniquement les projets sur lesquels l'employé est assigné"),
            Map.entry("VIEW_MON_CALENDRIER", "Mon calendrier — Consulter son agenda personnel et ses événements"));

    public List<RoleDTO> getAllRoles() {
        return roleRepository.findAll().stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    public RoleDTO getRoleById(Long id) {
        Role role = roleRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Rôle non trouvé"));
        return toDTO(role);
    }

    public RoleDTO createRole(RoleRequest request) {
        if (roleRepository.findByNom(request.getNom()).isPresent()) {
            throw new RuntimeException("Un rôle avec ce nom existe déjà");
        }

        Set<Permission> permissions = new HashSet<>();
        if (request.getPermissionIds() != null) {
            permissions = new HashSet<>(permissionRepository.findAllById(request.getPermissionIds()));
        }

        Role role = Role.builder()
                .nom(request.getNom())
                .permissions(permissions)
                .build();

        return toDTO(roleRepository.save(role));
    }

    public RoleDTO updateRole(Long id, RoleRequest request) {
        Role role = roleRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Rôle non trouvé"));

        role.setNom(request.getNom());

        if (request.getPermissionIds() != null) {
            Set<Permission> permissions = new HashSet<>(permissionRepository.findAllById(request.getPermissionIds()));
            role.setPermissions(permissions);
        }

        return toDTO(roleRepository.save(role));
    }

    public void deleteRole(Long id) {
        Role role = roleRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Rôle non trouvé"));

        if (!role.getComptes().isEmpty()) {
            throw new RuntimeException("Impossible de supprimer ce rôle car il est assigné à des comptes");
        }

        roleRepository.delete(role);
    }

    public List<PermissionDTO> getAllPermissions() {
        return permissionRepository.findAll().stream()
                .map(this::toPermissionDTO)
                .collect(Collectors.toList());
    }

    public void initPermissions() {
        for (Map.Entry<String, String> entry : PERMISSION_LABELS.entrySet()) {
            if (permissionRepository.findByPermission(entry.getKey()).isEmpty()) {
                permissionRepository.save(Permission.builder()
                        .permission(entry.getKey())
                        .build());
            }
        }
        // Supprimer les permissions obsolètes qui ne sont plus dans PERMISSION_LABELS
        permissionRepository.findAll().stream()
                .filter(p -> !PERMISSION_LABELS.containsKey(p.getPermission()))
                .forEach(p -> {
                    p.getRoles().forEach(role -> role.getPermissions().remove(p));
                    permissionRepository.delete(p);
                });
    }

    public RoleDTO toDTO(Role role) {
        return RoleDTO.builder()
                .id(role.getId())
                .nom(role.getNom())
                .permissions(role.getPermissions().stream()
                        .map(this::toPermissionDTO)
                        .collect(Collectors.toSet()))
                .build();
    }

    private PermissionDTO toPermissionDTO(Permission permission) {
        return PermissionDTO.builder()
                .id(permission.getId())
                .permission(permission.getPermission())
                .label(PERMISSION_LABELS.getOrDefault(permission.getPermission(), permission.getPermission()))
                .build();
    }
}
