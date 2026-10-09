// Scenario registry. Adding a scenario = one module here; the engine,
// API and UI are scenario-agnostic.

import s01 from './s01-beacon.js';
import s02 from './s02-authfail.js';

const ALL = [s01, s02];
const byId = new Map(ALL.map((s) => [s.id, s]));

export const getScenario = (id) => byId.get(id);

// Catalogue entries are deliberately neutral: they describe the alert an
// analyst would see, not what is behind it.
export const listScenarios = () => ALL.map((s) => ({
  id: s.id,
  ...s.catalog,
  stages: s.stages.filter((x) => x.kind !== 'monitor').map((x) => x.label),
}));
