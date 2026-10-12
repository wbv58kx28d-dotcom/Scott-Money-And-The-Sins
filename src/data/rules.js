// Combat tuning that isn't tied to one character (CLAUDE.md §5).
// Changing a number here changes the game; ask before changing formulas.

// Beat-timing minigame (§5.4). `within` is the distance from the center of
// the bar as a fraction of the bar's width (0.08 = 8%).
export const TIMING = {
  sweepMs: 820, // one full sweep at speed 1.0; divided by the move's speed
  ignoreFirstMs: 150, // ignore taps this soon after the bar appears (HANDOFF quirk)
  maxSweeps: 8, // RECONSTRUCTED: if nobody taps, it resolves as a WACK
  ratings: [
    { id: 'PERFECT', within: 0.08, mult: 1.5, crowd: 25 },
    { id: 'FIRE', within: 0.2, mult: 1.25, crowd: 18 },
    { id: 'MID', within: 0.36, mult: 1.0, crowd: 10 },
    { id: 'WACK', within: Infinity, mult: 0.6, crowd: -5 },
  ],
};

// Crowd meter (§5.5). Hit bonuses for $cott's disses live in types.js HIT_KINDS.
export const CROWD = {
  max: 100, // Drop the Mic unlocks here
  enemyHit: -4,
  enemyCritHit: -10,
  // RECONSTRUCTED: once full, the meter stays at max until Drop the Mic is
  // used. Without this, the enemy's hit (which always comes before $cott's
  // next turn) knocks it back under 100 and the finisher can almost never fire.
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
