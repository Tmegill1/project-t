import { describe, expect, it } from "vitest";
import { resolveDamage } from "./damage";
import type { DamageSource, DamageTarget } from "./damage";

function target(overrides: Partial<DamageTarget> = {}): DamageTarget {
  return { health: 10, maxHealth: 10, alive: true, ...overrides };
}

/** Total time to kill a target, in seconds, for a tower firing at a cadence. */
function timeToKill(
  perHit: number,
  fireRateMs: number,
  t: { health: number; armor?: number; shield?: number },
): number {
  let health = t.health;
  let shield = t.shield ?? 0;
  let shots = 0;
  while (health > 0 && shots < 10_000) {
    const result = resolveDamage(
      { damage: perHit },
      { health, maxHealth: t.health, alive: true, armor: t.armor, shield },
    );

    // A stalled shot is one that neither hurt the target nor spent a shield
    // charge. Checking shield progress *before* reassigning matters: spending
    // the final charge leaves shield at 0, which would otherwise read as a
    // stall and report Infinity for a perfectly winnable fight.
    if (result.damageDealt === 0 && result.remainingShield === shield) {
      return Infinity;
    }

    shield = result.remainingShield;
    health = result.remainingHealth;
    shots++;
  }
  return (shots * fireRateMs) / 1000;
}

function source(overrides: Partial<DamageSource> = {}): DamageSource {
  return { damage: 3, ...overrides };
}

describe("resolveDamage", () => {
  it("subtracts the source's damage from the target's health", () => {
    const result = resolveDamage(source({ damage: 4 }), target({ health: 10 }));
    expect(result.damageDealt).toBe(4);
    expect(result.remainingHealth).toBe(6);
    expect(result.lethal).toBe(false);
  });

  it("reports lethality when health reaches exactly zero", () => {
    const result = resolveDamage(source({ damage: 5 }), target({ health: 5 }));
    expect(result.remainingHealth).toBe(0);
    expect(result.lethal).toBe(true);
  });

  it("reports lethality when damage exceeds health", () => {
    const result = resolveDamage(source({ damage: 50 }), target({ health: 5 }));
    expect(result.lethal).toBe(true);
  });

  it("clamps remaining health at zero rather than going negative", () => {
    const result = resolveDamage(source({ damage: 50 }), target({ health: 5 }));
    expect(result.remainingHealth).toBe(0);
  });

  it("reports only the damage actually absorbed on a killing blow", () => {
    // Overkill is not damage dealt. Phase 3's economy scales rewards off real
    // contribution, so a 50-damage hit on a 5-health target dealt 5.
    const result = resolveDamage(source({ damage: 50 }), target({ health: 5 }));
    expect(result.damageDealt).toBe(5);
  });

  it("is a pure function — it does not mutate the target", () => {
    const t = target({ health: 10 });
    resolveDamage(source({ damage: 4 }), t);
    expect(t.health).toBe(10);
  });

  describe("towers with different damage values", () => {
    // The defect this whole step exists to fix: damage used to be a constant on
    // the projectile, so every tower hit for exactly 3.
    it("applies each source's own damage", () => {
      const t = target({ health: 100 });
      expect(resolveDamage(source({ damage: 3 }), t).remainingHealth).toBe(97);
      expect(resolveDamage(source({ damage: 8 }), t).remainingHealth).toBe(92);
      expect(resolveDamage(source({ damage: 20 }), t).remainingHealth).toBe(80);
    });
  });

  describe("targets that cannot be damaged", () => {
    it("deals nothing to an already-dead target", () => {
      const result = resolveDamage(source({ damage: 5 }), target({ health: 0, alive: false }));
      expect(result.damageDealt).toBe(0);
      expect(result.lethal).toBe(false);
    });

    it("does not re-report lethality on a corpse", () => {
      // Enemies stay in the scene briefly while their death animation plays.
      // Re-killing one would pay its reward twice.
      const result = resolveDamage(source({ damage: 5 }), target({ health: 0, alive: false }));
      expect(result.lethal).toBe(false);
      expect(result.remainingHealth).toBe(0);
    });
  });

  describe("input validation", () => {
    it("treats negative damage as zero rather than healing the target", () => {
      const result = resolveDamage(source({ damage: -5 }), target({ health: 10 }));
      expect(result.damageDealt).toBe(0);
      expect(result.remainingHealth).toBe(10);
    });

    it("handles zero damage without reporting a kill", () => {
      const result = resolveDamage(source({ damage: 0 }), target({ health: 10 }));
      expect(result.damageDealt).toBe(0);
      expect(result.lethal).toBe(false);
    });
  });
});

describe("armour", () => {
  it("reduces each hit by a flat amount", () => {
    const result = resolveDamage(source({ damage: 10 }), target({ health: 50, armor: 3 }));
    expect(result.damageDealt).toBe(7);
    expect(result.armorAbsorbed).toBe(3);
  });

  it("blocks a hit entirely when armour exceeds the damage", () => {
    // No chip floor: a weak hit against heavy armour does nothing at all. This
    // is what makes armour a real counter rather than a tax. See
    // NOTES-FOR-HUMAN.md — the floor is a tuning decision.
    const result = resolveDamage(source({ damage: 2 }), target({ health: 50, armor: 5 }));
    expect(result.damageDealt).toBe(0);
    expect(result.remainingHealth).toBe(50);
    expect(result.lethal).toBe(false);
  });

  it("never turns a blocked hit into healing", () => {
    const result = resolveDamage(source({ damage: 1 }), target({ health: 20, armor: 99 }));
    expect(result.remainingHealth).toBe(20);
  });

  describe("pierce", () => {
    it("ignores that much armour", () => {
      const result = resolveDamage(
        source({ damage: 10, pierce: 3 }),
        target({ health: 50, armor: 3 }),
      );
      expect(result.damageDealt).toBe(10);
      expect(result.armorAbsorbed).toBe(0);
    });

    it("cannot push damage above the source's own value", () => {
      const result = resolveDamage(
        source({ damage: 10, pierce: 99 }),
        target({ health: 50, armor: 3 }),
      );
      expect(result.damageDealt).toBe(10);
    });

    it("partially offsets heavier armour", () => {
      const result = resolveDamage(
        source({ damage: 10, pierce: 2 }),
        target({ health: 50, armor: 6 }),
      );
      expect(result.damageDealt).toBe(6); // 10 - (6 - 2)
    });
  });
});

describe("shields", () => {
  it("absorbs a hit whole, regardless of its size", () => {
    const big = resolveDamage(source({ damage: 999 }), target({ health: 10, shield: 2 }));
    expect(big.damageDealt).toBe(0);
    expect(big.remainingHealth).toBe(10);
    expect(big.remainingShield).toBe(1);
    expect(big.shieldAbsorbed).toBe(true);
  });

  it("costs one charge per hit no matter the damage", () => {
    const small = resolveDamage(source({ damage: 1 }), target({ health: 10, shield: 3 }));
    expect(small.remainingShield).toBe(2);
  });

  it("lets damage through once the charges are gone", () => {
    const result = resolveDamage(source({ damage: 4 }), target({ health: 10, shield: 0 }));
    expect(result.damageDealt).toBe(4);
    expect(result.shieldAbsorbed).toBe(false);
  });

  it("is not consumed by a zero-damage source", () => {
    // Otherwise a tower that cannot hurt the target could still strip its
    // shield for free, which would undo armour as a counter.
    const result = resolveDamage(source({ damage: 0 }), target({ health: 10, shield: 2 }));
    expect(result.remainingShield).toBe(2);
    expect(result.shieldAbsorbed).toBe(false);
  });

  it("takes priority over armour", () => {
    // A shielded, armoured enemy spends the charge first; armour applies only
    // to hits that get through.
    const result = resolveDamage(
      source({ damage: 20 }),
      target({ health: 50, shield: 1, armor: 5 }),
    );
    expect(result.shieldAbsorbed).toBe(true);
    expect(result.armorAbsorbed).toBe(0);
    expect(result.remainingShield).toBe(0);
  });

  it("cannot be pierced", () => {
    // Pierce answers armour, not shields. If it answered both, one upgrade
    // path would counter everything.
    const result = resolveDamage(
      source({ damage: 20, pierce: 99 }),
      target({ health: 50, shield: 2 }),
    );
    expect(result.shieldAbsorbed).toBe(true);
    expect(result.damageDealt).toBe(0);
  });
});

describe("armoured and shielded demand opposite answers", () => {
  // This is the load-bearing claim of Phase 1. If one tower profile beats both,
  // enemy properties are decoration and there is no build decision to make.
  //
  // Profiles use the shipped tower stats: fast is 2 damage every 500ms,
  // long-range is 15 damage every 1500ms. Equal-ish DPS, opposite shapes.
  const FAST = { perHit: 2, fireRate: 500 };
  const HEAVY = { perHit: 15, fireRate: 1500 };

  it("fast low-damage fire beats heavy hits against shields", () => {
    const shielded = { health: 30, shield: 6 };
    const fast = timeToKill(FAST.perHit, FAST.fireRate, shielded);
    const heavy = timeToKill(HEAVY.perHit, HEAVY.fireRate, shielded);
    expect(fast).toBeLessThan(heavy);
  });

  it("heavy hits beat fast low-damage fire against armour", () => {
    const armored = { health: 30, armor: 4 };
    const fast = timeToKill(FAST.perHit, FAST.fireRate, armored);
    const heavy = timeToKill(HEAVY.perHit, HEAVY.fireRate, armored);
    expect(heavy).toBeLessThan(fast);
  });

  it("leaves rapid fire unable to hurt armour at all", () => {
    expect(timeToKill(FAST.perHit, FAST.fireRate, { health: 30, armor: 4 })).toBe(Infinity);
  });

  it("makes neither profile a universal answer", () => {
    const shielded = { health: 30, shield: 6 };
    const armored = { health: 30, armor: 4 };

    const fastWinsShields = timeToKill(FAST.perHit, FAST.fireRate, shielded) <
      timeToKill(HEAVY.perHit, HEAVY.fireRate, shielded);
    const heavyWinsArmour = timeToKill(HEAVY.perHit, HEAVY.fireRate, armored) <
      timeToKill(FAST.perHit, FAST.fireRate, armored);

    expect(fastWinsShields && heavyWinsArmour).toBe(true);
  });
});
