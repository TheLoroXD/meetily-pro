CREATE TABLE IF NOT EXISTS meeting_suggestions (
    id TEXT NOT NULL,
    meeting_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    text TEXT NOT NULL,
    why TEXT NOT NULL DEFAULT '',
    at_seconds REAL NOT NULL,
    sequence_id INTEGER NOT NULL,
    pinned INTEGER NOT NULL DEFAULT 0,
    dismissed INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    PRIMARY KEY (meeting_id, id),
    FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_meeting_suggestions_meeting_id ON meeting_suggestions(meeting_id);
