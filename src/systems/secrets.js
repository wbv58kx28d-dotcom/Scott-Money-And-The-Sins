// Secrets in a region (CLAUDE.md §6.6): things hidden until $cott finds them,
// like Derek's cellar door, which only shows once he traces Derek's Wi-Fi with
// the WIFI app (data/phone.js). Pure, so the Region scene, the phone, the map
// checks and the unit tests share it.
//
// In a layout, a prop or exit with `secret: '<id>'` only exists once that
// secret is found; a prop with `cover: '<id>'` stands there until then (a tarp
// over the cellar). A map's content file says what each secret is
// (`secrets: { <id>: { ssid, app, found } }`). Where it is comes from the
// layout: the middle of everything tagged with it, so the editor can move it.

import { WIFI } from '../data/phone.js';

/** The save's id for a secret: `<region>:<secret>`. */
export const secretKey = (regionId, secret) => `${regionId}:${secret}`;

/** Is a prop or exit there right now? `found(secret)` says whether a secret's been found. */
export function present(item, found) {
  if (item.secret) return found(item.secret);
  if (item.cover) return !found(item.cover);
  return true;
}

/** Where each of a map's secrets is: { <id>: { x, y } }, the middle of its tagged props and exits. */
export function secretSpots(map) {
  const points = {};
  const add = (id, x, y) => (points[id] ??= []).push({ x, y });
  for (const p of map.props) for (const id of [p.secret, p.cover].filter(Boolean)) add(id, p.x, p.y);
  for (const e of map.exits) if (e.secret) add(e.secret, e.x + e.w / 2, e.y + e.h / 2);
  return Object.fromEntries(Object.entries(points).map(([id, list]) => [id, {
    x: Math.round(list.reduce((s, p) => s + p.x, 0) / list.length),
    y: Math.round(list.reduce((s, p) => s + p.y, 0) / list.length),
  }]));
}

/** Signal bars (0–4) at a distance in world px, and whether it's close enough to trace. */
export function signal(distance) {
  const bars = WIFI.bars.filter((d) => distance <= d).length;
  return { bars, trace: distance <= WIFI.traceRange };
}

const COMPASS = ['EAST', 'SOUTHEAST', 'SOUTH', 'SOUTHWEST', 'WEST', 'NORTHWEST', 'NORTH', 'NORTHEAST'];

/** Which way to walk from (x, y) toward a point, as one of 8 compass words (north is up the map). */
export function heading(from, to) {
  const angle = Math.atan2(to.y - from.y, to.x - from.x); // y grows down the map
  return COMPASS[((Math.round(angle / (Math.PI / 4)) % 8) + 8) % 8];
}
