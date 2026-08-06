import Phaser from "phaser";
import { ECONOMY } from "../data/economy";
import { callEarlyBonus } from "../sim/economy";

/**
 * The button that starts the next wave, and pays for starting it early.
 *
 * Replaces the plain Start button. The prep window between waves is real time
 * the player can spend building — calling early converts what is left of it
 * into gold, so waiting and rushing are both defensible and the choice is
 * theirs.
 *
 * The bonus is shown *on the button and counting down*, because a reward the
 * player cannot see is not an incentive. Watching it drain is the mechanic.
 */

const WIDTH = 150;
const HEIGHT = 48;

const COLORS = {
  ready: 0x2f6b3f,
  hover: 0x3d8a52,
  urgent: 0x8a6a2f,
} as const;

export class CallWaveButton {
  private scene: Phaser.Scene;
  private button?: Phaser.GameObjects.Rectangle;
  private label?: Phaser.GameObjects.Text;
  private onCall?: (bonus: number) => void;

  /** Simulation time the prep window closes. */
  private deadlineMs = 0;
  private getNow: () => number = () => 0;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /**
   * Opens a prep window at (x, y).
   *
   * @param getNow Reads the scene clock, so the countdown matches the timer
   *               that will start the wave automatically.
   */
  show(
    x: number,
    y: number,
    getNow: () => number,
    onCall: (bonus: number) => void,
  ) {
    this.hide();
    this.getNow = getNow;
    this.onCall = onCall;
    this.deadlineMs = getNow() + ECONOMY.callEarly.prepDurationMs;

    this.button = this.scene.add
      .rectangle(x, y, WIDTH, HEIGHT, COLORS.ready, 1)
      .setStrokeStyle(2, 0xffffff, 1)
      .setDepth(5000)
      .setInteractive({ useHandCursor: true });

    this.label = this.scene.add
      .text(x, y, "", {
        fontSize: "13px",
        color: "#ffffff",
        fontStyle: "bold",
        align: "center",
      })
      .setOrigin(0.5, 0.5)
      .setDepth(5001)
      .setInteractive({ useHandCursor: true });

    const press = () => this.call();
    this.button.on("pointerdown", press);
    this.label.on("pointerdown", press);
    this.button.on("pointerover", () => this.button?.setFillStyle(COLORS.hover, 1));
    this.button.on("pointerout", () => this.refreshColor());

    this.update();
  }

  /** Milliseconds of prep left. */
  remainingMs(): number {
    return Math.max(0, this.deadlineMs - this.getNow());
  }

  /** Gold the player would collect by calling right now. */
  currentBonus(): number {
    return callEarlyBonus(this.remainingMs());
  }

  /** Repaints the countdown. Called every frame while visible. */
  update() {
    if (!this.button || !this.label) return;

    const seconds = Math.ceil(this.remainingMs() / 1000);
    const bonus = this.currentBonus();

    this.label.setText(
      bonus > 0 ? `Call wave early\n+$${bonus}  ·  ${seconds}s` : "Start wave",
    );
    this.refreshColor();
  }

  private refreshColor() {
    // Turns amber as the bonus runs out, so the window closing is visible
    // without reading the number.
    const fraction = this.remainingMs() / ECONOMY.callEarly.prepDurationMs;
    this.button?.setFillStyle(fraction < 0.3 ? COLORS.urgent : COLORS.ready, 1);
  }

  /** Fires the callback with whatever bonus was still on the clock. */
  private call() {
    const bonus = this.currentBonus();
    const callback = this.onCall;
    this.hide();
    callback?.(bonus);
  }

  /** True once the window has closed and the wave should start on its own. */
  hasExpired(): boolean {
    return this.isVisible() && this.remainingMs() <= 0;
  }

  isVisible(): boolean {
    return this.button !== undefined;
  }

  hide() {
    this.button?.destroy();
    this.label?.destroy();
    this.button = undefined;
    this.label = undefined;
    this.onCall = undefined;
  }
}
