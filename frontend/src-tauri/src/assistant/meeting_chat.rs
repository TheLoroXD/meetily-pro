use log::warn;
use std::collections::HashSet;
use std::sync::Mutex;
use tauri::{AppHandle, Runtime};
use tokio_util::sync::CancellationToken;

use super::prompt::{self, ChatMessage, ChatRole};
use super::service::{self, RequestPlan};
use crate::audio::recording_saver::TranscriptSegment;
use crate::database::repositories::chat::MeetingChatRepository;
use crate::database::repositories::meeting::MeetingsRepository;
use crate::database::repositories::summary::SummaryProcessesRepository;
use crate::summary::llm_client::LLMProvider;
use crate::summary::processor::{clean_llm_markdown_detailed, rough_token_count};

const LARGE_CONTEXT_INPUT_TOKENS: usize = 24000;
const ANSWER_TOKENS: u32 = 1000;
const MIN_INPUT_TOKENS: usize = 512;

static IN_FLIGHT: std::sync::LazyLock<Mutex<HashSet<String>>> = std::sync::LazyLock::new(Default::default);

struct InFlight(String);

impl InFlight {
    fn claim(meeting_id: &str) -> Option<Self> {
        let mut guard = IN_FLIGHT.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
        guard.insert(meeting_id.to_string()).then(|| Self(meeting_id.to_string()))
    }
}

impl Drop for InFlight {
    fn drop(&mut self) {
        IN_FLIGHT.lock().unwrap_or_else(|poisoned| poisoned.into_inner()).remove(&self.0);
    }
}

pub fn is_answering(meeting_id: &str) -> bool {
    IN_FLIGHT.lock().unwrap_or_else(|poisoned| poisoned.into_inner()).contains(meeting_id)
}

fn message(role: ChatRole, text: String, error: bool) -> ChatMessage {
    ChatMessage { id: String::new(), role, text, error }
}

pub async fn ask<R: Runtime>(app: &AppHandle<R>, meeting_id: &str, question: String) -> Result<Vec<ChatMessage>, String> {
    let question = service::checked_question(question)?;
    let _claim = InFlight::claim(meeting_id).ok_or_else(|| "Wait for the current answer".to_string())?;
    let pool = service::db_pool(app)?;
    MeetingChatRepository::append(&pool, meeting_id, &[message(ChatRole::User, question, false)])
        .await
        .map_err(|e| e.to_string())?;
    let reply = match answer(app, meeting_id).await {
        Ok(text) => message(ChatRole::Assistant, text, false),
        Err(error) => {
            let error = service::short_error(&error);
            warn!("Meeting chat failed: {}", error);
            message(ChatRole::Assistant, error, true)
        }
    };
    MeetingChatRepository::append(&pool, meeting_id, &[reply])
        .await
        .map_err(|e| e.to_string())?;
    MeetingChatRepository::get_for_meeting(&pool, meeting_id)
        .await
        .map_err(|e| e.to_string())
}

async fn budget(plan: &RequestPlan) -> usize {
    match plan.provider_settings.provider {
        LLMProvider::OpenAI
        | LLMProvider::Claude
        | LLMProvider::OpenRouter
        | LLMProvider::ClaudeCode
        | LLMProvider::Codex => LARGE_CONTEXT_INPUT_TOKENS,
        LLMProvider::Ollama => service::input_budget(&plan.provider_settings, &plan.model)
            .await
            .saturating_sub(ANSWER_TOKENS as usize)
            .max(MIN_INPUT_TOKENS),
        _ => service::input_budget(&plan.provider_settings, &plan.model).await,
    }
}

fn summary_markdown(result: Option<String>) -> String {
    result
        .and_then(|raw| serde_json::from_str::<serde_json::Value>(&raw).ok())
        .and_then(|value| value.get("markdown").and_then(|m| m.as_str()).map(|m| clean_llm_markdown_detailed(m).markdown))
        .unwrap_or_default()
}

fn truncate_to_tokens(text: &str, tokens: usize) -> String {
    if rough_token_count(text) <= tokens {
        return text.to_string();
    }
    let chars = text.chars().count() * tokens / rough_token_count(text).max(1);
    text.chars().take(chars).collect()
}

async fn answer<R: Runtime>(app: &AppHandle<R>, meeting_id: &str) -> Result<String, String> {
    let plan = service::resolve_request(app).await?;
    let pool = service::db_pool(app)?;
    let meeting = MeetingsRepository::get_meeting_metadata(&pool, meeting_id)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Meeting not found".to_string())?;
    let (transcripts, _) = MeetingsRepository::get_meeting_transcripts_paginated(&pool, meeting_id, i64::MAX, 0)
        .await
        .map_err(|e| e.to_string())?;
    let segments: Vec<TranscriptSegment> = transcripts
        .into_iter()
        .enumerate()
        .map(|(index, t)| {
            let start = t.audio_start_time.unwrap_or(0.0);
            TranscriptSegment {
                id: t.id,
                text: t.transcript,
                audio_start_time: start,
                audio_end_time: t.audio_end_time.unwrap_or(start),
                duration: t.duration.unwrap_or(0.0),
                display_time: t.timestamp,
                confidence: 1.0,
                sequence_id: index as u64,
            }
        })
        .collect();
    if segments.is_empty() {
        return Err("This meeting has no transcript yet".to_string());
    }
    let summary = SummaryProcessesRepository::get_summary_data(&pool, meeting_id)
        .await
        .map_err(|e| e.to_string())?
        .map(|process| summary_markdown(process.result))
        .unwrap_or_default();
    let chat = MeetingChatRepository::get_for_meeting(&pool, meeting_id)
        .await
        .map_err(|e| e.to_string())?;

    let budget = budget(&plan).await;
    let request = service::ChatRequest {
        system_prompt: prompt::MEETING_CHAT_SYSTEM_PROMPT,
        prefix: prompt::build_meeting_prefix(&meeting.title, &truncate_to_tokens(&summary, budget / 4)),
        segments: &segments,
        chat: &chat,
        budget,
        max_tokens: ANSWER_TOKENS,
    };
    service::answer_question(app, &plan, request, &CancellationToken::new()).await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn summary_markdown_reads_only_markdown_summaries() {
        assert_eq!(summary_markdown(Some(r##"{"markdown":"# Notes","MeetingName":"x"}"##.to_string())), "# Notes");
        assert_eq!(summary_markdown(Some(r##"{"markdown":"<think>plan</think># Notes"}"##.to_string())), "# Notes");
        assert_eq!(summary_markdown(Some(r#"{"summary_json":[]}"#.to_string())), "");
        assert_eq!(summary_markdown(Some("not json".to_string())), "");
        assert_eq!(summary_markdown(None), "");
    }

    #[test]
    fn truncation_keeps_short_text_and_cuts_long_text() {
        assert_eq!(truncate_to_tokens("short", 100), "short");
        let long = "word ".repeat(2000);
        let cut = truncate_to_tokens(&long, 100);
        assert!(rough_token_count(&cut) <= 110);
        assert!(long.starts_with(&cut));
    }

    #[test]
    fn one_answer_per_meeting_at_a_time() {
        let first = InFlight::claim("m-test").expect("first claim");
        assert!(InFlight::claim("m-test").is_none());
        assert!(is_answering("m-test"));
        drop(first);
        assert!(!is_answering("m-test"));
        assert!(InFlight::claim("m-test").is_some());
    }
}
