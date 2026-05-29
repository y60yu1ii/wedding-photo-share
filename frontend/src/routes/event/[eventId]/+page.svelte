<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/stores";
  import { goto } from "$app/navigation";
  import { slideshow } from "$lib/api/client";

  const eventId = $derived($page.params.eventId);

  let event = $state<any>({});
  let photos = $state<any[]>([]);
  let loading = $state(true);

  onMount(async () => {
    try {
      const result = await slideshow.photos(eventId);
      event = result.event;
      photos = result.photos;
    } finally {
      loading = false;
    }
  });
</script>

<div class="max-w-md mx-auto px-4 pt-8">
  <div class="text-center mb-6">
    <h1 class="text-2xl font-bold">{event.name ?? "婚禮照片"}</h1>
    {#if event.date}
      <p class="text-sm text-[#8b7355] mt-1">{event.date}</p>
    {/if}
  </div>

  {#if loading}
    <div class="text-center py-12 text-[#8b7355]">載入中...</div>
  {:else if photos.length === 0}
    <div class="text-center py-12 text-[#8b7355] bg-white rounded-2xl shadow-sm border border-[#e8d5c4]">
      目前尚無照片
    </div>
  {:else}
    <div class="grid grid-cols-3 gap-1">
      {#each photos as photo}
        <img
          src={photo.presignedUrl ?? `https://picsum.photos/seed/${photo.PK}/400/400`}
          alt={photo.nickname}
          class="w-full aspect-square object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
        />
      {/each}
    </div>
  {/if}

  <div class="mt-8 text-center">
    <a href="/event/{eventId}/upload">
      <button class="py-2.5 px-6 bg-[#d4a373] text-white font-medium rounded-lg hover:bg-[#bc8a5f] transition-colors">
        上傳照片
      </button>
    </a>
  </div>
</div>
