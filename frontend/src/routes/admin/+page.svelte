<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { auth, events } from "$lib/api/client";

  let eventList = $state<any[]>([]);
  let loading = $state(true);
  let showCreate = $state(false);
  let newName = $state("");
  let newDate = $state("");
  let requiresReview = $state(true);
  let deletingId = $state<string | null>(null);
  let selected = $state<Set<string>>(new Set());
  let batchDeleting = $state(false);

  onMount(() => {
    if (!auth.isLoggedIn()) { goto("/admin/login"); return; }
    loadEvents();
  });

  async function loadEvents() {
    loading = true;
    try {
      eventList = await events.list();
    } catch {
      // handled in api
    } finally {
      loading = false;
    }
  }

  async function handleDelete(eventId: string, eventName: string) {
    if (!confirm(`確定要刪除「${eventName}」嗎？此操作無法復原。`)) return;
    deletingId = eventId;
    try {
      await events.remove(eventId);
      eventList = eventList.filter((e) => e.PK !== eventId);
      selected.delete(eventId);
      selected = new Set(selected);
    } catch {
      alert("刪除失敗，請重試");
    } finally {
      deletingId = null;
    }
  }

  async function createEvent() {
    if (!newName.trim() || !newDate) return;
    const result = await events.create(newName, newDate, requiresReview);
    showCreate = false;
    newName = "";
    newDate = "";
    requiresReview = true;
    loadEvents();
    goto(`/admin/event/${result.PK}`);
  }

  function toggleSelect(eventId: string) {
    if (selected.has(eventId)) {
      selected.delete(eventId);
    } else {
      selected.add(eventId);
    }
    selected = new Set(selected);
  }

  function toggleAll() {
    if (selected.size === eventList.length) {
      selected = new Set();
    } else {
      selected = new Set(eventList.map((e) => e.PK));
    }
  }

  async function batchDelete() {
    const ids = Array.from(selected);
    if (!confirm(`確定要刪除 ${ids.length} 個婚禮嗎？此操作無法復原。`)) return;
    batchDeleting = true;
    let failed = 0;
    for (const id of ids) {
      try {
        await events.remove(id);
        eventList = eventList.filter((e) => e.PK !== id);
      } catch {
        failed++;
      }
    }
    selected = new Set();
    batchDeleting = false;
    if (failed > 0) alert(`${failed} 個刪除失敗，請重試`);
  }
</script>

<div class="max-w-md mx-auto px-4 pt-8">
  <div class="flex items-center justify-between mb-6">
    <h1 class="text-2xl font-bold">管理後台</h1>
    <button
      onclick={() => auth.logout()}
      class="text-sm text-[#8b7355] hover:text-[#3d2b1f]"
    >登出</button>
  </div>

  {#if showCreate}
    <div class="bg-white rounded-2xl p-5 shadow-sm border border-[#e8d5c4] mb-4">
      <h2 class="text-base font-semibold mb-3">新婚禮</h2>
      <div class="space-y-3">
        <input
          bind:value={newName}
          placeholder="婚禮名稱"
          class="w-full px-4 py-2.5 border border-[#e8d5c4] rounded-lg text-sm focus:outline-none focus:border-[#d4a373]"
        />
        <input
          type="date"
          bind:value={newDate}
          class="w-full px-4 py-2.5 border border-[#e8d5c4] rounded-lg text-sm focus:outline-none focus:border-[#d4a373]"
        />
        <div class="flex items-center gap-2 py-1 px-1">
          <input
            type="checkbox"
            bind:checked={requiresReview}
            id="newRequiresReview"
            class="w-4 h-4 accent-[#d4a373] cursor-pointer"
          />
          <label for="newRequiresReview" class="text-xs text-[#8b7355] cursor-pointer">賓客上傳的照片需經管理員審核</label>
        </div>
        <div class="flex gap-2">
          <button onclick={createEvent} class="flex-1 py-2 bg-[#d4a373] text-white rounded-lg text-sm font-medium">建立</button>
          <button onclick={() => showCreate = false} class="flex-1 py-2 border border-[#e8d5c4] rounded-lg text-sm">取消</button>
        </div>
      </div>
    </div>
  {:else}
    <div class="flex gap-2 mb-4">
      <button
        onclick={() => showCreate = true}
        class="flex-1 py-2.5 bg-[#d4a373] text-white font-medium rounded-lg hover:bg-[#bc8a5f] transition-colors"
      >
        + 建立新婚禮
      </button>
      {#if selected.size > 0}
        <button
          onclick={batchDelete}
          disabled={batchDeleting}
          class="px-4 py-2.5 bg-red-500 text-white font-medium rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
        >
          {batchDeleting ? '刪除中...' : `刪除 ${selected.size} 個`}
        </button>
      {/if}
    </div>
  {/if}

  {#if loading}
    <div class="text-center py-8 text-[#8b7355]">載入中...</div>
  {:else if eventList.length === 0}
    <div class="text-center py-8 text-[#8b7355]">尚未建立任何婚禮</div>
  {:else}
    <!-- Header row -->
    <div class="flex items-center gap-2 mb-2 px-1">
      <input
        type="checkbox"
        checked={selected.size === eventList.length && eventList.length > 0}
        onchange={toggleAll}
        class="w-4 h-4 accent-[#d4a373]"
      />
      <span class="text-xs text-[#8b7355]">全選</span>
    </div>
    <div class="space-y-3">
      {#each eventList as event}
        <div class="bg-white rounded-2xl p-5 shadow-sm border border-[#e8d5c4] hover:border-[#d4a373] transition-colors">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2 flex-1 min-w-0">
              <input
                type="checkbox"
                checked={selected.has(event.PK)}
                onchange={() => toggleSelect(event.PK)}
                class="w-4 h-4 accent-[#d4a373] flex-shrink-0"
              />
              <a href="/admin/event/{event.PK}" class="flex-1 min-w-0">
                <h3 class="font-semibold text-base">{event.name}</h3>
                <p class="text-sm text-[#8b7355] mt-1">{event.date}</p>
              </a>
            </div>
            <div class="flex items-center gap-2 flex-shrink-0 ml-3">
              <span class="text-xs px-2.5 py-1 rounded-full {event.status === 'active' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}">
                {event.status === 'active' ? '進行中' : '已結束'}
              </span>
              <button
                onclick={(e) => { e.preventDefault(); handleDelete(event.PK, event.name); }}
                disabled={deletingId === event.PK}
                class="text-xs px-2.5 py-1 rounded-full bg-red-50 text-red-600 hover:bg-red-100 transition-colors disabled:opacity-50"
              >
                {deletingId === event.PK ? '刪除中...' : '刪除'}
              </button>
            </div>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>
