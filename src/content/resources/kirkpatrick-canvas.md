---
title: "Kirkpatrick L1–L4 planning canvas"
blurb: "The one page I fill in with a sponsor before anything gets built, so we agree on what 'it worked' means, and wire xAPI to prove it, instead of arguing about it at the next audit."
type: "Template"
tags: ["Evaluation", "Kirkpatrick", "xAPI"]
timeToUse: "45 min with a sponsor"
embedUrl: "/resources/kirkpatrick-app/index.html"
embedMinHeight: "680px"
color: "terracotta"
featured: false
order: 3
draft: false
---

## What this is

A one-page canvas with four columns, **L1 Reaction, L2 Learning, L3 Behavior, L4 Results**, and three rows: *what we'll measure*, *how we'll capture it*, *who owns the signal*. It forces the evaluation conversation to happen at kickoff, not after launch.

## If you're the manager or sponsor, this is for you

Most training reports answer the one question you didn't ask: *who finished it?* Completion is the easiest thing to measure and the least useful thing to know. This canvas makes the hard columns, did behavior change (L3), did the business metric move (L4), a design constraint from day one, so the program is built to produce the evidence you'll be asked for, not to dodge the question.

Fill it in together in 45 minutes and you leave with a shared definition of success and a plan to capture it. If the L3 or L4 columns come out blank, that's the most valuable thing the canvas can tell you: the training isn't actually tied to a business outcome yet, better to learn that now than at launch.

## Where xAPI changes the game

This is the part that's new. Traditional evaluation leans on **completion records and a smile-sheet survey**, self-reported, weeks late, and silent on whether anyone did anything differently. **xAPI** (the data standard behind a Learning Record Store) captures the *actual behavior* inside the experience: the decision someone made in a branching scenario, the approach they took in a roleplay, the question they got wrong, how long they hesitated.

That moves the L3 column from "we'll survey managers in six months" to "we can see it next week":

- **L2 → L3 in the data, not in a survey.** A simulation that emits xAPI shows you not just *that* someone passed, but *how*, which lets you separate "knows the rule" from "applies it under pressure."
- **Attribution you can defend.** Because each statement ties a person to a specific behavior at a specific moment, you can correlate the behavior the training built with the business metric it was meant to move, the L3→L4 link that's usually a leap of faith.
- **A live signal, not a post-mortem.** The same statements roll up to a manager dashboard, so a leader sees who's struggling with *which* skill while there's still time to coach, instead of reading a completion report after the quarter closes.

See it concretely: the [Practice Room demo](/demos/practice-room) streams a coaching conversation to an LRS turn by turn, and the [manager dashboard](/dashboard) shows what those statements look like once a leader has to act on them.

## Why I won't start without it

It surfaces the uncomfortable question early, *can we actually attribute behavior change to this, or are we just hoping?*, while there's still time to design for the answer. Every program I've run gets better the moment that question is on the table at kickoff instead of after the spend.
