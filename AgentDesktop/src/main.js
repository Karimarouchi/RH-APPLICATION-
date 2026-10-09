// Main Process - Antigone RH Desktop Agent
// Point d'entrée de l'application Electron
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const logger = require('./logger');

// Catch uncaught errors globally
process.on('uncaughtException', (err) => {
  console.error('[Agent] UNCAUGHT ERROR:', err);
  try { dialog.showErrorBox('Agent Error', err.stack || err.message); } catch {}
});

process.on('unhandledRejection', (reason) => {
  console.error('[Agent] UNHANDLED REJECTION:', reason);
});

let loginWindow = null;
let isQuitting = false;

// Lazy-loaded modules (after app ready)
let config, api, activity, heartbeat, popupManager, trayManager;

// ========================================
// Empêcher les instances multiples
// ========================================
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  console.log('[Agent] Autre instance détectée, fermeture...');
  app.quit();
  process.exit(0);
}

app.on('second-instance', () => {
  if (loginWindow) {
    if (loginWindow.isMinimized()) loginWindow.restore();
    loginWindow.focus();
  }
});

// ========================================
// Démarrage de l'application
// ========================================
app.whenReady().then(() => {
  logger.initialize();
  console.log('[Agent] Démarrage de Antigone RH Agent v1.0');

  // Load modules after app is ready
  try {
    config = require('./config');
    api = require('./api');
    activity = require('./activity');
    heartbeat = require('./heartbeat');
    popupManager = require('./popup-manager');
    trayManager = require('./tray');
    console.log('[Agent] Tous les modules chargés');

    // Reconnexion automatique : si la session expire en arrière-plan, afficher le login
    api.authEvents.on('session-expired', () => {
      console.log('[Agent] Session expirée et reconnexion silencieuse impossible — affichage du login');
      stopServices();
      showLoginWindow();
    });
  } catch (err) {
    console.error('[Agent] Erreur chargement modules:', err);
    dialog.showErrorBox('Agent Error', 'Erreur chargement modules: ' + err.message);
    app.quit();
    return;
  }

  // Créer le tray
  try {
    trayManager.create({
      onShowLogin: showLoginWindow,
      onQuit: quitApp
    });
    console.log('[Agent] Tray créé');
  } catch (err) {
    console.error('[Agent] Erreur tray:', err);
  }

  // Setup IPC handlers
  // Postes deja installes: forcer l'URL serveur verrouillee (remplace l'ancienne IP enregistree)
  const startupRuntime = getRuntimeConfig();
  if (startupRuntime.serverUrlLocked) config.set('serverUrl', startupRuntime.serverUrl);

  setupIPC();
  popupManager.setupIPC();

  // Vérifier si déjà connecté
  if (config.isLoggedIn()) {
    console.log('[Agent] Session existante trouvée, rafraîchissement config...');
    // Rafraîchir la config serveur AVANT de démarrer les services
    api.fetchConfig().then(() => {
      console.log('[Agent] Config rafraîchie, démarrage des services...');
    }).catch((err) => {
      console.log('[Agent] Config refresh échoué (utilisation du cache):', err.message);
    }).finally(() => {
      if (config.isLoggedIn()) {
        // Session toujours valide (token non expiré ou reconnexion silencieuse réussie)
        startServices();
        trayManager.updateMenu();
        trayManager.setStatus('Connecté');
      } else if (config.getCredentials()) {
        // Session effacée MAIS credentials présents → le serveur était down lors du démarrage.
        // On démarre les services en mode dégradé : ils réessaieront dès que le serveur reviendra.
        console.log('[Agent] Serveur indisponible au démarrage — démarrage en mode dégradé avec credentials sauvegardés');
        // NE PAS restaurer la session ici : les services détecteront eux-mêmes la reprise du serveur
        // et effectueront la reconnexion silencieuse automatiquement via l'intercepteur.
        // On démarre quand même pour que le tray soit actif.
        trayManager.updateMenu();
        trayManager.setStatus('En attente du serveur...');
      }
      // Si session effacée ET aucun credential → l'événement 'session-expired' a déjà affiché le login
    });
  } else {
    showLoginWindow();
  }

  // Auto-démarrage au boot (Windows + macOS)
  try {
    const loginSettings = { openAtLogin: true, openAsHidden: true };
    if (process.platform === 'win32') {
      loginSettings.path = app.getPath('exe');
    }
    app.setLoginItemSettings(loginSettings);
  } catch (e) {
    console.log('[Agent] Auto-start setup skipped:', e.message);
  }

  console.log('[Agent] Application initialisée');
}).catch((err) => {
  console.error('[Agent] FATAL:', err);
  try { dialog.showErrorBox('Agent Fatal Error', err.stack || err.message); } catch {}
});

// ========================================
// Fenêtre de Login
// ========================================
function showLoginWindow() {
  if (loginWindow) {
    loginWindow.focus();
    return;
  }

  loginWindow = new BrowserWindow({
    width: 460,
    height: 550,
    resizable: false,
    maximizable: false,
    frame: false,
    transparent: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      devTools: !app.isPackaged
    }
  });

  loginWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  loginWindow.webContents.on('will-navigate', (event) => event.preventDefault());
  loginWindow.loadFile(path.join(__dirname, 'login.html'));

  loginWindow.once('ready-to-show', () => {
    loginWindow.show();
    loginWindow.focus();
  });

  loginWindow.on('closed', () => {
    loginWindow = null;
  });
}

// ========================================
// IPC Handlers
// ========================================
function setupIPC() {
  ipcMain.handle('agent:get-runtime-config', () => getRuntimeConfig());

  ipcMain.on('login-attempt', async (event, { serverUrl, username, password }) => {
    const runtimeConfig = getRuntimeConfig();
    const effectiveServerUrl = runtimeConfig.serverUrlLocked ? runtimeConfig.serverUrl : serverUrl;

    console.log(`[Agent] Tentative de connexion: ${username} -> ${effectiveServerUrl}`);
    config.set('serverUrl', effectiveServerUrl);

    const result = await api.login(username, password);

    if (result.success) {
      console.log('[Agent] Connexion réussie!');
      startServices();
      trayManager.updateMenu();
      trayManager.setStatus('Connecté - ' + username);
      event.reply('login-result', { success: true });

      setTimeout(() => {
        if (loginWindow && !loginWindow.isDestroyed()) {
          loginWindow.close();
        }
      }, 1500);
    } else {
      event.reply('login-result', { success: false, message: result.message });
    }
  });

  ipcMain.on('login-minimize', () => {
    if (loginWindow) loginWindow.minimize();
  });

  ipcMain.on('login-close', () => {
    if (loginWindow) loginWindow.hide();
  });
}

function getRuntimeConfig() {
  const envServerUrl = process.env.AGENT_SERVER_URL?.trim();
  const storedServerUrl = config?.get('serverUrl');
  const defaultServerUrl = app.isPackaged ? 'https://rh.antigoneinterne.agency' : 'http://localhost:8080';
  const serverUrlLocked = app.isPackaged || process.env.AGENT_LOCK_SERVER_URL === 'true';

  return {
    appVersion: app.getVersion(),
    isPackaged: app.isPackaged,
    serverUrlLocked,
    // URL verrouillee: on ignore l'ancienne URL enregistree (ex: ancienne IP) sur les postes deja installes
    serverUrl: envServerUrl || (serverUrlLocked ? defaultServerUrl : (storedServerUrl || defaultServerUrl)),
    logFilePath: logger.getLogFilePath()
  };
}

// ========================================
// Services de monitoring
// ========================================
function startServices() {
  console.log('[Agent] Démarrage des services de monitoring...');
  activity.start((isActive) => {
    console.log('[Agent] Changement activité: ' + (isActive ? 'ACTIF' : 'INACTIF'));
  });
  heartbeat.start();
  popupManager.start();
  console.log('[Agent] Tous les services sont démarrés');
}

function stopServices() {
  console.log('[Agent] Arrêt des services...');
  if (activity) activity.stop();
  if (heartbeat) heartbeat.stop();
  if (popupManager) popupManager.stop();
}

// ========================================
// Gestion de la fermeture
// ========================================
function quitApp() {
  isQuitting = true;
  // Déclenche before-quit qui gère le CLOCK_OUT et l'arrêt des services
  app.quit();
}

app.on('window-all-closed', (e) => {
  if (!isQuitting) {
    e.preventDefault(); // Rester actif dans le tray même sans fenêtres
  }
});

// macOS : clic sur l'icône dock → afficher le login si déconnecté
app.on('activate', () => {
  if (!config?.isLoggedIn()) {
    showLoginWindow();
  }
});

// Sur macOS : gérer Cmd+Q (et toute fermeture externe)
// before-quit NE supporte PAS async/await → on doit bloquer l'événement et relancer app.quit()
let beforeQuitHandled = false;
app.on('before-quit', (event) => {
  if (beforeQuitHandled) return; // Éviter la boucle infinie
  event.preventDefault();
  beforeQuitHandled = true;

  const doQuit = () => {
    stopServices();
    if (trayManager) trayManager.destroy();
    app.quit(); // Relance before-quit → cette fois beforeQuitHandled=true → passe directement
  };

  if (config && config.get('clockedIn')) {
    const network = require('./network');
    network.getNetworkInfo()
      .then(netInfo => api.sendEvent('CLOCK_OUT', netInfo.localIP, netInfo.ssid))
      .then(() => { config.set('clockedIn', false); })
      .catch(() => {})
      .finally(doQuit);
  } else {
    doQuit();
  }
});
