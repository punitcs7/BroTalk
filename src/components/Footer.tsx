import React from 'react';
import { Mic, MicOff, ToggleLeft, ToggleRight, Activity, Keyboard } from 'lucide-react';
import { AudioTelemetry } from '../types';

interface FooterProps {
  telemetry: AudioTelemetry;
  onToggleMute: () => void;
  onToggleBypass: () => void;
}

export const Footer: React.FC<FooterProps> = ({
  telemetry,
  onToggleMute,
  onToggleBypass,
}) => {
  return (
    <footer className="bg-brand-dark/95 border-t border-brand-border px-5 py-2.5 backdrop-blur-md flex items-center justify-between text-xs font-mono">
      {/* Left: Quick Global Toggles */}
      <div className="flex items-center gap-3">
        {/* Master Mute Toggle */}
        <button
          onClick={onToggleMute}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border font-bold transition-all ${
            telemetry.is_muted
              ? 'bg-rose-500/20 border-rose-500 text-rose-300 shadow-glow-pink'
              : 'bg-brand-card hover:bg-brand-cardHover border-brand-border text-slate-300'
          }`}
          title="Global Hotkey: Ctrl + Shift + M"
        >
          {telemetry.is_muted ? (
            <>
              <MicOff className="w-3.5 h-3.5 text-rose-400" />
              <span>MUTED</span>
            </>
          ) : (
            <>
              <Mic className="w-3.5 h-3.5 text-brand-lime" />
              <span>MIC LIVE</span>
            </>
          )}
          <span className="text-[10px] text-slate-500 ml-1">Ctrl+Shift+M</span>
        </button>

        {/* Effects Bypass Toggle */}
        <button
          onClick={onToggleBypass}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border font-bold transition-all ${
            telemetry.is_bypassed
              ? 'bg-amber-500/20 border-amber-500 text-amber-300'
              : 'bg-brand-cyan/20 border-brand-cyan text-brand-cyan shadow-glow-cyan'
          }`}
          title="Global Hotkey: Ctrl + Shift + B"
        >
          {telemetry.is_bypassed ? (
            <>
              <ToggleLeft className="w-3.5 h-3.5" />
              <span>FX BYPASSED</span>
            </>
          ) : (
            <>
              <ToggleRight className="w-3.5 h-3.5" />
              <span>FX ACTIVE ({telemetry.active_preset})</span>
            </>
          )}
          <span className="text-[10px] opacity-70 ml-1">Ctrl+Shift+B</span>
        </button>
      </div>

      {/* Center: System Telemetry */}
      <div className="hidden md:flex items-center gap-4 text-slate-400">
        <div className="flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5 text-brand-cyan" />
          <span>DSP Latency:</span>
          <span className="text-slate-200 font-bold">{telemetry.latency_ms.toFixed(1)} ms</span>
        </div>
        <div className="text-slate-600">&bull;</div>
        <div>
          <span>Buffer:</span> <span className="text-slate-200">256 smp</span>
        </div>
        <div className="text-slate-600">&bull;</div>
        <div>
          <span>Rate:</span> <span className="text-slate-200">48.0 kHz</span>
        </div>
      </div>

      {/* Right: Keybind Helper */}
      <div className="flex items-center gap-2 text-[11px] text-slate-400">
        <Keyboard className="w-3.5 h-3.5 text-slate-500" />
        <span className="text-slate-500">Prank Clip:</span>
        <span className="bg-brand-void px-1.5 py-0.5 rounded border border-brand-border text-slate-300">
          Ctrl+Shift+R
        </span>
        <span className="text-slate-500">Inject:</span>
        <span className="bg-brand-void px-1.5 py-0.5 rounded border border-brand-border text-slate-300">
          Ctrl+Shift+P
        </span>
      </div>
    </footer>
  );
};
