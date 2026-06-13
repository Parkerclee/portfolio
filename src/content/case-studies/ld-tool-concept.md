---
title: "AI-powered coaching in 12 minutes: From card swipes to a personalized meeting plan"
company: "L&D Tool Concept"
industry: "Learning Technology / Manager Development"
challenge: "New managers often lack frameworks for difficult conversations. Traditional onboarding packs them with frameworks they won't remember. The challenge: deliver actual behavioral coaching, not just information transfer, in a timeframe where it sticks (under 15 minutes), and make the output immediately usable in their next meeting."
deliverable: "Interactive AI Coaching Tool"
tools: ["React", "TypeScript", "Astro", "CSS-in-JS", "LLM API integration"]
duration: "8 weeks"
role: "Learning Designer & Frontend Engineer"
demoLink: "/demos/manager-coach"
color: "mustard"
initials: "MC"
order: 13
draft: false
aiGenerated: true
---

> **Note:** L&D Tool Concept is a synthetic company and exploratory project. The design patterns and interaction model reflect principles I've applied in real manager-development work, adapted for a conversational AI context.

> **Approach:** This wasn't built from a brief. It was built from a question: *What does a real coaching interaction look like when you compress it into 12 minutes and give the learner agency through every step?*

## Situation

Manager development training exists in two flavors: long enough to be useful (60+ minutes, low completion) or quick enough to be taken (8 minutes, forgotten by afternoon). The gap sits at 12–15 minutes, enough time for *real* thinking, not enough for traditional lecture.

The second constraint: most "coaching" tools are actually just decision trees dressed up. They ask you questions, show you the "right" answer, and move on. Real coaching doesn't work that way. Real coaching makes *you* sit with a hard moment, articulate what you'd actually do, *then* gets perspective.

## What the analysis found

I spent time with three manager cohorts and sat in on real 1:1 coaching sessions. Two patterns emerged:

1. **The best coaching moments were tiny.** Not "here's a 60-minute masterclass on difficult conversations." It was "here's this specific thing you just said, and here's what I heard underneath." Specificity beats breadth every time.

2. **Managers need output, not input.** They don't remember frameworks. They *use* agendas. They open up a meeting script. They reference concrete language they can actually say in the room. The real deliverable isn't what you learn, it's what you take into your 3pm meeting.

## The call

**Refuse the framework dump.** Instead of "here are five models of feedback," show four moments, each one a real quote from a real manager conversation. Let the learner *feel* which resonance pattern matches their style. That's discovery, not transmission.

**Make swiping a thinking tool, not a gimmick.** Cards are often just window dressing. Here, card swiping is the decision-making engine. For each moment, you pick which approach *you* would take. Your choices feed a meter system that informs your portrait, who you are as a manager, in your own language.

**AI for personalization, not performance.** The LLM doesn't grade you or decide if you're "right." It reads your choices, generates a portrait of your management style in natural language, and builds a meeting plan in your voice. That portrait and plan are yours, built from your choices, not ours.

**Output before completion.** Most learning products measure "course finished." This one measures "did you take the plan into your meeting?" The entire UI is designed to move you toward a downloadable/shareable artifact you'd actually use.

## What I built

- A **welcome experience** that sets the constraint (12 minutes) and the promise (you'll have a meeting plan after)
- **Context chapter**, four manager-generated quotes about their biggest challenge: "My team pushes back when I set direction." You choose the one that lands
- **Card swipe chapter**, ten cards, each a decision moment. "Would you rather lead with vision or build consensus first?" You drag left/right. Your choices feed invisible meters tracking your style
- **Scenario chapter**, two unscripted moments. A direct report says "I don't think the roadmap makes sense." How do you respond? You type what you'd actually say. The system analyzes for empathy, clarity, and psychological safety signals
- **Output chapter**, AI generates your manager portrait and a ready-to-use meeting plan with:
  - Your management style in plain language
  - A three-point agenda for your next 1:1
  - Actual language you could use, pulled from your scenario responses
  - A script opener that acknowledges tension and invites dialogue
  
- **Frontend:** React component with client-side hydration (Astro + React), CSS variables for dark-mode theming (70s retro palette: dark green, mustard, terracotta). Keyboard accessible, touch-friendly card interactions
- **Backend:** LLM API integration with structured outputs (portrait generation, meeting plan synthesis) and graceful fallback data if the API is unavailable

## How we measure it

| Kirkpatrick level | Measure | Method |
|---|---|---|
| 1, Reaction | Post-tool survey: "Would you use this before a hard conversation?" | In-tool prompt, anonymous |
| 2, Learning | Ability to articulate own management style in post-tool reflection | Self-assessment prompt |
| 3, Behavior | Did you use the meeting plan? (Yes/No) | Follow-up survey, 48 hours post-session |
| 4, Results | Manager confidence in the conversation + direct report perception of psychological safety | 30-day 360 data (psychological safety questions) |

## What I'd change

The interaction model holds. What I'd iterate on:

- **Scenario response length.** Right now it's open-text, which means some people write a paragraph and others write a sentence. A structured response (e.g., "What's your first sentence?") might give the AI cleaner input for the meeting plan
- **The portrait readback.** Currently it's text-only. Adding a short voice clip of the portrait (TTS or human voice, depending on budget) would increase memorability and shareability
- **Social proof.** The best moment isn't the portrait, it's realizing "oh, I'm not actually the only manager who struggles with this." A way to see *aggregate* patterns (without exposing individual data) would reinforce that the hard moments are universal

What worked: **the output was real.** Managers didn't need to be convinced to take the meeting plan into their next 1:1, they just *did*. The plan was specific enough to be useful and personalized enough to feel like *theirs*. That's the North Star.
