<!-- Minimal HomePage stub for unit testing without SvelteKit router -->
<script lang="ts">
  export let onAdminClick: () => void = () => {};
  export let onGuestAccess: (eventId: string) => void = () => {};
  export let errorMsg: string = "";
  export let eventId: string = "";
</script>

<div>
  <h1>💍 婚禮照片分享</h1>
  <button onclick={onAdminClick}>管理登入</button>
  {#if errorMsg}
    <p class="error">{errorMsg}</p>
  {/if}
  <input placeholder="婚禮ID（向工作人員取得）" bind:value={eventId} />
  <button onclick={() => onGuestAccess(eventId)}>進入上傳</button>
</div>
