use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc;
use std::sync::{Arc, Mutex};
use std::thread::{self, JoinHandle};

use cpal::traits::{DeviceTrait, StreamTrait};
use cpal::SizedSample;
use serde::Serialize;
use tauri::{AppHandle, Emitter};

use crate::error::{AppError, AppResult};

use super::devices::find_input_device;
use super::stackmat::{StackmatConfig, StackmatDecoder, StackmatPacket, TimerState};

/// Événement "niveau" émis périodiquement pour le vumètre et le diagnostic.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LevelPayload {
    pub rms: f32,
    pub peak: f32,
    pub sample_rate: f32,
    pub last_state: Option<TimerState>,
    /// Derniers octets décodés en hexadécimal (mode debug).
    pub debug_hex: String,
}

/// Paramètres de démarrage passés depuis le frontend.
#[derive(Debug, Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StartOptions {
    pub device_name: Option<String>,
    pub invert: bool,
    pub threshold: f32,
}

/// Poignée d'une capture en cours (thread + drapeau d'arrêt).
pub struct CaptureHandle {
    stop: Arc<AtomicBool>,
    thread: Option<JoinHandle<()>>,
}

impl CaptureHandle {
    fn stop(&mut self) {
        self.stop.store(true, Ordering::Relaxed);
        if let Some(t) = self.thread.take() {
            let _ = t.join();
        }
    }
}

/// État Tauri pour l'audio : une seule capture active à la fois.
#[derive(Default)]
pub struct AudioState(pub Mutex<Option<CaptureHandle>>);

impl AudioState {
    pub fn is_running(&self) -> bool {
        self.0.lock().map(|g| g.is_some()).unwrap_or(false)
    }
}

/// Démarre la capture. Renvoie une erreur synchrone si le flux ne peut pas
/// être ouvert (périphérique invalide, format non supporté...).
pub fn start(app: &AppHandle, state: &AudioState, opts: StartOptions) -> AppResult<()> {
    // Stoppe une éventuelle capture précédente.
    stop(state);

    let device = find_input_device(opts.device_name.as_deref())?;

    let stop_flag = Arc::new(AtomicBool::new(false));
    let stop_thread = stop_flag.clone();
    let app_thread = app.clone();
    let (tx, rx) = mpsc::channel::<Result<(), String>>();

    let thread = thread::spawn(move || {
        match build_stream(&app_thread, &device, &opts) {
            Err(e) => {
                let _ = tx.send(Err(e.to_string()));
            }
            Ok(stream) => {
                if stream.play().is_err() {
                    let _ = tx.send(Err("impossible de démarrer le flux audio".into()));
                    return;
                }
                let _ = tx.send(Ok(()));
                // Maintient le flux vivant jusqu'à l'arrêt demandé.
                while !stop_thread.load(Ordering::Relaxed) {
                    thread::sleep(std::time::Duration::from_millis(100));
                }
                drop(stream);
            }
        }
    });

    // Attend le résultat d'ouverture du flux.
    match rx.recv() {
        Ok(Ok(())) => {
            let mut guard = state.0.lock().unwrap();
            *guard = Some(CaptureHandle {
                stop: stop_flag,
                thread: Some(thread),
            });
            Ok(())
        }
        Ok(Err(msg)) => {
            let _ = thread.join();
            Err(AppError::audio(msg))
        }
        Err(_) => Err(AppError::audio("thread audio interrompu")),
    }
}

/// Arrête la capture en cours (idempotent).
pub fn stop(state: &AudioState) {
    if let Ok(mut guard) = state.0.lock() {
        if let Some(mut handle) = guard.take() {
            handle.stop();
        }
    }
}

/// Construit le flux d'entrée selon le format natif du périphérique.
fn build_stream(
    app: &AppHandle,
    device: &cpal::Device,
    opts: &StartOptions,
) -> AppResult<cpal::Stream> {
    let supported = device
        .default_input_config()
        .map_err(|e| AppError::audio(format!("config d'entrée : {e}")))?;
    let sample_format = supported.sample_format();
    let config: cpal::StreamConfig = supported.into();

    // Conversion explicite vers f32 selon le format natif (robuste vis-à-vis
    // des versions de cpal : pas de dépendance aux traits de conversion).
    match sample_format {
        cpal::SampleFormat::F32 => {
            build_typed::<f32>(app, device, &config, opts, |s| s)
        }
        cpal::SampleFormat::I16 => {
            build_typed::<i16>(app, device, &config, opts, |s| s as f32 / 32768.0)
        }
        cpal::SampleFormat::U16 => build_typed::<u16>(app, device, &config, opts, |s| {
            (s as f32 - 32768.0) / 32768.0
        }),
        other => Err(AppError::audio(format!(
            "format d'échantillon non supporté : {other:?}"
        ))),
    }
}

fn build_typed<T>(
    app: &AppHandle,
    device: &cpal::Device,
    config: &cpal::StreamConfig,
    opts: &StartOptions,
    convert: impl Fn(T) -> f32 + Send + 'static,
) -> AppResult<cpal::Stream>
where
    T: SizedSample,
{
    let channels = config.channels as usize;
    let sample_rate = config.sample_rate.0 as f32;

    let mut decoder = StackmatDecoder::new(StackmatConfig {
        sample_rate,
        baud: 1_200.0,
        invert: opts.invert,
        threshold: opts.threshold,
    });

    let app = app.clone();
    let mut mono: Vec<f32> = Vec::with_capacity(2048);
    let mut sum_sq: f64 = 0.0;
    let mut peak: f32 = 0.0;
    let mut acc_count: usize = 0;
    let mut last_state: Option<TimerState> = None;
    // Émet le niveau ~toutes les 50 ms.
    let emit_every = (sample_rate * 0.05) as usize;

    let err_fn = |e| eprintln!("[audio] erreur de flux : {e}");

    let stream = device
        .build_input_stream(
            config,
            move |data: &[T], _| {
                mono.clear();
                for frame in data.chunks(channels) {
                    if let Some(&first) = frame.first() {
                        let v: f32 = convert(first);
                        mono.push(v);
                        sum_sq += (v as f64) * (v as f64);
                        peak = peak.max(v.abs());
                        acc_count += 1;
                    }
                }

                for packet in decoder.push_samples(&mono) {
                    last_state = Some(packet.state);
                    let _ = app.emit("audio://packet", packet);
                }

                if acc_count >= emit_every.max(1) {
                    let rms = (sum_sq / acc_count as f64).sqrt() as f32;
                    let debug_hex = decoder
                        .debug_bytes
                        .iter()
                        .map(|b| format!("{b:02X}"))
                        .collect::<Vec<_>>()
                        .join(" ");
                    let _ = app.emit(
                        "audio://level",
                        LevelPayload {
                            rms,
                            peak,
                            sample_rate,
                            last_state,
                            debug_hex,
                        },
                    );
                    sum_sq = 0.0;
                    peak = 0.0;
                    acc_count = 0;
                }
            },
            err_fn,
            None,
        )
        .map_err(|e| AppError::audio(format!("ouverture du flux : {e}")))?;

    Ok(stream)
}

/// Génère un signal de test décodable et le pousse dans un décodeur, pour
/// valider la chaîne sans matériel (auto-test du diagnostic).
pub fn self_test() -> Vec<StackmatPacket> {
    use super::stackmat::{encode_frame, encode_samples};
    let sr = 44_100.0;
    let baud = 1_200.0;
    let frame = encode_frame(b'S', 12_345);
    let samples = encode_samples(&frame, sr, baud, 0.8);
    let mut dec = StackmatDecoder::new(StackmatConfig {
        sample_rate: sr,
        baud,
        invert: false,
        threshold: 0.25,
    });
    dec.push_samples(&samples)
}
