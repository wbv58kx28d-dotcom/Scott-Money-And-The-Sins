// Walkable maps. A region's own map has the region's id (src/data/regions.js);
// a region without one skips straight from the overworld to its fight. Other
// maps are rooms behind a door in a region (Derek's basement): their content
// names the region, and an exit whose `to` is a map id leads there.
//
// Each map is a layout (where things are, written by the map editor) joined
// with its content (who's there and what they say), CLAUDE.md §6.11.

import { mergeMap } from '../../systems/mapfile.js';
import startLayout from './start.layout.js';
import start from './start.js';
import startLairLayout from './start_lair.layout.js';
import startLair from './start_lair.js';
import startOfficeLayout from './start_office.layout.js';
import startOffice from './start_office.js';
import islesSkyLayout from './isles_sky.layout.js';
import islesSky from './isles_sky.js';

export const LAYOUTS = { start: startLayout, start_lair: startLairLayout, start_office: startOfficeLayout, isles_sky: islesSkyLayout };
export const CONTENT = { start, start_lair: startLair, start_office: startOffice, isles_sky: islesSky };

export const MAPS = Object.fromEntries(Object.keys(LAYOUTS).map((id) => [id, mergeMap(LAYOUTS[id], CONTENT[id])]));
