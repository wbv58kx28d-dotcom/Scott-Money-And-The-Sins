// Images the Preload scene tries to load. Every entry is optional: if the
// file is missing (or `path` is null), the named procedural placeholder is
// generated under the same texture key, so the game runs before the art lands.
//
// When finished art arrives, drop it in assets/ and set its `path` here.
//
// The seven Sin sprites (lilturnt, babarbara, susan, toking, keezus, louis,
// sixpac) are already in assets/sprites/crew/. They get listed here when
// summon cut-ins and parley portraits are built (HANDOFF.md Phase 3), so phones
// don't download them before the game uses them. Likewise the villains with
// art but no battle yet (vince, max, fulfiller in assets/sprites/enemies/).
//
// Facing: crew sprites face left; villain sprites face right, toward $cott.

export const IMAGES = [
  { key: 'scott', path: 'assets/sprites/crew/scott.png', placeholder: 'scott' },
  { key: 'derek', path: 'assets/sprites/enemies/derek.png', placeholder: 'derek' },
  { key: 'bg_tokyo', path: 'assets/bg/bg_tokyo.webp', placeholder: 'bgCity' },
];
