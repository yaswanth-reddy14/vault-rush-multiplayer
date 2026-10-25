# VAULT RUSH submission kit

## Project description

**VAULT RUSH: THE NEON HEIST** is a real-time social strategy game for 2–8 friends. Join a private room from your phone or computer, receive truthful private intel, then secretly choose one of five futuristic vaults. Share your intel, keep it quiet, or bluff over your favorite voice chat. Pick the same vault as another thief and split the credits; find a trap and lose a small, capped amount. After six simultaneous rounds, the richest agent wins, with tied leaders sharing victory.

The server controls outcomes, legal moves, timing and scores. Original neon vault art, private hints, synchronized reveals, recovery after refresh, automatic host handoff and clean rematches support a complete session without accounts, downloads or buy-ins.

**Technology:** React, TypeScript, Vite, Node.js, Express, Socket.IO and Zod; Vitest and multi-context Playwright tests. One persistent Node instance serves frontend and backend on the same origin. Rooms are in memory and disappear on restart; no durable or multi-instance persistence is claimed.

**Playable URL:** add the actual HTTPS URL after deployment and external-network verification.

**Repository / demo video:** add the actual links after you publish them. No public deployment or independent-network test has occurred during local preparation.

## 60-second demo: shots and spoken script

| Time | Shot | Voiceover |
| --- | --- | --- |
| 0–7s | Neon landing and vault, title visible | “Welcome to Vault Rush: The Neon Heist. Five vaults. One crew. Everyone has a secret.” |
| 7–15s | Create a room on laptop; show a phone joining its invite | “Create a private room and invite up to seven friends. No accounts, downloads or payments.” |
| 15–25s | Different private hints on two devices; crop recovery tokens from all recordings | “Every agent gets truthful private intel. Share it, hide it, or bluff. You know something your friends don't.” |
| 25–35s | Select, change target, lock; show matching round and countdown | “You have twenty seconds to choose a vault. Read the room, make your move, and lock it in.” |
| 35–45s | Reveal showing shared reward and a trap, then matching standings | “Choices reveal together. Follow a friend and split the take. Find a trap and lose a little of your haul.” |
| 45–55s | Round-six results, winner or shared victory | “Six rounds of risk and questionable trust. The richest thief wins. Your next heist is one rematch away.” |
| 55–60s | Rematch lobby, title and verified public URL | “Bring your crew. Leave your trust at the door.” |

Record real multiplayer footage; edit waiting time to fit sixty seconds. Use only a public URL that has actually been deployed. Do not show localStorage, tokens, hosting credentials or unredacted test traces. Sound is optional and starts after a click. Use the original landing screenshot or the README's original cover brief for the cover artwork.

## Final testing and submission checklist

### Local release gate

- [ ] `npm ci --include=dev`
- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] `npm test`
- [ ] `npm run build`
- [ ] `npm run test:production`
- [ ] `npx playwright install chromium`
- [ ] `npm run test:e2e:production` (port 3000 must be free)
- [ ] `npm audit` reviewed; confirm latest results in QA_REPORT.md.

### Hosted smoke test: execute after deployment

- [ ] Confirm one Node instance, autoscaling off, Auto-Deploy off and successful `/health`.
- [ ] Open the actual HTTPS root and an invite URL directly from a new device.
- [ ] Use a laptop on Wi-Fi and a phone on mobile data; verify the WebSocket upgrade in Network tools. Record device/browser/network details.
- [ ] Join 2–8 real participants; verify roster and round synchronization, truthful separate hints and matching scores.
- [ ] Change choice, lock and confirm it cannot change; leave one round unlocked and verify deadline settlement.
- [ ] Refresh after a lock and after receiving credits; confirm identity, score and sealed choice survive.
- [ ] Disconnect the host and verify a connected agent becomes host; complete six rounds and rematch.
- [ ] Verify room-not-found and expired-room feedback, and that missing picks receive zero without freezing the match.
- [ ] Test iOS Safari and Android Chrome: touch controls, clipboard/fallback code, background/foreground recovery, sound/mute and no horizontal overflow.
- [ ] Keyboard and screen reader review: dialog focus, Escape, named inputs, labels, alerts and reduced motion.
- [ ] Schedule releases outside play sessions. A restart intentionally loses rooms; communicate this limitation.

### Publish and submit manually

- [ ] Authenticate to GitHub, create an isolated game repository and review staged files before pushing.
- [ ] Authenticate to Render, authorize the repository, review current paid plan charges and configure the service per README.md.
- [ ] Add only actual deployed URL, repository link and recorded demo link above.
- [ ] Verify official challenge eligibility, rules, deadline, timezone and portal; the original brief gives October 31, 2026, which has not been independently confirmed here.
- [ ] Submit the project description, playable URL, video and any required source/credits before the verified deadline.

Automated local results do not check these boxes on behalf of real-device or external-network testing. See QA_REPORT.md for the actual verified scope.
