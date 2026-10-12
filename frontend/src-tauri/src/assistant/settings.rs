use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tauri::{AppHandle, Runtime};
use tauri_plugin_store::StoreExt;

const STORE_FILE: &str = "assistant-preferences.json";
const STORE_KEY: &str = "settings";

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
pub struct AssistantSettings {
    #[serde(default)]
    pub enabled: bool,
    #[serde(default)]
    pub provider: Option<String>,
    #[serde(default)]
    pub model: Option<String>,
    #[serde(default)]
    pub cloud_consent: HashMap<String, bool>,
    #[serde(default)]
    pub last_goal: String,
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
