use cpal::traits::{DeviceTrait, HostTrait};
use serde::Serialize;

use crate::error::{AppError, AppResult};

/// Description d'un périphérique d'entrée audio exposée au frontend.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioDevice {
    pub name: String,
    pub is_default: bool,
    /// Fréquence d'échantillonnage par défaut (Hz), si disponible.
    pub default_sample_rate: Option<u32>,
    pub channels: Option<u16>,
}

/// Liste les périphériques d'entrée (microphones / entrées ligne) disponibles.
pub fn list_input_devices() -> AppResult<Vec<AudioDevice>> {
    let host = cpal::default_host();
    let default_name = host
        .default_input_device()
        .and_then(|d| d.name().ok());

    let devices = host
        .input_devices()
        .map_err(|e| AppError::audio(format!("énumération des entrées : {e}")))?;

    let mut out = Vec::new();
    for device in devices {
        let name = match device.name() {
            Ok(n) => n,
            Err(_) => continue,
        };
        let (sr, ch) = match device.default_input_config() {
            Ok(cfg) => (Some(cfg.sample_rate().0), Some(cfg.channels())),
            Err(_) => (None, None),
        };
        out.push(AudioDevice {
            is_default: default_name.as_deref() == Some(name.as_str()),
            name,
            default_sample_rate: sr,
            channels: ch,
        });
    }
    Ok(out)
}

/// Retrouve un périphérique d'entrée par son nom (ou le défaut si `None`).
pub fn find_input_device(name: Option<&str>) -> AppResult<cpal::Device> {
    let host = cpal::default_host();
    match name {
        None => host
            .default_input_device()
            .ok_or_else(|| AppError::audio("aucun périphérique d'entrée par défaut")),
        Some(target) => {
            let devices = host
                .input_devices()
                .map_err(|e| AppError::audio(format!("énumération : {e}")))?;
            for device in devices {
                if device.name().map(|n| n == target).unwrap_or(false) {
                    return Ok(device);
                }
            }
            Err(AppError::audio(format!(
                "périphérique audio introuvable : {target}"
            )))
        }
    }
}
