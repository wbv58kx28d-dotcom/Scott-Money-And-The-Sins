// Saved progress in localStorage (CLAUDE.md §6.5): cleared regions, recruited
// Sins and their levels, cleared side quests, where $cott stands on the map,
// won region challenges, the villain intel they revealed (systems/intel.js),
// the phone's economy: cash, the phone model, the item stash, and how many
// Stonks trades are left before the next fight (data/phone.js), and the
// social app (data/social.js): Clout, posts left, the classic posts he's
// unlocked and posted, who he's met, his replies, his own posts, the order
// the feed's posts arrived in, the velvet ropes he's opened, and the big
// moments he's already bragged about; plus the phone apps people gave him
// (the WIFI app) and the secrets he's found with them (Derek's hidden cellar);
// and the Sin who walks behind him: the test toggle, and her jealousy (data/followers.js).
//
// localStorage can be missing or throw (private browsing, blocked storage), so
// every access is guarded and the game falls back to an in-memory save.
// Debug presets (&cleared=, &sins=) also stay in memory and never overwrite a
// real save. &reset=1 wipes the stored save.

import { REGIONS } from '../data/regions.js';
import { DEBUG } from './debug.js';
import { emptyIntel, mergeIntel } from './intel.js';
import { PHONES, ECONOMY } from '../data/phone.js';
import { SOCIAL } from '../data/social.js';
import { FOLLOWERS, MAX_JEALOUSY } from '../data/followers.js';

const KEY = 'scottmoney.save';
const VERSION = 1;

// `won` holds challenge ids (`<region>:<npc>`); `intel` is { [enemy id]: { weak, resist, softSpots } }.
const fresh = () => ({
  v: VERSION, cleared: [], sins: {}, quests: [], at: 'start', won: [], intel: {},
  cash: ECONOMY.startCash, phone: 'flip', stash: {}, trades: ECONOMY.tradesPerFight,
  clout: SOCIAL.startClout, posts: SOCIAL.postsPerFight, unlocked: [], posted: [], met: [], replied: {},
  seq: 0, feedSeq: {}, mine: [], gates: [], bragged: [],
  apps: [], found: [],
  tryFollow: false, jealousy: {},
});
const MINE_MAX = 40; // $cott's own posts kept in the feed

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
    const preset = DEBUG.cleared !== null || DEBUG.sins !== null || DEBUG.cash !== null || DEBUG.phone !== null || DEBUG.clout !== null
      || DEBUG.apps !== null || DEBUG.found !== null
      || DEBUG.edit !== null; // playtesting a map in the editor never touches the real save
    this.persist = !preset;
    this.data = preset ? fresh() : read() ?? fresh();
    if (DEBUG.cleared) this.data.cleared = DEBUG.cleared.filter((id) => REGIONS.some((r) => r.id === id));
    if (DEBUG.sins) this.data.sins = { ...DEBUG.sins };
    if (DEBUG.cleared?.length) this.data.at = DEBUG.cleared.at(-1);
    if (DEBUG.cash !== null) this.data.cash = DEBUG.cash;
    if (PHONES[DEBUG.phone]) this.data.phone = DEBUG.phone;
    if (DEBUG.clout !== null) this.data.clout = DEBUG.clout;
    if (DEBUG.apps) this.data.apps = [...DEBUG.apps];
    if (DEBUG.found) this.data.found = [...DEBUG.found];
  }

  // ---- Gifted apps and found secrets (the WIFI app, Derek's cellar) ----------------

  hasApp(id) {
    return this.data.apps.includes(id);
  }

  /** Install a gifted app. Returns whether it's new. */
  addApp(id) {
    if (this.hasApp(id)) return false;
    this.data.apps.push(id);
    this.flush();
    return true;
  }

  /** A secret (`<region>:<secret>`) is found once traced, or for good once its region is cleared. */
  isFound(id) {
    return this.data.found.includes(id) || this.data.cleared.includes(id.split(':')[0]);
  }

  /** Returns whether it's new. */
  find(id) {
    if (this.data.found.includes(id)) return false;
    this.data.found.push(id);
    this.flush();
    return true;
  }

  // ---- The follower (Pikachu style, data/followers.js) ------------------------------

  /** Who walks behind $cott: the first recruited Sin who can, or Lil' Turnt while the test toggle is on. */
  get follower() {
    if (this.data.tryFollow) return 'lilturnt';
    return Object.keys(FOLLOWERS).find((id) => this.data.sins[id]) ?? null;
  }

  /** Whether the test toggle can be used (she isn't recruited yet). */
  get followIsTrial() {
    return !this.data.sins.lilturnt;
  }

  setTryFollow(on) {
    this.data.tryFollow = !!on;
    this.flush();
  }

  jealousy(id) {
    return this.data.jealousy[id] ?? 0;
  }

  setJealousy(id, n) {
    this.data.jealousy[id] = Math.max(0, Math.min(MAX_JEALOUSY, n));
    this.flush();
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

  /** After a fight the market reopens and $cott gets his posts back. */
  refillTrades() {
    this.data.trades = ECONOMY.tradesPerFight;
    this.data.posts = SOCIAL.postsPerFight;
    this.flush();
  }

  // ---- The social app (data/social.js) ---------------------------------------

  get clout() {
    return this.data.clout;
  }

  /** Clout only ever goes up. Returns what was added. */
  addClout(amount) {
    const n = Math.max(0, Math.round(amount));
    this.data.clout += n;
    this.flush();
    return n;
  }

  get posts() {
    return this.data.posts;
  }

  /** Spend one post. Returns whether one was left. */
  usePost() {
    if (this.data.posts <= 0) return false;
    this.data.posts -= 1;
    this.flush();
    return true;
  }

  /** Unlock a classic post. Returns whether it's new. */
  unlockClassic(id) {
    if (this.data.unlocked.includes(id)) return false;
    this.data.unlocked.push(id);
    this.flush();
    return true;
  }

  /** Unlocked classics not posted yet. */
  get classicsReady() {
    return this.data.unlocked.filter((id) => !this.data.posted.includes(id));
  }

  markPosted(classicId) {
    if (!this.data.posted.includes(classicId)) this.data.posted.push(classicId);
    this.flush();
  }

  /** $cott has talked to an NPC (`<region>:<npc>`). */
  meet(id) {
    if (this.data.met.includes(id)) return;
    this.data.met.push(id);
    this.flush();
  }

  /** { right, text } once he's replied to a feed post. */
  replyTo(postId) {
    return this.data.replied[postId];
  }

  reply(postId, right, text) {
    this.data.replied[postId] = { right, text };
    this.flush();
  }

  /** What the feed's `when` conditions check (systems/social.js isVisible). */
  get socialState() {
    const d = this.data;
    return { cleared: new Set(d.cleared), won: new Set(d.won), met: new Set(d.met), gates: new Set(d.gates), clout: d.clout };
  }

  /** How many of these visible feed post ids $cott hasn't seen yet. */
  unread(ids) {
    return ids.filter((id) => this.data.feedSeq[id] === undefined).length;
  }

  /** Mark visible feed posts seen, in order, so they keep their place in the timeline. */
  markSeen(ids) {
    let changed = false;
    for (const id of ids) {
      if (this.data.feedSeq[id] !== undefined) continue;
      this.data.feedSeq[id] = ++this.data.seq;
      changed = true;
    }
    if (changed) this.flush();
  }

  feedSeqOf(id) {
    return this.data.feedSeq[id] ?? 0;
  }

  /** $cott's own posts, oldest first: { text, tag, likes, reposts, replies, gain, seq, reactions }. */
  get mine() {
    return this.data.mine;
  }

  addMine(post) {
    this.data.mine.push({ ...post, seq: ++this.data.seq });
    if (this.data.mine.length > MINE_MAX) this.data.mine.splice(0, this.data.mine.length - MINE_MAX);
    this.flush();
  }

  /** Velvet ropes (`<region>:<gate>`): opened once, open for good. */
  gateOpen(id) {
    return this.data.gates.includes(id);
  }

  openGate(id) {
    if (!this.data.gates.includes(id)) this.data.gates.push(id);
    this.flush();
  }

  /** A big moment worth a post, once (`realty:tokyo:great`). Returns whether it's new. */
  brag(key) {
    if (this.data.bragged.includes(key)) return false;
    this.data.bragged.push(key);
    this.flush();
    return true;
  }

  /** Is there anything worth continuing? (The title screen offers CONTINUE / START FRESH.) */
  get hasProgress() {
    const d = this.data;
    const blank = fresh();
    return d.cleared.length > 0 || d.won.length > 0 || d.quests.length > 0 || Object.keys(d.sins).length > 0
      || Object.values(d.stash).some((n) => n > 0) || d.at !== blank.at || d.cash !== blank.cash
      || d.phone !== blank.phone || d.trades !== blank.trades
      || d.clout !== blank.clout || d.posts !== blank.posts || d.met.length > 0 || d.mine.length > 0
      || d.apps.length > 0 || d.found.length > 0;
  }

  /** Start over (Settings → RESET, or START FRESH on the title). Debug presets stay in memory as before. */
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
