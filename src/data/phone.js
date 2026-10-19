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
// `color` is the smartphone's tile and the app's accent on its pages (header, buttons) on both models.
export const APPS = [
  { id: 'map', name: 'MAP', icon: 'map', color: 0x3a9d5d },
  { id: 'social', name: 'Y', icon: 'y', color: 0xe0245e }, // $cott's social app (scenes/SocialScene.js)
  { id: 'stonks', name: 'STONKS', icon: 'chart', color: 0x1f6feb },
  { id: 'realty', name: 'REALTY', icon: 'house', color: 0xd94f70 },
  { id: 'shop', name: 'SHOP', icon: 'bag', color: 0xff8c42 },
  { id: 'settings', name: 'SETTINGS', icon: 'gear', color: 0x6f6888 },
  // Gifted apps show up only once someone gives them to $cott (Save.addApp).
  { id: 'wifi', name: 'WIFI', icon: 'wifi', color: 0x2bb3a3, gift: true }, // the day traders' Wi-Fi sniffer (CLAUDE.md §6.6)
];

// The WIFI app (systems/secrets.js): it lists the networks nearby. A hidden
// one (a map's `secrets`) gets stronger as $cott walks toward it, with a
// compass heading, and can be traced once he's right on top of it.
export const WIFI = {
  bars: [3600, 2200, 1200, 500], // world px: within each, one more bar (4 at the closest)
  traceRange: 260, // close enough to TRACE
  // Networks that are always around, to make the list feel lived in.
  // (Letters, digits, spaces and hyphens: the flip phone's pixel font has no underscore.)
  decoys: ['XFINITYWIFI', 'FBI-VAN-7', 'PRETTY FLY FOR A WIFI', 'MODS-ONLY', 'TELLMYWIFILOVEHER'],
};

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

// SETTINGS' TIME + WEATHER page: sliders that set the regions' clock and
// weather (systems/sky.js). The clock keeps running from the time picked; the
// weather picked lasts as long as weather ever does, then rolls on as usual.
export const SKY = {
  minuteStep: 15, // the time slider's notches, in game minutes
  // What the time slider calls each part of the day (from `at`, in hours), after the swamp's phases (data/looks.js).
  times: [
    { at: 0, name: 'NIGHT' },
    { at: 5, name: 'DAWN' },
    { at: 8.5, name: 'DAY' },
    { at: 17, name: 'GOLDEN HOUR' },
    { at: 18.75, name: 'DUSK' },
    { at: 21.5, name: 'NIGHT' },
  ],
  weather: ['clear', 'fog', 'rain', 'storm'], // the weather slider's stops, left to right (systems/sky.js WEATHER_KINDS)
};
