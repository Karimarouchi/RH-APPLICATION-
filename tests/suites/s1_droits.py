"""Droits d'acces : qui a le droit de faire quoi (projets, taches, clients, donnees RH, roles, conges)."""
from lib import call, data_of, msg_of, multipart, workday


def run(w):
    r = w.r
    E = w.eid
    pb = {'nom': 'Projet-droits', 'dateDebut': workday(2), 'dateFin': workday(60), 'statut': 'PLANIFIE',
          'typeProjet': 'INTERNE', 'chefDeProjetIds': [E('alice')], 'chefDeProjetId': E('alice'),
          'createurId': E('alice'), 'membreIds': [E('bob')]}

    r.section('Projets : seuls MANAGE_ALL_PROJETS / VIEW_PROJETS_CREATE_TACHES / ADMIN peuvent ecrire')
    c, j = w.req('alice', 'POST', '/api/projets', pb)
    r.expect('alice (MANAGER) cree un projet', c, 200, msg_of(j))
    pid = data_of(j)['id']
    w.projets.append(pid)
    r.expect('bob (employe) ne cree pas de projet', w.req('bob', 'POST', '/api/projets', pb)[0], 403)
    r.expect('carol (RH) ne cree pas de projet', w.req('carol', 'POST', '/api/projets', pb)[0], 403)
    r.expect('bob ne modifie pas un projet', w.req('bob', 'PUT', f'/api/projets/{pid}', pb)[0], 403)
    r.expect('bob ne supprime pas un projet', w.req('bob', 'DELETE', f'/api/projets/{pid}')[0], 403)
    r.expect('bob ne change pas le statut d\'un projet',
             w.req('bob', 'PATCH', f'/api/projets/{pid}/statut?statut=EN_COURS')[0], 403)
    r.expect('bob peut lire les projets', w.req('bob', 'GET', '/api/projets')[0], 200)

    r.section('Taches : un employe ne touche qu\'aux SIENNES')
    c, j = w.req('alice', 'POST', f'/api/taches/projet/{pid}', {'titre': 'T-bob', 'statut': 'TODO'})
    t_bob = data_of(j)['id']
    c, j = w.req('alice', 'POST', f'/api/taches/projet/{pid}', {'titre': 'T-alice', 'statut': 'TODO'})
    t_alice = data_of(j)['id']
    w.req('alice', 'PATCH', f"/api/taches/{t_bob}/assign/{E('bob')}")
    w.req('alice', 'PATCH', f"/api/taches/{t_alice}/assign/{E('alice')}")
    r.expect('bob ne cree pas de tache', w.req('bob', 'POST', f'/api/taches/projet/{pid}', {'titre': 'x'})[0], 403)
    r.expect('bob n\'assigne pas de tache', w.req('bob', 'PATCH', f"/api/taches/{t_bob}/assign/{E('bob')}")[0], 403)
    r.expect('bob ne supprime pas de tache', w.req('bob', 'DELETE', f'/api/taches/{t_bob}')[0], 403)
    r.expect('bob modifie SA tache', w.req('bob', 'PUT', f'/api/taches/{t_bob}', {'titre': 'T-bob v2', 'statut': 'IN_PROGRESS'})[0], 200)
    r.expect('bob change le statut de SA tache', w.req('bob', 'PATCH', f'/api/taches/{t_bob}/statut?statut=DONE')[0], 200)
    r.expect('bob ne modifie pas la tache d\'alice', w.req('bob', 'PUT', f'/api/taches/{t_alice}', {'titre': 'piratage'})[0], 403)
    r.expect('bob ne change pas le statut de la tache d\'alice',
             w.req('bob', 'PATCH', f'/api/taches/{t_alice}/statut?statut=DONE')[0], 403)
    r.expect('carol (RH) ne change pas le statut d\'une tache non assignee',
             w.req('carol', 'PATCH', f'/api/taches/{t_alice}/statut?statut=DONE')[0], 403)
    r.expect('alice change le statut de sa tache', w.req('alice', 'PATCH', f'/api/taches/{t_alice}/statut?statut=DONE')[0], 200)

    r.section('Clients')
    raw, ct = multipart({'nom': f'Client-droits-{w.run_id}', 'email': f'cd{w.run_id}@example.test'})
    r.expect('bob ne cree pas de client', w.req('bob', 'POST', '/api/clients', raw=raw, ctype=ct)[0], 403)
    r.expect('carol ne cree pas de client', w.req('carol', 'POST', '/api/clients', raw=raw, ctype=ct)[0], 403)
    c, j = w.req('alice', 'POST', '/api/clients', raw=raw, ctype=ct)
    r.expect('alice (MANAGER, MANAGE_CLIENTS) cree un client', c, 200, msg_of(j))
    cid = data_of(j)['id']
    w.clients.append(cid)
    r.expect('bob ne supprime pas un client', w.req('bob', 'DELETE', f'/api/clients/{cid}')[0], 403)
    r.expect('alice peut lire les clients', w.req('alice', 'GET', '/api/clients')[0], 200)

    r.section('Donnees RH sensibles (salaire, RIB, CIN, CNSS)')
    c, j = w.req('bob', 'GET', '/api/employes')
    a = [x for x in data_of(j) if x['id'] == E('alice')][0]
    r.check(a.get('salaire') is None and a.get('ribBancaire') is None and a.get('cin') is None and a.get('cnss') is None,
            "bob ne voit pas le salaire/RIB/CIN/CNSS d'alice")
    c, j = w.req('carol', 'GET', '/api/employes')
    a = [x for x in data_of(j) if x['id'] == E('alice')][0]
    r.check(a.get('salaire') == 4500.0, 'carol (RH, VIEW_EMPLOYES) voit le salaire')
    c, j = w.req('alice', 'GET', '/api/employes')
    a = [x for x in data_of(j) if x['id'] == E('alice')][0]
    r.check(a.get('salaire') == 4500.0, 'alice voit SON propre salaire')
    c, j = w.req('bob', 'GET', f'/api/projets/{pid}')
    chef = data_of(j)['chefsDeProjet'][0]
    r.check(chef.get('salaire') is None, 'bob ne voit pas le salaire du chef de projet (via /api/projets)')
    r.expect('bob ne modifie pas un employe', w.req('bob', 'PUT', f"/api/employes/{E('alice')}", {'nom': 'x'})[0], 403)
    r.expect('bob ne supprime pas un employe', w.req('bob', 'DELETE', f"/api/employes/{E('alice')}")[0], 403)
    r.expect('bob ne cree pas d\'employe', w.req('bob', 'POST', '/api/employes', {'nom': 'x'})[0], 403)

    r.section('Tableaux de bord, notifications, donnees personnelles')
    r.expect('bob : pas de dashboard admin', w.req('bob', 'GET', '/api/admin/dashboard')[0], 403)
    r.expect('bob : pas de dashboard de presence', w.req('bob', 'GET', '/api/agent/dashboard')[0], 403)
    r.expect('carol (VIEW_DASHBOARD) voit le dashboard', w.req('carol', 'GET', '/api/admin/dashboard')[0], 200)
    r.expect('alice (VIEW_TOUS_PROJETS) voit le dashboard projets', w.req('alice', 'GET', '/api/admin/dashboard')[0], 200)
    r.expect("bob lit SES notifications", w.req('bob', 'GET', f"/api/notifications/employe/{E('bob')}")[0], 200)
    r.expect("bob ne lit pas les notifications d'alice", w.req('bob', 'GET', f"/api/notifications/employe/{E('alice')}")[0], 403)
    r.expect("bob lit SES demandes", w.req('bob', 'GET', f"/api/demandes/employe/{E('bob')}")[0], 200)
    r.expect("bob ne lit pas les demandes d'alice", w.req('bob', 'GET', f"/api/demandes/employe/{E('alice')}")[0], 403)
    r.expect("carol (RH) lit les demandes de bob", w.req('carol', 'GET', f"/api/demandes/employe/{E('bob')}")[0], 200)
    r.expect("bob lit le statut de SON agent", w.req('bob', 'GET', f"/api/agent/status/{E('bob')}")[0], 200)
    r.expect("bob ne lit pas le statut de l'agent d'alice", w.req('bob', 'GET', f"/api/agent/status/{E('alice')}")[0], 403)

    r.section('Roles et referentiels')
    r.expect('bob ne cree pas de role', w.req('bob', 'POST', '/api/roles', {'nom': 'X', 'permissionIds': []})[0], 403)
    r.expect('bob ne lit pas la liste des roles', w.req('bob', 'GET', '/api/roles')[0], 403)
    r.expect('carol (RH) lit la liste des roles (formulaire employes)', w.req('carol', 'GET', '/api/roles')[0], 200)
    r.expect('carol (RH) ne cree pas de role', w.req('carol', 'POST', '/api/roles', {'nom': 'EVIL', 'permissionIds': []})[0], 403)
    r.expect('carol (RH) ne modifie pas un role', w.req('carol', 'PUT', f"/api/roles/{w.roles['ADMIN']}", {'nom': 'ADMIN', 'permissionIds': []})[0], 403)
    r.expect('bob ne cree pas de referentiel', w.req('bob', 'POST', '/api/referentiels', {'libelle': 'x', 'typeReferentiel': 'GENRE'})[0], 403)

    r.section('Calendrier')
    r.expect('bob ne cree pas de jour ferie', w.req('bob', 'POST', '/api/calendrier/jours', {'dateJour': workday(40), 'typeJour': 'FERIE'})[0], 403)
