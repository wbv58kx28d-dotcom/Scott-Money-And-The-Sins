// Overworld regions (CLAUDE.md §2, §6.5), keyed like the map pack
// (assets/map/map_regions.json, which holds the shapes, landmark points, and
// route). This file holds the gameplay side; a unit test keeps the two in sync.
//
// Both regions in a tier must be cleared before the next tier opens.
// `villain` is an enemy id from src/data/enemies/; null means not written yet,
// and the region shows as "coming soon" once it opens.

export const TIER_NAMES = ['PROLOGUE', 'TIER 1', 'TIER 2', 'TIER 3', 'FINALE', 'THE TOWER'];

export const REGIONS = [
  { id: 'start', name: 'Subreddit Swamps', tier: 0, villain: 'derek', recruit: null, background: 'bg_tokyo', sideQuests: [] },

  { id: 'isles', name: 'Influencer Isles', tier: 1, villain: null, recruit: 'lilturnt', background: null, sideQuests: [] },
  { id: 'ratio', name: 'Mount Ratio', tier: 1, villain: null, recruit: 'babarbara', background: null, sideQuests: [] },

  { id: 'riviera', name: 'Swipe Right Riviera', tier: 2, villain: null, recruit: 'susan', background: null, sideQuests: [] },
  { id: 'lofi', name: 'Lo-Fi Lowlands', tier: 2, villain: null, recruit: 'toking', background: null, sideQuests: [] },

  { id: 'bubble', name: 'Bubble Bay', tier: 3, villain: null, recruit: 'keezus', background: null, sideQuests: [] },
  { id: 'offshore', name: 'Offshore Archipelago', tier: 3, villain: null, recruit: 'louis', background: null, sideQuests: [] },

  { id: 'apex', name: 'Apex Launch Range', tier: 4, villain: null, recruit: 'sixpac', background: null, sideQuests: [] },

  // The everything-store overlord's tower (sprite: assets/sprites/enemies/fulfiller.png).
  { id: 'citadel', name: 'The Fulfillment Citadel', tier: 5, villain: null, recruit: null, background: null, sideQuests: [] },
];

export const regionById = (id) => REGIONS.find((r) => r.id === id) ?? null;
