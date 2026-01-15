import Phaser from "phaser";
import type { PathPoint } from "./Enemy";

export abstract class BaseEnemy extends Phaser.GameObjects.GameObject {
  protected path: PathPoint[];
  protected currentPathIndex: number = 0;
  protected speed: number;
  protected lifeLoss: number;
  protected health: number;
  protected maxHealth: number;
  protected sceneRef: Phaser.Scene;
  protected visual: Phaser.GameObjects.GameObject & { x: number; y: number; setPosition(x: number, y: number): void; setDepth(depth: number): void };

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    path: PathPoint[],
    speed: number,
    lifeLoss: number,
    health: number,
    visual: Phaser.GameObjects.GameObject
  ) {
    super(scene, "enemy");
    
    this.sceneRef = scene;
    this.path = path;
    this.currentPathIndex = 0;
    this.speed = speed;
    this.lifeLoss = lifeLoss;
    this.maxHealth = health;
    this.health = health;
    this.visual = visual as Phaser.GameObjects.GameObject & { x: number; y: number; setPosition(x: number, y: number): void; setDepth(depth: number): void };
    
    // Position the visual
    this.visual.setPosition(x, y);
    this.visual.setDepth(500);
    
    // Add to scene
    scene.add.existing(this.visual);
    scene.add.existing(this);
  }

  takeDamage(damage: number): void {
    this.health -= damage;
    if (this.health <= 0) {
      this.destroy();
    }
  }

  update(_time: number, delta: number) {
    if (this.currentPathIndex >= this.path.length) {
      // Reached the goal
      this.sceneRef.events.emit("enemy-reached-goal", this.lifeLoss);
      this.destroy();
      return;
    }

    const target = this.path[this.currentPathIndex];
    const dx = target.x - this.visual.x;
    const dy = target.y - this.visual.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < 2) {
      // Reached current waypoint, move to next
      this.currentPathIndex++;
      if (this.currentPathIndex >= this.path.length) {
        this.sceneRef.events.emit("enemy-reached-goal", this.lifeLoss);
        this.destroy();
        return;
      }
    } else {
      // Move towards current waypoint
      const moveDistance = (this.speed * delta) / 1000;
      const moveX = (dx / distance) * moveDistance;
      const moveY = (dy / distance) * moveDistance;
      
      this.visual.x += moveX;
      this.visual.y += moveY;
    }
  }

  destroy() {
    this.visual.destroy();
    super.destroy();
  }
}
