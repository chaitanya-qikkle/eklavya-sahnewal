// Adaptive post-processing pipeline. Wires effects based on the active
// quality profile from useQuality(). Renders nothing on low/mobile.

import React, { useMemo } from "react";
import { EffectComposer, Bloom, SSAO, SMAA, Vignette } from "@react-three/postprocessing";
import { BlendFunction } from "postprocessing";
import { useQuality } from "./qualityStore";

export default function PostFX() {
  const settings = useQuality(s => s.settings);
  const px = settings.postfx;

  // Skip composer entirely on tiers without any effects — avoids the cost
  // of an extra render target.
  const anyEffect = px.bloom || px.ssao || px.smaa || px.vignette;
  const effects = useMemo(() => {
    if (!anyEffect) return null;
    const list = [];
    if (px.smaa)    list.push(<SMAA key="smaa" />);
    if (px.ssao)    list.push(
      <SSAO key="ssao"
        samples={settings.tier === "ultra" ? 24 : 12}
        radius={0.18} intensity={20} luminanceInfluence={0.5}
        worldDistanceThreshold={50} worldDistanceFalloff={20}
        worldProximityThreshold={0.5} worldProximityFalloff={0.1}
      />
    );
    if (px.bloom)   list.push(
      <Bloom key="bloom"
        intensity={settings.tier === "ultra" ? 0.6 : 0.35}
        luminanceThreshold={0.85} luminanceSmoothing={0.2}
        mipmapBlur
      />
    );
    if (px.vignette) list.push(
      <Vignette key="vignette" eskil={false} offset={0.25} darkness={0.55}
        blendFunction={BlendFunction.NORMAL}
      />
    );
    return list;
  }, [px.smaa, px.ssao, px.bloom, px.vignette, settings.tier, anyEffect]);

  if (!anyEffect) return null;
  return (
    <EffectComposer multisampling={settings.tier === "ultra" ? 4 : 0}>
      {effects}
    </EffectComposer>
  );
}
