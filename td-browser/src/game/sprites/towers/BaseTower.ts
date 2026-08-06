import Phaser from "phaser";
import { getTowerDef } from "../../data/towers";
import { UPGRADE_DEFS } from "../../data/upgrades";
import { TILE_SIZE } from "../../data/map2";
import { tileToWorldCenter } from "../../map/Grid";
import {
  canUpgrade,
  emptyTiers,
  resolveTowerStats,
  spriteFrameFor,
  totalInvested,
  upgradeCost,
  visualTier,
  withUpgrade,
} from "../../sim/upgrades";
import {
  DEFAULT_TARGETING_PRIORITY,
  TARGETING_LABELS,
  nextPriority,
  selectTarget,
} from "../../sim/targeting";
import { BaseEnemy } from "../enemies/BaseEnemy";
import Projectile from "./Projectile";
import type { TowerDef } from "../../data/towers";
import type { UpgradeBranch } from "../../data/upgrades";
import type { TowerKind } from "../../sim/entities";
import type { ResolvedTowerStats, UpgradeTiers } from "../../sim/upgrades";
import type { TargetCandidate, TargetingPriority } from "../../sim/targeting";
import type { GlobalModifiers } from "../../sim/powers";

/**
 * @deprecated Stats now come from `TOWER_DEFS` in src/game/data/towers.ts.
 * Kept as a type alias so existing importers keep compiling.
 */
export type TowerConfig = TowerDef;

/**
 * The view for one tower.
 *
 * Owns its sprite, its range indicator, and its firing cadence. Every rule it
 * follows — which enemy to shoot, what its upgrades make it, what a hit does —
 * resolves in src/game/sim/.
 */
export abstract class BaseTower extends Phaser.GameObjects.Container {
  protected readonly def: TowerDef;
  protected readonly kind: TowerKind;
  protected tiers: UpgradeTiers = emptyTiers();
  protected stats: ResolvedTowerStats;
  protected priority: TargetingPriority = DEFAULT_TARGETING_PRIORITY;
  protected lastFireTime: number = 0;
  protected currentTarget: BaseEnemy | null = null;
  protected rangeCircle?: Phaser.GameObjects.Arc;
  /** The sprite, when the sheet loaded. Repointed at a new frame on upgrade. */
  protected readonly sprite?: Phaser.GameObjects.Sprite;
  protected readonly sceneRef: Phaser.Scene;
  protected readonly col: number;
  protected readonly row: number;

  constructor(
    scene: Phaser.Scene,
    col: number,
    row: number,
    kind: TowerKind,
    visual: Phaser.GameObjects.GameObject,
  ) {
    const worldPos = tileToWorldCenter(col, row);
    super(scene, worldPos.x, worldPos.y, [visual]);

    this.sceneRef = scene;
    this.col = col;
    this.row = row;
    this.kind = kind;
    this.def = getTowerDef(kind);
    this.stats = resolveTowerStats(kind, this.tiers);
    // Held so upgrades can change how the tower looks. Undefined when the
    // sprite sheet failed to load and the fallback polygon is in use.
    this.sprite = visual instanceof Phaser.GameObjects.Sprite ? visual : undefined;

    scene.add.existing(this);
    this.setDepth(600); // Above enemies

    this.rangeCircle = scene.add.circle(worldPos.x, worldPos.y, this.stats.range, this.def.color, 0.2);
    this.rangeCircle.setStrokeStyle(2, this.def.color, 0.5);
    this.rangeCircle.setDepth(550);
    this.rangeCircle.setVisible(false);
  }

  update(time: number, _delta: number, enemies: Phaser.GameObjects.Group) {
    this.rangeCircle?.setPosition(this.x, this.y);

    // Re-target every frame rather than holding a target until it dies. The
    // priority is a live setting the player can change mid-wave, and a cached
    // target would ignore the change until the current one expired.
    this.currentTarget = this.findTarget(enemies);

    if (this.currentTarget && time - this.lastFireTime >= this.stats.fireRate) {
      this.shoot(this.currentTarget);
      this.lastFireTime = time;
    }
  }

  /** Adapts the enemy group to what target selection needs. */
  private candidates(enemies: Phaser.GameObjects.Group): Array<TargetCandidate & { ref: BaseEnemy }> {
    const out: Array<TargetCandidate & { ref: BaseEnemy }> = [];
    for (const child of enemies.children.entries) {
      if (!(child instanceof BaseEnemy)) continue;
      const sim = child.getSimState();
      out.push({
        id: sim.id,
        position: child.getPosition(),
        health: sim.health,
        pathIndex: sim.pathIndex,
        alive: sim.alive,
        dying: sim.dying,
        phased: sim.phased,
        ref: child,
      });
    }
    return out;
  }

  protected findTarget(enemies: Phaser.GameObjects.Group): BaseEnemy | null {
    const global = (
      this.sceneRef as Phaser.Scene & { getPowerModifiers?: () => GlobalModifiers }
    ).getPowerModifiers?.() ?? null;

    const chosen = selectTarget(
      {
        position: { x: this.x, y: this.y },
        range: this.stats.range,
        priority: this.priority,
        // Sensor Net grants detection to every tower at once.
        detection: this.stats.detection || (global?.globalDetection ?? false),
      },
      this.candidates(enemies),
    );
    return chosen ? (chosen as TargetCandidate & { ref: BaseEnemy }).ref : null;
  }

  protected shoot(target: BaseEnemy) {
    // Overcharge and Armour Doctrine are global, so they are read at fire time
    // rather than baked into the tower's own resolved stats.
    const global = (
      this.sceneRef as Phaser.Scene & { getPowerModifiers?: () => GlobalModifiers }
    ).getPowerModifiers?.() ?? null;

    const projectile = new Projectile(this.sceneRef, this.x, this.y, target, {
      damage: Math.round(this.stats.damage * (global?.damageMultiplier ?? 1)),
      pierce: this.stats.pierce + (global?.bonusPierce ?? 0),
      splashRadius: this.stats.splashRadius,
      slowFactor: this.stats.slowFactor,
      slowDurationMs: this.stats.slowDurationMs,
      color: this.def.color,
      goldMultiplier: this.stats.goldMultiplier,
      bonusGoldPerKill: this.stats.bonusGoldPerKill,
    });

    const scene = this.sceneRef as Phaser.Scene & {
      projectiles?: Phaser.GameObjects.Group;
    };
    scene.projectiles?.add(projectile);
  }

  // --- upgrades ------------------------------------------------------------

  getTiers(): Readonly<UpgradeTiers> {
    return this.tiers;
  }

  getStats(): Readonly<ResolvedTowerStats> {
    return this.stats;
  }

  canUpgradeBranch(branch: UpgradeBranch): boolean {
    return canUpgrade(this.tiers, branch);
  }

  getUpgradeCost(branch: UpgradeBranch): number {
    return upgradeCost(this.kind, branch, this.tiers[branch]);
  }

  /** The tier the player would buy next, or null when the branch is closed. */
  getNextTier(branch: UpgradeBranch) {
    if (!this.canUpgradeBranch(branch)) return null;
    return UPGRADE_DEFS[this.kind][branch].tiers[this.tiers[branch]];
  }

  /** Applies an upgrade. Returns false when the branch is gated or maxed. */
  applyUpgrade(branch: UpgradeBranch): boolean {
    if (!this.canUpgradeBranch(branch)) return false;

    const before = visualTier(this.tiers);
    this.tiers = withUpgrade(this.tiers, branch);
    this.stats = resolveTowerStats(this.kind, this.tiers);

    // The range indicator must follow the stat, or the player sees a lie.
    this.rangeCircle?.setRadius(this.stats.range);

    if (visualTier(this.tiers) !== before) {
      this.applyUpgradeAppearance();
    }
    return true;
  }

  /**
   * Repoints the sprite at the frame for its current investment.
   *
   * The display size is reasserted afterwards because setFrame resets a
   * sprite's dimensions to the new frame's, which would make the tower jump to
   * 96px on the first upgrade.
   */
  private applyUpgradeAppearance() {
    if (!this.sprite) return;

    this.sprite.setFrame(spriteFrameFor(this.kind, this.tiers));

    const size = TILE_SIZE * this.def.size;
    this.sprite.setDisplaySize(size, size);

    // A brief flash, so an upgrade reads as having happened rather than the
    // tower quietly being a different shape next time the player looks.
    this.sceneRef.tweens.add({
      targets: this.sprite,
      scaleX: this.sprite.scaleX * 1.25,
      scaleY: this.sprite.scaleY * 1.25,
      duration: 120,
      yoyo: true,
      ease: "Quad.easeOut",
    });
  }

  // --- targeting -----------------------------------------------------------

  getPriority(): TargetingPriority {
    return this.priority;
  }

  getPriorityLabel(): string {
    return TARGETING_LABELS[this.priority];
  }

  /** Cycles targeting. Takes effect on the next shot, mid-wave included. */
  cyclePriority(): TargetingPriority {
    this.priority = nextPriority(this.priority);
    return this.priority;
  }

  setPriority(priority: TargetingPriority) {
    this.priority = priority;
  }

  // --- board ---------------------------------------------------------------

  showRange() {
    if (this.rangeCircle) {
      this.rangeCircle.setPosition(this.x, this.y);
      this.rangeCircle.setRadius(this.stats.range);
      this.rangeCircle.setVisible(true);
    }
  }

  hideRange() {
    this.rangeCircle?.setVisible(false);
  }

  getCol(): number {
    return this.col;
  }

  getRow(): number {
    return this.row;
  }

  getKind(): TowerKind {
    return this.kind;
  }

  getLabel(): string {
    return this.def.label;
  }

  /** Base price, before the per-tower escalation TowerManager applies. */
  getCost(): number {
    return this.def.cost;
  }

  /** Everything sunk into this tower, so selling refunds a fair share of it. */
  getInvestedValue(): number {
    return this.def.cost + totalInvested(this.kind, this.tiers);
  }

  getDamage(): number {
    return this.stats.damage;
  }

  destroy() {
    this.rangeCircle?.destroy();
    super.destroy();
  }
}
