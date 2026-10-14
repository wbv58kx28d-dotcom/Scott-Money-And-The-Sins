// Stonks market math (data/phone.js): a price that random-walks from 1.0,
// with a small upward drift and a chance per tick of getting rugged. No
// Phaser here, so it can be unit-tested in Node.

/** A live market for one ticker. `rng` is a systems/rng.js stream. */
export function createMarket(stock, rng) {
  const history = [1];
  let price = 1;
  let rugged = false;
  return {
    stock,
    history,
    get price() {
      return price;
    },
    get rugged() {
      return rugged;
    },
    /** Move the price one tick. Once rugged, it stays down. */
    tick() {
      if (rugged) return price;
      if (stock.rug && rng.chance(stock.rug)) {
        rugged = true;
        price *= 1 - stock.rugDrop;
      } else {
        price *= 1 + stock.drift + rng.range(-stock.vol, stock.vol);
      }
      price = Math.max(0.01, price);
      history.push(price);
      return price;
    },
  };
}

/** What selling a `stake` bought at 1.0 is worth at `price`, in whole dollars. */
export const payout = (stake, price) => Math.max(0, Math.round(stake * price));

/** "+12.4%" / "-3.0%" for a price relative to the 1.0 buy-in. */
export function changeLabel(price) {
  const pct = (price - 1) * 100;
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;
}

/** "$1,250" */
export const money = (n) => `$${Math.round(n).toLocaleString('en-US')}`;
