import React, { useEffect, useRef, useState } from 'react';
import {
  APIProvider,
  Map,
  AdvancedMarker,
  Pin,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import {
  Compass,
  CornerUpRight,
  Navigation,
  Search,
  WifiOff,
  MapPin,
  ExternalLink,
  Layers,
  LocateFixed,
} from 'lucide-react';

export interface PresetDestination {
  id: string;
  label: string;
  address: string;
  coords: { lat: number; lng: number };
  distanceKm: number;
  etaMin: number;
  nextTurnText: string;
  nextTurnDistMeters: number;
}

export const PRESET_DESTINATIONS: PresetDestination[] = [
  {
    id: 'dest-roma',
    label: 'Stazione Roma Termini',
    address: 'Piazza dei Cinquecento, 00185 Roma RM',
    coords: { lat: 41.901, lng: 12.5018 },
    distanceKm: 4.2,
    etaMin: 10,
    nextTurnText: 'Segui le indicazioni per il centro città',
    nextTurnDistMeters: 300,
  },
  {
    id: 'dest-duomo',
    label: 'Piazza del Duomo, Milano',
    address: 'Piazza del Duomo, 20122 Milano MI',
    coords: { lat: 45.4642, lng: 9.19 },
    distanceKm: 4.8,
    etaMin: 11,
    nextTurnText: 'Svolta a destra in Corso Venezia',
    nextTurnDistMeters: 350,
  },
  {
    id: 'dest-napoli',
    label: 'Piazza del Plebiscito, Napoli',
    address: 'Piazza del Plebiscito, 80132 Napoli NA',
    coords: { lat: 40.8358, lng: 14.2486 },
    distanceKm: 5.5,
    etaMin: 14,
    nextTurnText: 'Procedi lungo Corso Umberto I',
    nextTurnDistMeters: 500,
  },
  {
    id: 'dest-bologna',
    label: 'Piazza Maggiore, Bologna',
    address: 'Piazza Maggiore, 40124 Bologna BO',
    coords: { lat: 44.4938, lng: 11.3426 },
    distanceKm: 6.0,
    etaMin: 13,
    nextTurnText: 'Imbocca Viale Indipendenza',
    nextTurnDistMeters: 400,
  },
];

interface LiveGpsMapControllerProps {
  coords: { lat: number; lng: number };
  hasRealGps: boolean;
  recenterTrigger: number;
  onReverseGeocode: (resolvedAddress: string) => void;
}

function LiveGpsMapController({
  coords,
  hasRealGps,
  recenterTrigger,
  onReverseGeocode,
}: LiveGpsMapControllerProps) {
  const map = useMap();
  const geocodingLib = useMapsLibrary('geocoding');
  const lastGeocodedRef = useRef<string>('');

  useEffect(() => {
    if (!map) return;
    if (hasRealGps || recenterTrigger > 0) {
      map.panTo({ lat: coords.lat, lng: coords.lng });
      if (recenterTrigger > 0) {
        map.setZoom(16);
      }
    }
  }, [map, coords.lat, coords.lng, hasRealGps, recenterTrigger]);

  useEffect(() => {
    if (!geocodingLib || !hasRealGps) return;
    const key = `${coords.lat.toFixed(3)},${coords.lng.toFixed(3)}`;
    if (lastGeocodedRef.current === key) return;
    lastGeocodedRef.current = key;

    try {
      const geocoder = new geocodingLib.Geocoder();
      geocoder.geocode({ location: { lat: coords.lat, lng: coords.lng } }, (results, status) => {
        if (status === 'OK' && results && results[0]) {
          const shortAddr = results[0].formatted_address
            .replace(/, Italia$/i, '')
            .replace(/, Italy$/i, '');
          onReverseGeocode(shortAddr);
        }
      });
    } catch {
      // fallback to coordinates if geocoding fails
    }
  }, [geocodingLib, hasRealGps, coords.lat, coords.lng, onReverseGeocode]);

  return null;
}

interface RouteLayerProps {
  origin: { lat: number; lng: number };
  destination: string;
  shouldFitViewport: boolean;
  onRouteComputed: (summary: { distanceKm: number; durationMin: number } | null) => void;
}

function ModernRouteOverlay({
  origin,
  destination,
  shouldFitViewport,
  onRouteComputed,
}: RouteLayerProps) {
  const map = useMap();
  const routesLib = useMapsLibrary('routes');
  const polylinesRef = useRef<google.maps.Polyline[]>([]);

  useEffect(() => {
    if (!routesLib || !map || !destination) return;

    polylinesRef.current.forEach((p) => p.setMap(null));
    polylinesRef.current = [];

    const request = {
      origin,
      destination,
      travelMode: 'DRIVING',
      fields: ['path', 'distanceMeters', 'durationMillis', 'viewport'],
    };

    const RouteClass = (routesLib as unknown as { Route?: { computeRoutes?: (req: unknown) => Promise<{ routes?: Array<{ distanceMeters?: number; durationMillis?: number; viewport?: google.maps.LatLngBounds; createPolylines?: () => google.maps.Polyline[] }> }> } }).Route;

    if (!RouteClass || typeof RouteClass.computeRoutes !== 'function') {
      return;
    }

    RouteClass.computeRoutes(request)
      .then((res) => {
        const primaryRoute = res?.routes?.[0];
        if (!primaryRoute) return;

        if (typeof primaryRoute.createPolylines === 'function') {
          const lines = primaryRoute.createPolylines();
          lines.forEach((line) => {
            line.setOptions({
              strokeColor: '#3B82F6',
              strokeWeight: 6,
            });
            line.setMap(map);
          });
          polylinesRef.current = lines;
        }

        if (shouldFitViewport && primaryRoute.viewport) {
          map.fitBounds(primaryRoute.viewport);
        }

        const distanceKm = Number(((primaryRoute.distanceMeters ?? 4800) / 1000).toFixed(1));
        const durationMin = Math.max(1, Math.round((primaryRoute.durationMillis ?? 660000) / 60000));
        onRouteComputed({ distanceKm, durationMin });
      })
      .catch((err: unknown) => {
        const msg = String(err);
        if (msg.includes('RESOURCE_EXHAUSTED') || msg.includes('429') || msg.includes('OVER_QUERY_LIMIT')) {
          window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
        }
      });

    return () => {
      polylinesRef.current.forEach((p) => p.setMap(null));
      polylinesRef.current = [];
    };
  }, [routesLib, map, origin.lat, origin.lng, destination, shouldFitViewport]);

  return null;
}

interface CarMapStageProps {
  mapMode: 'google_live' | 'offline_vector';
  onChangeMapMode: (mode: 'google_live' | 'offline_vector') => void;
  activeDestination: PresetDestination;
  onSelectDestination: (dest: PresetDestination) => void;
  vehicleSpeedKmh: number;
  currentCoords: { lat: number; lng: number; label: string };
  cachedRegionsCount: number;
  hasRealGps: boolean;
  gpsStatusText: string;
  onRequestRealGps: () => void;
  onResolvedAddress: (addr: string) => void;
}

export const CarMapStage: React.FC<CarMapStageProps> = ({
  mapMode,
  onChangeMapMode,
  activeDestination,
  onSelectDestination,
  vehicleSpeedKmh,
  currentCoords,
  cachedRegionsCount,
  hasRealGps,
  gpsStatusText,
  onRequestRealGps,
  onResolvedAddress,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [liveRouteStats, setLiveRouteStats] = useState<{
    distanceKm: number;
    durationMin: number;
  } | null>(null);
  const [carPulseStep, setCarPulseStep] = useState(0);
  const [recenterCount, setRecenterCount] = useState(0);
  const [userSelectedRoute, setUserSelectedRoute] = useState(false);

  const apiKey = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined) ?? '';
  const hasValidMapsKey = Boolean(apiKey && apiKey !== 'MY_GOOGLE_MAPS_API_KEY');

  useEffect(() => {
    const timer = setInterval(() => {
      setCarPulseStep((prev) => (prev + 1) % 100);
    }, 1200);
    return () => clearInterval(timer);
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;

    setUserSelectedRoute(true);
    const matched = PRESET_DESTINATIONS.find(
      (d) =>
        d.label.toLowerCase().includes(q.toLowerCase()) ||
        d.address.toLowerCase().includes(q.toLowerCase())
    );

    if (matched) {
      onSelectDestination(matched);
    } else {
      onSelectDestination({
        id: `custom-${Date.now()}`,
        label: q,
        address: `${q}, Italia`,
        coords: {
          lat: currentCoords.lat + 0.025,
          lng: currentCoords.lng + 0.03,
        },
        distanceKm: 7.5,
        etaMin: 14,
        nextTurnText: `Procedi verso ${q}`,
        nextTurnDistMeters: 450,
      });
    }
    setSearchQuery('');
  };

  const handleRecenterRealGps = () => {
    setUserSelectedRoute(false);
    onRequestRealGps();
    setRecenterCount((c) => c + 1);
  };

  const displayDistKm = liveRouteStats?.distanceKm ?? activeDestination.distanceKm;
  const displayEtaMin = liveRouteStats?.durationMin ?? activeDestination.etaMin;
  const googleNavIntentUri = `google.navigation:q=${encodeURIComponent(activeDestination.address)}&mode=d`;

  return (
    <div className="relative flex flex-col w-full h-full min-h-[380px] max-h-[640px] rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-900">
      {/* Top Turn-by-Turn & Search HUD Bar */}
      <div className="z-20 flex flex-col gap-2 p-2.5 sm:p-3 bg-slate-950/90 backdrop-blur-md border-b border-slate-800">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          {/* Turn-by-turn primary maneuver */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-blue-600 text-white shrink-0">
              <CornerUpRight className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-baseline gap-1.5">
                <span className="font-mono text-base sm:text-lg font-bold text-white tabular-nums">
                  {activeDestination.nextTurnDistMeters} m
                </span>
                <span className="text-xs text-slate-400">·</span>
                <span className="text-xs font-medium text-blue-400 truncate max-w-[180px] sm:max-w-none">
                  Verso: {activeDestination.label}
                </span>
              </div>
              <p className="text-xs sm:text-sm font-semibold text-slate-100 truncate">
                {activeDestination.nextTurnText}
              </p>
            </div>
          </div>

          {/* Map Engine Switcher + Real GPS Lock Button */}
          <div className="w-full sm:w-auto flex flex-wrap items-center justify-between sm:justify-end gap-1.5">
            <button
              type="button"
              onClick={handleRecenterRealGps}
              className={`min-h-[38px] sm:min-h-[42px] px-2.5 sm:px-3 py-1.5 text-xs font-semibold rounded-xl border transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                hasRealGps
                  ? 'bg-emerald-600/20 border-emerald-500/50 text-emerald-300 hover:bg-emerald-600/30'
                  : 'bg-blue-600 hover:bg-blue-500 border-blue-500 text-white'
              }`}
              title="Attiva e centra il GPS reale del tuo dispositivo"
            >
              <LocateFixed className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="sm:hidden">{hasRealGps ? 'GPS Attivo' : 'Posizione GPS'}</span>
              <span className="hidden sm:inline">
                {hasRealGps ? 'GPS Reale Attivo' : 'Usa Mia Posizione GPS'}
              </span>
            </button>

            <div className="flex items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-xl shrink-0">
              <button
                type="button"
                onClick={() => onChangeMapMode('google_live')}
                className={`min-h-[36px] sm:min-h-[40px] px-2 sm:px-2.5 py-1 text-xs font-medium rounded-lg transition-colors flex items-center gap-1 whitespace-nowrap shrink-0 ${
                  mapMode === 'google_live'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Navigation className="w-3.5 h-3.5" />
                <span>Maps Live</span>
              </button>
              <button
                type="button"
                onClick={() => onChangeMapMode('offline_vector')}
                className={`min-h-[36px] sm:min-h-[40px] px-2 sm:px-2.5 py-1 text-xs font-medium rounded-lg transition-colors flex items-center gap-1 whitespace-nowrap shrink-0 ${
                  mapMode === 'offline_vector'
                    ? 'bg-amber-600 text-white'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Offline ({cachedRegionsCount})</span>
              </button>
            </div>
          </div>
        </div>

        {/* Search Input + Quick Destination Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <form onSubmit={handleSearchSubmit} className="relative flex-1 min-w-[200px]">
            <label htmlFor="car-map-destination-input" className="sr-only">
              Cerca destinazione o indirizzo
            </label>
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="car-map-destination-input"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cerca città o indirizzo..."
              className="w-full min-h-[40px] sm:min-h-[42px] pl-9 pr-14 py-1.5 text-xs bg-slate-900 border border-slate-800 rounded-xl text-white placeholder:text-slate-400 focus:outline-none focus:border-blue-500"
            />
            <button
              type="submit"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 min-h-[30px] px-2.5 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors whitespace-nowrap"
            >
              Vai
            </button>
          </form>

          <div className="flex items-center gap-1.5 overflow-x-auto max-w-full">
            {PRESET_DESTINATIONS.slice(0, 3).map((dest) => {
              const isSelected = activeDestination.id === dest.id;
              return (
                <button
                  key={dest.id}
                  type="button"
                  onClick={() => {
                    setUserSelectedRoute(true);
                    onSelectDestination(dest);
                  }}
                  className={`min-h-[38px] sm:min-h-[42px] px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-medium transition-colors whitespace-nowrap shrink-0 border ${
                    isSelected
                      ? 'bg-slate-800 text-blue-400 border-blue-500/60'
                      : 'bg-slate-900/90 text-slate-300 border-slate-800 hover:bg-slate-800'
                  }`}
                >
                  {dest.label.split(',')[0]}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Map Viewport Container (Explicitly Sized for CF2) */}
      <div className="relative flex-1 w-full min-h-[250px]" style={{ height: '100%' }}>
        {mapMode === 'google_live' && hasValidMapsKey ? (
          <APIProvider apiKey={apiKey} language="it" region="IT">
            <div className="w-full h-full min-h-[280px]" style={{ height: '100%', width: '100%' }}>
              <Map
                defaultCenter={currentCoords}
                defaultZoom={15}
                mapId="DEMO_MAP_ID"
                gestureHandling="greedy"
                disableDefaultUI={true}
                internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
                style={{ width: '100%', height: '100%', minHeight: '280px' }}
              >
                <LiveGpsMapController
                  coords={currentCoords}
                  hasRealGps={hasRealGps}
                  recenterTrigger={recenterCount}
                  onReverseGeocode={onResolvedAddress}
                />
                <AdvancedMarker position={currentCoords} title="La Tua Posizione Attuale">
                  <Pin background="#2563EB" glyphColor="#FFFFFF" borderColor="#1E3A8A" />
                </AdvancedMarker>
                <AdvancedMarker
                  position={activeDestination.coords}
                  title={activeDestination.label}
                >
                  <Pin background="#10B981" glyphColor="#FFFFFF" borderColor="#065F46" />
                </AdvancedMarker>
                <ModernRouteOverlay
                  origin={currentCoords}
                  destination={activeDestination.address}
                  shouldFitViewport={userSelectedRoute}
                  onRouteComputed={setLiveRouteStats}
                />
              </Map>
            </div>
          </APIProvider>
        ) : (
          /* High-Contrast Vector Offline Map Engine (Tunnel / Zero-Data Mode) */
          <div
            data-testid="offline-vector-map-canvas"
            className="relative w-full h-full min-h-[280px] bg-[#0B1220] flex flex-col justify-between overflow-hidden select-none"
          >
            <svg
              className="absolute inset-0 w-full h-full"
              viewBox="0 0 800 450"
              preserveAspectRatio="xMidYMid slice"
              aria-label="Mappa Vettoriale Offline"
            >
              <defs>
                <pattern id="offlineGrid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path
                    d="M 40 0 L 0 0 0 40"
                    fill="none"
                    stroke="#1E293B"
                    strokeWidth="1"
                  />
                </pattern>
              </defs>
              <rect width="800" height="450" fill="url(#offlineGrid)" />

              {/* Secondary urban roads */}
              <path
                d="M 0 110 L 800 110 M 0 280 L 800 280 M 180 0 L 180 450 M 560 0 L 560 450 M 60 420 L 720 40"
                stroke="#1E293B"
                strokeWidth="12"
                strokeLinecap="round"
              />
              {/* Ring highway */}
              <path
                d="M 80 390 Q 260 220 410 210 T 690 85"
                fill="none"
                stroke="#334155"
                strokeWidth="22"
                strokeLinecap="round"
              />
              {/* Active Navigation Vector Route */}
              <path
                d="M 120 365 Q 260 220 410 210 T 665 95"
                fill="none"
                stroke="#3B82F6"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray="12 6"
              />

              {/* Origin Vehicle Puck */}
              <g
                transform={`translate(${140 + (vehicleSpeedKmh > 0 ? (carPulseStep % 25) * 4 : 0)}, ${
                  345 - (vehicleSpeedKmh > 0 ? (carPulseStep % 25) * 2.2 : 0)
                })`}
              >
                <circle r="18" fill="#3B82F6" fillOpacity="0.25" />
                <circle r="10" fill="#3B82F6" stroke="#FFFFFF" strokeWidth="3" />
              </g>

              {/* Destination Marker Pin */}
              <g transform="translate(665, 95)">
                <circle r="16" fill="#10B981" fillOpacity="0.25" />
                <circle r="9" fill="#10B981" stroke="#FFFFFF" strokeWidth="2.5" />
              </g>

              {/* Road Labels */}
              <text x="200" y="102" fill="#64748B" fontSize="11" fontFamily="monospace">
                Cache Vettoriale Locale · {currentCoords.label}
              </text>
              <text x="440" y="268" fill="#94A3B8" fontSize="12" fontWeight="600">
                {activeDestination.label}
              </text>
            </svg>

            <div className="relative z-10 m-3 p-2.5 sm:p-3 rounded-xl bg-slate-950/85 border border-slate-800/90 backdrop-blur-md flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs text-amber-300">
                <WifiOff className="w-4 h-4 shrink-0" />
                <span>
                  Motore Vettoriale Offline Attivo · Tiles su memoria ({cachedRegionsCount} regioni)
                </span>
              </div>
              <span className="text-xs font-mono text-slate-400 tabular-nums">
                GPS: {currentCoords.lat.toFixed(4)}, {currentCoords.lng.toFixed(4)}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Telemetry & Native Intent Bar */}
      <div className="z-20 px-3 sm:px-4 py-2.5 sm:py-3 bg-slate-950/95 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 sm:gap-5">
          {/* Real GPS Speedometer + Limit */}
          <div className="flex items-center gap-2.5">
            <div className="flex flex-col">
              <span className="text-[11px] text-slate-400">
                Velocità {hasRealGps ? '(GPS Reale)' : '(Fermo)'}
              </span>
              <div className="flex items-baseline gap-1">
                <span className="font-mono text-xl sm:text-2xl font-bold text-white tabular-nums">
                  {vehicleSpeedKmh}
                </span>
                <span className="text-xs text-slate-400">km/h</span>
              </div>
            </div>
            <div
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-full border-[3px] border-red-500 bg-white text-slate-950 flex items-center justify-center font-mono text-xs font-extrabold tabular-nums shrink-0"
              title="Limite di velocità"
            >
              50
            </div>
          </div>

          <div className="h-7 w-px bg-slate-800 hidden sm:block" />

          {/* ETA & Remaining Distance + Real GPS Position */}
          <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs">
            <div>
              <span className="text-slate-400 block">ETA</span>
              <span className="font-mono text-sm sm:text-base font-bold text-emerald-400 tabular-nums">
                {displayEtaMin} min
              </span>
            </div>
            <div>
              <span className="text-slate-400 block">Distanza</span>
              <span className="font-mono text-sm sm:text-base font-semibold text-slate-100 tabular-nums">
                {displayDistKm} km
              </span>
            </div>
            <div className="max-w-[180px] sm:max-w-[240px]">
              <span className="text-slate-400 block truncate">{gpsStatusText}</span>
              <span className="text-xs font-medium text-slate-200 flex items-center gap-1 truncate">
                <MapPin className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                <span className="truncate">{currentCoords.label}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Native Google Maps Android Intent Trigger */}
        <div className="flex items-center gap-2">
          <a
            href={googleNavIntentUri}
            className="min-h-[40px] sm:min-h-[44px] px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-medium text-slate-200 flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
            title="Avvia Intent nativo Google Maps su telefono/tablet Android"
          >
            <Compass className="w-4 h-4 text-blue-400" />
            <span>Intent Maps APK</span>
            <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
          </a>
        </div>
      </div>
    </div>
  );
};
