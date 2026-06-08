use std::collections::HashMap;
use std::time::{SystemTime, UNIX_EPOCH};

use tauri::{AppHandle, State};

use crate::audio::capture::{self, StartOptions};
use crate::audio::devices::{list_input_devices, AudioDevice};
use crate::audio::stackmat::StackmatPacket;
use crate::audio::AudioState;
use crate::db::models::{NewSolve, Session, Solve};
use crate::db::{self, Db};
use crate::error::AppResult;
use crate::export;

fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn list_sessions(db: State<Db>) -> AppResult<Vec<Session>> {
    let conn = db.0.lock().unwrap();
    db::sessions::list(&conn)
}

#[tauri::command]
pub fn create_session(
    db: State<Db>,
    name: String,
    puzzle: String,
) -> AppResult<Session> {
    let conn = db.0.lock().unwrap();
    let created_at = now_ms();
    let id = db::sessions::create(&conn, &name, &puzzle, created_at)?;
    Ok(Session {
        id,
        name,
        puzzle,
        created_at,
        solve_count: Some(0),
    })
}

#[tauri::command]
pub fn rename_session(db: State<Db>, id: i64, name: String) -> AppResult<()> {
    let conn = db.0.lock().unwrap();
    db::sessions::rename(&conn, id, &name)
}

#[tauri::command]
pub fn delete_session(db: State<Db>, id: i64) -> AppResult<()> {
    let conn = db.0.lock().unwrap();
    db::sessions::delete(&conn, id)
}

// ---------------------------------------------------------------------------
// Solves
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn list_solves(db: State<Db>, session_id: i64) -> AppResult<Vec<Solve>> {
    let conn = db.0.lock().unwrap();
    db::solves::list_by_session(&conn, session_id)
}

#[tauri::command]
pub fn add_solve(db: State<Db>, solve: NewSolve) -> AppResult<Solve> {
    let conn = db.0.lock().unwrap();
    db::solves::insert(&conn, &solve)
}

#[tauri::command]
pub fn set_solve_penalty(db: State<Db>, id: i64, penalty: String) -> AppResult<Solve> {
    let conn = db.0.lock().unwrap();
    db::solves::set_penalty(&conn, id, &penalty)
}

#[tauri::command]
pub fn set_solve_status(db: State<Db>, id: i64, status: String) -> AppResult<()> {
    let conn = db.0.lock().unwrap();
    db::solves::set_status(&conn, id, &status)
}

#[tauri::command]
pub fn set_solve_comment(
    db: State<Db>,
    id: i64,
    comment: Option<String>,
) -> AppResult<()> {
    let conn = db.0.lock().unwrap();
    db::solves::set_comment(&conn, id, comment.as_deref())
}

#[tauri::command]
pub fn delete_solve_hard(db: State<Db>, id: i64) -> AppResult<()> {
    let conn = db.0.lock().unwrap();
    db::solves::delete_hard(&conn, id)
}

// ---------------------------------------------------------------------------
// Réglages
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn get_settings(db: State<Db>) -> AppResult<HashMap<String, String>> {
    let conn = db.0.lock().unwrap();
    db::settings::get_all(&conn)
}

#[tauri::command]
pub fn set_setting(db: State<Db>, key: String, value: String) -> AppResult<()> {
    let conn = db.0.lock().unwrap();
    db::settings::set(&conn, &key, &value)
}

// ---------------------------------------------------------------------------
// Audio
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn list_audio_devices() -> AppResult<Vec<AudioDevice>> {
    list_input_devices()
}

#[tauri::command]
pub fn start_audio(
    app: AppHandle,
    audio: State<AudioState>,
    options: StartOptions,
) -> AppResult<()> {
    capture::start(&app, &audio, options)
}

#[tauri::command]
pub fn stop_audio(audio: State<AudioState>) -> AppResult<()> {
    capture::stop(&audio);
    Ok(())
}

#[tauri::command]
pub fn audio_is_running(audio: State<AudioState>) -> bool {
    audio.is_running()
}

#[tauri::command]
pub fn audio_self_test() -> Vec<StackmatPacket> {
    capture::self_test()
}

// ---------------------------------------------------------------------------
// Export / Import
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn export_data(
    db: State<Db>,
    format: String,
    session_id: Option<i64>,
) -> AppResult<String> {
    let conn = db.0.lock().unwrap();
    match format.as_str() {
        "csv" => export::export_csv(&conn, session_id),
        _ => export::export_json(&conn, session_id, now_ms()),
    }
}

#[tauri::command]
pub fn import_data(db: State<Db>, json: String) -> AppResult<usize> {
    let mut guard = db.0.lock().unwrap();
    let conn = &mut *guard;
    export::import_json(conn, &json)
}

#[tauri::command]
pub fn save_text_file(path: String, content: String) -> AppResult<()> {
    std::fs::write(&path, content)?;
    Ok(())
}

#[tauri::command]
pub fn read_text_file(path: String) -> AppResult<String> {
    Ok(std::fs::read_to_string(&path)?)
}
