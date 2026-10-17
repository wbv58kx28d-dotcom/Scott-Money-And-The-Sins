// $cott's social app, the pure parts (systems/social.js, CLAUDE.md §6.10).
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createRng } from '../src/systems/rng.js';
import { SOCIAL, TRENDS, DRAFTS, CLASSICS, FEED, ACCOUNTS } from '../src/data/social.js';
import {
  isVisible, visibleFeed, pickTrending, offerDrafts, activityCurve, activityAt, ratingFor, scorePost, formatCount, formatClout, fillIn,
} from '../src/systems/social.js';
import { MAPS } from '../src/data/maps/index.js';

const state = (o = {}) => ({
  cleared: new Set(o.cleared ?? []), won: new Set(o.won ?? []), met: new Set(o.met ?? []), gates: new Set(o.gates ?? []), clout: o.clout ?? 0,
});

test('feed posts show once every `when` condition holds', () => {
  assert.equal(isVisible({}, state()), true);
  const post = { when: { cleared: 'start', met: 'start:chad' } };
  assert.equal(isVisible(post, state({ cleared: ['start'] })), false);
  assert.equal(isVisible(post, state({ cleared: ['start'], met: ['start:chad'] })), true);
  assert.equal(isVisible({ when: { clout: 100 } }, state({ clout: 99 })), false);
  assert.equal(isVisible({ when: { gate: 'start:vip' } }, state({ gates: ['start:vip'] })), true);
  // A new game already has something to read, and more arrives with the story.
  const fresh = visibleFeed(state()).length;
  assert.ok(fresh >= 3);
  assert.ok(visibleFeed(state({ cleared: ['start'], won: ['start:brad'], met: ['start:chad', 'start:vinny'], gates: ['start:vip'] })).length > fresh + 4);
});

test('feed data is well formed: known accounts, unique ids, replies with a right answer', () => {
  const ids = new Set();
  for (const p of FEED) {
    assert.ok(ACCOUNTS[p.by], `${p.id}: unknown account ${p.by}`);
    assert.ok(!ids.has(p.id), `duplicate ${p.id}`);
    ids.add(p.id);
    if (p.reply) {
      assert.ok(p.reply.options.length >= 2 && p.reply.right && p.reply.wrong, p.id);
    }
  }
  for (const d of DRAFTS) assert.ok(TRENDS.includes(d.tag), d.id);
});

test('NPC unlocks and gates in the maps point at real classics and feed conditions', () => {
  const classics = new Set(CLASSICS.map((c) => c.id));
  for (const map of Object.values(MAPS)) {
    for (const n of map.npcs) if (n.unlocks) assert.ok(classics.has(n.unlocks), `${n.id} unlocks ${n.unlocks}`);
    for (const g of map.gates ?? []) {
      assert.ok(g.clout > 0, g.id);
      assert.ok(map.npcs.some((n) => n.id === g.bouncer), `${g.id}: bouncer ${g.bouncer}`);
    }
  }
});

test('drafts: a trending one is always offered, an unlocked classic comes first', () => {
  const r = createRng(5);
  for (let i = 0; i < 200; i++) {
    const trending = pickTrending(r);
    assert.equal(new Set(trending).size, SOCIAL.trending);
    const offered = offerDrafts(r, { trending });
    assert.equal(offered.length, SOCIAL.drafts);
    assert.equal(new Set(offered.map((d) => d.id)).size, offered.length);
    assert.ok(offered.some((d) => trending.includes(d.tag)));
  }
  // Recently posted drafts sit out.
  const exclude = DRAFTS.slice(0, 8).map((d) => d.id);
  for (let i = 0; i < 50; i++) assert.ok(offerDrafts(r, { trending: pickTrending(r), exclude }).every((d) => !exclude.includes(d.id)));
  const withClassic = offerDrafts(r, { trending: ['GYM'], classics: [CLASSICS[1].id] });
  assert.equal(withClassic[0].id, CLASSICS[1].id);
  assert.ok(withClassic[0].classic);
  assert.ok(withClassic.slice(1).some((d) => d.tag === 'GYM'));
});

test('the followers-online curve peaks at exactly 1, with a fair PERFECT window', () => {
  const r = createRng(9);
  for (let i = 0; i < 200; i++) {
    const c = activityCurve(r);
    assert.ok(Math.abs(activityAt(c, c.peak) - 1) < 1e-9);
    let perfect = 0;
    let max = 0;
    const N = 1000;
    for (let k = 0; k <= N; k++) {
      const v = activityAt(c, k / N);
      max = Math.max(max, v);
      if (ratingFor(v).id === 'PERFECT') perfect += 1;
    }
    assert.ok(max <= 1 + 1e-9);
    // PERFECT is a narrow but hittable slice of the day: 6–12% of a sweep.
    assert.ok(perfect / N > 0.06 && perfect / N < 0.12, `perfect share ${perfect / N}`);
    // The second bump never reaches FIRE, so it's a decoy, not a second peak.
    assert.ok(c.bumpH < SOCIAL.timing.ratings.find((rt) => rt.id === 'FIRE').min);
  }
});

test('post scores: trend and timing multiply, classics always reach far, a flop still earns a little', () => {
  const draft = DRAFTS.find((d) => d.tag === 'GYM');
  const viral = scorePost(draft, ['GYM'], 'PERFECT');
  assert.equal(viral.gain, draft.base * SOCIAL.trendMult * 2);
  assert.equal(viral.grade.id, 'legendary');
  assert.equal(scorePost(draft, ['AI'], 'MID').grade.id, 'pass');
  assert.equal(scorePost(draft, ['GYM'], 'MID').grade.id, 'great');
  const flop = scorePost(draft, ['AI'], 'WACK');
  assert.equal(flop.grade.id, 'fail');
  assert.ok(flop.gain >= 1);
  const classic = scorePost({ ...CLASSICS[0], classic: true }, ['AI'], 'FIRE');
  assert.equal(classic.gain, Math.round(CLASSICS[0].base * SOCIAL.classicMult * 1.5));
  assert.equal(classic.onTrend, false);
});

test('a first run can open the Swamps velvet rope before beating Derek', () => {
  // Three posts (on-trend, FIRE), every pre-fight reply right, and the classic Brad unlocks.
  const draft = { base: 45, tag: 'GYM' };
  const posts = 2 * scorePost(draft, ['GYM'], 'FIRE').gain + scorePost({ ...CLASSICS[0], classic: true }, [], 'FIRE').gain;
  const replies = visibleFeed(state({ met: ['start:chad', 'start:brad', 'start:morgan', 'start:vinny'], won: ['start:brad'] }))
    .filter((p) => p.reply).length * SOCIAL.reply.right;
  const gate = MAPS.start.gates.find((g) => g.id === 'vip');
  assert.ok(posts + replies >= gate.clout, `${posts} + ${replies} < ${gate.clout}`);
  // ...but not with three flops and no replies.
  assert.ok(3 * scorePost(draft, [], 'MID').gain < gate.clout);
});

test("a first run can afford the trading firm's rope, the way to Derek", () => {
  // Every pre-fight reply right, and two on-trend posts: the tower can't be a wall before the first fight.
  const draft = { base: 45, tag: 'GYM' };
  const posts = 2 * scorePost(draft, ['GYM'], 'FIRE').gain;
  const met = ['chad', 'brad', 'morgan', 'floyd', 'lola', 'bob', 'doorman'].map((id) => `start:${id}`);
  const replies = visibleFeed(state({ met, won: ['start:brad'] })).filter((p) => p.reply).length * SOCIAL.reply.right;
  const gate = MAPS.start.gates.find((g) => g.id === 'office');
  assert.ok(posts + replies >= gate.clout, `${posts} + ${replies} < ${gate.clout}`);
  assert.ok(gate.clout < MAPS.start.gates.find((g) => g.id === 'vip').clout, 'cheaper than the optional Yacht Club');
});

test('number formats', () => {
  assert.equal(formatCount(950), '950');
  assert.equal(formatCount(1250), '1.2K');
  assert.equal(formatCount(3000), '3K');
  assert.equal(formatCount(34567), '34K');
  assert.equal(formatCount(1520000), '1.5M');
  assert.equal(formatClout(1250), '1,250');
  assert.equal(fillIn('{a} and {b}', { a: 1 }), '1 and {b}');
});

test('the save: Clout only goes up, posts refill after a fight, classics post once, ropes stay open', async () => {
  const { Save } = await import('../src/systems/save.js');
  Save.reset();
  assert.equal(Save.clout, SOCIAL.startClout);
  assert.equal(Save.addClout(-50), 0);
  assert.equal(Save.addClout(120), 120);
  assert.equal(Save.clout, 120);
  for (let i = 0; i < SOCIAL.postsPerFight; i++) assert.ok(Save.usePost());
  assert.equal(Save.usePost(), false);
  Save.refillAfterFight();
  assert.equal(Save.posts, SOCIAL.postsPerFight);
  assert.ok(Save.unlockClassic('c_lambo'));
  assert.equal(Save.unlockClassic('c_lambo'), false);
  assert.deepEqual(Save.classicsReady, ['c_lambo']);
  Save.markPosted('c_lambo');
  assert.deepEqual(Save.classicsReady, []);
  // New feed posts count as unread until seen, then keep their order.
  const ids = visibleFeed(Save.socialState).map((p) => p.id);
  assert.equal(Save.unread(ids), ids.length);
  Save.markSeen(ids);
  assert.equal(Save.unread(ids), 0);
  assert.ok(Save.feedSeqOf(ids[1]) > Save.feedSeqOf(ids[0]));
  Save.meet('start:chad');
  assert.equal(Save.unread(visibleFeed(Save.socialState).map((p) => p.id)), 1, "Chad's post arrives after meeting him");
  Save.openGate('start:vip');
  assert.ok(Save.gateOpen('start:vip'));
  assert.ok(Save.brag('realty:tokyo:pass'));
  assert.equal(Save.brag('realty:tokyo:pass'), false);
  assert.equal(Save.hasProgress, true);
  Save.reset();
});
