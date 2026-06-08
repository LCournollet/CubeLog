pub mod audio;
mod commands;
mod db;
pub mod error;
mod export;

use std::sync::Mutex;

use tauri::Manager;

use audio::AudioState;
use db::Db;

/// Point d'entrée de l'application Tauri.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(AudioState::default())
        .setup(|app| {
            // Base SQLite dans le dossier de données de l'application.
            let dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&dir)?;
            let db_path = dir.join("cubelog.sqlite");
            let conn = db::open(&db_path)
                .map_err(|e| format!("ouverture de la base : {e}"))?;
            app.manage(Db(Mutex::new(conn)));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::list_sessions,
            commands::create_session,
            commands::rename_session,
            commands::delete_session,
            commands::list_solves,
            commands::add_solve,
            commands::set_solve_penalty,
            commands::set_solve_status,
            commands::set_solve_comment,
            commands::delete_solve_hard,
            commands::get_settings,
            commands::set_setting,
            commands::list_audio_devices,
            commands::start_audio,
            commands::stop_audio,
            commands::audio_is_running,
            commands::audio_self_test,
            commands::export_data,
            commands::import_data,
            commands::save_text_file,
            commands::read_text_file,
        ])
        .run(tauri::generate_context!())
        .expect("erreur lors du démarrage de l'application CubeLog");
}
