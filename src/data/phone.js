// $cott's phone (scenes/PhoneScene.js): the models, the apps on them, the
// shop's catalog, the Stonks tickers, and the money rules. Everything here is
// tuning; the scene only draws it.

// Phone models. $cott starts on the flip phone and buys the upgrade in the shop.
// (While the phone is a work in progress, SETTINGS can also swap models freely.)
export const PHONES = {
  flip: { id: 'flip', name: 'FLIP PHONE', cols: 2 },
  smart: { id: 'smart', name: 'SMARTPHONE', cols: 4 },
};

// Home-screen apps, in grid order. `icon` names a bitmap in ui/phoneIcons.js;
// `color` is the smartphone tile (the flip phone's LCD is one color).
export const APPS = [
  { id: 'map', name: 'MAP', icon: 'map', color: 0x3a9d5d },
  { id: 'social', name: 'Y', icon: 'y', color: 0xe0245e }, // $cott's social app (scenes/SocialScene.js)
  { id: 'stonks', name: 'STONKS', icon: 'chart', color: 0x1f6feb },
  { id: 'realty', name: 'REALTY', icon: 'house', color: 0xd94f70 },
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

// Stonks: stake some of $cott's cash on a day trade (minigames/trade.js, the
// same game as Bagholder Brad's challenge). The trade starts with the stake,
// and whatever the account is worth at the closing bell comes back as cash.
export const ECONOMY = {
  startCash: 500,
  stakes: [100, 250, 500], // what a trade can put in (if $cott has it)
  tradesPerFight: 3, // trades refill after every fight, so the market can't be farmed forever
  // A ticker is picked at random for each trade. Parody only.
  tickers: ['$APE', '$MOON', '$HODL', '$YOLO', '$BAGS', '$DOGE2', '$LAMBO', '$RUG'],
};
