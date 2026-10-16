// $cott's posting minigame, for his social app (CLAUDE.md §6.10). Two beats:
//   1. WRITE: pick one of three drafts. A draft on one of the trending
//      hashtags reaches twice as far; a classic (unlocked by talking to
//      people in the world) always does.
//   2. TIME IT: a day's "followers online" curve, with a marker sweeping back
//      and forth across it. Tap POST at prime time (the peak) for the most
//      reach; the second bump is a decoy.
// Then the post goes out and the likes roll in.
//
// Follows the minigame contract (CLAUDE.md §6.3): run() launches an overlay
// scene and resolves with { grade, score } when it's done; `score` is the
// Clout the post earned (also `gain`), plus `draft`, `rating`, `onTrend`,
// `engagement` and `reactions` for the feed. NOT NOW resolves with
// { grade: null, cancelled: true }. The caller saves the result (the social
// app does). `difficulty` speeds up the sweep. `context`: `trending` and
// `drafts` to use instead of random ones, `classics` (unlocked, unposted ids),
// `recent` (draft ids to leave out).
// Scoring is pure, in systems/social.js.

import { GAME_W, GAME_H, COLORS, LAYOUT } from '../config.js';
import { SOCIAL, REACTIONS, FANS } from '../data/social.js';
import {
  pickTrending, offerDrafts, activityCurve, activityAt, ratingFor, scorePost, engagement, formatCount, formatClout,
} from '../systems/social.js';
import { rng } from '../systems/rng.js';
import { DEBUG } from '../systems/debug.js';
import { Audio } from '../systems/audio.js';
import { Button } from '../ui/button.js';
import { drawCard, drawRibbonPanel, CARD_INSET, RIBBON_GOLD } from '../ui/ribbon.js';
import { label, body, fitWidth, fitWrapped } from '../ui/text.js';
import { avatar, preloadAvatars, verifiedBadge } from '../ui/avatar.js';
import { pixelIcon } from '../ui/phoneIcons.js';

const KEY = 'Post';
export const PINK = 0xff5fa2;
export const PINK_CSS = '#ff8ad8';
const GOLD_CSS = '#ffd166';
const RATING_COLORS = { PERFECT: 0xffd166, FIRE: 0x7cf29c, MID: 0xf5f1e8, WACK: 0x6a6280 };

const HEADER = { x: 16, y: 40, w: 688, h: 100 };
const TRENDING = { x: 16, y: 160, w: 688, h: 130 };
const DRAFT_TOP = 350;
const DRAFT = { h: 210, gap: 20 };
const PICKED = { x: 16, y: 160, w: 688, h: 190 };
const CHART = { x: 16, y: 370, w: 688, h: 560 };
const PLOT = { left: 56, right: 684, top: 470, bottom: 850 };
const RESULT = { x: 16, y: 160, w: 688 }; // as tall as the post needs
const COUNT_MS = 1300;

export default {
  id: 'post',
  sin: null, // $cott's own
  title: "$cott's Post",
  run(scene, { difficulty = 1, context = {} } = {}) {
    return new Promise((done) => scene.scene.launch(KEY, { parent: scene.scene.key, difficulty, context, done }));
  },
};

export class PostScene extends Phaser.Scene {
  constructor() {
    super(KEY);
  }

  init({ parent, difficulty = 1, context = {}, done }) {
    this.parentKey = parent;
    this.done = done;
    this.sweepMs = SOCIAL.timing.sweepMs / (difficulty * DEBUG.speed);
    this.trending = context.trending ?? pickTrending(rng);
    this.drafts = context.drafts ?? offerDrafts(rng, { trending: this.trending, classics: context.classics ?? [], exclude: context.recent ?? [] });
  }

  preload() {
    preloadAvatars(this);
  }

  create() {
    this.buttons = new Set();
    this.layer = [];
    this.phase = 'write'; // write | time | posted | result
    this.result = null;
    this.finished = false;
    this.counting = null;
    this.add.rectangle(0, 0, GAME_W, GAME_H, 0x0b0914, 1).setOrigin(0).setInteractive();
    this.buildHeader();
    drawRibbonPanel(this, LAYOUT.panel);
    this.onParentGone = () => this.scene.stop();
    this.scene.get(this.parentKey)?.events.once('shutdown', this.onParentGone);
    this.input.keyboard?.on('keydown-SPACE', () => this.phase === 'time' && this.post());
    this.write();
    this.cameras.main.fadeIn(160, 0, 0, 0);
  }

  buildHeader() {
    const h = HEADER;
    drawCard(this.add.graphics(), h, PINK);
    label(this, h.x + CARD_INSET, h.y + 20, 'Y', 40, { color: PINK_CSS });
    this.titleText = label(this, h.x + CARD_INSET + 64, h.y + 22, 'NEW POST', 22);
    this.subText = body(this, h.x + CARD_INSET + 64, h.y + 56, '', 28, { color: COLORS.textDim });
  }

  /** Clear the page (keeps the header and panel). */
  clear() {
    for (const o of this.layer) o.destroy();
    this.layer = [];
    for (const b of [...this.buttons]) b.destroy();
  }

  keep(...objs) {
    this.layer.push(...objs.flat());
    return objs[0];
  }

  // ---- 1. Write ----------------------------------------------------------------------

  write() {
    this.clear();
    this.phase = 'write';
    this.subText.setText('Pick a draft. Ride a trend.');
    const t = TRENDING;
    this.keep(drawCard(this.add.graphics(), t, PINK));
    this.keep(label(this, t.x + CARD_INSET, t.y + 18, 'TRENDING NOW', 16, { color: PINK_CSS }));
    let x = t.x + CARD_INSET;
    for (const tag of this.trending) x += this.chip(x, t.y + 62, `#${tag}`, PINK) + 14;

    this.keep(label(this, 24, DRAFT_TOP - 36, 'DRAFTS', 16, { color: COLORS.textDim }));
    this.draftRects = this.drafts.map((d, i) => {
      const r = { x: 16, y: DRAFT_TOP + i * (DRAFT.h + DRAFT.gap), w: 688, h: DRAFT.h };
      const accent = d.classic ? RIBBON_GOLD : 0x8a80a8;
      const g = this.keep(drawCard(this.add.graphics(), r, accent));
      this.chip(r.x + CARD_INSET, r.y + 16, d.classic ? 'CLASSIC $COTT' : `#${d.tag}`, d.classic ? RIBBON_GOLD : 0x4a3a7a);
      const text = this.keep(body(this, r.x + CARD_INSET, r.y + 64, '', 34));
      text.setText(fitWrapped(text, `"${d.text}"`, { maxWidth: r.w - CARD_INSET - 28, maxHeight: r.h - 80, maxSize: 34, minSize: 24 }));
      const zone = this.keep(this.add.zone(r.x, r.y, r.w, r.h).setOrigin(0).setInteractive());
      zone.on('pointerdown', () => g.setAlpha(0.75));
      zone.on('pointerout', () => g.setAlpha(1));
      zone.on('pointerup', () => {
        g.setAlpha(1);
        Audio.sfx('blip');
        this.pick(d);
      });
      return r;
    });
    const p = LAYOUT.panel;
    new Button(this, {
      x: p.x + p.w / 2, y: p.y + p.h / 2, w: p.w - 16, h: p.h - 40, size: 22, text: 'NOT NOW', sub: 'Save the post for later.',
      onPress: () => this.finish({ grade: null, cancelled: true }),
    });
  }

  /** A hashtag chip; returns its width. */
  chip(x, y, text, color) {
    const t = label(this, x + 12, y + 10, text, 16, { strokeThickness: 0 });
    const w = t.width + 24;
    const g = this.add.graphics().fillStyle(color, 1).fillRoundedRect(x, y, w, 36, 18);
    t.setDepth(1);
    this.keep(g, t);
    return w;
  }

  // ---- 2. Time it --------------------------------------------------------------------

  pick(draft) {
    if (this.phase !== 'write') return;
    this.clear();
    this.phase = 'time';
    this.draft = draft;
    this.curve = activityCurve(rng);
    this.sweep = 0; // 0..2: forward then back
    this.subText.setText('Post it when everyone is online.');

    const r = PICKED;
    this.keep(drawCard(this.add.graphics(), r, draft.classic ? RIBBON_GOLD : PINK));
    const text = this.keep(body(this, r.x + CARD_INSET, r.y + 18, '', 32));
    text.setText(fitWrapped(text, `"${draft.text}"`, { maxWidth: r.w - CARD_INSET - 28, maxHeight: r.h - 76, maxSize: 32, minSize: 22 }));
    const onTrend = !draft.classic && this.trending.includes(draft.tag);
    const reach = draft.classic ? `CLASSIC · REACH ×${SOCIAL.classicMult}` : onTrend ? `#${draft.tag} IS TRENDING · REACH ×${SOCIAL.trendMult}` : `#${draft.tag} · NOT TRENDING`;
    this.keep(label(this, r.x + CARD_INSET, r.y + r.h - 40, reach, 14, { color: draft.classic || onTrend ? GOLD_CSS : COLORS.textDim }));

    const c = CHART;
    this.keep(drawCard(this.add.graphics(), c, COLORS.glow));
    this.keep(label(this, c.x + CARD_INSET, c.y + 20, 'FOLLOWERS ONLINE · TODAY', 16, { color: COLORS.textCool }));
    ['12AM', '6AM', '12PM', '6PM', '12AM'].forEach((t, i) => {
      const x = PLOT.left + ((PLOT.right - PLOT.left) * i) / 4;
      this.keep(body(this, x, PLOT.bottom + 12, t, 24, { color: COLORS.textDim }).setOrigin(i === 0 ? 0 : i === 4 ? 1 : 0.5, 0));
    });
    this.chart = this.keep(this.add.graphics());
    this.primeLabel = null;
    this.drawCurve();
    this.marker = this.keep(this.add.graphics());
    this.ratingText = this.keep(label(this, GAME_W / 2, PLOT.bottom + 62, '', 20).setOrigin(0.5));

    const p = LAYOUT.panel;
    this.postButton = new Button(this, {
      x: p.x + p.w / 2, y: p.y + p.h / 2, w: p.w - 16, h: p.h - 16, size: 34, accent: PINK, textColor: PINK_CSS,
      text: 'POST', sub: 'Tap at prime time', onPress: () => this.post(),
    });
  }

  xAt(t) {
    return PLOT.left + t * (PLOT.right - PLOT.left);
  }

  yAt(v) {
    return PLOT.bottom - v * (PLOT.bottom - PLOT.top);
  }

  drawCurve() {
    const g = this.chart.clear();
    // The PRIME TIME line.
    const prime = SOCIAL.timing.ratings[0];
    const py = Math.round(this.yAt(prime.min));
    g.fillStyle(RIBBON_GOLD, 0.6);
    for (let x = PLOT.left; x < PLOT.right; x += 20) g.fillRect(x, py - 1, Math.min(12, PLOT.right - x), 2);
    if (!this.primeLabel) this.primeLabel = this.keep(label(this, PLOT.right, py - 26, prime.label, 12, { color: GOLD_CSS }).setOrigin(1, 0));
    // Whole-pixel columns, colored by the rating at that hour.
    const step = 4;
    for (let x = PLOT.left; x < PLOT.right; x += step) {
      const v = activityAt(this.curve, (x - PLOT.left) / (PLOT.right - PLOT.left));
      const y = Math.round(this.yAt(v));
      g.fillStyle(RATING_COLORS[ratingFor(v).id], 0.28).fillRect(x, y, step, PLOT.bottom - y);
      g.fillStyle(RATING_COLORS[ratingFor(v).id], 1).fillRect(x, y - 2, step, 4);
    }
    g.fillStyle(0xffffff, 0.15).fillRect(PLOT.left, PLOT.bottom, PLOT.right - PLOT.left, 2);
  }

  /** Where the marker is now, 0..1 across the day. */
  get at() {
    return this.sweep <= 1 ? this.sweep : 2 - this.sweep;
  }

  update(time, delta) {
    if (this.phase === 'time') {
      this.sweep = (this.sweep + delta / this.sweepMs) % 2;
      this.drawMarker();
    } else if (this.phase === 'result' && this.counting !== null) {
      this.countUp(delta);
    }
  }

  drawMarker() {
    const v = activityAt(this.curve, this.at);
    const rating = ratingFor(v);
    const x = Math.round(this.xAt(this.at));
    const y = Math.round(this.yAt(v));
    const color = RATING_COLORS[rating.id];
    this.marker.clear().fillStyle(0xffffff, 0.5).fillRect(x - 1, PLOT.top - 10, 3, PLOT.bottom - PLOT.top + 10);
    this.marker.fillStyle(0x000000, 1).fillCircle(x, y, 13).fillStyle(color, 1).fillCircle(x, y, 9);
    this.ratingText.setText(rating.label).setColor(Phaser.Display.Color.IntegerToColor(color).rgba);
  }

  post() {
    if (this.phase !== 'time') return;
    this.phase = 'posted';
    const rating = DEBUG.perfect ? SOCIAL.timing.ratings[0] : ratingFor(activityAt(this.curve, this.at));
    this.drawMarker();
    this.postButton.setEnabled(false);
    Audio.sfx(rating.id === 'WACK' ? 'bad' : rating.id === 'PERFECT' ? 'crit' : 'good');
    this.cameras.main.flash(120, 255, 138, 216);
    this.time.delayedCall(450, () => this.showResult(rating.id));
  }

  // ---- 3. Posted ---------------------------------------------------------------------

  showResult(ratingId) {
    const score = scorePost(this.draft, this.trending, ratingId);
    const eng = engagement(score.gain, rng);
    const reactions = rng.pick([1, 2]) === 1 ? [this.reaction(ratingId)] : [this.reaction(ratingId), this.reaction(ratingId)];
    this.clear();
    this.phase = 'result';
    this.result = {
      grade: score.grade.id, score: score.gain, gain: score.gain, rating: ratingId, onTrend: score.onTrend,
      draft: this.draft, engagement: eng, reactions,
    };
    this.titleText.setText(score.grade.label);
    this.subText.setText(score.rating.label);

    const text = this.keep(body(this, RESULT.x + CARD_INSET, RESULT.y + 100, '', 34));
    const tagline = this.draft.classic ? '' : ` #${this.draft.tag}`;
    text.setText(fitWrapped(text, `${this.draft.text}${tagline}`, { maxWidth: RESULT.w - CARD_INSET - 28, maxHeight: 220, maxSize: 34, minSize: 24 }));
    const r = { ...RESULT, h: 100 + text.height + 80 };
    this.keep(drawCard(this.add.graphics(), r, this.draft.classic ? RIBBON_GOLD : PINK));
    text.setDepth(1); // drawn before its card, to size it
    this.keep(avatar(this, r.x + CARD_INSET + 34, r.y + 50, 'scott'));
    const name = this.keep(label(this, r.x + CARD_INSET + 84, r.y + 26, '$COTT MONEY', 18));
    this.keep(verifiedBadge(this, name.x + name.width + 18, name.y + 9));
    this.keep(body(this, r.x + CARD_INSET + 84, r.y + 52, '@scottmoney · now', 26, { color: COLORS.textDim }));
    // Likes, reposts, replies: they roll up from zero.
    this.counters = ['heart', 'repost', 'reply'].map((icon, i) => {
      const x = r.x + CARD_INSET + i * 200;
      const y = r.y + r.h - 56;
      this.keep(pixelIcon(this, x, y, icon, { px: 3, color: icon === 'heart' ? '#ff5f8a' : '#8a8496' }));
      return this.keep(label(this, x + 38, y + 4, '0', 18));
    });
    this.counting = 0;

    const gainY = r.y + r.h + 40;
    this.gainText = this.keep(label(this, GAME_W / 2, gainY, `+${formatClout(score.gain)} CLOUT`, 34, { color: PINK_CSS, strokeThickness: 8 }).setOrigin(0.5, 0).setScale(0.6));
    this.tweens.add({ targets: this.gainText, scale: 1, duration: 400, ease: 'Back.easeOut' });

    reactions.forEach((rx, i) => {
      const y = gainY + 90 + i * 100;
      const card = { x: 40, y, w: 664, h: 84 };
      this.keep(drawCard(this.add.graphics(), card, 0x4a3a7a, { alpha: 0.8 }));
      this.keep(label(this, card.x + CARD_INSET, y + 14, rx.handle, 14, { color: COLORS.textDim }));
      this.keep(fitWidth(body(this, card.x + CARD_INSET, y + 38, rx.text, 32), card.w - CARD_INSET - 20));
    });

    const p = LAYOUT.panel;
    new Button(this, {
      x: p.x + p.w / 2, y: p.y + p.h / 2, w: p.w - 16, h: p.h - 40, size: 26, accent: RIBBON_GOLD, textColor: GOLD_CSS,
      text: 'CONTINUE', onPress: () => this.finish(this.result),
    });
  }

  reaction(ratingId) {
    return { handle: rng.pick(FANS), text: rng.pick(REACTIONS[ratingId] ?? REACTIONS.MID) };
  }

  countUp(delta) {
    this.counting = Math.min(COUNT_MS, this.counting + delta);
    const k = 1 - (1 - this.counting / COUNT_MS) ** 3;
    const { likes, reposts, replies } = this.result.engagement;
    [likes, reposts, replies].forEach((n, i) => this.counters[i].setText(formatCount(n * k)));
    if (this.counting >= COUNT_MS) this.counting = null;
  }

  finish(result) {
    if (this.finished) return;
    this.finished = true;
    this.scene.get(this.parentKey)?.events.off('shutdown', this.onParentGone);
    const { done } = this;
    this.scene.stop();
    done(result);
  }

  /** Read by the debug hook / smoke test: `postAnswer` is where a sharp poster would tap now. */
  debugState() {
    let postAnswer = null;
    if (this.phase === 'write') {
      // The best draft: the classic, else the strongest one on a trend.
      const best = [...this.drafts].sort((a, b) => scorePost(b, this.trending, 'PERFECT').gain - scorePost(a, this.trending, 'PERFECT').gain)[0];
      const r = this.draftRects[this.drafts.indexOf(best)];
      postAnswer = { text: 'DRAFT', x: r.x + r.w / 2, y: r.y + r.h / 2 };
    } else if (this.phase === 'time' && ratingFor(activityAt(this.curve, this.at)).id === 'PERFECT') {
      postAnswer = { text: 'POST' };
    } else if (this.phase === 'result') {
      postAnswer = { text: 'CONTINUE' };
    }
    return { post: { phase: this.phase, at: this.at, result: this.result }, postAnswer };
  }
}
