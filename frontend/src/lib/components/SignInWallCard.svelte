<script lang="ts">
  import type { WallCard } from "$lib/api/types";

  type Props = {
    card: WallCard;
    drift?: number;
    entering?: boolean;
  };

  let { card, drift = 0, entering = false }: Props = $props();

  let createdAtLabel = $state("");
  $effect(() => {
    createdAtLabel = new Intl.DateTimeFormat("zh-TW", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(card.createdAt));
  });
</script>

<article
  data-testid="sign-in-wall-card"
  class={`wall-card relative overflow-hidden rounded-[22px] bg-white p-3 shadow-[0_20px_40px_rgba(61,43,31,0.18)] ${entering ? "wall-card-enter" : ""}`}
  style={`--drift:${drift}deg;`}
>
  <div class="wall-pin absolute left-1/2 top-[-10px] h-5 w-5 -translate-x-1/2 rounded-full bg-[#d4a373] shadow-md"></div>
  <div class="overflow-hidden rounded-[16px] bg-[#faf7f2]">
    <img
      src={card.presignedUrl}
      alt={card.nickname}
      class="wall-card-image aspect-[3/4] w-full object-cover"
    />
  </div>
  <div class="mt-3 flex items-center justify-between gap-3">
    <div class="min-w-0">
      <p class="truncate text-sm font-semibold text-[#3d2b1f]">{card.nickname}</p>
      <p class="text-[11px] text-[#8b7355]">{createdAtLabel}</p>
    </div>
    <span class={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${card.status === "approved" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
      {card.status}
    </span>
  </div>
</article>
