<script lang="ts">
  import { NodeResizer } from "@xyflow/svelte";
  import type { NodeProps } from "@xyflow/svelte";
  import type { TemplateLayer } from "$lib/api/types";

  let {
    id,
    data,
    selected = false,
    dragging = false,
  }: NodeProps & { data: { layer: TemplateLayer; assetPreviewUrl?: string } } = $props();

  const layer = $derived(data.layer);
  const assetPreviewUrl = $derived(data.assetPreviewUrl);
</script>

<NodeResizer nodeId={id} isVisible={selected} minWidth={80} minHeight={60} />

<div
  class={`w-full h-full rounded-lg overflow-hidden border shadow-sm relative ${selected ? "border-[#d4a373]" : "border-white/30"} ${dragging ? "opacity-80" : ""}`}
  style={`background:${layer.data.backgroundColor ?? "rgba(255,255,255,0.08)"};`}
>
  {#if layer.type === "decorative-asset" && assetPreviewUrl}
    <img src={assetPreviewUrl} alt={layer.data.text ?? "decorative asset"} class="w-full h-full object-cover" />
  {:else if layer.type === "text"}
    <div class="w-full h-full flex items-center justify-center p-3 text-center" style={`color:${layer.data.color ?? "#ffffff"};`}>
      <div class="space-y-1">
        <p class="text-[10px] uppercase tracking-[0.25em] opacity-70">Text</p>
        <p class="font-semibold" style={`font-size:${layer.data.fontSize ?? 18}px; text-align:${layer.data.align ?? "center"};`}>
          {layer.data.text ?? "文字"}
        </p>
      </div>
    </div>
  {:else}
    <div class="w-full h-full flex items-center justify-center p-2">
      <div class="w-full h-full rounded-[inherit] border-2 border-dashed border-white/45 flex items-center justify-center text-white/90 text-xs font-semibold bg-black/10">
        相框
      </div>
    </div>
  {/if}

  <div class="absolute inset-x-0 bottom-0 px-2 py-1 bg-black/50 text-[10px] text-white flex items-center justify-between gap-2">
    <span class="truncate">{layer.type}</span>
    {#if layer.locked}
      <span>鎖定</span>
    {/if}
  </div>
</div>
