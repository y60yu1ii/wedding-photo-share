import { describe, expect, it } from "vitest";
import {
  defaultFramePresets,
  frameTokenToInlineStyle,
  resolveLayerFrameToken,
} from "$lib/utils/frameToken";
import type { TemplateLayerData } from "$lib/api/types";

describe("frame token helpers", () => {
  it("applies override > legacy layer fields > preset precedence", () => {
    const presets = defaultFramePresets();
    const data: TemplateLayerData = {
      framePresetId: "classic-white",
      borderWidth: 11,
      borderColor: "#123123",
      frameTokenOverride: {
        borderWidth: 13,
        color: "#ff0000",
      },
    };

    const resolved = resolveLayerFrameToken(data, presets);
    expect(resolved.borderWidth).toBe(13);
    expect(resolved.color).toBe("#ff0000");
    expect(resolved.borderRadius).toBe(presets[0].token.borderRadius);
  });

  it("keeps preset mapping stable after persistence roundtrip", () => {
    const restored = JSON.parse(JSON.stringify(defaultFramePresets()));
    const resolved = resolveLayerFrameToken({ framePresetId: "elegant-gold" }, restored);
    expect(resolved.color).toBe("#d4a373");
    expect(resolved.glow).toContain("rgba(212,163,115");
  });

  it("emits texture and gradient styles when provided", () => {
    const style = frameTokenToInlineStyle({
      borderWidth: 8,
      borderRadius: 24,
      padding: 8,
      shadow: "0 0 10px rgba(0,0,0,0.2)",
      color: "#fff",
      gradient: "linear-gradient(#fff,#eee)",
      texture: "paper",
      doubleBorder: true,
    });
    expect(style).toContain("border:8px double #fff");
    expect(style).toContain("background-image:radial-gradient");
    expect(style).toContain("linear-gradient(#fff,#eee)");
  });
});
