use rusqlite::{params, Connection};

use crate::error::AppResult;

use super::models::{compute_final_time, NewSolve, Solve};

fn map_solve(row: &rusqlite::Row) -> rusqlite::Result<Solve> {
    Ok(Solve {
        id: row.get("id")?,
        session_id: row.get("session_id")?,
        puzzle: row.get("puzzle")?,
        created_at: row.get("created_at")?,
        scramble: row.get("scramble")?,
        time_ms: row.get("time_ms")?,
        penalty: row.get("penalty")?,
        final_time_ms: row.get("final_time_ms")?,
        comment: row.get("comment")?,
        source: row.get("source")?,
        status: row.get("status")?,
    })
}

const SELECT_COLS: &str = "id, session_id, puzzle, created_at, scramble, time_ms, \
     penalty, final_time_ms, comment, source, status";

/// Liste les solves "normal" d'une session, du plus ancien au plus récent.
pub fn list_by_session(conn: &Connection, session_id: i64) -> AppResult<Vec<Solve>> {
    let sql = format!(
        "SELECT {SELECT_COLS} FROM solves
         WHERE session_id = ?1 AND status = 'normal'
         ORDER BY created_at ASC, id ASC"
    );
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map(params![session_id], map_solve)?;
    Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
}

/// Insère un nouveau solve, calcule le temps final, retourne le solve créé.
pub fn insert(conn: &Connection, new: &NewSolve) -> AppResult<Solve> {
    let final_time = compute_final_time(new.time_ms, &new.penalty);
    conn.execute(
        "INSERT INTO solves
            (session_id, puzzle, created_at, scramble, time_ms, penalty,
             final_time_ms, comment, source, status)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 'normal')",
        params![
            new.session_id,
            new.puzzle,
            new.created_at,
            new.scramble,
            new.time_ms,
            new.penalty,
            final_time,
            new.comment,
            new.source,
        ],
    )?;
    let id = conn.last_insert_rowid();
    get(conn, id)?.ok_or_else(|| crate::error::AppError::other("solve introuvable après insertion"))
}

/// Récupère un solve par id.
pub fn get(conn: &Connection, id: i64) -> AppResult<Option<Solve>> {
    let sql = format!("SELECT {SELECT_COLS} FROM solves WHERE id = ?1");
    let mut stmt = conn.prepare(&sql)?;
    let mut rows = stmt.query_map(params![id], map_solve)?;
    match rows.next() {
        Some(r) => Ok(Some(r?)),
        None => Ok(None),
    }
}

/// Modifie la pénalité d'un solve et recalcule le temps final.
pub fn set_penalty(conn: &Connection, id: i64, penalty: &str) -> AppResult<Solve> {
    let time_ms: i64 =
        conn.query_row("SELECT time_ms FROM solves WHERE id = ?1", params![id], |r| {
            r.get(0)
        })?;
    let final_time = compute_final_time(time_ms, penalty);
    conn.execute(
        "UPDATE solves SET penalty = ?1, final_time_ms = ?2 WHERE id = ?3",
        params![penalty, final_time, id],
    )?;
    get(conn, id)?.ok_or_else(|| crate::error::AppError::other("solve introuvable"))
}

/// Change le statut (normal | deleted | archived).
pub fn set_status(conn: &Connection, id: i64, status: &str) -> AppResult<()> {
    conn.execute(
        "UPDATE solves SET status = ?1 WHERE id = ?2",
        params![status, id],
    )?;
    Ok(())
}

/// Met à jour la note d'un solve.
pub fn set_comment(conn: &Connection, id: i64, comment: Option<&str>) -> AppResult<()> {
    conn.execute(
        "UPDATE solves SET comment = ?1 WHERE id = ?2",
        params![comment, id],
    )?;
    Ok(())
}

/// Supprime définitivement un solve.
pub fn delete_hard(conn: &Connection, id: i64) -> AppResult<()> {
    conn.execute("DELETE FROM solves WHERE id = ?1", params![id])?;
    Ok(())
}
