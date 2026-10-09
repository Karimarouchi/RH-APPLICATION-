import { LoginResponse } from '../types';
import { setSharedCookie } from '../hooks/useTheme';

const USER_STORAGE_KEY = 'user';
const LOGIN_TIME_STORAGE_KEY = 'loginTime';
const RELAY_PREFIX = 'antigone-auth-relay:';

export const SESSION_DURATION_MS = 4 * 60 * 60 * 1000;

type AuthSnapshot = {
  user: LoginResponse;
  loginTime: number;
};

// Preferences d'affichage transportees lors du passage RH <-> Projets (origines differentes)
export type RelayPrefs = { theme?: string; font?: string; fontSize?: string };

const hasExpiredToken = (user: LoginResponse): boolean => {
  if (!user.tokenExpiresAt) return false;
  const expiresAt = Date.parse(user.tokenExpiresAt);
  if (Number.isNaN(expiresAt)) return false;
  return Date.now() >= expiresAt;
};

const toBase64 = (value: string): string => {
  try {
    const bytes = new TextEncoder().encode(value);
    const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');
    return btoa(binary);
  } catch {
    return '';
  }
};

const fromBase64 = (value: string): string | null => {
  try {
    const binary = atob(value);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
};

const isExpired = (loginTime: number): boolean => {
  if (!Number.isFinite(loginTime)) return true;
  return Date.now() - loginTime >= SESSION_DURATION_MS;
};

const clearLocalStorageSnapshot = (): void => {
  localStorage.removeItem(USER_STORAGE_KEY);
  localStorage.removeItem(LOGIN_TIME_STORAGE_KEY);
};

const readFromLocalStorage = (): AuthSnapshot | null => {
  const storedUser = localStorage.getItem(USER_STORAGE_KEY);
  const storedLoginTime = localStorage.getItem(LOGIN_TIME_STORAGE_KEY);
  if (!storedUser || !storedLoginTime) return null;

  try {
    const parsedUser = JSON.parse(storedUser) as LoginResponse;
    const parsedLoginTime = Number(storedLoginTime);
    if (isExpired(parsedLoginTime) || hasExpiredToken(parsedUser)) return null;
    return { user: parsedUser, loginTime: parsedLoginTime };
  } catch {
    return null;
  }
};

const persistToLocalStorage = (snapshot: AuthSnapshot): void => {
  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(snapshot.user));
  localStorage.setItem(LOGIN_TIME_STORAGE_KEY, String(snapshot.loginTime));
};

const parseRelaySnapshot = (): AuthSnapshot | null => {
  if (!window.name.startsWith(RELAY_PREFIX)) return null;

  const encodedSnapshot = window.name.slice(RELAY_PREFIX.length);
  if (!encodedSnapshot) return null;

  try {
    const decodedSnapshot = fromBase64(encodedSnapshot);
    if (!decodedSnapshot) return null;

    const parsedSnapshot = JSON.parse(decodedSnapshot) as AuthSnapshot;
    if (!parsedSnapshot || !parsedSnapshot.user) return null;
    if (isExpired(Number(parsedSnapshot.loginTime)) || hasExpiredToken(parsedSnapshot.user)) return null;

    return {
      user: parsedSnapshot.user,
      loginTime: Number(parsedSnapshot.loginTime),
    };
  } catch {
    return null;
  }
};

// Lit les preferences d'affichage du relais sans le consommer
export const peekRelayPrefs = (): RelayPrefs | null => {
  if (!window.name.startsWith(RELAY_PREFIX)) return null;
  try {
    const decoded = fromBase64(window.name.slice(RELAY_PREFIX.length));
    if (!decoded) return null;
    const prefs = (JSON.parse(decoded) as { prefs?: RelayPrefs }).prefs;
    return prefs ?? null;
  } catch {
    return null;
  }
};

const applyRelayPrefs = (prefs: RelayPrefs | null): void => {
  if (!prefs) return;
  const entries: Array<[string, string | undefined]> = [
    ['theme', prefs.theme],
    ['app-font', prefs.font],
    ['app-font-size', prefs.fontSize],
  ];
  for (const [key, value] of entries) {
    if (!value) continue;
    localStorage.setItem(key, value);
    setSharedCookie(key, value);
  }
};

const clearRelaySnapshot = (): void => {
  if (window.name.startsWith(RELAY_PREFIX)) {
    window.name = '';
  }
};

const writeRelaySnapshot = (snapshot: AuthSnapshot | null): void => {
  const prefs: RelayPrefs = {
    theme: document.documentElement.classList.contains('dark') ? 'dark' : 'light',
    font: localStorage.getItem('app-font') ?? undefined,
    fontSize: localStorage.getItem('app-font-size') ?? undefined,
  };
  const encodedSnapshot = toBase64(JSON.stringify({ ...(snapshot ?? {}), prefs }));
  if (!encodedSnapshot) return;

  window.name = `${RELAY_PREFIX}${encodedSnapshot}`;
};

const consumeRelaySnapshot = (): AuthSnapshot | null => {
  const snapshot = parseRelaySnapshot();
  applyRelayPrefs(peekRelayPrefs());
  clearRelaySnapshot();
  return snapshot;
};

const getLatestSnapshot = (): AuthSnapshot | null => {
  const fromRelay = consumeRelaySnapshot();
  if (fromRelay) {
    persistToLocalStorage(fromRelay);
    return fromRelay;
  }

  const fromStorage = readFromLocalStorage();
  if (fromStorage) return fromStorage;

  clearLocalStorageSnapshot();
  return null;
};

export const saveAuthSnapshot = (user: LoginResponse): void => {
  const snapshot: AuthSnapshot = {
    user,
    loginTime: Date.now(),
  };

  persistToLocalStorage(snapshot);
};

export const relayAuthSnapshotForSwitch = (): void => {
  // Sans session (page de login), on transmet quand meme theme et police
  writeRelaySnapshot(getLatestSnapshot());
};

/** Met a jour les donnees de l'utilisateur sans toucher a l'heure de connexion (la session n'est pas prolongee). */
export const updateAuthUser = (user: LoginResponse): void => {
  try {
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  } catch {
    /* stockage indisponible */
  }
};

export const clearAuthSnapshot = (): void => {
  clearLocalStorageSnapshot();
  clearRelaySnapshot();
};

export const getAuthSnapshot = (): AuthSnapshot | null => {
  return getLatestSnapshot();
};

export const getAccessToken = (): string | null => {
  const snapshot = getLatestSnapshot();
  return snapshot?.user.token ?? null;
};
