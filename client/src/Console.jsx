import React, { useEffect, useState } from 'react';
import { api } from './api.js';
import { stamp, Severity, ErrorNote, useLocal } from './components/bits.jsx';

export default function Console({ open, startTour, openDemo }) {
  const [scenarios, setScenarios] = useState(null);
  const [cases, setCases] = useState(null);
  const [name, setName] = useLocal('soc-sim-analyst', '');
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);

  const load = () => Promise.all([api.scenarios(), api.cases()]).then(([s, c]) => { setScenarios(s); setCases(c); }).catch(setErr);
  useEffect(() => { load(); }, []);

  const start = async (sid) => {
    if (!name.trim()) { setErr(new Error('Enter your analyst name first. It is recorded against every action in the case file.')); return; }
    setBusy(sid);
    try { const c = await api.createCase(sid, name.trim()); open(c.id); } catch (e) { setErr(e); setBusy(null); }
  };

  return (
    <div className="page">
      <header className="home-head">
        <div>
          <h1>SOC simulation</h1>
          <p className="lead">Work a ticket the way a SOC does: watch the queue, triage at Tier 1, hand off to Tier 2, investigate and validate, respond as Tier 3, close. Logs are generated live and every decision is checked against the evidence.</p>
        </div>
        <label className="analyst" data-tour="home-analyst">
          <span>Analyst name</span>
          <input className="input" value={name} onChange={(e) => { setName(e.target.value); setErr(null); }} placeholder="e.g. a.rivera" maxLength={40} />
        </label>
      </header>
      <ErrorNote error={err} onDismiss={() => setErr(null)} />

      <section className="learn" data-tour="home-learn" aria-labelledby="learn-h">
        <h2 id="learn-h">New here?</h2>
        <div className="learn-grid">
          <article className="learn-card" data-tour="home-demo">
            <p className="meta">Guided, step by step, sample scenario</p>
            <h3>Newbie Demo Mode</h3>
            <p>Learn how a SOC analyst investigates security events, reads logs, collects evidence, validates findings, and completes an incident through a guided, step-by-step demonstration.</p>
            <button type="button" className="btn btn-primary" data-tour="home-demo-start" onClick={openDemo}>Start guided demo</button>
          </article>
          <article className="learn-card" data-tour="home-tour">
            <p className="meta">Optional, about five minutes, nothing is started</p>
            <h3>How it works</h3>
            <p>A short tour of this application: the home page, the console, logs and search, the three tiers and the final report. It does not start an assessment and you can leave it at any time.</p>
            <button type="button" className="btn" data-tour="home-tour-start" onClick={startTour}>Take a walkthrough</button>
          </article>
        </div>
      </section>

      <section data-tour="home-scenarios">
        <h2 id="start-a-shift">Start a shift</h2>
        {!scenarios && <p className="muted">Loading…</p>}
        <div className="scenarios">
          {(scenarios || []).map((s) => (
            <article className="scenario" key={s.id} data-tour="home-scenario">
              <p className="meta">Queue: {s.queue}</p>
              <h3>{s.title}</h3>
              <p>{s.blurb}</p>
              <dl className="facts">
                <div><dt>Level</dt><dd>{s.difficulty}</dd></div>
                <div><dt>Typical time</dt><dd>{s.minutes} minutes</dd></div>
                <div><dt>Tiers</dt><dd>{s.tiers}</dd></div>
                <div><dt>Log sources</dt><dd>{s.sources.length}</dd></div>
              </dl>
              <button type="button" className="btn btn-primary" data-tour="home-start" onClick={() => start(s.id)} disabled={busy === s.id}>{busy === s.id ? 'Starting…' : 'Start shift'}</button>
            </article>
          ))}
        </div>
      </section>

      <section data-tour="home-cases">
        <h2>Cases</h2>
        {cases && !cases.length && <p className="muted">No cases yet. Starting a shift creates one.</p>}
        {cases && cases.length > 0 && (
          <div className="table-wrap">
            <table className="grid cases">
              <thead><tr><th>Ticket</th><th>Alert</th><th>Analyst</th><th>Stage</th><th>Severity</th><th>Opened (UTC)</th><th className="num">Score</th><th /></tr></thead>
              <tbody>
                {cases.map((c) => (
                  <tr key={c.id}>
                    <td className="mono"><button type="button" className="link" onClick={() => open(c.id)}>{c.status === 'monitoring' ? 'Monitoring' : c.ticket}</button></td>
                    <td>{c.status === 'monitoring' ? c.scenarioTitle : c.title}</td>
                    <td>{c.analyst}</td>
                    <td>{c.status === 'closed' ? 'Closed' : `${c.stageLabel} (${c.tier})`}</td>
                    <td><Severity level={c.severity} /></td>
                    <td className="mono">{stamp(c.createdAt)}</td>
                    <td className="num">{c.score ?? '-'}</td>
                    <td className="row-actions">
                      {confirmDel === c.id ? (
                        <>
                          <button type="button" className="link danger" onClick={async () => { await api.deleteCase(c.id).catch(setErr); setConfirmDel(null); load(); }}>Delete permanently</button>
                          <button type="button" className="link" onClick={() => setConfirmDel(null)}>Cancel</button>
                        </>
                      ) : <button type="button" className="link" onClick={() => setConfirmDel(c.id)}>Delete</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
