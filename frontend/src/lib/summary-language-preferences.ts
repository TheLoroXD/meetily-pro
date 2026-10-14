import { invoke } from '@tauri-apps/api/core';
import { normaliseLanguageCode } from '@/lib/summary-languages';

const DETECTED_SUMMARY_LANGUAGE_FALLBACK_PREFIX = 'detectedSummaryLanguageFallback';

export type SummaryLanguageStorage = 'metadata' | 'local_fallback';

export interface MeetingSummaryLanguagePreference {
  language: string | null;
  storage: SummaryLanguageStorage;
}

type RawMeetingSummaryLanguagePreference =
  | MeetingSummaryLanguagePreference
  | string
  | null;

export type SummaryLanguageDetectionReason =
  | 'detected'
  | 'tie'
  | 'low_confidence'
  | 'unsupported'
  | 'empty';

export interface SummaryLanguageDetectionResult {
  language: string | null;
  reason: SummaryLanguageDetectionReason;
}

function fallbackKey(prefix: string, meetingId: string): string {
  return `${prefix}:${meetingId}`;
}

function readLanguageFallback(prefix: string, meetingId: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return normaliseLanguageCode(
      window.localStorage.getItem(fallbackKey(prefix, meetingId))
    );
  } catch {
    return null;
  }
}

function writeLanguageFallback(
  prefix: string,
  meetingId: string,
  language: string | null
): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const key = fallbackKey(prefix, meetingId);
    if (language) window.localStorage.setItem(key, language);
    else window.localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

function normalisePreferenceResponse(
  raw: RawMeetingSummaryLanguagePreference
): MeetingSummaryLanguagePreference {
  if (raw && typeof raw === 'object' && 'storage' in raw) {
    return {
      language: normaliseLanguageCode(raw.language),
      storage: raw.storage === 'local_fallback' ? 'local_fallback' : 'metadata',
    };
  }

  return {
    language: normaliseLanguageCode(raw),
    storage: 'metadata',
  };
}

export async function readCachedDetectedSummaryLanguage(meetingId: string): Promise<string | null> {
  const response = normalisePreferenceResponse(
    await invoke<RawMeetingSummaryLanguagePreference>(
      'api_get_meeting_detected_summary_language',
      { meetingId }
    )
  );

  if (response.storage === 'local_fallback') {
    return readLanguageFallback(DETECTED_SUMMARY_LANGUAGE_FALLBACK_PREFIX, meetingId);
  }

  writeLanguageFallback(DETECTED_SUMMARY_LANGUAGE_FALLBACK_PREFIX, meetingId, null);
  return response.language;
}

export async function saveCachedDetectedSummaryLanguage(
  meetingId: string,
  language: string | null
): Promise<void> {
  const normalised = language ? normaliseLanguageCode(language) : null;
  const response = normalisePreferenceResponse(
    await invoke<RawMeetingSummaryLanguagePreference>(
      'api_save_meeting_detected_summary_language',
      {
        meetingId,
        detectedSummaryLanguage: normalised,
      }
    )
  );

  if (response.storage === 'local_fallback') {
    writeLanguageFallback(
      DETECTED_SUMMARY_LANGUAGE_FALLBACK_PREFIX,
      meetingId,
      normalised
    );
    return;
  }

  writeLanguageFallback(DETECTED_SUMMARY_LANGUAGE_FALLBACK_PREFIX, meetingId, null);
}

export async function detectTranscriptSummaryLanguage(
  transcriptTexts: string[]
): Promise<SummaryLanguageDetectionResult> {
  const detection = await invoke<SummaryLanguageDetectionResult>(
    'api_detect_transcript_summary_language',
    { transcriptTexts }
  );

  return {
    language: normaliseLanguageCode(detection.language),
    reason: detection.reason,
  };
}

export async function detectAndCacheSummaryLanguage(
  meetingId: string,
  transcriptTexts: string[]
): Promise<SummaryLanguageDetectionResult> {
  const detection = await detectTranscriptSummaryLanguage(transcriptTexts);

  if (detection.language) {
    try {
      await saveCachedDetectedSummaryLanguage(meetingId, detection.language);
    } catch (error) {
      console.warn('Failed to cache detected summary language:', error);
    }
  }

  return detection;
}
