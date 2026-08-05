import Phaser from "phaser";
import { getTowerDef } from "../data/towers";
import { escalatedCost } from "../sim/economy";
import { BaseTower } from "../sprites/towers/BaseTower";
import { TOWER_KIND_BY_CLASS } from "../sprites/towers/Towers";
import type { TowerType } from "../../ui/towerSelection/TowerSelection";
import type { TileKind } from "../data/map2";
import type { TowerKind } from "../sim/entities";

export class TowerManager {
  private scene: Phaser.Scene;
  private towers: Phaser.GameObjects.Group;
  private map: TileKind[][];
  private mapName?: "demoMap" | "map2";

  /** How many of each kind are currently placed. Drives both the price
   *  escalation and the hard cap. */
  private counts: Record<TowerKind, number> = { basic: 0, fast: 0, long: 0 };

  constructor(
    scene: Phaser.Scene,
    towers: Phaser.GameObjects.Group,
    map: TileKind[][],
    mapName?: "demoMap" | "map2",
  ) {
    this.scene = scene;
    this.towers = towers;
    this.map = map;
    this.mapName = mapName;
  }

  reset() {
    this.counts = { basic: 0, fast: 0, long: 0 };
  }

  hasTowerAt(col: number, row: number): boolean {
    return this.getTowerAt(col, row) !== null;
  }

  getTowerAt(col: number, row: number): BaseTower | null {
    for (const child of this.towers.children.entries) {
      if (child instanceof BaseTower && child.getCol() === col && child.getRow() === row) {
        return child;
      }
    }
    return null;
  }

  canPlaceTower(col: number, row: number): boolean {
    if (row < 0 || row >= this.map.length || col < 0 || col >= this.map[0].length) {
      return false;
    }
    return this.map[row][col] === "buildable" && !this.hasTowerAt(col, row);
  }

  placeTower(towerType: TowerType, col: number, row: number): BaseTower | null {
    if (!this.canPlaceTower(col, row) || this.isTowerAtLimit(towerType)) {
      return null;
    }

    try {
      const tower = new towerType(this.scene, col, row);
      this.towers.add(tower);
      this.counts[tower.getKind()]++;
      return tower;
    } catch (error) {
      console.error("Error creating tower:", error);
      return null;
    }
  }

  removeTower(tower: BaseTower): void {
    const kind = tower.getKind();
    this.counts[kind] = Math.max(0, this.counts[kind] - 1);

    this.towers.remove(tower, true, true);
    tower.hideRange();
  }

  getTowerCost(towerType: TowerType): number {
    const kind = this.kindOf(towerType);
    if (!kind) return 0;

    const def = getTowerDef(kind);
    return escalatedCost(def.cost, this.counts[kind], def.costEscalation);
  }

  getTowerLimit(towerType: TowerType): number {
    const kind = this.kindOf(towerType);
    if (!kind) return Infinity;

    const def = getTowerDef(kind);
    // The larger second map allows a couple more of everything.
    return this.mapName === "map2" ? def.baseLimit + def.limitBonusMap2 : def.baseLimit;
  }

  getTowerCount(towerType: TowerType): number {
    const kind = this.kindOf(towerType);
    return kind ? this.counts[kind] : 0;
  }

  isTowerAtLimit(towerType: TowerType): boolean {
    return this.getTowerCount(towerType) >= this.getTowerLimit(towerType);
  }

  private kindOf(towerType: TowerType): TowerKind | undefined {
    return TOWER_KIND_BY_CLASS.get(towerType);
  }
}
