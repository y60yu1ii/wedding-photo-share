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
