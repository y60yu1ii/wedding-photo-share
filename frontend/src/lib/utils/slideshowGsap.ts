import { gsap } from "gsap";
import type { TemplateTransition, TransitionConfig } from "$lib/api/types";
import { resolveTransitionConfig } from "$lib/utils/slideshowTransition";

export type TransitionRecipe = (
  target: HTMLElement | HTMLElement[],
  config: Required<TransitionConfig>,
) => gsap.core.Tween | gsap.core.Timeline;

const RECIPES = new Map<TemplateTransition, TransitionRecipe>();

export function registerRecipe(transition: TemplateTransition, recipe: TransitionRecipe): void {
  RECIPES.set(transition, recipe);
}

export function getTransitionRecipe(transition: TemplateTransition): TransitionRecipe | null {
  return RECIPES.get(transition) ?? null;
}

export function runTransitionRecipe(
  transition: TemplateTransition,
  target: HTMLElement | HTMLElement[],
  config: Required<TransitionConfig>,
): gsap.core.Tween | gsap.core.Timeline | null {
  const recipe = RECIPES.get(transition);
  if (!recipe) return null;
  gsap.killTweensOf(target);
  return recipe(target, config);
}

export function runConfiguredRecipe(
  transition: TemplateTransition,
  target: HTMLElement | HTMLElement[],
  playback: Parameters<typeof resolveTransitionConfig>[0],
): gsap.core.Tween | gsap.core.Timeline | null {
  return runTransitionRecipe(transition, target, resolveTransitionConfig(playback));
}

/** @internal — exposed for unit tests only. */
export const __RECIPES = RECIPES;

function durationSeconds(config: Required<TransitionConfig>): number {
  return config.durationMs / 1000;
}

function toGsapEase(easing: Required<TransitionConfig>["easing"]): string {
  switch (easing) {
    case "linear": return "none";
    case "ease": return "power1.out";
    case "ease-in": return "power1.in";
    case "ease-out": return "power1.out";
    case "ease-in-out": return "power2.inOut";
    default: return "power1.out";
  }
}

export function applyRecipe(
  target: HTMLElement | HTMLElement[],
  config: Required<TransitionConfig>,
  fromVars: gsap.TweenVars,
  toVars: gsap.TweenVars,
): gsap.core.Tween {
  return gsap.fromTo(target, fromVars, {
    duration: durationSeconds(config),
    ease: toGsapEase(config.easing),
    ...toVars,
  }) as gsap.core.Tween;
}

registerRecipe("fade", (target, config) =>
  applyRecipe(target, config, { opacity: 0 }, { opacity: 1 }),
);

registerRecipe("fade-scale", (target, config) =>
  applyRecipe(target, config, { opacity: 0, scale: 0.95 }, { opacity: 1, scale: 1 }),
);

registerRecipe("slide", (target, config) =>
  applyRecipe(target, config, { xPercent: 100 }, { xPercent: 0 }),
);

registerRecipe("fade-soft", (target, config) =>
  applyRecipe(target, config, { opacity: 0, y: 24 }, { opacity: 1, y: 0 }),
);

registerRecipe("slide-parallax", (target, config) => {
  const layers = Array.isArray(target) ? target : [target];
  const [back, front] = layers;
  if (!back || !front) {
    return applyRecipe(target, config, { opacity: 0 }, { opacity: 1 });
  }
  const tl = gsap.timeline() as gsap.core.Timeline;
  tl.fromTo(
    back,
    { xPercent: 30 },
    { xPercent: 0, duration: durationSeconds(config), ease: toGsapEase(config.easing) },
  );
  tl.fromTo(
    front,
    { xPercent: 100 },
    { xPercent: 0, duration: durationSeconds(config), ease: toGsapEase(config.easing) },
  );
  return tl;
});

registerRecipe("stack-flip", (target, config) => {
  if (Array.isArray(target)) {
    return applyRecipe(target[0], config, { rotateY: 90, opacity: 0 }, { rotateY: 0, opacity: 1, ease: "power3.out" });
  }
  gsap.set(target, { transformPerspective: 1000 });
  return applyRecipe(target, config, { rotateY: 90, opacity: 0 }, { rotateY: 0, opacity: 1, ease: "power3.out" });
});

// TODO(slideshow-gsap): read playback.intervalSeconds once the recipe contract exposes it.
registerRecipe("kenburns", (target, _config) => {
  if (Array.isArray(target)) {
    return gsap.fromTo(
      target[0],
      { scale: 1, x: 0, y: 0 },
      { scale: 1.12, x: -30, y: -15, duration: 8, ease: "none" },
    ) as gsap.core.Tween;
  }
  return gsap.fromTo(
    target,
    { scale: 1, x: 0, y: 0 },
    { scale: 1.12, x: -30, y: -15, duration: 8, ease: "none" },
  ) as gsap.core.Tween;
});

registerRecipe("ribbon-flow", (target, config) =>
  applyRecipe(target, config, { xPercent: 30 }, { xPercent: -30, ease: "elastic.out(1, 0.5)" }),
);

type MatchMediaHandle = {
  add: (query: string, fn: (self: gsap.MatchMedia) => void) => MatchMediaHandle;
  revert: () => void;
};

export function bindReducedMotion(
  target: HTMLElement | HTMLElement[],
): MatchMediaHandle {
  // The outer gsap.matchMedia call is already scoped to the reduced-motion
  // query, so the callback runs only when the user prefers reduced motion.
  // An inner mm.add with the same query would be redundant.
  // Cast: gsap's published type signature is `matchMedia(scope?)`, but the
  // runtime supports the `(query, callback)` convenience overload.
  return (gsap.matchMedia as any)(
    "(prefers-reduced-motion: reduce)",
    () => {
      gsap.fromTo(
        target as gsap.TweenTarget,
        { opacity: 0 },
        { opacity: 1, duration: 0.2, ease: "none" },
      );
    },
  ) as MatchMediaHandle;
}
