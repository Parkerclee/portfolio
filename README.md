# parkerlee.work

Parker Lee's instructional design portfolio. Astro 6 + React 19 + Tailwind v4, deployed on Vercel.

## Commands

| Command           | Action                                    |
| :---------------- | :---------------------------------------- |
| `npm install`     | Install dependencies                      |
| `npm run dev`     | Dev server at `localhost:4321`            |
| `npm run build`   | Production build to `./dist/`             |
| `npm run preview` | Preview the production build locally      |

## Live AI demos

The AI demos (Practice Room, Skill Check, TeamPulse dashboard, ManagerCoach) call a server-side
proxy at `/api/claude` (`src/pages/api/claude.ts`). The proxy holds the Anthropic API key, validates
payloads, and rate-limits per IP. Without a key configured, every demo falls back to its authored
guided experience, so the site is fully playable either way.

To turn on live AI, set these in Vercel → Project → Settings → Environment Variables:

| Variable            | Required | Notes                                        |
| :------------------ | :------- | :------------------------------------------- |
| `ANTHROPIC_API_KEY` | yes      | From console.anthropic.com                   |
| `CLAUDE_MODEL`      | no       | Defaults to `claude-opus-4-8`                |

Shared client plumbing lives in `src/lib/ai.ts`: it prefers the Claude preview surface
(`window.claude`) when present, then the proxy, then signals components to use their fallbacks.
