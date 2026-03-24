mod db;
mod llm;

use serde::Serialize;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::sync::Mutex;
use sysinfo::System;

// ── Active Window Info ──

#[derive(Serialize, Clone, Default)]
pub struct ActiveWindowInfo {
    pub title: String,
    pub app_name: String,
    pub pid: u32,
}

#[cfg(target_os = "windows")]
fn get_active_window_impl() -> ActiveWindowInfo {
    use windows::Win32::UI::WindowsAndMessaging::{GetForegroundWindow, GetWindowTextW};
    use windows::Win32::System::Threading::{OpenProcess, PROCESS_QUERY_LIMITED_INFORMATION};
    use windows::Win32::Foundation::CloseHandle;

    unsafe {
        let hwnd = GetForegroundWindow();
        if hwnd.0 == std::ptr::null_mut() {
            return ActiveWindowInfo::default();
        }

        // Get window title
        let mut title_buf = [0u16; 512];
        let title_len = GetWindowTextW(hwnd, &mut title_buf);
        let title = String::from_utf16_lossy(&title_buf[..title_len as usize]);

        // Get process ID
        let mut pid: u32 = 0;
        windows::Win32::UI::WindowsAndMessaging::GetWindowThreadProcessId(hwnd, Some(&mut pid));

        // Get process name from PID using sysinfo
        let mut app_name = String::new();
        if pid > 0 {
            let mut sys = System::new();
            let spid = sysinfo::Pid::from_u32(pid);
            sys.refresh_processes_specifics(
                sysinfo::ProcessesToUpdate::Some(&[spid]),
                true,
                sysinfo::ProcessRefreshKind::nothing(),
            );
            if let Some(process) = sys.process(spid) {
                app_name = process.name().to_string_lossy().to_string();
            }
        }

        // Fallback: try to get exe name from process handle
        if app_name.is_empty() && pid > 0 {
            if let Ok(handle) = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid) {
                let mut buf = [0u16; 260];
                let mut size = buf.len() as u32;
                let ret = windows::Win32::System::Threading::QueryFullProcessImageNameW(
                    handle,
                    windows::Win32::System::Threading::PROCESS_NAME_FORMAT(0),
                    windows::core::PWSTR(buf.as_mut_ptr()),
                    &mut size,
                );
                if ret.is_ok() {
                    let full_path = String::from_utf16_lossy(&buf[..size as usize]);
                    if let Some(name) = full_path.rsplit('\\').next() {
                        app_name = name.to_string();
                    }
                }
                let _ = CloseHandle(handle);
            }
        }

        ActiveWindowInfo { title, app_name, pid }
    }
}

#[cfg(not(target_os = "windows"))]
fn get_active_window_impl() -> ActiveWindowInfo {
    ActiveWindowInfo::default()
}

#[tauri::command]
fn get_active_window() -> ActiveWindowInfo {
    get_active_window_impl()
}

// ── Window positions enumeration ──

#[derive(Serialize, Clone)]
pub struct WindowRect {
    pub title: String,
    pub x: i32,
    pub y: i32,
    pub width: i32,
    pub height: i32,
}

#[cfg(target_os = "windows")]
fn get_visible_windows_impl() -> Vec<WindowRect> {
    use windows::Win32::UI::WindowsAndMessaging::{
        EnumWindows, GetWindowTextW, GetWindowRect as WinGetWindowRect,
        IsWindowVisible, GetWindowLongW, GWL_STYLE, GWL_EXSTYLE,
        WS_VISIBLE, WS_EX_TOOLWINDOW, WS_EX_NOACTIVATE,
    };
    use windows::Win32::Foundation::{BOOL, HWND, LPARAM, RECT};

    let results: Arc<Mutex<Vec<WindowRect>>> = Arc::new(Mutex::new(Vec::new()));
    let results_clone = Arc::clone(&results);

    unsafe {
        unsafe extern "system" fn enum_callback(hwnd: HWND, lparam: LPARAM) -> BOOL {
            // Skip invisible windows
            if !IsWindowVisible(hwnd).as_bool() {
                return BOOL(1);
            }

            // Skip tool windows and noactivate windows
            let ex_style = GetWindowLongW(hwnd, GWL_EXSTYLE) as u32;
            if (ex_style & WS_EX_TOOLWINDOW.0) != 0 || (ex_style & WS_EX_NOACTIVATE.0) != 0 {
                return BOOL(1);
            }

            // Skip windows with no title
            let mut title_buf = [0u16; 256];
            let title_len = GetWindowTextW(hwnd, &mut title_buf);
            if title_len == 0 {
                return BOOL(1);
            }
            let title = String::from_utf16_lossy(&title_buf[..title_len as usize]);

            // Get window rect
            let mut rect = RECT::default();
            if WinGetWindowRect(hwnd, &mut rect).is_ok() {
                let w = rect.right - rect.left;
                let h = rect.bottom - rect.top;
                // Skip tiny/zero-size or offscreen windows
                if w > 10 && h > 10 && rect.left > -5000 && rect.top > -5000 {
                    let vec_ptr = lparam.0 as *const Mutex<Vec<WindowRect>>;
                    if let Ok(mut vec) = (*vec_ptr).lock() {
                        vec.push(WindowRect {
                            title,
                            x: rect.left,
                            y: rect.top,
                            width: w,
                            height: h,
                        });
                    }
                }
            }
            BOOL(1) // continue
        }

        let ptr = Arc::as_ptr(&results_clone) as isize;
        let _ = EnumWindows(Some(enum_callback), LPARAM(ptr));
    }

    let guard = results.lock().unwrap();
    guard.clone()
}

#[cfg(not(target_os = "windows"))]
fn get_visible_windows_impl() -> Vec<WindowRect> {
    Vec::new()
}

#[tauri::command]
fn get_visible_windows() -> Vec<WindowRect> {
    let windows = get_visible_windows_impl();
    // Performance guard: limit to 20 windows
    if windows.len() > 20 {
        windows.into_iter().take(20).collect()
    } else {
        windows
    }
}

use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager,
};

// ── Clipboard monitoring state ──

struct ClipboardState(Mutex<Option<u64>>); // hash of last clipboard content

fn hash_string(s: &str) -> u64 {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};
    let mut hasher = DefaultHasher::new();
    s.hash(&mut hasher);
    hasher.finish()
}

#[derive(Serialize, Clone)]
pub struct ClipboardChange {
    pub changed: bool,
    pub content_type: String, // "text" | "image" | "none"
    pub text: String,         // text content (empty for image)
    pub preview: String,      // first 100 chars for display
}

#[tauri::command]
fn poll_clipboard(state: tauri::State<'_, ClipboardState>) -> ClipboardChange {
    let mut clipboard = match arboard::Clipboard::new() {
        Ok(c) => c,
        Err(_) => return ClipboardChange {
            changed: false, content_type: "none".into(), text: String::new(), preview: String::new(),
        },
    };

    // Try text first
    if let Ok(text) = clipboard.get_text() {
        if !text.is_empty() {
            let h = hash_string(&text);
            let mut last = state.0.lock().unwrap();
            if *last == Some(h) {
                return ClipboardChange {
                    changed: false, content_type: "text".into(), text: String::new(), preview: String::new(),
                };
            }
            *last = Some(h);
            let preview: String = text.chars().take(100).collect();
            return ClipboardChange {
                changed: true, content_type: "text".into(), text, preview,
            };
        }
    }

    ClipboardChange {
        changed: false, content_type: "none".into(), text: String::new(), preview: String::new(),
    }
}

#[tauri::command]
fn set_clipboard_text(text: String) -> Result<(), String> {
    let mut clipboard = arboard::Clipboard::new().map_err(|e| e.to_string())?;
    clipboard.set_text(&text).map_err(|e| e.to_string())?;
    Ok(())
}

// ── Network stats ──

use sysinfo::Networks;

struct NetworkState {
    networks: Networks,
    last_rx: u64,
    last_tx: u64,
    last_time: std::time::Instant,
}

struct NetworkMonitor(Mutex<NetworkState>);

#[derive(Serialize, Clone)]
pub struct NetworkStats {
    pub download_bytes_sec: u64,
    pub upload_bytes_sec: u64,
    pub is_connected: bool,
}

#[tauri::command]
fn get_network_stats(monitor: tauri::State<'_, NetworkMonitor>) -> NetworkStats {
    let mut state = monitor.0.lock().unwrap();
    state.networks.refresh(true);

    let now = std::time::Instant::now();
    let elapsed = now.duration_since(state.last_time).as_secs_f64().max(0.1);

    let mut total_rx: u64 = 0;
    let mut total_tx: u64 = 0;
    let mut has_interface = false;

    for (_name, data) in state.networks.iter() {
        total_rx += data.total_received();
        total_tx += data.total_transmitted();
        has_interface = true;
    }

    let dl = if total_rx >= state.last_rx {
        ((total_rx - state.last_rx) as f64 / elapsed) as u64
    } else { 0 };

    let ul = if total_tx >= state.last_tx {
        ((total_tx - state.last_tx) as f64 / elapsed) as u64
    } else { 0 };

    state.last_rx = total_rx;
    state.last_tx = total_tx;
    state.last_time = now;

    NetworkStats {
        download_bytes_sec: dl,
        upload_bytes_sec: ul,
        is_connected: has_interface && (dl > 0 || ul > 0 || total_rx > 0),
    }
}

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

    let key_clone = Arc::clone(&key_counter);
    let click_clone = Arc::clone(&click_counter);

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
        .plugin(tauri_plugin_geolocation::init())
        .manage(KeyCounter(key_counter))
        .manage(ClickCounter(click_counter))
        .manage(llm::LlmProcess::new())
        .manage(ClipboardState(Mutex::new(None)))
        .manage(NetworkMonitor(Mutex::new(NetworkState {
            networks: Networks::new_with_refreshed_list(),
            last_rx: 0,
            last_tx: 0,
            last_time: std::time::Instant::now(),
        })))
        .setup(|app| {
            // Initialize SQLite database
            let app_dir = app.path().app_data_dir().expect("Failed to get app data dir");
            app.manage(db::AppDb::new(&app_dir));

            // Build tray menu
            let show_i =
                MenuItem::with_id(app, "show_hide", "Show/Hide", true, None::<&str>)?;
            let focus_i =
                MenuItem::with_id(app, "start_focus", "Start Focus", true, None::<&str>)?;
            let settings_i =
                MenuItem::with_id(app, "open_settings", "Open Settings", true, None::<&str>)?;
            let quit_i = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;

            let menu = Menu::with_items(app, &[&show_i, &focus_i, &settings_i, &quit_i])?;

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
            llm::start_llm_server,
            llm::stop_llm_server,
            llm::llm_server_status,
            db::config_get,
            db::config_set,
            db::insert_mood,
            db::query_moods,
            db::get_mood_stats,
            db::export_moods,
            db::insert_focus_session,
            db::get_focus_stats,
            db::get_last_mood_time,
            db::insert_album_entry,
            db::query_album,
            db::get_total_xp,
            db::insert_reminder_response,
            db::get_reminder_stats,
            db::insert_activity,
            db::query_activities,
            db::insert_scene_log,
            db::query_scene_log,
            get_active_window,
            get_network_stats,
            get_visible_windows,
            poll_clipboard,
            set_clipboard_text,
            db::insert_clipboard_item,
            db::query_clipboard_history,
            db::toggle_clipboard_pin,
            db::delete_clipboard_item,
            db::clear_expired_clipboard,
            db::query_scene_summary,
            db::query_focus_sessions_all,
            db::insert_countdown_event,
            db::query_countdown_events,
            db::delete_countdown_event,
            db::upsert_journal_entry,
            db::get_journal_entry,
            db::query_journal_dates,
            db::search_journal,
            db::export_journal,
            db::discover_collectible,
            db::query_collectibles,
            db::unlock_achievement,
            db::query_achievements,
            db::query_focus_daily,
            db::query_mood_daily,
        ])
        .on_window_event(|_window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                if let Some(process) = _window.app_handle().try_state::<llm::LlmProcess>() {
                    if let Ok(mut guard) = process.0.lock() {
                        if let Some(ref mut child) = *guard {
                            let _ = child.kill();
                            let _ = child.wait();
                        }
                    }
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
