import Phaser from "phaser";
import { BaseEnemy } from "../sprites/enemies/BaseEnemy";
import { BeeEnemy, OgreEnemy, SlimeEnemy } from "../sprites/enemies/Enemy";
import type { SpawnOptions } from "../sprites/enemies/Enemy";
import type { EnemyKind, PathPoint } from "../sim/entities";
import type { EnemyProperty } from "../sim/properties";

/** Which view class renders each kind. */
const ENEMY_CLASSES = {
  slime: SlimeEnemy,
  ogre: OgreEnemy,
  bee: BeeEnemy,
} as const satisfies Record<EnemyKind, unknown>;

export class EnemySpawner {
  private scene: Phaser.Scene;
  private enemies: Phaser.GameObjects.Group;
  private enemyPaths: PathPoint[][];
  private currentWave: number;
  private healthModifier: number = 1;
  private speedModifier: number = 1;

  constructor(
    scene: Phaser.Scene,
    enemies: Phaser.GameObjects.Group,
    enemyPaths: PathPoint[][],
    currentWave: number,
  ) {
    this.scene = scene;
    this.enemies = enemies;
    this.enemyPaths = enemyPaths;
    this.currentWave = currentWave;
  }

  setModifiers(healthModifier: number, speedModifier: number) {
    this.healthModifier = healthModifier;
    this.speedModifier = speedModifier;
  }

  setCurrentWave(wave: number) {
    this.currentWave = wave;
  }

  spawnEnemy(
    kind: EnemyKind = "slime",
    pathIndex?: number,
    properties: readonly EnemyProperty[] = [],
    spawnOptions: SpawnOptions = {},
  ): BaseEnemy | null {
    const path = this.selectPath(pathIndex);
    if (!path || path.length === 0) {
      console.error("EnemySpawner: no usable path for spawn");
      return null;
    }

    const start = path[0];
    const EnemyClass = ENEMY_CLASSES[kind];
    const enemy = new EnemyClass(
      this.scene,
      start.x,
      start.y,
      path,
      this.speedModifier,
      this.healthModifier,
      this.currentWave,
      properties,
      spawnOptions,
    );

    this.enemies.add(enemy);
    return enemy;
  }

  private selectPath(pathIndex?: number): PathPoint[] | null {
    if (pathIndex !== undefined && this.enemyPaths[pathIndex]) {
      return this.enemyPaths[pathIndex];
    }
    if (this.enemyPaths.length === 0) {
      return null;
    }
    // Round-robin across spawn points when no path is specified.
    return this.enemyPaths[this.enemies.children.size % this.enemyPaths.length];
  }
}
