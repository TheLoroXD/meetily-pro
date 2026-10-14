import { describe, expect, test } from 'bun:test';
import { hasVisibleSummaryContent, parseSummaryContent, summaryToMarkdown } from '../../src/lib/summary-content';

describe('summary content validation', () => {
  test('accepts visible markdown and rejects whitespace or reasoning markers', () => {
    expect(hasVisibleSummaryContent({ markdown: '# Summary\nVisible' })).toBe(true);
    expect(hasVisibleSummaryContent({ markdown: '   ' })).toBe(false);
    expect(hasVisibleSummaryContent({ markdown: '<think>private</think>' })).toBe(false);
    expect(hasVisibleSummaryContent({
      markdown: '<thinking class="internal">private</thinking>',
    })).toBe(false);
    expect(hasVisibleSummaryContent({ markdown: '<thinker>Visible</thinker>' })).toBe(true);
  });

  test('validates BlockNote and legacy summary content', () => {
    expect(hasVisibleSummaryContent({ summary_json: [] })).toBe(false);
    expect(hasVisibleSummaryContent({
      summary_json: [{ content: [{ type: 'text', text: 'Visible' }] }],
    })).toBe(true);
    expect(hasVisibleSummaryContent({
      Decisions: { blocks: [{ content: '   ' }] },
    })).toBe(false);
    expect(hasVisibleSummaryContent({
      Decisions: { blocks: [{ content: 'Ship it' }] },
    })).toBe(true);
  });

  test('parses one historical double-encoded payload', () => {
    expect(parseSummaryContent('{"markdown":"Visible"}')).toEqual({ markdown: 'Visible' });
    expect(parseSummaryContent('{not json')).toBeNull();
  });
});

describe('summary as markdown', () => {
  test('returns stored markdown as is', () => {
    expect(summaryToMarkdown({ markdown: '# Notes\n- Ship Friday\n' })).toBe('# Notes\n- Ship Friday');
  });

  test('turns edited blocks into markdown', () => {
    expect(summaryToMarkdown({
      summary_json: [
        { id: '1', type: 'heading', props: { level: 2 }, content: [{ type: 'text', text: 'Decisions' }] },
        {
          id: '2',
          type: 'bulletListItem',
          content: [{ type: 'text', text: 'Ship ' }, { type: 'link', href: 'https://x.test', content: [{ type: 'text', text: 'Friday' }] }],
          children: [{ id: '3', type: 'bulletListItem', content: [{ type: 'text', text: 'Owner: Ana' }] }],
        },
        { id: '4', type: 'paragraph', content: [] },
        { id: '5', type: 'checkListItem', props: { checked: true }, content: [{ type: 'text', text: 'Book room' }] },
        { id: '6', type: 'checkListItem', props: { checked: false }, content: [{ type: 'text', text: 'Send notes' }] },
        { id: '7', type: 'paragraph', content: [{ type: 'text', text: 'Next steps' }] },
        {
          id: '8',
          type: 'numberedListItem',
          content: [{ type: 'text', text: 'Migrate' }],
          children: [{ id: '9', type: 'bulletListItem', content: [{ type: 'text', text: 'Friday night' }] }],
        },
      ],
    })).toBe('## Decisions\n\n- Ship [Friday](https://x.test)\n  - Owner: Ana\n- [x] Book room\n- [ ] Send notes\n\nNext steps\n\n1. Migrate\n   - Friday night');
  });

  test('turns legacy sections into markdown in their saved order', () => {
    expect(summaryToMarkdown({
      MeetingName: 'Sync',
      _section_order: ['Actions', 'Decisions'],
      Decisions: { title: 'Decisions', blocks: [{ content: 'Ship it' }] },
      Actions: { title: 'Action items', blocks: [{ content: 'Write notes' }, { content: '  ' }] },
    })).toBe('## Action items\n\n- Write notes\n\n## Decisions\n\n- Ship it');
  });

  test('gives nothing for empty or hidden content', () => {
    expect(summaryToMarkdown(null)).toBe('');
    expect(summaryToMarkdown({ markdown: '<think>x</think>' })).toBe('');
  });
});
