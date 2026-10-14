// Pixel bitmaps for the phone's app icons (data/phone.js). Each is a 9×9 grid
// drawn `px` screen px per pixel, so icons stay crisp on the flip phone's LCD
// and on smartphone tiles alike.

const ICONS = {
  // A location pin.
  map: [
    '...###...',
    '..#####..',
    '.###.###.',
    '.##...##.',
    '.###.###.',
    '..#####..',
    '...###...',
    '....#....',
    '....#....',
  ],
  // Rising bars.
  chart: [
    '.......##',
    '.......##',
    '....##.##',
    '....##.##',
    '.##.##.##',
    '.##.##.##',
    '.##.##.##',
    '#########',
    '.........',
  ],
  // A shopping bag.
  bag: [
    '...###...',
    '..#...#..',
    '..#...#..',
    '#########',
    '#.......#',
    '#.......#',
    '#.......#',
    '#.......#',
    '#########',
  ],
  // A house.
  house: [
    '....#....',
    '...###...',
    '..#####..',
    '.#######.',
    '#########',
    '.##...##.',
    '.##.#.##.',
    '.##.#.##.',
    '.#######.',
  ],
  gear: [
    '...#.#...',
    '.#.###.#.',
    '..#####..',
    '###...###',
    '.##...##.',
    '###...###',
    '..#####..',
    '.#.###.#.',
    '...#.#...',
  ],
  // Back arrow.
  back: [
    '.........',
    '...#.....',
    '..##.....',
    '.#######.',
    '########.',
    '.#######.',
    '..##.....',
    '...#.....',
    '.........',
  ],
  up: [
    '....#....',
    '...###...',
    '..#####..',
    '.#######.',
    '#########',
    '.........',
    '.........',
    '.........',
    '.........',
  ],
  down: [
    '.........',
    '.........',
    '.........',
    '.........',
    '#########',
    '.#######.',
    '..#####..',
    '...###...',
    '....#....',
  ],
};

export const ICON_SIZE = 9;

/** An image of an icon, top-left at (x, y), cached per name, size and color. */
export function pixelIcon(scene, x, y, name, { px = 4, color = '#ffffff' } = {}) {
  const rows = ICONS[name];
  const key = `pxicon:${name}:${px}:${color}`;
  if (!scene.textures.exists(key)) {
    const tex = scene.textures.createCanvas(key, ICON_SIZE * px, ICON_SIZE * px);
    const ctx = tex.getContext();
    ctx.fillStyle = color;
    rows.forEach((row, gy) => {
      [...row].forEach((cell, gx) => {
        if (cell === '#') ctx.fillRect(gx * px, gy * px, px, px);
      });
    });
    tex.refresh();
  }
  return scene.add.image(x, y, key).setOrigin(0, 0);
}
