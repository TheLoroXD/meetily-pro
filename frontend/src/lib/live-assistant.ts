import type { ModelConfig } from '@/components/ModelSettingsModal';

export type SuggestionKind = 'question' | 'tip';

export interface Suggestion {
  id: string;
  kind: SuggestionKind;
  text: string;
  why: string;
  at_seconds: number;
  sequence_id: number;
  pinned: boolean;
  dismissed: boolean;
  missed_ticks?: number;
}

export type AssistantStatus = 'idle' | 'waiting' | 'generating' | 'paused' | 'error';

export interface LiveAssistantState {
  active: boolean;
  status: AssistantStatus;
  goal: string;
  provider: string;
  model: string;
  is_cloud: boolean;
  last_tick_at: string | null;
  error: string | null;
  tick_no: number;
  state: string;
  suggestions: Suggestion[];
}

export interface AssistantSettings {
  enabled: boolean;
  provider: string | null;
  model: string | null;
  cloud_consent: Record<string, boolean>;
  last_goal: string;
}

type Provider = ModelConfig['provider'];

const PROVIDER_LABELS: Record<Provider, string> = {
  'builtin-ai': 'Built-in AI',
  ollama: 'Ollama',
  openai: 'OpenAI',
  claude: 'Claude',
  groq: 'Groq',
  openrouter: 'OpenRouter',
  'custom-openai': 'Custom Server (OpenAI)',
};

export const PROVIDERS = Object.keys(PROVIDER_LABELS) as Provider[];

export const KIND_META: Record<SuggestionKind, { label: string; badge: string; text: string }> = {
  question: { label: 'Ask', badge: 'bg-blue-50 text-blue-700', text: 'text-blue-700' },
  tip: { label: 'Tip', badge: 'bg-amber-50 text-amber-700', text: 'text-amber-700' },
};

const STALE_AFTER_MS = 3 * 60 * 1000;

export function providerLabel(provider: string): string {
  return PROVIDER_LABELS[provider as Provider] ?? provider;
}

export function isLocalEndpoint(endpoint: string | null | undefined): boolean {
  if (!endpoint) return true;
  try {
    const host = new URL(endpoint).hostname.toLowerCase();
    return host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host === '::1' || host === '0.0.0.0' || host.endsWith('.localhost');
  } catch {
    return false;
  }
}

export function isCloudProvider(provider: string, ollamaEndpoint?: string | null): boolean {
  if (provider === 'builtin-ai') return false;
  if (provider === 'ollama') return !isLocalEndpoint(ollamaEndpoint);
  return true;
}

const PANEL_OPEN_KEY = 'assistant_panel_open';

export function readPanelOpen(): boolean {
  try {
    return localStorage.getItem(PANEL_OPEN_KEY) === 'true';
  } catch {
    return false;
  }
}

export function writePanelOpen(open: boolean): void {
  try {
    localStorage.setItem(PANEL_OPEN_KEY, String(open));
  } catch {
    return;
  }
}

function idNumber(id: string): number {
  const parsed = Number.parseInt(id.replace(/^s/, ''), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function sortSuggestions(items: Suggestion[]): Suggestion[] {
  const visible = items.filter((item) => !item.dismissed);
  const pinned = visible.filter((item) => item.pinned).sort((a, b) => idNumber(a.id) - idNumber(b.id));
  const rest = visible.filter((item) => !item.pinned).sort((a, b) => idNumber(b.id) - idNumber(a.id));
  return [...pinned, ...rest];
}

export function formatClock(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  const mm = minutes.toString().padStart(2, '0');
  const ss = secs.toString().padStart(2, '0');
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function describeAge(lastTickAt: string | null, now: number = Date.now()): { label: string; stale: boolean } {
  if (!lastTickAt) return { label: 'No suggestions yet', stale: false };
  const elapsed = now - new Date(lastTickAt).getTime();
  if (!Number.isFinite(elapsed) || elapsed < 0) return { label: 'Updated just now', stale: false };
  const stale = elapsed >= STALE_AFTER_MS;
  if (elapsed < 10_000) return { label: 'Updated just now', stale };
  if (elapsed < 60_000) return { label: `Updated ${Math.round(elapsed / 1000)} s ago`, stale };
  return { label: `Updated ${Math.round(elapsed / 60_000)} min ago`, stale };
}

export function buildPinnedPromptSection(items: Suggestion[]): string {
  const pinned = items.filter((item) => item.pinned && !item.dismissed);
  if (pinned.length === 0) return '';
  const lines = pinned.map((item) => `- [${formatClock(item.at_seconds)}] ${item.kind}: ${item.text}`);
  return `Pinned during the call by the user (give these extra attention):\n${lines.join('\n')}`;
}

export function appendPinnedSection(customPrompt: string, section: string): string {
  if (!section) return customPrompt;
  return customPrompt.trim() ? `${customPrompt.trim()}\n\n${section}` : section;
}
