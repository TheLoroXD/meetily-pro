use sqlx::{Row, SqlitePool};

use crate::assistant::{Suggestion, SuggestionKind};

pub struct MeetingSuggestionsRepository;

impl MeetingSuggestionsRepository {
    pub async fn replace_for_meeting(
        pool: &SqlitePool,
        meeting_id: &str,
        items: &[Suggestion],
    ) -> Result<(), sqlx::Error> {
        let mut transaction = pool.begin().await?;
        sqlx::query("DELETE FROM meeting_suggestions WHERE meeting_id = ?")
            .bind(meeting_id)
            .execute(&mut *transaction)
            .await?;
        let created_at = chrono::Utc::now().to_rfc3339();
        for item in items {
            sqlx::query(
                "INSERT INTO meeting_suggestions (id, meeting_id, kind, text, why, at_seconds, sequence_id, pinned, dismissed, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            )
            .bind(&item.id)
            .bind(meeting_id)
            .bind(item.kind.as_str())
            .bind(&item.text)
            .bind(&item.why)
            .bind(item.at_seconds)
            .bind(item.sequence_id as i64)
            .bind(item.pinned as i64)
            .bind(item.dismissed as i64)
            .bind(&created_at)
            .execute(&mut *transaction)
            .await?;
        }
        transaction.commit().await
    }

    pub async fn get_for_meeting(
        pool: &SqlitePool,
        meeting_id: &str,
    ) -> Result<Vec<Suggestion>, sqlx::Error> {
        let rows = sqlx::query(
            "SELECT id, kind, text, why, at_seconds, sequence_id, pinned, dismissed FROM meeting_suggestions WHERE meeting_id = ? ORDER BY sequence_id, id",
        )
        .bind(meeting_id)
        .fetch_all(pool)
        .await?;
        Ok(rows
            .into_iter()
            .filter_map(|row| {
                let kind = SuggestionKind::parse(row.get::<String, _>("kind").as_str())?;
                Some(Suggestion {
                    id: row.get("id"),
                    kind,
                    text: row.get("text"),
                    why: row.get("why"),
                    at_seconds: row.get("at_seconds"),
                    sequence_id: row.get::<i64, _>("sequence_id").max(0) as u64,
                    pinned: row.get::<i64, _>("pinned") != 0,
                    dismissed: row.get::<i64, _>("dismissed") != 0,
                    missed_ticks: 0,
                })
            })
            .collect())
    }
}
