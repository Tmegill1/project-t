import Phaser from "phaser";
import { BaseEnemy } from "../sprites/enemies/BaseEnemy";
import { CircleEnemy, SquareEnemy, TriangleEnemy } from "../sprites/enemies/Enemy";
import type { PathPoint } from "../sprites/enemies/Enemy";

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
    currentWave: number
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

  spawnEnemy(type: "circle" | "square" | "triangle" = "circle", pathIndex?: number): void {
    let pathToUse: PathPoint[];
    
    if (pathIndex !== undefined && this.enemyPaths[pathIndex]) {
      pathToUse = this.enemyPaths[pathIndex];
    } else if (this.enemyPaths.length > 0) {
      const currentPathIndex = this.enemies.children.size % this.enemyPaths.length;
      pathToUse = this.enemyPaths[currentPathIndex];
    } else {
      console.error("No path found for enemy!");
      return;
    }

    if (pathToUse.length === 0) {
      console.error("Selected path is empty!");
      return;
    }

    const startPoint = pathToUse[0];
    console.log(`EnemySpawner: Spawning enemy at (${startPoint.x}, ${startPoint.y}) with path of ${pathToUse.length} points`);
    console.log(`EnemySpawner: Path points:`, pathToUse.slice(0, 3).map(p => `(${p.x}, ${p.y})`));
    
    let enemy: BaseEnemy;

    switch (type) {
      case "circle":
        enemy = new CircleEnemy(
          this.scene,
          startPoint.x,
          startPoint.y,
          pathToUse,
          this.speedModifier,
          this.healthModifier,
          this.currentWave
        );
        break;
      case "square":
        enemy = new SquareEnemy(
          this.scene,
          startPoint.x,
          startPoint.y,
          pathToUse,
          this.speedModifier,
          this.healthModifier,
          this.currentWave
        );
        break;
      case "triangle":
        enemy = new TriangleEnemy(
          this.scene,
          startPoint.x,
          startPoint.y,
          pathToUse,
          this.speedModifier,
          this.healthModifier,
          this.currentWave
        );
        break;
    }

    this.enemies.add(enemy);
  }
}
