/**
 * Shared AI plumbing for the demos.
 *
 * Resolution order:
 *   1. window.claude.complete (Claude preview surface)
 *   2. POST /api/claude (server-side proxy; live on parkerlee.work when the
 *      ANTHROPIC_API_KEY env var is set on Vercel)
 *   3. null → the calling component falls back to its authored experience
 */

export interface AIMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface CompleteOptions {
  messages: AIMessage[];
  system?: string;
  maxTokens?: number;
}

function previewClaude(): ((opts: { messages: AIMessage[] }) => Promise<string>) | null {
  if (typeof window === 'undefined') return null;
  const c = (window as any).claude;
  return c?.complete ? c.complete.bind(c) : null;
}

/** Returns the model's text, or null if no AI path is available/working. */
export async function aiComplete({ messages, system, maxTokens }: CompleteOptions): Promise<string | null> {
  const preview = previewClaude();
  if (preview) {
    try {
      // The preview surface takes no system param; fold it into the first turn.
      const merged = system
        ? [{ role: 'user' as const, content: `${system}\n\n${messages[0].content}` }, ...messages.slice(1)]
        : messages;
      return await preview({ messages: merged });
    } catch {
      return null;
    }
  }

  try {
    const res = await fetch('/api/claude', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ messages, system, max_tokens: maxTokens }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data.text === 'string' ? data.text : null;
  } catch {
    return null;
  }
}

/** Convenience: single prompt in, parsed JSON out, authored fallback if anything fails. */
export async function aiJSON<T>(prompt: string, fallback: T, system?: string): Promise<T> {
  const txt = await aiComplete({ messages: [{ role: 'user', content: prompt }], system });
  if (!txt) return fallback;
  const m = txt.match(/\{[\s\S]*\}/);
  if (!m) return fallback;
  try {
    return JSON.parse(m[0]) as T;
  } catch {
    return fallback;
  }
}

let livePromise: Promise<boolean> | null = null;

/** Whether a live model is reachable (preview surface or configured proxy). Cached per page load. */
export function aiAvailable(): Promise<boolean> {
  if (previewClaude()) return Promise.resolve(true);
  if (!livePromise) {
    livePromise = fetch('/api/claude')
      .then((r) => (r.ok ? r.json() : { live: false }))
      .then((d) => Boolean(d.live))
      .catch(() => false);
  }
  return livePromise;
}
