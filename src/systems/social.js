// $cott's social app, the pure parts (CLAUDE.md §6.10): which posts are in
// the feed, the drafts and trends a post is written from, the "followers
// online" curve the post is timed against, and what a post earns. No
// Phaser, so it's unit-tested in tools/social.test.mjs.

import { SOCIAL, TRENDS, DRAFTS, CLASSICS, FEED } from '../data/social.js';

/** Does a feed post's `when` hold? state: { cleared, won, met, gates: Sets, clout: number }. */
export function isVisible(post, state) {
  const w = post.when;
  if (!w) return true;
  if (w.cleared && !state.cleared.has(w.cleared)) return false;
  if (w.won && !state.won.has(w.won)) return false;
  if (w.met && !state.met.has(w.met)) return false;
  if (w.gate && !state.gates.has(w.gate)) return false;
  if (w.clout && state.clout < w.clout) return false;
  return true;
}

/** The NPC posts that are out now, in data (story) order. */
export function visibleFeed(state, feed = FEED) {
  return feed.filter((p) => isVisible(p, state));
}

function shuffled(r, list) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = r.int(0, i);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** `n` distinct trending hashtags. */
export function pickTrending(r, n = SOCIAL.trending, trends = TRENDS) {
  return shuffled(r, trends).slice(0, n);
}

/**
 * The drafts offered for one post: an unposted classic first (if any are
 * unlocked), then everyday drafts, at least one of them on a trending tag.
 * `classics` is the list of unlocked, unposted classic ids; `exclude`, draft ids to skip.
 */
export function offerDrafts(r, { trending, classics = [], exclude = [], n = SOCIAL.drafts, drafts = DRAFTS }) {
  const out = [];
  const classic = CLASSICS.find((c) => classics.includes(c.id));
  if (classic) out.push({ ...classic, classic: true });
  // Leave out `exclude` (recently posted), unless that leaves too few.
  const fresh = drafts.filter((d) => !exclude.includes(d.id));
  const pool = shuffled(r, fresh.length >= n * 2 ? fresh : drafts);
  const onTrend = pool.find((d) => trending.includes(d.tag));
  if (onTrend && out.length < n) out.push(onTrend);
  for (const d of pool) {
    if (out.length >= n) break;
    if (!out.includes(d)) out.push(d);
  }
  return [...out.filter((d) => d.classic), ...shuffled(r, out.filter((d) => !d.classic))];
}

/** A day's "followers online" curve: one prime-time peak and a smaller bump elsewhere. */
export function activityCurve(r) {
  const peak = r.range(0.2, 0.8);
  let bump = r.range(0.08, 0.92);
  if (Math.abs(bump - peak) < 0.3) bump = peak < 0.5 ? Math.min(0.92, peak + r.range(0.3, 0.45)) : Math.max(0.08, peak - r.range(0.3, 0.45));
  return { peak, width: r.range(0.085, 0.11), bump, bumpH: r.range(0.4, 0.6), bumpW: r.range(0.06, 0.1), floor: 0.08 };
}

/** Share of the peak online at time `x` (0..1 across the day). The peak is exactly 1. */
export function activityAt(c, x) {
  const g = (mu, w) => Math.exp(-(((x - mu) / w) ** 2) / 2);
  return Math.max(c.floor, g(c.peak, c.width), c.bumpH * g(c.bump, c.bumpW));
}

/** The timing rating for a share of the peak. */
export function ratingFor(value, ratings = SOCIAL.timing.ratings) {
  return ratings.find((rt) => value >= rt.min - 1e-9) ?? ratings[ratings.length - 1];
}

/** What a post earns: { gain, mult, onTrend, rating, grade }. */
export function scorePost(draft, trending, ratingId, cfg = SOCIAL) {
  const rating = cfg.timing.ratings.find((rt) => rt.id === ratingId) ?? cfg.timing.ratings.at(-1);
  const onTrend = !draft.classic && trending.includes(draft.tag);
  const reach = draft.classic ? cfg.classicMult : onTrend ? cfg.trendMult : 1;
  const mult = reach * rating.mult;
  const gain = Math.max(1, Math.round(draft.base * mult));
  const grade = cfg.grades.find((g) => mult >= g.mult - 1e-9) ?? cfg.grades.at(-1);
  return { gain, mult, onTrend, rating, grade };
}

/** Likes, reposts and replies to show for a post that earned `gain` Clout. */
export function engagement(gain, r) {
  const likes = Math.round(gain * r.range(18, 30));
  return { likes, reposts: Math.round(likes * r.range(0.12, 0.25)), replies: Math.round(likes * r.range(0.03, 0.08)) };
}

/** 950, 1.2K, 34K, 1.5M */
export function formatCount(n) {
  if (n < 1000) return String(Math.round(n));
  if (n < 10000) return `${(Math.floor(n / 100) / 10).toFixed(1).replace(/\.0$/, '')}K`;
  if (n < 1e6) return `${Math.floor(n / 1000)}K`;
  return `${(Math.floor(n / 1e5) / 10).toFixed(1).replace(/\.0$/, '')}M`;
}

/** 1,250 */
export const formatClout = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/**
 * One of $cott's "big moment" posts (a first clear, a great trade): it posts
 * itself, with `likes` and the reposts and replies that go with them.
 */
export const momentPost = (text, gain, likes, { tag = null, reactions = [] } = {}) => ({
  text, tag, gain, label: 'BIG MOMENT', likes, reposts: Math.round(likes * 0.2), replies: Math.round(likes * 0.05), reactions,
});

/** Fill {key} placeholders. */
export const fillIn = (text, vars) => text.replace(/\{(\w+)\}/g, (m, k) => (vars[k] ?? m));
