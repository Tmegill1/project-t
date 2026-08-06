import { describe, expect, it } from "vitest";
import {
  AUDIO_EXTENSION,
  AUDIO_PATH,
  SOUNDS,
  SOUND_IDS,
  deathSoundFor,
  fireSoundFor,
} from "./audio";
import { ENEMY_KINDS, TOWER_KINDS } from "../sim/entities";

/**
 * The manifest is loaded by filename at boot, so a typo here is a sound that
 * silently never plays. These checks catch that at build time instead.
 */
describe("the sound manifest", () => {
  it("names a file for every sound", () => {
    for (const id of SOUND_IDS) {
      expect(SOUNDS[id].file.length, id).toBeGreaterThan(0);
    }
  });

  it("gives every sound an audible volume that does not clip", () => {
    for (const id of SOUND_IDS) {
      expect(SOUNDS[id].volume, id).toBeGreaterThan(0);
      expect(SOUNDS[id].volume, id).toBeLessThanOrEqual(1);
    }
  });

  it("has no duplicate files, which would make two events indistinguishable", () => {
    const files = SOUND_IDS.map((id) => SOUNDS[id].file);
    expect(new Set(files).size).toBe(files.length);
  });

  it("builds a sane path", () => {
    expect(AUDIO_PATH.startsWith("/")).toBe(true);
    expect(AUDIO_EXTENSION).not.toContain(".");
  });
});

describe("rate limiting", () => {
  // At wave 15 there are 160 enemies dying and eight towers firing several
  // times a second. Playing every one is noise, not feedback, and enough
  // overlapping sources will stutter the tab.
  it("rate-limits everything that can fire many times a second", () => {
    const frequent = [
      ...TOWER_KINDS.map((kind) => fireSoundFor(kind)),
      ...ENEMY_KINDS.map((kind) => deathSoundFor(kind)),
      "explosion" as const,
    ];
    for (const id of frequent) {
      expect(SOUNDS[id].cooldownMs, id).toBeGreaterThan(0);
    }
  });

  it("leaves one-off events unlimited, so they are never swallowed", () => {
    for (const id of ["wave-start", "wave-clear", "boss", "victory", "defeat"] as const) {
      expect(SOUNDS[id].cooldownMs, id).toBe(0);
    }
  });

  it("keeps firing quieter than the events that matter", () => {
    // Firing is the most frequent sound by a wide margin. If it were as loud
    // as a leak, the sound that means "you are losing" would be buried.
    const loudestFire = Math.max(...TOWER_KINDS.map((k) => SOUNDS[fireSoundFor(k)].volume));
    expect(loudestFire).toBeLessThan(SOUNDS.leak.volume);
    expect(loudestFire).toBeLessThan(SOUNDS.boss.volume);
  });
});

describe("every tower and enemy has its own voice", () => {
  it("gives each tower kind a distinct firing sound", () => {
    const sounds = TOWER_KINDS.map((kind) => fireSoundFor(kind));
    expect(new Set(sounds).size).toBe(TOWER_KINDS.length);
    for (const id of sounds) expect(SOUND_IDS).toContain(id);
  });

  it("gives each enemy kind a death sound the manifest actually has", () => {
    for (const kind of ENEMY_KINDS) {
      expect(SOUND_IDS).toContain(deathSoundFor(kind));
    }
  });

  it("distinguishes the heavy enemy from the light ones", () => {
    // An ogre dying should not sound like a bee.
    expect(deathSoundFor("ogre")).not.toBe(deathSoundFor("bee"));
    expect(deathSoundFor("ogre")).not.toBe(deathSoundFor("slime"));
  });
});
