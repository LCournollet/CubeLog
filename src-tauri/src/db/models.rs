use serde::{Deserialize, Serialize};

/// Session de chronométrage. (camelCase pour matcher les types TypeScript.)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Session {
    pub id: i64,
    pub name: String,
    pub puzzle: String,
    pub created_at: i64,
    /// Nombre de solves "normal" (rempli par les requêtes de listing).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub solve_count: Option<i64>,
}

/// Un solve complet tel que stocké.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Solve {
    pub id: i64,
    pub session_id: i64,
    pub puzzle: String,
    pub created_at: i64,
    pub scramble: String,
    pub time_ms: i64,
    pub penalty: String,
    pub final_time_ms: Option<i64>,
    pub comment: Option<String>,
    pub source: String,
    pub status: String,
}

/// Données d'entrée pour créer un solve (champs dérivés calculés côté backend).
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NewSolve {
    pub session_id: i64,
    pub puzzle: String,
    pub created_at: i64,
    pub scramble: String,
    pub time_ms: i64,
    pub penalty: String,
    pub source: String,
    #[serde(default)]
    pub comment: Option<String>,
}

/// Calcule le temps final (ms) selon la pénalité. None si DNF.
pub fn compute_final_time(time_ms: i64, penalty: &str) -> Option<i64> {
    match penalty {
        "plus2" => Some(time_ms + 2000),
        "dnf" => None,
        _ => Some(time_ms),
    }
}
