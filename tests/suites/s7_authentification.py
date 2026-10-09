"""Authentification : mot de passe, blocage anti-force-brute, jetons, comptes desactives."""
from lib import TEST_PASSWORD, call, data_of, login, msg_of


def run(w):
    r = w.r
    # compte dedie : le blocage ne touche jamais les autres utilisateurs de test
    erin = w.new_employee('erin', 'TEST_EMPLOYE')
    w.extra_accounts.append((erin['cid'], erin['eid']))
    w.users.pop('erin')  # evite le double nettoyage

    r.section('Regles du mot de passe')
    cid, tok, user = erin['cid'], erin['token'], erin['username']
    c, j = call('PUT', f'/api/comptes/{cid}/password', tok, {'oldPassword': TEST_PASSWORD, 'newPassword': 'abc'})
    r.check(c == 400 and '8 caract' in msg_of(j), 'mot de passe de moins de 8 caracteres refuse')
    r.expect('nouveau identique a l\'ancien refuse', call('PUT', f'/api/comptes/{cid}/password', tok, {'oldPassword': TEST_PASSWORD, 'newPassword': TEST_PASSWORD})[0], 400)
    r.expect('ancien mot de passe faux refuse', call('PUT', f'/api/comptes/{cid}/password', tok, {'oldPassword': 'faux', 'newPassword': 'NouveauMdp1'})[0], 400)
    r.expect('changement valide', call('PUT', f'/api/comptes/{cid}/password', tok, {'oldPassword': TEST_PASSWORD, 'newPassword': 'NouveauMdp1'})[0], 200)
    r.expect('connexion avec le nouveau mot de passe', login(user, 'NouveauMdp1')[0], 200)
    r.expect("l'ancien mot de passe ne fonctionne plus", login(user, TEST_PASSWORD)[0], 400)

    r.section('Jetons et acces anonymes')
    r.expect('sans jeton : refuse', call('GET', '/api/projets')[0], 401)
    r.expect('jeton invalide : refuse', call('GET', '/api/projets', 'abc.def.ghi')[0], 401)
    r.expect('/api/auth/forgot-password ne revele pas si l\'email existe',
             call('POST', '/api/auth/forgot-password', None, {'email': 'inconnu@example.test'})[0], 200)
    r.expect('reinitialisation avec un faux jeton refusee', call('POST', '/api/auth/reset-password', None, {'token': 'faux', 'newPassword': 'Abcdefg1'})[0], 400)

    r.section('Compte desactive')
    r.expect('l\'admin desactive le compte', call('PATCH', f'/api/comptes/{cid}/toggle', w.admin)[0], 200)
    c, d = login(user, 'NouveauMdp1')
    r.expect('un compte desactive ne se connecte plus', c, 400)
    call('PATCH', f'/api/comptes/{cid}/toggle', w.admin)  # reactive pour le test suivant

    r.section('Guide de premiere connexion')
    c, d = login(user, 'NouveauMdp1')
    r.check(c == 200 and d.get('toursVus') == [], "un nouveau compte n'a vu aucun guide (toursVus vide)")
    r.expect('marquer le guide RH comme vu', call('POST', '/api/auth/tour-vu?app=rh', d['token'])[0], 200)
    c, d = login(user, 'NouveauMdp1')
    r.check(c == 200 and d.get('toursVus') == ['rh'], 'le serveur se souvient : toursVus = [rh]')
    call('POST', '/api/auth/tour-vu?app=rh', d['token'])
    call('POST', '/api/auth/tour-vu?app=projets', d['token'])
    c, d = login(user, 'NouveauMdp1')
    r.check(sorted(d.get('toursVus', [])) == ['projets', 'rh'], 'pas de doublon, les deux guides memorises')
    r.expect('application inconnue refusee', call('POST', '/api/auth/tour-vu?app=autre', d['token'])[0], 400)
    r.expect('sans jeton refuse', call('POST', '/api/auth/tour-vu?app=rh')[0], 401)

    r.section('Anti force brute (10 echecs / 15 minutes)')
    codes = [login(user, f'mauvais{i}')[0] for i in range(12)]
    r.check(codes[:9] == [400] * 9 and 429 in codes[9:], f'blocage (429) apres une serie d\'echecs : {codes}')
    r.expect('meme le bon mot de passe est bloque pendant la fenetre', login(user, 'NouveauMdp1')[0], 429)
    r.expect('un autre utilisateur n\'est pas affecte', login(w.users['carol']['username'], TEST_PASSWORD)[0], 200)
