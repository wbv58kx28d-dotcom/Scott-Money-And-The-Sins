// Saved progress in localStorage (CLAUDE.md §6.5): cleared regions, recruited
// Sins and their levels, cleared side quests, and where $cott stands on the map.
//
// localStorage can be missing or throw (private browsing, blocked storage), so
// every access is guarded and the game falls back to an in-memory save.
// Debug presets (&cleared=, &sins=) also stay in memory and never overwrite a
// real save. &reset=1 wipes the stored save.

import { REGIONS } from '../data/regions.js';
import { DEBUG } from './debug.js';

const KEY = 'scottmoney.save';
const VERSION = 1;

const fresh = () => ({ v: VERSION, cleared: [], sins: {}, quests: [], at: 'start' });

function read() {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return data?.v === VERSION ? { ...fresh(), ...data } : null;
  } catch {
    return null;
  }
}

function write(data) {
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

class SaveGame {
  constructor() {
    if (DEBUG.reset) {
      try {
        globalThis.localStorage?.removeItem(KEY);
      } catch {
        // storage unavailable; nothing to wipe
      }
    }
    const preset = DEBUG.cleared !== null || DEBUG.sins !== null;
    this.persist = !preset;
    this.data = preset ? fresh() : read() ?? fresh();
    if (DEBUG.cleared) this.data.cleared = DEBUG.cleared.filter((id) => REGIONS.some((r) => r.id === id));
    if (DEBUG.sins) this.data.sins = { ...DEBUG.sins };
    if (DEBUG.cleared?.length) this.data.at = DEBUG.cleared.at(-1);
  }

  get cleared() {
    return new Set(this.data.cleared);
  }

  get at() {
    return this.data.at;
  }

  /** Clear a region, and recruit its Sin at level 1 if it has one. */
  clearRegion(regionId) {
    const region = REGIONS.find((r) => r.id === regionId);
    if (!region) return;
    if (!this.data.cleared.includes(regionId)) this.data.cleared.push(regionId);
    if (region.recruit && !this.data.sins[region.recruit]) this.data.sins[region.recruit] = 1;
    this.data.at = regionId;
    this.flush();
  }

  /** Remember where $cott's token stands on the map. */
  moveTo(regionId) {
    this.data.at = regionId;
    this.flush();
  }

  flush() {
    if (this.persist) write(this.data);
  }
}

export const Save = new SaveGame();
