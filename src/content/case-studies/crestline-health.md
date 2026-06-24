---
title: "An EHR simulator that beat classroom training to 90% adoption"
company: "Crestline Health"
industry: "Healthcare / Hospital System"
location: "Portland, OR"
companySize: "~8,000 employees"
challenge: "A system-wide EHR migration was going sideways. 40% of IT support tickets were EHR-related six weeks post-launch, staff were bypassing workflows, and leadership needed 90% adoption of the new system within 60 days."
deliverable: "Code-Built Interactive EHR Simulator"
tools: ["HTML", "CSS", "JavaScript", "xAPI", "Figma", "Cursor"]
duration: "8 weeks"
role: "Lead Instructional Designer & Developer"
demoLink: "/demos/ehr-simulator"
color: "avocado"
initials: "CH"
order: 11
draft: false
aiGenerated: true
---

> **Note:** Crestline Health is a fictional company. The simulator approach, xAPI integration pattern, and evaluation structure reflect methods I've used in real client projects.

> **Methodology:** This project used the five-phase framework outlined in the [AI-in-L&D toolkit](/toolkit). This case study focuses on the Crestline-specific decisions, particularly the choice to code-build rather than author.

## Situation

Six weeks into a new EHR rollout, Crestline's help desk was drowning, 40% of tickets were EHR-related and nobody was getting to inbox zero. The vendor's training was a 40-hour classroom course delivered on a rotating schedule, and pulling 24/7 clinical staff off the floor one-by-one was an operational nightmare. Worse, people who had completed the training were still routing charts incorrectly, or copying old-system habits that didn't map to the new EHR at all.

Leadership gave L&D 60 days to move adoption from ~52% to 90% across the three highest-volume departments: ED, Med-Surg, and outpatient clinics.

## What the analysis found

I shadowed in all three departments for a week. The classroom training wasn't failing because it was bad, it was failing because the gap between *watching* someone click through a demo and *doing it yourself under pressure* is enormous. Clinicians needed reps, not more explanation.

Nine workflows accounted for **78% of the incorrectly-routed charts**:

1. Admit from ED to inpatient
2. Discharge with medication reconciliation
3. Place a routine lab order
4. Place a STAT lab order with critical-value flagging
5. Document a code blue event
6. Request a specialty consult
7. Transfer between units
8. Complete a rounding note
9. Handle a refused medication

## The call

**Code-build the simulator, don't author it.** This was the decision everyone had opinions on, my team was most comfortable in Storyline, and I had to commit to a tool they didn't fully own. Three reasons it was still the right call:

- **Fidelity.** I could recreate the actual pixel layout and click patterns of the real EHR, which authoring tools couldn't match.
- **xAPI granularity.** Every click, field change, and routing decision emitted a statement. Clinical informatics had never seen data that fine-grained and ended up being the most valuable collaborator on the project.
- **Iteration speed.** Once the engine existed, a new workflow was a day of work, not a week in Storyline.

**Make classroom optional, sim required.** The compromise with nursing leadership: learners who could demonstrate the workflows in the simulator within two attempts skipped classroom entirely. Those who couldn't were enrolled automatically. This took the scheduling pressure off the floor and let the best learners self-pace.

**Happy paths aren't enough, force the detours.** Each workflow had the clean path plus two or three realistic complications: a missing identifier, a drug-allergy collision, a STAT flag at the wrong step. The scenario didn't let learners shortcut; they had to navigate the detour to finish.

## What I built

- A browser-based simulator with nine workflows, runnable on any static host or the hospital portal
- Fully keyboard-navigable, WCAG 2.1 AA audited (critical for the older nursing population)
- xAPI statements flowing to SCORM Cloud with a schema clinical informatics co-designed
- Total payload: ~180KB including all nine workflows
- See the live demo above for a cut-down version of the ED admission workflow with the allergy-collision detour

## How we measure it

| Kirkpatrick level | Measure | Method |
|---|---|---|
| 1, Reaction | Post-simulator "Did this help?" single question | Embedded at completion |
| 2, Learning | First-attempt workflow completion rate, target 70%+ | xAPI statement analysis |
| 3, Behavior | Help desk ticket rate for these nine workflows, 30 days post-go-live | Service desk system |
| 4, Results | Department-level daily EHR usage | EHR vendor analytics |

## What I'd change

I'd loop clinical informatics in during week 1, not week 3. Once they were involved, the xAPI schema aligned to dashboards they already had, but we did a round of rework to get there. Their early involvement would have saved a week and produced a better pipeline.
