# SOC simulation

A training simulator for SOC analysts. The analyst watches a live log
stream, picks up an alert, and works the ticket through every tier:

    Monitor -> L1 triage -> L2 escalation -> Investigation -> Validation -> L3 response -> Closure

Logs are synthetic, generated per case, and internally consistent across
seven sources (proxy, DNS, email gateway, endpoint/Sysmon-style, Windows
Security, firewall, tool audit). Answer keys never leave the server until
the ticket is closed.

## Run it

Requires Node.js 18 or newer.

    npm install --omit=dev     # server needs only express; the UI is prebuilt in client/dist
    npm start                  # http://localhost:4000

Environment variables: `PORT` (default 4000), `SOC_SIM_DATA` (path of the
case store, default `data/cases.json`).

### Develop

    npm install
    npm run dev:server         # API on :4000, restarts on change
    npm run dev:client         # Vite on :5173, proxies /api to :4000
    npm run build              # rebuild client/dist
    npm test                   # end-to-end API tests (about 90 s; they wait for real alert timers)

## Scenarios

| id | Alert the analyst sees | Shape |
|----|------------------------|-------|
| `s01-beacon` | Periodic outbound connections to a newly observed domain | True positive. Full L1 -> L2 -> L3 path, 11 investigation findings, response console, about 45 minutes. |
| `s02-authfail` | Multiple failed logons followed by a successful logon from one source | Benign true positive. Correct path closes at Tier 1; escalating routes through an L2 review and costs credit. |

Catalogue entries describe only the alert. What is behind it is in the
after-action review.

## For beginners: Newbie Demo Mode and the walkthrough

The home page has a "New here?" section with two optional entry points.
Neither is needed to start a shift, and neither changes how the scenarios
above behave.

| Entry point | What it is | What it creates |
|-------------|------------|-----------------|
| **Newbie Demo Mode** ("Start guided demo", `#/demo`) | A guided run of one ticket from the first log line to the closed ticket, in 16 steps. An instructor panel points an arrow at each control, explains what it is, why it matters and what to do, and checks the work on the server before the learner can continue. | One demo session on a dedicated sample scenario (`demo-portal-login`). Ticket numbers start with `DEMO-`. It is not listed under Cases and does not use assessment ticket numbers. |
| **Take a walkthrough** ("How it works") | A 13-step tour of the interface: home page, console, logs, search, the three tiers and the report. | Nothing. Console screens are shown on read-only sample tickets the server keeps in memory. |

A demo session can be paused, exited, resumed after a refresh or a later
visit (kept for 24 hours), replayed, or restarted clean. Its result is
labelled a guided learning summary, not an assessment.

`docs/BEGINNER_MODE.md` is the implementation report: files, the guided
sequence, how validation and isolation work, and the test results.

## How it works

    server/
      index.js              HTTP API + SSE stream; serves client/dist
      store.js              JSON-file case store (atomic writes)
      engine/
        env.js              the simulated company: hosts, users, service accounts, baselines
        format.js           log line builders (raw line + parsed fields)
        noise.js            background activity, a pure function of (seed, second)
        logstream.js        per-case stream: history + one slot per elapsed second
        query.js            search language (field:value, wildcards, -exclude, a>n, (a|b))
        cases.js            workflow state machine, grading, public serialisation
        grading.js          per-field grading against the private key
        tools.js            threat intel, asset, directory, change calendar, decode, sweep, process tree, sandbox
        response.js         response actions, environment state, objective evaluation
        report.js           after-action report and Markdown export
        common.js           shared scenario helpers (beacon generator)
      scenarios/            one module per scenario (demo-portal.js is the hidden demo scenario)
      demo/
        guide.js            Newbie Demo script (public) and its checks (server only)
        service.js          demo sessions, progress, learning summary
        autoplay.js         read-only sample tickets for the walkthrough
        routes.js           /api/demo and /api/tour
    client/src/             React UI (Vite)
      tour/                 GuidedTour (reusable), HomeTour, DemoPage, DemoIntro, DemoSummary, Quiz
    tests/                  node:test suites driving the real API
    docs/                   BEGINNER_MODE.md

**Real-time logs.** Each case has a random seed and a start time. Every
one-second slot is generated deterministically from them, so history (30 to
45 minutes before the shift) and the live tail come from the same function
and a case can be regenerated exactly after a restart. Scenario events are
scheduled into slots; periodic behaviour (beacons) is computed per slot and
consults the response state in force at that second. Blocking a domain
turns the next beacon into a DENIED proxy line; isolating a host replaces it
with an EDR "blocked" event; eradication stops it.

**Hidden answers.** Every gradable field carries a private `key` object
(accepted values, supporting-evidence tags, hint, explanation). The
serialiser in `cases.js` strips `key` from everything sent to the browser,
log events are sent without their `_tags`, and response objectives live
under `scenario.secret`. `tests/` scans every response of an open case for
those properties and for explanation text. Feedback before closure is
verdict-only (accepted / partly accepted / not accepted, plus a hint that
points at where to look).

**Evidence-backed findings.** Investigation findings must be linked to a
pinned log event. A correct answer whose linked event does not show it
earns 70%. Three review rounds; accepted findings lock; credit decays
(100 / 70 / 40%).

**Case history.** Every acknowledgement, pin, indicator, tool run,
submission, QA overrule, response action and tier reassignment is appended
to `case.history` with actor and timestamp, and stays visible in every
later stage and after closure. Completed stages can be reviewed from the
stage rail.

**Tier gating** is enforced on the server: fleet sweep, process tree and
sandbox need Tier 2; response actions need the L3 response stage; a closed
case is read-only.

## Adding a scenario

Create `server/scenarios/sNN-name.js` exporting an object, and register it
in `server/scenarios/index.js`. The engine, API and UI need no changes.

    {
      id, historySeconds,
      catalog: { title, queue, blurb, difficulty, minutes, tiers, sources, environment },
      build({ t0, seed }) -> { events: [...], periodic: [...] },   // tag events with _tags
      alert: { at: seconds, build(stream, case) -> alert },
      relatedAlerts: [{ id, at, when(state, case), build }],
      stages: [ { id, label, tier, kind: 'monitor' | 'form' | 'response', weight, attempts, fields } ],
      flow(stageId, { values, c }) -> { next, result, notes } | null,   // branching and QA overrules
      intel({ t0 }), sandbox, assetNotes, accountNotes, changes,       // what the tools return
      secret: { response: { scope, objectives, artifacts, notify, contained }, truth({ t0 }) },
    }

Field types: `single`, `multi`, `host`, `account`, `hosts`, `accounts`,
`text`, `longtext`, `order`, `pins`, `pin_one`, `ioc_list`, `checks`. Each
takes a `key`; see `grading.js` for what each type expects. Write a test
with `solveStage()` from `tests/helpers.mjs`: it builds a perfect run from
your keys against your generated logs, which catches a key that the logs do
not actually support.

## Limits to know about

- No authentication or multi-tenancy. The analyst name is a label. Put it
  behind your own auth before exposing it beyond a lab network.
- Cases are stored in one JSON file. Fine for a single instance; replace
  `server/store.js` with a database adapter for anything larger.
- Free-text notes and summaries are recorded and length-checked, not graded
  for content.
- A live case stops generating new log lines six hours after it starts.
- Demo sessions are removed 24 hours after they start. Walkthrough sample
  tickets live in memory only and are rebuilt every 20 minutes.
- In Newbie Demo Mode the investigation summary is checked for its six
  parts by key words. That check cannot judge whether the reasoning is
  right, and says so.
- All organisation data is fictional. External infrastructure uses the
  reserved `.example` TLD and documentation IP ranges; benign destinations
  in the noise use those too, so a `.example` suffix is not a tell.
#   S O C - u p d a t e d  
 