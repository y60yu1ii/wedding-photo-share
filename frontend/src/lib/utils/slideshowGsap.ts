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
    ...toVars,
    duration: durationSeconds(config),
    ease: toGsapEase(config.easing),
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
