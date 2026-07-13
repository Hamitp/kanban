fn main() {
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(
        tauri_build::AppManifest::new().commands(&[
            "load",
            "save",
            "info",
            "open_save_folder",
            "save_problem_report",
            "open_exports_folder",
        ]),
    ))
    .expect("Tauri yapılandırması hazırlanamadı");
}
