use serde::Serialize;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use sysinfo::System;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager,
};

// ── Wrapper types for managed state ──

struct KeyCounter(Arc<AtomicU64>);
struct ClickCounter(Arc<AtomicU64>);

// ── Data structures ──

#[derive(Serialize, Clone)]
pub struct SystemStats {
    pub cpu_percent: f32,
    pub memory_used_percent: f64,
    pub memory_total_gb: f64,
}

#[derive(Serialize, Clone)]
pub struct BatteryStatus {
    pub charge_percent: f32,
    pub is_charging: bool,
    pub time_to_empty_min: Option<f64>,
}

#[derive(Serialize, Clone)]
pub struct InputActivity {
    pub key_count: u64,
    pub mouse_clicks: u64,
}

// ── Tauri Commands ──

#[tauri::command]
fn get_system_stats() -> SystemStats {
    let mut sys = System::new();
    sys.refresh_cpu_usage();
    std::thread::sleep(std::time::Duration::from_millis(200));
    sys.refresh_cpu_usage();
    sys.refresh_memory();

    let cpu_percent = sys.global_cpu_usage();
    let total_mem = sys.total_memory() as f64;
    let used_mem = sys.used_memory() as f64;
    let memory_used_percent = if total_mem > 0.0 {
        (used_mem / total_mem) * 100.0
    } else {
        0.0
    };
    let memory_total_gb = total_mem / 1_073_741_824.0;

    SystemStats {
        cpu_percent,
        memory_used_percent,
        memory_total_gb,
    }
}

#[tauri::command]
fn get_battery_status() -> BatteryStatus {
    let manager = battery::Manager::new();
    if let Ok(manager) = manager {
        if let Ok(mut batteries) = manager.batteries() {
            if let Some(Ok(bat)) = batteries.next() {
                let charge = bat.state_of_charge().get::<battery::units::ratio::percent>();
                let is_charging = bat.state() == battery::State::Charging
                    || bat.state() == battery::State::Full;
                let time_to_empty = bat
                    .time_to_empty()
                    .map(|t| t.get::<battery::units::time::minute>() as f64);
                return BatteryStatus {
                    charge_percent: charge,
                    is_charging,
                    time_to_empty_min: time_to_empty,
                };
            }
        }
    }
    // Fallback for desktops without battery
    BatteryStatus {
        charge_percent: 100.0,
        is_charging: true,
        time_to_empty_min: None,
    }
}

#[tauri::command]
fn get_input_activity(
    key_counter: tauri::State<'_, KeyCounter>,
    click_counter: tauri::State<'_, ClickCounter>,
) -> InputActivity {
    let keys = key_counter.0.swap(0, Ordering::Relaxed);
    let clicks = click_counter.0.swap(0, Ordering::Relaxed);
    InputActivity {
        key_count: keys,
        mouse_clicks: clicks,
    }
}

// ── App entry ──

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let key_counter = Arc::new(AtomicU64::new(0));
    let click_counter = Arc::new(AtomicU64::new(0));

    // Clone for the rdev listener thread
    let key_clone = Arc::clone(&key_counter);
    let click_clone = Arc::clone(&click_counter);

    // Spawn rdev listener in a dedicated thread
    std::thread::spawn(move || {
        let _ = rdev::listen(move |event| match event.event_type {
            rdev::EventType::KeyPress(_) => {
                key_clone.fetch_add(1, Ordering::Relaxed);
            }
            rdev::EventType::ButtonPress(_) => {
                click_clone.fetch_add(1, Ordering::Relaxed);
            }
            _ => {}
        });
    });

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(KeyCounter(key_counter))
        .manage(ClickCounter(click_counter))
        .setup(|app| {
            // Build tray menu
            let show_i =
                MenuItem::with_id(app, "show_hide", "Show/Hide", true, None::<&str>)?;
            let focus_i =
                MenuItem::with_id(app, "start_focus", "Start Focus", true, None::<&str>)?;
            let settings_i =
                MenuItem::with_id(app, "open_settings", "Open Settings", true, None::<&str>)?;
            let quit_i = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;

            let menu = Menu::with_items(app, &[&show_i, &focus_i, &settings_i, &quit_i])?;

            // Create tray icon
            TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .tooltip("FocusPal - Your Desktop Companion")
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show_hide" => {
                        if let Some(window) = app.get_webview_window("main") {
                            if window.is_visible().unwrap_or(false) {
                                let _ = window.hide();
                            } else {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            if window.is_visible().unwrap_or(false) {
                                let _ = window.hide();
                            } else {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_system_stats,
            get_battery_status,
            get_input_activity,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
