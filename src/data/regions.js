// Overworld regions (CLAUDE.md §2, §6.5). Data only for now; the map is
// Phase 3. Region names, themes, and most villains are still open questions
// (CLAUDE.md §10), so those are null until the chat side decides them.
//
// Both regions in a tier must be cleared before the next tier opens.

export const REGIONS = [
  { id: 'prologue', tier: 0, name: 'Subreddit Swamps', villain: 'derek', recruit: null, background: 'bg_tokyo', sideQuests: [] },

  { id: 'tier1a', tier: 1, name: null, villain: null, recruit: 'lilturnt', background: null, sideQuests: [] },
  { id: 'tier1b', tier: 1, name: null, villain: null, recruit: 'babarbara', background: null, sideQuests: [] },

  { id: 'tier2a', tier: 2, name: null, villain: null, recruit: 'susan', background: null, sideQuests: [] },
  { id: 'tier2b', tier: 2, name: null, villain: null, recruit: 'toking', background: null, sideQuests: [] },

  { id: 'tier3a', tier: 3, name: null, villain: null, recruit: 'keezus', background: null, sideQuests: [] },
  { id: 'tier3b', tier: 3, name: null, villain: null, recruit: 'louis', background: null, sideQuests: [] },

  { id: 'finale', tier: 4, name: null, villain: null, recruit: 'sixpac', background: null, sideQuests: [] },

  // The everything-store overlord's tower.
  { id: 'tower', tier: 5, name: null, villain: null, recruit: null, background: null, sideQuests: [] },
];
