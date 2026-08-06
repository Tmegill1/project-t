import Phaser from "phaser";
import { getEnemyDef } from "../../data/enemies";
import { resolveDamage } from "../../sim/damage";
import { resolveLeakPenalty } from "../../sim/leak";
import { advanceAlongPath } from "../../sim/movement";
import { effectiveSpeed } from "../../sim/entities";
import { createEnemyState } from "../../sim/spawn";
import { sceneEvents } from "../../events";
import { EnemyBadges } from "../../ui/EnemyBadges";
import { audio, deathSoundFor } from "../../audio/AudioManager";
import { HealthBar } from "../../ui/HealthBar";
import type { EnemyKind, EnemyState, Facing, PathPoint } from "../../sim/entities";
import type { EnemyProperty } from "../../sim/properties";

let nextEnemyId = 1;

/** The subset of a Phaser display object this class needs from its visual. */
type EnemyVisual =
  | Phaser.GameObjects.Sprite
  | (Phaser.GameObjects.GameObject & {
      x: number;
      y: number;
      setPosition(x: number, y: number): void;
      setDepth(depth: number): void;
    });

/**
 * The view for one enemy.
 *
 * Owns the sprite, its animations, and its place in the scene. It owns no
 * rules: movement, damage, and leak cost all resolve in src/game/sim/, and this
 * class applies the results to the display object.
 */
export abstract class BaseEnemy extends Phaser.GameObjects.GameObject {
  /** Simulation state. Named `sim` because Phaser's GameObject already
   *  owns a public `state` property of an incompatible type. */
  protected readonly sim: EnemyState;
  protected readonly path: PathPoint[];
  protected readonly sceneRef: Phaser.Scene;
  protected visual: EnemyVisual;
  protected currentDirection: Facing = "down";
  /** Artwork that faces the wrong way stays flipped for its whole life. */
  protected readonly isFlipped: boolean;
  protected readonly textureKey: string;
  /** Income modifiers from the tower landing the current hit. */
  private pendingGoldMultiplier = 1;
  private pendingBonusGold = 0;
  /** Marks showing which properties this enemy carries. */
  protected readonly badges: EnemyBadges;
  /** Remaining health, drawn above the sprite. */
  protected readonly healthBar: HealthBar;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    path: PathPoint[],
    kind: EnemyKind,
    visual: Phaser.GameObjects.GameObject,
    currentWave: number = 1,
    speedModifier: number = 1,
    healthModifier: number = 1,
    properties: readonly EnemyProperty[] = [],
    spawnOptions: {
      role?: EnemyState["role"];
      healthMultiplier?: number;
      extraSpeedMultiplier?: number;
      goldMultiplier?: number;
      insigniaReward?: number;
    } = {},
  ) {
    super(scene, "enemy");

    const def = getEnemyDef(kind);

    this.sceneRef = scene;
    this.path = path;
    this.textureKey = def.textureKey;
    this.isFlipped = def.flipHorizontally;
    this.visual = visual as EnemyVisual;

    // Built by the same factory the headless harness uses, so a simulated
    // enemy and a rendered one are the same enemy.
    this.sim = createEnemyState({
      id: nextEnemyId++,
      kind,
      position: { x, y },
      path,
      wave: currentWave,
      speedModifier,
      healthModifier,
      properties,
      ...spawnOptions,
    });

    this.visual.setPosition(x, y);
    this.visual.setDepth(500);

    if (this.visual instanceof Phaser.GameObjects.Sprite && this.isFlipped) {
      this.visual.setFlipX(true);
    }

    if (this.sim.role === "lieutenant" && this.visual instanceof Phaser.GameObjects.Sprite) {
      // Bigger and tinted, so a high-value target is never mistaken for the
      // ordinary wave it walks in with.
      this.visual.setScale(this.visual.scaleX * 1.6, this.visual.scaleY * 1.6);
      this.visual.setTint(0xffcc55);
    }

    // Sized from the sprite so an ogre's bar reads wider than a bee's.
    const spriteSize = getEnemyDef(kind).spriteScale * 48;
    this.healthBar = new HealthBar(scene, spriteSize * 0.8);
    this.healthBar.update(x, y, spriteSize, 1);

    this.badges = new EnemyBadges(scene, this.sim.properties);
    // Badges stack above the health bar rather than on top of it.
    this.badges.update(x, y, spriteSize + HealthBar.reservedHeight());

    scene.add.existing(this.visual);
    scene.add.existing(this);

    // Animations are registered during BootScene.create; a newly spawned enemy
    // can arrive before they are ready, so the first play is deferred.
    if (this.visual instanceof Phaser.GameObjects.Sprite) {
      scene.time.delayedCall(100, () => {
        if (!this.sim.dying && this.visual && this.visual.active && this.sceneRef?.sys) {
          this.playWalkAnimation();
        }
      });
    }
  }

  /** Whether a death animation is playing. Such an enemy is untargetable. */
  public getIsDying(): boolean {
    return this.sim.dying;
  }

  /**
   * World position, for targeting and projectile aiming.
   *
   * Exists so towers and projectiles stop reaching through
   * `(enemy as any).visual` to find out where an enemy is.
   */
  public getPosition(): { x: number; y: number } {
    return { x: this.visual.x, y: this.visual.y };
  }

  public getHealth(): number {
    return this.sim.health;
  }

  public getKind(): EnemyKind {
    return this.sim.kind;
  }

  public getRole(): EnemyState["role"] {
    return this.sim.role;
  }

  /** Properties this enemy carries, so the UI can show what it is. */
  public getProperties(): readonly EnemyProperty[] {
    return this.sim.properties;
  }

  /** Untargetable without detection. */
  public isPhased(): boolean {
    return this.sim.phased;
  }

  public getPathIndex(): number {
    return this.sim.pathIndex;
  }

  /** Read-only view of simulation state, for towers resolving a shot. */
  public getSimState(): Readonly<EnemyState> {
    return this.sim;
  }

  /** Applies a slow from a tower upgrade. */
  public applySlow(factor: number, durationMs: number, nowMs: number): void {
    if (factor >= 1) return;
    this.sim.slowedUntilMs = Math.max(this.sim.slowedUntilMs, nowMs + durationMs);
    this.sim.slowFactor = Math.min(this.sim.slowFactor, factor);
  }

  protected playWalkAnimation() {
    if (!(this.visual instanceof Phaser.GameObjects.Sprite) || this.sim.dying) return;
    if (!this.visual.active || !this.visual.scene || !this.sceneRef?.sys) return;
    if (!this.visual.anims || !this.sceneRef.anims) return;

    const animKey = `${this.textureKey}-walk-${this.currentDirection}`;

    const anim = this.sceneRef.anims.exists(animKey) ? this.sceneRef.anims.get(animKey) : null;
    if (!anim?.frames?.length) {
      this.showFirstFrame(animKey);
      return;
    }

    try {
      const current = this.visual.anims.currentAnim;
      if (!current || current.key !== animKey) {
        this.visual.play(animKey);
      }
    } catch {
      // The visual or scene can be torn down between the checks above and the
      // play call. Nothing to recover, and nothing worth logging every frame.
    }
  }

  /** Falls back to a static pose when an animation is missing or not yet built. */
  private showFirstFrame(textureKey: string) {
    if (!(this.visual instanceof Phaser.GameObjects.Sprite)) return;
    if (!this.sceneRef.textures?.exists(textureKey)) return;
    try {
      this.visual.setTexture(textureKey, 0);
    } catch {
      // Visual already destroyed.
    }
  }

  protected playDeathAnimation() {
    if (!(this.visual instanceof Phaser.GameObjects.Sprite)) {
      this.destroy();
      return;
    }

    this.sim.dying = true;
    this.badges.destroy();
    // A corpse has no health left to report.
    this.healthBar.destroy();
    const animKey = `${this.textureKey}-death-${this.currentDirection}`;

    const anim = this.sceneRef.anims.exists(animKey) ? this.sceneRef.anims.get(animKey) : null;
    if (!anim?.frames?.length) {
      this.showFirstFrame(animKey);
      this.sceneRef.time.delayedCall(500, () => this.destroy());
      return;
    }

    try {
      this.visual.play(animKey);
      this.visual.once("animationcomplete", () => {
        // Leave the group first so nothing can target a corpse, then tear down.
        const gameScene = this.sceneRef as Phaser.Scene & {
          enemies?: Phaser.GameObjects.Group;
        };
        if (gameScene.enemies?.contains(this)) {
          gameScene.enemies.remove(this);
        }
        this.visual?.destroy();
        super.destroy();
      });
    } catch {
      this.showFirstFrame(animKey);
      this.sceneRef.time.delayedCall(500, () => this.destroy());
    }
  }

  /** Applies the facing the simulation reported, plus the horizontal flip. */
  protected applyFacing(direction: Facing, movingLeft: boolean) {
    this.currentDirection = direction;
    if (!(this.visual instanceof Phaser.GameObjects.Sprite)) return;

    if (direction === "side") {
      // A permanently flipped sprite already faces left, so its flip is
      // inverted relative to everything else.
      this.visual.setFlipX(this.isFlipped ? !movingLeft : movingLeft);
    } else if (this.isFlipped) {
      this.visual.setFlipX(true);
    }
  }

  /**
   * Records the income bonus of whichever tower is about to land a hit.
   *
   * Set immediately before the damage so a kill pays according to the tower
   * that made it, rather than a flat rate regardless of investment.
   */
  setKillBounty(goldMultiplier: number, bonusGold: number) {
    this.pendingGoldMultiplier = goldMultiplier;
    this.pendingBonusGold = bonusGold;
  }

  takeDamage(damage: number, pierce: number = 0): void {
    const result = resolveDamage({ damage, pierce }, this.sim);
    this.sim.health = result.remainingHealth;
    this.sim.shield = result.remainingShield;

    // Repaint immediately rather than waiting for the next movement tick, so
    // damage is visible even on an enemy that is currently stationary.
    this.healthBar.update(
      this.visual.x,
      this.visual.y,
      this.spriteHeight(),
      this.sim.maxHealth > 0 ? this.sim.health / this.sim.maxHealth : 0,
    );

    if (result.lethal) {
      this.sim.alive = false;
      const events = sceneEvents(this.sceneRef);
      audio.play(this.sceneRef, deathSoundFor(this.sim.kind));
      const bounty =
        Math.round(this.sim.reward * this.pendingGoldMultiplier) + this.pendingBonusGold;
      events.emit("enemy-killed", bounty);

      if (this.sim.insigniaReward > 0) {
        // Both roles pay Insignia through the same path; only the boss count
        // feeds the end-of-run Seal payout.
        events.emit("lieutenantKilled", this.sim.insigniaReward);
        if (this.sim.role === "boss") {
          events.emit("bossKilled", this.sim.insigniaReward);
        }
      }
      this.playDeathAnimation();
    }
  }

  update(time: number, delta: number) {
    if (this.sim.dying) return;

    const result = advanceAlongPath(
      { position: { x: this.visual.x, y: this.visual.y }, pathIndex: this.sim.pathIndex },
      this.path,
      effectiveSpeed(this.sim, time),
      delta,
    );

    this.sim.pathIndex = result.pathIndex;

    if (result.reachedGoal) {
      const events = sceneEvents(this.sceneRef);
      // resolveLeakPenalty honours the lieutenant exemption, so a lieutenant
      // reports zero here however much health it escaped with.
      const penalty = resolveLeakPenalty(this.sim, this.sim.wave);
      // Only a leak that actually costs something makes a sound — a
      // lieutenant walking off is not a failure and must not sound like one.
      if (penalty > 0) audio.play(this.sceneRef, "leak");
      events.emit("enemy-reached-goal", penalty);
      if (this.sim.role === "lieutenant") {
        events.emit("lieutenantEscaped", this.sim.wave);
      }
      this.destroy();
      return;
    }

    this.sim.position = result.position;
    this.visual.x = result.position.x;
    this.visual.y = result.position.y;
    const spriteHeight = this.spriteHeight();
    this.healthBar.update(
      result.position.x,
      result.position.y,
      spriteHeight,
      this.sim.maxHealth > 0 ? this.sim.health / this.sim.maxHealth : 0,
    );
    this.badges.update(
      result.position.x,
      result.position.y,
      spriteHeight + HealthBar.reservedHeight(),
    );

    // An arrival tick covers no distance and carries a meaningless direction,
    // so facing and animation are left untouched — matching the original,
    // whose if/else could not reach the animation code on those frames.
    if (!result.advancedWaypoint) {
      this.applyFacing(result.direction, result.movingLeft);
      if (this.visual.active) {
        this.playWalkAnimation();
      }
    }
  }

  private spriteHeight(): number {
    return this.visual instanceof Phaser.GameObjects.Sprite ? this.visual.displayHeight : 32;
  }

  destroy() {
    this.badges.destroy();
    this.healthBar.destroy();
    if (this.visual && !this.sim.dying) {
      this.visual.destroy();
    } else if (this.visual && this.sim.dying) {
      // Let the death animation finish before the sprite disappears.
      this.sceneRef.time.delayedCall(1000, () => this.visual?.destroy());
    }
    super.destroy();
  }
}
