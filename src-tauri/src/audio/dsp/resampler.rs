/// Fast zero-allocation linear interpolation resampler
pub struct Resampler {
    from_sample_rate: f64,
    to_sample_rate: f64,
    ratio: f64,
    fractional_pos: f64,
    last_sample: f32,
}

impl Resampler {
    pub fn new(from_sample_rate: f64, to_sample_rate: f64) -> Self {
        let ratio = from_sample_rate / to_sample_rate;
        Self {
            from_sample_rate,
            to_sample_rate,
            ratio,
            fractional_pos: 0.0,
            last_sample: 0.0,
        }
    }

    pub fn set_rates(&mut self, from_rate: f64, to_rate: f64) {
        self.from_sample_rate = from_rate;
        self.to_sample_rate = to_rate;
        self.ratio = from_rate / to_rate;
        self.fractional_pos = 0.0;
    }

    pub fn process(&mut self, input: &[f32], output: &mut Vec<f32>) {
        if (self.from_sample_rate - self.to_sample_rate).abs() < 1.0 {
            // Identity - 1:1 copy
            output.extend_from_slice(input);
            if let Some(&last) = input.last() {
                self.last_sample = last;
            }
            return;
        }

        let input_len = input.len();
        if input_len == 0 {
            return;
        }

        while self.fractional_pos < input_len as f64 {
            let index = self.fractional_pos.floor() as usize;
            let frac = (self.fractional_pos - index as f64) as f32;

            let s0 = if index == 0 {
                self.last_sample
            } else {
                input[index - 1]
            };

            let s1 = input[index];
            let interpolated = s0 + frac * (s1 - s0);
            output.push(interpolated);

            self.fractional_pos += self.ratio;
        }

        self.fractional_pos -= input_len as f64;
        if let Some(&last) = input.last() {
            self.last_sample = last;
        }
    }

    pub fn reset(&mut self) {
        self.fractional_pos = 0.0;
        self.last_sample = 0.0;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_identity_resampling() {
        let mut resampler = Resampler::new(48000.0, 48000.0);
        let input = vec![0.1, 0.2, 0.3, 0.4];
        let mut output = Vec::new();
        resampler.process(&input, &mut output);
        assert_eq!(input, output);
    }

    #[test]
    fn test_upsampling() {
        let mut resampler = Resampler::new(24000.0, 48000.0);
        let input = vec![0.0, 1.0, 0.0, -1.0];
        let mut output = Vec::new();
        resampler.process(&input, &mut output);
        assert!(output.len() > input.len());
    }
}
