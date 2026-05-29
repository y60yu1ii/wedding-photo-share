<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/stores";
  import { slideshow } from "$lib/api/client";

  const eventId = $derived($page.params.eventId);
  const wsUrl = import.meta.env.VITE_WS_URL;

  let event = $state<any>({});
  let photos = $state<any[]>([]);
  let loading = $state(true);
  
  // Slideshow Modes
  let isPresentationMode = $state(false);
  let activeIndex = $state(0);
  let isFullscreen = $state(false);
  
  // Danmaku Queue
  let danmakus = $state<{ id: string; nickname: string; greeting: string; track: number }[]>([]);
  
  let socket: WebSocket;
  let slideshowInterval: any;

  onMount(async () => {
    try {
      const result = await slideshow.photos(eventId);
      event = result.event;
      photos = result.photos;
    } finally {
      loading = false;
    }

    connectWebSocket();
    startSlideshowInterval();

    // Listen to fullscreen changes
    const onFullscreenChange = () => {
      isFullscreen = !!document.fullscreenElement;
      if (!isFullscreen) {
        isPresentationMode = false;
      }
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);

    return () => {
      if (socket) socket.close();
      if (slideshowInterval) clearInterval(slideshowInterval);
      document.removeEventListener("fullscreenchange", onFullscreenChange);
    };
  });

  function connectWebSocket() {
    if (!wsUrl) return;
    try {
      socket = new WebSocket(wsUrl);

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
            status: "approved"
          };
          
          // Prepend new photo to list
          photos = [newPhoto, ...photos];
          
          // Switch presentation to the newly received photo instantly
          if (isPresentationMode) {
            activeIndex = 0;
          }

          // Trigger Danmaku if guest provided a greeting message
          if (data.greeting) {
            spawnDanmaku(data.nickname, data.greeting);
          }
        } else if (data.type === "delete_photo") {
          photos = photos.filter(p => p.PK !== data.photoId);
          if (activeIndex >= photos.length && photos.length > 0) {
            activeIndex = 0;
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

  function startSlideshowInterval() {
    slideshowInterval = setInterval(() => {
      if (photos.length > 0 && isPresentationMode) {
        activeIndex = (activeIndex + 1) % photos.length;
      }
    }, 8000); // Auto-advance every 8 seconds
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
</script>

{#if isPresentationMode && activePhoto}
  <!-- PRESENTATION FULLSCREEN MODE -->
  <div class="fixed inset-0 bg-[#0c0806] z-50 overflow-hidden flex flex-col justify-between select-none">
    
    <!-- Blur Backdrop Background -->
    <div class="absolute inset-0 w-full h-full opacity-35 filter blur-2xl scale-110 pointer-events-none transition-all duration-1000">
      <img src={activePhoto.presignedUrl} alt="backdrop" class="w-full h-full object-cover" />
    </div>

    <!-- Active Fullscreen Photo -->
    <div class="absolute inset-0 flex items-center justify-center p-6 z-10 transition-all duration-1000">
      <div class="relative max-w-full max-h-full rounded-2xl overflow-hidden shadow-2xl border border-white/10 flex flex-col justify-end bg-black/40">
        <img
          src={activePhoto.presignedUrl}
          alt={activePhoto.nickname}
          class="max-w-full max-h-[82vh] object-contain mx-auto"
        />
        
        <!-- Contributor Info bar -->
        <div class="w-full p-4 bg-gradient-to-t from-black/80 via-black/50 to-transparent text-white text-center">
          <p class="text-sm font-semibold tracking-wide text-[#d4a373]">👤 賓客 {activePhoto.nickname} 上傳分享</p>
          {#if activePhoto.greeting}
            <p class="text-lg font-medium mt-1 text-[#fdf8f3] tracking-wider leading-relaxed">「 {activePhoto.greeting} 」</p>
          {/if}
        </div>
      </div>
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
        <span class="text-xs text-neutral-300 font-semibold tracking-wider">WebSocket 連線正常</span>
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
