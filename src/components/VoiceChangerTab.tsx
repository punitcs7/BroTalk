import React, { useState } from 'react';
import { Sliders, Zap, RotateCcw, Sparkles, Check } from 'lucide-react';
import { DspParams, PresetType } from '../types';

interface VoiceChangerTabProps {
  params: DspParams;
  onChangeParams: (newParams: DspParams) => void;
}

interface PresetCardInfo {
  type: PresetType;
  title: string;
  tagline: string;
  image: string;
  badge: string;
  badgeColor: string;
  hotkey: string;
  gradient: string;
}

const PRESETS: PresetCardInfo[] = [
  {
    type: 'Clean',
    title: 'Clean Mic',
    tagline: 'Natural untouched studio microphone',
    image: '/assets/logo.png',
    badge: 'PASSTHROUGH',
    badgeColor: 'text-slate-400 bg-slate-800/80 border-slate-700',
    hotkey: '0',
    gradient: 'from-slate-700/20 to-transparent',
  },
  {
    type: 'Titan',
    title: 'Titan / Deep Voice',
    tagline: '-6 Semitones & heavy chest sub-bass',
    image: '/assets/presets/titan.png',
    badge: '-6.0 ST & BASS',
    badgeColor: 'text-cyan-300 bg-cyan-950/80 border-cyan-500/40 shadow-glow-cyan',
    hotkey: '1',
    gradient: 'from-cyan-900/30 to-transparent',
  },
  {
    type: 'Helium',
    title: 'Helium / Chipmunk',
    tagline: '+8.5 Semitones high squeak cartoon voice',
    image: '/assets/presets/helium.png',
    badge: '+8.5 ST SQUEAK',
    badgeColor: 'text-emerald-300 bg-emerald-950/80 border-emerald-500/40 shadow-glow-lime',
    hotkey: '2',
    gradient: 'from-emerald-900/30 to-transparent',
  },
  {
    type: 'Robot',
    title: 'Cyber Robot',
    tagline: 'Ring-modulated mechanical cyborg tone',
    image: '/assets/presets/robot.png',
    badge: '120Hz RING MOD',
    badgeColor: 'text-teal-300 bg-teal-950/80 border-teal-500/40',
    hotkey: '3',
    gradient: 'from-teal-900/30 to-transparent',
  },
  {
    type: 'Radio',
    title: 'Tactical Radio',
    tagline: 'Walkie-talkie military bandpass & crunch',
    image: '/assets/presets/radio.png',
    badge: '1.5kHz BANDPASS',
    badgeColor: 'text-amber-300 bg-amber-950/80 border-amber-500/40',
    hotkey: '4',
    gradient: 'from-amber-900/30 to-transparent',
  },
  {
    type: 'Alien',
    title: 'Extraterrestrial',
    tagline: 'LFO pitch vibrato & diode wave shaping',
    image: '/assets/presets/alien.png',
    badge: '7.5Hz LFO WARP',
    badgeColor: 'text-purple-300 bg-purple-950/80 border-purple-500/40',
    hotkey: '5',
    gradient: 'from-purple-900/30 to-transparent',
  },
  {
    type: 'Cathedral',
    title: 'Cathedral Reverb',
    tagline: 'Grand spatial acoustic reverb & echo',
    image: '/assets/presets/cathedral.png',
    badge: 'SCHROEDER FDN',
    badgeColor: 'text-blue-300 bg-blue-950/80 border-blue-500/40',
    hotkey: '6',
    gradient: 'from-blue-900/30 to-transparent',
  },
  {
    type: 'Custom',
    title: 'Custom Shifter',
    tagline: 'User-tuned parametric pitch & formants',
    image: '/assets/logo.png',
    badge: 'CUSTOM DSP',
    badgeColor: 'text-pink-300 bg-pink-950/80 border-pink-500/40 shadow-glow-pink',
    hotkey: '7',
    gradient: 'from-pink-900/30 to-transparent',
  },
];

export const VoiceChangerTab: React.FC<VoiceChangerTabProps> = ({
  params,
  onChangeParams,
}) => {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const selectPreset = (type: PresetType) => {
    let newPitch = params.pitch_semitones;
    let newFormant = params.formant_factor;
    let newCarrier = params.robot_carrier_freq;
    let newDrive = params.radio_drive;
    let newReverb = params.reverb_wet;

    if (type === 'Titan') {
      newPitch = -7.0;
      newFormant = 0.70;
    } else if (type === 'Helium') {
      newPitch = 9.0;
      newFormant = 1.50;
    } else if (type === 'Clean') {
      newPitch = 0.0;
      newFormant = 1.0;
    } else if (type === 'Robot') {
      newPitch = -1.0;
      newFormant = 1.0;
      newCarrier = 120.0;
    } else if (type === 'Radio') {
      newPitch = 0.0;
      newFormant = 1.10;
      newDrive = 3.5;
    } else if (type === 'Alien') {
      newPitch = 2.5;
      newFormant = 1.25;
    } else if (type === 'Cathedral') {
      newPitch = 0.0;
      newFormant = 1.0;
      newReverb = 0.60;
    }

    onChangeParams({
      ...params,
      preset: type,
      pitch_semitones: newPitch,
      formant_factor: newFormant,
      robot_carrier_freq: newCarrier,
      radio_drive: newDrive,
      reverb_wet: newReverb,
      wet_dry_mix: 1.0,
    });
  };

  return (
    <div className="flex flex-col h-full gap-5 p-6 overflow-y-auto bg-[#080C14]">
      {/* Top Section Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Zap className="w-5 h-5 text-cyan-400" />
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-100 font-mono">
              Voice Effect Profiles
            </h2>
            <p className="text-xs text-slate-400 font-sans">
              Click any profile to instantly modulate your microphone stream with &lt;15ms latency.
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-mono font-bold border transition-all ${
            showAdvanced
              ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300 shadow-glow-cyan'
              : 'bg-[#131D31] hover:bg-[#18243E] border-slate-800 text-slate-300'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>{showAdvanced ? 'Hide DSP Controls' : 'Fine-Tuning Controls'}</span>
        </button>
      </div>

      {/* Modern High-End Preset Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {PRESETS.map((p) => {
          const isActive = params.preset === p.type;
          return (
            <div
              key={p.type}
              onClick={() => selectPreset(p.type)}
              className={`relative group rounded-2xl p-4 cursor-pointer transition-all duration-200 border flex flex-col justify-between overflow-hidden ${
                isActive
                  ? 'bg-[#142036] border-cyan-400 shadow-glow-cyan scale-[1.01]'
                  : 'bg-[#0E1526]/90 hover:bg-[#121B2F] border-slate-800/90 hover:border-slate-700'
              }`}
            >
              {/* Subtle Ambient Background Gradient */}
              <div
                className={`absolute inset-0 bg-gradient-to-br ${p.gradient} opacity-50 pointer-events-none`}
              ></div>

              {/* Card Top Row: Image & Keybind Badge */}
              <div className="relative flex items-start gap-3.5 z-10 mb-3">
                {/* Artwork Thumbnail */}
                <div
                  className={`w-16 h-16 rounded-xl overflow-hidden bg-slate-950 flex-shrink-0 border transition-transform duration-300 group-hover:scale-105 ${
                    isActive ? 'border-cyan-400 shadow-md' : 'border-slate-800'
                  }`}
                >
                  <img
                    src={p.image}
                    alt={p.title}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/assets/logo.svg';
                    }}
                  />
                </div>

                {/* Preset Metadata */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span
                      className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border uppercase ${p.badgeColor}`}
                    >
                      {p.badge}
                    </span>
                    <span className="text-[10px] font-mono text-slate-500 bg-slate-900/80 px-1.5 py-0.5 rounded border border-slate-800">
                      Key {p.hotkey}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-slate-100 font-mono tracking-tight truncate">
                    {p.title}
                  </h3>
                  <p className="text-[11px] text-slate-400 font-sans line-clamp-2 mt-0.5 leading-snug">
                    {p.tagline}
                  </p>
                </div>
              </div>

              {/* Card Bottom Row: Active Status Indicator */}
              <div className="relative z-10 pt-2 border-t border-slate-800/60 flex items-center justify-between text-xs font-mono">
                {isActive ? (
                  <div className="flex items-center gap-1.5 text-cyan-400 font-bold text-[11px]">
                    <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
                    <span>ACTIVE PROFILE</span>
                  </div>
                ) : (
                  <span className="text-[11px] text-slate-500 group-hover:text-slate-300 transition-colors">
                    Click to activate
                  </span>
                )}

                {isActive && (
                  <div className="p-1 rounded-full bg-cyan-500/20 text-cyan-400">
                    <Check className="w-3.5 h-3.5" />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Advanced Fine-Tuning Drawer */}
      {showAdvanced && (
        <div className="bg-[#0F172A]/90 border border-slate-800 rounded-2xl p-5 backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-5">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 font-mono">
                Real-Time DSP Parameters ({params.preset})
              </h3>
            </div>
            <button
              onClick={() =>
                onChangeParams({
                  ...params,
                  pitch_semitones: 0.0,
                  formant_factor: 1.0,
                  wet_dry_mix: 1.0,
                  robot_carrier_freq: 120.0,
                  radio_drive: 2.5,
                  reverb_wet: 0.5,
                })
              }
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Defaults</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Pitch Shift Slider */}
            <div className="bg-[#131D31]/80 p-3.5 rounded-xl border border-slate-800">
              <div className="flex justify-between items-center text-xs mb-2 font-mono">
                <span className="text-slate-300 font-medium">Pitch Shift:</span>
                <span className="text-cyan-400 font-bold bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/30">
                  {params.pitch_semitones > 0 ? `+${params.pitch_semitones.toFixed(1)}` : params.pitch_semitones.toFixed(1)} st
                </span>
              </div>
              <input
                type="range"
                min="-12"
                max="12"
                step="0.5"
                value={params.pitch_semitones}
                onChange={(e) =>
                  onChangeParams({
                    ...params,
                    pitch_semitones: parseFloat(e.target.value),
                    preset: 'Custom',
                  })
                }
                className="w-full"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-1.5">
                <span>-12 st (Titan)</span>
                <span>0 (Natural)</span>
                <span>+12 st (Helium)</span>
              </div>
            </div>

            {/* Formant Scaling Slider */}
            <div className="bg-[#131D31]/80 p-3.5 rounded-xl border border-slate-800">
              <div className="flex justify-between items-center text-xs mb-2 font-mono">
                <span className="text-slate-300 font-medium">Formant Scaling:</span>
                <span className="text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
                  {params.formant_factor.toFixed(2)}x
                </span>
              </div>
              <input
                type="range"
                min="0.5"
                max="1.8"
                step="0.05"
                value={params.formant_factor}
                onChange={(e) =>
                  onChangeParams({
                    ...params,
                    formant_factor: parseFloat(e.target.value),
                    preset: 'Custom',
                  })
                }
                className="w-full"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-1.5">
                <span>0.5x (Deep Chest)</span>
                <span>1.0x (Normal)</span>
                <span>1.8x (Child)</span>
              </div>
            </div>

            {/* Robot Carrier Modulation */}
            <div className="bg-[#131D31]/80 p-3.5 rounded-xl border border-slate-800">
              <div className="flex justify-between items-center text-xs mb-2 font-mono">
                <span className="text-slate-300 font-medium">Robot Ring Mod Rate:</span>
                <span className="text-teal-400 font-bold bg-teal-500/10 px-2 py-0.5 rounded border border-teal-500/30">
                  {params.robot_carrier_freq.toFixed(0)} Hz
                </span>
              </div>
              <input
                type="range"
                min="30"
                max="400"
                step="5"
                value={params.robot_carrier_freq}
                onChange={(e) =>
                  onChangeParams({
                    ...params,
                    robot_carrier_freq: parseFloat(e.target.value),
                  })
                }
                className="w-full"
              />
            </div>

            {/* Radio Saturation */}
            <div className="bg-[#131D31]/80 p-3.5 rounded-xl border border-slate-800">
              <div className="flex justify-between items-center text-xs mb-2 font-mono">
                <span className="text-slate-300 font-medium">Radio Crunch / Drive:</span>
                <span className="text-amber-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30">
                  {params.radio_drive.toFixed(1)}x
                </span>
              </div>
              <input
                type="range"
                min="1.0"
                max="8.0"
                step="0.2"
                value={params.radio_drive}
                onChange={(e) =>
                  onChangeParams({
                    ...params,
                    radio_drive: parseFloat(e.target.value),
                  })
                }
                className="w-full"
              />
            </div>

            {/* Cathedral Reverb Wet */}
            <div className="bg-[#131D31]/80 p-3.5 rounded-xl border border-slate-800">
              <div className="flex justify-between items-center text-xs mb-2 font-mono">
                <span className="text-slate-300 font-medium">Reverb Room Decay:</span>
                <span className="text-blue-400 font-bold bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/30">
                  {(params.reverb_wet * 100).toFixed(0)}%
                </span>
              </div>
              <input
                type="range"
                min="0.0"
                max="1.0"
                step="0.05"
                value={params.reverb_wet}
                onChange={(e) =>
                  onChangeParams({
                    ...params,
                    reverb_wet: parseFloat(e.target.value),
                  })
                }
                className="w-full"
              />
            </div>

            {/* Wet / Dry Balance */}
            <div className="bg-[#131D31]/80 p-3.5 rounded-xl border border-slate-800">
              <div className="flex justify-between items-center text-xs mb-2 font-mono">
                <span className="text-slate-300 font-medium">Wet / Dry Balance:</span>
                <span className="text-slate-200 font-bold bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                  {(params.wet_dry_mix * 100).toFixed(0)}%
                </span>
              </div>
              <input
                type="range"
                min="0.0"
                max="1.0"
                step="0.05"
                value={params.wet_dry_mix}
                onChange={(e) =>
                  onChangeParams({
                    ...params,
                    wet_dry_mix: parseFloat(e.target.value),
                  })
                }
                className="w-full"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
