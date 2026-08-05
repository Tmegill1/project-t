import { describe, expect, it } from "vitest";
import {
  buyCommandUpgrade,
  canCast,
  castPower,
  commandModifiers,
  cooldownRemaining,
  createPowerState,
  currentModifiers,
  effectiveCooldown,
  isUnlocked,
  pruneExpired,
  unlockPower,
} from "./powers";
import type { PowerState } from "./powers";
import { COMMAND_UPGRADES, COMMAND_UPGRADE_IDS, TACTICAL_POWERS, TACTICAL_POWER_IDS } from "../data/powers";

/** A state with everything unlocked, for testing casting rather than buying. */
function armed(): PowerState {
  return { ...createPowerState(), unlocked: [...TACTICAL_POWER_IDS] };
}

describe("the catalogue meets the design's minimum", () => {
  it("offers at least four tactical powers", () => {
    expect(TACTICAL_POWER_IDS.length).toBeGreaterThanOrEqual(4);
  });

  it("offers at least four command upgrades", () => {
    expect(COMMAND_UPGRADE_IDS.length).toBeGreaterThanOrEqual(4);
  });

  it("gives every power a cost, a cooldown, and readable text", () => {
    for (const id of TACTICAL_POWER_IDS) {
      const power = TACTICAL_POWERS[id];
      expect(power.cost, id).toBeGreaterThan(0);
      expect(power.cooldownMs, id).toBeGreaterThan(0);
      // Touch-first: the button has to explain itself without a hover.
      expect(power.description.length, id).toBeGreaterThan(10);
    }
  });

  it("gives every command upgrade a cost and readable text", () => {
    for (const id of COMMAND_UPGRADE_IDS) {
      expect(COMMAND_UPGRADES[id].cost, id).toBeGreaterThan(0);
      expect(COMMAND_UPGRADES[id].description.length, id).toBeGreaterThan(10);
    }
  });

  it("makes every power do something", () => {
    for (const id of TACTICAL_POWER_IDS) {
      expect(Object.keys(TACTICAL_POWERS[id].effects).length, id).toBeGreaterThan(0);
    }
  });
});

describe("unlockPower", () => {
  it("unlocks when the player can pay", () => {
    const result = unlockPower(createPowerState(), "barrage", 10);
    expect(result.ok).toBe(true);
    expect(isUnlocked(result.state, "barrage")).toBe(true);
  });

  it("refuses when the player cannot pay", () => {
    const result = unlockPower(createPowerState(), "barrage", 0);
    expect(result.ok).toBe(false);
    expect(isUnlocked(result.state, "barrage")).toBe(false);
  });

  it("allows a purchase that spends the balance exactly", () => {
    expect(unlockPower(createPowerState(), "barrage", TACTICAL_POWERS.barrage.cost).ok).toBe(true);
  });

  it("refuses a duplicate rather than charging twice", () => {
    const once = unlockPower(createPowerState(), "barrage", 10).state;
    expect(unlockPower(once, "barrage", 10).ok).toBe(false);
  });

  it("is pure", () => {
    const state = createPowerState();
    unlockPower(state, "barrage", 10);
    expect(state.unlocked).toEqual([]);
  });

  it("reports the price so the caller can charge it", () => {
    expect(unlockPower(createPowerState(), "overcharge", 10).cost).toBe(
      TACTICAL_POWERS.overcharge.cost,
    );
  });
});

describe("buyCommandUpgrade", () => {
  it("buys when affordable", () => {
    const result = buyCommandUpgrade(createPowerState(), "sensorNet", 10);
    expect(result.ok).toBe(true);
    expect(result.state.commands).toContain("sensorNet");
  });

  it("refuses when unaffordable", () => {
    expect(buyCommandUpgrade(createPowerState(), "sensorNet", 1).ok).toBe(false);
  });

  it("refuses a duplicate", () => {
    const once = buyCommandUpgrade(createPowerState(), "sensorNet", 10).state;
    expect(buyCommandUpgrade(once, "sensorNet", 10).ok).toBe(false);
  });
});

describe("casting", () => {
  it("refuses a power that was never unlocked", () => {
    expect(canCast(createPowerState(), "barrage", 0)).toBe(false);
    expect(castPower(createPowerState(), "barrage", 0).ok).toBe(false);
  });

  it("casts an unlocked power", () => {
    expect(castPower(armed(), "barrage", 0).ok).toBe(true);
  });

  it("returns instant damage for a power that has it", () => {
    const result = castPower(armed(), "barrage", 0);
    expect(result.instantDamage).toBe(TACTICAL_POWERS.barrage.effects.instantDamage);
    expect(result.instantPierce).toBe(TACTICAL_POWERS.barrage.effects.instantPierce);
  });

  it("returns no instant damage for a duration power", () => {
    expect(castPower(armed(), "overcharge", 0).instantDamage).toBe(0);
  });

  describe("cooldowns", () => {
    it("blocks a second cast immediately after the first", () => {
      const after = castPower(armed(), "barrage", 1000).state;
      expect(canCast(after, "barrage", 1000)).toBe(false);
      expect(castPower(after, "barrage", 1000).ok).toBe(false);
    });

    it("still blocks one millisecond before it is ready", () => {
      const after = castPower(armed(), "barrage", 0).state;
      const cooldown = TACTICAL_POWERS.barrage.cooldownMs;
      expect(canCast(after, "barrage", cooldown - 1)).toBe(false);
    });

    it("allows the cast the moment the cooldown elapses", () => {
      const after = castPower(armed(), "barrage", 0).state;
      expect(canCast(after, "barrage", TACTICAL_POWERS.barrage.cooldownMs)).toBe(true);
    });

    it("reports the time remaining, counting down to zero", () => {
      const after = castPower(armed(), "barrage", 0).state;
      const cooldown = TACTICAL_POWERS.barrage.cooldownMs;
      expect(cooldownRemaining(after, "barrage", 0)).toBe(cooldown);
      expect(cooldownRemaining(after, "barrage", cooldown / 2)).toBe(cooldown / 2);
      expect(cooldownRemaining(after, "barrage", cooldown)).toBe(0);
      expect(cooldownRemaining(after, "barrage", cooldown * 10)).toBe(0);
    });

    it("keeps each power's cooldown independent", () => {
      const after = castPower(armed(), "barrage", 0).state;
      expect(canCast(after, "overcharge", 0)).toBe(true);
    });

    it("is shortened by Rapid Response", () => {
      const withUpgrade = buyCommandUpgrade(armed(), "rapidResponse", 10).state;
      expect(effectiveCooldown(withUpgrade, "barrage")).toBeLessThan(
        TACTICAL_POWERS.barrage.cooldownMs,
      );
    });
  });

  describe("effect expiry", () => {
    it("applies an effect while it lasts", () => {
      const after = castPower(armed(), "overcharge", 0).state;
      expect(currentModifiers(after, 0).damageMultiplier).toBe(2);
      expect(currentModifiers(after, TACTICAL_POWERS.overcharge.durationMs - 1).damageMultiplier)
        .toBe(2);
    });

    it("stops applying it the instant it expires", () => {
      const after = castPower(armed(), "overcharge", 0).state;
      const duration = TACTICAL_POWERS.overcharge.durationMs;
      expect(currentModifiers(after, duration).damageMultiplier).toBe(1);
      expect(currentModifiers(after, duration + 5000).damageMultiplier).toBe(1);
    });

    it("expires correctly even if nobody pruned", () => {
      // A caller that forgets housekeeping must still get correct answers.
      const after = castPower(armed(), "timeDilation", 0).state;
      const late = TACTICAL_POWERS.timeDilation.durationMs + 1;
      expect(after.active).toHaveLength(1);
      expect(currentModifiers(after, late).enemySpeedMultiplier).toBe(1);
    });

    it("prunes expired effects when asked", () => {
      const after = castPower(armed(), "timeDilation", 0).state;
      const pruned = pruneExpired(after, TACTICAL_POWERS.timeDilation.durationMs + 1);
      expect(pruned.active).toHaveLength(0);
    });

    it("refreshes rather than stacking on a recast", () => {
      // Otherwise a player could double a duration by casting the instant the
      // cooldown lifts, and the effect's value would depend on button mashing.
      let state = castPower(armed(), "overcharge", 0).state;
      state = { ...state, readyAtMs: {} }; // pretend the cooldown lapsed
      state = castPower(state, "overcharge", 1000).state;

      expect(state.active).toHaveLength(1);
      expect(currentModifiers(state, 1000).damageMultiplier).toBe(2);
    });

    it("combines different powers multiplicatively", () => {
      let state = castPower(armed(), "overcharge", 0).state;
      state = castPower(state, "bountyStrike", 0).state;
      const modifiers = currentModifiers(state, 0);
      expect(modifiers.damageMultiplier).toBe(2);
      expect(modifiers.goldMultiplier).toBe(3);
    });
  });
});

describe("command modifiers", () => {
  it("does nothing when nothing is bought", () => {
    expect(commandModifiers(createPowerState())).toEqual({
      damageMultiplier: 1,
      enemySpeedMultiplier: 1,
      goldMultiplier: 1,
      insigniaMultiplier: 1,
      cooldownMultiplier: 1,
      bonusPierce: 0,
      globalDetection: false,
    });
  });

  it("grants detection", () => {
    const state = buyCommandUpgrade(createPowerState(), "sensorNet", 10).state;
    expect(commandModifiers(state).globalDetection).toBe(true);
  });

  it("grants pierce", () => {
    const state = buyCommandUpgrade(createPowerState(), "armourDoctrine", 10).state;
    expect(commandModifiers(state).bonusPierce).toBeGreaterThan(0);
  });

  it("raises Insignia income", () => {
    const state = buyCommandUpgrade(createPowerState(), "spoilsOfWar", 10).state;
    expect(commandModifiers(state).insigniaMultiplier).toBeGreaterThan(1);
  });

  it("lasts the whole run, unlike a tactical effect", () => {
    const state = buyCommandUpgrade(createPowerState(), "sensorNet", 10).state;
    expect(currentModifiers(state, 999_999).globalDetection).toBe(true);
  });

  it("stacks across different upgrades", () => {
    let state = buyCommandUpgrade(createPowerState(), "sensorNet", 10).state;
    state = buyCommandUpgrade(state, "armourDoctrine", 10).state;
    const modifiers = commandModifiers(state);
    expect(modifiers.globalDetection).toBe(true);
    expect(modifiers.bonusPierce).toBeGreaterThan(0);
  });
});

describe("global detection is not a free substitute for the Marksman branch", () => {
  it("costs more than any tactical power", () => {
    const dearestPower = Math.max(...TACTICAL_POWER_IDS.map((id) => TACTICAL_POWERS[id].cost));
    expect(COMMAND_UPGRADES.sensorNet.cost).toBeGreaterThan(dearestPower);
  });

  it("costs several lieutenants' worth of Insignia", () => {
    // Three lieutenants at 3 Insignia each is roughly fifteen waves of play.
    expect(COMMAND_UPGRADES.sensorNet.cost).toBeGreaterThanOrEqual(6);
  });
});
