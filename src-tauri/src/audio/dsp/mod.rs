pub mod effects;
pub mod formant_filter;
pub mod pitch_shifter;
pub mod resampler;

use effects::{AlienEffect, CathedralReverb, RadioEffect, RingModulator};
use formant_filter::FormantFilter;
use pitch_shifter::PitchShifter;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum PresetType {
    Clean,
    Titan,
    Helium,
    Robot,
    Radio,
    Alien,
    Cathedral,
    Custom,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DspParams {
    pub preset: PresetType,
    #[serde(alias = "pitch_semitones")]
    pub pitch_semitones: f32,
    #[serde(alias = "formant_factor")]
    pub formant_factor: f32,
    #[serde(alias = "wet_dry_mix")]
    pub wet_dry_mix: f32,
    #[serde(alias = "robot_carrier_freq")]
    pub robot_carrier_freq: f32,
    #[serde(alias = "radio_drive")]
    pub radio_drive: f32,
    #[serde(alias = "reverb_wet")]
    pub reverb_wet: f32,
}

impl Default for DspParams {
    fn default() -> Self {
        Self {
            preset: PresetType::Clean,
            pitch_semitones: 0.0,
            formant_factor: 1.0,
            wet_dry_mix: 1.0,
            robot_carrier_freq: 120.0,
            radio_drive: 2.5,
            reverb_wet: 0.5,
        }
    }
}

pub struct DspChain {
    pitch_shifter: PitchShifter,
    formant_filter: FormantFilter,
    ring_mod: RingModulator,
    radio_fx: RadioEffect,
    alien_fx: AlienEffect,
    cathedral_reverb: CathedralReverb,
    params: DspParams,
}

impl DspChain {
    pub fn new(sample_rate: f32) -> Self {
        Self {
            pitch_shifter: PitchShifter::new(sample_rate, 25.0),
            formant_filter: FormantFilter::new(sample_rate),
            ring_mod: RingModulator::new(sample_rate),
            radio_fx: RadioEffect::new(sample_rate),
            alien_fx: AlienEffect::new(sample_rate),
            cathedral_reverb: CathedralReverb::new(sample_rate),
            params: DspParams::default(),
        }
    }

    pub fn set_params(&mut self, mut params: DspParams) {
        if self.params == params {
            return;
        }

        println!(">>> DSP PRESET CHANGED: {:?} (pitch={}st, formant={})", params.preset, params.pitch_semitones, params.formant_factor);

        match params.preset {
            PresetType::Clean => {
                params.pitch_semitones = 0.0;
                params.formant_factor = 1.0;
            }
            PresetType::Titan => {
                params.pitch_semitones = -7.0;
                params.formant_factor = 0.70;
            }
            PresetType::Helium => {
                params.pitch_semitones = 9.0;
                params.formant_factor = 1.50;
            }
            PresetType::Robot => {
                params.pitch_semitones = -1.0;
                params.formant_factor = 1.0;
                self.ring_mod.set_carrier_freq(params.robot_carrier_freq);
            }
            PresetType::Radio => {
                params.pitch_semitones = 0.0;
                params.formant_factor = 1.1;
                self.radio_fx.set_drive(params.radio_drive);
            }
            PresetType::Alien => {
                params.pitch_semitones = 2.5;
                params.formant_factor = 1.25;
            }
            PresetType::Cathedral => {
                params.pitch_semitones = 0.0;
                params.formant_factor = 1.0;
                self.cathedral_reverb.set_wet(params.reverb_wet);
            }
            PresetType::Custom => {
                // Keep caller's custom pitch and formant values
            }
        }

        self.pitch_shifter.set_semitones(params.pitch_semitones);
        self.formant_filter.set_formant_factor(params.formant_factor);
        self.params = params;
    }

    pub fn process(&mut self, samples: &mut [f32]) {
        if self.params.preset == PresetType::Clean {
            return;
        }

        // 1. Pitch Shifter
        self.pitch_shifter.process(samples);

        // 2. Formant Filter
        self.formant_filter.process(samples);

        // 3. Preset specific effect modules
        match self.params.preset {
            PresetType::Robot => {
                self.ring_mod.process(samples);
            }
            PresetType::Radio => {
                self.radio_fx.process(samples);
            }
            PresetType::Alien => {
                self.alien_fx.process(samples);
            }
            PresetType::Cathedral => {
                self.cathedral_reverb.process(samples);
            }
            _ => {}
        }
    }

    pub fn reset(&mut self) {
        self.pitch_shifter.reset();
        self.formant_filter.reset();
        self.ring_mod.reset();
        self.radio_fx.reset();
        self.alien_fx.reset();
        self.cathedral_reverb.reset();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_all_presets_modify_audio() {
        let sample_rate = 48000.0;
        let presets = [
            PresetType::Titan,
            PresetType::Helium,
            PresetType::Robot,
            PresetType::Radio,
            PresetType::Alien,
            PresetType::Cathedral,
        ];

        for &preset in &presets {
            let mut chain = DspChain::new(sample_rate);
            let mut params = DspParams::default();
            params.preset = preset;
            chain.set_params(params);

            // Generate 1000 samples of 440 Hz sine wave
            let original: Vec<f32> = (0..1000)
                .map(|i| ((i as f32) * 440.0 * 2.0 * std::f32::consts::PI / sample_rate).sin())
                .collect();
            let mut processed = original.clone();
            chain.process(&mut processed);

            // Calculate difference
            let diff: f32 = original
                .iter()
                .zip(processed.iter())
                .map(|(a, b)| (a - b).abs())
                .sum::<f32>()
                / (original.len() as f32);

            println!("Preset {:?}: average diff = {}", preset, diff);
            assert!(
                diff > 0.05,
                "Preset {:?} did not noticeably alter audio! diff={}",
                preset,
                diff
            );
        }
    }
}
