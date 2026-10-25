# Release verification — October 25, 2026

## Current production-readiness review

Preserved the existing game, UI, rules and six-round flow. Chose one Render Node Web Service with managed HTTPS, one instance, autoscaling disabled and automatic deploys off. Frontend and `/socket.io/` share one HTTP server and origin. Reviewed Render's current official WebSocket, environment-variable and Blueprint documentation; no hosting account or public deployment was accessed.

Targeted fixes:

- `npm start` always starts production; Vite is enabled only by `npm run dev` / `--dev`.
- Server configuration validates PORT, room TTL and HTTP(S) origins at startup. Render's HTTPS URL is used automatically; explicit custom-domain origin takes precedence.
- Production frontend path resolves relative to the compiled server, independent of the current working directory. SPA navigation works; missing assets stay 404s. Health responses cannot be cached.
- Replacement tabs retain shared recovery credentials, so the active tab can refresh again without losing its seat.
- Docker context excludes dependency backups and `.env.*` files. Render build explicitly installs development build tools; manual deploys avoid surprise room resets.
- Added cross-platform production smoke and Playwright launch scripts. Production browser tests require a fresh server and cannot accidentally reuse a development process.
- Added a bounded shutdown path and a safe startup error log. Rooms still disappear on restart.

### Current executed checks

| Exact command | Result |
| --- | --- |
| `npm.cmd run lint` | Passed after declaring Node's built-in fetch global and simplifying the smoke-test asset regex |
| `npm.cmd run typecheck` | Passed |
| `npm.cmd test` | **32 passed**, three files: engine, transport and configuration |
| `npm.cmd run build` | Passed, compiled React assets and TypeScript server |
| `npm.cmd run test:production` | Passed: host-assigned dynamic PORT, production defaults despite development NODE_ENV, different cwd, health, compiled assets, SPA and missing-asset 404 |
| `npm.cmd run test:e2e:production` | **4 passed in 2.2 minutes**: three-client six-round game, 390px onboarding, replacement-tab recovery, production HTTP/Socket.IO integration |
| `npm.cmd run test:e2e:production -- e2e/narrow.spec.ts` | **1 passed in 4.7 seconds**: 320px landing, form and lobby overflow with a long nickname |
| `npm.cmd audit` | Zero vulnerabilities |
| `git diff --check -- .` | No whitespace errors in tracked diff; this directory is still untracked in its parent repository |

The five browser cases ran in two invocations (4 + 1); no combined five-case run is claimed. All three gameplay clients agreed on scores in every round; the multiplayer test collected no JavaScript page errors. Configuration tests reject bad ports, TTLs and malformed origins. Transport tests cover both polling and WebSocket origin rejection/acceptance, plus timer-based room expiration and expired-token rejection. A configured HTTPS Origin was exercised against the local HTTP backend to represent proxy headers; no actual public TLS or external-network test is implied.

Local production service processes were started and stopped by the smoke/browser checks. This report does not claim a server remains running. The new deployment commands are in README.md; the project description, narrated 60-second demo and uncompleted hosted checklist are in SUBMISSION.md.

### Still manual

- Authenticate to GitHub, isolate and push only the game project, authorize Render and review its paid service plan.
- Configure one instance and the supplied commands, deploy, and obtain the real public URL. Set PUBLIC_ORIGIN when using a custom domain; Render's own domain is automatic.
- Run the hosted checklist on independent devices/networks, including real iOS/Android, TLS, WebSocket upgrade, clipboard, backgrounding, recovery, host handoff and rematch.
- Perform screen-reader, load/soak and Docker runtime checks; these were not executed here. Record the demo, verify official challenge requirements and submit.

In-memory persistence, proxy-shared IP entry rate limits and lack of multi-instance support remain disclosed limitations. No game rules or working screens were replaced.

## Initial implementation history

Environment: Windows, Node 24.21.0, npm 11.19.0, Playwright Chromium, local single-instance production server. No public deployment has been created.

## Commands and outcomes

| Command | Outcome |
| --- | --- |
| `node --version` | v24.21.0 |
| `npm --version` | PowerShell execution policy blocked npm.ps1; used npm.cmd thereafter |
| `npm.cmd install` | Initial install succeeded; audit exposed three test-toolchain vulnerabilities |
| `npm.cmd install -D vite@latest vitest@latest eslint@latest @eslint/js@latest typescript-eslint@latest @vitejs/plugin-react@latest` | Failed dependency resolution against old installed packages |
| `npm.cmd install` after changing version ranges | Same dependency-resolution conflict |
| `Rename-Item …node_modules -NewName dependencies-backup`; `Rename-Item …package-lock.json -NewName package-lock.backup`; `npm.cmd install` | Fresh resolution succeeded, zero vulnerabilities. Backups retained and ignored by Git/ESLint |
| `npm.cmd install -D eslint@^10.0.0 @eslint/js@^10.0.0` | Succeeded; package deprecation corrected with `npm.cmd install -D @eslint/js@10.0.1` |
| `npm.cmd run typecheck` | Passed after setting ES2023 library/target |
| `npm.cmd run lint` | Passed |
| `npm.cmd test` | 13 tests passed across engine and real WebSocket transport suites on Vitest 5.0.5 |
| `npm.cmd run build` | Initial failure inherited unrelated Desktop PostCSS config; fixed with explicit local empty PostCSS pipeline. Final frontend and server build passed |
| `npx.cmd playwright install chromium` | Succeeded; required Chromium already available |
| `$env:E2E_PRODUCTION='1'; npm.cmd run test:e2e` | First run: mobile test passed; full match failed after refresh reopened the join dialog. Fixed recovery dialog and added regression assertion. See final results below |
| `npx.cmd --yes prettier --write client server shared tests e2e index.html package.json tsconfig.json tsconfig.server.json vite.config.ts vitest.config.ts playwright.config.ts eslint.config.js` | Formatted sources; follow-up formatting for edited files also passed |
| `npm.cmd audit` | Zero vulnerabilities after upgrades |
| `npm.cmd audit --omit=dev` | Zero production dependency vulnerabilities |
| `Invoke-WebRequest http://localhost:3000/health -UseBasicParsing` | HTTP 200, `{"ok":true}` |
| `Invoke-WebRequest http://localhost:3000 -UseBasicParsing` | HTTP 200, compiled `/assets/` entry, production CSP without inline scripts |
| `$env:NODE_ENV='production'; $env:PUBLIC_ORIGIN='http://localhost:3000'; npm.cmd start` after browser tests | Automatic approval review rejected this standalone launch without giving a reason. The test-managed production server had passed and was stopped by Playwright; no local server is claimed to remain running. Start manually with `npm.cmd run dev` |

The initial recursive dependency cleanup was rejected by automatic review. The safe replacement preserved the old installation under `dependencies-backup/`; no unrelated workspace files were modified. The initial typecheck also caught `toSorted` requiring ES2023; the configured Node/browser targets support it.

## Covered behavior

Engine and transport: 2,000 generated rounds satisfy reward/trap bounds; injectable deterministic generation; truthful and distinct indexed hints; integer reward split; capped loss and zero floor; missing choices; pre-phase/expired/invalid/duplicate moves; private field redaction; all six phase cycles; tied scores; clean rematch; host election; eight-seat cap; full disconnection; real socket roster updates; private hints; shared deadlines; recovery token identity, score and lock preservation; duplicate connection replacement; unknown rooms; malformed nicknames; message rate limits.

Browser scenario: three isolated browser contexts, third-player roster broadcast, synchronized start and six rounds, matching scoreboards after every reveal, recovery by refresh on an invite URL, deadline settlement without locking while other pages are backgrounded, host departure, rematch. The third context uses 390×844. Separate mobile scenario checks landing overflow, sound toggle, onboarding, Escape and room-not-found feedback. JavaScript page errors are collected by the multiplayer test.

## Visual review

Inspected desktop landing and mobile gameplay captures. Original CSS vault illustration, no missing assets, two-column mobile vault grid and readable primary controls. Automated overflow assertions cover the mobile lobby, gameplay, results and landing. Captures live in `artifacts/`: desktop landing/gameplay, mobile landing/gameplay/results. These captures are local artifacts, not proof of public hosting.

## Remaining manual verification

- Provision and deploy a single persistent Node instance using the README instructions. Requires your repository/hosting access and billing choice. No external credentials were supplied; no public URL is claimed.
- Test the deployed invite URL, TLS, WebSocket upgrade and complete match on devices using separate networks.
- Real iOS Safari, Android Chrome, tablet, screen reader, subjective sound quality and load/soak tests remain unverified. Chromium mobile viewport testing is not real-device certification.
- Dockerfile is provided but Docker build/run was not tested.
- Rooms are in memory: deployments and process restarts lose games. Optional powers and integrated chat are omitted by design.

## Initial implementation browser results

`$env:E2E_PRODUCTION='1'; npm.cmd run test:e2e` **passed both tests in 2.2 minutes**. The three-client six-round test passed in 2.1 minutes; the separate mobile/onboarding/error test passed in 2.3 seconds. Every round logged agreement across all three clients; the collected JavaScript error list was empty. No failing required automated checks remain.
