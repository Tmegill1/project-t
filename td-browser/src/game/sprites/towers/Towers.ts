import Phaser from "phaser";
import { TILE_SIZE } from "../../data/tiles";
import { getTowerDef } from "../../data/towers";
import { emptyTiers, spriteFrameFor } from "../../sim/upgrades";
import { BaseTower } from "./BaseTower";
import type { TowerKind } from "../../sim/entities";

/**
 * Builds a tower's visual: its sprite-sheet frame when the sheet is available,
 * otherwise a coloured hexagon so the game stays playable.
 */
function createVisual(scene: Phaser.Scene, kind: TowerKind): Phaser.GameObjects.GameObject {
  const def = getTowerDef(kind);
  const size = TILE_SIZE * def.size;

  if (scene.textures.exists("towers")) {
    const sprite = scene.add.sprite(0, 0, "towers", spriteFrameFor(kind, emptyTiers()));
    sprite.setDisplaySize(size, size);
    sprite.setOrigin(0.5, 0.5);
    sprite.setAlpha(1);
    // Normal blending keeps the sheet's transparency intact.
    sprite.setBlendMode(Phaser.BlendModes.NORMAL);
    return sprite;
  }

  const hexagon = createHexagon(scene, size, def.color);
  hexagon.setOrigin(0.5, 0.5);
  return hexagon;
}

/** Balanced stats: middling range, middling cadence, cheapest to build. */
export class BasicTower extends BaseTower {
  static readonly KIND: TowerKind = "basic";

  constructor(scene: Phaser.Scene, col: number, row: number) {
    super(scene, col, row, "basic", createVisual(scene, "basic"));
  }
}

/** Fires twice as often as the others, at shorter reach. */
export class FastTower extends BaseTower {
  static readonly KIND: TowerKind = "fast";

  constructor(scene: Phaser.Scene, col: number, row: number) {
    super(scene, col, row, "fast", createVisual(scene, "fast"));
  }
}

/** Reaches furthest, fires slowest, costs the most. */
export class LongRangeTower extends BaseTower {
  static readonly KIND: TowerKind = "long";

  constructor(scene: Phaser.Scene, col: number, row: number) {
    super(scene, col, row, "long", createVisual(scene, "long"));
  }
}

/** Area specialist: splash from the moment it is placed. */
export class MortarTower extends BaseTower {
  static readonly KIND: TowerKind = "mortar";

  constructor(scene: Phaser.Scene, col: number, row: number) {
    super(scene, col, row, "mortar", createVisual(scene, "mortar"));
  }
}

/** Maps a tower class to its data key. */
export const TOWER_KIND_BY_CLASS = new Map<unknown, TowerKind>([
  [BasicTower, "basic"],
  [FastTower, "fast"],
  [LongRangeTower, "long"],
  [MortarTower, "mortar"],
]);

/** Creates a hexagon centred on (0, 0), for the no-sprite-sheet fallback. */
function createHexagon(
  scene: Phaser.Scene,
  radius: number,
  fillColor: number,
): Phaser.GameObjects.Polygon {
  const points: Phaser.Geom.Point[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 2; // Start from the top
    points.push(new Phaser.Geom.Point(radius * Math.cos(angle), radius * Math.sin(angle)));
  }
  return scene.add.polygon(0, 0, points, fillColor, 1);
}
