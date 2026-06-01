import type { FramePreset, FrameToken, TemplateLayerData } from "$lib/api/types";

export const DEFAULT_FRAME_TOKEN: FrameToken = {
  borderWidth: 8,
  borderRadius: 24,
  padding: 8,
  shadow: "0 10px 30px rgba(0,0,0,0.22)",
  color: "#ffffff",
  backgroundColor: "rgba(255,255,255,0.08)",
};

export function defaultFramePresets(): FramePreset[] {
  return [
    {
      id: "classic-white",
      name: "經典白框",
      token: { ...DEFAULT_FRAME_TOKEN, color: "#ffffff" },
    },
    {
      id: "elegant-gold",
      name: "典雅金",
      token: { ...DEFAULT_FRAME_TOKEN, color: "#d4a373", glow: "0 0 18px rgba(212,163,115,0.35)" },
    },
    {
      id: "cream-paper",
      name: "奶油紙感",
      token: {
        ...DEFAULT_FRAME_TOKEN,
        color: "#f6e7d7",
        backgroundColor: "rgba(246,231,215,0.12)",
        texture: "paper",
      },
    },
  ];
}

export function resolveLayerFrameToken(
  data: TemplateLayerData,
  presets: FramePreset[] = [],
): FrameToken {
  const preset = presets.find((item) => item.id === data.framePresetId)?.token ?? DEFAULT_FRAME_TOKEN;
  const override = data.frameTokenOverride ?? {};
  return {
    ...preset,
    ...override,
    borderWidth: override.borderWidth ?? data.borderWidth ?? preset.borderWidth,
    borderRadius: override.borderRadius ?? data.borderRadius ?? preset.borderRadius,
    color: override.color ?? data.borderColor ?? preset.color,
    backgroundColor: override.backgroundColor ?? data.backgroundColor ?? preset.backgroundColor,
  };
}

export function frameTokenToInlineStyle(token: FrameToken): string {
  const borderStyle = token.doubleBorder ? "double" : "solid";
  const boxShadowParts = [token.shadow, token.glow].filter(Boolean).join(", ");
  const background = token.gradient || token.backgroundColor || "rgba(255,255,255,0.08)";
  const texture =
    token.texture === "paper"
      ? "radial-gradient(rgba(255,255,255,0.14) 1px, transparent 1px),"
      : "";
  const backgroundImage = texture ? `${texture}${background}` : background;
  return [
    `border:${token.borderWidth}px ${borderStyle} ${token.color}`,
    `border-radius:${token.borderRadius}px`,
    `padding:${token.padding}px`,
    `box-shadow:${boxShadowParts || "none"}`,
    `background:${background}`,
    `background-image:${backgroundImage}`,
    "background-size:6px 6px,auto",
  ].join(";");
}
