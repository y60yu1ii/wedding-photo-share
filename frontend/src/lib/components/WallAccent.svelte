<script lang="ts">
  export let accent: {
    id: string;
    type: "butterfly";
    left: number;
    top: number;
    scale: number;
    delay: number;
    duration: number;
    rotation: number;
  };
</script>

<div
  aria-hidden="true"
  data-testid="wall-accent"
  class="wall-accent pointer-events-none absolute"
  style={`left:${accent.left}%;top:${accent.top}%;--scale:${accent.scale};--delay:${accent.delay}s;--duration:${accent.duration}s;--rotation:${accent.rotation}deg;`}
>
  {#if accent.type === "butterfly"}
    <span class="wall-butterfly">🦋</span>
  {/if}
</div>
