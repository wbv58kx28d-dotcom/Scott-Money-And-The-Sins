// Debug mode. Off unless the URL has `?debug=1`; every other flag only
// works alongside it, so a stray parameter in a shared link does nothing.
//
//   ?debug=1          skip the title screen
//   &battle=derek     jump straight to that battle
//   &perfect=1        every timing tap lands PERFECT
//   &seed=123         seed the random number source
//   &fast=1           dialog appears instantly
//
// Example: index.html?debug=1&battle=derek&perfect=1&seed=123&fast=1

const params = new URLSearchParams(globalThis.location?.search ?? '');
const enabled = params.get('debug') === '1';
const flag = (name) => enabled && params.get(name) === '1';

const seedParam = enabled ? params.get('seed') : null;
const seed = seedParam !== null && /^-?\d+$/.test(seedParam) ? Number(seedParam) : null;

export const DEBUG = Object.freeze({
  enabled,
  battle: enabled ? params.get('battle') : null,
  perfect: flag('perfect'),
  fast: flag('fast'),
  seed,
});
