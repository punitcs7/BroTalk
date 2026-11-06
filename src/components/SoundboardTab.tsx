import React, { useState } from 'react';
import {
  Volume2,
  Play,
  Trash2,
  Upload,
  Keyboard,
  Layers,
  ZapOff,
  Music,
  Sparkles,
} from 'lucide-react';
import { SoundboardSlot } from '../types';

interface SoundboardTabProps {
  slots: SoundboardSlot[];
  onLoadFile: (filePath: string) => void;
  onPlay: (slotId: string) => void;
  onStopAll: () => void;
  onDeleteSlot: (slotId: string) => void;
  onChangeVolume: (slotId: string, volume: number) => void;
  onChangeHotkey: (slotId: string, hotkey?: string) => void;
  overlapMode: 'CutPrevious' | 'Polyphonic';
  onToggleOverlapMode: () => void;
}

export const SoundboardTab: React.FC<SoundboardTabProps> = ({
  slots,
  onLoadFile,
  onPlay,
  onStopAll,
  onDeleteSlot,
  onChangeVolume,
  onChangeHotkey,
  overlapMode,
  onToggleOverlapMode,
}) => {
  const [editingHotkeyId, setEditingHotkeyId] = useState<string | null>(null);
  const [filePathInput, setFilePathInput] = useState<string>('');

  const handleAddPath = (e: React.FormEvent) => {
    e.preventDefault();
    if (filePathInput.trim()) {
      onLoadFile(filePathInput.trim());
      setFilePathInput('');
    }
  };

  const handleKeyDownHotkey = (e: React.KeyboardEvent, slotId: string) => {
    e.preventDefault();
    if (e.key === 'Escape') {
      onChangeHotkey(slotId, undefined);
      setEditingHotkeyId(null);
      return;
    }

    let keyString = '';
    if (e.ctrlKey) keyString += 'Ctrl+';
    if (e.shiftKey) keyString += 'Shift+';
    if (e.altKey) keyString += 'Alt+';

    if (!['Control', 'Shift', 'Alt'].includes(e.key)) {
      keyString += e.key.toUpperCase();
      onChangeHotkey(slotId, keyString);
      setEditingHotkeyId(null);
    }
  };

  return (
    <div className="flex flex-col h-full gap-5 p-6 overflow-y-auto">
      {/* Top Action Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-brand-card/80 border border-brand-border rounded-xl p-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-brand-cyan/10 border border-brand-cyan/30 rounded-xl text-brand-cyan">
            <Music className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-100 font-mono">
              In-Memory Soundboard
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Decoded to raw PCM f32 in RAM for zero-latency instant hotkey triggering.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Overlap Mode Toggle */}
          <button
            onClick={onToggleOverlapMode}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-mono font-bold transition-all ${
              overlapMode === 'Polyphonic'
                ? 'bg-purple-500/20 border-purple-500 text-purple-300'
                : 'bg-brand-void border-brand-border text-slate-300'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Overlap: {overlapMode === 'CutPrevious' ? 'Cut Off' : 'Polyphonic'}</span>
          </button>

          {/* Panic Stop Button */}
          <button
            onClick={onStopAll}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500 text-xs font-mono font-bold text-rose-300 transition-all shadow-glow-pink"
            title="Hotkey: Esc"
          >
            <ZapOff className="w-3.5 h-3.5" />
            <span>PANIC STOP (Esc)</span>
          </button>
        </div>
      </div>

      {/* File Dropzone & Path Loader */}
      <form
        onSubmit={handleAddPath}
        className="flex items-center gap-3 bg-brand-void/80 border border-brand-border rounded-xl p-3"
      >
        <Upload className="w-4 h-4 text-brand-cyan ml-1 flex-shrink-0" />
        <input
          type="text"
          placeholder="Paste or type audio file path (e.g. C:\Sounds\airhorn.mp3, .wav, .ogg, .flac)..."
          value={filePathInput}
          onChange={(e) => setFilePathInput(e.target.value)}
          className="flex-1 bg-transparent text-xs text-slate-200 outline-none font-mono"
        />
        <button
          type="submit"
          className="px-4 py-1.5 rounded-lg bg-brand-cyan/20 hover:bg-brand-cyan/30 border border-brand-cyan text-xs font-mono font-bold text-brand-cyan transition-colors"
        >
          Load Sound
        </button>
      </form>

      {/* Soundboard Slots Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {slots.length === 0 ? (
          <div className="col-span-full space-y-4">
            <div className="py-8 px-6 flex flex-col items-center justify-center text-center text-slate-500 bg-[#0C1220]/60 rounded-2xl border border-dashed border-slate-800">
              <div className="w-12 h-12 rounded-xl bg-emerald-950/60 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-3 shadow-glow-lime">
                <Music className="w-6 h-6" />
              </div>
              <p className="text-sm font-mono font-bold text-slate-200">Custom Soundboard Bank (In-Memory PCM)</p>
              <p className="text-xs text-slate-400 mt-1 max-w-md font-sans">
                Paste any local audio path above (e.g. <code>C:\Sounds\meme.mp3</code>) to arm custom sound clips. Audio is decoded with <code>symphonia</code> into raw RAM for zero-latency instant hotkeys.
              </p>
            </div>

            {/* Quick Starter Sound Pack */}
            <div className="bg-[#0C1220]/90 rounded-2xl border border-slate-800/90 p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-cyan-400" />
                  <h4 className="text-xs font-mono font-bold text-slate-200 uppercase tracking-wide">
                    Suggested Soundboard Hotkeys
                  </h4>
                </div>
                <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-500/30">
                  READY FOR CUSTOM FILES
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                {[
                  { name: 'Airhorn Blast', file: 'C:\Sounds\airhorn.mp3', hotkey: 'NUM1', badge: 'Meme' },
                  { name: 'Bruh Sound #2', file: 'C:\Sounds\bruh.mp3', hotkey: 'NUM2', badge: 'Reaction' },
                  { name: 'Victory Horn', file: 'C:\Sounds\victory.mp3', hotkey: 'NUM3', badge: 'Win' },
                  { name: 'Sad Trombone', file: 'C:\Sounds\trombone.mp3', hotkey: 'NUM4', badge: 'Fail' },
                ].map((item, idx) => (
                  <div
                    key={idx}
                    className="bg-[#121B2F]/80 border border-slate-800/80 hover:border-slate-700 rounded-xl p-3 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex justify-between items-center text-[10px] font-mono mb-1">
                        <span className="text-emerald-400 font-bold">{item.badge}</span>
                        <span className="px-1.5 py-0.2 rounded bg-slate-900 border border-slate-800 text-slate-400 font-bold">{item.hotkey}</span>
                      </div>
                      <h5 className="text-xs font-bold text-slate-200 font-mono">{item.name}</h5>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFilePathInput(item.file)}
                      className="mt-3 w-full py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-[10px] font-mono text-slate-300 transition-colors"
                    >
                      Use Sample Path
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          slots.map((slot) => (
            <div
              key={slot.id}
              className="bg-brand-card/60 hover:bg-brand-card border border-brand-border hover:border-slate-600 rounded-xl p-4 flex flex-col justify-between gap-3 transition-all duration-150 group"
            >
              {/* Slot Header */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h4 className="text-xs font-bold text-slate-200 font-mono truncate" title={slot.name}>
                    {slot.name}
                  </h4>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {slot.duration_secs.toFixed(1)}s
                  </span>
                </div>
                <button
                  onClick={() => onDeleteSlot(slot.id)}
                  className="text-slate-500 hover:text-rose-400 p-1 rounded transition-colors"
                  title="Remove sound"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Volume Slider */}
              <div className="flex items-center gap-2">
                <Volume2 className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.05"
                  value={slot.volume}
                  onChange={(e) => onChangeVolume(slot.id, parseFloat(e.target.value))}
                  className="flex-1"
                />
                <span className="text-[10px] font-mono text-slate-400 w-8 text-right">
                  {Math.round(slot.volume * 100)}%
                </span>
              </div>

              {/* Bottom Row: Hotkey & Play Trigger */}
              <div className="flex items-center justify-between gap-2 pt-1 border-t border-brand-border/40">
                {/* Hotkey Badge */}
                {editingHotkeyId === slot.id ? (
                  <input
                    type="text"
                    autoFocus
                    placeholder="Press hotkey..."
                    onKeyDown={(e) => handleKeyDownHotkey(e, slot.id)}
                    onBlur={() => setEditingHotkeyId(null)}
                    className="w-24 px-2 py-1 rounded bg-brand-void border border-brand-cyan text-[10px] font-mono text-brand-cyan text-center outline-none animate-pulse"
                  />
                ) : (
                  <button
                    onClick={() => setEditingHotkeyId(slot.id)}
                    className="flex items-center gap-1.5 px-2 py-1 rounded bg-brand-void hover:bg-slate-800 border border-brand-border text-[10px] font-mono text-slate-300 hover:text-brand-cyan transition-colors"
                    title="Click to assign hotkey"
                  >
                    <Keyboard className="w-3 h-3" />
                    <span>{slot.hotkey || 'Set Key'}</span>
                  </button>
                )}

                {/* Instant Play Button */}
                <button
                  onClick={() => onPlay(slot.id)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-brand-cyan/20 hover:bg-brand-cyan/30 border border-brand-cyan text-brand-cyan font-mono font-bold text-xs transition-all shadow-glow-cyan active:scale-95"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>PLAY</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
