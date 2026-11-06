use std::f32::consts::PI;
use super::formant_filter::BiquadFilter;

/// Ring Modulator for metallic Robot voice
pub struct RingModulator {
    sample_rate: f32,
    carrier_freq: f32,
    phase: f32,
    mix: f32,
}

impl RingModulator {
    pub fn new(sample_rate: f32) -> Self {
        Self {
            sample_rate,
            carrier_freq: 120.0,
            phase: 0.0,
            mix: 0.85,
        }
    }

    pub fn set_carrier_freq(&mut self, freq: f32) {
        self.carrier_freq = freq.clamp(20.0, 1000.0);
    }

    pub fn set_mix(&mut self, mix: f32) {
        self.mix = mix.clamp(0.0, 1.0);
    }

    pub fn process(&mut self, samples: &mut [f32]) {
        let phase_inc = 2.0 * PI * self.carrier_freq / self.sample_rate;
        for s in samples.iter_mut() {
            let carrier = self.phase.sin();
            self.phase += phase_inc;
            if self.phase >= 2.0 * PI {
                self.phase -= 2.0 * PI;
            }
            let modulated = *s * carrier;
            *s = *s * (1.0 - self.mix) + modulated * self.mix;
        }
    }

    pub fn reset(&mut self) {
        self.phase = 0.0;
    }
}

/// Tactical Radio / Walkie-Talkie effect with bandpass filtering and saturation
pub struct RadioEffect {
    bandpass: BiquadFilter,
    drive: f32,
    mix: f32,
}

impl RadioEffect {
    pub fn new(sample_rate: f32) -> Self {
        let mut bandpass = BiquadFilter::new();
        bandpass.set_bandpass(sample_rate, 1500.0, 1.8);
        Self {
            bandpass,
            drive: 2.2,
            mix: 0.9,
        }
    }

    pub fn set_drive(&mut self, drive: f32) {
        self.drive = drive.clamp(1.0, 8.0);
    }

    pub fn set_mix(&mut self, mix: f32) {
        self.mix = mix.clamp(0.0, 1.0);
    }

    pub fn process(&mut self, samples: &mut [f32]) {
        for s in samples.iter_mut() {
            let dry = *s;
            // Bandpass filter
            let filtered = self.bandpass.process(dry);
            // Soft clipping saturation (tanh distortion)
            let distorted = (filtered * self.drive).tanh() * 0.9;
            *s = dry * (1.0 - self.mix) + distorted * self.mix;
        }
    }

    pub fn reset(&mut self) {
        self.bandpass.reset();
    }
}

/// Extraterrestrial Alien modulation with LFO vibrato and asymmetric distortion
pub struct AlienEffect {
    sample_rate: f32,
    lfo_phase: f32,
    lfo_freq: f32,
    depth: f32,
    mix: f32,
}

impl AlienEffect {
    pub fn new(sample_rate: f32) -> Self {
        Self {
            sample_rate,
            lfo_phase: 0.0,
            lfo_freq: 7.5,
            depth: 0.4,
            mix: 0.8,
        }
    }

    pub fn process(&mut self, samples: &mut [f32]) {
        let lfo_inc = 2.0 * PI * self.lfo_freq / self.sample_rate;
        for s in samples.iter_mut() {
            let dry = *s;
            let lfo = (self.lfo_phase.sin() + 0.3 * (self.lfo_phase * 2.0).sin()) * self.depth;
            self.lfo_phase += lfo_inc;
            if self.lfo_phase >= 2.0 * PI {
                self.lfo_phase -= 2.0 * PI;
            }

            // Asymmetric diode-like distortion
            let shaped = if dry > 0.0 {
                dry * (1.0 + lfo)
            } else {
                (dry * 1.5).tanh() * (1.0 - lfo * 0.5)
            };

            *s = dry * (1.0 - self.mix) + shaped * self.mix;
        }
    }

    pub fn reset(&mut self) {
        self.lfo_phase = 0.0;
    }
}

/// Schroeder Reverb Comb Filter
struct CombFilter {
    buffer: Vec<f32>,
    idx: usize,
    feedback: f32,
    filter_store: f32,
    damp: f32,
}

impl CombFilter {
    fn new(size: usize, feedback: f32, damp: f32) -> Self {
        Self {
            buffer: vec![0.0; size],
            idx: 0,
            feedback,
            filter_store: 0.0,
            damp,
        }
    }

    fn process(&mut self, input: f32) -> f32 {
        let output = self.buffer[self.idx];
        self.filter_store = output * (1.0 - self.damp) + self.filter_store * self.damp;
        self.buffer[self.idx] = input + self.filter_store * self.feedback;
        self.idx += 1;
        if self.idx >= self.buffer.len() {
            self.idx = 0;
        }
        output
    }

    fn reset(&mut self) {
        self.buffer.fill(0.0);
        self.filter_store = 0.0;
        self.idx = 0;
    }
}

/// Schroeder Reverb Allpass Filter
struct AllpassFilter {
    buffer: Vec<f32>,
    idx: usize,
    feedback: f32,
}

impl AllpassFilter {
    fn new(size: usize, feedback: f32) -> Self {
        Self {
            buffer: vec![0.0; size],
            idx: 0,
            feedback,
        }
    }

    fn process(&mut self, input: f32) -> f32 {
        let buf_out = self.buffer[self.idx];
        let output = -input + buf_out;
        self.buffer[self.idx] = input + buf_out * self.feedback;
        self.idx += 1;
        if self.idx >= self.buffer.len() {
            self.idx = 0;
        }
        output
    }

    fn reset(&mut self) {
        self.buffer.fill(0.0);
        self.idx = 0;
    }
}

/// Schroeder Cathedral Reverb
pub struct CathedralReverb {
    combs: Vec<CombFilter>,
    allpasses: Vec<AllpassFilter>,
    wet: f32,
    dry: f32,
}

impl CathedralReverb {
    pub fn new(sample_rate: f32) -> Self {
        let scale = sample_rate / 44100.0;
        let comb_delays = [1116, 1188, 1277, 1356, 1422, 1491];
        let allpass_delays = [225, 556];

        let combs = comb_delays
            .iter()
            .map(|&d| CombFilter::new((d as f32 * scale).round() as usize, 0.84, 0.2))
            .collect();

        let allpasses = allpass_delays
            .iter()
            .map(|&d| AllpassFilter::new((d as f32 * scale).round() as usize, 0.5))
            .collect();

        Self {
            combs,
            allpasses,
            wet: 0.55,
            dry: 0.8,
        }
    }

    pub fn set_wet(&mut self, wet: f32) {
        self.wet = wet.clamp(0.0, 1.0);
    }

    pub fn process(&mut self, samples: &mut [f32]) {
        for s in samples.iter_mut() {
            let input = *s;
            let mut comb_sum = 0.0;
            for comb in self.combs.iter_mut() {
                comb_sum += comb.process(input);
            }
            comb_sum *= 0.2;

            let mut allpass_out = comb_sum;
            for allpass in self.allpasses.iter_mut() {
                allpass_out = allpass.process(allpass_out);
            }

            *s = input * self.dry + allpass_out * self.wet;
        }
    }

    pub fn reset(&mut self) {
        for c in self.combs.iter_mut() {
            c.reset();
        }
        for a in self.allpasses.iter_mut() {
            a.reset();
        }
    }
}
