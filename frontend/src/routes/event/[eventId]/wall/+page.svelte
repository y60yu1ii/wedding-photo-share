<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/stores";
  import { wall } from "$lib/api/client";
  import type { WallCard, WallPolicy } from "$lib/api/types";
  import { buildWallCards, shuffleWallCards } from "$lib/utils/wall";
  import { createWallAccent } from "$lib/utils/wallMotion";
  import SignInWallCard from "$lib/components/SignInWallCard.svelte";
  import WallAccent from "$lib/components/WallAccent.svelte";

  const eventId = $derived($page.params.eventId ?? "");
  const wsUrl = import.meta.env.VITE_WS_URL;

  let loading = $state(true);
  let wallPolicy = $state<WallPolicy>("approved_only");
  let cards = $state<WallCard[]>([]);
  let freshIds = $state<Set<string>>(new Set());
  let movingIds = $state<Set<string>>(new Set());
  let accents = $state<any[]>([]);
  let pointer = $state({ x: 50, y: 50, active: false });
  let lastSyncAt = $state<string>("");
  let socket: WebSocket | null = null;
  let refreshTimer: ReturnType<typeof setInterval> | null = null;
  let shuffleTimer: ReturnType<typeof setInterval> | null = null;
  let accentTimer: ReturnType<typeof setInterval> | null = null;
  let clearAccentTimers: Array<ReturnType<typeof setTimeout>> = [];
  let destroyed = false;
  let accentSeedIndex = 0;

  function asFreshIds(nextCards: WallCard[], previousCards: WallCard[]) {
    const previous = new Set(previousCards.map((card) => card.photoId));
    return new Set(nextCards.filter((card) => !previous.has(card.photoId)).map((card) => card.photoId));
  }

  async function refreshWall(animateNew = false, since?: string) {
    try {
      const previousCards = cards;
      const result = await wall.photos(eventId, since);
      const nextCards = result.cards ?? buildWallCards(result.photos, result.wallPolicy);
      wallPolicy = result.wallPolicy;
      if (since && previousCards.length > 0) {
        const merged = [...previousCards];
        for (const card of nextCards) {
          if (!merged.some((item) => item.photoId === card.photoId)) {
            merged.push(card);
          }
        }
        cards = shuffleWallCards(merged.sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
        freshIds = new Set(nextCards.map((card) => card.photoId));
      } else {
        cards = nextCards;
        freshIds = animateNew ? asFreshIds(nextCards, previousCards) : new Set();
      }
      lastSyncAt = result.generatedAt ?? new Date().toISOString();
      loading = false;

      const timer = setTimeout(() => {
        freshIds = new Set();
      }, 900);
      clearAccentTimers = [...clearAccentTimers, timer];
    } catch (error) {
      console.error("Failed to refresh wall:", error);
      loading = false;
    }
  }

  function spawnAccent() {
    const accent = createWallAccent(eventId, performance.now(), accentSeedIndex);
    accentSeedIndex += 1;
    accents = [...accents, accent].slice(-6);
    const timeout = setTimeout(() => {
      accents = accents.filter((item) => item.id !== accent.id);
    }, accent.lifeMs + 300);
    clearAccentTimers = [...clearAccentTimers, timeout];
  }

  function onWallPointerMove(event: PointerEvent) {
    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    pointer = { x, y, active: true };
  }

  function onWallPointerLeave() {
    pointer = { ...pointer, active: false };
  }

  function shuffleRecentCards() {
    if (cards.length < 4) return;
    const recentCount = Math.min(4, cards.length);
    movingIds = new Set(cards.slice(-recentCount).map((card) => card.photoId));
    cards = shuffleWallCards(cards, recentCount);
    const timeout = setTimeout(() => {
      movingIds = new Set();
    }, 1000);
    clearAccentTimers = [...clearAccentTimers, timeout];
  }

  function connectWebSocket() {
    if (!wsUrl) return;

    socket = new WebSocket(`${wsUrl}?eventId=${encodeURIComponent(eventId)}`);
    socket.onopen = () => {
      socket?.send(JSON.stringify({ action: "register", eventId }));
    };
    socket.onmessage = (messageEvent) => {
      try {
        const data = JSON.parse(messageEvent.data);
      if (["new_photo", "delete_photo", "representative_changed"].includes(data.type)) {
          if (data.type === "new_photo" && lastSyncAt) {
            void refreshWall(true, lastSyncAt);
          } else {
            void refreshWall(true);
          }
        }
      } catch {
        // ignore malformed ws payloads
      }
    };
    socket.onclose = () => {
      if (destroyed) return;
      setTimeout(connectWebSocket, 3000);
    };
  }

  onMount(() => {
    void refreshWall(true);
    connectWebSocket();
    refreshTimer = setInterval(() => {
      void refreshWall(false);
    }, 60000);
    shuffleTimer = setInterval(() => {
      shuffleRecentCards();
    }, 45000);
    accentTimer = setInterval(() => {
      spawnAccent();
    }, 20000);

    return () => {
      destroyed = true;
      socket?.close();
      if (refreshTimer) clearInterval(refreshTimer);
      if (shuffleTimer) clearInterval(shuffleTimer);
      if (accentTimer) clearInterval(accentTimer);
      for (const timer of clearAccentTimers) clearTimeout(timer);
    };
  });

  const displayCount = $derived(cards.length);
</script>

<svelte:head>
  <title>簽到牆</title>
</svelte:head>

<div class="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,#fffaf3_0%,#f9efe4_38%,#f2e4d5_100%)] px-4 py-5 text-[#3d2b1f]">
  <div class="pointer-events-none absolute inset-0 opacity-80">
    <div class="absolute left-[-8rem] top-[-10rem] h-[22rem] w-[22rem] rounded-full bg-[#f1d7b7]/40 blur-3xl"></div>
    <div class="absolute bottom-[-8rem] right-[-5rem] h-[18rem] w-[18rem] rounded-full bg-[#d4a373]/25 blur-3xl"></div>
  </div>

  <div class="relative mx-auto flex min-h-screen max-w-[1600px] flex-col">
    <header class="mb-4 flex items-end justify-between gap-4">
      <div>
        <p class="text-[11px] font-semibold uppercase tracking-[0.45em] text-[#8b7355]">Guest Sign-In Wall</p>
        <h1 class="mt-2 text-3xl font-black tracking-tight text-[#3d2b1f] md:text-5xl">賓客簽到牆</h1>
        <p class="mt-2 max-w-2xl text-sm leading-relaxed text-[#8b7355]">
          {wallPolicy === "approved_only" ? "目前只顯示已審核照片。" : "目前顯示所有賓客上傳，牆面會即時長滿。"}
        </p>
      </div>
      <div class="rounded-full border border-white/70 bg-white/70 px-4 py-2 text-right shadow-sm backdrop-blur">
        <p class="text-[11px] font-semibold uppercase tracking-[0.3em] text-[#8b7355]">Visible</p>
        <p class="text-xl font-black text-[#3d2b1f]">{displayCount}</p>
      </div>
    </header>

    {#if loading}
      <div class="flex flex-1 items-center justify-center rounded-[32px] border border-white/70 bg-white/55 text-[#8b7355] shadow-[0_20px_80px_rgba(61,43,31,0.08)] backdrop-blur">
        簽到牆載入中...
      </div>
    {:else if cards.length === 0}
      <div class="flex flex-1 items-center justify-center rounded-[32px] border border-white/70 bg-white/55 text-center text-[#8b7355] shadow-[0_20px_80px_rgba(61,43,31,0.08)] backdrop-blur">
        <div>
          <p class="text-lg font-semibold text-[#3d2b1f]">目前還沒有簽到照片</p>
          <p class="mt-2 text-sm">賓客上傳後，照片會即時插入這面牆。</p>
        </div>
      </div>
    {:else}
      <section
        class="relative flex-1 rounded-[32px] border border-white/70 bg-white/45 p-4 shadow-[0_20px_80px_rgba(61,43,31,0.08)] backdrop-blur"
        role="presentation"
        onpointermove={onWallPointerMove}
        onpointerleave={onWallPointerLeave}
      >
        <div data-testid="sign-in-wall-grid" class="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5 2xl:grid-cols-6">
          {#each cards as card, index (card.photoId)}
            <SignInWallCard
              {card}
              drift={((index % 7) - 3) * 0.6}
              entering={freshIds.has(card.photoId) || movingIds.has(card.photoId)}
            />
          {/each}
        </div>

        {#each accents as accent (accent.id)}
          <WallAccent {accent} {pointer} />
        {/each}
      </section>
    {/if}
  </div>
</div>
