use rusqlite::Connection;

use crate::error::AppResult;

/// Une migration = une version cible + le SQL à appliquer pour l'atteindre.
struct Migration {
    version: i64,
    sql: &'static str,
}

/// Liste ordonnée des migrations. Pour faire évoluer le schéma, on ajoute
/// une nouvelle entrée avec un numéro de version supérieur — jamais modifier
/// une migration déjà publiée.
const MIGRATIONS: &[Migration] = &[Migration {
    version: 1,
    sql: include_str!("sql/0001_init.sql"),
}];

/// Applique toutes les migrations en attente en s'appuyant sur `PRAGMA user_version`.
pub fn run_migrations(conn: &Connection) -> AppResult<()> {
    conn.execute_batch("PRAGMA foreign_keys = ON;")?;

    let current: i64 =
        conn.query_row("PRAGMA user_version", [], |row| row.get(0))?;

    for migration in MIGRATIONS {
        if migration.version > current {
            conn.execute_batch("BEGIN")?;
            match conn.execute_batch(migration.sql) {
                Ok(_) => {
                    // user_version ne supporte pas les paramètres liés.
                    conn.execute_batch(&format!(
                        "PRAGMA user_version = {};",
                        migration.version
                    ))?;
                    conn.execute_batch("COMMIT")?;
                }
                Err(e) => {
                    let _ = conn.execute_batch("ROLLBACK");
                    return Err(e.into());
                }
            }
        }
    }
    Ok(())
}
