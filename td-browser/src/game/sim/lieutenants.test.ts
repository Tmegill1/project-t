import { describe, expect, it } from "vitest";
import {
  FIRST_LIEUTENANT_WAVE,
  LIEUTENANT_INTERVAL,
  LIEUTENANT_STATS,
  costsLivesOnLeak,
  hasLieutenant,
  lieutenantFor,
  nextLieutenantWave,
} from "./lieutenants";
import { resolveLeakPenalty } from "./leak";
import { hasBoss } from "../data/bosses";

describe("a lieutenant that escapes costs zero lives", () => {
  // The load-bearing rule of the whole phase. If escaping cost lives, killing
  // one would always be correct and the decision would be fake.
  it("says lieutenants do not cost lives on leak", () => {
    expect(costsLivesOnLeak("lieutenant")).toBe(false);
  });

  it("still charges normal enemies and bosses", () => {
    expect(costsLivesOnLeak("normal")).toBe(true);
    // Phase 3 leans on this difference: bosses punish a leak, lieutenants do not.
    expect(costsLivesOnLeak("boss")).toBe(true);
  });

  it("costs nothing through resolveLeakPenalty, at any wave", () => {
    // The exemption has to survive the wave-5 rule, which otherwise charges the
    // enemy's remaining health — and a lieutenant has a great deal of it.
    const lieutenant = { lifeLoss: 5, health: 600, exemptFromLifeLoss: true };
    for (const wave of [1, 5, 6, 10, 25, 40]) {
      expect(resolveLeakPenalty(lieutenant, wave), `wave ${wave}`).toBe(0);
    }
  });

  it("would otherwise cost lives like anything else", () => {
    // Same enemy without the exemption still pays the full capped penalty —
    // a fifth of the starting life pool for a single leak. The exemption is
    // what makes declining a lieutenant free rather than merely cheap.
    const unexempt = { lifeLoss: 5, health: 600 };
    expect(resolveLeakPenalty(unexempt, 10)).toBeGreaterThan(0);
  });

  it("forfeits only the prize", () => {
    // Escaping costs the Insignia the player did not earn. Nothing more.
    expect(LIEUTENANT_STATS.insigniaIfEscaped).toBe(0);
  });
});

describe("hasLieutenant", () => {
  it("stays away from the opening waves", () => {
    for (let wave = 1; wave < FIRST_LIEUTENANT_WAVE; wave++) {
      expect(hasLieutenant(wave), `wave ${wave}`).toBe(false);
    }
  });

  it("appears first at the designated wave", () => {
    expect(hasLieutenant(FIRST_LIEUTENANT_WAVE)).toBe(true);
  });

  it("returns repeatedly across a run", () => {
    let appearances = 0;
    for (let wave = 1; wave <= 20; wave++) if (hasLieutenant(wave)) appearances++;
    expect(appearances).toBeGreaterThanOrEqual(4);
  });

  it("skips the waves between", () => {
    for (let offset = 1; offset < LIEUTENANT_INTERVAL; offset++) {
      expect(hasLieutenant(FIRST_LIEUTENANT_WAVE + offset), `offset ${offset}`).toBe(false);
    }
  });

  it("still appears on the interval when no boss intervenes", () => {
    const next = FIRST_LIEUTENANT_WAVE + LIEUTENANT_INTERVAL;
    if (!hasBoss(next)) expect(hasLieutenant(next)).toBe(true);
  });

  it("comes round often enough to be a habit rather than a curiosity", () => {
    expect(LIEUTENANT_INTERVAL).toBeLessThanOrEqual(5);
  });

  it("never lands on a boss wave", () => {
    // A boss is already a full wave of decision; stacking an optional side
    // objective on it would make the choice about survival, not value.
    for (let wave = 1; wave <= 60; wave++) {
      if (hasBoss(wave)) expect(hasLieutenant(wave), `wave ${wave}`).toBe(false);
    }
  });
});

describe("nextLieutenantWave", () => {
  it("finds the next appearance from any wave", () => {
    expect(nextLieutenantWave(1)).toBe(FIRST_LIEUTENANT_WAVE);
    expect(nextLieutenantWave(6)).toBe(FIRST_LIEUTENANT_WAVE + LIEUTENANT_INTERVAL);
  });

  it("returns the current wave when it already carries one", () => {
    expect(nextLieutenantWave(FIRST_LIEUTENANT_WAVE)).toBe(FIRST_LIEUTENANT_WAVE);
  });

  it("always returns a wave that has one", () => {
    for (let wave = 1; wave <= 40; wave++) {
      expect(hasLieutenant(nextLieutenantWave(wave))).toBe(true);
    }
  });
});

describe("lieutenantFor", () => {
  it("returns nothing on a wave without one", () => {
    expect(lieutenantFor(FIRST_LIEUTENANT_WAVE + 1)).toBeNull();
  });

  it("describes the spawn on a wave with one", () => {
    const spawn = lieutenantFor(FIRST_LIEUTENANT_WAVE);
    expect(spawn).not.toBeNull();
    expect(spawn!.insigniaReward).toBeGreaterThan(0);
    expect(spawn!.escortCount).toBeGreaterThan(0);
  });

  it("makes it substantially tougher than an ordinary enemy", () => {
    expect(LIEUTENANT_STATS.healthMultiplier).toBeGreaterThan(5);
  });

  it("makes it slower than its escort, so it is a wall rather than a racer", () => {
    expect(LIEUTENANT_STATS.speedMultiplier).toBeLessThan(1);
  });

  it("arrives mid-wave, not at the start", () => {
    // The overlap with the ordinary wave is what makes committing towers to it
    // an actual cost rather than a free side objective.
    expect(lieutenantFor(FIRST_LIEUTENANT_WAVE)!.spawnDelayMs).toBeGreaterThan(0);
  });

  it("pays gold as well as Insignia, so killing it is not purely tactical", () => {
    expect(LIEUTENANT_STATS.goldMultiplier).toBeGreaterThan(1);
  });
});
