import { Fragment, useMemo, useState } from 'react';

/**
 * Team Pulse, a manager-facing view of one training assignment, the way it
 * looks once xAPI statements land in an LRS. It mirrors the LouLearn assignment
 * dashboard (who's done, scores, open-text answers) and then layers on the part
 * managers actually want: AI that reads the raw xAPI and returns a follow-up
 * training plan and ready-to-send Slack coaching nudges.
 *
 * The roster is synthetic but shaped exactly like aggregated LRS output. The AI
 * calls use window.claude.complete when available (e.g. in a Claude preview)
 * and fall back to hand-authored output so the demo is compelling statically.
 */

// ── Types ──────────────────────────────────────────────────────────
type Status = 'completed' | 'in-progress' | 'not-started';

interface Learner {
  name: string;
  role: string;
  status: Status;
  progress: number; // 0–100
  score: number | null; // 0–1 scaled, null until a scored attempt exists
  passed: boolean | null;
  last: string; // human last-activity
  reflection?: string; // open-text answer to the lesson's reflection prompt
}

interface PlanGap {
  theme: string;
  evidence: string;
  severity: 'high' | 'medium' | 'low';
}
interface PlanAction {
  action: string;
  who: string;
  when: string;
}
interface TrainingPlan {
  headline: string;
  riskSummary: string;
  gaps: PlanGap[];
  actions: PlanAction[];
}

interface Nudge {
  to: string;
  channel: string;
  text: string;
}
interface SlackDraft {
  digest: { channel: string; text: string };
  nudges: Nudge[];
}

// ── Scenario data ──────────────────────────────────────────────────
const ASSIGN = {
  course: 'Customer Data Handling',
  team: 'Revenue Operations',
  manager: 'Dana Okafor',
  dueLabel: 'Fri, Jun 19',
  dueInDays: 3,
};

const TEAM: Learner[] = [
  { name: 'Priya Raman', role: 'AE', status: 'completed', progress: 100, score: 1.0, passed: true, last: '2 days ago',
    reflection: 'I keep prospect lists in a personal spreadsheet for forecasting, I’ll move that into the CRM and delete the local copy.' },
  { name: 'Marcus Bell', role: 'AE', status: 'completed', progress: 100, score: 0.67, passed: false, last: '1 day ago',
    reflection: 'Honestly not sure what counts as PII vs. just contact info. I forward customer emails to my Gmail to read on my phone.' },
  { name: 'Sofia Nguyen', role: 'SDR', status: 'completed', progress: 100, score: 1.0, passed: true, last: '3 days ago' },
  { name: 'Jordan Park', role: 'Ops Analyst', status: 'completed', progress: 100, score: 0.33, passed: false, last: '4 hours ago',
    reflection: 'I export the full customer table to CSV every Monday for the board deck. Didn’t realize that was a problem.' },
  { name: 'Aisha Khan', role: 'AE', status: 'completed', progress: 100, score: 1.0, passed: true, last: '2 days ago' },
  { name: 'Tom Becker', role: 'SDR', status: 'completed', progress: 100, score: 0.67, passed: true, last: '5 days ago' },
  { name: 'Elena Vasquez', role: 'Ops Analyst', status: 'completed', progress: 100, score: 1.0, passed: true, last: '6 days ago' },
  { name: 'Chris Donnelly', role: 'AE', status: 'in-progress', progress: 55, score: null, passed: null, last: '20 min ago' },
  { name: 'Maya Foster', role: 'SDR', status: 'in-progress', progress: 30, score: null, passed: null, last: 'yesterday' },
  { name: 'Raj Patel', role: 'AE', status: 'in-progress', progress: 10, score: null, passed: null, last: '1 hour ago' },
  { name: 'Will Hartley', role: 'AE', status: 'not-started', progress: 0, score: null, passed: null, last: '—' },
  { name: 'Grace Liu', role: 'Ops Analyst', status: 'not-started', progress: 0, score: null, passed: null, last: '—' },
];

// ── Derived manager metrics ────────────────────────────────────────
function useMetrics() {
  return useMemo(() => {
    const total = TEAM.length;
    const completed = TEAM.filter((l) => l.status === 'completed').length;
    const scored = TEAM.filter((l) => l.score != null);
    const avg = scored.reduce((s, l) => s + (l.score as number), 0) / (scored.length || 1);
    // At-risk = failed the check, stalled in progress, or not started with the clock running.
    const atRisk = TEAM.filter(
      (l) => l.passed === false || (l.status === 'not-started') || (l.status === 'in-progress' && l.progress < 35)
    );
    return { total, completed, completionPct: Math.round((completed / total) * 100), avg, atRisk };
  }, []);
}

// ── AI plumbing ────────────────────────────────────────────────────
async function callJSON<T>(prompt: string, fallback: T): Promise<T> {
  const claude = (window as any).claude;
  if (!claude?.complete) {
    await new Promise((r) => setTimeout(r, 900)); // let the "analyzing" state read as real
    return fallback;
  }
  try {
    const txt = await claude.complete({ messages: [{ role: 'user', content: prompt }] });
    const m = txt.match(/\{[\s\S]*\}/);
    if (!m) throw new Error('no json');
    return JSON.parse(m[0]) as T;
  } catch {
    return fallback;
  }
}

function rosterForPrompt() {
  return TEAM.map((l) => ({
    name: l.name, role: l.role, status: l.status, progress: l.progress,
    score: l.score, passed: l.passed, reflection: l.reflection ?? null,
  }));
}

// ── Pre-baked fallbacks (what a strong model returns on this data) ──
const PLAN_FALLBACK: TrainingPlan = {
  headline: 'Two real exposure patterns, three people to coach this week',
  riskSummary:
    'Completion is healthy (7 of 12) but the signal is in the answers, not the rate. Three people who finished revealed active data-handling habits that the audit would flag, and the two lowest scores both name a specific, fixable behavior. This is a coaching problem, not a re-train-everyone problem.',
  gaps: [
    { theme: 'Bulk export to local files', severity: 'high',
      evidence: 'Jordan Park (33%) exports the full customer table to CSV weekly; Priya self-reported a local prospect spreadsheet. Pattern: data leaving the system of record for convenience.' },
    { theme: 'PII boundary confusion', severity: 'high',
      evidence: 'Marcus Bell (67%) can’t distinguish PII from contact info and forwards customer email to personal Gmail, exactly the "wrong-recipient" leak the lesson centers on.' },
    { theme: 'Stalled before the risky part', severity: 'medium',
      evidence: 'Maya (30%) and Raj (10%) haven’t reached the breach-response section; Will and Grace haven’t started with 3 days left.' },
  ],
  actions: [
    { action: 'Targeted 15-min 1:1 on the CSV-export workflow + set up a sanctioned dashboard export', who: 'Jordan Park', when: 'This week' },
    { action: 'Re-take the check after a 1:1 clarifying PII vs. contact info; stop the Gmail forwarding today', who: 'Marcus Bell', when: 'Before Fri' },
    { action: 'Assign the 4-min "Spotting a Leak" micro-module as a focused follow-up', who: 'Jordan, Marcus', when: 'This week' },
    { action: 'Nudge to finish before the due date', who: 'Maya, Raj, Will, Grace', when: 'Today' },
  ],
};

const SLACK_FALLBACK: SlackDraft = {
  digest: {
    channel: '#revops-leads',
    text: 'Customer Data Handling, team is 7/12 done with 3 days left. Two scores need a quick coaching convo (Jordan 33%, Marcus 67%), both flagged a specific, fixable habit in their answers. 4 folks still to finish. I’ve drafted nudges for each; want me to send?',
  },
  nudges: [
    { to: 'Jordan Park', channel: 'DM',
      text: 'Hey Jordan, thanks for finishing the data-handling lesson. Quick one: I saw the bit about the weekly CSV export for the board deck. Let’s grab 15 min this week, I think we can get you the same numbers from a sanctioned dashboard export so you’re not pulling the full table down. Not a gotcha, just want to keep you covered.' },
    { to: 'Marcus Bell', channel: 'DM',
      text: 'Hey Marcus, appreciate you knocking out the training. One thing worth a 10-min chat: the PII vs. contact-info distinction trips a lot of people up. Can we also stop the forward-to-Gmail habit today? Happy to set you up so customer email is readable on your phone the approved way.' },
    { to: 'Maya, Raj, Will, Grace', channel: 'DM',
      text: 'Quick nudge, Customer Data Handling is due Fri. It’s ~6 minutes. Knock it out when you get a sec and you’re done: [link]' },
  ],
};

// ── UI atoms ───────────────────────────────────────────────────────
const STATUS_STYLE: Record<Status, string> = {
  completed: 'bg-secondary-100 text-secondary-700',
  'in-progress': 'bg-accent-300 text-cocoa',
  'not-started': 'bg-cocoa/10 text-cocoa/60',
};
const STATUS_LABEL: Record<Status, string> = {
  completed: 'Completed',
  'in-progress': 'In progress',
  'not-started': 'Not started',
};

function StatusPill({ status }: { status: Status }) {
  return (
    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_STYLE[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

function ScoreCell({ l }: { l: Learner }) {
  if (l.score == null) return <span className="text-cocoa/35">—</span>;
  const pct = Math.round(l.score * 100);
  const good = l.passed;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
        good ? 'bg-secondary-100 text-secondary-700' : 'bg-[#F4DACB] text-[#9C4A24]'
      }`}
    >
      {good ? 'Passed' : 'Failed'} · {pct}%
    </span>
  );
}

function Meter({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 rounded-full bg-cocoa/10 overflow-hidden">
        <div className="h-full rounded-full bg-primary-500" style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs text-cocoa/50 tabular-nums w-8">{value}%</span>
    </div>
  );
}

function SeverityDot({ s }: { s: PlanGap['severity'] }) {
  const c = s === 'high' ? 'bg-[#C4663D]' : s === 'medium' ? 'bg-accent-500' : 'bg-secondary-400';
  return <span className={`mt-1.5 inline-block w-2 h-2 rounded-full shrink-0 ${c}`} />;
}

function Avatar({ name }: { name: string }) {
  const initials = name.split(/[\s,]+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
  return (
    <span className="inline-flex items-center justify-center w-8 h-8 rounded-md bg-primary-100 text-primary-700 text-xs font-bold shrink-0">
      {initials}
    </span>
  );
}

// ── Main ───────────────────────────────────────────────────────────
export default function Dashboard() {
  const { total, completed, completionPct, avg, atRisk } = useMetrics();
  const [openRow, setOpenRow] = useState<string | null>(null);

  const [plan, setPlan] = useState<TrainingPlan | null>(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [slack, setSlack] = useState<SlackDraft | null>(null);
  const [slackLoading, setSlackLoading] = useState(false);
  const [sent, setSent] = useState<Record<number, boolean>>({});

  async function buildPlan() {
    setPlanLoading(true);
    const result = await callJSON<TrainingPlan>(
      `You are an L&D analyst reading raw xAPI statements from a compliance training assignment. ` +
        `The course is "Customer Data Handling". Here is the aggregated team data (statuses, quiz scores 0–1, and free-text reflection answers):\n` +
        `${JSON.stringify(rosterForPrompt())}\n\n` +
        `A busy manager needs the signal, not the noise. Identify the real exposure patterns hiding in the scores and reflections, and propose a tight, specific follow-up. ` +
        `Return ONLY JSON: {"headline":"one line","riskSummary":"2-3 sentences","gaps":[{"theme":"short","evidence":"who+what, specific","severity":"high|medium|low"}],"actions":[{"action":"specific","who":"name(s)","when":"short"}]}`,
      PLAN_FALLBACK
    );
    setPlan(result);
    setPlanLoading(false);
  }

  async function draftSlack() {
    setSlackLoading(true);
    const result = await callJSON<SlackDraft>(
      `You are a manager's coaching assistant. Based on this xAPI training data for "Customer Data Handling":\n` +
        `${JSON.stringify(rosterForPrompt())}\n\n` +
        `Draft Slack messages the manager (${ASSIGN.manager}) can send: one team-channel digest, and individual coaching DMs for the people who need a nudge or a kind, specific conversation about a risky habit they revealed. Warm, human, never preachy. ` +
        `Return ONLY JSON: {"digest":{"channel":"#channel","text":"..."},"nudges":[{"to":"name(s)","channel":"DM","text":"..."}]}`,
      SLACK_FALLBACK
    );
    setSlack(result);
    setSent({});
    setSlackLoading(false);
  }

  return (
    <div className="space-y-10">
      {/* ── Assignment header ── */}
      <div className="rounded-3xl border border-cocoa/15 bg-paper p-6 sm:p-7">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="font-display text-[11px] uppercase tracking-widest text-cocoa/45 mb-1">Assignment</p>
            <h2 className="font-display font-semibold text-cocoa text-2xl sm:text-3xl leading-tight">
              {ASSIGN.course}
            </h2>
            <p className="mt-1 text-cocoa/60 text-sm">
              {ASSIGN.team} · managed by {ASSIGN.manager} · due {ASSIGN.dueLabel}
            </p>
          </div>
          <div className="inline-flex items-center gap-2 self-start rounded-full border border-cocoa/15 bg-cream-50 px-3.5 py-1.5 text-xs font-semibold text-cocoa/70 font-display uppercase tracking-widest">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary-500" />
            Live from the LRS
          </div>
        </div>

        {/* Manager KPIs, the few things that drive a decision */}
        <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Kpi label="Completion" value={`${completed}/${total}`} sub={`${completionPct}% of the team`} tone="neutral" />
          <Kpi label="Avg. check score" value={`${Math.round(avg * 100)}%`} sub="of those who finished" tone={avg >= 0.8 ? 'good' : 'warn'} />
          <Kpi label="Need coaching" value={String(atRisk.length)} sub="failed, stalled, or unstarted" tone="risk" />
          <Kpi label="Due in" value={`${ASSIGN.dueInDays} days`} sub={ASSIGN.dueLabel} tone="neutral" />
        </div>
      </div>

      {/* ── Roster ── */}
      <div>
        <div className="flex items-baseline justify-between mb-3">
          <h3 className="font-display font-semibold text-cocoa text-lg">Team roster</h3>
          <p className="text-xs text-cocoa/45">Tap a row with a ⚑ to read what they wrote</p>
        </div>
        <div className="rounded-2xl border border-cocoa/15 bg-paper overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left font-display text-[11px] uppercase tracking-widest text-cocoa/45 border-b border-cocoa/10">
                <th className="py-3 px-4 font-semibold">Person</th>
                <th className="py-3 px-4 font-semibold">Status</th>
                <th className="py-3 px-4 font-semibold hidden sm:table-cell">Progress</th>
                <th className="py-3 px-4 font-semibold">Score</th>
                <th className="py-3 px-4 font-semibold hidden md:table-cell">Last activity</th>
              </tr>
            </thead>
            <tbody>
              {TEAM.map((l) => {
                const flagged = !!l.reflection && l.passed === false;
                const open = openRow === l.name;
                return (
                  <Fragment key={l.name}>
                    <tr
                      className={`border-b border-cocoa/[0.06] last:border-0 ${l.reflection ? 'cursor-pointer hover:bg-cream-50' : ''}`}
                      onClick={() => l.reflection && setOpenRow(open ? null : l.name)}
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <Avatar name={l.name} />
                          <div>
                            <div className="font-semibold text-cocoa flex items-center gap-1.5">
                              {l.name}
                              {l.reflection && <span className={flagged ? 'text-[#C4663D]' : 'text-cocoa/30'}>⚑</span>}
                            </div>
                            <div className="text-xs text-cocoa/45">{l.role}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4"><StatusPill status={l.status} /></td>
                      <td className="py-3 px-4 hidden sm:table-cell"><Meter value={l.progress} /></td>
                      <td className="py-3 px-4"><ScoreCell l={l} /></td>
                      <td className="py-3 px-4 hidden md:table-cell text-cocoa/50 text-xs">{l.last}</td>
                    </tr>
                    {open && l.reflection && (
                      <tr className="bg-cream-50 border-b border-cocoa/[0.06]">
                        <td colSpan={5} className="py-3 px-4">
                          <div className="text-xs">
                            <span className="font-display uppercase tracking-widest text-cocoa/45">
                              Reflection · “Where could customer data leak in your work?”
                            </span>
                            <p className="mt-1.5 text-cocoa/80 italic leading-relaxed max-w-2xl">“{l.reflection}”</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-cocoa/45">
          This is the whole picture a manager gets today: status, scores, and the open-text answers. The completion
          rate looks fine, the risk is buried in the ⚑ answers. That's the gap the next step closes.
        </p>
      </div>

      {/* ── AI layer ── */}
      <div className="rounded-3xl border border-primary-200 bg-primary-50/40 p-6 sm:p-7">
        <div className="flex items-center gap-2 mb-1">
          <AiBadge />
          <p className="font-display text-[11px] uppercase tracking-widest text-primary-700/70">
            AI analysis on the xAPI
          </p>
        </div>
        <h3 className="font-display font-semibold text-cocoa text-xl sm:text-2xl leading-tight">
          Turn the statements into a decision.
        </h3>
        <p className="mt-1.5 text-cocoa/65 text-sm max-w-2xl">
          The same xAPI feeding the table above goes to the model. It reads the scores <em>and</em> the free-text
          answers, finds the exposure patterns, and hands back something a manager can act on in two minutes.
        </p>

        <div className="mt-6 grid lg:grid-cols-2 gap-5">
          {/* Training plan */}
          <div className="rounded-2xl border border-cocoa/15 bg-paper p-5 flex flex-col">
            <h4 className="font-display font-semibold text-cocoa text-base mb-1">Follow-up training plan</h4>
            <p className="text-xs text-cocoa/55 mb-4">Gaps in the data → who to coach, on what, by when.</p>

            {!plan && (
              <button
                onClick={buildPlan}
                disabled={planLoading}
                className="self-start inline-flex items-center gap-2 rounded-full bg-cocoa text-cream px-4 py-2 text-sm font-semibold hover:bg-espresso transition-colors disabled:opacity-60"
              >
                {planLoading ? <><Spinner /> Reading the statements…</> : 'Analyze team & build plan'}
              </button>
            )}

            {plan && (
              <div className="space-y-4 text-sm">
                <div>
                  <p className="font-display font-semibold text-cocoa leading-snug">{plan.headline}</p>
                  <p className="mt-1 text-cocoa/70 leading-relaxed">{plan.riskSummary}</p>
                </div>
                <div>
                  <p className="font-display text-[11px] uppercase tracking-widest text-cocoa/45 mb-2">What the data shows</p>
                  <ul className="space-y-2">
                    {plan.gaps.map((g, i) => (
                      <li key={i} className="flex gap-2">
                        <SeverityDot s={g.severity} />
                        <span><span className="font-semibold text-cocoa">{g.theme}.</span>{' '}
                          <span className="text-cocoa/65">{g.evidence}</span></span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="font-display text-[11px] uppercase tracking-widest text-cocoa/45 mb-2">Recommended follow-up</p>
                  <ul className="space-y-2">
                    {plan.actions.map((a, i) => (
                      <li key={i} className="flex items-start gap-3 rounded-lg bg-cream-50 px-3 py-2">
                        <span className="text-cocoa/80">{a.action}</span>
                        <span className="ml-auto shrink-0 text-right">
                          <span className="block text-xs font-semibold text-cocoa">{a.who}</span>
                          <span className="block text-[11px] text-cocoa/50">{a.when}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
                <button onClick={buildPlan} className="text-xs font-semibold text-primary-600 hover:underline">Re-run analysis</button>
              </div>
            )}
          </div>

          {/* Slack automations */}
          <div className="rounded-2xl border border-cocoa/15 bg-paper p-5 flex flex-col">
            <h4 className="font-display font-semibold text-cocoa text-base mb-1">Coaching nudges, ready for Slack</h4>
            <p className="text-xs text-cocoa/55 mb-4">A team digest and per-person DMs, drafted, not preachy.</p>

            {!slack && (
              <button
                onClick={draftSlack}
                disabled={slackLoading}
                className="self-start inline-flex items-center gap-2 rounded-full bg-cocoa text-cream px-4 py-2 text-sm font-semibold hover:bg-espresso transition-colors disabled:opacity-60"
              >
                {slackLoading ? <><Spinner /> Drafting…</> : 'Draft coaching nudges'}
              </button>
            )}

            {slack && (
              <div className="space-y-3">
                <SlackMessage channel={slack.digest.channel} author={ASSIGN.manager} text={slack.digest.text}
                  sent={!!sent[-1]} onSend={() => setSent((s) => ({ ...s, [-1]: true }))} digest />
                {slack.nudges.map((n, i) => (
                  <SlackMessage key={i} channel={`${n.channel} · ${n.to}`} author={ASSIGN.manager} text={n.text}
                    sent={!!sent[i]} onSend={() => setSent((s) => ({ ...s, [i]: true }))} />
                ))}
                <button onClick={draftSlack} className="text-xs font-semibold text-primary-600 hover:underline">Re-draft</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Small components ───────────────────────────────────────────────
function Kpi({ label, value, sub, tone }: { label: string; value: string; sub: string; tone: 'good' | 'warn' | 'risk' | 'neutral' }) {
  const valueColor =
    tone === 'good' ? 'text-secondary-600' : tone === 'risk' ? 'text-[#C4663D]' : tone === 'warn' ? 'text-accent-600' : 'text-cocoa';
  return (
    <div className="rounded-2xl border border-cocoa/12 bg-cream-50 p-4 retro-sheen">
      <p className="font-display text-[11px] uppercase tracking-widest text-cocoa/45 mb-1.5">{label}</p>
      <p className={`font-display font-semibold text-3xl leading-none ${valueColor}`}>{value}</p>
      <p className="mt-1.5 text-xs text-cocoa/55">{sub}</p>
    </div>
  );
}

function AiBadge() {
  return (
    <span className="inline-flex items-center justify-center w-5 h-5 rounded-md bg-primary-600 text-cream text-[10px] font-bold">
      AI
    </span>
  );
}

function Spinner() {
  return (
    <span className="inline-block w-3.5 h-3.5 rounded-full border-2 border-cream/40 border-t-cream animate-spin" />
  );
}

function SlackMessage({
  channel, author, text, sent, onSend, digest,
}: { channel: string; author: string; text: string; sent: boolean; onSend: () => void; digest?: boolean }) {
  return (
    <div className={`rounded-xl border ${digest ? 'border-primary-200 bg-primary-50/50' : 'border-cocoa/12 bg-cream-50'} p-3.5`}>
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-xs font-mono text-cocoa/50">{channel}</span>
      </div>
      <div className="flex gap-2.5">
        <Avatar name={author} />
        <div className="min-w-0">
          <p className="text-xs font-semibold text-cocoa">{author} <span className="font-normal text-cocoa/40">· now</span></p>
          <p className="text-sm text-cocoa/80 leading-relaxed whitespace-pre-line mt-0.5">{text}</p>
        </div>
      </div>
      <div className="mt-2.5 flex justify-end">
        {sent ? (
          <span className="text-xs font-semibold text-secondary-600">✓ Sent</span>
        ) : (
          <button onClick={onSend}
            className="inline-flex items-center gap-1.5 rounded-md bg-[#4A154B] text-white px-3 py-1 text-xs font-semibold hover:opacity-90 transition-opacity">
            Send in Slack
          </button>
        )}
      </div>
    </div>
  );
}
