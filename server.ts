import express from 'express';
import fs from 'fs';
import { createServer } from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';
import dotenv from 'dotenv';
import {
  INITIAL_APPS,
  buildAndroidMediaIntent,
  parseLocalVoiceCommand,
  ConnectionTopology,
} from './src/utils/carLogic.ts';
import { getCompleteAndroidProjectFiles } from './src/utils/androidProjectGenerator.ts';
import { createZipBuffer, ZipEntryInput } from './src/utils/zipBuilder.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface WhatsAppMessageItem {
  id: string;
  senderName: string;
  senderRole: string;
  text: string;
  timestamp: string;
  unread: boolean;
  repliedText?: string;
}

export interface ServerBridgeState {
  topology: ConnectionTopology;
  pairingPin: string;
  isPhoneConnected: boolean;
  phoneDeviceName: string;
  phoneBatteryLevel: number;
  phoneCharging: boolean;
  phoneHotspotActive: boolean;
  networkSsid: string;
  tabletIpAddress: string;
  vehicleSpeedKmh: number;
  gpsLocation: { lat: number; lng: number; label: string };
  whatsappMessages: WhatsAppMessageItem[];
}

const authoritativeState: ServerBridgeState = {
  topology: 'tablet_wifi_router',
  pairingPin: '8492',
  isPhoneConnected: true,
  phoneDeviceName: 'Pixel 9 Pro (Bluetooth + Wi-Fi Direct)',
  phoneBatteryLevel: 86,
  phoneCharging: false,
  phoneHotspotActive: false,
  networkSsid: 'AutoDrive-Tablet-5GHz',
  tabletIpAddress: '192.168.43.1:3000',
  vehicleSpeedKmh: 0,
  gpsLocation: {
    lat: 41.9028,
    lng: 12.4964,
    label: 'Rilevamento GPS in corso...',
  },
  whatsappMessages: [
    {
      id: 'wa-101',
      senderName: 'Marco Rossi',
      senderRole: 'WhatsApp · 2 min fa',
      text: 'Ciao! A che punto sei? Ti aspettiamo davanti all’ingresso principale.',
      timestamp: '18:42',
      unread: true,
    },
    {
      id: 'wa-102',
      senderName: 'Elena (Casa)',
      senderRole: 'WhatsApp · 9 min fa',
      text: 'Quando torni riesci a passare a prendere il pane? Guida con prudenza!',
      timestamp: '18:35',
      unread: true,
    },
    {
      id: 'wa-103',
      senderName: 'Gruppo Calcetto Giovedì',
      senderRole: 'WhatsApp Gruppo · 24 min fa',
      text: 'Campo prenotato per le 21:00 al Centro Sportivo Nord.',
      timestamp: '18:20',
      unread: false,
    },
  ],
};

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function startServer() {
  const app = express();
  app.use(express.json());

  const httpServer = createServer(app);
  const wss = new WebSocketServer({ noServer: true });
  const hmrWss = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', (request, socket, head) => {
    const pathname = request.url ? request.url.split('?')[0] : '';
    if (pathname === '/ws') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    } else {
      // Accept Vite HMR / client WebSocket probes cleanly so @vite/client never throws "WebSocket closed without opened"
      hmrWss.handleUpgrade(request, socket, head, (ws) => {
        ws.send(JSON.stringify({ type: 'connected' }));
      });
    }
  });

  function broadcast(event: string, payload: unknown) {
    const msg = JSON.stringify({ event, payload });
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(msg);
      }
    });
  }

  wss.on('connection', (ws) => {
    ws.send(
      JSON.stringify({
        event: 'bridge:init',
        payload: authoritativeState,
      })
    );

    ws.on('message', (rawBuffer) => {
      try {
        const data = JSON.parse(rawBuffer.toString());
        const { event, payload } = data;

        if (event === 'bridge:set_topology' && payload?.topology) {
          authoritativeState.topology = payload.topology;
          authoritativeState.phoneHotspotActive = payload.topology === 'legacy_zlink_hotspot';
          authoritativeState.phoneCharging = payload.topology === 'usb_cable_aoa';
          authoritativeState.networkSsid =
            payload.topology === 'tablet_wifi_router'
              ? 'AutoDrive-Tablet-5GHz'
              : payload.topology === 'bluetooth_pan'
              ? 'BT-PAN-LowEnergy'
              : payload.topology === 'usb_cable_aoa'
              ? 'USB-AOA-Direct-Link'
              : 'Hotspot-Smartphone (ZLink Mode)';
          broadcast('bridge:state_updated', authoritativeState);
        } else if (event === 'whatsapp:send_from_phone' && payload?.senderName && payload?.text) {
          const msgId = payload.id || `wa-${Date.now()}`;
          const exists = authoritativeState.whatsappMessages.some((m) => m.id === msgId);
          if (!exists) {
            const newMsg: WhatsAppMessageItem = {
              id: msgId,
              senderName: String(payload.senderName).trim(),
              senderRole: 'WhatsApp · Adesso',
              text: String(payload.text).trim(),
              timestamp: new Date().toLocaleTimeString('it-IT', {
                hour: '2-digit',
                minute: '2-digit',
              }),
              unread: true,
            };
            authoritativeState.whatsappMessages = [
              newMsg,
              ...authoritativeState.whatsappMessages,
            ];
            broadcast('whatsapp:message_created', {
              message: newMsg,
              state: authoritativeState,
            });
          }
        } else if (event === 'whatsapp:reply' && payload?.id && payload?.replyText) {
          authoritativeState.whatsappMessages = authoritativeState.whatsappMessages.map((m) =>
            m.id === payload.id
              ? { ...m, unread: false, repliedText: String(payload.replyText).trim() }
              : m
          );
          broadcast('bridge:state_updated', authoritativeState);
        } else if (event === 'whatsapp:mark_read' && payload?.id) {
          authoritativeState.whatsappMessages = authoritativeState.whatsappMessages.map((m) =>
            m.id === payload.id ? { ...m, unread: false } : m
          );
          broadcast('bridge:state_updated', authoritativeState);
        } else if (event === 'bridge:update_telemetry') {
          if (typeof payload?.phoneBatteryLevel === 'number') {
            authoritativeState.phoneBatteryLevel = Math.max(
              1,
              Math.min(100, payload.phoneBatteryLevel)
            );
          }
          if (typeof payload?.vehicleSpeedKmh === 'number') {
            authoritativeState.vehicleSpeedKmh = Math.max(
              0,
              Math.min(220, payload.vehicleSpeedKmh)
            );
          }
          if (payload?.gpsLocation) {
            authoritativeState.gpsLocation = payload.gpsLocation;
          }
          broadcast('bridge:state_updated', authoritativeState);
        }
      } catch (err) {
        console.error('WebSocket message error:', err);
      }
    });
  });

  // REST API for Bridge State
  app.get('/api/bridge/state', (_req, res) => {
    res.json(authoritativeState);
  });

  // Hybrid Voice Assistant API (Gemini Cloud Stage with automatic local fallback metadata)
  app.post('/api/voice/intent', async (req, res) => {
    const { transcript, defaultMusicAppId, installedApps } = req.body ?? {};
    const appsList = Array.isArray(installedApps) && installedApps.length > 0 ? installedApps : INITIAL_APPS;
    const defaultMusicApp =
      appsList.find((a: { id: string }) => a.id === defaultMusicAppId) ||
      appsList.find((a: { id: string }) => a.id === 'metrolist') ||
      INITIAL_APPS[0];

    if (!transcript || typeof transcript !== 'string') {
      res.status(400).json({ error: 'Transcript mancante' });
      return;
    }

    const ai = getGeminiClient();
    if (!ai) {
      // Automatic fallback to deterministic local parser on server if API key is not configured
      const fallbackParsed = parseLocalVoiceCommand(transcript, defaultMusicApp, appsList);
      res.json({
        engineUsed: 'local_offline',
        autoSwitched: true,
        switchReason: 'Chiave Gemini non presente: comando elaborato dal motore locale offline',
        command: fallbackParsed,
      });
      return;
    }

    try {
      const musicAppNames = appsList
        .filter((a: { category: string }) => a.category === 'music')
        .map((a: { id: string; name: string; packageName: string }) => `${a.name} (id: ${a.id}, pkg: ${a.packageName})`)
        .join(', ');

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: `Comando vocale automobilista: "${transcript}".
App musicale predefinita: ${defaultMusicApp.name} (id: ${defaultMusicApp.id}, pkg: ${defaultMusicApp.packageName}).
App musicali installate: ${musicAppNames}.`,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          systemInstruction:
            'Sei il motore vocale di bordo di AutoDrive Tablet OS su Android. ' +
            'Interpreta il comando vocale in italiano e restituisci un JSON conforme allo schema. ' +
            'Azioni consentite: PLAY_MEDIA, NEXT_TRACK, PREV_TRACK, PAUSE_MEDIA, RESUME_MEDIA, NAVIGATE_TO, READ_MESSAGES, REPLY_MESSAGE, SWITCH_MAP_MODE. ' +
            'Rispondi in modo conciso e sicuro per chi guida.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              action: {
                type: Type.STRING,
                description:
                  'One of PLAY_MEDIA, NEXT_TRACK, PREV_TRACK, PAUSE_MEDIA, RESUME_MEDIA, NAVIGATE_TO, READ_MESSAGES, REPLY_MESSAGE, SWITCH_MAP_MODE, UNKNOWN',
              },
              query: {
                type: Type.STRING,
                description: 'Brano o artista richiesto se PLAY_MEDIA',
              },
              targetAppId: {
                type: Type.STRING,
                description: 'ID app musicale target (es. metrolist, vlc, spotify, poweramp)',
              },
              destination: {
                type: Type.STRING,
                description: 'Indirizzo o città di destinazione se NAVIGATE_TO',
              },
              recipient: {
                type: Type.STRING,
                description: 'Destinatario WhatsApp se REPLY_MESSAGE',
              },
              replyText: {
                type: Type.STRING,
                description: 'Testo della risposta WhatsApp se REPLY_MESSAGE',
              },
              mapMode: {
                type: Type.STRING,
                description: 'google_live oppure offline_vector se SWITCH_MAP_MODE',
              },
              spokenResponse: {
                type: Type.STRING,
                description: 'Frase breve in italiano pronunciata dal sintetizzatore vocale di bordo',
              },
            },
            required: ['action', 'spokenResponse'],
          },
        },
      });

      const parsedJson = JSON.parse((response.text ?? '{}').trim());
      const targetApp =
        appsList.find((a: { id: string }) => a.id === parsedJson.targetAppId) || defaultMusicApp;

      let androidIntentUri = '';
      if (parsedJson.action === 'PLAY_MEDIA') {
        androidIntentUri = buildAndroidMediaIntent(
          targetApp,
          'PLAY_SEARCH',
          parsedJson.query || transcript
        );
      } else if (parsedJson.action === 'NEXT_TRACK') {
        androidIntentUri = buildAndroidMediaIntent(targetApp, 'NEXT');
      } else if (parsedJson.action === 'PREV_TRACK') {
        androidIntentUri = buildAndroidMediaIntent(targetApp, 'PREV');
      } else if (parsedJson.action === 'PAUSE_MEDIA') {
        androidIntentUri = buildAndroidMediaIntent(targetApp, 'PAUSE');
      } else if (parsedJson.action === 'NAVIGATE_TO' && parsedJson.destination) {
        androidIntentUri = `google.navigation:q=${encodeURIComponent(parsedJson.destination)}&mode=d`;
      }

      res.json({
        engineUsed: 'gemini_cloud',
        autoSwitched: false,
        command: {
          action: parsedJson.action || 'UNKNOWN',
          rawTranscript: transcript,
          query: parsedJson.query,
          targetAppId: targetApp.id,
          targetAppName: targetApp.name,
          targetPackage: targetApp.packageName,
          destination: parsedJson.destination,
          recipient: parsedJson.recipient,
          replyText: parsedJson.replyText,
          mapMode: parsedJson.mapMode,
          androidIntentUri,
          spokenResponse: parsedJson.spokenResponse || 'Comando eseguito.',
          confidence: 0.99,
        },
      });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      const localFallback = parseLocalVoiceCommand(transcript, defaultMusicApp, appsList);
      res.json({
        engineUsed: 'local_offline',
        autoSwitched: true,
        switchReason: `Gemini API non raggiungibile o quota esaurita (${errorMessage.slice(0, 60)}): switch automatico al Motore Locale Offline`,
        command: localFallback,
      });
    }
  });

  // Helper to recursively read directory files for packaging
  function collectFilesFromDir(dirAbsPath: string, zipPrefix: string): ZipEntryInput[] {
    const results: ZipEntryInput[] = [];
    if (!fs.existsSync(dirAbsPath)) return results;
    const items = fs.readdirSync(dirAbsPath, { withFileTypes: true });
    for (const item of items) {
      const fullPath = path.join(dirAbsPath, item.name);
      const relZipPath = path.posix.join(zipPrefix, item.name);
      if (item.isDirectory()) {
        results.push(...collectFilesFromDir(fullPath, relZipPath));
      } else if (item.isFile()) {
        results.push({
          path: relZipPath,
          content: fs.readFileSync(fullPath),
        });
      }
    }
    return results;
  }

  // 1) Download Complete Android Native Project + Web Source (.zip)
  app.get('/api/apk/download-project-zip', (_req, res) => {
    try {
      const entries: ZipEntryInput[] = [];

      // Add root project files
      const rootFiles = ['package.json', 'tsconfig.json', 'vite.config.ts', 'index.html', 'metadata.json'];
      for (const rf of rootFiles) {
        const full = path.join(__dirname, rf);
        if (fs.existsSync(full)) {
          entries.push({ path: rf, content: fs.readFileSync(full) });
        }
      }

      // Add src/ and public/
      entries.push(...collectFilesFromDir(path.join(__dirname, 'src'), 'src'));
      entries.push(...collectFilesFromDir(path.join(__dirname, 'public'), 'public'));

      // If dist/ exists, include it both in dist/ and in android/app/src/main/assets/public/
      const distDir = path.join(__dirname, 'dist');
      if (fs.existsSync(distDir)) {
        entries.push(...collectFilesFromDir(distDir, 'dist'));
        entries.push(
          ...collectFilesFromDir(distDir, 'android/app/src/main/assets/public')
        );
      }

      // Add complete native Android Gradle project files + GitHub Actions APK compiler
      const androidFiles = getCompleteAndroidProjectFiles();
      for (const af of androidFiles) {
        entries.push({ path: af.path, content: af.content });
      }

      // Add Italian README instructions
      entries.push({
        path: 'COME-OTTENERE-IL-FILE-APK.md',
        content: `# AutoDrive Tablet OS — Guida Rapida per Ottenere il File .APK

Questo archivio contiene **l'intero progetto nativo Android (Gradle + Java + Web Bundle Offline)**.

### Metodo A: Compilazione Automatica su GitHub (Senza installare nulla sul PC/Telefono)
1. Crea un nuovo repository su [GitHub.com](https://github.com/new) e carica tutti i file di questo ZIP.
2. Vai nella scheda **Actions** del tuo repository GitHub: partirà in automatico il workflow **Build AutoDrive Android APK**.
3. Dopo circa 90 secondi, troverai il file **AutoDrive-Tablet-OS.apk** già firmato e pronto da scaricare nella sezione **Releases** (o sotto *Artifacts*).
4. Scarica **AutoDrive-Tablet-OS.apk** sul tuo telefono o tablet Android e toccalo per installarlo!

### Metodo B: Compilazione Locale con Android Studio
1. Apri la cartella \`android/\` in **Android Studio**.
2. Clicca su **Build → Build Bundle(s) / APK(s) → Build APK(s)**.
`,
      });

      const zipBuf = createZipBuffer(entries);
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Length', String(zipBuf.length));
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader(
        'Content-Disposition',
        'attachment; filename="AutoDrive-Tablet-OS-Android-Complete.zip"'
      );
      res.end(zipBuf);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // 2) Download Single-File Standalone Offline App (AutoDrive-Tablet-OS-Standalone.html)
  // Runs 100% outside AI Studio so Chrome/Android never shows the AI Studio wrapper
  app.get('/api/apk/download-standalone-html', (_req, res) => {
    try {
      const distAssetsDir = path.join(__dirname, 'dist', 'assets');
      let cssInline = '';
      let jsInline = '';

      if (fs.existsSync(distAssetsDir)) {
        const assetFiles = fs.readdirSync(distAssetsDir);
        for (const f of assetFiles) {
          if (f.endsWith('.css')) {
            cssInline += fs.readFileSync(path.join(distAssetsDir, f), 'utf-8') + '\n';
          } else if (f.endsWith('.js') && !f.includes('workbox')) {
            jsInline += fs.readFileSync(path.join(distAssetsDir, f), 'utf-8') + '\n';
          }
        }
      }

      const standaloneHtml = `<!doctype html>
<html lang="it" class="dark">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
    <meta name="theme-color" content="#090D16" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="mobile-web-app-capable" content="yes" />
    <title>AutoDrive Tablet OS (Standalone)</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400..700;1,9..40,400..700&family=JetBrains+Mono:wght@500;600;700&family=Plus+Jakarta+Sans:wght@600;700;800&display=swap" rel="stylesheet" />
    <style>${cssInline}</style>
  </head>
  <body class="bg-[#090D16] text-slate-100 antialiased selection:bg-blue-500 selection:text-white overflow-x-hidden">
    <div id="root"></div>
    <script type="module">
${jsInline}
    </script>
  </body>
</html>`;

      const htmlBuf = Buffer.from(standaloneHtml, 'utf-8');
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Content-Length', String(htmlBuf.length));
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader(
        'Content-Disposition',
        'attachment; filename="AutoDrive-Tablet-OS-Standalone.html"'
      );
      res.end(htmlBuf);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // 3) 1-Click GitHub Cloud APK Builder (Creates GitHub Repo, Pushes Pre-Built Native Android Project, Triggers GitHub Actions APK Build)
  app.post('/api/apk/github-cloud-build', async (req, res) => {
    const { githubToken, repoName } = req.body ?? {};
    const cleanToken = String(githubToken || '').trim();
    const cleanRepo = String(repoName || 'autodrive-tablet-os')
      .trim()
      .replace(/[^a-zA-Z0-9._-]/g, '-');

    if (!cleanToken) {
      res.status(400).json({
        error: 'Inserisci un Personal Access Token di GitHub (con permessi repo e workflow).',
      });
      return;
    }

    const ghHeaders = {
      Authorization: `Bearer ${cleanToken}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'User-Agent': 'AutoDrive-Tablet-OS-APK-Builder',
    };

    try {
      // Step 1: Verify GitHub user
      const userResp = await fetch('https://api.github.com/user', {
        headers: ghHeaders,
      });
      if (!userResp.ok) {
        res.status(401).json({
          error: 'Token GitHub non valido o scaduto. Verifica di aver selezionato i permessi "repo" e "workflow".',
        });
        return;
      }
      const userData = (await userResp.json()) as { login: string };
      const owner = userData.login;

      // Step 2: Create repo if it doesn't exist (auto_init: true so default branch exists)
      const checkRepo = await fetch(`https://api.github.com/repos/${owner}/${cleanRepo}`, {
        headers: ghHeaders,
      });
      if (checkRepo.status === 404) {
        const createResp = await fetch('https://api.github.com/user/repos', {
          method: 'POST',
          headers: ghHeaders,
          body: JSON.stringify({
            name: cleanRepo,
            description: 'AutoDrive Tablet OS — Native Android Automotive Infotainment APK',
            private: false,
            auto_init: true,
          }),
        });
        if (!createResp.ok) {
          const errText = await createResp.text();
          res.status(400).json({
            error: `Impossibile creare il repository su GitHub: ${errText.slice(0, 120)}`,
          });
          return;
        }
        // Wait briefly for GitHub initial commit
        await new Promise((r) => setTimeout(r, 1500));
      }

      // Step 3: Get latest commit SHA on default branch
      const repoInfoResp = await fetch(`https://api.github.com/repos/${owner}/${cleanRepo}`, {
        headers: ghHeaders,
      });
      const repoInfo = (await repoInfoResp.json()) as { default_branch?: string };
      const branch = repoInfo.default_branch || 'main';

      const refResp = await fetch(
        `https://api.github.com/repos/${owner}/${cleanRepo}/git/ref/heads/${branch}`,
        { headers: ghHeaders }
      );
      if (!refResp.ok) {
        res.status(400).json({
          error: 'Il repository GitHub non ha ancora un branch principale inizializzato.',
        });
        return;
      }
      const refData = (await refResp.json()) as { object: { sha: string } };
      const baseCommitSha = refData.object.sha;

      // Step 4: Collect all source, public, native Android, and pre-built dist assets for the commit tree
      const treeItems: Array<{
        path: string;
        mode: '100644';
        type: 'blob';
        content: string;
      }> = [];

      const textRootFiles = [
        'package.json',
        'tsconfig.json',
        'vite.config.ts',
        'index.html',
        'metadata.json',
        'server.ts',
      ];
      for (const rf of textRootFiles) {
        const full = path.join(__dirname, rf);
        if (fs.existsSync(full)) {
          treeItems.push({
            path: rf,
            mode: '100644',
            type: 'blob',
            content: fs.readFileSync(full, 'utf-8'),
          });
        }
      }

      function addTextDirToTree(dirAbs: string, prefix: string) {
        if (!fs.existsSync(dirAbs)) return;
        for (const entry of fs.readdirSync(dirAbs, { withFileTypes: true })) {
          const full = path.join(dirAbs, entry.name);
          const rel = path.posix.join(prefix, entry.name);
          if (entry.isDirectory()) {
            addTextDirToTree(full, rel);
          } else if (
            entry.isFile() &&
            /\.(ts|tsx|js|css|html|json|svg|md|xml|gradle|properties|java|yml|webmanifest|txt)$/i.test(
              entry.name
            )
          ) {
            treeItems.push({
              path: rel,
              mode: '100644',
              type: 'blob',
              content: fs.readFileSync(full, 'utf-8'),
            });
          }
        }
      }

      addTextDirToTree(path.join(__dirname, 'src'), 'src');
      addTextDirToTree(path.join(__dirname, 'public'), 'public');

      // Embed pre-compiled dist/ directly into android/app/src/main/assets/public so Gradle can build the APK immediately without failing on npm build
      if (fs.existsSync(path.join(__dirname, 'dist', 'index.html'))) {
        addTextDirToTree(
          path.join(__dirname, 'dist'),
          'android/app/src/main/assets/public'
        );
      }

      for (const af of getCompleteAndroidProjectFiles()) {
        treeItems.push({
          path: af.path,
          mode: '100644',
          type: 'blob',
          content: af.content,
        });
      }

      // Create Git Tree
      const treeResp = await fetch(
        `https://api.github.com/repos/${owner}/${cleanRepo}/git/trees`,
        {
          method: 'POST',
          headers: ghHeaders,
          body: JSON.stringify({
            base_tree: baseCommitSha,
            tree: treeItems,
          }),
        }
      );
      if (!treeResp.ok) {
        const errBody = await treeResp.text();
        res.status(400).json({
          error: `Errore durante il caricamento dei file su GitHub (verifica che il token abbia sia il permesso "repo" sia "workflow"): ${errBody.slice(0, 140)}`,
        });
        return;
      }
      const treeData = (await treeResp.json()) as { sha: string };

      // Create Commit
      const commitResp = await fetch(
        `https://api.github.com/repos/${owner}/${cleanRepo}/git/commits`,
        {
          method: 'POST',
          headers: ghHeaders,
          body: JSON.stringify({
            message: 'Build AutoDrive Tablet OS Native Android APK (Zero-Dependency SDK 34)',
            tree: treeData.sha,
            parents: [baseCommitSha],
          }),
        }
      );
      const commitData = (await commitResp.json()) as { sha: string };

      // Update branch ref
      await fetch(
        `https://api.github.com/repos/${owner}/${cleanRepo}/git/refs/heads/${branch}`,
        {
          method: 'PATCH',
          headers: ghHeaders,
          body: JSON.stringify({
            sha: commitData.sha,
            force: true,
          }),
        }
      );

      // Explicitly trigger workflow_dispatch in case branch force-update did not trigger push workflow
      try {
        await fetch(
          `https://api.github.com/repos/${owner}/${cleanRepo}/actions/workflows/release-apk.yml/dispatches`,
          {
            method: 'POST',
            headers: ghHeaders,
            body: JSON.stringify({ ref: branch }),
          }
        );
      } catch {
        // Ignore if push event already started the workflow
      }

      res.json({
        success: true,
        owner,
        repo: cleanRepo,
        branch,
        repoUrl: `https://github.com/${owner}/${cleanRepo}`,
        actionsUrl: `https://github.com/${owner}/${cleanRepo}/actions`,
        releasesUrl: `https://github.com/${owner}/${cleanRepo}/releases`,
      });
    } catch (err) {
      res.status(500).json({
        error: `Errore di rete verso GitHub: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  });

  // 4) Live GitHub Actions & Release APK Polling Endpoint (Prevents user from hitting empty /releases page before build finishes)
  app.get('/api/apk/github-status', async (req, res) => {
    const owner = String(req.query.owner || '').trim();
    const repo = String(req.query.repo || '').trim();
    const token = String(req.query.token || '').trim();

    if (!owner || !repo) {
      res.status(400).json({ error: 'Parametri owner e repo mancanti.' });
      return;
    }

    const ghHeaders: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'AutoDrive-Tablet-OS-APK-Status',
    };
    if (token) {
      ghHeaders.Authorization = `Bearer ${token}`;
    }

    try {
      const [runsResp, releaseResp] = await Promise.all([
        fetch(`https://api.github.com/repos/${owner}/${repo}/actions/runs?per_page=1`, {
          headers: ghHeaders,
        }),
        fetch(`https://api.github.com/repos/${owner}/${repo}/releases/latest`, {
          headers: ghHeaders,
        }),
      ]);

      let runStatus = 'queued';
      let runConclusion: string | null = null;
      let runHtmlUrl = `https://github.com/${owner}/${repo}/actions`;

      if (runsResp.ok) {
        const runsData = (await runsResp.json()) as {
          workflow_runs?: Array<{
            status: string;
            conclusion: string | null;
            html_url: string;
          }>;
        };
        const latestRun = runsData.workflow_runs?.[0];
        if (latestRun) {
          runStatus = latestRun.status;
          runConclusion = latestRun.conclusion;
          runHtmlUrl = latestRun.html_url;
        }
      }

      let releaseReady = false;
      let apkDownloadUrl = '';
      let releaseHtmlUrl = `https://github.com/${owner}/${repo}/releases`;
      let releaseTag = '';

      if (releaseResp.ok) {
        const relData = (await releaseResp.json()) as {
          tag_name?: string;
          html_url?: string;
          assets?: Array<{ name: string; browser_download_url: string }>;
        };
        if (relData.html_url) {
          releaseHtmlUrl = relData.html_url;
        }
        if (relData.tag_name) {
          releaseTag = relData.tag_name;
        }
        const apkAsset = relData.assets?.find((a) => a.name.endsWith('.apk'));
        if (apkAsset?.browser_download_url) {
          releaseReady = true;
          apkDownloadUrl = apkAsset.browser_download_url;
        }
      }

      res.json({
        runStatus,
        runConclusion,
        runHtmlUrl,
        releaseReady,
        apkDownloadUrl,
        releaseHtmlUrl,
        releaseTag,
      });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const PORT = Number(process.env.PORT) || 3000;
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`AutoDrive Tablet OS Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
