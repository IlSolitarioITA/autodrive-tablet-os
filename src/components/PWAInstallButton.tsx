import React, { useState } from 'react';
import { Download, Smartphone, Archive, FileCode, Rocket } from 'lucide-react';
import { usePWAInstall, useOnlineStatus } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  onOpenApkBuilder?: () => void;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  onOpenApkBuilder,
}) => {
  const { isInstallable, install } = usePWAInstall();
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setShowModal(true)}
        className="min-h-[44px] flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 px-4 py-2 text-xs font-semibold text-white transition-colors whitespace-nowrap shrink-0"
      >
        <Download className="w-4 h-4 shrink-0" />
        Scarica APK / App Android
      </button>

      {showModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="pwa-install-dialog-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
        >
          <div className="w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-800 p-6 text-slate-100 space-y-4">
            <div>
              <h3 id="pwa-install-dialog-title" className="text-lg font-bold text-white">
                Scarica AutoDrive Tablet OS su Android (Senza AI Studio)
              </h3>
              <p className="mt-1 text-xs text-slate-300 leading-relaxed">
                Se usi i 3 puntini di Chrome mentre sei dentro AI Studio, Chrome installa il contenitore di Google AI Studio. Usa invece uno dei <strong>3 metodi diretti qui sotto</strong> per scaricare l’intera applicazione autonoma:
              </p>
            </div>

            <div className="space-y-3">
              {/* Option 1: 1-Click GitHub Cloud APK Compiler */}
              <button
                type="button"
                onClick={() => {
                  setShowModal(false);
                  onOpenApkBuilder?.();
                }}
                className="w-full p-4 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/50 text-left flex items-start gap-3 transition-colors"
              >
                <Rocket className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                <div>
                  <span className="text-sm font-bold text-white block">
                    1. Compila il File .APK Nativo nel Cloud (GitHub Actions 1-Click)
                  </span>
                  <span className="text-xs text-slate-300 block mt-0.5">
                    Genera automaticamente il vero file <code>AutoDrive-Tablet-OS.apk</code> firmato con <code>MainActivity.java</code>, permessi Metrolist e servizio WhatsApp, pronto da installare sul telefono.
                  </span>
                </div>
              </button>

              {/* Option 2: Download Complete Android Studio + Gradle ZIP */}
              <a
                href="/api/apk/download-project-zip"
                download="AutoDrive-Tablet-OS-Android-Complete.zip"
                className="w-full p-4 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/50 text-left flex items-start gap-3 transition-colors"
              >
                <Archive className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <span className="text-sm font-bold text-white block">
                    2. Scarica Pacchetto Completo Android (.ZIP con tutti i file)
                  </span>
                  <span className="text-xs text-slate-300 block mt-0.5">
                    Scarica in un unico file <code>.zip</code> l’intera applicazione compilata + la cartella nativa <code>android/</code> (Gradle + Java) + il compilatore automatico APK.
                  </span>
                </div>
              </a>

              {/* Option 3: Download Single-File Standalone Offline HTML */}
              <a
                href="/api/apk/download-standalone-html"
                download="AutoDrive-Tablet-OS-Standalone.html"
                className="w-full p-4 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-left flex items-start gap-3 transition-colors"
              >
                <FileCode className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <span className="text-sm font-bold text-white block">
                    3. Scarica App Autonoma Singolo File (.HTML Offline sul Telefono)
                  </span>
                  <span className="text-xs text-slate-300 block mt-0.5">
                    Scarica direttamente sul telefono un singolo file con tutta l’app incorporata che gira al 100% fuori da AI Studio.
                  </span>
                </div>
              </a>

              {isInstallable && (
                <button
                  type="button"
                  onClick={() => {
                    install();
                    setShowModal(false);
                  }}
                  className="w-full min-h-[44px] px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white flex items-center justify-center gap-2"
                >
                  <Smartphone className="w-4 h-4" />
                  Avvia Prompt Installazione PWA Nativa
                </button>
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="min-h-[42px] px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white transition-colors"
              >
                Chiudi
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-xl bg-amber-600 px-3.5 py-2 text-xs font-semibold text-white shadow-lg">
      <span>Modalità Offline Attiva — Mappe vettoriali e motore vocale locale in uso.</span>
    </div>
  );
};
