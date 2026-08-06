import Phaser from "phaser";
import {
  COMMAND_UNLOCKS,
  META_PASSIVES,
  META_PASSIVE_CEILING,
  POWER_UNLOCKS,
  TOWER_UNLOCKS,
} from "../data/metaUpgrades";
import {
  allPassiveIds,
  availableCommands,
  availablePowers,
  buyPassive,
  isTowerUnlocked,
  passiveBonus,
  passiveCost,
  unlockCommand,
  unlockPower,
  unlockTower,
} from "../sim/metaProgression";
import { getLoadResult, getProfile, isPersistent, saveProfile } from "../meta/profile";
import type { SaveData } from "../meta/saveSchema";

/**
 * The between-runs shop, where Seals are spent.
 *
 * Three sections in a deliberate order — unlocks first, passives last —
 * because unlocks buy *options* and passives buy *power*. The passive section
 * states its own ceiling on screen, so a player can see that grinding has a
 * defined end rather than assuming more Seals will eventually trivialise the
 * game.
 *
 * The list is clipped to the panel rather than scrolled. With the current
 * catalogue every row fits; if it grows past a screen, this needs a scroll
 * container rather than the current `break`.
 */

const PANEL_WIDTH = 420;
const ROW_HEIGHT = 46;

export class MetaShop {
  private scene: Phaser.Scene;
  private objects: Phaser.GameObjects.GameObject[] = [];
  private open = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  toggle() {
    if (this.open) this.hide();
    else this.show();
  }

  isOpen(): boolean {
    return this.open;
  }

  show() {
    this.hide();
    this.open = true;
    this.render();
  }

  private render() {
    for (const object of this.objects) object.destroy();
    this.objects = [];

    const profile = getProfile();
    const camera = this.scene.cameras.main;
    const centerX = camera.width / 2;
    const rows = this.buildRows(profile);

    const height = Math.min(camera.height - 40, rows.length * ROW_HEIGHT + 96);
    const top = (camera.height - height) / 2;

    // Full-screen dismiss layer, behind the panel. Tapping away from a panel
    // is what closes it everywhere else; the cross alone is not enough.
    this.push(
      this.scene.add
        .rectangle(0, 0, camera.width, camera.height, 0x000000, 0.55)
        .setOrigin(0, 0)
        .setScrollFactor(0)
        .setDepth(10900)
        .setInteractive({ useHandCursor: false })
        .on("pointerdown", () => this.hide()),
    );

    this.push(
      this.scene.add
        .rectangle(centerX, top, PANEL_WIDTH, height, 0x11141c, 0.98)
        .setOrigin(0.5, 0)
        .setStrokeStyle(2, 0x3a4256, 1)
        .setDepth(11000)
        // Swallows taps on empty panel space so they do not reach the
        // dismiss layer and close the shop from under the player.
        .setInteractive(),
    );

    const loadProblem = getLoadResult().problem;
    this.push(
      this.scene.add
        .text(
          centerX,
          top + 12,
          `Seals: ${profile.seals}   ·   lifetime ${profile.lifetimeSeals}   ✕`,
          { fontSize: "15px", color: "#ffd479", fontStyle: "bold" },
        )
        .setOrigin(0.5, 0)
        .setDepth(11001)
        .setInteractive({ useHandCursor: true })
        .on("pointerdown", () => this.hide()),
    );

    if (loadProblem || !isPersistent()) {
      // A player whose save could not be read deserves to be told, rather than
      // silently shown an empty profile and left to assume a bug ate it.
      this.push(
        this.scene.add
          .text(centerX, top + 34, loadProblem ?? "Progress will not persist in this browser.", {
            fontSize: "11px",
            color: "#ef4444",
            wordWrap: { width: PANEL_WIDTH - 30 },
            align: "center",
          })
          .setOrigin(0.5, 0)
          .setDepth(11001),
      );
    }

    let y = top + 54;
    for (const row of rows) {
      if (y + ROW_HEIGHT > top + height) break; // Clipped rather than overflowing.
      this.renderRow(row, centerX, y, profile);
      y += ROW_HEIGHT;
    }
  }

  private renderRow(row: ShopRow, centerX: number, y: number, profile: SaveData) {
    if (row.kind === "header") {
      this.push(
        this.scene.add
          .text(centerX - PANEL_WIDTH / 2 + 14, y + 12, row.label, {
            fontSize: "13px",
            color: "#8fb3ff",
            fontStyle: "bold",
          })
          .setDepth(11001),
      );
      return;
    }

    const affordable = row.cost > 0 && profile.seals >= row.cost;
    const background = this.scene.add
      .rectangle(
        centerX,
        y,
        PANEL_WIDTH - 20,
        ROW_HEIGHT - 4,
        row.owned ? 0x24303f : affordable ? 0x2f6b3f : 0x2a2f3c,
        1,
      )
      .setOrigin(0.5, 0)
      .setDepth(11001);

    const label = this.scene.add
      .text(
        centerX - PANEL_WIDTH / 2 + 18,
        y + 5,
        `${row.label}\n${row.detail}`,
        { fontSize: "11px", color: row.owned ? "#8a90a0" : "#ffffff", wordWrap: { width: PANEL_WIDTH - 110 } },
      )
      .setDepth(11002);

    const price = this.scene.add
      .text(centerX + PANEL_WIDTH / 2 - 18, y + 14, row.owned ? "owned" : `${row.cost}`, {
        fontSize: "12px",
        color: row.owned ? "#8a90a0" : affordable ? "#ffd479" : "#7d8390",
        fontStyle: "bold",
      })
      .setOrigin(1, 0)
      .setDepth(11002);

    if (!row.owned && affordable && row.buy) {
      const press = () => {
        const next = row.buy!(profile);
        if (next) {
          saveProfile(next);
          this.render();
        }
      };
      background.setInteractive({ useHandCursor: true }).on("pointerdown", press);
      label.setInteractive({ useHandCursor: true }).on("pointerdown", press);
    }

    this.push(background, label, price);
  }

  private buildRows(profile: SaveData): ShopRow[] {
    const rows: ShopRow[] = [{ kind: "header", label: "TOWERS — new options to build" }];

    for (const unlock of TOWER_UNLOCKS) {
      const owned = isTowerUnlocked(profile, unlock.tower);
      rows.push({
        kind: "item",
        label: unlock.label,
        detail: unlock.description,
        cost: unlock.cost,
        owned,
        buy: (save) => {
          const result = unlockTower(save, unlock.tower);
          return result.ok ? result.save : null;
        },
      });
    }

    rows.push({ kind: "header", label: "POWERS — added to the in-run Insignia pool" });

    for (const unlock of POWER_UNLOCKS) {
      const owned = availablePowers(profile).includes(unlock.power);
      rows.push({
        kind: "item",
        label: unlock.label,
        detail: "Buyable with Insignia during a run.",
        cost: unlock.cost,
        owned,
        buy: (save) => {
          const result = unlockPower(save, unlock.power);
          return result.ok ? result.save : null;
        },
      });
    }

    for (const unlock of COMMAND_UNLOCKS) {
      const owned = availableCommands(profile).includes(unlock.command);
      rows.push({
        kind: "item",
        label: `${unlock.label} (command)`,
        detail: "Buyable with Insignia during a run.",
        cost: unlock.cost,
        owned,
        buy: (save) => {
          const result = unlockCommand(save, unlock.command);
          return result.ok ? result.save : null;
        },
      });
    }

    // The ceiling is stated on screen so the player can see grinding has an
    // end, rather than assuming enough Seals will trivialise the game.
    rows.push({
      kind: "header",
      label: `PASSIVES — permanent, capped at +${Math.round(META_PASSIVE_CEILING * 100)}%`,
    });

    for (const id of allPassiveIds()) {
      const definition = META_PASSIVES[id];
      const tier = profile.passives[id] ?? 0;
      const maxed = tier >= definition.maxTier;
      const bonus = Math.round(passiveBonus(profile, id) * 1000) / 10;

      rows.push({
        kind: "item",
        label: `${definition.label}  (${tier}/${definition.maxTier})  +${bonus}%`,
        detail: definition.description,
        cost: passiveCost(profile, id),
        owned: maxed,
        buy: (save) => {
          const result = buyPassive(save, id);
          return result.ok ? result.save : null;
        },
      });
    }

    return rows;
  }

  private push(...objects: Phaser.GameObjects.GameObject[]) {
    this.objects.push(...objects);
  }

  hide() {
    for (const object of this.objects) object.destroy();
    this.objects = [];
    this.open = false;
  }
}

type ShopRow =
  | { kind: "header"; label: string }
  | {
      kind: "item";
      label: string;
      detail: string;
      cost: number;
      owned: boolean;
      buy: (save: SaveData) => SaveData | null;
    };
