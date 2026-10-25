# VAULT RUSH: THE NEON HEIST

**Five vaults. One crew. Everyone has a secret.** A real networked browser party game for 2–8 friends. Create a private room, share its link, and chase the biggest haul across six simultaneous rounds. No account, payment or installation for players.

**Deployment status:** implemented and tested locally. A public URL and independent-network test are pending. See [QA_REPORT.md](QA_REPORT.md) for executed checks and [SUBMISSION.md](SUBMISSION.md) for the submission copy, final checklist and narrated demo script.

## Play locally

Use Node 24 (at least 22.12) and npm. On Windows PowerShell, use `npm.cmd` / `npx.cmd` if script execution is disabled.

```sh
npm ci
npm run dev
```

Open **http://localhost:3000** in two separate browser profiles or independent browser contexts. Create a room in one and join with its code in the other. Normal tabs on the same origin share localStorage, so use separate profiles for separate players. For phones on your LAN, visit `http://YOUR_COMPUTER_LAN_IP:3000`; allow port 3000 through the firewall. Clipboard sharing may require HTTPS; the visible room code always works.

## Rules

Each of six rounds has a 4-second preview, 20-second decision, 5-second reveal, and 5-second scoreboard. Everyone sees five vaults and receives truthful private intel. Discuss or bluff over your own voice/chat channel; there is no built-in chat. Pick one vault and optionally change it before locking. The server ends selection when every connected participant locks, or when the shared deadline expires. An unlocked selection still counts; no selection earns zero. Speed gives no bonus.

Three guaranteed credit vaults have pools 90–150, 150–230 and 240–320. A guaranteed trap costs 20–35. The fifth vault is equally likely to be a 330–400 credit pool or a 35-credit trap. Outcomes are securely shuffled. Loot is `floor(pool / number of selectors)`; remainder is discarded, independent of arrival order. Loss is `min(balance, trap, 35)`. Most credits wins after six rounds, with tied leaders sharing victory. No paid items, power-ups or hidden score multipliers.

Hints count safe vaults in a pair or compare two reward pools, based on the already generated server outcomes. A hint can expose safe options but cannot predict crowding or guarantee the best payout. Each player gets their own indexed intercept. New hints and outcomes arrive each round.

## Architecture and resilience

- `client/`: React and CSS, original procedural vault illustration, responsive screens, optional synthesized sound. CSS replaces Tailwind/Motion to reduce build complexity; no external artwork or font request.
- `server/engine.ts`: transport-independent rules and phase state machine; `crypto.randomInt` and opaque `randomBytes` credentials.
- `server/app.ts`: Express, Socket.IO, Zod validation, rate limits, per-socket private messages and sanitized public snapshots.
- `shared/`: public protocol types. `tests/`: engine and actual WebSocket transport tests. `e2e/`: independent Playwright browser contexts.

One Node process serves the production frontend and socket endpoint on one origin. A 100ms scheduler advances server-owned deadlines. Client countdowns use the offset between each snapshot's server timestamp and the local clock. Background tabs do not control game timing. Hidden outcomes and other players' choices are absent from pre-reveal public state. Decisions are settled once, and scores are never accepted from clients.

Recovery tokens live in localStorage and act as bearer credentials: protect them as you would a password. Refresh/reconnect restores identity, score and lock. A second connection using the same token disconnects its predecessor; it does not create another player. Host departure elects the first connected participant. If nobody is connected, the last host identifier remains until recovery. Games continue on deadlines even with fewer than two connected players; missing choices get zero. Start requires two connected players. Late joins are restricted to the lobby. Rematch resets all scores, stats and choices and removes offline seats. Intentional lobby departure frees the seat; departure during a game retains the offline seat until rematch. If you intentionally leave, your saved recovery token is removed.

Tabs in the same browser profile share that recovery token. Opening the same invite in another tab takes over the same seat, and its next refresh still recovers correctly. Use separate profiles or devices for distinct agents. Opening a different room's invite prompts for a new join instead of recovering the old room.

Disconnected rooms expire after `ROOM_TTL_MS` (default 30 minutes after last transition/disconnect). Limit: 1,000 rooms, eight seats per room. Rate limit: 60 acknowledged commands per connection per 10 seconds; 30 room entry/recovery attempts per IP per minute. The IP limit uses the direct socket address; behind a reverse proxy this may be shared by users. Do not blindly trust forwarded IP headers. Logs omit tokens and payloads.

## Checks

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm run test:production
npx playwright install chromium
npm run test:e2e:production
npm audit
```

`test:production` starts and stops the compiled server on a dynamic port from outside the repository to verify PORT handling, production defaults, health, asset serving and SPA routes. `test:e2e:production` starts a fresh built server on port 3000, never reuses an existing development server, and shuts it down after the run. Stop any process already using port 3000 first. Both commands work on Windows and Linux. For development-only browser checks, `npm run test:e2e` can reuse a local dev server. Tests use real isolated contexts and sockets. Reports are in `playwright-report/`, failure traces in `test-results/`, screenshots in `artifacts/`. The six-round scenario takes about two minutes.

## Production and deployment

Rooms are **in memory**. Restarting, redeploying, crashing or changing instance loses rooms and recovery identities. Use **one instance**, with autoscaling disabled. No Redis adapter, durable storage or horizontal scaling is implemented. TLS and a stable Node host are required for public use. The private room code is an invitation, not an access-control password. Browser input is rendered as text; Zod rejects unexpected move fields. CSP, frame blocking, payload limits and bounded rooms reduce exposure. This MVP has no distributed anti-abuse service, moderation, full load test or uptime guarantee.

Local production smoke test (PowerShell):

```powershell
npm.cmd run build
$env:PORT='3000'
$env:PUBLIC_ORIGIN='http://localhost:3000'
npm.cmd start
```

`npm start` always runs the compiled production service, even without `NODE_ENV`; `npm run dev` explicitly enables Vite via `--dev`. One HTTP server hosts `/`, SPA routes and `/socket.io/`; `io()` connects to the browser's own origin. Do not configure a separate frontend URL, backend port, CORS wildcard, static-site service or Socket.IO host. No frontend environment variables or secrets are needed.

`.env.example` documents configuration. Environment files are not loaded automatically: configure variables in your shell or hosting dashboard.

| Variable | Value / behavior |
| --- | --- |
| `PORT` | Host-supplied integer 1–65535; local default 3000. Binds `0.0.0.0`. |
| `ROOM_TTL_MS` | Positive integer; default 1800000 (30 min). Expiry is checked every 100ms when all participants are offline. Active round transitions refresh the idle timestamp. |
| `PUBLIC_ORIGIN` | Optional exact HTTP(S) origin, e.g. `https://play.example.com`. Overrides the Render URL. No path, query, credentials or fragment; a trailing slash is normalized. |
| `RENDER_EXTERNAL_URL` | Render-provided `https://…onrender.com` origin, automatically used if `PUBLIC_ORIGIN` is unset. |
| `NODE_ENV` | Set to production by the production entry point, development by `--dev`. No manual setting required for `npm start`. |

Without either origin variable, browser socket handshakes permit only `http://` plus the request host, suitable for local/LAN development. Set an origin for any HTTPS host other than Render. Invalid ports, TTLs and origin values fail startup rather than silently selecting a different setting. Requests without an Origin header remain supported for nonbrowser clients; origin checks do not replace recovery-token authorization.

`GET /health` returns HTTP 200 and `{"ok":true}` with `Cache-Control: no-store`. HTML navigation falls back to the SPA; missing JavaScript/CSS assets return 404. Health output includes no room data or tokens. SIGTERM/SIGINT close the Socket.IO service and the HTTP listener with a 10-second forced-exit bound. Restarting still loses rooms.

### Render walkthrough

The simplest supported setup here is **one Render Node Web Service**, with its managed HTTPS URL serving the entire application. Render documents [Node deployment](https://render.com/docs/deploy-node-express-app), [PORT binding](https://render.com/docs/web-services#port-binding), [WebSocket support](https://render.com/docs/websocket), [automatic environment variables](https://render.com/docs/environment-variables) and [Blueprint settings](https://render.com/docs/blueprint-spec). WebSockets close on instance replacement; rooms will be lost. `render.yaml` selects a paid `starter` instance; review current charges before provisioning. No free-plan or uptime claim is made.

1. Push **this project directory** to a new Git repository you own. The surrounding Desktop may belong to a different repository; do not publish unrelated Desktop files. No repository or deployment is created by the local build.
2. Sign in to Render, choose **New → Web Service**, connect that repository, choose Node and its branch. If the project is nested, configure its root directory.
3. Build command: **`npm ci --include=dev && npm run build`**. Start command: **`npm start`**. Node version: **24.21.0**. Set `ROOM_TTL_MS=1800000`. Leave `PUBLIC_ORIGIN` unset for the Render default domain; `RENDER_EXTERNAL_URL` supplies it automatically. For a custom domain, set `PUBLIC_ORIGIN` to that exact HTTPS origin. Render supplies `PORT`; do not hardcode it. Health check: **`/health`**. No pre-deploy command, database or disk is needed.
4. Select **one** continuously running instance, disable autoscaling, and set **Auto-Deploy → Off**. Review billing terms. `render.yaml` provides equivalent Blueprint configuration, including disabled automatic deploys. For a Blueprint, choose **New → Blueprint**, select the repository and approve the service plan. Subsequent releases should be deliberate: run all checks, finish active games, then deploy manually. Scaling, restarts and deploys discard rooms, including during rolling replacement.
5. Deploy. Copy the actual service URL from the dashboard. Verify `/health`, create a room, and invite a second device using a **different network** (e.g. mobile data). Confirm a WebSocket upgrade in browser Network tools, all six rounds, refresh recovery, host departure and rematch.
6. Use this verified HTTPS URL for the challenge. Deployment credentials/dashboard access and this external-network smoke test remain manual until access is supplied.

### GitHub and hosting actions you perform

1. Authenticate to your own GitHub account and create an empty repository. Push only this project, with its lockfile. This workspace currently sits inside a parent Desktop Git repository; create an isolated repository for the game before adding files. Inspect `git status` and `git diff --cached --stat` before pushing. Do not stage unrelated Desktop files, `.env*` files, dependency backups or Playwright traces (which can contain recovery credentials).
2. Authorize Render's GitHub integration for that repository; choose its owner/workspace, branch, root directory, region and paid instance. These require your account access and billing approval. No GitHub authentication, push, hosting provisioning or deploy is performed by this local preparation.
3. Enter the configuration above, deploy, and copy the URL actually issued by Render. Check the service logs for the listening message and `/health` success. If the page loads but sockets fail, confirm `PUBLIC_ORIGIN` matches the browser origin exactly and that you selected a Web Service.
4. Complete the deployment smoke checklist in [SUBMISSION.md](SUBMISSION.md), including phones on independent networks. Record the demo and submit through the official challenge portal.

Useful diagnostics: missing `dist/client` or `dist/server` means the build was skipped; unavailable Vite/TypeScript during build means dev dependencies were omitted (use `--include=dev`); origin rejection means the public URL and origin setting differ; lost room after a deploy is expected with in-memory storage. `/health` confirms process readiness, not room persistence or cross-network gameplay.

Docker alternative: `docker build -t vault-rush .`, then `docker run --rm -p 3000:3000 -e PUBLIC_ORIGIN=http://localhost:3000 vault-rush`. Place a TLS reverse proxy supporting HTTP upgrade in front for public use. Docker execution requires Docker installed and running; see QA report for whether it was tested.

## Mobile and accessibility QA

- [ ] 390px and 320px: landing, dialog, roster, all five vaults, scores and final results fit without horizontal scrolling.
- [ ] Touch-select and lock; selected/locked/revealed states remain clear, including trap labels.
- [ ] Background the phone during decision, return after deadline, confirm synchronized scores.
- [ ] Refresh after locking; identity and score remain intact.
- [ ] Keyboard Tab/Shift-Tab through dialogs; Escape closes; focus returns; visible focus and text labels.
- [ ] Screen-reader check of dialog names, inputs, button names and alerts on real assistive technology.
- [ ] Reduced-motion preference removes motion; optional sound begins only after an explicit click; mute works.
- [ ] Real iOS Safari and Android Chrome on separate networks: invite URL, clipboard, connection recovery and six-round flow.

## Submission description

**VAULT RUSH: THE NEON HEIST** turns your friend group into a crew of very unreliable thieves. Two to eight players join a private room from any browser. Every round, five server-sealed vaults await, and every agent has a different piece of truthful private intel. Share what you know, bluff about what you don't, and secretly lock a target. Pick the same vault and split the take; find a trap and watch your haul shrink. Six fast rounds produce one richest thief—or a shared victory. Original neon artwork, simultaneous reveals, recovery and instant rematches keep the crew together.

## 60-second demo storyboard

| Time | Shot / narration |
| --- | --- |
| 0–7s | Landing, luminous vault. “Your friends. Your rivals. Welcome to Vault Rush.” |
| 7–15s | Create room on laptop, join link on phone. “No accounts. Just a room code and a crew.” |
| 15–25s | Show different private hints side by side. “Everyone knows something. Nobody knows everything.” |
| 25–35s | Select, change, lock. Countdown across devices. “Follow the intel. Or follow the bluff.” |
| 35–45s | Simultaneous reveal: shared reward and trap, matching scores. “Split the take. Dodge the traps.” |
| 45–55s | Round-six standings and winner celebration. “Six rounds. One clean getaway.” |
| 55–60s | Run it back, final title and actual public URL. “Bring your crew. Leave your trust.” |

## Original cover brief

16:9 dark navy sci-fi arcade poster. A chunky graphite security vault floats above a receding technical grid, electric lime dial light, cyan and ultraviolet rim highlights, original SVG lightning insignia. Small silhouettes of five differently colored vaults below. Bold upper-left title “VAULT RUSH”; subtitle “THE NEON HEIST”; room for “2–8 PLAYERS · 6 ROUNDS · ZERO TRUST.” All assets here are original CSS/SVG or Lucide ISC-licensed icons. Use the landing screenshot as a reference. No stock or third-party character art required.

## Final challenge checklist

- [ ] Verify official challenge eligibility, rules, deadline and submission portal independently; October 31, 2026 is supplied by the brief and has not been verified here.
- [ ] Deploy and record the **actual public HTTPS URL**; test distinct devices/networks.
- [ ] Confirm production logs, health endpoint, WebSocket upgrade, one instance and no restart during demo.
- [ ] Record the 60-second demo; capture a 16:9 cover and mobile gameplay screenshot.
- [ ] Run the checks above; review QA report and disclose persistence limits.
- [ ] Submit description, playable URL, repository (if required), credits and demo before the verified deadline.
