use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EchoPrankClipInfo {
    pub duration_secs: f32,
    pub sample_rate: u32,
    pub channels: u16,
    pub waveform_peaks: Vec<f32>,
    pub is_armed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VaultSlotInfo {
    pub id: String,
    pub name: String,
    pub duration_secs: f32,
    pub hotkey: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlaybackOptions {
    pub trim_start: f32, // 0.0 to 1.0
    pub trim_end: f32,   // 0.0 to 1.0
    pub pitch_semitones: f32,
    pub stutter: bool,
    pub looping: bool,
    pub volume: f32,
}

impl Default for PlaybackOptions {
    fn default() -> Self {
        Self {
            trim_start: 0.0,
            trim_end: 1.0,
            pitch_semitones: 0.0,
            stutter: false,
            looping: false,
            volume: 1.0,
        }
    }
}

pub struct ActivePrankPad {
    pub samples: Vec<f32>,
    pub sample_rate: u32,
    pub channels: u16,
    pub options: PlaybackOptions,
    pub play_cursor: f64,
    pub is_playing: bool,
    pub stutter_count: u32,
    pub vault_slots: HashMap<String, (String, Vec<f32>, f32)>,
}

impl ActivePrankPad {
    pub fn new() -> Self {
        let mut vault_slots = HashMap::new();

        // Initialize the 4 Prank Tape Vault slots with comedy prank clips
        vault_slots.insert(
            "1".to_string(),
            (
                "Discord Screamer".to_string(),
                generate_vault_sfx("screamer", 48000.0),
                3.2,
            ),
        );
        vault_slots.insert(
            "2".to_string(),
            (
                "Party Chat Laugh".to_string(),
                generate_vault_sfx("laugh", 48000.0),
                4.8,
            ),
        );
        vault_slots.insert(
            "3".to_string(),
            (
                "Rage Quit Sigh".to_string(),
                generate_vault_sfx("ragequit", 48000.0),
                2.5,
            ),
        );
        vault_slots.insert(
            "4".to_string(),
            (
                "Whimper / Confusion".to_string(),
                generate_vault_sfx("whimper", 48000.0),
                5.0,
            ),
        );

        Self {
            samples: Vec::new(),
            sample_rate: 48000,
            channels: 2,
            options: PlaybackOptions::default(),
            play_cursor: 0.0,
            is_playing: false,
            stutter_count: 0,
            vault_slots,
        }
    }

    pub fn arm(&mut self, audio: Vec<f32>, sample_rate: u32, channels: u16) {
        self.samples = audio;
        self.sample_rate = sample_rate;
        self.channels = channels;
        self.play_cursor = 0.0;
        self.is_playing = false;
        self.stutter_count = 0;
    }

    pub fn trigger_play(&mut self, options: Option<PlaybackOptions>) {
        if self.samples.is_empty() {
            return;
        }
        if let Some(opt) = options {
            self.options = opt;
        }
        let total_frames = (self.samples.len() / self.channels as usize) as f64;
        self.play_cursor = total_frames * self.options.trim_start as f64;
        self.is_playing = true;
        self.stutter_count = 0;
    }

    pub fn stop(&mut self) {
        self.is_playing = false;
        self.play_cursor = 0.0;
        self.stutter_count = 0;
    }

    pub fn play_vault(&mut self, slot_id: &str) -> Option<EchoPrankClipInfo> {
        if let Some((_, pcm, _)) = self.vault_slots.get(slot_id).cloned() {
            self.arm(pcm, 48000, 2);
            self.trigger_play(None);
            let total_frames = self.samples.len() / (self.channels as usize).max(1);
            let duration = total_frames as f32 / self.sample_rate as f32;
            Some(EchoPrankClipInfo {
                duration_secs: duration,
                sample_rate: self.sample_rate,
                channels: self.channels,
                waveform_peaks: self.get_waveform_peaks(120),
                is_armed: true,
            })
        } else {
            None
        }
    }

    pub fn save_current_to_vault(&mut self, slot_id: &str, custom_name: Option<String>) -> Result<VaultSlotInfo, String> {
        if self.samples.is_empty() {
            return Err("No clip is armed. First capture friend voice or trigger a clip.".to_string());
        }
        let total_frames = self.samples.len() / (self.channels as usize).max(1);
        let duration = total_frames as f32 / self.sample_rate as f32;
        let name = custom_name.unwrap_or_else(|| format!("Friend Clip {}", slot_id));

        self.vault_slots.insert(
            slot_id.to_string(),
            (name.clone(), self.samples.clone(), duration),
        );

        Ok(VaultSlotInfo {
            id: slot_id.to_string(),
            name,
            duration_secs: duration,
            hotkey: format!("Ctrl+{}", slot_id),
        })
    }

    pub fn get_vault_slots(&self) -> Vec<VaultSlotInfo> {
        let mut slots = Vec::new();
        for id in &["1", "2", "3", "4"] {
            if let Some((name, _, duration)) = self.vault_slots.get(*id) {
                slots.push(VaultSlotInfo {
                    id: id.to_string(),
                    name: name.clone(),
                    duration_secs: *duration,
                    hotkey: format!("Ctrl+{}", id),
                });
            }
        }
        slots
    }

    /// Read next audio frame with pitch/stutter/trim manipulation
    pub fn next_frame(&mut self) -> Option<(f32, f32)> {
        if !self.is_playing || self.samples.is_empty() {
            return None;
        }

        let channels = self.channels as usize;
        let total_frames = self.samples.len() / channels;
        let start_frame = ((total_frames as f32) * self.options.trim_start).max(0.0) as usize;
        let end_frame = ((total_frames as f32) * self.options.trim_end).min(total_frames as f32) as usize;

        if end_frame <= start_frame {
            self.is_playing = false;
            return None;
        }

        let playback_rate = 2.0_f64.powf(self.options.pitch_semitones as f64 / 12.0);

        let frame_idx = self.play_cursor.floor() as usize;
        let frac = (self.play_cursor - frame_idx as f64) as f32;

        if frame_idx >= end_frame {
            if self.options.looping {
                self.play_cursor = start_frame as f64;
            } else {
                self.is_playing = false;
                return None;
            }
        }

        // Handle stutter effect: rapidly replay the first 180ms 3 times
        let stutter_frame_count = (self.sample_rate as f64 * 0.18) as usize;
        if self.options.stutter && self.stutter_count < 3 {
            if frame_idx >= start_frame + stutter_frame_count {
                self.stutter_count += 1;
                self.play_cursor = start_frame as f64;
            }
        }

        let curr_idx = frame_idx.clamp(0, total_frames - 1);
        let next_idx = (curr_idx + 1).min(total_frames - 1);

        let (left, right) = if channels == 1 {
            let s0 = self.samples[curr_idx];
            let s1 = self.samples[next_idx];
            let s = s0 + frac * (s1 - s0);
            (s, s)
        } else {
            let s0_l = self.samples[curr_idx * 2];
            let s1_l = self.samples[next_idx * 2];
            let s0_r = self.samples[curr_idx * 2 + 1];
            let s1_r = self.samples[next_idx * 2 + 1];
            (s0_l + frac * (s1_l - s0_l), s0_r + frac * (s1_r - s0_r))
        };

        self.play_cursor += playback_rate;

        let vol = self.options.volume;
        Some((left * vol, right * vol))
    }

    pub fn get_waveform_peaks(&self, num_points: usize) -> Vec<f32> {
        if self.samples.is_empty() {
            return vec![0.0; num_points];
        }

        let step = (self.samples.len() / num_points).max(1);
        let mut peaks = Vec::with_capacity(num_points);

        for chunk in self.samples.chunks(step) {
            let max_val = chunk.iter().fold(0.0_f32, |acc, &s| acc.max(s.abs()));
            peaks.push(max_val);
            if peaks.len() >= num_points {
                break;
            }
        }

        while peaks.len() < num_points {
            peaks.push(0.0);
        }

        peaks
    }
}

/// 30-second rolling circular buffer for EchoPrank loopback capture
pub struct EchoPrankBuffer {
    buffer: Vec<f32>,
    write_idx: usize,
    capacity: usize,
    sample_rate: u32,
    channels: u16,
    is_push_recording: bool,
    push_record_buffer: Vec<f32>,
}

impl EchoPrankBuffer {
    pub fn new(sample_rate: u32, channels: u16, duration_secs: usize) -> Self {
        let capacity = (sample_rate as usize) * (channels as usize) * duration_secs;
        Self {
            buffer: vec![0.0; capacity],
            write_idx: 0,
            capacity,
            sample_rate,
            channels,
            is_push_recording: false,
            push_record_buffer: Vec::new(),
        }
    }

    pub fn push_samples(&mut self, samples: &[f32]) {
        for &s in samples {
            self.buffer[self.write_idx] = s;
            self.write_idx += 1;
            if self.write_idx >= self.capacity {
                self.write_idx = 0;
            }

            if self.is_push_recording {
                self.push_record_buffer.push(s);
            }
        }
    }

    /// Extract the last N seconds of recorded friend speech from the rolling circular buffer
    pub fn clip_last(&self, duration_secs: f32) -> Vec<f32> {
        let frames_needed = (self.sample_rate as f32 * duration_secs).round() as usize;
        let samples_needed = (frames_needed * self.channels as usize).min(self.capacity);
        let mut extracted = vec![0.0; samples_needed];

        let start_pos = if self.write_idx >= samples_needed {
            self.write_idx - samples_needed
        } else {
            self.capacity - (samples_needed - self.write_idx)
        };

        for i in 0..samples_needed {
            let read_pos = (start_pos + i) % self.capacity;
            extracted[i] = self.buffer[read_pos];
        }

        extracted
    }

    pub fn start_push_to_record(&mut self) {
        self.push_record_buffer.clear();
        self.is_push_recording = true;
    }

    pub fn stop_push_to_record(&mut self) -> Vec<f32> {
        self.is_push_recording = false;
        std::mem::take(&mut self.push_record_buffer)
    }
}

pub type SharedEchoPrank = Arc<Mutex<(EchoPrankBuffer, ActivePrankPad)>>;

pub fn create_echoprank_engine(sample_rate: u32, channels: u16) -> SharedEchoPrank {
    let buf = EchoPrankBuffer::new(sample_rate, channels, 30);
    let pad = ActivePrankPad::new();
    Arc::new(Mutex::new((buf, pad)))
}

/// Synthesize hilarious reaction audio clips for the Prank Tape Vault (48kHz stereo)
fn generate_vault_sfx(clip_type: &str, sample_rate: f32) -> Vec<f32> {
    use std::f32::consts::PI;
    let mut pcm = Vec::new();

    match clip_type {
        "screamer" => {
            // Chaotic high-frequency pitched scream prank (3.2s)
            let duration = 3.2;
            let total_samples = (sample_rate * duration) as usize;

            for i in 0..total_samples {
                let t = i as f32 / sample_rate;
                // Wild frequency modulation between 650 Hz and 2200 Hz
                let f_mod = 1200.0 + 800.0 * (t * 2.0 * PI * 8.5).sin() + 300.0 * (t * 2.0 * PI * 22.0).sin();
                let osc1 = (t * 2.0 * PI * f_mod).sin();
                let osc2 = (t * 2.0 * PI * (f_mod * 1.5)).sin() * 0.4;
                let harsh = (osc1 + osc2).clamp(-0.8, 0.8) * 1.2;

                let env = if t < 0.08 {
                    t / 0.08
                } else if t > 2.8 {
                    (1.0 - (t - 2.8) / 0.4).max(0.0)
                } else {
                    1.0
                };

                let val = (harsh * env * 0.65).clamp(-0.75, 0.75);
                pcm.push(val);
                pcm.push(val);
            }
        }
        "laugh" => {
            // Party chat giggling laughter loop (4.8s)
            let duration = 4.8;
            let total_samples = (sample_rate * duration) as usize;

            for i in 0..total_samples {
                let t = i as f32 / sample_rate;
                let chuckle_cycle = (t * 4.5) % 1.0;
                let f = 340.0 + 120.0 * (t * 2.0 * PI * 0.8).sin() - chuckle_cycle * 90.0;
                let osc = 2.0 * ((t * f) % 1.0) - 1.0;
                let formant = (t * 2.0 * PI * 750.0).sin() * 0.5;

                let chuckle_env = (1.0 - (chuckle_cycle - 0.5).abs() * 2.0).max(0.0);
                let overall_env = if t < 0.1 {
                    t / 0.1
                } else if t > 4.4 {
                    (1.0 - (t - 4.4) / 0.4).max(0.0)
                } else {
                    1.0
                };

                let val = ((osc + formant) * chuckle_env * overall_env * 0.55).clamp(-0.75, 0.75);
                pcm.push(val);
                pcm.push(val);
            }
        }
        "ragequit" => {
            // Heavy sigh + violent desk slam thud (2.5s)
            let duration = 2.5;
            let total_samples = (sample_rate * duration) as usize;

            for i in 0..total_samples {
                let t = i as f32 / sample_rate;
                let val = if t < 0.9 {
                    // Filtered breath / sigh noise
                    let noise = (((i * 1103515245 + 12345) & 0x7FFFFFFF) as f32 / 0x7FFFFFFF as f32) * 2.0 - 1.0;
                    let breath_env = (t / 0.45).min(1.0) * (1.0 - (t - 0.45).max(0.0) / 0.45);
                    noise * breath_env * 0.35
                } else {
                    // Desk slam impact at t = 0.9
                    let slam_t = t - 0.9;
                    let sub = (slam_t * 2.0 * PI * (65.0 * (-8.0 * slam_t).exp() + 45.0)).sin();
                    let snap_noise = (((i * 1664525 + 1013904223) & 0x7FFFFFFF) as f32 / 0x7FFFFFFF as f32) * 2.0 - 1.0;
                    let impact_env = (-14.0 * slam_t).exp();
                    let rumble_env = (-3.2 * slam_t).exp();

                    sub * rumble_env * 0.70 + snap_noise * impact_env * 0.50
                };

                let clamped = val.clamp(-0.75, 0.75);
                pcm.push(clamped);
                pcm.push(clamped);
            }
        }
        "whimper" => {
            // Pitch-sliding comic confusion whimper "Whaaaat?!" (5.0s)
            let duration = 5.0;
            let total_samples = (sample_rate * duration) as usize;

            for i in 0..total_samples {
                let t = i as f32 / sample_rate;
                let cycle = (t / 2.5) % 1.0;
                let f = 550.0 + (cycle * 600.0) + 25.0 * (t * 2.0 * PI * 11.0).sin();
                let sine = (t * 2.0 * PI * f).sin();
                let formant = (t * 2.0 * PI * (f * 1.6)).sin() * 0.35;

                let env = if cycle < 0.15 {
                    cycle / 0.15
                } else if cycle > 0.85 {
                    (1.0 - (cycle - 0.85) / 0.15).max(0.0)
                } else {
                    1.0
                };

                let val = ((sine + formant) * env * 0.55).clamp(-0.75, 0.75);
                pcm.push(val);
                pcm.push(val);
            }
        }
        _ => {
            let duration = 1.0;
            let total_samples = (sample_rate * duration) as usize;
            for i in 0..total_samples {
                let t = i as f32 / sample_rate;
                let val = (t * 2.0 * PI * 440.0).sin() * (-3.0 * t).exp() * 0.3;
                pcm.push(val);
                pcm.push(val);
            }
        }
    }

    pcm
}
