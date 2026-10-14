CREATE TABLE IF NOT EXISTS meeting_chat_messages (
    meeting_id TEXT NOT NULL,
    position INTEGER NOT NULL,
    role TEXT NOT NULL,
    text TEXT NOT NULL,
    error INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    PRIMARY KEY (meeting_id, position),
    FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE
);
