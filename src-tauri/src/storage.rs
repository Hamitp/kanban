use chrono::{SecondsFormat, Utc};
use serde::Serialize;
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::cmp::max;
#[cfg(unix)]
use std::fs::File;
use std::fs::{self, OpenOptions};
use std::io::{self, Write};
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Manager, State};

const BACKUP_INTERVAL: Duration = Duration::from_secs(60 * 60);
const MAX_BACKUPS: usize = 60;
const MAX_WORKSPACE_BYTES: u64 = 50 * 1024 * 1024;
const MAX_REPORT_BYTES: usize = 20 * 1024 * 1024;
const MAX_SAFE_JS_INTEGER: u64 = 9_007_199_254_740_991;

#[derive(Clone)]
pub struct StorageRuntime {
    write_lock: Arc<Mutex<()>>,
    latest_revision: Arc<AtomicU64>,
}

impl Default for StorageRuntime {
    fn default() -> Self {
        Self {
            write_lock: Arc::new(Mutex::new(())),
            latest_revision: Arc::new(AtomicU64::new(0)),
        }
    }
}

impl StorageRuntime {
    pub fn wait_until_idle(&self) {
        if let Ok(guard) = self.write_lock.lock() {
            drop(guard);
        }
    }
}

#[derive(Debug, Clone)]
struct StoragePaths {
    save_directory: PathBuf,
    backup_directory: PathBuf,
    recovery_directory: PathBuf,
    data_file: PathBuf,
    previous_file: PathBuf,
    temporary_file: PathBuf,
}

impl StoragePaths {
    fn under_documents(documents: &Path) -> Self {
        let save_directory = documents.join("Akış").join("Save");
        Self {
            backup_directory: save_directory.join("Backups"),
            recovery_directory: save_directory.join("Recovery"),
            data_file: save_directory.join("workspace.akis.json"),
            previous_file: save_directory.join("workspace.previous.akis.json"),
            temporary_file: save_directory.join("workspace.tmp.akis.json"),
            save_directory,
        }
    }

    fn for_app(app: &AppHandle) -> Result<Self, CommandError> {
        let documents = app.path().document_dir().map_err(|error| {
            CommandError::new(
                "DOCUMENTS_DIRECTORY_UNAVAILABLE",
                format!("Belgeler klasörü bulunamadı: {error}"),
            )
        })?;
        Ok(Self::under_documents(&documents))
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CommandError {
    code: String,
    message: String,
}

impl CommandError {
    fn new(code: impl Into<String>, message: impl Into<String>) -> Self {
        Self {
            code: code.into(),
            message: message.into(),
        }
    }

    fn io(context: &str, error: io::Error) -> Self {
        Self::new("STORAGE_IO_ERROR", format!("{context}: {error}"))
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageInfo {
    is_desktop: bool,
    save_directory: String,
    backup_directory: String,
    data_file: String,
    automatic_backups: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveResult {
    is_desktop: bool,
    save_directory: String,
    backup_directory: String,
    data_file: String,
    automatic_backups: bool,
    saved_at: String,
    revision: u64,
    backup_created: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReportExportResult {
    path: String,
    directory: String,
    filename: String,
    destination: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RecoveryMetadata {
    status: String,
    source: Option<String>,
    source_file: Option<String>,
    source_saved_at: Option<String>,
    quarantined_file: Option<String>,
    recovered_at: Option<String>,
}

impl RecoveryMetadata {
    fn none() -> Self {
        Self {
            status: "none".into(),
            source: None,
            source_file: None,
            source_saved_at: None,
            quarantined_file: None,
            recovered_at: None,
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LoadResult {
    data: Option<Value>,
    recovery: RecoveryMetadata,
}

#[derive(Debug)]
struct WorkspaceRecord {
    data: Value,
    revision: u64,
    saved_at: Option<String>,
    path: PathBuf,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct WorkspaceEnvelope<'a> {
    format: &'static str,
    format_version: u8,
    revision: u64,
    saved_at: &'a str,
    checksum: String,
    data: &'a Value,
}

#[derive(Debug)]
struct BackupEntry {
    path: PathBuf,
    modified: SystemTime,
}

fn path_text(path: &Path) -> String {
    path.to_string_lossy().into_owned()
}

fn validate_app_data(data: &Value) -> bool {
    let Some(object) = data.as_object() else {
        return false;
    };

    matches!(object.get("version").and_then(Value::as_u64), Some(1 | 2))
        && object.get("projects").is_some_and(Value::is_array)
        && object.get("boards").is_some_and(Value::is_array)
        && object.get("mindMaps").is_some_and(Value::is_array)
        && object.get("members").is_some_and(Value::is_array)
        && object.get("labels").is_some_and(Value::is_array)
        && (object.get("version").and_then(Value::as_u64) == Some(1)
            || (object.get("issues").is_some_and(Value::is_array)
                && object.get("calendarEvents").is_some_and(Value::is_array)))
}

fn validate_workspace(data: &Value) -> bool {
    // Read and preserve legacy v1 files so the renderer can migrate them.
    if validate_app_data(data) {
        return true;
    }

    let Some(object) = data.as_object() else {
        return false;
    };
    let version = object.get("version").and_then(Value::as_u64);
    if version != Some(2) && version != Some(3) && version != Some(4) {
        return false;
    }
    if version == Some(3) || version == Some(4) {
        let Some(preferences) = object.get("preferences").and_then(Value::as_object) else {
            return false;
        };
        if preferences
            .get("language")
            .is_some_and(|language| !matches!(language.as_str(), Some("tr" | "en")))
            || !matches!(
                preferences.get("defaultCurrency").and_then(Value::as_str),
                Some("TRY" | "USD" | "EUR" | "GBP")
            )
            || !preferences
                .get("freshInstallation")
                .is_some_and(Value::is_boolean)
        {
            return false;
        }
    }
    let Some(active_workspace_id) = object.get("activeWorkspaceId").and_then(Value::as_str) else {
        return false;
    };
    let Some(workspaces) = object.get("workspaces").and_then(Value::as_array) else {
        return false;
    };
    if workspaces.is_empty() {
        return false;
    }

    let mut active_workspace_is_available = false;
    for workspace in workspaces {
        let Some(workspace) = workspace.as_object() else {
            return false;
        };
        let Some(id) = workspace.get("id").and_then(Value::as_str) else {
            return false;
        };
        if id.is_empty()
            || workspace
                .get("name")
                .and_then(Value::as_str)
                .is_none_or(str::is_empty)
            || !workspace.get("archived").is_some_and(Value::is_boolean)
            || !workspace.get("data").is_some_and(validate_app_data)
        {
            return false;
        }
        if id == active_workspace_id
            && workspace.get("archived").and_then(Value::as_bool) == Some(false)
        {
            active_workspace_is_available = true;
        }
    }

    active_workspace_is_available
}

fn checksum(data: &Value) -> String {
    // preserve_order on serde_json keeps Electron's JSON.stringify key order.
    let bytes = serde_json::to_vec(data).expect("serde_json::Value must always serialize");
    format!("sha256:{:x}", Sha256::digest(bytes))
}

fn ensure_directories(paths: &StoragePaths) -> Result<(), CommandError> {
    for directory in [
        &paths.save_directory,
        &paths.backup_directory,
        &paths.recovery_directory,
    ] {
        fs::create_dir_all(directory)
            .map_err(|error| CommandError::io("Kayıt klasörü oluşturulamadı", error))?;
    }
    Ok(())
}

fn exists(path: &Path) -> Result<bool, CommandError> {
    match fs::metadata(path) {
        Ok(_) => Ok(true),
        Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(false),
        Err(error) => Err(CommandError::io("Dosya bilgisi okunamadı", error)),
    }
}

fn read_workspace_file(path: &Path) -> Result<Option<WorkspaceRecord>, CommandError> {
    let metadata = match fs::metadata(path) {
        Ok(metadata) => metadata,
        Err(error) if error.kind() == io::ErrorKind::NotFound => return Ok(None),
        Err(error) => return Err(CommandError::io("Çalışma alanı okunamadı", error)),
    };

    if !metadata.is_file() || metadata.len() > MAX_WORKSPACE_BYTES {
        return Ok(None);
    }

    let text = fs::read_to_string(path)
        .map_err(|error| CommandError::io("Çalışma alanı okunamadı", error))?;
    let parsed: Value = match serde_json::from_str(&text) {
        Ok(value) => value,
        Err(_) => return Ok(None),
    };

    if parsed.get("data").is_none() {
        return if validate_workspace(&parsed) {
            Ok(Some(WorkspaceRecord {
                data: parsed,
                revision: 0,
                saved_at: None,
                path: path.to_path_buf(),
            }))
        } else {
            Ok(None)
        };
    }

    if parsed.get("format").and_then(Value::as_str) != Some("akis-workspace")
        || parsed.get("formatVersion").and_then(Value::as_u64) != Some(1)
    {
        return Ok(None);
    }

    let Some(data) = parsed.get("data").cloned() else {
        return Ok(None);
    };
    if !validate_workspace(&data) {
        return Ok(None);
    }

    let Some(stored_checksum) = parsed.get("checksum").and_then(Value::as_str) else {
        return Ok(None);
    };
    if stored_checksum != checksum(&data) {
        return Ok(None);
    }

    let revision = parsed
        .get("revision")
        .and_then(Value::as_u64)
        .filter(|value| *value <= MAX_SAFE_JS_INTEGER)
        .unwrap_or(0);

    Ok(Some(WorkspaceRecord {
        data,
        revision,
        saved_at: parsed
            .get("savedAt")
            .and_then(Value::as_str)
            .map(str::to_owned),
        path: path.to_path_buf(),
    }))
}

fn list_backups(paths: &StoragePaths) -> Result<Vec<BackupEntry>, CommandError> {
    let entries = match fs::read_dir(&paths.backup_directory) {
        Ok(entries) => entries,
        Err(error) if error.kind() == io::ErrorKind::NotFound => return Ok(Vec::new()),
        Err(error) => return Err(CommandError::io("Yedek klasörü okunamadı", error)),
    };

    let mut backups = Vec::new();
    for entry in entries {
        let entry = entry.map_err(|error| CommandError::io("Yedek girdisi okunamadı", error))?;
        let path = entry.path();
        let is_json = path
            .file_name()
            .and_then(|name| name.to_str())
            .is_some_and(|name| name.ends_with(".json"));
        if !is_json {
            continue;
        }
        let metadata = entry
            .metadata()
            .map_err(|error| CommandError::io("Yedek bilgisi okunamadı", error))?;
        if metadata.is_file() {
            backups.push(BackupEntry {
                path,
                modified: metadata.modified().unwrap_or(UNIX_EPOCH),
            });
        }
    }

    backups.sort_by(|left, right| right.modified.cmp(&left.modified));
    Ok(backups)
}

fn timestamp() -> String {
    Utc::now().format("%Y-%m-%dT%H-%M-%S-%3fZ").to_string()
}

fn saved_at() -> String {
    Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true)
}

fn sibling_temp(destination: &Path) -> Result<PathBuf, CommandError> {
    let Some(name) = destination.file_name().and_then(|name| name.to_str()) else {
        return Err(CommandError::new(
            "INVALID_STORAGE_PATH",
            "Geçici kayıt dosyası adı oluşturulamadı",
        ));
    };
    Ok(destination.with_file_name(format!(".{name}.tmp")))
}

fn write_durable(path: &Path, bytes: &[u8]) -> Result<(), CommandError> {
    let mut file = OpenOptions::new()
        .create(true)
        .truncate(true)
        .write(true)
        .open(path)
        .map_err(|error| CommandError::io("Geçici dosya açılamadı", error))?;
    file.write_all(bytes)
        .map_err(|error| CommandError::io("Geçici dosya yazılamadı", error))?;
    file.sync_all()
        .map_err(|error| CommandError::io("Geçici dosya diske aktarılamadı", error))?;
    Ok(())
}

#[cfg(windows)]
fn replace_file_once(source: &Path, destination: &Path) -> io::Result<()> {
    use std::iter::once;
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::Storage::FileSystem::{
        MoveFileExW, MOVEFILE_REPLACE_EXISTING, MOVEFILE_WRITE_THROUGH,
    };

    let source: Vec<u16> = source.as_os_str().encode_wide().chain(once(0)).collect();
    let destination: Vec<u16> = destination
        .as_os_str()
        .encode_wide()
        .chain(once(0))
        .collect();
    let succeeded = unsafe {
        MoveFileExW(
            source.as_ptr(),
            destination.as_ptr(),
            MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH,
        )
    };
    if succeeded == 0 {
        Err(io::Error::last_os_error())
    } else {
        Ok(())
    }
}

#[cfg(not(windows))]
fn replace_file_once(source: &Path, destination: &Path) -> io::Result<()> {
    fs::rename(source, destination)
}

fn replace_file_with_retry(source: &Path, destination: &Path) -> Result<(), CommandError> {
    let mut last_error = None;
    for attempt in 0..4 {
        match replace_file_once(source, destination) {
            Ok(()) => {
                sync_parent_directory(destination)?;
                return Ok(());
            }
            Err(error) => {
                last_error = Some(error);
                thread::sleep(Duration::from_millis(40 * (attempt + 1)));
            }
        }
    }

    Err(CommandError::io(
        "Atomik dosya değişimi başarısız oldu",
        last_error.unwrap_or_else(|| io::Error::other("bilinmeyen dosya hatası")),
    ))
}

#[cfg(unix)]
fn sync_parent_directory(path: &Path) -> Result<(), CommandError> {
    let Some(parent) = path.parent() else {
        return Ok(());
    };
    File::open(parent)
        .and_then(|directory| directory.sync_all())
        .map_err(|error| CommandError::io("Kayıt klasörü diske aktarılamadı", error))
}

#[cfg(not(unix))]
fn sync_parent_directory(_path: &Path) -> Result<(), CommandError> {
    // MOVEFILE_WRITE_THROUGH provides the equivalent durability on Windows.
    Ok(())
}

fn atomic_copy(source: &Path, destination: &Path) -> Result<(), CommandError> {
    let temporary = sibling_temp(destination)?;
    fs::copy(source, &temporary)
        .map_err(|error| CommandError::io("Güvenli kopya oluşturulamadı", error))?;
    OpenOptions::new()
        .read(true)
        .write(true)
        .open(&temporary)
        .and_then(|file| file.sync_all())
        .map_err(|error| CommandError::io("Güvenli kopya diske aktarılamadı", error))?;
    if let Err(error) = replace_file_with_retry(&temporary, destination) {
        let _ = fs::remove_file(&temporary);
        return Err(error);
    }
    Ok(())
}

fn create_backup_if_due(
    paths: &StoragePaths,
    current: &WorkspaceRecord,
) -> Result<bool, CommandError> {
    let backups = list_backups(paths)?;
    if let Some(newest) = backups.first() {
        let age = SystemTime::now()
            .duration_since(newest.modified)
            .unwrap_or(Duration::ZERO);
        if age < BACKUP_INTERVAL {
            return Ok(false);
        }

        if let Some(record) = read_workspace_file(&newest.path)? {
            if checksum(&record.data) == checksum(&current.data) {
                return Ok(false);
            }
        }
    }

    let backup_file = paths
        .backup_directory
        .join(format!("akis-otomatik-{}.akis.json", timestamp()));
    atomic_copy(&current.path, &backup_file)?;
    let Some(verified) = read_workspace_file(&backup_file)? else {
        let _ = fs::remove_file(&backup_file);
        return Err(CommandError::new(
            "BACKUP_VERIFICATION_FAILED",
            "Otomatik yedek doğrulanamadı",
        ));
    };
    if checksum(&verified.data) != checksum(&current.data) {
        let _ = fs::remove_file(&backup_file);
        return Err(CommandError::new(
            "BACKUP_VERIFICATION_FAILED",
            "Otomatik yedek ana kayıtla eşleşmiyor",
        ));
    }

    let refreshed = list_backups(paths)?;
    for expired in refreshed.into_iter().skip(MAX_BACKUPS) {
        fs::remove_file(expired.path)
            .map_err(|error| CommandError::io("Eski yedek silinemedi", error))?;
    }
    Ok(true)
}

fn storage_info(paths: &StoragePaths) -> StorageInfo {
    StorageInfo {
        is_desktop: true,
        save_directory: path_text(&paths.save_directory),
        backup_directory: path_text(&paths.backup_directory),
        data_file: path_text(&paths.data_file),
        automatic_backups: true,
    }
}

fn write_workspace_at(
    paths: &StoragePaths,
    runtime: &StorageRuntime,
    data: Value,
) -> Result<SaveResult, CommandError> {
    if !validate_workspace(&data) {
        return Err(CommandError::new(
            "INVALID_WORKSPACE",
            "Çalışma alanı verisi geçerli değil",
        ));
    }
    let serialized_data = serde_json::to_vec(&data).map_err(|error| {
        CommandError::new(
            "WORKSPACE_SERIALIZATION_FAILED",
            format!("Çalışma alanı hazırlanamadı: {error}"),
        )
    })?;
    if serialized_data.len() as u64 > MAX_WORKSPACE_BYTES {
        return Err(CommandError::new(
            "WORKSPACE_TOO_LARGE",
            "Çalışma alanı 50 MB sınırını aşıyor",
        ));
    }

    ensure_directories(paths)?;
    let current = read_workspace_file(&paths.data_file)?;
    let backup_created = match &current {
        Some(record) => create_backup_if_due(paths, record)?,
        None => false,
    };

    let latest_revision = runtime.latest_revision.load(Ordering::SeqCst);
    let base_revision = max(
        latest_revision,
        current.as_ref().map_or(0, |record| record.revision),
    );
    let revision = base_revision
        .checked_add(1)
        .filter(|value| *value <= MAX_SAFE_JS_INTEGER)
        .ok_or_else(|| {
            CommandError::new(
                "REVISION_LIMIT_REACHED",
                "Çalışma alanı kayıt sayacı güvenli sınırı aştı",
            )
        })?;
    let saved_at = saved_at();
    let envelope = WorkspaceEnvelope {
        format: "akis-workspace",
        format_version: 1,
        revision,
        saved_at: &saved_at,
        checksum: checksum(&data),
        data: &data,
    };
    let payload = serde_json::to_vec_pretty(&envelope).map_err(|error| {
        CommandError::new(
            "WORKSPACE_SERIALIZATION_FAILED",
            format!("Kayıt zarfı hazırlanamadı: {error}"),
        )
    })?;

    write_durable(&paths.temporary_file, &payload)?;
    let Some(verified) = read_workspace_file(&paths.temporary_file)? else {
        let _ = fs::remove_file(&paths.temporary_file);
        return Err(CommandError::new(
            "SAVE_VERIFICATION_FAILED",
            "Geçici kayıt doğrulanamadı",
        ));
    };
    if verified.revision != revision || checksum(&verified.data) != checksum(&data) {
        let _ = fs::remove_file(&paths.temporary_file);
        return Err(CommandError::new(
            "SAVE_VERIFICATION_FAILED",
            "Geçici kayıt çalışma alanıyla eşleşmiyor",
        ));
    }

    if current.is_some() {
        if let Err(error) = atomic_copy(&paths.data_file, &paths.previous_file) {
            let _ = fs::remove_file(&paths.temporary_file);
            return Err(error);
        }
    }

    replace_file_with_retry(&paths.temporary_file, &paths.data_file)?;
    runtime.latest_revision.store(revision, Ordering::SeqCst);

    Ok(SaveResult {
        is_desktop: true,
        save_directory: path_text(&paths.save_directory),
        backup_directory: path_text(&paths.backup_directory),
        data_file: path_text(&paths.data_file),
        automatic_backups: true,
        saved_at,
        revision,
        backup_created,
    })
}

fn quarantine_corrupt_primary(paths: &StoragePaths) -> Result<Option<PathBuf>, CommandError> {
    if !exists(&paths.data_file)? {
        return Ok(None);
    }
    let quarantine = paths
        .recovery_directory
        .join(format!("workspace-bozuk-{}.akis.json", timestamp()));
    atomic_copy(&paths.data_file, &quarantine)?;
    Ok(Some(quarantine))
}

fn recover_record(
    paths: &StoragePaths,
    runtime: &StorageRuntime,
    record: WorkspaceRecord,
    source: &str,
    quarantined: Option<&Path>,
) -> Result<LoadResult, CommandError> {
    runtime
        .latest_revision
        .store(record.revision, Ordering::SeqCst);
    let source_file = path_text(&record.path);
    let source_saved_at = record.saved_at.clone();
    let data = record.data;

    // Rewrite through the normal verified path so the next launch has a healthy primary.
    write_workspace_at(paths, runtime, data.clone())?;

    Ok(LoadResult {
        data: Some(data),
        recovery: RecoveryMetadata {
            status: "recovered".into(),
            source: Some(source.into()),
            source_file: Some(source_file),
            source_saved_at,
            quarantined_file: quarantined.map(path_text),
            recovered_at: Some(saved_at()),
        },
    })
}

fn load_workspace_at(
    paths: &StoragePaths,
    runtime: &StorageRuntime,
) -> Result<LoadResult, CommandError> {
    ensure_directories(paths)?;
    let primary_exists = exists(&paths.data_file)?;
    if let Some(primary) = read_workspace_file(&paths.data_file)? {
        runtime
            .latest_revision
            .store(primary.revision, Ordering::SeqCst);
        return Ok(LoadResult {
            data: Some(primary.data),
            recovery: RecoveryMetadata::none(),
        });
    }

    let previous_exists = exists(&paths.previous_file)?;
    let quarantined = if primary_exists {
        quarantine_corrupt_primary(paths)?
    } else {
        None
    };

    if let Some(previous) = read_workspace_file(&paths.previous_file)? {
        return recover_record(paths, runtime, previous, "previous", quarantined.as_deref());
    }

    let backups = list_backups(paths)?;
    for backup in &backups {
        if let Some(record) = read_workspace_file(&backup.path)? {
            return recover_record(paths, runtime, record, "backup", quarantined.as_deref());
        }
    }

    if primary_exists || previous_exists || !backups.is_empty() {
        return Ok(LoadResult {
            data: None,
            recovery: RecoveryMetadata {
                status: "required".into(),
                source: None,
                source_file: None,
                source_saved_at: None,
                quarantined_file: quarantined.as_deref().map(path_text),
                recovered_at: None,
            },
        });
    }

    Ok(LoadResult {
        data: None,
        recovery: RecoveryMetadata::none(),
    })
}

fn lock_runtime(runtime: &StorageRuntime) -> Result<std::sync::MutexGuard<'_, ()>, CommandError> {
    runtime.write_lock.lock().map_err(|_| {
        CommandError::new(
            "STORAGE_LOCK_POISONED",
            "Kayıt sırası beklenmeyen biçimde durdu",
        )
    })
}

fn blocking_join_error(error: impl std::fmt::Display) -> CommandError {
    CommandError::new(
        "STORAGE_TASK_FAILED",
        format!("Kayıt görevi tamamlanamadı: {error}"),
    )
}

#[tauri::command]
pub async fn load(
    app: AppHandle,
    state: State<'_, StorageRuntime>,
) -> Result<LoadResult, CommandError> {
    let runtime = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let _guard = lock_runtime(&runtime)?;
        let paths = StoragePaths::for_app(&app)?;
        load_workspace_at(&paths, &runtime)
    })
    .await
    .map_err(blocking_join_error)?
}

#[tauri::command]
pub async fn save(
    app: AppHandle,
    state: State<'_, StorageRuntime>,
    data: Value,
) -> Result<SaveResult, CommandError> {
    let runtime = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let _guard = lock_runtime(&runtime)?;
        let paths = StoragePaths::for_app(&app)?;
        write_workspace_at(&paths, &runtime, data)
    })
    .await
    .map_err(blocking_join_error)?
}

#[tauri::command]
pub async fn info(
    app: AppHandle,
    state: State<'_, StorageRuntime>,
) -> Result<StorageInfo, CommandError> {
    let runtime = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let _guard = lock_runtime(&runtime)?;
        let paths = StoragePaths::for_app(&app)?;
        ensure_directories(&paths)?;
        Ok(storage_info(&paths))
    })
    .await
    .map_err(blocking_join_error)?
}

fn open_directory(path: &Path) -> Result<(), CommandError> {
    #[cfg(target_os = "windows")]
    let mut command = Command::new("explorer.exe");
    #[cfg(target_os = "macos")]
    let mut command = Command::new("open");
    #[cfg(all(unix, not(target_os = "macos")))]
    let mut command = Command::new("xdg-open");

    command
        .arg(path)
        .spawn()
        .map_err(|error| CommandError::io("Save klasörü açılamadı", error))?;
    Ok(())
}

fn safe_report_filename(filename: &str) -> String {
    let stem = filename
        .trim()
        .trim_end_matches(|character: char| character == '.' || character.is_whitespace())
        .strip_suffix(".pdf")
        .or_else(|| filename.trim().strip_suffix(".PDF"))
        .unwrap_or(filename.trim());
    let mut safe = String::with_capacity(stem.len().min(96));
    for character in stem.chars() {
        if safe.chars().count() >= 96 {
            break;
        }
        if character.is_control()
            || matches!(
                character,
                '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|'
            )
        {
            safe.push('_');
        } else {
            safe.push(character);
        }
    }
    let safe = safe.trim().trim_matches('.');
    format!(
        "{}.pdf",
        if safe.is_empty() {
            "akis-sorun-raporu"
        } else {
            safe
        }
    )
}

fn safe_workspace_folder(workspace_id: &str, workspace_name: &str) -> Result<String, CommandError> {
    let workspace_id = workspace_id.trim();
    if workspace_id.is_empty() || workspace_id.len() > 512 {
        return Err(CommandError::new(
            "INVALID_WORKSPACE_ID",
            "Rapor klasörü için geçerli bir çalışma alanı kimliği gerekli",
        ));
    }

    let mut safe_name = String::with_capacity(workspace_name.len().min(64));
    for (index, character) in workspace_name.trim().chars().enumerate() {
        if index >= 64 {
            break;
        }
        if character.is_control()
            || matches!(
                character,
                '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|'
            )
        {
            safe_name.push('_');
        } else {
            safe_name.push(character);
        }
    }
    let safe_name = safe_name.trim().trim_matches('.');
    let safe_name = if safe_name.is_empty() {
        "Calisma-Alani"
    } else {
        safe_name
    };
    let identity = format!("{:x}", Sha256::digest(workspace_id.as_bytes()));
    Ok(format!("{safe_name}--{}", &identity[..12]))
}

fn workspace_exports_directory(
    paths: &StoragePaths,
    workspace_id: &str,
    workspace_name: &str,
) -> Result<PathBuf, CommandError> {
    Ok(paths
        .save_directory
        .join("Exports")
        .join(safe_workspace_folder(workspace_id, workspace_name)?))
}

fn unique_report_path(directory: &Path, filename: &str) -> PathBuf {
    let requested = directory.join(filename);
    if !requested.exists() {
        return requested;
    }
    let stem = Path::new(filename)
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("akis-sorun-raporu");
    let stamp = Utc::now().format("%Y%m%d-%H%M%S");
    directory.join(format!("{stem}-{stamp}.pdf"))
}

fn write_problem_report(
    paths: &StoragePaths,
    workspace_id: &str,
    workspace_name: &str,
    filename: &str,
    bytes: &[u8],
) -> Result<ReportExportResult, CommandError> {
    if bytes.len() > MAX_REPORT_BYTES {
        return Err(CommandError::new(
            "REPORT_TOO_LARGE",
            "PDF raporu 20 MB sınırını aşıyor",
        ));
    }
    if !bytes.starts_with(b"%PDF-") {
        return Err(CommandError::new(
            "INVALID_REPORT",
            "Oluşturulan dosya geçerli bir PDF değil",
        ));
    }
    let exports = workspace_exports_directory(paths, workspace_id, workspace_name)?;
    fs::create_dir_all(&exports)
        .map_err(|error| CommandError::io("Rapor klasörü oluşturulamadı", error))?;
    let safe_name = safe_report_filename(filename);
    let target = unique_report_path(&exports, &safe_name);
    let temporary = exports.join(format!(
        ".{}.tmp",
        target
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or("report.pdf")
    ));
    write_durable(&temporary, bytes)?;
    fs::rename(&temporary, &target)
        .map_err(|error| CommandError::io("PDF raporu tamamlanamadı", error))?;
    let final_name = target
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or(&safe_name)
        .to_string();
    Ok(ReportExportResult {
        path: path_text(&target),
        directory: path_text(&exports),
        filename: final_name,
        destination: "desktop-exports".into(),
    })
}

#[tauri::command]
pub async fn open_save_folder(
    app: AppHandle,
    state: State<'_, StorageRuntime>,
) -> Result<String, CommandError> {
    let runtime = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let _guard = lock_runtime(&runtime)?;
        let paths = StoragePaths::for_app(&app)?;
        ensure_directories(&paths)?;
        open_directory(&paths.save_directory)?;
        // Electron's shell.openPath contract returns an empty string on success.
        Ok(String::new())
    })
    .await
    .map_err(blocking_join_error)?
}

#[tauri::command]
pub async fn save_problem_report(
    app: AppHandle,
    state: State<'_, StorageRuntime>,
    workspace_id: String,
    workspace_name: String,
    filename: String,
    bytes: Vec<u8>,
) -> Result<ReportExportResult, CommandError> {
    let runtime = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let _guard = lock_runtime(&runtime)?;
        let paths = StoragePaths::for_app(&app)?;
        ensure_directories(&paths)?;
        write_problem_report(&paths, &workspace_id, &workspace_name, &filename, &bytes)
    })
    .await
    .map_err(blocking_join_error)?
}

#[tauri::command]
pub async fn open_exports_folder(
    app: AppHandle,
    state: State<'_, StorageRuntime>,
    workspace_id: String,
    workspace_name: String,
) -> Result<String, CommandError> {
    let runtime = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let _guard = lock_runtime(&runtime)?;
        let paths = StoragePaths::for_app(&app)?;
        let exports = workspace_exports_directory(&paths, &workspace_id, &workspace_name)?;
        fs::create_dir_all(&exports)
            .map_err(|error| CommandError::io("Rapor klasörü oluşturulamadı", error))?;
        open_directory(&exports)?;
        Ok(String::new())
    })
    .await
    .map_err(blocking_join_error)?
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use tempfile::tempdir;

    #[test]
    fn report_filename_is_sanitized_and_keeps_unicode() {
        assert_eq!(
            safe_report_filename("Kök neden: müşteri/teslim.pdf"),
            "Kök neden_ müşteri_teslim.pdf"
        );
        assert_eq!(safe_report_filename("../"), "_.pdf");
        assert_eq!(safe_report_filename("   "), "akis-sorun-raporu.pdf");
    }

    #[test]
    fn workspace_export_folder_is_a_safe_single_component() {
        let first = safe_workspace_folder("workspace-personal", "../Müşteri\\A:*?")
            .expect("safe workspace folder");
        let second = safe_workspace_folder("workspace-company", "../Müşteri\\A:*?")
            .expect("safe workspace folder");

        assert_eq!(Path::new(&first).components().count(), 1);
        assert!(!first.contains('/') && !first.contains('\\'));
        assert!(!first.starts_with('.'));
        assert_ne!(
            first, second,
            "different workspace ids must not share a folder"
        );
        assert_eq!(
            first,
            safe_workspace_folder("workspace-personal", "../Müşteri\\A:*?")
                .expect("stable workspace folder")
        );
    }

    #[test]
    fn workspace_export_folder_rejects_an_empty_identity() {
        let error = safe_workspace_folder("   ", "Kişisel Alanım")
            .expect_err("empty workspace ids must be rejected");
        assert_eq!(error.code, "INVALID_WORKSPACE_ID");
    }

    #[test]
    fn problem_report_requires_a_pdf_signature() {
        let directory = tempdir().expect("temp");
        let paths = StoragePaths::under_documents(directory.path());
        ensure_directories(&paths).expect("directories");
        let error = write_problem_report(
            &paths,
            "workspace-personal",
            "Kişisel Alanım",
            "rapor.pdf",
            b"not a pdf",
        )
        .expect_err("invalid report");
        assert_eq!(error.code, "INVALID_REPORT");
    }

    #[test]
    fn problem_reports_are_isolated_by_workspace() {
        let directory = tempdir().expect("temp");
        let paths = StoragePaths::under_documents(directory.path());
        ensure_directories(&paths).expect("directories");

        let personal = write_problem_report(
            &paths,
            "workspace-personal",
            "Kişisel Alanım",
            "rapor.pdf",
            b"%PDF-1.7\n",
        )
        .expect("personal report");
        let company = write_problem_report(
            &paths,
            "workspace-company",
            "Şirket Alanı",
            "rapor.pdf",
            b"%PDF-1.7\n",
        )
        .expect("company report");

        let exports_root = paths.save_directory.join("Exports");
        let personal_path = Path::new(&personal.path);
        let company_path = Path::new(&company.path);
        assert!(personal_path.starts_with(&exports_root));
        assert!(company_path.starts_with(&exports_root));
        assert_ne!(personal.directory, company.directory);
        assert_eq!(personal.destination, "desktop-exports");
        assert_eq!(company.destination, "desktop-exports");
        assert_eq!(
            fs::read(personal_path).expect("personal bytes"),
            b"%PDF-1.7\n"
        );
        assert_eq!(
            fs::read(company_path).expect("company bytes"),
            b"%PDF-1.7\n"
        );
    }

    fn workspace(name: &str) -> Value {
        json!({
            "version": 1,
            "workspaceName": name,
            "theme": "linen",
            "projects": [],
            "boards": [],
            "mindMaps": [],
            "members": [],
            "labels": [],
            "updatedAt": "2026-07-12T12:00:00.000Z"
        })
    }

    fn workspace_v2(name: &str) -> Value {
        let mut data = workspace(name);
        let object = data.as_object_mut().expect("app data object");
        object.insert("version".into(), json!(2));
        object.insert("issues".into(), json!([]));
        object.insert("calendarEvents".into(), json!([]));
        data
    }

    fn workspace_store(name: &str) -> Value {
        json!({
            "version": 4,
            "activeWorkspaceId": "workspace-personal",
            "workspaces": [{
                "id": "workspace-personal",
                "name": name,
                "color": "#6558c7",
                "archived": false,
                "createdAt": "2026-07-12T12:00:00.000Z",
                "updatedAt": "2026-07-12T12:00:00.000Z",
                "data": workspace_v2(name)
            }],
            "preferences": {
                "language": "en",
                "defaultCurrency": "USD",
                "freshInstallation": false
            },
            "updatedAt": "2026-07-12T12:00:00.000Z"
        })
    }

    #[test]
    fn uses_only_the_fixed_documents_save_tree() {
        let paths = StoragePaths::under_documents(Path::new("C:/Users/Test/Documents"));
        assert_eq!(
            paths.save_directory,
            Path::new("C:/Users/Test/Documents")
                .join("Akış")
                .join("Save")
        );
        assert_eq!(
            paths.data_file.file_name().and_then(|name| name.to_str()),
            Some("workspace.akis.json")
        );
    }

    #[test]
    fn checksum_matches_electron_json_stringify_for_the_same_key_order() {
        assert_eq!(
            checksum(&workspace("Akis")),
            "sha256:6d89d37b855108e44b632064e732da8dc99f695740fe37eab6abc7f3ab98848b"
        );
    }

    #[test]
    fn writes_electron_compatible_envelope_previous_and_backup() {
        let root = tempdir().expect("temp dir");
        let paths = StoragePaths::under_documents(root.path());
        let runtime = StorageRuntime::default();

        let first = write_workspace_at(&paths, &runtime, workspace("Bir")).expect("first save");
        assert_eq!(first.revision, 1);
        assert!(!first.backup_created);

        let primary_text = fs::read_to_string(&paths.data_file).expect("primary");
        assert!(primary_text.contains("\"format\": \"akis-workspace\""));
        assert!(primary_text.contains("\"formatVersion\": 1"));
        assert!(primary_text.contains("\"checksum\": \"sha256:"));
        assert_eq!(
            read_workspace_file(&paths.data_file)
                .expect("read")
                .expect("valid")
                .data,
            workspace("Bir")
        );

        let second = write_workspace_at(&paths, &runtime, workspace("İki")).expect("second save");
        assert_eq!(second.revision, 2);
        assert!(second.backup_created);
        assert_eq!(
            read_workspace_file(&paths.previous_file)
                .expect("read previous")
                .expect("valid previous")
                .data,
            workspace("Bir")
        );
        assert_eq!(list_backups(&paths).expect("backups").len(), 1);
    }

    #[test]
    fn accepts_and_round_trips_the_v4_workspace_store() {
        let root = tempdir().expect("temp dir");
        let paths = StoragePaths::under_documents(root.path());
        let runtime = StorageRuntime::default();
        let expected = workspace_store("Kişisel Alanım");

        write_workspace_at(&paths, &runtime, expected.clone()).expect("v4 save");
        let loaded = load_workspace_at(&paths, &runtime).expect("v4 load");

        assert_eq!(loaded.data, Some(expected));
        assert_eq!(loaded.recovery.status, "none");
    }

    #[test]
    fn still_accepts_the_v2_workspace_store_for_migration() {
        let mut legacy = workspace_store("Kişisel Alanım");
        let object = legacy.as_object_mut().expect("workspace object");
        object.insert("version".into(), json!(2));
        object.remove("preferences");
        assert!(validate_workspace(&legacy));
    }

    #[test]
    fn rejects_unknown_workspace_currency_preferences() {
        let mut invalid = workspace_store("Kişisel Alanım");
        invalid["preferences"]["defaultCurrency"] = json!("JPY");
        assert!(!validate_workspace(&invalid));
    }

    #[test]
    fn corrupt_primary_is_quarantined_and_previous_is_restored() {
        let root = tempdir().expect("temp dir");
        let paths = StoragePaths::under_documents(root.path());
        let runtime = StorageRuntime::default();
        write_workspace_at(&paths, &runtime, workspace("Sağlam 1")).expect("first");
        write_workspace_at(&paths, &runtime, workspace("Sağlam 2")).expect("second");

        fs::write(&paths.data_file, b"{ yarim json").expect("corrupt");
        let loaded = load_workspace_at(&paths, &runtime).expect("recover");
        assert_eq!(loaded.data, Some(workspace("Sağlam 1")));
        assert_eq!(loaded.recovery.status, "recovered");
        assert_eq!(loaded.recovery.source.as_deref(), Some("previous"));
        assert!(loaded.recovery.quarantined_file.is_some());
        assert_eq!(
            read_workspace_file(&paths.data_file)
                .expect("read restored")
                .expect("valid restored")
                .data,
            workspace("Sağlam 1")
        );
    }

    #[test]
    fn invalid_workspace_never_replaces_the_primary() {
        let root = tempdir().expect("temp dir");
        let paths = StoragePaths::under_documents(root.path());
        let runtime = StorageRuntime::default();
        write_workspace_at(&paths, &runtime, workspace("Korunacak")).expect("first");
        let before = fs::read(&paths.data_file).expect("before");

        let error = write_workspace_at(&paths, &runtime, json!({ "version": 1 }))
            .expect_err("invalid must fail");
        assert_eq!(error.code, "INVALID_WORKSPACE");
        assert_eq!(fs::read(&paths.data_file).expect("after"), before);
    }

    #[test]
    fn unrecoverable_artifacts_are_reported_without_overwrite() {
        let root = tempdir().expect("temp dir");
        let paths = StoragePaths::under_documents(root.path());
        let runtime = StorageRuntime::default();
        ensure_directories(&paths).expect("directories");
        fs::write(&paths.data_file, b"broken").expect("primary");
        fs::write(&paths.previous_file, b"also broken").expect("previous");

        let before = fs::read(&paths.data_file).expect("before");
        let loaded = load_workspace_at(&paths, &runtime).expect("load result");
        assert!(loaded.data.is_none());
        assert_eq!(loaded.recovery.status, "required");
        assert_eq!(fs::read(&paths.data_file).expect("after"), before);
    }
}
