# Tasks: expand-slideshow-animation-and-signin-motion

## Phase 1 — Foundation

- [x] Audit existing slideshow transition implementation and isolate common lifecycle hooks.
- [x] Define `transitionPreset` and `transitionConfig` shared types.
- [x] Add reduced-motion fallback selection utility.

## Phase 2 — Slideshow Presets

- [x] Implement at least 5 presets: `fade-soft`, `slide-parallax`, `stack-flip`, `kenburns`, `ribbon-flow`.
- [x] Add admin-facing preset selector and config controls (duration/easing/stagger where applicable).
- [x] Ensure preset switching is safe during active playback (no stuck state, no flash).

## Phase 3 — Frame Editor Upgrade

- [x] Refactor frame editor into token-based model (`borderWidth`, `borderRadius`, `padding`, `shadow`, `color`).
- [x] Add advanced options (`gradient`, `doubleBorder`, `texture`, `glow`) behind progressive controls.
- [x] Implement preset save/apply flow with global and per-photo scope.
- [x] Persist frame settings and restore on page reload.

## Phase 4 — Sign-in Wall Dynamic Motion

- [x] Introduce curve-based route generator with noise perturbation.
- [x] Add per-entity behavior parameters and random seed/phase offset.
- [x] Implement soft avoidance around key zones and pointer proximity reaction.
- [x] Add guardrails for entity count and frame-time stability.

## Phase 5 — Verification

- [x] Add unit tests for transition config normalization and reduced-motion fallback.
- [x] Add tests for frame setting precedence (global vs per-photo override) and preset persistence.
- [x] Add deterministic tests for motion seed handling.
- [x] Run frontend build, lint, and relevant test suites.
- [x] Perform manual visual QA checklist and capture before/after notes.
