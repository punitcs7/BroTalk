export type PresetType =
  | 'Clean'
  | 'Titan'
  | 'Helium'
  | 'Robot'
  | 'Radio'
  | 'Alien'
  | 'Cathedral'
  | 'Custom';

export interface DspParams {
  preset: PresetType;
  pitch_semitones: number;
  formant_factor: number;
  wet_dry_mix: number;
  robot_carrier_freq: number;
  radio_drive: number;
  reverb_wet: number;
}

export interface AudioDeviceInfo {
  id: string;
  name: string;
  is_default: boolean;
  is_virtual_cable: boolean;
  is_headphone: boolean;
  default_sample_rate: number;
  default_channels: number;
}

export interface DeviceCatalog {
  input_devices: AudioDeviceInfo[];
  output_devices: AudioDeviceInfo[];
  recommended_input?: string;
  recommended_virtual?: string;
  recommended_monitor?: string;
}

export interface AudioTelemetry {
  input_level: number;
  output_level: number;
  latency_ms: number;
  is_muted: boolean;
  is_bypassed: boolean;
  hear_myself: boolean;
  active_preset: PresetType;
  active_input_name: string;
  active_virtual_name: string;
  active_monitor_name: string;
  engine_error?: string;
}

export interface EchoPrankClipInfo {
  duration_secs: number;
  sample_rate: number;
  channels: number;
  waveform_peaks: number[];
  is_armed: boolean;
}

export interface PlaybackOptions {
  trim_start: number;
  trim_end: number;
  pitch_semitones: number;
  stutter: boolean;
  looping: boolean;
  volume: number;
}

export interface SoundboardSlot {
  id: string;
  name: string;
  file_path: string;
  hotkey?: string;
  volume: number;
  duration_secs: number;
  overlap_mode: 'CutPrevious' | 'Polyphonic';
}

export interface VaultSlotInfo {
  id: string;
  name: string;
  duration_secs: number;
  hotkey: string;
}
