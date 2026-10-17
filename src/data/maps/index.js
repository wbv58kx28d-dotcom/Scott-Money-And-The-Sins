// Walkable region maps, keyed by region id (src/data/regions.js). A region
// without a map here skips straight from the overworld to its fight.
//
// Each map is a layout (where things are, written by the map editor) joined
// with its content (who's there and what they say), CLAUDE.md §6.11.

import { mergeMap } from '../../systems/mapfile.js';
import startLayout from './start.layout.js';
import start from './start.js';

export const LAYOUTS = { start: startLayout };
export const CONTENT = { start };

export const MAPS = Object.fromEntries(Object.keys(LAYOUTS).map((id) => [id, mergeMap(LAYOUTS[id], CONTENT[id])]));
