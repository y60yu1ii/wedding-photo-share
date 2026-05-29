<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/stores";
  import { myguest } from "$lib/api/client";

  const eventId = $derived($page.params.eventId);

  let photos = $state<any[]>([]);
  let loading = $state(true);
  let deletingId = $state<string | null>(null);
  let nickname = $state("");
  let searched = $state(false);

  onMount(async () => {
    const q = new URLSearchParams(window.location.search);
    nickname = q.get("nickname") ?? "";
    if (!nickname.trim()) {
      loading = false;
      return;
    }
    await search();
  });

  async function search() {
    if (!nickname.trim()) return;
    loading = true;
    try {
      photos = await myguest.photos(eventId, nickname.trim());
      searched = true;
    } catch {
      // no photos yet
    } finally {
      loading = false;
    }
  }

  async function handleDelete(photoPK: string) {
    if (!confirm("確定要刪除這張照片嗎？")) return;
    deletingId = photoPK;
    try {
      await myguest.delete(photoPK, eventId, nickname.trim());
      photos = photos.filter((p) => p.PK !== photoPK);
    } finally {
      deletingId = null;
    }
  }
</script>

<div class="max-w-md mx-auto px-4 pt-8">
  <div class="text-center mb-6">
    <h1 class="text-2xl font-bold">我的上傳</h1>
    <p class="text-sm text-[#8b7355] mt-1">您上傳的所有照片</p>
  </div>

  <div class="mb-4 bg-white rounded-2xl p-4 shadow-sm border border-[#e8d5c4]">
    <div class="flex gap-2">
      <input
        bind:value={nickname}
        placeholder="輸入上傳時暱稱"
        class="flex-1 px-4 py-2.5 border border-[#e8d5c4] rounded-lg text-sm focus:outline-none focus:border-[#d4a373]"
      />
      <button
        onclick={search}
        class="py-2.5 px-4 bg-[#d4a373] text-white font-medium rounded-lg hover:bg-[#bc8a5f] transition-colors"
      >
        查詢
      </button>
    </div>
  </div>

  {#if loading}
    <div class="text-center py-12 text-[#8b7355]">載入中...</div>
  {:else if searched && photos.length === 0}
    <div class="text-center py-12 text-[#8b7355] bg-white rounded-2xl shadow-sm border border-[#e8d5c4]">
      您還沒有上傳任何照片
    </div>
  {:else if !searched}
    <div class="text-center py-12 text-[#8b7355] bg-white rounded-2xl shadow-sm border border-[#e8d5c4]">
      請輸入暱稱後查詢
    </div>
  {:else}
    <div class="grid grid-cols-3 gap-1">
      {#each photos as photo}
        <div class="relative aspect-square">
          <img
            src={photo.presignedUrl ?? `https://picsum.photos/seed/${photo.PK}/200/200`}
            alt={photo.nickname}
            class="w-full h-full object-cover rounded-lg"
          />
          <div class="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs text-center py-0.5 truncate px-1">
            {photo.nickname}
          </div>
          <button
            onclick={() => handleDelete(photo.PK)}
            disabled={deletingId === photo.PK}
            class="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs font-bold hover:bg-red-600 disabled:opacity-50"
          >×</button>
        </div>
      {/each}
    </div>
  {/if}

  <div class="mt-8 text-center">
    <a href="/event/{eventId}">
      <button class="py-2.5 px-6 border border-[#e8d5c4] text-[#3d2b1f] font-medium rounded-lg hover:bg-[#faf7f2] transition-colors">
        返回婚禮
      </button>
    </a>
  </div>
</div>
