/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  Mic,
  Volume2,
  MessageSquare,
  Send,
  Wifi,
  Battery,
  Cpu,
  AlertCircle,
  CheckCircle2,
  RotateCcw,
} from 'lucide-react';
import {
  INITIAL_APPS,
  INITIAL_TRACKS,
  MediaAppConfig,
  TrackItem,
  VoiceEngineConfig,
  VoiceEngineType,
  ParsedCarCommand,
  ConnectionTopology,
  parseLocalVoiceCommand,
  resolveVoiceEngineDecision,
  buildAndroidMediaIntent,
} from './utils/carLogic';
import {
  CarMapStage,
  PRESET_DESTINATIONS,
  PresetDestination,
} from './components/CarMapStage';
import { MediaPlayerWidget } from './components/MediaPlayerWidget';
import {
  AppsManagerView,
  PhoneBridgeView,
  OfflineMapsView,
  ApkGithubBuilderView,
  OfflineRegionItem,
} from './components/SecondaryViews';
import { PWAInstallButton, OfflineIndicator } from './components/PWAInstallButton';
import { useOnlineStatus } from './hooks/usePWAInstall';
import type { ServerBridgeState, WhatsAppMessageItem } from '../server';

type ActiveSection = 'cockpit' | 'apps' | 'bridge' | 'offline_maps' | 'apk_github';

const INITIAL_OFFLINE_REGIONS: OfflineRegionItem[] = [
  {
    id: 'reg-lombardia',
    name: 'Lombardia & Rete Autostradale Nord',
    coverage: 'Milano, Bergamo, Brescia, Como, Varese, A1, A4, A8',
    sizeMb: 412,
    status: 'downloaded',
    updatedAt: 'Oggi',
  },
  {
    id: 'reg-emilia',
    name: 'Emilia-Romagna & Appennino',
    coverage: 'Bologna, Modena, Parma, Reggio Emilia, Rimini, A1, A14',
    sizeMb: 340,
    status: 'downloaded',
    updatedAt: '3 giorni fa',
  },
  {
    id: 'reg-piemonte',
    name: 'Piemonte & Liguria',
    coverage: 'Torino, Genova, Asti, Alessandria, A6, A10, A26',
    sizeMb: 385,
    status: 'available',
    updatedAt: 'Disponibile',
  },
  {
    id: 'reg-toscana',
    name: 'Toscana & Umbria Centrale',
    coverage: 'Firenze, Pisa, Siena, Perugia, Variante di Valico',
    sizeMb: 360,
    status: 'available',
    updatedAt: 'Disponibile',
  },
];

export default function App() {
  const isOnline = useOnlineStatus();

  // Top-level Google Maps Demo Key Quota Banner State (Mandatory Case A Defense)
  const [mapsQuotaExceeded, setMapsQuotaExceeded] = useState(false);

  // Navigation Tab State
  const [activeSection, setActiveSection] = useState<ActiveSection>('cockpit');

  // Apps & Default Preferences
  const [installedApps, setInstalledApps] = useState<MediaAppConfig[]>(INITIAL_APPS);
  const [defaultMusicAppId, setDefaultMusicAppId] = useState<string>('metrolist');
  const [activeMusicAppId, setActiveMusicAppId] = useState<string>('metrolist');

  // Media Player State
  const [tracks, setTracks] = useState<TrackItem[]>(INITIAL_TRACKS);
  const [currentTrack, setCurrentTrack] = useState<TrackItem>(INITIAL_TRACKS[0]);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [progressSec, setProgressSec] = useState<number>(0);
  const [localAudioUrls, setLocalAudioUrls] = useState<Record<string, string>>({});
  const [lastGeneratedIntent, setLastGeneratedIntent] = useState<string>('');

  // Map, Real GPS & Navigation State
  const [mapMode, setMapMode] = useState<'google_live' | 'offline_vector'>('google_live');
  const [activeDestination, setActiveDestination] = useState<PresetDestination>(
    PRESET_DESTINATIONS[0]
  );
  const [offlineRegions, setOfflineRegions] =
    useState<OfflineRegionItem[]>(INITIAL_OFFLINE_REGIONS);
  const [hasRealGps, setHasRealGps] = useState<boolean>(false);
  const [gpsStatusText, setGpsStatusText] = useState<string>(
    'Posizione Attuale (Premi "Usa Mia Posizione GPS")'
  );
  const hasRealGpsRef = useRef<boolean>(false);
  const lastGpsSampleRef = useRef<{ lat: number; lng: number; timeMs: number } | null>(
    null
  );
  const watchIdRef = useRef<number | null>(null);

  // Dual Voice Engine State (Gemini Cloud <-> Local Offline Auto-Switchover)
  const [voiceConfig, setVoiceConfig] = useState<VoiceEngineConfig>({
    mode: 'hybrid_gemini_first',
    dailyGeminiLimit: 15,
    dailyGeminiUsed: 3,
  });
  const [voiceInputText, setVoiceInputText] = useState<string>('');
  const [isListeningMic, setIsListeningMic] = useState<boolean>(false);
  const [isProcessingVoice, setIsProcessingVoice] = useState<boolean>(false);
  const [lastExecutedEngine, setLastExecutedEngine] =
    useState<VoiceEngineType>('local_offline');
  const [lastAutoSwitchBanner, setLastAutoSwitchBanner] = useState<string>('');
  const [lastParsedCommand, setLastParsedCommand] = useState<ParsedCarCommand | null>(
    null
  );

  // Lightweight Phone-to-Tablet Bridge State (Synced via WebSocket /ws)
  const [bridgeState, setBridgeState] = useState<ServerBridgeState>({
    topology: 'tablet_wifi_router',
    pairingPin: '8492',
    isPhoneConnected: true,
    phoneDeviceName: 'Pixel 9 Pro (Wi-Fi Tablet Bridge)',
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
    ],
  });

  const [quickReplyTargetId, setQuickReplyTargetId] = useState<string | null>(null);
  const [customReplyText, setCustomReplyText] = useState<string>('');
  const wsRef = useRef<WebSocket | null>(null);

  const activeMusicApp =
    installedApps.find((a) => a.id === activeMusicAppId) ||
    installedApps.find((a) => a.id === defaultMusicAppId) ||
    INITIAL_APPS[0];

  // Listen for Google Maps Platform Quota Exceeded custom event & Native Android WhatsApp Broadcasts
  useEffect(() => {
    const onQuotaExceeded = () => {
      setMapsQuotaExceeded(true);
    };
    const onNativeWhatsApp = (ev: Event) => {
      const customEv = ev as CustomEvent<{ senderName?: string; text?: string }>;
      if (customEv.detail?.text) {
        const nativeMsg: WhatsAppMessageItem = {
          id: `wa-native-${Date.now()}`,
          senderName: customEv.detail.senderName || 'WhatsApp',
          senderRole: 'WhatsApp Nativo Android · Adesso',
          text: customEv.detail.text,
          timestamp: new Date().toLocaleTimeString('it-IT', {
            hour: '2-digit',
            minute: '2-digit',
          }),
          unread: true,
        };
        setBridgeState((prev) => ({
          ...prev,
          whatsappMessages: [nativeMsg, ...prev.whatsappMessages],
        }));
      }
    };
    window.addEventListener('gmp-quota-exceeded', onQuotaExceeded);
    window.addEventListener('autodrive-native-whatsapp', onNativeWhatsApp);
    return () => {
      window.removeEventListener('gmp-quota-exceeded', onQuotaExceeded);
      window.removeEventListener('autodrive-native-whatsapp', onNativeWhatsApp);
    };
  }, []);

  // Connect to Lightweight Companion Bridge WebSocket
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      try {
        socket = new WebSocket(wsUrl);
        wsRef.current = socket;

        socket.onmessage = (ev) => {
          try {
            const data = JSON.parse(ev.data);
            if (data.event === 'bridge:init' || data.event === 'bridge:state_updated') {
              setBridgeState((prev) => ({
                ...data.payload,
                vehicleSpeedKmh: hasRealGpsRef.current
                  ? prev.vehicleSpeedKmh
                  : data.payload.vehicleSpeedKmh,
                gpsLocation: hasRealGpsRef.current
                  ? prev.gpsLocation
                  : data.payload.gpsLocation,
              }));
            } else if (data.event === 'whatsapp:message_created' && data.payload?.state) {
              setBridgeState((prev) => ({
                ...data.payload.state,
                vehicleSpeedKmh: hasRealGpsRef.current
                  ? prev.vehicleSpeedKmh
                  : data.payload.state.vehicleSpeedKmh,
                gpsLocation: hasRealGpsRef.current
                  ? prev.gpsLocation
                  : data.payload.state.gpsLocation,
              }));
            }
          } catch {
            // ignore malformed payload
          }
        };

        socket.onclose = () => {
          reconnectTimer = setTimeout(connect, 3000);
        };
      } catch {
        // fallback to REST state if ws fails
      }
    };

    connect();

    return () => {
      if (reconnectTimer) clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, []);

  // Real Hardware Geolocation & Speedometer (0 km/h when stationary at home)
  const requestRealGps = () => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      setGpsStatusText('GPS non supportato su questo browser');
      return;
    }

    setGpsStatusText('Aggancio satelliti GPS in corso...');

    const handleGpsPosition = (pos: GeolocationPosition) => {
      const { latitude, longitude, speed } = pos.coords;
      const nowMs = Date.now();
      let computedKmh = 0;

      if (typeof speed === 'number' && !Number.isNaN(speed) && speed >= 0) {
        computedKmh = speed * 3.6;
      } else if (lastGpsSampleRef.current) {
        const dtSec = (nowMs - lastGpsSampleRef.current.timeMs) / 1000;
        if (dtSec > 0.8) {
          const R = 6371000;
          const dLat = ((latitude - lastGpsSampleRef.current.lat) * Math.PI) / 180;
          const dLon = ((longitude - lastGpsSampleRef.current.lng) * Math.PI) / 180;
          const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos((lastGpsSampleRef.current.lat * Math.PI) / 180) *
              Math.cos((latitude * Math.PI) / 180) *
              Math.sin(dLon / 2) *
              Math.sin(dLon / 2);
          const distMeters = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          computedKmh = (distMeters / dtSec) * 3.6;
        }
      }

      lastGpsSampleRef.current = { lat: latitude, lng: longitude, timeMs: nowMs };
      // Deadband filter (< 3.2 km/h = 0 km/h) so indoor GPS jitter while stationary at home reads 0 km/h
      const finalSpeedKmh = computedKmh < 3.2 ? 0 : Math.min(220, Math.round(computedKmh));

      hasRealGpsRef.current = true;
      setHasRealGps(true);
      setGpsStatusText('Posizione GPS Reale Attiva');

      const coordLabel = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;

      setBridgeState((prev) => {
        const keepAddressLabel =
          prev.gpsLocation.label &&
          !prev.gpsLocation.label.includes('Rilevamento') &&
          !prev.gpsLocation.label.includes('Milano');
        const nextGps = {
          lat: latitude,
          lng: longitude,
          label: keepAddressLabel ? prev.gpsLocation.label : `GPS Live (${coordLabel})`,
        };
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(
            JSON.stringify({
              event: 'bridge:update_telemetry',
              payload: {
                vehicleSpeedKmh: finalSpeedKmh,
                gpsLocation: nextGps,
              },
            })
          );
        }
        return {
          ...prev,
          vehicleSpeedKmh: finalSpeedKmh,
          gpsLocation: nextGps,
        };
      });
    };

    navigator.geolocation.getCurrentPosition(
      handleGpsPosition,
      () => {
        setGpsStatusText('Permesso GPS negato · Tocca "Usa Mia Posizione GPS"');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );

    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }
    watchIdRef.current = navigator.geolocation.watchPosition(
      handleGpsPosition,
      () => {
        // keep last known coords
      },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 }
    );
  };

  useEffect(() => {
    requestRealGps();
    return () => {
      if (watchIdRef.current !== null && 'geolocation' in navigator) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  // Read real device battery level on Android Chrome / PWA
  useEffect(() => {
    const navWithBattery = navigator as Navigator & {
      getBattery?: () => Promise<{
        level: number;
        charging: boolean;
        addEventListener: (type: string, cb: () => void) => void;
      }>;
    };
    if (typeof navWithBattery.getBattery !== 'function') return;

    navWithBattery
      .getBattery()
      .then((battery) => {
        const syncBattery = () => {
          const pct = Math.round(battery.level * 100);
          setBridgeState((prev) => ({
            ...prev,
            phoneBatteryLevel: pct,
            phoneCharging: battery.charging,
          }));
        };
        syncBattery();
        battery.addEventListener('levelchange', syncBattery);
        battery.addEventListener('chargingchange', syncBattery);
      })
      .catch(() => {
        // ignore if battery API restricted
      });
  }, []);

  // Track Progress Counter when playing
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setProgressSec((prev) => (prev + 1 >= currentTrack.durationSec ? 0 : prev + 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [isPlaying, currentTrack.durationSec]);

  // Speak response aloud via browser TTS (Italian)
  const speakItalian = (text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'it-IT';
      utterance.rate = 1.02;
      window.speechSynthesis.speak(utterance);
    } catch {
      // ignore TTS errors in headless browsers
    }
  };

  // Apply parsed voice command to application state
  const applyParsedCommandToCockpit = (cmd: ParsedCarCommand) => {
    setLastParsedCommand(cmd);
    if (cmd.androidIntentUri) {
      setLastGeneratedIntent(cmd.androidIntentUri);
    }

    if (cmd.action === 'PLAY_MEDIA') {
      if (cmd.targetAppId) {
        setActiveMusicAppId(cmd.targetAppId);
      }
      const queryLower = (cmd.query || '').toLowerCase();
      const matchedTrack = tracks.find(
        (t) =>
          t.title.toLowerCase().includes(queryLower) ||
          t.artist.toLowerCase().includes(queryLower)
      );

      if (matchedTrack) {
        setCurrentTrack(matchedTrack);
      } else if (cmd.query) {
        const dynamicTrack: TrackItem = {
          id: `trk-voice-${Date.now()}`,
          title: cmd.query,
          artist: `Ricerca Vocale su ${cmd.targetAppName || activeMusicApp.name}`,
          album: 'Streaming / Cache Locale',
          durationSec: 215,
          appId: cmd.targetAppId || activeMusicApp.id,
          palette: ['#EC4899', '#3B82F6'],
        };
        setTracks((prev) => [dynamicTrack, ...prev]);
        setCurrentTrack(dynamicTrack);
      }
      setProgressSec(0);
      setIsPlaying(true);
    } else if (cmd.action === 'NEXT_TRACK') {
      handleNextTrack();
    } else if (cmd.action === 'PREV_TRACK') {
      handlePrevTrack();
    } else if (cmd.action === 'PAUSE_MEDIA') {
      setIsPlaying(false);
    } else if (cmd.action === 'RESUME_MEDIA') {
      setIsPlaying(true);
    } else if (cmd.action === 'NAVIGATE_TO' && cmd.destination) {
      const destQuery = cmd.destination.toLowerCase();
      const matchedPreset = PRESET_DESTINATIONS.find(
        (d) =>
          d.label.toLowerCase().includes(destQuery) ||
          d.address.toLowerCase().includes(destQuery)
      );
      if (matchedPreset) {
        setActiveDestination(matchedPreset);
      } else {
        setActiveDestination({
          id: `dest-voice-${Date.now()}`,
          label: cmd.destination,
          address: `${cmd.destination}, Italia`,
          coords: {
            lat: bridgeState.gpsLocation.lat + 0.02,
            lng: bridgeState.gpsLocation.lng + 0.025,
          },
          distanceKm: 9.4,
          etaMin: 16,
          nextTurnText: `Procedi verso ${cmd.destination}`,
          nextTurnDistMeters: 400,
        });
      }
    } else if (cmd.action === 'SWITCH_MAP_MODE' && cmd.mapMode) {
      setMapMode(cmd.mapMode);
    } else if (cmd.action === 'READ_MESSAGES') {
      const firstUnread =
        bridgeState.whatsappMessages.find((m) => m.unread) ||
        bridgeState.whatsappMessages[0];
      if (firstUnread) {
        const readText = `Messaggio su WhatsApp da ${firstUnread.senderName}: ${firstUnread.text}`;
        speakItalian(readText);
        return;
      }
    } else if (cmd.action === 'REPLY_MESSAGE' && cmd.replyText) {
      const targetMsg =
        bridgeState.whatsappMessages.find((m) =>
          cmd.recipient
            ? m.senderName.toLowerCase().includes(cmd.recipient.toLowerCase())
            : true
        ) || bridgeState.whatsappMessages[0];
      if (targetMsg) {
        handleReplyWhatsApp(targetMsg.id, cmd.replyText);
      }
    }

    speakItalian(cmd.spokenResponse);
  };

  // Execute a Voice Command through the Dual-Engine Orchestrator (Gemini <-> Local Offline Failover)
  const executeVoiceCommand = async (rawTranscript: string) => {
    const clean = rawTranscript.trim();
    if (!clean) return;

    setIsProcessingVoice(true);
    const defaultApp =
      installedApps.find((a) => a.id === defaultMusicAppId) || activeMusicApp;

    const decision = resolveVoiceEngineDecision(voiceConfig, isOnline);

    if (decision.autoSwitched && decision.switchReason) {
      setLastAutoSwitchBanner(decision.switchReason);
    } else {
      setLastAutoSwitchBanner('');
    }

    // Path A: Local Offline Engine (Zero tokens, instant deterministic NLU)
    if (decision.selectedEngine === 'local_offline') {
      const localResult = parseLocalVoiceCommand(clean, defaultApp, installedApps);
      setLastExecutedEngine('local_offline');
      applyParsedCommandToCockpit(localResult);
      setIsProcessingVoice(false);
      setVoiceInputText('');
      return;
    }

    // Path B: Gemini Cloud Engine with automatic fallback to Local Offline if API/quota fails
    try {
      const response = await fetch('/api/voice/intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: clean,
          defaultMusicAppId,
          installedApps,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      if (data.engineUsed === 'gemini_cloud') {
        setVoiceConfig((prev) => ({
          ...prev,
          dailyGeminiUsed: Math.min(prev.dailyGeminiLimit, prev.dailyGeminiUsed + 1),
        }));
        setLastExecutedEngine('gemini_cloud');
      } else {
        setLastExecutedEngine('local_offline');
        if (data.switchReason) {
          setLastAutoSwitchBanner(data.switchReason);
        }
      }

      if (data.command) {
        applyParsedCommandToCockpit(data.command);
      }
    } catch {
      // Seamless local failover if server or network fails
      const fallbackCmd = parseLocalVoiceCommand(clean, defaultApp, installedApps);
      setLastExecutedEngine('local_offline');
      setLastAutoSwitchBanner(
        'Connessione Gemini non disponibile: passaggio automatico al Motore Vocale Locale Offline.'
      );
      applyParsedCommandToCockpit(fallbackCmd);
    } finally {
      setIsProcessingVoice(false);
      setVoiceInputText('');
    }
  };

  // Start hardware microphone recognition (Web Speech API) or prompt input
  const handleStartMicrophone = () => {
    const SpeechRec =
      (window as unknown as { SpeechRecognition?: new () => { lang: string; interimResults: boolean; onresult: (e: { results: Array<Array<{ transcript: string }>> }) => void; onerror: () => void; onend: () => void; start: () => void }; webkitSpeechRecognition?: new () => { lang: string; interimResults: boolean; onresult: (e: { results: Array<Array<{ transcript: string }>> }) => void; onerror: () => void; onend: () => void; start: () => void } }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: new () => { lang: string; interimResults: boolean; onresult: (e: { results: Array<Array<{ transcript: string }>> }) => void; onerror: () => void; onend: () => void; start: () => void } }).webkitSpeechRecognition;

    if (!SpeechRec) {
      // If browser doesn't expose Web Speech API, execute current input or sample command
      const fallbackSample =
        voiceInputText.trim() || 'Riproduci Blinding Lights su Metrolist';
      executeVoiceCommand(fallbackSample);
      return;
    }

    try {
      const recognition = new SpeechRec();
      recognition.lang = 'it-IT';
      recognition.interimResults = false;
      setIsListeningMic(true);

      recognition.onresult = (event) => {
        const transcript = event.results?.[0]?.[0]?.transcript;
        if (transcript) {
          setVoiceInputText(transcript);
          executeVoiceCommand(transcript);
        }
      };
      recognition.onerror = () => {
        setIsListeningMic(false);
      };
      recognition.onend = () => {
        setIsListeningMic(false);
      };
      recognition.start();
    } catch {
      setIsListeningMic(false);
    }
  };

  const handleNextTrack = () => {
    const idx = tracks.findIndex((t) => t.id === currentTrack.id);
    const nextIdx = (idx + 1) % tracks.length;
    setCurrentTrack(tracks[nextIdx]);
    setProgressSec(0);
    setIsPlaying(true);
    setLastGeneratedIntent(buildAndroidMediaIntent(activeMusicApp, 'NEXT'));
  };

  const handlePrevTrack = () => {
    const idx = tracks.findIndex((t) => t.id === currentTrack.id);
    const prevIdx = (idx - 1 + tracks.length) % tracks.length;
    setCurrentTrack(tracks[prevIdx]);
    setProgressSec(0);
    setIsPlaying(true);
    setLastGeneratedIntent(buildAndroidMediaIntent(activeMusicApp, 'PREV'));
  };

  const handlePlaySpecificTrack = (track: TrackItem, appOverride?: MediaAppConfig) => {
    const targetApp = appOverride || activeMusicApp;
    setCurrentTrack(track);
    setProgressSec(0);
    setIsPlaying(true);
    setLastGeneratedIntent(
      buildAndroidMediaIntent(targetApp, 'PLAY_SEARCH', track.title)
    );
  };

  const handleAddLocalAudioTrack = (newTrack: TrackItem, objectUrl: string) => {
    setLocalAudioUrls((prev) => ({ ...prev, [newTrack.id]: objectUrl }));
    setTracks((prev) => [newTrack, ...prev]);
    setCurrentTrack(newTrack);
    setProgressSec(0);
    setIsPlaying(true);
  };

  const handleResolvedAddress = (resolvedAddress: string) => {
    setBridgeState((prev) => ({
      ...prev,
      gpsLocation: {
        ...prev.gpsLocation,
        label: resolvedAddress,
      },
    }));
  };

  const handleReadWhatsAppAloud = (msg: WhatsAppMessageItem) => {
    speakItalian(`Messaggio WhatsApp da ${msg.senderName}: ${msg.text}`);
    setBridgeState((prev) => ({
      ...prev,
      whatsappMessages: prev.whatsappMessages.map((m) =>
        m.id === msg.id ? { ...m, unread: false } : m
      ),
    }));
    wsRef.current?.send(
      JSON.stringify({ event: 'whatsapp:mark_read', payload: { id: msg.id } })
    );
  };

  const handleReplyWhatsApp = (msgId: string, replyText: string) => {
    if (!replyText.trim()) return;
    setBridgeState((prev) => ({
      ...prev,
      whatsappMessages: prev.whatsappMessages.map((m) =>
        m.id === msgId ? { ...m, unread: false, repliedText: replyText.trim() } : m
      ),
    }));
    wsRef.current?.send(
      JSON.stringify({
        event: 'whatsapp:reply',
        payload: { id: msgId, replyText: replyText.trim() },
      })
    );
    setQuickReplyTargetId(null);
    setCustomReplyText('');
  };

  const handleSelectTopology = (topology: ConnectionTopology) => {
    setBridgeState((prev) => ({
      ...prev,
      topology,
      phoneHotspotActive: topology === 'legacy_zlink_hotspot',
      phoneCharging: topology === 'usb_cable_aoa',
    }));
    wsRef.current?.send(
      JSON.stringify({ event: 'bridge:set_topology', payload: { topology } })
    );
  };

  const handleSendSimulatedWhatsApp = (senderName: string, text: string) => {
    const newMsg: WhatsAppMessageItem = {
      id: `wa-${Date.now()}`,
      senderName,
      senderRole: 'WhatsApp · Adesso',
      text,
      timestamp: new Date().toLocaleTimeString('it-IT', {
        hour: '2-digit',
        minute: '2-digit',
      }),
      unread: true,
    };
    setBridgeState((prev) => ({
      ...prev,
      whatsappMessages: [newMsg, ...prev.whatsappMessages],
    }));
    wsRef.current?.send(
      JSON.stringify({
        event: 'whatsapp:send_from_phone',
        payload: newMsg,
      })
    );
  };

  const handleUpdatePhoneBattery = (level: number) => {
    setBridgeState((prev) => ({ ...prev, phoneBatteryLevel: level }));
    wsRef.current?.send(
      JSON.stringify({
        event: 'bridge:update_telemetry',
        payload: { phoneBatteryLevel: level },
      })
    );
  };

  const handleToggleDownloadRegion = (regionId: string) => {
    setOfflineRegions((prev) =>
      prev.map((r) =>
        r.id === regionId
          ? {
              ...r,
              status: r.status === 'downloaded' ? 'available' : 'downloaded',
              updatedAt: r.status === 'downloaded' ? 'Disponibile' : 'Adesso',
            }
          : r
      )
    );
  };

  const cachedRegionsCount = offlineRegions.filter(
    (r) => r.status === 'downloaded'
  ).length;
  const currentEngineResolution = resolveVoiceEngineDecision(voiceConfig, isOnline);
  const remainingGeminiTokens = currentEngineResolution.remainingQuota;

  return (
    <div className="min-h-screen bg-[#090D16] text-slate-100 flex flex-col">
      {/* Mandatory Case A Google Maps Quota Banner */}
      {mapsQuotaExceeded && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm">
          <span>
            Google Maps Platform quota reached. If you are the app owner, visit{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold text-amber-950 hover:text-amber-800"
            >
              maps developer site
            </a>{' '}
            for instructions to update your account.
          </span>
        </div>
      )}

      {/* Strict 3-Zone Top Navigation Bar Contract */}
      <header className="flex items-center justify-between gap-8 px-6 py-3 border-b border-slate-800 bg-slate-950/95">
        {/* Zone 1: Brand Title (Single Text Element, One Line) */}
        <a
          href="#cockpit"
          onClick={(e) => {
            e.preventDefault();
            setActiveSection('cockpit');
          }}
          className="text-lg font-extrabold tracking-tight text-white whitespace-nowrap shrink-0"
        >
          AutoDrive Tablet OS
        </a>

        {/* Zone 2: 5 Concise Single-Line Navigation Links */}
        <nav
          aria-label="Navigazione Principale Sistema Auto"
          className="flex items-center gap-6 text-sm font-medium text-slate-300 overflow-x-auto"
        >
          <a
            href="#cockpit"
            onClick={(e) => {
              e.preventDefault();
              setActiveSection('cockpit');
            }}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
              activeSection === 'cockpit'
                ? 'text-white border-blue-500'
                : 'border-transparent hover:text-white'
            }`}
          >
            Cockpit Guida
          </a>
          <a
            href="#apps"
            onClick={(e) => {
              e.preventDefault();
              setActiveSection('apps');
            }}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
              activeSection === 'apps'
                ? 'text-white border-blue-500'
                : 'border-transparent hover:text-white'
            }`}
          >
            App & Metrolist
          </a>
          <a
            href="#bridge"
            onClick={(e) => {
              e.preventDefault();
              setActiveSection('bridge');
            }}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
              activeSection === 'bridge'
                ? 'text-white border-blue-500'
                : 'border-transparent hover:text-white'
            }`}
          >
            Bridge Telefono
          </a>
          <a
            href="#offline-maps"
            onClick={(e) => {
              e.preventDefault();
              setActiveSection('offline_maps');
            }}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
              activeSection === 'offline_maps'
                ? 'text-white border-blue-500'
                : 'border-transparent hover:text-white'
            }`}
          >
            Mappe Offline
          </a>
          <a
            href="#apk-github"
            onClick={(e) => {
              e.preventDefault();
              setActiveSection('apk_github');
            }}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
              activeSection === 'apk_github'
                ? 'text-white border-blue-500'
                : 'border-transparent hover:text-white'
            }`}
          >
            Build APK & GitHub
          </a>
        </nav>

        {/* Zone 3: 1 Primary Action (Direct APK / Android Package Download) */}
        <div className="flex items-center shrink-0">
          <PWAInstallButton onOpenApkBuilder={() => setActiveSection('apk_github')} />
        </div>
      </header>

      {/* Main Content Workspace */}
      <main className="flex-1 w-full max-w-[1440px] mx-auto px-4 sm:px-6 py-3 flex flex-col gap-3">
        {/* Dual-Engine Voice Command Bar & Automatic Failover Controller */}
        <section
          aria-label="Controllo Vocale Ibrido Locale e Gemini"
          className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col gap-2.5"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Microphone Button + Voice Command Input */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                executeVoiceCommand(voiceInputText);
              }}
              className="flex-1 min-w-[280px] flex items-center gap-2.5"
            >
              <button
                type="button"
                onClick={handleStartMicrophone}
                aria-label="Attiva comando vocale microfono"
                className={`min-h-[46px] min-w-[46px] px-3.5 rounded-xl font-semibold text-xs flex items-center justify-center gap-2 transition-colors shrink-0 ${
                  isListeningMic
                    ? 'bg-red-600 text-white'
                    : 'bg-blue-600 hover:bg-blue-500 text-white'
                }`}
              >
                <Mic className="w-5 h-5" />
                <span className="hidden sm:inline">
                  {isListeningMic ? 'In ascolto...' : 'Parla'}
                </span>
              </button>

              <div className="relative flex-1">
                <label htmlFor="voice-command-input" className="sr-only">
                  Pronuncia o scrivi un comando vocale per l’auto
                </label>
                <input
                  id="voice-command-input"
                  type="text"
                  value={voiceInputText}
                  onChange={(e) => setVoiceInputText(e.target.value)}
                  placeholder='Prova: "Riproduci Blinding Lights su Metrolist", "Brano successivo", "Portami a Milano"...'
                  className="w-full min-h-[46px] px-4 py-2 text-sm bg-slate-950 border border-slate-800 rounded-xl text-white placeholder:text-slate-400 focus:outline-none focus:border-blue-500"
                />
              </div>

              <button
                type="submit"
                disabled={isProcessingVoice}
                className="min-h-[46px] px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white transition-colors whitespace-nowrap shrink-0"
              >
                {isProcessingVoice ? 'Elaborazione...' : 'Esegui Comando'}
              </button>
            </form>

            {/* Dual Voice Engine Status & Failover Test Controls */}
            <div className="flex flex-wrap items-center gap-2">
              <div
                role="group"
                aria-label="Modalità motore vocale"
                className="flex items-center gap-1 p-1 bg-slate-950 rounded-xl border border-slate-800"
              >
                <button
                  type="button"
                  onClick={() =>
                    setVoiceConfig((prev) => ({ ...prev, mode: 'hybrid_gemini_first' }))
                  }
                  className={`min-h-[38px] px-2.5 py-1 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                    voiceConfig.mode === 'hybrid_gemini_first'
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Auto (Gemini → Locale)
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setVoiceConfig((prev) => ({ ...prev, mode: 'offline_only' }))
                  }
                  className={`min-h-[38px] px-2.5 py-1 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                    voiceConfig.mode === 'offline_only'
                      ? 'bg-emerald-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  100% Locale Offline
                </button>
              </div>

              {/* Token Quota Counter + Simulate Quota Exhaustion Button */}
              <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 text-xs">
                <Cpu className="w-4 h-4 text-blue-400 shrink-0" />
                <span className="font-mono text-slate-300 tabular-nums">
                  Token Gemini: <strong>{remainingGeminiTokens}</strong>/{voiceConfig.dailyGeminiLimit}
                </span>
                {remainingGeminiTokens > 0 ? (
                  <button
                    type="button"
                    onClick={() =>
                      setVoiceConfig((prev) => ({
                        ...prev,
                        dailyGeminiUsed: prev.dailyGeminiLimit,
                      }))
                    }
                    className="min-h-[32px] px-2 py-0.5 rounded-lg bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/40 text-amber-300 text-[11px] font-medium transition-colors whitespace-nowrap"
                    title="Simula la fine dei token Gemini per verificare il passaggio automatico al motore locale offline"
                  >
                    Simula Fine Token
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() =>
                      setVoiceConfig((prev) => ({ ...prev, dailyGeminiUsed: 0 }))
                    }
                    className="min-h-[32px] px-2 py-0.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-blue-300 text-[11px] font-medium flex items-center gap-1 transition-colors whitespace-nowrap"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Ripristina Quota
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Quick 1-Tap Voice Command Presets + Active Engine Telemetry */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/80 text-xs">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-slate-400 mr-1">Comandi rapidi:</span>
              {[
                'Riproduci Blinding Lights su Metrolist',
                'Brano successivo',
                'Portami a Aeroporto Milano Malpensa',
                'Leggi messaggi WhatsApp',
              ].map((presetCmd) => (
                <button
                  key={presetCmd}
                  type="button"
                  onClick={() => executeVoiceCommand(presetCmd)}
                  className="min-h-[34px] px-2.5 py-1 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 transition-colors whitespace-nowrap"
                >
                  &ldquo;{presetCmd}&rdquo;
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 text-slate-300">
              <span>Motore in uso:</span>
              <span className="font-semibold text-white">
                {currentEngineResolution.selectedEngine === 'gemini_cloud'
                  ? 'Gemini Cloud AI (+ Failover Locale)'
                  : lastExecutedEngine === 'local_offline'
                  ? 'Locale Offline (Zero Token)'
                  : 'Locale Offline (Zero Token)'}
              </span>
            </div>
          </div>

          {/* Automatic Switchover Alert or Last Parsed Command Feedback */}
          {(lastAutoSwitchBanner || lastParsedCommand) && (
            <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
              {lastParsedCommand && (
                <div className="flex items-center gap-2 text-emerald-400 font-medium">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{lastParsedCommand.spokenResponse}</span>
                </div>
              )}
              {lastAutoSwitchBanner && (
                <div className="flex items-center gap-1.5 text-amber-300 font-medium">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{lastAutoSwitchBanner}</span>
                </div>
              )}
            </div>
          )}
        </section>

        {/* SECTION ROUTER */}
        {activeSection === 'cockpit' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch flex-1">
            {/* Left 7 Columns (approx 60%): Map & Navigation Stage */}
            <div className="lg:col-span-7 flex flex-col">
              <CarMapStage
                mapMode={mapMode}
                onChangeMapMode={setMapMode}
                activeDestination={activeDestination}
                onSelectDestination={setActiveDestination}
                vehicleSpeedKmh={bridgeState.vehicleSpeedKmh}
                currentCoords={bridgeState.gpsLocation}
                cachedRegionsCount={cachedRegionsCount}
                hasRealGps={hasRealGps}
                gpsStatusText={gpsStatusText}
                onRequestRealGps={requestRealGps}
                onResolvedAddress={handleResolvedAddress}
              />
            </div>

            {/* Right 5 Columns (approx 40%): Media Player (Metrolist) + WhatsApp & Phone Bridge */}
            <div className="lg:col-span-5 flex flex-col gap-3">
              {/* Universal Media Player Widget */}
              <MediaPlayerWidget
                installedApps={installedApps}
                activeMusicApp={activeMusicApp}
                onSelectMusicApp={(app) => setActiveMusicAppId(app.id)}
                tracks={tracks}
                currentTrack={currentTrack}
                isPlaying={isPlaying}
                progressSec={progressSec}
                onTogglePlay={() => setIsPlaying((v) => !v)}
                onNextTrack={handleNextTrack}
                onPrevTrack={handlePrevTrack}
                onPlaySpecificTrack={handlePlaySpecificTrack}
                onAddLocalAudioTrack={handleAddLocalAudioTrack}
                localAudioUrls={localAudioUrls}
                lastGeneratedIntent={lastGeneratedIntent}
              />

              {/* WhatsApp & Lightweight Phone Bridge Status Card */}
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col gap-3 flex-1">
                {/* Bridge Telemetry Header (Confirms Phone Hotspot is OFF) */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800">
                  <div className="flex items-center gap-2 text-xs">
                    <MessageSquare className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="font-bold text-white">WhatsApp & Bridge Auto</span>
                    <span aria-hidden="true" className="text-slate-500">·</span>
                    <span className="text-slate-400">{bridgeState.networkSsid}</span>
                  </div>

                  <div className="flex items-center gap-3 text-xs font-mono text-slate-300 tabular-nums">
                    <span className="flex items-center gap-1 text-emerald-400">
                      <Wifi className="w-3.5 h-3.5" />
                      Hotspot Tel: {bridgeState.phoneHotspotActive ? 'ON' : 'OFF'}
                    </span>
                    <span className="flex items-center gap-1">
                      <Battery className="w-3.5 h-3.5 text-blue-400" />
                      {bridgeState.phoneBatteryLevel}%
                    </span>
                  </div>
                </div>

                {/* Incoming WhatsApp Messages List */}
                <div className="space-y-2 max-h-[175px] overflow-y-auto pr-1">
                  {bridgeState.whatsappMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-xs">
                          <span className="font-bold text-white">{msg.senderName}</span>
                          <span className="text-slate-500">·</span>
                          <span className="text-slate-400 font-mono tabular-nums">
                            {msg.timestamp}
                          </span>
                        </div>
                        {msg.unread && (
                          <span className="text-[11px] font-semibold text-emerald-400">
                            Nuovo
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-200 leading-relaxed">{msg.text}</p>

                      {msg.repliedText && (
                        <p className="text-xs text-blue-400 bg-slate-900 px-2.5 py-1.5 rounded-lg">
                          Tu: &ldquo;{msg.repliedText}&rdquo;
                        </p>
                      )}

                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => handleReadWhatsAppAloud(msg)}
                          className="min-h-[40px] px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-medium text-slate-100 flex items-center gap-1.5 transition-colors"
                        >
                          <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                          Ascolta TTS
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            handleReplyWhatsApp(
                              msg.id,
                              'Sto guidando, arrivo tra 10 minuti!'
                            )
                          }
                          className="min-h-[40px] px-3 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-xs font-medium text-emerald-300 flex items-center gap-1.5 transition-colors"
                        >
                          <Send className="w-3.5 h-3.5" />
                          &ldquo;Arrivo tra 10 min&rdquo;
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            setQuickReplyTargetId(
                              quickReplyTargetId === msg.id ? null : msg.id
                            )
                          }
                          className="min-h-[40px] px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs text-slate-300 transition-colors"
                        >
                          Rispondi...
                        </button>
                      </div>

                      {quickReplyTargetId === msg.id && (
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            handleReplyWhatsApp(msg.id, customReplyText);
                          }}
                          className="pt-2 flex items-center gap-2"
                        >
                          <label htmlFor={`reply-input-${msg.id}`} className="sr-only">
                            Scrivi risposta a {msg.senderName}
                          </label>
                          <input
                            id={`reply-input-${msg.id}`}
                            type="text"
                            value={customReplyText}
                            onChange={(e) => setCustomReplyText(e.target.value)}
                            placeholder={`Rispondi a ${msg.senderName}...`}
                            className="flex-1 min-h-[40px] px-3 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded-xl text-white"
                          />
                          <button
                            type="submit"
                            className="min-h-[40px] px-3 py-1.5 rounded-xl bg-emerald-600 text-xs font-semibold text-white"
                          >
                            Invia
                          </button>
                        </form>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeSection === 'apps' && (
          <AppsManagerView
            installedApps={installedApps}
            defaultMusicAppId={defaultMusicAppId}
            onChangeDefaultMusicApp={(appId) => {
              setDefaultMusicAppId(appId);
              setActiveMusicAppId(appId);
            }}
            defaultNavMode={mapMode}
            onChangeDefaultNavMode={(mode) => setMapMode(mode)}
            onAddCustomApk={(newApp) => {
              setInstalledApps((prev) => [...prev, newApp]);
              if (newApp.category === 'music') {
                setDefaultMusicAppId(newApp.id);
                setActiveMusicAppId(newApp.id);
              }
            }}
            onLaunchAppInCockpit={(app) => {
              if (app.category === 'music') {
                setActiveMusicAppId(app.id);
              } else if (app.id === 'osmand') {
                setMapMode('offline_vector');
              } else if (app.id === 'google_maps') {
                setMapMode('google_live');
              }
              setActiveSection('cockpit');
            }}
          />
        )}

        {activeSection === 'bridge' && (
          <PhoneBridgeView
            bridgeState={bridgeState}
            onSelectTopology={handleSelectTopology}
            onSendSimulatedWhatsApp={handleSendSimulatedWhatsApp}
            onUpdatePhoneBattery={handleUpdatePhoneBattery}
          />
        )}

        {activeSection === 'offline_maps' && (
          <OfflineMapsView
            regions={offlineRegions}
            onToggleDownloadRegion={handleToggleDownloadRegion}
            onActivateOfflineMapInCockpit={() => {
              setMapMode('offline_vector');
              setActiveSection('cockpit');
            }}
          />
        )}

        {activeSection === 'apk_github' && <ApkGithubBuilderView />}
      </main>

      <OfflineIndicator />
    </div>
  );
}
