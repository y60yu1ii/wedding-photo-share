<script lang="ts">
  import type { GuestUpload } from "$lib/api/types";

  type Props = {
    photos?: GuestUpload[];
    selectedPhotoId?: string;
    disabled?: boolean;
    onChoose?: (photoId: string) => void;
  };

  let {
    photos = [],
    selectedPhotoId = "",
    disabled = false,
    onChoose,
  }: Props = $props();

  function choose(photoId: string) {
    if (disabled) return;
    onChoose?.(photoId);
  }
</script>

<div class="space-y-3">
  {#each photos as photo}
    <article class={`rounded-2xl border bg-white p-3 shadow-sm ${photo.PK === selectedPhotoId ? "border-[#d4a373] ring-1 ring-[#d4a373]/40" : "border-[#e8d5c4]"}`}>
      <div class="flex items-center gap-3">
        <img
          src={photo.presignedUrl ?? `https://picsum.photos/seed/${photo.PK}/160/160`}
          alt={photo.nickname}
          loading="lazy"
          decoding="async"
          class="h-20 w-20 flex-none rounded-xl object-cover"
        />
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-semibold text-[#3d2b1f]">{photo.nickname}</p>
          <p class="mt-0.5 text-xs text-[#8b7355]">{photo.PK}</p>
          {#if photo.representativePhotoId}
            <p class="mt-1 text-[11px] text-[#8b7355]">目前簽到照：{photo.representativePhotoId}</p>
          {/if}
        </div>
        <button
          type="button"
          class={`rounded-full px-3 py-2 text-xs font-semibold transition-colors ${photo.PK === selectedPhotoId ? "bg-[#f5ede3] text-[#8b7355]" : "bg-[#d4a373] text-white hover:bg-[#bc8a5f]"}`}
          onclick={() => choose(photo.PK)}
          disabled={disabled || photo.PK === selectedPhotoId}
        >
          {photo.PK === selectedPhotoId ? "目前簽到照" : "設為簽到照"}
        </button>
      </div>
    </article>
  {/each}
</div>
