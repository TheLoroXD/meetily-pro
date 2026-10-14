pub mod commands;
pub mod meeting_chat;
pub mod prompt;
pub mod service;
pub mod settings;

pub use prompt::{Suggestion, SuggestionKind};
pub use service::AssistantState;
