import React, { useState, useEffect } from 'react';
import {
  Disc,
  Play,
  Square,
  Repeat,
  Radio,
  Clock,
  Sparkles,
  Bookmark,
  Check,
} from 'lucide-react';
import { EchoPrankClipInfo, PlaybackOptions, VaultSlotInfo } from '../types';
import { tauriInvoke } from '../App';

interface EchoPrankTabProps {
  clipInfo: EchoPrankClipInfo | null;
  onClip: (seconds: number) => void;
  onStartRecord: () => void;
  onStopRecord: () => void;
  onPlay: (options: PlaybackOptions) => void;
  onStop: () => void;
  onClipInfoUpdate?: (info: EchoPrankClipInfo) => void;
}

const DEFAULT_VAULT_SLOTS: VaultSlotInfo[] = [
  { id: '1', name: 'Discord Screamer', duration_secs: 3.2, hotkey: 'Ctrl+1' },
  { id: '2', name: 'Party Chat Laugh', duration_secs: 4.8, hotkey: 'Ctrl+2' },
  { id: '3', name: 'Rage Quit Sigh', duration_secs: 2.5, hotkey: 'Ctrl+3' },
  { id: '4', name: 'Whimper / Confusion', duration_secs: 5.0, hotkey: 'Ctrl+4' },
];

export const EchoPrankTab: React.FC<EchoPrankTabProps> = ({
  clipInfo,
  onClip,
  onStartRecord,
  onStopRecord,
  onPlay,
  onStop,
  onClipInfoUpdate,
}) => {
  const [trimStart, setTrimStart] = useState<number>(0.0);
  const [trimEnd, setTrimEnd] = useState<number>(1.0);
  const [pitchSemitones, setPitchSemitones] = useState<number>(0.0);
  const [stutter, setStutter] = useState<boolean>(false);
  const [looping, setLooping] = useState<boolean>(false);
  const [volume, setVolume] = useState<number>(1.2);
  const [isRecording, setIsRecording] = useState<boolean>(false);

  const [vaultSlots, setVaultSlots] = useState<VaultSlotInfo[]>(DEFAULT_VAULT_SLOTS);
  const [activeTriggerId, setActiveTriggerId] = useState<string | null>(null);
  const [savedSlotId, setSavedSlotId] = useState<string | null>(null);

  // Load vault slots from Rust backend if available
  useEffect(() => {
    async function loadVault() {
      try {
        const slots = await tauriInvoke<VaultSlotInfo[]>('echoprank_get_vault_slots');
        if (slots && slots.length > 0) {
          setVaultSlots(slots);
        }
      } catch (e) {
        // Fallback to default presets
      }
    }
    loadVault();
  }, []);

  const handleStartRecording = () => {
    setIsRecording(true);
    onStartRecord();
  };

  const handleStopRecording = () => {
    setIsRecording(false);
    onStopRecord();
  };

  const handlePlay = () => {
    onPlay({
      trim_start: trimStart,
      trim_end: trimEnd,
      pitch_semitones: pitchSemitones,
      stutter,
      looping,
      volume,
    });
  };

  const handleTriggerVaultSlot = async (slotId: string) => {
    setActiveTriggerId(slotId);
    setTimeout(() => setActiveTriggerId(null), 400);

    try {
      const info = await tauriInvoke<EchoPrankClipInfo>('echoprank_play_vault', { slotId });
      if (info && onClipInfoUpdate) {
        onClipInfoUpdate(info);
      }
    } catch (e) {
      console.error('Trigger vault error:', e);
      handlePlay();
    }
  };

  const handleSaveToSlot = async (slotId: string) => {
    if (!clipInfo?.is_armed) {
      alert('No clip currently armed! First click "Clip 10s" or hold record while your friend is talking.');
      return;
    }

    try {
      const updated = await tauriInvoke<VaultSlotInfo>('echoprank_save_vault', {
        slotId,
        name: `Friend Clip ${slotId} (${clipInfo.duration_secs.toFixed(1)}s)`,
      });
      setVaultSlots((prev) => prev.map((s) => (s.id === slotId ? updated : s)));
      setSavedSlotId(slotId);
      setTimeout(() => setSavedSlotId(null), 2000);
    } catch (e) {
      console.error('Save vault slot error:', e);
    }
  };

  // Keyboard shortcut listener for Vault Slots (Ctrl+1, Ctrl+2, Ctrl+3, Ctrl+4)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }
      if (e.ctrlKey && !e.shiftKey && ['1', '2', '3', '4'].includes(e.key)) {
        e.preventDefault();
        handleTriggerVaultSlot(e.key);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [clipInfo]);

  return (
    <div className="flex flex-col h-full gap-5 p-6 overflow-y-auto">
      {/* Top Banner & Mode Selection */}
      <div className="bg-brand-card/80 border border-brand-border rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-brand-pink/10 border border-brand-pink/30 rounded-xl text-brand-pink">
            <Disc className="w-6 h-6 animate-spin" style={{ animationDuration: '8s' }} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-100 font-mono">
                EchoPrank Friend Sampler
              </h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                WASAPI LOOPBACK ACTIVE
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Continuously capturing incoming Discord / party chat voice into a rolling 30s buffer.
            </p>
          </div>
        </div>

        {/* Instant Clip Buttons */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono text-slate-400 mr-1 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-brand-cyan" />
            Clip Last:
          </span>
          <button
            onClick={() => onClip(5)}
            className="px-3 py-1.5 rounded-lg bg-brand-void hover:bg-slate-800 border border-brand-border text-xs font-mono font-bold text-slate-200 transition-colors"
          >
            5s
          </button>
          <button
            onClick={() => onClip(10)}
            className="px-3 py-1.5 rounded-lg bg-brand-cyan/20 hover:bg-brand-cyan/30 border border-brand-cyan text-xs font-mono font-bold text-brand-cyan transition-colors shadow-glow-cyan"
            title="Hotkey: Ctrl + Shift + R"
          >
            10s (Ctrl+Shift+R)
          </button>
          <button
            onClick={() => onClip(15)}
            className="px-3 py-1.5 rounded-lg bg-brand-void hover:bg-slate-800 border border-brand-border text-xs font-mono font-bold text-slate-200 transition-colors"
          >
            15s
          </button>
        </div>
      </div>

      {/* Push to Record Live Capture Button */}
      <div className="flex justify-center">
        <button
          onMouseDown={handleStartRecording}
          onMouseUp={handleStopRecording}
          onTouchStart={handleStartRecording}
          onTouchEnd={handleStopRecording}
          className={`flex items-center gap-3 px-8 py-3.5 rounded-xl border font-mono font-bold text-sm transition-all duration-200 select-none ${
            isRecording
              ? 'bg-rose-600 border-rose-400 text-white shadow-glow-pink scale-95'
              : 'bg-brand-card hover:bg-brand-cardHover border-brand-border text-slate-300 hover:text-white'
          }`}
        >
          <div
            className={`w-3 h-3 rounded-full ${
              isRecording ? 'bg-white animate-ping' : 'bg-rose-500'
            }`}
          ></div>
          <span>
            {isRecording
              ? 'SAMPLING FRIEND VOICE... (RELEASE TO ARM)'
              : 'HOLD TO RECORD FRIEND LIVE (Ctrl + Shift + E)'}
          </span>
        </button>
      </div>

      {/* Armed Prank Pad & Waveform Editor */}
      <div className="bg-brand-card/70 border border-brand-border rounded-xl p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between border-b border-brand-border/60 pb-3">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-brand-lime" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 font-mono">
              Active Prank Pad
            </h3>
            {clipInfo?.is_armed && (
              <span className="text-[10px] px-2 py-0.5 rounded bg-brand-lime/10 text-brand-lime border border-brand-lime/30 font-mono">
                ARMED ({clipInfo.duration_secs.toFixed(1)}s)
              </span>
            )}
          </div>
          <div className="text-[11px] text-slate-400 font-mono">
            Direct Mic Injection: <span className="text-brand-cyan">Ctrl + Shift + P</span>
          </div>
        </div>

        {/* Waveform Visualization Canvas / Bar Display */}
        <div className="relative h-28 bg-brand-void rounded-xl border border-brand-border overflow-hidden p-3 flex items-center justify-center">
          {clipInfo && clipInfo.waveform_peaks.length > 0 ? (
            <div className="w-full h-full flex items-center gap-[2px]">
              {clipInfo.waveform_peaks.map((peak, idx) => {
                const total = clipInfo.waveform_peaks.length;
                const ratio = idx / total;
                const isTrimmed = ratio < trimStart || ratio > trimEnd;
                const heightPct = Math.max(8, Math.min(100, peak * 120));

                return (
                  <div
                    key={idx}
                    className="flex-1 flex items-center justify-center h-full"
                  >
                    <div
                      className={`w-full rounded-full transition-all duration-150 ${
                        isTrimmed
                          ? 'bg-slate-700/40'
                          : 'bg-gradient-to-t from-brand-cyan to-brand-lime shadow-glow-cyan'
                      }`}
                      style={{ height: `${heightPct}%` }}
                    ></div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center text-slate-500 text-xs font-mono">
              [ NO CLIP ARMED - PRESS "CLIP 10s" OR TRIGGER A PRANK VAULT SLOT BELOW ]
            </div>
          )}

          {/* Start and End Trim Markers */}
          {clipInfo?.is_armed && (
            <>
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-brand-cyan"
                style={{ left: `${trimStart * 100}%` }}
              ></div>
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-brand-lime"
                style={{ left: `${trimEnd * 100}%` }}
              ></div>
            </>
          )}
        </div>

        {/* Trimming Handles */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="flex justify-between text-xs text-slate-400 font-mono mb-1">
              <span>Trim Start:</span>
              <span className="text-brand-cyan">{(trimStart * 100).toFixed(0)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="0.9"
              step="0.02"
              value={trimStart}
              onChange={(e) => setTrimStart(parseFloat(e.target.value))}
              className="w-full"
            />
          </div>
          <div>
            <div className="flex justify-between text-xs text-slate-400 font-mono mb-1">
              <span>Trim End:</span>
              <span className="text-brand-lime">{(trimEnd * 100).toFixed(0)}%</span>
            </div>
            <input
              type="range"
              min="0.1"
              max="1"
              step="0.02"
              value={trimEnd}
              onChange={(e) => setTrimEnd(parseFloat(e.target.value))}
              className="w-full"
            />
          </div>
        </div>

        {/* Playback Modifiers */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-brand-void/50 p-3 rounded-lg border border-brand-border/60">
          {/* Pitch Shift Modifier */}
          <div>
            <div className="flex justify-between text-xs text-slate-400 font-mono mb-1">
              <span>Replay Pitch:</span>
              <span className="text-brand-cyan">
                {pitchSemitones > 0 ? `+${pitchSemitones}` : pitchSemitones} st
              </span>
            </div>
            <input
              type="range"
              min="-8"
              max="8"
              step="1"
              value={pitchSemitones}
              onChange={(e) => setPitchSemitones(parseFloat(e.target.value))}
              className="w-full"
            />
          </div>

          {/* Volume Modifier */}
          <div>
            <div className="flex justify-between text-xs text-slate-400 font-mono mb-1">
              <span>Injection Vol:</span>
              <span className="text-brand-lime">{(volume * 100).toFixed(0)}%</span>
            </div>
            <input
              type="range"
              min="0.2"
              max="2.0"
              step="0.1"
              value={volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              className="w-full"
            />
          </div>

          {/* Stutter Glitch Toggle */}
          <div className="flex items-center justify-center">
            <button
              onClick={() => setStutter(!stutter)}
              className={`w-full py-2 px-3 rounded-lg border text-xs font-mono font-bold flex items-center justify-center gap-2 transition-all ${
                stutter
                  ? 'bg-brand-pink/20 border-brand-pink text-brand-pink shadow-glow-pink'
                  : 'bg-brand-card border-brand-border text-slate-400 hover:text-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Stutter Glitch: {stutter ? 'ON' : 'OFF'}</span>
            </button>
          </div>

          {/* Looping Toggle */}
          <div className="flex items-center justify-center">
            <button
              onClick={() => setLooping(!looping)}
              className={`w-full py-2 px-3 rounded-lg border text-xs font-mono font-bold flex items-center justify-center gap-2 transition-all ${
                looping
                  ? 'bg-brand-cyan/20 border-brand-cyan text-brand-cyan shadow-glow-cyan'
                  : 'bg-brand-card border-brand-border text-slate-400 hover:text-white'
              }`}
            >
              <Repeat className="w-3.5 h-3.5" />
              <span>Loop Clip: {looping ? 'ON' : 'OFF'}</span>
            </button>
          </div>
        </div>

        {/* Action Trigger Buttons */}
        <div className="flex items-center justify-between gap-4 pt-2">
          <button
            onClick={onStop}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-brand-border text-xs font-mono text-slate-300 transition-colors"
          >
            <Square className="w-4 h-4 text-rose-400" />
            <span>Stop Replay</span>
          </button>

          <button
            onClick={handlePlay}
            disabled={!clipInfo?.is_armed}
            className="flex-1 flex items-center justify-center gap-3 py-3 rounded-xl bg-gradient-to-r from-brand-cyan to-brand-lime text-slate-950 font-mono font-black text-sm tracking-wider uppercase shadow-glow-cyan hover:brightness-110 active:scale-[0.99] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Play className="w-5 h-5 fill-current" />
            <span>Inject Friend Voice Into Virtual Mic (Ctrl + Shift + P)</span>
          </button>
        </div>
      </div>

      {/* =========================================================================
          LOWER SECTION: ECHOPRANK TAPE VAULT & DISCORD ROUTING TELEMETRY
      ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1">
        {/* Quick Prank Tape Vault (4 Slots) */}
        <div className="lg:col-span-7 bg-[#0C1220]/90 rounded-2xl border border-slate-800/90 p-4 flex flex-col justify-between shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-rose-950/80 border border-rose-500/40 flex items-center justify-center text-rose-400 shadow-glow-pink">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-mono font-bold text-slate-100 uppercase tracking-wide">
                  Prank Tape Vault
                </h4>
                <p className="text-[10px] text-slate-400 font-sans">
                  Instant triggers & quick-save slots for friend voice clips
                </p>
              </div>
            </div>
            <span className="text-[10px] font-mono text-rose-400 bg-rose-950/80 px-2 py-0.5 rounded border border-rose-500/30">
              4 SLOTS LIVE
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1">
            {vaultSlots.map((slot) => {
              const isTriggering = activeTriggerId === slot.id;
              const isJustSaved = savedSlotId === slot.id;

              return (
                <div
                  key={slot.id}
                  className={`bg-[#121B2F]/80 border rounded-xl p-3 flex flex-col justify-between hover:bg-[#18243E] transition-all group ${
                    isTriggering
                      ? 'border-cyan-400 shadow-glow-cyan scale-[1.02]'
                      : 'border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex justify-between items-center text-[10px] font-mono text-slate-400">
                    <span className="font-bold text-white group-hover:text-cyan-300 transition-colors truncate pr-1">
                      {slot.name}
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-cyan-300 font-bold shrink-0">
                      {slot.hotkey}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-[11px] font-mono mt-3 pt-2 border-t border-slate-800/80">
                    <span className="text-slate-500 text-[10px]">
                      {slot.duration_secs.toFixed(1)}s
                    </span>

                    <div className="flex items-center gap-1.5">
                      {/* Save Current Clip Here Button */}
                      <button
                        onClick={() => handleSaveToSlot(slot.id)}
                        disabled={!clipInfo?.is_armed}
                        title="Save currently armed friend voice clip to this vault slot"
                        className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono border transition-all ${
                          isJustSaved
                            ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                            : 'bg-slate-900/80 hover:bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed'
                        }`}
                      >
                        {isJustSaved ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" />
                            <span>Saved</span>
                          </>
                        ) : (
                          <>
                            <Bookmark className="w-3 h-3" />
                            <span>Save Clip</span>
                          </>
                        )}
                      </button>

                      {/* Instant Trigger Button */}
                      <button
                        onClick={() => handleTriggerVaultSlot(slot.id)}
                        className={`flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-mono transition-all font-bold ${
                          isTriggering
                            ? 'bg-cyan-400 text-slate-950 shadow-glow-cyan'
                            : 'bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-300'
                        }`}
                      >
                        <Play className="w-3 h-3 fill-current" />
                        <span>Trigger</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Discord WASAPI Loopback Pipeline Monitor */}
        <div className="lg:col-span-5 bg-[#0C1220]/90 rounded-2xl border border-slate-800/90 p-4 flex flex-col justify-between shadow-lg">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-cyan-950/80 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
                <Radio className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-mono font-bold text-slate-100 uppercase tracking-wide">
                  Loopback Pipeline
                </h4>
                <p className="text-[10px] text-slate-400 font-sans">
                  WASAPI Shared capture signal flow
                </p>
              </div>
            </div>

            <div className="space-y-2 text-xs font-mono">
              <div className="bg-[#121B2F]/80 border border-slate-800 rounded-xl p-2.5 flex items-center justify-between">
                <span className="text-slate-400">1. Friend Audio:</span>
                <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  Headphones Loopback Live
                </span>
              </div>

              <div className="bg-[#121B2F]/80 border border-slate-800 rounded-xl p-2.5 flex items-center justify-between">
                <span className="text-slate-400">2. Circular Buffer:</span>
                <span className="text-cyan-400 font-bold">
                  30s Rolling RAM Ringbuf
                </span>
              </div>

              <div className="bg-[#121B2F]/80 border border-slate-800 rounded-xl p-2.5 flex items-center justify-between">
                <span className="text-slate-400">3. Injection Mic:</span>
                <span className="text-purple-300 font-bold">
                  CABLE Input (Zero Delay)
                </span>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800/80 text-[10px] text-slate-400 font-sans leading-relaxed">
            💡 <strong>How To Prank:</strong> When your friend speaks in Discord, press <kbd className="px-1 py-0.5 rounded bg-slate-900 border border-slate-800 text-cyan-300 font-mono">Ctrl+Shift+R</kbd> to clip the last 10 seconds. Then press <kbd className="px-1 py-0.5 rounded bg-slate-900 border border-slate-800 text-emerald-300 font-mono">Ctrl+Shift+P</kbd> to play their words right back into their ears!
          </div>
        </div>
      </div>
    </div>
  );
};
