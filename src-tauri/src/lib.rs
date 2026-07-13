mod storage;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        // Single-instance must be the first registered plugin.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .manage(storage::StorageRuntime::default())
        .invoke_handler(tauri::generate_handler![
            storage::load,
            storage::save,
            storage::info,
            storage::open_save_folder,
            storage::save_problem_report,
            storage::open_exports_folder
        ])
        .build(tauri::generate_context!())
        .expect("Akış masaüstü uygulaması başlatılamadı");

    app.run(|app_handle, event| {
        if let tauri::RunEvent::ExitRequested { .. } = event {
            // A close request must not interrupt an atomic write already in progress.
            app_handle
                .state::<storage::StorageRuntime>()
                .wait_until_idle();
        }
    });
}
