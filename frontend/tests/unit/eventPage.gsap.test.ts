import { describe, expect, it, vi } from "vitest";

vi.mock("gsap", () => {
  const ctx = { revert: vi.fn() };
  return {
    gsap: {
      context: vi.fn(() => ctx),
      fromTo: vi.fn().mockReturnValue({ kill: vi.fn() }),
      killTweensOf: vi.fn(),
      set: vi.fn(),
      matchMedia: vi.fn().mockReturnValue({ add: vi.fn(), revert: vi.fn() }),
    },
  };
});

import { gsap } from "gsap";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("event page GSAP wiring", () => {
  const src = readFileSync(
    resolve("src/routes/event/[eventId]/+page.svelte"),
    "utf8",
  );

  it("imports gsap", () => {
    expect(src).toMatch(/import\s+\{\s*gsap\s*\}\s+from\s+["']gsap["']/);
  });

  it("imports slideshowGsap helpers", () => {
    expect(src).toMatch(/from\s+["']\$lib\/utils\/slideshowGsap["']/);
  });

  it("creates a gsap.context at mount", () => {
    expect(src).toMatch(/gsap\.context\(\)/);
  });

  it("reverts the context on unmount", () => {
    expect(src).toMatch(/context\.revert\(\)/);
  });

  it("kills tweens on photo swap", () => {
    expect(src).toMatch(/gsap\.killTweensOf/);
  });

  it("calls clearProps on preset switch", () => {
    expect(src).toMatch(/clearProps/);
  });
});
