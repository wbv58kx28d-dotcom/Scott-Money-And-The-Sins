// A minimal on-screen joystick for walking regions (CLAUDE.md §6.6): a faint
// ring with a small knob, pinned to the screen. A touch that starts on it
// steers $cott directly; a touch anywhere else still means tap-to-walk.
//
// The scene feeds it pointer events and reads `vector()` each frame.

const RING_ALPHA = { idle: 0.22, active: 0.45 };
const KNOB_ALPHA = { idle: 0.3, active: 0.6 };

export class Joystick {
  /** @param {{x:number, y:number, radius:number, knob:number, grab:number, deadZone:number}} o  grab: touch radius that picks it up */
  constructor(scene, o) {
    this.o = o;
    this.pointerId = null;
    this.dx = 0;
    this.dy = 0;
    this.ring = scene.add.circle(o.x, o.y, o.radius).setStrokeStyle(3, 0xffffff, 1).setAlpha(RING_ALPHA.idle).setDepth(30);
    this.knob = scene.add.circle(o.x, o.y, o.knob, 0xffffff, 1).setAlpha(KNOB_ALPHA.idle).setDepth(30);
  }

  get active() {
    return this.pointerId !== null;
  }

  /** Does a touch at this screen point grab the stick? */
  contains(pointer) {
    return this.ring.visible && Math.hypot(pointer.x - this.o.x, pointer.y - this.o.y) <= this.o.grab;
  }

  begin(pointer) {
    this.pointerId = pointer.id;
    this.ring.setAlpha(RING_ALPHA.active);
    this.knob.setAlpha(KNOB_ALPHA.active);
    this.move(pointer);
  }

  move(pointer) {
    if (pointer.id !== this.pointerId) return;
    const { x, y, radius } = this.o;
    let dx = pointer.x - x;
    let dy = pointer.y - y;
    const len = Math.hypot(dx, dy);
    if (len > radius) {
      dx = (dx / len) * radius;
      dy = (dy / len) * radius;
    }
    this.dx = dx / radius;
    this.dy = dy / radius;
    this.knob.setPosition(Math.round(x + dx), Math.round(y + dy));
  }

  release() {
    this.pointerId = null;
    this.dx = 0;
    this.dy = 0;
    this.knob.setPosition(this.o.x, this.o.y);
    this.ring.setAlpha(RING_ALPHA.idle);
    this.knob.setAlpha(KNOB_ALPHA.idle);
  }

  /** Direction and strength in 0..1, or null inside the dead zone. */
  vector() {
    const mag = Math.hypot(this.dx, this.dy);
    if (!this.active || mag < this.o.deadZone) return null;
    return { x: this.dx / mag, y: this.dy / mag, strength: Math.min(1, (mag - this.o.deadZone) / (1 - this.o.deadZone)) };
  }

  setVisible(on) {
    if (!on) this.release();
    this.ring.setVisible(on);
    this.knob.setVisible(on);
  }
}
