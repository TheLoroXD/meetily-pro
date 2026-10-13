use tauri::{AppHandle, Runtime};

use super::prompt::Suggestion;
use super::service::{self, LiveAssistantState};
use super::settings::{self, AssistantSettings};
use crate::database::repositories::suggestion::MeetingSuggestionsRepository;
use crate::state::AppState;

#[tauri::command]
pub async fn start_live_assistant<R: Runtime>(
    app: AppHandle<R>,
    goal: Option<String>,
) -> Result<(), String> {
    service::start(&app, goal)
}

#[tauri::command]
pub async fn refresh_live_assistant<R: Runtime>(app: AppHandle<R>) -> Result<(), String> {
    service::refresh(&app)
}

#[tauri::command]
pub async fn pause_live_assistant<R: Runtime>(app: AppHandle<R>, paused: bool) -> Result<(), String> {
    service::set_paused(&app, paused)
}

#[tauri::command]
pub async fn set_live_assistant_goal<R: Runtime>(app: AppHandle<R>, goal: String) -> Result<(), String> {
    service::set_goal(&app, goal)
}

#[tauri::command]
pub async fn update_live_suggestion<R: Runtime>(
    app: AppHandle<R>,
    id: String,
    pinned: Option<bool>,
    dismissed: Option<bool>,
) -> Result<(), String> {
    service::update_suggestion(&app, &id, pinned, dismissed)
}

#[tauri::command]
pub async fn get_live_assistant_state<R: Runtime>(app: AppHandle<R>) -> Result<LiveAssistantState, String> {
    Ok(service::snapshot(&app))
}

#[tauri::command]
pub async fn api_get_assistant_settings<R: Runtime>(app: AppHandle<R>) -> Result<AssistantSettings, String> {
    Ok(settings::load(&app))
}

#[tauri::command]
pub async fn api_save_assistant_settings<R: Runtime>(
    app: AppHandle<R>,
    settings: AssistantSettings,
) -> Result<(), String> {
    let settings = AssistantSettings { last_goal: settings::load(&app).last_goal, ..settings };
    settings::save(&app, &settings)?;
    if !settings.enabled {
        service::stop(&app);
    }
    Ok(())
}

#[tauri::command]
pub async fn api_get_meeting_suggestions(
    state: tauri::State<'_, AppState>,
    meeting_id: String,
) -> Result<Vec<Suggestion>, String> {
    MeetingSuggestionsRepository::get_for_meeting(state.db_manager.pool(), &meeting_id)
        .await
        .map_err(|e| e.to_string())
}

async fn store_suggestions(
    state: &AppState,
    meeting_id: &str,
    suggestions: &[Suggestion],
) -> Result<usize, String> {
    if suggestions.is_empty() {
        return Ok(0);
    }
    MeetingSuggestionsRepository::replace_for_meeting(state.db_manager.pool(), meeting_id, suggestions)
        .await
        .map_err(|e| e.to_string())?;
    Ok(suggestions.len())
}

#[tauri::command]
pub async fn api_import_assistant_snapshot(
    state: tauri::State<'_, AppState>,
    meeting_id: String,
    folder: String,
) -> Result<usize, String> {
    let suggestions = service::read_snapshot(std::path::Path::new(&folder)).unwrap_or_default();
    store_suggestions(&state, &meeting_id, &suggestions).await
}

#[tauri::command]
pub async fn api_save_meeting_suggestions<R: Runtime>(
    app: AppHandle<R>,
    state: tauri::State<'_, AppState>,
    meeting_id: String,
) -> Result<usize, String> {
    store_suggestions(&state, &meeting_id, &service::snapshot(&app).suggestions).await
}
