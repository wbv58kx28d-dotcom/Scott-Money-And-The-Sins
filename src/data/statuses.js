// Status effects (CLAUDE.md §5.7).
//
// `turns` is how many of the holder's upcoming rounds the status lasts.
// RECONSTRUCTED: statuses tick down at the end of each round, but not at the
// end of the round they were applied in, so "2 turns" of Rug Pulled drains
// $cott twice and Mooning boosts his next 3 attacks.
// `turns: null` means it lasts for the rest of the fight.
//
// dealMult / takeMult multiply damage the holder deals / takes.
// applyMsg / endMsg are shown in battle; {name} is the holder's name.

export const STATUSES = {
  mooning: {
    id: 'mooning',
    name: 'Mooning',
    tag: 'MOONING',
    color: '#f472b6',
    turns: 3,
    dealMult: 1.5,
    takeMult: 1.25,
    applyMsg: '{name} is MOONING. Deals 1.5× damage... and takes 1.25×.',
    endMsg: '{name} comes back down to earth. Mooning wore off.',
  },
  rugPulled: {
    id: 'rugPulled',
    name: 'Rug Pulled',
    tag: 'RUG PULLED',
    color: '#ff6b6b',
    turns: 2,
    flowDrain: 8, // lost at the start of each of the holder's turns
    blocksRegen: true,
    applyMsg: 'RUG PULLED! {name} bleeds 8 Flow a turn, no regen.',
    drainMsg: 'The rug is still pulled. {name} loses {n} Flow.',
    endMsg: '{name} finds a new rug. Flow regen is back.',
  },
  shortSqueezed: {
    id: 'shortSqueezed',
    name: 'Short Squeezed',
    tag: 'SHORT SQUEEZED',
    color: '#ff8c42',
    turns: null,
    dealMult: 1.3,
    applyMsg: '{name} is SHORT SQUEEZED! Deals 1.3× damage for the rest of the fight.',
  },
  // Not built yet: Ratio'd, Cancelled.
};
