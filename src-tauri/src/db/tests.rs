use super::models::NewSolve;
use super::{open_in_memory, sessions, settings, solves};

/// Compteur monotone pour garantir un ordre chronologique stable et
/// indépendant de la valeur du temps (évite que le tri par created_at
/// réordonne les solves selon leur durée).
fn new_solve(session_id: i64, time_ms: i64, penalty: &str) -> NewSolve {
    use std::sync::atomic::{AtomicI64, Ordering};
    static SEQ: AtomicI64 = AtomicI64::new(1);
    NewSolve {
        session_id,
        puzzle: "333".into(),
        created_at: SEQ.fetch_add(1, Ordering::SeqCst),
        scramble: "R U R' U'".into(),
        time_ms,
        penalty: penalty.into(),
        source: "keyboard".into(),
        comment: None,
    }
}

#[test]
fn migrations_create_default_session() {
    let conn = open_in_memory().unwrap();
    let list = sessions::list(&conn).unwrap();
    assert_eq!(list.len(), 1, "une session par défaut doit exister");
    assert_eq!(list[0].solve_count, Some(0));
}

#[test]
fn insert_and_list_solves() {
    let conn = open_in_memory().unwrap();
    let sid = sessions::create(&conn, "Test", "333", 123).unwrap();

    solves::insert(&conn, &new_solve(sid, 12_340, "none")).unwrap();
    solves::insert(&conn, &new_solve(sid, 9_990, "plus2")).unwrap();

    let list = solves::list_by_session(&conn, sid).unwrap();
    assert_eq!(list.len(), 2);
    // Ordre chronologique.
    assert_eq!(list[0].time_ms, 12_340);
    assert_eq!(list[1].final_time_ms, Some(11_990)); // 9990 + 2000
}

#[test]
fn penalty_update_recomputes_final_time() {
    let conn = open_in_memory().unwrap();
    let sid = sessions::create(&conn, "Test", "333", 1).unwrap();
    let s = solves::insert(&conn, &new_solve(sid, 10_000, "none")).unwrap();
    assert_eq!(s.final_time_ms, Some(10_000));

    let updated = solves::set_penalty(&conn, s.id, "dnf").unwrap();
    assert_eq!(updated.penalty, "dnf");
    assert_eq!(updated.final_time_ms, None);

    let updated = solves::set_penalty(&conn, s.id, "plus2").unwrap();
    assert_eq!(updated.final_time_ms, Some(12_000));
}

#[test]
fn deleted_solves_excluded_from_list() {
    let conn = open_in_memory().unwrap();
    let sid = sessions::create(&conn, "Test", "333", 1).unwrap();
    let s = solves::insert(&conn, &new_solve(sid, 5_000, "none")).unwrap();
    solves::set_status(&conn, s.id, "deleted").unwrap();
    assert!(solves::list_by_session(&conn, sid).unwrap().is_empty());

    // Restauration.
    solves::set_status(&conn, s.id, "normal").unwrap();
    assert_eq!(solves::list_by_session(&conn, sid).unwrap().len(), 1);
}

#[test]
fn deleting_session_cascades_to_solves() {
    let conn = open_in_memory().unwrap();
    let sid = sessions::create(&conn, "Test", "333", 1).unwrap();
    solves::insert(&conn, &new_solve(sid, 5_000, "none")).unwrap();
    sessions::delete(&conn, sid).unwrap();

    let count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM solves WHERE session_id = ?1",
            [sid],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(count, 0);
}

#[test]
fn settings_upsert() {
    let conn = open_in_memory().unwrap();
    settings::set(&conn, "theme", "\"dark\"").unwrap();
    assert_eq!(settings::get(&conn, "theme").unwrap().as_deref(), Some("\"dark\""));
    settings::set(&conn, "theme", "\"light\"").unwrap();
    assert_eq!(settings::get(&conn, "theme").unwrap().as_deref(), Some("\"light\""));
}
