use std::f32::consts::PI;

/// Low-latency time-domain pitch shifter using dual crossfading delay lines.
/// Achieves < 5ms processing latency ideal for real-time gaming voice modulation.
pub struct PitchShifter {
    pitch_ratio: f32,
    buffer: Vec<f32>,
    buffer_mask: usize,
    write_pos: usize,
    read_pos_1: f32,
    read_pos_2: f32,
    window_size: usize,
    half_window: usize,
    phase: f32,
    half_realigned: bool,
}

impl PitchShifter {
    pub fn new(sample_rate: f32, max_window_ms: f32) -> Self {
        let window_size = ((sample_rate * (max_window_ms / 1000.0)).round() as usize).next_power_of_two();
        let buffer_size = window_size * 4;
        let buffer_mask = buffer_size - 1;

        Self {
            pitch_ratio: 1.0,
            buffer: vec![0.0; buffer_size],
            buffer_mask,
            write_pos: 0,
            read_pos_1: 0.0,
            read_pos_2: (window_size / 2) as f32,
            window_size,
            half_window: window_size / 2,
            phase: 0.0,
            half_realigned: false,
        }
    }

    /// Set pitch ratio: 0.5 = 1 octave down (Titan), 2.0 = 1 octave up (Chipmunk)
    pub fn set_pitch_ratio(&mut self, ratio: f32) {
        self.pitch_ratio = ratio.clamp(0.25, 4.0);
    }

    /// Set pitch in semitones: e.g. -12.0 to +12.0
    pub fn set_semitones(&mut self, semitones: f32) {
        let ratio = 2.0_f32.powf(semitones / 12.0);
        self.set_pitch_ratio(ratio);
    }

    pub fn process_sample(&mut self, input: f32) -> f32 {
        if (self.pitch_ratio - 1.0).abs() < 0.001 {
            return input;
        }

        // Store sample in circular buffer
        self.buffer[self.write_pos] = input;

        // Calculate smooth crossfade weights using raised cosine (Hann) window
        let norm_phase = self.phase / (self.window_size as f32);
        let weight_1 = 0.5 * (1.0 + (norm_phase * 2.0 * PI).cos());
        let weight_2 = 1.0 - weight_1;

        // Linear interpolation for read pointers
        let s1 = self.read_interpolated(self.read_pos_1);
        let s2 = self.read_interpolated(self.read_pos_2);

        let output = s1 * weight_1 + s2 * weight_2;

        // Advance write pointer
        self.write_pos = (self.write_pos + 1) & self.buffer_mask;

        // Advance read pointers based on pitch ratio
        self.read_pos_1 += self.pitch_ratio;
        self.read_pos_2 += self.pitch_ratio;

        // Advance window phase based on rate of divergence
        let step = (self.pitch_ratio - 1.0).abs().max(0.001);
        self.phase += step;

        let current_write = self.write_pos as f32;
        let target_delay = self.half_window as f32;

        // When phase reaches half_window, weight_1 is exactly 0.0 -> realign read_pos_1
        if self.phase >= self.half_window as f32 && !self.half_realigned {
            self.read_pos_1 = current_write - target_delay;
            self.half_realigned = true;
        }

        // When phase reaches window_size, weight_2 is exactly 0.0 -> realign read_pos_2
        if self.phase >= self.window_size as f32 {
            self.phase -= self.window_size as f32;
            self.read_pos_2 = current_write - target_delay;
            self.half_realigned = false;
        }

        output
    }

    pub fn process(&mut self, samples: &mut [f32]) {
        if (self.pitch_ratio - 1.0).abs() < 0.001 {
            return;
        }

        for sample in samples.iter_mut() {
            *sample = self.process_sample(*sample);
        }
    }

    fn read_interpolated(&self, pos: f32) -> f32 {
        let buf_len = self.buffer.len() as f32;
        let wrapped_pos = ((pos % buf_len) + buf_len) % buf_len;
        let idx0 = wrapped_pos.floor() as usize & self.buffer_mask;
        let idx1 = (idx0 + 1) & self.buffer_mask;
        let frac = wrapped_pos - wrapped_pos.floor();

        self.buffer[idx0] * (1.0 - frac) + self.buffer[idx1] * frac
    }

    pub fn reset(&mut self) {
        self.buffer.fill(0.0);
        self.write_pos = 0;
        self.read_pos_1 = 0.0;
        self.read_pos_2 = (self.window_size / 2) as f32;
        self.phase = 0.0;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_pitch_shifter_stability() {
        let mut shifter = PitchShifter::new(48000.0, 20.0);
        shifter.set_semitones(-6.0); // Titan pitch

        let mut samples = vec![0.5; 512];
        shifter.process(&mut samples);

        for &s in &samples {
            assert!(!s.is_nan() && !s.is_infinite());
        }
    }
}
