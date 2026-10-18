// Trees and buildings go see-through when $cott walks behind them (CLAUDE.md
// §6.6), so he never vanishes in a grove. A prop counts as in front of him
// when its feet are below his (it's drawn over him) and any of a few points
// on his body lands on one of its painted pixels, not just inside its box.
// It fades down while he's behind it and back up once he's out.

const FADED = 0.4; // how see-through a prop gets
const RATE = 5; // alpha per second, either way
const TALL = 110; // props at least this tall (px) can hide him
// Points on his body to test, from his feet (x, y up): head, chest, waist, either shoulder.
const BODY = [[0, 112], [0, 84], [0, 56], [-16, 80], [16, 80]];

export class SeeThrough {
  /** @param {Phaser.Scene} scene  @param {Phaser.GameObjects.Image[]} props  every prop's image */
  constructor(scene, props) {
    this.scene = scene;
    this.props = props.filter((img) => img.height >= TALL).map((img) => ({ img, alpha: 1 }));
  }

  /** Is world point (x, y) on one of this prop image's painted pixels? */
  covers(img, x, y) {
    const lx = Math.floor(x - (img.x - img.width * img.originX));
    const ly = Math.floor(y - (img.y - img.height * img.originY));
    if (lx < 0 || ly < 0 || lx >= img.width || ly >= img.height) return false;
    return this.scene.textures.getPixelAlpha(lx, ly, img.texture.key, img.frame.name) > 0;
  }

  update(delta, who) {
    const step = (RATE * delta) / 1000;
    for (const p of this.props) {
      const { img } = p;
      let target = 1;
      if (img.visible && img.y > who.y && Math.abs(img.x - who.x) < img.width / 2 + 24 && who.y > img.y - img.height) {
        if (BODY.some(([dx, dy]) => this.covers(img, who.x + dx, who.y - dy))) target = FADED;
      }
      if (p.alpha === target) continue;
      p.alpha = target < p.alpha ? Math.max(target, p.alpha - step) : Math.min(target, p.alpha + step);
      img.setAlpha(p.alpha);
    }
  }
}
