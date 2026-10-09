import React, { useState } from 'react';
import { clock, SourceTag, KvLine, indicatorKind } from './bits.jsx';

const HIDE = new Set(['source']);

function body(raw) {
  const i = raw.indexOf(': ');
  return i > 0 ? raw.slice(i + 2) : raw;
}

function Row({ ev, ctx, fresh }) {
  const [open, setOpen] = useState(false);
  const pinned = ctx.pinned.has(ev.id);
  return (
    <>
      <tr className={`log-row${open ? ' is-open' : ''}${pinned ? ' is-pinned' : ''}${fresh ? ' is-fresh' : ''}`}>
        <td className="c-time">
          <button type="button" className="row-toggle" onClick={() => setOpen(!open)} aria-expanded={open} title={open ? 'Collapse' : 'Show parsed fields'}>
            <span className="caret" aria-hidden="true">{open ? '▾' : '▸'}</span>
            {clock(ev.ts)}
          </button>
        </td>
        <td className="c-src"><SourceTag source={ev.source} /></td>
        <td className="c-host">{ev.host}</td>
        <td className="c-raw" onClick={() => setOpen(!open)}><div className={open ? 'raw raw-full' : 'raw'}><KvLine text={body(ev.raw)} /></div></td>
        <td className="c-act">
          {ctx.canPin && (
            <button type="button" className={`btn btn-xs${pinned ? ' btn-on' : ''}`} onClick={() => ctx.onPin(ev, pinned)} title={pinned ? 'Remove from evidence' : 'Pin as evidence'}>
              {pinned ? 'Pinned' : 'Pin'}
            </button>
          )}
        </td>
      </tr>
      {open && (
        <tr className="log-detail">
          <td colSpan={5}>
            <div className="raw-line">{ev.raw}</div>
            <dl className="fields">
              {Object.entries(ev.fields).filter(([k]) => !HIDE.has(k)).map(([k, v]) => {
                const kind = indicatorKind(k, v);
                const val = String(v);
                const lookup = kind === 'domain' && val.includes('@') ? val.split('@')[1] : val;
                const enc = k === 'command_line' && / -(e|enc|encodedcommand) /i.test(val) ? val.split(/ -(?:e|enc|encodedcommand) /i)[1]?.split(' ')[0] : null;
                return (
                  <div className="field" key={k}>
                    <dt>{k}</dt>
                    <dd>
                      <span className="fv">{val}</span>
                      <span className="field-actions">
                        <button type="button" className="link" onClick={() => ctx.onFilter(k, val, false)}>Filter</button>
                        <button type="button" className="link" onClick={() => ctx.onFilter(k, val, true)}>Exclude</button>
                        {kind && ctx.onLookup && <button type="button" className="link" onClick={() => ctx.onLookup('reputation', lookup)}>Look up</button>}
                        {kind && ctx.onIoc && <button type="button" className="link" onClick={() => ctx.onIoc(lookup)}>Add indicator</button>}
                        {enc && ctx.onLookup && <button type="button" className="link" onClick={() => ctx.onLookup('decode', enc)}>Decode</button>}
                      </span>
                    </dd>
                  </div>
                );
              })}
            </dl>
            <div className="detail-actions">
              <button type="button" className="link" onClick={() => ctx.onContext(ev)}>Show this host ±2 minutes</button>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export default function LogTable({ events, ctx, freshAfter }) {
  return (
    <table className="logs">
      <thead>
        <tr>
          <th className="c-time">Time (UTC)</th>
          <th className="c-src">Source</th>
          <th className="c-host">Host</th>
          <th>Event</th>
          <th className="c-act"><span className="sr">Actions</span></th>
        </tr>
      </thead>
      <tbody>
        {events.map((ev) => <Row key={ev.id} ev={ev} ctx={ctx} fresh={freshAfter !== undefined && ev.ts > freshAfter} />)}
      </tbody>
    </table>
  );
}
