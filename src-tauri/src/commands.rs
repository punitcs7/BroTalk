use crate::audio::device_manager::{DeviceCatalog, DeviceManager};
use crate::audio::dsp::DspParams;
use crate::audio::echoprank::{EchoPrankClipInfo, PlaybackOptions, VaultSlotInfo};
use crate::audio::engine::{AudioEngineState, AudioTelemetry};
use crate::audio::soundboard::SoundboardSlot;
use std::sync::atomic::Ordering;
use tauri::State;

#[tauri::command]
pub fn get_audio_devices() -> DeviceCatalog {
    DeviceManager::enumerate_devices()
}

#[tauri::command]
pub fn set_audio_devices(
    state: State<'_, AudioEngineState>,
    input_id: Option<String>,
    virtual_id: Option<String>,
    monitor_id: Option<String>,
) -> Result<(), String> {
    if let Some(in_dev) = input_id {
        state.set_input_device(in_dev);
    }
    if let Some(virt_dev) = virtual_id {
        state.set_virtual_device(virt_dev);
    }
    if let Some(mon_dev) = monitor_id {
        state.set_monitor_device(mon_dev);
    }

    // If already running, restart streams with newly selected devices
    if state.is_running.load(Ordering::Relaxed) {
        state.stop_engine();
        state.start_engine()?;
    }

    Ok(())
}

#[tauri::command]
pub fn start_engine(state: State<'_, AudioEngineState>) -> Result<(), String> {
    state.start_engine()
}

#[tauri::command]
pub fn stop_engine(state: State<'_, AudioEngineState>) -> Result<(), String> {
    state.stop_engine();
    Ok(())
}

#[tauri::command]
pub fn set_voice_preset(state: State<'_, AudioEngineState>, params: DspParams) {
    println!(">>> TAURI IPC set_voice_preset received: {:?}", params.preset);
    *state.dsp_params.lock() = params;
}

#[tauri::command]
pub fn set_hear_myself(state: State<'_, AudioEngineState>, enabled: bool) {
    println!(">>> TAURI IPC set_hear_myself: {}", enabled);
    state.hear_myself.store(enabled, Ordering::Relaxed);
}

#[tauri::command]
pub fn set_master_mute(state: State<'_, AudioEngineState>, muted: bool) {
    println!(">>> TAURI IPC set_master_mute: {}", muted);
    state.is_muted.store(muted, Ordering::Relaxed);
}

#[tauri::command]
pub fn set_effects_bypass(state: State<'_, AudioEngineState>, bypassed: bool) {
    println!(">>> TAURI IPC set_effects_bypass: {}", bypassed);
    state.is_bypassed.store(bypassed, Ordering::Relaxed);
}

#[tauri::command]
pub fn echoprank_clip(
    state: State<'_, AudioEngineState>,
    duration_secs: f32,
) -> Result<EchoPrankClipInfo, String> {
    let mut guard = state.echoprank.lock();
    let (ref buf, ref mut pad) = *guard;
    let clipped = buf.clip_last(duration_secs);

    pad.arm(clipped, 48000, 2);
    let peaks = pad.get_waveform_peaks(120);

    Ok(EchoPrankClipInfo {
        duration_secs,
        sample_rate: 48000,
        channels: 2,
        waveform_peaks: peaks,
        is_armed: true,
    })
}

#[tauri::command]
pub fn echoprank_start_record(state: State<'_, AudioEngineState>) {
    let mut guard = state.echoprank.lock();
    guard.0.start_push_to_record();
}

#[tauri::command]
pub fn echoprank_stop_record(state: State<'_, AudioEngineState>) -> Result<EchoPrankClipInfo, String> {
    let mut guard = state.echoprank.lock();
    let (ref mut buf, ref mut pad) = *guard;
    let audio = buf.stop_push_to_record();
    let duration = (audio.len() / 2) as f32 / 48000.0;

    pad.arm(audio, 48000, 2);
    let peaks = pad.get_waveform_peaks(120);

    Ok(EchoPrankClipInfo {
        duration_secs: duration,
        sample_rate: 48000,
        channels: 2,
        waveform_peaks: peaks,
        is_armed: true,
    })
}

#[tauri::command]
pub fn echoprank_play(state: State<'_, AudioEngineState>, options: PlaybackOptions) {
    let mut guard = state.echoprank.lock();
    guard.1.trigger_play(Some(options));
}

#[tauri::command]
pub fn echoprank_stop(state: State<'_, AudioEngineState>) {
    let mut guard = state.echoprank.lock();
    guard.1.stop();
}

#[tauri::command]
pub fn echoprank_get_clip_info(state: State<'_, AudioEngineState>) -> EchoPrankClipInfo {
    let guard = state.echoprank.lock();
    let pad = &guard.1;
    let total_frames = pad.samples.len() / (pad.channels as usize).max(1);
    let duration = total_frames as f32 / pad.sample_rate as f32;

    EchoPrankClipInfo {
        duration_secs: duration,
        sample_rate: pad.sample_rate,
        channels: pad.channels,
        waveform_peaks: pad.get_waveform_peaks(120),
        is_armed: !pad.samples.is_empty(),
    }
}

#[tauri::command]
pub fn echoprank_play_vault(
    state: State<'_, AudioEngineState>,
    slot_id: String,
) -> Result<EchoPrankClipInfo, String> {
    let mut guard = state.echoprank.lock();
    guard.1.play_vault(&slot_id).ok_or_else(|| format!("Vault slot '{}' not found", slot_id))
}

#[tauri::command]
pub fn echoprank_save_vault(
    state: State<'_, AudioEngineState>,
    slot_id: String,
    name: Option<String>,
) -> Result<VaultSlotInfo, String> {
    let mut guard = state.echoprank.lock();
    guard.1.save_current_to_vault(&slot_id, name)
}

#[tauri::command]
pub fn echoprank_get_vault_slots(
    state: State<'_, AudioEngineState>,
) -> Vec<VaultSlotInfo> {
    let guard = state.echoprank.lock();
    guard.1.get_vault_slots()
}

#[tauri::command]
pub fn soundboard_play_sfx(state: State<'_, AudioEngineState>, sfx_type: String) {
    let mut sb = state.soundboard.lock();
    sb.play_sfx(&sfx_type);
}

#[tauri::command]
pub fn soundboard_load_file(
    state: State<'_, AudioEngineState>,
    path: String,
    slot_id: Option<String>,
) -> Result<SoundboardSlot, String> {
    let mut sb = state.soundboard.lock();
    sb.load_audio_file(&path, slot_id)
}

#[tauri::command]
pub fn soundboard_play(state: State<'_, AudioEngineState>, slot_id: String) {
    let mut sb = state.soundboard.lock();
    sb.play(&slot_id);
}

#[tauri::command]
pub fn soundboard_stop_all(state: State<'_, AudioEngineState>) {
    let mut sb = state.soundboard.lock();
    sb.stop_all();
}

#[tauri::command]
pub fn soundboard_delete(state: State<'_, AudioEngineState>, slot_id: String) {
    let mut sb = state.soundboard.lock();
    sb.delete_slot(&slot_id);
}

#[tauri::command]
pub fn soundboard_set_volume(state: State<'_, AudioEngineState>, slot_id: String, volume: f32) {
    let mut sb = state.soundboard.lock();
    sb.set_slot_volume(&slot_id, volume);
}

#[tauri::command]
pub fn soundboard_set_hotkey(
    state: State<'_, AudioEngineState>,
    slot_id: String,
    hotkey: Option<String>,
) {
    let mut sb = state.soundboard.lock();
    sb.set_slot_hotkey(&slot_id, hotkey);
}

#[tauri::command]
pub fn soundboard_get_slots(state: State<'_, AudioEngineState>) -> Vec<SoundboardSlot> {
    let sb = state.soundboard.lock();
    sb.get_slots()
}

#[tauri::command]
pub fn get_audio_telemetry(state: State<'_, AudioEngineState>) -> AudioTelemetry {
    state.get_telemetry()
}
