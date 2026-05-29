export type TemplateTransition = "fade" | "fade-scale" | "slide";
export type TemplateLayerType = "photo-frame" | "text" | "decorative-asset";

export type TemplateCanvas = {
  width: number;
  height: number;
};

export type TemplatePlayback = {
  transition: TemplateTransition;
  intervalSeconds: number;
  transitionSeconds: number;
};

export type TemplateAsset = {
  assetId: string;
  filename: string;
  contentType: string;
  key: string;
  uploadedAt: string;
};

export type TemplateLayerData = {
  text?: string;
  fontSize?: number;
  color?: string;
  align?: "left" | "center" | "right";
  assetId?: string;
  assetKey?: string;
  assetFit?: "cover" | "contain";
  opacity?: number;
  borderWidth?: number;
  borderColor?: string;
  borderRadius?: number;
  backgroundColor?: string;
};

export type TemplateLayer = {
  id: string;
  type: TemplateLayerType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  zIndex: number;
  locked: boolean;
  data: TemplateLayerData;
};

export type EventTemplate = {
  canvas: TemplateCanvas;
  playback: TemplatePlayback;
  layers: TemplateLayer[];
  assets: TemplateAsset[];
  updatedAt: string;
};

export type EventTemplateSnapshot = EventTemplate & {
  published: boolean;
};

const DEFAULT_TRANSITION: TemplateTransition = "fade";
const DEFAULT_INTERVAL_SECONDS = 8;
const DEFAULT_TRANSITION_SECONDS = 0.5;
const DEFAULT_CANVAS = { width: 1920, height: 1080 };
const MAX_DIMENSION = 10000;
const MAX_LAYER_COUNT = 100;
const MAX_ASSET_COUNT = 100;

export function defaultTemplate(): EventTemplate {
  return {
    canvas: { ...DEFAULT_CANVAS },
    playback: {
      transition: DEFAULT_TRANSITION,
      intervalSeconds: DEFAULT_INTERVAL_SECONDS,
      transitionSeconds: DEFAULT_TRANSITION_SECONDS,
    },
    layers: [],
    assets: [],
    updatedAt: new Date().toISOString(),
  };
}

export function createTemplateSnapshot(template: EventTemplate, published = false): EventTemplateSnapshot {
  return { ...template, published };
}

export function isTemplateTransition(value: unknown): value is TemplateTransition {
  return value === "fade" || value === "fade-scale" || value === "slide";
}

export function normalizeTemplate(input: any, fallback = defaultTemplate()): EventTemplate {
  const canvas = {
    width: safePositiveNumber(input?.canvas?.width, fallback.canvas.width),
    height: safePositiveNumber(input?.canvas?.height, fallback.canvas.height),
  };
  const playback = {
    transition: isTemplateTransition(input?.playback?.transition)
      ? input.playback.transition
      : fallback.playback.transition,
    intervalSeconds: safePositiveNumber(input?.playback?.intervalSeconds, fallback.playback.intervalSeconds),
    transitionSeconds: safePositiveNumber(
      input?.playback?.transitionSeconds,
      fallback.playback.transitionSeconds,
    ),
  };
  const layers = Array.isArray(input?.layers)
    ? input.layers.slice(0, MAX_LAYER_COUNT).map(normalizeLayer)
    : fallback.layers;
  const assets = Array.isArray(input?.assets)
    ? input.assets.slice(0, MAX_ASSET_COUNT).map(normalizeAsset)
    : fallback.assets;
  return {
    canvas,
    playback,
    layers,
    assets,
    updatedAt: typeof input?.updatedAt === "string" ? input.updatedAt : fallback.updatedAt,
  };
}

export function validateTemplate(template: EventTemplate) {
  if (!Number.isFinite(template.canvas.width) || !Number.isFinite(template.canvas.height)) {
    throw new Error("Invalid template canvas");
  }
  if (template.canvas.width <= 0 || template.canvas.height <= 0) {
    throw new Error("Invalid template canvas");
  }
  if (template.canvas.width > MAX_DIMENSION || template.canvas.height > MAX_DIMENSION) {
    throw new Error("Invalid template canvas");
  }
  if (!isTemplateTransition(template.playback.transition)) {
    throw new Error("Invalid template transition");
  }
  if (!Number.isFinite(template.playback.intervalSeconds) || template.playback.intervalSeconds <= 0) {
    throw new Error("Invalid template interval");
  }
  if (!Number.isFinite(template.playback.transitionSeconds) || template.playback.transitionSeconds < 0) {
    throw new Error("Invalid template transition duration");
  }
  if (template.layers.length > MAX_LAYER_COUNT) {
    throw new Error("Too many template layers");
  }
  if (template.assets.length > MAX_ASSET_COUNT) {
    throw new Error("Too many template assets");
  }
  for (const layer of template.layers) {
    if (!layer.id || !layer.type) {
      throw new Error("Invalid template layer");
    }
    if (!Number.isFinite(layer.x) || !Number.isFinite(layer.y)) {
      throw new Error("Invalid template layer");
    }
    if (!Number.isFinite(layer.width) || !Number.isFinite(layer.height)) {
      throw new Error("Invalid template layer");
    }
    if (layer.width <= 0 || layer.height <= 0) {
      throw new Error("Invalid template layer");
    }
    if (layer.width > MAX_DIMENSION || layer.height > MAX_DIMENSION) {
      throw new Error("Invalid template layer");
    }
    if (!Number.isFinite(layer.rotation)) {
      throw new Error("Invalid template layer");
    }
    if (!Number.isFinite(layer.zIndex)) {
      throw new Error("Invalid template layer");
    }
    if (layer.data?.opacity !== undefined && (layer.data.opacity < 0 || layer.data.opacity > 1)) {
      throw new Error("Invalid template layer");
    }
  }
}

export function sanitizeAssetFilename(filename: string) {
  return filename.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

export function makeAssetKey(eventId: string, assetId: string, filename: string) {
  return `templates/${eventId}/${assetId}/${sanitizeAssetFilename(filename) || "asset"}`;
}

function safePositiveNumber(value: unknown, fallback: number) {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function normalizeLayer(input: any): TemplateLayer {
  return {
    id: typeof input?.id === "string" && input.id ? input.id : crypto.randomUUID(),
    type: input?.type === "text" || input?.type === "decorative-asset" ? input.type : "photo-frame",
    x: safeNumber(input?.x),
    y: safeNumber(input?.y),
    width: safePositiveNumber(input?.width, 320),
    height: safePositiveNumber(input?.height, 240),
    rotation: safeNumber(input?.rotation),
    zIndex: safeNumber(input?.zIndex),
    locked: Boolean(input?.locked),
    data: normalizeLayerData(input?.data),
  };
}

function normalizeAsset(input: any): TemplateAsset {
  return {
    assetId: typeof input?.assetId === "string" && input.assetId ? input.assetId : crypto.randomUUID(),
    filename: typeof input?.filename === "string" && input.filename ? input.filename : "asset",
    contentType: typeof input?.contentType === "string" && input.contentType ? input.contentType : "image/png",
    key: typeof input?.key === "string" && input.key ? input.key : "",
    uploadedAt: typeof input?.uploadedAt === "string" ? input.uploadedAt : new Date().toISOString(),
  };
}

function normalizeLayerData(input: any): TemplateLayerData {
  return {
    text: typeof input?.text === "string" ? input.text : undefined,
    fontSize: typeof input?.fontSize === "number" ? input.fontSize : undefined,
    color: typeof input?.color === "string" ? input.color : undefined,
    align: input?.align === "left" || input?.align === "center" || input?.align === "right" ? input.align : undefined,
    assetId: typeof input?.assetId === "string" ? input.assetId : undefined,
    assetKey: typeof input?.assetKey === "string" ? input.assetKey : undefined,
    assetFit: input?.assetFit === "cover" || input?.assetFit === "contain" ? input.assetFit : undefined,
    opacity: typeof input?.opacity === "number" ? input.opacity : undefined,
    borderWidth: typeof input?.borderWidth === "number" ? input.borderWidth : undefined,
    borderColor: typeof input?.borderColor === "string" ? input.borderColor : undefined,
    borderRadius: typeof input?.borderRadius === "number" ? input.borderRadius : undefined,
    backgroundColor: typeof input?.backgroundColor === "string" ? input.backgroundColor : undefined,
  };
}

function safeNumber(value: unknown) {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}
