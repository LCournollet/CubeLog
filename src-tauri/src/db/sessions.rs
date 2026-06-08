use rusqlite::{params, Connection};

use crate::error::AppResult;

use super::models::Session;

fn map_session(row: &rusqlite::Row) -> rusqlite::Result<Session> {
    Ok(Session {
        id: row.get("id")?,
        name: row.get("name")?,
        puzzle: row.get("puzzle")?,
        created_at: row.get("created_at")?,
        solve_count: row.get("solve_count").ok(),
    })
}

/// Liste toutes les sessions avec leur nombre de solves "normal".
pub fn list(conn: &Connection) -> AppResult<Vec<Session>> {
    let mut stmt = conn.prepare(
        "SELECT s.id, s.name, s.puzzle, s.created_at,
                (SELECT COUNT(*) FROM solves v
                 WHERE v.session_id = s.id AND v.status = 'normal') AS solve_count
         FROM sessions s
         ORDER BY s.created_at ASC",
    )?;
    let rows = stmt.query_map([], map_session)?;
    Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
}

/// Crée une session et retourne son id.
pub fn create(
    conn: &Connection,
    name: &str,
    puzzle: &str,
    created_at: i64,
) -> AppResult<i64> {
    conn.execute(
        "INSERT INTO sessions (name, puzzle, created_at) VALUES (?1, ?2, ?3)",
        params![name, puzzle, created_at],
    )?;
    Ok(conn.last_insert_rowid())
}

/// Renomme une session.
pub fn rename(conn: &Connection, id: i64, name: &str) -> AppResult<()> {
    conn.execute(
        "UPDATE sessions SET name = ?1 WHERE id = ?2",
        params![name, id],
    )?;
    Ok(())
}

/// Supprime une session et tous ses solves (ON DELETE CASCADE).
pub fn delete(conn: &Connection, id: i64) -> AppResult<()> {
    conn.execute("DELETE FROM sessions WHERE id = ?1", params![id])?;
    Ok(())
}

/// Récupère une session par id. (API conservée pour usage futur.)
#[allow(dead_code)]
pub fn get(conn: &Connection, id: i64) -> AppResult<Option<Session>> {
    let mut stmt = conn.prepare(
        "SELECT id, name, puzzle, created_at, NULL AS solve_count
         FROM sessions WHERE id = ?1",
    )?;
    let mut rows = stmt.query_map(params![id], map_session)?;
    match rows.next() {
        Some(r) => Ok(Some(r?)),
        None => Ok(None),
    }
}
