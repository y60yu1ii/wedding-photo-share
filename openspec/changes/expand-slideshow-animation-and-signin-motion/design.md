# Design: Slideshow Presets, Frame Tokens, and Dynamic Motion Paths

## Goal

Increase visual variety while keeping implementation maintainable, configurable, and accessible.

## Design Decisions

### 1) Slideshow transition architecture

- Define transition behavior as:
  - `transitionPreset`: preset identity (e.g. `fade-soft`, `slide-parallax`, `stack-flip`, `kenburns`, `ribbon-flow`)
  - `transitionConfig`: normalized runtime knobs (`durationMs`, `easing`, `staggerMs`, optional effect-specific tuning)
- Route all transitions through a common timeline/controller interface to avoid per-effect ad hoc lifecycle code.
- Add `prefers-reduced-motion` fallback to simplified fade/instant transitions.

### 2) Frame editor model

- Introduce tokenized frame configuration:
  - Core tokens: `borderWidth`, `borderRadius`, `padding`, `shadow`, `color`
  - Extended tokens: `gradient`, `doubleBorder`, `texture`, `glow`
- Support scopes:
  - Global default (`all photos`)
  - Per-photo override
- Add custom preset persistence:
  - Save preset from current token set
  - Apply preset globally or to selected photo

### 3) Sign-in wall butterfly/airplane motion

- Replace simple deterministic routes with curve-based motion:
  - Spline path (`Bezier` or `Catmull-Rom`)
  - Noise perturbation for micro-variation
- Add per-entity behavior parameters:
  - `baseSpeed`, `turnSmoothness`, `wanderAmplitude`, `pauseChance`, `bankAngleLimit`
- Prevent synchronized movement by random seed and phase offset.
- Add lightweight avoidance/interaction:
  - Soft detour near key UI regions
  - Pointer proximity reaction (brief dodge/lift behavior)

## Performance and Accessibility

- Keep animation work on `transform`/`opacity` paths when possible.
- Cap active animated entities for low-end devices.
- Respect reduced-motion preference and provide low-motion fallback for all presets.

## Verification Strategy

1. Unit test transition preset normalization and fallback selection.
2. Unit/integration test frame token persistence and scope precedence (global vs override).
3. UI verification for preset switching and live preview update.
4. Deterministic test hooks for motion engine seed handling.
5. Manual visual QA checklist for route naturalness and non-repetition.
