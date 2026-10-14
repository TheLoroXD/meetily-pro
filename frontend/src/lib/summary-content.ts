import type { MeetingSummary } from '@/types';
import { z } from 'zod';

const REASONING_MARKER = /<\/?think(?:ing)?(?:\s+[^>]*)?>/i;
const SummaryObject = z.record(z.unknown());

function parseSummaryObject(value: unknown) {
  const parsed = SummaryObject.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function containsReasoningMarker(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some(containsReasoningMarker);
  }
  const object = parseSummaryObject(value);
  if (!object) {
    return false;
  }

  return Object.entries(object).some(([key, child]) => {
    if (typeof child === 'string') {
      return ['markdown', 'text', 'content'].includes(key) && REASONING_MARKER.test(child);
    }
    return ['summary_json', 'children', 'content', 'blocks'].includes(key)
      && containsReasoningMarker(child);
  });
}

function hasBlockText(value: unknown): boolean {
  if (typeof value === 'string') {
    return value.trim().length > 0;
  }
  if (Array.isArray(value)) {
    return value.some(hasBlockText);
  }
  const object = parseSummaryObject(value);
  return object ? [object.text, object.content, object.children].some(hasBlockText) : false;
}

function hasLegacySectionText(value: unknown): boolean {
  const section = parseSummaryObject(value);
  return Array.isArray(section?.blocks) && section.blocks.some((block) => {
    const parsedBlock = parseSummaryObject(block);
    return typeof parsedBlock?.content === 'string' && parsedBlock.content.trim().length > 0;
  });
}

export function hasVisibleSummaryContent(value: unknown): value is MeetingSummary {
  const object = parseSummaryObject(value);
  if (!object || containsReasoningMarker(value)) {
    return false;
  }
  if ('markdown' in object) {
    return typeof object.markdown === 'string' && object.markdown.trim().length > 0;
  }
  if ('summary_json' in object) {
    return hasBlockText(object.summary_json);
  }
  return Object.entries(object)
    .filter(([key]) => key !== 'MeetingName' && key !== '_section_order')
    .some(([, section]) => hasLegacySectionText(section));
}

const SummaryMetadata = z.object({
  MeetingName: z.string().optional(),
  reasoning_stripped: z.boolean().optional(),
  normalization_fallback: z.boolean().optional(),
}).passthrough();

export function readSummaryMetadata(value: unknown) {
  const parsed = SummaryMetadata.safeParse(value);
  return parsed.success
    ? {
        meetingName: parsed.data.MeetingName ?? null,
        reasoningStripped: parsed.data.reasoning_stripped === true,
        normalizationFallback: parsed.data.normalization_fallback === true,
      }
    : {
        meetingName: null,
        reasoningStripped: false,
        normalizationFallback: false,
      };
}

export function parseSummaryContent(value: unknown): MeetingSummary | null {
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return null;
    }
  }
  return hasVisibleSummaryContent(value) ? value : null;
}

function inlineText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content.map((item) => {
    const object = parseSummaryObject(item);
    if (!object) return '';
    const text = typeof object.text === 'string' ? object.text : inlineText(object.content);
    return object.type === 'link' && typeof object.href === 'string' ? `[${text}](${object.href})` : text;
  }).join('');
}

const BLOCK_PREFIX: Record<string, string> = {
  bulletListItem: '- ',
  numberedListItem: '1. ',
  checkListItem: '- [ ] ',
};

interface MarkdownLine {
  text: string;
  list: boolean;
}

function blocksToLines(blocks: unknown, indent = ''): MarkdownLine[] {
  if (!Array.isArray(blocks)) return [];
  return blocks.flatMap((block) => {
    const object = parseSummaryObject(block);
    if (!object) return [];
    const text = inlineText(object.content).trim();
    const props = parseSummaryObject(object.props);
    const level = typeof props?.level === 'number' ? props.level : 2;
    const type = typeof object.type === 'string' ? object.type : 'paragraph';
    const prefix = type === 'checkListItem' && props?.checked === true ? '- [x] ' : BLOCK_PREFIX[type] ?? '';
    const list = prefix !== '';
    const line = type === 'heading' ? `${'#'.repeat(level)} ${text}` : `${indent}${prefix}${text}`;
    const childIndent = indent + ' '.repeat(type === 'numberedListItem' ? 3 : list ? 2 : 0);
    return [...(text ? [{ text: line, list }] : []), ...blocksToLines(object.children, childIndent)];
  });
}

function joinLines(lines: MarkdownLine[]): string {
  return lines
    .map((line, index) => (index === 0 ? '' : line.list && lines[index - 1].list ? '\n' : '\n\n') + line.text)
    .join('');
}

function legacyToMarkdown(object: Record<string, unknown>): string {
  const order = Array.isArray(object._section_order)
    ? object._section_order.filter((key): key is string => typeof key === 'string')
    : Object.keys(object);
  return order
    .filter((key) => key !== 'MeetingName' && key !== '_section_order')
    .map((key) => {
      const section = parseSummaryObject(object[key]);
      if (!section || !Array.isArray(section.blocks)) return '';
      const items = section.blocks
        .map((block) => parseSummaryObject(block)?.content)
        .filter((content): content is string => typeof content === 'string' && content.trim().length > 0)
        .map((content) => `- ${content.trim()}`);
      if (items.length === 0) return '';
      const title = typeof section.title === 'string' ? section.title : key;
      return `## ${title}\n\n${items.join('\n')}`;
    })
    .filter(Boolean)
    .join('\n\n');
}

export function summaryToMarkdown(summary: MeetingSummary | null): string {
  if (!hasVisibleSummaryContent(summary)) return '';
  const object = parseSummaryObject(summary) ?? {};
  if (typeof object.markdown === 'string') return object.markdown.trim();
  if ('summary_json' in object) return joinLines(blocksToLines(object.summary_json));
  return legacyToMarkdown(object);
}
