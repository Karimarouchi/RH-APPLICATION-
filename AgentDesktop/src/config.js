// Configuration de l'agent - stockée localement après login
const { safeStorage } = require('electron');
const Store = require('electron-store');

const TOKEN_ENCRYPTED_KEY = 'tokenEncrypted';
const TOKEN_FALLBACK_KEY = 'tokenFallback';
const CREDS_ENCRYPTED_KEY = 'credsPasswordEncrypted';
const CREDS_FALLBACK_KEY = 'credsPasswordFallback';

const store = new Store({
  name: 'antigone-rh-agent-config',
  defaults: {
    serverUrl: 'https://rh.antigoneinterne.agency',
    employeId: null,
    username: null,
    // Config récupérée du serveur
    popupIntervalleHeures: 2,
    popupTimeoutSecondes: 60,
    inactiviteToleranceMinutesJour: 30,
    reseauEntrepriseIp: '192.168.1.0/24',
    reseauEntrepriseSsid: '',
    toleranceRetardMinutes: 10,
    heureDebutTravail: '09:00',
    heureFinTravail: '18:00',
    pauseDebutMidi: null,
    pauseFinMidi: null,
    joursTravail: 'LUNDI,MARDI,MERCREDI,JEUDI,VENDREDI',
    joursFeries: [],          // ['2026-01-01', '2026-05-01', ...]
    lastConfigFetchDate: null, // 'YYYY-MM-DD' — pour fetch 1x/jour
    // État
    isLoggedIn: false,
    clockedIn: false,
    lastHeartbeat: null,
    lastConfigRefresh: null
  }
});

// Mapping jours français -> numéro JS (0=Dimanche, 1=Lundi...)
const JOURS_MAP = {
  'DIMANCHE': 0, 'LUNDI': 1, 'MARDI': 2, 'MERCREDI': 3,
  'JEUDI': 4, 'VENDREDI': 5, 'SAMEDI': 6
};

/**
 * Vérifie si on est dans les horaires de travail (jour + heure).
 * Prend en compte :
 *   - les jours de travail configurés
 *   - les jours fériés (liste synchronisée depuis le serveur)
 *   - la pause déjeuner (on continue à heartbeater, mais isWorkingTime = false pendant la pause)
 *   - une marge de 30 min après la fin de shift pour le clock-out automatique
 */
function isWorkingTime() {
  const now = new Date();
  const currentDay = now.getDay(); // 0=Dim, 1=Lun...

  // 1. Vérifier le jour de travail
  const joursTravail = store.get('joursTravail') || 'LUNDI,MARDI,MERCREDI,JEUDI,VENDREDI';
  const joursArray = joursTravail.split(',').map(j => j.trim().toUpperCase());
  const joursNumeros = joursArray.map(j => JOURS_MAP[j]).filter(n => n !== undefined);
  if (!joursNumeros.includes(currentDay)) return false;

  // 2. Vérifier les jours fériés
  const joursFeries = store.get('joursFeries') || [];
  const todayStr = now.toISOString().slice(0, 10); // 'YYYY-MM-DD'
  if (joursFeries.includes(todayStr)) return false;

  // 3. Vérifier l'heure de travail
  const heureDebut = store.get('heureDebutTravail') || '09:00';
  const heureFin = store.get('heureFinTravail') || '18:00';
  const [debutH, debutM] = heureDebut.split(':').map(Number);
  const [finH, finM] = heureFin.split(':').map(Number);
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const debutMinutes = debutH * 60 + (debutM || 0);
  const finMinutes = finH * 60 + (finM || 0);

  // Hors horaires
  if (currentMinutes < debutMinutes || currentMinutes > finMinutes + 30) return false;

  // 4. Vérifier la pause déjeuner (optionnel)
  const pauseDebut = store.get('pauseDebutMidi');
  const pauseFin = store.get('pauseFinMidi');
  if (pauseDebut && pauseFin) {
    const [pdH, pdM] = pauseDebut.split(':').map(Number);
    const [pfH, pfM] = pauseFin.split(':').map(Number);
    const pdMin = pdH * 60 + (pdM || 0);
    const pfMin = pfH * 60 + (pfM || 0);
    if (currentMinutes >= pdMin && currentMinutes < pfMin) return false;
  }

  return true;
}

function get(key) {
  if (key === 'token') {
    return getToken();
  }
  return store.get(key);
}

function set(key, value) {
  if (key === 'token') {
    setToken(value);
    return;
  }
  store.set(key, value);
}

function getAll() {
  return store.store;
}

function clear() {
  store.clear();
}

function isLoggedIn() {
  return store.get('isLoggedIn') && store.get('employeId') && !!getToken();
}

function clearSession() {
  store.set('isLoggedIn', false);
  store.set('clockedIn', false);
  store.set('employeId', null);
  store.set('username', null);
  store.set('nom', null);
  store.set('prenom', null);
  store.delete(TOKEN_ENCRYPTED_KEY);
  store.delete(TOKEN_FALLBACK_KEY);
  // Les credentials (savedUsername, credsPassword*) sont conservés volontairement
  // pour permettre la reconnexion automatique silencieuse après expiration du token
}

function getToken() {
  const encrypted = store.get(TOKEN_ENCRYPTED_KEY);
  if (encrypted && safeStorage.isEncryptionAvailable()) {
    try {
      return safeStorage.decryptString(Buffer.from(encrypted, 'base64'));
    } catch {
      store.delete(TOKEN_ENCRYPTED_KEY);
    }
  }
  return store.get(TOKEN_FALLBACK_KEY) || null;
}

function setToken(value) {
  if (!value) {
    store.delete(TOKEN_ENCRYPTED_KEY);
    store.delete(TOKEN_FALLBACK_KEY);
    return;
  }

  if (safeStorage.isEncryptionAvailable()) {
    const encrypted = safeStorage.encryptString(String(value)).toString('base64');
    store.set(TOKEN_ENCRYPTED_KEY, encrypted);
    store.delete(TOKEN_FALLBACK_KEY);
    return;
  }

  store.set(TOKEN_FALLBACK_KEY, String(value));
}

function saveCredentials(username, password) {
  if (!username || !password) return;
  store.set('savedUsername', username);
  if (safeStorage.isEncryptionAvailable()) {
    const encrypted = safeStorage.encryptString(String(password)).toString('base64');
    store.set(CREDS_ENCRYPTED_KEY, encrypted);
    store.delete(CREDS_FALLBACK_KEY);
  } else {
    store.set(CREDS_FALLBACK_KEY, String(password));
  }
}

function getCredentials() {
  const username = store.get('savedUsername');
  if (!username) return null;
  const encrypted = store.get(CREDS_ENCRYPTED_KEY);
  if (encrypted && safeStorage.isEncryptionAvailable()) {
    try {
      const password = safeStorage.decryptString(Buffer.from(encrypted, 'base64'));
      return { username, password };
    } catch {
      store.delete(CREDS_ENCRYPTED_KEY);
    }
  }
  const fallback = store.get(CREDS_FALLBACK_KEY);
  if (fallback) return { username, password: fallback };
  return null;
}

module.exports = { get, set, getAll, clear, clearSession, isLoggedIn, isWorkingTime, saveCredentials, getCredentials };
