// Diss types, their targets, and hit results (CLAUDE.md §5.2–5.3).

export const DISS_TYPES = {
  FLEX: { id: 'FLEX', color: '#f4d35e', targets: ['WEALTH', 'PHYSIQUE', 'STYLE', 'STATUS'] },
  ROAST: { id: 'ROAST', color: '#ff6b6b', targets: ['LOOKS', 'INTELLECT', 'LIFESTYLE', 'FAMILY'] },
  WORDPLAY: { id: 'WORDPLAY', color: '#9fdcff', targets: ['NAME', 'CAREER', 'REP'] },
  HYPE: { id: 'HYPE', color: '#f472b6', targets: [] }, // self-buffs, no target
};

// How a diss lands, given the defender's weaknesses, resistances, and soft
// spots. `mult` scales damage; `crowd` is the crowd-meter bonus on $cott's hits.
//   weak type + soft spot      → crit   (3× total)
//   resisted type + soft spot  → bypass (resistance ignored, 1×)
//   neutral type + soft spot   → nerve  (1.5×)
export const HIT_KINDS = {
  crit: { id: 'crit', mult: 3, crowd: 20, label: 'CRITICAL!' },
  bypass: { id: 'bypass', mult: 1, crowd: 12, label: 'BYPASS!' },
  nerve: { id: 'nerve', mult: 1.5, crowd: 12, label: 'NERVE!' },
  weak: { id: 'weak', mult: 2, crowd: 10, label: 'WEAKNESS!' },
  resisted: { id: 'resisted', mult: 0.5, crowd: -5, label: 'RESISTED' },
  normal: { id: 'normal', mult: 1, crowd: 0, label: '' },
};
