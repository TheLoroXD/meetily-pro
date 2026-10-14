# Security policy

## Supported versions

Only the latest release on the `main` branch receives fixes.

## Reporting a vulnerability

Use GitHub private vulnerability reporting: https://github.com/asidko/meetily-pro/security/advisories/new

Do not open a public issue for security problems. Expect an acknowledgement within 7 days.

## Scope notes

- Meetily processes audio and transcripts locally. Data leaves the machine only when a cloud LLM provider is configured, and only from the Rust core.
- Provider API keys are stored in the local SQLite database in the app data directory; protect that directory with your OS user permissions.
