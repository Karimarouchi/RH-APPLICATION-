package com.antigone.rh.enums;

public enum StatutShooting {
    EN_ATTENTE,
    /** Le manager du département Production doit poser la date exacte. */
    EN_ATTENTE_DATE,
    /** L'employé et son manager vérifient la date avec le client. */
    EN_ATTENTE_CLIENT_DATE,
    VALIDE,
    REJETE
}
