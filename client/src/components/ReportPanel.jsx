import React, { useState } from 'react';
import { stamp, duration, Verdict } from './bits.jsx';

function Stage({ s }) {
  const [open, setOpen] = useState(s.pct < 100 && !s.skipped);
  if (s.skipped) {
    return <section className="rep-stage"><header><h3>{s.label}</h3><span className="muted">Not required on the path this ticket took</span></header></section>;
  }
  return (
    <section className="rep-stage">
      <header>
        <button type="button" className="rep-toggle" onClick={() => setOpen(!open)} aria-expanded={open}>
          <span className="caret" aria-hidden="true">{open ? '▾' : '▸'}</span>
          <h3>{s.label}</h3>
        </button>
        <span className="muted">{s.tier}, weight {s.weight}%{s.seconds != null ? `, ${duration(s.seconds)}` : ''}{s.attempts > 1 ? `, ${s.attempts} review rounds` : ''}</span>
        <span className="rep-bar" aria-hidden="true"><span style={{ width: `${s.pct}%` }} className={s.pct >= 80 ? 'good' : s.pct >= 50 ? 'mid' : 'low'} /></span>
        <span className="rep-pct">{s.pct}%</span>
      </header>
      {open && (
        <div className="rep-body">
          {(s.fields || []).map((f) => (
            <div className="rep-item" key={f.label}>
              <div className="rep-item-head"><h4>{f.label}</h4><Verdict v={f.verdict} supported={f.supported} /><span className="muted">{f.earned} / {f.points}</span></div>
              <dl>
                <div><dt>You answered</dt><dd className="break">{f.yours}</dd></div>
                <div><dt>Expected</dt><dd className="break">{f.expected}</dd></div>
                {f.explain && <div><dt>Why</dt><dd>{f.explain}</dd></div>}
              </dl>
            </div>
          ))}
          {(s.objectives || []).map((o) => (
            <div className="rep-item" key={o.label}>
              <div className="rep-item-head"><h4>{o.label}</h4><Verdict v={o.verdict} /><span className="muted">{o.earned} / {o.points}</span></div>
              <dl><div><dt>Why</dt><dd>{o.explain}</dd></div></dl>
            </div>
          ))}
          {(s.findings || []).length > 0 && (
            <div className="rep-item">
              <div className="rep-item-head"><h4>Deductions</h4><span className="muted">-{s.penalty}</span></div>
              <ul className="notes">{s.findings.map((f, i) => <li key={i}><strong>{f.action}</strong> (-{f.points}). {f.reason}</li>)}</ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

export default function ReportPanel({ cs }) {
  const r = cs.report;
  return (
    <div className="panel">
      <div className="scroll pad report">
        {cs.kind === 'demo' && <p className="note" data-tour="report-note">Guided demo result. You were coached and could retry, so this figure is a learning record, not an assessment or a certification. It is not listed with, and does not affect, normal simulation cases.</p>}
        {r.sample && <p className="note" data-tour="report-note">Sample report for the walkthrough. Answers, expected answers and explanations are left out here; your own closed ticket shows them in full.</p>}
        <header className="rep-head" data-tour="report-head">
          <div>
            <p className="meta">After-action review, {cs.ticket}</p>
            <h2>{cs.title}</h2>
            <p className="muted">Analyst {cs.analyst}. Opened {stamp(cs.createdAt)} UTC, closed {stamp(cs.closedAt)} UTC.</p>
          </div>
          <div className="rep-score"><span className="score-n">{r.score}</span><span className="score-of">/ 100</span><span className="band">{r.band}</span></div>
        </header>
        <dl className="metrics">
          {cs.metrics.map((m) => <div key={m.id}><dt>{m.label}</dt><dd>{duration(m.seconds)}</dd></div>)}
        </dl>
        <div className="rep-export" data-tour="report-export">
          <a className="btn btn-sm" href={`/api/cases/${cs.id}/export?format=md`}>Download case file (Markdown)</a>
          <a className="btn btn-sm" href={`/api/cases/${cs.id}/export?format=json`}>Download case file (JSON)</a>
        </div>

        <div data-tour="report-stages">
          <h3 className="rep-h">Scoring by stage</h3>
          {r.stages.map((s) => <Stage key={s.id} s={s} />)}
        </div>

        <h3 className="rep-h" data-tour="report-truth">What actually happened</h3>
        <p className="prose">{r.truth.summary}</p>
        <ol className="truth">
          {r.truth.timeline.map((t) => <li key={t.ts + t.text}><span className="mono">{stamp(t.ts)}</span><span>{t.text}</span></li>)}
        </ol>
        {r.truth.iocs?.length > 0 && (
          <>
            <h3 className="rep-h">Indicators of compromise</h3>
            <table className="grid">
              <thead><tr><th>Type</th><th>Value</th><th>Role</th></tr></thead>
              <tbody>{r.truth.iocs.map((i) => <tr key={i.value}><td>{i.type}</td><td className="mono break">{i.value}</td><td>{i.note}</td></tr>)}</tbody>
            </table>
          </>
        )}
      </div>
    </div>
  );
}
