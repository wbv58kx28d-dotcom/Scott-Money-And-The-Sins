// $cott's phone (scenes/PhoneScene.js): the models, the apps on them, the
// shop's catalog, the Stonks tickers, and the money rules. Everything here is
// tuning; the scene only draws it.

// Phone models. $cott starts on the flip phone and buys the upgrade in the shop.
export const PHONES = {
  flip: { id: 'flip', name: 'FLIP PHONE', cols: 2 },
  smart: { id: 'smart', name: 'SMARTPHONE', cols: 4 },
};

// Home-screen apps, in grid order. `icon` names a bitmap in ui/phoneIcons.js;
// `color` is the smartphone tile (the flip phone's LCD is one color).
export const APPS = [
  { id: 'map', name: 'MAP', icon: 'map', color: 0x3a9d5d },
  { id: 'stonks', name: 'STONKS', icon: 'chart', color: 0x1f6feb },
  { id: 'shop', name: 'SHOP', icon: 'bag', color: 0xff8c42 },
  { id: 'settings', name: 'SETTINGS', icon: 'gear', color: 0x6f6888 },
];

// The shop. Items stack in $cott's stash and are used in battle after the
// free per-fight ones (data/items.js). `phone` entries upgrade the phone.
export const SHOP = [
  { id: 'coldBrew', kind: 'item', price: 150 },
  { id: 'voicemail', kind: 'item', price: 300 },
  {
    id: 'smartphone', kind: 'phone', phone: 'smart', name: 'SMARTPHONE', price: 2500,
    desc: 'Apps. A real chart in Stonks. Finally.',
  },
];

// Stonks: pick a ticker and a stake, watch the price, SELL before it rugs.
// Each tick the price moves by a random step of up to `vol` (a fraction),
// plus `drift`; each tick there's a `rug` chance it crashes by `rugDrop`.
export const STOCKS = [
  { id: 'HODL', name: 'HODL INDEX', vol: 0.025, drift: 0.004, rug: 0, rugDrop: 0 },
  { id: 'APE', name: 'APE COIN', vol: 0.06, drift: 0.006, rug: 0.008, rugDrop: 0.5 },
  { id: 'MOON', name: 'MOONSHOT', vol: 0.12, drift: 0.012, rug: 0.02, rugDrop: 0.8 },
];

export const ECONOMY = {
  startCash: 500,
  stakes: [100, 250, 500], // what a trade can put in (if $cott has it)
  tradesPerFight: 3, // trades refill after every fight, so the market can't be farmed forever
  tickMs: 160, // how often the price moves
  maxTicks: 75, // the market closes itself after this many ticks (~12 s)
};
