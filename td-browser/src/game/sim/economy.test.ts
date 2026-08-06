import { describe, expect, it } from "vitest";
import { canAfford, escalatedCost, purchase, sellRefund } from "./economy";

describe("canAfford", () => {
  it("allows a purchase when the balance exceeds the cost", () => {
    expect(canAfford(100, 20)).toBe(true);
  });

  it("allows a purchase that spends the balance exactly", () => {
    expect(canAfford(20, 20)).toBe(true);
  });

  it("refuses a purchase beyond the balance", () => {
    expect(canAfford(19, 20)).toBe(false);
  });

  it("refuses any purchase at a zero balance", () => {
    // Preserves UIScene's existing `money > 0 && money >= cost` rule verbatim.
    // The `money > 0` clause means a zero-cost item is unaffordable at zero
    // balance, which is odd but is current behaviour; Phase 0 changes nothing
    // visible. See NOTES-FOR-HUMAN.md.
    expect(canAfford(0, 0)).toBe(false);
    expect(canAfford(0, 10)).toBe(false);
  });

  it("refuses a purchase at a negative balance", () => {
    expect(canAfford(-5, 1)).toBe(false);
  });
});

describe("purchase", () => {
  it("deducts the cost and reports success", () => {
    expect(purchase(100, 30)).toEqual({ balance: 70, ok: true });
  });

  it("leaves the balance untouched when unaffordable", () => {
    expect(purchase(10, 30)).toEqual({ balance: 10, ok: false });
  });

  it("never drives the balance negative", () => {
    const result = purchase(5, 500);
    expect(result.ok).toBe(false);
    expect(result.balance).toBe(5);
  });
});

describe("sellRefund", () => {
  it("refunds half the cost", () => {
    expect(sellRefund(100)).toBe(50);
  });

  it("rounds down on odd costs, matching GameScene.sellTower", () => {
    expect(sellRefund(25)).toBe(12);
    expect(sellRefund(3)).toBe(1);
  });

  it("refunds nothing for a free tower", () => {
    expect(sellRefund(0)).toBe(0);
  });

  it("never refunds a negative amount", () => {
    expect(sellRefund(-10)).toBe(0);
  });
});

describe("escalatedCost", () => {
  // Mirrors TowerManager.getTowerCost: BASE + owned * escalation.
  it("charges the base price for the first tower", () => {
    expect(escalatedCost(20, 0, 20)).toBe(20);
  });

  it("adds one escalation step per tower already owned", () => {
    expect(escalatedCost(20, 1, 20)).toBe(40);
    expect(escalatedCost(20, 3, 20)).toBe(80);
  });

  it("reproduces each tower's current escalation", () => {
    expect(escalatedCost(20, 2, 20)).toBe(60); // BasicTower
    expect(escalatedCost(50, 2, 30)).toBe(110); // FastTower
    expect(escalatedCost(100, 2, 100)).toBe(300); // LongRangeTower
  });

  it("treats a negative owned count as zero", () => {
    expect(escalatedCost(20, -3, 20)).toBe(20);
  });
});
