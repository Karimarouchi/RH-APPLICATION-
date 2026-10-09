// Teste le guide de premiere connexion dans un vrai navigateur, pour chaque profil de test et chaque application :
// ouverture automatique, parcours complet avec « Suivant », memorisation, non reapparition, relance par le bouton « ? ».
// Prerequis : `python tests/run_all.py --keep` (cree les utilisateurs, ecrits dans tests/.state.json).
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const API = process.env.API_URL || 'http://localhost:8080';
const APPS = {
  rh: process.env.RH_URL || 'http://rh.localhost:8083',
  projets: process.env.PROJECT_URL || 'http://project.localhost:8083',
};
const stateFile = path.join(here, '..', '.state.json');
if (!fs.existsSync(stateFile)) {
  console.error('tests/.state.json introuvable : lancez d\'abord `python tests/run_all.py --keep`.');
  process.exit(2);
}
const { users } = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
const shotsDir = process.env.SHOTS_DIR; // optionnel : dossier de captures d'ecran

const login = async (u, p) => (await (await fetch(API + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: u, password: p }),
})).json()).data;

const browser = await chromium.launch();
let failures = 0;
const check = (ok, text) => { if (!ok) failures++; console.log((ok ? '  OK    ' : '  ECHEC ') + text); };

for (const [who, creds] of Object.entries(users)) {
  for (const [app, origin] of Object.entries(APPS)) {
    const data = await login(creds.username, creds.password);
    if (!data) { check(false, `${who}/${app}: connexion impossible`); continue; }
    if ((data.toursVus || []).includes(app)) { console.log(`  (ignore) ${who}/${app}: guide deja vu par ce compte`); continue; }
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    await page.addInitScript(([u]) => {
      localStorage.setItem('user', JSON.stringify(u));
      localStorage.setItem('loginTime', String(Date.now()));
    }, [data]);
    await page.goto(origin + '/dashboard', { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
    const dlg = page.locator('[role=dialog][aria-label="Guide de l\'application"]');
    const opened = await dlg.isVisible({ timeout: 5000 }).catch(() => false);
    check(opened, `${who}/${app}: le guide s'ouvre tout seul a la premiere connexion`);
    const titles = [];
    if (opened) {
      for (let i = 0; i < 40; i++) {
        titles.push((await dlg.locator('h2').innerText()).trim());
        if (shotsDir) { fs.mkdirSync(shotsDir, { recursive: true }); await page.screenshot({ path: path.join(shotsDir, `${who}-${app}-${String(i + 1).padStart(2, '0')}.png`) }); }
        const next = dlg.getByRole('button', { name: /Suivant|Terminer/ });
        const label = (await next.innerText()).trim();
        await next.click();
        await page.waitForTimeout(400);
        if (label.startsWith('Terminer')) break;
      }
      check(titles.length >= 3 && /pr[eê]t|tout/i.test(titles[titles.length - 1]), `${who}/${app}: ${titles.length} etapes parcourues jusqu'a la fin`);
      const closed = await dlg.waitFor({ state: 'hidden', timeout: 3000 }).then(() => true).catch(() => false);
      check(closed, `${who}/${app}: le guide se ferme apres « Terminer »`);
    }
    await page.reload({ waitUntil: 'networkidle' }).catch(() => {});
    check(!(await dlg.isVisible({ timeout: 2500 }).catch(() => false)), `${who}/${app}: ne reapparait pas apres rechargement`);
    const after = await login(creds.username, creds.password);
    check((after.toursVus || []).includes(app), `${who}/${app}: le serveur a memorise que le guide est vu`);
    await page.getByRole('button', { name: /Ouvrir le guide/ }).click().catch(() => {});
    check(await dlg.isVisible({ timeout: 2000 }).catch(() => false), `${who}/${app}: le bouton « ? » relance le guide`);
    await ctx.close();
  }
}
await browser.close();
console.log(failures ? `\n${failures} verification(s) en echec` : '\nGuide : tout est OK');
process.exit(failures ? 1 : 0);
