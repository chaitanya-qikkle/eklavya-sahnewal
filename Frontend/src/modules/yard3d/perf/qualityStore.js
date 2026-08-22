// Zustand store holding the active quality profile.
// One source of truth for Canvas, PostFX, LOD, and PathNavigator.

import { create } from "zustand";
import { detectDeviceProfile, settingsForTier, downgradeTier, upgradeTier } from "./deviceProfile";

const DEFAULT_TIER = "high";

export const useQuality = create((set, get) => ({
  ready: false,
  device: null,
  tier: DEFAULT_TIER,
  settings: settingsForTier(DEFAULT_TIER),
  auto: true,           // FPS-based auto-adjustment enabled
  fps: 60,
  override: null,       // user-pinned tier; disables auto when set

  init: async () => {
    if (get().ready) return;
    const device = await detectDeviceProfile();
    const tier = get().override || device.tier;
    set({ ready: true, device, tier, settings: settingsForTier(tier) });
  },

  setTier: (tier) => {
    set({ tier, settings: settingsForTier(tier), override: tier, auto: false });
  },

  setAuto: (auto) => set({ auto, override: auto ? null : get().tier }),

  reportFps: (fps) => set({ fps }),

  // Called by FpsAdaptor. Returns new tier if it changed.
  autoAdjust: (avgFps) => {
    const { auto, tier, override } = get();
    if (!auto || override) return tier;
    let next = tier;
    if (avgFps < 28) next = downgradeTier(tier);
    else if (avgFps > 58 && tier !== "ultra") {
      // Only auto-upgrade if we have stable headroom AND we're at a tier strictly
      // below the device's detected ceiling — never push past the hardware verdict.
      const ceiling = get().device?.tier || "high";
      if (rank(next) < rank(ceiling)) next = upgradeTier(tier);
    }
    if (next !== tier) {
      set({ tier: next, settings: settingsForTier(next) });
    }
    return next;
  },
}));

function rank(t) {
  return ["mobile", "low", "medium", "high", "ultra"].indexOf(t);
}
