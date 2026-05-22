---
title: "Porting Storyline interactions to plain HTML (and improving them)"
blurb: "A pattern for rebuilding classic Storyline mechanics — branching scenarios, tabs interactions, drag-and-drops — as light HTML/CSS/JS that runs anywhere."
type: "Case pattern"
tags: ["HTML", "Storyline", "Accessibility"]
timeToUse: "Pattern + starter files"
color: "avocado"
featured: false
order: 5
draft: false
---

> **Status:** Draft — starter files and live examples coming.

## What this is

A writeup of the pattern I use when I need a Storyline-style interaction to live outside a SCORM package — in a static site, an email, or an iframe. The goal isn't to replace Storyline; it's to free a specific interaction from the runtime.

## Interactions I've rebuilt

- Branching decision scenarios (see the Meridian demo)
- Process-step walkthroughs with conditional feedback (see the Crestline EHR simulator)
- Tabbed reference interactions — more accessible as native HTML than inside Storyline's player
- Rubric-scored self-assessments with printable summary output

## What you get in the port

- Native keyboard and screen-reader support without fighting the player
- Real URLs per state (if you want them)
- xAPI emission without the SCORM wrapper
- Pages that load in a fraction of the time

## What you lose

- The Storyline authoring UI. Which, depending on the week, is a feature or a bug.
