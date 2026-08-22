// Shared state between in-Canvas controllers and DOM UI overlays.
// Holds: camera mode, character runtime state, route progress.

import { create } from "zustand";
import * as THREE from "three";

export const CAM_MODES = ["third", "first", "free"];

export const useNavigation = create((set, get) => ({
  cameraMode: "third",
  setCameraMode: (m) => set({ cameraMode: m }),
  cycleCameraMode: () => {
    const cur = get().cameraMode;
    const i = CAM_MODES.indexOf(cur);
    set({ cameraMode: CAM_MODES[(i + 1) % CAM_MODES.length] });
  },

  // Updated by CharacterController each frame (refs, not React state, to
  // avoid re-renders). DOM widgets pull rounded progress via subscribe.
  posRef: { current: new THREE.Vector3() },
  facingRef: { current: 0 },
  speedRef: { current: 0 },
  walking: false,
  arrived: false,
  setWalking: (v) => set({ walking: v }),
  setArrived: (v) => set({ arrived: v }),

  // Progress along the active route (0..1)
  progress: 0,
  totalDist: 0,
  reportProgress: (p, total) => set({ progress: p, totalDist: total }),

  reset: () => set({
    walking: false, arrived: false, progress: 0, totalDist: 0,
  }),
}));
