<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { page } from "$app/stores";
  import {
    Background,
    BackgroundVariant,
    Controls,
    SvelteFlow,
  } from "@xyflow/svelte";
  import "@xyflow/svelte/dist/style.css";
  import { auth, events, templates } from "$lib/api/client";
  import TemplateLayerNode from "$lib/components/TemplateLayerNode.svelte";
  import type { EventTemplate, FramePreset, FrameToken, TemplateAsset, TemplateLayer, TemplateTransition, TransitionEasing } from "$lib/api/types";
  import { DEFAULT_FRAME_TOKEN, defaultFramePresets, frameTokenToInlineStyle, resolveLayerFrameToken } from "$lib/utils/frameToken";
  import { normalizeTransitionPreset } from "$lib/utils/slideshowTransition";
  import type { Node } from "@xyflow/svelte";

  const eventId = $derived($page.params.eventId ?? "");
  const ratioPresets = [
    { label: "16:9", width: 1920, height: 1080 },
    { label: "4:3", width: 1440, height: 1080 },
    { label: "1:1", width: 1080, height: 1080 },
    { label: "9:16", width: 1080, height: 1920 },
  ] as const;
  const transitionOptions: Array<{ value: TemplateTransition; label: string }> = [
    { value: "fade", label: "淡入淡出" },
    { value: "fade-scale", label: "淡入縮放" },
    { value: "slide", label: "滑動" },
    { value: "fade-soft", label: "柔和淡入" },
    { value: "slide-parallax", label: "視差滑動" },
    { value: "stack-flip", label: "堆疊翻頁" },
    { value: "kenburns", label: "Ken Burns" },
    { value: "ribbon-flow", label: "緞帶流動" },
  ];
  const transitionEasingOptions: Array<{ value: TransitionEasing; label: string }> = [
    { value: "ease", label: "ease" },
    { value: "ease-in-out", label: "ease-in-out" },
    { value: "ease-out", label: "ease-out" },
    { value: "ease-in", label: "ease-in" },
    { value: "linear", label: "linear" },
  ];

  type TemplateFlowNode = Node<{ layer: TemplateLayer; assetPreviewUrl?: string }, "template-layer">;

  let event = $state<any>({});
  let photos = $state<any[]>([]);
  let loading = $state(true);
  let saving = $state(false);
  let uploadingAsset = $state(false);
  let notice = $state("");
  let template = $state<EventTemplate | null>(null);
  let publishedTemplate = $state<EventTemplate | null>(null);
  let nodes = $state<TemplateFlowNode[]>([]);
  let selectedNodeId = $state<string | null>(null);
  let previewPhotoIndex = $state(0);
  let assetFileInput = $state<HTMLInputElement | null>(null);
  let framePresetDraftName = $state("自訂相框");

  const nodeTypes = {
    "template-layer": TemplateLayerNode,
  };

  onMount(() => {
    if (!auth.isLoggedIn()) {
      goto("/admin/login");
      return;
    }
    void loadData();
  });

  async function loadData() {
    loading = true;
    try {
      const [eventData, photoList, templateResult] = await Promise.all([
        events.get(eventId),
        events.photos(eventId),
        templates.get(eventId),
      ]);
      event = eventData;
      photos = photoList;
      template = templateResult.template;
      template = ensureFramePresets(template);
      publishedTemplate = templateResult.publishedTemplate ?? null;
      nodes = templateToNodes(template);
      previewPhotoIndex = 0;
      selectedNodeId = nodes[0]?.id ?? null;
    } catch (err: any) {
      notice = err?.message || "載入模板失敗";
    } finally {
      loading = false;
    }
  }

  function templateToNodes(source: EventTemplate): TemplateFlowNode[] {
    return source.layers
      .slice()
      .sort((a, b) => a.zIndex - b.zIndex)
      .map((layer) => {
        const assetPreviewUrl = source.assets.find((asset) => asset.assetId === layer.data.assetId || asset.key === layer.data.assetKey)?.previewUrl;
        return {
          id: layer.id,
          type: "template-layer",
          position: { x: layer.x, y: layer.y },
          data: { layer, assetPreviewUrl },
          draggable: !layer.locked,
          selectable: true,
          deletable: true,
          selected: false,
          dragging: false,
          style: `width:${layer.width}px;height:${layer.height}px;`,
        };
      });
  }

  function ensureFramePresets(source: EventTemplate): EventTemplate {
    if (source.framePresets && source.framePresets.length > 0) return source;
    return { ...source, framePresets: defaultFramePresets() };
  }

  function nodeToLayer(node: TemplateFlowNode): TemplateLayer {
    const fallback = node.data.layer;
    return {
      ...fallback,
      x: node.position.x,
      y: node.position.y,
      width: (node as any).width ?? fallback.width,
      height: (node as any).height ?? fallback.height,
      rotation: fallback.rotation,
      zIndex: fallback.zIndex,
      locked: fallback.locked,
      data: fallback.data,
    };
  }

  function rebuildTemplateFromNodes(nextNodes: TemplateFlowNode[] = nodes) {
    if (!template) return null;
    return {
      ...template,
      layers: nextNodes.map(nodeToLayer),
      framePresets: template.framePresets ?? defaultFramePresets(),
      updatedAt: new Date().toISOString(),
    };
  }

  function updateTemplateFromNodes(nextNodes: TemplateFlowNode[] = nodes) {
    const next = rebuildTemplateFromNodes(nextNodes);
    if (next) template = next;
  }

  function framePresets(): FramePreset[] {
    return template?.framePresets ?? defaultFramePresets();
  }

  function selectedFrameToken(layer: TemplateLayer): FrameToken {
    return resolveLayerFrameToken(layer.data, framePresets());
  }

  function updateSelectedFrameToken(mutator: (token: FrameToken) => FrameToken) {
    if (!selectedNode || selectedNode.data.layer.type !== "photo-frame") return;
    const nextToken = mutator(selectedFrameToken(selectedNode.data.layer));
    updateSelectedNode((current) => ({
      ...current,
      data: {
        ...current.data,
        frameTokenOverride: {
          borderWidth: nextToken.borderWidth,
          borderRadius: nextToken.borderRadius,
          padding: nextToken.padding,
          shadow: nextToken.shadow,
          color: nextToken.color,
          backgroundColor: nextToken.backgroundColor,
          gradient: nextToken.gradient,
          doubleBorder: nextToken.doubleBorder,
          texture: nextToken.texture,
          glow: nextToken.glow,
        },
        borderWidth: nextToken.borderWidth,
        borderRadius: nextToken.borderRadius,
        borderColor: nextToken.color,
        backgroundColor: nextToken.backgroundColor,
      },
    }));
  }

  function updateFramePresets(nextPresets: FramePreset[]) {
    if (!template) return;
    template = { ...template, framePresets: nextPresets, updatedAt: new Date().toISOString() };
  }

  function applyPresetToSelectedLayer(presetId: string) {
    if (!selectedNode || selectedNode.data.layer.type !== "photo-frame") return;
    const preset = framePresets().find((item) => item.id === presetId);
    if (!preset) return;
    updateSelectedNode((current) => ({
      ...current,
      data: {
        ...current.data,
        framePresetId: preset.id,
        frameTokenOverride: undefined,
        borderWidth: preset.token.borderWidth,
        borderRadius: preset.token.borderRadius,
        borderColor: preset.token.color,
        backgroundColor: preset.token.backgroundColor,
      },
    }));
  }

  function applyPresetToAllFrames(presetId: string) {
    const preset = framePresets().find((item) => item.id === presetId);
    if (!preset) return;
    nodes = nodes.map((node) => {
      if (node.data.layer.type !== "photo-frame") return node;
      return {
        ...node,
        data: {
          ...node.data,
          layer: {
            ...node.data.layer,
            data: {
              ...node.data.layer.data,
              framePresetId: preset.id,
              frameTokenOverride: undefined,
              borderWidth: preset.token.borderWidth,
              borderRadius: preset.token.borderRadius,
              borderColor: preset.token.color,
              backgroundColor: preset.token.backgroundColor,
            },
          },
        },
      };
    });
    updateTemplateFromNodes(nodes);
  }

  function saveCurrentFrameAsPreset() {
    if (!selectedNode || selectedNode.data.layer.type !== "photo-frame") return;
    const token = selectedFrameToken(selectedNode.data.layer);
    const preset: FramePreset = {
      id: crypto.randomUUID(),
      name: framePresetDraftName.trim() || "自訂相框",
      token,
    };
    updateFramePresets([...framePresets(), preset]);
    applyPresetToSelectedLayer(preset.id);
  }

  function findNode(id: string | null) {
    return id ? nodes.find((node) => node.id === id) ?? null : null;
  }

  const selectedNode = $derived(findNode(selectedNodeId));

  function updateSelectedNode(mutator: (layer: TemplateLayer) => TemplateLayer) {
    if (!selectedNodeId) return;
    nodes = nodes.map((node) => {
      if (node.id !== selectedNodeId) return node;
      const nextLayer = mutator(node.data.layer);
      return {
        ...node,
        data: {
          ...node.data,
          layer: nextLayer,
          assetPreviewUrl: resolveAssetPreviewUrl(nextLayer),
        },
        draggable: !nextLayer.locked,
        style: `width:${nextLayer.width}px;height:${nextLayer.height}px;`,
        position: { x: nextLayer.x, y: nextLayer.y },
      };
    });
    updateTemplateFromNodes(nodes);
  }

  function resolveAssetPreviewUrl(layer: TemplateLayer) {
    return template?.assets.find((asset) => asset.assetId === layer.data.assetId || asset.key === layer.data.assetKey)?.previewUrl;
  }

  function transitionLabel(value: TemplateTransition) {
    return transitionOptions.find((option) => option.value === value)?.label ?? value;
  }

  function addLayer(type: TemplateLayer["type"]) {
    if (!template) return;
    const nextId = crypto.randomUUID();
    const baseX = Math.max(40, Math.round(template.canvas.width * 0.1));
    const baseY = Math.max(40, Math.round(template.canvas.height * 0.1));
    const baseWidth = type === "text" ? 360 : type === "photo-frame" ? 600 : 220;
    const baseHeight = type === "text" ? 140 : type === "photo-frame" ? 420 : 220;
    const nextLayer: TemplateLayer = {
      id: nextId,
      type,
      x: baseX + nodes.length * 20,
      y: baseY + nodes.length * 20,
      width: baseWidth,
      height: baseHeight,
      rotation: 0,
      zIndex: nodes.length + 1,
      locked: false,
      data:
        type === "text"
          ? { text: "新文字", fontSize: 28, color: "#ffffff", align: "center" }
          : type === "decorative-asset"
            ? { assetFit: "contain", opacity: 1, assetId: "", assetKey: "" }
            : {
                framePresetId: framePresets()[0]?.id,
                borderWidth: DEFAULT_FRAME_TOKEN.borderWidth,
                borderColor: DEFAULT_FRAME_TOKEN.color,
                borderRadius: DEFAULT_FRAME_TOKEN.borderRadius,
                backgroundColor: DEFAULT_FRAME_TOKEN.backgroundColor,
                frameTokenOverride: { ...DEFAULT_FRAME_TOKEN },
              },
    };
    const nextNode: TemplateFlowNode = {
      id: nextId,
      type: "template-layer",
      position: { x: nextLayer.x, y: nextLayer.y },
      data: { layer: nextLayer },
      draggable: true,
      selectable: true,
      deletable: true,
      selected: false,
      dragging: false,
      style: `width:${nextLayer.width}px;height:${nextLayer.height}px;`,
    };
    nodes = [...nodes, nextNode];
    selectedNodeId = nextId;
    updateTemplateFromNodes(nodes);
  }

  function deleteSelectedLayer() {
    if (!selectedNodeId) return;
    nodes = nodes.filter((node) => node.id !== selectedNodeId);
    selectedNodeId = nodes[0]?.id ?? null;
    updateTemplateFromNodes(nodes);
  }

  function setCanvasPreset(width: number, height: number) {
    if (!template) return;
    template = {
      ...template,
      canvas: { width, height },
      updatedAt: new Date().toISOString(),
    };
  }

  function getPreviewPhoto() {
    return photos[previewPhotoIndex] ?? null;
  }

  function cyclePreview(delta: number) {
    if (photos.length === 0) return;
    previewPhotoIndex = (previewPhotoIndex + delta + photos.length) % photos.length;
  }

  async function uploadAsset(file: File) {
    if (!template) return;
    uploadingAsset = true;
    notice = "";
    try {
      const { assetId, assetKey, uploadUrl } = await templates.presignAsset(eventId, file.name, file.type || "image/png");
      const xhr = new XMLHttpRequest();
      await new Promise<void>((resolve, reject) => {
        xhr.open("PUT", uploadUrl);
        xhr.setRequestHeader("Content-Type", file.type || "image/png");
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error(`素材上傳失敗 (${xhr.status})`));
        };
        xhr.onerror = () => reject(new Error("素材上傳失敗"));
        xhr.send(file);
      });
      const result = await templates.confirmAsset(eventId, assetId, file.name, file.type || "image/png", assetKey);
      const ensuredTemplate = ensureFramePresets(result.template);
      template = ensuredTemplate;
      nodes = nodes.map((node) => ({
        ...node,
        data: {
          ...node.data,
          assetPreviewUrl: ensuredTemplate.assets.find((asset) => asset.assetId === node.data.layer.data.assetId || asset.key === node.data.layer.data.assetKey)?.previewUrl,
        },
      }));
      updateTemplateFromNodes(nodes);
      notice = "裝飾素材已上傳";
    } catch (err: any) {
      notice = err?.message || "素材上傳失敗";
    } finally {
      uploadingAsset = false;
      if (assetFileInput) assetFileInput.value = "";
    }
  }

  async function saveTemplate(publish = false) {
    if (!template) return;
    saving = true;
    notice = "";
    try {
      const payload = rebuildTemplateFromNodes(nodes);
      if (!payload) return;
      const result = await templates.save(eventId, payload, publish);
      template = ensureFramePresets(result.template);
      publishedTemplate = result.publishedTemplate ?? (publish ? result.template : publishedTemplate);
      nodes = templateToNodes(template);
      selectedNodeId = nodes[0]?.id ?? null;
      notice = publish ? "模板已發布" : "模板已儲存";
    } catch (err: any) {
      notice = err?.message || "儲存失敗";
    } finally {
      saving = false;
    }
  }

  function assetLibrary() {
    return template?.assets ?? [];
  }

  function insertAssetLayer(asset: TemplateAsset) {
    const nextId = crypto.randomUUID();
    const layer: TemplateLayer = {
      id: nextId,
      type: "decorative-asset",
      x: Math.max(30, Math.round((template?.canvas.width ?? 1920) * 0.12)),
      y: Math.max(30, Math.round((template?.canvas.height ?? 1080) * 0.12)),
      width: 220,
      height: 220,
      rotation: 0,
      zIndex: nodes.length + 1,
      locked: false,
      data: { assetId: asset.assetId, assetKey: asset.key, assetFit: "contain", opacity: 1 },
    };
    const node: TemplateFlowNode = {
      id: nextId,
      type: "template-layer",
      position: { x: layer.x, y: layer.y },
      data: { layer, assetPreviewUrl: asset.previewUrl },
      draggable: true,
      selectable: true,
      deletable: true,
      selected: false,
      dragging: false,
      style: `width:${layer.width}px;height:${layer.height}px;`,
    };
    nodes = [...nodes, node];
    selectedNodeId = nextId;
    updateTemplateFromNodes(nodes);
  }

  function selectPreset(preset: typeof ratioPresets[number]) {
    setCanvasPreset(preset.width, preset.height);
  }

  function updateCanvasWidth(value: number) {
    if (!template) return;
    template = { ...template, canvas: { ...template.canvas, width: value }, updatedAt: new Date().toISOString() };
  }

  function updateCanvasHeight(value: number) {
    if (!template) return;
    template = { ...template, canvas: { ...template.canvas, height: value }, updatedAt: new Date().toISOString() };
  }

  function updatePlaybackTransition(value: TemplateTransition) {
    if (!template) return;
    template = {
      ...template,
      playback: { ...template.playback, transition: normalizeTransitionPreset(value) },
      updatedAt: new Date().toISOString(),
    };
  }

  function updatePlaybackInterval(value: number) {
    if (!template) return;
    template = { ...template, playback: { ...template.playback, intervalSeconds: value }, updatedAt: new Date().toISOString() };
  }

  function updatePlaybackTransitionSeconds(value: number) {
    if (!template) return;
    template = { ...template, playback: { ...template.playback, transitionSeconds: value }, updatedAt: new Date().toISOString() };
  }

  function updateTransitionDurationMs(value: number) {
    if (!template) return;
    template = {
      ...template,
      playback: {
        ...template.playback,
        transitionConfig: {
          ...template.playback.transitionConfig,
          durationMs: value,
        },
      },
      updatedAt: new Date().toISOString(),
    };
  }

  function updateTransitionEasing(value: TransitionEasing) {
    if (!template) return;
    template = {
      ...template,
      playback: {
        ...template.playback,
        transitionConfig: {
          ...template.playback.transitionConfig,
          easing: value,
        },
      },
      updatedAt: new Date().toISOString(),
    };
  }

  function updateTransitionStaggerMs(value: number) {
    if (!template) return;
    template = {
      ...template,
      playback: {
        ...template.playback,
        transitionConfig: {
          ...template.playback.transitionConfig,
          staggerMs: value,
        },
      },
      updatedAt: new Date().toISOString(),
    };
  }
</script>

<div class="max-w-[1400px] mx-auto px-4 py-6 space-y-4">
  <div class="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
    <div>
      <a href="/admin/event/{eventId}" class="text-sm text-[#8b7355] hover:text-[#3d2b1f]">← 返回活動管理</a>
      <h1 class="text-3xl font-bold mt-2">{event.name ?? "婚禮模板編輯器"}</h1>
      {#if event.date}
        <p class="text-sm text-[#8b7355] mt-1">{event.date}</p>
      {/if}
    </div>
    <div class="flex flex-wrap items-center gap-2">
      <button
        onclick={() => void saveTemplate(false)}
        disabled={saving || loading}
        class="px-4 py-2 rounded-lg border border-[#e8d5c4] bg-white text-sm font-semibold hover:bg-[#fff8ef] disabled:opacity-50"
      >
        {saving ? "儲存中..." : "儲存草稿"}
      </button>
      <button
        onclick={() => void saveTemplate(true)}
        disabled={saving || loading}
        class="px-4 py-2 rounded-lg bg-[#3d2b1f] text-amber-200 text-sm font-semibold hover:text-white disabled:opacity-50"
      >
        發布模板
      </button>
    </div>
  </div>

  {#if notice}
    <div class="text-sm px-4 py-3 rounded-xl border border-[#e8d5c4] bg-white shadow-sm">{notice}</div>
  {/if}

  {#if loading || !template}
    <div class="text-center py-16 text-[#8b7355]">載入中...</div>
  {:else}
    <div class="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.65fr)] items-start">
      <div class="space-y-4">
        <div class="bg-white rounded-2xl p-4 shadow-sm border border-[#e8d5c4]">
          <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h2 class="text-sm font-bold text-[#8b7355] uppercase tracking-wider">畫布設定</h2>
              <p class="text-xs text-gray-500 mt-1">選比例、調畫布尺寸、設定輪播節奏</p>
            </div>
            <div class="flex flex-wrap gap-2">
              {#each ratioPresets as preset}
                <button
                  onclick={() => selectPreset(preset)}
                  class="px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors {template.canvas.width === preset.width && template.canvas.height === preset.height ? 'bg-[#3d2b1f] text-white border-[#3d2b1f]' : 'bg-white border-[#e8d5c4] text-[#3d2b1f] hover:bg-[#fff8ef]'}"
                >
                  {preset.label}
                </button>
              {/each}
            </div>
          </div>

          <div class="grid gap-3 md:grid-cols-4">
            <label class="space-y-1">
              <span class="text-xs text-[#8b7355] font-semibold">寬度</span>
              <input
                type="number"
                min="320"
                max="6000"
                value={template.canvas.width}
                oninput={(e) => updateCanvasWidth(Number((e.currentTarget as HTMLInputElement).value))}
                class="w-full px-3 py-2 rounded-lg border border-[#e8d5c4] bg-white"
              />
            </label>
            <label class="space-y-1">
              <span class="text-xs text-[#8b7355] font-semibold">高度</span>
              <input
                type="number"
                min="240"
                max="6000"
                value={template.canvas.height}
                oninput={(e) => updateCanvasHeight(Number((e.currentTarget as HTMLInputElement).value))}
                class="w-full px-3 py-2 rounded-lg border border-[#e8d5c4] bg-white"
              />
            </label>
            <label class="space-y-1">
              <span class="text-xs text-[#8b7355] font-semibold">輪播動畫</span>
              <select
                value={template.playback.transition}
                onchange={(e) => updatePlaybackTransition((e.currentTarget as HTMLSelectElement).value as TemplateTransition)}
                class="w-full px-3 py-2 rounded-lg border border-[#e8d5c4] bg-white"
              >
                {#each transitionOptions as option}
                  <option value={option.value}>{option.label}</option>
                {/each}
              </select>
            </label>
            <label class="space-y-1">
              <span class="text-xs text-[#8b7355] font-semibold">每張間隔(秒)</span>
              <input
                type="number"
                min="1"
                max="60"
                value={template.playback.intervalSeconds}
                oninput={(e) => updatePlaybackInterval(Number((e.currentTarget as HTMLInputElement).value))}
                class="w-full px-3 py-2 rounded-lg border border-[#e8d5c4] bg-white"
              />
            </label>
          </div>
          <div class="mt-3 grid gap-3 md:grid-cols-3">
            <label class="space-y-1">
              <span class="text-xs text-[#8b7355] font-semibold">轉場時間(秒)</span>
              <input
                type="number"
                min="0"
                max="5"
                step="0.1"
                value={template.playback.transitionSeconds}
                oninput={(e) => updatePlaybackTransitionSeconds(Number((e.currentTarget as HTMLInputElement).value))}
                class="w-full px-3 py-2 rounded-lg border border-[#e8d5c4] bg-white"
              />
            </label>
            <label class="space-y-1">
              <span class="text-xs text-[#8b7355] font-semibold">Duration (ms)</span>
              <input
                type="number"
                min="120"
                max="5000"
                step="10"
                value={template.playback.transitionConfig?.durationMs ?? Math.round(template.playback.transitionSeconds * 1000)}
                oninput={(e) => updateTransitionDurationMs(Number((e.currentTarget as HTMLInputElement).value))}
                class="w-full px-3 py-2 rounded-lg border border-[#e8d5c4] bg-white"
              />
            </label>
            <label class="space-y-1">
              <span class="text-xs text-[#8b7355] font-semibold">Stagger (ms)</span>
              <input
                type="number"
                min="0"
                max="2000"
                step="10"
                value={template.playback.transitionConfig?.staggerMs ?? 0}
                oninput={(e) => updateTransitionStaggerMs(Number((e.currentTarget as HTMLInputElement).value))}
                class="w-full px-3 py-2 rounded-lg border border-[#e8d5c4] bg-white"
              />
            </label>
          </div>
          <label class="block mt-3 space-y-1 max-w-sm">
            <span class="text-xs text-[#8b7355] font-semibold">Easing</span>
            <select
              value={template.playback.transitionConfig?.easing ?? "ease"}
              onchange={(e) => updateTransitionEasing((e.currentTarget as HTMLSelectElement).value as TransitionEasing)}
              class="w-full px-3 py-2 rounded-lg border border-[#e8d5c4] bg-white"
            >
              {#each transitionEasingOptions as option}
                <option value={option.value}>{option.label}</option>
              {/each}
            </select>
          </label>
        </div>

        <div class="bg-white rounded-2xl p-4 shadow-sm border border-[#e8d5c4]">
          <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h2 class="text-sm font-bold text-[#8b7355] uppercase tracking-wider">模板編輯</h2>
              <p class="text-xs text-gray-500 mt-1">拖曳、縮放、選取後在右側編輯</p>
            </div>
            <div class="flex flex-wrap gap-2">
              <button onclick={() => addLayer("photo-frame")} class="px-3 py-1.5 rounded-full text-xs font-semibold border border-[#e8d5c4] bg-white hover:bg-[#fff8ef]">+ 相框</button>
              <button onclick={() => addLayer("text")} class="px-3 py-1.5 rounded-full text-xs font-semibold border border-[#e8d5c4] bg-white hover:bg-[#fff8ef]">+ 文字</button>
            </div>
          </div>

          <div
            class="relative overflow-hidden rounded-2xl border border-[#e8d5c4] bg-[#221912] shadow-inner"
            style={`aspect-ratio: ${template.canvas.width} / ${template.canvas.height};`}
          >
            <SvelteFlow
              nodes={nodes}
              edges={[]}
              nodeTypes={nodeTypes}
              fitView
              nodesDraggable
              nodesConnectable={false}
              elementsSelectable
              onnodeclick={({ node }) => {
                selectedNodeId = node.id;
              }}
              onnodedragstop={({ targetNode }) => {
                if (!targetNode) return;
                nodes = nodes.map((item) => (item.id === targetNode.id ? { ...item, position: targetNode.position } : item));
                updateTemplateFromNodes(nodes);
              }}
              onpaneclick={() => {
                selectedNodeId = null;
              }}
            >
              <Background variant={BackgroundVariant.Dots} gap={18} size={1} bgColor="transparent" patternColor="rgba(255,255,255,0.2)" />
              <Controls />
            </SvelteFlow>
          </div>
        </div>
      </div>

      <div class="space-y-4">
        <div class="bg-white rounded-2xl p-4 shadow-sm border border-[#e8d5c4]">
          <h2 class="text-sm font-bold text-[#8b7355] uppercase tracking-wider">檢視與素材</h2>
          <p class="text-xs text-gray-500 mt-1">預覽真實照片與上傳裝飾元素</p>

          <div class="mt-4 rounded-2xl overflow-hidden border border-[#e8d5c4] bg-[#1b130d]">
            <div class="relative w-full" style={`aspect-ratio: ${template.canvas.width} / ${template.canvas.height};`}>
              {#if getPreviewPhoto()}
                <img src={getPreviewPhoto().presignedUrl} alt={getPreviewPhoto().nickname} class="absolute inset-0 w-full h-full object-cover opacity-65" />
              {:else}
                <div class="absolute inset-0 flex items-center justify-center text-white/70 text-sm">尚未有可預覽照片</div>
              {/if}

              {#each nodes.slice().sort((a, b) => a.data.layer.zIndex - b.data.layer.zIndex) as node (node.id)}
                {@const layer = node.data.layer}
                <div class="absolute rounded-lg overflow-hidden" style={`left:${layer.x}px;top:${layer.y}px;width:${layer.width}px;height:${layer.height}px;transform:rotate(${layer.rotation}deg);z-index:${layer.zIndex};opacity:${layer.data.opacity ?? 1};`}>
                  {#if layer.type === "decorative-asset" && node.data.assetPreviewUrl}
                    <img src={node.data.assetPreviewUrl} alt={layer.data.text ?? "decorative"} class="w-full h-full object-contain" />
                  {:else if layer.type === "text"}
                    <div class="w-full h-full flex items-center justify-center p-4 text-center" style={`background:${layer.data.backgroundColor ?? "rgba(0,0,0,0.15)"};color:${layer.data.color ?? "#fff"};`}>
                      <span style={`font-size:${layer.data.fontSize ?? 24}px;text-align:${layer.data.align ?? "center"};`}>{layer.data.text ?? "文字"}</span>
                    </div>
                  {:else}
                    <div class="w-full h-full rounded-[inherit]" style={frameTokenToInlineStyle(resolveLayerFrameToken(layer.data, framePresets()))}></div>
                  {/if}
                </div>
              {/each}
            </div>
          </div>

          <div class="mt-3 flex items-center justify-between gap-2">
            <button onclick={() => cyclePreview(-1)} class="px-3 py-1.5 rounded-lg border border-[#e8d5c4] text-xs font-semibold">上一張</button>
            <div class="text-xs text-[#8b7355]">預覽照片 {photos.length > 0 ? previewPhotoIndex + 1 : 0} / {photos.length}</div>
            <button onclick={() => cyclePreview(1)} class="px-3 py-1.5 rounded-lg border border-[#e8d5c4] text-xs font-semibold">下一張</button>
          </div>
        </div>

        <div class="bg-white rounded-2xl p-4 shadow-sm border border-[#e8d5c4]">
          <div class="flex items-center justify-between gap-2">
            <div>
              <h2 class="text-sm font-bold text-[#8b7355] uppercase tracking-wider">裝飾素材</h2>
              <p class="text-xs text-gray-500 mt-1">上傳圖片後可插入到模板</p>
            </div>
            <label class="px-3 py-1.5 rounded-full text-xs font-semibold border border-[#e8d5c4] bg-white hover:bg-[#fff8ef] cursor-pointer">
              上傳素材
              <input
                bind:this={assetFileInput}
                type="file"
                accept="image/*"
                class="hidden"
                onchange={(e) => {
                  const file = (e.currentTarget as HTMLInputElement).files?.[0];
                  if (file) void uploadAsset(file);
                }}
              />
            </label>
          </div>

          {#if uploadingAsset}
            <p class="mt-3 text-xs text-[#8b7355]">素材上傳中...</p>
          {/if}

          <div class="mt-3 grid grid-cols-2 gap-2">
            {#each assetLibrary() as asset (asset.assetId)}
              <div class="rounded-xl border border-[#e8d5c4] overflow-hidden bg-[#faf7f2]">
                <div class="aspect-square bg-black/5">
                  {#if asset.previewUrl}
                    <img src={asset.previewUrl} alt={asset.filename} class="w-full h-full object-cover" />
                  {/if}
                </div>
                <div class="p-2 space-y-2">
                  <p class="text-[11px] truncate">{asset.filename}</p>
                  <button
                    onclick={() => insertAssetLayer(asset)}
                    class="w-full text-[11px] py-1.5 rounded-md bg-[#3d2b1f] text-white font-semibold"
                  >
                    插入模板
                  </button>
                </div>
              </div>
            {/each}
          </div>
        </div>
      </div>
    </div>

    <div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div class="bg-white rounded-2xl p-4 shadow-sm border border-[#e8d5c4]">
        <h2 class="text-sm font-bold text-[#8b7355] uppercase tracking-wider">已選取圖層</h2>
        {#if selectedNode}
          {@const layer = selectedNode.data.layer}
          <div class="mt-3 grid gap-3 md:grid-cols-2">
            <label class="space-y-1">
              <span class="text-xs text-[#8b7355] font-semibold">X</span>
              <input type="number" value={layer.x} oninput={(e) => updateSelectedNode((current) => ({ ...current, x: Number((e.currentTarget as HTMLInputElement).value) }))} class="w-full px-3 py-2 rounded-lg border border-[#e8d5c4]" />
            </label>
            <label class="space-y-1">
              <span class="text-xs text-[#8b7355] font-semibold">Y</span>
              <input type="number" value={layer.y} oninput={(e) => updateSelectedNode((current) => ({ ...current, y: Number((e.currentTarget as HTMLInputElement).value) }))} class="w-full px-3 py-2 rounded-lg border border-[#e8d5c4]" />
            </label>
            <label class="space-y-1">
              <span class="text-xs text-[#8b7355] font-semibold">寬度</span>
              <input type="number" value={layer.width} oninput={(e) => updateSelectedNode((current) => ({ ...current, width: Number((e.currentTarget as HTMLInputElement).value) }))} class="w-full px-3 py-2 rounded-lg border border-[#e8d5c4]" />
            </label>
            <label class="space-y-1">
              <span class="text-xs text-[#8b7355] font-semibold">高度</span>
              <input type="number" value={layer.height} oninput={(e) => updateSelectedNode((current) => ({ ...current, height: Number((e.currentTarget as HTMLInputElement).value) }))} class="w-full px-3 py-2 rounded-lg border border-[#e8d5c4]" />
            </label>
            <label class="space-y-1">
              <span class="text-xs text-[#8b7355] font-semibold">旋轉</span>
              <input type="number" value={layer.rotation} oninput={(e) => updateSelectedNode((current) => ({ ...current, rotation: Number((e.currentTarget as HTMLInputElement).value) }))} class="w-full px-3 py-2 rounded-lg border border-[#e8d5c4]" />
            </label>
            <label class="space-y-1">
              <span class="text-xs text-[#8b7355] font-semibold">圖層順序</span>
              <input type="number" value={layer.zIndex} oninput={(e) => updateSelectedNode((current) => ({ ...current, zIndex: Number((e.currentTarget as HTMLInputElement).value) }))} class="w-full px-3 py-2 rounded-lg border border-[#e8d5c4]" />
            </label>
          </div>

          <div class="mt-3 flex flex-wrap gap-2">
            <button
              onclick={() => updateSelectedNode((current) => ({ ...current, locked: !current.locked }))}
              class="px-3 py-1.5 rounded-lg border border-[#e8d5c4] text-xs font-semibold"
            >
              {layer.locked ? "解除鎖定" : "鎖定圖層"}
            </button>
            <button
              onclick={() => {
                const max = Math.max(...nodes.map((node) => node.data.layer.zIndex), 0) + 1;
                updateSelectedNode((current) => ({ ...current, zIndex: max }));
                nodes = [...nodes].sort((a, b) => (a.id === selectedNodeId ? max : a.data.layer.zIndex) - (b.id === selectedNodeId ? max : b.data.layer.zIndex));
              }}
              class="px-3 py-1.5 rounded-lg border border-[#e8d5c4] text-xs font-semibold"
            >
              移到最上層
            </button>
            <button onclick={deleteSelectedLayer} class="px-3 py-1.5 rounded-lg border border-red-200 text-xs font-semibold text-red-600">刪除圖層</button>
          </div>

          {#if layer.type === "text"}
            <div class="mt-4 space-y-3">
              <label class="block space-y-1">
                <span class="text-xs text-[#8b7355] font-semibold">文字內容</span>
                <input
                  value={layer.data.text ?? ""}
                  oninput={(e) => updateSelectedNode((current) => ({ ...current, data: { ...current.data, text: (e.currentTarget as HTMLInputElement).value } }))}
                  class="w-full px-3 py-2 rounded-lg border border-[#e8d5c4]"
                />
              </label>
              <div class="grid gap-3 md:grid-cols-3">
                <label class="space-y-1">
                  <span class="text-xs text-[#8b7355] font-semibold">字體大小</span>
                  <input type="number" value={layer.data.fontSize ?? 28} oninput={(e) => updateSelectedNode((current) => ({ ...current, data: { ...current.data, fontSize: Number((e.currentTarget as HTMLInputElement).value) } }))} class="w-full px-3 py-2 rounded-lg border border-[#e8d5c4]" />
                </label>
                <label class="space-y-1">
                  <span class="text-xs text-[#8b7355] font-semibold">顏色</span>
                  <input type="text" value={layer.data.color ?? "#ffffff"} oninput={(e) => updateSelectedNode((current) => ({ ...current, data: { ...current.data, color: (e.currentTarget as HTMLInputElement).value } }))} class="w-full px-3 py-2 rounded-lg border border-[#e8d5c4]" />
                </label>
                <label class="space-y-1">
                  <span class="text-xs text-[#8b7355] font-semibold">對齊</span>
                  <select value={layer.data.align ?? "center"} onchange={(e) => updateSelectedNode((current) => ({ ...current, data: { ...current.data, align: (e.currentTarget as HTMLSelectElement).value as "left" | "center" | "right" } }))} class="w-full px-3 py-2 rounded-lg border border-[#e8d5c4]">
                    <option value="left">左</option>
                    <option value="center">中</option>
                    <option value="right">右</option>
                  </select>
                </label>
              </div>
            </div>
          {/if}

          {#if layer.type === "decorative-asset"}
            <div class="mt-4 space-y-3">
              <label class="block space-y-1">
                <span class="text-xs text-[#8b7355] font-semibold">選擇素材</span>
                <select
                  value={layer.data.assetId ?? ""}
                  onchange={(e) => {
                    const asset = assetLibrary().find((item) => item.assetId === (e.currentTarget as HTMLSelectElement).value);
                    if (!asset) return;
                    updateSelectedNode((current) => ({
                      ...current,
                      data: { ...current.data, assetId: asset.assetId, assetKey: asset.key },
                    }));
                  }}
                  class="w-full px-3 py-2 rounded-lg border border-[#e8d5c4]"
                >
                  <option value="">請選擇</option>
                  {#each assetLibrary() as asset}
                    <option value={asset.assetId}>{asset.filename}</option>
                  {/each}
                </select>
              </label>
              <label class="block space-y-1">
                <span class="text-xs text-[#8b7355] font-semibold">透明度</span>
                <input type="range" min="0" max="1" step="0.05" value={layer.data.opacity ?? 1} oninput={(e) => updateSelectedNode((current) => ({ ...current, data: { ...current.data, opacity: Number((e.currentTarget as HTMLInputElement).value) } }))} class="w-full" />
              </label>
            </div>
          {/if}

          {#if layer.type === "photo-frame"}
            <div class="mt-4 space-y-3">
              <div class="grid gap-3 md:grid-cols-3">
                <label class="space-y-1">
                  <span class="text-xs text-[#8b7355] font-semibold">Preset</span>
                  <select
                    value={layer.data.framePresetId ?? ""}
                    onchange={(e) => applyPresetToSelectedLayer((e.currentTarget as HTMLSelectElement).value)}
                    class="w-full px-3 py-2 rounded-lg border border-[#e8d5c4]"
                  >
                    <option value="">自訂</option>
                    {#each framePresets() as preset}
                      <option value={preset.id}>{preset.name}</option>
                    {/each}
                  </select>
                </label>
                <label class="space-y-1">
                  <span class="text-xs text-[#8b7355] font-semibold">新 preset 名稱</span>
                  <input type="text" bind:value={framePresetDraftName} class="w-full px-3 py-2 rounded-lg border border-[#e8d5c4]" />
                </label>
                <div class="flex items-end gap-2">
                  <button onclick={saveCurrentFrameAsPreset} class="px-3 py-2 rounded-lg border border-[#e8d5c4] text-xs font-semibold">儲存為 preset</button>
                  <button onclick={() => applyPresetToAllFrames(layer.data.framePresetId ?? framePresets()[0]?.id ?? "")} class="px-3 py-2 rounded-lg border border-[#e8d5c4] text-xs font-semibold">套用到全部相框</button>
                </div>
              </div>
              <div class="grid gap-3 md:grid-cols-3">
                <label class="space-y-1">
                  <span class="text-xs text-[#8b7355] font-semibold">邊框寬度</span>
                  <input type="number" value={selectedFrameToken(layer).borderWidth} oninput={(e) => updateSelectedFrameToken((t) => ({ ...t, borderWidth: Number((e.currentTarget as HTMLInputElement).value) }))} class="w-full px-3 py-2 rounded-lg border border-[#e8d5c4]" />
                </label>
                <label class="space-y-1">
                  <span class="text-xs text-[#8b7355] font-semibold">邊框顏色</span>
                  <input type="text" value={selectedFrameToken(layer).color} oninput={(e) => updateSelectedFrameToken((t) => ({ ...t, color: (e.currentTarget as HTMLInputElement).value }))} class="w-full px-3 py-2 rounded-lg border border-[#e8d5c4]" />
                </label>
                <label class="space-y-1">
                  <span class="text-xs text-[#8b7355] font-semibold">圓角</span>
                  <input type="number" value={selectedFrameToken(layer).borderRadius} oninput={(e) => updateSelectedFrameToken((t) => ({ ...t, borderRadius: Number((e.currentTarget as HTMLInputElement).value) }))} class="w-full px-3 py-2 rounded-lg border border-[#e8d5c4]" />
                </label>
                <label class="space-y-1">
                  <span class="text-xs text-[#8b7355] font-semibold">內距</span>
                  <input type="number" value={selectedFrameToken(layer).padding} oninput={(e) => updateSelectedFrameToken((t) => ({ ...t, padding: Number((e.currentTarget as HTMLInputElement).value) }))} class="w-full px-3 py-2 rounded-lg border border-[#e8d5c4]" />
                </label>
                <label class="space-y-1 md:col-span-2">
                  <span class="text-xs text-[#8b7355] font-semibold">陰影</span>
                  <input type="text" value={selectedFrameToken(layer).shadow} oninput={(e) => updateSelectedFrameToken((t) => ({ ...t, shadow: (e.currentTarget as HTMLInputElement).value }))} class="w-full px-3 py-2 rounded-lg border border-[#e8d5c4]" />
                </label>
                <label class="space-y-1 md:col-span-2">
                  <span class="text-xs text-[#8b7355] font-semibold">漸層背景</span>
                  <input type="text" value={selectedFrameToken(layer).gradient ?? ""} placeholder="linear-gradient(...)" oninput={(e) => updateSelectedFrameToken((t) => ({ ...t, gradient: (e.currentTarget as HTMLInputElement).value || undefined }))} class="w-full px-3 py-2 rounded-lg border border-[#e8d5c4]" />
                </label>
                <label class="space-y-1">
                  <span class="text-xs text-[#8b7355] font-semibold">發光</span>
                  <input type="text" value={selectedFrameToken(layer).glow ?? ""} oninput={(e) => updateSelectedFrameToken((t) => ({ ...t, glow: (e.currentTarget as HTMLInputElement).value || undefined }))} class="w-full px-3 py-2 rounded-lg border border-[#e8d5c4]" />
                </label>
                <label class="space-y-1">
                  <span class="text-xs text-[#8b7355] font-semibold">紋理</span>
                  <select value={selectedFrameToken(layer).texture ?? ""} onchange={(e) => updateSelectedFrameToken((t) => ({ ...t, texture: (e.currentTarget as HTMLSelectElement).value || undefined }))} class="w-full px-3 py-2 rounded-lg border border-[#e8d5c4]">
                    <option value="">無</option>
                    <option value="paper">paper</option>
                  </select>
                </label>
                <label class="space-y-1 flex items-center gap-2 mt-5">
                  <input type="checkbox" checked={selectedFrameToken(layer).doubleBorder ?? false} onchange={(e) => updateSelectedFrameToken((t) => ({ ...t, doubleBorder: (e.currentTarget as HTMLInputElement).checked }))} />
                  <span class="text-xs text-[#8b7355] font-semibold">雙層邊框</span>
                </label>
              </div>
            </div>
          {/if}
        {:else}
          <p class="mt-3 text-sm text-[#8b7355]">點選畫布中的圖層後，可以在這裡調整細節。</p>
        {/if}
      </div>

      <div class="bg-white rounded-2xl p-4 shadow-sm border border-[#e8d5c4]">
        <h2 class="text-sm font-bold text-[#8b7355] uppercase tracking-wider">發布狀態</h2>
        <div class="mt-3 space-y-2 text-sm">
          <p>草稿圖層：{nodes.length}</p>
          <p>已發布：{publishedTemplate ? "是" : "否"}</p>
          <p>動畫：{transitionLabel(template.playback.transition)}</p>
          <p>間隔：{template.playback.intervalSeconds} 秒</p>
        </div>
        <div class="mt-4 grid gap-2">
          <button onclick={() => addLayer("decorative-asset")} class="px-3 py-2 rounded-lg border border-[#e8d5c4] text-sm font-semibold">+ 空白裝飾層</button>
          <button onclick={() => deleteSelectedLayer()} class="px-3 py-2 rounded-lg border border-red-200 text-sm font-semibold text-red-600">刪除目前圖層</button>
        </div>
      </div>
    </div>
  {/if}
</div>
