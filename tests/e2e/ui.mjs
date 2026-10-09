// Parcours de l'interface reelle, role par role : releve toutes les erreurs d'appel API (>= 400) et les erreurs JS.
// Prerequis : avoir lance `python tests/run_all.py --keep` (cree les utilisateurs de test, ecrits dans tests/.state.json).
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const API = process.env.API_URL || 'http://localhost:8080';
const RH_URL = process.env.RH_URL || 'http://rh.localhost:8083';
const PROJECT_URL = process.env.PROJECT_URL || 'http://project.localhost:8083';
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin@123';
const stateFile = path.join(here, '..', '.state.json');

if (!fs.existsSync(stateFile)) {
  console.error('tests/.state.json introuvable : lancez d\'abord `python tests/run_all.py --keep`.');
  process.exit(2);
}
const { users } = JSON.parse(fs.readFileSync(stateFile, 'utf8'));

const RH_ROUTES = ['dashboard', 'employes', 'employes/archives', 'organigramme', 'demandes', 'demandes/new', 'demandes/liste-papier',
  'mes-demandes', 'mes-demandes/papier', 'validations', 'referentiels', 'calendrier', 'restrictions-conges', 'mon-calendrier',
  'comptes', 'roles', 'mon-profil', 'suivi-temps-reel', 'rapports-inactivite', 'historique-agent', 'dashboard-rh', 'admin/departements'];
const PROJ_ROUTES = ['dashboard', 'accueil', 'projets', 'equipes', 'mon-profil', 'mes-taches', 'admin/calendrier-projets', 'admin/clients',
  'media-plan', 'admin/media-plans', 'rapport-projet', 'admin/dashboard-projets', 'reactifs/intern', 'reactifs/extern', 'mes-demandes', 'validations'];

async function apiLogin(username, password) {
  const r = await fetch(API + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
  return (await r.json()).data;
}

const browser = await chromium.launch();
const report = [];
const targets = [
  { app: 'RH', origin: RH_URL, routes: RH_ROUTES },
  { app: 'PROJETS', origin: PROJECT_URL, routes: PROJ_ROUTES },
];
const who = [['admin', ADMIN_USER, ADMIN_PASSWORD], ...Object.entries(users).map(([k, v]) => [k, v.username, v.password])];

for (const [label, username, password] of who) {
  const data = await apiLogin(username, password);
  if (!data) { console.log('connexion impossible pour', label); continue; }
  for (const t of targets) {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.addInitScript(([u]) => {
      localStorage.setItem('user', JSON.stringify(u));
      localStorage.setItem('loginTime', String(Date.now()));
    }, [data]);
    const errors = new Map();
    page.on('response', (resp) => {
      const url = resp.url();
      if (!url.includes('/api/')) return;
      if (resp.status() >= 400) {
        const key = `${resp.request().method()} ${url.replace(/^https?:\/\/[^/]+/, '')} -> ${resp.status()}`;
        errors.set(key, (errors.get(key) || 0) + 1);
      }
    });
    const jsErrors = [];
    page.on('pageerror', (e) => jsErrors.push(String(e).slice(0, 140)));
    for (const route of t.routes) {
      errors.clear();
      try {
        await page.goto(`${t.origin}/${route}`, { waitUntil: 'networkidle', timeout: 25000 });
      } catch (e) { /* delai reseau depasse : on releve quand meme */ }
      await page.waitForTimeout(400);
      report.push({ who: label, app: t.app, route, errors: [...errors.keys()], jsErrors: [...jsErrors] });
      jsErrors.length = 0;
    }
    await ctx.close();
  }
}
await browser.close();
fs.writeFileSync(path.join(here, 'rapport-ui.json'), JSON.stringify(report, null, 1));
const bad = report.filter((r) => r.errors.length || r.jsErrors.length);
console.log(`ecrans visites : ${report.length}`);
console.log(`ecrans avec erreur API/JS : ${bad.length}`);
for (const r of bad) console.log(`  ${r.who.padEnd(7)} ${r.app.padEnd(8)} /${r.route}  ${r.errors.join(' | ')} ${r.jsErrors.join(' | ')}`);
process.exit(bad.length ? 1 : 0);
