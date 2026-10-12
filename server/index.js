import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { store } from './store.js';
import { listScenarios } from './scenarios/index.js';
import {
  createCase, getCase, streamFor, tick, publicCase, caseSummary, acknowledge, pinEvent, unpinEvent,
  addIoc, removeIoc, addNote, saveDraft, tool, action, submit, removeCase,
} from './engine/cases.js';
import { publicEvent } from './engine/logstream.js';
import { HttpError } from './engine/response.js';
import { exportMarkdown } from './engine/report.js';
import { demoRouter, tourRouter } from './demo/routes.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '256kb' }));

const wrap = (fn) => (req, res, next) => Promise.resolve().then(() => fn(req, res)).catch(next);
const load = (req) => {
  const c = getCase(req.params.id);
  tick(c);
  return c;
};

app.get('/api/health', (req, res) => res.json({ ok: true, time: Date.now() }));
app.get('/api/scenarios', (req, res) => res.json(listScenarios()));

app.get('/api/cases', (req, res) => {
  // Guided-demo sessions are kept apart from assessment cases.
  res.json(store.all().filter((c) => !c.kind).sort((a, b) => b.t0 - a.t0).map(caseSummary));
});
app.post('/api/cases', wrap((req, res) => {
  const { scenarioId, analyst } = req.body || {};
  const c = createCase({ scenarioId, analyst });
  res.status(201).json(publicCase(c));
}));
app.get('/api/cases/:id', wrap((req, res) => res.json(publicCase(load(req)))));
app.delete('/api/cases/:id', wrap((req, res) => { removeCase(getCase(req.params.id)); res.json({ ok: true }); }));

app.post('/api/cases/:id/ack', wrap((req, res) => { const c = load(req); acknowledge(c); res.json(publicCase(c)); }));

app.get('/api/cases/:id/logs', wrap((req, res) => {
  const c = load(req);
  const q = req.query;
  const num = (v) => (v === undefined || v === '' ? undefined : Number(v));
  const out = streamFor(c).query({
    q: q.q, source: q.source, from: num(q.from), to: num(q.to),
    limit: Math.min(500, num(q.limit) || 100), offset: num(q.offset) || 0, order: q.order,
  });
  res.json({ total: out.total, bySource: out.bySource, events: out.events.map(publicEvent) });
}));

app.get('/api/cases/:id/events', wrap((req, res) => {
  const c = load(req);
  const s = streamFor(c);
  const ids = String(req.query.ids || '').split(',').filter(Boolean).slice(0, 200);
  res.json({ events: ids.map((i) => s.get(i)).filter(Boolean).map(publicEvent) });
}));

app.post('/api/cases/:id/pins', wrap((req, res) => { const c = load(req); pinEvent(c, req.body.eventId, req.body.note); res.json(publicCase(c)); }));
app.delete('/api/cases/:id/pins/:eventId', wrap((req, res) => { const c = load(req); unpinEvent(c, req.params.eventId); res.json(publicCase(c)); }));
app.post('/api/cases/:id/iocs', wrap((req, res) => { const c = load(req); addIoc(c, req.body || {}); res.json(publicCase(c)); }));
app.post('/api/cases/:id/iocs/remove', wrap((req, res) => { const c = load(req); removeIoc(c, req.body.value); res.json(publicCase(c)); }));
app.post('/api/cases/:id/notes', wrap((req, res) => { const c = load(req); addNote(c, req.body.text); res.json(publicCase(c)); }));
app.put('/api/cases/:id/draft', wrap((req, res) => { const c = load(req); saveDraft(c, req.body || {}); res.json({ ok: true }); }));

app.post('/api/cases/:id/tools/:tool', wrap((req, res) => {
  const c = load(req);
  const result = tool(c, req.params.tool, req.body || {});
  res.json({ result, case: publicCase(c) });
}));

app.post('/api/cases/:id/actions', wrap(async (req, res) => {
  // Security consoles take a moment to apply a change; the action is
  // executed when that round-trip completes.
  await new Promise((r) => setTimeout(r, process.env.SOC_SIM_FAST ? 0 : 600));
  const c = load(req);
  const rec = action(c, req.body || {});
  res.json({ action: rec, case: publicCase(c) });
}));

app.post('/api/cases/:id/submit', wrap((req, res) => {
  const c = load(req);
  const outcome = submit(c, req.body || {});
  res.json({ outcome, case: publicCase(c) });
}));

app.get('/api/cases/:id/export', wrap((req, res) => {
  const pub = publicCase(load(req));
  if (req.query.format === 'md') {
    res.set('Content-Type', 'text/markdown; charset=utf-8');
    res.set('Content-Disposition', `attachment; filename="${pub.ticket}.md"`);
    res.send(exportMarkdown(pub));
  } else {
    res.set('Content-Disposition', `attachment; filename="${pub.ticket}.json"`);
    res.json(pub);
  }
}));

// Live stream: new log lines every second, plus a nudge whenever the case changes.
app.get('/api/cases/:id/stream', wrap((req, res) => {
  const c = getCase(req.params.id);
  const stream = streamFor(c);
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  res.flushHeaders();
  tick(c);
  let seq = stream.seq;
  let rev = c.rev;
  const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  send('hello', { time: Date.now(), rev });
  const timer = setInterval(() => {
    try {
      tick(c);
      const fresh = stream.since(seq);
      if (fresh.length) {
        seq = fresh[fresh.length - 1].seq;
        send('logs', fresh.map(publicEvent));
      } else res.write(': keep-alive\n\n');
      if (c.rev !== rev) { rev = c.rev; send('case', { rev }); }
      if (c.status === 'closed') { send('closed', {}); }
    } catch (err) {
      console.error(err);
    }
  }, 1000);
  req.on('close', () => clearInterval(timer));
}));

app.use('/api/demo', demoRouter);
app.use('/api/tour', tourRouter);

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));

const dist = path.join(here, '..', 'client', 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get('*', (req, res) => res.sendFile(path.join(dist, 'index.html')));
} else {
  app.get('/', (req, res) => res.type('text').send('Client not built. Run: npm run build'));
}

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message, ...(err.extra || {}) });
  if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'Malformed JSON.' });
  console.error(err);
  return res.status(500).json({ error: 'Internal error.' });
});

const port = Number(process.env.PORT) || 4000;
if (process.env.SOC_SIM_NO_LISTEN !== '1') {
  app.listen(port, () => console.log(`SOC simulation running at http://localhost:${port}`));
}

export { app };
