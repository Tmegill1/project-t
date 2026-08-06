import { describe, expect, it } from "vitest";
import { callEarlyBonus, interestOn, waveClearReward } from "./economy";
import { ECONOMY } from "../data/economy";

describe("interestOn", () => {
  it("pays a fraction of the banked balance", () => {
    expect(interestOn(200)).toBe(Math.floor(200 * ECONOMY.interest.ratePerWave));
  });

  describe("the cap", () => {
    // Load-bearing. Uncapped compounding makes hoarding strictly better than
    // building, which inverts the entire game.
    it("never pays more than the cap, however large the balance", () => {
      for (const balance of [1_000, 10_000, 1_000_000]) {
        expect(interestOn(balance)).toBeLessThanOrEqual(ECONOMY.interest.maxPerWave);
      }
    });

    it("reaches the cap and stops", () => {
      const atCap = Math.ceil(ECONOMY.interest.maxPerWave / ECONOMY.interest.ratePerWave);
      expect(interestOn(atCap)).toBe(ECONOMY.interest.maxPerWave);
      expect(interestOn(atCap * 5)).toBe(ECONOMY.interest.maxPerWave);
    });

    it("makes banking beyond the cap worthless, so gold has to be spent", () => {
      const wellPastCap = 100_000;
      expect(interestOn(wellPastCap)).toBe(interestOn(wellPastCap * 10));
    });
  });

  it("pays nothing below the minimum balance, so it never trickles", () => {
    expect(interestOn(ECONOMY.interest.minimumBalance - 1)).toBe(0);
    expect(interestOn(0)).toBe(0);
  });

  it("pays nothing on a negative balance", () => {
    expect(interestOn(-500)).toBe(0);
  });

  it("returns whole gold", () => {
    for (const balance of [51, 137, 999]) {
      expect(Number.isInteger(interestOn(balance))).toBe(true);
    }
  });
});

describe("callEarlyBonus", () => {
  const { prepDurationMs, goldPerSecond, maxBonus } = ECONOMY.callEarly;

  it("pays per full second of prep given up", () => {
    expect(callEarlyBonus(5_000)).toBe(5 * goldPerSecond);
  });

  it("pays nothing when the prep window has run out", () => {
    expect(callEarlyBonus(0)).toBe(0);
  });

  it("pays nothing for a negative remainder", () => {
    expect(callEarlyBonus(-4_000)).toBe(0);
  });

  it("rounds down to whole seconds", () => {
    expect(callEarlyBonus(2_999)).toBe(2 * goldPerSecond);
  });

  it("is capped, so rushing cannot dominate clearing", () => {
    expect(callEarlyBonus(prepDurationMs)).toBeLessThanOrEqual(maxBonus);
    expect(callEarlyBonus(prepDurationMs * 100)).toBeLessThanOrEqual(maxBonus);
  });

  it("rises with the time given up", () => {
    expect(callEarlyBonus(10_000)).toBeGreaterThan(callEarlyBonus(3_000));
  });

  it("never exceeds the wave-clear bonus by much", () => {
    // Otherwise the correct play is always to rush, and the prep window — the
    // thing that lets a player react to what is coming — becomes a trap.
    const clearBonus = waveClearReward(10, 0, 0).total;
    expect(callEarlyBonus(prepDurationMs)).toBeLessThan(clearBonus);
  });
});

describe("waveClearReward", () => {
  const { fastClearMs, slowClearMs, maxSpeedBonus, baseBonus, bonusPerWave } = ECONOMY.waveClear;

  it("pays a base that grows with the wave number", () => {
    expect(waveClearReward(1, fastClearMs, 0).base).toBe(baseBonus + bonusPerWave);
    expect(waveClearReward(10, fastClearMs, 0).base).toBe(baseBonus + 10 * bonusPerWave);
  });

  describe("the speed component", () => {
    it("pays in full for a fast clear", () => {
      expect(waveClearReward(5, fastClearMs, 0).speed).toBe(maxSpeedBonus);
      expect(waveClearReward(5, 0, 0).speed).toBe(maxSpeedBonus);
    });

    it("pays nothing for a slow one", () => {
      expect(waveClearReward(5, slowClearMs, 0).speed).toBe(0);
      expect(waveClearReward(5, slowClearMs * 10, 0).speed).toBe(0);
    });

    it("scales between the two", () => {
      const midpoint = (fastClearMs + slowClearMs) / 2;
      const speed = waveClearReward(5, midpoint, 0).speed;
      expect(speed).toBeGreaterThan(0);
      expect(speed).toBeLessThan(maxSpeedBonus);
    });

    it("never pays more for a slower clear", () => {
      let previous = Infinity;
      for (let ms = 0; ms <= slowClearMs * 1.5; ms += 5_000) {
        const speed = waveClearReward(5, ms, 0).speed;
        expect(speed).toBeLessThanOrEqual(previous);
        previous = speed;
      }
    });
  });

  it("includes capped interest on the banked balance", () => {
    expect(waveClearReward(5, fastClearMs, 400).interest).toBe(interestOn(400));
    expect(waveClearReward(5, fastClearMs, 1_000_000).interest).toBeLessThanOrEqual(
      ECONOMY.interest.maxPerWave,
    );
  });

  it("itemises so the UI can show why the player was paid", () => {
    const reward = waveClearReward(7, 30_000, 300);
    expect(reward.base + reward.speed + reward.interest).toBe(reward.total);
  });

  it("always pays something for clearing, however slowly", () => {
    expect(waveClearReward(1, slowClearMs * 10, 0).total).toBeGreaterThan(0);
  });

  it("returns whole gold", () => {
    const reward = waveClearReward(9, 27_531, 317);
    for (const value of [reward.base, reward.speed, reward.interest, reward.total]) {
      expect(Number.isInteger(value)).toBe(true);
    }
  });
});

describe("the incentives point the right way", () => {
  it("rewards clearing fast more than sitting on gold", () => {
    // A defence that kills should out-earn one that hoards, or the game
    // rewards passivity.
    const fastAndBroke = waveClearReward(10, ECONOMY.waveClear.fastClearMs, 0);
    const slowAndRich = waveClearReward(10, ECONOMY.waveClear.slowClearMs, 600);
    expect(fastAndBroke.total).toBeGreaterThan(slowAndRich.total - fastAndBroke.base);
  });

  it("keeps every source bounded, so none can run away", () => {
    const extreme = waveClearReward(500, 0, 10_000_000);
    expect(extreme.speed).toBeLessThanOrEqual(ECONOMY.waveClear.maxSpeedBonus);
    expect(extreme.interest).toBeLessThanOrEqual(ECONOMY.interest.maxPerWave);
  });
});
