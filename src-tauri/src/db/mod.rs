pub mod migrations;
pub mod models;
pub mod sessions;
pub mod settings;
pub mod solves;

#[cfg(test)]
mod tests;

use std::path::Path;
use std::sync::Mutex;

use rusqlite::Connection;

use crate::error::AppResult;

/// État Tauri encapsulant la connexion SQLite (accès sérialisé par un Mutex).
pub struct Db(pub Mutex<Connection>);

/// Ouvre la base, active WAL + clés étrangères et applique les migrations.
pub fn open(path: &Path) -> AppResult<Connection> {
    let conn = Connection::open(path)?;
    conn.execute_batch(
        "PRAGMA journal_mode = WAL;
         PRAGMA synchronous = NORMAL;
         PRAGMA foreign_keys = ON;",
    )?;
    migrations::run_migrations(&conn)?;
    Ok(conn)
}

/// Ouvre une base en mémoire (utile pour les tests).
#[cfg(test)]
pub fn open_in_memory() -> AppResult<Connection> {
    let conn = Connection::open_in_memory()?;
    conn.execute_batch("PRAGMA foreign_keys = ON;")?;
    migrations::run_migrations(&conn)?;
    Ok(conn)
}
