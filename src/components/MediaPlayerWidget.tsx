import React, { useEffect, useRef, useState } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Disc,
  ExternalLink,
  Search,
  Check,
  Terminal,
  Upload,
  Volume2,
} from 'lucide-react';
import {
  MediaAppConfig,
  TrackItem,
  buildAndroidMediaIntent,
} from '../utils/carLogic';

interface MediaPlayerWidgetProps {
  installedApps: MediaAppConfig[];
  activeMusicApp: MediaAppConfig;
  onSelectMusicApp: (app: MediaAppConfig) => void;
  tracks: TrackItem[];
  currentTrack: TrackItem;
  isPlaying: boolean;
  progressSec: number;
  onTogglePlay: () => void;
  onNextTrack: () => void;
  onPrevTrack: () => void;
  onPlaySpecificTrack: (track: TrackItem, app?: MediaAppConfig) => void;
  onAddLocalAudioTrack: (track: TrackItem, objectUrl: string) => void;
  localAudioUrls: Record<string, string>;
  lastGeneratedIntent: string;
}

export const MediaPlayerWidget: React.FC<MediaPlayerWidgetProps> = ({
  installedApps,
  activeMusicApp,
  onSelectMusicApp,
  tracks,
  currentTrack,
  isPlaying,
  progressSec,
  onTogglePlay,
  onNextTrack,
  onPrevTrack,
  onPlaySpecificTrack,
  onAddLocalAudioTrack,
  localAudioUrls,
  lastGeneratedIntent,
}) => {
  const [searchFilter, setSearchFilter] = useState('');
  const [showIntentInspect, setShowIntentInspect] = useState(false);
  const [synthAudioEnabled, setSynthAudioEnabled] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);

  const musicApps = installedApps.filter((a) => a.category === 'music');
  const activeLocalUrl = localAudioUrls[currentTrack.id];

  // Register Android / Browser MediaSession metadata & hardware steering wheel controls
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentTrack.title,
        artist: currentTrack.artist,
        album: `${currentTrack.album} (${activeMusicApp.name})`,
      });
      navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
      navigator.mediaSession.setActionHandler('play', () => {
        if (!isPlaying) onTogglePlay();
      });
      navigator.mediaSession.setActionHandler('pause', () => {
        if (isPlaying) onTogglePlay();
      });
      navigator.mediaSession.setActionHandler('previoustrack', onPrevTrack);
      navigator.mediaSession.setActionHandler('nexttrack', onNextTrack);
    } catch {
      // ignore if browser blocks MediaSession
    }
  }, [currentTrack, activeMusicApp.name, isPlaying, onTogglePlay, onPrevTrack, onNextTrack]);

  // Real HTML5 Audio playback when a local file from the phone is selected
  useEffect(() => {
    const audioEl = audioRef.current;
    if (!audioEl) return;

    if (activeLocalUrl) {
      if (audioEl.src !== activeLocalUrl) {
        audioEl.src = activeLocalUrl;
      }
      if (isPlaying) {
        audioEl.play().catch(() => {
          // user gesture needed
        });
      } else {
        audioEl.pause();
      }
    } else {
      audioEl.pause();
    }
  }, [activeLocalUrl, isPlaying, currentTrack.id]);

  // Optional Web Audio Synthesizer so user can test real car speaker output even without local MP3s
  useEffect(() => {
    if (!synthAudioEnabled || activeLocalUrl || !isPlaying) {
      if (gainNodeRef.current && audioCtxRef.current) {
        gainNodeRef.current.gain.setTargetAtTime(0, audioCtxRef.current.currentTime, 0.05);
      }
      return;
    }

    try {
      const AudioContextClass =
        window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!audioCtxRef.current) {
        const ctx = new AudioContextClass();
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();
        osc1.type = 'sine';
        osc2.type = 'triangle';
        osc1.frequency.value = 220;
        osc2.frequency.value = 329.63;
        gain.gain.value = 0.04;
        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);
        osc1.start();
        osc2.start();
        audioCtxRef.current = ctx;
        gainNodeRef.current = gain;
      }
      if (audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume();
      }
      if (gainNodeRef.current) {
        gainNodeRef.current.gain.setTargetAtTime(0.04, audioCtxRef.current.currentTime, 0.08);
      }
    } catch {
      // ignore audio context restrictions
    }
  }, [synthAudioEnabled, activeLocalUrl, isPlaying, currentTrack.id]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const objectUrl = URL.createObjectURL(file);
    const cleanName = file.name.replace(/\.[^/.]+$/, '');
    const newTrack: TrackItem = {
      id: `local-file-${Date.now()}`,
      title: cleanName,
      artist: 'File Audio Locale Telefono/Tablet',
      album: file.type || 'MP3 / Audio Locale',
      durationSec: 210,
      appId: activeMusicApp.id,
      palette: ['#10B981', '#2563EB'],
    };
    onAddLocalAudioTrack(newTrack, objectUrl);
    e.target.value = '';
  };

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const filteredTracks = tracks.filter(
    (t) =>
      t.title.toLowerCase().includes(searchFilter.toLowerCase()) ||
      t.artist.toLowerCase().includes(searchFilter.toLowerCase())
  );

  const activeIntentUri =
    lastGeneratedIntent ||
    buildAndroidMediaIntent(activeMusicApp, 'PLAY_SEARCH', currentTrack.title);

  return (
    <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col gap-3.5">
      <audio ref={audioRef} className="hidden" />
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Header: Active Player Source & Selector */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Disc className="w-4 h-4 text-pink-400 shrink-0" />
          <span className="font-semibold text-slate-100">{activeMusicApp.name}</span>
          <span aria-hidden="true">·</span>
          <span className="font-mono text-[11px] text-slate-400 truncate max-w-[170px]">
            {activeMusicApp.packageName}
          </span>
        </div>

        {/*Segmented App Source Switcher (Metrolist / VLC / Spotify / Poweramp)*/}
        <div
          role="group"
          aria-label="Seleziona app musicale attiva"
          className="flex items-center gap-1 p-1 bg-slate-950 rounded-xl border border-slate-800 overflow-x-auto"
        >
          {musicApps.map((app) => {
            const isSelected = app.id === activeMusicApp.id;
            return (
              <button
                key={app.id}
                type="button"
                onClick={() => onSelectMusicApp(app)}
                className={`min-h-[38px] px-2.5 py-1 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                  isSelected
                    ? 'bg-slate-800 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {app.name.split(' ')[0]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Track Display + Handcrafted SVG Artwork Container (Zero-Broken-Image Compliant) */}
      <div className="flex items-center gap-4">
        <div
          className="w-20 h-20 rounded-2xl shrink-0 flex items-center justify-center relative overflow-hidden border border-white/10"
          style={{
            background: `linear-gradient(135deg, ${currentTrack.palette[0]}, ${currentTrack.palette[1]})`,
          }}
        >
          <svg
            viewBox="0 0 80 80"
            className="w-16 h-16 opacity-90"
            aria-hidden="true"
          >
            <circle
              cx="40"
              cy="40"
              r="30"
              fill="none"
              stroke="rgba(255,255,255,0.28)"
              strokeWidth="2"
            />
            <circle
              cx="40"
              cy="40"
              r="20"
              fill="none"
              stroke="rgba(255,255,255,0.2)"
              strokeWidth="1.5"
              strokeDasharray="4 4"
            />
            <circle cx="40" cy="40" r="7" fill="rgba(9,13,22,0.85)" />
          </svg>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span>
              {activeLocalUrl
                ? 'Audio Reale dal Dispositivo'
                : activeMusicApp.sourceType === 'sideload_apk'
                ? 'APK Esterno GitHub'
                : 'MediaSession Android'}
            </span>
            <span aria-hidden="true">·</span>
            <span className="truncate">{currentTrack.album}</span>
          </div>
          <h3 className="text-lg font-bold text-white truncate mt-0.5">
            {currentTrack.title}
          </h3>
          <p className="text-sm text-slate-300 truncate">{currentTrack.artist}</p>

          {/* Progress Bar */}
          <div className="mt-2.5">
            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 transition-transform origin-left"
                style={{
                  transform: `scaleX(${Math.min(
                    1,
                    progressSec / Math.max(1, currentTrack.durationSec)
                  )})`,
                }}
              />
            </div>
            <div className="mt-1 flex justify-between text-[11px] font-mono text-slate-400 tabular-nums">
              <span>{formatTime(progressSec)}</span>
              <span>{formatTime(currentTrack.durationSec)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Large Ergonomic Car Touch Transport Controls (>= 48x48px) */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onPrevTrack}
            aria-label="Brano precedente"
            className="min-h-[48px] min-w-[48px] rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-100 flex items-center justify-center transition-colors"
          >
            <SkipBack className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={() => {
              setSynthAudioEnabled(true);
              onTogglePlay();
            }}
            aria-label={isPlaying ? 'Metti in pausa' : 'Riproduci brano'}
            className="min-h-[52px] min-w-[64px] px-5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center gap-2 font-semibold text-sm transition-colors"
          >
            {isPlaying ? (
              <>
                <Pause className="w-5 h-5" />
                <span>Pausa</span>
              </>
            ) : (
              <>
                <Play className="w-5 h-5" />
                <span>Play</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onNextTrack}
            aria-label="Brano successivo"
            className="min-h-[48px] min-w-[48px] rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-100 flex items-center justify-center transition-colors"
          >
            <SkipForward className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="min-h-[44px] px-3 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-xs font-semibold text-emerald-300 flex items-center gap-1.5 transition-colors whitespace-nowrap"
            title="Seleziona un file MP3 o audio reale dalla memoria del tuo telefono/tablet"
          >
            <Upload className="w-3.5 h-3.5" />
            MP3 Telefono
          </button>

          <button
            type="button"
            onClick={() => setShowIntentInspect((v) => !v)}
            className="min-h-[44px] px-2.5 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-xs font-medium text-slate-300 flex items-center gap-1 transition-colors whitespace-nowrap"
          >
            <Terminal className="w-3.5 h-3.5 text-pink-400" />
            Intent
          </button>

          <a
            href={activeIntentUri}
            className="min-h-[44px] px-3 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-blue-400 flex items-center gap-1 transition-colors whitespace-nowrap"
            title={`Avvia realmente ${activeMusicApp.name} sul telefono/tablet Android`}
          >
            <span>Apri {activeMusicApp.name.split(' ')[0]}</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* Optional Android Intent Inspector for Sideloaded Apps (Metrolist) */}
      {showIntentInspect && (
        <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1.5">
          <div className="flex items-center justify-between text-slate-400">
            <span>URI Intent Android (MediaSession / MEDIA_PLAY_FROM_SEARCH):</span>
            <span className="font-mono text-pink-400">{activeMusicApp.serviceComponent}</span>
          </div>
          <code className="block font-mono text-[11px] text-slate-200 break-all bg-slate-900 p-2 rounded-lg">
            {activeIntentUri}
          </code>
        </div>
      )}

      {/* Quick Track & Voice Search Picker */}
      <div className="pt-2 border-t border-slate-800/80 space-y-2">
        <div className="relative">
          <label htmlFor="media-quick-search" className="sr-only">
            Cerca brano su {activeMusicApp.name}
          </label>
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            id="media-quick-search"
            type="text"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder={`Cerca brano in ${activeMusicApp.name} o carica MP3 dal telefono...`}
            className="w-full min-h-[40px] pl-8 pr-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-28 overflow-y-auto pr-1">
          {filteredTracks.map((trk) => {
            const isCurrent = trk.id === currentTrack.id;
            const isLocal = Boolean(localAudioUrls[trk.id]);
            return (
              <button
                key={trk.id}
                type="button"
                onClick={() => {
                  setSynthAudioEnabled(true);
                  onPlaySpecificTrack(trk);
                }}
                className={`min-h-[44px] px-3 py-2 rounded-xl text-left flex items-center justify-between gap-2 transition-colors border ${
                  isCurrent
                    ? 'bg-slate-800/90 border-blue-500/50 text-white'
                    : 'bg-slate-950/70 border-slate-800/80 text-slate-300 hover:bg-slate-800/50'
                }`}
              >
                <div className="min-w-0">
                  <p className="text-xs font-semibold truncate flex items-center gap-1.5">
                    {isLocal && <Volume2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                    <span className="truncate">{trk.title}</span>
                  </p>
                  <p className="text-[11px] text-slate-400 truncate">{trk.artist}</p>
                </div>
                {isCurrent && <Check className="w-4 h-4 text-blue-400 shrink-0" />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
