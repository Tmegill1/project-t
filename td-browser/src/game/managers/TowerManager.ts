import Phaser from "phaser";
import { BaseTower } from "../sprites/towers/BaseTower";
import { BasicTower, FastTower, LongRangeTower } from "../sprites/towers/Towers";
import type { TowerType } from "../../ui/towerSelection/TowerSelection";
import type { TileKind } from "../data/map2";

export class TowerManager {
  private scene: Phaser.Scene;
  private towers: Phaser.GameObjects.Group;
  private map: TileKind[][];
  private mapName?: "demoMap" | "map2";
  
  // Tower placement tracking
  private basicTowerCount: number = 0;
  private fastTowerCount: number = 0;
  private longTowerCount: number = 0;

  constructor(scene: Phaser.Scene, towers: Phaser.GameObjects.Group, map: TileKind[][], mapName?: "demoMap" | "map2") {
    this.scene = scene;
    this.towers = towers;
    this.map = map;
    this.mapName = mapName;
  }

  reset() {
    this.basicTowerCount = 0;
    this.fastTowerCount = 0;
    this.longTowerCount = 0;
  }

  hasTowerAt(col: number, row: number): boolean {
    for (const child of this.towers.children.entries) {
      if (child instanceof BaseTower) {
        if (child.getCol() === col && child.getRow() === row) {
          return true;
        }
      }
    }
    return false;
  }

  getTowerAt(col: number, row: number): BaseTower | null {
    for (const child of this.towers.children.entries) {
      if (child instanceof BaseTower) {
        if (child.getCol() === col && child.getRow() === row) {
          return child;
        }
      }
    }
    return null;
  }

  canPlaceTower(col: number, row: number): boolean {
    if (row < 0 || row >= this.map.length || col < 0 || col >= this.map[0].length) {
      return false;
    }
    const kind = this.map[row][col] as TileKind;
    return kind === "buildable" && !this.hasTowerAt(col, row);
  }

  placeTower(towerType: TowerType, col: number, row: number): BaseTower | null {
    if (!this.canPlaceTower(col, row)) {
      return null;
    }

    if (this.isTowerAtLimit(towerType)) {
      return null;
    }

    try {
      const tower = new towerType(this.scene, col, row);
      this.towers.add(tower);
      this.incrementTowerCount(towerType);
      return tower;
    } catch (error) {
      console.error("Error creating tower:", error);
      return null;
    }
  }

  removeTower(tower: BaseTower): void {
    if (tower instanceof BasicTower) {
      this.basicTowerCount = Math.max(0, this.basicTowerCount - 1);
    } else if (tower instanceof FastTower) {
      this.fastTowerCount = Math.max(0, this.fastTowerCount - 1);
    } else if (tower instanceof LongRangeTower) {
      this.longTowerCount = Math.max(0, this.longTowerCount - 1);
    }
    
    this.towers.remove(tower, true, true);
    tower.hideRange();
  }

  getTowerCost(towerType: TowerType): number {
    if (towerType === BasicTower) {
      return BasicTower.COST + (this.basicTowerCount * 20);
    } else if (towerType === FastTower) {
      return FastTower.COST + (this.fastTowerCount * 30);
    } else if (towerType === LongRangeTower) {
      return LongRangeTower.COST + (this.longTowerCount * 100);
    }
    return (towerType as any).COST || 0;
  }

  getTowerLimit(towerType: TowerType): number {
    // Base limits
    let baseLimit = 0;
    if (towerType === BasicTower) {
      baseLimit = 5;
    } else if (towerType === FastTower) {
      baseLimit = 5;
    } else if (towerType === LongRangeTower) {
      baseLimit = 3;
    } else {
      return Infinity;
    }
    
    // Increase limit by 2 for map2
    if (this.mapName === "map2") {
      return baseLimit + 2;
    }
    
    return baseLimit;
  }

  getTowerCount(towerType: TowerType): number {
    if (towerType === BasicTower) {
      return this.basicTowerCount;
    } else if (towerType === FastTower) {
      return this.fastTowerCount;
    } else if (towerType === LongRangeTower) {
      return this.longTowerCount;
    }
    return 0;
  }

  isTowerAtLimit(towerType: TowerType): boolean {
    return this.getTowerCount(towerType) >= this.getTowerLimit(towerType);
  }

  private incrementTowerCount(towerType: TowerType) {
    if (towerType === BasicTower) {
      this.basicTowerCount++;
    } else if (towerType === FastTower) {
      this.fastTowerCount++;
    } else if (towerType === LongRangeTower) {
      this.longTowerCount++;
    }
  }
}
