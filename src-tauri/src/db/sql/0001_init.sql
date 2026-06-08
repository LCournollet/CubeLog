-- Migration 0001 : schéma initial de CubeLog.

CREATE TABLE sessions (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT    NOT NULL,
    puzzle     TEXT    NOT NULL DEFAULT '333',
    created_at INTEGER NOT NULL,                 -- unix ms
    settings   TEXT    NOT NULL DEFAULT '{}'     -- JSON paramètres propres
);

CREATE TABLE solves (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id    INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    puzzle        TEXT    NOT NULL DEFAULT '333',
    created_at    INTEGER NOT NULL,              -- unix ms
    scramble      TEXT    NOT NULL,              -- notation technique exacte
    time_ms       INTEGER NOT NULL,             -- temps brut
    penalty       TEXT    NOT NULL DEFAULT 'none',   -- none | plus2 | dnf
    final_time_ms INTEGER,                       -- NULL si DNF
    comment       TEXT,
    source        TEXT    NOT NULL DEFAULT 'keyboard', -- external_timer | keyboard | manual
    status        TEXT    NOT NULL DEFAULT 'normal'    -- normal | deleted | archived
);

CREATE INDEX idx_solves_session ON solves(session_id, created_at);
CREATE INDEX idx_solves_status  ON solves(status);

-- Réglages globaux (clé/valeur, valeur en JSON).
CREATE TABLE settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- Cache des périphériques audio + calibration mémorisée par périphérique.
CREATE TABLE audio_devices_cache (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL UNIQUE,
    last_seen   INTEGER NOT NULL,
    invert      INTEGER NOT NULL DEFAULT 0,   -- bool
    threshold   REAL    NOT NULL DEFAULT 0.0,
    sensitivity REAL    NOT NULL DEFAULT 1.0
);

-- Session par défaut créée d'emblée pour que l'app soit utilisable au 1er lancement.
INSERT INTO sessions (name, puzzle, created_at)
VALUES ('3x3 entraînement', '333', CAST(strftime('%s','now') AS INTEGER) * 1000);
