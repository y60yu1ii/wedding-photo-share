<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/stores";
  import { goto } from "$app/navigation";
  import { auth, events } from "$lib/api/client";

  const eventId = $derived($page.params.eventId);

  let event = $state<any>({});
  let photos = $state<any[]>([]);
  let loading = $state(true);

  onMount(() => {
    if (!auth.isLoggedIn()) { goto("/admin/login"); return; }
    loadData();
  });

  async function loadData() {
    loading = true;
    try {
      [event, photos] = await Promise.all([
        events.get(eventId),
        events.photos(eventId),
      ]);
    } finally {
      loading = false;
    }
  }

  async function approvePhoto(photoId: string) {
    await events.approvePhoto(photoId);
    photos = photos.map((p) => p.PK === photoId ? { ...p, status: "approved" } : p);
  }

  async function toggleReviewSetting() {
    const updatedValue = !event.requiresReview;
    try {
      await events.update(eventId, { requiresReview: updatedValue });
      event.requiresReview = { ...event, requiresReview: updatedValue }.requiresReview;
      // Also reload data or update event directly to make sure Svelte 5 states are properly reactively synced
      event = { ...event, requiresReview: updatedValue };
    } catch (e: any) {
      alert(e.message || "更新失敗");
    }
  }

  const pending = $derived(photos.filter((p) => p.status === "pending"));
  const approved = $derived(photos.filter((p) => p.status === "approved"));

  const BASE_URL = "https://wedding.fishare.de";

  function buildUrls(evt: any) {
    const eid = evt.PK ?? eventId;
    const uk = evt.uploadKey;
    const sk = evt.showKey;
    if (!uk || !sk) return { hasKeys: false };
    const uploadUrl = `${BASE_URL}/event/${eid}/upload?key=${uk}`;
    const showUrl = `${BASE_URL}/event/${eid}?key=${sk}`;
    return {
      hasKeys: true,
      uploadUrl,
      showUrl,
    };
  }

  function qrUrl(text: string) {
    return `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(text)}`;
  }

  const urls = $derived(buildUrls(event));
</script>

<div class="max-w-md mx-auto px-4 pt-6">
  <a href="/admin" class="text-sm text-[#8b7355] hover:text-[#3d2b1f]">← 返回列表</a>

  <div class="mt-4 mb-5">
    <h1 class="text-2xl font-bold">{event.name ?? "婚禮管理"}</h1>
    {#if event.date}
      <p class="text-sm text-[#8b7355] mt-1">{event.date}</p>
    {/if}
  </div>

  <!-- Key Cards -->
  <div class="bg-white rounded-2xl p-5 shadow-sm border border-[#e8d5c4] mb-4">
    <h2 class="text-sm font-semibold mb-3">分享連結</h2>

    {#if urls.hasKeys}
      <!-- Upload Link -->
      <div class="flex items-start gap-3 mb-4">
        <img src={qrUrl(urls.uploadUrl)} alt="上傳 QR" class="w-20 h-20 rounded-lg border border-[#e8d5c4] flex-shrink-0" />
        <div class="flex-1 min-w-0">
          <p class="text-xs text-[#8b7355] mb-1">👤 賓客上傳</p>
          <p class="text-xs font-mono break-all text-[#3d2b1f] bg-[#fdf8f3] rounded px-2 py-1">{urls.uploadUrl}</p>
          <button
            onclick={() => navigator.clipboard.writeText(urls.uploadUrl)}
            class="mt-1.5 text-xs bg-[#f5ede3] hover:bg-[#e8d5c4] text-[#8b7355] px-3 py-1 rounded-md transition-colors"
          >📋 複製連結</button>
        </div>
      </div>

      <!-- Show Link -->
      <div class="flex items-start gap-3">
        <img src={qrUrl(urls.showUrl)} alt="瀏覽 QR" class="w-20 h-20 rounded-lg border border-[#e8d5c4] flex-shrink-0" />
        <div class="flex-1 min-w-0">
          <p class="text-xs text-[#8b7355] mb-1">🎉 婚禮展示</p>
          <p class="text-xs font-mono break-all text-[#3d2b1f] bg-[#fdf8f3] rounded px-2 py-1">{urls.showUrl}</p>
          <button
            onclick={() => navigator.clipboard.writeText(urls.showUrl)}
            class="mt-1.5 text-xs bg-[#f5ede3] hover:bg-[#e8d5c4] text-[#8b7355] px-3 py-1 rounded-md transition-colors"
          >📋 複製連結</button>
        </div>
      </div>

      <!-- Photo Review Toggle Setting -->
      <div class="mt-4 pt-4 border-t border-[#e8d5c4] flex items-center justify-between">
        <div>
          <p class="text-xs font-semibold text-[#8b7355]">📢 照片發布設定</p>
          <p class="text-[11px] text-gray-500 mt-0.5">
            {event.requiresReview ? "賓客上傳的照片需經管理員審核後才公開" : "賓客照片上傳完成後免審核直接公開發布"}
          </p>
        </div>
        <button
          onclick={toggleReviewSetting}
          class="text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors {event.requiresReview ? 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100' : 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100'}"
        >
          {event.requiresReview ? "🔓 切換為免審核" : "🔒 切換為需審核"}
        </button>
      </div>
    {:else}
      <p class="text-sm text-[#8b7355] text-center py-4">此婚禮尚無金鑰，請重新建立。</p>
    {/if}
  </div>

  {#if loading}
    <div class="text-center py-12 text-[#8b7355]">載入中...</div>
  {:else}
    {#if pending.length > 0}
      <div class="bg-white rounded-2xl p-5 shadow-sm border border-[#e8d5c4] mb-4">
        <h2 class="text-sm font-semibold text-amber-600 mb-3">待審核 ({pending.length})</h2>
        <div class="grid grid-cols-3 gap-1">
          {#each pending as photo}
            <div class="relative aspect-square">
              <img
                src={photo.presignedUrl ?? `https://picsum.photos/seed/${photo.PK}/200/200`}
                alt={photo.nickname}
                class="w-full h-full object-cover rounded-lg cursor-pointer opacity-80 hover:opacity-100 transition-opacity"
                onclick={() => approvePhoto(photo.PK)}
              />
              <div class="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs text-center py-0.5 rounded-b-lg truncate px-1">
                {photo.nickname}
              </div>
            </div>
          {/each}
        </div>
        <p class="text-xs text-[#8b7355] mt-2">點擊照片即可核准</p>
      </div>
    {/if}

    <div class="bg-white rounded-2xl p-5 shadow-sm border border-[#e8d5c4]">
      <h2 class="text-sm font-semibold mb-3">已核准 ({approved.length})</h2>
      {#if approved.length === 0}
        <p class="text-sm text-[#8b7355] text-center py-6">尚無已核准照片</p>
      {:else}
        <div class="grid grid-cols-3 gap-1">
          {#each approved as photo}
            <img
              src={photo.presignedUrl ?? `https://picsum.photos/seed/${photo.PK}/200/200`}
              alt={photo.nickname}
              class="w-full aspect-square object-cover rounded-lg"
            />
          {/each}
        </div>
      {/if}
    </div>
  {/if}
</div>
