import type { TemplatePlayback, TemplateTransition, TransitionConfig } from "$lib/api/types";

const TRANSITION_PRESETS = new Set<TemplateTransition>([
  "fade",
  "fade-scale",
  "slide",
  "fade-soft",
  "slide-parallax",
  "stack-flip",
  "kenburns",
  "ribbon-flow",
]);

const LEGACY_FALLBACK_PRESET: TemplateTransition = "fade";
const REDUCED_MOTION_PRESET: TemplateTransition = "fade";

export function normalizeTransitionPreset(input: string | null | undefined): TemplateTransition {
  if (!input) return LEGACY_FALLBACK_PRESET;
  return TRANSITION_PRESETS.has(input as TemplateTransition)
    ? (input as TemplateTransition)
    : LEGACY_FALLBACK_PRESET;
}

export function isReducedMotionPreferred(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function resolveTransitionPreset(playback: TemplatePlayback | null | undefined): TemplateTransition {
  const normalized = normalizeTransitionPreset(playback?.transition);
  if (isReducedMotionPreferred()) {
    return REDUCED_MOTION_PRESET;
  }
  return normalized;
}

export function resolveTransitionClass(playback: TemplatePlayback | null | undefined): string {
  const preset = resolveTransitionPreset(playback);
  if (preset === "fade") return "photo-fade";
  if (preset === "fade-scale") return "photo-fade-scale";
  if (preset === "slide") return "photo-slide";
  if (preset === "fade-soft") return "photo-fade-soft";
  if (preset === "slide-parallax") return "photo-slide-parallax";
  if (preset === "stack-flip") return "photo-stack-flip";
  if (preset === "kenburns") return "photo-kenburns";
  return "photo-ribbon-flow";
}

export function resolveTransitionConfig(playback: TemplatePlayback | null | undefined): Required<TransitionConfig> {
  const config = playback?.transitionConfig ?? {};
  const seconds = Number.isFinite(playback?.transitionSeconds)
    ? Number(playback?.transitionSeconds)
    : 0.55;
  const durationMs = Number.isFinite(config.durationMs) ? Number(config.durationMs) : Math.round(seconds * 1000);
  return {
    durationMs: Math.min(5000, Math.max(120, durationMs)),
    easing: config.easing ?? "ease",
    staggerMs: Number.isFinite(config.staggerMs) ? Math.max(0, Number(config.staggerMs)) : 0,
  };
}
