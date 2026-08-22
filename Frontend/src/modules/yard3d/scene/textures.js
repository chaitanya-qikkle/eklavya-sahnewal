// Procedural canvas textures — generated once, cached, GPU-cheap.
// All textures are computed on the CPU at startup (a few ms total)
// and uploaded once. They use small canvases + RepeatWrapping so the
// total VRAM cost stays under a few hundred KB.
import * as THREE from "three";

const cache = new Map();
const get = (key, factory) => {
  if (cache.has(key)) return cache.get(key);
  const t = factory();
  cache.set(key, t);
  return t;
};

function makeCanvas(size) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  return c;
}

// Dark asphalt for service roads / gate areas — fine grit + tar specks
export function asphaltTexture() {
  return get("asphalt", () => {
    const size = 256;
    const c = makeCanvas(size);
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#272d39";
    ctx.fillRect(0, 0, size, size);
    const img = ctx.getImageData(0, 0, size, size);
    for (let i = 0; i < img.data.length; i += 4) {
      const n = (Math.random() - 0.5) * 28;
      img.data[i] += n;
      img.data[i + 1] += n;
      img.data[i + 2] += n;
    }
    ctx.putImageData(img, 0, 0);
    for (let i = 0; i < 500; i++) {
      ctx.fillStyle = Math.random() < 0.5 ? "#3b4252" : "#1c2230";
      ctx.fillRect(Math.random() * size, Math.random() * size, 1.5, 1.5);
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(40, 40);
    t.anisotropy = 4;
    return t;
  });
}

// Concrete pad — for block foundations & high-traffic yard surfaces
export function concreteTexture() {
  return get("concrete", () => {
    const size = 256;
    const c = makeCanvas(size);
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#4a5260";
    ctx.fillRect(0, 0, size, size);
    const img = ctx.getImageData(0, 0, size, size);
    for (let i = 0; i < img.data.length; i += 4) {
      const n = (Math.random() - 0.5) * 22;
      img.data[i] += n;
      img.data[i + 1] += n;
      img.data[i + 2] += n;
    }
    ctx.putImageData(img, 0, 0);
    // expansion joints
    ctx.strokeStyle = "#2c3340";
    ctx.lineWidth = 1.2;
    for (let i = 1; i < 4; i++) {
      const p = (i / 4) * size;
      ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(size, p); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, size); ctx.stroke();
    }
    // small stains
    for (let i = 0; i < 12; i++) {
      ctx.fillStyle = "rgba(20,24,32,0.18)";
      ctx.beginPath();
      ctx.arc(Math.random() * size, Math.random() * size, Math.random() * 6 + 2, 0, Math.PI * 2);
      ctx.fill();
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(8, 8);
    t.anisotropy = 4;
    return t;
  });
}

// Yard tarmac — bigger pattern for the whole site
export function yardTarmacTexture() {
  return get("yard-tarmac", () => {
    const size = 256;
    const c = makeCanvas(size);
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#323a4a";
    ctx.fillRect(0, 0, size, size);
    const img = ctx.getImageData(0, 0, size, size);
    for (let i = 0; i < img.data.length; i += 4) {
      const n = (Math.random() - 0.5) * 18;
      img.data[i] += n;
      img.data[i + 1] += n;
      img.data[i + 2] += n;
    }
    ctx.putImageData(img, 0, 0);
    for (let i = 0; i < 300; i++) {
      ctx.fillStyle = Math.random() < 0.5 ? "#404a5d" : "#252b38";
      ctx.fillRect(Math.random() * size, Math.random() * size, 1, 1);
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(60, 60);
    return t;
  });
}

// Container side panel — corrugated profile (used as alphaMap)
export function corrugatedTexture() {
  return get("corrugated", () => {
    const w = 128, h = 16;
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const ctx = c.getContext("2d");
    const grad = ctx.createLinearGradient(0, 0, w, 0);
    for (let i = 0; i <= 30; i++) {
      const stop = i / 30;
      grad.addColorStop(stop, i % 2 === 0 ? "#ffffff" : "#cccccc");
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  });
}
