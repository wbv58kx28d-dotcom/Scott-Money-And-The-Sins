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
