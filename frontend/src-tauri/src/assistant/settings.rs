use log::{info, warn};
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use std::collections::HashMap;
use tauri::{AppHandle, Runtime};
use tauri_plugin_store::StoreExt;

use crate::database::repositories::setting::SettingsRepository;

const STORE_FILE: &str = "assistant-preferences.json";
const STORE_KEY: &str = "settings";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(default)]
pub struct AssistantSettings {
    pub enabled: bool,
    pub cloud_consent: HashMap<String, bool>,
}

impl Default for AssistantSettings {
    fn default() -> Self {
        Self {
            enabled: true,
            cloud_consent: HashMap::new(),
        }
    }
}

impl AssistantSettings {
    pub fn has_cloud_consent(&self, provider: &str) -> bool {
        self.cloud_consent.get(provider).copied().unwrap_or(false)
    }
}

pub fn load<R: Runtime>(app: &AppHandle<R>) -> AssistantSettings {
    let Ok(store) = app.store(STORE_FILE) else {
        return AssistantSettings::default();
    };
    store
        .get(STORE_KEY)
        .and_then(|value| serde_json::from_value(value).ok())
        .unwrap_or_default()
}

pub fn save<R: Runtime>(app: &AppHandle<R>, settings: &AssistantSettings) -> Result<(), String> {
    let store = app.store(STORE_FILE).map_err(|e| e.to_string())?;
    let value = serde_json::to_value(settings).map_err(|e| e.to_string())?;
    store.set(STORE_KEY, value);
    store.save().map_err(|e| e.to_string())
}

fn own_model(stored: &serde_json::Value) -> Option<(String, String)> {
    let field = |key: &str| {
        stored
            .get(key)
            .and_then(|value| value.as_str())
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(str::to_string)
    };
    Some((field("provider")?, field("model")?))
}

pub async fn adopt_own_model<R: Runtime>(app: &AppHandle<R>, pool: &SqlitePool) {
    let Ok(store) = app.store(STORE_FILE) else {
        return;
    };
    let Some(stored) = store.get(STORE_KEY) else {
        return;
    };
    if stored.get("provider").is_none() && stored.get("model").is_none() {
        return;
    }
    if let Some((provider, model)) = own_model(&stored) {
        if let Err(error) = SettingsRepository::save_ai_model(pool, &provider, &model).await {
            warn!("Failed to adopt the assistant model as the AI model: {}", error);
            return;
        }
        info!("Assistant model {}/{} is now the AI model", provider, model);
    }
    let settings: AssistantSettings = serde_json::from_value(stored).unwrap_or_default();
    if let Err(error) = save(app, &settings) {
        warn!("Failed to rewrite assistant settings: {}", error);
    }
}
