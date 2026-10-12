// Pixel maps for procedural placeholder sprites. Each character is one sprite
// pixel; '.' is transparent. Everyone faces LEFT (CLAUDE.md §8.1).
// systems/placeholders.js bakes these at PLACEHOLDER_PX screen pixels per
// sprite pixel, with a 3 px outline, so they stand ~320 px tall.

export const PIXEL_SPRITES = {
  // Diamond Hands Derek fallback, used only if assets/sprites/enemies/derek.png
  // is missing: backwards cap, stubble, rocket hoodie, a glowing diamond.
  derek: {
    palette: {
      C: '#c8313a', c: '#8e1f2a', // cap
      H: '#5a3a22', // hair
      S: '#e3a983', s: '#b8795a', // skin
      K: '#1a1420', // eyes
      E: '#ff6b6b', // bloodshot from staring at charts
      B: '#8a6046', // stubble
      M: '#6e2626', // mouth
      D: '#2f6f63', d: '#1f4a43', // hoodie
      R: '#f39a2b', // rocket logo
      G: '#7fe7ff', g: '#2ab0e0', W: '#ffffff', // diamond
      P: '#55586a', p: '#3c3e4c', // sweatpants
      F: '#e8e8ee', f: '#a8a8b8', // sneakers
    },
    rows: [
      '.......CCCCCC.......',
      '......CCCCCCCC......',
      '.....CCCCCCCCCCcc...',
      '.....CCCCCCCCCCccc..',
      '.....HHSSSSSSHHH....',
      '....SSSSSSSSSSHH....',
      '....SKESSSKESSsH....',
      '...SSSSSSSSSSSsH....',
      '....SSSSSSSSSss.....',
      '....BBMMMMBBBBs.....',
      '.....BBBBBBBBB......',
      '.......sSSSs........',
      '.....DDDDDDDDDD.....',
      '....DDDDDDDDDDDDd...',
      '..WGg.DDRRDDDDDDd...',
      '.GGGGgSRRRRDDDDDdd..',
      'GGWGGGSDRRDDDDDDdd..',
      '.gGGGgSDDDDDDDDDdd..',
      '..gGg.DDDDDDDDDDd...',
      '...g..DDDDDDDDDDd...',
      '.....dDDDDDDDDDdd...',
      '.....PPPPPPPPPPp....',
      '.....PPPPP.PPPPp....',
      '.....PPPPp.PPPPp....',
      '.....PPPPp.PPPPp....',
      '.....PPPPp.PPPPp....',
      '.....pPPPp.pPPPp....',
      '...FFFFFf.FFFFFf....',
      '...fffff..fffff.....',
    ],
  },

  // $cott Money fallback, used only while assets/sprites/crew/scott.png is
  // missing: slicked hair, shades, puffer vest over a crisp shirt, gold chain.
  scott: {
    palette: {
      H: '#1d1b26', h: '#3a3550', // slicked hair + shine
      S: '#e8b48f', s: '#c08a68', // skin
      K: '#0d0b14', c: '#9fdcff', // shades + glint
      M: '#8a3b3b', // smug mouth
      V: '#27304f', v: '#1a2038', // vest
      w: '#dce8ff', // shirt
      Y: '#ffcc33', // gold chain
      T: '#b49a6e', t: '#8c7650', // chinos
      L: '#5a3a22', l: '#3c2716', // loafers
    },
    rows: [
      '......hHHHHH........',
      '.....HhhHHHHHH......',
      '....HHHHHHHHHHHH....',
      '....HHHHHHHHHHHHh...',
      '....HSSSSSSSHHHH....',
      '...SSSSSSSSSSHHH....',
      '...KKKKKKKKKSSH.....',
      '...KcKKKKcKKSs......',
      '..SSSSSSSSSSs.......',
      '...SSMMMMSSSs.......',
      '....SSSSSSSs........',
      '......sSSs..........',
      '....VVwYYwVVVV......',
      '...VVVwwYwwVVVV.....',
      '..VVVVwwwwwVVVVv....',
      '..VVVVwwwwwVVVVv....',
      '..SVVVwwwwwVVVVv....',
      '..SVVVwwwwwVVVVvS...',
      '...VVVwwwwwVVVVvS...',
      '...VVVwwwwwVVVVv....',
      '....wwwwwwwwwww.....',
      '....TTTTTTTTTTt.....',
      '....TTTTT.TTTTt.....',
      '....TTTTt.TTTTt.....',
      '....TTTTt.TTTTt.....',
      '....TTTTt.TTTTt.....',
      '....tTTTt.tTTTt.....',
      '..LLLLLl.LLLLLl.....',
      '..lllll..lllll......',
    ],
  },
};

// Field (walking) placeholders for region maps (CLAUDE.md §6.6, §8.4): one
// 16×24 body template in three views, recolored per character. Walking swaps
// the leg rows. Down and up share legs; left-facing has its own; right is
// the left view mirrored. systems/fieldArt.js lays them out like a real
// sprite sheet, so finished art can drop in under the same key.
const FIELD_BODY = {
  down: [
    '......HHHH......',
    '....HHHHHHHH....',
    '...HHhHHHHHHH...',
    '...HHSSSSSSHH...',
    '...HSSSSSSSSH...',
    '...SKKKSSKKKS...',
    '...SKkKSSKkKS...',
    '...SSSSSSSSSS...',
    '....SBBBBBBS....',
    '.....BBMMBB.....',
    '......ssss......',
    '...RRRWWWWRRR...',
    '..RRRRWGGWRRRR..',
    '..RRRRWWWWRRRR..',
    '..RrRRWWWWRRrR..',
    '..SrRRRWWRRRrS..',
    '..S.RRRRRRRR.S..',
  ],
  up: [
    '......HHHH......',
    '....HHHHHHHH....',
    '...HHHHHHHHHH...',
    '...HHHHHHhHHH...',
    '...HHHHHHHHHH...',
    '...SHHHHHHHHS...',
    '...SHHHHHHHHS...',
    '....HHHHHHHH....',
    '.....HHHHHH.....',
    '......ssss......',
    '......ssss......',
    '...RRRRRRRRRR...',
    '..RRRRRRRRRRRR..',
    '..RRRRRRRRRRRR..',
    '..RrRRRrrRRRrR..',
    '..SrRRRrrRRRrS..',
    '..S.RRRRRRRR.S..',
  ],
  left: [
    '......HHHH......',
    '.....HHHHHHH....',
    '....HHHHHHHHH...',
    '....SSSSHHHHH...',
    '...SSSSSSHHHH...',
    '...KKKKSSSHHH...',
    '...KkKKSSSSH....',
    '..SSSSSSSSSs....',
    '...BBBBSSSSs....',
    '....BBBBSSs.....',
    '.......sss......',
    '.....WWRRRRR....',
    '....WWRRRRRRR...',
    '....WGRRRRRRR...',
    '....WWRRRRRRr...',
    '.....RRRSSRRr...',
    '.....RRRRRRR....',
  ],
};

const FRONT_LEGS = {
  stand: ['....PPPPPPPP....', '....PPPPPPPP....', '....PPP..PPP....', '....PPP..PPP....', '....PPp..PPp....', '...FFFF..FFFF...', '...ffff..ffff...'],
  stepA: ['....PPPPPPPP....', '....PPPPPPPP....', '....PPP..PPP....', '....PPp..PPP....', '...FFFF..PPp....', '...ffff..FFFF...', '.........ffff...'],
  stepB: ['....PPPPPPPP....', '....PPPPPPPP....', '....PPP..PPP....', '....PPP..PPp....', '....PPp..FFFF...', '...FFFF..ffff...', '...ffff.........'],
};
const SIDE_LEGS = {
  stand: ['.....PPPPPPP....', '.....PPPPPPP....', '......PPPPP.....', '......PPPPp.....', '......PPPPp.....', '....FFFFFf......', '....fffff.......'],
  stepA: ['.....PPPPPPP....', '.....PPPPPPp....', '....PPP..ppp....', '...PPP....ppp...', '...PP......pp...', '.FFFF......Fff..', '.ffff.......ff..'],
  stepB: ['.....PPPPPPP....', '.....pPPPPPP....', '....ppp..PPP....', '...ppp....PPP...', '...pp......PP...', '.Ffff......FFF..', '.ffff.......ff..'],
};

/** Rows for one view and pose: 'stand', 'stepA', or 'stepB'. */
export function fieldRows(view, pose) {
  const legs = view === 'left' ? SIDE_LEGS : FRONT_LEGS;
  return [...FIELD_BODY[view], ...legs[pose]];
}

// H hair (or cap), S/s skin, K/k eyes or shades, B beard, M mouth,
// R/r jacket, W shirt, G chain or logo, P/p pants, F/f shoes.
export const FIELD_PALETTES = {
  // Red blazer, white shirt, gold chain, shades, like his battle sprite.
  field_scott: {
    H: '#2a1d16', h: '#5a4030', S: '#e2a77f', s: '#b8775a', K: '#0e0c14', k: '#5b6c9a',
    B: '#3a2618', M: '#7a3a2a', R: '#a3202c', r: '#701520', W: '#efece6', G: '#ffd166',
    P: '#26222e', p: '#16131c', F: '#5a1a1a', f: '#320c0e',
  },
  // Red cap, bloodshot eyes, rocket hoodie, sweatpants, white sneakers.
  field_derek: {
    H: '#c8313a', h: '#8e1f2a', S: '#e3a983', s: '#b8795a', K: '#1a1420', k: '#ff6b6b',
    B: '#8a6046', M: '#6e2626', R: '#2f6f63', r: '#1f4a43', W: '#2f6f63', G: '#f39a2b',
    P: '#55586a', p: '#3c3e4c', F: '#e8e8ee', f: '#a8a8b8',
  },
};
