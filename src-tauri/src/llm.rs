// LLM sidecar manager: spawns and manages llama-server process

use std::process::{Child, Command};
use std::sync::Mutex;

pub struct LlmProcess(pub Mutex<Option<Child>>);

impl LlmProcess {
    pub fn new() -> Self {
        Self(Mutex::new(None))
    }
}

/// Models directory — must be a path without CJK characters (llama.cpp limitation)
fn models_dir() -> std::path::PathBuf {
    std::path::PathBuf::from(r"D:\focuspal_models")
}

#[tauri::command]
pub fn start_llm_server(process: tauri::State<'_, LlmProcess>) -> Result<String, String> {
    let mut guard = process.0.lock().map_err(|e| e.to_string())?;

    // Already running?
    if let Some(ref mut child) = *guard {
        match child.try_wait() {
            Ok(None) => return Ok("already running".into()),
            _ => {} // exited, we'll restart
        }
    }

    let models = models_dir();
    let server_exe = models.join("llama-server").join("llama-server.exe");
    let model_path = models.join("Qwen3-4B-Q4_K_M.gguf");

    if !server_exe.exists() {
        return Err(format!("llama-server.exe not found at {:?}", server_exe));
    }
    if !model_path.exists() {
        return Err(format!("Model not found at {:?}", model_path));
    }

    let child = Command::new(&server_exe)
        .args([
            "-m", &model_path.to_string_lossy(),
            "--host", "127.0.0.1",
            "--port", "8384",
            "-ngl", "99",             // offload all layers to GPU
            "-c", "4096",             // context length (Qwen3-4B supports more)
            "--chat-template", "chatml", // Qwen3 uses ChatML format
        ])
        .spawn()
        .map_err(|e| format!("Failed to spawn llama-server: {}", e))?;

    let pid = child.id();
    *guard = Some(child);

    Ok(format!("started pid={}", pid))
}

#[tauri::command]
pub fn stop_llm_server(process: tauri::State<'_, LlmProcess>) -> Result<String, String> {
    let mut guard = process.0.lock().map_err(|e| e.to_string())?;
    if let Some(ref mut child) = *guard {
        let _ = child.kill();
        let _ = child.wait();
        *guard = None;
        Ok("stopped".into())
    } else {
        Ok("not running".into())
    }
}

#[tauri::command]
pub fn llm_server_status(process: tauri::State<'_, LlmProcess>) -> String {
    let mut guard = match process.0.lock() {
        Ok(g) => g,
        Err(_) => return "error".into(),
    };
    match *guard {
        Some(ref mut child) => match child.try_wait() {
            Ok(None) => "running".into(),
            Ok(Some(status)) => {
                *guard = None;
                format!("exited: {}", status)
            }
            Err(e) => format!("error: {}", e),
        },
        None => "stopped".into(),
    }
}
