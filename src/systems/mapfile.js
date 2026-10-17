// A walkable region is two files (CLAUDE.md §6.11):
//   src/data/maps/<id>.layout.js  WHERE things are: the ground (a terrain grid,
//                                 systems/terrain.js), the spawn, exits, bridges,
//                                 props, and the spot of every NPC and velvet rope.
//                                 The map editor writes it (layoutToSource below).
//   src/data/maps/<id>.js         WHAT they are: names, lines, challenges, fights,
//                                 classic posts, gifts, rope prices. Keyed by id.
//                                 A map behind a door (an interior) also sets its
//                                 `region` and `name` here; an exit whose `to` is
//                                 another map's id is a door into it.
// mergeMap() joins them into the map object the Region scene plays. Pure, so
// the editor, the game, the map checks and the unit tests all share it.

/** The full map: layout positions with each NPC's and rope's content merged in by id. */
export function mergeMap(layout, content = {}) {
  const npcContent = content.npcs ?? {};
  const gateContent = content.gates ?? {};
  return {
    id: layout.id,
    // A region's own map has the region's id; another map in it (an interior
    // behind a door) names its region and its own title in its content file.
    region: content.region ?? layout.id,
    name: content.name,
    tileset: layout.tileset,
    layout,
    size: { w: layout.cols * layout.cell, h: (layout.terrain.length - 1) * layout.cell },
    spawn: layout.spawn,
    exits: layout.exits ?? [],
    bridges: layout.bridges ?? [],
    props: layout.props ?? [],
    npcs: (layout.npcs ?? []).map((n) => ({
      // An NPC placed in the editor before anyone wrote for them still talks.
      name: n.id.toUpperCase(),
      talk: [{ speaker: n.id.toUpperCase(), text: '"..."' }],
      ...npcContent[n.id],
      ...n,
    })),
    gates: (layout.gates ?? []).map((g) => ({
      name: g.id.toUpperCase(),
      clout: 100,
      deny: [{ text: 'The rope stays up. {clout}/{need} Clout.' }],
      allow: [{ text: 'The rope comes down.' }],
      open: [{ text: 'The rope is down.' }],
      ...gateContent[g.id],
      ...g,
    })),
  };
}

// Single quotes like the rest of the code, unless the string has one.
const quote = (v) => (v.includes("'") || v.includes('\\') ? JSON.stringify(v) : `'${v}'`);
const num = (v) => (Number.isInteger(v) ? String(v) : String(Math.round(v)));

/** One object on one line, keys in a fixed order, so diffs stay readable. */
function inline(obj, order) {
  const keys = [...order.filter((k) => k in obj), ...Object.keys(obj).filter((k) => !order.includes(k)).sort()];
  const parts = keys.filter((k) => obj[k] !== undefined && obj[k] !== null).map((k) => {
    const v = obj[k];
    if (typeof v === 'number') return `${k}: ${num(v)}`;
    if (typeof v === 'string') return `${k}: ${quote(v)}`;
    if (typeof v === 'object') return `${k}: ${inline(v, ['x', 'y', 'w', 'h'])}`;
    return `${k}: ${JSON.stringify(v)}`;
  });
  return `{ ${parts.join(', ')} }`;
}

const ORDER = {
  spawn: ['x', 'y', 'facing'],
  exits: ['to', 'x', 'y', 'w', 'h'],
  bridges: ['x', 'y', 'w', 'h'],
  props: ['texture', 'x', 'y', 'block', 'label'],
  npcs: ['id', 'sprite', 'x', 'y', 'facing'],
  gates: ['id', 'x', 'y', 'block', 'bouncer'],
};

/** A layout as the source of src/data/maps/<id>.layout.js. */
export function layoutToSource(layout) {
  const list = (name) => {
    const items = layout[name] ?? [];
    if (!items.length) return `  ${name}: [],`;
    return `  ${name}: [\n${items.map((o) => `    ${inline(o, ORDER[name])},`).join('\n')}\n  ],`;
  };
  return `// Region '${layout.id}': the layout (CLAUDE.md §6.11). Written by the map
// editor (index.html?debug=1&edit=${layout.id}); what the NPCs and ropes say and do
// is in ./${layout.id}.js. Terrain: one letter per cell corner (assets/regions/${layout.tileset}/tileset.json).

export default {
  id: '${layout.id}',
  tileset: '${layout.tileset}',
  cell: ${layout.cell},
  cols: ${layout.cols},
  spawn: ${inline(layout.spawn, ORDER.spawn)},
${list('exits')}
${list('bridges')}
${list('npcs')}
${list('gates')}
${list('props')}
  terrain: [
${layout.terrain.map((r) => `    '${r}',`).join('\n')}
  ],
};
`;
}

/** A deep copy of a layout (for undo snapshots and drafts). */
export const cloneLayout = (layout) => JSON.parse(JSON.stringify(layout));
