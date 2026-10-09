"""Outils communs des tests : appels HTTP, connexion, comptage des verifications.

Aucune dependance externe : Python 3.9+ suffit.
"""
import datetime
import json
import os
import urllib.error
import urllib.request
import uuid

API = os.environ.get('API_URL', 'http://localhost:8080').rstrip('/')
ADMIN_USER = os.environ.get('ADMIN_USER', 'admin')
ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD', 'Admin@123')
TEST_PASSWORD = 'TestMdp123!'


def call(method, path, token=None, body=None, raw=None, ctype='application/json'):
    """Appelle l'API. Retourne (code_http, json_ou_texte)."""
    data = raw if raw is not None else (json.dumps(body).encode() if body is not None else None)
    req = urllib.request.Request(API + path, method=method, data=data)
    if data is not None:
        req.add_header('Content-Type', ctype)
    if token:
        req.add_header('Authorization', 'Bearer ' + token)
    try:
        resp = urllib.request.urlopen(req, timeout=60)
        code, text = resp.status, resp.read().decode(errors='replace')
    except urllib.error.HTTPError as e:
        code, text = e.code, e.read().decode(errors='replace')
    except Exception as e:  # serveur injoignable
        return 0, str(e)
    try:
        return code, json.loads(text)
    except ValueError:
        return code, text


def data_of(j):
    """Contenu utile d'une reponse (enveloppe ApiResponse ou liste brute)."""
    return j['data'] if isinstance(j, dict) and 'data' in j else j


def msg_of(j):
    return str(j.get('message')) if isinstance(j, dict) else str(j)[:120]


def login(username, password):
    code, j = call('POST', '/api/auth/login', body={'username': username, 'password': password})
    return code, (j.get('data') if isinstance(j, dict) else None)


def multipart(fields, files=None):
    """Corps multipart/form-data. files = {nom_champ: (nom_fichier, type_mime, octets)}."""
    boundary = '----t' + uuid.uuid4().hex
    out = b''
    for k, v in fields.items():
        out += f'--{boundary}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode()
    for k, (fname, mime, content) in (files or {}).items():
        out += (f'--{boundary}\r\nContent-Disposition: form-data; name="{k}"; filename="{fname}"\r\n'
                f'Content-Type: {mime}\r\n\r\n').encode() + content + b'\r\n'
    out += f'--{boundary}--\r\n'.encode()
    return out, 'multipart/form-data; boundary=' + boundary


def workday(days_ahead):
    """Premier jour ouvre (lundi-vendredi) a au moins `days_ahead` jours d'aujourd'hui, au format AAAA-MM-JJ."""
    d = datetime.date.today() + datetime.timedelta(days=days_ahead)
    while d.weekday() >= 5:
        d += datetime.timedelta(days=1)
    return d.isoformat()


def midweek(days_ahead):
    """Premier mardi/mercredi/jeudi a au moins `days_ahead` jours (regle metier : un conge d'un seul vendredi doit etre sans solde)."""
    d = datetime.date.today() + datetime.timedelta(days=days_ahead)
    while d.weekday() not in (1, 2, 3):
        d += datetime.timedelta(days=1)
    return d.isoformat()


def saturday(days_ahead):
    d = datetime.date.today() + datetime.timedelta(days=days_ahead)
    while d.weekday() != 5:
        d += datetime.timedelta(days=1)
    return d.isoformat()


class Report:
    """Compte les verifications reussies / echouees."""

    def __init__(self):
        self.ok = 0
        self.fail = 0
        self.skipped = 0
        self.failures = []
        self.suite = ''

    def section(self, title):
        print(f'\n--- {title}')

    def check(self, good, text):
        if good:
            self.ok += 1
        else:
            self.fail += 1
            self.failures.append(f'[{self.suite}] {text}')
        print(('  OK    ' if good else '  ECHEC ') + text)

    def skip(self, text):
        self.skipped += 1
        print('  (ignore) ' + text)

    def expect(self, label, got, expected, extra=''):
        good = (got in expected) if isinstance(expected, (list, tuple, set)) else got == expected
        self.check(good, f'{label} -> {got} (attendu {expected}) {extra if not good else ""}'.strip())
        return good
