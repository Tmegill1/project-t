import { describe, expect, it } from "vitest";
import {
  allPassiveIds,
  availableCommands,
  availablePowers,
  availableTowers,
  bankRun,
  buyPassive,
  canBuyPassive,
  isTowerUnlocked,
  metaBonuses,
  passiveBonus,
  passiveCost,
  unlockCommand,
  unlockPower,
  unlockTower,
} from "./metaProgression";
import { META_PASSIVES, META_PASSIVE_CEILING } from "../data/metaUpgrades";
import { createNewSave } from "../meta/saveSchema";
import { sealsForRun } from "./currencies";
import type { SaveData } from "../meta/saveSchema";

const withSeals = (seals: number): SaveData => ({ ...createNewSave(), seals });

describe("★ the passive ceiling is enforced in code", () => {
  // The load-bearing rule of the phase. If meta upgrades beat the game, skill
  // stops mattering and a new player is simply told to grind. The guarantee
  // must live somewhere a data typo cannot reach.
  it("caps every passive at the ceiling when fully bought", () => {
    for (const id of allPassiveIds()) {
      const maxed: SaveData = {
        ...createNewSave(),
        passives: { [id]: META_PASSIVES[id].maxTier },
      };
      expect(passiveBonus(maxed, id), id).toBeLessThanOrEqual(META_PASSIVE_CEILING);
    }
  });

  it("caps a save claiming an absurd tier", () => {
    // A hand-edited save, or a data typo, must not become power.
    for (const id of allPassiveIds()) {
      const cheated: SaveData = { ...createNewSave(), passives: { [id]: 9999 } };
      expect(passiveBonus(cheated, id), id).toBeLessThanOrEqual(META_PASSIVE_CEILING);
    }
  });

  it("ignores a negative tier", () => {
    const odd: SaveData = { ...createNewSave(), passives: { veteranCrews: -5 } };
    expect(passiveBonus(odd, "veteranCrews")).toBe(0);
  });

  it("keeps every run bonus within one plus the ceiling", () => {
    const maxed: SaveData = {
      ...createNewSave(),
      passives: Object.fromEntries(allPassiveIds().map((id) => [id, 9999])),
    };
    const bonuses = metaBonuses(maxed);
    for (const [name, value] of Object.entries(bonuses)) {
      expect(value, name).toBeLessThanOrEqual(1 + META_PASSIVE_CEILING);
      expect(value, name).toBeGreaterThanOrEqual(1);
    }
  });

  it("stays inside the 5-10% band the design specifies", () => {
    expect(META_PASSIVE_CEILING).toBeGreaterThanOrEqual(0.05);
    expect(META_PASSIVE_CEILING).toBeLessThanOrEqual(0.1);
  });

  it("gives a fresh profile no bonus at all", () => {
    const bonuses = metaBonuses(createNewSave());
    for (const value of Object.values(bonuses)) expect(value).toBe(1);
  });
});

describe("buying passives", () => {
  it("charges and applies a tier", () => {
    const result = buyPassive(withSeals(100), "veteranCrews");
    expect(result.ok).toBe(true);
    expect(result.save.passives.veteranCrews).toBe(1);
    expect(result.save.seals).toBeLessThan(100);
  });

  it("refuses when the player cannot pay", () => {
    expect(buyPassive(withSeals(0), "veteranCrews").ok).toBe(false);
  });

  it("gets more expensive per tier", () => {
    let save = withSeals(1000);
    let previous = 0;
    for (let i = 0; i < META_PASSIVES.veteranCrews.maxTier; i++) {
      const cost = passiveCost(save, "veteranCrews");
      expect(cost).toBeGreaterThan(previous);
      previous = cost;
      save = buyPassive(save, "veteranCrews").save;
    }
  });

  it("refuses past the maximum tier", () => {
    let save = withSeals(10_000);
    for (let i = 0; i < META_PASSIVES.veteranCrews.maxTier; i++) {
      save = buyPassive(save, "veteranCrews").save;
    }
    expect(canBuyPassive(save, "veteranCrews")).toBe(false);
    expect(buyPassive(save, "veteranCrews").ok).toBe(false);
    expect(passiveCost(save, "veteranCrews")).toBe(0);
  });

  it("is pure", () => {
    const save = withSeals(100);
    buyPassive(save, "veteranCrews");
    expect(save.seals).toBe(100);
    expect(save.passives).toEqual({});
  });
});

describe("unlocks gate what is available in a run", () => {
  it("always allows the basic tower", () => {
    expect(availableTowers(createNewSave())).toContain("basic");
  });

  it("withholds the others until bought", () => {
    const fresh = createNewSave();
    expect(isTowerUnlocked(fresh, "fast")).toBe(false);
    expect(isTowerUnlocked(fresh, "long")).toBe(false);
  });

  it("grants a tower once bought", () => {
    const result = unlockTower(withSeals(200), "fast");
    expect(result.ok).toBe(true);
    expect(isTowerUnlocked(result.save, "fast")).toBe(true);
  });

  it("refuses an unaffordable unlock", () => {
    expect(unlockTower(withSeals(0), "fast").ok).toBe(false);
  });

  it("refuses to buy the same tower twice", () => {
    const once = unlockTower(withSeals(200), "fast").save;
    expect(unlockTower(once, "fast").ok).toBe(false);
  });

  it("refuses a tower that is not for sale", () => {
    // BasicTower is granted, never purchased.
    expect(unlockTower(withSeals(500), "basic").ok).toBe(false);
  });

  describe("powers", () => {
    it("starts with one, so a new player has something to learn with", () => {
      expect(availablePowers(createNewSave())).toEqual(["barrage"]);
    });

    it("adds a power to the in-run pool once bought", () => {
      const result = unlockPower(withSeals(200), "overcharge");
      expect(result.ok).toBe(true);
      expect(availablePowers(result.save)).toContain("overcharge");
    });

    it("refuses a duplicate", () => {
      const once = unlockPower(withSeals(200), "overcharge").save;
      expect(unlockPower(once, "overcharge").ok).toBe(false);
    });
  });

  describe("command upgrades", () => {
    it("starts with none", () => {
      expect(availableCommands(createNewSave())).toEqual([]);
    });

    it("adds one once bought", () => {
      const result = unlockCommand(withSeals(200), "sensorNet");
      expect(result.ok).toBe(true);
      expect(availableCommands(result.save)).toContain("sensorNet");
    });
  });

  it("buys options rather than power", () => {
    // Unlocks widen what may be built; they do not make anything stronger.
    // Only passives do that, and only up to the ceiling.
    let save = withSeals(500);
    save = unlockTower(save, "fast").save;
    save = unlockTower(save, "long").save;
    save = unlockPower(save, "overcharge").save;

    const bonuses = metaBonuses(save);
    for (const value of Object.values(bonuses)) expect(value).toBe(1);
  });
});

describe("bankRun", () => {
  const outcome = { wavesSurvived: 14, bossesKilled: 1, unspentInsignia: 6, sealsEarned: 22 };

  it("adds the Seals earned", () => {
    expect(bankRun(withSeals(10), outcome).seals).toBe(32);
  });

  it("tracks lifetime Seals separately, and never spends them", () => {
    const after = bankRun(createNewSave(), outcome);
    expect(after.lifetimeSeals).toBe(22);

    const spent = buyPassive({ ...after, seals: 100 }, "veteranCrews").save;
    expect(spent.lifetimeSeals).toBe(22);
  });

  it("records the best wave without regressing on a worse run", () => {
    const good = bankRun(createNewSave(), { ...outcome, wavesSurvived: 30 });
    const bad = bankRun(good, { ...outcome, wavesSurvived: 4 });
    expect(bad.stats.bestWave).toBe(30);
  });

  it("counts runs and bosses cumulatively", () => {
    const twice = bankRun(bankRun(createNewSave(), outcome), outcome);
    expect(twice.stats.runsPlayed).toBe(2);
    expect(twice.stats.bossesKilled).toBe(2);
  });

  it("ignores a negative payout", () => {
    expect(bankRun(withSeals(10), { ...outcome, sealsEarned: -50 }).seals).toBe(10);
  });

  it("is pure", () => {
    const save = withSeals(10);
    bankRun(save, outcome);
    expect(save.seals).toBe(10);
  });
});

describe("the final-wave choice", () => {
  it("makes unspent Insignia worth banking, but worth less than spending", () => {
    // The decision the design wants on the last wave: spend to survive, or
    // bank for permanent progress.
    const hoarded = sealsForRun({ wavesSurvived: 10, bossesKilled: 1, unspentInsignia: 10 });
    const spent = sealsForRun({ wavesSurvived: 10, bossesKilled: 1, unspentInsignia: 0 });

    expect(hoarded.total).toBeGreaterThan(spent.total);
    expect(hoarded.fromInsignia).toBeLessThan(10);
  });

  it("pays more for surviving further than for hoarding", () => {
    // Otherwise the correct play is to stop trying and sit on Insignia.
    const survivedLonger = sealsForRun({ wavesSurvived: 20, bossesKilled: 1, unspentInsignia: 0 });
    const hoardedInstead = sealsForRun({ wavesSurvived: 10, bossesKilled: 1, unspentInsignia: 10 });
    expect(survivedLonger.total).toBeGreaterThan(hoardedInstead.total);
  });
});
