// Debug mode. Off unless the URL has `?debug=1`; every other flag only
// works alongside it, so a stray parameter in a shared link does nothing.
//
//   ?debug=1             skip the title (goes to the map, or a battle with &battle=)
//   &battle=derek        jump straight to that battle
//   &perfect=1           every timing tap lands PERFECT
//   &seed=123            seed the random number source
//   &fast=1              dialog appears instantly
//   &cleared=start,isles preset cleared regions (in memory only; the real save is untouched)
//   &sins=lilturnt,babarbara:2
//                        preset recruited Sins, with optional levels (in memory only)
//   &reset=1             wipe the saved progress
//   &region=start        walk around that region
//   &cash=5000           preset $cott's cash (in memory only)
//   &phone=smart         preset the phone model: flip or smart (in memory only)
//   &title=1             show the title screen anyway (to test CONTINUE / START FRESH)
//   &speed=4             run minigame clocks (day trade, property ladder) 4× faster
//   &canvas=1            use the Canvas renderer instead of WebGL (fast without a GPU)
//
// Example: index.html?debug=1&battle=derek&perfect=1&seed=123&fast=1

const params = new URLSearchParams(globalThis.location?.search ?? '');
const enabled = params.get('debug') === '1';
const flag = (name) => enabled && params.get(name) === '1';
const list = (name) => (enabled && params.has(name) ? params.get(name).split(',').map((s) => s.trim()).filter(Boolean) : null);

const seedParam = enabled ? params.get('seed') : null;
const seed = seedParam !== null && /^-?\d+$/.test(seedParam) ? Number(seedParam) : null;

const sinList = list('sins');
const sins = sinList
  ? Object.fromEntries(sinList.map((entry) => {
    const [id, level] = entry.split(':');
    return [id, Math.min(3, Math.max(1, Number(level) || 1))];
  }))
  : null;

export const DEBUG = Object.freeze({
  enabled,
  battle: enabled ? params.get('battle') : null,
  perfect: flag('perfect'),
  fast: flag('fast'),
  seed,
  cleared: list('cleared'),
  sins,
  reset: flag('reset'),
  region: enabled ? params.get('region') : null,
  cash: enabled && /^\d+$/.test(params.get('cash') ?? '') ? Number(params.get('cash')) : null,
  phone: enabled ? params.get('phone') : null,
  title: flag('title'),
  canvas: flag('canvas'),
  speed: enabled && /^\d+(\.\d+)?$/.test(params.get('speed') ?? '') ? Math.max(0.1, Number(params.get('speed'))) : 1,
});
