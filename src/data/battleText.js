// Battle text shared by every fight: hit reactions and the cheat sheet.
// Placeholders: {enemy} short name, {target}, {targetLower}, {type}, {why}
// (the soft spot's message). Arrays are picked from at random.

export const HIT_TEXT = {
  // When $cott's diss lands on a villain.
  onEnemy: {
    crit: 'CRITICAL! Soft spot found: {target}.\n{why}',
    bypass: "Crack in the armor: {target}!\nHis {type} resistance doesn't matter here.\n{why}",
    nerve: 'Hit a nerve: {target}!\n{why}',
    weak: ["IT'S A BODY BAG!\nSuper effective.", 'OHHHH! The crowd felt that one.\nSuper effective.'],
    resisted: 'Weak bars.\nNot very effective.', // unless the villain has its own resistMsg
  },
  // When a villain's diss lands on $cott.
  onScott: {
    crit: 'CRITICAL! {enemy} went for the {targetLower}.\n{why}',
    bypass: "{enemy} found a crack in the armor: {target}!\n$cott's {type} resistance doesn't matter here.\n{why}",
    nerve: 'That hit a nerve.\n{why}',
    weak: ['Right in the ego.\nSuper effective.', "That one's going in the group chat.\nSuper effective."],
    resisted: '$cott barely noticed.\nNot very effective.',
  },
};

// The "?" cheat sheet.
export const HOW_TO = {
  title: 'HOW TO DISS',
  body:
    'Clout is your health. Flow pays for bars. Pick a diss type, then a target, then tap as the marker crosses the gold zone.\n\n' +
    'Rivals are weak to some types (2x) and resist others (half). Each rival also has soft spots: targets that hurt more.\n' +
    '- Resisted type + soft spot: resistance ignored\n' +
    '- Neutral type + soft spot: 1.5x\n' +
    '- Weak type + soft spot: CRITICAL, 3x\n\n' +
    'Clean bars hype the crowd. Fill it to drop the mic.',
  close: 'Tap anywhere to close',
};
