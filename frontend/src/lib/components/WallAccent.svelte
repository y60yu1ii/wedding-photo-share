<script lang="ts">
  import { onMount } from "svelte";

  export let accent: {
    id: string;
    type: "butterfly" | "plane";
    baseLeft: number;
    baseTop: number;
    scale: number;
    phase: number;
    speed: number;
    sway: number;
    turnSmoothness: number;
    wanderAmplitude: number;
    bankAngleLimit: number;
    bornAt: number;
    lifeMs: number;
    avoidZones: Array<{ x: number; y: number; radius: number }>;
  };
  export let pointer: { x: number; y: number; active: boolean };

  let x = accent.baseLeft;
  let y = accent.baseTop;
  let rotation = 0;
  let opacity = 0;
  let rafId = 0;

  function clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
  }

  function distance(ax: number, ay: number, bx: number, by: number) {
    return Math.hypot(ax - bx, ay - by);
  }

  function tick(now: number) {
    const t = (now - accent.bornAt) / 1000;
    const lifeProgress = clamp((now - accent.bornAt) / accent.lifeMs, 0, 1);
    const fadeIn = clamp(lifeProgress * 4, 0, 1);
    const fadeOut = clamp((1 - lifeProgress) * 4, 0, 1);
    opacity = Math.min(fadeIn, fadeOut);

    const stream = ((t * accent.speed * 8) + accent.phase * 30) % 120 - 10;
    const sway = Math.sin(t * accent.turnSmoothness + accent.phase * 5.7) * accent.sway;
    const noise = Math.sin(t * 1.27 + accent.phase * 9.1) * accent.wanderAmplitude;
    const noiseY = Math.cos(t * 1.71 + accent.phase * 7.4) * accent.wanderAmplitude * 0.7;

    let nextX = stream + accent.baseLeft;
    let nextY = accent.baseTop + sway + noise + noiseY;

    for (const zone of accent.avoidZones) {
      const d = distance(nextX, nextY, zone.x, zone.y);
      if (d < zone.radius) {
        const push = ((zone.radius - d) / zone.radius) * 6;
        const vx = nextX - zone.x || 1;
        const vy = nextY - zone.y || 1;
        const mag = Math.hypot(vx, vy);
        nextX += (vx / mag) * push;
        nextY += (vy / mag) * push;
      }
    }

    if (pointer.active) {
      const d = distance(nextX, nextY, pointer.x, pointer.y);
      if (d < 18) {
        const flee = (18 - d) * 0.8;
        const vx = nextX - pointer.x || 1;
        const vy = nextY - pointer.y || -1;
        const mag = Math.hypot(vx, vy);
        nextX += (vx / mag) * flee;
        nextY += (vy / mag) * flee;
      }
    }

    x = clamp(nextX, -5, 105);
    y = clamp(nextY, 5, 95);
    rotation = clamp((sway + noise) * 1.6, -accent.bankAngleLimit, accent.bankAngleLimit);
    rafId = requestAnimationFrame(tick);
  }

  onMount(() => {
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  });
</script>

<div
  aria-hidden="true"
  data-testid="wall-accent"
  class="wall-accent pointer-events-none absolute"
  style={`left:${x}%;top:${y}%;opacity:${opacity};--scale:${accent.scale};--rotation:${rotation}deg;`}
>
  {#if accent.type === "butterfly"}
    <span class="wall-butterfly">🦋</span>
  {:else}
    <span class="wall-plane">🛩️</span>
  {/if}
</div>
