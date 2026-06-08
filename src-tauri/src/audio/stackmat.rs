//! Décodeur de signal Stackmat-like (timers SpeedStacks / QiYi / QY Toys).
//!
//! Le timer émet en continu un flux série UART à 1200 bauds (8N1) sur la sortie
//! jack, capté ici via l'entrée micro. Format de trame **vérifié sur un timer
//! QiYi réel** (10 octets) :
//!
//! ```text
//! [statut][d0][d1][d2][d3][d4][d5][checksum][LF=0x0A][CR=0x0D]
//! ```
//!
//! - `statut`   : caractère d'état (' '=running, I, S, A, L, R, C) ;
//! - `d0..d5`   : 6 chiffres ASCII = M:SS.mmm (minute, secondes, millisecondes) ;
//! - `checksum` : 64 + somme des 6 chiffres (valeur numérique) ;
//! - `LF CR`    : fin de trame (LF **puis** CR).
//!
//! Réimplémentation propre à partir de l'observation du signal réel (aucun code
//! copié d'un projet GPL). Robustesse :
//!  - suppression de la composante continue (couplage AC du micro) ;
//!  - comparateur adaptatif à hystérésis basé sur l'enveloppe du signal ;
//!  - **auto-détection de la polarité** : deux décodeurs UART tournent en
//!    parallèle (normal + inversé) et seule la polarité qui produit des trames
//!    au checksum valide est retenue — l'utilisateur n'a rien à régler ;
//!  - cadrage des trames sur le terminateur LF/CR + validation du checksum.

use serde::Serialize;

/// Longueur d'une trame complète en octets.
const FRAME_LEN: usize = 10;

/// État logique du timer tel que décodé depuis l'octet de statut.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum TimerState {
    /// Au repos / remis à zéro.
    Idle,
    /// Mains sur les capteurs, prêt à démarrer.
    Ready,
    /// Chronométrage en cours.
    Running,
    /// Chrono arrêté, temps final affiché.
    Stopped,
    /// Statut non reconnu.
    Unknown,
}

/// Une trame Stackmat décodée et validée.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StackmatPacket {
    pub state: TimerState,
    pub time_ms: u32,
    pub header: char,
    pub valid_checksum: bool,
}

/// Paramètres de décodage.
#[derive(Debug, Clone)]
pub struct StackmatConfig {
    pub sample_rate: f32,
    pub baud: f32,
    /// Conservé pour compatibilité d'API ; la polarité est désormais
    /// auto-détectée, ce champ n'a plus d'effet sur le décodage.
    pub invert: bool,
    /// Fraction de l'enveloppe servant de seuil au comparateur (0..1).
    pub threshold: f32,
}

impl Default for StackmatConfig {
    fn default() -> Self {
        Self {
            sample_rate: 44_100.0,
            baud: 1_200.0,
            invert: false,
            threshold: 0.25,
        }
    }
}

/// Caractères de statut reconnus.
fn state_from_header(h: u8) -> TimerState {
    match h {
        b'I' => TimerState::Idle,
        b'S' => TimerState::Stopped,
        b' ' | b'A' => TimerState::Running,
        b'L' | b'R' | b'C' => TimerState::Ready,
        _ => TimerState::Unknown,
    }
}

/// Parse une trame de 10 octets `[statut][6 chiffres][checksum][LF][CR]`.
pub fn parse_frame(frame: &[u8]) -> Option<StackmatPacket> {
    if frame.len() != FRAME_LEN || frame[8] != 0x0A || frame[9] != 0x0D {
        return None;
    }
    let header = frame[0];
    let state = state_from_header(header);
    if state == TimerState::Unknown {
        return None;
    }

    let mut digits = [0u8; 6];
    let mut sum: u32 = 0;
    for i in 0..6 {
        let c = frame[1 + i];
        if !c.is_ascii_digit() {
            return None;
        }
        digits[i] = c - b'0';
        sum += digits[i] as u32;
    }

    // Checksum = 64 + somme des 6 chiffres.
    let expected = 64u32 + sum;
    let valid_checksum = frame[7] as u32 == expected;

    let minutes = digits[0] as u32;
    let seconds = digits[1] as u32 * 10 + digits[2] as u32;
    let millis = digits[3] as u32 * 100 + digits[4] as u32 * 10 + digits[5] as u32;
    let time_ms = minutes * 60_000 + seconds * 1_000 + millis;

    Some(StackmatPacket {
        state,
        time_ms,
        header: header as char,
        valid_checksum,
    })
}

#[derive(Debug, Clone, Copy)]
enum UartState {
    /// En attente d'un bit de start (front descendant).
    Idle,
    /// Réception des 8 bits de données.
    Receiving {
        next_sample_at: f64,
        bit: u8,
        byte: u8,
    },
}

/// Un pipeline de décodage pour UNE polarité (comparateur + UART + cadrage).
struct Channel {
    level: bool,
    prev_level: bool,
    uart: UartState,
    buffer: Vec<u8>,
    debug: Vec<u8>,
}

impl Channel {
    fn new() -> Self {
        Self {
            level: true,
            prev_level: true,
            uart: UartState::Idle,
            buffer: Vec::with_capacity(32),
            debug: Vec::with_capacity(64),
        }
    }

    /// Traite un échantillon déjà conditionné (signal centré, polarité appliquée).
    /// Renvoie un octet quand une trame UART est complète.
    fn step(&mut self, signal: f32, thr: f32, sample_index: f64, spb: f64) -> Option<u8> {
        self.prev_level = self.level;
        if signal > thr {
            self.level = true;
        } else if signal < -thr {
            self.level = false;
        }

        match self.uart {
            UartState::Idle => {
                if self.prev_level && !self.level {
                    self.uart = UartState::Receiving {
                        next_sample_at: sample_index + 1.5 * spb,
                        bit: 0,
                        byte: 0,
                    };
                }
                None
            }
            UartState::Receiving {
                next_sample_at,
                bit,
                byte,
            } => {
                if sample_index >= next_sample_at {
                    let mut new_byte = byte;
                    if self.level {
                        new_byte |= 1 << bit;
                    }
                    let new_bit = bit + 1;
                    if new_bit >= 8 {
                        self.uart = UartState::Idle;
                        return Some(new_byte);
                    }
                    self.uart = UartState::Receiving {
                        next_sample_at: next_sample_at + spb,
                        bit: new_bit,
                        byte: new_byte,
                    };
                }
                None
            }
        }
    }

    /// Accumule l'octet, mémorise pour le debug et tente le cadrage sur LF/CR.
    fn on_byte(&mut self, byte: u8) -> Option<StackmatPacket> {
        self.buffer.push(byte);
        self.debug.push(byte);
        if self.debug.len() > 64 {
            let excess = self.debug.len() - 64;
            self.debug.drain(0..excess);
        }

        let len = self.buffer.len();
        // Trame terminée par LF(0x0A) CR(0x0D) sur 10 octets.
        if byte == 0x0D && len >= FRAME_LEN && self.buffer[len - 2] == 0x0A {
            let frame: Vec<u8> = self.buffer[len - FRAME_LEN..len].to_vec();
            self.buffer.clear();
            return parse_frame(&frame);
        }
        if self.buffer.len() > 40 {
            let excess = self.buffer.len() - 20;
            self.buffer.drain(0..excess);
        }
        None
    }
}

/// Décodeur incrémental à auto-détection de polarité.
pub struct StackmatDecoder {
    cfg: StackmatConfig,
    samples_per_bit: f64,
    sample_index: f64,
    lp: f32,
    env: f32,
    normal: Channel,
    inverted: Channel,
    /// Canal actuellement valide (0 = normal, 1 = inversé).
    active: usize,
    /// Derniers octets bruts du canal actif (mode debug).
    pub debug_bytes: Vec<u8>,
}

impl StackmatDecoder {
    pub fn new(cfg: StackmatConfig) -> Self {
        let samples_per_bit = (cfg.sample_rate / cfg.baud) as f64;
        Self {
            cfg,
            samples_per_bit,
            sample_index: 0.0,
            lp: 0.0,
            env: 1e-6,
            normal: Channel::new(),
            inverted: Channel::new(),
            active: 0,
            debug_bytes: Vec::new(),
        }
    }

    /// Pousse un bloc d'échantillons et renvoie les trames valides décodées.
    pub fn push_samples(&mut self, samples: &[f32]) -> Vec<StackmatPacket> {
        let mut packets = Vec::new();
        for &s in samples {
            self.push_sample(s, &mut packets);
        }
        packets
    }

    fn push_sample(&mut self, raw: f32, packets: &mut Vec<StackmatPacket>) {
        self.sample_index += 1.0;

        // 1) Suppression de la composante continue (passe-haut à un pôle).
        //    Coupure TRÈS basse (~4 Hz) : la ligne de base doit rester stable
        //    sur toute une trame (~83 ms), sinon de longues séries de bits
        //    identiques (chiffres '0') la font dériver et corrompent le décodage.
        let alpha = 0.0005_f32;
        self.lp += alpha * (raw - self.lp);
        let hp = raw - self.lp;

        // 2) Enveloppe adaptative (attaque immédiate, relâchement lent).
        let mag = hp.abs();
        if mag > self.env {
            self.env = mag;
        } else {
            self.env *= 0.999_5;
        }
        self.env = self.env.max(1e-6);

        // 3) Seuil du comparateur.
        let thr = self.cfg.threshold.clamp(0.01, 0.95) * self.env;
        let spb = self.samples_per_bit;
        let idx = self.sample_index;

        // 4) Deux canaux : polarité normale (hp) et inversée (-hp).
        if let Some(b) = self.normal.step(hp, thr, idx, spb) {
            if self.active == 0 {
                self.record_debug(b);
            }
            if let Some(pkt) = self.normal.on_byte(b) {
                if pkt.valid_checksum {
                    self.active = 0;
                    packets.push(pkt);
                }
            }
        }
        if let Some(b) = self.inverted.step(-hp, thr, idx, spb) {
            if self.active == 1 {
                self.record_debug(b);
            }
            if let Some(pkt) = self.inverted.on_byte(b) {
                if pkt.valid_checksum {
                    self.active = 1;
                    packets.push(pkt);
                }
            }
        }
    }

    fn record_debug(&mut self, byte: u8) {
        self.debug_bytes.push(byte);
        if self.debug_bytes.len() > 64 {
            let excess = self.debug_bytes.len() - 64;
            self.debug_bytes.drain(0..excess);
        }
    }
}

/// Construit une trame de 10 octets pour un statut et un temps donnés.
pub fn encode_frame(header: u8, time_ms: u32) -> [u8; FRAME_LEN] {
    let minutes = time_ms / 60_000;
    let rem = time_ms % 60_000;
    let seconds = rem / 1_000;
    let millis = rem % 1_000;

    let digits = [
        (minutes % 10) as u8,
        (seconds / 10) as u8,
        (seconds % 10) as u8,
        (millis / 100) as u8,
        (millis / 10 % 10) as u8,
        (millis % 10) as u8,
    ];
    let sum: u32 = digits.iter().map(|&d| d as u32).sum();
    let checksum = (64 + sum) as u8;

    [
        header,
        b'0' + digits[0],
        b'0' + digits[1],
        b'0' + digits[2],
        b'0' + digits[3],
        b'0' + digits[4],
        b'0' + digits[5],
        checksum,
        0x0A,
        0x0D,
    ]
}

/// Encode des octets en échantillons UART idéaux bipolaires (±amp), 8N1, idle haut.
pub fn encode_samples(bytes: &[u8], sample_rate: f32, baud: f32, amp: f32) -> Vec<f32> {
    let spb = (sample_rate / baud).round() as usize;
    let mut out = Vec::new();
    let push_bit = |out: &mut Vec<f32>, high: bool| {
        let v = if high { amp } else { -amp };
        for _ in 0..spb {
            out.push(v);
        }
    };
    for _ in 0..spb * 2 {
        out.push(amp); // préambule idle
    }
    for &b in bytes {
        push_bit(&mut out, false); // start
        for i in 0..8 {
            push_bit(&mut out, (b >> i) & 1 == 1); // LSB d'abord
        }
        push_bit(&mut out, true); // stop
    }
    for _ in 0..spb * 2 {
        out.push(amp); // postambule idle
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn frame_roundtrip_checksum() {
        // 12.340 s, état "stopped".
        let frame = encode_frame(b'S', 12_340);
        let pkt = parse_frame(&frame).expect("trame valide");
        assert_eq!(pkt.state, TimerState::Stopped);
        assert_eq!(pkt.time_ms, 12_340);
        assert!(pkt.valid_checksum);
    }

    #[test]
    fn frame_minutes_and_millis() {
        // 1:23.450 = 83_450 ms.
        let frame = encode_frame(b'S', 83_450);
        let pkt = parse_frame(&frame).expect("trame valide");
        assert_eq!(pkt.time_ms, 83_450);
    }

    #[test]
    fn checksum_matches_real_timer() {
        // Trame réelle observée : ' ' 7 3 5 9 4 5 -> checksum 0x61.
        let frame = [b' ', b'7', b'3', b'5', b'9', b'4', b'5', 0x61, 0x0A, 0x0D];
        let pkt = parse_frame(&frame).expect("trame valide");
        assert!(pkt.valid_checksum);
        assert_eq!(pkt.state, TimerState::Running);
        // 7:35.945
        assert_eq!(pkt.time_ms, 7 * 60_000 + 35 * 1_000 + 945);
    }

    #[test]
    fn rejects_bad_checksum() {
        let mut frame = encode_frame(b'S', 5_000);
        frame[7] = frame[7].wrapping_add(1);
        let pkt = parse_frame(&frame).expect("structure ok");
        assert!(!pkt.valid_checksum);
    }

    #[test]
    fn rejects_unknown_header() {
        let mut frame = encode_frame(b'S', 5_000);
        frame[0] = b'Z';
        assert!(parse_frame(&frame).is_none());
    }

    #[test]
    fn decodes_synthetic_signal() {
        let sr = 44_100.0;
        let baud = 1_200.0;
        let frame = encode_frame(b'S', 9_870);
        let samples = encode_samples(&frame, sr, baud, 0.8);

        let mut dec = StackmatDecoder::new(StackmatConfig {
            sample_rate: sr,
            baud,
            invert: false,
            threshold: 0.25,
        });
        let packets = dec.push_samples(&samples);
        assert_eq!(packets.len(), 1, "une trame doit être décodée");
        assert_eq!(packets[0].time_ms, 9_870);
        assert_eq!(packets[0].state, TimerState::Stopped);
        assert!(packets[0].valid_checksum);
    }

    #[test]
    fn auto_detects_inverted_polarity() {
        // Signal inversé : l'auto-détection doit le décoder sans réglage.
        let sr = 48_000.0;
        let baud = 1_200.0;
        let frame = encode_frame(b' ', 4_560); // running
        let mut samples = encode_samples(&frame, sr, baud, 0.8);
        for s in &mut samples {
            *s = -*s;
        }
        let mut dec = StackmatDecoder::new(StackmatConfig {
            sample_rate: sr,
            baud,
            invert: false, // pas besoin de l'indiquer
            threshold: 0.25,
        });
        let packets = dec.push_samples(&samples);
        assert_eq!(packets.len(), 1);
        assert_eq!(packets[0].time_ms, 4_560);
        assert_eq!(packets[0].state, TimerState::Running);
    }
}
