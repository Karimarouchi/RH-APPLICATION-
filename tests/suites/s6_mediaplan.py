"""Media plans : creation, validation interne, validation client, rectifs, tournage (Head Prod), suppression."""
from lib import call, data_of, msg_of, workday
from suites.s5_portail_client import make_client


def run(w):
    r = w.r
    E = w.eid
    cid_a, tok_a, _ = make_client(w, f'MP A {w.run_id}', f'mpa{w.run_id}@example.test')
    cid_b, tok_b, _ = make_client(w, f'MP B {w.run_id}', f'mpb{w.run_id}@example.test')
    mp = {'clientId': cid_a, 'createurId': E('alice'), 'titre': 'Post lancement', 'datePublication': workday(20), 'heure': '10:00',
          'format': 'Post carré', 'type': 'Organique', 'platforme': 'Instagram', 'texteSurVisuel': 'Bonjour'}

    r.section('Creation et validation interne')
    r.expect('un employe sans droit media plan ne cree pas', w.req('bob', 'POST', '/api/media-plans', mp)[0], 403)
    c, j = w.req('alice', 'POST', '/api/media-plans', mp)
    r.expect('alice cree un media plan', c, 200, msg_of(j))
    mid = data_of(j)['id']
    w.media_plans.append(mid)
    r.check(data_of(j)['statut'] == 'EN_ATTENTE', 'statut initial EN_ATTENTE')
    r.expect('un employe n\'approuve pas', w.req('bob', 'PATCH', f"/api/media-plans/{mid}/approve?managerId={E('bob')}")[0], 403)
    r.expect('voir tous les media plans ne permet pas d\'approuver', w.req('alice', 'PATCH', f"/api/media-plans/{mid}/approve?managerId={E('carol')}")[0], 403)
    r.expect('voir tous les media plans ne permet pas de desapprouver', w.req('alice', 'PATCH', f'/api/media-plans/{mid}/disapprove')[0], 403)
    c, j = w.req('admin', 'PATCH', f"/api/media-plans/{mid}/approve?managerId={E('carol')}")
    r.check(c == 200 and data_of(j)['statut'] == 'APPROUVE', 'le droit Valider les medias plans approuve (managerId fourni ignore)')
    c, j = w.req('alice', 'PATCH', f'/api/media-plans/{mid}/request-client-validation')
    r.check(c == 200 and data_of(j)['statut'] == 'EN_ATTENTE_CLIENT', 'envoi a la validation du client')

    r.section('Validation par le client (et isolement entre clients)')
    def B(method, path, body=None):
        return call(method, path, tok_b, body)[0]
    r.expect("le client B n'approuve pas le plan de A", B('PATCH', f'/api/media-plans/{mid}/client-approve'), 403)
    r.expect("le client B n'ecrit pas de rectifs sur le plan de A", B('PATCH', f'/api/media-plans/{mid}/rectifs', {'rectifs': 'x'}), 403)
    r.expect("le client B n'approuve pas en lot le plan de A", B('POST', '/api/media-plans/client-approve-all', [mid]), 403)
    c, j = call('GET', f'/api/media-plans/client/{cid_a}', tok_a)
    r.check(c == 200 and any(x['id'] == mid for x in data_of(j)), 'le client A voit son plan')
    c, j = call('PATCH', f'/api/media-plans/{mid}/client-approve', tok_a)
    r.check(c == 200 and data_of(j)['statut'] == 'APPROUVE', 'le client A approuve')

    r.section('Desapprobation, rectifs, resoumission')
    c, j = w.req('alice', 'POST', '/api/media-plans', {**mp, 'titre': 'Post 2'})
    m2 = data_of(j)['id']
    w.media_plans.append(m2)
    w.req('admin', 'PATCH', f'/api/media-plans/{m2}/approve')
    w.req('alice', 'PATCH', f'/api/media-plans/{m2}/request-client-validation')
    c, j = call('PATCH', f'/api/media-plans/{m2}/client-disapprove', tok_a)
    r.check(c == 200 and data_of(j)['statut'] == 'DESAPPROUVE', 'le client A desapprouve')
    r.expect('le client A ajoute des rectifs', call('PATCH', f'/api/media-plans/{m2}/rectifs', tok_a, {'rectifs': 'changer la couleur'})[0], 200)
    r.expect('le client A cree un rectif externe',
             call('POST', f'/api/reactifs/mediaplan-extern/{m2}?clientId={cid_b}', tok_a, {'contenu': 'changer la couleur'})[0], 200)
    c, j = w.req('alice', 'GET', f'/api/reactifs/by-mediaplan/{m2}')
    rect = data_of(j) if c == 200 else []
    r.check(rect and all(x.get('clientId') in (cid_a, None) for x in rect),
            "le rectif est rattache au client connecte (le clientId fourni dans l'URL est ignore)")
    r.expect('resoumission', w.req('alice', 'PATCH', f'/api/media-plans/{m2}/resubmit')[0], 200)

    r.section('Tournage et Head Prod')
    shoot = {**mp, 'titre': 'Shooting', 'isShooting': True, 'shootingDescription': 'Tournage produit',
             'shootingLocalisation': 'Studio', 'shootingDate': workday(25), 'shootingTypeDeContenu': 'PHOTO'}
    c, j = w.req('alice', 'POST', '/api/media-plans', shoot)
    r.expect('creation d\'un plan avec tournage', c, 200, msg_of(j))
    sid = data_of(j)['id']
    w.media_plans.append(sid)
    # le serveur previent UN Head Prod (le premier trouve) : on compte chez tous ceux qui ont ce role
    c, j = w.req('admin', 'GET', '/api/employes/by-role/Head%20Prod')
    head_ids = [x['id'] for x in data_of(j)] if c == 200 else [E('dave')]

    def notifs():
        return sum(len(data_of(w.req('admin', 'GET', f'/api/notifications/employe/{i}')[1]) or []) for i in head_ids)

    avant = notifs()
    c, j = w.req('admin', 'PATCH', f'/api/media-plans/{sid}/approve')
    r.expect("approbation d'un plan avec tournage", c, 200, msg_of(j))
    r.check(notifs() > avant, 'un Head Prod recoit une notification de validation du tournage')
    c, j = w.req('dave', 'GET', f"/api/notifications/employe/{E('dave')}")
    r.expect('dave lit ses notifications', c, 200)
    c, j = w.req('dave', 'GET', f'/api/calendrier-projets/between?startDate={workday(1)}&endDate={workday(60)}')
    r.check(c == 200 and isinstance(data_of(j), list), 'calendrier de tournage lisible (avec un creneau existant)')

    r.section('Suppression')
    r.expect('un employe ne supprime pas un media plan', w.req('bob', 'DELETE', f'/api/media-plans/{m2}')[0], 403)
    r.expect('le manager supprime un plan avec rectifs', w.req('alice', 'DELETE', f'/api/media-plans/{m2}')[0], 200)
    r.expect('le manager supprime un plan avec creneau de tournage', w.req('alice', 'DELETE', f'/api/media-plans/{sid}')[0], 200)
