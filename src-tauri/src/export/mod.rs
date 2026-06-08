//! Exports / imports CSV et JSON.

use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};

use crate::db::models::{compute_final_time, Solve};
use crate::error::{AppError, AppResult};

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ExportSession {
    name: String,
    puzzle: String,
    created_at: i64,
    solves: Vec<Solve>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ExportFile {
    app: String,
    format_version: u32,
    exported_at: i64,
    sessions: Vec<ExportSession>,
}

/// Récupère tous les solves d'une session (tous statuts sauf supprimés).
fn solves_for_export(conn: &Connection, session_id: i64) -> AppResult<Vec<Solve>> {
    let mut stmt = conn.prepare(
        "SELECT id, session_id, puzzle, created_at, scramble, time_ms, penalty,
                final_time_ms, comment, source, status
         FROM solves
         WHERE session_id = ?1 AND status != 'deleted'
         ORDER BY created_at ASC, id ASC",
    )?;
    let rows = stmt.query_map(params![session_id], |row| {
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
    })?;
    Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
}

/// Liste (id, name, puzzle, created_at) des sessions à exporter.
fn sessions_for_export(
    conn: &Connection,
    only: Option<i64>,
) -> AppResult<Vec<(i64, String, String, i64)>> {
    let mut out = Vec::new();
    match only {
        Some(id) => {
            let row = conn.query_row(
                "SELECT id, name, puzzle, created_at FROM sessions WHERE id = ?1",
                params![id],
                |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?)),
            )?;
            out.push(row);
        }
        None => {
            let mut stmt = conn.prepare(
                "SELECT id, name, puzzle, created_at FROM sessions ORDER BY created_at ASC",
            )?;
            let rows = stmt.query_map([], |r| {
                Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?))
            })?;
            for r in rows {
                out.push(r?);
            }
        }
    }
    Ok(out)
}

/// Export JSON complet (toutes les sessions, ou une seule si `session_id`).
pub fn export_json(
    conn: &Connection,
    session_id: Option<i64>,
    now_ms: i64,
) -> AppResult<String> {
    let mut sessions = Vec::new();
    for (id, name, puzzle, created_at) in sessions_for_export(conn, session_id)? {
        sessions.push(ExportSession {
            name,
            puzzle,
            created_at,
            solves: solves_for_export(conn, id)?,
        });
    }
    let file = ExportFile {
        app: "CubeLog".into(),
        format_version: 1,
        exported_at: now_ms,
        sessions,
    };
    Ok(serde_json::to_string_pretty(&file)?)
}

/// Échappe un champ CSV (RFC 4180).
fn csv_escape(field: &str) -> String {
    if field.contains([',', '"', '\n', '\r']) {
        format!("\"{}\"", field.replace('"', "\"\""))
    } else {
        field.to_string()
    }
}

/// Export CSV (une ligne par solve).
pub fn export_csv(conn: &Connection, session_id: Option<i64>) -> AppResult<String> {
    let mut out = String::from(
        "session,puzzle,date_ms,scramble,time_ms,penalty,final_time_ms,source,status,comment\n",
    );
    for (id, name, _puzzle, _created) in sessions_for_export(conn, session_id)? {
        for s in solves_for_export(conn, id)? {
            let final_str = s.final_time_ms.map(|v| v.to_string()).unwrap_or_default();
            let comment = s.comment.unwrap_or_default();
            let line = [
                csv_escape(&name),
                csv_escape(&s.puzzle),
                s.created_at.to_string(),
                csv_escape(&s.scramble),
                s.time_ms.to_string(),
                csv_escape(&s.penalty),
                final_str,
                csv_escape(&s.source),
                csv_escape(&s.status),
                csv_escape(&comment),
            ]
            .join(",");
            out.push_str(&line);
            out.push('\n');
        }
    }
    Ok(out)
}

/// Importe un export JSON CubeLog. Crée de nouvelles sessions et solves.
/// Renvoie le nombre de solves importés.
pub fn import_json(conn: &mut Connection, json: &str) -> AppResult<usize> {
    let file: ExportFile = serde_json::from_str(json)
        .map_err(|e| AppError::other(format!("JSON invalide : {e}")))?;
    if file.app != "CubeLog" {
        return Err(AppError::other(
            "ce fichier n'est pas un export CubeLog",
        ));
    }

    let tx = conn.transaction()?;
    let mut imported = 0usize;
    for session in &file.sessions {
        tx.execute(
            "INSERT INTO sessions (name, puzzle, created_at) VALUES (?1, ?2, ?3)",
            params![session.name, session.puzzle, session.created_at],
        )?;
        let new_session_id = tx.last_insert_rowid();

        for s in &session.solves {
            // Recalcule le temps final pour garantir la cohérence.
            let final_time = compute_final_time(s.time_ms, &s.penalty);
            tx.execute(
                "INSERT INTO solves
                    (session_id, puzzle, created_at, scramble, time_ms, penalty,
                     final_time_ms, comment, source, status)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
                params![
                    new_session_id,
                    s.puzzle,
                    s.created_at,
                    s.scramble,
                    s.time_ms,
                    s.penalty,
                    final_time,
                    s.comment,
                    s.source,
                    s.status,
                ],
            )?;
            imported += 1;
        }
    }
    tx.commit()?;
    Ok(imported)
}
