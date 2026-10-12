// Diss types, their targets, and hit results (CLAUDE.md §5.2–5.3).

export const DISS_TYPES = {
  FLEX: { id: 'FLEX', color: '#ffd166', desc: 'Wealth, status, and things you bought.', targets: ['WEALTH', 'PHYSIQUE', 'STYLE', 'STATUS'] },
  ROAST: { id: 'ROAST', color: '#ff5c8a', desc: 'Personal attacks. Low blows welcome.', targets: ['LOOKS', 'INTELLECT', 'LIFESTYLE', 'FAMILY'] },
  WORDPLAY: { id: 'WORDPLAY', color: '#4cc9f0', desc: 'Punchlines, puns, and technical bars.', targets: ['NAME', 'CAREER', 'REP'] },
  HYPE: { id: 'HYPE', color: '#b388ff', desc: 'Mind games, buffs, and market manipulation.', targets: [] }, // self-buffs, no target
};

// One-line description of each target, shown in the target menu.
export const TARGET_INFO = {
  WEALTH: 'Money and assets',
  PHYSIQUE: 'Gains, or lack of',
  STYLE: 'The fit',
  STATUS: 'Clout and connects',
  LOOKS: 'Face, hair, vibes',
  INTELLECT: 'Brains, bad takes',
  LIFESTYLE: 'How they live',
  FAMILY: 'Mom jokes',
  NAME: 'Puns on the name',
  CAREER: 'The job (or none)',
  REP: 'Street cred',
};

// How a diss lands, given the defender's weaknesses, resistances, and soft
// spots. `mult` scales damage; `crowd` is the crowd-meter bonus on $cott's hits.
//   weak type + soft spot      → crit   (2× weak × 1.5 = 3× total)
//   resisted type + soft spot  → bypass (resistance ignored, 1×)
//   neutral type + soft spot   → nerve  (1.5×)
export const HIT_KINDS = {
  crit: { id: 'crit', mult: 3, crowd: 20 },
  bypass: { id: 'bypass', mult: 1, crowd: 12 },
  nerve: { id: 'nerve', mult: 1.5, crowd: 12 },
  weak: { id: 'weak', mult: 2, crowd: 10 },
  resisted: { id: 'resisted', mult: 0.5, crowd: -5 },
  normal: { id: 'normal', mult: 1, crowd: 0 },
};
