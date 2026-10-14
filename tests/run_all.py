#!/usr/bin/env python3
"""Lance tous les tests de l'API.

    python tests/run_all.py                      # tout
    python tests/run_all.py --only droits,conges # seulement certaines suites
    API_URL=http://localhost:8080 python tests/run_all.py

Code de sortie : 0 si tout passe, 1 sinon (utilisable en integration continue).
"""
import argparse
import importlib
import os
import sys
import time

sys.path.insert(0, os.path.dirname(__file__))

from fixtures import World  # noqa: E402
from lib import API, Report  # noqa: E402

SUITES = [
    ('droits', 'suites.s1_droits'),
    ('projets', 'suites.s2_projets'),
    ('conges', 'suites.s3_conges'),
    ('agent', 'suites.s4_agent'),
    ('portail', 'suites.s5_portail_client'),
    ('mediaplan', 'suites.s6_mediaplan'),
    ('manager', 'suites.s9_manager_departement'),
    ('auth', 'suites.s7_authentification'),
    ('balayage', 'suites.s8_balayage'),
]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--only', help='suites separees par des virgules : ' + ', '.join(n for n, _ in SUITES))
    ap.add_argument('--keep', action='store_true', help='ne pas nettoyer les donnees de test')
    ap.add_argument('--cleanup', action='store_true', help='desactive et archive les comptes laisses par --keep, puis quitte')
    args = ap.parse_args()
    wanted = set(args.only.split(',')) if args.only else {n for n, _ in SUITES}

    if args.cleanup:
        from fixtures import STATE_FILE
        from lib import ADMIN_PASSWORD, ADMIN_USER, call, login
        if not os.path.exists(STATE_FILE):
            print('Rien a nettoyer (tests/.state.json absent).')
            return
        code, d = login(ADMIN_USER, ADMIN_PASSWORD)
        if code != 200:
            raise SystemExit('Connexion admin impossible.')
        import json
        n = 0
        for u in json.load(open(STATE_FILE, encoding='utf-8'))['users'].values():
            if 'cid' in u:
                call('PATCH', f"/api/comptes/{u['cid']}/toggle", d['token'])
                call('PUT', f"/api/employes/{u['eid']}/archive", d['token'])
                n += 1
        os.remove(STATE_FILE)
        print(f'{n} comptes de test desactives et archives.')
        return

    print(f'Tests de l\'API : {API}')
    started = time.time()
    report = Report()
    world = World(report)
    world.setup()
    try:
        for name, module in SUITES:
            if name not in wanted:
                continue
            report.suite = name
            try:
                importlib.import_module(module).run(world)
            except SystemExit:
                raise
            except Exception as e:  # une suite qui plante est un echec, pas un arret
                import traceback
                traceback.print_exc()
                report.check(False, f'la suite {name} s\'est arretee sur une erreur : {e}')
    finally:
        if not args.keep:
            world.cleanup()
    print('\n' + '=' * 60)
    print(f'RESULTAT : {report.ok} reussis, {report.fail} echecs, {report.skipped} ignores  ({time.time() - started:.0f} s)')
    for f in report.failures:
        print('  ECHEC ' + f)
    sys.exit(1 if report.fail else 0)


if __name__ == '__main__':
    main()
