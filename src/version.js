// The build players are running, shown on the title screen (CLAUDE.md §7).
// Bump it in every change that goes to main: minor for new features, patch
// for fixes. Since it loads with the rest of the game code, a stale version
// on screen means the browser is still running a cached copy.

export const VERSION = '0.32.0';
export const RELEASED = '2026-10-19';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "v0.5.0 · Oct 14, 2026" */
export function versionLabel() {
  const [y, m, d] = RELEASED.split('-').map(Number);
  return `v${VERSION} · ${MONTHS[m - 1]} ${d}, ${y}`;
}
