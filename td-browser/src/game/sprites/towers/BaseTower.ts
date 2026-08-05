import Phaser from "phaser";
import { getTowerDef } from "../../data/towers";
import { tileToWorldCenter } from "../../map/Grid";
import { BaseEnemy } from "../enemies/BaseEnemy";
import Projectile from "./Projectile";
import type { TowerDef } from "../../data/towers";
import type { TowerKind } from "../../sim/entities";

/**
 * @deprecated Stats now come from `TOWER_DEFS` in src/game/data/towers.ts.
 * Kept as a type alias so existing importers keep compiling.
 */
export type TowerConfig = TowerDef;

/**
 * The view for one tower.
 *
 * Owns its sprite, its range indicator, and its firing cadence. Its stats are
 * read from data rather than declared here, and the damage it deals travels
 * with the projectile it fires.
 */
export abstract class BaseTower extends Phaser.GameObjects.Container {
  protected readonly def: TowerDef;
  protected readonly kind: TowerKind;
  protected lastFireTime: number = 0;
  protected currentTarget: BaseEnemy | null = null;
  protected rangeCircle?: Phaser.GameObjects.Arc;
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

    const def = getTowerDef(kind);

    this.sceneRef = scene;
    this.col = col;
    this.row = row;
    this.kind = kind;
    this.def = def;

    scene.add.existing(this);
    this.setDepth(600); // Above enemies

    this.rangeCircle = scene.add.circle(worldPos.x, worldPos.y, def.range, def.color, 0.2);
    this.rangeCircle.setStrokeStyle(2, def.color, 0.5);
    this.rangeCircle.setDepth(550);
    this.rangeCircle.setVisible(false);
  }

  update(time: number, _delta: number, enemies: Phaser.GameObjects.Group) {
    this.rangeCircle?.setPosition(this.x, this.y);

    if (!this.currentTarget || !this.isTargetValid(this.currentTarget, enemies)) {
      this.currentTarget = this.findTarget(enemies);
    }

    if (this.currentTarget && time - this.lastFireTime >= this.def.fireRate) {
      this.shoot(this.currentTarget);
      this.lastFireTime = time;
    }
  }

  protected isTargetValid(target: BaseEnemy, enemies: Phaser.GameObjects.Group): boolean {
    if (!enemies.contains(target)) return false;
    // Dying enemies are untargetable, so towers do not waste shots on corpses.
    if (target.getIsDying()) return false;

    return this.distanceTo(target) <= this.def.range;
  }

  protected findTarget(enemies: Phaser.GameObjects.Group): BaseEnemy | null {
    let closestEnemy: BaseEnemy | null = null;
    let closestDistance = this.def.range;

    for (const child of enemies.children.entries) {
      if (!(child instanceof BaseEnemy) || child.getIsDying()) continue;

      const distance = this.distanceTo(child);
      if (distance <= this.def.range && distance < closestDistance) {
        closestDistance = distance;
        closestEnemy = child;
      }
    }

    return closestEnemy;
  }

  private distanceTo(enemy: BaseEnemy): number {
    const pos = enemy.getPosition();
    return Phaser.Math.Distance.Between(this.x, this.y, pos.x, pos.y);
  }

  protected shoot(target: BaseEnemy) {
    const projectile = new Projectile(this.sceneRef, this.x, this.y, target, this.def.damage);

    const scene = this.sceneRef as Phaser.Scene & {
      projectiles?: Phaser.GameObjects.Group;
    };
    scene.projectiles?.add(projectile);
  }

  showRange() {
    if (this.rangeCircle) {
      this.rangeCircle.setPosition(this.x, this.y);
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

  /** Base price, before the per-tower escalation TowerManager applies. */
  getCost(): number {
    return this.def.cost;
  }

  getDamage(): number {
    return this.def.damage;
  }

  destroy() {
    this.rangeCircle?.destroy();
    super.destroy();
  }
}
