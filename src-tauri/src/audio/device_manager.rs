use cpal::traits::{DeviceTrait, HostTrait};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AudioDeviceInfo {
    pub id: String,
    pub name: String,
    pub is_default: bool,
    pub is_virtual_cable: bool,
    pub is_headphone: bool,
    pub default_sample_rate: u32,
    pub default_channels: u16,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceCatalog {
    pub input_devices: Vec<AudioDeviceInfo>,
    pub output_devices: Vec<AudioDeviceInfo>,
    pub recommended_input: Option<String>,
    pub recommended_virtual: Option<String>,
    pub recommended_monitor: Option<String>,
}

pub struct DeviceManager;

impl DeviceManager {
    pub fn enumerate_devices() -> DeviceCatalog {
        let host = cpal::default_host();
        let default_in = host.default_input_device().and_then(|d| d.name().ok());
        let default_out = host.default_output_device().and_then(|d| d.name().ok());

        let mut input_devices = Vec::new();
        let mut first_real_mic = None;

        if let Ok(devices) = host.input_devices() {
            for device in devices {
                if let Ok(name) = device.name() {
                    let is_virtual = is_virtual_device_name(&name);
                    let is_hp = is_headphone_name(&name);
                    let is_default = default_in.as_ref().map(|d| d == &name).unwrap_or(false);
                    let config = device.default_input_config().ok();
                    let (sample_rate, channels) = if let Some(c) = config {
                        (c.sample_rate().0, c.channels())
                    } else {
                        (48000, 2)
                    };

                    if !is_virtual && first_real_mic.is_none() {
                        first_real_mic = Some(name.clone());
                    }

                    input_devices.push(AudioDeviceInfo {
                        id: name.clone(),
                        name,
                        is_default,
                        is_virtual_cable: is_virtual,
                        is_headphone: is_hp,
                        default_sample_rate: sample_rate,
                        default_channels: channels,
                    });
                }
            }
        }

        let mut output_devices = Vec::new();
        let mut recommended_virtual = None;
        let mut recommended_hp = None;
        let mut first_real_speaker = None;

        if let Ok(devices) = host.output_devices() {
            for device in devices {
                if let Ok(name) = device.name() {
                    let is_virtual = is_virtual_device_name(&name);
                    let is_hp = is_headphone_name(&name);
                    let is_default = default_out.as_ref().map(|d| d == &name).unwrap_or(false);
                    let config = device.default_output_config().ok();
                    let (sample_rate, channels) = if let Some(c) = config {
                        (c.sample_rate().0, c.channels())
                    } else {
                        (48000, 2)
                    };

                    // For virtual output, strictly look for "CABLE Input"
                    if name.to_lowercase().contains("cable input") {
                        recommended_virtual = Some(name.clone());
                    } else if is_virtual && recommended_virtual.is_none() {
                        recommended_virtual = Some(name.clone());
                    }

                    if is_hp && recommended_hp.is_none() {
                        recommended_hp = Some(name.clone());
                    }

                    if !is_virtual && first_real_speaker.is_none() {
                        first_real_speaker = Some(name.clone());
                    }

                    output_devices.push(AudioDeviceInfo {
                        id: name.clone(),
                        name,
                        is_default,
                        is_virtual_cable: is_virtual,
                        is_headphone: is_hp,
                        default_sample_rate: sample_rate,
                        default_channels: channels,
                    });
                }
            }
        }

        // Recommended Input: Always prefer physical mic over virtual cable
        let recommended_input = if let Some(ref def) = default_in {
            if is_virtual_device_name(def) {
                first_real_mic.or_else(|| default_in.clone())
            } else {
                Some(def.clone())
            }
        } else {
            first_real_mic
        };

        // Recommended Monitor: Always prefer default_out if it's a real device (headphones/speakers),
        // otherwise fall back to detected headphones or first real speaker
        let recommended_monitor = if let Some(ref def) = default_out {
            if !is_virtual_device_name(def) {
                Some(def.clone())
            } else {
                recommended_hp.or(first_real_speaker)
            }
        } else {
            recommended_hp.or(first_real_speaker)
        };

        DeviceCatalog {
            input_devices,
            output_devices,
            recommended_input,
            recommended_virtual,
            recommended_monitor,
        }
    }
}

pub fn is_virtual_device_name(name: &str) -> bool {
    let lower = name.to_lowercase();
    lower.contains("cable")
        || lower.contains("vb-audio")
        || lower.contains("virtual")
        || lower.contains("voicemeeter")
        || lower.contains("sonar")
}

pub fn is_headphone_name(name: &str) -> bool {
    let lower = name.to_lowercase();
    lower.contains("headphone")
        || lower.contains("headset")
        || lower.contains("thx spatial")
        || lower.contains("earphone")
        || lower.contains("razer")
        || lower.contains("kraken")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_print_devices() {
        let catalog = DeviceManager::enumerate_devices();
        println!("=== ENUMERATED AUDIO DEVICES ===");
        println!("{}", serde_json::to_string_pretty(&catalog).unwrap());
    }
}

