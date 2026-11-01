import React, { useState } from 'react';
import {
  Wifi,
  Bluetooth,
  Usb,
  Smartphone,
  BatteryCharging,
  ShieldCheck,
  Download,
  Plus,
  Check,
  Send,
  HardDrive,
  FileCode,
  Copy,
  AlertTriangle,
  Archive,
  Rocket,
  ExternalLink,
  CheckCircle2,
} from 'lucide-react';
import {
  MediaAppConfig,
  ConnectionTopology,
  calculateBatteryImpactEstimate,
  buildAndroidMediaIntent,
} from '../utils/carLogic';
import { getCompleteAndroidProjectFiles } from '../utils/androidProjectGenerator';
import type { ServerBridgeState } from '../../server';

/* ============================================================================
 * VIEW 1: APP LAUNCHER & EXTERNAL SIDELOAD APK MANAGER (METROLIST / FOSS)
 * ============================================================================ */
interface AppsManagerViewProps {
  installedApps: MediaAppConfig[];
  defaultMusicAppId: string;
  onChangeDefaultMusicApp: (appId: string) => void;
  defaultNavMode: 'google_live' | 'offline_vector';
  onChangeDefaultNavMode: (mode: 'google_live' | 'offline_vector') => void;
  onAddCustomApk: (newApp: MediaAppConfig) => void;
  onLaunchAppInCockpit: (app: MediaAppConfig) => void;
}

export const AppsManagerView: React.FC<AppsManagerViewProps> = ({
  installedApps,
  defaultMusicAppId,
  onChangeDefaultMusicApp,
  defaultNavMode,
  onChangeDefaultNavMode,
  onAddCustomApk,
  onLaunchAppInCockpit,
}) => {
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'music' | 'navigation' | 'messaging'>('all');
  const [apkName, setApkName] = useState('');
  const [apkPackage, setApkPackage] = useState('');
  const [apkCategory, setApkCategory] = useState<'music' | 'navigation'>('music');
  const [formError, setFormError] = useState('');

  const visibleApps =
    categoryFilter === 'all'
      ? installedApps
      : installedApps.filter((a) => a.category === categoryFilter);

  const handleRegisterApk = (e: React.FormEvent) => {
    e.preventDefault();
    if (!apkName.trim() || !apkPackage.trim()) {
      setFormError('Inserisci sia il nome dell’applicazione sia il package Android (es. com.moagamy.metrolist).');
      return;
    }
    if (!apkPackage.includes('.')) {
      setFormError('Il package name Android deve avere un formato valido (es. com.esempio.app).');
      return;
    }

    setFormError('');
    const newApp: MediaAppConfig = {
      id: `custom-${Date.now()}`,
      name: apkName.trim(),
      packageName: apkPackage.trim(),
      serviceComponent: `${apkPackage.trim()}/.PlaybackService`,
      sourceType: 'sideload_apk',
      category: apkCategory,
      supportsVoiceSearch: true,
      accentHex: '#8B5CF6',
      version: 'Custom-APK',
      description: 'Applicazione esterna registrata manualmente per controllo vocale e lancio rapido via Intent.',
    };

    onAddCustomApk(newApp);
    setApkName('');
    setApkPackage('');
  };

  return (
    <div className="space-y-6">
      {/* Default App Preferences Panel */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <h2 className="text-lg font-bold text-white">
            Scelta Applicazione Musicale Predefinita
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Seleziona quale app utilizzare di default quando pronunci un comando vocale come &ldquo;Riproduci brano&rdquo; o &ldquo;Vai avanti&rdquo;. Supporta nativamente APK esterni al Play Store come Metrolist.
          </p>
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {installedApps
              .filter((a) => a.category === 'music')
              .map((app) => {
                const isDefault = app.id === defaultMusicAppId;
                return (
                  <button
                    key={app.id}
                    type="button"
                    onClick={() => onChangeDefaultMusicApp(app.id)}
                    className={`min-h-[52px] p-3 rounded-xl border text-left transition-colors flex flex-col justify-between ${
                      isDefault
                        ? 'bg-blue-600/20 border-blue-500 text-white'
                        : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="text-xs font-bold truncate">{app.name}</span>
                      {isDefault && <Check className="w-4 h-4 text-blue-400 shrink-0" />}
                    </div>
                    <span className="text-[11px] font-mono text-slate-400 truncate mt-1">
                      {app.sourceType === 'sideload_apk' ? 'APK Esterno' : 'Play / F-Droid'}
                    </span>
                  </button>
                );
              })}
          </div>
        </div>

        <div>
          <h2 className="text-lg font-bold text-white">
            Scelta Navigatore Predefinito in Sovrimpressione
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Scegli se avviare il cockpit con Google Maps Live (con Places & Routes API) oppure direttamente con la Mappa Vettoriale Offline per risparmiare dati.
          </p>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => onChangeDefaultNavMode('google_live')}
              className={`min-h-[52px] p-3 rounded-xl border text-left transition-colors ${
                defaultNavMode === 'google_live'
                  ? 'bg-blue-600/20 border-blue-500 text-white'
                  : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold">Google Maps Integrato</span>
                {defaultNavMode === 'google_live' && <Check className="w-4 h-4 text-blue-400" />}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Traffico live + fallback automatico offline in galleria
              </p>
            </button>

            <button
              type="button"
              onClick={() => onChangeDefaultNavMode('offline_vector')}
              className={`min-h-[52px] p-3 rounded-xl border text-left transition-colors ${
                defaultNavMode === 'offline_vector'
                  ? 'bg-amber-600/20 border-amber-500 text-white'
                  : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold">Mappa Vettoriale Offline</span>
                {defaultNavMode === 'offline_vector' && <Check className="w-4 h-4 text-amber-400" />}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                100% locale su memoria tablet senza connessione internet
              </p>
            </button>
          </div>
        </div>
      </div>

      {/* Filter Bar + Installed Apps Grid */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-white">
              Applicazioni Abilitate Auto & Sorgenti Esterne (Sideload APK)
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              A differenza di Android Auto standard, non serve sbloccare ogni volta le opzioni sviluppatore per vedere app da GitHub o F-Droid come Metrolist.
            </p>
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-950 rounded-xl border border-slate-800">
            {(
              [
                ['all', 'Tutte'],
                ['music', 'Musica & Audio'],
                ['navigation', 'Navigazione'],
                ['messaging', 'Messaggistica'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setCategoryFilter(key)}
                className={`min-h-[40px] px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                  categoryFilter === key
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {visibleApps.map((app) => {
            const intentUri = buildAndroidMediaIntent(app, 'OPEN');
            return (
              <div
                key={app.id}
                className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between gap-4"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-base font-bold text-white">{app.name}</h3>
                    <span className="text-xs text-slate-400 font-mono">{app.version}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-400 font-mono">
                    <span>{app.packageName}</span>
                    <span aria-hidden="true">·</span>
                    <span>
                      {app.sourceType === 'sideload_apk'
                        ? 'Sorgente Esterna APK'
                        : app.sourceType === 'f_droid'
                        ? 'F-Droid FOSS'
                        : 'Sistema / Play'}
                    </span>
                  </div>
                  <p className="mt-2.5 text-xs text-slate-300 leading-relaxed">
                    {app.description}
                  </p>
                </div>

                <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-800/80">
                  <button
                    type="button"
                    onClick={() => onLaunchAppInCockpit(app)}
                    className="min-h-[44px] flex-1 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white transition-colors"
                  >
                    Attiva nel Cockpit
                  </button>
                  <a
                    href={intentUri}
                    className="min-h-[44px] px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-medium text-slate-200 flex items-center justify-center transition-colors whitespace-nowrap"
                  >
                    Intent APK
                  </a>
                </div>
              </div>
            );
          })}
        </div>

        {/* Form to Add Custom External APK */}
        <form
          onSubmit={handleRegisterApk}
          className="pt-5 border-t border-slate-800 flex flex-col gap-3"
        >
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Plus className="w-4 h-4 text-blue-400" />
            Registra Nuova Applicazione Esterna (APK Non-Play Store)
          </h3>
          {formError && (
            <p role="alert" className="text-xs text-amber-400 font-medium">
              {formError}
            </p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label htmlFor="custom-apk-name" className="block text-xs text-slate-400 mb-1">
                Nome App (es. RiMusic / InnerTune)
              </label>
              <input
                id="custom-apk-name"
                type="text"
                value={apkName}
                onChange={(e) => setApkName(e.target.value)}
                placeholder="Es. RiMusic FOSS"
                className="w-full min-h-[44px] px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-white"
              />
            </div>
            <div>
              <label htmlFor="custom-apk-pkg" className="block text-xs text-slate-400 mb-1">
                Package Name Android
              </label>
              <input
                id="custom-apk-pkg"
                type="text"
                value={apkPackage}
                onChange={(e) => setApkPackage(e.target.value)}
                placeholder="Es. it.fast4x.rimusic"
                className="w-full min-h-[44px] px-3 py-2 text-xs font-mono rounded-xl bg-slate-950 border border-slate-800 text-white"
              />
            </div>
            <div>
              <label htmlFor="custom-apk-cat" className="block text-xs text-slate-400 mb-1">
                Categoria Comandi Vocali
              </label>
              <select
                id="custom-apk-cat"
                value={apkCategory}
                onChange={(e) => setApkCategory(e.target.value as 'music' | 'navigation')}
                className="w-full min-h-[44px] px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-white"
              >
                <option value="music">Player Musicale (MediaSession)</option>
                <option value="navigation">Navigatore GPS</option>
              </select>
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                className="w-full min-h-[44px] px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white transition-colors"
              >
                Aggiungi APK al Launcher
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ============================================================================
 * VIEW 2: PHONE-TO-TABLET BRIDGE (NO PHONE HOTSPOT) & LIVE COMPANION SIMULATOR
 * ============================================================================ */
interface PhoneBridgeViewProps {
  bridgeState: ServerBridgeState;
  onSelectTopology: (topology: ConnectionTopology) => void;
  onSendSimulatedWhatsApp: (senderName: string, text: string) => void;
  onUpdatePhoneBattery: (level: number) => void;
}

export const PhoneBridgeView: React.FC<PhoneBridgeViewProps> = ({
  bridgeState,
  onSelectTopology,
  onSendSimulatedWhatsApp,
  onUpdatePhoneBattery,
}) => {
  const [tripDurationMin, setTripDurationMin] = useState(60);
  const [simSender, setSimSender] = useState('Luca (Ufficio)');
  const [simMessage, setSimMessage] = useState('Sei già partito? Ci vediamo direttamente al parcheggio Ovest.');
  const [simFeedback, setSimFeedback] = useState('');

  const currentMetrics = calculateBatteryImpactEstimate(bridgeState.topology, tripDurationMin);
  const zlinkComparison = calculateBatteryImpactEstimate('legacy_zlink_hotspot', tripDurationMin);

  const handleTriggerWhatsApp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!simSender.trim() || !simMessage.trim()) return;
    onSendSimulatedWhatsApp(simSender.trim(), simMessage.trim());
    setSimFeedback(`Notifica WhatsApp di ${simSender} trasmessa in tempo reale al Tablet via WebSocket!`);
    setTimeout(() => setSimFeedback(''), 4000);
  };

  return (
    <div className="space-y-6">
      {/* Architecture Selection: Tablet Wi-Fi Router vs Bluetooth PAN vs USB Cable */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-white">
              Architettura di Connessione Telefono ↔ Tablet (Senza Hotspot Telefono)
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Scegli come far comunicare lo smartphone e il tablet in auto. Evitando l’hotspot sul telefono e lo streaming video H.264 continuo di ZLink, elimini blocchi e surriscaldamento.
            </p>
          </div>
          <div className="text-xs font-mono text-slate-300 bg-slate-950 px-3.5 py-2 rounded-xl border border-slate-800">
            PIN Pairing Sicuro: <strong className="text-blue-400">{bridgeState.pairingPin}</strong> · Endpoint: {bridgeState.tabletIpAddress}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(
            [
              {
                id: 'tablet_wifi_router',
                title: '1. Wi-Fi Router Tablet / Auto (Consigliato)',
                subtitle: 'Hotspot Telefono: SPENTO · Il telefono si collega al Wi-Fi del tablet/router auto',
                icon: Wifi,
                desc: 'Il tablet (o la saponetta 4G dell’auto) crea la rete locale. Quando sali in auto, il telefono si aggancia automaticamente al Wi-Fi e sincronizza notifiche WhatsApp e GPS consumando solo 2.2% di batteria all’ora.',
              },
              {
                id: 'bluetooth_pan',
                title: '2. Bluetooth Low-Energy / PAN Bridge',
                subtitle: 'Hotspot Telefono: SPENTO · Zero configurazione Wi-Fi',
                icon: Bluetooth,
                desc: 'Ideale se il tablet non ha SIM e non vuoi toccare il Wi-Fi dello smartphone. Trasmette comandi MediaSession e testo dei messaggi WhatsApp tramite canale GATT/PAN crittografato.',
              },
              {
                id: 'usb_cable_aoa',
                title: '3. Cavo USB Diretto (ADB / AOA)',
                subtitle: 'Stabilità 100% via cavo + Ricarica controllata',
                icon: Usb,
                desc: 'Modalità cablata opzionale per lunghi viaggi autostradali: tethering inverso USB a latenza 0 ms senza attivare alcun modulo wireless.',
              },
            ] as const
          ).map((item) => {
            const Icon = item.icon;
            const isSelected = bridgeState.topology === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTopology(item.id)}
                className={`p-4 rounded-xl border text-left transition-colors flex flex-col justify-between gap-3 ${
                  isSelected
                    ? 'bg-blue-600/15 border-blue-500 text-white'
                    : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800/70'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-blue-400">
                      <Icon className="w-5 h-5" />
                    </div>
                    {isSelected && (
                      <span className="text-xs font-semibold text-blue-400">Attivo</span>
                    )}
                  </div>
                  <h3 className="text-sm font-bold text-white mt-3">{item.title}</h3>
                  <p className="text-[11px] font-medium text-emerald-400 mt-0.5">
                    {item.subtitle}
                  </p>
                  <p className="text-xs text-slate-400 mt-2 leading-relaxed">{item.desc}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Battery & Performance Comparison vs ZLink + Live Smartphone Companion Simulator */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quantitative Battery Comparison Card */}
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <BatteryCharging className="w-5 h-5 text-emerald-400" />
              Impatto Batteria Smartphone (Viaggio di {tripDurationMin} min)
            </h3>
            <div className="flex items-center gap-1.5">
              {[30, 60, 120].map((mins) => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => setTripDurationMin(mins)}
                  className={`min-h-[36px] px-2.5 py-1 rounded-lg text-xs font-mono transition-colors ${
                    tripDurationMin === mins
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-950 text-slate-400 hover:text-white'
                  }`}
                >
                  {mins}m
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div className="p-4 rounded-xl bg-slate-950 border border-emerald-500/40 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-emerald-400">{currentMetrics.label}</span>
                <span className="font-mono font-bold text-white tabular-nums">
                  -{currentMetrics.estimatedTripDrainPercent}% batteria
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                <span>Hotspot Telefono: {currentMetrics.phoneHotspotRequired ? 'Richiesto' : 'Disattivato'}</span>
                <span>·</span>
                <span>Traffico: {currentMetrics.avgDataRateKbps} KB/s</span>
                <span>·</span>
                <span>Temp: {currentMetrics.thermalLevel}</span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2 opacity-80">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-amber-400">{zlinkComparison.label}</span>
                <span className="font-mono font-bold text-amber-400 tabular-nums">
                  -{zlinkComparison.estimatedTripDrainPercent}% batteria
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                <span>Hotspot Telefono: Obbligatorio</span>
                <span>·</span>
                <span>Stream Video: {zlinkComparison.avgDataRateKbps} KB/s</span>
                <span>·</span>
                <span>Temp: {zlinkComparison.thermalLevel}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Live Smartphone Companion Transmitter (WebSocket Real-Time Test) */}
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-blue-400" />
                Simulatore Smartphone Companion (Live WebSocket)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Invia in tempo reale una notifica WhatsApp dallo smartphone al Cockpit del tablet senza usare l’hotspot del telefono.
              </p>
            </div>
          </div>

          <form onSubmit={handleTriggerWhatsApp} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="companion-sender" className="block text-xs text-slate-400 mb-1">
                  Mittente WhatsApp
                </label>
                <input
                  id="companion-sender"
                  type="text"
                  value={simSender}
                  onChange={(e) => setSimSender(e.target.value)}
                  className="w-full min-h-[44px] px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-white"
                />
              </div>
              <div>
                <label htmlFor="companion-battery" className="block text-xs text-slate-400 mb-1">
                  Livello Batteria Telefono ({bridgeState.phoneBatteryLevel}%)
                </label>
                <input
                  id="companion-battery"
                  type="range"
                  min={5}
                  max={100}
                  value={bridgeState.phoneBatteryLevel}
                  onChange={(e) => onUpdatePhoneBattery(Number(e.target.value))}
                  className="w-full h-[44px] accent-blue-500"
                />
              </div>
            </div>

            <div>
              <label htmlFor="companion-msg-text" className="block text-xs text-slate-400 mb-1">
                Testo Messaggio WhatsApp in Arrivo
              </label>
              <input
                id="companion-msg-text"
                type="text"
                value={simMessage}
                onChange={(e) => setSimMessage(e.target.value)}
                className="w-full min-h-[44px] px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-white"
              />
            </div>

            {simFeedback && (
              <p className="text-xs font-medium text-emerald-400">{simFeedback}</p>
            )}

            <button
              type="submit"
              className="w-full min-h-[48px] px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white flex items-center justify-center gap-2 transition-colors"
            >
              <Send className="w-4 h-4" />
              Invia Notifica WhatsApp al Tablet via Bridge
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

/* ============================================================================
 * VIEW 3: OFFLINE VECTOR MAP PACKAGES MANAGER
 * ============================================================================ */
export interface OfflineRegionItem {
  id: string;
  name: string;
  coverage: string;
  sizeMb: number;
  status: 'downloaded' | 'available';
  updatedAt: string;
}

interface OfflineMapsViewProps {
  regions: OfflineRegionItem[];
  onToggleDownloadRegion: (id: string) => void;
  onActivateOfflineMapInCockpit: () => void;
}

export const OfflineMapsView: React.FC<OfflineMapsViewProps> = ({
  regions,
  onToggleDownloadRegion,
  onActivateOfflineMapInCockpit,
}) => {
  const downloadedCount = regions.filter((r) => r.status === 'downloaded').length;
  const totalMb = regions
    .filter((r) => r.status === 'downloaded')
    .reduce((acc, item) => acc + item.sizeMb, 0);

  return (
    <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <HardDrive className="w-5 h-5 text-blue-400" />
            Archivio Mappe Vettoriali Offline sul Tablet
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Scarica preventivamente i pacchetti regionali sulla memoria del tablet: quando l’auto entra in galleria o perde il segnale 4G, il navigatore commuta senza blocchi.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-xs font-mono text-slate-300 bg-slate-950 px-3.5 py-2.5 rounded-xl border border-slate-800 tabular-nums">
            Regioni Attive: <strong>{downloadedCount}</strong> · Spazio: <strong>{totalMb} MB</strong>
          </div>
          <button
            type="button"
            onClick={onActivateOfflineMapInCockpit}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-xs font-semibold text-white transition-colors"
          >
            Apri Mappa Vettoriale nel Cockpit
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {regions.map((reg) => {
          const isDownloaded = reg.status === 'downloaded';
          return (
            <div
              key={reg.id}
              className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-4"
            >
              <div>
                <h3 className="text-sm font-bold text-white">{reg.name}</h3>
                <p className="text-xs text-slate-400 mt-0.5">{reg.coverage}</p>
                <div className="mt-2 flex items-center gap-2 text-[11px] font-mono text-slate-400 tabular-nums">
                  <span>{reg.sizeMb} MB</span>
                  <span>·</span>
                  <span>Aggiornato: {reg.updatedAt}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onToggleDownloadRegion(reg.id)}
                className={`min-h-[44px] px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
                  isDownloaded
                    ? 'bg-emerald-600/20 border border-emerald-500/50 text-emerald-300 hover:bg-emerald-600/30'
                    : 'bg-blue-600 hover:bg-blue-500 text-white'
                }`}
              >
                {isDownloaded ? (
                  <>
                    <Check className="w-4 h-4" />
                    Scaricata
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    Scarica Offline
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/* ============================================================================
 * VIEW 4: APK & GITHUB RELEASE BUILDER + DIRECT ANDROID PROJECT DOWNLOAD
 * ============================================================================ */
export const ApkGithubBuilderView: React.FC = () => {
  const androidProjectFiles = getCompleteAndroidProjectFiles();
  const [selectedFileIndex, setSelectedFileIndex] = useState<number>(4); // defaults to MainActivity.java or AndroidManifest.xml
  const [copiedNotice, setCopiedNotice] = useState('');

  // 1-Click GitHub Cloud APK Builder State
  const [githubToken, setGithubToken] = useState('');
  const [githubRepoName, setGithubRepoName] = useState('autodrive-tablet-os');
  const [isPushingGithub, setIsPushingGithub] = useState(false);
  const [githubBuildError, setGithubBuildError] = useState('');
  const [githubBuildSuccess, setGithubBuildSuccess] = useState<{
    repoUrl: string;
    actionsUrl: string;
    releasesUrl: string;
  } | null>(null);

  const activeFile = androidProjectFiles[selectedFileIndex] || androidProjectFiles[0];

  const handleCopyCode = () => {
    navigator.clipboard?.writeText(activeFile.content);
    setCopiedNotice(`Copiato ${activeFile.path} negli appunti!`);
    setTimeout(() => setCopiedNotice(''), 3000);
  };

  const handleDownloadSingleFile = () => {
    const blob = new Blob([activeFile.content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = activeFile.path.split('/').pop() || 'file.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleTriggerGithubCloudApk = async (e: React.FormEvent) => {
    e.preventDefault();
    setGithubBuildError('');
    setGithubBuildSuccess(null);

    if (!githubToken.trim()) {
      setGithubBuildError(
        'Incolla un Token GitHub (premi "Crea Token su GitHub" qui a fianco per crearlo in 5 secondi).'
      );
      return;
    }

    setIsPushingGithub(true);
    try {
      const resp = await fetch('/api/apk/github-cloud-build', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          githubToken: githubToken.trim(),
          repoName: githubRepoName.trim() || 'autodrive-tablet-os',
        }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.success) {
        setGithubBuildError(
          data.error || 'Errore durante la creazione del repository su GitHub.'
        );
      } else {
        setGithubBuildSuccess({
          repoUrl: data.repoUrl,
          actionsUrl: data.actionsUrl,
          releasesUrl: data.releasesUrl,
        });
      }
    } catch (err) {
      setGithubBuildError(
        `Errore di connessione: ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      setIsPushingGithub(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* SECTION 1: 1-CLICK COMPLETE ANDROID PROJECT (.ZIP) & STANDALONE (.HTML) DOWNLOAD */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-blue-500/40 space-y-5">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Archive className="w-5 h-5 text-emerald-400" />
            Scarica l’Intera Applicazione Android (Senza il Sito di AI Studio)
          </h2>
          <p className="text-xs text-slate-300 mt-1 leading-relaxed">
            Quando usi il menu dei 3 puntini di Chrome dentro Google AI Studio, Chrome installa il sito di AI Studio invece della tua app. Qui sotto puoi <strong>scaricare direttamente l’intero progetto nativo Android completo</strong> oppure <strong>far compilare automaticamente il vero file <code>AutoDrive-Tablet-OS.apk</code></strong>:
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Button A: Complete Android Studio + Gradle + Web Project ZIP */}
          <a
            href="/api/apk/download-project-zip"
            download="AutoDrive-Tablet-OS-Android-Complete.zip"
            className="p-5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/50 flex flex-col justify-between gap-3 transition-colors"
          >
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-400">
                  Pacchetto Completo Nativo Android (.ZIP)
                </span>
                <Download className="w-5 h-5 text-emerald-400" />
              </div>
              <h3 className="text-base font-bold text-white">
                Scarica AutoDrive-Tablet-OS-Android-Complete.zip
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Un unico file <code>.zip</code> che contiene <strong>tutta l’applicazione compilata</strong> + la cartella nativa <code>android/</code> (<code>MainActivity.java</code> a schermo intero, <code>WhatsAppNotificationService.java</code>, permessi Metrolist e Gradle) + il workflow automatico per generare l’APK.
              </p>
            </div>
            <div className="pt-2 flex items-center gap-2 text-xs font-bold text-emerald-300">
              <span>Clicca qui per scaricare subito lo .ZIP completo</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </div>
          </a>

          {/* Button B: Single-File Standalone Offline HTML */}
          <a
            href="/api/apk/download-standalone-html"
            download="AutoDrive-Tablet-OS-Standalone.html"
            className="p-5 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/50 flex flex-col justify-between gap-3 transition-colors"
          >
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold uppercase tracking-wider text-blue-400">
                  Eseguibile Unico Offline per Telefono/Tablet (.HTML)
                </span>
                <Smartphone className="w-5 h-5 text-blue-400" />
              </div>
              <h3 className="text-base font-bold text-white">
                Scarica AutoDrive-Tablet-OS-Standalone.html
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Scarica l’intera applicazione fusa in <strong>un singolo file autonomo</strong>. Puoi salvarlo direttamente nella memoria del tuo telefono/tablet Android e aprirlo (o convertirlo in APK con <em>WebCode / APK Creator</em>) senza passare mai da AI Studio.
              </p>
            </div>
            <div className="pt-2 flex items-center gap-2 text-xs font-bold text-blue-300">
              <span>Clicca qui per scaricare il file Standalone sul Telefono</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </div>
          </a>
        </div>
      </div>

      {/* SECTION 2: 1-CLICK CLOUD APK COMPILER VIA GITHUB ACTIONS */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Rocket className="w-5 h-5 text-blue-400" />
              Compilatore Cloud Automatico del File .APK (Senza usare il PC)
            </h2>
            <p className="text-xs text-slate-300 mt-1 max-w-3xl">
              Vuoi ottenere direttamente il file installabile <strong><code>AutoDrive-Tablet-OS.apk</code></strong> firmato sul tuo telefono senza installare Android Studio? Inserisci un Token GitHub qui sotto: il nostro server creerà il repository, caricherà il progetto Android Java nativo e avvierà la compilazione dell’APK sui server di GitHub!
            </p>
          </div>

          <a
            href="https://github.com/settings/tokens/new?scopes=repo,workflow&description=AutoDrive+Tablet+OS+APK+Builder"
            target="_blank"
            rel="noopener noreferrer"
            className="min-h-[42px] px-4 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-blue-400 flex items-center gap-1.5 transition-colors shrink-0"
          >
            <span>1. Ottieni Token su GitHub (spunta repo & workflow)</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

        <form onSubmit={handleTriggerGithubCloudApk} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
          <div className="md:col-span-5">
            <label htmlFor="gh-token-input" className="block text-xs text-slate-400 mb-1">
              GitHub Personal Access Token (permessi: <code>repo</code> + <code>workflow</code>)
            </label>
            <input
              id="gh-token-input"
              type="password"
              value={githubToken}
              onChange={(e) => setGithubToken(e.target.value)}
              placeholder="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              className="w-full min-h-[44px] px-3.5 py-2 text-xs font-mono rounded-xl bg-slate-950 border border-slate-800 text-white"
            />
          </div>

          <div className="md:col-span-4">
            <label htmlFor="gh-repo-input" className="block text-xs text-slate-400 mb-1">
              Nome Repository GitHub da creare
            </label>
            <input
              id="gh-repo-input"
              type="text"
              value={githubRepoName}
              onChange={(e) => setGithubRepoName(e.target.value)}
              placeholder="autodrive-tablet-os"
              className="w-full min-h-[44px] px-3.5 py-2 text-xs font-mono rounded-xl bg-slate-950 border border-slate-800 text-white"
            />
          </div>

          <div className="md:col-span-3">
            <button
              type="submit"
              disabled={isPushingGithub}
              className="w-full min-h-[44px] px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-xs font-bold text-white flex items-center justify-center gap-2 transition-colors"
            >
              <Rocket className="w-4 h-4" />
              {isPushingGithub ? 'Caricamento su GitHub...' : '2. Compila .APK su GitHub'}
            </button>
          </div>
        </form>

        {githubBuildError && (
          <div className="p-3.5 rounded-xl bg-amber-950/60 border border-amber-500/40 text-xs text-amber-300">
            {githubBuildError}
          </div>
        )}

        {githubBuildSuccess && (
          <div className="p-4 rounded-xl bg-emerald-950/60 border border-emerald-500/50 space-y-3">
            <div className="flex items-center gap-2 text-sm font-bold text-emerald-300">
              <CheckCircle2 className="w-5 h-5 shrink-0" />
              <span>
                Progetto Android caricato con successo! GitHub sta compilando <code>AutoDrive-Tablet-OS.apk</code> (richiede ~90 secondi).
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <a
                href={githubBuildSuccess.actionsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[42px] px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white flex items-center gap-1.5"
              >
                <span>Segui Compilazione APK Live (GitHub Actions)</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
              <a
                href={githubBuildSuccess.releasesUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[42px] px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white flex items-center gap-1.5"
              >
                <span>Apri Pagina Download APK (GitHub Releases)</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        )}
      </div>

      {/* SECTION 3: SECURITY & NATIVE CAPABILITIES OVERVIEW */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
          <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
            <ShieldCheck className="w-5 h-5" />
            1. Activity Nativa Fullscreen Landscape
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            <code>MainActivity.java</code> blocca lo schermo in orizzontale (<code>sensorLandscape</code>), mantiene il display sempre acceso in guida (<code>FLAG_KEEP_SCREEN_ON</code>) ed esegue l’app dagli assets interni dell’APK senza alcun browser.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
          <div className="flex items-center gap-2 text-blue-400 font-bold text-sm">
            <ShieldCheck className="w-5 h-5" />
            2. Lancio Nativo Intent Metrolist & Maps
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            Il metodo nativo <code>shouldOverrideUrlLoading</code> in <code>MainActivity.java</code> intercetta gli URI <code>intent:</code> e <code>google.navigation:</code> e avvia direttamente <strong>Metrolist</strong> (<code>com.metrolist.music</code>) e <strong>Google Maps</strong>.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
          <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
            <AlertTriangle className="w-5 h-5" />
            3. Servizio Nativo Notifiche WhatsApp
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            <code>WhatsAppNotificationService.java</code> estende <code>NotificationListenerService</code> di Android per catturare in tempo reale i messaggi WhatsApp in arrivo e leggerli con il sintetizzatore vocale dell’auto.
          </p>
        </div>
      </div>

      {/* SECTION 4: NATIVE ANDROID SOURCE FILES INSPECTOR */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <FileCode className="w-5 h-5 text-blue-400" />
              Codice Sorgente Nativo Android Incluso nello .ZIP ({androidProjectFiles.length} file)
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Tutti questi file sono già inclusi automaticamente quando clicchi su <strong>Scarica AutoDrive-Tablet-OS-Android-Complete.zip</strong> qui sopra.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-950 rounded-xl border border-slate-800">
            {androidProjectFiles.map((file, idx) => (
              <button
                key={file.path}
                type="button"
                onClick={() => setSelectedFileIndex(idx)}
                className={`min-h-[38px] px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                  selectedFileIndex === idx
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {file.path.split('/').pop()}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between bg-slate-950 px-4 py-2.5 rounded-t-xl border border-b-0 border-slate-800">
          <div>
            <span className="font-mono text-xs text-blue-400 block">{activeFile.path}</span>
            <span className="text-[11px] text-slate-400">{activeFile.description}</span>
          </div>
          <div className="flex items-center gap-2">
            {copiedNotice && (
              <span className="text-xs text-emerald-400 font-medium">{copiedNotice}</span>
            )}
            <button
              type="button"
              onClick={handleCopyCode}
              className="min-h-[38px] px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-medium text-slate-200 flex items-center gap-1.5"
            >
              <Copy className="w-3.5 h-3.5" />
              Copia
            </button>
            <button
              type="button"
              onClick={handleDownloadSingleFile}
              className="min-h-[38px] px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              Scarica Singolo
            </button>
          </div>
        </div>

        <pre className="p-4 rounded-b-xl bg-slate-950 border border-slate-800 text-xs font-mono text-slate-200 overflow-x-auto leading-relaxed max-h-[360px]">
          <code>{activeFile.content}</code>
        </pre>
      </div>
    </div>
  );
};
