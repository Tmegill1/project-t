import Phaser from "phaser";
import { AUDIO_EXTENSION, AUDIO_PATH, SOUNDS, SOUND_IDS } from "../data/audio";
import type { SoundId } from "../data/audio";

/**
 * The one place the game makes noise.
 *
 * A module-level singleton for the same reason the profile is: Phaser scenes
 * are constructed by the framework and restarted freely, and audio outlives
 * any one of them.
 *
 * Three things this has to get right, none of which are obvious:
 *
 * 1. **Autoplay policy.** Browsers refuse to start audio before a user
 *    gesture. Without an explicit unlock the first several sounds are dropped
 *    silently and the game appears to have no audio at all — the single most
 *    common way this feature ships broken.
 * 2. **Missing files must not throw.** A manifest entry with no file behind it
 *    should be silent, not a crash. That keeps a half-finished sound pack
 *    playable and lets a file be swapped without touching code.
 * 3. **Rate limiting.** At wave 15 there are 160 enemies dying and eight
 *    towers firing. Playing every event produces noise rather than feedback,
 *    and enough overlapping sources will stutter the tab.
 */

class AudioManager {
  private muted = false;
  /** Per-sound timestamp of the last play, for cooldowns. */
  private lastPlayed = new Map<SoundId, number>();
  /** Sounds that failed to load. Asked for, but never again complained about. */
  private missing = new Set<SoundId>();
  private unlocked = false;

  /** Queues every sound for loading. Call from a scene's preload(). */
  preload(scene: Phaser.Scene) {
    for (const id of SOUND_IDS) {
      // Already loaded by an earlier scene; re-adding warns and wastes work.
      if (scene.cache.audio.exists(id)) continue;
      scene.load.audio(id, `${AUDIO_PATH}/${SOUNDS[id].file}.${AUDIO_EXTENSION}`);
    }

    // A missing file is a silent sound, not a broken game.
    scene.load.on("loaderror", (file: Phaser.Loader.File) => {
      if (SOUND_IDS.includes(file.key as SoundId)) {
        this.missing.add(file.key as SoundId);
      }
    });
  }

  /**
   * Arranges for the audio context to resume on the first input.
   *
   * Safe to call from every scene: it only installs the handler once.
   */
  attachUnlock(scene: Phaser.Scene) {
    if (this.unlocked) return;

    const unlock = () => {
      const context = (scene.sound as Phaser.Sound.WebAudioSoundManager).context;
      if (context && context.state === "suspended") {
        void context.resume();
      }
      this.unlocked = true;
    };

    scene.input.once("pointerdown", unlock);
    scene.input.keyboard?.once("keydown", unlock);
  }

  /** Plays a sound, unless muted, missing, or still cooling down. */
  play(scene: Phaser.Scene, id: SoundId, nowMs?: number) {
    if (this.muted || this.missing.has(id)) return;
    if (!scene.cache.audio.exists(id)) {
      // Never loaded — record it so this is checked once rather than per shot.
      this.missing.add(id);
      return;
    }

    const definition = SOUNDS[id];
    const now = nowMs ?? scene.time.now;

    if (definition.cooldownMs > 0) {
      const last = this.lastPlayed.get(id);
      if (last !== undefined && now - last < definition.cooldownMs) return;
    }
    this.lastPlayed.set(id, now);

    try {
      scene.sound.play(id, { volume: definition.volume });
    } catch {
      // A decode failure mid-session must not take a frame down with it.
      this.missing.add(id);
    }
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    this.lastPlayed.clear();
  }

  isMuted(): boolean {
    return this.muted;
  }

  toggleMuted(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  /** Sounds the manifest names but the loader could not find. For diagnostics. */
  getMissing(): SoundId[] {
    return [...this.missing];
  }
}

export const audio = new AudioManager();

// deathSoundFor and fireSoundFor live in data/audio.ts: they are mappings
// rather than behaviour, and keeping them out of this module lets them be
// tested without loading Phaser.
export { deathSoundFor, fireSoundFor } from "../data/audio";
