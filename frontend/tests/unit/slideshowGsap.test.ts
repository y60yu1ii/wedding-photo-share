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
  bindReducedMotion,
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

describe("composed recipes", () => {
  it("slide-parallax: builds a timeline with back + front layers", () => {
    (gsap.timeline as any).mockClear();
    (gsap.fromTo as any).mockClear();
    const fakeTimeline = { to: vi.fn(), fromTo: vi.fn() };
    (gsap.timeline as any).mockReturnValue(fakeTimeline);
    const back = document.createElement("div");
    const front = document.createElement("div");
    runTransitionRecipe("slide-parallax", [back, front], {
      durationMs: 600, easing: "ease-in-out", staggerMs: 0,
    });
    expect(gsap.timeline).toHaveBeenCalled();
    expect(fakeTimeline.fromTo).toHaveBeenCalledWith(
      back,
      { xPercent: 30 },
      expect.objectContaining({ xPercent: 0, duration: 0.6 }),
    );
    expect(fakeTimeline.fromTo).toHaveBeenCalledWith(
      front,
      { xPercent: 100 },
      expect.objectContaining({ xPercent: 0, duration: 0.6 }),
    );
  });

  it("stack-flip: rotateY 90->0 with perspective 1000", () => {
    (gsap.set as any).mockClear();
    (gsap.fromTo as any).mockClear();
    const target = document.createElement("div");
    runConfiguredRecipe("stack-flip", target, { transition: "stack-flip", intervalSeconds: 8, transitionSeconds: 0.5 });
    expect(gsap.set).toHaveBeenCalledWith(target, expect.objectContaining({ transformPerspective: 1000 }));
    expect(gsap.fromTo).toHaveBeenCalledWith(
      target,
      { rotateY: 90, opacity: 0 },
      expect.objectContaining({ rotateY: 0, opacity: 1, ease: "power3.out" }),
    );
  });

  it("kenburns: runs for the full interval with linear ease", () => {
    (gsap.fromTo as any).mockClear();
    const target = document.createElement("div");
    runConfiguredRecipe("kenburns", target, { transition: "kenburns", intervalSeconds: 8, transitionSeconds: 0.5 });
    expect(gsap.fromTo).toHaveBeenCalledWith(
      target,
      { scale: 1, x: 0, y: 0 },
      expect.objectContaining({ scale: 1.12, x: -30, y: -15, duration: 8, ease: "none" }),
    );
  });

  it("ribbon-flow: xPercent 30->-30 with elastic ease", () => {
    (gsap.fromTo as any).mockClear();
    const target = document.createElement("div");
    runConfiguredRecipe("ribbon-flow", target, { transition: "ribbon-flow", intervalSeconds: 8, transitionSeconds: 0.8 });
    expect(gsap.fromTo).toHaveBeenCalledWith(
      target,
      { xPercent: 30 },
      expect.objectContaining({ xPercent: -30, ease: "elastic.out(1, 0.5)" }),
    );
  });
});

describe("reduced-motion binding", () => {
  it("creates a gsap.matchMedia binding with the reduced-motion query", () => {
    (gsap.matchMedia as any).mockClear();
    const ctx = gsap.matchMedia as unknown as ReturnType<typeof vi.fn>;
    (ctx as any).mockReturnValue({ add: vi.fn(), revert: vi.fn() });
    importTarget().bindReducedMotion();
    expect(gsap.matchMedia).toHaveBeenCalledWith(
      "(prefers-reduced-motion: reduce)",
      expect.any(Function),
    );
  });

  it("reduced-motion branch calls fromTo with opacity-only vars at <=200ms", () => {
    (gsap.fromTo as any).mockClear();
    let captured: ((self: any) => void) | undefined;
    (gsap.matchMedia as any).mockImplementation((_q: string, cb: any) => {
      captured = cb;
      return { add: vi.fn(), revert: vi.fn() };
    });
    importTarget().bindReducedMotion();
    captured?.({ isTouch: false });
    expect(gsap.fromTo).toHaveBeenCalled();
    const call = (gsap.fromTo as any).mock.calls[0];
    expect(call[1]).toEqual({ opacity: 0 });
    expect(call[2]).toMatchObject({ opacity: 1 });
    expect(call[2].duration).toBeLessThanOrEqual(0.2);
  });
});

function importTarget() {
  return {
    bindReducedMotion: () => bindReducedMotion(document.createElement("div")),
  };
}
