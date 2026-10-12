// Combat tuning that isn't tied to one character (CLAUDE.md §5), matching
// legacy/scott-money-battle.html. Ask before changing formulas.

// Beat-timing minigame (§5.4). `within` is the distance from the center as a
// fraction of HALF the bar (0 = dead center, 1 = either end), so PERFECT is
// the middle 8% of each half. sfx names are in systems/audio.js.
export const TIMING = {
  sweepMs: 820, // one end-to-end sweep at speed 1.0; divided by the move's speed
  ignoreFirstMs: 150, // ignore taps this soon after the bar appears (HANDOFF quirk)
  resultMs: 750, // how long the rating shows before the bars
  ratings: [
    { id: 'PERFECT', label: 'PERFECT!', within: 0.08, mult: 1.5, crowd: 25, color: '#ffd166', sfx: 'good' },
    { id: 'FIRE', label: 'FIRE!', within: 0.2, mult: 1.25, crowd: 18, color: '#ff8c42', sfx: 'good' },
    { id: 'MID', label: 'MID', within: 0.36, mult: 1.0, crowd: 10, color: '#cfc3ef', sfx: 'ok' },
    { id: 'WACK', label: 'WACK...', within: Infinity, mult: 0.6, crowd: -5, color: '#8a80a8', sfx: 'bad' },
  ],
};

// Crowd meter (§5.5). Hit bonuses for $cott's disses live in types.js HIT_KINDS.
export const CROWD = {
  max: 100, // Drop the Mic unlocks here
  enemyHit: -4,
  enemyCritHit: -10,
  mooning: 8, // Mooning hypes the crowd a little
  bigHitJump: 18, // the crowd silhouettes jump on a FIRE or better
  // Once full, the meter stays at max until Drop the Mic is used. The legacy
  // prototype didn't do this, and there the enemy's hit (which always lands
  // before $cott's next turn) knocked it back under 100, so the finisher could
  // never fire. Set to false for the prototype's behavior.
  lockWhenFull: true,
};

// Damage (§5.6). Final damage rounds to a whole number, minimum 1.
export const DAMAGE = {
  scottVariance: [0.9, 1.1],
  enemyVariance: [0.85, 1.15],
  min: 1,
};

// Flow (§5.1): regained at the start of each of $cott's turns after the first.
export const FLOW = {
  regenPerTurn: 5,
};
