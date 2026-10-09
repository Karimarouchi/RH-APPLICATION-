"""Agent de pointage : heartbeat, entree/sortie, retard, jour ferie, conge.

Les statuts sont relus par l'API (historique). Le cas « en conge aujourd'hui » a besoin d'un acces a la base
(la saisie d'un conge pour aujourd'hui est interdite par le preavis) : il est ignore si Docker n'est pas disponible.
"""
import datetime
import os
import subprocess

from lib import call, data_of, msg_of, midweek

DB_CONTAINER = os.environ.get('DB_CONTAINER', 'rh-postgres')
DB_USER = os.environ.get('DB_USER', 'rh_user')
DB_NAME = os.environ.get('DB_NAME', 'rh_database')


def sql(query):
    try:
        out = subprocess.run(['docker', 'exec', DB_CONTAINER, 'psql', '-U', DB_USER, '-d', DB_NAME, '-t', '-A', '-c', query],
                             capture_output=True, text=True, timeout=30)
        return out.stdout.strip() if out.returncode == 0 else None
    except Exception:
        return None


def statut_du_jour(w, who):
    today = datetime.date.today().isoformat()
    c, j = w.req('admin', 'GET', f"/api/agent/historique/{w.eid(who)}?debut={today}&fin={today}")
    jours = data_of(j)['jours'] if c == 200 else []
    return jours[0]['statut'] if jours else None


def clock_in(w, who):
    return w.req(who, 'POST', '/api/agent/event', {'eventType': 'CLOCK_IN', 'ipAddress': '192.168.1.20', 'ssid': ''})


def run(w):
    r = w.r
    E = w.eid
    today = datetime.date.today().isoformat()

    r.section('Appels de l\'agent (employe connecte)')
    c, j = w.req('bob', 'GET', '/api/agent/config')
    cfg = data_of(j) if c == 200 else {}
    r.check(c == 200 and cfg.get('heureDebutTravail') and cfg.get('joursTravail'), 'configuration lue par un employe (horaires, jours de travail)')
    r.expect('heartbeat', w.req('bob', 'POST', '/api/agent/heartbeat', {'ipAddress': '192.168.1.20', 'ssid': '', 'actif': True})[0], 200)
    r.expect('confirmation de presence', w.req('bob', 'POST', '/api/agent/presence-confirm', {'confirmed': True})[0], 200)
    r.expect('sans jeton : refuse', call('POST', '/api/agent/heartbeat', None, {})[0], 401)

    r.section('Pointage d\'entree (jour courant)')
    c, j = clock_in(w, 'bob')
    r.expect('CLOCK_IN accepte', c, 200, msg_of(j))
    st = statut_du_jour(w, 'bob')
    attendus = {'PRESENT', 'RETARD', 'TELETRAVAIL', 'JOUR_NON_TRAVAILLE', 'JOUR_FERIE', 'EN_CONGE'}
    r.check(st in attendus, f'statut du jour enregistre : {st}')
    r.expect('CLOCK_OUT accepte', w.req('bob', 'POST', '/api/agent/event', {'eventType': 'CLOCK_OUT', 'ipAddress': '', 'ssid': ''})[0], 200)

    r.section('Jour ferie')
    c, j = w.req('admin', 'POST', '/api/calendrier/jours', {'dateJour': today, 'nomJour': 'Test auto ferie', 'typeJour': 'FERIE',
                                                         'origine': 'NATIONAL', 'description': 'test', 'estPaye': True})
    r.expect('creation d\'un jour ferie aujourd\'hui', c, 200, msg_of(j))
    jid = data_of(j)['id'] if c == 200 else None
    try:
        if jid:
            clock_in(w, 'carol')
            r.expect('CLOCK_IN un jour ferie -> JOUR_FERIE', statut_du_jour(w, 'carol'), 'JOUR_FERIE')
            r.expect("un employe ne supprime pas un jour ferie", w.req('bob', 'DELETE', f'/api/calendrier/jours/{jid}')[0], 403)
    finally:
        if jid:
            w.req('admin', 'DELETE', f'/api/calendrier/jours/{jid}')

    r.section('Conge approuve aujourd\'hui')
    c, j = w.req('bob', 'POST', '/api/demandes', {'type': 'CONGE', 'typeConge': 'CONGE_PAYE', 'dateDebut': midweek(70), 'dateFin': midweek(70),
                                                    'raison': 'agent', 'employeId': E('bob')})
    did = data_of(j)['id'] if c == 200 else None
    if did and sql('select 1') == '1':
        w.req('carol', 'PATCH', f'/api/demandes/{did}/approve')
        sql(f"update conges set date_debut='{today}', date_fin='{today}' where id={did}")
        clock_in(w, 'bob')
        r.expect('CLOCK_IN un jour de conge approuve -> EN_CONGE', statut_du_jour(w, 'bob'), 'EN_CONGE')
        sql(f"update conges set date_debut='{midweek(70)}', date_fin='{midweek(70)}' where id={did}")
    else:
        r.skip('conge du jour : acces a la base indisponible (docker/psql)')
