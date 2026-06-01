export type WallAccent = {
  id: string;
  type: "butterfly" | "plane";
  baseLeft: number;
  baseTop: number;
  scale: number;
  phase: number;
  speed: number;
  sway: number;
  turnSmoothness: number;
  wanderAmplitude: number;
  bankAngleLimit: number;
  bornAt: number;
  lifeMs: number;
  avoidZones: Array<{ x: number; y: number; radius: number }>;
};

function hashSeed(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRandom(seed: number): () => number {
  let state = seed || 1;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createWallAccent(seedInput: string, bornAt: number, index: number): WallAccent {
  const rand = seededRandom(hashSeed(`${seedInput}:${index}`));
  const lifeMs = 10000 + rand() * 8000;
  const type = rand() < 0.7 ? "butterfly" : "plane";

  return {
    id: `accent-${hashSeed(`${seedInput}:${index}:id`).toString(36)}`,
    type,
    baseLeft: -8 + rand() * 12,
    baseTop: 16 + rand() * 62,
    scale: type === "plane" ? 0.95 + rand() * 0.45 : 0.72 + rand() * 0.55,
    phase: rand() * 10,
    speed: 0.6 + rand() * 0.85,
    sway: 4 + rand() * 7,
    turnSmoothness: 0.8 + rand() * 1.8,
    wanderAmplitude: 1.2 + rand() * 2.6,
    bankAngleLimit: type === "plane" ? 26 : 34,
    bornAt,
    lifeMs,
    avoidZones: [
      { x: 50, y: 8, radius: 18 },
      { x: 50, y: 88, radius: 14 },
    ],
  };
}
