# Handoff — Slideshow GSAP Migration

**Status at handoff:** 2026-06-01, mid-execution. Tasks 1-3 done with reviews. Tasks 4-10 + final review pending.

## Last commit
`f3eaee65` — feat(frontend): implement fade, fade-scale, slide, fade-soft gsap recipes

## What's done
- Task 1: `gsap@^3.13.0` installed
- Task 2: Recipe registry skeleton (`slideshowGsap.ts`) + `__RECIPES` typed test handle + 2 skeleton tests
- Task 3: 4 simple recipes (fade, fade-scale, slide, fade-soft) registered at module load; `durationSeconds` / `toGsapEase` / `applyRecipe` helpers; 4 simple-recipe tests

## Test baseline
- `slideshowGsap.test.ts`: 6/6 passing
- Full unit suite: 36/36 passing
- `svelte-check`: clean

## Plan bugs already fixed (do not re-introduce)

**Task 2 (5 bugs):**
1. `__test` function-property mutation replaced with typed `export const __RECIPES = RECIPES`
2. Test 1 "exposes a recipe for every TemplateTransition" moved to Task 3/4 (registry empty by design at Task 2)
3. `runTransitionRecipe as any` cast removed
4. `afterEach(() => __RECIPES.delete("fade"))` replaced with `beforeEach` snapshot + `afterEach` restore pattern (test file lines ~23-36)
5. Cosmetic: removed `// override registry to use the mock` comment

**Task 3 (5 bugs):**
1. Added `runConfiguredRecipe` to test imports
2. Deleted `importTarget()` no-op function
3. afterEach snapshot-restore (already done in Task 2) — keep using this pattern for the "fade" recipe across tests
4. Removed unused `import type { TemplatePlayback }` line
5. Test assertion completeness: only fade-soft checks all 4 (from/to/ease/duration). Other 3 only check from/to. Defer acceptable.

## Next: Task 4
Plan lines 356-? (read plan file for full text). Composed recipes: slide-parallax, stack-flip, kenburns, ribbon-flow. Will use `gsap.timeline` for slide-parallax, `gsap.set` for stack-flip perspective, full-interval linear for kenburns, etc.

## Architecture reference
- Recipes registered at module load via `registerRecipe(...)` calls at the bottom of `slideshowGsap.ts`
- Recipe contract: `(target, config: Required<TransitionConfig>) => Tween | Timeline` — pure function
- `runTransitionRecipe` calls `gsap.killTweensOf(target)` before invoking recipe
- `runConfiguredRecipe` wraps `runTransitionRecipe` + `resolveTransitionConfig(playback)` for callers with `TemplatePlayback`

## Continuation prompt for new session

```
Continue the slideshow GSAP migration plan. Plan: /Users/yaoyu/Desktop/wedding-photo-share/docs/superpowers/plans/2026-06-01-slideshow-gsap-migration.md. Handoff: /Users/yaoyu/Desktop/wedding-photo-share/docs/superpowers/plans/2026-06-01-slideshow-gsap-migration.HANDOFF.md. Tasks 1-3 done (commits cf112995, 258148a9, 52369474, 2009aca1, f3eaee65). Continue with Task 4 (composed recipes) using superpowers:subagent-driven-development (fresh implementer + spec review + code quality review per task). Test baseline: 6/6 in slideshowGsap.test.ts, 36/36 full suite, svelte-check clean.
```
