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
  previewUrl?: string;
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

export type EventTemplateResponse = {
  eventId: string;
  template: EventTemplate;
  publishedTemplate?: EventTemplate | null;
  published: boolean;
};
