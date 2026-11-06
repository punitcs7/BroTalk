import React from 'react';
import {
  Mic,
  Radio,
  Headphones,
  Sliders,
  ChevronDown,
  ShieldCheck,
  RefreshCw,
  Download,
} from 'lucide-react';
import { DeviceCatalog, AudioTelemetry } from '../types';

interface HeaderProps {
  catalog: DeviceCatalog;
  telemetry: AudioTelemetry;
  selectedInput: string;
  selectedVirtual: string;
  selectedMonitor: string;
  onSelectInput: (id: string) => void;
  onSelectVirtual: (id: string) => void;
  onSelectMonitor: (id: string) => void;
  onToggleHearMyself: () => void;
  onOpenGuide: () => void;
  updater?: {
    isChecking: boolean;
    updateAvailable: boolean;
    newVersion: string | null;
    currentVersion: string;
    isDownloading: boolean;
    downloadProgress: number;
    statusMessage: string | null;
    error: string | null;
    checkForUpdates: () => void;
    downloadAndInstall: () => void;
  };
}

export const Header: React.FC<HeaderProps> = ({
  catalog,
  telemetry,
  selectedInput,
  selectedVirtual,
  selectedMonitor,
  onSelectInput,
  onSelectVirtual,
  onSelectMonitor,
  onToggleHearMyself,
  onOpenGuide,
  updater,
}) => {
  // Input & Output levels (0.0 to 1.0)
  const inLevel = Math.min(100, Math.max(0, Math.round(telemetry.input_level * 100)));
  const outLevel = Math.min(100, Math.max(0, Math.round(telemetry.output_level * 100)));

  // Filter output devices for the "Hear Myself" monitor so virtual cables don't clutter the user's headphones
  const monitorOutputs = catalog.output_devices.filter((d) => !d.is_virtual_cable);
  const virtualOutputs = catalog.output_devices.filter((d) => d.is_virtual_cable);

  return (
    <header className="bg-gradient-to-b from-[#0F172A] to-[#0B0F19] border-b border-slate-800/80 px-6 py-3 select-none">
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
        {/* Left: Branding & Status */}
        <div className="flex items-center gap-3.5 flex-shrink-0">
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500 to-emerald-400 rounded-2xl blur-sm opacity-70 group-hover:opacity-100 transition duration-300"></div>
            <img
              src="/assets/logo.png"
              alt="BroTalk Logo"
              className="relative w-11 h-11 rounded-2xl object-cover bg-slate-950 border border-slate-700 shadow-xl"
              onError={(e) => {
                (e.target as HTMLImageElement).src = '/assets/logo.svg';
              }}
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-teal-300 to-emerald-400 font-mono">
                BROTALK
              </span>
              <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-md bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                PRO DSP
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono mt-0.5">
              <span className="flex items-center gap-1 text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                LIVE
              </span>
              <span>&bull;</span>
              <span>WASAPI</span>
              <span>&bull;</span>
              <span className="text-cyan-400 font-bold">{telemetry.latency_ms.toFixed(1)}ms</span>
            </div>
          </div>
        </div>

        {/* Center: 3-Deck Hardware Routing Console */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 flex-1 max-w-4xl">
          {/* Deck 1: Microphone / Headset Input */}
          <div className="bg-[#131D31]/90 hover:bg-[#16233B] border border-slate-800 focus-within:border-cyan-500/70 rounded-xl px-3 py-2 transition-all shadow-sm">
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mb-1">
              <span className="flex items-center gap-1.5 text-cyan-400 font-bold">
                <Mic className="w-3.5 h-3.5" />
                <span>1. MIC / HEADSET</span>
              </span>
              <span className="text-[9px] text-slate-500 font-sans">Hardware In</span>
            </div>
            <div className="relative">
              <select
                value={selectedInput}
                onChange={(e) => onSelectInput(e.target.value)}
                className="w-full bg-transparent text-xs text-slate-200 outline-none pr-5 truncate cursor-pointer font-sans"
              >
                {/* Physical Mics First */}
                <optgroup label="Physical Microphones & Headsets" className="bg-[#0F172A] text-slate-200">
                  {catalog.input_devices
                    .filter((d) => !d.is_virtual_cable)
                    .map((dev) => (
                      <option key={dev.id} value={dev.id}>
                        {dev.is_headphone ? '🎧 ' : '🎙️ '}
                        {dev.name} {dev.is_default ? '(Default)' : ''}
                      </option>
                    ))}
                </optgroup>
                {/* Virtual Devices */}
                {catalog.input_devices.some((d) => d.is_virtual_cable) && (
                  <optgroup label="Virtual Devices (Not recommended for speech)" className="bg-[#0F172A] text-slate-500">
                    {catalog.input_devices
                      .filter((d) => d.is_virtual_cable)
                      .map((dev) => (
                        <option key={dev.id} value={dev.id}>
                          ⚠️ {dev.name}
                        </option>
                      ))}
                  </optgroup>
                )}
              </select>
              <ChevronDown className="w-3 h-3 text-slate-500 absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Deck 2: Virtual Cable Output (Discord Pipe) */}
          <div className="bg-[#131D31]/90 hover:bg-[#16233B] border border-slate-800 focus-within:border-emerald-500/70 rounded-xl px-3 py-2 transition-all shadow-sm">
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mb-1">
              <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
                <Radio className="w-3.5 h-3.5" />
                <span>2. VIRTUAL CABLE</span>
              </span>
              <span className="text-[9px] text-emerald-400 flex items-center gap-0.5 bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/30">
                <ShieldCheck className="w-2.5 h-2.5" />
                Discord Mic
              </span>
            </div>
            <div className="relative">
              <select
                value={selectedVirtual}
                onChange={(e) => onSelectVirtual(e.target.value)}
                className="w-full bg-transparent text-xs text-slate-200 outline-none pr-5 truncate cursor-pointer font-sans"
              >
                {virtualOutputs.length > 0 ? (
                  virtualOutputs.map((dev) => (
                    <option key={dev.id} value={dev.id} className="bg-[#0F172A] text-slate-200">
                      📻 {dev.name}
                    </option>
                  ))
                ) : (
                  <option value="" className="bg-[#0F172A] text-slate-400">
                    No Virtual Cable Detected
                  </option>
                )}
                {/* Fallback all output devices */}
                {virtualOutputs.length === 0 &&
                  catalog.output_devices.map((dev) => (
                    <option key={dev.id} value={dev.id} className="bg-[#0F172A] text-slate-200">
                      {dev.name}
                    </option>
                  ))}
              </select>
              <ChevronDown className="w-3 h-3 text-slate-500 absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Deck 3: Monitor Headphones ("Hear Myself") */}
          <div className="bg-[#131D31]/90 hover:bg-[#16233B] border border-slate-800 focus-within:border-cyan-500/70 rounded-xl px-3 py-2 transition-all shadow-sm">
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mb-1">
              <span className="flex items-center gap-1.5 text-cyan-400 font-bold">
                <Headphones className="w-3.5 h-3.5" />
                <span>3. HEAR MYSELF</span>
              </span>
              <button
                onClick={onToggleHearMyself}
                className={`text-[9px] px-2 py-0.5 rounded font-mono font-bold transition-all ${
                  telemetry.hear_myself
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 shadow-glow-cyan'
                    : 'bg-slate-800 text-slate-500 border border-slate-700'
                }`}
              >
                {telemetry.hear_myself ? 'MONITOR ON' : 'MUTED'}
              </button>
            </div>
            <div className="relative">
              <select
                value={selectedMonitor}
                onChange={(e) => onSelectMonitor(e.target.value)}
                disabled={!telemetry.hear_myself}
                className="w-full bg-transparent text-xs text-slate-200 outline-none pr-5 truncate cursor-pointer disabled:opacity-40 font-sans"
              >
                {monitorOutputs.length > 0 ? (
                  monitorOutputs.map((dev) => (
                    <option key={dev.id} value={dev.id} className="bg-[#0F172A] text-slate-200">
                      {dev.is_headphone ? '🎧 ' : '🔊 '}
                      {dev.name} {dev.is_default ? '(Default)' : ''}
                    </option>
                  ))
                ) : (
                  catalog.output_devices.map((dev) => (
                    <option key={dev.id} value={dev.id} className="bg-[#0F172A] text-slate-200">
                      {dev.name}
                    </option>
                  ))
                )}
              </select>
              <ChevronDown className="w-3 h-3 text-slate-500 absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Right: Broadcast VU Meters & Routing Guide */}
        <div className="flex items-center gap-3.5 flex-shrink-0">
          {/* LED Level Meters */}
          <div className="bg-[#080C14] border border-slate-800 p-2.5 rounded-xl flex flex-col gap-1.5 w-36 shadow-inner">
            {/* Input meter */}
            <div className="flex items-center gap-1.5 text-[9px] font-mono">
              <span className="w-5 text-slate-400">MIC</span>
              <div className="flex-1 h-2 bg-slate-900 rounded-sm overflow-hidden flex items-center p-[1px] border border-slate-800">
                <div
                  className="h-full rounded-sm bg-gradient-to-r from-emerald-500 via-teal-400 to-rose-500 transition-all duration-75"
                  style={{ width: `${inLevel}%` }}
                ></div>
              </div>
              <span className={`text-[8px] w-4 text-right ${inLevel > 85 ? 'text-rose-400 font-bold' : 'text-slate-500'}`}>
                {inLevel > 0 ? `${inLevel}%` : '0'}
              </span>
            </div>
            {/* Output meter */}
            <div className="flex items-center gap-1.5 text-[9px] font-mono">
              <span className="w-5 text-slate-400">OUT</span>
              <div className="flex-1 h-2 bg-slate-900 rounded-sm overflow-hidden flex items-center p-[1px] border border-slate-800">
                <div
                  className="h-full rounded-sm bg-gradient-to-r from-emerald-500 via-cyan-400 to-rose-500 transition-all duration-75"
                  style={{ width: `${outLevel}%` }}
                ></div>
              </div>
              <span className={`text-[8px] w-4 text-right ${outLevel > 85 ? 'text-rose-400 font-bold' : 'text-slate-500'}`}>
                {outLevel > 0 ? `${outLevel}%` : '0'}
              </span>
            </div>
          </div>

          {/* Updater Action Pill */}
          {updater && (
            <>
              {updater.updateAvailable ? (
                <button
                  onClick={updater.downloadAndInstall}
                  disabled={updater.isDownloading}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-emerald-500/25 to-teal-500/25 hover:from-emerald-500/35 hover:to-teal-500/35 border border-emerald-400 text-emerald-300 text-xs font-mono font-bold animate-pulse shadow-glow-lime transition-all"
                  title="Click to install update & restart BroTalk"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-400" />
                  <span>
                    {updater.isDownloading
                      ? `Updating ${updater.downloadProgress}%`
                      : `v${updater.newVersion} Ready!`}
                  </span>
                </button>
              ) : (
                <button
                  onClick={() => updater.checkForUpdates()}
                  disabled={updater.isChecking}
                  className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-slate-300 hover:text-cyan-300 text-xs font-mono transition-all"
                  title={updater.statusMessage || 'Check for GitHub Updates'}
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${
                      updater.isChecking ? 'animate-spin text-cyan-400' : 'text-slate-400'
                    }`}
                  />
                  <span className="hidden sm:inline">
                    {updater.isChecking ? 'Checking...' : updater.statusMessage || 'Updates'}
                  </span>
                </button>
              )}
            </>
          )}

          {/* Configure Devices Button */}
          <button
            onClick={onOpenGuide}
            title="Configure Audio Devices & Virtual Cable Routing"
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-cyan-500/15 to-emerald-500/15 hover:from-cyan-500/25 hover:to-emerald-500/25 border border-cyan-500/40 text-cyan-300 text-xs font-mono font-bold transition-all shadow-glow-cyan"
          >
            <Sliders className="w-4 h-4 text-cyan-400" />
            <span>Devices</span>
          </button>
        </div>
      </div>
    </header>
  );
};
