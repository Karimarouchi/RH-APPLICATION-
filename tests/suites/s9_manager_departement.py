"""Manager du departement : une seule personne par departement, et c'est elle le chef du projet video."""
from lib import data_of, msg_of, multipart, workday


def employe(rid, key, departement=None, manager=False):
    body = {
        'nom': f'Mgr{key}', 'prenom': f'Auto{rid}', 'email': f'mgr-{rid}-{key}@example.test',
        'dateEmbauche': '2025-01-01', 'poste': 'Test', 'salaire': 1000,
        'managerDepartement': manager,
    }
    if departement is not None:
        body['departement'] = departement
    return body


def run(w):
    r = w.r
    rid = w.run_id
    created = []

    def post(body):
        c, j = w.req('admin', 'POST', '/api/employes', body)
        if c == 200:
            created.append(data_of(j)['id'])
        return c, j

    def get(eid):
        return data_of(w.req('admin', 'GET', f'/api/employes/{eid}')[1])

    try:
        r.section('Case manager du departement')
        c, j = post(employe(rid, 'vide', manager=True))
        r.expect('sans departement, la case est refusee', c, 400, msg_of(j))
        r.check('manager' in msg_of(j).lower(), 'le message explique le refus')

        c, j = post(employe(rid, 'soc1', 'Social Media', True))
        r.expect('le premier Social Media est manager du departement', c, 200, msg_of(j))
        a = data_of(j)
        r.check(a.get('managerDepartement') is True, 'la case est enregistree')
        r.check(a.get('managerId') is None, 'sans champ Manager, il n a pas de superieur')

        c, j = post(employe(rid, 'soc2', 'social media', True))
        r.expect('un second Social Media peut etre designe', c, 200, msg_of(j))
        b = data_of(j)
        r.check(b.get('managerDepartement') is True, 'le second est le manager')
        r.check(get(a['id']).get('managerDepartement') is False,
                'le premier perd la case : un seul manager par departement')

        c, j = post(employe(rid, 'prod1', 'Production', False))
        r.expect('un employe Production sans la case', c, 200)
        plain = data_of(j)
        c, j = post(employe(rid, 'prod2', 'Production', True))
        r.expect('le manager Production est designe', c, 200)
        chef = data_of(j)
        r.check(get(b['id']).get('managerDepartement') is True,
                'le manager Social Media reste en place')
        r.check(plain.get('managerDepartement') is False, 'sans la case, il n est pas manager')

        r.section('Le projet video prend ce manager')
        raw, ct = multipart({'nom': f'Mgr client {rid}', 'email': f'mgrclient{rid}@example.test', 'createAccount': 'false'})
        c, j = w.req('admin', 'POST', '/api/clients', raw=raw, ctype=ct)
        r.expect('client de test cree', c, 200, msg_of(j))
        cid = data_of(j)['id']
        w.clients.append(cid)
        c, j = w.req('admin', 'POST', '/api/media-plans', {
            'clientId': cid, 'createurId': w.eid('alice'), 'titre': f'Video {rid}',
            'datePublication': workday(20), 'format': 'video', 'type': 'Organique', 'platforme': 'Instagram'})
        r.expect('media plan video cree', c, 200, msg_of(j))
        mid = data_of(j)['id']
        w.media_plans.append(mid)
        c, j = w.req('admin', 'PATCH', f'/api/media-plans/{mid}/approve')
        r.expect('le media plan video est approuve', c, 200, msg_of(j))
        c, j = w.req('admin', 'GET', f'/api/projets/by-client/{cid}')
        projets = data_of(j) if c == 200 else []
        projet = next((p for p in projets if p.get('mediaPlanLigneId') == mid), None)
        chefs = [x.get('id') for x in (projet or {}).get('chefsDeProjet') or []]
        r.check(projet is not None, 'un projet est ouvert pour la video')
        r.check(chef['id'] in chefs, 'le manager du departement Production est chef du projet')
        r.check(plain['id'] not in chefs, 'l employe Production sans la case n est pas chef')
    finally:
        for eid in created:
            w.req('admin', 'PUT', f'/api/employes/{eid}/archive')
