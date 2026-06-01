import { describe, expect, it, vi, afterEach } from "vitest";
import {
  normalizeTransitionPreset,
  resolveTransitionConfig,
} from "$lib/utils/slideshowTransition";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("slideshowTransition (post-GSAP migration)", () => {
  it("normalizes unknown transition preset to fade", () => {
    expect(normalizeTransitionPreset("unknown")).toBe("fade");
    expect(normalizeTransitionPreset(undefined)).toBe("fade");
  });

  it("normalizes transition config boundaries", () => {
    expect(
      resolveTransitionConfig({
        transition: "fade",
        intervalSeconds: 8,
        transitionSeconds: 0.1,
        transitionConfig: { durationMs: 30, staggerMs: -5, easing: "linear" },
      }),
    ).toEqual({
      durationMs: 120,
      easing: "linear",
      staggerMs: 0,
    });

    expect(
      resolveTransitionConfig({
        transition: "fade",
        intervalSeconds: 8,
        transitionSeconds: 20,
        transitionConfig: { durationMs: 999999 },
      }),
    ).toEqual({
      durationMs: 5000,
      easing: "ease",
      staggerMs: 0,
    });
  });
});
