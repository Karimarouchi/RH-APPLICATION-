package com.antigone.rh.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CompteRequest {
    private Long employeId;
    private List<Long> roleIds;
    /** Null à la modification = ne pas changer. */
    private List<Long> permissionIdsAjoutees;
    /** Null à la modification = ne pas changer. */
    private List<Long> permissionIdsRetirees;
}
