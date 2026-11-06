use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use std::fs::File;
use std::path::Path;
use std::sync::Arc;
use symphonia::core::audio::SampleBuffer;
use symphonia::core::codecs::DecoderOptions;
use symphonia::core::formats::FormatOptions;
use symphonia::core::io::MediaSourceStream;
use symphonia::core::meta::MetadataOptions;
use symphonia::core::probe::Hint;

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum OverlapMode {
    CutPrevious,
    Polyphonic,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SoundboardSlot {
    pub id: String,
    pub name: String,
    pub file_path: String,
    pub hotkey: Option<String>,
    pub volume: f32,
    pub duration_secs: f32,
    pub overlap_mode: OverlapMode,
}

pub struct ActivePlayback {
    pub slot_id: String,
    pub pcm: Arc<Vec<f32>>,
    pub cursor: usize,
    pub volume: f32,
    pub channels: u16,
}

pub struct SoundboardEngine {
    slots: Vec<SoundboardSlot>,
    samples: std::collections::HashMap<String, Arc<Vec<f32>>>,
    active_playbacks: Vec<ActivePlayback>,
    overlap_mode: OverlapMode,
    master_volume: f32,
}

impl SoundboardEngine {
    pub fn new() -> Self {
        let mut engine = Self {
            slots: Vec::new(),
            samples: std::collections::HashMap::new(),
            active_playbacks: Vec::new(),
            overlap_mode: OverlapMode::Polyphonic,
            master_volume: 1.0,
        };

        // Preload procedural gamer sound pads at 48 kHz stereo into RAM
        let sfx_types = [
            "airhorn", "bruh", "victory", "headshot", "laugh",
            "drumroll", "sadtrombone", "siren", "wow", "denied", "levelup",
        ];

        for &sfx in &sfx_types {
            let pcm = generate_procedural_sfx(sfx, 48000.0);
            let arc_pcm = Arc::new(pcm);
            engine.samples.insert(sfx.to_string(), arc_pcm.clone());
            engine.samples.insert(format!("sfx_{}", sfx), arc_pcm);
        }

        // Aliases for quick pads
        if let Some(vic) = engine.samples.get("victory").cloned() {
            engine.samples.insert("gg".to_string(), vic.clone());
            engine.samples.insert("sfx_gg".to_string(), vic);
        }

        engine
    }

    pub fn play_sfx(&mut self, sfx_type: &str) {
        let normalized = sfx_type.trim().to_lowercase();
        let key = if self.samples.contains_key(&normalized) {
            normalized
        } else {
            let prefixed = format!("sfx_{}", normalized);
            if self.samples.contains_key(&prefixed) {
                prefixed
            } else if normalized == "gg" {
                "victory".to_string()
            } else {
                eprintln!("Unknown sfx type: {}", sfx_type);
                return;
            }
        };

        self.play(&key);
    }

    pub fn set_overlap_mode(&mut self, mode: OverlapMode) {
        self.overlap_mode = mode;
    }

    pub fn set_master_volume(&mut self, vol: f32) {
        self.master_volume = vol.clamp(0.0, 2.0);
    }

    pub fn get_slots(&self) -> Vec<SoundboardSlot> {
        self.slots.clone()
    }

    pub fn load_audio_file(&mut self, file_path: &str, slot_id: Option<String>) -> Result<SoundboardSlot, String> {
        let path = Path::new(file_path);
        if !path.exists() {
            return Err("File does not exist".to_string());
        }

        let file = File::open(path).map_err(|e| e.to_string())?;
        let mss = MediaSourceStream::new(Box::new(file), Default::default());

        let mut hint = Hint::new();
        if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
            hint.with_extension(ext);
        }

        let format_opts = FormatOptions::default();
        let metadata_opts = MetadataOptions::default();
        let probed = symphonia::default::get_probe()
            .format(&hint, mss, &format_opts, &metadata_opts)
            .map_err(|e| format!("Audio format probe error: {}", e))?;

        let mut format = probed.format;
        let track = format
            .default_track()
            .ok_or_else(|| "No default audio track found".to_string())?;

        let track_id = track.id;
        let sample_rate = track.codec_params.sample_rate.unwrap_or(48000);
        let channels = track.codec_params.channels.map(|c| c.count() as u16).unwrap_or(2);

        let decoder_opts = DecoderOptions::default();
        let mut decoder = symphonia::default::get_codecs()
            .make(&track.codec_params, &decoder_opts)
            .map_err(|e| format!("Decoder creation error: {}", e))?;

        let mut pcm = Vec::new();
        let mut sample_buf = None;

        while let Ok(packet) = format.next_packet() {
            if packet.track_id() != track_id {
                continue;
            }

            match decoder.decode(&packet) {
                Ok(decoded) => {
                    if sample_buf.is_none() {
                        let spec = *decoded.spec();
                        let duration = decoded.capacity() as u64;
                        sample_buf = Some(SampleBuffer::<f32>::new(duration, spec));
                    }

                    if let Some(buf) = &mut sample_buf {
                        buf.copy_interleaved_ref(decoded);
                        pcm.extend_from_slice(buf.samples());
                    }
                }
                Err(symphonia::core::errors::Error::DecodeError(_)) => (),
                Err(_) => break,
            }
        }

        let total_frames = pcm.len() / (channels as usize).max(1);
        let duration_secs = total_frames as f32 / sample_rate as f32;

        let id = slot_id.unwrap_or_else(|| uuid_like_id());
        let file_name = path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("Sound Clip")
            .to_string();

        let arc_pcm = Arc::new(pcm);
        self.samples.insert(id.clone(), arc_pcm);

        let slot = SoundboardSlot {
            id: id.clone(),
            name: file_name,
            file_path: file_path.to_string(),
            hotkey: None,
            volume: 1.0,
            duration_secs,
            overlap_mode: self.overlap_mode,
        };

        self.slots.retain(|s| s.id != id);
        self.slots.push(slot.clone());

        Ok(slot)
    }

    pub fn play(&mut self, slot_id: &str) {
        if let Some(pcm) = self.samples.get(slot_id) {
            let slot = self.slots.iter().find(|s| s.id == slot_id);
            let volume = slot.map(|s| s.volume).unwrap_or(1.0) * self.master_volume;
            let overlap = slot.map(|s| s.overlap_mode).unwrap_or(self.overlap_mode);

            if overlap == OverlapMode::CutPrevious {
                self.active_playbacks.clear();
            }

            self.active_playbacks.push(ActivePlayback {
                slot_id: slot_id.to_string(),
                pcm: pcm.clone(),
                cursor: 0,
                volume,
                channels: 2,
            });
        }
    }

    pub fn stop_all(&mut self) {
        self.active_playbacks.clear();
    }

    pub fn set_slot_hotkey(&mut self, slot_id: &str, hotkey: Option<String>) {
        if let Some(slot) = self.slots.iter_mut().find(|s| s.id == slot_id) {
            slot.hotkey = hotkey;
        }
    }

    pub fn set_slot_volume(&mut self, slot_id: &str, vol: f32) {
        if let Some(slot) = self.slots.iter_mut().find(|s| s.id == slot_id) {
            slot.volume = vol.clamp(0.0, 2.0);
        }
    }

    pub fn delete_slot(&mut self, slot_id: &str) {
        self.slots.retain(|s| s.id != slot_id);
        self.samples.remove(slot_id);
        self.active_playbacks.retain(|p| p.slot_id != slot_id);
    }

    /// Read next mixed soundboard stereo frame (left, right)
    pub fn next_frame(&mut self) -> (f32, f32) {
        if self.active_playbacks.is_empty() {
            return (0.0, 0.0);
        }

        let mut mix_l = 0.0;
        let mut mix_r = 0.0;

        self.active_playbacks.retain_mut(|playback| {
            let pcm = &playback.pcm;
            let len = pcm.len();
            if playback.cursor >= len {
                return false;
            }

            let s_l = pcm[playback.cursor];
            let s_r = if playback.cursor + 1 < len {
                pcm[playback.cursor + 1]
            } else {
                s_l
            };

            mix_l += s_l * playback.volume;
            mix_r += s_r * playback.volume;

            playback.cursor += 2;
            playback.cursor < len
        });

        (mix_l, mix_r)
    }
}

/// Synthesize iconic gamer sound effects procedurally (48kHz stereo)
fn generate_procedural_sfx(sfx_type: &str, sample_rate: f32) -> Vec<f32> {
    use std::f32::consts::PI;
    let mut pcm = Vec::new();

    match sfx_type {
        "airhorn" => {
            // MLG Stadium Airhorn blast: Bb4 (466.16), Db5 (554.37), F5 (698.46)
            let duration = 0.55;
            let total_samples = (sample_rate * duration) as usize;
            let freqs = [466.16_f32, 554.37, 698.46, 932.33];
            let offsets = [0.0_f32, 0.015, 0.03, 0.045];

            for i in 0..total_samples {
                let t = i as f32 / sample_rate;
                let mut sum = 0.0_f32;

                for (idx, &f) in freqs.iter().enumerate() {
                    let note_t = t - offsets[idx];
                    if note_t >= 0.0 {
                        // Sawtooth wave with subtle brass vibrato
                        let vib = 1.0 + 0.018 * (note_t * 2.0 * PI * 14.0).sin();
                        let phase = (note_t * f * vib) % 1.0;
                        let saw = 2.0 * phase - 1.0;

                        // Punchy horn envelope
                        let env = if note_t < 0.015 {
                            note_t / 0.015
                        } else if note_t < 0.38 {
                            1.0
                        } else {
                            (-5.0 * (note_t - 0.38)).exp().max(0.0)
                        };

                        sum += saw * env * 0.22;
                    }
                }

                let clamped = sum.clamp(-0.75, 0.75);
                pcm.push(clamped);
                pcm.push(clamped);
            }
        }
        "bruh" => {
            // Vocal "Bruh" formant drop (145 Hz -> 52 Hz)
            let duration = 0.48;
            let total_samples = (sample_rate * duration) as usize;

            for i in 0..total_samples {
                let t = i as f32 / sample_rate;
                let progress = (t / duration).clamp(0.0, 1.0);
                // Pitch bends down from 145 Hz to 52 Hz
                let f0 = 145.0 * (1.0 - 0.64 * progress * progress);
                let saw = 2.0 * ((t * f0) % 1.0) - 1.0;

                // Formant tone boost around 500 Hz
                let formant = (t * 2.0 * PI * 520.0).sin() * 0.4;
                let wave = saw * 0.6 + formant;

                let env = if t < 0.02 {
                    t / 0.02
                } else {
                    (-3.5 * (t - 0.02)).exp()
                };

                let val = (wave * env * 0.65).clamp(-0.75, 0.75);
                pcm.push(val);
                pcm.push(val);
            }
        }
        "headshot" => {
            // Arcade impact snap & metallic headshot ping
            let duration = 0.35;
            let total_samples = (sample_rate * duration) as usize;

            for i in 0..total_samples {
                let t = i as f32 / sample_rate;
                // High frequency snap
                let sweep_freq = 2400.0 * (-12.0 * t).exp() + 300.0;
                let snap = (t * 2.0 * PI * sweep_freq).sin();
                let snap_env = (-22.0 * t).exp();

                // Metallic ring (2800 Hz & 3600 Hz)
                let ring = (t * 2.0 * PI * 2800.0).sin() * 0.6 + (t * 2.0 * PI * 3600.0).sin() * 0.4;
                let ring_env = (-8.0 * t).exp();

                let val = ((snap * snap_env * 0.6 + ring * ring_env * 0.4) * 0.75).clamp(-0.75, 0.75);
                pcm.push(val);
                pcm.push(val);
            }
        }
        "victory" => {
            // Triumphant RPG Fanfare: C5 (523.25), E5 (659.25), G5 (783.99), C6 (1046.50)
            let duration = 0.85;
            let total_samples = (sample_rate * duration) as usize;
            let notes = [523.25_f32, 659.25, 783.99, 1046.50];
            let step = 0.085_f32;

            for i in 0..total_samples {
                let t = i as f32 / sample_rate;
                let mut sum = 0.0_f32;

                for (idx, &f) in notes.iter().enumerate() {
                    let note_start = idx as f32 * step;
                    let note_t = t - note_start;
                    if note_t >= 0.0 {
                        let tri = 2.0 * ((note_t * f) % 1.0 - 0.5).abs() * 2.0 - 1.0;
                        let env = if note_t < 0.01 {
                            note_t / 0.01
                        } else {
                            (-3.8 * (note_t - 0.01)).exp()
                        };
                        sum += tri * env * 0.35;
                    }
                }

                let val = sum.clamp(-0.75, 0.75);
                pcm.push(val);
                pcm.push(val);
            }
        }
        "sadtrombone" => {
            // Sad Trombone "Wah wah wah waaaah"
            let duration = 1.25;
            let total_samples = (sample_rate * duration) as usize;
            let pitches = [415.30_f32, 392.00, 369.99, 329.63];

            for i in 0..total_samples {
                let t = i as f32 / sample_rate;
                let section = (t / 0.28).floor() as usize;

                if section < 4 {
                    let note_t = t - (section as f32 * 0.28);
                    let mut f = pitches[section];
                    if section == 3 {
                        // Bend final note down
                        f -= note_t * 65.0;
                    }

                    // Sawtooth with wah-wah filter
                    let saw = 2.0 * ((note_t * f) % 1.0) - 1.0;
                    let wah = 0.5 + 0.5 * (note_t * 2.0 * PI * 8.0).sin();
                    let env = if note_t < 0.015 {
                        note_t / 0.015
                    } else if section == 3 {
                        (-2.0 * note_t).exp()
                    } else {
                        (-3.2 * note_t).exp()
                    };

                    let val = (saw * wah * env * 0.55).clamp(-0.75, 0.75);
                    pcm.push(val);
                    pcm.push(val);
                } else {
                    pcm.push(0.0);
                    pcm.push(0.0);
                }
            }
        }
        "siren" => {
            // Police / Raid Siren sweep (600 Hz <-> 1100 Hz)
            let duration = 0.95;
            let total_samples = (sample_rate * duration) as usize;

            for i in 0..total_samples {
                let t = i as f32 / sample_rate;
                let cycle = (t * 2.0) % 1.0;
                let sweep = if cycle < 0.5 {
                    cycle * 2.0
                } else {
                    (1.0 - cycle) * 2.0
                };
                let f = 600.0 + sweep * 520.0;
                let saw = 2.0 * ((t * f) % 1.0) - 1.0;

                let env = if t < 0.03 {
                    t / 0.03
                } else if t > 0.85 {
                    (1.0 - (t - 0.85) / 0.10).max(0.0)
                } else {
                    1.0
                };

                let val = (saw * env * 0.55).clamp(-0.75, 0.75);
                pcm.push(val);
                pcm.push(val);
            }
        }
        "denied" => {
            // Game show denied buzzer (115 Hz harsh square wave)
            let duration = 0.42;
            let total_samples = (sample_rate * duration) as usize;

            for i in 0..total_samples {
                let t = i as f32 / sample_rate;
                let sqr1 = if (t * 115.0) % 1.0 < 0.5 { 1.0 } else { -1.0 };
                let sqr2 = if (t * 230.0) % 1.0 < 0.5 { 0.4 } else { -0.4 };

                let env = if t < 0.01 {
                    t / 0.01
                } else {
                    (-3.5 * t).exp()
                };

                let val = ((sqr1 + sqr2) * env * 0.50).clamp(-0.75, 0.75);
                pcm.push(val);
                pcm.push(val);
            }
        }
        "levelup" => {
            // RPG Level Up Arpeggio: 440, 554.37, 659.25, 880
            let duration = 0.70;
            let total_samples = (sample_rate * duration) as usize;
            let notes = [440.0_f32, 554.37, 659.25, 880.0];
            let step = 0.065_f32;

            for i in 0..total_samples {
                let t = i as f32 / sample_rate;
                let mut sum = 0.0_f32;

                for (idx, &f) in notes.iter().enumerate() {
                    let note_start = idx as f32 * step;
                    let note_t = t - note_start;
                    if note_t >= 0.0 {
                        let bell = (note_t * 2.0 * PI * f).sin()
                            + 0.5 * (note_t * 2.0 * PI * f * 2.0).sin();
                        let env = if note_t < 0.01 {
                            note_t / 0.01
                        } else {
                            (-4.0 * note_t).exp()
                        };
                        sum += bell * env * 0.32;
                    }
                }

                let val = sum.clamp(-0.75, 0.75);
                pcm.push(val);
                pcm.push(val);
            }
        }
        "drumroll" => {
            // Snare roll accelerando ending in a crash
            let duration = 0.75;
            let total_samples = (sample_rate * duration) as usize;

            for i in 0..total_samples {
                let t = i as f32 / sample_rate;
                let pseudo_noise = (((i * 1103515245 + 12345) & 0x7FFFFFFF) as f32
                    / 0x7FFFFFFF as f32)
                    * 2.0
                    - 1.0;

                let hit_spacing = 0.06 * (1.0 - 0.7 * (t / 0.6).min(1.0));
                let hit_phase = (t / hit_spacing) % 1.0;
                let hit_env = (-18.0 * hit_phase).exp();

                let body = (t * 2.0 * PI * 180.0).sin() * 0.3;
                let snare = (pseudo_noise * 0.7 + body) * hit_env;

                let val = if t < 0.62 {
                    snare * 0.55
                } else {
                    // Final crash
                    let crash_t = t - 0.62;
                    let crash = pseudo_noise * (-5.0 * crash_t).exp() * 0.65;
                    crash
                };

                let clamped = val.clamp(-0.75, 0.75);
                pcm.push(clamped);
                pcm.push(clamped);
            }
        }
        "laugh" => {
            // Chuckle laugh bursts
            let duration = 0.90;
            let total_samples = (sample_rate * duration) as usize;

            for i in 0..total_samples {
                let t = i as f32 / sample_rate;
                let chuckle_idx = (t / 0.22).floor() as usize;
                let chuckle_t = t - (chuckle_idx as f32 * 0.22);

                let val = if chuckle_idx < 4 && chuckle_t < 0.17 {
                    let f = 380.0 - chuckle_t * 240.0;
                    let saw = 2.0 * ((chuckle_t * f) % 1.0) - 1.0;
                    let formant = (chuckle_t * 2.0 * PI * 650.0).sin() * 0.5;
                    let env = (1.0 - (chuckle_t - 0.085).abs() / 0.085).max(0.0);
                    ((saw + formant) * env * 0.48).clamp(-0.75, 0.75)
                } else {
                    0.0
                };

                pcm.push(val);
                pcm.push(val);
            }
        }
        "wow" => {
            // Anime "WOW" upward vocal slide
            let duration = 0.60;
            let total_samples = (sample_rate * duration) as usize;

            for i in 0..total_samples {
                let t = i as f32 / sample_rate;
                let progress = (t / duration).clamp(0.0, 1.0);
                let f = 480.0 + (progress * 760.0);
                let vib = 1.0 + 0.02 * (t * 2.0 * PI * 7.5).sin();

                let sine = (t * 2.0 * PI * f * vib).sin();
                let formant = (t * 2.0 * PI * (f * 1.8)).sin() * 0.35;

                let env = if t < 0.05 {
                    t / 0.05
                } else if t > 0.45 {
                    (1.0 - (t - 0.45) / 0.15).max(0.0)
                } else {
                    1.0
                };

                let val = ((sine + formant) * env * 0.60).clamp(-0.75, 0.75);
                pcm.push(val);
                pcm.push(val);
            }
        }
        _ => {
            // Default gentle chime
            let duration = 0.35;
            let total_samples = (sample_rate * duration) as usize;
            for i in 0..total_samples {
                let t = i as f32 / sample_rate;
                let val = (t * 2.0 * PI * 880.0).sin() * (-6.0 * t).exp() * 0.4;
                pcm.push(val);
                pcm.push(val);
            }
        }
    }

    pcm
}

fn uuid_like_id() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos();
    format!("snd_{:x}", now)
}

pub type SharedSoundboard = Arc<Mutex<SoundboardEngine>>;

pub fn create_soundboard_engine() -> SharedSoundboard {
    Arc::new(Mutex::new(SoundboardEngine::new()))
}
