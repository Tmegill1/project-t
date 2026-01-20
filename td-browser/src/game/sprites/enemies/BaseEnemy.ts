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
  protected visual: Phaser.GameObjects.Sprite | (Phaser.GameObjects.GameObject & { x: number; y: number; setPosition(x: number, y: number): void; setDepth(depth: number): void });
  protected enemyType: string = ""; // "slime", "bee", or "ogre"
  protected currentDirection: "up" | "down" | "side" = "down";
  protected isDying: boolean = false;
  protected isFlipped: boolean = false; // Track if enemy should be permanently flipped
  
  // Public method to check if enemy is dying (for targeting)
  public getIsDying(): boolean {
    return this.isDying;
  }
  protected currentWave: number = 1; // Track which wave this enemy belongs to
  protected reward: number; // Money reward for killing this enemy

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    path: PathPoint[],
    speed: number,
    lifeLoss: number,
    health: number,
    visual: Phaser.GameObjects.GameObject,
    currentWave: number = 1,
    reward: number = 0,
    enemyType: string = ""
  ) {
    super(scene, "enemy");
    
    this.sceneRef = scene;
    this.path = path;
    this.currentPathIndex = 0;
    this.speed = speed;
    this.lifeLoss = lifeLoss;
    this.maxHealth = health;
    this.health = health;
    this.currentWave = currentWave;
    this.reward = reward;
    this.enemyType = enemyType;
    this.visual = visual as Phaser.GameObjects.Sprite | (Phaser.GameObjects.GameObject & { x: number; y: number; setPosition(x: number, y: number): void; setDepth(depth: number): void });
    
    // Position the visual at the spawn point
    this.visual.setPosition(x, y);
    this.visual.setDepth(500);
    
    // If we're already at the first waypoint, start moving to the second one
    // This prevents enemies from getting stuck if they spawn exactly on the first waypoint
    if (this.path.length > 1) {
      const firstPoint = this.path[0];
      const dxToFirst = Math.abs(firstPoint.x - x);
      const dyToFirst = Math.abs(firstPoint.y - y);
      if (dxToFirst < 1 && dyToFirst < 1) {
        // Already at first point, start with second waypoint
        this.currentPathIndex = 1;
      }
    }
    
    // Debug: Log enemy creation
    console.log(`BaseEnemy: Created at (${x}, ${y}), path has ${this.path.length} points, starting at pathIndex: ${this.currentPathIndex}`);
    if (this.path.length > 0) {
      console.log(`BaseEnemy: First path point: (${this.path[0].x}, ${this.path[0].y}), target: ${this.path.length > this.currentPathIndex ? `(${this.path[this.currentPathIndex].x}, ${this.path[this.currentPathIndex].y})` : 'none'}`);
    }
    
    // Apply permanent flip if needed (for ogres)
    if (this.visual instanceof Phaser.GameObjects.Sprite && this.enemyType === "ogre") {
      this.isFlipped = true;
      this.visual.setFlipX(true);
    }
    
    // Add to scene
    scene.add.existing(this.visual);
    scene.add.existing(this);
    
    // Start walking animation if it's a sprite (delay slightly to ensure animations are ready)
    if (this.visual instanceof Phaser.GameObjects.Sprite && this.enemyType) {
      // Use a small delay to ensure animations are created, then start the animation
      scene.time.delayedCall(100, () => {
        // Check if enemy still exists and is not dying before playing animation
        if (!this.isDying && this.visual && this.visual.active && this.sceneRef && this.sceneRef.sys) {
          this.playWalkAnimation();
        }
      });
    }
  }
  
  protected playWalkAnimation() {
    // Safety checks: ensure visual exists, is active, and scene is still valid
    if (!this.visual || !(this.visual instanceof Phaser.GameObjects.Sprite) || !this.enemyType || this.isDying) {
      return;
    }
    
    // Check if visual is still active and scene is still active
    if (!this.visual.active || !this.visual.scene || !this.sceneRef || !this.sceneRef.sys) {
      return;
    }
    
    // Check if anims system exists and is available
    if (!this.visual.anims || !this.sceneRef.anims) {
      return;
    }
    
    const animKey = `${this.enemyType}-walk-${this.currentDirection}`;
    
    // Check if animation exists and is properly initialized
    if (!this.sceneRef.anims.exists(animKey)) {
      // Animation doesn't exist yet, just show first frame of the sprite sheet
      const textureKey = `${this.enemyType}-walk-${this.currentDirection}`;
      if (this.sceneRef.textures && this.sceneRef.textures.exists(textureKey)) {
        try {
          this.visual.setTexture(textureKey, 0);
        } catch (error) {
          // Visual might be destroyed, ignore
        }
      }
      return;
    }
    
    // Get the animation to verify it's ready
    const anim = this.sceneRef.anims.get(animKey);
    if (!anim || !anim.frames || anim.frames.length === 0) {
      // Animation exists but isn't ready, show first frame
      const textureKey = `${this.enemyType}-walk-${this.currentDirection}`;
      if (this.sceneRef.textures && this.sceneRef.textures.exists(textureKey)) {
        try {
          this.visual.setTexture(textureKey, 0);
        } catch (error) {
          // Visual might be destroyed, ignore
        }
      }
      return;
    }
    
    try {
      // Only play if not already playing this animation (to avoid restarting)
      // Check if anims and currentAnim exist before accessing
      if (this.visual.anims && (!this.visual.anims.currentAnim || this.visual.anims.currentAnim.key !== animKey)) {
        this.visual.play(animKey);
      }
    } catch (error) {
      // Visual or scene might be destroyed, ignore silently
      // Only log if it's not a destruction-related error
      if (this.visual && this.visual.active && this.sceneRef && this.sceneRef.sys) {
        console.warn(`Failed to play walk animation ${animKey}:`, error);
      }
    }
  }
  
  protected playDeathAnimation() {
    if (!(this.visual instanceof Phaser.GameObjects.Sprite) || !this.enemyType) {
      this.destroy();
      return;
    }
    
    this.isDying = true;
    const animKey = `${this.enemyType}-death-${this.currentDirection}`;
    
    // Check if animation exists and is properly initialized
    if (!this.sceneRef.anims.exists(animKey)) {
      // If no death animation, show first frame of death texture if available, then destroy
      const textureKey = `${this.enemyType}-death-${this.currentDirection}`;
      if (this.sceneRef.textures.exists(textureKey)) {
        try {
          this.visual.setTexture(textureKey, 0);
          // Destroy after a short delay
          this.sceneRef.time.delayedCall(500, () => {
            this.destroy();
          });
        } catch (error) {
          // If texture setting fails, destroy immediately
          this.destroy();
        }
      } else {
        // If no death texture, destroy immediately
        this.destroy();
      }
      return;
    }
    
    // Get the animation to verify it's ready
    const anim = this.sceneRef.anims.get(animKey);
    if (!anim || !anim.frames || anim.frames.length === 0) {
      // Animation exists but isn't ready, show first frame and destroy
      const textureKey = `${this.enemyType}-death-${this.currentDirection}`;
      if (this.sceneRef.textures.exists(textureKey)) {
        this.visual.setTexture(textureKey, 0);
      }
      this.sceneRef.time.delayedCall(500, () => {
        this.destroy();
      });
      return;
    }
    
    try {
      this.visual.play(animKey);
      // Destroy after death animation completes
      this.visual.once("animationcomplete", () => {
        // Remove from enemies group first (makes it untargetable immediately)
        if (this.sceneRef) {
          const gameScene = this.sceneRef as any;
          if (gameScene.enemies && gameScene.enemies.contains(this)) {
            gameScene.enemies.remove(this);
          }
        }
        // Then destroy the visual
        if (this.visual) {
          this.visual.destroy();
        }
        // Finally destroy the enemy object itself
        super.destroy();
      });
    } catch (error) {
      console.warn(`Failed to play death animation ${animKey}:`, error);
      // If animation fails, just show first frame and destroy after a delay
      const textureKey = `${this.enemyType}-death-${this.currentDirection}`;
      if (this.sceneRef.textures.exists(textureKey)) {
        this.visual.setTexture(textureKey, 0);
      }
      // Destroy after a short delay
      this.sceneRef.time.delayedCall(500, () => {
        this.destroy();
      });
    }
  }
  
  protected updateDirection(dx: number, dy: number) {
    // Determine direction based on movement
    if (Math.abs(dy) > Math.abs(dx)) {
      this.currentDirection = dy > 0 ? "down" : "up";
      // For ogres, maintain the permanent flip even when moving up/down
      if (this.visual instanceof Phaser.GameObjects.Sprite && this.isFlipped) {
        this.visual.setFlipX(true);
      }
    } else {
      this.currentDirection = "side";
      // Flip sprite horizontally if moving left
      if (this.visual instanceof Phaser.GameObjects.Sprite) {
        if (this.isFlipped) {
          // For ogres (or other permanently flipped enemies), maintain flip and adjust for direction
          // If ogre is permanently flipped, we need to invert the direction logic
          this.visual.setFlipX(dx > 0); // Flip when moving right (since ogre is already flipped)
        } else {
          // Other enemies flip normally
          this.visual.setFlipX(dx < 0);
        }
      }
    }
  }

  takeDamage(damage: number): void {
    this.health -= damage;
    if (this.health <= 0) {
      // Emit reward event when enemy is killed (not when reaching goal)
      this.sceneRef.events.emit("enemy-killed", this.reward);
      this.playDeathAnimation();
    }
  }

  update(_time: number, delta: number) {
    // If enemy is dying, stop movement but continue death animation
    if (this.isDying) {
      // Don't move, just let the death animation play
      return;
    }
    
    if (this.currentPathIndex >= this.path.length) {
      // Reached the goal
      // After wave 5, use remaining health instead of base lifeLoss
      const lifeLoss = this.currentWave > 5 ? Math.max(1, Math.ceil(this.health)) : this.lifeLoss;
      this.sceneRef.events.emit("enemy-reached-goal", lifeLoss);
      this.destroy();
      return;
    }

    const target = this.path[this.currentPathIndex];
    const dx = target.x - this.visual.x;
    const dy = target.y - this.visual.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // Debug: Log movement (only first few times to avoid spam)
    if (!(this as any)._updateLogged) {
      console.log(`BaseEnemy: Update called - Enemy at (${this.visual.x}, ${this.visual.y}), target (${target.x}, ${target.y}), distance: ${distance.toFixed(2)}, pathIndex: ${this.currentPathIndex}, speed: ${this.speed}, delta: ${delta}`);
      (this as any)._updateLogged = true;
      // Log a few more times
      (this as any)._updateCount = 0;
    } else if ((this as any)._updateCount < 5) {
      (this as any)._updateCount++;
      console.log(`BaseEnemy: Update ${(this as any)._updateCount} - Enemy at (${this.visual.x.toFixed(1)}, ${this.visual.y.toFixed(1)}), target (${target.x}, ${target.y}), distance: ${distance.toFixed(2)}`);
    }

    if (distance < 2) {
      // Reached current waypoint, move to next
      this.currentPathIndex++;
      if (this.currentPathIndex >= this.path.length) {
        // After wave 5, use remaining health instead of base lifeLoss
        const lifeLoss = this.currentWave > 5 ? Math.max(1, Math.ceil(this.health)) : this.lifeLoss;
        this.sceneRef.events.emit("enemy-reached-goal", lifeLoss);
        this.destroy();
        return;
      }
    } else {
      // Move towards current waypoint
      const moveDistance = (this.speed * delta) / 1000;
      const moveX = (dx / distance) * moveDistance;
      const moveY = (dy / distance) * moveDistance;
      
      // Debug: Log movement calculation
      if ((this as any)._updateCount < 3) {
        console.log(`BaseEnemy: Moving - moveDistance: ${moveDistance.toFixed(3)}, moveX: ${moveX.toFixed(3)}, moveY: ${moveY.toFixed(3)}`);
      }
      
      // Update direction based on movement
      this.updateDirection(dx, dy);
      // Only play animation if enemy is still active
      if (this.visual && this.visual.active && !this.isDying) {
        this.playWalkAnimation();
      }
      
      const oldX = this.visual.x;
      const oldY = this.visual.y;
      this.visual.x += moveX;
      this.visual.y += moveY;
      
      // Debug: Verify position update
      if ((this as any)._updateCount < 3) {
        console.log(`BaseEnemy: Position updated from (${oldX.toFixed(1)}, ${oldY.toFixed(1)}) to (${this.visual.x.toFixed(1)}, ${this.visual.y.toFixed(1)})`);
      }
    }
  }

  destroy() {
    // Destroy visual - if playing death animation, it will be destroyed after animation completes
    if (this.visual && !this.isDying) {
      this.visual.destroy();
    } else if (this.visual && this.isDying && this.visual instanceof Phaser.GameObjects.Sprite) {
      // If death animation is playing, destroy after a delay to allow animation to complete
      this.sceneRef.time.delayedCall(1000, () => {
        if (this.visual) {
          this.visual.destroy();
        }
      });
    }
    super.destroy();
  }
}
