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

pub struct SoundSample {
    pub slot_id: String,
    pub pcm: Vec<f32>,
    pub channels: u16,
    pub sample_rate: u32,
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
        Self {
            slots: Vec::new(),
            samples: std::collections::HashMap::new(),
            active_playbacks: Vec::new(),
            overlap_mode: OverlapMode::CutPrevious,
            master_volume: 1.0,
        }
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

        // Remove old slot with same id if replacing
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

fn uuid_like_id() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos();
    format!("snd_{:x}", now)
}

pub type SharedSoundboard = Arc<Mutex<SoundboardEngine>>;

pub fn create_soundboard_engine() -> SharedSoundboard {
    Arc::new(Mutex::new(SoundboardEngine::new()))
}
