import Phaser from "phaser";
import { COMMAND_UPGRADES, COMMAND_UPGRADE_IDS, TACTICAL_POWERS, TACTICAL_POWER_IDS } from "../data/powers";
import { canCast, cooldownRemaining, effectiveCooldown, isUnlocked } from "../sim/powers";
import type { CommandUpgradeId, TacticalPowerId } from "../data/powers";
import type { PowerState } from "../sim/powers";

/**
 * The tactical power bar and the Insignia shop.
 *
 * **Touch-first is a requirement here, not polish.** The mobile port is the
 * reason, and three rules follow from it:
 *
 * - *Thumb-reachable.* Buttons sit along the bottom edge, where a thumb rests.
 *   Nothing important lives in the top corners.
 * - *Portrait-safe.* The bar lays out across the width it is given and never
 *   assumes a landscape aspect, so it survives a rotation.
 * - *No hover-dependent information.* Every button states its own cost,
 *   cooldown, and effect on its face. There is no tooltip, because on a
 *   touchscreen there is no hover to trigger one.
 *
 * Cooldown is shown as a shrinking overlay rather than a number alone, so it
 * reads at a glance mid-wave.
 */

const BUTTON_HEIGHT = 62;
const BUTTON_GAP = 6;
const BAR_MARGIN = 8;

/** Smallest comfortable touch target. Buttons never go below this. */
const MIN_TOUCH_SIZE = 44;

/**
 * Vertical space the bar owns along the bottom edge, including the Insignia
 * counter above it.
 *
 * Exported because the bar has first claim on the thumb zone — anything else
 * anchored to the bottom (the tower panel) must sit above this, or the two
 * overlap and the player taps the wrong thing.
 */
export const POWER_BAR_RESERVED_HEIGHT =
  BAR_MARGIN + Math.max(MIN_TOUCH_SIZE, BUTTON_HEIGHT) + 26;

const COLORS = {
  ready: 0x2f5d8a,
  cooling: 0x2a3242,
  locked: 0x23262f,
  affordable: 0x2f6b3f,
  panel: 0x151922,
  border: 0x3a4256,
} as const;

interface PowerButton {
  id: TacticalPowerId;
  background: Phaser.GameObjects.Rectangle;
  cooldownOverlay: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
  width: number;
  x: number;
  y: number;
}

export class PowerBar {
  private scene: Phaser.Scene;
  private buttons: PowerButton[] = [];
  private shopOpen = false;
  private shopObjects: Phaser.GameObjects.GameObject[] = [];
  private insigniaText?: Phaser.GameObjects.Text;

  private getState: () => PowerState = () => ({
    unlocked: [],
    commands: [],
    readyAtMs: {},
    active: [],
  });
  private getInsignia: () => number = () => 0;
  private powerPool: ReadonlySet<TacticalPowerId> = new Set(TACTICAL_POWER_IDS);
  private commandPool: ReadonlySet<CommandUpgradeId> = new Set(COMMAND_UPGRADE_IDS);
  private getNow: () => number = () => 0;

  private onCast?: (power: TacticalPowerId) => void;
  private onUnlock?: (power: TacticalPowerId) => void;
  private onBuyCommand?: (upgrade: CommandUpgradeId) => void;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  create(handlers: {
    getState: () => PowerState;
    /** Powers this profile has unlocked. Others are not offered. */
    availablePowers?: ReadonlySet<TacticalPowerId>;
    availableCommands?: ReadonlySet<CommandUpgradeId>;
    getInsignia: () => number;
    getNow: () => number;
    onCast: (power: TacticalPowerId) => void;
    onUnlock: (power: TacticalPowerId) => void;
    onBuyCommand: (upgrade: CommandUpgradeId) => void;
  }) {
    this.destroy();
    this.getState = handlers.getState;
    this.powerPool = handlers.availablePowers ?? new Set(TACTICAL_POWER_IDS);
    this.commandPool = handlers.availableCommands ?? new Set(COMMAND_UPGRADE_IDS);
    this.getInsignia = handlers.getInsignia;
    this.getNow = handlers.getNow;
    this.onCast = handlers.onCast;
    this.onUnlock = handlers.onUnlock;
    this.onBuyCommand = handlers.onBuyCommand;

    this.buildBar();
  }

  private buildBar() {
    const camera = this.scene.cameras.main;
    const count = TACTICAL_POWER_IDS.length;

    // Divide the available width rather than assuming a fixed button size, so
    // a portrait screen gets narrower buttons instead of an overflowing row.
    const usable = camera.width - BAR_MARGIN * 2 - BUTTON_GAP * (count - 1);
    const buttonWidth = Math.max(MIN_TOUCH_SIZE, Math.floor(usable / count));
    const height = Math.max(MIN_TOUCH_SIZE, BUTTON_HEIGHT);
    const y = camera.height - BAR_MARGIN - height;

    TACTICAL_POWER_IDS.forEach((id, index) => {
      const x = BAR_MARGIN + index * (buttonWidth + BUTTON_GAP);
      this.buttons.push(this.createButton(id, x, y, buttonWidth, height));
    });

    // The Insignia counter sits directly above its spending buttons, so the
    // resource and the thing it buys read as one unit.
    this.insigniaText = this.scene.add
      .text(BAR_MARGIN, y - 22, "", {
        fontSize: "13px",
        color: "#ffd479",
        stroke: "#000000",
        strokeThickness: 3,
      })
      .setScrollFactor(0)
      .setDepth(9100)
      .setInteractive({ useHandCursor: true });
    this.insigniaText.on("pointerdown", () => this.toggleShop());
  }

  private createButton(
    id: TacticalPowerId,
    x: number,
    y: number,
    width: number,
    height: number,
  ): PowerButton {
    const power = TACTICAL_POWERS[id];

    const background = this.scene.add
      .rectangle(x, y, width, height, COLORS.locked, 0.95)
      .setOrigin(0, 0)
      .setStrokeStyle(2, COLORS.border, 1)
      .setScrollFactor(0)
      .setDepth(9100)
      .setInteractive({ useHandCursor: true });

    // Drawn from the bottom up as the cooldown expires, so "nearly ready" is
    // legible without reading a number.
    const cooldownOverlay = this.scene.add
      .rectangle(x, y + height, width, 0, 0x000000, 0.55)
      .setOrigin(0, 1)
      .setScrollFactor(0)
      .setDepth(9101);

    // The face carries name, cost and cooldown. No hover required.
    const label = this.scene.add
      .text(x + 6, y + 6, `${power.label}\n${power.cost}◈  ${power.cooldownMs / 1000}s`, {
        fontSize: "11px",
        color: "#ffffff",
        wordWrap: { width: width - 12 },
      })
      .setScrollFactor(0)
      .setDepth(9102);

    const press = () => this.pressPower(id);
    background.on("pointerdown", press);
    label.setInteractive({ useHandCursor: true }).on("pointerdown", press);

    return { id, background, cooldownOverlay, label, width, x, y };
  }

  /** Casts if unlocked and ready; otherwise opens the shop to buy it. */
  private pressPower(id: TacticalPowerId) {
    const state = this.getState();
    if (!isUnlocked(state, id)) {
      // Not in this profile's pool at all — the shop has nothing to offer.
      if (this.powerPool.has(id)) this.openShop();
      return;
    }
    if (canCast(state, id, this.getNow())) {
      this.onCast?.(id);
    }
  }

  /** Repaints cooldowns and affordability. Called every frame. */
  update() {
    const state = this.getState();
    const now = this.getNow();
    const insignia = this.getInsignia();

    for (const button of this.buttons) {
      const unlocked = isUnlocked(state, button.id);
      const remaining = cooldownRemaining(state, button.id, now);
      const ready = unlocked && remaining === 0;

      button.background.setFillStyle(
        ready ? COLORS.ready : unlocked ? COLORS.cooling : COLORS.locked,
        0.95,
      );

      const height = Math.max(MIN_TOUCH_SIZE, BUTTON_HEIGHT);
      if (unlocked && remaining > 0) {
        const fraction = remaining / effectiveCooldown(state, button.id);
        button.cooldownOverlay.setSize(button.width, height * fraction);
        button.cooldownOverlay.setVisible(true);
      } else {
        button.cooldownOverlay.setVisible(false);
      }

      const power = TACTICAL_POWERS[button.id];
      button.label.setText(
        unlocked
          ? `${power.label}\n${remaining > 0 ? `${Math.ceil(remaining / 1000)}s` : "READY"}`
          : this.powerPool.has(button.id)
            ? `${power.label}\n${power.cost}◈ locked`
            : `${power.label}\nnot unlocked`,
      );
      button.label.setColor(unlocked ? "#ffffff" : insignia >= power.cost ? "#ffd479" : "#7d8390");
    }

    this.insigniaText?.setText(`◈ ${insignia} Insignia  —  tap to spend`);
    if (this.shopOpen) this.renderShop();
  }

  private toggleShop() {
    if (this.shopOpen) this.closeShop();
    else this.openShop();
  }

  private openShop() {
    this.shopOpen = true;
    this.renderShop();
  }

  closeShop() {
    this.shopOpen = false;
    for (const object of this.shopObjects) object.destroy();
    this.shopObjects = [];
  }

  isShopOpen(): boolean {
    return this.shopOpen;
  }

  /** The Insignia shop: unlock powers, buy command upgrades. */
  private renderShop() {
    for (const object of this.shopObjects) object.destroy();
    this.shopObjects = [];

    const camera = this.scene.cameras.main;
    const state = this.getState();
    const insignia = this.getInsignia();

    const rows: Array<{ text: string; enabled: boolean; press: () => void }> = [];

    for (const id of TACTICAL_POWER_IDS) {
      if (isUnlocked(state, id) || !this.powerPool.has(id)) continue;
      const power = TACTICAL_POWERS[id];
      rows.push({
        text: `${power.label}  ${power.cost}◈\n${power.description}`,
        enabled: insignia >= power.cost,
        press: () => {
          this.onUnlock?.(id);
          this.renderShop();
        },
      });
    }

    for (const id of COMMAND_UPGRADE_IDS) {
      if (state.commands.includes(id) || !this.commandPool.has(id)) continue;
      const upgrade = COMMAND_UPGRADES[id];
      rows.push({
        text: `${upgrade.label}  ${upgrade.cost}◈  (permanent)\n${upgrade.description}`,
        enabled: insignia >= upgrade.cost,
        press: () => {
          this.onBuyCommand?.(id);
          this.renderShop();
        },
      });
    }

    const width = Math.min(360, camera.width - BAR_MARGIN * 2);
    const rowHeight = Math.max(MIN_TOUCH_SIZE, 50);
    const height = Math.max(rowHeight, rows.length * rowHeight) + 44;
    const top = camera.height - BAR_MARGIN - BUTTON_HEIGHT - 26 - height;

    const panel = this.scene.add
      .rectangle(BAR_MARGIN, top, width, height, COLORS.panel, 0.97)
      .setOrigin(0, 0)
      .setStrokeStyle(2, COLORS.border, 1)
      .setScrollFactor(0)
      .setDepth(9200);
    this.shopObjects.push(panel);

    const title = this.scene.add
      .text(BAR_MARGIN + 8, top + 8, `Spend Insignia  (◈ ${insignia})   ✕`, {
        fontSize: "13px",
        color: "#ffd479",
      })
      .setScrollFactor(0)
      .setDepth(9201)
      .setInteractive({ useHandCursor: true });
    title.on("pointerdown", () => this.closeShop());
    this.shopObjects.push(title);

    if (rows.length === 0) {
      this.shopObjects.push(
        this.scene.add
          .text(BAR_MARGIN + 8, top + 34, "Everything bought.", {
            fontSize: "12px",
            color: "#8a90a0",
          })
          .setScrollFactor(0)
          .setDepth(9201),
      );
      return;
    }

    rows.forEach((row, index) => {
      const y = top + 34 + index * rowHeight;
      const background = this.scene.add
        .rectangle(BAR_MARGIN + 6, y, width - 12, rowHeight - 4, row.enabled ? COLORS.affordable : COLORS.locked, 1)
        .setOrigin(0, 0)
        .setScrollFactor(0)
        .setDepth(9201);

      const label = this.scene.add
        .text(BAR_MARGIN + 12, y + 5, row.text, {
          fontSize: "11px",
          color: row.enabled ? "#ffffff" : "#7d8390",
          wordWrap: { width: width - 28 },
        })
        .setScrollFactor(0)
        .setDepth(9202);

      if (row.enabled) {
        background.setInteractive({ useHandCursor: true }).on("pointerdown", row.press);
        label.setInteractive({ useHandCursor: true }).on("pointerdown", row.press);
      }

      this.shopObjects.push(background, label);
    });
  }

  /** Screen-space bounds, so the scene can stop taps falling through to the board. */
  containsPoint(x: number, y: number): boolean {
    const camera = this.scene.cameras.main;
    if (y > camera.height - POWER_BAR_RESERVED_HEIGHT) return true;
    return this.shopOpen && x < 380 && y > camera.height - 460;
  }

  destroy() {
    this.closeShop();
    for (const button of this.buttons) {
      button.background.destroy();
      button.cooldownOverlay.destroy();
      button.label.destroy();
    }
    this.buttons = [];
    this.insigniaText?.destroy();
    this.insigniaText = undefined;
  }
}
