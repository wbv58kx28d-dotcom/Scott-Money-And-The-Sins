// Unit tests for region walking: the walk grid and pathfinding (no browser).
// Run: npm test

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { WalkGrid } from '../src/systems/walkGrid.js';
import { MAPS } from '../src/data/maps/index.js';
import { REGIONS } from '../src/data/regions.js';
import { ENEMIES } from '../src/data/enemies/index.js';

// A 20×20 grid (10 px cells) with a wall across the middle and a gap on the right.
const walled = () => new WalkGrid(20, 20, 10, (c, r) => !(r === 10 && c < 16));

test('a straight shot with nothing in the way is one waypoint', () => {
  const grid = walled();
  const path = grid.findPath({ x: 25, y: 25 }, { x: 175, y: 45 });
  assert.deepEqual(path, [{ x: 175, y: 45 }]);
});

test('paths go around walls, through the gap, and never cross a closed cell', () => {
  const grid = walled();
  const from = { x: 25, y: 25 };
  const path = grid.findPath(from, { x: 25, y: 175 });
  assert.ok(path && path.length >= 2, 'needs at least one turn');
  assert.ok(path.some((p) => p.x >= 160), 'goes through the gap on the right');
  let prev = from;
  for (const p of path) {
    assert.ok(grid.clearLine(prev, p), `segment ${JSON.stringify(prev)} -> ${JSON.stringify(p)} crosses a wall`);
    prev = p;
  }
  assert.deepEqual(path[path.length - 1], { x: 25, y: 175 });
});

test('a tap on a wall walks to the nearest open spot instead', () => {
  const grid = walled();
  const path = grid.findPath({ x: 25, y: 25 }, { x: 55, y: 105 });
  const end = path[path.length - 1];
  assert.ok(grid.walkableAt(end.x, end.y));
  assert.ok(Math.abs(end.y - 105) <= 10);
});

test('no way through returns null', () => {
  const grid = new WalkGrid(20, 20, 10, (c, r) => r !== 10);
  assert.equal(grid.findPath({ x: 25, y: 25 }, { x: 25, y: 175 }), null);
});

test('erode keeps feet off walls; block closes a footprint', () => {
  const grid = walled().erode(1);
  assert.equal(grid.isOpen(5, 9), false);
  assert.equal(grid.isOpen(5, 8), true);
  assert.equal(grid.isOpen(0, 0), false, 'the outside counts as a wall');
  grid.block({ x: 100, y: 40, w: 20, h: 20 });
  assert.equal(grid.isOpen(11, 5), false);
});

test('every region map is wired up: its region exists, its villain exists, points sit inside it', () => {
  for (const [id, map] of Object.entries(MAPS)) {
    assert.equal(map.id, id);
    assert.ok(REGIONS.some((r) => r.id === id), `${id} is a region`);
    const inside = ({ x, y }) => x >= 0 && y >= 0 && x <= map.size.w && y <= map.size.h;
    assert.ok(inside(map.spawn), `${id} spawn`);
    assert.ok(map.exits.length > 0, `${id} needs a way out`);
    for (const n of map.npcs) {
      assert.ok(inside(n), `${id}/${n.id} position`);
      if (n.fight) assert.ok(ENEMIES[n.fight], `${id}/${n.id} fights a known enemy`);
      assert.ok(n.talk?.length, `${id}/${n.id} has lines`);
    }
    for (const p of map.props) assert.ok(inside(p), `${id} prop ${p.texture}`);
  }
});
