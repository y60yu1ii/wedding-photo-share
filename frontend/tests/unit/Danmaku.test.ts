import { describe, expect, it, vi, afterEach } from "vitest";

vi.mock("gsap", () => ({
  gsap: {
    fromTo: vi.fn().mockReturnValue({ kill: vi.fn() }),
    killTweensOf: vi.fn(),
  },
}));

import { render } from "@testing-library/svelte";
import { gsap } from "gsap";
import Danmaku from "$lib/components/Danmaku.svelte";

afterEach(() => {
  (gsap.fromTo as any).mockClear();
  (gsap.killTweensOf as any).mockClear();
});

describe("Danmaku component", () => {
  it("renders one item per pending danmaku", () => {
    const items = [
      { id: "a", nickname: "n1", greeting: "g1", track: 0 },
      { id: "b", nickname: "n2", greeting: "g2", track: 1 },
    ];
    const { container } = render(Danmaku, { props: { items } });
    expect(container.querySelectorAll(".danmaku-item").length).toBe(2);
  });

  it("animates each item with gsap.fromTo xPercent 100→-100 over 4.5s", () => {
    const items = [{ id: "a", nickname: "n", greeting: "g", track: 0 }];
    render(Danmaku, { props: { items } });
    expect(gsap.fromTo).toHaveBeenCalledWith(
      expect.any(HTMLElement),
      { xPercent: 100 },
      expect.objectContaining({ xPercent: -100, duration: 4.5, ease: "none" }),
    );
  });

  it("kills the tween on unmount", () => {
    const items = [{ id: "a", nickname: "n", greeting: "g", track: 0 }];
    const { unmount } = render(Danmaku, { props: { items } });
    unmount();
    expect(gsap.killTweensOf).toHaveBeenCalled();
  });
});
