# legacy/

`scott-money-battle.html` is the original single-file prototype from the
Battle 1 artifact in claude.ai. Open it directly in a browser to play it.

It's reference only; the game never loads it. Per `CLAUDE.md` §5 it is the
source of truth for every combat number, and `tools/legacy-parity.test.mjs`
(run by `npm test`) checks the data in `src/data/` against it. Edit either side
and the test tells you if they've drifted apart.
