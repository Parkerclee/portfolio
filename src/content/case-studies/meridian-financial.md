---
title: "Compliance onboarding that cut time-to-proficiency in half"
company: "Meridian Financial"
industry: "Fintech / Digital Banking"
location: "Austin, TX"
companySize: "~2,000 employees"
challenge: "Loan officers were making compliance errors that triggered regulatory audit flags. Time-to-proficiency was stretching past 12 weeks, and the existing onboarding was a 340-slide click-through that no one finished."
deliverable: "Rise 360 eLearning Module"
tools: ["Articulate Rise 360", "SCORM Cloud", "xAPI", "Figma"]
duration: "10 weeks"
role: "Lead Instructional Designer"
demoLink: "/demos/meridian-scenario"
color: "terracotta"
initials: "MF"
order: 1
draft: false
---

> **Note:** Meridian Financial is a fictional company. The methodology, artifacts, and outcomes reflect patterns I've applied in real client work.

> **Methodology:** This project used the five-phase framework outlined on the [Process page](/process) — Discover, Design, Build, Deliver, Measure. This case study focuses on the decisions that were specific to Meridian, not the framework itself.

## Situation

Meridian's consumer lending team had grown 40% in 18 months and the compliance function was buckling. A federal audit had flagged inconsistent disclosure practices three months earlier. The legacy onboarding was a 340-slide Storyline course built in 2019 with a 48% completion rate — and the completions weren't helping anyway.

Leadership gave me ten weeks and one ask: cut time-to-proficiency in half without losing audit defensibility.

## What the analysis found

I pulled three months of audit findings and mapped each one back to a specific moment in the loan workflow. Of 47 findings, **82% clustered around four decision points**:

1. Adverse action disclosure timing
2. Regulation Z APR presentation
3. Regulation B denial-reason documentation
4. Fair lending steering risk at pricing

That was the actual skill surface area. The old course tried to teach all of Regulation Z. The business only needed these four decisions made reliably.

## The call

**Refuse to teach all of Regulation Z.** That was the hard conversation, and the one that mattered most. The Compliance SME pushed back until we looked at the findings clusters together — then the scope argument became easier because we were both looking at the same four clusters.

**Decision-first scenarios, regulation second.** Every knowledge check started with a situation. Regulatory text only appeared *after* the learner made a call, never before. This broke the old pattern of memorizing regulation numbers instead of recognizing decision moments.

**Rise 360 over Storyline.** The module needed to work on shared iPads in branches, and block-based authoring let me iterate with the SME in near-real-time during review. The trade-off was less interactivity — which I recovered by embedding branching scenarios as separate SCORM objects for the four decision moments.

## What I built

- A 45-minute Rise 360 module replacing 340 slides, broken into four 10–12 minute decision-focused chapters
- Four branching scenarios with specific-diagnosis feedback (e.g. *"Adverse action is required within 30 days of the denial decision, not 30 days of the application date"*) rather than generic reinforcement
- A capstone that strung all four decisions together with at least one red herring each
- A one-page manager job aid — the highest-leverage piece, in hindsight
- 30- and 60-day spaced-repetition microlearning pushed via email
- xAPI statements flowing to SCORM Cloud for a pilot analytics read

## How we measure it

| Kirkpatrick level | Measure | Method |
|---|---|---|
| 1 — Reaction | Post-course survey, 5 questions, target 4.2/5 | In-module survey block |
| 2 — Learning | Pass rate on capstone scenario, target 85% first-attempt | xAPI statement tracking |
| 3 — Behavior | Audit finding rate on the four focus decisions | Quarterly compliance report delta |
| 4 — Results | Time-to-proficiency (weeks) for new loan officers | HRIS delta vs. 12-week baseline |

## What I'd change

I'd invest more in the manager job aid up front. The spaced-repetition prompts helped, but the single highest-impact lever was whether managers asked the right questions in 1:1s — and that depended on the job aid being genuinely usable, not a compliance document in disguise.
