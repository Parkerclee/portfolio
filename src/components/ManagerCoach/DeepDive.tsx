import { useState, useEffect, useRef, useCallback } from 'react';

// ── Types ──────────────────────────────────────────────────────

type Step = 'welcome' | 'context' | 'swipe' | 'scenario' | 'processing' | 'output';

interface ContextOption { v: string; big: string; head: string; sub: string; }
interface ContextQuestion { id: string; q: string; sub: string; multi?: boolean; options: ContextOption[]; }
interface SwipeCardData { id: string; q: string; a: string; b: string; axis: string; }
interface ScenarioOption { v: string; h: string; s: string; }
interface ScenarioData { id: string; setting: string; sub: string; what: string; q: string; options: ScenarioOption[]; }
interface Portrait { archetype: string; tagline: string; traits: string[]; watchout: string; }
interface AgendaItem { time: string; duration: string; label: string; title: string; say: string; note: string; }
interface IfThenItem { if: string; then: string; }
interface Meeting { title: string; subtitle: string; agenda: AgendaItem[]; ifthen: IfThenItem[]; open: string; close: string; }

interface AppState {
  step: Step;
  name: string;
  context: Record<string, string | string[]>;
  swipes: Record<string, 'a' | 'b'>;
  scenarios: Record<string, string>;
  cardIdx: number;
  scenIdx: number;
  contextIdx: number;
  portrait: Portrait | null;
  meeting: Meeting | null;
}

// ── Data ───────────────────────────────────────────────────────

const CONTEXT_QUESTIONS: ContextQuestion[] = [
  {
    id: 'size', q: 'How big is the room you walk into?', sub: 'Tap the size that matches your direct reports.',
    options: [
      { v: '2-3',   big: '2–3',   head: 'Tight pod',   sub: '1:1 vibes, low ceremony' },
      { v: '4-6',   big: '4–6',   head: 'Small team',  sub: 'Where most new managers start' },
      { v: '7-10',  big: '7–10',  head: 'Mid-size',    sub: 'Process starts to matter' },
      { v: '11-15', big: '11+',   head: 'Big team',    sub: 'Sub-leads emerging' },
      { v: 'mixed', big: '?',     head: 'Mixed',       sub: 'Matrix / contractors' },
      { v: '16+',   big: '16+',   head: 'Org',         sub: 'Managing managers' },
    ],
  },
  {
    id: 'industry', q: 'Where do you work?', sub: 'Helps us tune tone and references.',
    options: [
      { v: 'tech',      big: '💻', head: 'Tech / Software',       sub: 'SaaS, dev tools, platforms' },
      { v: 'services',  big: '🤝', head: 'Services / Agency',     sub: 'Consulting, creative, freelance' },
      { v: 'finance',   big: '$$', head: 'Finance',               sub: 'Banking, fintech, insurance' },
      { v: 'health',    big: '✚',  head: 'Healthcare',            sub: 'Hospitals, pharma, biotech' },
      { v: 'retail',    big: '🛍', head: 'Retail / E-comm',       sub: 'Consumer products' },
      { v: 'edu',       big: '🎓', head: 'Education / Non-profit', sub: 'Schools, mission-driven' },
      { v: 'media',     big: '📣', head: 'Media / Marketing',     sub: 'Brands, content, ads' },
      { v: 'industry',  big: '🏭', head: 'Manufacturing / Ops',   sub: 'Physical products, logistics' },
      { v: 'other',     big: '✶',  head: 'Something else',        sub: 'Tell us more' },
    ],
  },
  {
    id: 'role', q: 'Your role on Thursday?', sub: 'Who\'s running this meeting.',
    options: [
      { v: 'people',   big: 'PM',  head: 'People manager',   sub: 'Direct reports, performance' },
      { v: 'project',  big: 'PJ',  head: 'Project lead',     sub: 'Cross-functional, time-bound' },
      { v: 'tech',     big: 'TL',  head: 'Technical lead',   sub: 'Player-coach setup' },
      { v: 'function', big: 'FN',  head: 'Function head',    sub: 'Marketing, design, ops, etc.' },
      { v: 'exec',     big: 'EX',  head: 'Senior leader',    sub: 'Managing managers' },
      { v: 'founder',  big: 'FDR', head: 'Founder / Owner',  sub: 'Running the whole thing' },
    ],
  },
  {
    id: 'meeting', q: 'Which Thursday are we planning?', sub: 'Pick the meeting that\'s on your mind.',
    options: [
      { v: 'standup', big: '🌅', head: 'Team standup',     sub: 'Weekly sync · 30 min' },
      { v: 'review',  big: '🔍', head: 'Project review',   sub: 'Pulling back the curtain' },
      { v: 'retro',   big: '↺',  head: 'Retro',            sub: 'What\'s working / not' },
      { v: 'kickoff', big: '🚀', head: 'Kickoff',          sub: 'New project, new vibes' },
      { v: '1on1',    big: '👥', head: 'Skip-level group', sub: 'Skip-level Q&A' },
      { v: 'town',    big: '📣', head: 'All-hands · team', sub: 'You + everyone' },
    ],
  },
  {
    id: 'tools', q: 'Your stack on the day?', sub: 'We\'ll wire references into the agenda.', multi: true,
    options: [
      { v: 'slack',    big: '💬', head: 'Slack / Teams', sub: 'Async chatter' },
      { v: 'tracker',  big: '△',  head: 'Project tool',  sub: 'Linear, Jira, Asana, ClickUp' },
      { v: 'docs',     big: '🗂', head: 'Docs',          sub: 'Notion, Confluence, Google' },
      { v: 'code',     big: '⌥',  head: 'Code / repo',   sub: 'GitHub, GitLab' },
      { v: 'design',   big: '▽',  head: 'Design tool',   sub: 'Figma, Sketch' },
      { v: 'video',    big: '📹', head: 'Video call',    sub: 'Zoom, Meet, Teams' },
      { v: 'email',    big: '✉',  head: 'Email',         sub: 'Outlook, Gmail' },
      { v: 'calendar', big: '📅', head: 'Calendar',      sub: 'For invites + agendas' },
    ],
  },
];

const SWIPE_CARDS: SwipeCardData[] = [
  { id: 'agenda',   q: 'Pre-meeting prep style?',              a: 'Detailed written agenda',       b: 'Loose talking points',        axis: 'structured' },
  { id: 'camera',   q: 'Defaults on Zoom?',                    a: 'Cameras on, full attention',    b: 'Cameras off, focus on talk',  axis: 'live' },
  { id: 'praise',   q: 'When someone ships big?',              a: 'Shout out in the meeting',      b: 'DM them privately',           axis: 'diplomatic' },
  { id: 'tempo',    q: 'Default meeting length?',              a: 'Tight 25 — under by design',    b: 'Full hour to actually talk',  axis: 'decisive' },
  { id: 'decide',   q: 'Team split 3/3 on a call?',            a: 'I make it. Move on.',           b: 'Async vote, ship tomorrow',   axis: 'decisive' },
  { id: 'open',     q: 'First 5 minutes?',                     a: 'Quick win to warm the room',    b: 'Straight to the hard one',    axis: 'direct' },
  { id: 'conflict', q: 'Two reports clash in a meeting?',      a: 'Address it in the room',        b: 'Park it, fix in 1:1',         axis: 'direct' },
  { id: 'input',    q: 'How do you collect input?',            a: 'Round-robin, everyone speaks',  b: 'Whoever brings it, brings it', axis: 'structured' },
  { id: 'miss',     q: 'Someone misses a deadline?',           a: 'Quick async ping',              b: 'Pull them aside',             axis: 'diplomatic' },
  { id: 'async',    q: 'Status updates work best when?',       a: 'Written async on Monday',       b: 'Live in the meeting',         axis: 'live' },
];

const SCENARIOS: ScenarioData[] = [
  {
    id: 'pushback', setting: 'Tuesday standup', sub: 'You · 5 engineers · Zoom · cameras on',
    what: 'Mid-update, **Jordan** cuts in: *"I don\'t think the roadmap makes sense — we\'re building the wrong thing."* The room goes quiet. Cameras are on.',
    q: 'What do you do?',
    options: [
      { v: 'address', h: 'Address it now, in the room', s: 'Pause the standup. Hear Jordan out. Pull the team in.' },
      { v: 'park',    h: 'Park it, 1:1 after',          s: '"That\'s worth a real convo — let\'s hit pause and dig in after."' },
      { v: 'defend',  h: 'Defend the roadmap',          s: 'Quickly remind the team why this work matters, move on.' },
      { v: 'open',    h: 'Ask the room',                s: '"Does anyone else feel this way?" Open it up.' },
    ],
  },
  {
    id: 'silence', setting: 'Thursday review', sub: 'You · 6 reports · 25 min in',
    what: 'You ask, "What\'s getting in the way this week?" Five seconds of silence. Ten. Nobody types. Nobody unmutes.',
    q: 'What do you do?',
    options: [
      { v: 'name',  h: 'Call on someone by name', s: '"Priya, what\'s on your plate that\'s tough?"' },
      { v: 'share', h: 'Share your own first',    s: 'Model the vulnerability — say what\'s hard for YOU.' },
      { v: 'switch',h: 'Switch modes',            s: '"Let\'s drop it in Slack instead — back to roadmap."' },
      { v: 'wait',  h: 'Sit in the silence',      s: 'Hold it. Someone will eventually fill the gap.' },
    ],
  },
];

const DEFAULT_STATE: AppState = {
  step: 'welcome', name: '', context: {}, swipes: {}, scenarios: {},
  cardIdx: 0, scenIdx: 0, contextIdx: 0, portrait: null, meeting: null,
};

// ── Style meter ─────────────────────────────────────────────────

function deriveMeters(swipes: Record<string, string>) {
  const axes: Record<string, number> = { structured: 0.5, live: 0.5, diplomatic: 0.5, decisive: 0.5, direct: 0.5 };
  const counts: Record<string, number> = { structured: 0, live: 0, diplomatic: 0, decisive: 0, direct: 0 };
  for (const card of SWIPE_CARDS) {
    const choice = swipes[card.id];
    if (!choice) continue;
    counts[card.axis] = (counts[card.axis] || 0) + 1;
    axes[card.axis] = (axes[card.axis] || 0) + (choice === 'a' ? 1 : 0);
  }
  const out: Record<string, number> = {};
  for (const k of Object.keys(axes)) {
    out[k] = counts[k] > 0 ? axes[k] / counts[k] : 0.5;
  }
  return out;
}

// ── AI helpers ─────────────────────────────────────────────────

async function callJSON<T>(prompt: string, fallback: T): Promise<T> {
  const claude = (window as any).claude;
  if (!claude?.complete) return fallback;
  try {
    const txt = await claude.complete({ messages: [{ role: 'user', content: prompt }] });
    const m = txt.match(/\{[\s\S]*\}/);
    if (!m) throw new Error('no json');
    return JSON.parse(m[0]) as T;
  } catch {
    return fallback;
  }
}

async function generatePortrait(state: AppState): Promise<Portrait> {
  const swipeSummary = SWIPE_CARDS
    .filter(c => state.swipes[c.id])
    .map(c => `${c.q} → ${state.swipes[c.id] === 'a' ? c.a : c.b}`)
    .join('\n');
  const scenSummary = SCENARIOS
    .filter(s => state.scenarios[s.id])
    .map(s => {
      const choice = s.options.find(o => o.v === state.scenarios[s.id]);
      return `${s.setting}: ${choice?.h || ''}`;
    }).join('\n');

  return callJSON<Portrait>(
    `You are a leadership coach building a personalized portrait of a first-time manager. Be warm, specific, slightly wry. NO corporate fluff.\n\nNAME: ${state.name || 'the manager'}\nCONTEXT: ${JSON.stringify(state.context)}\nTHEIR SWIPES:\n${swipeSummary}\nTHEIR SCENARIO CHOICES:\n${scenSummary}\n\nReturn ONLY a JSON object:\n{"archetype":"2-word punchy nickname","tagline":"one short sentence","traits":["3 specific traits"],"watchout":"one specific watchout in 1 sentence"}`,
    {
      archetype: 'The Builder',
      tagline: 'Direct, structured, decision-forward — you don\'t waste a minute.',
      traits: [
        'Sets a tight agenda before the meeting starts',
        'Owns the call when the team splits',
        'Praises in private, fixes in public',
      ],
      watchout: 'Your bias toward decisiveness can shut down dissent before it surfaces — build in two "do you all agree?" beats.',
    }
  );
}

async function generateMeeting(state: AppState): Promise<Meeting> {
  const meetingType = CONTEXT_QUESTIONS[3].options.find(o => o.v === state.context.meeting)?.head || 'Team standup';
  const role = CONTEXT_QUESTIONS[2].options.find(o => o.v === state.context.role)?.head || 'Manager';
  const size = CONTEXT_QUESTIONS[0].options.find(o => o.v === state.context.size)?.head || 'Small team';
  const tools = ((state.context.tools as string[]) || [])
    .map(t => CONTEXT_QUESTIONS[4].options.find(o => o.v === t)?.head).filter(Boolean).join(', ');
  const portrait = state.portrait || { archetype: 'The Builder', tagline: '' };
  const swipeSummary = SWIPE_CARDS.filter(c => state.swipes[c.id])
    .map(c => `${c.id}: ${state.swipes[c.id] === 'a' ? c.a : c.b}`).join('; ');

  return callJSON<Meeting>(
    `Write a meeting plan that sounds like ${state.name || 'this manager'} wrote it. Archetype: "${portrait.archetype}". Meeting: ${meetingType}. Role: ${role}. Size: ${size}. Tools: ${tools || 'Slack, Linear'}. Style: ${swipeSummary}.\n\nReturn ONLY JSON: {"title":"...","subtitle":"...","agenda":[{"time":"0:00","duration":"1 min","label":"CAPS","title":"3-6 words","say":"script line","note":"coach note"}],"ifthen":[{"if":"...","then":"..."}],"open":"...","close":"..."}`,
    {
      title: 'Thursday Sync',
      subtitle: '30 min · one big topic · ship by 10:28',
      agenda: [
        { time: '0:00', duration: '1 min',  label: 'LAND',   title: 'Open the room',   say: 'Quick one today. One big topic. I\'ll keep us tight.',                                    note: 'Stand up. Don\'t sit until you\'ve named the agenda.' },
        { time: '0:01', duration: '12 min', label: 'FOCUS',  title: 'The one thing',   say: 'Priya, walk us through Linear forty-eight twenty-one. I\'m staying quiet for the first three.', note: 'You swiped "address it in the room." This is where that lives.' },
        { time: '0:13', duration: '10 min', label: 'OPEN',   title: 'Round the room',  say: 'One thing each. Stuck, not solved.',                                                     note: 'Hard rule — no solutioning until everyone speaks.' },
        { time: '0:23', duration: '5 min',  label: 'DECIDE', title: 'Pick the path',   say: 'Three paths on the board. We pick one by ten twenty-eight.',                             note: 'Your Closer move — own the call if it splits 3/3.' },
        { time: '0:28', duration: '2 min',  label: 'CLOSE',  title: 'Close + thanks',  say: 'Decisions are in Linear. DMs welcome. Thanks team.',                                    note: 'You swiped "praise privately" — DM Priya in the next 30 min.' },
      ],
      ifthen: [
        { if: 'Jordan pushes back again',    then: '"Park it — let\'s hit that in a 1:1 today."' },
        { if: 'Round-robin stalls',          then: '"Skip, come back. Nina, you\'re up."' },
        { if: 'We\'re over time at :28',     then: '"Cutting. Decisions move to Slack — I\'ll start the thread."' },
      ],
      open: 'Thursday Sync. One topic. Tight.',
      close: 'Decisions are in Linear. DMs welcome. Thanks team.',
    }
  );
}

// ── Shared primitives ──────────────────────────────────────────

function Sun({ style }: { style?: React.CSSProperties }) {
  return <div className="sun" style={style}></div>;
}

function DotTyping({ color = 'currentColor' }: { color?: string }) {
  return (
    <span className="dd-typing" style={{ color }}>
      <i></i><i></i><i></i>
    </span>
  );
}

function renderMarkdown(txt: string) {
  const parts = txt.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/);
  return parts.map((p, i) => {
    if (p.startsWith('**')) return <strong key={i}>{p.slice(2, -2)}</strong>;
    if (p.startsWith('*'))  return <em key={i}>{p.slice(1, -1)}</em>;
    return <span key={i}>{p}</span>;
  });
}

// ── Scene: Welcome ─────────────────────────────────────────────

function SceneWelcome({ state, set, next }: { state: AppState; set: (p: Partial<AppState>) => void; next: () => void }) {
  const [name, setName] = useState(state.name);
  const valid = name.trim().length > 0;

  const onStart = () => {
    set({ name: name.trim() });
    next();
  };

  return (
    <div className="dd-welcome">
      <div>
        <span className="tag solid">A 12-MIN COACHING WALK</span>
        <h1 className="display">
          Hey there.<br />
          Let's plan<br />
          <em>your Thursday.</em>
        </h1>
        <p style={{ fontSize: 17, lineHeight: 1.5, color: 'var(--ink-2)', maxWidth: 460, margin: '0 0 8px' }}>
          We'll swipe through a few cards, sit with two tough moments, and at the end you'll have a meeting plan in your voice.
        </p>

        <div className="dd-name-input">
          <label htmlFor="dd-name">YOUR NAME</label>
          <input
            id="dd-name"
            autoFocus
            placeholder="Alex"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && valid) onStart(); }}
          />
        </div>

        <div style={{ display: 'flex', gap: 12, marginTop: 22, alignItems: 'center' }}>
          <button className="btn primary big" onClick={onStart} disabled={!valid}>Let's go →</button>
          <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>10 cards · ~12 min · pause anytime</span>
        </div>
      </div>

      <div className="dd-welcome-tiles">
        {[
          { label: 'CH. 1 · CONTEXT', title: 'Your room.', bg: 'var(--mustard)', color: 'var(--dark-fixed)',
            extra: <div style={{ display: 'flex', gap: 6, marginTop: 'auto' }}>{[1,2,3,4].map(i => <div key={i} style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--dark-fixed)', opacity: 0.85 - i * 0.18 }}></div>)}</div> },
          { label: 'CH. 2 · CARDS', title: 'Would you rather?', bg: 'var(--terracotta)', color: 'var(--cream-fixed)',
            extra: <div style={{ marginTop: 'auto', display: 'flex', gap: 6 }}><div style={{ flex: 1, height: 28, background: 'var(--cream-fixed)', borderRadius: 999, border: '1.5px solid var(--dark-fixed)' }}></div><div style={{ flex: 1, height: 28, background: 'var(--mustard)', borderRadius: 999, border: '1.5px solid var(--dark-fixed)' }}></div></div> },
          { label: 'CH. 3 · SCENARIOS', title: 'What would you do?', bg: 'var(--avocado)', color: 'var(--cream-fixed)',
            extra: <div style={{ marginTop: 'auto', fontSize: 12, fontStyle: 'italic', opacity: 0.95 }}>"I don't think the roadmap makes sense…"</div> },
          { label: 'OUT · YOUR PLAN', title: 'Meeting deck.', bg: 'var(--sky)', color: 'var(--dark-fixed)',
            extra: <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 4, marginTop: 'auto' }}><div className="line short"></div><div className="line med"></div><div className="line long"></div></div> },
        ].map(t => (
          <div key={t.label} className="dd-welcome-tile" style={{ background: t.bg, color: t.color }}>
            <span className="label">{t.label}</span>
            <div className="display">{t.title}</div>
            {t.extra}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Scene: Context ─────────────────────────────────────────────

function SceneContext({ state, set, next, back }: { state: AppState; set: (p: Partial<AppState>) => void; next: () => void; back: () => void }) {
  const idx = state.contextIdx || 0;
  const q = CONTEXT_QUESTIONS[idx];
  const ctx = state.context || {};
  const isMulti = !!q.multi;
  const currentVal = ctx[q.id] as string | string[] | undefined;
  const pickedSet = isMulti ? new Set(currentVal as string[] || []) : null;

  const coachNotes = [
    'Size shapes whether you run the meeting or facilitate it.',
    'Different industries have different rhythms — we tune the script.',
    'We\'ll match patterns from managers in your role.',
    'Every meeting type has a different shape.',
    'Tool references go straight into the agenda.',
  ];

  const pick = (v: string) => {
    if (isMulti) {
      const s = new Set(currentVal as string[] || []);
      if (s.has(v)) s.delete(v); else s.add(v);
      set({ context: { ...ctx, [q.id]: [...s] } });
    } else {
      set({ context: { ...ctx, [q.id]: v } });
      setTimeout(() => advance(), 250);
    }
  };

  const advance = () => {
    if (idx + 1 < CONTEXT_QUESTIONS.length) set({ contextIdx: idx + 1 });
    else next();
  };

  const goBack = () => {
    if (idx > 0) set({ contextIdx: idx - 1 });
    else back();
  };

  const canAdvance = isMulti ? (currentVal as string[] || []).length > 0 : !!currentVal;

  return (
    <div className="dd-context">
      <div className="dd-context-q">
        <span className="tag">CONTEXT · {idx + 1} / {CONTEXT_QUESTIONS.length}</span>
        <h2 className="display">{q.q}</h2>
        <p style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.45, maxWidth: 280 }}>{q.sub}</p>

        <div className="card" style={{ marginTop: 24, padding: 16, background: 'var(--ink)', color: 'var(--paper)', borderColor: 'var(--ink)' }}>
          <div style={{ fontSize: 10, opacity: 0.7, letterSpacing: '0.12em', textTransform: 'uppercase' as const }}>Why we ask</div>
          <div style={{ fontSize: 13, marginTop: 6, lineHeight: 1.4 }}>{coachNotes[idx]}</div>
        </div>

        <div className="dd-actions" style={{ marginTop: 28 }}>
          <button className="btn ghost" onClick={goBack}>← Back</button>
          {isMulti && (
            <button className="btn primary" onClick={advance} disabled={!canAdvance}>
              {idx + 1 < CONTEXT_QUESTIONS.length ? 'Next →' : 'Start swiping →'}
            </button>
          )}
        </div>
      </div>

      <div>
        <div className="dd-context-grid">
          {q.options.map(o => {
            const on = isMulti ? pickedSet!.has(o.v) : currentVal === o.v;
            return (
              <button key={o.v} className={`dd-pick ${on ? 'on' : ''}`} onClick={() => pick(o.v)}>
                <div className="big">{o.big}</div>
                <div className="head">{o.head}</div>
                <div className="sub">{o.sub}</div>
                {on && <span className="stamp" style={{ position: 'absolute', top: 12, right: 12 }}>{isMulti ? '+' : 'PICKED'}</span>}
              </button>
            );
          })}
        </div>

        <div className="dd-chapter-rail">
          {CONTEXT_QUESTIONS.map((cq, i) => {
            const v = ctx[cq.id];
            const filled = Array.isArray(v) ? v.length > 0 : !!v;
            const label = filled
              ? (Array.isArray(v) ? `${v.length} picked` : (cq.options.find(o => o.v === v)?.head || String(v)))
              : '—';
            return (
              <div key={cq.id} className={`dd-rail-item ${filled ? 'done' : ''} ${i === idx ? 'active' : ''}`}>
                <div className="k">{cq.id.toUpperCase()}</div>
                <div className="v">{label}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Scene: Swipe ───────────────────────────────────────────────

function SceneSwipe({ state, set, next, back }: { state: AppState; set: (p: Partial<AppState>) => void; next: () => void; back: () => void }) {
  const idx = state.cardIdx || 0;
  const cards = SWIPE_CARDS;
  const allDone = idx >= cards.length;
  const card = cards[idx];
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const [drag, setDrag] = useState({ x: 0, y: 0, active: false });
  const [flying, setFlying] = useState<'left' | 'right' | null>(null);
  const [editing, setEditing] = useState(false);

  const meters = deriveMeters(state.swipes);

  const choose = useCallback((choice: 'a' | 'b') => {
    if (flying || !card) return;
    setFlying(choice === 'a' ? 'left' : 'right');
    setTimeout(() => {
      const newSwipes = { ...state.swipes, [card.id]: choice };
      if (editing) {
        set({ swipes: newSwipes, cardIdx: cards.length });
        setEditing(false);
      } else {
        set({ swipes: newSwipes, cardIdx: idx + 1 });
      }
      setFlying(null);
      setDrag({ x: 0, y: 0, active: false });
    }, 280);
  }, [card, idx, state.swipes, set, flying, editing, cards.length]);

  const undo = () => {
    if (allDone) return;
    if (idx === 0) { back(); return; }
    const prev = cards[idx - 1];
    const newSwipes = { ...state.swipes };
    delete newSwipes[prev.id];
    set({ swipes: newSwipes, cardIdx: idx - 1 });
  };

  useEffect(() => {
    if (allDone) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return;
      if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'a') choose('a');
      else if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'b') choose('b');
      else if (e.key === 'Backspace' || e.key.toLowerCase() === 'u') undo();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [choose, allDone]);

  // Review mode
  if (allDone) {
    const swipedCount = Object.keys(state.swipes).length;
    return (
      <div style={{ padding: '32px 80px 40px', height: '100%', overflow: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20 }}>
          <div>
            <span className="tag">CARDS COMPLETE · REVIEW</span>
            <h2 className="display" style={{ fontSize: 38, lineHeight: 1, margin: '8px 0 4px' }}>
              You swiped {swipedCount} of {cards.length}.
            </h2>
            <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>Tap a card to re-swipe it. Or keep moving.</div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn ghost" onClick={back}>← Back to context</button>
            <button className="btn primary" onClick={next}>Continue to scenarios →</button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 18, marginBottom: 28 }}>
          {[['Direct ↔ Diplomatic', 'direct'], ['Structured ↔ Loose', 'structured'], ['Decide ↔ Discuss', 'decisive'], ['Live ↔ Async', 'live']].map(([label, key]) => (
            <div key={key}>
              <div style={{ fontSize: 10, color: 'var(--ink-3)', textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: 4 }}>{label}</div>
              <div className="dd-meter" style={{ '--v': `${meters[key] * 100}%` } as React.CSSProperties}>
                <div className="dd-meter-fill"></div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
          {cards.map((c, i) => {
            const pick = state.swipes[c.id];
            const text = pick === 'a' ? c.a : pick === 'b' ? c.b : null;
            return (
              <button key={c.id} onClick={() => { setEditing(true); set({ cardIdx: i }); }}
                style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 14, alignItems: 'center', padding: '12px 14px', border: '1.5px solid var(--line-2)', borderRadius: 12, background: 'var(--paper)', color: 'var(--ink)', cursor: 'pointer', font: 'inherit', textAlign: 'left' as const }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--ink)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--line-2)'; }}
              >
                <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, color: 'var(--ink-3)', width: 22 }}>{String(i + 1).padStart(2, '0')}</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>{c.q}</div>
                  {text ? <span className={`pill ${pick === 'a' ? 'mustard' : 'avocado'}`} style={{ fontSize: 11, padding: '2px 8px' }}>{text}</span>
                        : <span style={{ fontSize: 11, color: 'var(--ink-3)', fontStyle: 'italic' }}>not picked</span>}
                </div>
                <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>edit →</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const onDown = (e: React.MouseEvent | React.TouchEvent) => {
    if (flying) return;
    const p = 'touches' in e ? e.touches[0] : e;
    startRef.current = { x: p.clientX, y: p.clientY };
    setDrag({ x: 0, y: 0, active: true });
  };
  const onMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!startRef.current) return;
    const p = 'touches' in e ? e.touches[0] : e;
    setDrag({ x: p.clientX - startRef.current.x, y: (p.clientY - startRef.current.y) * 0.3, active: true });
  };
  const onUp = () => {
    if (!startRef.current) return;
    const threshold = 110;
    if (drag.x < -threshold) choose('a');
    else if (drag.x > threshold) choose('b');
    else setDrag({ x: 0, y: 0, active: false });
    startRef.current = null;
  };

  const r = Math.max(-18, Math.min(18, drag.x / 12));
  const cardTransform = drag.active ? `translate(${drag.x}px, ${drag.y}px) rotate(${r}deg)` : undefined;
  const nextCard = cards[idx + 1];
  const next2 = cards[idx + 2];
  const hintIntensity = Math.min(1, Math.abs(drag.x) / 180);

  return (
    <div className="dd-swipe">
      <div className="dd-swipe-side left">
        <button className="dd-arrow" onClick={() => choose('a')} aria-label={`Pick: ${card.a}`}
          style={drag.x < -30 ? { transform: `scale(${1 + hintIntensity * 0.15})` } : undefined}>←</button>
        <div style={{ fontSize: 14, fontWeight: 700 }}>{card.a}</div>
        <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>Press <b>A</b> · or swipe left</div>
      </div>

      <div style={{ width: '100%' }}>
        {editing && (
          <div style={{ marginBottom: 12, padding: '8px 14px', background: 'var(--terracotta)', color: 'var(--cream-fixed)', borderRadius: 999, fontSize: 12, fontWeight: 600, textAlign: 'center' as const }}>
            ✎ Editing card {idx + 1} · pick again
          </div>
        )}

        <div className="dd-card-stage">
          {!editing && next2 && (
            <div className="dd-swipe-card behind-2">
              <div className="dd-card-head"><span className="tag">WOULD YOU RATHER</span><span style={{ fontSize: 11, color: 'var(--ink-3)', fontFamily: "'Space Mono', monospace" }}>{idx + 3}/{cards.length}</span></div>
              <div className="dd-card-q">{next2.q}</div>
              <div className="dd-card-options"><div className="dd-card-option a">{next2.a}</div><div className="dd-card-option b">{next2.b}</div></div>
            </div>
          )}
          {!editing && nextCard && (
            <div className="dd-swipe-card behind-1">
              <div className="dd-card-head"><span className="tag">WOULD YOU RATHER</span><span style={{ fontSize: 11, color: 'var(--ink-3)', fontFamily: "'Space Mono', monospace" }}>{idx + 2}/{cards.length}</span></div>
              <div className="dd-card-q">{nextCard.q}</div>
              <div className="dd-card-options"><div className="dd-card-option a">{nextCard.a}</div><div className="dd-card-option b">{nextCard.b}</div></div>
            </div>
          )}

          <div
            className={`dd-swipe-card ${drag.active ? 'dragging' : ''} ${flying ? `flying-${flying}` : ''}`}
            style={cardTransform ? { transform: cardTransform } : undefined}
            onMouseDown={onDown} onMouseMove={drag.active ? onMove : undefined}
            onMouseUp={onUp} onMouseLeave={drag.active ? onUp : undefined}
            onTouchStart={onDown} onTouchMove={onMove} onTouchEnd={onUp}
          >
            <div className="dd-card-head">
              <span className="tag">WOULD YOU RATHER</span>
              <span style={{ fontSize: 11, color: 'var(--ink-3)', fontFamily: "'Space Mono', monospace" }}>{idx + 1}/{cards.length}</span>
            </div>
            <div className="dd-card-q">{card.q}</div>
            <div className="dd-card-options">
              <button className="dd-card-option a" onClick={e => { e.stopPropagation(); choose('a'); }}>{card.a}</button>
              <button className="dd-card-option b" onClick={e => { e.stopPropagation(); choose('b'); }}>{card.b}</button>
            </div>

            {drag.x < -30 && (
              <div style={{ position: 'absolute', top: 20, left: 20, padding: '6px 12px', border: '2px solid var(--mustard)', color: 'var(--mustard)', borderRadius: 6, fontFamily: "'Bagel Fat One', serif", letterSpacing: '0.1em', transform: 'rotate(-8deg)', opacity: hintIntensity }}>A</div>
            )}
            {drag.x > 30 && (
              <div style={{ position: 'absolute', top: 20, right: 20, padding: '6px 12px', border: '2px solid var(--avocado)', color: 'var(--avocado)', borderRadius: 6, fontFamily: "'Bagel Fat One', serif", letterSpacing: '0.1em', transform: 'rotate(8deg)', opacity: hintIntensity }}>B</div>
            )}
          </div>
        </div>

        <div className="dd-card-dots">
          {cards.map((c, i) => (
            <div key={c.id} className={`dd-card-dot ${state.swipes[c.id] ? 'done' : ''} ${i === idx ? 'cur' : ''}`}></div>
          ))}
        </div>

        <div className="dd-actions" style={{ marginTop: 16, justifyContent: 'center', gap: 12 }}>
          <button className="btn ghost" onClick={undo} style={{ padding: '8px 14px', fontSize: 12 }}>↩ Undo</button>
          {editing
            ? <button className="btn ghost" onClick={() => { setEditing(false); set({ cardIdx: cards.length }); }} style={{ padding: '8px 14px', fontSize: 12 }}>Cancel edit</button>
            : <button className="btn ghost" onClick={() => set({ cardIdx: cards.length })} style={{ padding: '8px 14px', fontSize: 12 }}>⏭ Skip remaining</button>
          }
        </div>
      </div>

      <div className="dd-swipe-side right">
        <button className="dd-arrow" onClick={() => choose('b')} aria-label={`Pick: ${card.b}`}
          style={drag.x > 30 ? { transform: `scale(${1 + hintIntensity * 0.15})` } : undefined}>→</button>
        <div style={{ fontSize: 14, fontWeight: 700 }}>{card.b}</div>
        <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>Press <b>B</b> · or swipe right</div>

        <div style={{ marginTop: 22, width: '100%' }}>
          <div className="dd-swipe-meter">
            <div className="head">EMERGING STYLE</div>
            {[['Direct ↔ Diplomatic', 'direct'], ['Structured ↔ Loose', 'structured'], ['Decide ↔ Discuss', 'decisive'], ['Live ↔ Async', 'live']].map(([label, key]) => (
              <div key={key} style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 10, color: 'var(--ink-3)', textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: 3 }}>{label}</div>
                <div className="dd-meter" style={{ '--v': `${meters[key] * 100}%` } as React.CSSProperties}><div className="dd-meter-fill"></div></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Scene: Scenario ────────────────────────────────────────────

function SceneScenario({ state, set, next, back }: { state: AppState; set: (p: Partial<AppState>) => void; next: () => void; back: () => void }) {
  const idx = state.scenIdx || 0;
  const allDone = idx >= SCENARIOS.length;
  const scn = SCENARIOS[idx];
  const [editing, setEditing] = useState(false);

  const pick = (v: string) => {
    const newScen = { ...state.scenarios, [scn.id]: v };
    if (editing) { set({ scenarios: newScen, scenIdx: SCENARIOS.length }); setEditing(false); }
    else set({ scenarios: newScen, scenIdx: idx + 1 });
  };

  const goBack = () => {
    if (idx > 0) set({ scenIdx: idx - 1 });
    else back();
  };

  if (allDone) {
    return (
      <div style={{ padding: '32px 80px 40px', height: '100%', overflow: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24 }}>
          <div>
            <span className="tag">SCENARIOS COMPLETE · REVIEW</span>
            <h2 className="display" style={{ fontSize: 38, lineHeight: 1, margin: '8px 0 4px' }}>You made your calls.</h2>
            <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>Tap a scenario to redo it. Or generate your plan.</div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn ghost" onClick={back}>← Back to cards</button>
            <button className="btn primary" onClick={next}>Build my plan →</button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {SCENARIOS.map((s, i) => {
            const choiceV = state.scenarios[s.id];
            const o = s.options.find(x => x.v === choiceV);
            const colorIdx = s.options.findIndex(x => x.v === choiceV);
            const bgs = ['var(--terracotta)', 'var(--mustard)', 'var(--teal)', 'var(--avocado)'];
            const fgs = ['var(--cream-fixed)', 'var(--dark-fixed)', 'var(--cream-fixed)', 'var(--cream-fixed)'];
            return (
              <button key={s.id} onClick={() => { setEditing(true); set({ scenIdx: i }); }}
                style={{ display: 'flex', flexDirection: 'column' as const, gap: 10, padding: 18, border: '1.5px solid var(--line-2)', borderRadius: 16, background: 'var(--paper)', color: 'var(--ink)', cursor: 'pointer', font: 'inherit', textAlign: 'left' as const }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--ink)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--line-2)'; }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="tag">📼 SCENE 0{i + 1}</span>
                  <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>edit →</span>
                </div>
                <div className="display" style={{ fontSize: 22, lineHeight: 1 }}>{s.setting}</div>
                {o ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Bagel Fat One', serif", fontSize: 16, border: '2px solid var(--ink)', background: bgs[colorIdx], color: fgs[colorIdx], flex: 'none' }}>{String.fromCharCode(65 + colorIdx)}</div>
                    <div><div style={{ fontSize: 13, fontWeight: 700 }}>{o.h}</div><div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{o.s}</div></div>
                  </div>
                ) : <div style={{ fontSize: 12, color: 'var(--ink-3)', fontStyle: 'italic' }}>not picked</div>}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const bgs = ['var(--terracotta)', 'var(--mustard)', 'var(--teal)', 'var(--avocado)'];
  const fgs = ['var(--cream-fixed)', 'var(--dark-fixed)', 'var(--cream-fixed)', 'var(--cream-fixed)'];

  return (
    <div className="dd-scenario">
      <div style={{ position: 'relative' }}>
        {editing && (
          <div style={{ marginBottom: 12, padding: '8px 14px', background: 'var(--terracotta)', color: 'var(--cream-fixed)', borderRadius: 999, fontSize: 12, fontWeight: 600, textAlign: 'center' as const }}>
            ✎ Editing scene {idx + 1} · pick again
          </div>
        )}
        <div className="dd-film">
          <div className="dd-film-head">
            <span>📼 SCENE 0{idx + 1}</span>
            <span style={{ opacity: 0.6 }}>0:{(42 + idx * 8) % 60} / 1:00</span>
          </div>
          <div className="dd-film-frame">
            <span className="stamp">FRESH</span>
            <div style={{ fontSize: 11, opacity: 0.7, letterSpacing: '0.12em', textTransform: 'uppercase' as const }}>setting</div>
            <div className="display">{scn.setting}</div>
            <div style={{ fontSize: 13, opacity: 0.8 }}>{scn.sub}</div>
          </div>
          <div className="dd-film-body">
            <div className="who">What happens</div>
            <div className="what">{renderMarkdown(scn.what)}</div>
          </div>
        </div>

        <div className="bubble" style={{ marginTop: 22, marginLeft: 20 }}>
          Take a breath. No perfect answer — we're learning your instinct.
        </div>
      </div>

      <div>
        <span className="tag">YOUR MOVE · {idx + 1} OF {SCENARIOS.length}</span>
        <h3 className="display" style={{ fontSize: 30, lineHeight: 1, margin: '10px 0 18px' }}>{scn.q}</h3>

        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 10 }}>
          {scn.options.map((o, i) => {
            const isPicked = state.scenarios[scn.id] === o.v;
            return (
              <button key={o.v} className="dd-choice" onClick={() => pick(o.v)}
                style={isPicked ? { outline: '3px solid var(--ink)', outlineOffset: 2 } : undefined}>
                <div className="badge" style={{ background: bgs[i], color: fgs[i] }}>{String.fromCharCode(65 + i)}</div>
                <div className="body"><div className="h">{o.h}</div><div className="s">{o.s}</div></div>
                <span className="arr">→</span>
              </button>
            );
          })}
        </div>

        <div className="dd-actions" style={{ marginTop: 18 }}>
          {editing
            ? <button className="btn ghost" onClick={() => { setEditing(false); set({ scenIdx: SCENARIOS.length }); }}>Cancel edit</button>
            : <button className="btn ghost" onClick={goBack}>← Back</button>
          }
          <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>Whatever you pick, we'll show how it plays.</span>
        </div>
      </div>
    </div>
  );
}

// ── Scene: Processing ──────────────────────────────────────────

function SceneProcessing({ state, set, next }: { state: AppState; set: (p: Partial<AppState>) => void; next: () => void }) {
  type StepStatus = 'done' | 'active' | 'queue';
  interface StepRow { k: string; st: StepStatus; v: string; }
  const [steps, setSteps] = useState<StepRow[]>([
    { k: 'Reading your 10 swipes',   st: 'done',   v: '10 / 10' },
    { k: 'Scoring scenarios',        st: 'done',   v: '2 / 2' },
    { k: 'Synthesizing your style',  st: 'active', v: '…' },
    { k: 'Drafting agenda',          st: 'queue',  v: '—' },
    { k: 'Writing the script',       st: 'queue',  v: '—' },
  ]);
  const [phase, setPhase] = useState<'portrait' | 'meeting' | 'done'>('portrait');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const portrait = await generatePortrait(state);
      if (cancelled) return;
      set({ portrait });
      setSteps([
        { k: 'Reading your 10 swipes',   st: 'done',   v: '10 / 10' },
        { k: 'Scoring scenarios',        st: 'done',   v: '2 / 2' },
        { k: 'Synthesizing your style',  st: 'done',   v: portrait.archetype },
        { k: 'Drafting agenda',          st: 'active', v: '…' },
        { k: 'Writing the script',       st: 'queue',  v: '—' },
      ]);
      setPhase('meeting');

      const meeting = await generateMeeting({ ...state, portrait });
      if (cancelled) return;
      set({ meeting });
      setSteps([
        { k: 'Reading your 10 swipes',   st: 'done',   v: '10 / 10' },
        { k: 'Scoring scenarios',        st: 'done',   v: '2 / 2' },
        { k: 'Synthesizing your style',  st: 'done',   v: portrait.archetype },
        { k: 'Drafting agenda',          st: 'done',   v: `${(meeting?.agenda || []).length} sections` },
        { k: 'Writing the script',       st: 'done',   v: 'ready' },
      ]);
      setPhase('done');
      setTimeout(() => { if (!cancelled) next(); }, 1400);
    })();
    return () => { cancelled = true; };
  }, []);

  const portrait = state.portrait;

  return (
    <div className="dd-process">
      <div>
        <Sun style={{ width: 100, height: 100, marginBottom: 24 }} />
        <h2 className="display" style={{ fontSize: 56, lineHeight: 0.92, margin: 0 }}>
          One sec, {state.name || 'friend'} —<br />
          <span style={{ color: 'var(--terracotta)' }}>laying it out.</span>
        </h2>

        <div className="dd-checklist" style={{ marginTop: 26 }}>
          {steps.map((s, i) => (
            <div key={i} className={`row ${s.st}`}>
              <div className="pip"></div>
              <div>{s.k}{s.st === 'active' && <DotTyping color="var(--terracotta)" />}</div>
              <div className="v">{s.v}</div>
            </div>
          ))}
        </div>

        {phase === 'meeting' && (
          <div className="dd-coach-msg">Got a read on you, {state.name || 'friend'}. Now writing your script…</div>
        )}
      </div>

      <div>
        <span className="tag">PORTRAIT · {phase === 'done' ? 'READY' : 'DRAFT'}</span>
        {portrait ? (
          <div className="dd-portrait-card" style={{ marginTop: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase' as const, letterSpacing: '0.1em' }}>You manage like</div>
                <div className="display">{portrait.archetype}</div>
              </div>
              <Sun style={{ width: 56, height: 56 }} />
            </div>
            <div style={{ fontSize: 14, color: 'var(--ink-2)', marginTop: 8, fontStyle: 'italic', lineHeight: 1.45 }}>{portrait.tagline}</div>
            <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column' as const, gap: 10 }}>
              {(portrait.traits || []).map((t, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <div style={{ width: 12, height: 12, borderRadius: '50%', background: ['var(--avocado)', 'var(--terracotta)', 'var(--mustard)', 'var(--teal)'][i % 4], border: '1.5px solid var(--ink)', flex: 'none', marginTop: 4 }}></div>
                  <span style={{ fontSize: 13, lineHeight: 1.4 }}>{t}</span>
                </div>
              ))}
            </div>
            <div className="wave" style={{ margin: '18px 0' }}></div>
            <div style={{ fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase' as const, letterSpacing: '0.1em', marginBottom: 6 }}>Watch-out</div>
            <div style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.5 }}>{portrait.watchout}</div>
          </div>
        ) : (
          <div className="dd-portrait-card" style={{ marginTop: 10, minHeight: 320, display: 'flex', flexDirection: 'column' as const, gap: 12, justifyContent: 'center', alignItems: 'center' }}>
            <DotTyping color="var(--ink-3)" />
            <div style={{ fontSize: 12, color: 'var(--ink-3)', letterSpacing: '0.1em', textTransform: 'uppercase' as const }}>reading your room…</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Scene: Output ──────────────────────────────────────────────

const SLIDE_THEMES = ['theme-paper', 'theme-terracotta', 'theme-mustard', 'theme-avocado', 'theme-teal', 'theme-ink'];

function buildSlides(m: Meeting) {
  const title = { label: 'OPEN', title: m.title, body: m.subtitle, meta: 'Thursday Sync · 01', theme: 'theme-paper' };
  const sections = (m.agenda || []).map((a, i) => ({
    label: a.label, title: a.title, body: `"${a.say}"`, meta: `${a.time} · ${a.duration}`, theme: SLIDE_THEMES[(i + 1) % SLIDE_THEMES.length],
  }));
  const close = { label: 'CLOSE', title: 'Thanks team.', body: `"${m.close}"`, meta: `Thursday Sync · ${(m.agenda || []).length + 2}`, theme: 'theme-ink' };
  return [title, ...sections, close];
}

function DeckView({ meeting, state }: { meeting: Meeting; state: AppState }) {
  const [slideIdx, setSlideIdx] = useState(0);
  const slides = buildSlides(meeting);
  const slide = slides[slideIdx];
  const sectionSlide = slideIdx > 0 && slideIdx <= meeting.agenda.length ? meeting.agenda[slideIdx - 1] : null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') setSlideIdx(i => Math.min(i + 1, slides.length - 1));
      if (e.key === 'ArrowLeft')  setSlideIdx(i => Math.max(i - 1, 0));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [slides.length]);

  return (
    <div className="dd-output">
      <div className="dd-out-side">
        <div className="head">SLIDES · {slides.length}</div>
        {slides.map((s, i) => (
          <button key={i} className={`dd-out-row ${i === slideIdx ? 'on' : ''}`} onClick={() => setSlideIdx(i)}>
            <span className="n">{String(i + 1).padStart(2, '0')}</span>
            <span>{s.title}</span>
          </button>
        ))}
      </div>

      <div className="dd-out-main">
        <div className={`dd-slide ${slide.theme}`}>
          <span className="tag" style={{ alignSelf: 'flex-start', background: 'rgba(255,255,255,0.85)', color: 'var(--dark-fixed)', marginBottom: 18 }}>{slide.label}</span>
          <h1 className="title">{slide.title}</h1>
          <p className="body">{slide.body}</p>
          <span className="meta">{slide.meta}</span>
          <div style={{ position: 'absolute', bottom: 22, right: 56, width: 50, height: 50, borderRadius: '50%', background: 'var(--mustard)', border: '2px solid var(--dark-fixed)' }}></div>
        </div>

        <div className="dd-slide-strip">
          {slides.map((_, i) => (
            <button key={i} className={i === slideIdx ? 'on' : ''} onClick={() => setSlideIdx(i)}>{String(i + 1).padStart(2, '0')}</button>
          ))}
        </div>
      </div>

      <div className="dd-out-rail">
        {sectionSlide ? (
          <>
            <div className="dd-notes"><span className="label">SAY THIS</span><div>"{sectionSlide.say}"</div></div>
            <div className="card" style={{ padding: 14 }}>
              <div style={{ fontSize: 10, color: 'var(--ink-3)', letterSpacing: '0.1em', textTransform: 'uppercase' as const, marginBottom: 6 }}>Coach note</div>
              <div style={{ fontSize: 12, lineHeight: 1.5 }}>{sectionSlide.note}</div>
            </div>
            <div style={{ display: 'flex', gap: 6, fontSize: 11, color: 'var(--ink-3)', marginTop: 'auto' }}>
              <span>{sectionSlide.time}</span><span>·</span><span>{sectionSlide.duration}</span>
            </div>
          </>
        ) : (
          <div className="dd-notes"><span className="label">SAY THIS</span><div>"{slide.body.replace(/^"|"$/g, '')}"</div></div>
        )}
        <button
          type="button"
          className="card terracotta"
          onClick={() => setSlideIdx(i => Math.min(i + 1, slides.length - 1))}
          disabled={slideIdx >= slides.length - 1}
          style={{
            padding: 14, marginTop: 'auto', textAlign: 'left', cursor: slideIdx >= slides.length - 1 ? 'default' : 'pointer',
            font: 'inherit', width: '100%', opacity: slideIdx >= slides.length - 1 ? 0.5 : 1,
            transition: 'transform 0.12s, opacity 0.15s',
          }}
          onMouseDown={e => { if (!e.currentTarget.disabled) e.currentTarget.style.transform = 'scale(0.98)'; }}
          onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
        >
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' as const, marginBottom: 4 }}>NEXT</div>
          <div style={{ fontSize: 13, lineHeight: 1.4 }}>
            {slideIdx >= slides.length - 1
              ? 'End of deck.'
              : <>Advance to slide {slideIdx + 2} <span aria-hidden="true">→</span></>}
          </div>
        </button>
      </div>
    </div>
  );
}

function ScriptView({ meeting, portrait }: { meeting: Meeting; portrait: Portrait | null }) {
  const pillColors = ['mustard', 'terracotta', 'avocado', 'teal', 'mustard'];
  return (
    <div style={{ flex: 1, padding: '26px 80px 40px', display: 'grid', gridTemplateColumns: '1.3fr 0.7fr', gap: 36, overflow: 'auto' }}>
      <div>
        <span className="tag">TALKING POINTS · {(meeting.agenda || []).length} BEATS</span>
        <h2 className="display" style={{ fontSize: 34, margin: '8px 0 0', lineHeight: 1 }}>The script (your voice)</h2>
        <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 4 }}>{portrait?.archetype} · {portrait?.tagline}</div>

        <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column' as const, gap: 14 }}>
          {(meeting.agenda || []).map((a, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 14, alignItems: 'start' }}>
              <span className={`pill ${pillColors[i % 5]}`} style={{ justifyContent: 'center' }}>{a.label} · {a.duration}</span>
              <div>
                <div style={{ fontSize: 15, fontStyle: 'italic', lineHeight: 1.45 }}>"{a.say}"</div>
                <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 4 }}>↳ {a.note}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <span className="tag">IF / THEN · BACKUP MOVES</span>
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column' as const, gap: 10 }}>
          {(meeting.ifthen || []).map((x, i) => (
            <div key={i} className="dd-ifthen-row">
              <span className={`pill ${['terracotta', 'mustard', 'avocado', 'teal'][i % 4]}`} style={{ padding: '2px 8px' }}>IF</span>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{x.if}</span>
              <div className="then">{x.then}</div>
            </div>
          ))}
        </div>
        <div className="card solid-ink" style={{ padding: 14, marginTop: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' as const, marginBottom: 6 }}>Read it once aloud</div>
          <div style={{ fontSize: 13, lineHeight: 1.45 }}>Don't memorize. Let the bones show — that's what makes it sound like you.</div>
        </div>
      </div>
    </div>
  );
}

function ChecklistView({ meeting, name }: { meeting: Meeting; name: string }) {
  const [done, setDone] = useState<Record<string, boolean>>({});
  const toggle = (k: string) => setDone(d => ({ ...d, [k]: !d[k] }));

  const items = [
    { k: 'p1', group: 'BEFORE',      text: 'Drop the agenda in your team channel 24h ahead', sub: 'Sets expectations before the room opens.' },
    { k: 'p2', group: 'BEFORE',      text: 'Pin one blocker to discuss', sub: 'Pick the one that actually matters.' },
    { k: 'p3', group: 'BEFORE',      text: 'Two-minute pre-meeting breath', sub: 'Set a timer at :58.' },
    ...(meeting.agenda || []).map((a, i) => ({ k: `m${i}`, group: 'IN THE ROOM', text: `${a.time} · ${a.title}`, sub: `"${a.say}"` })),
    { k: 'a1', group: 'AFTER',       text: 'DM the team standout (praise privately)', sub: 'You said you praise quietly.' },
    { k: 'a2', group: 'AFTER',       text: 'Post decisions in your tool of record',   sub: 'Linear / Notion / wherever decisions live.' },
    { k: 'a3', group: 'AFTER',       text: 'Schedule the next follow-up 1:1',         sub: 'Within 2 days.' },
  ];

  return (
    <div style={{ flex: 1, padding: '26px 80px 40px', overflow: 'auto' }}>
      <span className="tag">INTERACTIVE CHECKLIST</span>
      <h2 className="display" style={{ fontSize: 32, margin: '8px 0 18px', lineHeight: 1 }}>Your run-of-show, {name}.</h2>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 24 }}>
        {['BEFORE', 'IN THE ROOM', 'AFTER'].map(g => (
          <div key={g}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', color: 'var(--ink-3)', marginBottom: 10 }}>{g}</div>
            {items.filter(x => x.group === g).map(it => (
              <button key={it.k} onClick={() => toggle(it.k)}
                style={{ background: 'transparent', border: 0, borderBottom: '1px dashed var(--line)', textAlign: 'left' as const, width: '100%', color: 'var(--ink)', cursor: 'pointer', padding: '12px 0', fontFamily: 'inherit', display: 'flex' }}>
                <div className={`check-box ${done[it.k] ? 'done' : ''}`}></div>
                <div style={{ flex: 1, marginLeft: 12 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, textDecoration: done[it.k] ? 'line-through' : 'none', opacity: done[it.k] ? 0.5 : 1 }}>{it.text}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 3, fontStyle: it.sub.startsWith('"') ? 'italic' : 'normal' }}>{it.sub}</div>
                </div>
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function PrintView({ meeting, name, portrait }: { meeting: Meeting; name: string; portrait: Portrait | null }) {
  return (
    <div style={{ flex: 1, padding: '36px 60px', overflow: 'auto', display: 'grid', gridTemplateColumns: '220px 1fr 220px', gap: 36 }}>
      <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 10 }}>
        <span className="tag">PRINT</span>
        <div className="pill solid" style={{ alignSelf: 'flex-start' }}>📄 1-page</div>
        <div className="pill ghost" style={{ alignSelf: 'flex-start' }}>📑 With notes</div>
        <button className="btn primary" style={{ marginTop: 10 }} onClick={() => window.print()}>⤓ Download PDF</button>
      </div>

      <div style={{ background: '#F2E9D6', color: '#211712', border: '1.5px solid #C9B898', borderRadius: 4, padding: '44px 52px', boxShadow: '8px 10px 0 rgba(0,0,0,0.4)', fontSize: 13 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 10, color: '#7B6A57', letterSpacing: '0.16em', textTransform: 'uppercase' as const }}>{name}'s Thursday</div>
            <div className="display" style={{ fontSize: 38, lineHeight: 0.95, marginTop: 6, color: '#211712' }}>{meeting.title}</div>
            <div style={{ fontSize: 12, color: '#7B6A57', marginTop: 6 }}>{meeting.subtitle}</div>
          </div>
          <Sun style={{ width: 50, height: 50 }} />
        </div>

        <div style={{ height: 14, margin: '20px 0 16px', background: 'radial-gradient(circle at 7px 14px, transparent 7px, #211712 7px 8.5px, transparent 8.5px) 0 0/14px 14px repeat-x', opacity: 0.5 }}></div>

        <div style={{ display: 'grid', gridTemplateColumns: '70px 1fr', rowGap: 14, columnGap: 14 }}>
          {(meeting.agenda || []).map((a, i) => (
            <div key={i} style={{ display: 'contents' }}>
              <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, color: '#7B6A57' }}>{a.time}</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{a.title}</div>
                <div style={{ color: '#4A3A2C', fontSize: 12, marginTop: 2, fontStyle: 'italic' }}>"{a.say}"</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ height: 14, margin: '20px 0 14px', background: 'radial-gradient(circle at 7px 14px, transparent 7px, #211712 7px 8.5px, transparent 8.5px) 0 0/14px 14px repeat-x', opacity: 0.5 }}></div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' as const, marginBottom: 4 }}>Open with</div>
            <div style={{ fontStyle: 'italic', color: '#4A3A2C' }}>"{meeting.open}"</div>
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' as const, marginBottom: 4 }}>Close with</div>
            <div style={{ fontStyle: 'italic', color: '#4A3A2C' }}>"{meeting.close}"</div>
          </div>
        </div>

        <div style={{ marginTop: 22, fontSize: 9, color: '#7B6A57', display: 'flex', justifyContent: 'space-between' }}>
          <span>managercoach.app · {portrait?.archetype} · {name}</span>
          <span>1 / 1</span>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 10 }}>
        <span className="tag">SHARE</span>
        <div className="pill ghost" style={{ justifyContent: 'flex-start' }}>Drop in team channel</div>
        <div className="pill ghost" style={{ justifyContent: 'flex-start' }}>Attach to invite</div>
        <div className="pill ghost" style={{ justifyContent: 'flex-start' }}>Send to Notion</div>
        <div className="card avocado" style={{ marginTop: 18, padding: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' as const, marginBottom: 4 }}>After</div>
          <div style={{ fontSize: 12, lineHeight: 1.45 }}>Come back. Tell us what worked. We'll tune the next one.</div>
        </div>
      </div>
    </div>
  );
}

function SceneOutput({ state, set, back }: { state: AppState; set: (p: Partial<AppState>) => void; back: () => void }) {
  const [tab, setTab] = useState<'deck' | 'script' | 'checklist' | 'print'>('deck');
  const m = state.meeting;
  const p = state.portrait;

  if (!m) return <div style={{ padding: 80 }}>No plan yet.</div>;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' as const }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 28px', borderBottom: '1.5px solid var(--line)', flex: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button className="btn ghost" onClick={back} style={{ padding: '6px 14px', fontSize: 12 }}>← Re-swipe</button>
          <div>
            <div style={{ fontSize: 10, color: 'var(--ink-3)', letterSpacing: '0.12em', textTransform: 'uppercase' as const }}>{state.name}'s plan · {p?.archetype}</div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>{m.title}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {([['deck', '🎞 Deck'], ['script', '💬 Script'], ['checklist', '📋 Checklist'], ['print', '📄 Print']] as const).map(([v, label]) => (
            <button key={v} className={`pill ${tab === v ? 'solid' : 'ghost'}`} onClick={() => setTab(v)} style={{ cursor: 'pointer', border: 'none' }}>{label}</button>
          ))}
        </div>
      </div>

      {tab === 'deck'      && <DeckView meeting={m} state={state} />}
      {tab === 'script'    && <ScriptView meeting={m} portrait={p} />}
      {tab === 'checklist' && <ChecklistView meeting={m} name={state.name} />}
      {tab === 'print'     && <PrintView meeting={m} name={state.name} portrait={p} />}
    </div>
  );
}

// ── Root App ────────────────────────────────────────────────────

const STEPS: Step[] = ['welcome', 'context', 'swipe', 'scenario', 'processing', 'output'];

export default function DeepDive() {
  const [state, setState] = useState<AppState>(DEFAULT_STATE);
  const set = useCallback((patch: Partial<AppState>) => setState(s => ({ ...s, ...patch })), []);

  const stepIdx = STEPS.indexOf(state.step);
  const goto = (step: Step) => set({ step });
  const next = () => goto(STEPS[Math.min(STEPS.length - 1, stepIdx + 1)]);
  const back = () => goto(STEPS[Math.max(0, stepIdx - 1)]);

  const ctxDone = CONTEXT_QUESTIONS.filter(q => { const v = state.context?.[q.id]; return Array.isArray(v) ? v.length > 0 : !!v; }).length;
  const swipeDone = Object.keys(state.swipes || {}).length;
  const scenDone = Object.keys(state.scenarios || {}).length;
  const totalWork = CONTEXT_QUESTIONS.length + SWIPE_CARDS.length + SCENARIOS.length;
  const doneWork = ctxDone + swipeDone + scenDone;
  const pct = state.step === 'output' ? 100 : state.step === 'processing' ? 95 : Math.round((doneWork / totalWork) * 90);

  const chapters = [
    { id: 'context', label: 'CONTEXT' }, { id: 'swipe', label: 'CARDS' },
    { id: 'scenario', label: 'SCENARIOS' }, { id: 'output', label: 'YOUR PLAN' },
  ];

  return (
    <div className="dd-app">
      <div className="dd-topbar">
        <div className="dd-topbar-left">
          <div className="brand-mark" style={{ width: 22, height: 22 }}></div>
          <div className="brand-name" style={{ fontSize: 14 }}>ManagerCoach</div>
          {state.name && <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>· {state.name}</span>}
        </div>

        <div className="dd-progress">
          <div className="dd-progress-fill" style={{ width: `${pct}%` }}></div>
        </div>

        <div className="dd-chapters">
          {chapters.map(c => {
            const cidx = STEPS.indexOf(c.id as Step);
            const cls = cidx < stepIdx ? 'done' : cidx === stepIdx ? 'on' : '';
            return <span key={c.id} className={`dd-chip ${cls}`}>{c.label}</span>;
          })}
        </div>
      </div>

      <div className="dd-stage">
        <div className="dd-scene" key={state.step}>
          {state.step === 'welcome'    && <SceneWelcome    state={state} set={set} next={next} />}
          {state.step === 'context'    && <SceneContext    state={state} set={set} next={next} back={back} />}
          {state.step === 'swipe'      && <SceneSwipe      state={state} set={set} next={next} back={back} />}
          {state.step === 'scenario'   && <SceneScenario   state={state} set={set} next={next} back={back} />}
          {state.step === 'processing' && <SceneProcessing state={state} set={set} next={next} />}
          {state.step === 'output'     && <SceneOutput     state={state} set={set} back={() => goto('swipe')} />}
        </div>
      </div>
    </div>
  );
}
