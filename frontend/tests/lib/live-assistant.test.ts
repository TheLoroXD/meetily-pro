import { describe, expect, test } from 'bun:test';
import {
  appendPinnedSection,
  buildPinnedPromptSection,
  describeAge,
  formatClock,
  isCloudProvider,
  isLocalEndpoint,
  sortSuggestions,
  splitCitations,
  type Suggestion,
} from '../../src/lib/live-assistant';

const item = (id: string, overrides: Partial<Suggestion> = {}): Suggestion => ({
  id,
  kind: 'question',
  text: `Suggestion ${id}`,
  why: '',
  at_seconds: 12,
  sequence_id: 1,
  pinned: false,
  dismissed: false,
  ...overrides,
});

describe('live assistant helpers', () => {
  test('splits chat answers into text and clickable citations', () => {
    expect(splitCitations('Owner unclear [01:00], deadline [1:02:03].')).toEqual([
      { text: 'Owner unclear ' },
      { clock: '01:00', seconds: 60 },
      { text: ', deadline ' },
      { clock: '1:02:03', seconds: 3723 },
      { text: '.' },
    ]);
    expect(splitCitations('No citations')).toEqual([{ text: 'No citations' }]);
  });

  test('sorts pinned first, then newest, and hides dismissed', () => {
    const ordered = sortSuggestions([
      item('s1'),
      item('s2', { pinned: true }),
      item('s3', { dismissed: true }),
      item('s4'),
    ]);
    expect(ordered.map((s) => s.id)).toEqual(['s2', 's4', 's1']);
  });

  test('formats clock values', () => {
    expect(formatClock(0)).toBe('00:00');
    expect(formatClock(754.9)).toBe('12:34');
    expect(formatClock(3723)).toBe('1:02:03');
    expect(formatClock(-5)).toBe('00:00');
  });

  test('describes age and staleness', () => {
    const now = Date.parse('2026-10-12T10:00:00Z');
    expect(describeAge(null, now)).toEqual({ label: 'No suggestions yet', stale: false });
    expect(describeAge('2026-10-12T09:59:58Z', now)).toEqual({ label: 'Updated just now', stale: false });
    expect(describeAge('2026-10-12T09:59:20Z', now)).toEqual({ label: 'Updated 40 s ago', stale: false });
    expect(describeAge('2026-10-12T09:55:00Z', now)).toEqual({ label: 'Updated 5 min ago', stale: true });
  });

  test('classifies providers as cloud or local', () => {
    expect(isCloudProvider('builtin-ai')).toBe(false);
    expect(isCloudProvider('ollama')).toBe(false);
    expect(isCloudProvider('ollama', 'http://127.0.0.1:11434')).toBe(false);
    expect(isCloudProvider('ollama', 'http://10.0.0.4:11434')).toBe(true);
    expect(isCloudProvider('openai')).toBe(true);
    expect(isCloudProvider('custom-openai')).toBe(true);
    expect(isLocalEndpoint('nonsense')).toBe(false);
    expect(isLocalEndpoint(null)).toBe(true);
  });

  test('builds the pinned section only from pinned, visible items', () => {
    expect(buildPinnedPromptSection([item('s1')])).toBe('');
    const section = buildPinnedPromptSection([
      item('s1', { pinned: true, at_seconds: 65, text: 'Who owns the migration?' }),
      item('s2', { pinned: true, dismissed: true }),
      item('s3', { pinned: true, kind: 'tip', at_seconds: 3, text: 'Confirm Friday' }),
    ]);
    expect(section).toBe('Pinned during the call by the user (give these extra attention):\n- [01:05] question: Who owns the migration?\n- [00:03] tip: Confirm Friday');
    expect(appendPinnedSection('', section)).toBe(section);
    expect(appendPinnedSection('Focus on risks', section)).toBe(`Focus on risks\n\n${section}`);
    expect(appendPinnedSection('Focus on risks', '')).toBe('Focus on risks');
  });
});
