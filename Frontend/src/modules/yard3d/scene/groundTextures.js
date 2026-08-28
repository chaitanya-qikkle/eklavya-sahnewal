// groundTextures.js — shared procedural PBR-map derivation helpers.
// Takes a hand-drawn color <canvas> (asphalt, concrete, grass, whatever) and
// derives normal/roughness/AO maps straight from its own luminance, so every
// yard surface gets consistent bump/shading detail without hand-authoring
// three separate images per material. No network fetch — generated once and
// cached by the caller's useMemo.
//
// Copied verbatim from the yard-builder-tool zip (DICT fork) — this project
// had no equivalent file, and wallTextures.js (also copied for the Yard
// Builder's IndustrialWallPanel) depends on it directly.

import * as THREE from "three";

function luminanceSampler(canvas) {
  const w = canvas.width, h = canvas.height;
  const data = canvas.getContext("2d").getImageData(0, 0, w, h).data;
  return {
    w, h,
    at(x, y) {
      const xi = (x + w) % w, yi = (y + h) % h;
      const i = (yi * w + xi) * 4;
      return (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) / 255;
    },
  };
}

function makeMap(w, h, paint) {
  const out = document.createElement("canvas"); out.width = w; out.height = h;
  const octx = out.getContext("2d");
  const img = octx.createImageData(w, h);
  paint(img.data);
  octx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(out);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// Tangent-space normal map from a Sobel-style luminance gradient.
export function deriveNormalMap(canvas, strength = 1.6) {
  const { w, h, at } = luminanceSampler(canvas);
  return makeMap(w, h, (data) => {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const dx = (at(x - 1, y) - at(x + 1, y)) * strength;
        const dy = (at(x, y - 1) - at(x, y + 1)) * strength;
        const len = Math.sqrt(dx * dx + dy * dy + 1);
        const i = (y * w + x) * 4;
        data[i] = ((dx / len) * 0.5 + 0.5) * 255;
        data[i + 1] = ((dy / len) * 0.5 + 0.5) * 255;
        data[i + 2] = ((1 / len) * 0.5 + 0.5) * 255;
        data[i + 3] = 255;
      }
    }
  });
}

// Roughness map: darker parts of the source canvas (grime, cracks, shadowed
// pores) read as rougher; brighter parts as cleaner/smoother.
export function deriveRoughnessMap(canvas, { base = 0.8, variance = 0.2 } = {}) {
  const { w, h, at } = luminanceSampler(canvas);
  return makeMap(w, h, (data) => {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const l = at(x, y);
        const v = Math.max(0, Math.min(1, base + (0.5 - l) * variance)) * 255;
        const i = (y * w + x) * 4;
        data[i] = data[i + 1] = data[i + 2] = v;
        data[i + 3] = 255;
      }
    }
  });
}

// Ambient-occlusion map: darker areas of the source canvas (crevices, seams,
// stains) are treated as more occluded. Three reads the AO map's red channel.
export function deriveAOMap(canvas, strength = 0.3) {
  const { w, h, at } = luminanceSampler(canvas);
  return makeMap(w, h, (data) => {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const l = at(x, y);
        const v = Math.max(0, Math.min(1, 1 - (1 - l) * strength)) * 255;
        const i = (y * w + x) * 4;
        data[i] = data[i + 1] = data[i + 2] = v;
        data[i + 3] = 255;
      }
    }
  });
}
