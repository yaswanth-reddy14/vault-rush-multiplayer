# VAULT RUSH implementation plan

Build a single-origin React/Vite/TypeScript client and Express/Socket.IO authoritative server. Shared public types never contain hidden outcomes or recovery tokens. A transport-independent engine owns rooms, phases, secure randomness, votes and settlement.

## Rules and decisions
Six rounds; five shuffled vaults (three rewards, one trap, one random reward/trap). Preview 4s, decision 20s, reveal 5s, summary 5s. Rewards use floor(pool / occupants), leaving remainder unclaimed. Trap loss capped at 35 and balance. Truthful hints report relative reward information or a safe pair; no exact pools. No powers in the first release. All connected active players locking ends decision; no speed bonuses. With fewer than two connected players, the decision deadline still settles and the game completes; missing choices earn zero. Late joins only in lobby. Disconnected participants retain seats; host moves to a connected player. Rematch clears scores and removes disconnected seats.

## Milestones
1. Engine, rooms, transport, React end-to-end flow.
2. Original SVG/CSS neon art, responsive gameplay, onboarding, sound.
3. Validation, rate limits, recovery, cleanup and host failover.
4. Engine/transport tests, multi-context Playwright, mobile and visual verification.
5. Production build, Docker/Render instructions, submission material.

## Acceptance and risks
Verify 2–3 isolated clients, six rounds, private state redaction, illegal/duplicate actions, reconnect, host handoff, rematch and 390px overflow. Run lint, strict typecheck, unit/integration tests, build, E2E. In-memory single-instance rooms disappear on restart; recovery tokens are bearer credentials. Public deployment requires a hosting account; never invent a URL or claim cross-network verification from localhost. Bound rooms, participants, messages and idle lifetime. Sites' Worker runtime cannot host this Node service; use a persistent Node WebSocket host.

## Completion status
Local implementation and deployment-readiness review complete. Strict typecheck, lint, 32 unit/socket/configuration tests, production build, dynamic-port startup smoke and five Playwright cases (run as 4 + 1) pass. Three isolated browser clients completed six synchronized rounds with deadline settlement, recovery, host handoff and rematch. Mobile 390px gameplay and 320px landing/form/lobby checks pass. Render single-instance configuration, validated origins, production startup, Docker exclusions, README, QA evidence and SUBMISSION.md supplied. External hosting provisioning and separate-network production smoke tests remain manual. See QA_REPORT.md for exact results and limitations.
