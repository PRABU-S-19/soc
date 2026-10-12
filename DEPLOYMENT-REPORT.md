# Deployment report

Repository reviewed: `https://github.com/PRABU-S-19/soc.git`, branch `main`,
commit `d3ceafc` ("Fix SOC simulation merge conflicts").

## Why the Render deploy failed

Six source files committed on `main` still contained unresolved Git conflict
markers: `server/index.js`, `server/store.js`, `server/engine/cases.js`,
`server/engine/grading.js`, `server/scenarios/index.js` and
`tests/s01.test.mjs`. `npm start` loads `server/index.js`, which
stops immediately with:

    server/index.js:14
    <<<<<<< HEAD
    SyntaxError: Unexpected token '<<'

So the service never started listening. Reproduced locally before fixing.

## What the conflicts were

The repository history has two unrelated roots that were merged:
`7b1da55` is the original SOC simulation, and `b11cf46` is the updated
version (Newbie Demo Mode, walkthrough, demo API). Every conflict in every
file (52 conflict blocks in 20 files, including the `client-backup` copy)
was one of these two versions against the other. The updated version was
built on the original, so it contains the original's behaviour plus the
additions. Each file was checked mechanically: resolving every block to the
updated side reproduces `b11cf46` exactly, and resolving to the other side
reproduces the original exactly. Each conflict was therefore resolved to
the updated side, which keeps both. No conflict block was resolved by
deleting marker lines.

## Fixes made

| # | File(s) | Problem | Fix |
|---|---|---|---|
| 1 | `server/index.js`, `server/store.js`, `server/engine/cases.js`, `server/engine/grading.js`, `server/scenarios/index.js`, `tests/s01.test.mjs`, `.gitignore`, `README.md` | Unresolved conflict markers (server could not start) | Resolved as described above |
| 2 | `client-backup/` (whole folder) | A second copy of the frontend with 57 conflict blocks, not used by the build or the server | Removed. `client/` is the frontend Vite builds |
| 3 | `client/src/*` | Reformatted during the manual merge. Compiled output compared file by file against the tested version: identical except `Console.jsx`, where home-page text had been changed, including the required Newbie Demo Mode sentence ("...through a guided, step-by-step demonstration." had lost "step-by-step") | Restored the tested version of `client/src` |
| 4 | `client/dist/` | Built from the merged source; contained a stale bundle | Rebuilt with `npm run build`. The JS bundle hash before fix 9 matched the previously browser-tested build exactly |
| 5 | `README.md` | A UTF-16 line (`# SOC-updated`, written by a Windows shell) made Git treat the file as binary | Removed the line; added environment variables, Render deployment and merge-conflict sections |
| 6 | `package.json` test script, new `tests/run.mjs` | `node --test tests/*.test.mjs` relies on the shell expanding the glob: fails in Windows cmd/PowerShell on Node 18 and 20 | `npm test` now runs `tests/run.mjs`, which lists the test files itself |
| 7 | `tests/demo.test.mjs`, `tests/ui/*.mjs` | `new URL(...).pathname` gives `/C:/...` on Windows, which file APIs cannot open | Replaced with `fileURLToPath(...)` |
| 8 | `server/store.js` | `renameSync` over an open file fails with `EPERM` on Windows | Falls back to copy-then-delete on `EPERM`, `EACCES` or `EBUSY`; behaviour on Linux unchanged |
| 9 | `client/src/App.jsx`, `client/src/Console.jsx` | "Open normal simulation" scrolled 60 ms after navigation, before the scenario list had loaded | Scrolls once the scenario list has rendered |
| 10 | new `render.yaml`, new `.node-version` | No Render configuration in the repository | Blueprint with build, start and health check; Node 22 pinned |
| 11 | new `.gitattributes`, `.gitignore` | Mixed Windows/Linux line endings; `.env` files not ignored | LF line endings for text, fonts marked binary; `.env`, `.env.*`, `*.log` ignored |
| 12 | `tests/ui/summary-actions.mjs` | Its scroll check failed on short pages that cannot scroll further | Check accepts "scrolled as far as the page allows" |

Nothing was simplified or removed apart from the unused `client-backup`
folder. Scenarios, grading, guided demo, walkthrough, pause/resume/replay/
reset, API routes, isolation, answer-key protection and read-only previews
are the same code as the tested version.

## Commands actually run (Linux, Node 22.22.0, npm 10.9.4)

| Command | Result |
|---|---|
| `node server/index.js` on the unfixed repo | `SyntaxError: Unexpected token '<<'` (the deploy failure) |
| `git grep` for conflict markers on the fixed tree | none |
| `node --check` on every server and test file | all parse |
| `npm ci` (clean, from `package-lock.json`) | succeeded |
| `npm audit --omit=dev` | 0 vulnerabilities |
| `npm audit` (including dev) | 2 findings in esbuild/Vite, development server only. See limitations |
| `npm run build` | succeeded, 55 modules |
| `npm test` | 27 passed, 0 failed (79 s) |
| `node tests/run.mjs` run from a different working directory | 27 passed, 0 failed |
| `NODE_ENV=production PORT=4410 npm start` | started, "SOC simulation running at http://localhost:4410" |
| HTTP smoke test against that server (35 checks) | 35 passed |
| Restart persistence (stop, start, list cases) | 3 cases before, 3 after |

### HTTP smoke test (production server)

Health; UI served; bundle served; deep-link fallback; JSON 404 for unknown
API routes; scenario list with the demo hidden; demo scenario refused on
the normal case API; normal case created (a `kind` field in the request is
ignored); alert acknowledged; log search; tool run; no answer keys in an
open case; live SSE stream; Markdown export; demo start (repeat start with
the same nonce returns the same session); demo guide of 49 beats / 16 steps
without answer keys; explanation step; required task cannot be skipped;
cannot jump past an open task; wrong answer gets coaching; a client
"completed" flag is not trusted; pause; resume; demo not listed with cases;
partial summary labelled as not an assessment; reset to a clean session;
old session gone after reset; normal case untouched; demo API refuses a
normal case id; walkthrough preview created, read-only and redacted,
rejects changes and deletion, creates no listed case; bundle free of answer
keys, `process.env`, secrets and local paths.

### Real browser (Chromium via Playwright) against the production server

| Run | Result |
|---|---|
| Guided demo, start to learning summary, 1440×900 and 390×844 | 49/49 beats; 43/43 targeted steps highlighted with an arrow; 0 covered; 27/27 checks passed; no page errors |
| Guided demo on the final bundle, 1440×900 | Same result |
| Homepage walkthrough, 1440×900 and 390×844 | 13 steps, 12/12 targeted steps with an arrow, case count unchanged, no page errors |
| Edge cases (46 checks) | Double click makes one session; tasks cannot be skipped; API failure handled; missing target recovers; refresh resumes; pause/resume; exit then normal shift; restart; invalid session handled; no page errors |
| Learning summary actions | Review a step, Open normal simulation, Replay: all passed |
| Scenario 1, start to closure | Score 99 (same as before the merge) |
| Scenario 2, start to closure | Score 100 |

Playwright is not a project dependency. These scripts are in `tests/ui/`
and are not part of `npm test`.

## Render settings

| Setting | Value |
|---|---|
| Runtime | Node |
| Build command | `npm ci --include=dev && npm run build` |
| Start command | `npm start` |
| Health check path | `/api/health` |

### Environment variables

| Variable | Required | Value |
|---|---|---|
| `NODE_VERSION` | Recommended | `22` (set in `render.yaml`; also pinned by `.node-version`) |
| `PORT` | No, Render sets it | do not set manually |
| `SOC_SIM_DATA` | No | path of the case store; default `data/cases.json` |

The project uses no secrets, API keys or `.env` files.

## Not verified, and limitations

- **Not deployed to Render from here.** There is no access to your Render
  account. The same build and start commands were run locally with
  `NODE_ENV=production` and a custom `PORT`, which is how Render runs them.
- **Windows** was not available here. The Windows-specific fixes (test
  runner, file URLs, rename fallback) were made from known Windows
  behaviour and verified on Linux only.
- **Node 18 and 20** were not run; only Node 22. `render.yaml` and
  `.node-version` pin 22.
- **Dev-only audit findings**: esbuild ≤0.24.2 (via Vite 5) lets a website
  read responses from the local Vite dev server (`npm run dev:client`).
  Production does not use Vite or esbuild. The fix requires a major Vite
  upgrade, which was not done to avoid changing the build.
- **Free plan**: Render's free plan disk is not persistent, so cases and
  demo sessions are lost on restart or redeploy, and the service sleeps
  when idle.
- `client/dist` is committed so that `npm start` works without a build. It
  will conflict again if two branches rebuild it; the README explains how
  to resolve that (rebuild, do not hand-edit).
