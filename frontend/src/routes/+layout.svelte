<script lang="ts">
  import "../app.css";
  let { children } = $props();
</script>

<div class="min-h-screen bg-[#faf7f2] text-[#3d2b1f]">
  {@render children()}
</div>
