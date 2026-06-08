// Empêche l'ouverture d'une console Windows en build release.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    cubelog_lib::run()
}
