export type AppSourceType = 'sideload_apk' | 'f_droid' | 'play_store' | 'system';

export interface MediaAppConfig {
  id: string;
  name: string;
  packageName: string;
  serviceComponent: string;
  sourceType: AppSourceType;
  category: 'music' | 'navigation' | 'messaging' | 'utility';
  supportsVoiceSearch: boolean;
  accentHex: string;
  version: string;
  description: string;
}

export interface TrackItem {
  id: string;
  title: string;
  artist: string;
  album: string;
  durationSec: number;
  appId: string;
  palette: [string, string];
}

export type VoiceMode = 'hybrid_gemini_first' | 'hybrid_local_first' | 'offline_only';
export type VoiceEngineType = 'local_offline' | 'gemini_cloud';

export interface VoiceEngineConfig {
  mode: VoiceMode;
  dailyGeminiLimit: number;
  dailyGeminiUsed: number;
}

export interface VoiceEngineResolution {
  selectedEngine: VoiceEngineType;
  autoSwitched: boolean;
  switchReason?: string;
  remainingQuota: number;
}

export type CarActionType =
  | 'PLAY_MEDIA'
  | 'NEXT_TRACK'
  | 'PREV_TRACK'
  | 'PAUSE_MEDIA'
  | 'RESUME_MEDIA'
  | 'NAVIGATE_TO'
  | 'READ_MESSAGES'
  | 'REPLY_MESSAGE'
  | 'SWITCH_MAP_MODE'
  | 'UNKNOWN';

export interface ParsedCarCommand {
  action: CarActionType;
  rawTranscript: string;
  query?: string;
  targetAppId?: string;
  targetAppName?: string;
  targetPackage?: string;
  destination?: string;
  recipient?: string;
  replyText?: string;
  mapMode?: 'google_live' | 'offline_vector';
  androidIntentUri: string;
  spokenResponse: string;
  confidence: number;
}

export type ConnectionTopology =
  | 'tablet_wifi_router'
  | 'bluetooth_pan'
  | 'usb_cable_aoa'
  | 'legacy_zlink_hotspot';

export interface BatteryImpactMetrics {
  topology: ConnectionTopology;
  label: string;
  phoneHotspotRequired: boolean;
  videoEncodingActive: boolean;
  avgDataRateKbps: number;
  batteryDrainPercentPerHour: number;
  estimatedTripDrainPercent: number;
  thermalLevel: 'Basso (31°C)' | 'Minimo (29°C)' | 'Incarica Controllata (30°C)' | 'Critico (44°C)';
  stabilityScore: number;
}

export const INITIAL_APPS: MediaAppConfig[] = [
  {
    id: 'metrolist',
    name: 'Metrolist',
    packageName: 'com.metrolist.music',
    serviceComponent: 'com.metrolist.music/.playback.MusicService',
    sourceType: 'sideload_apk',
    category: 'music',
    supportsVoiceSearch: true,
    accentHex: '#EC4899',
    version: '11.4.2-FOSS',
    description: 'Client YouTube Music open-source (GitHub APK) con supporto Media3, testi sincronizzati e cache brani offline.',
  },
  {
    id: 'vlc',
    name: 'VLC for Android',
    packageName: 'org.videolan.vlc',
    serviceComponent: 'org.videolan.vlc/.PlaybackService',
    sourceType: 'f_droid',
    category: 'music',
    supportsVoiceSearch: true,
    accentHex: '#F97316',
    version: '3.6.3',
    description: 'Player multimediale locale per cartelle FLAC/MP3 su scheda SD o chiavetta USB OTG del tablet.',
  },
  {
    id: 'spotify',
    name: 'Spotify',
    packageName: 'com.spotify.music',
    serviceComponent: 'com.spotify.music/.MainActivity',
    sourceType: 'play_store',
    category: 'music',
    supportsVoiceSearch: true,
    accentHex: '#10B981',
    version: '8.9.84',
    description: 'Streaming musicale con MediaSession standard e comandi rapidi.',
  },
  {
    id: 'poweramp',
    name: 'Poweramp',
    packageName: 'com.maxmpz.audioplayer',
    serviceComponent: 'com.maxmpz.audioplayer/.player.PlayerService',
    sourceType: 'sideload_apk',
    category: 'music',
    supportsVoiceSearch: true,
    accentHex: '#06B6D4',
    version: 'build-981',
    description: 'Motore audio DSP Hi-Res con equalizzatore parametrico per impianto amplificato auto.',
  },
  {
    id: 'google_maps',
    name: 'Google Maps',
    packageName: 'com.google.android.apps.maps',
    serviceComponent: 'com.google.android.maps.MapsActivity',
    sourceType: 'system',
    category: 'navigation',
    supportsVoiceSearch: true,
    accentHex: '#3B82F6',
    version: '11.145',
    description: 'Navigazione passo-passo in sovrimpressione con traffico in tempo reale e Places API.',
  },
  {
    id: 'osmand',
    name: 'OsmAnd~ Offline',
    packageName: 'net.osmand.plus',
    serviceComponent: 'net.osmand.plus/.activities.MapActivity',
    sourceType: 'f_droid',
    category: 'navigation',
    supportsVoiceSearch: true,
    accentHex: '#6366F1',
    version: '4.9.10',
    description: 'Mappe vettoriali offline complete su memoria interna del tablet senza consumo dati.',
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp Bridge',
    packageName: 'com.whatsapp',
    serviceComponent: 'android.service.notification.NotificationListenerService',
    sourceType: 'system',
    category: 'messaging',
    supportsVoiceSearch: true,
    accentHex: '#22C55E',
    version: '2.25.4',
    description: 'Ricezione notifiche dal telefono via WebSocket leggero, lettura TTS e risposta vocale.',
  },
];

export const INITIAL_TRACKS: TrackItem[] = [
  {
    id: 'trk-1',
    title: 'Midnight City',
    artist: 'M83',
    album: 'Hurry Up, We Are Dreaming',
    durationSec: 243,
    appId: 'metrolist',
    palette: ['#EC4899', '#6366F1'],
  },
  {
    id: 'trk-2',
    title: 'Blinding Lights',
    artist: 'The Weeknd',
    album: 'After Hours',
    durationSec: 200,
    appId: 'metrolist',
    palette: ['#F43F5E', '#D97706'],
  },
  {
    id: 'trk-3',
    title: 'Veridis Quo',
    artist: 'Daft Punk',
    album: 'Discovery',
    durationSec: 345,
    appId: 'metrolist',
    palette: ['#3B82F6', '#8B5CF6'],
  },
  {
    id: 'trk-4',
    title: 'Giorgio by Moroder',
    artist: 'Daft Punk',
    album: 'Random Access Memories',
    durationSec: 544,
    appId: 'vlc',
    palette: ['#F97316', '#0EA5E9'],
  },
  {
    id: 'trk-5',
    title: 'Coraline',
    artist: 'Måneskin',
    album: 'Teatro d\'ira - Vol. I',
    durationSec: 300,
    appId: 'spotify',
    palette: ['#10B981', '#0F172A'],
  },
  {
    id: 'trk-6',
    title: 'Nightcall',
    artist: 'Kavinsky',
    album: 'OutRun',
    durationSec: 258,
    appId: 'poweramp',
    palette: ['#06B6D4', '#3B82F6'],
  },
];

/**
 * Builds an Android Intent URI for launching or controlling an external app
 * (including sideloaded APKs like Metrolist).
 */
export function buildAndroidMediaIntent(
  app: Pick<MediaAppConfig, 'packageName' | 'serviceComponent'>,
  actionType: 'PLAY_SEARCH' | 'NEXT' | 'PREV' | 'PAUSE' | 'OPEN',
  query?: string
): string {
  const pkg = app.packageName;
  if (actionType === 'PLAY_SEARCH' && query) {
    const encoded = encodeURIComponent(query.trim());
    return `intent:#Intent;action=android.media.action.MEDIA_PLAY_FROM_SEARCH;package=${pkg};S.query=${encoded};S.android.intent.extra.focus=vnd.android.cursor.item%2F*;end`;
  }
  if (actionType === 'NEXT') {
    return `intent:#Intent;action=android.intent.action.MEDIA_BUTTON;package=${pkg};i.android.intent.extra.KEY_EVENT=87;end`;
  }
  if (actionType === 'PREV') {
    return `intent:#Intent;action=android.intent.action.MEDIA_BUTTON;package=${pkg};i.android.intent.extra.KEY_EVENT=88;end`;
  }
  if (actionType === 'PAUSE') {
    return `intent:#Intent;action=android.intent.action.MEDIA_BUTTON;package=${pkg};i.android.intent.extra.KEY_EVENT=85;end`;
  }
  return `intent:#Intent;action=android.intent.action.MAIN;category=android.intent.category.LAUNCHER;package=${pkg};end`;
}

/**
 * Determines which voice engine to run and whether automatic switchover occurred.
 * Guarantees 100% continuity if Gemini tokens run out or network drops.
 */
export function resolveVoiceEngineDecision(
  config: VoiceEngineConfig,
  isOnline: boolean
): VoiceEngineResolution {
  const remainingQuota = Math.max(0, config.dailyGeminiLimit - config.dailyGeminiUsed);

  if (config.mode === 'offline_only') {
    return {
      selectedEngine: 'local_offline',
      autoSwitched: false,
      remainingQuota,
    };
  }

  if (config.mode === 'hybrid_local_first') {
    return {
      selectedEngine: 'local_offline',
      autoSwitched: false,
      remainingQuota,
    };
  }

  // mode === 'hybrid_gemini_first'
  if (!isOnline) {
    return {
      selectedEngine: 'local_offline',
      autoSwitched: true,
      switchReason: 'Rete assente: passaggio automatico al Motore Vocale Locale Offline (Zero Token)',
      remainingQuota,
    };
  }

  if (remainingQuota <= 0) {
    return {
      selectedEngine: 'local_offline',
      autoSwitched: true,
      switchReason: 'Quota giornaliera Gemini esaurita: switch automatico al Motore Vocale Locale Offline',
      remainingQuota: 0,
    };
  }

  return {
    selectedEngine: 'gemini_cloud',
    autoSwitched: false,
    remainingQuota,
  };
}

/**
 * Deterministic local NLU parser for Italian & English automotive voice commands.
 * Operates completely offline with 0 token consumption.
 */
export function parseLocalVoiceCommand(
  transcript: string,
  defaultMusicApp: MediaAppConfig,
  installedApps: MediaAppConfig[]
): ParsedCarCommand {
  const raw = transcript.trim();
  const lower = raw.toLowerCase();

  // 1. Check transport controls (Next / Previous / Pause / Resume)
  if (
    /\b(brano successivo|prossimo brano|prossima canzone|vai avanti|avanti traccia|next track|skip)\b/i.test(lower)
  ) {
    return {
      action: 'NEXT_TRACK',
      rawTranscript: raw,
      targetAppId: defaultMusicApp.id,
      targetAppName: defaultMusicApp.name,
      targetPackage: defaultMusicApp.packageName,
      androidIntentUri: buildAndroidMediaIntent(defaultMusicApp, 'NEXT'),
      spokenResponse: `Passo al brano successivo su ${defaultMusicApp.name}.`,
      confidence: 0.98,
    };
  }

  if (
    /\b(brano precedente|canzone precedente|torna indietro|indietro traccia|previous track)\b/i.test(lower)
  ) {
    return {
      action: 'PREV_TRACK',
      rawTranscript: raw,
      targetAppId: defaultMusicApp.id,
      targetAppName: defaultMusicApp.name,
      targetPackage: defaultMusicApp.packageName,
      androidIntentUri: buildAndroidMediaIntent(defaultMusicApp, 'PREV'),
      spokenResponse: `Torno al brano precedente su ${defaultMusicApp.name}.`,
      confidence: 0.98,
    };
  }

  if (/\b(metti in pausa|pausa musica|ferma la musica|stop musica|pause)\b/i.test(lower)) {
    return {
      action: 'PAUSE_MEDIA',
      rawTranscript: raw,
      targetAppId: defaultMusicApp.id,
      targetAppName: defaultMusicApp.name,
      targetPackage: defaultMusicApp.packageName,
      androidIntentUri: buildAndroidMediaIntent(defaultMusicApp, 'PAUSE'),
      spokenResponse: `Riproduzione in pausa su ${defaultMusicApp.name}.`,
      confidence: 0.97,
    };
  }

  if (/\b(riprendi|continua la musica|avvia musica|resume)\b/i.test(lower) && !lower.includes('riproduci ')) {
    return {
      action: 'RESUME_MEDIA',
      rawTranscript: raw,
      targetAppId: defaultMusicApp.id,
      targetAppName: defaultMusicApp.name,
      targetPackage: defaultMusicApp.packageName,
      androidIntentUri: buildAndroidMediaIntent(defaultMusicApp, 'OPEN'),
      spokenResponse: `Riprendo la riproduzione su ${defaultMusicApp.name}.`,
      confidence: 0.95,
    };
  }

  // 2. Check WhatsApp Reply command: "Rispondi a [Nome] [Testo]"
  const replyMatch = raw.match(/^(?:rispondi|invia messaggio|scrivi)\s+a\s+([a-zA-ZÀ-ÿ]+)\s+(.+)$/i);
  if (replyMatch) {
    const recipient = replyMatch[1].trim();
    const replyText = replyMatch[2].trim();
    return {
      action: 'REPLY_MESSAGE',
      rawTranscript: raw,
      recipient,
      replyText,
      targetPackage: 'com.whatsapp',
      androidIntentUri: `intent:#Intent;action=android.intent.action.SEND;package=com.whatsapp;type=text/plain;S.android.intent.extra.TEXT=${encodeURIComponent(replyText)};end`,
      spokenResponse: `Messaggio inviato a ${recipient} su WhatsApp: "${replyText}".`,
      confidence: 0.96,
    };
  }

  // 3. Check WhatsApp Read messages command
  if (/\b(leggi|ascolta|controlla).*(messaggi|whatsapp|notifiche)\b/i.test(lower)) {
    return {
      action: 'READ_MESSAGES',
      rawTranscript: raw,
      targetPackage: 'com.whatsapp',
      androidIntentUri: 'intent:#Intent;action=android.settings.ACTION_NOTIFICATION_LISTENER_SETTINGS;end',
      spokenResponse: 'Leggo gli ultimi messaggi ricevuti su WhatsApp.',
      confidence: 0.96,
    };
  }

  // 4. Check Offline / Live Map Switch
  if (/\b(mappa offline|mappe offline|modalità offline|vettoriale offline)\b/i.test(lower)) {
    return {
      action: 'SWITCH_MAP_MODE',
      rawTranscript: raw,
      mapMode: 'offline_vector',
      androidIntentUri: 'intent:#Intent;package=net.osmand.plus;end',
      spokenResponse: 'Passo alla mappa vettoriale offline memorizzata sul tablet.',
      confidence: 0.95,
    };
  }

  // 5. Check Navigation command: "Portami a ...", "Naviga verso ...", "Indicazioni per ..."
  const navMatch = raw.match(
    /(?:portami a|portami in|naviga verso|naviga a|indicazioni per|vai a|cerca destinazione)\s+(.+)$/i
  );
  if (navMatch) {
    const destination = navMatch[1].trim();
    return {
      action: 'NAVIGATE_TO',
      rawTranscript: raw,
      destination,
      targetPackage: 'com.google.android.apps.maps',
      androidIntentUri: `google.navigation:q=${encodeURIComponent(destination)}&mode=d`,
      spokenResponse: `Calcolo il percorso verso ${destination}.`,
      confidence: 0.96,
    };
  }

  // 6. Check Play specific song/artist on external app (e.g. "Riproduci Blinding Lights su Metrolist")
  const playMatch = raw.match(/(?:riproduci|metti|ascolta|suona|play|avvia)\s+(.+)$/i);
  if (playMatch) {
    let songQuery = playMatch[1].trim();
    let targetApp = defaultMusicApp;

    const musicApps = installedApps.filter((a) => a.category === 'music');
    for (const app of musicApps) {
      const appRegex = new RegExp(`\\s+(?:su|con|in|tramite|on)\\s+${app.name}$`, 'i');
      if (appRegex.test(songQuery)) {
        targetApp = app;
        songQuery = songQuery.replace(appRegex, '').trim();
        break;
      }
    }

    return {
      action: 'PLAY_MEDIA',
      rawTranscript: raw,
      query: songQuery,
      targetAppId: targetApp.id,
      targetAppName: targetApp.name,
      targetPackage: targetApp.packageName,
      androidIntentUri: buildAndroidMediaIntent(targetApp, 'PLAY_SEARCH', songQuery),
      spokenResponse: `Riproduco "${songQuery}" su ${targetApp.name}.`,
      confidence: 0.95,
    };
  }

  return {
    action: 'UNKNOWN',
    rawTranscript: raw,
    androidIntentUri: '',
    spokenResponse:
      'Comando registrato. Prova con "Riproduci un brano su Metrolist", "Portami a Milano" o "Leggi messaggi WhatsApp".',
    confidence: 0.4,
  };
}

/**
 * Calculates battery and network metrics for the chosen phone-to-tablet connection topology.
 */
export function calculateBatteryImpactEstimate(
  topology: ConnectionTopology,
  tripMinutes: number
): BatteryImpactMetrics {
  const hours = Math.max(0.1, tripMinutes / 60);

  switch (topology) {
    case 'tablet_wifi_router':
      return {
        topology,
        label: 'Wi-Fi Router Tablet / Auto (No Hotspot Telefono)',
        phoneHotspotRequired: false,
        videoEncodingActive: false,
        avgDataRateKbps: 1.8,
        batteryDrainPercentPerHour: 2.2,
        estimatedTripDrainPercent: Number((2.2 * hours).toFixed(1)),
        thermalLevel: 'Basso (31°C)',
        stabilityScore: 98,
      };
    case 'bluetooth_pan':
      return {
        topology,
        label: 'Bluetooth Low-Energy / PAN Bridge',
        phoneHotspotRequired: false,
        videoEncodingActive: false,
        avgDataRateKbps: 0.9,
        batteryDrainPercentPerHour: 1.5,
        estimatedTripDrainPercent: Number((1.5 * hours).toFixed(1)),
        thermalLevel: 'Minimo (29°C)',
        stabilityScore: 95,
      };
    case 'usb_cable_aoa':
      return {
        topology,
        label: 'Cavo USB Diretto (ADB / Android Open Accessory)',
        phoneHotspotRequired: false,
        videoEncodingActive: false,
        avgDataRateKbps: 2.4,
        batteryDrainPercentPerHour: 0,
        estimatedTripDrainPercent: 0,
        thermalLevel: 'Incarica Controllata (30°C)',
        stabilityScore: 100,
      };
    case 'legacy_zlink_hotspot':
      return {
        topology,
        label: 'Emulazione ZLink / Hotspot Telefono + Stream Video H.264',
        phoneHotspotRequired: true,
        videoEncodingActive: true,
        avgDataRateKbps: 6800,
        batteryDrainPercentPerHour: 24.5,
        estimatedTripDrainPercent: Number((24.5 * hours).toFixed(1)),
        thermalLevel: 'Critico (44°C)',
        stabilityScore: 54,
      };
  }
}
