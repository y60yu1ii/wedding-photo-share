export type TemplateTransition =
  | "fade"
  | "fade-scale"
  | "slide"
  | "fade-soft"
  | "slide-parallax"
  | "stack-flip"
  | "kenburns"
  | "ribbon-flow";

export type TransitionEasing = "linear" | "ease" | "ease-in" | "ease-out" | "ease-in-out";

export type TransitionConfig = {
  durationMs?: number;
  easing?: TransitionEasing;
  staggerMs?: number;
};
export type TemplateLayerType = "photo-frame" | "text" | "decorative-asset";

export type TemplateCanvas = {
  width: number;
  height: number;
};

export type TemplatePlayback = {
  transition: TemplateTransition;
  intervalSeconds: number;
  transitionSeconds: number;
  transitionConfig?: TransitionConfig;
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
  framePresetId?: string;
  frameTokenOverride?: Partial<FrameToken>;
};

export type FrameToken = {
  borderWidth: number;
  borderRadius: number;
  padding: number;
  shadow: string;
  color: string;
  backgroundColor?: string;
  gradient?: string;
  doubleBorder?: boolean;
  texture?: string;
  glow?: string;
};

export type FramePreset = {
  id: string;
  name: string;
  token: FrameToken;
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
  framePresets?: FramePreset[];
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

export type PhotoStatus = "pending" | "approved";

export type WallPolicy = "approved_only" | "all_uploads";

export type GuestUpload = {
  PK: string;
  eventId: string;
  nickname: string;
  guestKey?: string;
  representativePhotoId?: string;
  status: PhotoStatus;
  createdAt: string;
  greeting?: string;
  s3Key?: string;
  presignedUrl?: string;
};

export type WallCard = {
  photoId: string;
  guestKey: string;
  nickname: string;
  createdAt: string;
  presignedUrl: string;
  status: PhotoStatus;
};

export type WallPhotosResponse = {
  eventId: string;
  wallPolicy: WallPolicy;
  generatedAt?: string;
  photos: GuestUpload[];
  cards?: WallCard[];
  nextCursor?: string;
};

export type MyGuestPhotosResponse = {
  photos: GuestUpload[];
  nextCursor?: string;
};

export type SlideshowPhotosResponse = {
  event: Record<string, any>;
  photos: Array<
    Pick<GuestUpload, "PK" | "nickname" | "greeting" | "createdAt" | "presignedUrl">
  >;
  nextCursor?: string;
};
