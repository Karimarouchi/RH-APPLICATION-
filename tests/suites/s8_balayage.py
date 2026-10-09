"""Balayage : appelle toutes les routes de lecture (GET) en admin et verifie qu'aucune ne plante (erreur 5xx)."""
import glob
import os
import re

from lib import call

CONTROLLERS = os.path.join(os.path.dirname(__file__), '..', '..', 'Backend', 'src', 'main', 'java', 'com', 'antigone', 'rh', 'controller')


def run(w):
    r = w.r
    r.section('Toutes les routes GET en admin : aucune erreur serveur')
    files = sorted(glob.glob(os.path.join(CONTROLLERS, '*.java')))
    if not files:
        r.skip('sources des controleurs introuvables : balayage ignore')
        return
    bad, n = [], 0
    for f in files:
        s = open(f, encoding='utf-8', errors='replace').read()
        base = (re.search(r'@RequestMapping\("([^"]*)"\)', s) or [None, ''])[1]
        for m in re.finditer(r'@GetMapping(?:\(([^)]*)\))?', s):
            p = re.search(r'"([^"]*)"', m.group(1) or '')
            path = re.sub(r'\{[^}]*\}', '1', base + (p.group(1) if p else ''))
            code, j = call('GET', path, w.admin)
            n += 1
            if code >= 500 or code == 0:
                bad.append(f'{path} -> {code}')
    r.check(n > 50, f'{n} routes GET appelees')
    r.check(not bad, 'aucune erreur 5xx' + (' : ' + '; '.join(bad[:5]) if bad else ''))
