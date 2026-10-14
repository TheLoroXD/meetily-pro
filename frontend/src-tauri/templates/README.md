# Meeting Summary Templates

This directory contains the template definition for meeting summary generation.

## Available Templates

### `standard_meeting.json`
General-purpose meeting notes template focusing on key outcomes and actions. Every summary uses it.

**Sections:**
- Summary
- Key Decisions
- Action Items
- Discussion Highlights

## Template Structure

Each template JSON file follows this schema:

```json
{
  "name": "Template Name",
  "description": "Brief description of the template's purpose",
  "sections": [
    {
      "title": "Section Title",
      "instruction": "Instructions for the LLM on what to extract/include",
      "format": "paragraph|list|string",
      "item_format": "Optional: Markdown table format for list items"
    }
  ]
}
```

## Custom Templates

Users can override the standard template by placing a `standard_meeting.json` in the application data directory:

- **macOS**: `~/Library/Application Support/Meetily/templates/`
- **Windows**: `%APPDATA%\Meetily\templates\`
- **Linux**: `~/.config/Meetily/templates/`

A file there replaces the bundled template with the same filename.

## Template Fields

### Root Level
- `name` (required): Display name for the template
- `description` (required): Brief explanation of the template's use case
- `sections` (required): Array of section definitions

### Section Object
- `title` (required): Section heading text
- `instruction` (required): LLM guidance for this section
- `format` (required): One of `"paragraph"`, `"list"`, or `"string"`
- `item_format` (optional): Markdown formatting hint for list items (e.g., table structure)
- `example_item_format` (optional): Alternative formatting hint

## Usage in Code

Templates are loaded using the `templates` module:

```rust
use crate::summary::templates;

// Get the standard template
let template = templates::get_template("standard_meeting")?;

// List available template ids
let available = templates::list_template_ids();
```
