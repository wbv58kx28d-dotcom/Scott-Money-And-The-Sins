// Saved progress in localStorage (CLAUDE.md §6.5): cleared regions, recruited
// Sins and their levels, cleared side quests, where $cott stands on the map,
// won region challenges, the villain intel they revealed (systems/intel.js),
// and the phone's economy: cash, the phone model, the item stash, and how many
// Stonks trades are left before the next fight (data/phone.js).
//
// localStorage can be missing or throw (private browsing, blocked storage), so
// every access is guarded and the game falls back to an in-memory save.
// Debug presets (&cleared=, &sins=) also stay in memory and never overwrite a
// real save. &reset=1 wipes the stored save.

import { REGIONS } from '../data/regions.js';
import { DEBUG } from './debug.js';
import { emptyIntel, mergeIntel } from './intel.js';
import { PHONES, ECONOMY } from '../data/phone.js';

const KEY = 'scottmoney.save';
const VERSION = 1;

// `won` holds challenge ids (`<region>:<npc>`); `intel` is { [enemy id]: { weak, resist, softSpots } }.
const fresh = () => ({
  v: VERSION, cleared: [], sins: {}, quests: [], at: 'start', won: [], intel: {},
  cash: ECONOMY.startCash, phone: 'flip', stash: {}, trades: ECONOMY.tradesPerFight,
});

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
    const preset = DEBUG.cleared !== null || DEBUG.sins !== null || DEBUG.cash !== null || DEBUG.phone !== null;
    this.persist = !preset;
    this.data = preset ? fresh() : read() ?? fresh();
    if (DEBUG.cleared) this.data.cleared = DEBUG.cleared.filter((id) => REGIONS.some((r) => r.id === id));
    if (DEBUG.sins) this.data.sins = { ...DEBUG.sins };
    if (DEBUG.cleared?.length) this.data.at = DEBUG.cleared.at(-1);
    if (DEBUG.cash !== null) this.data.cash = DEBUG.cash;
    if (PHONES[DEBUG.phone]) this.data.phone = DEBUG.phone;
  }

  // ---- Money, phone, stash ------------------------------------------------------

  get cash() {
    return this.data.cash;
  }

  earn(amount) {
    this.data.cash += Math.max(0, Math.round(amount));
    this.flush();
  }

  /** Pay if $cott can afford it. Returns whether he could. */
  spend(amount) {
    if (amount > this.data.cash) return false;
    this.data.cash -= amount;
    this.flush();
    return true;
  }

  get phone() {
    return this.data.phone;
  }

  setPhone(id) {
    if (!PHONES[id]) return;
    this.data.phone = id;
    this.flush();
  }

  /** Bought items waiting in the stash. */
  stash(itemId) {
    return this.data.stash[itemId] ?? 0;
  }

  addStash(itemId, n = 1) {
    this.data.stash[itemId] = this.stash(itemId) + n;
    this.flush();
  }

  /** Use one stashed item. Returns whether there was one. */
  useStash(itemId) {
    if (this.stash(itemId) <= 0) return false;
    this.data.stash[itemId] -= 1;
    this.flush();
    return true;
  }

  get trades() {
    return this.data.trades;
  }

  /** Spend one Stonks trade. Returns whether one was left. */
  useTrade() {
    if (this.data.trades <= 0) return false;
    this.data.trades -= 1;
    this.flush();
    return true;
  }

  /** After a fight the market reopens. */
  refillTrades() {
    this.data.trades = ECONOMY.tradesPerFight;
    this.flush();
  }

  /** Start over (Settings → RESET). Debug presets stay in memory as before. */
  reset() {
    this.data = fresh();
    this.flush();
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

  /** Has $cott already won this region challenge (`<region>:<npc>`)? */
  hasWon(id) {
    return this.data.won.includes(id);
  }

  /** What $cott has scouted about a villain. */
  intelFor(enemyId) {
    return this.data.intel[enemyId] ?? emptyIntel();
  }

  /** Win a challenge and keep what it revealed. */
  winChallenge(id, reveal) {
    if (!this.data.won.includes(id)) this.data.won.push(id);
    if (reveal?.enemy) this.data.intel[reveal.enemy] = mergeIntel(this.data.intel[reveal.enemy], reveal);
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
