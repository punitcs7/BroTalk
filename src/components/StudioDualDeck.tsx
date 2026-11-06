import React, { useState, useEffect, useRef } from 'react';
import { Activity, Volume2, Sparkles } from 'lucide-react';
import { AudioTelemetry } from '../types';

interface StudioDualDeckProps {
  telemetry: AudioTelemetry;
  onOpenSoundboardTab?: () => void;
  onPanicStop?: () => void;
}

interface SoundPad {
  id: string;
  name: string;
  icon: string;
  hotkey: string;
  keybind: string;
  color: string;
  glow: string;
  borderColor: string;
  type: string;
}

const SOUND_PADS: SoundPad[] = [
  {
    id: 'airhorn',
    name: 'Airhorn',
    icon: '🎺',
    hotkey: 'NUM1',
    keybind: 'Numpad1',
    color: 'from-amber-500/20 to-orange-500/20 text-amber-300',
    glow: 'shadow-[0_0_15px_rgba(245,158,11,0.35)]',
    borderColor: 'border-amber-500/60 hover:border-amber-400',
    type: 'airhorn',
  },
  {
    id: 'bruh',
    name: 'Bruh Moment',
    icon: '🗿',
    hotkey: 'NUM2',
    keybind: 'Numpad2',
    color: 'from-cyan-500/20 to-blue-500/20 text-cyan-300',
    glow: 'shadow-[0_0_15px_rgba(6,182,212,0.35)]',
    borderColor: 'border-cyan-500/60 hover:border-cyan-400',
    type: 'bruh',
  },
  {
    id: 'gg',
    name: 'GG WP',
    icon: '👑',
    hotkey: 'NUM3',
    keybind: 'Numpad3',
    color: 'from-emerald-500/20 to-teal-500/20 text-emerald-300',
    glow: 'shadow-[0_0_15px_rgba(16,185,129,0.35)]',
    borderColor: 'border-emerald-500/60 hover:border-emerald-400',
    type: 'victory',
  },
  {
    id: 'headshot',
    name: 'Headshot',
    icon: '🎯',
    hotkey: 'NUM4',
    keybind: 'Numpad4',
    color: 'from-rose-500/20 to-red-500/20 text-rose-300',
    glow: 'shadow-[0_0_15px_rgba(244,63,94,0.35)]',
    borderColor: 'border-rose-500/60 hover:border-rose-400',
    type: 'headshot',
  },
  {
    id: 'laugh',
    name: 'Troll Laugh',
    icon: '😂',
    hotkey: 'NUM5',
    keybind: 'Numpad5',
    color: 'from-purple-500/20 to-pink-500/20 text-purple-300',
    glow: 'shadow-[0_0_15px_rgba(168,85,247,0.35)]',
    borderColor: 'border-purple-500/60 hover:border-purple-400',
    type: 'laugh',
  },
  {
    id: 'drumroll',
    name: 'Drum Roll',
    icon: '🥁',
    hotkey: 'NUM6',
    keybind: 'Numpad6',
    color: 'from-blue-500/20 to-indigo-500/20 text-blue-300',
    glow: 'shadow-[0_0_15px_rgba(59,130,246,0.35)]',
    borderColor: 'border-blue-500/60 hover:border-blue-400',
    type: 'drumroll',
  },
  {
    id: 'sadtrombone',
    name: 'Sad Trombone',
    icon: '📉',
    hotkey: 'NUM7',
    keybind: 'Numpad7',
    color: 'from-yellow-500/20 to-amber-500/20 text-yellow-300',
    glow: 'shadow-[0_0_15px_rgba(234,179,8,0.35)]',
    borderColor: 'border-yellow-500/60 hover:border-yellow-400',
    type: 'sadtrombone',
  },
  {
    id: 'siren',
    name: 'Police Siren',
    icon: '🚨',
    hotkey: 'NUM8',
    keybind: 'Numpad8',
    color: 'from-red-500/20 to-rose-500/20 text-red-300',
    glow: 'shadow-[0_0_15px_rgba(239,68,68,0.35)]',
    borderColor: 'border-red-500/60 hover:border-red-400',
    type: 'siren',
  },
  {
    id: 'wow',
    name: 'Anime Wow',
    icon: '✨',
    hotkey: 'NUM9',
    keybind: 'Numpad9',
    color: 'from-fuchsia-500/20 to-pink-500/20 text-fuchsia-300',
    glow: 'shadow-[0_0_15px_rgba(217,70,239,0.35)]',
    borderColor: 'border-fuchsia-500/60 hover:border-fuchsia-400',
    type: 'wow',
  },
  {
    id: 'denied',
    name: 'Denied / Buzzer',
    icon: '⚡',
    hotkey: 'NUM0',
    keybind: 'Numpad0',
    color: 'from-orange-500/20 to-rose-500/20 text-orange-300',
    glow: 'shadow-[0_0_15px_rgba(249,115,22,0.35)]',
    borderColor: 'border-orange-500/60 hover:border-orange-400',
    type: 'denied',
  },
  {
    id: 'levelup',
    name: 'Level Up',
    icon: '🚀',
    hotkey: 'MINUS',
    keybind: 'NumpadSubtract',
    color: 'from-teal-500/20 to-emerald-500/20 text-teal-300',
    glow: 'shadow-[0_0_15px_rgba(20,184,166,0.35)]',
    borderColor: 'border-teal-500/60 hover:border-teal-400',
    type: 'levelup',
  },
  {
    id: 'panic',
    name: 'PANIC STOP',
    icon: '🛑',
    hotkey: 'ESC',
    keybind: 'Escape',
    color: 'from-rose-600/30 to-red-600/30 text-rose-200',
    glow: 'shadow-[0_0_15px_rgba(225,29,72,0.5)]',
    borderColor: 'border-rose-500 hover:border-rose-400',
    type: 'panic',
  },
];

// Web Audio API Procedural Sound Engine for instant gamer sound pads
class WebAudioSFX {
  private ctx: AudioContext | null = null;

  private getContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  public play(type: string, volume: number = 0.8) {
    try {
      const ctx = this.getContext();
      const now = ctx.currentTime;
      const master = ctx.createGain();
      master.gain.setValueAtTime(volume, now);
      master.connect(ctx.destination);

      if (type === 'airhorn') {
        const freqs = [466.16, 466.16, 554.37, 622.25];
        freqs.forEach((f, i) => {
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(f, now);
          g.gain.setValueAtTime(0.2, now);
          g.gain.linearRampToValueAtTime(0.25, now + 0.1);
          g.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
          osc.connect(g);
          g.connect(master);
          osc.start(now + i * 0.05);
          osc.stop(now + 0.5);
        });
      } else if (type === 'bruh') {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(140, now);
        osc.frequency.exponentialRampToValueAtTime(55, now + 0.35);
        g.gain.setValueAtTime(0.4, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        osc.connect(g);
        g.connect(master);
        osc.start(now);
        osc.stop(now + 0.42);
      } else if (type === 'headshot') {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1800, now);
        osc.frequency.exponentialRampToValueAtTime(3200, now + 0.08);
        g.gain.setValueAtTime(0.5, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        osc.connect(g);
        g.connect(master);
        osc.start(now);
        osc.stop(now + 0.28);
      } else if (type === 'victory') {
        [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(f, now + i * 0.08);
          g.gain.setValueAtTime(0.25, now + i * 0.08);
          g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.3);
          osc.connect(g);
          g.connect(master);
          osc.start(now + i * 0.08);
          osc.stop(now + i * 0.08 + 0.32);
        });
      } else if (type === 'sadtrombone') {
        [415.3, 392.0, 369.99, 329.63].forEach((f, i) => {
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = 'sawtooth';
          const t = now + i * 0.2;
          osc.frequency.setValueAtTime(f, t);
          osc.frequency.linearRampToValueAtTime(f - 15, t + 0.18);
          g.gain.setValueAtTime(0.25, t);
          g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
          osc.connect(g);
          g.connect(master);
          osc.start(t);
          osc.stop(t + 0.25);
        });
      } else if (type === 'siren') {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.linearRampToValueAtTime(1100, now + 0.25);
        osc.frequency.linearRampToValueAtTime(600, now + 0.5);
        g.gain.setValueAtTime(0.3, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
        osc.connect(g);
        g.connect(master);
        osc.start(now);
        osc.stop(now + 0.58);
      } else if (type === 'denied') {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(120, now);
        g.gain.setValueAtTime(0.35, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        osc.connect(g);
        g.connect(master);
        osc.start(now);
        osc.stop(now + 0.32);
      } else if (type === 'levelup') {
        [440, 554, 659, 880].forEach((f, i) => {
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = 'sine';
          const t = now + i * 0.06;
          osc.frequency.setValueAtTime(f, t);
          g.gain.setValueAtTime(0.3, t);
          g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
          osc.connect(g);
          g.connect(master);
          osc.start(t);
          osc.stop(t + 0.22);
        });
      } else if (type === 'drumroll') {
        for (let i = 0; i < 12; i++) {
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = 'triangle';
          const t = now + i * 0.035;
          osc.frequency.setValueAtTime(160 + (i % 2) * 20, t);
          g.gain.setValueAtTime(0.25, t);
          g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
          osc.connect(g);
          g.connect(master);
          osc.start(t);
          osc.stop(t + 0.06);
        }
      } else {
        // Default chime
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, now);
        g.gain.setValueAtTime(0.2, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        osc.connect(g);
        g.connect(master);
        osc.start(now);
        osc.stop(now + 0.22);
      }
    } catch (e) {
      console.warn('[WebAudioSFX Error]', e);
    }
  }

  public panicStop() {
    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
    }
  }
}

const sfxEngine = new WebAudioSFX();

export const StudioDualDeck: React.FC<StudioDualDeckProps> = ({
  telemetry,
  onOpenSoundboardTab,
  onPanicStop,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [visualizerMode, setVisualizerMode] = useState<'hybrid' | 'spectrum' | 'oscilloscope'>('hybrid');
  const [sensitivity, setSensitivity] = useState<number>(1.2);
  const [padVolume, setPadVolume] = useState<number>(0.85);
  const [activePadId, setActivePadId] = useState<string | null>(null);

  // Bars frequency history buffer for smooth physics decay
  const barValuesRef = useRef<number[]>(new Array(36).fill(0.05));
  const peakCapsRef = useRef<number[]>(new Array(36).fill(0.05));

  // Canvas 60 FPS animation loop
  useEffect(() => {
    let animId: number;

    const render = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const width = canvas.width;
      const height = canvas.height;

      // Clear with dark subtle fade
      ctx.fillStyle = '#090E17';
      ctx.fillRect(0, 0, width, height);

      // Draw subtle phosphor audio grid lines
      ctx.strokeStyle = 'rgba(15, 30, 50, 0.6)';
      ctx.lineWidth = 1;
      for (let y = 0; y < height; y += height / 4) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Compute live reactive energy from mic level & sine harmonics
      const inputEnergy = Math.max(0.02, (telemetry.input_level || 0) * sensitivity);
      const isVoiceActive = inputEnergy > 0.05;

      const barCount = 36;
      const bars = barValuesRef.current;
      const peaks = peakCapsRef.current;

      // Update frequency bars with organic audio distribution
      for (let i = 0; i < barCount; i++) {
        const centerDist = 1 - Math.abs(i - barCount * 0.4) / (barCount * 0.6);
        const freqWeight = Math.max(0.2, centerDist);
        const targetVal = isVoiceActive
          ? Math.min(1.0, (inputEnergy * freqWeight * (0.6 + Math.sin(Date.now() * 0.008 + i * 0.4) * 0.4)) + Math.random() * 0.08)
          : 0.03 + Math.sin(Date.now() * 0.002 + i * 0.3) * 0.015;

        // Smooth physics: fast attack, smooth decay
        if (targetVal > bars[i]) {
          bars[i] = bars[i] * 0.4 + targetVal * 0.6;
        } else {
          bars[i] = bars[i] * 0.88;
        }

        // Peak caps with gravity drop
        if (bars[i] > peaks[i]) {
          peaks[i] = bars[i];
        } else {
          peaks[i] = Math.max(0.02, peaks[i] - 0.008);
        }
      }

      // Mode: Spectrum or Hybrid
      if (visualizerMode === 'spectrum' || visualizerMode === 'hybrid') {
        const barWidth = width / barCount;
        const gap = 2.5;

        for (let i = 0; i < barCount; i++) {
          const val = bars[i];
          const barHeight = Math.max(4, val * (height * (visualizerMode === 'hybrid' ? 0.75 : 0.88)));
          const x = i * barWidth + gap / 2;
          const y = height - barHeight;

          // Multi-color gradient: Cyan to Emerald to Hot Amber
          const gradient = ctx.createLinearGradient(0, height, 0, y);
          gradient.addColorStop(0, '#06b6d4');
          gradient.addColorStop(0.65, '#10b981');
          gradient.addColorStop(1, '#f59e0b');

          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.roundRect(x, y, barWidth - gap, barHeight, [3, 3, 0, 0]);
          ctx.fill();

          // Peak Cap
          const capY = height - peaks[i] * (height * (visualizerMode === 'hybrid' ? 0.75 : 0.88)) - 2;
          ctx.fillStyle = '#00f2fe';
          ctx.shadowColor = '#00f2fe';
          ctx.shadowBlur = 6;
          ctx.fillRect(x, Math.max(2, capY), barWidth - gap, 2);
          ctx.shadowBlur = 0;
        }
      }

      // Mode: Oscilloscope or Hybrid
      if (visualizerMode === 'oscilloscope' || visualizerMode === 'hybrid') {
        ctx.beginPath();
        const midY = visualizerMode === 'hybrid' ? height * 0.35 : height * 0.5;
        const waveAmp = (visualizerMode === 'hybrid' ? 24 : 45) * (isVoiceActive ? inputEnergy * 1.5 : 0.15);

        for (let x = 0; x < width; x += 2) {
          const progress = x / width;
          const sine1 = Math.sin(progress * 16 + Date.now() * 0.012);
          const sine2 = Math.sin(progress * 32 - Date.now() * 0.008);
          const y = midY + (sine1 * 0.7 + sine2 * 0.3) * waveAmp;

          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }

        ctx.strokeStyle = visualizerMode === 'hybrid' ? '#00ff88' : '#00f2fe';
        ctx.shadowColor = ctx.strokeStyle;
        ctx.shadowBlur = 8;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [visualizerMode, sensitivity, telemetry.input_level]);

  // Sound pad trigger handler
  const handleTriggerPad = (pad: SoundPad) => {
    setActivePadId(pad.id);
    setTimeout(() => setActivePadId(null), 250);

    if (pad.type === 'panic') {
      sfxEngine.panicStop();
      if (onPanicStop) onPanicStop();
    } else {
      sfxEngine.play(pad.type, padVolume);
    }
  };

  // Keyboard shortcut listener for Sound Pads (NumPad 1-9, 0, -, Escape)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      const match = SOUND_PADS.find((p) => p.keybind === e.code);
      if (match) {
        e.preventDefault();
        handleTriggerPad(match);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [padVolume]);

  const inputLevelDb = telemetry.input_level ? (20 * Math.log10(Math.max(0.0001, telemetry.input_level))).toFixed(1) : '-∞';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-full min-h-[290px]">
      {/* =========================================================================
          LEFT DECK: REAL-TIME AUDIO SPECTRUM & OSCILLOSCOPE (5 COLUMNS)
      ========================================================================= */}
      <div className="lg:col-span-5 bg-[#0C1220]/95 rounded-2xl border border-slate-800/90 p-4 flex flex-col justify-between shadow-lg relative overflow-hidden group">
        {/* Ambient Top Glow */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 via-emerald-400 to-transparent"></div>

        {/* Deck Header */}
        <div className="flex items-center justify-between mb-3 z-10">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-cyan-950/80 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shadow-glow-cyan">
              <Activity className="w-4 h-4 animate-pulse" />
            </div>
            <div>
              <h3 className="text-xs font-mono font-bold text-slate-100 uppercase tracking-wide flex items-center gap-2">
                <span>Audio Visualizer</span>
                <span className="text-[10px] text-cyan-400 bg-cyan-950/80 px-1.5 py-0.2 rounded border border-cyan-500/30">
                  60 FPS FFT
                </span>
              </h3>
              <p className="text-[10px] text-slate-400 font-sans">
                Real-time frequency & waveform analyzer
              </p>
            </div>
          </div>

          {/* Mode Switcher Pill */}
          <div className="flex items-center bg-[#131D31] p-0.5 rounded-lg border border-slate-800 text-[10px] font-mono">
            <button
              onClick={() => setVisualizerMode('hybrid')}
              className={`px-2 py-1 rounded transition-all ${
                visualizerMode === 'hybrid'
                  ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Hybrid
            </button>
            <button
              onClick={() => setVisualizerMode('spectrum')}
              className={`px-2 py-1 rounded transition-all ${
                visualizerMode === 'spectrum'
                  ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              FFT
            </button>
            <button
              onClick={() => setVisualizerMode('oscilloscope')}
              className={`px-2 py-1 rounded transition-all ${
                visualizerMode === 'oscilloscope'
                  ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Wave
            </button>
          </div>
        </div>

        {/* 60 FPS HTML5 Canvas Screen */}
        <div className="flex-1 w-full bg-[#070B12] rounded-xl border border-slate-800/80 overflow-hidden relative min-h-[150px] shadow-inner flex items-center justify-center">
          <canvas
            ref={canvasRef}
            width={480}
            height={160}
            className="w-full h-full object-cover"
          />

          {/* Canvas Floating Frequency Labels */}
          <div className="absolute bottom-1 left-2 right-2 flex justify-between text-[9px] font-mono text-slate-500 pointer-events-none select-none">
            <span>60Hz</span>
            <span>250Hz</span>
            <span>1kHz</span>
            <span>4kHz</span>
            <span>16kHz</span>
          </div>

          {/* In-Canvas Latency & Level Watermark */}
          <div className="absolute top-2 right-2 flex items-center gap-2 pointer-events-none select-none">
            <span className="text-[9px] font-mono text-slate-400 bg-slate-950/80 px-1.5 py-0.5 rounded border border-slate-800">
              {telemetry.latency_ms.toFixed(1)}ms MMCSS
            </span>
          </div>
        </div>

        {/* Bottom Visualizer Metrics Strip */}
        <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono">
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Peak:</span>
            <span className="text-emerald-400 font-bold bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-500/30">
              {inputLevelDb} dBFS
            </span>
          </div>

          {/* Sensitivity Slider */}
          <div className="flex items-center gap-2">
            <span className="text-slate-500 text-[10px]">Gain:</span>
            <input
              type="range"
              min="0.5"
              max="2.5"
              step="0.1"
              value={sensitivity}
              onChange={(e) => setSensitivity(parseFloat(e.target.value))}
              className="w-20 accent-cyan-400 h-1 bg-slate-800 rounded-lg cursor-pointer"
            />
            <span className="text-cyan-300 text-[10px] w-6 text-right">
              {sensitivity.toFixed(1)}x
            </span>
          </div>
        </div>
      </div>

      {/* =========================================================================
          RIGHT DECK: 12-PAD RGB ACTION SOUNDBOARD (7 COLUMNS)
      ========================================================================= */}
      <div className="lg:col-span-7 bg-[#0C1220]/95 rounded-2xl border border-slate-800/90 p-4 flex flex-col justify-between shadow-lg relative overflow-hidden">
        {/* Ambient Top Glow */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-cyan-400 to-purple-500"></div>

        {/* Deck Header */}
        <div className="flex items-center justify-between mb-3 z-10">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-purple-950/80 border border-purple-500/40 flex items-center justify-center text-purple-400 shadow-glow-pink">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-mono font-bold text-slate-100 uppercase tracking-wide flex items-center gap-2">
                <span>Quick Soundboard Deck</span>
                <span className="text-[10px] text-purple-300 bg-purple-950/80 px-1.5 py-0.2 rounded border border-purple-500/30">
                  12 RGB PADS
                </span>
              </h3>
              <p className="text-[10px] text-slate-400 font-sans">
                Zero-latency meme triggers • NumPad hotkeys enabled
              </p>
            </div>
          </div>

          {/* Soundboard Master Vol Slider & Tab Opener */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs font-mono text-slate-400">
              <Volume2 className="w-3.5 h-3.5 text-slate-400" />
              <input
                type="range"
                min="0.1"
                max="1.5"
                step="0.05"
                value={padVolume}
                onChange={(e) => setPadVolume(parseFloat(e.target.value))}
                className="w-16 accent-purple-400 h-1 bg-slate-800 rounded-lg cursor-pointer"
              />
              <span className="text-[10px] text-purple-300 w-7">
                {Math.round(padVolume * 100)}%
              </span>
            </div>

            {onOpenSoundboardTab && (
              <button
                onClick={onOpenSoundboardTab}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#142036] hover:bg-[#1A2A47] border border-slate-700 text-slate-300 hover:text-cyan-300 text-[10px] font-mono transition-colors"
                title="Open soundboard manager to add custom audio files"
              >
                <span>Full Library</span>
              </button>
            )}
          </div>
        </div>

        {/* 12 Illuminated RGB Soundboard Pads Grid (4x3 layout) */}
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 flex-1">
          {SOUND_PADS.map((pad) => {
            const isActive = activePadId === pad.id;
            return (
              <button
                key={pad.id}
                onClick={() => handleTriggerPad(pad)}
                className={`relative group rounded-xl p-2 flex flex-col justify-between items-center text-center border transition-all duration-150 overflow-hidden select-none ${
                  pad.borderColor
                } ${
                  isActive
                    ? `scale-95 bg-white/20 ${pad.glow} ring-2 ring-white/50`
                    : `bg-gradient-to-br ${pad.color} hover:scale-[1.02]`
                }`}
              >
                {/* Top Badge: Hotkey */}
                <div className="w-full flex justify-between items-center text-[9px] font-mono text-slate-400 mb-1">
                  <span className="px-1.5 py-0.2 rounded bg-slate-950/70 border border-slate-800 font-bold group-hover:text-white transition-colors">
                    {pad.hotkey}
                  </span>
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-700 group-hover:bg-cyan-400 transition-colors"></span>
                </div>

                {/* Pad Icon & Name */}
                <div className="my-1 flex flex-col items-center">
                  <span className="text-xl group-hover:scale-110 transition-transform duration-150">
                    {pad.icon}
                  </span>
                  <span className="text-[11px] font-mono font-bold tracking-tight text-slate-200 mt-1 truncate max-w-[85px]">
                    {pad.name}
                  </span>
                </div>

                {/* Bottom Active Glow Bar */}
                <div className="w-full h-1 rounded-full bg-slate-900 overflow-hidden mt-1">
                  <div
                    className={`h-full w-full bg-current opacity-70 group-hover:opacity-100 transition-opacity`}
                  ></div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
