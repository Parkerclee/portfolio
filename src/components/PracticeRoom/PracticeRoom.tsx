import { useEffect, useMemo, useRef, useState } from 'react';

/**
 * Practice Room, an AI roleplay where a leader works through a real
 * conversation with a character who reacts in the moment. This is the thing a
 * fixed branching scenario can't do: the learner can say anything, the read on
 * how it's landing moves live, every turn streams to the LRS as xAPI, and the
 * debrief is generated from what the learner actually said.
 *
 * Scenario: coaching Sam Rivera, a senior engineer and former go-to who's been
 * quietly disengaging. The goal isn't to "fix" Sam, it's to make it safe
 * enough that the real thing surfaces.
 *
 * AI: when window.claude.complete is available (e.g. a Claude preview) the
 * learner free-types and the model plays Sam + scores the read and the debrief.
 * On the static site it runs as a guided experience off authored branches so
 * it's always fully playable; the framing makes which mode is live obvious.
 */

// ── Read axes ──────────────────────────────────────────────────────
interface Read {
  trust: number;
  openness: number;
  guard: number; // defensiveness
}
const START: Read = { trust: 48, openness: 28, guard: 58 };
const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
const applyRead = (r: Read, d: Partial<Read>): Read => ({
  trust: clamp(r.trust + (d.trust ?? 0)),
  openness: clamp(r.openness + (d.openness ?? 0)),
  guard: clamp(r.guard + (d.guard ?? 0)),
});
const warmth = (r: Read) => r.trust * 0.4 + r.openness * 0.4 + (100 - r.guard) * 0.2;
const tierOf = (r: Read): 'cold' | 'neutral' | 'warm' => {
  const w = warmth(r);
  return w < 42 ? 'cold' : w < 66 ? 'neutral' : 'warm';
};

type Quality = 'insightful' | 'okay' | 'misstep';

interface Approach {
  id: string;
  label: string; // the chip
  text: string; // what the manager says
  deltas: Partial<Read>;
  quality: Quality;
  skill: string; // rubric dimension this move exercises
}

interface Beat {
  id: string;
  // Sam's opening line for this beat, varied by how the room feels.
  sam: Record<'cold' | 'neutral' | 'warm', string>;
  approaches: Approach[];
}

// ── Authored conversation spine ────────────────────────────────────
const BEATS: Beat[] = [
  {
    id: 'open',
    sam: {
      cold: 'Hey. So… what’s this about? Did I miss something on the sprint?',
      neutral: 'Hey. What’s up? Everything okay with my work?',
      warm: 'Hey. What’s up? Everything okay with my work?',
    },
    approaches: [
      {
        id: 'open-care',
        label: 'No agenda, check in on the person',
        text: 'Honestly, no agenda. Your work’s solid. I’ve just missed a bit of your spark lately and wanted to see how you’re actually doing.',
        deltas: { trust: 14, openness: 12, guard: -12 },
        quality: 'insightful',
        skill: 'Made it safe',
      },
      {
        id: 'open-observe',
        label: 'Name what you’ve noticed, gently',
        text: 'Your work isn’t the issue at all. I’ve just noticed you seem a little further away lately, quieter in standup, and I wanted to check in.',
        deltas: { trust: 7, openness: 6, guard: -4 },
        quality: 'okay',
        skill: 'Named the pattern',
      },
      {
        id: 'open-fix',
        label: 'Get to the point, re-engage them',
        text: 'I’ve noticed your engagement is down and I want to talk about how we get you back on track.',
        deltas: { trust: -6, openness: -8, guard: 16 },
        quality: 'misstep',
        skill: 'Made it safe',
      },
    ],
  },
  {
    id: 'surface',
    sam: {
      cold: '“On autopilot” I guess. My tickets are all closing, so I figured everything was fine.',
      neutral: '…Yeah. I guess I have been kind of on autopilot lately. I don’t totally know why.',
      warm: 'Honestly? Things have felt flat for a while. I didn’t want to make it a thing.',
    },
    approaches: [
      {
        id: 'surf-listen',
        label: 'Stay with it, ask them to say more',
        text: 'Flat. Say more about that, when did it start feeling that way?',
        deltas: { trust: 10, openness: 16, guard: -8 },
        quality: 'insightful',
        skill: 'Listened before fixing',
      },
      {
        id: 'surf-normalize',
        label: 'Normalize it, then ask',
        text: 'That’s really human, and I’m glad you said it out loud. What’s underneath it, do you think?',
        deltas: { trust: 8, openness: 10, guard: -6 },
        quality: 'okay',
        skill: 'Made it safe',
      },
      {
        id: 'surf-solve',
        label: 'Offer a fix right away',
        text: 'Okay, maybe we get you onto a newer project, something shinier? That usually helps.',
        deltas: { trust: -4, openness: -10, guard: 8 },
        quality: 'misstep',
        skill: 'Listened before fixing',
      },
    ],
  },
  {
    id: 'truth',
    sam: {
      cold: 'I mean… it’s the same work on repeat. And every time something’s on fire, it lands on me. I’m tired.',
      neutral: 'It’s like… I became the person everything routes to. It’s flattering, but I haven’t had a real challenge in a year. I’m just tired.',
      warm: 'The truth? I’m burned out. I became the safe pair of hands, so I get all the urgent stuff and none of the interesting stuff. I’ve thought about leaving.',
    },
    approaches: [
      {
        id: 'truth-reflect',
        label: 'Reflect it back, no rushing',
        text: 'So you’re the one everything lands on, and somewhere in there the interesting work disappeared. That would wear anyone down. Thank you for trusting me with it.',
        deltas: { trust: 12, openness: 12, guard: -10 },
        quality: 'insightful',
        skill: 'Named the pattern',
      },
      {
        id: 'truth-own',
        label: 'Own your part in it',
        text: 'And I think I’ve leaned on you for exactly that reason, without checking what it was costing you. That’s on me, and I want to fix it with you.',
        deltas: { trust: 16, openness: 10, guard: -12 },
        quality: 'insightful',
        skill: 'Made it safe',
      },
      {
        id: 'truth-defend',
        label: 'Reassure that it’s valued',
        text: 'But you’re so good at it, that’s why it comes to you. The team really needs you in that role right now.',
        deltas: { trust: -8, openness: -12, guard: 14 },
        quality: 'misstep',
        skill: 'Listened before fixing',
      },
    ],
  },
  {
    id: 'nextstep',
    sam: {
      cold: 'I don’t know what would even help at this point, honestly.',
      neutral: 'I don’t know. Part of me wants a real project. Part of me is just relieved someone finally noticed.',
      warm: 'Honestly, just being able to say this helps. And yeah, I’d love something that stretches me again.',
    },
    approaches: [
      {
        id: 'next-cocreate',
        label: 'Co-create the next step with them',
        text: 'Then let’s design it together. If we could hand off two of the “everything routes to Sam” things and carve out one real challenge for next quarter, what would you want that challenge to be?',
        deltas: { trust: 12, openness: 14, guard: -8 },
        quality: 'insightful',
        skill: 'Co-created a next step',
      },
      {
        id: 'next-offer',
        label: 'Offer a concrete option',
        text: 'Here’s one idea: I take the on-call escalations off you for a month, and you scope the new pipeline rebuild you flagged. Want to try that?',
        deltas: { trust: 8, openness: 6, guard: -4 },
        quality: 'okay',
        skill: 'Co-created a next step',
      },
      {
        id: 'next-defer',
        label: 'Promise to think about it',
        text: 'Let me think about how to free you up and I’ll get back to you next week.',
        deltas: { trust: -4, openness: -6, guard: 6 },
        quality: 'misstep',
        skill: 'Co-created a next step',
      },
    ],
  },
  {
    id: 'close',
    sam: {
      cold: 'Okay. I appreciate you asking, at least.',
      neutral: 'Yeah. Let’s try that. It’s the most seen I’ve felt in a while, honestly.',
      warm: 'That actually sounds great. Thank you, genuinely. This is the most hopeful I’ve felt about this job in months.',
    },
    approaches: [
      {
        id: 'close-commit',
        label: 'Lock a specific follow-up',
        text: 'Let’s put 30 minutes on Friday to write down the handoffs and the new project so it’s real, not just a nice talk. And this is a standing check-in now, not a one-off.',
        deltas: { trust: 10, openness: 8, guard: -6 },
        quality: 'insightful',
        skill: 'Co-created a next step',
      },
      {
        id: 'close-thank',
        label: 'Close warmly, keep it loose',
        text: 'I’m really glad we talked. Let’s keep this going, my door’s open whenever.',
        deltas: { trust: 4, openness: 2, guard: -2 },
        quality: 'okay',
        skill: 'Made it safe',
      },
    ],
  },
];

const SKILLS = ['Made it safe', 'Listened before fixing', 'Named the pattern', 'Co-created a next step'];

// ── Types for runtime ──────────────────────────────────────────────
interface Turn {
  role: 'sam' | 'you';
  text: string;
  approachLabel?: string;
  quality?: Quality;
  skill?: string;
}
interface XStatement {
  verb: string;
  object: string;
  extra?: string;
}
interface RubricLine {
  skill: string;
  score: number; // 0–100
  note: string;
}
interface Debrief {
  outcome: string;
  worked: string;
  tryNext: string;
  rubric: RubricLine[];
}

// ── AI plumbing ────────────────────────────────────────────────────
function hasAI() {
  return typeof window !== 'undefined' && !!(window as any).claude?.complete;
}
async function callJSON<T>(prompt: string, fallback: T): Promise<T> {
  const claude = (window as any).claude;
  if (!claude?.complete) return fallback;
  try {
    const txt = await claude.complete({ messages: [{ role: 'user', content: prompt }] });
    const m = txt.match(/\{[\s\S]*\}/);
    return m ? (JSON.parse(m[0]) as T) : fallback;
  } catch {
    return fallback;
  }
}

// ── Component ──────────────────────────────────────────────────────
type Phase = 'brief' | 'live' | 'debrief';

export default function PracticeRoom() {
  const [phase, setPhase] = useState<Phase>('brief');
  const [beatIdx, setBeatIdx] = useState(0);
  const [read, setRead] = useState<Read>(START);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [xapi, setXapi] = useState<XStatement[]>([]);
  const [chosen, setChosen] = useState<Approach[]>([]);
  const [samThinking, setSamThinking] = useState(false);
  const [freeText, setFreeText] = useState('');
  const [debrief, setDebrief] = useState<Debrief | null>(null);
  const [debriefLoading, setDebriefLoading] = useState(false);
  const aiLive = useMemo(() => hasAI(), []);

  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [turns, samThinking]);

  const beat = BEATS[beatIdx];
  const tier = tierOf(read);

  function emit(s: XStatement) {
    setXapi((x) => [...x, s]);
  }

  function start() {
    setPhase('live');
    emit({ verb: 'launched', object: 'coaching-the-disengaged-teammate' });
    // Sam opens.
    setSamThinking(true);
    setTimeout(() => {
      setTurns([{ role: 'sam', text: BEATS[0].sam.neutral }]);
      setSamThinking(false);
    }, 700);
  }

  async function chooseApproach(a: Approach) {
    // Manager's line
    setTurns((t) => [...t, { role: 'you', text: a.text, approachLabel: a.label, quality: a.quality, skill: a.skill }]);
    const nextRead = applyRead(read, a.deltas);
    setRead(nextRead);
    setChosen((c) => [...c, a]);
    emit({
      verb: 'answered',
      object: `${beat.id} · ${a.skill.toLowerCase()}`,
      extra: `trust ${nextRead.trust} · openness ${nextRead.openness}`,
    });

    const isLast = beatIdx >= BEATS.length - 1;
    setSamThinking(true);

    if (aiLive) {
      // Let the model voice Sam's reaction in-character (read already moved).
      const reply = await callJSON<{ line: string }>(
        samPrompt(turns, a.text, nextRead, isLast),
        { line: isLast ? '' : BEATS[beatIdx + 1].sam[tierOf(nextRead)] }
      );
      finishSamTurn(reply.line, isLast, nextRead);
    } else {
      setTimeout(() => {
        const line = isLast ? '' : BEATS[beatIdx + 1].sam[tierOf(nextRead)];
        finishSamTurn(line, isLast, nextRead);
      }, 650);
    }
  }

  async function sendFreeText() {
    const msg = freeText.trim();
    if (!msg || !aiLive) return;
    setFreeText('');
    setTurns((t) => [...t, { role: 'you', text: msg }]);
    setSamThinking(true);
    const isLast = beatIdx >= BEATS.length - 1;
    const result = await callJSON<{ line: string; deltas: Read; skill: string; quality: Quality }>(
      samFreePrompt(turns, msg, read, isLast),
      { line: 'Hm. Say a bit more?', deltas: { trust: 0, openness: 0, guard: 0 }, skill: 'Listened before fixing', quality: 'okay' }
    );
    const nextRead = applyRead(read, result.deltas);
    setRead(nextRead);
    setChosen((c) => [...c, { id: 'free', label: 'free response', text: msg, deltas: result.deltas, quality: result.quality, skill: result.skill }]);
    emit({ verb: 'answered', object: `${beat.id} · free response`, extra: `trust ${nextRead.trust} · openness ${nextRead.openness}` });
    finishSamTurn(result.line, isLast, nextRead);
  }

  function finishSamTurn(line: string, isLast: boolean, nextRead: Read) {
    setSamThinking(false);
    if (isLast || beatIdx + 1 >= BEATS.length) {
      emit({ verb: 'progressed', object: 'conversation complete (100%)' });
      runDebrief(nextRead);
      return;
    }
    if (line) setTurns((t) => [...t, { role: 'sam', text: line }]);
    setBeatIdx((i) => i + 1);
    emit({ verb: 'progressed', object: `beat ${beatIdx + 2}/${BEATS.length}` });
  }

  async function runDebrief(finalRead: Read) {
    setDebriefLoading(true);
    setPhase('debrief');
    const authored = authoredDebrief(chosen, finalRead);
    const result = await callJSON<Debrief>(debriefPrompt(turns, finalRead), authored);
    // Pass/fail off the composite read + skill coverage.
    const composite = Math.round(warmth(finalRead));
    emit({ verb: composite >= 60 ? 'passed' : 'failed', object: 'coaching conversation', extra: `read ${composite}/100` });
    emit({ verb: 'scored', object: 'rubric · Kirkpatrick L3 (behavior)', extra: result.rubric.map((r) => `${r.skill.split(' ')[0]} ${r.score}`).join(' · ') });
    setDebrief(result);
    setDebriefLoading(false);
  }

  function reset() {
    setPhase('brief');
    setBeatIdx(0);
    setRead(START);
    setTurns([]);
    setXapi([]);
    setChosen([]);
    setDebrief(null);
    setFreeText('');
  }

  // ── Render ──
  return (
    <div className="rounded-3xl border border-cocoa/15 bg-paper overflow-hidden shadow-xl shadow-primary-900/5">
      {/* Title bar */}
      <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-cocoa/10 bg-cocoa text-cream">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex w-7 h-7 rounded-lg bg-cream/15 items-center justify-center text-sm">🎧</span>
          <div className="leading-tight">
            <p className="font-display font-semibold text-sm">Practice Room</p>
            <p className="text-[11px] text-cream/55">Coaching a disengaged teammate</p>
          </div>
        </div>
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${aiLive ? 'bg-secondary-400/25 text-secondary-100' : 'bg-cream/10 text-cream/70'}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${aiLive ? 'bg-secondary-300 animate-pulse' : 'bg-accent-400'}`} />
          {aiLive ? 'Live AI roleplay' : 'Guided demo'}
        </span>
      </div>

      {phase === 'brief' && <Brief aiLive={aiLive} onStart={start} />}

      {phase !== 'brief' && (
        <div className="grid lg:grid-cols-[1fr_300px]">
          {/* Conversation column */}
          <div className="flex flex-col min-h-[520px] max-h-[640px]">
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-5 space-y-4 bg-cream-50">
              {turns.map((t, i) => <Bubble key={i} turn={t} />)}
              {samThinking && <Typing />}
              {phase === 'debrief' && <DebriefCard debrief={debrief} loading={debriefLoading} read={read} onReplay={reset} />}
            </div>

            {phase === 'live' && (
              <div className="border-t border-cocoa/10 bg-paper px-5 py-4">
                <p className="font-display text-[11px] uppercase tracking-widest text-cocoa/40 mb-2">
                  How do you respond?
                </p>
                <div className="space-y-2">
                  {beat.approaches.map((a) => (
                    <button
                      key={a.id}
                      disabled={samThinking}
                      onClick={() => chooseApproach(a)}
                      className="w-full text-left rounded-xl border border-cocoa/15 bg-cream-50 hover:border-primary-400 hover:bg-primary-50/40 px-3.5 py-2.5 text-sm text-cocoa transition-colors disabled:opacity-50"
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <input
                    value={freeText}
                    onChange={(e) => setFreeText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && sendFreeText()}
                    disabled={!aiLive || samThinking}
                    placeholder={aiLive ? 'Or say it in your own words…' : 'Connect a model to free-type your own words'}
                    className="flex-1 rounded-xl border border-cocoa/15 bg-paper px-3.5 py-2.5 text-sm text-cocoa placeholder:text-cocoa/35 focus:outline-none focus:border-primary-400 disabled:bg-cream-100 disabled:cursor-not-allowed"
                  />
                  <button
                    onClick={sendFreeText}
                    disabled={!aiLive || samThinking || !freeText.trim()}
                    className="rounded-xl bg-cocoa text-cream px-4 py-2.5 text-sm font-semibold hover:bg-espresso transition-colors disabled:opacity-40"
                  >
                    Send
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Live read + xAPI column */}
          <aside className="border-t lg:border-t-0 lg:border-l border-cocoa/10 bg-paper px-5 py-5 space-y-6">
            <div>
              <p className="font-display text-[11px] uppercase tracking-widest text-cocoa/40 mb-3">How it’s landing</p>
              <ReadMeter label="Trust" value={read.trust} tone="secondary" />
              <ReadMeter label="Openness" value={read.openness} tone="primary" />
              <ReadMeter label="Guard up" value={read.guard} tone="warm" invert />
              <p className="mt-3 text-[11px] text-cocoa/50 leading-relaxed">
                The read shifts with every line, the same loop a coach watches for, made visible.
              </p>
            </div>

            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <span className="inline-flex items-center justify-center w-4 h-4 rounded bg-primary-600 text-cream text-[9px] font-bold">x</span>
                <p className="font-display text-[11px] uppercase tracking-widest text-cocoa/40">xAPI → LRS</p>
              </div>
              <div className="rounded-xl border border-cocoa/10 bg-espresso/[0.96] p-2.5 max-h-44 overflow-y-auto font-mono text-[10.5px] leading-relaxed space-y-1.5">
                {xapi.length === 0 && <p className="text-cream/40">awaiting first statement…</p>}
                {xapi.map((s, i) => (
                  <div key={i} className="text-cream/85">
                    <span className="text-accent-400">{s.verb}</span>{' '}
                    <span className="text-cream/55">{s.object}</span>
                    {s.extra && <div className="text-secondary-300/80 pl-2">↳ {s.extra}</div>}
                  </div>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-cocoa/50 leading-relaxed">
                Every turn is a real statement. In production these land in the LRS and roll up to the manager dashboard.
              </p>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────
function Brief({ aiLive, onStart }: { aiLive: boolean; onStart: () => void }) {
  return (
    <div className="px-6 sm:px-10 py-9 max-w-2xl">
      <p className="font-display text-[11px] uppercase tracking-widest text-cocoa/40 mb-2">The setup</p>
      <h3 className="font-display font-semibold text-cocoa text-2xl leading-tight mb-4">
        Sam used to be your spark. Lately they’ve gone quiet.
      </h3>
      <div className="space-y-3 text-cocoa/75 text-sm leading-relaxed">
        <p>
          <strong className="text-cocoa">You’re Sam Rivera’s manager.</strong> Four years in, Sam was the person
          everything routed to, now they’ve turned down a conference talk, gone quiet in standup, and answered a
          stretch project with a flat “sure, I’ll take it.” The work still ships. The spark is gone.
        </p>
        <p>
          You’ve got a 1:1 in a minute. Your job isn’t to <em>fix</em> Sam, it’s to make it safe enough that the
          real thing surfaces, and to leave with a next step you build together.
        </p>
      </div>
      <div className="mt-5 rounded-xl border border-cocoa/12 bg-cream-50 p-4 text-sm">
        <p className="font-semibold text-cocoa mb-1">What you’re practicing</p>
        <p className="text-cocoa/65">Make it safe · listen before fixing · name the pattern without blame · co-create the next step.</p>
      </div>
      <p className="mt-4 text-[12px] text-cocoa/55">
        {aiLive
          ? 'A live model is playing Sam, type anything, or pick a suggested approach. The read and the debrief respond to what you actually say.'
          : 'Running as a guided demo: choose how you respond and watch the read move. Connect a model and you can free-type, with Sam improvising back.'}
      </p>
      <button
        onClick={onStart}
        className="mt-6 inline-flex items-center gap-2 rounded-full bg-cocoa text-cream px-6 py-3 text-sm font-semibold hover:bg-espresso transition-colors"
      >
        Walk into the room →
      </button>
    </div>
  );
}

function Bubble({ turn }: { turn: Turn }) {
  const you = turn.role === 'you';
  return (
    <div className={`flex gap-2.5 ${you ? 'flex-row-reverse' : ''}`}>
      <span className={`shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-lg text-xs font-bold ${you ? 'bg-cocoa text-cream' : 'bg-accent-400/40 text-cocoa'}`}>
        {you ? 'You' : 'SR'}
      </span>
      <div className={`max-w-[78%] ${you ? 'items-end' : 'items-start'} flex flex-col`}>
        <div className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${you ? 'bg-cocoa text-cream rounded-tr-sm' : 'bg-paper border border-cocoa/12 text-cocoa rounded-tl-sm'}`}>
          {turn.text}
        </div>
        {turn.approachLabel && (
          <span className="mt-1 text-[10.5px] text-cocoa/40 px-1">{turn.approachLabel}</span>
        )}
      </div>
    </div>
  );
}

function Typing() {
  return (
    <div className="flex gap-2.5">
      <span className="shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-lg bg-accent-400/40 text-cocoa text-xs font-bold">SR</span>
      <div className="rounded-2xl rounded-tl-sm bg-paper border border-cocoa/12 px-3.5 py-3">
        <span className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <span key={i} className="w-1.5 h-1.5 rounded-full bg-cocoa/40 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
          ))}
        </span>
      </div>
    </div>
  );
}

function ReadMeter({ label, value, tone, invert }: { label: string; value: number; tone: 'primary' | 'secondary' | 'warm'; invert?: boolean }) {
  const color = tone === 'secondary' ? 'bg-secondary-500' : tone === 'primary' ? 'bg-primary-500' : 'bg-[#C4663D]';
  return (
    <div className="mb-2.5">
      <div className="flex justify-between text-[11px] mb-1">
        <span className="text-cocoa/60 font-semibold">{label}</span>
        <span className="text-cocoa/40 tabular-nums">{value}</span>
      </div>
      <div className="h-1.5 rounded-full bg-cocoa/10 overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all duration-500`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function DebriefCard({ debrief, loading, read, onReplay }: { debrief: Debrief | null; loading: boolean; read: Read; onReplay: () => void }) {
  if (loading || !debrief) {
    return (
      <div className="rounded-2xl border border-primary-200 bg-primary-50/50 p-5 text-sm text-cocoa/70">
        <span className="inline-flex items-center gap-2">
          <span className="w-3.5 h-3.5 rounded-full border-2 border-primary-300 border-t-primary-600 animate-spin" />
          Reading the whole conversation back…
        </span>
      </div>
    );
  }
  const composite = Math.round(warmth(read));
  return (
    <div className="rounded-2xl border border-primary-200 bg-primary-50/50 p-5 space-y-4">
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center justify-center w-5 h-5 rounded-md bg-primary-600 text-cream text-[10px] font-bold">AI</span>
        <p className="font-display text-[11px] uppercase tracking-widest text-primary-700/70">Coaching debrief</p>
        <span className={`ml-auto text-xs font-semibold ${composite >= 60 ? 'text-secondary-600' : 'text-[#C4663D]'}`}>
          {composite >= 60 ? 'Sam opened up' : 'Sam stayed guarded'} · {composite}/100
        </span>
      </div>
      <p className="text-sm text-cocoa/80 leading-relaxed">{debrief.outcome}</p>

      <div className="space-y-2">
        {debrief.rubric.map((r) => (
          <div key={r.skill}>
            <div className="flex justify-between text-xs mb-1">
              <span className="font-semibold text-cocoa">{r.skill}</span>
              <span className="text-cocoa/45 tabular-nums">{r.score}</span>
            </div>
            <div className="h-1.5 rounded-full bg-cocoa/10 overflow-hidden">
              <div className="h-full rounded-full bg-primary-500" style={{ width: `${r.score}%` }} />
            </div>
            <p className="mt-1 text-[11.5px] text-cocoa/55 leading-snug">{r.note}</p>
          </div>
        ))}
      </div>

      <div className="grid sm:grid-cols-2 gap-3 pt-1">
        <div className="rounded-xl bg-secondary-100/60 border border-secondary-200 p-3">
          <p className="font-display text-[11px] uppercase tracking-widest text-secondary-700/70 mb-1">Your move that worked</p>
          <p className="text-xs text-cocoa/75 leading-relaxed">{debrief.worked}</p>
        </div>
        <div className="rounded-xl bg-accent-400/15 border border-accent-500/30 p-3">
          <p className="font-display text-[11px] uppercase tracking-widest text-accent-700/80 mb-1">Try this next time</p>
          <p className="text-xs text-cocoa/75 leading-relaxed">{debrief.tryNext}</p>
        </div>
      </div>

      <button onClick={onReplay} className="text-xs font-semibold text-primary-600 hover:underline">↺ Run it again</button>
    </div>
  );
}

// ── Authored debrief (fallback / static site) ──────────────────────
function authoredDebrief(chosen: Approach[], read: Read): Debrief {
  const bySkill = (skill: string) => {
    const moves = chosen.filter((c) => c.skill === skill);
    if (moves.length === 0) return { score: 50, note: 'Didn’t really come up, a chance you left on the table.' };
    const good = moves.filter((m) => m.quality === 'insightful').length;
    const bad = moves.filter((m) => m.quality === 'misstep').length;
    const score = clamp(55 + good * 22 - bad * 25);
    const note =
      bad > good
        ? 'You reached for this but slipped into fixing or reassuring, it closed Sam down a notch.'
        : good > 0
        ? 'You did this well, it’s a big reason Sam let the guard down.'
        : 'You touched this but kept it surface; there was more room to go.';
    return { score, note };
  };
  const rubric = SKILLS.map((skill) => ({ skill, ...bySkill(skill) }));
  const insightful = chosen.filter((c) => c.quality === 'insightful');
  const misstep = chosen.filter((c) => c.quality === 'misstep');
  const composite = Math.round(warmth(read));

  const outcome =
    composite >= 70
      ? 'Sam went from guarded to genuinely relieved. You named the “everything routes to me” pattern without making Sam defend it, and you left with a step you built together, that’s the difference between a check-in and a turning point.'
      : composite >= 55
      ? 'Sam opened up partway. The honesty was there by the end, but a couple of moves jumped toward solving before Sam felt fully heard, the burnout surfaced, the next step is still a little yours rather than theirs.'
      : 'Sam stayed mostly guarded. The instinct to reassure and fix kept the conversation safe for you but not for Sam, the real thing (the burnout, the thought of leaving) never fully came out. Worth a re-run.';

  return {
    outcome,
    worked: insightful[0]
      ? `“${insightful[0].text.slice(0, 90)}…”, that landed. ${insightful[0].skill.toLowerCase()} is exactly what made Sam feel safe enough to be honest.`
      : 'You kept the conversation calm and respectful throughout, a solid floor to build on.',
    tryNext: misstep[0]
      ? `When you said “${misstep[0].text.slice(0, 70)}…”, you reached for a fix before Sam felt heard. Next time, sit in the discomfort one beat longer and reflect back what you heard first.`
      : 'Push even further on co-creating: hand Sam the pen on what the next challenge should be, rather than offering the option yourself.',
    rubric,
  };
}

// ── Prompts (used only when a live model is present) ───────────────
function transcriptText(turns: Turn[]) {
  return turns.map((t) => `${t.role === 'you' ? 'MANAGER' : 'SAM'}: ${t.text}`).join('\n');
}
function samPrompt(turns: Turn[], managerLine: string, read: Read, isLast: boolean) {
  return `You are roleplaying SAM RIVERA, a senior engineer quietly burning out, the former go-to who now gets all the urgent work and none of the interesting work, and has privately thought about leaving. Stay fully in character: guarded at first, opening up only as the manager earns it. Never coach or break character.\nConversation so far:\n${transcriptText(turns)}\nMANAGER just said: "${managerLine}"\nCurrent read, trust ${read.trust}, openness ${read.openness}, guard ${read.guard}.\n${isLast ? 'This is the closing beat; give a short, real reaction to how the conversation landed.' : 'Reply in 1-2 natural sentences.'}\nReturn ONLY JSON: {"line":"Sam's reply"}`;
}
function samFreePrompt(turns: Turn[], managerLine: string, read: Read, isLast: boolean) {
  return `You are roleplaying SAM RIVERA (senior engineer, quietly burned out, former go-to, gets all urgent work, has thought about leaving). Stay in character. Also judge how the MANAGER's latest line lands.\nConversation:\n${transcriptText(turns)}\nMANAGER just said: "${managerLine}"\nCurrent read, trust ${read.trust}, openness ${read.openness}, guard ${read.guard} (0-100).\nReturn ONLY JSON: {"line":"Sam's 1-2 sentence in-character reply","deltas":{"trust":int -20..20,"openness":int -20..20,"guard":int -20..20},"skill":"one of: Made it safe | Listened before fixing | Named the pattern | Co-created a next step","quality":"insightful | okay | misstep"}. Reward listening and safety; penalize jumping to fixes or reassurance.`;
}
function debriefPrompt(turns: Turn[], read: Read) {
  return `You are a warm, sharp leadership coach. Debrief this manager's coaching conversation with Sam (a burned-out top performer). Be specific, quote their actual words, no fluff.\nTranscript:\n${transcriptText(turns)}\nFinal read, trust ${read.trust}, openness ${read.openness}, guard ${read.guard}.\nReturn ONLY JSON: {"outcome":"2-3 sentences on how it went and where Sam landed","worked":"one specific thing they did well, quoting them","tryNext":"one specific thing to try next time, quoting a moment","rubric":[{"skill":"Made it safe","score":int 0-100,"note":"short, specific"},{"skill":"Listened before fixing","score":int,"note":"..."},{"skill":"Named the pattern","score":int,"note":"..."},{"skill":"Co-created a next step","score":int,"note":"..."}]}`;
}
