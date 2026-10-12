// Status effects (CLAUDE.md §5.7), matching the legacy prototype.
//
// `turns` counts down at the time named by `countdown`:
//   'roundEnd'  — at the end of every round, including the one it was applied
//                 in. Mooning used in round 1 boosts $cott's attacks in rounds
//                 2 and 3 and wears off at the end of round 3.
//   'onDrain'   — each time it drains Flow at the start of the holder's turn.
//                 Rug Pulled drains twice, then it's gone.
// `turns: null` lasts for the rest of the fight.
//
// dealMult / takeMult multiply damage the holder deals / takes. `tint` colors
// the holder's sprite while active. Messages use {name} for the holder.

export const STATUSES = {
  mooning: {
    id: 'mooning',
    name: 'Mooning',
    tag: 'MOONING',
    color: '#ff9de0',
    tint: 0xfff0a0,
    turns: 3,
    countdown: 'roundEnd',
    dealMult: 1.5,
    takeMult: 1.25,
    applyMsg: "$cott is MOONING! His damage is way up, but he's wide open. (3 turns)",
    endMsg: '$cott comes back down to Earth.\nMOONING wore off.',
  },
  rugPulled: {
    id: 'rugPulled',
    name: 'Rug Pulled',
    tag: 'RUG PULLED',
    color: '#ff9de0',
    turns: 2,
    countdown: 'onDrain',
    flowDrain: 8, // lost at the start of each of the holder's turns, instead of regen
    applyMsg: "$cott got RUG PULLED!\nHe'll bleed Flow for the next 2 turns.",
    drainMsg: 'The rug is still pulled. $cott bleeds 8 Flow.',
    endMsg: "...He finds a new rug. It's fine.",
  },
  shortSqueezed: {
    id: 'shortSqueezed',
    name: 'Short Squeezed',
    tag: 'SHORT SQUEEZED',
    color: '#ff8c42',
    tint: 0xffa0a0,
    turns: null,
    dealMult: 1.3,
  },
  // Not built yet: Ratio'd, Cancelled.
};
