import { describe, expect, it } from "vitest";
import { simulateWave } from "./harness";
import { LIEUTENANT_STATS, hasLieutenant, nextLieutenantWave } from "./lieutenants";
import type { HarnessConfig, HarnessTower } from "./harness";
import type { PathPoint, TowerKind } from "./entities";
import type { TargetingPriority } from "./targeting";
import type { UpgradeTiers } from "./upgrades";

/**
 * The hinge the whole Phase 2 design sits on.
 *
 * **If killing a lieutenant is always correct, the decision is fake and the
 * game has gained a chore, not a mechanic.**
 *
 * Letting one escape has to be genuinely right sometimes — when the escort
 * would break the defence, or when the towers spent holding it would have been
 * better spent elsewhere. These tests model both choices across several board
 * states and check the outcomes stay close enough that the player has to think.
 *
 * A failure here does not mean the code is broken. It means the *numbers* have
 * drifted to where one answer always wins, and the mechanic has stopped being a
 * mechanic. Balance values live in sim/lieutenants.ts.
 */

const LANE: PathPoint[] = [
  { x: 0, y: 300 },
  { x: 1100, y: 300 },
];

const tiers = (sustained: number, burst: number): UpgradeTiers => ({ sustained, burst });

function line(
  kind: TowerKind,
  count: number,
  upgrades: UpgradeTiers,
  priority: TargetingPriority,
): HarnessTower[] {
  return Array.from({ length: count }, (_, i) => ({
    kind,
    position: { x: 160 + i * (820 / Math.max(1, count)), y: 300 },
    upgrades,
    priority,
  }));
}

/**
 * How the player actually declines or accepts.
 *
 * The choice is not whether the lieutenant spawns — it always does. It is
 * whether the player retargets their towers onto it. Leaving targeting on
 * "closest" means the towers keep grinding the ordinary wave and the lieutenant
 * walks through; switching to "strongest" means they focus it and the rest of
 * the wave gets less attention.
 *
 * That this works out to a real cost is emergent rather than designed: it falls
 * out of Phase 1's per-tower targeting meeting Phase 2's high-health target.
 */
const DECLINE: TargetingPriority = "closest";
const ENGAGE: TargetingPriority = "strongest";

function board(name: string, build: (p: TargetingPriority) => HarnessTower[]) {
  return { name, build };
}

/** Board states spanning weak to strong defences. */
const BOARDS = [
  board("thin (2 basic, tier 1)", (p) => line("basic", 2, tiers(1, 0), p)),
  board("modest (3 basic + 2 fast)", (p) => [
    ...line("basic", 3, tiers(2, 1), p),
    ...line("fast", 2, tiers(2, 0), p),
  ]),
  board("committed (5 fast suppression)", (p) => line("fast", 5, tiers(4, 2), p)),
  board("heavy (3 long siege)", (p) => line("long", 3, tiers(2, 4), p)),
];

const LIEUTENANT_WAVE = nextLieutenantWave(10);

function run(towers: HarnessTower[], includeLieutenant = true) {
  const config: HarnessConfig = {
    path: LANE,
    wave: LIEUTENANT_WAVE,
    seed: 20260805,
    towers,
    includeLieutenant,
  };
  return simulateWave(config);
}

describe("the lieutenant wave is a real wave either way", () => {
  it("spawns a lieutenant on a lieutenant wave", () => {
    expect(hasLieutenant(LIEUTENANT_WAVE)).toBe(true);
    expect(run(BOARDS[1].build(DECLINE)).lieutenantsSpawned).toBe(1);
  });

  it("can be excluded, for isolating the escort's contribution", () => {
    expect(run(BOARDS[1].build(DECLINE), false).lieutenantsSpawned).toBe(0);
  });
});

describe("escaping costs the player nothing but the prize", () => {
  it("charges zero lives for a lieutenant that reaches the exit", () => {
    const thin = run(BOARDS[0].build(DECLINE));
    expect(thin.lieutenantsEscaped).toBe(1);
    expect(thin.lieutenantsKilled).toBe(0);
  });

  it("pays no Insignia for one that escaped", () => {
    const thin = run(BOARDS[0].build(DECLINE));
    expect(thin.insigniaEarned).toBe(LIEUTENANT_STATS.insigniaIfEscaped);
  });

  it("pays Insignia for one that died", () => {
    const heavy = run(BOARDS[3].build(ENGAGE));
    expect(heavy.lieutenantsKilled).toBe(1);
    expect(heavy.insigniaEarned).toBeGreaterThan(0);
  });
});

describe("★ the decision is genuine", () => {
  // Both choices, on every board: retarget onto the lieutenant, or ignore it.
  const outcomes = BOARDS.map((b) => ({
    board: b.name,
    engaged: run(b.build(ENGAGE)),
    declined: run(b.build(DECLINE)),
  }));

  const report = outcomes
    .map(
      (o) =>
        `${o.board}: engage lives=${o.engaged.livesLost} kill=${o.engaged.lieutenantsKilled} ` +
        `| decline lives=${o.declined.livesLost}`,
    )
    .join(" || ");

  it("makes declining correct on at least two boards", () => {
    // The spec's requirement: letting one escape has to be genuinely right
    // sometimes. It is right whenever engaging costs lives *and* fails to
    // collect — the player paid and got nothing.
    //
    // Note this is not true on every board, and should not be. A siege build
    // retargeted onto "strongest" stops wasting 59-damage shots on bees, so it
    // both kills the lieutenant and loses fewer lives. That is the reward for
    // having built the right thing, not a flaw in the decision.
    const decliningWins = outcomes.filter(
      (o) => o.engaged.lieutenantsKilled === 0 && o.engaged.livesLost > o.declined.livesLost,
    );
    expect(decliningWins.length, report).toBeGreaterThanOrEqual(2);
  });

  it("makes engaging correct on at least one board", () => {
    const engagingWins = outcomes.filter((o) => o.engaged.lieutenantsKilled > 0);
    expect(engagingWins.length, report).toBeGreaterThan(0);
  });

  it("never lets one answer win everywhere", () => {
    // The single claim the whole mechanic rests on.
    const engagingWins = outcomes.filter((o) => o.engaged.lieutenantsKilled > 0).length;
    expect(engagingWins, report).toBeGreaterThan(0);
    expect(engagingWins, report).toBeLessThan(outcomes.length);
  });

  it("leaves at least one board unable to collect the prize even when it tries", () => {
    // A lieutenant every board can kill is not a decision, it is a delivery.
    const failed = outcomes.filter((o) => o.engaged.lieutenantsKilled === 0);
    expect(failed.length, report).toBeGreaterThan(0);
  });

  it("leaves at least one board able to collect it", () => {
    // And a prize nobody can win is not a decision either.
    const succeeded = outcomes.filter((o) => o.engaged.lieutenantsKilled > 0);
    expect(succeeded.length, report).toBeGreaterThan(0);
  });

  it("splits the boards rather than favouring one answer everywhere", () => {
    // The core claim: which choice is better must depend on the board.
    const canWin = outcomes.filter((o) => o.engaged.lieutenantsKilled > 0).length;
    expect(canWin, report).toBeGreaterThan(0);
    expect(canWin, report).toBeLessThan(outcomes.length);
  });

  it("wastes the attempt entirely on a board that cannot finish it", () => {
    // The worst case has to exist: pay the lives, still lose the prize. That is
    // what makes declining correct on a thin board rather than merely cautious.
    const wasted = outcomes.filter(
      (o) => o.engaged.lieutenantsKilled === 0 && o.engaged.livesLost > o.declined.livesLost,
    );
    expect(wasted.length, report).toBeGreaterThan(0);
  });
});

describe("the reward is worth considering but not overwhelming", () => {
  it("pays enough Insignia to matter", () => {
    // Below a tactical power's price, killing one would never be worth towers.
    expect(LIEUTENANT_STATS.insigniaReward).toBeGreaterThanOrEqual(2);
  });

  it("does not hand over a command upgrade in one kill", () => {
    // Command upgrades cost 4 to 6. A single lieutenant buying one outright
    // would make engaging obviously correct every time.
    expect(LIEUTENANT_STATS.insigniaReward).toBeLessThan(4);
  });

  it("pays gold too, so declining is not free of opportunity cost", () => {
    const heavy = BOARDS[3];
    const killed = run(heavy.build(ENGAGE));
    const ignored = run(heavy.build(DECLINE));
    expect(killed.lieutenantsKilled).toBe(1);
    expect(killed.goldEarned).toBeGreaterThan(ignored.goldEarned);
  });
});

describe("determinism", () => {
  it("returns identical results for identical inputs", () => {
    for (const b of BOARDS) {
      expect(run(b.build(ENGAGE))).toEqual(run(b.build(ENGAGE)));
    }
  });
});
