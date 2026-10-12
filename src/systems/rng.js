// The game's single random number source. Everything random goes through
// here, so `&seed=123` in debug mode makes a whole battle repeatable.
//
// `rng` drives gameplay (damage rolls, enemy AI). `rng.fx` is a second stream
// from the same seed for cosmetics (particles, placeholder art), so purely
// visual randomness never shifts the gameplay rolls.

// mulberry32: small, fast, good enough for a game.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createRng(seed) {
  let next = mulberry32(seed);
  const api = {
    seed(newSeed) {
      next = mulberry32(newSeed);
      return api;
    },
    /** Float in [0, 1). */
    random: () => next(),
    /** Float in [min, max). */
    range: (min, max) => min + next() * (max - min),
    /** Integer in [min, max], inclusive. */
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    /** True with probability p. */
    chance: (p) => next() < p,
    pick: (list) => list[Math.floor(next() * list.length)],
    /** Pick from a list using each item's numeric `weight` (or weightOf(item)). */
    weighted(list, weightOf = (item) => item.weight) {
      const total = list.reduce((sum, item) => sum + weightOf(item), 0);
      let roll = next() * total;
      for (const item of list) {
        roll -= weightOf(item);
        if (roll < 0) return item;
      }
      return list[list.length - 1];
    },
  };
  return api;
}

// Unseeded play still needs a starting seed; this is the only place the
// browser's own randomness is used.
const initialSeed = (Math.random() * 2 ** 32) >>> 0;

export const rng = createRng(initialSeed);
rng.fx = createRng(initialSeed ^ 0x9e3779b9);

/** Reseed both streams (debug `&seed=`). */
export function seedAll(seed) {
  rng.seed(seed);
  rng.fx.seed(seed ^ 0x9e3779b9);
}
