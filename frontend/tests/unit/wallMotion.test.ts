import { describe, expect, it } from "vitest";
import { createWallAccent } from "$lib/utils/wallMotion";

describe("wall motion seed handling", () => {
  it("produces deterministic accent fields from identical seed and index", () => {
    const a = createWallAccent("EVENT-1", 1234, 2);
    const b = createWallAccent("EVENT-1", 1234, 2);
    expect(a).toEqual(b);
  });

  it("changes generated motion values when index changes", () => {
    const first = createWallAccent("EVENT-1", 1234, 0);
    const second = createWallAccent("EVENT-1", 1234, 1);
    expect(first.id).not.toBe(second.id);
    expect(first.phase).not.toBe(second.phase);
  });

  it("keeps generated values inside guardrail ranges", () => {
    const accent = createWallAccent("EVENT-X", 5000, 9);
    expect(accent.lifeMs).toBeGreaterThanOrEqual(10000);
    expect(accent.lifeMs).toBeLessThanOrEqual(18000);
    expect(accent.baseLeft).toBeGreaterThanOrEqual(-8);
    expect(accent.baseLeft).toBeLessThanOrEqual(4);
    expect(accent.baseTop).toBeGreaterThanOrEqual(16);
    expect(accent.baseTop).toBeLessThanOrEqual(78);
    expect(accent.avoidZones).toHaveLength(2);
  });
});
