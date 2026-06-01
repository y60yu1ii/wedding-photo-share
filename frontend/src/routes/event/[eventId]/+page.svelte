<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/stores";
  import { slideshow, templates } from "$lib/api/client";
  import type { EventTemplate, TemplateLayer } from "$lib/api/types";
  import { resolveTransitionClass, resolveTransitionConfig } from "$lib/utils/slideshowTransition";
  import { frameTokenToInlineStyle, resolveLayerFrameToken } from "$lib/utils/frameToken";

  const eventId = $derived($page.params.eventId ?? "");
  const wsUrl = import.meta.env.VITE_WS_URL;

  let event = $state<any>({});
  let photos = $state<any[]>([]);
  let template = $state<EventTemplate | null>(null);
  let loading = $state(true);
  let loadingMore = $state(false);
  
  // Slideshow Modes
  let isPresentationMode = $state(false);
  let activeIndex = $state(0);
  let isFullscreen = $state(false);
  let transitionVersion = $state(0);
  
  // Danmaku Queue
  let danmakus = $state<{ id: string; nickname: string; greeting: string; track: number }[]>([]);
  
  let socket: WebSocket;
  let slideshowInterval: any;
  let templateRefreshInterval: any;

  onMount(() => {
    let disposed = false;

    const onFullscreenChange = () => {
      isFullscreen = !!document.fullscreenElement;
      if (!isFullscreen) {
        isPresentationMode = false;
      }
    };

    document.addEventListener("fullscreenchange", onFullscreenChange);

    void (async () => {
      try {
        await loadSlideshowData();
        if (disposed) return;
      } finally {
        loading = false;
      }

      connectWebSocket();
      startTemplatePolling();
    })();

    return () => {
      disposed = true;
      if (socket) socket.close();
      if (slideshowInterval) clearInterval(slideshowInterval);
      if (templateRefreshInterval) clearInterval(templateRefreshInterval);
      document.removeEventListener("fullscreenchange", onFullscreenChange);
    };
  });

  async function loadSlideshowData() {
    const [photoResult, templateResult] = await Promise.all([
      slideshow.photosPage(eventId),
      templates.slideshow(eventId).catch(() => null),
    ]);
    event = photoResult.event;
    photos = sortPhotosAsc(photoResult.photos);
    template = templateResult?.template ?? null;
    restartSlideshowInterval();
    loadingMore = !!photoResult.nextCursor;
    void loadMorePhotos(photoResult.nextCursor);
  }

  async function loadMorePhotos(cursor?: string) {
    let nextCursor = cursor;
    while (nextCursor) {
      const currentPhotoId = activePhoto?.PK;
      const page = await slideshow.photosPage(eventId, 50, nextCursor);
      photos = sortPhotosAsc([...photos, ...(page.photos ?? [])]);
      if (currentPhotoId) {
        const nextIndex = photos.findIndex((photo) => photo.PK === currentPhotoId);
        if (nextIndex >= 0) {
          activeIndex = nextIndex;
        }
      }
      nextCursor = page.nextCursor;
      loadingMore = !!nextCursor;
    }
    loadingMore = false;
  }

  async function refreshTemplate() {
    try {
      const result = await templates.slideshow(eventId);
      if (!template || result.template.updatedAt !== template.updatedAt) {
        template = result.template;
        restartSlideshowInterval();
      }
    } catch (e) {
      console.error("Template refresh error:", e);
    }
  }

  function startTemplatePolling() {
    if (templateRefreshInterval) clearInterval(templateRefreshInterval);
    templateRefreshInterval = setInterval(() => {
      void refreshTemplate();
    }, 30000);
  }

  function connectWebSocket() {
    if (!wsUrl) return;
    try {
      socket = new WebSocket(`${wsUrl}?eventId=${encodeURIComponent(eventId)}`);

      socket.onopen = () => {
        // Register connection for this event
        socket.send(JSON.stringify({
          action: "register",
          eventId
        }));
      };

      socket.onmessage = (eventMsg) => {
        const data = JSON.parse(eventMsg.data);
        if (data.type === "new_photo") {
          const newPhoto = {
            PK: data.photoId,
            presignedUrl: data.presignedUrl,
            nickname: data.nickname,
            greeting: data.greeting,
            status: "approved",
            createdAt: data.uploadedAt ?? new Date().toISOString(),
          };
          
          // Prepend new photo to list
          photos = [newPhoto, ...photos];
          
          // Switch presentation to the newly received photo instantly
          if (isPresentationMode) {
            activeIndex = 0;
            transitionVersion += 1;
          }

          // Trigger Danmaku if guest provided a greeting message
          if (data.greeting) {
            spawnDanmaku(data.nickname, data.greeting);
          }
        } else if (data.type === "delete_photo") {
          photos = photos.filter(p => p.PK !== data.photoId);
          if (activeIndex >= photos.length && photos.length > 0) {
            activeIndex = 0;
            transitionVersion += 1;
          }
        }
      };

      socket.onclose = () => {
        // Reconnect after 3 seconds
        setTimeout(connectWebSocket, 3000);
      };
    } catch (e) {
      console.error("WebSocket connection error:", e);
    }
  }

  function restartSlideshowInterval() {
    if (slideshowInterval) clearInterval(slideshowInterval);
    const intervalSeconds = template?.playback.intervalSeconds ?? 8;
    slideshowInterval = setInterval(() => {
      if (photos.length > 0 && isPresentationMode) {
        advanceSlide(1);
      }
    }, intervalSeconds * 1000);
  }

  function advanceSlide(step: number) {
    if (photos.length === 0) return;
    activeIndex = (activeIndex + step + photos.length) % photos.length;
    transitionVersion += 1;
  }

  // High performance CSS3 Track-based Danmaku Scheduler
  let trackStates = [false, false, false, false, false]; // 5 tracks
  function spawnDanmaku(nickname: string, greeting: string) {
    let track = trackStates.findIndex(occupied => !occupied);
    if (track === -1) {
      track = Math.floor(Math.random() * 5); // Fallback to random track if all full
    }
    
    // Lock track
    trackStates[track] = true;
    
    const id = `${Date.now()}-${Math.random()}`;
    const item = { id, nickname, greeting, track };
    danmakus.push(item);

    // Free the track after 4 seconds (allows messages to pass clear)
    setTimeout(() => {
      trackStates[track] = false;
    }, 4500);

    // Auto-destroy element after animation ends (9 seconds)
    setTimeout(() => {
      danmakus = danmakus.filter(d => d.id !== id);
    }, 9000);
  }

  function enterPresentationMode() {
    isPresentationMode = true;
    activeIndex = 0;
    transitionVersion += 1;
    const docEl = document.documentElement;
    if (docEl.requestFullscreen) {
      docEl.requestFullscreen().then(() => {
        isFullscreen = true;
      }).catch(err => {
        console.error("Error entering fullscreen:", err);
      });
    }
  }

  function exitPresentationMode() {
    isPresentationMode = false;
    if (document.fullscreenElement) {
      document.exitFullscreen().then(() => {
        isFullscreen = false;
      });
    }
  }

  const activePhoto = $derived(photos[activeIndex] || null);

  function sortPhotosAsc(list: any[]) {
    return [...list].sort((a, b) =>
      (a.confirmedAt ?? a.uploadedAt ?? a.createdAt ?? "").localeCompare(b.confirmedAt ?? b.uploadedAt ?? b.createdAt ?? "")
    );
  }

  function layerStyle(layer: TemplateLayer) {
    if (!template) return "";
    const widthPct = (layer.width / template.canvas.width) * 100;
    const heightPct = (layer.height / template.canvas.height) * 100;
    const leftPct = (layer.x / template.canvas.width) * 100;
    const topPct = (layer.y / template.canvas.height) * 100;
    return `left:${leftPct}%;top:${topPct}%;width:${widthPct}%;height:${heightPct}%;z-index:${layer.zIndex};transform:rotate(${layer.rotation}deg);opacity:${layer.data.opacity ?? 1};`;
  }

  function previewAssetUrl(layer: TemplateLayer) {
    return template?.assets.find((asset) => asset.assetId === layer.data.assetId || asset.key === layer.data.assetKey)?.previewUrl;
  }

  function frameStyle(layer: TemplateLayer) {
    if (!template) return "";
    return frameTokenToInlineStyle(resolveLayerFrameToken(layer.data, template.framePresets ?? []));
  }

  function photoTransitionClass() {
    return resolveTransitionClass(template?.playback);
  }

  const transitionDurationMs = $derived(resolveTransitionConfig(template?.playback).durationMs);
  const transitionEasing = $derived(resolveTransitionConfig(template?.playback).easing);
  const transitionStaggerMs = $derived(resolveTransitionConfig(template?.playback).staggerMs);
</script>

{#if isPresentationMode && activePhoto}
  <!-- PRESENTATION FULLSCREEN MODE -->
  <div class="fixed inset-0 bg-[#0c0806] z-50 overflow-hidden flex flex-col justify-between select-none">
    
    <!-- Blur Backdrop Background -->
    <div class="absolute inset-0 w-full h-full opacity-35 filter blur-2xl scale-110 pointer-events-none transition-all duration-1000">
      <img src={activePhoto.presignedUrl} alt="backdrop" decoding="async" class="w-full h-full object-cover" />
    </div>

    <!-- Active Fullscreen Photo -->
    <div class="absolute inset-0 flex items-center justify-center p-4 z-10">
      {#key transitionVersion}
        <div
          class={`relative w-full h-full max-w-[92vw] max-h-[88vh] ${photoTransitionClass()} rounded-2xl overflow-hidden shadow-2xl border border-white/10 bg-black/40`}
          style={`--photo-transition-duration:${transitionDurationMs}ms;--photo-transition-easing:${transitionEasing};--photo-transition-stagger:${transitionStaggerMs}ms;`}
        >
          <div class="absolute inset-0 photo-stage">
            <img
              src={activePhoto.presignedUrl}
              alt={activePhoto.nickname}
              decoding="async"
              class="w-full h-full object-cover opacity-80 photo-main-image"
            />
            <div class="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-black/10"></div>
          </div>

          {#if template}
            <div class="absolute inset-0" style={`aspect-ratio: ${template.canvas.width} / ${template.canvas.height};`}>
              {#each template.layers.slice().sort((a, b) => a.zIndex - b.zIndex) as layer (layer.id)}
                <div class="absolute overflow-hidden" style={layerStyle(layer)}>
                  {#if layer.type === "decorative-asset" && previewAssetUrl(layer)}
                    <img src={previewAssetUrl(layer)} alt={layer.data.text ?? "decorative asset"} class="w-full h-full object-contain" />
                  {:else if layer.type === "text"}
                    <div class="w-full h-full flex items-center justify-center p-4 text-center" style={`background:${layer.data.backgroundColor ?? "rgba(0,0,0,0.12)"};color:${layer.data.color ?? "#fff"};`}>
                      <div style={`font-size:${layer.data.fontSize ?? 28}px;text-align:${layer.data.align ?? "center"};`} class="font-semibold tracking-wide">
                        {layer.data.text ?? "文字"}
                      </div>
                    </div>
                  {:else}
                    <div class="w-full h-full rounded-[inherit]" style={frameStyle(layer)}></div>
                  {/if}
                </div>
              {/each}
            </div>
          {/if}

          <!-- Contributor Info bar -->
          <div class="absolute left-0 right-0 bottom-0 p-4 bg-gradient-to-t from-black/80 via-black/45 to-transparent text-white text-center photo-meta">
            <p class="text-sm font-semibold tracking-wide text-[#d4a373]">👤 賓客 {activePhoto.nickname} 上傳分享</p>
            {#if activePhoto.greeting}
              <p class="text-lg font-medium mt-1 text-[#fdf8f3] tracking-wider leading-relaxed">「 {activePhoto.greeting} 」</p>
            {/if}
          </div>
        </div>
      {/key}
    </div>

    <!-- 📣 GPU-Accelerated Danmaku Overlay Tracks -->
    <div class="absolute inset-x-0 top-6 bottom-auto h-[350px] z-30 pointer-events-none overflow-hidden">
      {#each danmakus as d (d.id)}
        <div
          class="danmaku-item flex items-center gap-3 px-5 py-2.5 rounded-full shadow-lg border text-white font-medium bg-[#3d2b1f]/80 border-[#d4a373]/40 backdrop-blur-md"
          style="top: {d.track * 68 + 12}px;"
        >
          <span class="text-xs font-semibold text-[#d4a373] bg-[#fdf8f3]/10 px-2 py-0.5 rounded-full">💬 {d.nickname}</span>
          <span class="text-base tracking-wide">{d.greeting}</span>
        </div>
      {/each}
    </div>

    <!-- Floating Controller Bar -->
    <div class="absolute bottom-6 left-1/2 -translate-x-1/2 z-40 bg-black/60 backdrop-blur-lg border border-white/10 rounded-full px-5 py-2.5 flex items-center gap-6 shadow-xl opacity-20 hover:opacity-100 transition-opacity duration-300">
      <div class="flex items-center gap-2">
        <div class="w-2.5 h-2.5 bg-green-500 rounded-full animate-ping"></div>
        <span class="text-xs text-neutral-300 font-semibold tracking-wider">動畫 {template?.playback.transition ?? "fade"} / {template?.playback.intervalSeconds ?? 8}s</span>
      </div>
      <div class="w-[1px] h-4 bg-white/20"></div>
      <button
        onclick={exitPresentationMode}
        class="text-xs font-semibold text-amber-200 hover:text-white transition-colors"
      >🚪 退出投屏模式</button>
    </div>

  </div>
{:else}
  <!-- STANDARD LIST GRID MODE -->
  <div class="max-w-md mx-auto px-4 pt-6 pb-16">
    <a href="/admin" class="text-sm text-[#8b7355] hover:text-[#3d2b1f] transition-colors">← 返回管理中心</a>

    <div class="text-center mt-3 mb-6">
      <h1 class="text-2xl font-bold text-[#3d2b1f]">{event.name ?? "婚禮相簿"}</h1>
      {#if event.date}
        <p class="text-xs text-[#8b7355] mt-1 tracking-wider">{event.date}</p>
      {/if}
    </div>

    <!-- Interactive Buttons -->
    <div class="grid grid-cols-2 gap-2.5 mb-6">
      <button
        onclick={enterPresentationMode}
        disabled={photos.length === 0}
        class="py-3 px-4 bg-[#3d2b1f] text-amber-200 hover:text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span>📺 開啟即時大螢幕投屏</span>
      </button>
      <a href="/event/{eventId}/upload">
        <button class="w-full py-3 px-4 bg-[#d4a373] text-white hover:bg-[#bc8a5f] font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors shadow-sm">
          <span>🚀 賓客上傳照片</span>
        </button>
      </a>
    </div>

    {#if loading}
      <div class="text-center py-12 text-[#8b7355]">載入中...</div>
    {:else if photos.length === 0}
      <div class="text-center py-16 text-[#8b7355] bg-white rounded-2xl shadow-sm border border-[#e8d5c4] px-6">
        <p class="text-4xl mb-3">🖼️</p>
        <p class="text-sm font-semibold">目前尚無已發布的照片</p>
        <p class="text-xs text-gray-400 mt-1 leading-relaxed">
          掃描上方的上傳 QR Code 或點擊按鈕，<br />上傳第一張照片開啟婚禮分享！
        </p>
      </div>
    {:else}
      {#if loadingMore}
        <p class="mb-3 text-center text-xs text-[#8b7355]">正在分批預載更多照片...</p>
      {/if}
      <div class="bg-white rounded-2xl p-4 shadow-sm border border-[#e8d5c4]">
        <h2 class="text-xs font-bold text-[#8b7355] mb-3 uppercase tracking-wider">相片牆 ({photos.length})</h2>
        <div class="grid grid-cols-3 gap-1.5">
          {#each photos as photo}
            <div class="relative aspect-square rounded-lg overflow-hidden group border border-neutral-100">
              <img
                src={photo.presignedUrl}
                alt={photo.nickname}
                class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
              <div class="absolute bottom-0 left-0 right-0 p-1 bg-black/60 text-white text-[9px] text-center truncate pointer-events-none">
                {photo.nickname}
              </div>
            </div>
          {/each}
        </div>
      </div>
    {/if}
  </div>
{/if}

<style>
  @keyframes photo-fade {
    from {
      opacity: 0;
      transform: scale(1.01);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }

  @keyframes photo-fade-scale {
    from {
      opacity: 0;
      transform: scale(1.05);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }

  @keyframes photo-slide {
    from {
      opacity: 0;
      transform: translateX(2.5%) scale(1.01);
    }
    to {
      opacity: 1;
      transform: translateX(0) scale(1);
    }
  }

  @keyframes photo-fade-soft {
    from {
      opacity: 0;
      transform: scale(1.015);
      filter: blur(4px);
    }
    to {
      opacity: 1;
      transform: scale(1);
      filter: blur(0);
    }
  }

  @keyframes photo-slide-parallax {
    from {
      opacity: 0;
      transform: translateX(3.5%) scale(1.03);
    }
    to {
      opacity: 1;
      transform: translateX(0) scale(1);
    }
  }

  @keyframes photo-stack-flip {
    from {
      opacity: 0;
      transform: perspective(1400px) rotateY(14deg) rotateX(1.5deg) translateY(1%);
    }
    to {
      opacity: 1;
      transform: perspective(1400px) rotateY(0) rotateX(0) translateY(0);
    }
  }

  @keyframes photo-kenburns {
    from {
      opacity: 0;
      transform: scale(1.14) translate(-2.2%, -1.4%);
    }
    to {
      opacity: 1;
      transform: scale(1.05) translate(0, 0);
    }
  }

  @keyframes photo-ribbon-flow {
    from {
      opacity: 0;
      transform: translateX(-3.5%) skewX(-2deg) scale(1.02);
    }
    to {
      opacity: 1;
      transform: translateX(0) skewX(0) scale(1);
    }
  }

  @keyframes photo-meta-rise {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .photo-fade {
    animation: photo-fade var(--photo-transition-duration, 550ms) var(--photo-transition-easing, ease) both;
  }

  .photo-fade-scale {
    animation: photo-fade-scale var(--photo-transition-duration, 550ms) var(--photo-transition-easing, ease) both;
  }

  .photo-slide {
    animation: photo-slide var(--photo-transition-duration, 550ms) var(--photo-transition-easing, ease) both;
  }

  .photo-fade-soft {
    animation: photo-fade-soft var(--photo-transition-duration, 700ms) ease-out both;
  }

  .photo-slide-parallax {
    animation: photo-slide-parallax var(--photo-transition-duration, 700ms) var(--photo-transition-easing, ease-out) both;
  }

  .photo-slide-parallax .photo-main-image {
    transform-origin: center center;
    animation: photo-kenburns calc(var(--photo-transition-duration, 700ms) + 1000ms) ease-out both;
  }

  .photo-stack-flip {
    transform-style: preserve-3d;
    animation: photo-stack-flip var(--photo-transition-duration, 700ms) cubic-bezier(0.18, 0.9, 0.22, 1) both;
  }

  .photo-kenburns .photo-main-image {
    transform-origin: center center;
    animation: photo-kenburns calc(var(--photo-transition-duration, 700ms) + 1800ms) var(--photo-transition-easing, ease-out) both;
  }

  .photo-ribbon-flow {
    animation: photo-ribbon-flow var(--photo-transition-duration, 760ms) cubic-bezier(0.25, 0.8, 0.25, 1) both;
  }

  .photo-meta {
    animation: photo-meta-rise calc(var(--photo-transition-duration, 550ms) * 0.7) ease-out both;
    animation-delay: var(--photo-transition-stagger, 0ms);
  }

  @media (prefers-reduced-motion: reduce) {
    .photo-fade,
    .photo-fade-scale,
    .photo-slide,
    .photo-fade-soft,
    .photo-slide-parallax,
    .photo-stack-flip,
    .photo-ribbon-flow,
    .photo-main-image,
    .photo-meta {
      animation-duration: 1ms !important;
      animation-delay: 0ms !important;
      transform: none !important;
      filter: none !important;
    }
  }

  @keyframes danmaku-scroll {
    from {
      transform: translateX(100vw);
    }
    to {
      transform: translateX(-100%);
    }
  }

  .danmaku-item {
    position: absolute;
    white-space: nowrap;
    animation: danmaku-scroll 9s linear forwards;
    will-change: transform;
    pointer-events: none;
    z-index: 100;
  }
</style>
