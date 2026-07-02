import type { APIRoute } from 'astro';
import Anthropic from '@anthropic-ai/sdk';

export const prerender = false;

/**
 * Server-side proxy for the AI demos (Practice Room, TeamPulse, ManagerCoach,
 * Skill Check). The Anthropic API key lives in a Vercel env var and never
 * reaches the browser. Components send compact {system?, messages} payloads;
 * the proxy validates, rate-limits, and forwards.
 *
 * Configure on Vercel:
 *   ANTHROPIC_API_KEY  (required for live AI; without it demos use their
 *                       authored fallbacks)
 *   CLAUDE_MODEL       (optional, defaults to claude-opus-4-8)
 */

// Read at request time from the serverless runtime env. import.meta.env is
// baked at build time and misses vars added in the Vercel dashboard.
const env = (key: string): string | undefined =>
  (typeof process !== 'undefined' ? process.env?.[key] : undefined) ?? (import.meta.env as any)[key];
const MAX_TOKENS_CAP = 1500;
const MAX_MESSAGES = 40;
const MAX_CHARS_PER_MESSAGE = 8000;
const MAX_SYSTEM_CHARS = 8000;

// Per-IP sliding window. In-memory, so it's per serverless instance — coarse
// but enough to keep a public portfolio from becoming a free API relay.
const WINDOW_MS = 5 * 60 * 1000;
const MAX_PER_WINDOW = 25;
const hits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const list = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (list.length >= MAX_PER_WINDOW) {
    hits.set(ip, list);
    return true;
  }
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 5000) hits.clear(); // crude memory guard
  return false;
}

function sameOrigin(request: Request, url: URL): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return true; // same-origin fetches may omit Origin
  try {
    return new URL(origin).host === url.host;
  } catch {
    return false;
  }
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

// Health check: lets the client know whether live AI is configured without
// spending tokens.
export const GET: APIRoute = () => {
  return json({ live: Boolean(env('ANTHROPIC_API_KEY')) });
};

export const POST: APIRoute = async ({ request, url, clientAddress }) => {
  const apiKey = env('ANTHROPIC_API_KEY');
  if (!apiKey) return json({ error: 'not_configured' }, 503);
  if (!sameOrigin(request, url)) return json({ error: 'forbidden' }, 403);

  let ip = 'unknown';
  try {
    ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || clientAddress || 'unknown';
  } catch {
    /* clientAddress can throw in some runtimes */
  }
  if (rateLimited(ip)) return json({ error: 'rate_limited' }, 429);

  let body: any;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'bad_json' }, 400);
  }

  const { messages, system, max_tokens } = body ?? {};
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > MAX_MESSAGES) {
    return json({ error: 'bad_messages' }, 400);
  }
  for (const m of messages) {
    if (
      !m ||
      (m.role !== 'user' && m.role !== 'assistant') ||
      typeof m.content !== 'string' ||
      m.content.length === 0 ||
      m.content.length > MAX_CHARS_PER_MESSAGE
    ) {
      return json({ error: 'bad_messages' }, 400);
    }
  }
  if (system !== undefined && (typeof system !== 'string' || system.length > MAX_SYSTEM_CHARS)) {
    return json({ error: 'bad_system' }, 400);
  }

  const client = new Anthropic({ apiKey });
  try {
    const response = await client.messages.create({
      model: env('CLAUDE_MODEL') || 'claude-opus-4-8',
      max_tokens: Math.min(Number(max_tokens) || 1024, MAX_TOKENS_CAP),
      ...(system ? { system } : {}),
      messages,
    });
    if (response.stop_reason === 'refusal') {
      return json({ error: 'refused' }, 502);
    }
    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');
    return json({ text });
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) {
      return json({ error: 'upstream_rate_limited' }, 429);
    }
    if (error instanceof Anthropic.APIError) {
      return json({ error: 'upstream_error' }, 502);
    }
    return json({ error: 'unknown' }, 500);
  }
};
