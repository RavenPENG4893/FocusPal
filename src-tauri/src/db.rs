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
            CREATE INDEX IF NOT EXISTS idx_activity_ts ON activity_log(timestamp);",
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

fn now_ms() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis() as i64
}
