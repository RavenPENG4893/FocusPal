use rusqlite::{Connection, params};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;

pub struct AppDb(pub Mutex<Connection>);

// ── Types ──

#[derive(Serialize, Deserialize, Clone)]
pub struct MoodRecord {
    pub id: i64,
    pub score: i32,
    pub timestamp: i64,
    pub tags: String,
}

#[derive(Serialize)]
pub struct MoodStats {
    pub avg_7d: f64,
    pub avg_prev_7d: f64,
    pub checkins_7d: i32,
    pub most_common_score: i32,
    pub best_streak: i32,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct FocusSession {
    pub id: i64,
    pub duration_min: i32,
    pub actual_min: i32,
    pub xp: i32,
    pub completed: bool,
    pub timestamp: i64,
}

#[derive(Serialize)]
pub struct FocusStats {
    pub today_minutes: i32,
    pub today_sessions: i32,
    pub week_minutes: i32,
    pub week_sessions: i32,
    pub streak: i32,
}

// ── Init ──

impl AppDb {
    pub fn new(app_dir: &std::path::Path) -> Self {
        std::fs::create_dir_all(app_dir).ok();
        let db_path = app_dir.join("focuspal.db");
        let conn = Connection::open(db_path).expect("Failed to open SQLite database");

        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS mood_records (
                id        INTEGER PRIMARY KEY AUTOINCREMENT,
                score     INTEGER NOT NULL,
                timestamp INTEGER NOT NULL,
                tags      TEXT NOT NULL DEFAULT ''
            );
            CREATE INDEX IF NOT EXISTS idx_mood_ts ON mood_records(timestamp);

            CREATE TABLE IF NOT EXISTS app_config (
                key   TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS focus_sessions (
                id           INTEGER PRIMARY KEY AUTOINCREMENT,
                duration_min INTEGER NOT NULL,
                actual_min   INTEGER NOT NULL,
                xp           INTEGER NOT NULL,
                completed    INTEGER NOT NULL DEFAULT 0,
                timestamp    INTEGER NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_focus_ts ON focus_sessions(timestamp);

            CREATE TABLE IF NOT EXISTS growth_album (
                id        INTEGER PRIMARY KEY AUTOINCREMENT,
                event     TEXT NOT NULL,
                caption   TEXT NOT NULL DEFAULT '',
                timestamp INTEGER NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_album_ts ON growth_album(timestamp);

            CREATE TABLE IF NOT EXISTS reminder_responses (
                id           INTEGER PRIMARY KEY AUTOINCREMENT,
                reminder_type TEXT NOT NULL,
                response     TEXT NOT NULL,
                timestamp    INTEGER NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_reminder_ts ON reminder_responses(timestamp);

            CREATE TABLE IF NOT EXISTS activity_log (
                id        INTEGER PRIMARY KEY AUTOINCREMENT,
                activity  TEXT NOT NULL,
                caption   TEXT NOT NULL DEFAULT '',
                duration_sec INTEGER NOT NULL DEFAULT 0,
                timestamp INTEGER NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_activity_ts ON activity_log(timestamp);

            CREATE TABLE IF NOT EXISTS clipboard_history (
                id           INTEGER PRIMARY KEY AUTOINCREMENT,
                content_type TEXT NOT NULL DEFAULT 'text',
                content      TEXT NOT NULL,
                preview_text TEXT NOT NULL DEFAULT '',
                is_pinned    INTEGER NOT NULL DEFAULT 0,
                timestamp    INTEGER NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_clipboard_ts ON clipboard_history(timestamp);

            CREATE TABLE IF NOT EXISTS scene_log (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                app_name   TEXT NOT NULL,
                scene_type TEXT NOT NULL,
                duration_sec INTEGER NOT NULL DEFAULT 0,
                timestamp  INTEGER NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_scene_ts ON scene_log(timestamp);

            CREATE TABLE IF NOT EXISTS countdown_events (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                title      TEXT NOT NULL,
                emoji      TEXT NOT NULL DEFAULT '',
                date_ts    INTEGER NOT NULL,
                yearly     INTEGER NOT NULL DEFAULT 0,
                created_at INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS journal_entries (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                date_key        TEXT NOT NULL UNIQUE,
                content_md      TEXT NOT NULL DEFAULT '',
                mood_score      REAL NOT NULL DEFAULT 0,
                focus_hours     REAL NOT NULL DEFAULT 0,
                companion_level INTEGER NOT NULL DEFAULT 1,
                is_ai_generated INTEGER NOT NULL DEFAULT 0,
                timestamp       INTEGER NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_journal_date ON journal_entries(date_key);

            CREATE TABLE IF NOT EXISTS collectibles (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                category      TEXT NOT NULL,
                item_key      TEXT NOT NULL UNIQUE,
                name          TEXT NOT NULL,
                discovered_at INTEGER NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_collectible_key ON collectibles(item_key);

            CREATE TABLE IF NOT EXISTS achievements (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                ach_key     TEXT NOT NULL UNIQUE,
                name        TEXT NOT NULL,
                criteria    TEXT NOT NULL DEFAULT '',
                unlocked_at INTEGER NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_achievement_key ON achievements(ach_key);",
        )
        .expect("Failed to create tables");

        AppDb(Mutex::new(conn))
    }
}

// ── Config commands ──

#[tauri::command]
pub fn config_get(db: tauri::State<'_, AppDb>, key: String) -> Result<Option<String>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let result = conn.query_row(
        "SELECT value FROM app_config WHERE key = ?1",
        params![key],
        |row| row.get::<_, String>(0),
    );
    match result {
        Ok(v) => Ok(Some(v)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub fn config_set(db: tauri::State<'_, AppDb>, key: String, value: String) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO app_config (key, value) VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = ?2",
        params![key, value],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

// ── Mood commands ──

#[tauri::command]
pub fn insert_mood(db: tauri::State<'_, AppDb>, score: i32, tags: String) -> Result<i64, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let ts = now_ms();
    conn.execute(
        "INSERT INTO mood_records (score, timestamp, tags) VALUES (?1, ?2, ?3)",
        params![score, ts, tags],
    )
    .map_err(|e| e.to_string())?;
    Ok(conn.last_insert_rowid())
}

#[tauri::command]
pub fn query_moods(
    db: tauri::State<'_, AppDb>,
    from_ts: i64,
    to_ts: i64,
) -> Result<Vec<MoodRecord>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, score, timestamp, tags FROM mood_records WHERE timestamp >= ?1 AND timestamp <= ?2 ORDER BY timestamp ASC")
        .map_err(|e| e.to_string())?;
    let records = stmt
        .query_map(params![from_ts, to_ts], |row| {
            Ok(MoodRecord {
                id: row.get(0)?,
                score: row.get(1)?,
                timestamp: row.get(2)?,
                tags: row.get(3)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    Ok(records)
}

#[tauri::command]
pub fn get_mood_stats(db: tauri::State<'_, AppDb>) -> Result<MoodStats, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let now = now_ms();
    let day_ms: i64 = 86_400_000;
    let seven_days_ago = now - 7 * day_ms;
    let fourteen_days_ago = now - 14 * day_ms;

    let avg_7d: f64 = conn
        .query_row(
            "SELECT COALESCE(AVG(score), 3.0) FROM mood_records WHERE timestamp >= ?1",
            params![seven_days_ago],
            |row| row.get(0),
        )
        .unwrap_or(3.0);

    let avg_prev_7d: f64 = conn
        .query_row(
            "SELECT COALESCE(AVG(score), 3.0) FROM mood_records WHERE timestamp >= ?1 AND timestamp < ?2",
            params![fourteen_days_ago, seven_days_ago],
            |row| row.get(0),
        )
        .unwrap_or(3.0);

    let checkins_7d: i32 = conn
        .query_row(
            "SELECT COUNT(*) FROM mood_records WHERE timestamp >= ?1",
            params![seven_days_ago],
            |row| row.get(0),
        )
        .unwrap_or(0);

    let most_common_score: i32 = conn
        .query_row(
            "SELECT score FROM mood_records WHERE timestamp >= ?1 GROUP BY score ORDER BY COUNT(*) DESC LIMIT 1",
            params![seven_days_ago],
            |row| row.get(0),
        )
        .unwrap_or(3);

    // Best streak
    let mut stmt = conn
        .prepare(
            "SELECT CAST((timestamp / 86400000) AS INTEGER) as day, AVG(score) as avg_score
             FROM mood_records WHERE timestamp >= ?1
             GROUP BY day ORDER BY day ASC",
        )
        .map_err(|e| e.to_string())?;

    let daily_avgs: Vec<(i64, f64)> = stmt
        .query_map(params![now - 30 * day_ms], |row| {
            Ok((row.get::<_, i64>(0)?, row.get::<_, f64>(1)?))
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    let mut best_streak = 0i32;
    let mut current_streak = 0i32;
    let mut prev_day: Option<i64> = None;
    for (day, avg) in &daily_avgs {
        if *avg >= 4.0 {
            if prev_day.map_or(false, |p| *day == p + 1) {
                current_streak += 1;
            } else {
                current_streak = 1;
            }
            best_streak = best_streak.max(current_streak);
        } else {
            current_streak = 0;
        }
        prev_day = Some(*day);
    }

    Ok(MoodStats {
        avg_7d,
        avg_prev_7d,
        checkins_7d,
        most_common_score,
        best_streak,
    })
}

#[tauri::command]
pub fn export_moods(db: tauri::State<'_, AppDb>) -> Result<Vec<MoodRecord>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, score, timestamp, tags FROM mood_records ORDER BY timestamp ASC")
        .map_err(|e| e.to_string())?;
    let records = stmt
        .query_map([], |row| {
            Ok(MoodRecord {
                id: row.get(0)?,
                score: row.get(1)?,
                timestamp: row.get(2)?,
                tags: row.get(3)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    Ok(records)
}

// ── Focus commands ──

#[tauri::command]
pub fn insert_focus_session(
    db: tauri::State<'_, AppDb>,
    duration_min: i32,
    actual_min: i32,
    xp: i32,
    completed: bool,
) -> Result<i64, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let ts = now_ms();
    conn.execute(
        "INSERT INTO focus_sessions (duration_min, actual_min, xp, completed, timestamp) VALUES (?1, ?2, ?3, ?4, ?5)",
        params![duration_min, actual_min, xp, completed as i32, ts],
    )
    .map_err(|e| e.to_string())?;
    Ok(conn.last_insert_rowid())
}

#[tauri::command]
pub fn get_focus_stats(db: tauri::State<'_, AppDb>) -> Result<FocusStats, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let now = now_ms();
    let day_ms: i64 = 86_400_000;

    // Today start (UTC-based day boundary, good enough)
    let today_start = now - (now % day_ms);
    let week_start = now - 7 * day_ms;

    let today_minutes: i32 = conn
        .query_row(
            "SELECT COALESCE(SUM(actual_min), 0) FROM focus_sessions WHERE timestamp >= ?1",
            params![today_start],
            |row| row.get(0),
        )
        .unwrap_or(0);

    let today_sessions: i32 = conn
        .query_row(
            "SELECT COUNT(*) FROM focus_sessions WHERE timestamp >= ?1 AND completed = 1",
            params![today_start],
            |row| row.get(0),
        )
        .unwrap_or(0);

    let week_minutes: i32 = conn
        .query_row(
            "SELECT COALESCE(SUM(actual_min), 0) FROM focus_sessions WHERE timestamp >= ?1",
            params![week_start],
            |row| row.get(0),
        )
        .unwrap_or(0);

    let week_sessions: i32 = conn
        .query_row(
            "SELECT COUNT(*) FROM focus_sessions WHERE timestamp >= ?1 AND completed = 1",
            params![week_start],
            |row| row.get(0),
        )
        .unwrap_or(0);

    // Streak: consecutive days with at least one completed session
    let mut stmt = conn
        .prepare(
            "SELECT DISTINCT CAST((timestamp / 86400000) AS INTEGER) as day
             FROM focus_sessions WHERE completed = 1 AND timestamp >= ?1
             ORDER BY day DESC",
        )
        .map_err(|e| e.to_string())?;

    let days: Vec<i64> = stmt
        .query_map(params![now - 90 * day_ms], |row| row.get::<_, i64>(0))
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    let mut streak = 0i32;
    let today_day = now / day_ms;
    for (i, day) in days.iter().enumerate() {
        if *day == today_day - i as i64 {
            streak += 1;
        } else {
            break;
        }
    }

    Ok(FocusStats {
        today_minutes,
        today_sessions,
        week_minutes,
        week_sessions,
        streak,
    })
}

/// Return all focus sessions (for ML training)
#[tauri::command]
pub fn query_focus_sessions_all(db: tauri::State<'_, AppDb>) -> Result<Vec<FocusSession>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, duration_min, actual_min, xp, completed, timestamp FROM focus_sessions ORDER BY timestamp ASC")
        .map_err(|e| e.to_string())?;
    let entries = stmt
        .query_map([], |row| {
            Ok(FocusSession {
                id: row.get(0)?,
                duration_min: row.get(1)?,
                actual_min: row.get(2)?,
                xp: row.get(3)?,
                completed: row.get::<_, i32>(4)? != 0,
                timestamp: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    Ok(entries)
}

#[tauri::command]
pub fn get_last_mood_time(db: tauri::State<'_, AppDb>) -> Result<i64, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.query_row(
        "SELECT COALESCE(MAX(timestamp), 0) FROM mood_records",
        [],
        |row| row.get::<_, i64>(0),
    )
    .map_err(|e| e.to_string())
}

// ── Growth album commands ──

#[derive(Serialize, Deserialize, Clone)]
pub struct AlbumEntry {
    pub id: i64,
    pub event: String,
    pub caption: String,
    pub timestamp: i64,
}

#[tauri::command]
pub fn insert_album_entry(
    db: tauri::State<'_, AppDb>,
    event: String,
    caption: String,
) -> Result<i64, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let ts = now_ms();
    conn.execute(
        "INSERT INTO growth_album (event, caption, timestamp) VALUES (?1, ?2, ?3)",
        params![event, caption, ts],
    )
    .map_err(|e| e.to_string())?;
    Ok(conn.last_insert_rowid())
}

#[tauri::command]
pub fn query_album(db: tauri::State<'_, AppDb>) -> Result<Vec<AlbumEntry>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, event, caption, timestamp FROM growth_album ORDER BY timestamp DESC")
        .map_err(|e| e.to_string())?;
    let entries = stmt
        .query_map([], |row| {
            Ok(AlbumEntry {
                id: row.get(0)?,
                event: row.get(1)?,
                caption: row.get(2)?,
                timestamp: row.get(3)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    Ok(entries)
}

// ── XP commands ──

#[tauri::command]
pub fn get_total_xp(db: tauri::State<'_, AppDb>) -> Result<i64, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.query_row(
        "SELECT COALESCE(SUM(xp), 0) FROM focus_sessions",
        [],
        |row| row.get::<_, i64>(0),
    )
    .map_err(|e| e.to_string())
}

// ── Reminder commands ──

#[derive(Serialize, Deserialize, Clone)]
pub struct ReminderResponse {
    pub id: i64,
    pub reminder_type: String,
    pub response: String,
    pub timestamp: i64,
}

#[tauri::command]
pub fn insert_reminder_response(
    db: tauri::State<'_, AppDb>,
    reminder_type: String,
    response: String,
) -> Result<i64, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let ts = now_ms();
    conn.execute(
        "INSERT INTO reminder_responses (reminder_type, response, timestamp) VALUES (?1, ?2, ?3)",
        params![reminder_type, response, ts],
    )
    .map_err(|e| e.to_string())?;
    Ok(conn.last_insert_rowid())
}

#[tauri::command]
pub fn get_reminder_stats(
    db: tauri::State<'_, AppDb>,
    reminder_type: String,
) -> Result<Vec<ReminderResponse>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let week_ago = now_ms() - 7 * 86_400_000;
    let mut stmt = conn
        .prepare("SELECT id, reminder_type, response, timestamp FROM reminder_responses WHERE reminder_type = ?1 AND timestamp >= ?2 ORDER BY timestamp DESC")
        .map_err(|e| e.to_string())?;
    let entries = stmt
        .query_map(params![reminder_type, week_ago], |row| {
            Ok(ReminderResponse {
                id: row.get(0)?,
                reminder_type: row.get(1)?,
                response: row.get(2)?,
                timestamp: row.get(3)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    Ok(entries)
}

// ── Activity log commands ──

#[derive(Serialize, Deserialize, Clone)]
pub struct ActivityEntry {
    pub id: i64,
    pub activity: String,
    pub caption: String,
    pub duration_sec: i64,
    pub timestamp: i64,
}

#[tauri::command]
pub fn insert_activity(
    db: tauri::State<'_, AppDb>,
    activity: String,
    caption: String,
    duration_sec: i64,
) -> Result<i64, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let ts = now_ms();
    conn.execute(
        "INSERT INTO activity_log (activity, caption, duration_sec, timestamp) VALUES (?1, ?2, ?3, ?4)",
        params![activity, caption, duration_sec, ts],
    )
    .map_err(|e| e.to_string())?;
    Ok(conn.last_insert_rowid())
}

#[tauri::command]
pub fn query_activities(
    db: tauri::State<'_, AppDb>,
    limit: i64,
) -> Result<Vec<ActivityEntry>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, activity, caption, duration_sec, timestamp FROM activity_log ORDER BY timestamp DESC LIMIT ?1")
        .map_err(|e| e.to_string())?;
    let entries = stmt
        .query_map(params![limit], |row| {
            Ok(ActivityEntry {
                id: row.get(0)?,
                activity: row.get(1)?,
                caption: row.get(2)?,
                duration_sec: row.get(3)?,
                timestamp: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    Ok(entries)
}

// ── Clipboard history commands ──

#[derive(Serialize, Deserialize, Clone)]
pub struct ClipboardItem {
    pub id: i64,
    pub content_type: String,
    pub content: String,
    pub preview_text: String,
    pub is_pinned: bool,
    pub timestamp: i64,
}

#[tauri::command]
pub fn insert_clipboard_item(
    db: tauri::State<'_, AppDb>,
    content_type: String,
    content: String,
    preview_text: String,
) -> Result<i64, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let ts = now_ms();

    // Enforce 50-item limit: delete oldest non-pinned if at capacity
    let count: i64 = conn
        .query_row("SELECT COUNT(*) FROM clipboard_history", [], |row| row.get(0))
        .unwrap_or(0);
    if count >= 50 {
        conn.execute(
            "DELETE FROM clipboard_history WHERE id = (
                SELECT id FROM clipboard_history WHERE is_pinned = 0 ORDER BY timestamp ASC LIMIT 1
            )",
            [],
        )
        .ok();
    }

    conn.execute(
        "INSERT INTO clipboard_history (content_type, content, preview_text, timestamp) VALUES (?1, ?2, ?3, ?4)",
        params![content_type, content, preview_text, ts],
    )
    .map_err(|e| e.to_string())?;
    Ok(conn.last_insert_rowid())
}

#[tauri::command]
pub fn query_clipboard_history(
    db: tauri::State<'_, AppDb>,
) -> Result<Vec<ClipboardItem>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, content_type, content, preview_text, is_pinned, timestamp FROM clipboard_history ORDER BY is_pinned DESC, timestamp DESC LIMIT 50")
        .map_err(|e| e.to_string())?;
    let items = stmt
        .query_map([], |row| {
            Ok(ClipboardItem {
                id: row.get(0)?,
                content_type: row.get(1)?,
                content: row.get(2)?,
                preview_text: row.get(3)?,
                is_pinned: row.get::<_, i32>(4)? != 0,
                timestamp: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    Ok(items)
}

#[tauri::command]
pub fn toggle_clipboard_pin(
    db: tauri::State<'_, AppDb>,
    id: i64,
) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE clipboard_history SET is_pinned = CASE WHEN is_pinned = 0 THEN 1 ELSE 0 END WHERE id = ?1",
        params![id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn delete_clipboard_item(
    db: tauri::State<'_, AppDb>,
    id: i64,
) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM clipboard_history WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn clear_expired_clipboard(
    db: tauri::State<'_, AppDb>,
    max_age_ms: i64,
) -> Result<i64, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let cutoff = now_ms() - max_age_ms;
    let deleted = conn
        .execute(
            "DELETE FROM clipboard_history WHERE is_pinned = 0 AND timestamp < ?1",
            params![cutoff],
        )
        .map_err(|e| e.to_string())?;
    Ok(deleted as i64)
}

// ── Scene log commands ──

#[derive(Serialize, Deserialize, Clone)]
pub struct SceneLogEntry {
    pub id: i64,
    pub app_name: String,
    pub scene_type: String,
    pub duration_sec: i64,
    pub timestamp: i64,
}

#[tauri::command]
pub fn insert_scene_log(
    db: tauri::State<'_, AppDb>,
    app_name: String,
    scene_type: String,
    duration_sec: i64,
) -> Result<i64, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let ts = now_ms();
    conn.execute(
        "INSERT INTO scene_log (app_name, scene_type, duration_sec, timestamp) VALUES (?1, ?2, ?3, ?4)",
        params![app_name, scene_type, duration_sec, ts],
    )
    .map_err(|e| e.to_string())?;
    Ok(conn.last_insert_rowid())
}

#[tauri::command]
pub fn query_scene_log(
    db: tauri::State<'_, AppDb>,
    from_ts: i64,
    to_ts: i64,
) -> Result<Vec<SceneLogEntry>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, app_name, scene_type, duration_sec, timestamp FROM scene_log WHERE timestamp >= ?1 AND timestamp <= ?2 ORDER BY timestamp DESC LIMIT 500")
        .map_err(|e| e.to_string())?;
    let entries = stmt
        .query_map(params![from_ts, to_ts], |row| {
            Ok(SceneLogEntry {
                id: row.get(0)?,
                app_name: row.get(1)?,
                scene_type: row.get(2)?,
                duration_sec: row.get(3)?,
                timestamp: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    Ok(entries)
}

// ── Scene summary (aggregation for Desktop Archaeologist) ──

#[derive(Serialize, Deserialize, Clone)]
pub struct SceneSummaryEntry {
    pub hour: i32,
    pub app_name: String,
    pub scene_type: String,
    pub total_minutes: f64,
    pub frequency: i32,
    pub distinct_days: i32,
}

#[tauri::command]
pub fn query_scene_summary(
    db: tauri::State<'_, AppDb>,
    from_ts: i64,
    tz_offset_sec: i64,
) -> Result<Vec<SceneSummaryEntry>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let sql = format!(
        "SELECT
            CAST(((timestamp / 1000 + {tz}) % 86400) / 3600 AS INTEGER) as hour,
            app_name,
            scene_type,
            CAST(SUM(duration_sec) AS REAL) / 60.0 as total_minutes,
            COUNT(*) as frequency,
            COUNT(DISTINCT CAST((timestamp / 1000 + {tz}) / 86400 AS INTEGER)) as distinct_days
         FROM scene_log
         WHERE timestamp >= ?1
         GROUP BY hour, app_name, scene_type
         ORDER BY hour, total_minutes DESC",
        tz = tz_offset_sec,
    );
    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let entries = stmt
        .query_map(params![from_ts], |row| {
            Ok(SceneSummaryEntry {
                hour: row.get(0)?,
                app_name: row.get(1)?,
                scene_type: row.get(2)?,
                total_minutes: row.get(3)?,
                frequency: row.get(4)?,
                distinct_days: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    Ok(entries)
}

// ── Countdown events commands ──

#[derive(Serialize, Deserialize, Clone)]
pub struct CountdownEvent {
    pub id: i64,
    pub title: String,
    pub emoji: String,
    pub date_ts: i64,       // target date as ms timestamp (midnight of that date)
    pub yearly: bool,       // recur every year
    pub created_at: i64,
}

#[tauri::command]
pub fn insert_countdown_event(
    db: tauri::State<'_, AppDb>,
    title: String,
    emoji: String,
    date_ts: i64,
    yearly: bool,
) -> Result<i64, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let ts = now_ms();
    conn.execute(
        "INSERT INTO countdown_events (title, emoji, date_ts, yearly, created_at) VALUES (?1, ?2, ?3, ?4, ?5)",
        params![title, emoji, date_ts, yearly as i32, ts],
    )
    .map_err(|e| e.to_string())?;
    Ok(conn.last_insert_rowid())
}

#[tauri::command]
pub fn query_countdown_events(db: tauri::State<'_, AppDb>) -> Result<Vec<CountdownEvent>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, title, emoji, date_ts, yearly, created_at FROM countdown_events ORDER BY date_ts ASC")
        .map_err(|e| e.to_string())?;
    let entries = stmt
        .query_map([], |row| {
            Ok(CountdownEvent {
                id: row.get(0)?,
                title: row.get(1)?,
                emoji: row.get(2)?,
                date_ts: row.get(3)?,
                yearly: row.get::<_, i32>(4)? != 0,
                created_at: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    Ok(entries)
}

#[tauri::command]
pub fn delete_countdown_event(db: tauri::State<'_, AppDb>, id: i64) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM countdown_events WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

// ── Journal commands ──

#[derive(Serialize, Deserialize, Clone)]
pub struct JournalEntry {
    pub id: i64,
    pub date_key: String,
    pub content_md: String,
    pub mood_score: f64,
    pub focus_hours: f64,
    pub companion_level: i32,
    pub is_ai_generated: bool,
    pub timestamp: i64,
}

#[tauri::command]
pub fn upsert_journal_entry(
    db: tauri::State<'_, AppDb>,
    date_key: String,
    content_md: String,
    mood_score: f64,
    focus_hours: f64,
    companion_level: i32,
    is_ai_generated: bool,
) -> Result<i64, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let ts = now_ms();
    conn.execute(
        "INSERT INTO journal_entries (date_key, content_md, mood_score, focus_hours, companion_level, is_ai_generated, timestamp)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
         ON CONFLICT(date_key) DO UPDATE SET content_md = ?2, mood_score = ?3, focus_hours = ?4, companion_level = ?5, is_ai_generated = ?6, timestamp = ?7",
        params![date_key, content_md, mood_score, focus_hours, companion_level, is_ai_generated as i32, ts],
    )
    .map_err(|e| e.to_string())?;
    Ok(conn.last_insert_rowid())
}

#[tauri::command]
pub fn get_journal_entry(
    db: tauri::State<'_, AppDb>,
    date_key: String,
) -> Result<Option<JournalEntry>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let result = conn.query_row(
        "SELECT id, date_key, content_md, mood_score, focus_hours, companion_level, is_ai_generated, timestamp FROM journal_entries WHERE date_key = ?1",
        params![date_key],
        |row| {
            Ok(JournalEntry {
                id: row.get(0)?,
                date_key: row.get(1)?,
                content_md: row.get(2)?,
                mood_score: row.get(3)?,
                focus_hours: row.get(4)?,
                companion_level: row.get(5)?,
                is_ai_generated: row.get::<_, i32>(6)? != 0,
                timestamp: row.get(7)?,
            })
        },
    );
    match result {
        Ok(v) => Ok(Some(v)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub fn query_journal_dates(db: tauri::State<'_, AppDb>) -> Result<Vec<String>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT date_key FROM journal_entries WHERE content_md != '' ORDER BY date_key DESC")
        .map_err(|e| e.to_string())?;
    let dates = stmt
        .query_map([], |row| row.get::<_, String>(0))
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    Ok(dates)
}

#[tauri::command]
pub fn search_journal(
    db: tauri::State<'_, AppDb>,
    query: String,
) -> Result<Vec<JournalEntry>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let pattern = format!("%{}%", query);
    let mut stmt = conn
        .prepare("SELECT id, date_key, content_md, mood_score, focus_hours, companion_level, is_ai_generated, timestamp FROM journal_entries WHERE content_md LIKE ?1 ORDER BY date_key DESC LIMIT 50")
        .map_err(|e| e.to_string())?;
    let entries = stmt
        .query_map(params![pattern], |row| {
            Ok(JournalEntry {
                id: row.get(0)?,
                date_key: row.get(1)?,
                content_md: row.get(2)?,
                mood_score: row.get(3)?,
                focus_hours: row.get(4)?,
                companion_level: row.get(5)?,
                is_ai_generated: row.get::<_, i32>(6)? != 0,
                timestamp: row.get(7)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    Ok(entries)
}

#[tauri::command]
pub fn export_journal(db: tauri::State<'_, AppDb>) -> Result<String, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT date_key, content_md FROM journal_entries WHERE content_md != '' ORDER BY date_key ASC")
        .map_err(|e| e.to_string())?;
    let entries: Vec<(String, String)> = stmt
        .query_map([], |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)))
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    let mut md = String::from("# FocusPal Journal\n\n");
    for (date, content) in entries {
        md.push_str(&format!("## {}\n\n{}\n\n---\n\n", date, content));
    }
    Ok(md)
}

// ── Collectible commands ──

#[derive(Serialize, Deserialize, Clone)]
pub struct Collectible {
    pub id: i64,
    pub category: String,
    pub item_key: String,
    pub name: String,
    pub discovered_at: i64,
}

#[tauri::command]
pub fn discover_collectible(
    db: tauri::State<'_, AppDb>,
    category: String,
    item_key: String,
    name: String,
) -> Result<bool, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    // Check if already discovered
    let exists: bool = conn
        .query_row(
            "SELECT COUNT(*) FROM collectibles WHERE item_key = ?1",
            params![item_key],
            |row| row.get::<_, i32>(0).map(|c| c > 0),
        )
        .unwrap_or(false);
    if exists {
        return Ok(false);
    }
    let ts = now_ms();
    conn.execute(
        "INSERT INTO collectibles (category, item_key, name, discovered_at) VALUES (?1, ?2, ?3, ?4)",
        params![category, item_key, name, ts],
    )
    .map_err(|e| e.to_string())?;
    Ok(true) // newly discovered
}

#[tauri::command]
pub fn query_collectibles(db: tauri::State<'_, AppDb>) -> Result<Vec<Collectible>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, category, item_key, name, discovered_at FROM collectibles ORDER BY discovered_at DESC")
        .map_err(|e| e.to_string())?;
    let items = stmt
        .query_map([], |row| {
            Ok(Collectible {
                id: row.get(0)?,
                category: row.get(1)?,
                item_key: row.get(2)?,
                name: row.get(3)?,
                discovered_at: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    Ok(items)
}

// ── Achievement commands ──

#[derive(Serialize, Deserialize, Clone)]
pub struct Achievement {
    pub id: i64,
    pub ach_key: String,
    pub name: String,
    pub criteria: String,
    pub unlocked_at: i64,
}

#[tauri::command]
pub fn unlock_achievement(
    db: tauri::State<'_, AppDb>,
    ach_key: String,
    name: String,
    criteria: String,
) -> Result<bool, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let exists: bool = conn
        .query_row(
            "SELECT COUNT(*) FROM achievements WHERE ach_key = ?1",
            params![ach_key],
            |row| row.get::<_, i32>(0).map(|c| c > 0),
        )
        .unwrap_or(false);
    if exists {
        return Ok(false);
    }
    let ts = now_ms();
    conn.execute(
        "INSERT INTO achievements (ach_key, name, criteria, unlocked_at) VALUES (?1, ?2, ?3, ?4)",
        params![ach_key, name, criteria, ts],
    )
    .map_err(|e| e.to_string())?;
    Ok(true)
}

#[tauri::command]
pub fn query_achievements(db: tauri::State<'_, AppDb>) -> Result<Vec<Achievement>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, ach_key, name, criteria, unlocked_at FROM achievements ORDER BY unlocked_at DESC")
        .map_err(|e| e.to_string())?;
    let items = stmt
        .query_map([], |row| {
            Ok(Achievement {
                id: row.get(0)?,
                ach_key: row.get(1)?,
                name: row.get(2)?,
                criteria: row.get(3)?,
                unlocked_at: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    Ok(items)
}

// ── Analytics helper commands ──

#[derive(Serialize, Clone)]
pub struct DailyFocusSummary {
    pub date_key: String,
    pub total_minutes: i32,
    pub sessions: i32,
    pub completed: i32,
}

#[tauri::command]
pub fn query_focus_daily(
    db: tauri::State<'_, AppDb>,
    from_ts: i64,
    to_ts: i64,
) -> Result<Vec<DailyFocusSummary>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT
                date(timestamp / 1000, 'unixepoch', 'localtime') as date_key,
                COALESCE(SUM(actual_min), 0) as total_minutes,
                COUNT(*) as sessions,
                SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) as completed
             FROM focus_sessions
             WHERE timestamp >= ?1 AND timestamp <= ?2
             GROUP BY date_key
             ORDER BY date_key ASC",
        )
        .map_err(|e| e.to_string())?;
    let entries = stmt
        .query_map(params![from_ts, to_ts], |row| {
            Ok(DailyFocusSummary {
                date_key: row.get(0)?,
                total_minutes: row.get(1)?,
                sessions: row.get(2)?,
                completed: row.get(3)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    Ok(entries)
}

#[derive(Serialize, Clone)]
pub struct DailyMoodSummary {
    pub date_key: String,
    pub avg_score: f64,
    pub count: i32,
}

#[tauri::command]
pub fn query_mood_daily(
    db: tauri::State<'_, AppDb>,
    from_ts: i64,
    to_ts: i64,
) -> Result<Vec<DailyMoodSummary>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT
                date(timestamp / 1000, 'unixepoch', 'localtime') as date_key,
                AVG(score) as avg_score,
                COUNT(*) as count
             FROM mood_records
             WHERE timestamp >= ?1 AND timestamp <= ?2
             GROUP BY date_key
             ORDER BY date_key ASC",
        )
        .map_err(|e| e.to_string())?;
    let entries = stmt
        .query_map(params![from_ts, to_ts], |row| {
            Ok(DailyMoodSummary {
                date_key: row.get(0)?,
                avg_score: row.get(1)?,
                count: row.get(2)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    Ok(entries)
}

fn now_ms() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis() as i64
}
