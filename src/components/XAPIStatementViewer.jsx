import { useState } from "react";

const sampleStatements = [
  {
    simplified: {
      icon: "🚀",
      who: "Portfolio Visitor",
      action: "Started",
      what: "EHR Simulator, Medication Order Task",
      when: "2 minutes ago",
      detail: null,
    },
    raw: {
      actor: {
        objectType: "Agent",
        name: "Portfolio Visitor",
        mbox: "mailto:visitor@portfolio.com",
      },
      verb: {
        id: "http://adlnet.gov/expapi/verbs/initialized",
        display: { "en-US": "initialized" },
      },
      object: {
        objectType: "Activity",
        id: "https://parkerclee.com/demos/ehr-simulator",
        definition: {
          name: { "en-US": "EHR Simulator, Medication Order Task" },
          description: {
            "en-US":
              "Learner opened the EHR simulator to practice medication ordering.",
          },
        },
      },
      timestamp: "2026-04-17T18:42:00Z",
    },
  },
  {
    simplified: {
      icon: "✅",
      who: "Portfolio Visitor",
      action: "Answered correctly",
      what: "Verify patient identity before medication entry",
      when: "1 minute ago",
      detail: "Score: 100%",
    },
    raw: {
      actor: {
        objectType: "Agent",
        name: "Portfolio Visitor",
        mbox: "mailto:visitor@portfolio.com",
      },
      verb: {
        id: "http://adlnet.gov/expapi/verbs/answered",
        display: { "en-US": "answered" },
      },
      object: {
        objectType: "Activity",
        id: "https://parkerclee.com/demos/ehr-simulator/patient-verification",
        definition: {
          name: {
            "en-US": "Verify patient identity before medication entry",
          },
        },
      },
      result: {
        success: true,
        score: { raw: 100, min: 0, max: 100 },
      },
      timestamp: "2026-04-17T18:43:12Z",
    },
  },
  {
    simplified: {
      icon: "❌",
      who: "Portfolio Visitor",
      action: "Answered incorrectly",
      what: "Select correct dosage for Lisinopril",
      when: "45 seconds ago",
      detail: "Selected 50mg instead of 10mg",
    },
    raw: {
      actor: {
        objectType: "Agent",
        name: "Portfolio Visitor",
        mbox: "mailto:visitor@portfolio.com",
      },
      verb: {
        id: "http://adlnet.gov/expapi/verbs/answered",
        display: { "en-US": "answered" },
      },
      object: {
        objectType: "Activity",
        id: "https://parkerclee.com/demos/ehr-simulator/dosage-selection",
        definition: {
          name: { "en-US": "Select correct dosage for Lisinopril" },
        },
      },
      result: {
        success: false,
        response: "50mg",
        score: { raw: 0, min: 0, max: 100 },
      },
      timestamp: "2026-04-17T18:43:47Z",
    },
  },
  {
    simplified: {
      icon: "🏁",
      who: "Portfolio Visitor",
      action: "Completed",
      what: "EHR Simulator, Full Patient Encounter",
      when: "Just now",
      detail: "Final score: 85% · Duration: 4m 22s · Passed",
    },
    raw: {
      actor: {
        objectType: "Agent",
        name: "Portfolio Visitor",
        mbox: "mailto:visitor@portfolio.com",
      },
      verb: {
        id: "http://adlnet.gov/expapi/verbs/completed",
        display: { "en-US": "completed" },
      },
      object: {
        objectType: "Activity",
        id: "https://parkerclee.com/demos/ehr-simulator",
        definition: {
          name: { "en-US": "EHR Simulator, Full Patient Encounter" },
          description: {
            "en-US":
              "Learner completed all tasks in the simulated EHR patient encounter.",
          },
        },
      },
      result: {
        success: true,
        completion: true,
        duration: "PT4M22S",
        score: { raw: 85, min: 0, max: 100 },
      },
      timestamp: "2026-04-17T18:44:02Z",
    },
  },
];

const actionColors = {
  Started: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
  "Answered correctly": { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  "Answered incorrectly": { bg: "bg-red-50", text: "text-red-700", border: "border-red-200" },
  Completed: { bg: "bg-violet-50", text: "text-violet-700", border: "border-violet-200" },
};

function StatementCard({ statement, index }) {
  const [showRaw, setShowRaw] = useState(false);
  const { simplified, raw } = statement;
  const colors = actionColors[simplified.action] || actionColors.Started;

  return (
    <div
      className={`rounded-xl border ${colors.border} ${colors.bg} overflow-hidden transition-all duration-300`}
      style={{ animationDelay: `${index * 120}ms` }}
    >
      {/* Simplified view */}
      <div className="p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <span className="text-2xl mt-0.5 shrink-0">{simplified.icon}</span>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="font-semibold text-slate-800 text-sm">
                {simplified.who}
              </span>
              <span
                className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${colors.text} bg-white/60`}
              >
                {simplified.action}
              </span>
            </div>
            <p className="text-slate-700 mt-1 text-sm leading-relaxed">
              {simplified.what}
            </p>
            {simplified.detail && (
              <p className="text-slate-500 text-xs mt-1.5">
                {simplified.detail}
              </p>
            )}
            <div className="flex items-center justify-between mt-3">
              <span className="text-xs text-slate-400">{simplified.when}</span>
              <button
                onClick={() => setShowRaw(!showRaw)}
                className={`
                  inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                  transition-all duration-200 cursor-pointer
                  ${showRaw
                    ? "bg-slate-800 text-white"
                    : "bg-white/70 text-slate-600 hover:bg-white hover:text-slate-900"
                  }
                `}
              >
                <svg
                  className="w-3 h-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
                  />
                </svg>
                {showRaw ? "Hide" : "Show"} raw xAPI
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Raw JSON expandable */}
      <div
        className={`
          overflow-hidden transition-all duration-300 ease-in-out
          ${showRaw ? "max-h-[600px] opacity-100" : "max-h-0 opacity-0"}
        `}
      >
        <div className="border-t border-slate-200/50 bg-slate-900 p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              xAPI Statement (JSON)
            </span>
            <span className="text-[10px] text-slate-500 font-mono">
              {raw.verb?.display?.["en-US"]}
            </span>
          </div>
          <pre className="text-xs text-emerald-400 font-mono overflow-x-auto leading-relaxed whitespace-pre-wrap break-words">
            {JSON.stringify(raw, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
}

export default function XAPIStatementViewer() {
  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2.5 mb-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-slate-900"
              style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
            Live Learning Data
          </h2>
        </div>
        <p className="text-sm text-slate-500 leading-relaxed">
          Every interaction in the demo generates an{" "}
          <span className="font-semibold text-slate-700">xAPI statement</span>, a
          standardized record of what the learner did. These statements
          flow to a Learning Record Store (LRS) for analysis.
        </p>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2 mb-5">
        {Object.entries(actionColors).map(([label, colors]) => (
          <span
            key={label}
            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${colors.bg} ${colors.text} border ${colors.border}`}
          >
            {label}
          </span>
        ))}
      </div>

      {/* Statements feed */}
      <div className="space-y-3">
        {sampleStatements.map((statement, i) => (
          <StatementCard key={i} statement={statement} index={i} />
        ))}
      </div>

      {/* Explainer footer */}
      <div className="mt-6 p-4 rounded-xl bg-slate-100 border border-slate-200">
        <p className="text-xs text-slate-500 leading-relaxed">
          <span className="font-semibold text-slate-700">Why this matters:</span>{" "}
          xAPI statements let us measure exactly how learners interact with
          training, not just whether they finished, but what they struggled
          with, how long each task took, and which paths they chose. This data
          drives the analytics dashboard and informs Kirkpatrick Level 2 & 3
          evaluation.
        </p>
      </div>
    </div>
  );
}
