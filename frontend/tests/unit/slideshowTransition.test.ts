import { describe, expect, it, vi, afterEach } from "vitest";
import {
  normalizeTransitionPreset,
  resolveTransitionConfig,
  resolveTransitionPreset,
} from "$lib/utils/slideshowTransition";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("slideshow transition helpers", () => {
  it("normalizes unknown transition preset to fade", () => {
    expect(normalizeTransitionPreset("unknown")).toBe("fade");
    expect(normalizeTransitionPreset(undefined)).toBe("fade");
  });

  it("falls back to reduced-motion preset when media query matches", () => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockReturnValue({ matches: true }),
    });
    expect(resolveTransitionPreset({ transition: "kenburns", intervalSeconds: 5, transitionSeconds: 0.8 })).toBe("fade");
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
