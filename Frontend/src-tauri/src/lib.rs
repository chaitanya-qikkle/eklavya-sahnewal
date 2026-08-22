use tauri::Manager;

#[tauri::command]
fn app_info() -> serde_json::Value {
    serde_json::json!({
        "client": "desktop-tauri",
        "version": env!("CARGO_PKG_VERSION"),
        "hwAccel": true,
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![app_info])
        .setup(|app| {
            #[cfg(debug_assertions)]
            {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.set_title("YMS Yard Twin (dev)");
                }
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running YMS Yard Twin");
}
