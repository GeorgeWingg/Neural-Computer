use serde::Serialize;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::Manager;

#[cfg(not(debug_assertions))]
use std::{
  io::{Read, Write},
  net::{SocketAddr, TcpStream},
  process::{Child, Command, Stdio},
  thread,
  time::{Duration, Instant},
};

#[cfg(not(debug_assertions))]
const LOCAL_SERVER_HOST: &str = "127.0.0.1";
#[cfg(not(debug_assertions))]
const LOCAL_SERVER_PORT: u16 = 8787;

#[cfg(not(debug_assertions))]
struct LocalServerState(Mutex<Option<Child>>);

struct RuntimeBootstrapState(Mutex<RuntimeBootstrapSnapshot>);

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct RuntimeBootstrapSnapshot {
  available: bool,
  status: String,
  launch_mode: String,
  message: Option<String>,
  checked_at_ms: u64,
}

fn now_ms() -> u64 {
  SystemTime::now()
    .duration_since(UNIX_EPOCH)
    .map(|duration| duration.as_millis() as u64)
    .unwrap_or(0)
}

fn runtime_snapshot(
  available: bool,
  status: &str,
  launch_mode: &str,
  message: Option<String>,
) -> RuntimeBootstrapSnapshot {
  RuntimeBootstrapSnapshot {
    available,
    status: status.to_string(),
    launch_mode: launch_mode.to_string(),
    message,
    checked_at_ms: now_ms(),
  }
}

#[cfg(debug_assertions)]
fn default_runtime_snapshot() -> RuntimeBootstrapSnapshot {
  runtime_snapshot(true, "ready", "dev-external", None)
}

#[cfg(not(debug_assertions))]
fn default_runtime_snapshot() -> RuntimeBootstrapSnapshot {
  runtime_snapshot(
    false,
    "pending",
    "none",
    Some("Runtime bootstrap has not completed yet.".to_string()),
  )
}

fn set_runtime_bootstrap_snapshot(app: &tauri::AppHandle, snapshot: RuntimeBootstrapSnapshot) {
  if let Some(state) = app.try_state::<RuntimeBootstrapState>() {
    if let Ok(mut guard) = state.0.lock() {
      *guard = snapshot;
    }
  }
}

#[tauri::command]
fn runtime_bootstrap_status(state: tauri::State<'_, RuntimeBootstrapState>) -> RuntimeBootstrapSnapshot {
  match state.0.lock() {
    Ok(guard) => guard.clone(),
    Err(_) => runtime_snapshot(
      false,
      "error",
      "unknown",
      Some("Runtime status lock poisoned.".to_string()),
    ),
  }
}

#[tauri::command]
fn runtime_retry_bootstrap(app: tauri::AppHandle) -> RuntimeBootstrapSnapshot {
  #[cfg(debug_assertions)]
  {
    let snapshot = default_runtime_snapshot();
    set_runtime_bootstrap_snapshot(&app, snapshot.clone());
    return snapshot;
  }

  #[cfg(not(debug_assertions))]
  {
    stop_local_server(&app);
    let snapshot = match start_local_server(&app) {
      Ok((child, snapshot)) => {
        set_local_server_child(&app, Some(child));
        snapshot
      }
      Err(snapshot) => snapshot,
    };
    set_runtime_bootstrap_snapshot(&app, snapshot.clone());
    snapshot
  }
}

#[cfg(not(debug_assertions))]
#[derive(Clone, Copy)]
enum LaunchMode {
  Sidecar,
  FallbackNode,
}

#[cfg(not(debug_assertions))]
impl LaunchMode {
  fn as_str(self) -> &'static str {
    match self {
      Self::Sidecar => "sidecar",
      Self::FallbackNode => "fallback-node",
    }
  }
}

#[cfg(not(debug_assertions))]
struct LocalServerSpawn {
  child: Child,
  launch_mode: LaunchMode,
  warning: Option<String>,
}

#[cfg(not(debug_assertions))]
fn resolve_bundled_server_script(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
  app
    .path()
    .resolve("sidecar/server.bundle.cjs", tauri::path::BaseDirectory::Resource)
    .map_err(|error| format!("failed to resolve bundled sidecar script: {error}"))
}

#[cfg(not(debug_assertions))]
fn resolve_bundled_node_binary(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
  if std::env::consts::OS != "macos" {
    return Err(format!(
      "unsupported sidecar platform: {}",
      std::env::consts::OS
    ));
  }

  let binary_name = match std::env::consts::ARCH {
    "aarch64" => "neural-os-node-aarch64-apple-darwin",
    "x86_64" => "neural-os-node-x86_64-apple-darwin",
    other => return Err(format!("unsupported sidecar architecture: {other}")),
  };

  app
    .path()
    .resolve(
      format!("binaries/{binary_name}"),
      tauri::path::BaseDirectory::Resource,
    )
    .map_err(|error| format!("failed to resolve bundled node binary ({binary_name}): {error}"))
}

#[cfg(not(debug_assertions))]
fn resolve_legacy_server_script(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
  app
    .path()
    .resolve("server.mjs", tauri::path::BaseDirectory::Resource)
    .map_err(|error| format!("failed to resolve legacy bundled server.mjs: {error}"))
}

#[cfg(not(debug_assertions))]
fn spawn_sidecar_server(app: &tauri::AppHandle) -> Result<Child, String> {
  let node_binary = resolve_bundled_node_binary(app)?;
  let server_script = resolve_bundled_server_script(app)?;
  Command::new(node_binary)
    .arg(server_script)
    .env("NEURAL_OS_SERVER_PORT", LOCAL_SERVER_PORT.to_string())
    .env("NEURAL_COMPUTER_SERVER_PORT", LOCAL_SERVER_PORT.to_string())
    .stdin(Stdio::null())
    .stdout(Stdio::null())
    .stderr(Stdio::null())
    .spawn()
    .map_err(|error| format!("failed to spawn bundled sidecar runtime: {error}"))
}

#[cfg(not(debug_assertions))]
fn spawn_fallback_server(app: &tauri::AppHandle) -> Result<Child, String> {
  let fallback_server_script = resolve_legacy_server_script(app)?;
  Command::new("node")
    .arg(fallback_server_script)
    .env("NEURAL_OS_SERVER_PORT", LOCAL_SERVER_PORT.to_string())
    .env("NEURAL_COMPUTER_SERVER_PORT", LOCAL_SERVER_PORT.to_string())
    .stdin(Stdio::null())
    .stdout(Stdio::null())
    .stderr(Stdio::null())
    .spawn()
    .map_err(|error| format!("failed to spawn fallback local API server: {error}"))
}

#[cfg(not(debug_assertions))]
fn spawn_local_server(app: &tauri::AppHandle) -> Result<LocalServerSpawn, String> {
  match spawn_sidecar_server(app) {
    Ok(child) => Ok(LocalServerSpawn {
      child,
      launch_mode: LaunchMode::Sidecar,
      warning: None,
    }),
    Err(sidecar_error) => {
      let child = spawn_fallback_server(app).map_err(|fallback_error| {
        format!(
          "preferred sidecar launch failed: {sidecar_error}; fallback node launch failed: {fallback_error}"
        )
      })?;
      Ok(LocalServerSpawn {
        child,
        launch_mode: LaunchMode::FallbackNode,
        warning: Some(format!(
          "Bundled sidecar launch failed, using host node fallback: {sidecar_error}"
        )),
      })
    }
  }
}

#[cfg(not(debug_assertions))]
fn probe_local_server_health_once() -> Result<(), String> {
  let socket_addr: SocketAddr = format!("{LOCAL_SERVER_HOST}:{LOCAL_SERVER_PORT}")
    .parse()
    .map_err(|error| format!("invalid health check address: {error}"))?;
  let mut stream = TcpStream::connect_timeout(&socket_addr, Duration::from_millis(450))
    .map_err(|error| format!("connect failed: {error}"))?;
  let _ = stream.set_read_timeout(Some(Duration::from_millis(450)));
  let _ = stream.set_write_timeout(Some(Duration::from_millis(450)));

  let request = format!(
    "GET /api/health HTTP/1.1\r\nHost: {LOCAL_SERVER_HOST}:{LOCAL_SERVER_PORT}\r\nConnection: close\r\n\r\n"
  );
  stream
    .write_all(request.as_bytes())
    .map_err(|error| format!("request failed: {error}"))?;

  let mut response = String::new();
  stream
    .read_to_string(&mut response)
    .map_err(|error| format!("response read failed: {error}"))?;

  let status_line = response.lines().next().unwrap_or_default();
  if status_line.starts_with("HTTP/1.1 200") || status_line.starts_with("HTTP/1.0 200") {
    return Ok(());
  }
  Err(format!("health probe returned '{status_line}'"))
}

#[cfg(not(debug_assertions))]
fn wait_for_local_server_health(timeout: Duration) -> Result<(), String> {
  let started_at = Instant::now();
  let mut last_error = "no health response".to_string();

  while started_at.elapsed() < timeout {
    match probe_local_server_health_once() {
      Ok(()) => return Ok(()),
      Err(error) => {
        last_error = error;
        thread::sleep(Duration::from_millis(140));
      }
    }
  }

  Err(last_error)
}

#[cfg(not(debug_assertions))]
fn set_local_server_child(app: &tauri::AppHandle, next_child: Option<Child>) {
  if let Some(state) = app.try_state::<LocalServerState>() {
    if let Ok(mut guard) = state.0.lock() {
      if let Some(mut existing) = guard.take() {
        let _ = existing.kill();
        let _ = existing.wait();
      }
      *guard = next_child;
    }
  }
}

#[cfg(not(debug_assertions))]
fn start_local_server(
  app: &tauri::AppHandle,
) -> Result<(Child, RuntimeBootstrapSnapshot), RuntimeBootstrapSnapshot> {
  let mut spawn = match spawn_local_server(app) {
    Ok(spawn) => spawn,
    Err(error) => return Err(runtime_snapshot(false, "error", "none", Some(error))),
  };

  match wait_for_local_server_health(Duration::from_secs(7)) {
    Ok(()) => Ok((
      spawn.child,
      runtime_snapshot(true, "ready", spawn.launch_mode.as_str(), spawn.warning),
    )),
    Err(error) => {
      let _ = spawn.child.kill();
      let _ = spawn.child.wait();
      let message = if let Some(warning) = spawn.warning {
        format!("{warning}. Health check failed: {error}")
      } else {
        format!("Runtime started but failed health check: {error}")
      };
      Err(runtime_snapshot(
        false,
        "error",
        spawn.launch_mode.as_str(),
        Some(message),
      ))
    }
  }
}

#[cfg(not(debug_assertions))]
fn stop_local_server(app: &tauri::AppHandle) {
  set_local_server_child(app, None);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  let builder = tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![
      runtime_bootstrap_status,
      runtime_retry_bootstrap
    ])
    .setup(|app| {
      #[cfg(debug_assertions)]
      {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
        app.manage(RuntimeBootstrapState(Mutex::new(default_runtime_snapshot())));
      }

      #[cfg(not(debug_assertions))]
      {
        app.manage(LocalServerState(Mutex::new(None)));
        app.manage(RuntimeBootstrapState(Mutex::new(default_runtime_snapshot())));
        let snapshot = match start_local_server(&app.handle()) {
          Ok((child, snapshot)) => {
            set_local_server_child(&app.handle(), Some(child));
            snapshot
          }
          Err(snapshot) => snapshot,
        };
        if !snapshot.available {
          eprintln!(
            "[neural-os] runtime bootstrap unavailable: {}",
            snapshot
              .message
              .clone()
              .unwrap_or_else(|| "unknown error".to_string())
          );
        }
        set_runtime_bootstrap_snapshot(&app.handle(), snapshot);
      }

      Ok(())
    });

  let app = builder
    .build(tauri::generate_context!())
    .expect("error while building tauri application");

  app.run(|_app_handle, event| match event {
    tauri::RunEvent::ExitRequested { .. } | tauri::RunEvent::Exit => {
      #[cfg(not(debug_assertions))]
      stop_local_server(_app_handle);
    }
    _ => {}
  });
}
