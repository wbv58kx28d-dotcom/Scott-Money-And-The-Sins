// A red count on the PHONE button: new posts in $cott's social app (data/social.js)
// he hasn't seen, plus classic posts waiting in his drafts. Hidden at zero.

import { Save } from '../systems/save.js';
import { visibleFeed } from '../systems/social.js';
import { label } from './text.js';

/** How many things are new in the social app. */
export function socialNews() {
  return Save.unread(visibleFeed(Save.socialState).map((p) => p.id)) + Save.classicsReady.length;
}

export class PhoneBadge {
  constructor(scene, x, y, depth = 31) {
    this.g = scene.add.graphics().setDepth(depth);
    this.text = label(scene, x, y, '', 12, { strokeThickness: 0 }).setOrigin(0.5).setDepth(depth);
    this.x = x;
    this.y = y;
    this.refresh();
  }

  refresh() {
    const n = socialNews();
    const str = badgeLabel(n);
    const r = 15;
    this.g.clear().setVisible(n > 0);
    this.text.setText(str).setVisible(n > 0);
    if (!n) return;
    this.g.fillStyle(0x0d0820, 1).fillCircle(this.x, this.y, r + 3).fillStyle(0xe0245e, 1).fillCircle(this.x, this.y, r);
    this.text.setPosition(Math.round(this.x), Math.round(this.y + 1));
  }
}

/** A count as a badge shows it. */
export const badgeLabel = (n) => (n > 9 ? '9+' : String(n));
