// Case persistence: one JSON file, written atomically. Cases survive a
// server restart; their log streams are regenerated from the stored seed.
// Swap this module for a database adapter when moving beyond one instance.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const FILE = process.env.SOC_SIM_DATA || path.join(here, '..', 'data', 'cases.json');

let db = { seq: 1000, cases: {} };
try {
  if (fs.existsSync(FILE)) db = JSON.parse(fs.readFileSync(FILE, 'utf8'));
} catch (err) {
  console.error(`Could not read ${FILE}: ${err.message}. Starting with an empty case store.`);
}

let timer = null;
function flush() {
  timer = null;
  try {
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    const tmp = `${FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(db));
    fs.renameSync(tmp, FILE);
  } catch (err) {
    console.error(`Could not write ${FILE}: ${err.message}`);
  }
}

export const store = {
  // Demo tickets draw from their own counter so they never consume or
  // reorder assessment ticket numbers.
  nextSeq(kind) {
    if (kind === 'demo') { db.demoSeq = (db.demoSeq || 0) + 1; return db.demoSeq; }
    db.seq += 1;
    return db.seq;
  },
  all() { return Object.values(db.cases); },
  get(id) { return db.cases[id]; },
  put(c) { db.cases[c.id] = c; this.save(); },
  remove(id) { delete db.cases[id]; this.save(); },
  save() { if (!timer) timer = setTimeout(flush, 250); },
  flushNow() { if (timer) clearTimeout(timer); flush(); },
};

process.on('SIGINT', () => { store.flushNow(); process.exit(0); });
process.on('SIGTERM', () => { store.flushNow(); process.exit(0); });
