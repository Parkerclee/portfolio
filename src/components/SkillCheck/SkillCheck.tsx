import { useEffect, useRef, useState } from 'react';
import { aiAvailable, aiJSON } from '../../lib/ai';

/**
 * Skill Check, an adaptive AI knowledge check. Instead of ten fixed questions
 * everyone answers identically, an interviewer probes each competency, scores
 * the substance of the answer, and spends its remaining question on whatever
 * looked weakest. Every exchange emits xAPI, so what lands in the LRS is a
 * mastery profile, not a completion bit.
 *
 * Topic: customer data handling, the same compliance push the TeamPulse
 * dashboard reports on. This is the learner-side instrument; the dashboard is
 * the roll-up.
 *
 * Live mode (preview surface or /api/claude proxy): the learner answers in
 * their own words and the model scores and writes the follow-up. Static
 * fallback: authored answer options with authored scoring, fully playable.
 */

// ── Competency model ───────────────────────────────────────────────
interface Competency {
  id: string;
  label: string;
  short: string; // what "good" looks like, used in prompts + report
}

const COMPETENCIES: Competency[] = [
  {
    id: 'pii-boundaries',
    label: 'PII boundaries',
    short: 'Knows what counts as PII and which systems it is allowed to live in.',
  },
  {
    id: 'exports',
    label: 'Exports & local copies',
    short: 'Knows when exporting customer data is allowed and what to do instead of a local spreadsheet.',
  },
  {
    id: 'sharing',
    label: 'Access & sharing',
    short: 'Handles access requests through the approval path instead of forwarding data directly.',
  },
  {
    id: 'escalation',
    label: 'Incident escalation',
    short: 'Recognizes a potential exposure and escalates it fast, without cleaning it up quietly first.',
  },
];

interface AnswerOption {
  label: string;
  score: number; // 0–100
  note: string; // one-line coaching note
}

interface QuestionSpec {
  competency: string;
  question: string;
  options: AnswerOption[]; // authored answers for guided mode
}

// Authored openers, one per competency. In guided mode these are the whole
// interview; in live mode they seed it and the model takes over the follow-up.
const QUESTIONS: QuestionSpec[] = [
  {
    competency: 'pii-boundaries',
    question:
      "A teammate asks you what actually counts as PII in our customer records. What do you tell them, and where is that data allowed to live?",
    options: [
      {
        label:
          'Name, email, SSN, account numbers, anything that identifies a person. It stays in the CRM and the systems on the approved list; if a tool isn\'t on the list, the data doesn\'t go in it.',
        score: 92,
        note: 'Definition plus the systems boundary. That second half is what most people miss.',
      },
      {
        label: 'Stuff like names and social security numbers. Mostly you just have to be careful with it.',
        score: 48,
        note: 'The definition is half right, but "be careful" isn\'t a boundary. Where is it allowed to live?',
      },
      {
        label: 'Anything in the customer table, honestly. I treat it all the same so I don\'t have to think about it.',
        score: 30,
        note: 'Safe instinct, wrong mechanism. Treating everything as PII breaks down the first time you need to share anything.',
      },
    ],
  },
  {
    competency: 'exports',
    question:
      "You need to analyze churn across a few thousand accounts and the reporting tool is missing one field. The fastest path is exporting the customer table to a spreadsheet. What do you do?",
    options: [
      {
        label:
          'Request the field in the reporting tool, and if I can\'t wait, ask data for a de-identified extract. The full table doesn\'t leave the system for a convenience problem.',
        score: 95,
        note: 'Exactly the trade: solve the missing-field problem, not the export problem.',
      },
      {
        label: 'Export it but delete the file when I\'m done with the analysis.',
        score: 40,
        note: '"Delete it after" is the most common answer and the audit finding. The exposure happens at export, not at cleanup.',
      },
      {
        label: 'Export just the columns I need, including account IDs, and keep it in my drive folder.',
        score: 35,
        note: 'Fewer columns is still customer data in an unmanaged location.',
      },
    ],
  },
  {
    competency: 'sharing',
    question:
      "A colleague on another team pings you: \"Can you send me the list of customers in the pilot? I need it for a deck today.\" They're legitimate and it's urgent. What happens next?",
    options: [
      {
        label:
          'They get pointed to the access request path, and I flag it as urgent to speed the approval. If the deck only needs counts, I can share the aggregate myself.',
        score: 90,
        note: 'Right on both halves: the path for the data, an aggregate when the data isn\'t actually needed.',
      },
      {
        label: 'Send it, they\'re internal and it\'s clearly work-related.',
        score: 25,
        note: 'Internal and legitimate is not the test. The approval path exists exactly for this moment.',
      },
      {
        label: 'Ask my manager if it\'s okay to send.',
        score: 55,
        note: 'Better than sending, but the answer is a process, not a person. Your manager will just have to look it up too.',
      },
    ],
  },
  {
    competency: 'escalation',
    question:
      "You realize a spreadsheet with customer emails was shared to a channel with contractors in it three days ago. Nobody has said anything. What do you do, in order?",
    options: [
      {
        label:
          'Report it to security first, then pull the file. They need the timeline and audience while it\'s intact; deleting first destroys the evidence they triage with.',
        score: 94,
        note: 'The order is the whole answer, and you got it right: report, then remediate.',
      },
      {
        label: 'Delete it from the channel immediately, then report it since it\'s handled.',
        score: 45,
        note: 'The instinct to act fast is right, but delete-first hides the scope from the people who have to assess it.',
      },
      {
        label: 'Delete it quietly. Three days with no complaints means no harm done.',
        score: 12,
        note: 'This is the answer that turns an incident into a cover-up. Silence isn\'t evidence of no exposure.',
      },
    ],
  },
];

// Authored adaptive follow-up per competency (guided mode's 5th question).
const FOLLOWUPS: Record<string, QuestionSpec> = {
  'pii-boundaries': {
    competency: 'pii-boundaries',
    question:
      'Follow-up, since this one was shaky: a customer\'s first name alone, in a support note. PII or not, and does it matter?',
    options: [
      {
        label: 'On its own, low risk. Combined with anything identifying in the same record, treat the record as PII. Context decides.',
        score: 88,
        note: 'Context over checklist. That\'s the mature version of this skill.',
      },
      { label: 'Not PII. First names are everywhere.', score: 35, note: 'True alone, wrong in a record that links it to an account.' },
      { label: 'Everything in a support note is PII.', score: 40, note: 'Overcorrection again. The skill is judging linkage, not blanket labels.' },
    ],
  },
  exports: {
    competency: 'exports',
    question:
      'Follow-up: your manager asks for the same export "just this once" for a board meeting. Does that change the answer?',
    options: [
      {
        label: 'The ask is legitimate but the path is the same: de-identified extract or an approved report. Authority doesn\'t change where data can live.',
        score: 90,
        note: 'Holding the line under mild pressure is the actual competency.',
      },
      { label: 'A manager request makes it approved, so yes, export it.', score: 30, note: 'Approval is a process, not a person with seniority.' },
      { label: 'I\'d do it but ask them to delete it after the meeting.', score: 38, note: 'Same exposure, now with two copies.' },
    ],
  },
  sharing: {
    competency: 'sharing',
    question:
      'Follow-up: the requester says the access request path takes two days and the deadline is today. Now what?',
    options: [
      {
        label: 'Escalate the request as urgent, and meanwhile give them what doesn\'t need approval: counts, aggregates, a screenshot of the dashboard.',
        score: 89,
        note: 'Speed problems get escalation, not workarounds. Good.',
      },
      { label: 'Send it this once and note it in the request afterwards.', score: 28, note: 'Retroactive paperwork isn\'t approval.' },
      { label: 'Tell them it\'s not possible and leave it there.', score: 50, note: 'Compliant but unhelpful. The aggregate option was available.' },
    ],
  },
  escalation: {
    competency: 'escalation',
    question:
      'Follow-up: security asks how many people could have seen the file. You can see channel membership but not view history. What do you give them?',
    options: [
      {
        label: 'The membership list, when it was shared, and an explicit "I can\'t see views." What I know, what I don\'t, clearly separated.',
        score: 91,
        note: 'Clean incident reporting: facts, gaps, no guesses dressed as facts.',
      },
      { label: 'An estimate of viewers based on how active the channel is.', score: 40, note: 'A guess presented as data slows triage down.' },
      { label: 'Just the membership count, that\'s all they asked for.', score: 55, note: 'Accurate but thin. The timing and the visibility gap matter.' },
    ],
  },
};

// ── xAPI + scoring ─────────────────────────────────────────────────
interface XStatement {
  verb: string;
  object: string;
  extra?: string;
}
interface Exchange {
  role: 'coach' | 'you';
  text: string;
  note?: string;
  score?: number;
  competency?: string;
}

const MASTERY_BAR = 70;

function avg(nums: number[]) {
  return nums.length ? Math.round(nums.reduce((a, b) => a + b, 0) / nums.length) : 0;
}

interface LiveJudgement {
  score: number;
  note: string;
}

function judgePrompt(spec: QuestionSpec, comp: Competency, answer: string): string {
  return [
    'You are scoring one answer in a workplace knowledge check about customer data handling.',
    `Competency: ${comp.label}. Strong looks like: ${comp.short}`,
    `Question asked: ${spec.question}`,
    `Learner's answer: """${answer}"""`,
    'Score the substance 0-100 (70+ means they could be trusted to do this unsupervised) and write one coaching sentence in a direct, warm voice. Judge what they said, not how formally they said it.',
    'Reply with ONLY JSON: {"score": <int>, "note": "<one sentence>"}',
  ].join('\n');
}

// ── Component ──────────────────────────────────────────────────────
type Phase = 'brief' | 'live' | 'report';

export default function SkillCheck() {
  const [phase, setPhase] = useState<Phase>('brief');
  const [qIdx, setQIdx] = useState(0); // 0..3 openers, 4 = adaptive follow-up
  const [currentQ, setCurrentQ] = useState<QuestionSpec>(QUESTIONS[0]);
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [scores, setScores] = useState<Record<string, number[]>>({});
  const [xapi, setXapi] = useState<XStatement[]>([]);
  const [thinking, setThinking] = useState(false);
  const [freeText, setFreeText] = useState('');
  const [aiLive, setAiLive] = useState(false);

  useEffect(() => {
    aiAvailable().then(setAiLive);
  }, []);

  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [exchanges, thinking, phase]);

  const emit = (s: XStatement) => setXapi((x) => [...x, s]);

  const compScore = (id: string) => avg(scores[id] ?? []);

  function start() {
    setPhase('live');
    emit({ verb: 'launched', object: 'skill-check/customer-data-handling' });
    setExchanges([{ role: 'coach', text: QUESTIONS[0].question, competency: QUESTIONS[0].competency }]);
    emit({ verb: 'asked', object: QUESTIONS[0].competency });
  }

  function weakestCompetency(all: Record<string, number[]>): string {
    let worst = COMPETENCIES[0].id;
    let worstScore = Infinity;
    for (const c of COMPETENCIES) {
      const s = avg(all[c.id] ?? [0]);
      if (s < worstScore) {
        worstScore = s;
        worst = c.id;
      }
    }
    return worst;
  }

  async function advance(newScores: Record<string, number[]>) {
    const nextIdx = qIdx + 1;
    setQIdx(nextIdx);

    if (nextIdx < QUESTIONS.length) {
      const next = QUESTIONS[nextIdx];
      setCurrentQ(next);
      setExchanges((e) => [...e, { role: 'coach', text: next.question, competency: next.competency }]);
      emit({ verb: 'asked', object: next.competency });
      return;
    }

    if (nextIdx === QUESTIONS.length) {
      // Adaptive turn: spend the last question on the weakest competency.
      const weakId = weakestCompetency(newScores);
      const followup = FOLLOWUPS[weakId];
      setCurrentQ(followup);
      emit({ verb: 'adapted', object: weakId, extra: `weakest so far (${avg(newScores[weakId] ?? [])}%)` });
      setExchanges((e) => [...e, { role: 'coach', text: followup.question, competency: weakId }]);
      emit({ verb: 'asked', object: `${weakId} (follow-up)` });
      return;
    }

    finish(newScores);
  }

  function finish(finalScores: Record<string, number[]>) {
    setPhase('report');
    for (const c of COMPETENCIES) {
      const s = avg(finalScores[c.id] ?? []);
      emit({
        verb: s >= MASTERY_BAR ? 'mastered' : 'progressed',
        object: c.id,
        extra: `scaled ${(s / 100).toFixed(2)}`,
      });
    }
    emit({ verb: 'completed', object: 'skill-check/customer-data-handling' });
  }

  function recordAnswer(text: string, score: number, note: string, competency: string) {
    setExchanges((e) => [...e, { role: 'you', text }, { role: 'coach', text: note, note, score, competency }]);
    emit({ verb: 'answered', object: competency, extra: `scaled ${(score / 100).toFixed(2)}` });
    const newScores = { ...scores, [competency]: [...(scores[competency] ?? []), score] };
    setScores(newScores);
    return newScores;
  }

  async function chooseOption(opt: AnswerOption) {
    if (thinking) return;
    setThinking(true);
    const comp = currentQ.competency;
    setExchanges((e) => [...e, { role: 'you', text: opt.label }]);
    await new Promise((r) => setTimeout(r, 650));
    setExchanges((e) => [...e, { role: 'coach', text: opt.note, score: opt.score, competency: comp }]);
    emit({ verb: 'answered', object: comp, extra: `scaled ${(opt.score / 100).toFixed(2)}` });
    const newScores = { ...scores, [comp]: [...(scores[comp] ?? []), opt.score] };
    setScores(newScores);
    setThinking(false);
    await advance(newScores);
  }

  async function sendFreeText() {
    const answer = freeText.trim();
    if (!answer || !aiLive || thinking) return;
    setFreeText('');
    setThinking(true);
    setExchanges((e) => [...e, { role: 'you', text: answer }]);

    const comp = COMPETENCIES.find((c) => c.id === currentQ.competency)!;
    const judged = await aiJSON<LiveJudgement>(judgePrompt(currentQ, comp, answer), {
      score: 55,
      note: 'I could not score that one live, so it gets a neutral mark. Try the next one.',
    });
    const score = Math.max(0, Math.min(100, Math.round(judged.score)));

    setExchanges((e) => [...e, { role: 'coach', text: judged.note, score, competency: comp.id }]);
    emit({ verb: 'answered', object: comp.id, extra: `scaled ${(score / 100).toFixed(2)}` });
    const newScores = { ...scores, [comp.id]: [...(scores[comp.id] ?? []), score] };
    setScores(newScores);
    setThinking(false);
    await advance(newScores);
  }

  function reset() {
    setPhase('brief');
    setQIdx(0);
    setCurrentQ(QUESTIONS[0]);
    setExchanges([]);
    setScores({});
    setXapi([]);
    setFreeText('');
  }

  // ── Render ──
  return (
    <div className="rounded-3xl border border-cocoa/15 bg-paper overflow-hidden shadow-xl shadow-primary-900/5">
      {/* Title bar */}
      <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-cocoa/10 bg-cocoa text-cream">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex w-7 h-7 rounded-lg bg-cream/15 items-center justify-center text-sm">🧭</span>
          <div className="leading-tight">
            <p className="font-display font-semibold text-sm">Skill Check</p>
            <p className="text-[11px] text-cream/55">Customer data handling · adaptive</p>
          </div>
        </div>
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${aiLive ? 'bg-secondary-400/25 text-secondary-100' : 'bg-cream/10 text-cream/70'}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${aiLive ? 'bg-secondary-300 animate-pulse' : 'bg-accent-400'}`} />
          {aiLive ? 'Live AI scoring' : 'Guided demo'}
        </span>
      </div>

      {phase === 'brief' && (
        <div className="px-6 sm:px-10 py-9 max-w-2xl">
          <p className="font-display text-[11px] uppercase tracking-widest text-cocoa/40 mb-2">The setup</p>
          <h3 className="font-display font-semibold text-cocoa text-2xl leading-tight mb-4">
            A quiz asks ten questions. An assessor asks the right five.
          </h3>
          <div className="space-y-3 text-[0.95rem] text-cocoa/75 leading-relaxed">
            <p>
              This is a knowledge check on customer data handling that behaves like a good interviewer: one open
              question per competency, scored on substance, then the final question spent wherever you looked weakest.
            </p>
            <p>
              Every exchange emits xAPI, so the record isn't "completed the quiz." It's a mastery profile per
              competency, the thing the <a href="/dashboard" className="text-primary-600 font-semibold hover:underline">manager dashboard</a> rolls up.
            </p>
            {aiLive ? (
              <p className="text-secondary-700 font-semibold text-sm">
                A live model is connected: answer in your own words and it scores what you actually said.
              </p>
            ) : (
              <p className="text-cocoa/55 text-sm">
                Running as a guided version: pick from realistic answers, the same scoring and adaptivity applies.
              </p>
            )}
          </div>
          <button
            onClick={start}
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary-500 text-cream font-semibold px-6 py-3 retro-sheen hover:bg-primary-600 transition-colors"
          >
            Start the check
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </button>
        </div>
      )}

      {phase !== 'brief' && (
        <div className="grid lg:grid-cols-[1fr_300px]">
          {/* Interview column */}
          <div className="flex flex-col min-h-[520px] max-h-[640px]">
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-5 space-y-4 bg-cream-50">
              {exchanges.map((x, i) =>
                x.role === 'coach' ? (
                  <div key={i} className="max-w-[85%]">
                    <div className={`rounded-2xl rounded-tl-sm px-4 py-3 text-sm leading-relaxed ${x.score !== undefined ? 'bg-secondary-100/70 border border-secondary-200 text-cocoa' : 'bg-paper border border-cocoa/10 text-cocoa'}`}>
                      {x.score !== undefined && (
                        <p className="font-display text-[10px] uppercase tracking-widest text-secondary-700 mb-1">
                          Scored {x.score}/100
                        </p>
                      )}
                      {x.text}
                    </div>
                  </div>
                ) : (
                  <div key={i} className="max-w-[85%] ml-auto">
                    <div className="rounded-2xl rounded-tr-sm bg-primary-500 text-cream px-4 py-3 text-sm leading-relaxed">
                      {x.text}
                    </div>
                  </div>
                )
              )}
              {thinking && (
                <div className="flex items-center gap-1.5 px-2 py-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-cocoa/30 animate-bounce" />
                  <span className="w-1.5 h-1.5 rounded-full bg-cocoa/30 animate-bounce [animation-delay:120ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-cocoa/30 animate-bounce [animation-delay:240ms]" />
                </div>
              )}
              {phase === 'report' && (
                <div className="rounded-2xl border border-cocoa/15 bg-paper p-5">
                  <p className="font-display text-[11px] uppercase tracking-widest text-cocoa/40 mb-3">Mastery profile</p>
                  <div className="space-y-3">
                    {COMPETENCIES.map((c) => {
                      const s = compScore(c.id);
                      const mastered = s >= MASTERY_BAR;
                      return (
                        <div key={c.id}>
                          <div className="flex items-baseline justify-between gap-3 mb-1">
                            <p className="font-display font-semibold text-cocoa text-sm">{c.label}</p>
                            <span className={`text-[11px] font-bold ${mastered ? 'text-secondary-700' : 'text-primary-600'}`}>
                              {mastered ? `Mastered · ${s}` : `Review · ${s}`}
                            </span>
                          </div>
                          <p className="text-[12px] text-cocoa/60 leading-relaxed">{c.short}</p>
                        </div>
                      );
                    })}
                  </div>
                  <button
                    onClick={reset}
                    className="mt-5 inline-flex items-center gap-2 rounded-full border border-cocoa/25 px-4 py-2 text-sm font-semibold text-cocoa hover:border-primary-500 hover:text-primary-600 transition-colors"
                  >
                    Run it again
                  </button>
                </div>
              )}
            </div>

            {phase === 'live' && !thinking && (
              <div className="border-t border-cocoa/10 bg-paper px-5 py-4">
                <p className="font-display text-[11px] uppercase tracking-widest text-cocoa/40 mb-2">Your answer</p>
                {!aiLive && (
                  <div className="space-y-2">
                    {currentQ.options.map((o, i) => (
                      <button
                        key={i}
                        onClick={() => chooseOption(o)}
                        className="w-full text-left rounded-xl border border-cocoa/15 bg-cream-50 hover:border-primary-400 hover:bg-primary-50/40 px-3.5 py-2.5 text-sm text-cocoa transition-colors"
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                )}
                {aiLive && (
                  <div className="flex items-end gap-2">
                    <textarea
                      value={freeText}
                      onChange={(e) => setFreeText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          sendFreeText();
                        }
                      }}
                      rows={2}
                      placeholder="Answer in your own words…"
                      className="flex-1 rounded-xl border border-cocoa/15 bg-paper px-3.5 py-2.5 text-sm text-cocoa placeholder:text-cocoa/35 focus:outline-none focus:border-primary-400 resize-none"
                    />
                    <button
                      onClick={sendFreeText}
                      disabled={!freeText.trim()}
                      className="rounded-xl bg-cocoa text-cream px-4 py-2.5 text-sm font-semibold hover:bg-espresso transition-colors disabled:opacity-40"
                    >
                      Send
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Mastery + xAPI column */}
          <aside className="border-t lg:border-t-0 lg:border-l border-cocoa/10 bg-paper px-5 py-5 space-y-6">
            <div>
              <p className="font-display text-[11px] uppercase tracking-widest text-cocoa/40 mb-3">Mastery so far</p>
              {COMPETENCIES.map((c) => {
                const s = compScore(c.id);
                const probed = (scores[c.id] ?? []).length > 0;
                return (
                  <div key={c.id} className="mb-3">
                    <div className="flex items-baseline justify-between gap-2 mb-1">
                      <p className="text-[12px] font-semibold text-cocoa/80">{c.label}</p>
                      <span className="text-[11px] font-bold text-cocoa/50">{probed ? s : '—'}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-cocoa/10 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${s >= MASTERY_BAR ? 'bg-secondary-500' : 'bg-primary-500'}`}
                        style={{ width: `${probed ? s : 0}%` }}
                      />
                    </div>
                  </div>
                );
              })}
              <p className="mt-3 text-[11px] text-cocoa/50 leading-relaxed">
                The last question goes to whichever bar is lowest. That's the adaptive part.
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
                Mastery per competency, not a completion bit. This is what rolls up to the dashboard.
              </p>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
