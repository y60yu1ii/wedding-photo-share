import { describe, expect, it, vi, afterEach } from "vitest";

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
import { runTransitionRecipe, getTransitionRecipe, __RECIPES } from "$lib/utils/slideshowGsap";

describe("slideshowGsap recipe registry", () => {
  afterEach(() => {
    __RECIPES.delete("fade");
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
