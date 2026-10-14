"""Media plans : creation, validation interne, validation client, rectifs, tournage (manager Production), suppression."""
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

    r.section('Tournage et manager du departement Production')
    c, j = w.req('admin', 'GET', f"/api/employes/{E('dave')}")
    dave = data_of(j)
    dave['departement'] = 'Production'
    dave['managerDepartement'] = True
    c, j = w.req('admin', 'PUT', f"/api/employes/{E('dave')}", dave)
    r.expect('dave est designe manager du departement Production', c, 200, msg_of(j))
    r.check(data_of(j).get('managerDepartement') is True, 'la case manager du departement est enregistree')

    def notif_count(who):
        return len(data_of(w.req('admin', 'GET', f"/api/notifications/employe/{E(who)}")[1]) or [])

    shoot = {**mp, 'titre': 'Shooting', 'isShooting': True, 'shootingDescription': 'Tournage produit',
             'shootingLocalisation': 'Studio', 'shootingAuPlusTard': workday(25),
             'clientDoitValiderDate': False, 'shootingTypeDeContenu': 'PHOTO'}
    c, j = w.req('alice', 'POST', '/api/media-plans', shoot)
    r.expect('creation d\'un plan avec tournage', c, 200, msg_of(j))
    sid = data_of(j)['id']
    w.media_plans.append(sid)
    avant = notif_count('dave')
    c, j = w.req('admin', 'PATCH', f'/api/media-plans/{sid}/approve')
    r.expect("approbation d'un plan avec tournage", c, 200, msg_of(j))
    if c != 200:
        return
    r.check(data_of(j).get('shootingStatus') == 'EN_ATTENTE_DATE', 'le shooting attend une date de la Production')
    r.check(notif_count('dave') > avant, 'le manager Production recoit la demande de date')
    r.expect('alice ne peut pas poser la date',
             w.req('alice', 'PATCH', f'/api/media-plans/{sid}/shooting-date', {'date': workday(20)})[0], 400)
    r.expect('une date apres la limite est refusee',
             w.req('dave', 'PATCH', f'/api/media-plans/{sid}/shooting-date', {'date': workday(40)})[0], 400)
    c, j = w.req('dave', 'PATCH', f'/api/media-plans/{sid}/shooting-date', {'date': workday(20)})
    r.expect('le manager Production pose la date', c, 200, msg_of(j))
    r.check(data_of(j).get('shootingStatus') == 'VALIDE', 'sans validation client, la date est valide tout de suite')
    c, j = w.req('dave', 'GET', f'/api/calendrier-projets/between?startDate={workday(1)}&endDate={workday(60)}')
    r.check(c == 200 and isinstance(data_of(j), list), 'calendrier de tournage lisible')

    shoot_client = {**shoot, 'titre': 'Shooting client', 'shootingAuPlusTard': workday(50), 'clientDoitValiderDate': True}
    c, j = w.req('alice', 'POST', '/api/media-plans', shoot_client)
    r.expect('creation d\'un tournage a faire valider par le client', c, 200, msg_of(j))
    sid2 = data_of(j)['id']
    w.media_plans.append(sid2)
    c, j = w.req('admin', 'PATCH', f'/api/media-plans/{sid2}/approve')
    r.expect('approbation du tournage a valider', c, 200, msg_of(j))
    avant_alice = notif_count('alice')
    c, j = w.req('dave', 'PATCH', f'/api/media-plans/{sid2}/shooting-date', {'date': workday(30)})
    r.expect('la Production propose une date', c, 200, msg_of(j))
    r.check(data_of(j).get('shootingStatus') == 'EN_ATTENTE_CLIENT_DATE', 'la date attend le client')
    r.check(notif_count('alice') > avant_alice, 'l employe est prevenu pour verifier avec le client')
    r.expect('un autre employe ne confirme pas la date',
             w.req('bob', 'PATCH', f'/api/media-plans/{sid2}/shooting-date-confirm', {'accepte': False})[0], 400)
    c, j = w.req('alice', 'PATCH', f'/api/media-plans/{sid2}/shooting-date-confirm', {'accepte': False})
    r.expect('l employe refuse la date proposee', c, 200, msg_of(j))
    r.check(data_of(j).get('shootingStatus') == 'EN_ATTENTE_DATE', 'le shooting retourne a la Production')
    c, j = w.req('dave', 'PATCH', f'/api/media-plans/{sid2}/shooting-date', {'date': workday(31)})
    r.expect('la Production propose une autre date', c, 200, msg_of(j))
    c, j = w.req('alice', 'PATCH', f'/api/media-plans/{sid2}/shooting-date-confirm', {'accepte': True})
    r.expect('l employe accepte la nouvelle date', c, 200, msg_of(j))
    r.check(data_of(j).get('shootingStatus') == 'VALIDE', 'la date confirmee est valide')

    r.section('Acceptation et refus ligne par ligne')
    c, j = w.req('alice', 'POST', '/api/media-plans', {**mp, 'titre': 'Ligne a accepter'})
    ok_id = data_of(j)['id']
    w.media_plans.append(ok_id)
    c, j = w.req('alice', 'POST', '/api/media-plans', {**mp, 'titre': 'Ligne a refuser'})
    no_id = data_of(j)['id']
    w.media_plans.append(no_id)
    r.expect('voir tous ne permet pas d accepter une ligne',
             w.req('alice', 'PATCH', f'/api/media-plans/{ok_id}/accept', {'champs': ['titre']})[0], 403)
    r.expect('accepter sans champ visible est refuse',
             w.req('admin', 'PATCH', f'/api/media-plans/{ok_id}/accept', {'champs': []})[0], 400)
    c, j = w.req('admin', 'PATCH', f'/api/media-plans/{ok_id}/accept', {'champs': ['titre', 'platforme']})
    r.expect('la ligne acceptee part chez le client', c, 200, msg_of(j))
    r.check(data_of(j).get('statut') == 'EN_ATTENTE_CLIENT', 'statut en attente client')
    r.check(data_of(j).get('champsVisiblesClient') == 'titre,platforme', 'seuls les champs choisis sont visibles')
    r.expect('refuser sans rectifs est refuse',
             w.req('admin', 'PATCH', f'/api/media-plans/{no_id}/refuse', {'rectifs': '   '})[0], 400)
    avant_refus = notif_count('alice')
    c, j = w.req('admin', 'PATCH', f'/api/media-plans/{no_id}/refuse', {'rectifs': 'changer le titre'})
    r.expect('la ligne est refusee avec des rectifs', c, 200, msg_of(j))
    r.check(data_of(j).get('statut') == 'DESAPPROUVE' and data_of(j).get('rectifs') == 'changer le titre',
            'les rectifs restent sur cette ligne')
    r.check(notif_count('alice') > avant_refus, 'le createur est prevenu du refus')

    r.section('Assignation reservee a la validation')
    body = {'clientId': cid_a, 'employeIds': [E('bob')]}
    r.expect('voir tous ne permet pas d assigner un client',
             w.req('alice', 'POST', '/api/media-plan-assignments', body)[0], 403)
    c, j = w.req('admin', 'POST', '/api/media-plan-assignments', body)
    r.expect('le validateur assigne le client', c, 200, msg_of(j))
    aid = data_of(j)[0]['id']
    r.expect('voir tous ne retire pas l assignation',
             w.req('alice', 'DELETE', f'/api/media-plan-assignments/{aid}')[0], 403)
    r.expect('le validateur retire l assignation',
             w.req('admin', 'DELETE', f'/api/media-plan-assignments/{aid}')[0], 200)

    r.section('Suppression')
    r.expect('un employe ne supprime pas un media plan', w.req('bob', 'DELETE', f'/api/media-plans/{m2}')[0], 403)
    r.expect('le manager supprime un plan avec rectifs', w.req('alice', 'DELETE', f'/api/media-plans/{m2}')[0], 200)
    r.expect('le manager supprime un plan avec creneau de tournage', w.req('alice', 'DELETE', f'/api/media-plans/{sid}')[0], 200)
