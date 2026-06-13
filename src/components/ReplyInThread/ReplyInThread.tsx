import { useState } from 'react';

/**
 * Reply in thread — a tiny click-through that teaches one habit: when you're
 * answering someone, reply *in the thread* instead of starting a new message.
 * Works for both Slack and Teams (the gesture differs, the principle doesn't).
 *
 * The learner makes the choice, sees the consequence in a simulated channel,
 * then gets shown exactly where the button lives in their app. Pairs with a
 * postable reminder GIF for the channels where the lesson keeps not landing.
 */

type AppId = 'slack' | 'teams';
type Step = 'choose' | 'wrong' | 'right' | 'where' | 'done';

const APPS: Record<AppId, {
  name: string;
  accent: string;
  channel: string;
  rightLabel: string;
  wrongLabel: string;
  where: string;
  wrongWhy: string;
}> = {
  slack: {
    name: 'Slack',
    accent: '#611f69',
    channel: '# q3-planning',
    rightLabel: 'Reply in thread',
    wrongLabel: 'Send to channel',
    where: 'Hover the message you’re answering and click the speech-bubble “Reply in thread” icon. The big box at the bottom posts to the whole channel — a thread keeps it on the message.',
    wrongWhy: 'Your answer is now floating in the channel, detached from the question. Three messages later, nobody can tell what it’s answering — and the next person asks Priya the same thing.',
  },
  teams: {
    name: 'Teams',
    accent: '#5059c9',
    channel: 'Q3 Planning › General',
    rightLabel: 'Reply',
    wrongLabel: 'New conversation',
    where: 'Use the “Reply” box attached under the post. The “Start a post / New conversation” box at the bottom begins a brand-new thread that buries everything above it.',
    wrongWhy: 'In Teams a new post jumps to the bottom and pushes the question up out of view. The conversation is now split across two places, and half the team only sees one.',
  },
};

export default function ReplyInThread() {
  const [app, setApp] = useState<AppId>('slack');
  const [step, setStep] = useState<Step>('choose');
  const a = APPS[app];

  function switchApp(id: AppId) {
    setApp(id);
    setStep('choose');
  }
  function restart() {
    setStep('choose');
  }

  return (
    <div className="rounded-3xl border border-cocoa/15 bg-paper overflow-hidden shadow-xl shadow-primary-900/5">
      {/* Header + app toggle */}
      <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-cocoa/10 bg-cream-50">
        <p className="font-display font-semibold text-cocoa text-sm">Reply in thread — 60-second walkthrough</p>
        <div className="inline-flex rounded-full border border-cocoa/15 bg-paper p-0.5 text-xs font-semibold">
          {(['slack', 'teams'] as AppId[]).map((id) => (
            <button
              key={id}
              onClick={() => switchApp(id)}
              className={`px-3 py-1 rounded-full transition-colors ${app === id ? 'text-cream' : 'text-cocoa/60 hover:text-cocoa'}`}
              style={app === id ? { background: APPS[id].accent } : undefined}
            >
              {APPS[id].name}
            </button>
          ))}
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_300px]">
        {/* Simulated channel */}
        <div className="bg-white min-h-[440px] flex flex-col">
          {/* channel header */}
          <div className="px-4 py-2.5 border-b border-black/[0.07] flex items-center gap-2" style={{ color: a.accent }}>
            <span className="font-bold text-[15px]">{a.channel}</span>
            <span className="text-black/35 text-xs font-normal">12 members</span>
          </div>

          <div className="flex-1 px-4 py-3 space-y-3 overflow-y-auto">
            <Msg who="Priya Raman" time="9:41 AM" accent={a.accent}
              text="Anyone have the final Q3 numbers? Need them for the board deck this afternoon." />

            {step === 'choose' && (
              <p className="text-[12px] text-black/40 italic pl-11">You have the numbers. How do you send them?</p>
            )}

            {/* WRONG outcome: answer floats in the channel, noise piles up */}
            {step === 'wrong' && (
              <>
                <Msg who="(you)" time="9:42 AM" accent={a.accent} highlight="bad"
                  text="Here you go — Q3 came in at $4.2M, up 12% QoQ." />
                <Msg who="Dev Shah" time="9:43 AM" accent={a.accent}
                  text="Reminder: standup moved to 10:30 today 👍" />
                <Msg who="Mara Lin" time="9:44 AM" accent={a.accent}
                  text="Can someone review my PR when you get a sec?" />
                <Msg who="Priya Raman" time="9:46 AM" accent={a.accent}
                  text="…wait, which message had the Q3 number? 😅" />
              </>
            )}

            {/* RIGHT outcome: a tidy thread under the question */}
            {(step === 'right' || step === 'where' || step === 'done') && (
              <div className="pl-11">
                <button className="text-[12.5px] font-semibold flex items-center gap-1.5 mb-1" style={{ color: a.accent }}>
                  <span className="inline-block w-5 h-5 rounded-full bg-current opacity-90" style={{ background: a.accent }} />
                  <span style={{ color: a.accent }}>2 replies</span>
                  <span className="text-black/35 font-normal">· last reply just now</span>
                </button>
                <div className={`border-l-2 pl-3 space-y-2.5 ${step === 'where' ? 'rounded-r-lg ring-2 ring-offset-2' : ''}`}
                  style={{ borderColor: a.accent, ...(step === 'where' ? { boxShadow: `0 0 0 2px ${a.accent}` } : {}) }}>
                  <Msg dense who="(you)" time="9:42 AM" accent={a.accent}
                    text="Here you go — Q3 came in at $4.2M, up 12% QoQ. Full breakdown in the sheet 👇" />
                  <Msg dense who="Priya Raman" time="9:43 AM" accent={a.accent}
                    text="Perfect, exactly what I needed. Thank you! 🙏" />
                </div>
              </div>
            )}
          </div>

          {/* Compose / choice bar */}
          <div className="border-t border-black/[0.07] p-3">
            {step === 'choose' && (
              <div className="space-y-2">
                <p className="text-[11px] uppercase tracking-widest text-black/35 font-semibold">Choose how to respond</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setStep('right')}
                    className="rounded-lg px-3 py-2.5 text-sm font-semibold text-white text-left transition-transform hover:-translate-y-0.5"
                    style={{ background: a.accent }}
                  >
                    ✓ {a.rightLabel}
                    <span className="block text-[11px] font-normal text-white/75">on Priya’s message</span>
                  </button>
                  <button
                    onClick={() => setStep('wrong')}
                    className="rounded-lg px-3 py-2.5 text-sm font-semibold text-black/70 text-left border border-black/15 hover:border-black/30 transition-colors"
                  >
                    {a.wrongLabel}
                    <span className="block text-[11px] font-normal text-black/45">a fresh message</span>
                  </button>
                </div>
              </div>
            )}
            {step !== 'choose' && (
              <div className="flex items-center gap-2 rounded-lg border border-black/12 px-3 py-2 text-black/35 text-sm">
                <span className="flex-1">{step === 'where' ? `This is where “${a.rightLabel}” lives ☝️` : 'Message #' + a.channel.replace(/[#›].*/, '').trim()}</span>
              </div>
            )}
          </div>
        </div>

        {/* Coaching rail */}
        <aside className="border-t lg:border-t-0 lg:border-l border-cocoa/10 bg-paper px-5 py-5 flex flex-col">
          {step === 'choose' && (
            <Rail title="The one habit" body="When you’re answering someone, reply in the thread instead of starting a new message. Try it both ways — watch what happens to the channel.">
              <span className="text-xs text-cocoa/45">Pick an option to see the result →</span>
            </Rail>
          )}

          {step === 'wrong' && (
            <Rail title="That’s the noise" tone="bad" body={a.wrongWhy}>
              <button onClick={() => setStep('right')} className="mt-1 inline-flex items-center gap-1.5 rounded-full text-cream px-4 py-2 text-sm font-semibold" style={{ background: a.accent }}>
                Show me the better way →
              </button>
            </Rail>
          )}

          {step === 'right' && (
            <Rail title="Calm channel, kept context" tone="good" body="The answer stays attached to the question. Anyone scanning the channel sees one tidy item, and someone catching up tomorrow reads the whole exchange in one place.">
              <button onClick={() => setStep('where')} className="mt-1 inline-flex items-center gap-1.5 rounded-full text-cream px-4 py-2 text-sm font-semibold" style={{ background: a.accent }}>
                Where’s the button? →
              </button>
            </Rail>
          )}

          {step === 'where' && (
            <Rail title={`Where it lives in ${a.name}`} tone="good" body={a.where}>
              <button onClick={() => setStep('done')} className="mt-1 inline-flex items-center gap-1.5 rounded-full text-cream px-4 py-2 text-sm font-semibold" style={{ background: a.accent }}>
                Got it →
              </button>
            </Rail>
          )}

          {step === 'done' && (
            <Rail title="That’s the whole lesson" tone="good" body="Reply in the thread, not a new message. It keeps channels scannable and context together — and it’s the same idea in Slack and Teams.">
              <div className="mt-1 flex flex-col gap-2">
                <a href="#reminder-gif" className="inline-flex items-center gap-1.5 rounded-full text-cream px-4 py-2 text-sm font-semibold self-start" style={{ background: a.accent }}>
                  Get the reminder GIF ↓
                </a>
                <button onClick={() => switchApp(app === 'slack' ? 'teams' : 'slack')} className="text-xs font-semibold text-primary-600 hover:underline self-start">
                  See it in {app === 'slack' ? 'Teams' : 'Slack'} →
                </button>
                <button onClick={restart} className="text-xs font-semibold text-cocoa/50 hover:text-cocoa self-start">↺ Run it again</button>
              </div>
            </Rail>
          )}
        </aside>
      </div>
    </div>
  );
}

function Msg({ who, time, text, accent, highlight, dense }: {
  who: string; time: string; text: string; accent: string; highlight?: 'bad'; dense?: boolean;
}) {
  const initials = who === '(you)' ? 'You' : who.split(' ').map((p) => p[0]).slice(0, 2).join('');
  return (
    <div className={`flex gap-2.5 ${highlight === 'bad' ? 'bg-[#FBEAE2] -mx-2 px-2 py-1 rounded-md' : ''}`}>
      {!dense && (
        <span className="shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-md text-white text-[11px] font-bold" style={{ background: accent }}>
          {initials}
        </span>
      )}
      <div className={dense ? '' : 'min-w-0'}>
        <p className="text-[13px] leading-tight">
          <span className="font-bold text-black/80">{who}</span>{' '}
          <span className="text-black/35 text-[11px]">{time}</span>
        </p>
        <p className="text-[13.5px] text-black/75 leading-snug mt-0.5">{text}</p>
      </div>
    </div>
  );
}

function Rail({ title, body, tone, children }: { title: string; body: string; tone?: 'good' | 'bad'; children?: any }) {
  const dot = tone === 'good' ? 'bg-secondary-500' : tone === 'bad' ? 'bg-[#C4663D]' : 'bg-primary-500';
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${dot}`} />
        <p className="font-display font-semibold text-cocoa">{title}</p>
      </div>
      <p className="text-sm text-cocoa/70 leading-relaxed">{body}</p>
      {children}
    </div>
  );
}
