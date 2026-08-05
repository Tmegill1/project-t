import { describe, expect, it } from "vitest";
import {
  CURRENCIES,
  SEAL_CONVERSION,
  canEarn,
  createRunCurrencies,
  earn,
  sealsForRun,
  spend,
} from "./currencies";

describe("CURRENCIES", () => {
  it("has the three the design calls for", () => {
    expect([...CURRENCIES]).toEqual(["gold", "insignia", "seals"]);
  });
});

describe("canEarn", () => {
  // The boundaries are the economy. The moment an ordinary kill pays Insignia,
  // lieutenants stop being a decision and become a grind.
  it("pays gold for ordinary play", () => {
    expect(canEarn("gold", "kill")).toBe(true);
    expect(canEarn("gold", "wave-clear")).toBe(true);
  });

  it("pays Insignia only for lieutenants and bosses", () => {
    expect(canEarn("insignia", "lieutenant")).toBe(true);
    expect(canEarn("insignia", "boss")).toBe(true);

    expect(canEarn("insignia", "kill")).toBe(false);
    expect(canEarn("insignia", "wave-clear")).toBe(false);
    expect(canEarn("insignia", "run-end")).toBe(false);
  });

  it("never pays gold from a lieutenant source alone", () => {
    // Lieutenants do pay gold, but through the ordinary kill path — the
    // lieutenant source exists solely for Insignia.
    expect(canEarn("gold", "lieutenant")).toBe(false);
  });

  it("pays Seals only at the end of a run", () => {
    expect(canEarn("seals", "run-end")).toBe(true);
    expect(canEarn("seals", "kill")).toBe(false);
    expect(canEarn("seals", "lieutenant")).toBe(false);
  });
});

describe("earn", () => {
  const balances = createRunCurrencies(100);

  it("adds to the balance", () => {
    expect(earn(balances, "gold", 25, "kill").gold).toBe(125);
  });

  it("is pure", () => {
    earn(balances, "gold", 25, "kill");
    expect(balances.gold).toBe(100);
  });

  it("refuses a source that may not pay that currency", () => {
    expect(() => earn(balances, "insignia", 5, "kill")).toThrow();
    expect(() => earn(balances, "insignia", 5, "wave-clear")).toThrow();
  });

  it("allows lieutenants to pay Insignia", () => {
    expect(earn(balances, "insignia", 3, "lieutenant").insignia).toBe(3);
  });

  it("refuses a negative amount", () => {
    expect(() => earn(balances, "gold", -10, "kill")).toThrow();
  });
});

describe("spend", () => {
  const balances = { gold: 100, insignia: 5 };

  it("deducts and reports success", () => {
    expect(spend(balances, "gold", 40)).toEqual({ balances: { gold: 60, insignia: 5 }, ok: true });
  });

  it("allows spending the balance exactly", () => {
    expect(spend(balances, "insignia", 5).ok).toBe(true);
  });

  it("refuses to overspend and leaves the balance alone", () => {
    expect(spend(balances, "insignia", 6)).toEqual({ balances, ok: false });
  });

  it("refuses a negative amount", () => {
    expect(spend(balances, "gold", -5).ok).toBe(false);
  });

  it("keeps the two currencies independent", () => {
    const after = spend(balances, "gold", 100).balances;
    expect(after.insignia).toBe(5);
  });
});

describe("createRunCurrencies", () => {
  it("starts with the given gold and no Insignia", () => {
    expect(createRunCurrencies(250)).toEqual({ gold: 250, insignia: 0 });
  });

  it("never starts negative", () => {
    expect(createRunCurrencies(-50).gold).toBe(0);
  });
});

describe("sealsForRun", () => {
  it("pays for waves survived and bosses killed", () => {
    const breakdown = sealsForRun({ wavesSurvived: 10, bossesKilled: 1, unspentInsignia: 0 });
    expect(breakdown.fromWaves).toBe(10 * SEAL_CONVERSION.perWaveSurvived);
    expect(breakdown.fromBosses).toBe(1 * SEAL_CONVERSION.perBossKilled);
    expect(breakdown.total).toBe(breakdown.fromWaves + breakdown.fromBosses);
  });

  it("converts unspent Insignia", () => {
    // This is what creates the final-wave choice: spend to survive, or bank it.
    const breakdown = sealsForRun({ wavesSurvived: 0, bossesKilled: 0, unspentInsignia: 10 });
    expect(breakdown.fromInsignia).toBeGreaterThan(0);
  });

  it("values banked Insignia below what spending it would have bought", () => {
    // Otherwise hoarding is strictly correct and the powers go unused.
    expect(SEAL_CONVERSION.perUnspentInsignia).toBeLessThan(1);
  });

  it("returns whole Seals", () => {
    const breakdown = sealsForRun({ wavesSurvived: 3, bossesKilled: 0, unspentInsignia: 7 });
    expect(Number.isInteger(breakdown.total)).toBe(true);
  });

  it("pays nothing for a run that achieved nothing", () => {
    expect(sealsForRun({ wavesSurvived: 0, bossesKilled: 0, unspentInsignia: 0 }).total).toBe(0);
  });

  it("degrades gracefully on nonsense input rather than paying out", () => {
    const breakdown = sealsForRun({
      wavesSurvived: -5,
      bossesKilled: -1,
      unspentInsignia: -100,
    });
    expect(breakdown.total).toBe(0);
  });

  it("itemises so the summary screen can show its work", () => {
    const breakdown = sealsForRun({ wavesSurvived: 8, bossesKilled: 2, unspentInsignia: 6 });
    expect(breakdown.fromWaves + breakdown.fromBosses + breakdown.fromInsignia).toBe(
      breakdown.total,
    );
  });
});
