"""Portail client (isolement entre clients, acces limite) et televersement de fichiers."""
from lib import call, data_of, login, msg_of, multipart, workday


def make_client(w, nom, mail):
    raw, ct = multipart({'nom': nom, 'email': mail, 'createAccount': 'true', 'clientPages': 'MEDIA_PLANS,PROJETS,FICHIERS'})
    c, j = w.req('alice', 'POST', '/api/clients', raw=raw, ctype=ct)
    d = data_of(j)
    w.clients.append(d['id'])
    code, lj = call('POST', '/api/auth/client-login', body={'loginClient': d['loginClient'], 'passwordClient': d['generatedPassword']})
    return d['id'], (data_of(lj)['token'] if code == 200 else None), code


def run(w):
    r = w.r
    E = w.eid
    cid_a, tok_a, code_a = make_client(w, f'Portail A {w.run_id}', f'pa{w.run_id}@example.test')
    cid_b, tok_b, _ = make_client(w, f'Portail B {w.run_id}', f'pb{w.run_id}@example.test')
    r.expect('le client A se connecte au portail', code_a, 200)
    # un projet du client B, que A ne doit pas voir
    c, j = w.req('alice', 'POST', '/api/projets', {'nom': 'Projet de B', 'dateDebut': workday(2), 'dateFin': workday(30), 'statut': 'PLANIFIE',
                                                      'typeProjet': 'CLIENT', 'clientId': cid_b, 'chefDeProjetIds': [E('alice')],
                                                      'chefDeProjetId': E('alice'), 'createurId': E('alice')})
    p_b = data_of(j)['id']
    w.projets.append(p_b)

    def A(method, path, expect, body=None, label=''):
        c, j = call(method, path, tok_a, body)
        r.expect(f'client A {method} {path} {label}'.strip(), c, expect, msg_of(j))
        return c, j

    r.section('Le client utilise SON portail')
    A('GET', f'/api/clients/{cid_a}/client-portal-drive-link', [200, 400, 404])
    A('GET', f'/api/media-plans/client/{cid_a}', 200)
    A('GET', f'/api/projets/by-client/{cid_a}', 200)

    r.section('Le client ne peut pas sortir de son portail')
    A('GET', f'/api/media-plans/client/{cid_b}', 403, label='(autre client)')
    A('GET', f'/api/projets/by-client/{cid_b}', 403, label='(autre client)')
    A('GET', f'/api/clients/{cid_b}/drive-files', 403, label='(autre client)')
    A('GET', f'/api/taches/projet/{p_b}', 403, label='(projet d\'un autre client)')
    for path in ('/api/clients', '/api/employes', '/api/projets', '/api/comptes', '/api/media-plans', '/api/referentiels',
                 '/api/demandes', '/api/admin/dashboard'):
        A('GET', path, 403)
    A('POST', '/api/projets', 403, {'nom': 'x'})
    A('DELETE', f'/api/projets/{p_b}', 403)

    r.section('Televersement : liste blanche des extensions')

    def logo(fname, mime, content=b'x'):
        raw, ct = multipart({'nom': f'Logo {w.run_id}', 'email': f'lg{w.run_id}@example.test'}, {'logoFile': (fname, mime, content)})
        c, j = w.req('alice', 'POST', '/api/clients', raw=raw, ctype=ct)
        if c == 200:
            w.clients.append(data_of(j)['id'])
        return c, j

    c, j = logo('logo.html', 'image/png', b'<script>alert(1)</script>')
    r.expect('logo .html (type MIME falsifie) refuse', c, 400, msg_of(j))
    r.expect('logo .svg refuse', logo('logo.svg', 'image/svg+xml', b'<svg onload=alert(1)/>')[0], 400)
    r.expect('logo .png accepte', logo('logo.png', 'image/png', b'\x89PNG\r\n')[0], 200)

    def photo(fname, mime):
        bd, ct = multipart({}, {'file': (fname, mime, b'<script>alert(1)</script>')})
        return w.req('bob', 'POST', f"/api/employes/{E('bob')}/image", raw=bd, ctype=ct)

    r.expect('photo .html (type MIME falsifie) refusee', photo('evil.html', 'image/png')[0], 400)
    r.expect('photo sans extension refusee proprement', photo('sansextension', 'image/png')[0], 400)
    r.expect('photo .jpg acceptee', photo('ok.jpg', 'image/jpeg')[0], 200)
