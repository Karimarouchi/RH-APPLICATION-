"""Jeu de test : utilisateurs avec les VRAIS roles par defaut de l'application, crees puis nettoyes par l'API."""
import json
import os
import time

from lib import (ADMIN_PASSWORD, ADMIN_USER, TEST_PASSWORD, call, data_of, login, msg_of)

EMPLOYEE_ROLE = 'TEST_EMPLOYE'  # role d'un employe simple (4 permissions personnelles), cree au besoin
EMPLOYEE_PERMS = ['VIEW_DASHBOARD_RH', 'VIEW_MES_DEMANDES', 'VIEW_MON_CALENDRIER', 'VIEW_MES_PROJETS']
STATE_FILE = os.path.join(os.path.dirname(__file__), '.state.json')


class World:
    def __init__(self, report):
        self.r = report
        self.run_id = str(int(time.time()))[-7:]
        self.admin = None
        self.users = {}          # nom -> {eid, cid, username, password, token}
        self.roles = {}          # nom -> id
        self.clients = []        # ids a supprimer
        self.projets = []
        self.media_plans = []
        self.extra_accounts = []  # (compte_id, employe_id)

    # -- helpers
    def tok(self, who):
        return self.admin if who == 'admin' else self.users[who]['token']

    def eid(self, who):
        return self.users[who]['eid']

    def req(self, who, method, path, body=None, **kw):
        return call(method, path, self.tok(who), body, **kw)

    def new_employee(self, key, role_name, salaire=None, poste='Test'):
        """Cree un employe + un compte (mot de passe genere par le serveur), puis fixe un mot de passe connu."""
        rid = self.run_id
        code, j = call('POST', '/api/employes', self.admin, {
            'nom': f'Test{key.title()}', 'prenom': f'Auto{rid}', 'email': f'tst-{rid}-{key}@example.test',
            'dateEmbauche': '2025-01-01', 'poste': poste, 'salaire': salaire})
        if code != 200:
            raise RuntimeError(f'creation employe {key}: {code} {msg_of(j)}')
        eid = data_of(j)['id']
        code, j = call('POST', '/api/comptes', self.admin, {'employeId': eid, 'roleIds': [self.roles[role_name]]})
        if code != 200:
            raise RuntimeError(f'creation compte {key}: {code} {msg_of(j)}')
        acct = data_of(j)
        code, d = login(acct['username'], acct['generatedPassword'])
        if code != 200:
            raise RuntimeError(f'connexion {key} avec le mot de passe genere: {code}')
        code, j = call('PUT', f"/api/comptes/{acct['id']}/password", d['token'],
                       {'oldPassword': acct['generatedPassword'], 'newPassword': TEST_PASSWORD})
        if code != 200:
            raise RuntimeError(f'changement mot de passe {key}: {code} {msg_of(j)}')
        code, d = login(acct['username'], TEST_PASSWORD)
        self.users[key] = {'eid': eid, 'cid': acct['id'], 'username': acct['username'],
                           'password': TEST_PASSWORD, 'token': d['token']}
        return self.users[key]

    def setup(self):
        r = self.r
        r.section('Preparation (utilisateurs de test avec les roles par defaut)')
        code, d = login(ADMIN_USER, ADMIN_PASSWORD)
        if code != 200:
            raise SystemExit(f"Connexion admin impossible ({code}). Verifiez API_URL, ADMIN_USER et ADMIN_PASSWORD.")
        self.admin = d['token']
        # Securite : creer un client genere ~50 dossiers sur le Google Drive branche. Jamais sur un vrai Drive.
        code, j = call('GET', '/api/media-plans/google-drive/status', self.admin)
        if code == 200 and data_of(j) is True and os.environ.get('ALLOW_DRIVE') != '1':
            raise SystemExit(
                "ARRET : ce serveur est connecte a un Google Drive actif. Les tests creent des clients, et chaque client "
                "cree une cinquantaine de dossiers sur ce Drive. Lancez les tests sur un serveur SANS cles Google Drive "
                "(voir tests/README.md), ou definissez ALLOW_DRIVE=1 si vous utilisez un Drive de test dedie.")
        code, j = call('GET', '/api/roles', self.admin)
        self.roles = {x['nom']: x['id'] for x in data_of(j)}
        for needed in ('ADMIN', 'MANAGER', 'RH', 'Head Prod'):
            r.check(needed in self.roles, f"role par defaut '{needed}' present")
            if needed not in self.roles:
                raise SystemExit(f"Role {needed} absent : l'initialisation au demarrage n'a pas tourne.")
        if EMPLOYEE_ROLE not in self.roles:
            code, j = call('GET', '/api/roles/permissions', self.admin)
            pid = {p['permission']: p['id'] for p in data_of(j)}
            code, j = call('POST', '/api/roles', self.admin,
                           {'nom': EMPLOYEE_ROLE, 'permissionIds': [pid[p] for p in EMPLOYEE_PERMS]})
            self.roles[EMPLOYEE_ROLE] = data_of(j)['id']
        self.new_employee('alice', 'MANAGER', salaire=4500)
        self.new_employee('bob', EMPLOYEE_ROLE)
        self.new_employee('carol', 'RH')
        self.new_employee('dave', 'Head Prod')
        r.check(len(self.users) == 4, 'utilisateurs de test crees : alice (MANAGER), bob (employe), carol (RH), dave (Head Prod)')
        with open(STATE_FILE, 'w', encoding='utf-8') as f:
            json.dump({'users': {k: {'username': v['username'], 'password': v['password'], 'eid': v['eid'], 'cid': v['cid']} for k, v in self.users.items()}}, f)

    def cleanup(self):
        self.r.section('Nettoyage des donnees de test')
        n = 0
        for pid in self.projets:
            n += call('DELETE', f'/api/projets/{pid}', self.admin)[0] == 200
        for mid in self.media_plans:
            n += call('DELETE', f'/api/media-plans/{mid}', self.admin)[0] == 200
        for cid in self.clients:
            # l'approbation d'un media plan cree automatiquement un projet : on les retire avant le client
            code, j = call('GET', f'/api/projets/by-client/{cid}', self.admin)
            for p in (data_of(j) if code == 200 else []):
                call('DELETE', f"/api/projets/{p['id']}", self.admin)
            n += call('DELETE', f'/api/clients/{cid}', self.admin)[0] == 200
        for u in list(self.users.values()):
            call('PATCH', f"/api/comptes/{u['cid']}/toggle", self.admin)
            call('PUT', f"/api/employes/{u['eid']}/archive", self.admin)
        for cid, eid in self.extra_accounts:
            call('PATCH', f'/api/comptes/{cid}/toggle', self.admin)
            call('PUT', f'/api/employes/{eid}/archive', self.admin)
        print(f"  {n} objets supprimes, {len(self.users) + len(self.extra_accounts)} comptes de test desactives et archives")
