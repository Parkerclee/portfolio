---
title: "Build-a-Mattress — a Storyline piece, rebuilt in HTML"
blurb: "A sales enablement tool I built for a mattress retailer, rebuilt here as plain HTML. Same action-mapping origin, same talking-point payoff — faster, accessible, and embeddable anywhere."
type: "Interactive"
tags: ["Sales enablement", "Action mapping", "HTML rebuild", "Storyline"]
timeToUse: "About 5 min"
embedUrl: "/resources/mattress-builder-app/index.html"
embedMinHeight: "720px"
color: "terracotta"
featured: true
order: 0
draft: false
---

## The story behind it

During an action mapping session with subject matter experts on the sales floor, we kept landing on the same skill gap: new hires couldn't confidently speak about the differences between mattresses. They knew the names of the layers. They couldn't translate them into something a tired guest at 7pm would actually care about.

So I built this: a tool that lets a new hire pick a sleeper profile, stack the layers, and read the talking points in the exact order they'd say them on the floor. It shipped in Storyline originally. I've rebuilt it here in plain HTML so it loads fast, lives outside a player, and is easier to update when the product changes.

## What changed in the rebuild

- **Faster load.** No player, no SCORM wrapper — just HTML and CSS.
- **Better accessibility.** Native radios, focus rings, and ARIA that work the first time.
- **Embeddable anywhere.** A partner site, an email (as a link), a new-hire microsite. Storyline's player fought that.
- **Easier to update.** Changing a talking point is a one-line edit in a JS file, not a Storyline republish.

## What stayed

- The action-mapping backbone: **Discover → Build → Translate → Check**.
- Layer-by-layer talking points written in the voice a new hire should use.
- A single check-for-understanding, because one good question beats a ten-question quiz nobody reads.

## Who this is for

Anyone running a small L&D function at a retail, DTC, or specialty-product company who's tired of waiting on a Storyline republish to fix a talking point. If you want to do this for your product, the code's on GitHub and the pattern travels.
