use std::f32::consts::PI;

/// Direct Form II Transposed Biquad Filter
#[derive(Clone, Copy)]
pub struct BiquadFilter {
    b0: f32,
    b1: f32,
    b2: f32,
    a1: f32,
    a2: f32,
    d1: f32,
    d2: f32,
}

impl BiquadFilter {
    pub fn new() -> Self {
        Self {
            b0: 1.0,
            b1: 0.0,
            b2: 0.0,
            a1: 0.0,
            a2: 0.0,
            d1: 0.0,
            d2: 0.0,
        }
    }

    /// Peak / Bell filter for formant shifting
    pub fn set_peaking(
        &mut self,
        sample_rate: f32,
        center_freq: f32,
        gain_db: f32,
        q: f32,
    ) {
        let w0 = (2.0 * PI * center_freq / sample_rate).clamp(0.001, PI - 0.01);
        let alpha = w0.sin() / (2.0 * q.max(0.1));
        let a = 10.0_f32.powf(gain_db / 40.0);

        let cos_w0 = w0.cos();
        let a0 = 1.0 + alpha / a;
        self.b0 = (1.0 + alpha * a) / a0;
        self.b1 = (-2.0 * cos_w0) / a0;
        self.b2 = (1.0 - alpha * a) / a0;
        self.a1 = (-2.0 * cos_w0) / a0;
        self.a2 = (1.0 - alpha / a) / a0;
    }

    /// Bandpass filter for radio/walkie-talkie
    pub fn set_bandpass(&mut self, sample_rate: f32, center_freq: f32, q: f32) {
        let w0 = (2.0 * PI * center_freq / sample_rate).clamp(0.001, PI - 0.01);
        let alpha = w0.sin() / (2.0 * q.max(0.1));
        let cos_w0 = w0.cos();
        let a0 = 1.0 + alpha;

        self.b0 = (alpha) / a0;
        self.b1 = 0.0;
        self.b2 = (-alpha) / a0;
        self.a1 = (-2.0 * cos_w0) / a0;
        self.a2 = (1.0 - alpha) / a0;
    }

    #[inline(always)]
    pub fn process(&mut self, input: f32) -> f32 {
        let output = self.b0 * input + self.d1;
        self.d1 = self.b1 * input - self.a1 * output + self.d2;
        self.d2 = self.b2 * input - self.a2 * output;
        output
    }

    pub fn reset(&mut self) {
        self.d1 = 0.0;
        self.d2 = 0.0;
    }
}

/// Multi-stage Formant Filter bank for vocal tract manipulation
pub struct FormantFilter {
    sample_rate: f32,
    formant_factor: f32, // 0.6 = deep chest/throat, 1.4 = child/squeak
    filters: [BiquadFilter; 3],
}

impl FormantFilter {
    pub fn new(sample_rate: f32) -> Self {
        let mut filter = Self {
            sample_rate,
            formant_factor: 1.0,
            filters: [BiquadFilter::new(); 3],
        };
        filter.update_filters();
        filter
    }

    pub fn set_formant_factor(&mut self, factor: f32) {
        self.formant_factor = factor.clamp(0.5, 2.0);
        self.update_filters();
    }

    fn update_filters(&mut self) {
        // Human vocal formants approx: F1 ~ 700Hz, F2 ~ 1220Hz, F3 ~ 2600Hz
        let f1 = (700.0 * self.formant_factor).clamp(200.0, 3500.0);
        let f2 = (1220.0 * self.formant_factor).clamp(400.0, 5000.0);
        let f3 = (2600.0 * self.formant_factor).clamp(800.0, 8000.0);

        let gain = if self.formant_factor < 1.0 { 6.0 } else { 4.0 };

        self.filters[0].set_peaking(self.sample_rate, f1, gain, 2.0);
        self.filters[1].set_peaking(self.sample_rate, f2, gain, 2.5);
        self.filters[2].set_peaking(self.sample_rate, f3, gain, 3.0);
    }

    pub fn process(&mut self, samples: &mut [f32]) {
        if (self.formant_factor - 1.0).abs() < 0.02 {
            return;
        }

        for sample in samples.iter_mut() {
            let mut s = *sample;
            for f in self.filters.iter_mut() {
                s = f.process(s);
            }
            *sample = s;
        }
    }

    pub fn reset(&mut self) {
        for f in self.filters.iter_mut() {
            f.reset();
        }
    }
}
