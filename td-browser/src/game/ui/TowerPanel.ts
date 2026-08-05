import Phaser from "phaser";
import { UPGRADE_DEFS } from "../data/upgrades";
import { MAX_TIER } from "../sim/upgrades";
import { POWER_BAR_RESERVED_HEIGHT } from "./PowerBar";
import { BaseTower } from "../sprites/towers/BaseTower";
import type { UpgradeBranch } from "../data/upgrades";

/**
 * The panel shown when a tower is selected: both upgrade branches, what the
 * next tier does, the targeting priority, and a sell button.
 *
 * Communicating the branches is a requirement, not polish. A player who cannot
 * see that committing to one branch closes the other cannot make the choice the
 * cross-path rule exists to create — so a gated branch says *why* it is gated
 * rather than simply refusing the click.
 *
 * Layout is thumb-first and portrait-safe: full-width rows stacked at the
 * bottom of the screen, each at least 44px tall, with nothing that depends on
 * hover. Phase 2's power bar has to live on the same screen edge, and the
 * mobile port is the reason.
 */

const PANEL_WIDTH = 300;
const ROW_HEIGHT = 52;
const PADDING = 8;

const COLORS = {
  panel: 0x1b1f2a,
  border: 0x3a4256,
  affordable: 0x2f6b3f,
  unaffordable: 0x4a3030,
  gated: 0x2a2f3c,
  sell: 0xaa0000,
  targeting: 0x2c3e6b,
} as const;

interface Row {
  background: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
}

export class TowerPanel {
  private scene: Phaser.Scene;
  private container?: Phaser.GameObjects.Container;
  private tower?: BaseTower;
  private rows: Row[] = [];
  /** Height of the panel as last rendered, for the hit test. */
  private height = 0;

  private onUpgrade?: (branch: UpgradeBranch) => void;
  private onSell?: () => void;
  private canAfford: (cost: number) => boolean = () => true;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  show(
    tower: BaseTower,
    handlers: {
      onUpgrade: (branch: UpgradeBranch) => void;
      onSell: () => void;
      canAfford: (cost: number) => boolean;
    },
  ) {
    this.hide();
    this.tower = tower;
    this.onUpgrade = handlers.onUpgrade;
    this.onSell = handlers.onSell;
    this.canAfford = handlers.canAfford;
    this.render();
  }

  /** Rebuilds in place, so buying a tier updates prices and gating at once. */
  refresh() {
    if (!this.tower) return;
    const tower = this.tower;
    const handlers = {
      onUpgrade: this.onUpgrade!,
      onSell: this.onSell!,
      canAfford: this.canAfford,
    };
    this.show(tower, handlers);
  }

  private render() {
    const tower = this.tower;
    if (!tower) return;

    const camera = this.scene.cameras.main;
    // Bottom-left in screen space, but stacked *above* the power bar rather
    // than on top of it. The power bar has first claim on the thumb zone.
    const x = PADDING;
    const y = camera.height - PADDING - POWER_BAR_RESERVED_HEIGHT;

    this.container = this.scene.add.container(0, 0);
    this.container.setScrollFactor(0);
    this.container.setDepth(9000);

    const rowSpecs = this.buildRowSpecs();
    const height = rowSpecs.length * ROW_HEIGHT + PADDING * 2 + 28;
    this.height = height;
    const top = y - height;

    const panel = this.scene.add
      .rectangle(x, top, PANEL_WIDTH, height, COLORS.panel, 0.95)
      .setOrigin(0, 0)
      .setStrokeStyle(2, COLORS.border, 1)
      .setScrollFactor(0);
    this.container.add(panel);

    const stats = tower.getStats();
    const title = this.scene.add
      .text(
        x + PADDING,
        top + PADDING,
        `${tower.getLabel()}  ·  ${stats.damage} dmg / ${(stats.fireRate / 1000).toFixed(2)}s` +
          (stats.pierce > 0 ? `  ·  pierce ${stats.pierce}` : "") +
          (stats.splashRadius > 0 ? `  ·  splash` : "") +
          (stats.detection ? `  ·  detection` : "") +
          (stats.slowFactor < 1 ? `  ·  slow` : ""),
        { fontSize: "12px", color: "#c8d0e0" },
      )
      .setScrollFactor(0);
    this.container.add(title);

    rowSpecs.forEach((spec, index) => {
      const rowY = top + PADDING + 26 + index * ROW_HEIGHT;
      this.container!.add(this.createRow(x + PADDING, rowY, spec).background);
      this.container!.add(this.rows[this.rows.length - 1].label);
    });
  }

  private buildRowSpecs(): RowSpec[] {
    const tower = this.tower!;
    const specs: RowSpec[] = [];

    for (const branch of ["sustained", "burst"] as const) {
      const definition = UPGRADE_DEFS[tower.getKind()][branch];
      const tier = tower.getTiers()[branch];
      const next = tower.getNextTier(branch);

      if (!next) {
        // Distinguish "finished" from "locked out". They look the same to a
        // click but mean opposite things to a plan.
        const maxed = tier >= MAX_TIER;
        specs.push({
          text:
            `${definition.label}  ·  tier ${tier} of ${MAX_TIER}\n` +
            (maxed ? "Fully upgraded." : "Locked — the other branch went deep."),
          color: COLORS.gated,
          enabled: false,
        });
        continue;
      }

      const cost = tower.getUpgradeCost(branch);
      const affordable = this.canAfford(cost);
      specs.push({
        text:
          `${definition.label}  ·  tier ${tier} of ${MAX_TIER}   $${cost}\n` +
          `${next.label} — ${next.description}`,
        color: affordable ? COLORS.affordable : COLORS.unaffordable,
        enabled: affordable,
        onPress: () => this.onUpgrade?.(branch),
      });
    }

    specs.push({
      text: `Targeting: ${tower.getPriorityLabel()}   (tap to change)`,
      color: COLORS.targeting,
      enabled: true,
      onPress: () => {
        tower.cyclePriority();
        this.refresh();
      },
    });

    specs.push({
      text: `Sell for $${Math.floor(tower.getInvestedValue() / 2)}`,
      color: COLORS.sell,
      enabled: true,
      onPress: () => this.onSell?.(),
    });

    return specs;
  }

  private createRow(x: number, y: number, spec: RowSpec): Row {
    const width = PANEL_WIDTH - PADDING * 2;
    // 44px is the smallest comfortable touch target; rows are taller still.
    const background = this.scene.add
      .rectangle(x, y, width, ROW_HEIGHT - 6, spec.color, 1)
      .setOrigin(0, 0)
      .setScrollFactor(0);

    const label = this.scene.add
      .text(x + 8, y + 6, spec.text, {
        fontSize: "12px",
        color: spec.enabled ? "#ffffff" : "#8a90a0",
        wordWrap: { width: width - 16 },
      })
      .setScrollFactor(0);

    if (spec.enabled && spec.onPress) {
      background.setInteractive({ useHandCursor: true });
      // Both the block and its text accept the tap, so a thumb landing on a
      // letter still registers.
      label.setInteractive({ useHandCursor: true });
      background.on("pointerdown", spec.onPress);
      label.on("pointerdown", spec.onPress);
    }

    const row = { background, label };
    this.rows.push(row);
    return row;
  }

  hide() {
    for (const row of this.rows) {
      row.background.destroy();
      row.label.destroy();
    }
    this.rows = [];
    this.container?.destroy();
    this.container = undefined;
    this.tower = undefined;
  }

  isVisible(): boolean {
    return this.container !== undefined;
  }

  /** Screen-space bounds, so a tap on the panel does not reach the board. */
  containsPoint(x: number, y: number): boolean {
    if (!this.container) return false;
    const camera = this.scene.cameras.main;
    const bottom = camera.height - PADDING - POWER_BAR_RESERVED_HEIGHT;
    return x >= 0 && x <= PANEL_WIDTH + PADDING * 2 && y <= bottom && y >= bottom - this.height;
  }

  getTower(): BaseTower | undefined {
    return this.tower;
  }
}

interface RowSpec {
  text: string;
  color: number;
  enabled: boolean;
  onPress?: () => void;
}
