use chrono::{DateTime, Utc};
use log::{info, warn};
use serde::Serialize;
use sqlx::SqlitePool;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, Manager, Runtime};
use tokio::sync::Notify;
use tokio_util::sync::CancellationToken;

use super::prompt::{self, ModelOutput, PromptContext, Suggestion};
use super::settings::{self, AssistantSettings};
use crate::audio::recording_commands::{live_transcript_progress, live_transcript_snapshot, LiveTranscriptSnapshot};
use crate::audio::recording_saver::TranscriptSegment;
use crate::database::repositories::setting::SettingsRepository;
use crate::state::AppState;
use crate::summary::language_detection::detect_summary_language;
use crate::summary::llm_client::{complete, CompletionOptions, LLMProvider};
use crate::summary::processor::{language_name_from_code, rough_token_count};
use crate::summary::service::{resolve_provider_settings, ProviderSettings, METADATA_CACHE};
use crate::summary::summary_engine::client::is_sidecar_busy;

const LOOP_INTERVAL: Duration = Duration::from_secs(1);
const MIN_NEW_WORDS: usize = 120;
const SLOW_TICK_AFTER: Duration = Duration::from_secs(90);
const SLOW_TICK_MIN_WORDS: usize = 30;
const SPEECH_GAP: Duration = Duration::from_millis(2500);
const MAX_GAP_WAIT: Duration = Duration::from_secs(10);
const FLOOR_CLOUD: Duration = Duration::from_secs(45);
const FLOOR_BUILTIN: Duration = Duration::from_secs(90);
const MANUAL_DEBOUNCE: Duration = Duration::from_secs(5);
const MAX_CONSECUTIVE_FAILURES: u32 = 3;
const OUTPUT_TOKENS: u32 = 400;
const BUILTIN_INPUT_TOKENS: usize = 2000;
const CLOUD_INPUT_TOKENS: usize = 8000;
const OLLAMA_HEADROOM_TOKENS: usize = 800;
const OLLAMA_FALLBACK_CONTEXT: usize = 4096;
const MAX_ERROR_CHARS: usize = 160;
const HTTP_TICK_TIMEOUT: Duration = Duration::from_secs(120);
const SNAPSHOT_FILE: &str = "suggestions.json";

static PROVIDER_STATUS: std::sync::LazyLock<regex::Regex> =
    std::sync::LazyLock::new(|| regex::Regex::new(r"failed with status (\d{3}[^:]*)").unwrap());

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum AssistantStatus {
    Idle,
    Waiting,
    Generating,
    Paused,
    Error,
}

#[derive(Debug, Clone, Serialize)]
pub struct LiveAssistantState {
    pub active: bool,
    pub status: AssistantStatus,
    pub goal: String,
    pub provider: String,
    pub model: String,
    pub is_cloud: bool,
    pub last_tick_at: Option<String>,
    pub error: Option<String>,
    pub tick_no: u32,
    pub state: String,
    pub suggestions: Vec<Suggestion>,
}

pub struct TriggerInput {
    pub manual: bool,
    pub pending: bool,
    pub paused: bool,
    pub new_words: usize,
    pub has_ticked: bool,
    pub since_last_tick: Duration,
    pub since_last_segment: Duration,
    pub waited_since_due: Option<Duration>,
    pub floor: Duration,
}

pub fn content_due(input: &TriggerInput) -> bool {
    input.new_words >= MIN_NEW_WORDS
        || (input.since_last_tick >= SLOW_TICK_AFTER && input.new_words >= SLOW_TICK_MIN_WORDS)
}

pub fn tick_due(input: &TriggerInput) -> bool {
    if input.manual {
        return true;
    }
    if input.paused {
        return false;
    }
    if !(input.pending || content_due(input)) {
        return false;
    }
    if input.has_ticked && input.since_last_tick < input.floor {
        return false;
    }
    input.since_last_segment >= SPEECH_GAP
        || input.waited_since_due.is_some_and(|waited| waited >= MAX_GAP_WAIT)
}

pub fn tick_floor(builtin: bool, last_duration: Duration, failures: u32) -> Duration {
    let base = if builtin { FLOOR_BUILTIN } else { FLOOR_CLOUD };
    let floor = base.max(last_duration * 2);
    floor * 2u32.pow(failures.min(2))
}

struct SessionData {
    goal: String,
    state_text: String,
    suggestions: Vec<Suggestion>,
    next_id: u64,
    tick_no: u32,
    status: AssistantStatus,
    paused: bool,
    manual_requested: bool,
    pending: bool,
    failures: u32,
    error: Option<String>,
    provider: String,
    model: String,
    is_cloud: bool,
    builtin: bool,
    started_at: Instant,
    last_tick_started: Option<Instant>,
    last_tick_at: Option<DateTime<Utc>>,
    last_duration: Duration,
    last_tick_seq: Option<u64>,
    last_seen_seq: Option<u64>,
    last_seen_change: Instant,
    due_since: Option<Instant>,
    last_manual: Option<Instant>,
    meeting_folder: Option<PathBuf>,
    inflight: Option<CancellationToken>,
}

impl SessionData {
    fn new(goal: String) -> Self {
        let now = Instant::now();
        Self {
            goal,
            state_text: String::new(),
            suggestions: Vec::new(),
            next_id: 0,
            tick_no: 0,
            status: AssistantStatus::Waiting,
            paused: false,
            manual_requested: false,
            pending: false,
            failures: 0,
            error: None,
            provider: String::new(),
            model: String::new(),
            is_cloud: false,
            builtin: false,
            started_at: now,
            last_tick_started: None,
            last_tick_at: None,
            last_duration: Duration::ZERO,
            last_tick_seq: None,
            last_seen_seq: None,
            last_seen_change: now,
            due_since: None,
            last_manual: None,
            meeting_folder: None,
            inflight: None,
        }
    }

    fn settle_status(&mut self) {
        self.status = if self.paused { AssistantStatus::Paused } else { AssistantStatus::Waiting };
    }

    fn snapshot(&self, active: bool) -> LiveAssistantState {
        LiveAssistantState {
            active,
            status: self.status,
            goal: self.goal.clone(),
            provider: self.provider.clone(),
            model: self.model.clone(),
            is_cloud: self.is_cloud,
            last_tick_at: self.last_tick_at.map(|t| t.to_rfc3339()),
            error: self.error.clone(),
            tick_no: self.tick_no,
            state: self.state_text.clone(),
            suggestions: self.suggestions.clone(),
        }
    }
}

struct Session {
    data: Arc<Mutex<SessionData>>,
    token: CancellationToken,
    notify: Arc<Notify>,
}

#[derive(Default)]
struct AssistantInner {
    session: Option<Session>,
    last_suggestions: Vec<Suggestion>,
    last_goal: String,
}

#[derive(Default)]
pub struct AssistantState {
    inner: Mutex<AssistantInner>,
}

fn lock_data(data: &Arc<Mutex<SessionData>>) -> std::sync::MutexGuard<'_, SessionData> {
    data.lock().unwrap_or_else(|poisoned| poisoned.into_inner())
}

fn lock_inner(state: &AssistantState) -> std::sync::MutexGuard<'_, AssistantInner> {
    state.inner.lock().unwrap_or_else(|poisoned| poisoned.into_inner())
}

fn with_session<R: Runtime, T>(
    app: &AppHandle<R>,
    f: impl FnOnce(&Session) -> T,
) -> Option<T> {
    let state = app.try_state::<AssistantState>()?;
    let inner = lock_inner(&state);
    inner.session.as_ref().map(f)
}

fn emit_status<R: Runtime>(app: &AppHandle<R>, data: &SessionData, active: bool) {
    let _ = app.emit("assistant-status", data.snapshot(active));
}

pub fn start<R: Runtime>(app: &AppHandle<R>, goal: Option<String>) -> Result<(), String> {
    let state = app
        .try_state::<AssistantState>()
        .ok_or_else(|| "Live assistant state is not initialised".to_string())?;
    let mut inner = lock_inner(&state);
    if inner.session.is_some() {
        return Ok(());
    }
    let mut settings = settings::load(app);
    let goal = goal.unwrap_or_else(|| settings.last_goal.clone());
    if settings.last_goal != goal {
        settings.last_goal = goal.clone();
        let _ = settings::save(app, &settings);
    }
    let data = Arc::new(Mutex::new(SessionData::new(goal)));
    let token = CancellationToken::new();
    let notify = Arc::new(Notify::new());
    let session = Session { data: data.clone(), token: token.clone(), notify: notify.clone() };
    inner.session = Some(session);
    drop(inner);

    emit_status(app, &lock_data(&data), true);
    let app_for_loop = app.clone();
    tauri::async_runtime::spawn(async move {
        run_loop(app_for_loop, data, token, notify).await;
    });
    info!("Live assistant session started");
    Ok(())
}

pub fn on_recording_started<R: Runtime>(app: &AppHandle<R>) {
    if let Some(state) = app.try_state::<AssistantState>() {
        let mut inner = lock_inner(&state);
        inner.last_suggestions.clear();
    }
    let settings = settings::load(app);
    if !settings.enabled {
        return;
    }
    if let Err(error) = start(app, None) {
        warn!("Live assistant autostart failed: {}", error);
    }
}

pub fn stop<R: Runtime>(app: &AppHandle<R>) {
    close_session(app, None);
}

fn close_session<R: Runtime>(app: &AppHandle<R>, only: Option<&Arc<Mutex<SessionData>>>) {
    let Some(state) = app.try_state::<AssistantState>() else {
        return;
    };
    let mut inner = lock_inner(&state);
    if let (Some(session), Some(data)) = (inner.session.as_ref(), only) {
        if !Arc::ptr_eq(&session.data, data) {
            return;
        }
    }
    let Some(session) = inner.session.take() else {
        return;
    };
    session.token.cancel();
    session.notify.notify_one();
    let mut data = lock_data(&session.data);
    data.status = AssistantStatus::Idle;
    inner.last_suggestions = data.suggestions.clone();
    inner.last_goal = data.goal.clone();
    emit_status(app, &data, false);
    info!("Live assistant session stopped after {} ticks", data.tick_no);
}

pub fn refresh<R: Runtime>(app: &AppHandle<R>) -> Result<(), String> {
    with_session(app, |session| {
        let mut data = lock_data(&session.data);
        let now = Instant::now();
        if data.last_manual.is_some_and(|last| now.duration_since(last) < MANUAL_DEBOUNCE) {
            return;
        }
        data.last_manual = Some(now);
        data.manual_requested = true;
        session.notify.notify_one();
    })
    .ok_or_else(|| "Live assistant is not running".to_string())
}

pub fn set_paused<R: Runtime>(app: &AppHandle<R>, paused: bool) -> Result<(), String> {
    with_session(app, |session| {
        let mut data = lock_data(&session.data);
        data.paused = paused;
        if paused {
            data.status = AssistantStatus::Paused;
            if let Some(inflight) = data.inflight.take() {
                inflight.cancel();
            }
        } else {
            data.failures = 0;
            data.error = None;
            data.status = AssistantStatus::Waiting;
        }
        emit_status(app, &data, true);
    })
    .ok_or_else(|| "Live assistant is not running".to_string())
}

pub fn set_goal<R: Runtime>(app: &AppHandle<R>, goal: String) -> Result<(), String> {
    let mut settings = settings::load(app);
    settings.last_goal = goal.clone();
    settings::save(app, &settings)?;
    if with_session(app, |session| {
        let mut data = lock_data(&session.data);
        data.goal = goal.clone();
        emit_status(app, &data, true);
    })
    .is_none()
    {
        if let Some(state) = app.try_state::<AssistantState>() {
            lock_inner(&state).last_goal = goal;
        }
    }
    Ok(())
}

pub fn update_suggestion<R: Runtime>(
    app: &AppHandle<R>,
    id: &str,
    pinned: Option<bool>,
    dismissed: Option<bool>,
) -> Result<(), String> {
    with_session(app, |session| {
        let mut data = lock_data(&session.data);
        let item = data
            .suggestions
            .iter_mut()
            .find(|s| s.id == id)
            .ok_or_else(|| format!("Unknown suggestion {}", id))?;
        if let Some(pinned) = pinned {
            item.pinned = pinned;
            if pinned {
                item.dismissed = false;
            }
        }
        if let Some(dismissed) = dismissed {
            item.dismissed = dismissed;
            if dismissed {
                item.pinned = false;
            }
        }
        emit_status(app, &data, true);
        if let Some(folder) = data.meeting_folder.clone() {
            persist_snapshot(&folder, &data);
        }
        Ok(())
    })
    .unwrap_or_else(|| Err("Live assistant is not running".to_string()))
}

pub fn snapshot<R: Runtime>(app: &AppHandle<R>) -> LiveAssistantState {
    if let Some(state) = with_session(app, |session| lock_data(&session.data).snapshot(true)) {
        return state;
    }
    let (suggestions, goal) = app
        .try_state::<AssistantState>()
        .map(|state| {
            let inner = lock_inner(&state);
            (inner.last_suggestions.clone(), inner.last_goal.clone())
        })
        .unwrap_or_default();
    LiveAssistantState {
        active: false,
        status: AssistantStatus::Idle,
        goal,
        provider: String::new(),
        model: String::new(),
        is_cloud: false,
        last_tick_at: None,
        error: None,
        tick_no: 0,
        state: String::new(),
        suggestions,
    }
}

fn db_pool<R: Runtime>(app: &AppHandle<R>) -> Result<SqlitePool, String> {
    app.try_state::<AppState>()
        .map(|state| state.db_manager.pool().clone())
        .ok_or_else(|| "Database is not ready yet".to_string())
}

async fn resolve_target<R: Runtime>(
    app: &AppHandle<R>,
    settings: &AssistantSettings,
) -> Result<(String, String), String> {
    if let Some(provider) = settings.provider.as_deref().filter(|p| !p.trim().is_empty()) {
        return match settings.model.as_deref().filter(|m| !m.trim().is_empty()) {
            Some(model) => Ok((provider.to_string(), model.to_string())),
            None => Err("Pick a model for the live assistant in Settings".to_string()),
        };
    }
    let pool = db_pool(app)?;
    match SettingsRepository::get_model_config(&pool).await {
        Ok(Some(config)) => Ok((config.provider, config.model)),
        Ok(None) => Err("No summary model is configured".to_string()),
        Err(error) => Err(error.to_string()),
    }
}

pub fn is_local_endpoint(endpoint: &str) -> bool {
    let Ok(parsed) = url::Url::parse(endpoint.trim()) else {
        return false;
    };
    match parsed.host_str() {
        Some(host) => {
            let host = host.trim_matches(|c| c == '[' || c == ']').to_ascii_lowercase();
            host == "localhost"
                || host == "127.0.0.1"
                || host == "::1"
                || host == "0.0.0.0"
                || host.ends_with(".localhost")
        }
        None => false,
    }
}

pub fn is_cloud(provider: &LLMProvider, ollama_endpoint: Option<&str>) -> bool {
    match provider {
        LLMProvider::BuiltInAI => false,
        LLMProvider::Ollama => !is_local_endpoint(ollama_endpoint.unwrap_or("http://localhost:11434")),
        _ => true,
    }
}

async fn input_budget(settings: &ProviderSettings, model: &str) -> usize {
    match settings.provider {
        LLMProvider::BuiltInAI => BUILTIN_INPUT_TOKENS,
        LLMProvider::Ollama => {
            let context = METADATA_CACHE
                .get_or_fetch(model, settings.ollama_endpoint.as_deref())
                .await
                .map(|metadata| metadata.context_size)
                .unwrap_or(OLLAMA_FALLBACK_CONTEXT);
            context
                .saturating_sub(OLLAMA_HEADROOM_TOKENS)
                .clamp(512, CLOUD_INPUT_TOKENS)
        }
        _ => CLOUD_INPUT_TOKENS,
    }
}

fn language_name(window: &[TranscriptSegment]) -> String {
    let texts: Vec<String> = window.iter().map(|s| s.text.clone()).collect();
    detect_summary_language(&texts)
        .language
        .as_deref()
        .and_then(language_name_from_code)
        .map(str::to_string)
        .unwrap_or_else(|| "the transcript's language".to_string())
}

fn short_error(error: &str) -> String {
    if let Some(captures) = PROVIDER_STATUS.captures(error) {
        return format!("Provider returned {}", captures[1].trim());
    }
    let single_line: String = error.split_whitespace().collect::<Vec<_>>().join(" ");
    single_line.chars().take(MAX_ERROR_CHARS).collect()
}

fn persist_snapshot(folder: &Path, data: &SessionData) {
    let payload = serde_json::json!({
        "goal": data.goal,
        "state": data.state_text,
        "suggestions": data.suggestions,
        "updated_at": Utc::now().to_rfc3339(),
    });
    let Ok(serialized) = serde_json::to_string_pretty(&payload) else {
        return;
    };
    let final_path = folder.join(SNAPSHOT_FILE);
    let temp_path = folder.join(format!(".{}.tmp", SNAPSHOT_FILE));
    if std::fs::write(&temp_path, serialized).is_ok() {
        if let Err(error) = std::fs::rename(&temp_path, &final_path) {
            warn!("Failed to persist live assistant snapshot: {}", error);
        }
    }
}

pub fn read_snapshot(folder: &Path) -> Option<Vec<Suggestion>> {
    let raw = std::fs::read_to_string(folder.join(SNAPSHOT_FILE)).ok()?;
    let value: serde_json::Value = serde_json::from_str(&raw).ok()?;
    serde_json::from_value(value.get("suggestions")?.clone()).ok()
}

struct TickPlan {
    provider_settings: ProviderSettings,
    provider_label: String,
    model: String,
}

async fn plan_tick<R: Runtime>(app: &AppHandle<R>, data: &Arc<Mutex<SessionData>>) -> Result<TickPlan, String> {
    let settings = settings::load(app);
    let (provider_label, model) = resolve_target(app, &settings).await?;
    let pool = db_pool(app)?;
    let provider_settings = resolve_provider_settings(&pool, &provider_label).await?;
    let cloud = is_cloud(&provider_settings.provider, provider_settings.ollama_endpoint.as_deref());
    {
        let mut guard = lock_data(data);
        guard.provider = provider_label.clone();
        guard.model = model.clone();
        guard.is_cloud = cloud;
        guard.builtin = provider_settings.provider == LLMProvider::BuiltInAI;
    }
    if cloud && !settings.has_cloud_consent(&provider_label) {
        return Err(format!(
            "Confirm sending the live transcript to {} in the assistant settings first",
            provider_label
        ));
    }
    Ok(TickPlan { provider_settings, provider_label, model })
}

async fn run_tick<R: Runtime>(
    app: &AppHandle<R>,
    client: &reqwest::Client,
    data: &Arc<Mutex<SessionData>>,
    plan: &TickPlan,
    snapshot: &LiveTranscriptSnapshot,
    token: &CancellationToken,
) -> Result<(ModelOutput, Option<u64>), String> {
    let segments = &snapshot.segments;
    if segments.is_empty() {
        return Err("No transcript yet".to_string());
    }
    let budget = input_budget(&plan.provider_settings, &plan.model).await;
    let language = language_name(prompt::select_window(segments, budget));
    let prefix = {
        let guard = lock_data(data);
        let dismissed: Vec<String> = guard
            .suggestions
            .iter()
            .filter(|s| s.dismissed)
            .map(|s| s.text.clone())
            .collect();
        prompt::build_prefix(&PromptContext {
            title: snapshot.meeting_name.as_deref().unwrap_or(""),
            goal: &guard.goal,
            language_name: &language,
            state: &guard.state_text,
            open: &guard.suggestions,
            dismissed_texts: &dismissed,
        })
    };
    let window_budget = budget.saturating_sub(rough_token_count(&prefix)).max(200);
    let window = prompt::select_window(segments, window_budget);
    let user_prompt = prompt::build_user_prompt(prefix, window);
    let through_seq = window.last().map(|s| s.sequence_id);

    let settings = &plan.provider_settings;
    let app_data_dir = app.path().app_data_dir().ok();
    let completion = complete(
        client,
        &settings.provider,
        &plan.model,
        &settings.api_key,
        prompt::SYSTEM_PROMPT,
        &user_prompt,
        settings.ollama_endpoint.as_deref(),
        settings.custom_openai_endpoint.as_deref(),
        settings.custom_max_tokens,
        settings.custom_temperature,
        settings.custom_top_p,
        app_data_dir.as_ref(),
        Some(token),
        CompletionOptions { json_mode: true, max_tokens: Some(OUTPUT_TOKENS) },
    )
    .await?;

    Ok((prompt::parse_model_output(&completion.content)?, through_seq))
}

fn defer_for_busy_sidecar<R: Runtime>(app: &AppHandle<R>, data: &Arc<Mutex<SessionData>>) {
    let mut guard = lock_data(data);
    if guard.pending && guard.status == AssistantStatus::Waiting {
        return;
    }
    guard.pending = true;
    guard.status = AssistantStatus::Waiting;
    emit_status(app, &guard, true);
}

async fn run_loop<R: Runtime>(
    app: AppHandle<R>,
    data: Arc<Mutex<SessionData>>,
    token: CancellationToken,
    notify: Arc<Notify>,
) {
    let client = reqwest::Client::new();
    let _ = plan_tick(&app, &data).await;
    emit_status(&app, &lock_data(&data), true);
    loop {
        tokio::select! {
            _ = token.cancelled() => break,
            _ = tokio::time::sleep(LOOP_INTERVAL) => {},
            _ = notify.notified() => {},
        }
        if token.is_cancelled() {
            break;
        }
        let last_tick_seq = lock_data(&data).last_tick_seq;
        let Some(progress) = live_transcript_progress(last_tick_seq) else {
            info!("Live assistant loop ending: no active recording");
            break;
        };

        let (due, manual) = {
            let mut guard = lock_data(&data);
            let now = Instant::now();
            guard.meeting_folder = progress.meeting_folder;
            if progress.newest_seq != guard.last_seen_seq {
                guard.last_seen_seq = progress.newest_seq;
                guard.last_seen_change = now;
            }
            let since_last_tick = guard
                .last_tick_started
                .map(|started| now.duration_since(started))
                .unwrap_or_else(|| now.duration_since(guard.started_at));
            let floor = tick_floor(guard.builtin, guard.last_duration, guard.failures);
            let manual = guard.manual_requested;
            let input = TriggerInput {
                manual,
                pending: guard.pending,
                paused: guard.paused || progress.is_paused,
                new_words: progress.new_words,
                has_ticked: guard.last_tick_started.is_some(),
                since_last_tick,
                since_last_segment: now.duration_since(guard.last_seen_change),
                waited_since_due: guard.due_since.map(|since| now.duration_since(since)),
                floor,
            };
            if content_due(&input) || input.pending {
                if guard.due_since.is_none() {
                    guard.due_since = Some(now);
                }
            } else {
                guard.due_since = None;
            }
            let due = tick_due(&input);
            if due {
                guard.manual_requested = false;
                guard.due_since = None;
            }
            (due, manual)
        };
        if !due {
            continue;
        }

        let plan = match plan_tick(&app, &data).await {
            Ok(plan) => plan,
            Err(error) => {
                let mut guard = lock_data(&data);
                guard.status = AssistantStatus::Error;
                guard.paused = true;
                guard.error = Some(short_error(&error));
                guard.pending = false;
                emit_status(&app, &guard, true);
                let _ = app.emit("assistant-error", serde_json::json!({ "message": guard.error }));
                continue;
            }
        };

        let builtin = plan.provider_settings.provider == LLMProvider::BuiltInAI;
        if builtin && is_sidecar_busy().await {
            defer_for_busy_sidecar(&app, &data);
            continue;
        }

        let Some(snapshot) = live_transcript_snapshot() else {
            info!("Live assistant loop ending: no active recording");
            break;
        };

        let started = Instant::now();
        let tick_token = token.child_token();
        {
            let mut guard = lock_data(&data);
            if guard.paused && !manual {
                continue;
            }
            guard.pending = false;
            guard.status = AssistantStatus::Generating;
            guard.last_tick_started = Some(started);
            guard.inflight = Some(tick_token.clone());
            emit_status(&app, &guard, true);
        }
        info!(
            "Live assistant tick via {}/{} ({} segments, manual={})",
            plan.provider_label,
            plan.model,
            snapshot.segments.len(),
            manual
        );

        let tick = run_tick(&app, &client, &data, &plan, &snapshot, &tick_token);
        let result = if builtin {
            tick.await
        } else {
            tokio::time::timeout(HTTP_TICK_TIMEOUT, tick)
                .await
                .unwrap_or_else(|_| Err("Provider did not answer within two minutes".to_string()))
        };
        if token.is_cancelled() {
            break;
        }
        let mut guard = lock_data(&data);
        guard.inflight = None;
        guard.last_duration = started.elapsed();
        if tick_token.is_cancelled() {
            guard.settle_status();
            emit_status(&app, &guard, true);
            continue;
        }
        match result {
            Ok((output, through_seq)) => {
                let outcome = prompt::reconcile(guard.suggestions.clone(), output, &snapshot.segments, guard.next_id);
                guard.tick_no += 1;
                guard.suggestions = outcome.open;
                if !outcome.state.trim().is_empty() {
                    guard.state_text = outcome.state;
                }
                guard.next_id = outcome.next_id;
                guard.last_tick_seq = through_seq;
                guard.last_tick_at = Some(Utc::now());
                guard.failures = 0;
                guard.error = None;
                guard.settle_status();
                info!(
                    "Live assistant tick {} done in {:?}: {} added, {} uncited dropped, {} open",
                    guard.tick_no,
                    guard.last_duration,
                    outcome.added,
                    outcome.dropped_uncited,
                    guard.suggestions.iter().filter(|s| !s.dismissed).count()
                );
                emit_status(&app, &guard, true);
                if let Some(folder) = guard.meeting_folder.clone() {
                    persist_snapshot(&folder, &guard);
                }
            }
            Err(error) => {
                guard.failures += 1;
                guard.error = Some(short_error(&error));
                warn!(
                    "Live assistant tick failed ({} consecutive): {}",
                    guard.failures,
                    guard.error.as_deref().unwrap_or("")
                );
                if guard.failures >= MAX_CONSECUTIVE_FAILURES {
                    guard.paused = true;
                    guard.status = AssistantStatus::Error;
                    let _ = app.emit("assistant-error", serde_json::json!({ "message": guard.error }));
                } else {
                    guard.settle_status();
                }
                emit_status(&app, &guard, true);
            }
        }
    }
    close_session(&app, Some(&data));
}

#[cfg(test)]
mod tests {
    use super::*;

    fn input() -> TriggerInput {
        TriggerInput {
            manual: false,
            pending: false,
            paused: false,
            new_words: 0,
            has_ticked: true,
            since_last_tick: Duration::from_secs(60),
            since_last_segment: Duration::from_secs(3),
            waited_since_due: None,
            floor: FLOOR_CLOUD,
        }
    }

    #[test]
    fn manual_refresh_always_fires() {
        let mut i = input();
        i.manual = true;
        i.paused = true;
        assert!(tick_due(&i));
    }

    #[test]
    fn paused_never_fires_without_manual() {
        let mut i = input();
        i.paused = true;
        i.new_words = 500;
        assert!(!tick_due(&i));
    }

    #[test]
    fn needs_enough_new_words_or_slow_tick() {
        let mut i = input();
        i.new_words = 50;
        assert!(!tick_due(&i));
        i.new_words = 120;
        assert!(tick_due(&i));
        i.new_words = 30;
        i.since_last_tick = Duration::from_secs(95);
        assert!(tick_due(&i));
    }

    #[test]
    fn respects_floor_only_after_first_tick() {
        let mut i = input();
        i.new_words = 200;
        i.since_last_tick = Duration::from_secs(10);
        assert!(!tick_due(&i));
        i.has_ticked = false;
        assert!(tick_due(&i));
    }

    #[test]
    fn waits_for_speech_gap_up_to_ten_seconds() {
        let mut i = input();
        i.new_words = 200;
        i.since_last_segment = Duration::from_millis(500);
        assert!(!tick_due(&i));
        i.waited_since_due = Some(Duration::from_secs(11));
        assert!(tick_due(&i));
    }

    #[test]
    fn pending_tick_fires_once_floor_passes() {
        let mut i = input();
        i.pending = true;
        i.since_last_tick = Duration::from_secs(10);
        assert!(!tick_due(&i));
        i.since_last_tick = Duration::from_secs(50);
        assert!(tick_due(&i));
    }

    #[test]
    fn floor_scales_with_duration_and_failures() {
        assert_eq!(tick_floor(false, Duration::ZERO, 0), Duration::from_secs(45));
        assert_eq!(tick_floor(true, Duration::ZERO, 0), Duration::from_secs(90));
        assert_eq!(tick_floor(false, Duration::from_secs(40), 0), Duration::from_secs(80));
        assert_eq!(tick_floor(false, Duration::ZERO, 1), Duration::from_secs(90));
        assert_eq!(tick_floor(false, Duration::ZERO, 5), Duration::from_secs(180));
    }

    #[test]
    fn local_endpoint_detection() {
        assert!(is_local_endpoint("http://localhost:11434"));
        assert!(is_local_endpoint("http://127.0.0.1:11434/"));
        assert!(is_local_endpoint("http://[::1]:11434"));
        assert!(!is_local_endpoint("https://ollama.example.com"));
        assert!(!is_local_endpoint("not a url"));
        assert!(is_cloud(&LLMProvider::Ollama, Some("http://10.0.0.5:11434")));
        assert!(!is_cloud(&LLMProvider::Ollama, None));
        assert!(!is_cloud(&LLMProvider::BuiltInAI, None));
        assert!(is_cloud(&LLMProvider::OpenAI, None));
    }

    #[test]
    fn short_error_hides_provider_response_bodies() {
        let error = "LLM API request failed with status 401 Unauthorized: {\"error\":\"echo of the transcript text\"}";
        assert_eq!(short_error(error), "Provider returned 401 Unauthorized");
    }

    #[test]
    fn short_error_strips_newlines_and_truncates() {
        let long = "a\nb ".repeat(200);
        let short = short_error(&long);
        assert!(!short.contains('\n'));
        assert!(short.chars().count() <= MAX_ERROR_CHARS);
    }
}
