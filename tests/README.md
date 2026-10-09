# Tests automatiques

Ces tests vérifient que l'application fonctionne **comme un vrai utilisateur** : qui peut faire quoi, les règles de congés,
les projets, les média plans, le portail client, l'agent, la sécurité, et l'affichage de chaque écran.
À lancer **avant chaque livraison**.

> **À lancer sur un serveur de test ou en local, jamais sur les vraies données de l'entreprise.**
> Les tests créent des utilisateurs, clients, projets… (puis les nettoient), mais ils ne doivent pas toucher à votre Google Drive.
> Ils **refusent de démarrer** si le serveur visé est connecté à un Google Drive actif (voir plus bas).

## Ce qu'il faut

- Python 3.9 ou plus (aucune bibliothèque à installer).
- Le projet démarré (`docker compose up -d`), avec le compte `admin`.
- Pour les tests d'écrans (facultatif) : Node.js 18+.

## 1. Préparer un serveur de test sans Google Drive

Chaque création de client génère une cinquantaine de dossiers sur le Drive branché. Pour les tests, branchez de **faux fichiers de clés**
(ils contiennent `{}`), en laissant vos vrais fichiers dans `secrets/` :

```bash
mkdir secrets-test
echo {} > secrets-test/service-account.json
echo {} > secrets-test/client-viewer-service-account.json
```

Dans le `.env` (poste de test uniquement) :

```
SECRETS_DIR=./secrets-test
```

puis `docker compose up -d --force-recreate backend`. Vérification : `GET /api/media-plans/google-drive/status` doit répondre `false`.
(Si vous utilisez un Drive de test dédié, vous pouvez passer outre avec `ALLOW_DRIVE=1`.)

## 2. Lancer les tests de l'API

```bash
python tests/run_all.py                         # tout
python tests/run_all.py --only droits,conges    # certaines suites seulement
python tests/run_all.py --keep                  # garde les comptes de test (utile pour les tests d'écrans)
python tests/run_all.py --cleanup               # supprime les comptes laissés par --keep
```

Variables utiles :

| Variable | Défaut | Rôle |
|---|---|---|
| `API_URL` | `http://localhost:8080` | adresse du backend |
| `ADMIN_USER` / `ADMIN_PASSWORD` | `admin` / `Admin@123` | compte administrateur |
| `ALLOW_DRIVE` | (vide) | `1` = autorise un Drive actif (déconseillé) |

Le programme affiche chaque vérification (`OK` / `ECHEC`) puis un résumé. **Code de sortie 0 = tout passe**, 1 = au moins un échec
(utilisable dans une intégration continue). Compter une dizaine de minutes (chaque création de compte et de client prend un moment).

Suites :

| Suite | Ce qui est vérifié |
|---|---|
| `droits` | qui peut créer/modifier/supprimer projets, tâches, clients, employés, rôles ; salaire, RIB, CIN masqués ; notifications et demandes privées |
| `projets` | cycle d'un projet : tâches, assignation, clôture bloquée ou forcée, suppression |
| `conges` | préavis, solde, chevauchement, week-end, approbation (jamais la sienne), refus, annulation, autorisations, télétravail |
| `agent` | heartbeat, pointage, jour férié, congé du jour (ce dernier cas demande Docker pour modifier la base ; ignoré sinon) |
| `portail` | un client ne voit que ses données ; fichiers dangereux (.html, .svg) refusés |
| `mediaplan` | création, approbation, validation client, rectifs, tournage et Head Prod, suppression |
| `auth` | règles du mot de passe, comptes désactivés, guide de première connexion, blocage après 10 échecs |
| `balayage` | toutes les routes de lecture répondent sans erreur serveur |

## 3. Tester l'affichage de chaque écran (navigateur)

```bash
cd tests/e2e
npm install
npx playwright install chromium

# 1) créer les comptes de test et les garder
python ../run_all.py --keep

# 2) parcourir tous les écrans de chaque rôle, dans les 2 applications : aucune erreur d'appel ou de JavaScript
node ui.mjs

# 3) vérifier le guide de première connexion (ouverture, parcours, mémorisation, bouton « ? »)
node guide.mjs

# 4) nettoyer
python ../run_all.py --cleanup
```

Adresses utilisées (modifiables) : `API_URL=http://localhost:8080`, `RH_URL=http://rh.localhost:8083`, `PROJECT_URL=http://project.localhost:8083`
(ce sont les ports par défaut de `docker-compose.yml` ; adaptez-les à votre `.env`).
Pour garder des captures d'écran du guide : `SHOTS_DIR=./captures node guide.mjs`.

## Ajouter un test

Chaque suite est un fichier de `tests/suites/` avec une fonction `run(w)`. L'objet `w` donne des utilisateurs prêts à l'emploi
(`alice` = MANAGER, `bob` = employé simple, `carol` = RH, `dave` = Head Prod) et des outils :

```python
c, j = w.req('bob', 'POST', '/api/projets', {...})   # appel au nom de bob
r.expect('bob ne crée pas de projet', c, 403)         # vérification
```

Ajoutez la suite dans la liste `SUITES` de `run_all.py`. Gardez les tests **rejouables** : dates calculées à partir d'aujourd'hui,
données de test supprimées à la fin (`w.projets`, `w.clients`, `w.media_plans` sont nettoyés automatiquement).

## Règles métier utiles à connaître (découvertes par les tests)

- Un congé d'**un seul vendredi** doit être de type « sans solde ».
- Le préavis d'un congé augmente avec sa durée ; l'application indique la date la plus proche possible.
- Une autorisation d'absence est limitée à 2 h.
- Un employé ne peut jamais approuver ses propres demandes (sauf un administrateur).
