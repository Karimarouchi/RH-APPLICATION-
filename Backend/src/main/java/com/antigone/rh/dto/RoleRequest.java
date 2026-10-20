package com.antigone.rh.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Set;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RoleRequest {
    private String nom;
    private Set<Long> permissionIds;
    /** null = inchange. Modifiable uniquement par un super administrateur. */
    private Boolean accesTotal;
}
