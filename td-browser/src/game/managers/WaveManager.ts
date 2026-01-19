export interface WaveSpawn {
  type: "circle" | "square" | "triangle";
  count: number;
}

export interface WaveConfig {
  spawns: WaveSpawn[];
  total: number;
}

export class WaveManager {
  private waveConfigs: Record<number, WaveSpawn[]> = {
    1: [{ type: "circle", count: 5 }],
    2: [
      { type: "circle", count: 3 },
      { type: "triangle", count: 3 }
    ],
    3: [
      { type: "circle", count: 3 },
      { type: "triangle", count: 3 }
    ],
    4: [{ type: "square", count: 2 }],
    5: [
      { type: "circle", count: 3 },
      { type: "triangle", count: 3 },
      { type: "square", count: 1 }
    ]
  };

  getWaveConfig(waveNumber: number): WaveConfig {
    const spawns: WaveSpawn[] = [];
    let total = 0;

    const effectiveWave = waveNumber > 5 ? 5 : waveNumber;
    for (let w = 1; w <= effectiveWave; w++) {
      if (this.waveConfigs[w]) {
        for (const spawn of this.waveConfigs[w]) {
          const existing = spawns.find(s => s.type === spawn.type);
          if (existing) {
            existing.count += spawn.count;
          } else {
            spawns.push({ ...spawn });
          }
          total += spawn.count;
        }
      }
    }

    // For waves after 5, add extra enemies per wave
    if (waveNumber > 5) {
      const wavesOver5 = waveNumber - 5;
      const extraPerWave: WaveSpawn[] = [
        { type: "circle", count: 5 },
        { type: "triangle", count: 10 },
        { type: "square", count: 3 }
      ];

      for (let i = 0; i < wavesOver5; i++) {
        for (const extra of extraPerWave) {
          const existing = spawns.find(s => s.type === extra.type);
          if (existing) {
            existing.count += extra.count;
          } else {
            spawns.push({ ...extra });
          }
          total += extra.count;
        }
      }
    }

    return { spawns, total };
  }

  calculateModifiers(waveNumber: number): { healthModifier: number; speedModifier: number } {
    let healthModifier = 1;
    let speedModifier = 1;
    
    if (waveNumber > 5) {
      const wavesOver5 = waveNumber - 5;
      healthModifier = 1 + (wavesOver5 * 0.10);
      speedModifier = 1 + (wavesOver5 * 0.05);
    }
    
    return { healthModifier, speedModifier };
  }
}
