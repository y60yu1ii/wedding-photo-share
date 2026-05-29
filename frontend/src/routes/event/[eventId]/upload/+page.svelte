<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/stores";
  import { goto } from "$app/navigation";
  import { upload } from "$lib/api/client";

  const eventId = $derived($page.params.eventId);
  const uploadKey = $derived($page.url.searchParams.get("key") ?? "");

  let file = $state<File | null>(null);
  let nickname = $state("");
  let preview = $state<string | null>(null);
  let uploading = $state(false);
  let done = $state(false);
  let error = $state("");

  function handleFile(e: Event) {
    const input = e.target as HTMLInputElement;
    const f = input.files?.[0];
    if (!f) return;
    file = f;
    nickname = nickname || "匿名";
    const reader = new FileReader();
    reader.onload = (ev) => preview = ev.target?.result as string;
    reader.readAsDataURL(f);
  }

  async function handleUpload() {
    if (!file || !nickname.trim()) { error = "請選擇照片並填寫暱稱"; return; }
    error = "";
    uploading = true;
    try {
      const { uploadUrl, photoId } = await upload.presign(eventId, file.name, file.type, uploadKey);
      await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
      await upload.confirm(eventId, photoId, nickname.trim(), uploadKey);
      done = true;
    } catch (e) {
      error = (e as Error).message;
    } finally {
      uploading = false;
    }
  }
</script>

<div class="max-w-md mx-auto px-4 pt-6">
  <a href="/event/{eventId}" class="text-sm text-[#8b7355] hover:text-[#3d2b1f]">← 返回</a>

  <h1 class="text-2xl font-bold mt-3 mb-5">上傳照片</h1>

  {#if done}
    <div class="bg-white rounded-2xl p-8 shadow-sm border border-[#e8d5c4] text-center">
      <p class="text-4xl mb-4">✅</p>
      <h2 class="text-xl font-bold mb-2">上傳成功！</h2>
      <p class="text-sm text-[#8b7355] mb-6">感謝您的照片，管理員審核後就會公開</p>
      <a href="/event/{eventId}">
        <button class="py-2.5 px-6 border border-[#e8d5c4] text-[#3d2b1f] font-medium rounded-lg hover:bg-[#faf7f2] transition-colors">
          返回婚禮
        </button>
      </a>
    </div>
  {:else}
    <div class="bg-white rounded-2xl p-5 shadow-sm border border-[#e8d5c4]">
      {#if preview}
        <div class="mb-4 text-center">
          <img src={preview} alt="preview" class="max-h-64 mx-auto rounded-lg object-contain" />
        </div>
      {/if}

      {#if error}
        <div class="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg mb-4">{error}</div>
      {/if}

      <div class="space-y-3">
        <input
          type="file"
          accept="image/*"
          onchange={handleFile}
          class="w-full text-sm file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:bg-[#faf7f2] file:text-[#3d2b1f] file:cursor-pointer"
        />
        <input
          bind:value={nickname}
          placeholder="您的暱稱（顯示在照片旁）"
          class="w-full px-4 py-2.5 border border-[#e8d5c4] rounded-lg text-sm focus:outline-none focus:border-[#d4a373]"
        />
        <button
          onclick={handleUpload}
          disabled={uploading || !file || !nickname.trim()}
          class="w-full py-2.5 bg-[#d4a373] text-white font-medium rounded-lg hover:bg-[#bc8a5f] transition-colors disabled:opacity-50"
        >
          {uploading ? "上傳中..." : "送出照片"}
        </button>
      </div>
    </div>
  {/if}
</div>
