// The seven Sins (CLAUDE.md §3, §6.1). Data only for now: summons, minigames,
// and levels are Phase 3 (HANDOFF.md). Targets and summon effects are the
// PROPOSED ones from the brief; cooldowns are still an open question.
//
// featureLines[target] is the Sin's feature verse for that target. It works
// against every villain; `{villain}` is replaced with the villain's name.

export const CREW = {
  lilturnt: {
    id: 'lilturnt',
    name: "Lil' Turnt",
    sin: 'Envy',
    tier: 1,
    texture: 'lilturnt',
    look: 'Orange tabby kitten, pearls, pink tutu, jealous side-eye',
    minigame: 'catquiz',
    summonTargets: [{ target: 'REP' }],
    summon: { effect: 'copyEnemyBuff', cooldown: null, summary: "Copies the enemy's last buff." },
    featureLines: {},
  },
  babarbara: {
    id: 'babarbara',
    name: 'Babarbara',
    sin: 'Wrath',
    tier: 1,
    texture: 'babarbara',
    look: 'Pink-red curly mohawk, black leather jumpsuit, scowl',
    minigame: 'ragemeter',
    summonTargets: [{ type: 'ROAST' }], // any ROAST target
    summon: { effect: 'ignoreResistRecoil', cooldown: null, summary: 'Ignores resistance, but $cott takes recoil.' },
    featureLines: {},
  },
  susan: {
    id: 'susan',
    name: 'Susan G. Kummin',
    sin: 'Lust',
    tier: 2,
    texture: 'susan',
    look: 'Long wavy red hair, red leather dress, sly smirk',
    minigame: 'rizzcheck',
    summonTargets: [{ target: 'LOOKS' }, { target: 'STYLE' }],
    summon: { effect: 'charmMisfire', cooldown: null, summary: "Charms the enemy so their next diss misfires." },
    featureLines: {},
  },
  toking: {
    id: 'toking',
    name: 'J.R.R Toking',
    sin: 'Sloth',
    tier: 2,
    texture: 'toking',
    look: 'Elderly wizard, huge white beard, velvet robe, long pipe',
    minigame: 'lorequiz',
    summonTargets: [{ target: 'INTELLECT' }],
    summon: { effect: 'slowAndSkip', cooldown: null, summary: 'Slows the timing marker; the enemy skips a turn.' },
    featureLines: {},
  },
  keezus: {
    id: 'keezus',
    name: 'Keezus',
    sin: 'Gluttony',
    tier: 3,
    texture: 'keezus',
    look: 'Beard, aviators, open white hoodie, maxed-out credit cards',
    minigame: 'cryptobet',
    summonTargets: [{ target: 'LIFESTYLE' }],
    summon: { effect: 'doubleOrNothing', cooldown: null, summary: 'Double or nothing.' },
    featureLines: {},
  },
  louis: {
    id: 'louis',
    name: 'Louis Change',
    sin: 'Greed',
    tier: 3,
    texture: 'louis',
    look: 'Frosted tips, hot pink brocade suit, fanning cash',
    minigame: 'haggle',
    summonTargets: [{ target: 'WEALTH' }],
    summon: { effect: 'stealFlow', cooldown: null, summary: 'Steals Flow from the enemy.' },
    featureLines: {},
  },
  sixpac: {
    id: 'sixpac',
    name: 'Six Pac',
    sin: 'Pride',
    tier: 4, // solo finale
    texture: 'sixpac',
    look: 'Shirtless, abs, admiring his own bicep',
    minigame: 'flexhold',
    summonTargets: [{ target: 'PHYSIQUE' }, { target: 'STATUS' }],
    summon: { effect: 'bigCritChance', cooldown: null, summary: 'Big crit chance.' },
    featureLines: {},
  },
};

/** True if this Sin can be summoned for a diss of `type` at `target`. */
export function canSummonFor(sin, type, target) {
  return sin.summonTargets.some(
    (rule) => (!rule.type || rule.type === type) && (!rule.target || rule.target === target),
  );
}
