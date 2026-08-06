import Phaser from "phaser";
import { TILE_SIZE } from "../../data/tiles";
import { getEnemyDef } from "../../data/enemies";
import { BaseEnemy } from "./BaseEnemy";
import type { EnemyKind } from "../../sim/entities";
import type { EnemyProperty } from "../../sim/properties";
import type { EnemyRole } from "../../sim/entities";

/** Lieutenant and boss knobs, forwarded straight to the spawn factory. */
export interface SpawnOptions {
  role?: EnemyRole;
  healthMultiplier?: number;
  extraSpeedMultiplier?: number;
  goldMultiplier?: number;
  insigniaReward?: number;
}

/**
 * Re-exported so existing importers keep working. The canonical definition now
 * lives in src/game/sim/entities.ts, since paths are simulation data.
 */
export type { PathPoint } from "../../sim/entities";

import type { PathPoint } from "../../sim/entities";

/** Fallback shapes for when a creature's sprite sheet failed to load. */
type FallbackFactory = (scene: Phaser.Scene, size: number) => Phaser.GameObjects.GameObject;

/**
 * Builds an enemy's visual: the animated sprite when its sheet is available,
 * otherwise a coloured primitive so the game stays playable.
 */
function createVisual(
  scene: Phaser.Scene,
  kind: EnemyKind,
  fallback: FallbackFactory,
): Phaser.GameObjects.GameObject {
  const def = getEnemyDef(kind);
  const size = TILE_SIZE * def.spriteScale;

  if (scene.textures.exists(`${def.textureKey}-walk-down`)) {
    const sprite = scene.add.sprite(0, 0, `${def.textureKey}-walk-down`, 0);
    sprite.setDisplaySize(size, size);
    sprite.setOrigin(0.5, 0.5);
    sprite.setFrame(0);
    if (def.flipHorizontally) {
      sprite.setFlipX(true);
    }
    return sprite;
  }

  return fallback(scene, size);
}

export class SlimeEnemy extends BaseEnemy {
  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    path: PathPoint[],
    speedModifier: number = 1,
    healthModifier: number = 1,
    currentWave: number = 1,
    properties: readonly EnemyProperty[] = [],
    spawnOptions: SpawnOptions = {},
  ) {
    const visual = createVisual(
      scene,
      "slime",
      (s) => new Phaser.GameObjects.Arc(s, 0, 0, TILE_SIZE * 0.35, 0, 360, false, 0xff0000, 1),
    );
    super(scene, x, y, path, "slime", visual, currentWave, speedModifier, healthModifier, properties, spawnOptions);
  }
}

export class OgreEnemy extends BaseEnemy {
  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    path: PathPoint[],
    speedModifier: number = 1,
    healthModifier: number = 1,
    currentWave: number = 1,
    properties: readonly EnemyProperty[] = [],
    spawnOptions: SpawnOptions = {},
  ) {
    const visual = createVisual(
      scene,
      "ogre",
      (s) => new Phaser.GameObjects.Rectangle(s, 0, 0, TILE_SIZE * 0.5, TILE_SIZE * 0.5, 0xff0000, 1),
    );
    super(scene, x, y, path, "ogre", visual, currentWave, speedModifier, healthModifier, properties, spawnOptions);
  }
}

export class BeeEnemy extends BaseEnemy {
  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    path: PathPoint[],
    speedModifier: number = 1,
    healthModifier: number = 1,
    currentWave: number = 1,
    properties: readonly EnemyProperty[] = [],
    spawnOptions: SpawnOptions = {},
  ) {
    const visual = createVisual(scene, "bee", (s) => {
      const size = TILE_SIZE * 0.4;
      return new Phaser.GameObjects.Triangle(
        s,
        0,
        0,
        0,
        -size / 2,
        -size / 2,
        size / 2,
        size / 2,
        size / 2,
        0xff0000,
        1,
      );
    });
    super(scene, x, y, path, "bee", visual, currentWave, speedModifier, healthModifier, properties, spawnOptions);
  }
}

