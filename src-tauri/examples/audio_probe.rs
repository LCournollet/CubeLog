//! Diagnostic complet : signal + décodage brut + décodeur app.
//! Le timer doit juste être ALLUMÉ. `cargo run --example audio_probe [-- secs]`

use std::sync::{Arc, Mutex};
use std::time::Duration;

use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::SizedSample;
use cubelog_lib::audio::stackmat::{StackmatConfig, StackmatDecoder};

fn main() {
    let secs: f32 = std::env::args().nth(1).and_then(|s| s.parse().ok()).unwrap_or(8.0);
    let host = cpal::default_host();
    let device = pick_device(&host);
    let name = device.name().unwrap_or_else(|_| "?".into());
    let supported = device.default_input_config().expect("config");
    let sr = supported.sample_rate().0 as f32;
    let fmt = supported.sample_format();
    let config: cpal::StreamConfig = supported.into();
    let channels = config.channels as usize;

    println!("== Diagnostic complet ==");
    println!("Périphérique : {name} | {sr} Hz | {fmt:?} | {channels} canaux\n");
    let samples = capture_raw(&device, &config, fmt, channels, secs);

    // Sauvegarde brute pour rejouer hors-ligne (f32 little-endian).
    let path = std::env::temp_dir().join("cubelog_samples.f32");
    let mut bytes = Vec::with_capacity(samples.len() * 4);
    for &s in &samples {
        bytes.extend_from_slice(&s.to_le_bytes());
    }
    let _ = std::fs::write(&path, &bytes);
    println!("Échantillons sauvegardés : {} ({} valeurs)\n", path.display(), samples.len());

    // Stats signal.
    let n = samples.len().max(1) as f64;
    let mean = samples.iter().map(|&x| x as f64).sum::<f64>() / n;
    let min = samples.iter().cloned().fold(f32::INFINITY, f32::min);
    let max = samples.iter().cloned().fold(f32::NEG_INFINITY, f32::max);
    let rms = (samples.iter().map(|&x| (x as f64) * (x as f64)).sum::<f64>() / n).sqrt();
    let clip = samples.iter().filter(|&&x| x.abs() > 0.9).count();
    println!("Échantillons : {}", samples.len());
    println!(
        "min={min:.3} max={max:.3} mean={mean:.4} RMS={rms:.3} clip(|x|>0.9)={:.1}%\n",
        100.0 * clip as f64 / n
    );

    // Décodage brut UART, 2 polarités.
    for &invert in &[false, true] {
        let bytes = decode_uart(&samples, sr, 1200.0, invert, mean as f32);
        let crlf = bytes.windows(2).filter(|w| w == &[0x0A, 0x0D]).count();
        let printable = bytes.iter().filter(|b| b.is_ascii_graphic()).count();
        println!(
            "UART brut invert={invert} : {} octets, {} ascii, {} terminateurs LF/CR",
            bytes.len(), printable, crlf
        );
        print!("  hex: ");
        for b in bytes.iter().take(40) { print!("{b:02X} "); }
        println!();
    }

    // Décodeur de l'app.
    let mut dec = StackmatDecoder::new(StackmatConfig {
        sample_rate: sr, baud: 1200.0, invert: false, threshold: 0.25,
    });
    let packets = dec.push_samples(&samples);
    println!("\nDécodeur app : {} paquets valides", packets.len());
    if let Some(p) = packets.last() {
        println!("  dernier : état={:?} temps={:.3}s en-tête='{}'", p.state, p.time_ms as f32 / 1000.0, p.header);
    }
    println!("  debug bytes app : {}", dec.debug_bytes.iter().map(|b| format!("{b:02X}")).collect::<Vec<_>>().join(" "));
}

fn decode_uart(samples: &[f32], sr: f32, baud: f32, invert: bool, dc: f32) -> Vec<u8> {
    let spb = sr / baud;
    let level = |i: usize| {
        let mut v = samples[i] - dc;
        if invert { v = -v; }
        v >= 0.0
    };
    let mut out = Vec::new();
    let mut i = 1usize;
    while i < samples.len() {
        if level(i - 1) && !level(i) {
            let start = i as f32;
            let mut byte = 0u8;
            let mut ok = true;
            for b in 0..8 {
                let idx = (start + (1.5 + b as f32) * spb).round() as usize;
                if idx >= samples.len() { ok = false; break; }
                if level(idx) { byte |= 1 << b; }
            }
            if ok { out.push(byte); i = (start + 9.5 * spb).round() as usize; continue; }
        }
        i += 1;
    }
    out
}

fn pick_device(host: &cpal::Host) -> cpal::Device {
    if let Ok(devices) = host.input_devices() {
        for d in devices {
            if d.name().map(|n| n.contains("Realtek")).unwrap_or(false) { return d; }
        }
    }
    host.default_input_device().expect("aucun périphérique")
}

fn capture_raw(device: &cpal::Device, config: &cpal::StreamConfig, fmt: cpal::SampleFormat, channels: usize, seconds: f32) -> Vec<f32> {
    let buf = Arc::new(Mutex::new(Vec::<f32>::new()));
    let stream = match fmt {
        cpal::SampleFormat::F32 => build::<f32>(device, config, channels, buf.clone(), |s| s),
        cpal::SampleFormat::I16 => build::<i16>(device, config, channels, buf.clone(), |s| s as f32 / 32768.0),
        cpal::SampleFormat::U16 => build::<u16>(device, config, channels, buf.clone(), |s| (s as f32 - 32768.0) / 32768.0),
        other => panic!("format non supporté : {other:?}"),
    };
    stream.play().expect("play");
    std::thread::sleep(Duration::from_secs_f32(seconds));
    drop(stream);
    Arc::try_unwrap(buf).ok().unwrap().into_inner().unwrap()
}

fn build<T>(device: &cpal::Device, config: &cpal::StreamConfig, channels: usize, buf: Arc<Mutex<Vec<f32>>>, convert: impl Fn(T) -> f32 + Send + 'static) -> cpal::Stream
where T: SizedSample {
    device.build_input_stream(config, move |data: &[T], _: &_| {
        let mut g = buf.lock().unwrap();
        for frame in data.chunks(channels) {
            if let Some(&first) = frame.first() { g.push(convert(first)); }
        }
    }, |e| eprintln!("[audio] {e}"), None).expect("flux")
}
