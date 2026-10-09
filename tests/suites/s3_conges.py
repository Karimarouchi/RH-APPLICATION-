"""Conges, autorisations, teletravail : regles metier et validation (qui peut approuver quoi)."""
from lib import call, data_of, msg_of, midweek, saturday, workday


def solde(w, who):
    c, j = w.req('admin', 'GET', f"/api/employes/{w.eid(who)}")
    return data_of(j)['soldeConge']


def run(w):
    r = w.r
    E = w.eid

    def conge(who, debut, fin, owner=None, typ='CONGE_PAYE', by=None):
        return w.req(by or who, 'POST', '/api/demandes', {
            'type': 'CONGE', 'typeConge': typ, 'dateDebut': debut, 'dateFin': fin, 'raison': 'test auto',
            'employeId': E(owner or who)})

    r.section('Regles de calcul et de saisie')
    d1 = midweek(30)
    c, j = w.req('bob', 'GET', f'/api/demandes/calculate-days?dateDebut={d1}&dateFin={d1}&typeConge=CONGE_PAYE')
    r.check(c == 200 and data_of(j)['nombreJours'] == 1, 'calcul : 1 jour ouvre = 1 jour')
    c, j = w.req('bob', 'GET', '/api/demandes/calculate-days')
    r.expect('parametres manquants -> 400 (et non 500)', c, 400)
    c, j = conge('bob', workday(1), workday(15))
    r.check(c == 400 and 'avance' in msg_of(j), 'conge de 2 semaines commence demain : preavis non respecte, refuse')
    c, j = conge('bob', midweek(40), midweek(35))
    r.expect('date de fin avant le debut refusee', c, 400, msg_of(j))
    sat = saturday(30)
    c, j = conge('bob', sat, sat)
    r.check(c == 400 and 'jour ouvrable' in msg_of(j), 'conge sur un week-end seul : message clair (pas d\'erreur interne)')
    c, j = conge('bob', midweek(400), midweek(460))
    r.expect('conge superieur au solde refuse', c, 400, msg_of(j))

    r.section('Cycle d\'une demande : creation, approbation, solde')
    s0 = solde(w, 'bob')
    c, j = conge('bob', d1, d1)
    r.expect('bob cree un conge', c, 200, msg_of(j))
    did = data_of(j)['id']
    r.check(data_of(j)['statut'] == 'EN_ATTENTE', 'statut initial EN_ATTENTE')
    c, j = conge('bob', d1, d1)
    r.expect('chevauchement avec un conge existant refuse', c, 400, msg_of(j))
    r.expect("bob n'approuve pas son propre conge",
             w.req('bob', 'PATCH', f"/api/demandes/{did}/approve?adminEmployeId={E('bob')}")[0], 403)
    r.expect("bob ne peut pas usurper l'identite de carol",
             w.req('bob', 'PATCH', f"/api/demandes/{did}/approve?adminEmployeId={E('carol')}")[0], 403)
    r.expect('bob ne refuse pas non plus', w.req('bob', 'PATCH', f"/api/demandes/{did}/refuse?adminEmployeId={E('bob')}")[0], 403)
    r.expect("alice (manager) n'annule pas la demande de bob", w.req('alice', 'PATCH', f'/api/demandes/{did}/cancel')[0], 403)
    r.check(solde(w, 'bob') == s0, 'le solde n\'a pas bouge tant que rien n\'est approuve')
    c, j = w.req('carol', 'PATCH', f"/api/demandes/{did}/approve?adminEmployeId={E('bob')}")
    r.check(c == 200 and data_of(j)['statut'] == 'APPROUVEE', 'carol (RH) approuve (identifiant fourni ignore)')
    r.check(solde(w, 'bob') == s0 - 1, f'le solde de bob est debite d\'un jour ({s0} -> {solde(w, "bob")})')
    c, j = w.req('carol', 'GET', f'/api/demandes/{did}/historique')
    r.check(c == 200 and len(data_of(j)) >= 1, 'historique de la demande enregistre')
    r.expect('demande deja traitee : nouvelle approbation refusee', w.req('carol', 'PATCH', f'/api/demandes/{did}/approve')[0], 400)

    r.section('Validation par un manager, refus, annulation')
    d2 = midweek(35)
    c, j = conge('bob', d2, d2)
    did2 = data_of(j)['id']
    c, j = w.req('alice', 'PATCH', f'/api/demandes/{did2}/approve')
    r.check(c == 200 and data_of(j)['statut'] == 'APPROUVEE', 'alice (VIEW_VALIDATIONS) approuve la demande de son equipe')
    d3 = midweek(45)
    c, j = conge('alice', d3, d3)
    did3 = data_of(j)['id']
    r.expect("alice (manager) n'approuve pas SON PROPRE conge", w.req('alice', 'PATCH', f'/api/demandes/{did3}/approve')[0], 403)
    r.expect('carol (RH) approuve celui d\'alice', w.req('carol', 'PATCH', f'/api/demandes/{did3}/approve')[0], 200)
    d4 = midweek(50)
    c, j = conge('bob', d4, d4)
    did4 = data_of(j)['id']
    c, j = w.req('carol', 'PATCH', f'/api/demandes/{did4}/refuse?commentaire=pas%20possible')
    r.check(c == 200 and data_of(j)['statut'] == 'REFUSEE', 'carol refuse avec un commentaire')
    d5 = midweek(55)
    c, j = conge('bob', d5, d5)
    did5 = data_of(j)['id']
    r.expect('bob annule sa propre demande en attente', w.req('bob', 'PATCH', f'/api/demandes/{did5}/cancel')[0], 200)
    r.expect('on n\'annule pas une demande deja annulee', w.req('bob', 'PATCH', f'/api/demandes/{did5}/cancel')[0], 400)

    r.section('Usurpation et acces')
    c, j = conge('bob', midweek(60), midweek(60), owner='alice')
    r.expect("bob ne cree pas de demande au nom d'alice", c, 403)
    c, j = w.req('carol', 'POST', '/api/demandes', {'type': 'CONGE', 'typeConge': 'CONGE_PAYE', 'dateDebut': midweek(61),
                                                       'dateFin': midweek(61), 'raison': 'saisie par la RH', 'employeId': E('bob')})
    r.expect('la RH peut saisir une demande pour un employe', c, 200, msg_of(j))
    r.expect("bob ne lit pas les demandes d'alice", w.req('bob', 'GET', f"/api/demandes/employe/{E('alice')}")[0], 403)

    r.section('Autorisations et teletravail')
    day = midweek(40)
    c, j = w.req('bob', 'POST', '/api/demandes', {'type': 'AUTORISATION', 'employeId': E('bob'), 'raison': 't', 'date': day,
                                                    'heureDebut': '09:00', 'heureFin': '17:00'})
    r.expect('autorisation de 8 h refusee (limite 2 h)', c, 400, msg_of(j))
    c, j = w.req('bob', 'POST', '/api/demandes', {'type': 'AUTORISATION', 'employeId': E('bob'), 'raison': 't', 'date': day,
                                                    'heureDebut': '10:00', 'heureFin': '10:30'})
    r.expect('autorisation de 30 min acceptee', c, 200, msg_of(j))
    d = midweek(41)
    c, j = w.req('bob', 'POST', '/api/demandes', {'type': 'TELETRAVAIL', 'employeId': E('bob'), 'raison': 't',
                                                    'dateDebut': d, 'dateFin': d})
    r.expect('teletravail accepte', c, 200, msg_of(j))
