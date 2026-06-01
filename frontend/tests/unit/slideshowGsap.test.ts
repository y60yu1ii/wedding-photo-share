import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

vi.mock("gsap", () => ({
  gsap: {
    fromTo: vi.fn(),
    timeline: vi.fn(),
    set: vi.fn(),
    killTweensOf: vi.fn(),
    matchMedia: vi.fn(),
    context: vi.fn(),
  },
}));

import { gsap } from "gsap";
import {
  runTransitionRecipe,
  getTransitionRecipe,
  runConfiguredRecipe,
  __RECIPES,
  type TransitionRecipe,
} from "$lib/utils/slideshowGsap";

let originalFadeRecipe: TransitionRecipe | undefined;

describe("slideshowGsap recipe registry", () => {
  beforeEach(() => {
    originalFadeRecipe = __RECIPES.get("fade");
  });

  afterEach(() => {
    if (originalFadeRecipe) {
      __RECIPES.set("fade", originalFadeRecipe);
    } else {
      __RECIPES.delete("fade");
    }
  });


  it("returns null for unknown transition", () => {
    expect(getTransitionRecipe("nope" as any)).toBeNull();
  });

  it("runTransitionRecipe calls killTweensOf and invokes the recipe", () => {
    (gsap.killTweensOf as any).mockClear();
    const target = document.createElement("div");
    const recipe = vi.fn().mockReturnValue({ kill: vi.fn() });
    __RECIPES.set("fade", recipe);
    const result = runTransitionRecipe("fade", target, {
      durationMs: 400, easing: "ease", staggerMs: 0,
    });
    expect(gsap.killTweensOf).toHaveBeenCalledWith(target);
    expect(recipe).toHaveBeenCalledWith(target, expect.objectContaining({ durationMs: 400 }));
    expect(result).toBeDefined();
  });
});

describe("simple recipes", () => {
  it("fade: gsap.fromTo opacity 0->1", () => {
    (gsap.fromTo as any).mockClear();
    const target = document.createElement("div");
    runConfiguredRecipe("fade", target, { transition: "fade", intervalSeconds: 8, transitionSeconds: 0.5 });
    expect(gsap.fromTo).toHaveBeenCalledWith(
      target,
      { opacity: 0 },
      expect.objectContaining({ opacity: 1, ease: "power1.out" }),
    );
  });

  it("fade-scale: scales 0.95->1 alongside opacity", () => {
    (gsap.fromTo as any).mockClear();
    const target = document.createElement("div");
    runConfiguredRecipe("fade-scale", target, { transition: "fade-scale", intervalSeconds: 8, transitionSeconds: 0.5 });
    expect(gsap.fromTo).toHaveBeenCalledWith(
      target,
      { opacity: 0, scale: 0.95 },
      expect.objectContaining({ opacity: 1, scale: 1 }),
    );
  });

  it("slide: xPercent 100->0", () => {
    (gsap.fromTo as any).mockClear();
    const target = document.createElement("div");
    runConfiguredRecipe("slide", target, { transition: "slide", intervalSeconds: 8, transitionSeconds: 0.5 });
    expect(gsap.fromTo).toHaveBeenCalledWith(
      target,
      { xPercent: 100 },
      expect.objectContaining({ xPercent: 0 }),
    );
  });

  it("fade-soft: opacity 0->1, y 24->0 with power2.out", () => {
    (gsap.fromTo as any).mockClear();
    const target = document.createElement("div");
    runConfiguredRecipe("fade-soft", target, { transition: "fade-soft", intervalSeconds: 8, transitionSeconds: 0.6, transitionConfig: { durationMs: 600, easing: "ease-in-out" } });
    expect(gsap.fromTo).toHaveBeenCalledWith(
      target,
      { opacity: 0, y: 24 },
      expect.objectContaining({ opacity: 1, y: 0, ease: "power2.inOut", duration: 0.6 }),
    );
  });
});
