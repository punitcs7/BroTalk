use super::device_manager::DeviceManager;
use super::dsp::{DspChain, DspParams, PresetType};
use super::echoprank::{create_echoprank_engine, SharedEchoPrank};
use super::soundboard::{create_soundboard_engine, SharedSoundboard};
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{Device, Stream};
use parking_lot::Mutex;
use ringbuf::traits::{Consumer, Producer, Split};
use ringbuf::HeapRb;
use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
use std::sync::Arc;
use std::thread;
use std::time::{Duration, Instant};

struct StreamContainer(Vec<Stream>);
unsafe impl Send for StreamContainer {}
unsafe impl Sync for StreamContainer {}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AudioTelemetry {
    pub input_level: f32,
    pub output_level: f32,
    pub latency_ms: f32,
    pub is_muted: bool,
    pub is_bypassed: bool,
    pub hear_myself: bool,
    pub active_preset: PresetType,
    pub active_input_name: String,
    pub active_virtual_name: String,
    pub active_monitor_name: String,
    pub engine_error: Option<String>,
}

#[derive(Clone)]
pub struct AudioEngineState {
    pub is_running: Arc<AtomicBool>,
    pub is_muted: Arc<AtomicBool>,
    pub is_bypassed: Arc<AtomicBool>,
    pub hear_myself: Arc<AtomicBool>,
    pub input_level_bits: Arc<AtomicU32>,
    pub output_level_bits: Arc<AtomicU32>,
    pub latency_ms_bits: Arc<AtomicU32>,
    pub dsp_params: Arc<Mutex<DspParams>>,
    pub echoprank: SharedEchoPrank,
    pub soundboard: SharedSoundboard,
    active_input_device: Arc<Mutex<Option<String>>>,
    active_virtual_device: Arc<Mutex<Option<String>>>,
    active_monitor_device: Arc<Mutex<Option<String>>>,
    engine_error: Arc<Mutex<Option<String>>>,
    streams: Arc<Mutex<StreamContainer>>,
}

unsafe impl Send for AudioEngineState {}
unsafe impl Sync for AudioEngineState {}

impl AudioEngineState {
    pub fn new() -> Self {
        let sample_rate = 48000;
        let channels = 2;

        Self {
            is_running: Arc::new(AtomicBool::new(false)),
            is_muted: Arc::new(AtomicBool::new(false)),
            is_bypassed: Arc::new(AtomicBool::new(false)),
            hear_myself: Arc::new(AtomicBool::new(true)),
            input_level_bits: Arc::new(AtomicU32::new(0.0_f32.to_bits())),
            output_level_bits: Arc::new(AtomicU32::new(0.0_f32.to_bits())),
            latency_ms_bits: Arc::new(AtomicU32::new(5.3_f32.to_bits())),
            dsp_params: Arc::new(Mutex::new(DspParams::default())),
            echoprank: create_echoprank_engine(sample_rate, channels),
            soundboard: create_soundboard_engine(),
            active_input_device: Arc::new(Mutex::new(None)),
            active_virtual_device: Arc::new(Mutex::new(None)),
            active_monitor_device: Arc::new(Mutex::new(None)),
            engine_error: Arc::new(Mutex::new(None)),
            streams: Arc::new(Mutex::new(StreamContainer(Vec::new()))),
        }
    }

    pub fn get_telemetry(&self) -> AudioTelemetry {
        let in_bits = self.input_level_bits.load(Ordering::Relaxed);
        let out_bits = self.output_level_bits.load(Ordering::Relaxed);
        let lat_bits = self.latency_ms_bits.load(Ordering::Relaxed);
        let preset = self.dsp_params.lock().preset;

        AudioTelemetry {
            input_level: f32::from_bits(in_bits),
            output_level: f32::from_bits(out_bits),
            latency_ms: f32::from_bits(lat_bits),
            is_muted: self.is_muted.load(Ordering::Relaxed),
            is_bypassed: self.is_bypassed.load(Ordering::Relaxed),
            hear_myself: self.hear_myself.load(Ordering::Relaxed),
            active_preset: preset,
            active_input_name: self.active_input_device.lock().clone().unwrap_or_default(),
            active_virtual_name: self.active_virtual_device.lock().clone().unwrap_or_default(),
            active_monitor_name: self.active_monitor_device.lock().clone().unwrap_or_default(),
            engine_error: self.engine_error.lock().clone(),
        }
    }

    pub fn start_engine(&self) -> Result<(), String> {
        self.stop_engine();

        let host = cpal::default_host();
        let catalog = DeviceManager::enumerate_devices();

        // 1. Choose input mic device (Prioritize real physical mic / headset)
        let chosen_in_name = self.active_input_device.lock().clone();
        let input_name = chosen_in_name.or(catalog.recommended_input);
        let input_device = if let Some(ref name) = input_name {
            find_input_device_by_name(&host, name)
        } else {
            host.default_input_device()
        }
        .ok_or_else(|| "No input microphone device found on system".to_string())?;

        let actual_in_name = input_device.name().unwrap_or_else(|_| "Microphone".into());
        *self.active_input_device.lock() = Some(actual_in_name.clone());

        // 2. Choose virtual cable render device (CABLE Input)
        let chosen_virt_name = self.active_virtual_device.lock().clone();
        let virtual_name = chosen_virt_name.or(catalog.recommended_virtual);
        let virtual_device = if let Some(ref name) = virtual_name {
            find_output_device_by_name(&host, name)
        } else {
            host.default_output_device()
        }
        .ok_or_else(|| "No virtual output device found on system".to_string())?;

        let actual_virt_name = virtual_device.name().unwrap_or_else(|_| "Virtual Cable".into());
        *self.active_virtual_device.lock() = Some(actual_virt_name.clone());

        // 3. Choose monitor headphones device (Headphones / THX / Speakers)
        let chosen_mon_name = self.active_monitor_device.lock().clone();
        let monitor_name = chosen_mon_name.or(catalog.recommended_monitor);
        let monitor_device = if let Some(ref name) = monitor_name {
            find_output_device_by_name(&host, name)
        } else {
            host.default_output_device()
        };

        if let Some(ref mon) = monitor_device {
            let actual_mon_name = mon.name().unwrap_or_else(|_| "Headphones".into());
            *self.active_monitor_device.lock() = Some(actual_mon_name);
        }

        // Query native Windows WASAPI formats
        let in_supported = input_device
            .default_input_config()
            .map_err(|e| format!("Cannot get default config for mic '{}': {}", actual_in_name, e))?;

        let virt_supported = virtual_device
            .default_output_config()
            .map_err(|e| format!("Cannot get default config for virtual cable '{}': {}", actual_virt_name, e))?;

        let in_channels = in_supported.channels() as usize;
        let _in_rate = in_supported.sample_rate().0;

        let virt_channels = virt_supported.channels() as usize;
        let virt_rate = virt_supported.sample_rate().0;

        // Lock-free ring buffer
        let ring_cap = 19200;
        let rb_mic = HeapRb::<f32>::new(ring_cap);
        let (mut prod_mic, mut cons_mic) = rb_mic.split();

        let rb_cable = HeapRb::<f32>::new(ring_cap);
        let (mut prod_cable, mut cons_cable) = rb_cable.split();

        let rb_mon = HeapRb::<f32>::new(ring_cap);
        let (mut prod_mon, mut cons_mon) = rb_mon.split();

        let in_level = self.input_level_bits.clone();
        let is_muted = self.is_muted.clone();

        // Noise gate threshold: Any room background noise or ADC hiss below 0.012 drops to true 0.0
        const NOISE_GATE_THRESHOLD: f32 = 0.015;

        // A. Capture Stream (Physical Mic -> Downmix to Mono)
        let in_config = in_supported.into();
        let input_stream = input_device
            .build_input_stream(
                &in_config,
                move |data: &[f32], _| {
                    let mut max_abs = 0.0_f32;
                    let muted = is_muted.load(Ordering::Relaxed);

                    for frame in data.chunks(in_channels) {
                        let mono: f32 = if muted {
                            0.0
                        } else {
                            frame.iter().sum::<f32>() / (in_channels as f32)
                        };
                        max_abs = max_abs.max(mono.abs());
                        let _ = prod_mic.try_push(mono);
                    }

                    // Apply noise gate to level meter so it doesn't flicker when silent
                    let gated_level = if max_abs < NOISE_GATE_THRESHOLD {
                        0.0
                    } else {
                        ((max_abs - NOISE_GATE_THRESHOLD) / (1.0 - NOISE_GATE_THRESHOLD)).clamp(0.0, 1.0)
                    };

                    in_level.store(gated_level.to_bits(), Ordering::Relaxed);
                },
                |err| eprintln!("Input mic stream error: {}", err),
                None,
            )
            .map_err(|e| format!("Failed to build stream for mic '{}': {}", actual_in_name, e))?;

        // B. Virtual Cable Output Stream (Render to CABLE Input)
        let out_level = self.output_level_bits.clone();
        let virt_config = virt_supported.into();
        let cable_stream = virtual_device
            .build_output_stream(
                &virt_config,
                move |data: &mut [f32], _| {
                    let mut max_abs = 0.0_f32;
                    for frame in data.chunks_mut(virt_channels) {
                        let left = cons_cable.try_pop().unwrap_or(0.0);
                        let right = cons_cable.try_pop().unwrap_or(left);

                        max_abs = max_abs.max(left.abs()).max(right.abs());

                        if virt_channels == 1 {
                            frame[0] = (left + right) * 0.5;
                        } else if virt_channels == 2 {
                            frame[0] = left;
                            frame[1] = right;
                        } else {
                            frame[0] = left;
                            frame[1] = right;
                            for s in &mut frame[2..] {
                                *s = 0.0;
                            }
                        }
                    }

                    let gated_out = if max_abs < NOISE_GATE_THRESHOLD {
                        0.0
                    } else {
                        ((max_abs - NOISE_GATE_THRESHOLD) / (1.0 - NOISE_GATE_THRESHOLD)).clamp(0.0, 1.0)
                    };

                    out_level.store(gated_out.to_bits(), Ordering::Relaxed);
                },
                |err| eprintln!("Virtual cable stream error: {}", err),
                None,
            )
            .map_err(|e| format!("Failed to build stream for virtual cable '{}': {}", actual_virt_name, e))?;

        // C. Monitor Headphones Stream
        let hear_myself = self.hear_myself.clone();
        let monitor_stream = if let Some(ref mon_dev) = monitor_device {
            if let Ok(mon_supp) = mon_dev.default_output_config() {
                let mon_channels = mon_supp.channels() as usize;
                let mon_cfg = mon_supp.into();
                mon_dev
                    .build_output_stream(
                        &mon_cfg,
                        move |data: &mut [f32], _| {
                            let active = hear_myself.load(Ordering::Relaxed);
                            for frame in data.chunks_mut(mon_channels) {
                                let left = cons_mon.try_pop().unwrap_or(0.0);
                                let right = cons_mon.try_pop().unwrap_or(left);

                                if active {
                                    if mon_channels == 1 {
                                        frame[0] = (left + right) * 0.5;
                                    } else if mon_channels == 2 {
                                        frame[0] = left;
                                        frame[1] = right;
                                    } else {
                                        frame[0] = left;
                                        frame[1] = right;
                                        for s in &mut frame[2..] {
                                            *s = 0.0;
                                        }
                                    }
                                } else {
                                    frame.fill(0.0);
                                }
                            }
                        },
                        |err| eprintln!("Monitor stream error: {}", err),
                        None,
                    )
                    .ok()
            } else {
                None
            }
        } else {
            None
        };

        // D. DSP Processing Thread
        let is_running = self.is_running.clone();
        is_running.store(true, Ordering::SeqCst);

        let dsp_params = self.dsp_params.clone();
        let echoprank = self.echoprank.clone();
        let soundboard = self.soundboard.clone();
        let is_bypassed = self.is_bypassed.clone();
        let latency_bits = self.latency_ms_bits.clone();

        thread::spawn(move || {
            let mmcss_handle = set_mmcss_pro_audio();
            let mut dsp_chain = DspChain::new(virt_rate as f32);
            let mut process_buf = vec![0.0_f32; 128];

            while is_running.load(Ordering::Relaxed) {
                let start_time = Instant::now();

                // Update DSP parameters
                {
                    let p = dsp_params.lock().clone();
                    dsp_chain.set_params(p);
                }

                // Read available mic samples from ringbuffer
                let mut samples_read = 0;
                for s in process_buf.iter_mut() {
                    if let Some(val) = cons_mic.try_pop() {
                        *s = val;
                        samples_read += 1;
                    } else {
                        *s = 0.0;
                    }
                }

                if samples_read > 0 {
                    let active_slice = &mut process_buf[..samples_read];

                    // Apply DSP unless bypassed
                    if !is_bypassed.load(Ordering::Relaxed) {
                        dsp_chain.process(active_slice);
                    }

                    // Mix EchoPrank and Soundboard audio into stereo streams
                    for &mic_s in active_slice.iter() {
                        let prank_frame = echoprank.lock().1.next_frame();
                        let sb_frame = soundboard.lock().next_frame();

                        let (prank_l, prank_r) = prank_frame.unwrap_or((0.0, 0.0));
                        let (sb_l, sb_r) = sb_frame;

                        let final_l = (mic_s + prank_l + sb_l).clamp(-1.0, 1.0);
                        let final_r = (mic_s + prank_r + sb_r).clamp(-1.0, 1.0);

                        let _ = prod_cable.try_push(final_l);
                        let _ = prod_cable.try_push(final_r);

                        let _ = prod_mon.try_push(final_l);
                        let _ = prod_mon.try_push(final_r);
                    }

                    let elapsed = start_time.elapsed().as_secs_f32() * 1000.0;
                    let total_latency = 4.8 + elapsed;
                    latency_bits.store(total_latency.to_bits(), Ordering::Relaxed);
                } else {
                    thread::sleep(Duration::from_micros(500));
                }
            }

            revert_mmcss(mmcss_handle);
        });

        // Start CPAL playback/capture
        input_stream.play().map_err(|e| format!("Mic play error: {}", e))?;
        cable_stream.play().map_err(|e| format!("Cable play error: {}", e))?;
        if let Some(ref mon) = monitor_stream {
            let _ = mon.play();
        }

        let mut streams_guard = self.streams.lock();
        streams_guard.0.clear();
        streams_guard.0.push(input_stream);
        streams_guard.0.push(cable_stream);
        if let Some(mon) = monitor_stream {
            streams_guard.0.push(mon);
        }

        *self.engine_error.lock() = None;
        println!(">>> BroTalk Audio Engine connected: Mic='{}', Virtual='{}'", actual_in_name, actual_virt_name);

        Ok(())
    }

    pub fn stop_engine(&self) {
        self.is_running.store(false, Ordering::SeqCst);
        let mut streams = self.streams.lock();
        streams.0.clear();
    }

    pub fn set_input_device(&self, name: String) {
        *self.active_input_device.lock() = Some(name);
    }

    pub fn set_virtual_device(&self, name: String) {
        *self.active_virtual_device.lock() = Some(name);
    }

    pub fn set_monitor_device(&self, name: String) {
        *self.active_monitor_device.lock() = Some(name);
    }
}

fn find_input_device_by_name(host: &cpal::Host, target_name: &str) -> Option<Device> {
    host.input_devices()
        .ok()?
        .find(|d| d.name().map(|n| n == target_name).unwrap_or(false))
}

fn find_output_device_by_name(host: &cpal::Host, target_name: &str) -> Option<Device> {
    host.output_devices()
        .ok()?
        .find(|d| d.name().map(|n| n == target_name).unwrap_or(false))
}

#[cfg(windows)]
fn set_mmcss_pro_audio() -> usize {
    type AvSetMmThreadCharacteristicsWFn = unsafe extern "system" fn(*const u16, *mut u32) -> usize;
    unsafe {
        #[link(name = "kernel32")]
        extern "system" {
            fn LoadLibraryA(name: *const u8) -> usize;
            fn GetProcAddress(module: usize, name: *const u8) -> usize;
        }

        let mod_name = b"avrt.dll\0";
        let h_mod = LoadLibraryA(mod_name.as_ptr());
        if h_mod != 0 {
            let proc_name = b"AvSetMmThreadCharacteristicsW\0";
            let proc_addr = GetProcAddress(h_mod, proc_name.as_ptr());
            if proc_addr != 0 {
                let func: AvSetMmThreadCharacteristicsWFn = std::mem::transmute(proc_addr);
                let mut task_index = 0u32;
                let task_name: Vec<u16> = "Pro Audio\0".encode_utf16().collect();
                return func(task_name.as_ptr(), &mut task_index);
            }
        }
    }
    0
}

#[cfg(windows)]
fn revert_mmcss(handle: usize) {
    if handle != 0 {
        type AvRevertMmThreadCharacteristicsFn = unsafe extern "system" fn(usize) -> i32;
        unsafe {
            #[link(name = "kernel32")]
            extern "system" {
                fn LoadLibraryA(name: *const u8) -> usize;
                fn GetProcAddress(module: usize, name: *const u8) -> usize;
            }

            let mod_name = b"avrt.dll\0";
            let h_mod = LoadLibraryA(mod_name.as_ptr());
            if h_mod != 0 {
                let proc_name = b"AvRevertMmThreadCharacteristics\0";
                let proc_addr = GetProcAddress(h_mod, proc_name.as_ptr());
                if proc_addr != 0 {
                    let func: AvRevertMmThreadCharacteristicsFn = std::mem::transmute(proc_addr);
                    func(handle);
                }
            }
        }
    }
}

#[cfg(not(windows))]
fn set_mmcss_pro_audio() -> usize { 0 }
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_engine_startup_and_monitor() {
        let engine = AudioEngineState::new();
        let res = engine.start_engine();
        println!("start_engine result: {:?}", res);
        assert!(res.is_ok(), "Engine failed to start: {:?}", res);

        let tele = engine.get_telemetry();
        println!("Telemetry: input='{}', virtual='{}', monitor='{}'", 
            tele.active_input_name, tele.active_virtual_name, tele.active_monitor_name);

        engine.stop_engine();
    }
}

