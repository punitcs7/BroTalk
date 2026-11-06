import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { VoiceChangerTab } from './components/VoiceChangerTab';
import { EchoPrankTab } from './components/EchoPrankTab';
import { SoundboardTab } from './components/SoundboardTab';
import { Footer } from './components/Footer';
import { RoutingModal } from './components/RoutingModal';
import {
  DspParams,
  DeviceCatalog,
  AudioTelemetry,
  EchoPrankClipInfo,
  PlaybackOptions,
  SoundboardSlot,
  PresetType,
} from './types';
import { Zap, Disc, Music, AlertTriangle, RefreshCw } from 'lucide-react';
import { useUpdater } from './hooks/useUpdater';

// Check if running inside native Tauri desktop app
export const isTauri = typeof window !== 'undefined' && Boolean((window as any).__TAURI_INTERNALS__);

// Tauri IPC wrapper with browser fallback
async function tauriInvoke<T>(cmd: string, args: Record<string, any> = {}): Promise<T> {
  if (isTauri) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke<T>(cmd, args);
    } catch (err) {
      console.error(`[Tauri IPC Error] ${cmd}:`, err);
    }
  }

  // Browser Fallback (matches Windows system inventory)
  console.debug(`[Browser Mock IPC] ${cmd}:`, args);
  if (cmd === 'get_audio_devices') {
    return {
      input_devices: [
        { id: 'Microphone (Razer Kraken Ultimate)', name: 'Microphone (Razer Kraken Ultimate)', is_default: true, is_virtual_cable: false, is_headphone: true, default_sample_rate: 48000, default_channels: 2 },
        { id: 'Microphone (Realtek(R) Audio)', name: 'Microphone (Realtek(R) Audio)', is_default: false, is_virtual_cable: false, is_headphone: false, default_sample_rate: 48000, default_channels: 2 },
        { id: 'External Microphone (Realtek(R) Audio)', name: 'External Microphone (Realtek(R) Audio)', is_default: false, is_virtual_cable: false, is_headphone: false, default_sample_rate: 48000, default_channels: 2 },
        { id: 'CABLE Output (VB-Audio Virtual Cable)', name: 'CABLE Output (VB-Audio Virtual Cable)', is_default: false, is_virtual_cable: true, is_headphone: false, default_sample_rate: 48000, default_channels: 2 },
      ],
      output_devices: [
        { id: 'Speakers (Razer Kraken Ultimate)', name: 'Speakers (Razer Kraken Ultimate)', is_default: true, is_virtual_cable: false, is_headphone: true, default_sample_rate: 48000, default_channels: 2 },
        { id: 'Speakers (THX Spatial)', name: 'Speakers (THX Spatial)', is_default: false, is_virtual_cable: false, is_headphone: true, default_sample_rate: 48000, default_channels: 8 },
        { id: 'Headphones (Realtek(R) Audio)', name: 'Headphones (Realtek(R) Audio)', is_default: false, is_virtual_cable: false, is_headphone: true, default_sample_rate: 48000, default_channels: 2 },
        { id: 'Speakers (Realtek(R) Audio)', name: 'Speakers (Realtek(R) Audio)', is_default: false, is_virtual_cable: false, is_headphone: false, default_sample_rate: 48000, default_channels: 2 },
        { id: 'XV270U (NVIDIA High Definition Audio)', name: 'XV270U (NVIDIA High Definition Audio)', is_default: false, is_virtual_cable: false, is_headphone: false, default_sample_rate: 48000, default_channels: 2 },
        { id: 'CABLE Input (VB-Audio Virtual Cable)', name: 'CABLE Input (VB-Audio Virtual Cable)', is_default: false, is_virtual_cable: true, is_headphone: false, default_sample_rate: 48000, default_channels: 2 },
      ],
      recommended_input: 'Microphone (Razer Kraken Ultimate)',
      recommended_virtual: 'CABLE Input (VB-Audio Virtual Cable)',
      recommended_monitor: 'Speakers (Razer Kraken Ultimate)',
    } as unknown as T;
  }
  if (cmd === 'get_audio_telemetry') {
    return {
      input_level: 0.0,
      output_level: 0.0,
      latency_ms: 4.8,
      is_muted: false,
      is_bypassed: false,
      hear_myself: true,
      active_preset: 'Clean',
      active_input_name: 'Microphone (Razer Kraken Ultimate)',
      active_virtual_name: 'CABLE Input (VB-Audio Virtual Cable)',
      active_monitor_name: 'Speakers (Razer Kraken Ultimate)',
    } as unknown as T;
  }
    if (cmd === 'echoprank_clip' || cmd === 'echoprank_stop_record') {
      const peaks = Array.from({ length: 120 }, () => Math.random() * 0.85);
      return {
        duration_secs: args.durationSecs || 10.0,
        sample_rate: 48000,
        channels: 2,
        waveform_peaks: peaks,
        is_armed: true,
      } as unknown as T;
    }
  if (cmd === 'soundboard_get_slots') {
    return [] as unknown as T;
  }
  return {} as unknown as T;
}

export const App: React.FC = () => {
  const updater = useUpdater();
  const [activeTab, setActiveTab] = useState<'voice' | 'echoprank' | 'soundboard'>('voice');
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  const [catalog, setCatalog] = useState<DeviceCatalog>({
    input_devices: [],
    output_devices: [],
  });

  const [selectedInput, setSelectedInput] = useState<string>('');
  const [selectedVirtual, setSelectedVirtual] = useState<string>('');
  const [selectedMonitor, setSelectedMonitor] = useState<string>('');
  const [engineErrorMessage, setEngineErrorMessage] = useState<string | null>(null);

  const [telemetry, setTelemetry] = useState<AudioTelemetry>({
    input_level: 0,
    output_level: 0,
    latency_ms: 5.3,
    is_muted: false,
    is_bypassed: false,
    hear_myself: true,
    active_preset: 'Clean',
    active_input_name: '',
    active_virtual_name: '',
    active_monitor_name: '',
  });

  const [dspParams, setDspParams] = useState<DspParams>({
    preset: 'Clean',
    pitch_semitones: 0.0,
    formant_factor: 1.0,
    wet_dry_mix: 1.0,
    robot_carrier_freq: 120.0,
    radio_drive: 2.5,
    reverb_wet: 0.5,
  });

  const [clipInfo, setClipInfo] = useState<EchoPrankClipInfo | null>(null);
  const [soundboardSlots, setSoundboardSlots] = useState<SoundboardSlot[]>([]);
  const [overlapMode, setOverlapMode] = useState<'CutPrevious' | 'Polyphonic'>('CutPrevious');

  // Initial load
  useEffect(() => {
    async function init() {
      try {
        const devices = await tauriInvoke<DeviceCatalog>('get_audio_devices');
        setCatalog(devices);

        const inDev = devices.recommended_input || (devices.input_devices.length > 0 ? String(devices.input_devices[0].id) : '');
        const virtDev = devices.recommended_virtual || (devices.output_devices.find(d => d.is_virtual_cable)?.id || '');
        const monDev = devices.recommended_monitor || (devices.output_devices.find(d => !d.is_virtual_cable)?.id || '');

        setSelectedInput(inDev);
        setSelectedVirtual(String(virtDev));
        setSelectedMonitor(String(monDev));

        await tauriInvoke('set_audio_devices', { inputId: inDev, virtualId: virtDev, monitorId: monDev });
        await tauriInvoke('start_engine');
        setEngineErrorMessage(null);
      } catch (err: any) {
        console.error('Engine startup error:', err);
        setEngineErrorMessage(String(err));
      }

      const slots = await tauriInvoke<SoundboardSlot[]>('soundboard_get_slots');
      setSoundboardSlots(slots);
    }

    init();
  }, []);

  // Telemetry loop
  useEffect(() => {
    const timer = setInterval(async () => {
      try {
        const t = await tauriInvoke<AudioTelemetry>('get_audio_telemetry');
        setTelemetry(t);
        if (t.engine_error) {
          setEngineErrorMessage(t.engine_error);
        }
      } catch (err) {
        // Ignore polling error
      }
    }, 80);

    return () => clearInterval(timer);
  }, []);

  // Keyboard shortcut listener (including 0-7 preset quick-selection)
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      // Don't intercept if user is typing in an input
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      if (e.ctrlKey && e.shiftKey && e.code === 'KeyR') {
        e.preventDefault();
        handleClip(10);
      } else if (e.ctrlKey && e.shiftKey && e.code === 'KeyP') {
        e.preventDefault();
        handlePlayPrank({
          trim_start: 0.0,
          trim_end: 1.0,
          pitch_semitones: 0.0,
          stutter: false,
          looping: false,
          volume: 1.2,
        });
      } else if (e.ctrlKey && e.shiftKey && e.code === 'KeyM') {
        e.preventDefault();
        handleToggleMute();
      } else if (e.ctrlKey && e.shiftKey && e.code === 'KeyB') {
        e.preventDefault();
        handleToggleBypass();
      } else if (e.code === 'Escape') {
        handleStopAllSoundboard();
      } else if (!e.ctrlKey && !e.altKey && !e.shiftKey) {
        // Number keys 0-7 for instant preset selection
        const keyMap: Record<string, PresetType> = {
          '0': 'Clean',
          '1': 'Titan',
          '2': 'Helium',
          '3': 'Robot',
          '4': 'Radio',
          '5': 'Alien',
          '6': 'Cathedral',
          '7': 'Custom',
        };
        if (keyMap[e.key]) {
          const targetPreset = keyMap[e.key];
          let pitch = dspParams.pitch_semitones;
          let formant = dspParams.formant_factor;
          if (targetPreset === 'Titan') { pitch = -6.0; formant = 0.72; }
          else if (targetPreset === 'Helium') { pitch = 8.5; formant = 1.45; }
          else if (targetPreset === 'Clean') { pitch = 0.0; formant = 1.0; }
          else if (targetPreset === 'Robot') { pitch = -1.0; formant = 1.0; }

          handleChangeDspParams({
            ...dspParams,
            preset: targetPreset,
            pitch_semitones: pitch,
            formant_factor: formant,
          });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [telemetry, dspParams]);

  // Handlers
  const handleSelectInput = async (id: string) => {
    setSelectedInput(id);
    try {
      await tauriInvoke('set_audio_devices', { inputId: id, virtualId: selectedVirtual, monitorId: selectedMonitor });
      setEngineErrorMessage(null);
    } catch (e: any) {
      setEngineErrorMessage(String(e));
    }
  };

  const handleSelectVirtual = async (id: string) => {
    setSelectedVirtual(id);
    try {
      await tauriInvoke('set_audio_devices', { inputId: selectedInput, virtualId: id, monitorId: selectedMonitor });
      setEngineErrorMessage(null);
    } catch (e: any) {
      setEngineErrorMessage(String(e));
    }
  };

  const handleSelectMonitor = async (id: string) => {
    setSelectedMonitor(id);
    try {
      await tauriInvoke('set_audio_devices', { inputId: selectedInput, virtualId: selectedVirtual, monitorId: id });
      setEngineErrorMessage(null);
    } catch (e: any) {
      setEngineErrorMessage(String(e));
    }
  };

  const handleRestartEngine = async () => {
    try {
      await tauriInvoke('start_engine');
      setEngineErrorMessage(null);
    } catch (e: any) {
      setEngineErrorMessage(String(e));
    }
  };

  const handleApplyDevices = async () => {
    try {
      await tauriInvoke('set_audio_devices', {
        inputId: selectedInput,
        virtualId: selectedVirtual,
        monitorId: selectedMonitor,
      });
      await tauriInvoke('start_engine');
      setEngineErrorMessage(null);
    } catch (e: any) {
      setEngineErrorMessage(String(e));
      throw e;
    }
  };

  const handleRefreshDevices = async () => {
    try {
      const devices = await tauriInvoke<DeviceCatalog>('get_audio_devices');
      setCatalog(devices);
    } catch (e) {
      console.error(e);
    }
  };

  const handleToggleHearMyself = async () => {
    const nextVal = !telemetry.hear_myself;
    await tauriInvoke('set_hear_myself', { enabled: nextVal });
    setTelemetry((prev) => ({ ...prev, hear_myself: nextVal }));
  };

  const handleToggleMute = async () => {
    const nextVal = !telemetry.is_muted;
    await tauriInvoke('set_master_mute', { muted: nextVal });
    setTelemetry((prev) => ({ ...prev, is_muted: nextVal }));
  };

  const handleToggleBypass = async () => {
    const nextVal = !telemetry.is_bypassed;
    await tauriInvoke('set_effects_bypass', { bypassed: nextVal });
    setTelemetry((prev) => ({ ...prev, is_bypassed: nextVal }));
  };

  const handleChangeDspParams = async (newParams: DspParams) => {
    setDspParams(newParams);
    await tauriInvoke('set_voice_preset', { params: newParams });
  };

  const handleClip = async (seconds: number) => {
    const info = await tauriInvoke<EchoPrankClipInfo>('echoprank_clip', { durationSecs: seconds });
    setClipInfo(info);
    setActiveTab('echoprank');
  };

  const handleStartRecord = async () => {
    await tauriInvoke('echoprank_start_record');
  };

  const handleStopRecord = async () => {
    const info = await tauriInvoke<EchoPrankClipInfo>('echoprank_stop_record');
    setClipInfo(info);
  };

  const handlePlayPrank = async (options: PlaybackOptions) => {
    await tauriInvoke('echoprank_play', { options });
  };

  const handleStopPrank = async () => {
    await tauriInvoke('echoprank_stop');
  };

  const handleLoadSoundboardFile = async (filePath: string) => {
    try {
      const slot = await tauriInvoke<SoundboardSlot>('soundboard_load_file', { path: filePath, slotId: null });
      setSoundboardSlots((prev) => [...prev.filter((s) => s.id !== slot.id), slot]);
    } catch (e: any) {
      alert(`Could not load audio file: ${e}`);
    }
  };

  const handlePlaySoundboardSlot = async (slotId: string) => {
    await tauriInvoke('soundboard_play', { slotId });
  };

  const handleStopAllSoundboard = async () => {
    await tauriInvoke('soundboard_stop_all');
  };

  const handleDeleteSoundboardSlot = async (slotId: string) => {
    await tauriInvoke('soundboard_delete', { slotId });
    setSoundboardSlots((prev) => prev.filter((s) => s.id !== slotId));
  };

  const handleChangeSoundboardVolume = async (slotId: string, volume: number) => {
    await tauriInvoke('soundboard_set_volume', { slotId, volume });
    setSoundboardSlots((prev) =>
      prev.map((s) => (s.id === slotId ? { ...s, volume } : s))
    );
  };

  const handleChangeSoundboardHotkey = async (slotId: string, hotkey?: string) => {
    await tauriInvoke('soundboard_set_hotkey', { slotId, hotkey: hotkey || null });
    setSoundboardSlots((prev) =>
      prev.map((s) => (s.id === slotId ? { ...s, hotkey } : s))
    );
  };

  const handleToggleOverlapMode = () => {
    const nextMode = overlapMode === 'CutPrevious' ? 'Polyphonic' : 'CutPrevious';
    setOverlapMode(nextMode);
  };

  return (
    <div className="flex flex-col h-screen bg-[#080C14] text-slate-100 font-sans select-none overflow-hidden">
      {/* Top 3-Deck Hardware Routing Header */}
      <Header
        catalog={catalog}
        telemetry={telemetry}
        selectedInput={selectedInput}
        selectedVirtual={selectedVirtual}
        selectedMonitor={selectedMonitor}
        onSelectInput={handleSelectInput}
        onSelectVirtual={handleSelectVirtual}
        onSelectMonitor={handleSelectMonitor}
        onToggleHearMyself={handleToggleHearMyself}
        onOpenGuide={() => setIsGuideOpen(true)}
        updater={updater}
      />

      {/* Error Alert Banner if audio device cannot start */}
      {engineErrorMessage && (
        <div className="bg-rose-950/90 border-b border-rose-500/50 px-6 py-2.5 flex items-center justify-between text-xs text-rose-200">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
            <span>
              <strong>Audio Engine Notice:</strong> {engineErrorMessage}
            </span>
          </div>
          <button
            onClick={handleRestartEngine}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-rose-800/80 hover:bg-rose-700 text-white font-mono text-[11px] transition-colors shadow-sm"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Reconnect</span>
          </button>
        </div>
      )}

      {/* Web Browser Preview Warning Banner */}
      {!isTauri && (
        <div className="bg-amber-950/60 border-b border-amber-500/40 px-6 py-2 flex items-center justify-between text-xs text-amber-200">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <span>
              <strong>Web Browser Preview:</strong> You are viewing BroTalk in a web browser. Launch the Windows desktop app (<code>brotalk.exe</code> or <code>npx.cmd @tauri-apps/cli dev</code>) for live WASAPI low-latency hardware DSP & Discord routing.
            </span>
          </div>
        </div>
      )}

      {/* Main Tab Navigation Bar */}
      <div className="bg-[#0B0F19]/90 border-b border-slate-800/80 px-6 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Voice Changer Tab */}
          <button
            onClick={() => setActiveTab('voice')}
            className={`flex items-center gap-2.5 px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all ${
              activeTab === 'voice'
                ? 'bg-cyan-500/20 border border-cyan-400 text-cyan-300 shadow-glow-cyan'
                : 'text-slate-400 hover:text-slate-200 hover:bg-[#131D31]'
            }`}
          >
            <Zap className="w-4 h-4 text-cyan-400" />
            <span>VOICE CHANGER</span>
          </button>

          {/* EchoPrank Sampler Tab */}
          <button
            onClick={() => setActiveTab('echoprank')}
            className={`flex items-center gap-2.5 px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all ${
              activeTab === 'echoprank'
                ? 'bg-rose-500/20 border border-rose-400 text-rose-300 shadow-glow-pink'
                : 'text-slate-400 hover:text-slate-200 hover:bg-[#131D31]'
            }`}
          >
            <Disc className="w-4 h-4 text-rose-400" />
            <span>ECHOPRANK SAMPLER</span>
            {clipInfo?.is_armed && (
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
            )}
          </button>

          {/* Soundboard Tab */}
          <button
            onClick={() => setActiveTab('soundboard')}
            className={`flex items-center gap-2.5 px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all ${
              activeTab === 'soundboard'
                ? 'bg-emerald-500/20 border border-emerald-400 text-emerald-300 shadow-glow-lime'
                : 'text-slate-400 hover:text-slate-200 hover:bg-[#131D31]'
            }`}
          >
            <Music className="w-4 h-4 text-emerald-400" />
            <span>SOUNDBOARD ({soundboardSlots.length})</span>
          </button>
        </div>

        {/* Global Active Preset & Live Routing Pill */}
        <div className="text-[11px] font-mono text-slate-400 flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-slate-400">Piping to:</span>
            <span className="text-emerald-300 font-bold">
              {telemetry.active_virtual_name || selectedVirtual || 'VB-CABLE'}
            </span>
          </div>
          <span className="text-slate-700">|</span>
          <div className="flex items-center gap-1.5">
            <span>Profile:</span>
            <span className="px-2 py-0.5 rounded-md bg-[#131D31] border border-slate-700 text-cyan-300 font-bold">
              {dspParams.preset}
            </span>
          </div>
        </div>
      </div>

      {/* Center Deck Body */}
      <main className="flex-1 overflow-hidden relative">
        {activeTab === 'voice' && (
          <VoiceChangerTab
            params={dspParams}
            onChangeParams={handleChangeDspParams}
          />
        )}

        {activeTab === 'echoprank' && (
          <EchoPrankTab
            clipInfo={clipInfo}
            onClip={handleClip}
            onStartRecord={handleStartRecord}
            onStopRecord={handleStopRecord}
            onPlay={handlePlayPrank}
            onStop={handleStopPrank}
          />
        )}

        {activeTab === 'soundboard' && (
          <SoundboardTab
            slots={soundboardSlots}
            onLoadFile={handleLoadSoundboardFile}
            onPlay={handlePlaySoundboardSlot}
            onStopAll={handleStopAllSoundboard}
            onDeleteSlot={handleDeleteSoundboardSlot}
            onChangeVolume={handleChangeSoundboardVolume}
            onChangeHotkey={handleChangeSoundboardHotkey}
            overlapMode={overlapMode}
            onToggleOverlapMode={handleToggleOverlapMode}
          />
        )}
      </main>

      {/* Bottom Control Footer */}
      <Footer
        telemetry={telemetry}
        onToggleMute={handleToggleMute}
        onToggleBypass={handleToggleBypass}
      />

      {/* Virtual Audio Routing Modal */}
      <RoutingModal
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
        catalog={catalog}
        selectedInput={selectedInput}
        selectedVirtual={selectedVirtual}
        selectedMonitor={selectedMonitor}
        telemetry={telemetry}
        onSelectInput={handleSelectInput}
        onSelectVirtual={handleSelectVirtual}
        onSelectMonitor={handleSelectMonitor}
        onApplyDevices={handleApplyDevices}
        onRefreshDevices={handleRefreshDevices}
      />
    </div>
  );
};
