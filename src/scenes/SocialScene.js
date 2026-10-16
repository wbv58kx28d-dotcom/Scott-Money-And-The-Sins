// Y, $cott's social app (CLAUDE.md §6.10), opened from his phone. It takes
// the whole screen, like the minigames, and holds:
//   - the header: back, the logo, and his Clout (the meter that opens velvet
//     ropes around the world, map `gates`; it only goes up);
//   - his profile, with posts left until the next fight;
//   - the feed: NPC posts as the story unlocks them (data/social.js FEED),
//     newest first, mixed with his own. Drag to scroll. Some posts take a
//     REPLY: pick the right one of three for Clout;
//   - NEW POST: the posting minigame (minigames/post.js). He gets 3 per fight.
// The feed scrolls in its own camera, so nothing outside it needs a mask.

import { GAME_W, GAME_H, COLORS } from '../config.js';
import { APP, ACCOUNTS, SOCIAL } from '../data/social.js';
import { visibleFeed, formatCount, formatClout } from '../systems/social.js';
import { Save } from '../systems/save.js';
import { Audio } from '../systems/audio.js';
import { rng } from '../systems/rng.js';
import post, { PINK, PINK_CSS } from '../minigames/post.js';
import { Button } from '../ui/button.js';
import { drawCard, CARD_INSET, RIBBON_GOLD } from '../ui/ribbon.js';
import { label, body, fitWidth, fitWrapped } from '../ui/text.js';
import { avatar, preloadAvatars, verifiedBadge } from '../ui/avatar.js';
import { pixelIcon } from '../ui/phoneIcons.js';

const KEY = 'Social';
const BG = 0x0b0914;
const BAR = 0x130e22;
const LINE = 0x2a2440;
const HEADER_H = 120;
const PROFILE = { y: 120, h: 132 };
const FEED = { x: 0, y: 256, w: 720, h: 876 };
const BOTTOM_Y = 1136;
const TEXT_X = 116;
const TEXT_W = 580;
const SLOP = 14; // px of movement before a press counts as a drag
const SHEET = { x: 16, y: 200, w: 688, h: 880 };
const RECENT = 8; // his last posts' drafts aren't offered again

export default {
  id: 'social',
  run(scene) {
    return new Promise((done) => scene.scene.launch(KEY, { parent: scene.scene.key, done }));
  },
};

/** Shuffled copy (so the right reply isn't always first). */
function shuffled(list) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export class SocialScene extends Phaser.Scene {
  constructor() {
    super(KEY);
  }

  init({ parent, done }) {
    this.parentKey = parent;
    this.done = done;
  }

  preload() {
    preloadAvatars(this);
  }

  create() {
    this.buttons = new Set();
    this.hits = [];
    this.sheetOpen = null;
    this.posting = false;
    this.closing = false;
    this.scroll = 0;
    this.press = null;
    this.ui = this.add.layer();
    this.feed = this.add.layer();
    this.ui.add(this.add.rectangle(0, 0, GAME_W, GAME_H, BG, 1).setOrigin(0).setInteractive());
    this.feedCam = this.cameras.add(FEED.x, FEED.y, FEED.w, FEED.h).setBackgroundColor(BG);
    this.cameras.main.ignore(this.feed);
    this.feedCam.ignore(this.ui);

    // Posts that are new since he last looked keep a pink edge this visit.
    const ids = visibleFeed(Save.socialState).map((p) => p.id);
    this.fresh = new Set(ids.filter((id) => Save.feedSeqOf(id) === 0));
    Save.markSeen(ids);

    this.buildHeader();
    this.buildProfile();
    this.buildBottom();
    this.buildFeed();

    this.input.on('pointerdown', (p) => this.onDown(p));
    this.input.on('pointermove', (p) => this.onMove(p));
    this.input.on('pointerup', (p) => this.onUp(p));
    this.onParentGone = () => this.scene.stop();
    this.scene.get(this.parentKey)?.events.once('shutdown', this.onParentGone);
    this.cameras.main.fadeIn(160, 0, 0, 0);
  }

  /** A UI object (main camera only). */
  addUi(...objs) {
    for (const o of objs.flat()) this.ui.add(o);
    return objs[0];
  }

  button(o) {
    const b = new Button(this, o);
    this.ui.add(b.container);
    return b;
  }

  // ---- Header, profile, post button --------------------------------------------------

  buildHeader() {
    this.addUi(this.add.rectangle(0, 0, GAME_W, HEADER_H, BAR, 1).setOrigin(0));
    this.button({ x: 84, y: 60, w: 136, h: 64, text: 'BACK', size: 16, onPress: () => this.close() });
    this.addUi(label(this, GAME_W / 2, 26, APP.name, 44, { color: PINK_CSS, strokeThickness: 10 }).setOrigin(0.5, 0));
    this.addUi(body(this, GAME_W / 2, 80, APP.tagline, 22, { color: COLORS.textDim }).setOrigin(0.5, 0));
    this.addUi(label(this, GAME_W - 24, 28, 'CLOUT', 12, { color: COLORS.textDim, strokeThickness: 0 }).setOrigin(1, 0));
    this.cloutShown = Save.clout;
    this.cloutText = this.addUi(label(this, GAME_W - 24, 50, formatClout(Save.clout), 26, { color: '#ffd166' }).setOrigin(1, 0));
  }

  buildProfile() {
    const y = PROFILE.y;
    this.addUi(this.add.rectangle(0, y, GAME_W, PROFILE.h, BG, 1).setOrigin(0));
    this.addUi(this.add.rectangle(0, y + PROFILE.h - 2, GAME_W, 2, LINE, 1).setOrigin(0));
    this.addUi(avatar(this, 66, y + 66, 'scott', 84));
    const name = this.addUi(label(this, 126, y + 34, ACCOUNTS.scott.name, 20));
    this.addUi(verifiedBadge(this, name.x + name.width + 20, name.y + 10));
    this.addUi(body(this, 126, y + 66, ACCOUNTS.scott.handle, 28, { color: COLORS.textDim }));
    this.addUi(label(this, GAME_W - 24, y + 36, 'POSTS LEFT', 12, { color: COLORS.textDim, strokeThickness: 0 }).setOrigin(1, 0));
    this.postsText = this.addUi(label(this, GAME_W - 24, y + 58, '', 22).setOrigin(1, 0));
  }

  buildBottom() {
    this.addUi(this.add.rectangle(0, BOTTOM_Y, GAME_W, GAME_H - BOTTOM_Y, BAR, 1).setOrigin(0));
    this.postButton = this.button({
      x: GAME_W / 2, y: BOTTOM_Y + 72, w: 688, h: 112, size: 28, accent: PINK, textColor: PINK_CSS,
      text: 'NEW POST', sub: ' ', onPress: () => this.newPost(),
      onDisabledPress: () => Audio.sfx('bad'),
    });
    this.refreshCounts();
  }

  refreshCounts() {
    const left = Save.posts;
    this.postsText.setText(`${left}/${SOCIAL.postsPerFight}`).setColor(left ? COLORS.text : '#ff6b6b');
    const classic = Save.classicsReady.length > 0;
    this.postButton.setEnabled(left > 0);
    this.postButton.setSub(left <= 0 ? 'Out of posts. Win a fight to post again.' : classic ? 'A CLASSIC is in your drafts.' : 'Ride a trend. Post at prime time.');
  }

  /** Count the header's Clout up to the saved value, with a "+N" popping off it. */
  showGain(n) {
    if (!n) return;
    // The "+N" floats up beside the number (left of it), not over it.
    const pop = this.addUi(label(this, this.cloutText.x - this.cloutText.width - 16, 62, `+${formatClout(n)}`, 16, { color: PINK_CSS }).setOrigin(1, 0));
    this.tweens.add({ targets: pop, y: 30, alpha: 0, delay: 300, duration: 1100, ease: 'Quad.easeOut', onComplete: () => pop.destroy() });
    const from = this.cloutShown;
    const to = Save.clout;
    this.tweens.addCounter({
      from, to, duration: 700, ease: 'Quad.easeOut',
      onUpdate: (tw) => this.cloutText.setText(formatClout(tw.getValue())),
      onComplete: () => this.cloutText.setText(formatClout(to)),
    });
    this.cloutShown = to;
  }

  // ---- The feed ------------------------------------------------------------------------

  /** NPC posts and $cott's own, newest first. */
  items() {
    const npc = visibleFeed(Save.socialState).map((p) => ({ kind: 'npc', post: p, seq: Save.feedSeqOf(p.id) }));
    const mine = Save.mine.map((m) => ({ kind: 'mine', mine: m, seq: m.seq }));
    return [...npc, ...mine].sort((a, b) => b.seq - a.seq);
  }

  buildFeed() {
    this.feed.removeAll(true);
    this.hits = [];
    const items = this.items();
    this.topSeq = items[0]?.seq ?? 0;
    let y = 0;
    for (const item of items) y += this.drawItem(item, y);
    if (!items.length) this.feed.add(body(this, GAME_W / 2, 60, 'Nothing yet. Post something.', 30, { color: COLORS.textDim }).setOrigin(0.5, 0));
    this.contentH = y + 40;
    this.scrollTo(this.scroll);
  }

  scrollTo(y) {
    this.scroll = Phaser.Math.Clamp(y, 0, Math.max(0, this.contentH - FEED.h));
    this.feedCam.setScroll(0, this.scroll);
  }

  ago(seq) {
    const age = this.topSeq - seq;
    if (age <= 0) return 'now';
    return age < 12 ? `${age * 2}h` : `${Math.floor(age / 12) + 1}d`;
  }

  /** One post (and its replies) at feed y; returns its height. */
  drawItem(item, y0) {
    const f = (o) => {
      this.feed.add(o);
      return o;
    };
    const fa = (list) => list.forEach((o) => this.feed.add(o));
    const by = item.kind === 'mine' ? 'scott' : item.post.by;
    const acct = ACCOUNTS[by];
    let y = y0 + 20;
    fa(avatar(this, 58, y + 34, by));
    const name = f(label(this, TEXT_X, y, acct.name, 16));
    fitWidth(name, TEXT_W - 40);
    if (acct.verified) fa(verifiedBadge(this, name.x + name.width + 18, y + 8));
    const when = this.ago(item.seq);
    f(body(this, TEXT_X, y + 22, `${acct.handle} · ${when}`, 26, { color: COLORS.textDim }));
    y += 58;

    const text = item.kind === 'mine'
      ? `${item.mine.text}${item.mine.tag ? ` #${item.mine.tag}` : ''}`
      : item.post.text;
    const t = f(body(this, TEXT_X, y, text, 32, { wordWrap: { width: TEXT_W, useAdvancedWrap: true } }));
    y += t.height + 14;

    // Likes, reposts, replies.
    const likes = item.kind === 'mine' ? item.mine.likes : item.post.likes;
    const reposts = item.kind === 'mine' ? item.mine.reposts : Math.round(item.post.likes * 0.18);
    const replies = item.kind === 'mine' ? item.mine.replies : Math.round(item.post.likes * 0.04);
    [['heart', likes, '#ff5f8a'], ['repost', reposts, '#7cf29c'], ['reply', replies, '#9fdcff']].forEach(([icon, n, color], i) => {
      const x = TEXT_X + i * 150;
      f(pixelIcon(this, x, y, icon, { px: 2, color }));
      f(label(this, x + 26, y + 2, formatCount(n), 14, { color: COLORS.textDim, strokeThickness: 0 }));
    });

    if (item.kind === 'mine') {
      const m = item.mine;
      if (m.label) {
        const tag = f(label(this, GAME_W - 24, y + 2, `${m.label} +${formatClout(m.gain)}`, 12, { color: PINK_CSS, strokeThickness: 0 }).setOrigin(1, 0));
        fitWidth(tag, 230);
      }
      y += 36;
      for (const r of m.reactions ?? []) {
        f(body(this, TEXT_X + 20, y, `${r.handle}: ${r.text}`, 26, { color: COLORS.textDim, wordWrap: { width: TEXT_W - 20 } }));
        y += 30;
      }
    } else if (item.post.reply) {
      const done = Save.replyTo(item.post.id);
      if (!done) {
        // A REPLY pill on the right of the counts row.
        const w = 150;
        const h = 44;
        const x = GAME_W - 24 - w;
        const g = f(this.add.graphics().fillStyle(PINK, 1).fillRoundedRect(x, y - 10, w, h, 22));
        f(label(this, x + w / 2, y + 12, 'REPLY', 14, { color: '#0d0820', strokeThickness: 0 }).setOrigin(0.5));
        this.hits.push({ x, y: y - 16, w, h: h + 12, text: 'REPLY', post: item.post, g, fn: () => this.openReply(item.post) });
        y += 44;
      } else {
        y += 40;
        y += this.thread(f, y, 'scott', done.text, done.right ? `+${SOCIAL.reply.right} CLOUT` : `+${SOCIAL.reply.wrong} CLOUT`);
        y += this.thread(f, y, by, done.right ? item.post.reply.right : item.post.reply.wrong);
      }
    } else {
      y += 36;
    }

    const h = y - y0 + 14;
    f(this.add.rectangle(0, y0 + h - 2, GAME_W, 2, LINE, 1).setOrigin(0));
    if (item.kind === 'npc' && this.fresh.has(item.post.id)) f(this.add.rectangle(0, y0, 6, h - 2, PINK, 1).setOrigin(0));
    return h;
  }

  /** A reply under a post: who said it, what, and an optional note. Returns its height. */
  thread(f, y, who, text, note = null) {
    const x = TEXT_X + 20;
    f(this.add.rectangle(TEXT_X + 4, y, 4, 64, LINE, 1).setOrigin(0));
    f(label(this, x, y, ACCOUNTS[who].name, 12, { color: who === 'scott' ? '#ffd166' : COLORS.textDim, strokeThickness: 0 }));
    if (note) f(label(this, GAME_W - 24, y, note, 12, { color: PINK_CSS, strokeThickness: 0 }).setOrigin(1, 0));
    const t = f(body(this, x, y + 18, text, 28, { wordWrap: { width: TEXT_W - 24, useAdvancedWrap: true } }));
    return t.height + 30;
  }

  // ---- Scrolling and tapping -----------------------------------------------------------

  inFeed(p) {
    return p.y >= FEED.y && p.y < FEED.y + FEED.h;
  }

  onDown(p) {
    if (this.sheetOpen || this.posting || !this.inFeed(p)) return;
    this.press = { y: p.y, scroll: this.scroll, moved: false };
  }

  onMove(p) {
    if (!this.press || !p.isDown) return;
    if (Math.abs(p.y - this.press.y) > SLOP) this.press.moved = true;
    if (this.press.moved) this.scrollTo(this.press.scroll - (p.y - this.press.y));
  }

  onUp(p) {
    const press = this.press;
    this.press = null;
    if (!press || press.moved || !this.inFeed(p)) return;
    const fx = p.x - FEED.x;
    const fy = p.y - FEED.y + this.scroll;
    const hit = this.hits.find((h) => fx >= h.x && fx <= h.x + h.w && fy >= h.y && fy <= h.y + h.h);
    if (hit) {
      Audio.sfx('blip');
      hit.fn();
    }
  }

  // ---- Replying ------------------------------------------------------------------------

  openReply(feedPost) {
    if (this.sheetOpen) return;
    const sheet = [];
    const keep = (...objs) => {
      for (const o of objs.flat()) {
        this.ui.add(o);
        sheet.push(o);
      }
      return objs[0];
    };
    this.sheetOpen = { post: feedPost, objs: sheet, buttons: [] };
    this.feedCam.setVisible(false);
    const s = SHEET;
    keep(this.add.rectangle(0, 0, GAME_W, GAME_H, 0x05030a, 0.8).setOrigin(0).setInteractive());
    keep(drawCard(this.add.graphics(), s, PINK));
    const acct = ACCOUNTS[feedPost.by];
    keep(avatar(this, s.x + CARD_INSET + 30, s.y + 50, feedPost.by, 60));
    keep(fitWidth(label(this, s.x + CARD_INSET + 76, s.y + 30, acct.name, 16), s.w - CARD_INSET - 110));
    keep(body(this, s.x + CARD_INSET + 76, s.y + 52, acct.handle, 26, { color: COLORS.textDim }));
    const t = keep(body(this, s.x + CARD_INSET, s.y + 100, '', 30));
    t.setText(fitWrapped(t, feedPost.text, { maxWidth: s.w - CARD_INSET - 28, maxHeight: 160, maxSize: 30, minSize: 22 }));
    keep(label(this, s.x + CARD_INSET, s.y + 280, 'YOUR REPLY', 14, { color: PINK_CSS }));

    const options = shuffled(feedPost.reply.options.map((text, i) => ({ text, right: i === 0 })));
    this.sheetOpen.options = options.map((o, i) => {
      const r = { x: s.x + 24, y: s.y + 316 + i * 150, w: s.w - 48, h: 134 };
      const g = keep(this.add.graphics().fillStyle(0x1a1030, 1).fillRoundedRect(r.x, r.y, r.w, r.h, 18).lineStyle(3, 0x4a3a7a, 1).strokeRoundedRect(r.x, r.y, r.w, r.h, 18));
      const ot = keep(body(this, r.x + 20, r.y + 14, '', 30));
      ot.setText(fitWrapped(ot, o.text, { maxWidth: r.w - 40, maxHeight: r.h - 24, maxSize: 30, minSize: 22 }));
      const zone = keep(this.add.zone(r.x, r.y, r.w, r.h).setOrigin(0).setInteractive());
      zone.on('pointerup', () => this.pickReply(o));
      zone.on('pointerdown', () => g.setAlpha(0.7));
      zone.on('pointerout', () => g.setAlpha(1));
      return { ...o, rect: r };
    });
    this.sheetOpen.buttons.push(this.button({
      x: GAME_W / 2, y: s.y + s.h - 60, w: s.w - 48, h: 80, text: 'NEVER MIND', size: 18, depth: 21,
      onPress: () => this.closeSheet(),
    }));
  }

  pickReply(option) {
    const open = this.sheetOpen;
    if (!open || open.picked) return;
    open.picked = option;
    const p = open.post;
    Save.reply(p.id, option.right, option.text);
    const gain = Save.addClout(option.right ? SOCIAL.reply.right : SOCIAL.reply.wrong);
    Audio.sfx(option.right ? 'good' : 'bad');
    // Cover the options with the answer.
    const s = SHEET;
    const cover = this.add.rectangle(s.x + 20, s.y + 270, s.w - 40, s.h - 380, 0x0d0820, 1).setOrigin(0).setInteractive();
    this.ui.add(cover);
    open.objs.push(cover);
    const add = (o) => {
      this.ui.add(o);
      open.objs.push(o);
      return o;
    };
    add(label(this, s.x + CARD_INSET, s.y + 290, 'YOU', 14, { color: '#ffd166' }));
    const mine = add(body(this, s.x + CARD_INSET, s.y + 316, '', 30));
    mine.setText(fitWrapped(mine, option.text, { maxWidth: s.w - CARD_INSET - 28, maxHeight: 130, maxSize: 30, minSize: 22 }));
    add(label(this, s.x + CARD_INSET, s.y + 480, ACCOUNTS[p.by].name, 14, { color: COLORS.textDim }));
    const theirs = add(body(this, s.x + CARD_INSET, s.y + 506, '', 30));
    theirs.setText(fitWrapped(theirs, option.right ? p.reply.right : p.reply.wrong, { maxWidth: s.w - CARD_INSET - 28, maxHeight: 130, maxSize: 30, minSize: 22 }));
    const verdict = option.right ? 'NAILED IT' : 'MEH';
    add(label(this, GAME_W / 2, s.y + 680, `${verdict}  +${gain} CLOUT`, 24, { color: option.right ? PINK_CSS : COLORS.textDim }).setOrigin(0.5, 0));
    for (const b of open.buttons) b.destroy();
    open.buttons = [this.button({
      x: GAME_W / 2, y: s.y + s.h - 60, w: s.w - 48, h: 80, text: 'DONE', size: 20, accent: RIBBON_GOLD, textColor: '#ffd166', depth: 21,
      onPress: () => this.closeSheet(gain),
    })];
  }

  closeSheet(gain = 0) {
    const open = this.sheetOpen;
    if (!open) return;
    for (const o of open.objs) o.destroy();
    for (const b of open.buttons) b.destroy();
    this.sheetOpen = null;
    this.feedCam.setVisible(true);
    this.buildFeed();
    this.showGain(gain);
  }

  // ---- Posting -------------------------------------------------------------------------

  async newPost() {
    if (this.posting || this.sheetOpen || Save.posts <= 0) return;
    this.posting = true;
    this.scene.pause();
    // Drafts he's posted lately sit out, so the same one doesn't come up twice in a row.
    const recent = Save.mine.slice(-RECENT).map((m) => m.draft).filter(Boolean);
    const result = await post.run(this, { context: { classics: Save.classicsReady, recent } });
    this.scene.resume();
    this.posting = false;
    if (!result || result.cancelled || !Save.usePost()) return;
    const gain = Save.addClout(result.gain);
    if (result.draft.classic) Save.markPosted(result.draft.id);
    const grade = SOCIAL.grades.find((g) => g.id === result.grade);
    Save.addMine({
      draft: result.draft.id, text: result.draft.text, tag: result.draft.classic ? null : result.draft.tag, gain, label: grade?.label ?? '',
      ...result.engagement, reactions: result.reactions,
    });
    this.scroll = 0;
    this.buildFeed();
    this.refreshCounts();
    this.showGain(gain);
  }

  close() {
    if (this.closing || this.sheetOpen || this.posting) return;
    this.closing = true;
    this.scene.get(this.parentKey)?.events.off('shutdown', this.onParentGone);
    const { done } = this;
    this.scene.stop();
    done();
  }

  /** Read by the debug hook / smoke test. Points are canvas coordinates. */
  debugState() {
    const onScreen = (h) => ({ text: h.text, id: h.post.id, x: FEED.x + h.x + h.w / 2, y: FEED.y + h.y + h.h / 2 - this.scroll });
    const open = this.sheetOpen;
    const right = open && !open.picked ? open.options.find((o) => o.right) : null;
    return {
      social: {
        clout: Save.clout, posts: Save.posts, scroll: this.scroll, sheet: !!open,
        replies: this.hits.map(onScreen).filter((h) => h.y > FEED.y && h.y < FEED.y + FEED.h),
        feed: this.items().map((i) => (i.kind === 'mine' ? 'mine' : i.post.id)),
      },
      socialAnswer: right ? { text: 'REPLY', x: right.rect.x + right.rect.w / 2, y: right.rect.y + right.rect.h / 2 } : null,
    };
  }
}
