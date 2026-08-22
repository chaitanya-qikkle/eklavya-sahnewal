// In-scene FPS monitor. Samples frame time, reports a rolling average,
// and asks the quality store to downgrade if we drop below target.
//
// Mount once inside <Canvas>.

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import { useQuality } from "./qualityStore";

const WINDOW_MS = 1500;      // rolling average window
const ADJUST_COOLDOWN_MS = 4000; // don't thrash quality changes

export default function FpsAdaptor() {
  const samples = useRef([]);
  const lastAdjust = useRef(0);
  const reportFps = useQuality(s => s.reportFps);
  const autoAdjust = useQuality(s => s.autoAdjust);

  useFrame(() => {
    const now = performance.now();
    samples.current.push(now);
    while (samples.current.length && now - samples.current[0] > WINDOW_MS) {
      samples.current.shift();
    }
    if (samples.current.length < 8) return;
    const span = now - samples.current[0];
    const fps = (samples.current.length - 1) * 1000 / span;
    reportFps(fps);
    if (now - lastAdjust.current > ADJUST_COOLDOWN_MS) {
      autoAdjust(fps);
      lastAdjust.current = now;
    }
  });

  return null;
}
