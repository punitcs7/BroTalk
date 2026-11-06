use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
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
}

impl ActivePrankPad {
    pub fn new() -> Self {
        Self {
            samples: Vec::new(),
            sample_rate: 48000,
            channels: 2,
            options: PlaybackOptions::default(),
            play_cursor: 0.0,
            is_playing: false,
            stutter_count: 0,
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
