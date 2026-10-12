// Enemy move choice, driven by each villain's `ai` data (CLAUDE.md §5.9):
// rules are checked in order; a rule whose conditions hold fires with its
// `chance`. If none fires, pick from moves with a weight > 0.

function conditionsHold(when = {}, target) {
  if (when.targetLacksStatus && target.statuses.has(when.targetLacksStatus)) return false;
  if (when.targetHasStatus && !target.statuses.has(when.targetHasStatus)) return false;
  if (when.targetFlowAtLeast !== undefined && target.flow < when.targetFlowAtLeast) return false;
  return true;
}

export function chooseEnemyMove(enemy, target, rng) {
  const { moves, ai } = enemy.def;
  for (const rule of ai?.rules ?? []) {
    if (!conditionsHold(rule.when, target)) continue;
    if (rng.chance(rule.chance)) {
      const move = moves.find((m) => m.id === rule.move);
      if (move) return move;
    }
  }
  return rng.weighted(moves.filter((m) => m.weight > 0));
}
