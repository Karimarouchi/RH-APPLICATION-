"""Permissions propres a un compte, et validation reservee au chef du departement."""
from lib import data_of, login, midweek, msg_of


def put_employe(w, who, **changes):
    c, j = w.req('admin', 'GET', f"/api/employes/{w.eid(who)}")
    body = data_of(j)
    body.update(changes)
    return w.req('admin', 'PUT', f"/api/employes/{w.eid(who)}", body)


def run(w):
    r = w.r
    alice_compte = None
    alice_roles = None
    try:
        r.section('Permissions ajoutees et retirees sur un compte')
        c, j = w.req('admin', 'GET', '/api/roles/permissions')
        perms = {p['permission']: p['id'] for p in data_of(j)}
        c, j = w.req('admin', 'GET', f"/api/comptes/employe/{w.eid('alice')}")
        r.expect('le compte d alice est lisible', c, 200, msg_of(j))
        alice_compte = data_of(j)
        alice_roles = [x['id'] for x in alice_compte['roles']]
        c, j = w.req('admin', 'PUT', f"/api/comptes/{alice_compte['id']}", {
            'employeId': w.eid('alice'),
            'roleIds': alice_roles,
            'permissionIdsAjoutees': [perms['VALIDATE_MEDIA_PLAN']],
            'permissionIdsRetirees': [perms['VIEW_VALIDATIONS']],
        })
        r.expect('les permissions du compte sont enregistrees', c, 200, msg_of(j))
        effectives = set(data_of(j).get('permissionsEffectives') or [])
        r.check('VALIDATE_MEDIA_PLAN' in effectives, 'la permission ajoutee est effective')
        r.check('VIEW_VALIDATIONS' not in effectives, 'la permission retiree n est plus effective')
        r.check('VIEW_TOUS_MEDIA_PLAN' in effectives, 'le reste du role MANAGER est conserve')
        code, session = login(w.users['alice']['username'], w.users['alice']['password'])
        r.check(code == 200, 'alice se reconnecte')
        got = set((session or {}).get('permissions') or [])
        r.check('VALIDATE_MEDIA_PLAN' in got, 'la reconnexion prend la permission ajoutee')
        r.check('VIEW_VALIDATIONS' not in got, 'la reconnexion applique la permission retiree')

        r.section('Seul le chef du departement valide ses employes')
        w.new_employee('prodchef', 'MANAGER')
        w.new_employee('prodguy', 'TEST_EMPLOYE')
        w.new_employee('designchef', 'MANAGER')
        r.expect('chef Production designe', put_employe(w, 'prodchef', departement='Production', managerDepartement=True)[0], 200)
        r.expect('employe Production', put_employe(w, 'prodguy', departement='Production', managerDepartement=False)[0], 200)
        r.expect('chef Design designe', put_employe(w, 'designchef', departement='Designer graphique', managerDepartement=True)[0], 200)

        day = midweek(80)
        c, j = w.req('prodguy', 'POST', '/api/demandes', {
            'type': 'CONGE', 'typeConge': 'CONGE_PAYE', 'dateDebut': day, 'dateFin': day, 'raison': 'departement'})
        r.expect('l employe Production cree un conge', c, 200, msg_of(j))
        did = data_of(j)['id']
        r.expect('un manager sans la case ne valide pas ce departement',
                 w.req('alice', 'PATCH', f'/api/demandes/{did}/approve')[0], 403)
        r.expect('le chef d un autre departement ne valide pas',
                 w.req('designchef', 'PATCH', f'/api/demandes/{did}/approve')[0], 403)
        c, j = w.req('prodchef', 'GET', f"/api/notifications/employe/{w.eid('prodchef')}")
        notes = data_of(j) if c == 200 else []
        r.check(any('chef de son département' in (n.get('message') or '') for n in notes),
                'le chef Production est prevenu')
        c, j = w.req('prodchef', 'PATCH', f'/api/demandes/{did}/approve')
        r.expect('le chef du departement approuve', c, 200, msg_of(j))
        r.check(data_of(j).get('statut') == 'APPROUVEE', 'la demande est approuvee')

        day2 = midweek(90)
        c, j = w.req('prodguy', 'POST', '/api/demandes', {
            'type': 'CONGE', 'typeConge': 'CONGE_PAYE', 'dateDebut': day2, 'dateFin': day2, 'raison': 'rh'})
        did2 = data_of(j)['id']
        r.expect('la RH peut encore valider ce departement',
                 w.req('carol', 'PATCH', f'/api/demandes/{did2}/approve')[0], 200)
    finally:
        if alice_compte and alice_roles:
            w.req('admin', 'PUT', f"/api/comptes/{alice_compte['id']}", {
                'employeId': w.eid('alice'),
                'roleIds': alice_roles,
                'permissionIdsAjoutees': [],
                'permissionIdsRetirees': [],
            })
            code, session = login(w.users['alice']['username'], w.users['alice']['password'])
            if code == 200 and session:
                w.users['alice']['token'] = session['token']
