// Runtime device-capability detection → quality profile.
// One-time at app boot; cheap, no rendering needed.

const PROFILES = ["mobile", "low", "medium", "high", "ultra"];

const GPU_TIERS = [
  { re: /(rtx\s?[2-9]\d{3}|rtx\s?40|rtx\s?50|rtx\s?A\d{3,4}|h100|a100|l40)/i, tier: "ultra" },
  { re: /(rtx\s?20\d{2}|gtx\s?16\d{2}|gtx\s?10[7-9]\d|radeon\s?rx\s?[6-9]\d{3}|m1\s?pro|m1\s?max|m2|m3|m4|apple\s?gpu)/i, tier: "ultra" },
  { re: /(gtx\s?10[5-6]\d|gtx\s?9\d{2}|radeon\s?rx\s?5\d{3}|radeon\s?rx\s?4\d{2}|vega\s?\d+)/i, tier: "high" },
  { re: /(iris\s?xe|iris\s?plus|radeon\s?vega|adreno\s?7\d\d|mali-g7\d|apple\s?a1[5-9])/i, tier: "medium" },
  { re: /(intel\s?uhd|intel\s?hd|adreno\s?[56]\d\d|mali-g[345]\d|apple\s?a1[0-4])/i, tier: "low" },
];

function detectGpuName() {
  try {
    const c = document.createElement("canvas");
    const gl = c.getContext("webgl2") || c.getContext("webgl");
    if (!gl) return { name: "unknown", vendor: "unknown" };
    const dbg = gl.getExtension("WEBGL_debug_renderer_info");
    if (!dbg) return { name: gl.getParameter(gl.RENDERER) || "unknown", vendor: gl.getParameter(gl.VENDOR) || "unknown" };
    return {
      name: gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || "unknown",
      vendor: gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) || "unknown",
    };
  } catch {
    return { name: "unknown", vendor: "unknown" };
  }
}

function classifyGpu(name) {
  for (const t of GPU_TIERS) if (t.re.test(name)) return t.tier;
  return null;
}

function detectMobile() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /android|iphone|ipad|ipod|mobile|tablet/i.test(ua) ||
         (navigator.maxTouchPoints > 1 && window.innerWidth < 900);
}

async function detectWebGpu() {
  if (typeof navigator === "undefined" || !navigator.gpu) return false;
  try {
    const a = await navigator.gpu.requestAdapter();
    return !!a;
  } catch { return false; }
}

export async function detectDeviceProfile() {
  const gpu = detectGpuName();
  const isMobile = detectMobile();
  const cores = navigator.hardwareConcurrency || 4;
  const ram = navigator.deviceMemory || 4; // GB, undefined on some browsers
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const screenPx = (window.screen?.width || 1280) * (window.screen?.height || 720);
  const webgpu = await detectWebGpu();

  let tier;
  if (isMobile) {
    tier = "mobile";
  } else {
    tier = classifyGpu(gpu.name);
    if (!tier) {
      if (cores >= 12 && ram >= 16) tier = "high";
      else if (cores >= 8 && ram >= 8) tier = "medium";
      else if (cores >= 4 && ram >= 4) tier = "low";
      else tier = "low";
    }
  }

  return {
    tier,
    gpu: gpu.name,
    vendor: gpu.vendor,
    cores,
    ram,
    dpr,
    screenPx,
    isMobile,
    webgpu,
    detectedAt: Date.now(),
  };
}

export function settingsForTier(tier) {
  switch (tier) {
    case "ultra":
      return {
        tier,
        dpr: [1, 2],
        antialias: true,
        shadows: true,
        shadowMapSize: 2048,
        textureScale: 1.0,
        postfx: { bloom: true, ssao: true, ssr: true, vignette: true, smaa: true, tone: "ACES" },
        envIntensity: 1.0,
        instanceCullPad: 1.4,
        maxLights: 12,
        fog: true,
        volumetric: true,
      };
    case "high":
      return {
        tier,
        dpr: [1, 1.75],
        antialias: true,
        shadows: true,
        shadowMapSize: 1024,
        textureScale: 1.0,
        postfx: { bloom: true, ssao: true, ssr: false, vignette: true, smaa: true, tone: "ACES" },
        envIntensity: 0.9,
        instanceCullPad: 1.2,
        maxLights: 8,
        fog: true,
        volumetric: false,
      };
    case "medium":
      return {
        tier,
        dpr: [1, 1.5],
        antialias: true,
        shadows: true,
        shadowMapSize: 512,
        textureScale: 0.75,
        postfx: { bloom: true, ssao: false, ssr: false, vignette: false, smaa: false, tone: "ACES" },
        envIntensity: 0.8,
        instanceCullPad: 1.1,
        maxLights: 6,
        fog: true,
        volumetric: false,
      };
    case "low":
      return {
        tier,
        dpr: [1, 1.25],
        antialias: false,
        shadows: false,
        shadowMapSize: 0,
        textureScale: 0.6,
        postfx: { bloom: false, ssao: false, ssr: false, vignette: false, smaa: false, tone: "Linear" },
        envIntensity: 0.7,
        instanceCullPad: 1.0,
        maxLights: 4,
        fog: true,
        volumetric: false,
      };
    case "mobile":
    default:
      return {
        tier: "mobile",
        dpr: [1, 1.25],
        antialias: false,
        shadows: false,
        shadowMapSize: 0,
        textureScale: 0.5,
        postfx: { bloom: false, ssao: false, ssr: false, vignette: false, smaa: false, tone: "Linear" },
        envIntensity: 0.6,
        instanceCullPad: 0.9,
        maxLights: 3,
        fog: false,
        volumetric: false,
      };
  }
}

export const ALL_TIERS = PROFILES;

export function downgradeTier(tier) {
  const i = PROFILES.indexOf(tier);
  return i > 0 ? PROFILES[i - 1] : tier;
}

export function upgradeTier(tier) {
  const i = PROFILES.indexOf(tier);
  return i >= 0 && i < PROFILES.length - 1 ? PROFILES[i + 1] : tier;
}
