"""Partie Projets : cycle de vie d'un projet (taches, assignation, cloture bloquee ou forcee, suppression)."""
from lib import call, data_of, msg_of, multipart, workday


def run(w):
    r = w.r
    E = w.eid
    raw, ct = multipart({'nom': f'Client-projets-{w.run_id}', 'email': f'cp{w.run_id}@example.test'})
    c, j = w.req('alice', 'POST', '/api/clients', raw=raw, ctype=ct)
    cid = data_of(j)['id']
    w.clients.append(cid)
    body = {'nom': 'Projet Alpha', 'dateDebut': workday(2), 'dateFin': workday(90), 'statut': 'PLANIFIE',
            'typeProjet': 'CLIENT', 'description': 'test', 'clientId': cid, 'chefDeProjetIds': [E('alice')],
            'chefDeProjetId': E('alice'), 'createurId': E('alice'), 'membreIds': [E('bob')]}

    r.section('Projet : creation, lecture, modification')
    c, j = w.req('alice', 'POST', '/api/projets', body)
    r.expect('alice cree un projet client', c, 200, msg_of(j))
    pid = data_of(j)['id']
    w.projets.append(pid)
    c, j = w.req('alice', 'GET', f'/api/projets/{pid}')
    d = data_of(j)
    r.check(c == 200 and d['nom'] == 'Projet Alpha' and d['statut'] == 'PLANIFIE' and d['clientId'] == cid,
            'lecture : nom, statut PLANIFIE, client rattache')
    r.check(len(d['chefsDeProjet']) == 1 and len(d['membres']) == 1, 'chef de projet et membre enregistres')
    c, j = w.req('bob', 'GET', f"/api/projets/by-employe/{E('bob')}")
    r.check(c == 200 and any(p['id'] == pid for p in data_of(j)), 'bob voit le projet dont il est membre')
    c, j = w.req('alice', 'GET', f'/api/projets/by-client/{cid}')
    r.check(c == 200 and len(data_of(j)) == 1, 'liste des projets du client')
    c, j = w.req('alice', 'PUT', f'/api/projets/{pid}', {**body, 'nom': 'Projet Alpha v2'})
    r.check(c == 200 and data_of(j)['nom'] == 'Projet Alpha v2', 'alice renomme le projet')

    r.section('Taches : assignation et regles de statut')
    c, j = w.req('alice', 'POST', f'/api/taches/projet/{pid}', {'titre': 'Tache 1', 'statut': 'TODO', 'dateEcheance': workday(30)})
    r.expect('alice cree une tache', c, 200, msg_of(j))
    tid = data_of(j)['id']
    c, j = w.req('alice', 'PATCH', f'/api/taches/{tid}/statut?statut=IN_PROGRESS')
    r.expect('demarrer une tache SANS assigne est refuse', c, 409, msg_of(j))
    r.expect('alice assigne la tache a bob', w.req('alice', 'PATCH', f"/api/taches/{tid}/assign/{E('bob')}")[0], 200)
    c, j = w.req('bob', 'GET', f"/api/taches/assignee/{E('bob')}")
    r.check(c == 200 and any(t['id'] == tid for t in data_of(j)), 'bob voit sa tache')
    r.expect('bob demarre sa tache', w.req('bob', 'PATCH', f'/api/taches/{tid}/statut?statut=IN_PROGRESS')[0], 200)

    r.section('Cloture du projet')
    w.req('alice', 'PATCH', f'/api/projets/{pid}/statut?statut=EN_COURS')
    c, j = w.req('alice', 'PATCH', f'/api/projets/{pid}/statut?statut=CLOTURE')
    r.expect('cloture avec tache ouverte refusee', c, 409, msg_of(j))
    r.check('CLOTURE_INCOMPLETE' in msg_of(j), 'le refus liste les taches ouvertes')
    r.expect('bob termine sa tache', w.req('bob', 'PATCH', f'/api/taches/{tid}/statut?statut=DONE')[0], 200)
    c, j = w.req('alice', 'PATCH', f'/api/projets/{pid}/statut?statut=CLOTURE')
    r.check(c == 200 and data_of(j)['statut'] == 'CLOTURE', 'cloture acceptee quand toutes les taches sont terminees')
    c, j = w.req('alice', 'GET', f'/api/projets/{pid}/rapport')
    r.expect('rapport du projet', c, 200, msg_of(j))
    r.expect('rapports de tous les projets', w.req('alice', 'GET', '/api/projets/rapports')[0], 200)

    r.section('Cloture forcee et suppression')
    c, j = w.req('alice', 'POST', '/api/projets', {**body, 'nom': 'Projet Beta'})
    p2 = data_of(j)['id']
    w.req('alice', 'POST', f'/api/taches/projet/{p2}', {'titre': 'ouverte', 'statut': 'TODO'})
    c, j = w.req('alice', 'PATCH', f'/api/projets/{p2}/statut?statut=CLOTURE&force=true')
    r.check(c == 200 and data_of(j)['statut'] == 'CLOTURE_INCOMPLET', 'cloture forcee -> CLOTURE_INCOMPLET')
    r.expect('alice supprime le projet (avec ses taches)', w.req('alice', 'DELETE', f'/api/projets/{p2}')[0], 200)
    r.expect('le projet supprime est introuvable', w.req('alice', 'GET', f'/api/projets/{p2}')[0], [400, 404])
    r.expect('statut invalide refuse proprement', w.req('alice', 'PATCH', f'/api/projets/{pid}/statut?statut=NIMPORTEQUOI')[0], 400)

    r.section('Suppression d\'un client')
    c, j = w.req('alice', 'DELETE', f'/api/clients/{cid}')
    r.expect('client ayant des projets : suppression refusee', c, 400, msg_of(j))
    r.check('projet' in msg_of(j), 'le refus explique pourquoi')
