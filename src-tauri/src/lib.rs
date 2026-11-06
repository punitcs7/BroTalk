pub mod audio;
pub mod commands;

use audio::engine::AudioEngineState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let engine_state = AudioEngineState::new();
    let engine_exit = engine_state.clone();

    let app = tauri::Builder::default()
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .manage(engine_state)
        .invoke_handler(tauri::generate_handler![
            commands::get_audio_devices,
            commands::set_audio_devices,
            commands::start_engine,
            commands::stop_engine,
            commands::set_voice_preset,
            commands::set_hear_myself,
            commands::set_master_mute,
            commands::set_effects_bypass,
            commands::echoprank_clip,
            commands::echoprank_start_record,
            commands::echoprank_stop_record,
            commands::echoprank_play,
            commands::echoprank_stop,
            commands::echoprank_get_clip_info,
            commands::soundboard_load_file,
            commands::soundboard_play,
            commands::soundboard_stop_all,
            commands::soundboard_delete,
            commands::soundboard_set_volume,
            commands::soundboard_set_hotkey,
            commands::soundboard_get_slots,
            commands::get_audio_telemetry,
        ])
        .setup(|_app| {
            log::info!("BroTalk engine initialized");
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building BroTalk application");

    app.run(move |_app_handle, event| {
        if let tauri::RunEvent::ExitRequested { .. } = event {
            engine_exit.stop_engine();
        }
    });
}
