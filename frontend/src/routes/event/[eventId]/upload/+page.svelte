<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/stores";
  import { goto } from "$app/navigation";
  import { upload } from "$lib/api/client";
  import { compressImage } from "$lib/utils/compressor";

  const eventId = $derived($page.params.eventId);
  const uploadKey = $derived($page.url.searchParams.get("key") ?? "");

  let queue = $state<any[]>([]);
  let nickname = $state("");
  let greeting = $state("");
  let uploading = $state(false);
  let allDone = $state(false);
  let error = $state("");

  // Retrieve saved nickname from localStorage if it exists
  onMount(() => {
    if (typeof localStorage !== "undefined") {
      nickname = localStorage.getItem("guest_nickname") || "";
    }
  });

  function handleFiles(e: Event) {
    const input = e.target as HTMLInputElement;
    const files = input.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const id = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      
      const item = {
        id,
        file: f,
        preview: "",
        progress: 0,
        status: "pending" as const,
        error: ""
      };

      queue.push(item);

      const reader = new FileReader();
      reader.onload = (ev) => {
        const found = queue.find(q => q.id === id);
        if (found) found.preview = ev.target?.result as string;
      };
      reader.readAsDataURL(f);
    }
    
    // Clear input to allow re-selection
    input.value = "";
  }

  function removeItem(id: string) {
    queue = queue.filter(item => item.id !== id);
  }

  function uploadFile(blob: Blob, uploadUrl: string, onProgress: (p: number) => void): Promise<void> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", uploadUrl);
      xhr.setRequestHeader("Content-Type", blob.type);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          reject(new Error(`S3 上傳失敗 (狀態碼: ${xhr.status})`));
        }
      };
      xhr.onerror = () => reject(new Error("網路上傳異常"));
      xhr.send(blob);
    });
  }

  async function handleBatchUpload() {
    if (queue.length === 0) { error = "請先選擇至少一張照片"; return; }
    if (!nickname.trim()) { error = "請填寫您的暱稱"; return; }
    
    error = "";
    uploading = true;

    // Save nickname to localStorage
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("guest_nickname", nickname.trim());
    }

    try {
      for (let i = 0; i < queue.length; i++) {
        const item = queue[i];
        if (item.status === "completed") continue;

        try {
          // 1. Image Compression
          item.status = "compressing";
          const compressedBlob = await compressImage(item.file, 1920, 0.82);

          // 2. Presigned S3 URL
          item.status = "uploading";
          const { uploadUrl, photoId } = await upload.presign(
            eventId,
            item.file.name,
            compressedBlob.type,
            uploadKey
          );

          // 3. Perform S3 Upload with progress listener
          await uploadFile(compressedBlob, uploadUrl, (progress) => {
            item.progress = progress;
          });

          // 4. Confirm upload + greeting message
          await upload.confirm(eventId, photoId, nickname.trim(), uploadKey, greeting.trim());
          item.status = "completed";
          item.progress = 100;
        } catch (e: any) {
          item.status = "failed";
          item.error = e.message || "上傳失敗";
          throw e; // Break loop on first error to prevent half-success issues
        }
      }
      allDone = true;
    } catch (e: any) {
      error = e.message || "部分照片上傳失敗，請檢查網路後重試";
    } finally {
      uploading = false;
    }
  }
</script>

<div class="max-w-md mx-auto px-4 pt-6 pb-12">
  <a href="/event/{eventId}" class="text-sm text-[#8b7355] hover:text-[#3d2b1f] transition-colors">← 返回婚禮相簿</a>

  <h1 class="text-2xl font-bold mt-3 mb-5 text-[#3d2b1f]">📸 上傳照片</h1>

  {#if allDone}
    <div class="bg-white rounded-2xl p-8 shadow-sm border border-[#e8d5c4] text-center">
      <div class="w-16 h-16 bg-green-50 text-green-500 rounded-full flex items-center justify-center text-3xl mx-auto mb-4 border border-green-200">✓</div>
      <h2 class="text-xl font-bold text-[#3d2b1f] mb-2">上傳成功！</h2>
      <p class="text-sm text-[#8b7355] mb-6 leading-relaxed">
        感謝您的照片與暖心祝福！<br />新人的大螢幕上馬上就會出現您的精彩瞬間喔～
      </p>
      <a href="/event/{eventId}">
        <button class="w-full py-2.5 bg-[#d4a373] text-white font-medium rounded-lg hover:bg-[#bc8a5f] transition-colors shadow-sm">
          返回婚禮大螢幕
        </button>
      </a>
    </div>
  {:else}
    <div class="bg-white rounded-2xl p-5 shadow-sm border border-[#e8d5c4] space-y-5">
      
      <!-- Upload Dropzone / Button -->
      {#if !uploading}
        <div class="relative border-2 border-dashed border-[#e8d5c4] hover:border-[#d4a373] rounded-xl p-6 text-center transition-colors bg-[#faf7f2]/50">
          <input
            type="file"
            multiple
            accept="image/*"
            onchange={handleFiles}
            class="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          <div class="space-y-1.5 pointer-events-none">
            <p class="text-4xl">➕</p>
            <p class="text-sm font-semibold text-[#3d2b1f]">點擊或拖曳照片至此</p>
            <p class="text-xs text-[#8b7355]">支援批量上傳多張照片</p>
          </div>
        </div>
      {/if}

      <!-- Selected Photo List (Queue) -->
      {#if queue.length > 0}
        <div class="space-y-2">
          <p class="text-xs font-semibold text-[#8b7355]">已選擇的照片 ({queue.length})</p>
          <div class="grid grid-cols-2 gap-2">
            {#each queue as item}
              <div class="relative aspect-square rounded-xl overflow-hidden border border-[#e8d5c4] bg-[#faf7f2] flex flex-col justify-end">
                {#if item.preview}
                  <img src={item.preview} alt="preview" class="absolute inset-0 w-full h-full object-cover" />
                {/if}
                
                <!-- Remove item button -->
                {#if !uploading && item.status !== 'completed'}
                  <button
                    onclick={() => removeItem(item.id)}
                    class="absolute top-1.5 right-1.5 w-6 h-6 bg-black/60 text-white rounded-full flex items-center justify-center text-xs hover:bg-black/80 transition-colors"
                  >✕</button>
                {/if}

                <!-- Status Overlay & Progress Bar -->
                <div class="relative z-10 p-1.5 bg-gradient-to-t from-black/80 via-black/40 to-transparent text-white">
                  <div class="flex items-center justify-between text-[10px] mb-1">
                    <span>
                      {#if item.status === 'pending'}等待中
                      {:else if item.status === 'compressing'}壓縮中...
                      {:else if item.status === 'uploading'}上傳中...
                      {:else if item.status === 'completed'}✓ 已完成
                      {:else if item.status === 'failed'}✕ 失敗
                      {/if}
                    </span>
                    {#if item.status === 'uploading'}
                      <span>{item.progress}%</span>
                    {/if}
                  </div>
                  <div class="w-full bg-white/30 h-1 rounded-full overflow-hidden">
                    <div
                      class="bg-[#d4a373] h-full transition-all duration-300"
                      style="width: {item.progress}%"
                    ></div>
                  </div>
                </div>
              </div>
            {/each}
          </div>
        </div>
      {/if}

      <!-- Error Message -->
      {#if error}
        <div class="bg-red-50 border border-red-100 text-red-700 text-xs px-4 py-3 rounded-lg">{error}</div>
      {/if}

      <!-- Inputs Form -->
      <div class="space-y-3 pt-2">
        <div>
          <label for="nickname" class="block text-xs font-semibold text-[#8b7355] mb-1.5">您的暱稱 <span class="text-red-500">*</span></label>
          <input
            id="nickname"
            bind:value={nickname}
            disabled={uploading}
            placeholder="如：伴郎小張 / 大學同學雅婷"
            class="w-full px-4 py-2.5 border border-[#e8d5c4] rounded-lg text-sm focus:outline-none focus:border-[#d4a373] bg-[#faf7f2]/20 disabled:opacity-50"
          />
        </div>

        <div>
          <label for="greeting" class="block text-xs font-semibold text-[#8b7355] mb-1.5">暖心祝福留言 <span class="text-gray-400 font-normal">(選填)</span></label>
          <input
            id="greeting"
            bind:value={greeting}
            disabled={uploading}
            maxlength="50"
            placeholder="寫下您對新人的滿滿祝福吧（50字以內）"
            class="w-full px-4 py-2.5 border border-[#e8d5c4] rounded-lg text-sm focus:outline-none focus:border-[#d4a373] bg-[#faf7f2]/20 disabled:opacity-50"
          />
        </div>

        <button
          onclick={handleBatchUpload}
          disabled={uploading || queue.length === 0 || !nickname.trim()}
          class="w-full py-3 mt-4 bg-[#d4a373] hover:bg-[#bc8a5f] text-white font-semibold rounded-lg transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {#if uploading}
            <svg class="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>正在壓縮並上傳中...</span>
          {:else}
            <span>🚀 送出照片與祝福</span>
          {/if}
        </button>
      </div>

    </div>
  {/if}
</div>
