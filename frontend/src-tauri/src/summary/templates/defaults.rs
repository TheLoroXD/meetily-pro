/// Embedded default templates using compile-time inclusion
///
/// These templates are bundled into the binary and serve as fallbacks
/// when custom templates are not available.

/// Standard meeting notes template
pub const STANDARD_MEETING: &str = include_str!("../../../templates/standard_meeting.json");

const STANDARD_MEETING_ID: &str = "standard_meeting";

/// Get a built-in template by identifier
///
/// # Arguments
/// * `id` - Template identifier ("standard_meeting")
///
/// # Returns
/// The template JSON content if found, None otherwise
pub fn get_builtin_template(id: &str) -> Option<&'static str> {
    (id == STANDARD_MEETING_ID).then_some(STANDARD_MEETING)
}

/// List all built-in template identifiers
pub fn list_builtin_template_ids() -> Vec<&'static str> {
    vec![STANDARD_MEETING_ID]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_builtin_templates_valid_json() {
        let result = serde_json::from_str::<serde_json::Value>(STANDARD_MEETING);
        assert!(
            result.is_ok(),
            "Built-in template 'standard_meeting' contains invalid JSON: {:?}",
            result.err()
        );
    }

    #[test]
    fn test_get_builtin_template() {
        assert!(get_builtin_template("standard_meeting").is_some());
        assert!(get_builtin_template("nonexistent").is_none());
    }
}
