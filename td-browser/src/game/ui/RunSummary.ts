import Phaser from "phaser";
import { SEAL_CONVERSION, sealsForRun } from "../sim/currencies";
import { bankRunResult, isPersistent } from "../meta/profile";
import type { SealBreakdown } from "../sim/currencies";

/**
 * The end-of-run screen: what the run earned, and where it came from.
 *
 * The breakdown is itemised rather than shown as a total, because the
 * conversion is a mechanic the player is meant to reason about. Seeing
 * "6 unspent Insignia → 3 Seals" alongside "20 waves → 20 Seals" is what makes
 * the final-wave choice — spend to survive, or bank for progress — legible
 * enough to make deliberately next time.
 */

const PANEL_WIDTH = 380;
const ROW_HEIGHT = 26;

export interface RunSummaryData {
  wavesSurvived: number;
  bossesKilled: number;
  unspentInsignia: number;
  victory: boolean;
}

export class RunSummary {
  private scene: Phaser.Scene;
  private objects: Phaser.GameObjects.GameObject[] = [];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /**
   * Shows the summary and banks the run.
   *
   * Banking happens here rather than at the call site so the numbers displayed
   * and the numbers persisted cannot drift apart.
   */
  show(data: RunSummaryData, onContinue: () => void) {
    this.hide();

    const breakdown = sealsForRun({
      wavesSurvived: data.wavesSurvived,
      bossesKilled: data.bossesKilled,
      unspentInsignia: data.unspentInsignia,
    });

    const profile = bankRunResult({ ...data, sealsEarned: breakdown.total });

    const camera = this.scene.cameras.main;
    const centerX = camera.width / 2;
    const rows = this.buildRows(data, breakdown);
    const height = rows.length * ROW_HEIGHT + 132;
    const top = Math.max(20, camera.height / 2 - height / 2);

    this.add(
      this.scene.add
        .rectangle(centerX, top, PANEL_WIDTH, height, 0x11141c, 0.97)
        .setOrigin(0.5, 0)
        .setStrokeStyle(2, 0x3a4256, 1)
        .setScrollFactor(0)
        .setDepth(12000),
    );

    this.add(
      this.scene.add
        .text(centerX, top + 14, data.victory ? "Victory" : "Run over", {
          fontSize: "22px",
          color: data.victory ? "#4ade80" : "#ef4444",
          fontStyle: "bold",
        })
        .setOrigin(0.5, 0)
        .setScrollFactor(0)
        .setDepth(12001),
    );

    rows.forEach((row, index) => {
      const y = top + 52 + index * ROW_HEIGHT;
      this.add(
        this.scene.add
          .text(centerX - PANEL_WIDTH / 2 + 18, y, row.label, {
            fontSize: "13px",
            color: row.emphasis ? "#ffd479" : "#c8d0e0",
          })
          .setScrollFactor(0)
          .setDepth(12001),
      );
      this.add(
        this.scene.add
          .text(centerX + PANEL_WIDTH / 2 - 18, y, row.value, {
            fontSize: "13px",
            color: row.emphasis ? "#ffd479" : "#ffffff",
            fontStyle: row.emphasis ? "bold" : "normal",
          })
          .setOrigin(1, 0)
          .setScrollFactor(0)
          .setDepth(12001),
      );
    });

    const footerY = top + 52 + rows.length * ROW_HEIGHT + 10;
    this.add(
      this.scene.add
        .text(
          centerX,
          footerY,
          isPersistent()
            ? `Total banked: ${profile.seals} Seals`
            : "Storage unavailable — this run was not saved.",
          { fontSize: "12px", color: isPersistent() ? "#8a90a0" : "#ef4444" },
        )
        .setOrigin(0.5, 0)
        .setScrollFactor(0)
        .setDepth(12001),
    );

    // 44px tall, tappable on its label as well as its body — the same
    // touch rules the power bar follows.
    const buttonY = footerY + 30;
    const button = this.scene.add
      .rectangle(centerX, buttonY, 200, 44, 0x2f6b3f, 1)
      .setOrigin(0.5, 0)
      .setStrokeStyle(2, 0xffffff, 1)
      .setScrollFactor(0)
      .setDepth(12001)
      .setInteractive({ useHandCursor: true });

    const label = this.scene.add
      .text(centerX, buttonY + 12, "Continue", {
        fontSize: "15px",
        color: "#ffffff",
        fontStyle: "bold",
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(12002)
      .setInteractive({ useHandCursor: true });

    const press = () => {
      this.hide();
      onContinue();
    };
    button.on("pointerdown", press);
    label.on("pointerdown", press);

    this.add(button, label);
  }

  private buildRows(
    data: RunSummaryData,
    breakdown: SealBreakdown,
  ): Array<{ label: string; value: string; emphasis?: boolean }> {
    const rows = [
      { label: "Waves survived", value: `${data.wavesSurvived}` },
      {
        label: `  → Seals (${SEAL_CONVERSION.perWaveSurvived} each)`,
        value: `+${breakdown.fromWaves}`,
      },
      { label: "Bosses defeated", value: `${data.bossesKilled}` },
      {
        label: `  → Seals (${SEAL_CONVERSION.perBossKilled} each)`,
        value: `+${breakdown.fromBosses}`,
      },
      { label: "Unspent Insignia", value: `${data.unspentInsignia}` },
      {
        // Spelled out because it is the whole point of the final-wave choice.
        label: `  → Seals (${SEAL_CONVERSION.perUnspentInsignia} each)`,
        value: `+${breakdown.fromInsignia}`,
      },
      { label: "Seals earned", value: `${breakdown.total}`, emphasis: true },
    ];
    return rows;
  }

  private add(...objects: Phaser.GameObjects.GameObject[]) {
    this.objects.push(...objects);
  }

  isVisible(): boolean {
    return this.objects.length > 0;
  }

  hide() {
    for (const object of this.objects) object.destroy();
    this.objects = [];
  }
}
