// Every villain, by id. Adding a villain = add a file in this folder and
// list it here.

import derek from './derek.js';

export const ENEMIES = {
  [derek.id]: derek,
};

export const DEFAULT_ENEMY = derek.id;
