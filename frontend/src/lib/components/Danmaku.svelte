<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { gsap } from "gsap";

  type DanmakuItem = { id: string; nickname: string; greeting: string; track: number };
  // Mount-time only: items appended after onMount will not auto-animate.
  // The caller must invoke animateItem() for reactive items (Task 7 will
  // wire the public event page to call it for new danmaku arrivals).
  export let items: DanmakuItem[] = [];

  const tweens: gsap.core.Tween[] = [];

  export function animateItem(item: DanmakuItem) {
    const el = document.querySelector(`[data-danmaku-id="${item.id}"]`);
    if (!el) return;
    gsap.killTweensOf(el);
    const tween = gsap.fromTo(
      el,
      { xPercent: 100 },
      {
        xPercent: -100,
        duration: 4.5,
        ease: "none",
        onComplete: () => {
          const idx = tweens.indexOf(tween);
          if (idx >= 0) tweens.splice(idx, 1);
        },
      },
    );
    tweens.push(tween as gsap.core.Tween);
  }

  onMount(() => {
    for (const item of items) animateItem(item);
  });

  onDestroy(() => {
    for (const t of tweens) t.kill();
    for (const item of items) {
      const el = document.querySelector(`[data-danmaku-id="${item.id}"]`);
      if (el) gsap.killTweensOf(el);
    }
  });
</script>

{#each items as item (item.id)}
  <div
    class="danmaku-item flex items-center gap-3 px-5 py-2.5 rounded-full shadow-lg border text-white font-medium bg-[#3d2b1f]/80 border-[#d4a373]/40 backdrop-blur-md"
    style="top: {item.track * 68 + 12}px; will-change: transform;"
    data-danmaku-id={item.id}
  >
    <span class="text-sm text-[#d4a373]">👤 {item.nickname}</span>
    <span class="text-base tracking-wide">{item.greeting}</span>
  </div>
{/each}
