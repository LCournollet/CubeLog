use serde::{Serialize, Serializer};

/// Erreur applicative unifiée, sérialisable vers le frontend.
#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("erreur base de données : {0}")]
    Db(#[from] rusqlite::Error),

    #[error("erreur d'entrée/sortie : {0}")]
    Io(#[from] std::io::Error),

    #[error("erreur audio : {0}")]
    Audio(String),

    #[error("erreur de sérialisation : {0}")]
    Serde(#[from] serde_json::Error),

    #[error("{0}")]
    Other(String),
}

impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

impl AppError {
    pub fn other(msg: impl Into<String>) -> Self {
        AppError::Other(msg.into())
    }
    pub fn audio(msg: impl Into<String>) -> Self {
        AppError::Audio(msg.into())
    }
}

pub type AppResult<T> = Result<T, AppError>;
