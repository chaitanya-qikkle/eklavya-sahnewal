// Dev-only yard builder — walls + the full prop kit (masts, cameras, gates,
// tanks, custom GLB models, …) on top of Sahnewal's real geofence/DXF layout.
//
// This is a focused harness, not a rebuild of YardLiveStatus3D.jsx: it fetches
// the same two Sahnewal JSON files that page uses, renders the SAME YardScene
// (so the yard looks identical to production), and layers WallEditor +
// PropsEditor inside YardScene's own <Canvas> via the `children` passthrough
// added to YardScene for exactly this purpose. One shared undo/redo history
// (useUndoable) covers both tools, same as the DICT harness this was adapted
// from.
//
// IMPORTANT — this is a LOCAL, SESSION-ONLY editor. Edits live only in this
// page's React state; nothing is written back into yard-layout-sahnewal.json
// or slot-geofence-sahnewal.json automatically. Use "Export edits.json" to
// download the current edit list, then run
//   node bake-yard-builder-edits.mjs <edits.json>
// from Frontend/ to apply it permanently to yard-layout-sahnewal.json.
//
// Not wired into any nav menu — reachable only by navigating directly to
// /dashboard/yard-builder.

import React, { useCallback, useEffect, useMemo, useState } from "react";
import YardScene from "../scene/YardScene";
import { buildProjection, computeDxfAlignment } from "../scene/geofence";
import WallEditor, { EMPTY_EDITS, MODES, applyEdits, wallSegments, obstacleRings } from "../tools/WallEditor";
import PropsEditor, { newPropId } from "../tools/PropsEditor";
import { PROP_CATEGORIES, PROP_SPECS } from "../tools/PropKit";
import useUndoable from "../tools/useUndoable";

const SAHNEWAL_SITE = { geofence: "/slot-geofence-sahnewal.json", layout: "/yard-layout-sahnewal.json" };

const smallBtn = {
  padding: "5px 9px", borderRadius: 5, cursor: "pointer", fontSize: 11,
  background: "rgba(255,255,255,.06)", color: "#cfe0f0",
  border: "1px solid rgba(140,175,210,.25)",
};

function saveBundle(edits) {
  return JSON.stringify({ edits, exportedAt: new Date().toISOString(), site: "sahnewal" }, null, 2);
}

function SaveRow({ edits }) {
  const download = () => {
    const json = saveBundle(edits);
    const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url; a.download = "sahnewal-yard-builder-edits.json"; a.click();
    URL.revokeObjectURL(url);
  };
  const copy = () => navigator.clipboard?.writeText(saveBundle(edits));
  return (
    <div style={{ display: "flex", gap: 6, marginTop: 6, marginBottom: 10 }}>
      <button onClick={download} style={{
        flex: 1, padding: "6px 0", cursor: "pointer", fontSize: 12,
        background: "rgba(79,154,224,.28)", color: "#eaf4ff",
        border: "1px solid rgba(140,175,210,.25)", borderRadius: 5,
      }}>Export edits.json</button>
      <button onClick={copy} style={smallBtn}>Copy</button>
    </div>
  );
}

// ── Custom uploaded GLB models ─────────────────────────────────────────────
// Upload any .glb — the backend (Backend/v1/api/assets_api/Assets.py) saves
// it as-is under Frontend/public/models/custom/ (no compression step; an
// earlier gltf-transform pass was removed after it crashed on some source
// textures), then click "Place" to arm it like any other point prop.
function CustomModelsSection({ active, onPick }) {
  const [models, setModels] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = React.useRef(null);

  const refresh = useCallback(() => {
    fetch("/v1/assets/models")
      .then(r => r.json())
      .then(j => { if (j.status === "success") setModels(j.data || []); })
      .catch(() => {});
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".glb")) {
      setError("Only .glb files are supported");
      return;
    }
    setUploading(true); setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/v1/assets/upload-model", { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok || json.status === "error") throw new Error(json.message || json.detail || "Upload failed");
      refresh();
    } catch (err) {
      setError(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{
      padding: 10, borderRadius: 6, marginBottom: 12,
      background: "rgba(255,255,255,.04)", border: "1px solid rgba(140,175,210,.2)",
    }}>
      <div style={{ fontSize: 11, color: "#8fa5bb", marginBottom: 8, fontWeight: 600 }}>Custom Models</div>

      <input ref={fileInputRef} type="file" accept=".glb" style={{ display: "none" }} onChange={handleFile} />
      <button onClick={() => fileInputRef.current?.click()} disabled={uploading} style={{
        width: "100%", padding: "7px 0", borderRadius: 5, cursor: uploading ? "default" : "pointer",
        fontSize: 12, fontWeight: 600, marginBottom: 8,
        background: "rgba(79,154,224,.22)", color: "#eaf4ff", border: "1px solid rgba(79,154,224,.4)",
        opacity: uploading ? 0.6 : 1,
      }}>{uploading ? "Uploading…" : "+ Upload .glb"}</button>

      {error && <div style={{ fontSize: 10.5, color: "#ffb4b4", marginBottom: 8 }}>{error}</div>}

      {models.length === 0 ? (
        <div style={{ fontSize: 10.5, color: "#7d94ab" }}>No models uploaded yet.</div>
      ) : (
        <div style={{ display: "grid", gap: 4 }}>
          {models.map(m => (
            <button key={m.filename} onClick={() => onPick(m.url)} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "6px 8px", borderRadius: 5, cursor: "pointer", fontSize: 11.5, textAlign: "left",
              background: active ? "rgba(79,154,224,.28)" : "rgba(255,255,255,.05)",
              border: `1px solid ${active ? "#4f9ae0" : "transparent"}`,
              color: active ? "#eaf4ff" : "#9fb2c6",
            }}>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.filename}</span>
              <span style={{ fontSize: 9.5, color: "#7d94ab", flexShrink: 0, marginLeft: 6 }}>Place</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Walls tab ──────────────────────────────────────────────────────────────
function WallsTab({ mode, setMode, edits, setEdits, layout, pending }) {
  const counts = {
    walls: layout ? wallSegments(layout).length : 0,
    obstacles: layout ? obstacleRings(layout).length : 0,
  };
  const masts = edits.masts || [];
  const cams = masts.reduce((n, m) => n + (m.cameras?.length || 0), 0);

  return (
    <>
      <div style={{ fontSize: 11, color: "#8fa5bb", marginBottom: 12 }}>
        {counts.walls} wall segments · {counts.obstacles} obstacles
        {masts.length > 0 && ` · ${masts.length} masts · ${cams} cameras`}
      </div>
      <div style={{ display: "grid", gap: 5, marginBottom: 12 }}>
        {Object.entries(MODES).map(([k, label]) => (
          <button key={k} onClick={() => setMode(k)} style={{
            padding: "7px 10px", borderRadius: 6, cursor: "pointer", fontSize: 12.5, textAlign: "left",
            background: mode === k ? "rgba(79,154,224,.28)" : "rgba(255,255,255,.05)",
            border: `1px solid ${mode === k ? "#4f9ae0" : "transparent"}`,
            color: mode === k ? "#eaf4ff" : "#9fb2c6",
          }}>{label}</button>
        ))}
      </div>
      <div style={{ fontSize: 11, color: "#8fa5bb", lineHeight: 1.5, marginBottom: 12 }}>
        {mode === "break" && "Click a blue wall segment to remove it. Click again to restore."}
        {mode === "build" && (pending ? "Click the wall's end point." : "Click the ground for the wall's start point.")}
        {mode === "obstacle" && "Click a building to remove it. Click again to restore."}
        {mode === "mast" && "Click the ground to raise a 30 m high mast. Click a mast to remove it."}
        {mode === "camera" && "Click a mast to mount a camera. Each one faces a quarter-turn further round."}
        {mode === "off" && "Pick a mode to start editing."}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12, rowGap: 10 }}>
        {[["Broken", edits.removedWalls.length], ["Built", edits.addedWalls.length],
          ["Removed", edits.removedObstacles.length], ["Masts", masts.length],
          ["Cameras", cams]].map(([k, v]) => (
          <div key={k}>
            <div style={{ fontSize: 9.5, color: "#7d94ab", textTransform: "uppercase", letterSpacing: .6 }}>{k}</div>
            <div style={{ fontSize: 17, fontWeight: 700 }}>{v}</div>
          </div>
        ))}
      </div>
      <SaveRow edits={edits} />
      <button onClick={() => setEdits(EMPTY_EDITS)} style={{
        width: "100%", padding: "6px 10px", cursor: "pointer", fontSize: 12, marginBottom: 4,
        background: "rgba(255,255,255,.06)", color: "#cfe0f0",
        border: "1px solid rgba(140,175,210,.25)", borderRadius: 5,
      }}>Reset all edits</button>
    </>
  );
}

// ── Props/Buildings tab ─────────────────────────────────────────────────────
function PropsTab({
  activeType, setActiveType, propMode, setPropMode,
  selectedIdx, setSelectedIdx, moveArm, setMoveArm,
  breakArm, setBreakArm, edits, setEdits, drawPts, setDrawPts,
  setPendingModelUrl,
}) {
  const props = edits.props || [];
  const activeSpec = activeType ? PROP_SPECS[activeType] : null;
  const drawing = activeSpec && (activeSpec.footprint === "polygon" || activeSpec.footprint === "polyline");
  const minPts = activeSpec?.footprint === "polygon" ? 3 : 2;
  const canFinish = drawing && drawPts.length >= minPts;

  const finishDraw = () => {
    if (!canFinish) return;
    const prop = { id: newPropId(activeType), type: activeType, points: drawPts };
    if (activeSpec.footprint === "polygon") prop.h = activeSpec.h;
    setEdits({ ...edits, props: [...props, prop] });
    setDrawPts([]);
    setSelectedIdx(props.length);
  };
  const cancelDraw = () => setDrawPts([]);

  const targetIdx = selectedIdx != null ? selectedIdx : (props.length ? props.length - 1 : null);
  const target = targetIdx != null ? props[targetIdx] : null;
  const targetSpec = target ? PROP_SPECS[target.type] : null;
  const updateTarget = (patch) => {
    const copy = [...props];
    copy[targetIdx] = { ...target, ...patch };
    setEdits({ ...edits, props: copy });
  };
  const rotateTarget = (delta) => {
    if (!target) return;
    if (targetSpec.footprint === "point") { updateTarget({ rot: ((target.rot || 0) + delta + 360) % 360 }); return; }
    if (targetSpec.footprint === "polygon" || targetSpec.footprint === "rect") {
      const cx = target.points.reduce((s, p) => s + p[0], 0) / target.points.length;
      const cy = target.points.reduce((s, p) => s + p[1], 0) / target.points.length;
      const th = (delta * Math.PI) / 180;
      const cos = Math.cos(th), sin = Math.sin(th);
      const points = target.points.map(([x, y]) => {
        const a = x - cx, b = y - cy;
        return [cx + a * cos - b * sin, cy + a * sin + b * cos];
      });
      updateTarget({ points });
    }
  };
  const isStructure = (s) => s && (s.footprint === "polygon" || s.footprint === "rect");
  const hasHeight = (t, s) => isStructure(s) || t?.type === "compound_wall" || t?.type === "security_wall";
  const hasColor = (t, s) => isStructure(s) || t?.type === "compound_wall" || t?.type === "custom_model" || t?.type === "security_wall";
  const BREAKABLE_RUN_TYPES = new Set(["compound_wall", "fence", "road", "rail", "security_wall"]);
  const isWallRun = (t) => BREAKABLE_RUN_TYPES.has(t?.type);
  const nudgeHeight = (d) => {
    if (!target || !hasHeight(target, targetSpec)) return;
    const min = target.type === "compound_wall" ? 1 : 2;
    updateTarget({ h: Math.max(min, (target.h ?? targetSpec.h ?? (target.type === "compound_wall" ? 2 : 6)) + d) });
  };
  const setColor = (hex) => { if (target && hasColor(target, targetSpec)) updateTarget({ color: hex }); };
  const SCALE_MIN = 0.01, SCALE_MAX = 100;
  const nudgeScale = (mult) => {
    if (!target || !isStructure(targetSpec)) return;
    updateTarget({ scale: Math.max(SCALE_MIN, Math.min(SCALE_MAX, (target.scale || 1) * mult)) });
  };
  const nudgeMove = (dx, dy) => {
    if (!target) return;
    if (targetSpec.footprint === "point") { updateTarget({ x: target.x + dx, y: target.y + dy }); return; }
    updateTarget({ points: target.points.map(([x, y]) => [x + dx, y + dy]) });
  };
  const deleteTarget = () => {
    if (targetIdx == null) return;
    setEdits({ ...edits, props: props.filter((_, k) => k !== targetIdx) });
    setSelectedIdx(null); setMoveArm(false); setBreakArm(false);
  };
  const pick = (type) => {
    setPropMode(null); setDrawPts([]); setSelectedIdx(null); setMoveArm(false); setBreakArm(false);
    setActiveType(type === activeType ? null : type);
  };
  const pickCustomModel = (url) => {
    setPropMode(null); setDrawPts([]); setSelectedIdx(null); setMoveArm(false); setBreakArm(false);
    setPendingModelUrl(url);
    setActiveType("custom_model");
  };
  const setMode = (m) => {
    setActiveType(null); setDrawPts([]); setMoveArm(false);
    setPropMode(mode => {
      const next = mode === m ? null : m;
      setBreakArm(next === "break");
      return next;
    });
    if (m !== "select") setSelectedIdx(null);
  };

  return (
    <>
      <div style={{ fontSize: 11, color: "#8fa5bb", marginBottom: 10 }}>
        {props.length} props placed this session. Pick something below, then click the yard.
      </div>

      <CustomModelsSection active={activeType === "custom_model"} onPick={pickCustomModel} />

      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        <button onClick={() => setMode("select")} style={{
          flex: 1, padding: "7px 0", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600,
          background: propMode === "select" ? "rgba(79,154,224,.28)" : "rgba(255,255,255,.05)",
          border: `1px solid ${propMode === "select" ? "#4f9ae0" : "transparent"}`,
          color: propMode === "select" ? "#eaf4ff" : "#9fb2c6",
        }}>{propMode === "select" ? "Click a prop to select" : "Select / move"}</button>
        <button onClick={() => setMode("erase")} style={{
          flex: 1, padding: "7px 0", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600,
          background: propMode === "erase" ? "rgba(224,79,79,.28)" : "rgba(255,255,255,.05)",
          border: `1px solid ${propMode === "erase" ? "#e04f4f" : "transparent"}`,
          color: propMode === "erase" ? "#ffdcdc" : "#9fb2c6",
        }}>{propMode === "erase" ? "Click a prop to erase" : "Erase"}</button>
        <button onClick={() => setMode("break")} style={{
          flex: 1, padding: "7px 0", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600,
          background: propMode === "break" ? "rgba(224,79,79,.28)" : "rgba(255,255,255,.05)",
          border: `1px solid ${propMode === "break" ? "#e04f4f" : "transparent"}`,
          color: propMode === "break" ? "#ffdcdc" : "#9fb2c6",
        }}>{propMode === "break" ? "Click a road/wall to break" : "Break road/wall"}</button>
      </div>

      <div style={{ maxHeight: 220, overflowY: "auto", marginBottom: 10, paddingRight: 2 }}>
        {PROP_CATEGORIES.map(cat => (
          <div key={cat.id} style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 9.5, color: "#7d94ab", textTransform: "uppercase", letterSpacing: .6, marginBottom: 4 }}>{cat.label}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
              {cat.items.map(it => (
                <button key={it.type} onClick={() => pick(it.type)} style={{
                  padding: "6px 8px", borderRadius: 5, cursor: "pointer", fontSize: 11.5, textAlign: "left",
                  background: activeType === it.type ? "rgba(79,154,224,.28)" : "rgba(255,255,255,.05)",
                  border: `1px solid ${activeType === it.type ? "#4f9ae0" : "transparent"}`,
                  color: activeType === it.type ? "#eaf4ff" : "#9fb2c6",
                }}>{it.label}</button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {activeSpec && (
        <div style={{ fontSize: 11, color: "#8fa5bb", lineHeight: 1.5, marginBottom: 8 }}>
          {activeSpec.footprint === "point" && "Click the ground to place one. Keeps placing — pick another tool to stop."}
          {activeSpec.footprint === "rect" && (drawPts.length ? "Click the opposite corner — the building appears immediately." : "Click one corner of the footprint.")}
          {activeSpec.footprint === "polyline" && `Click each point along the run (${drawPts.length} so far). Finish needs at least 2.`}
          {activeSpec.footprint === "polygon" && `Click each corner of the footprint (${drawPts.length} so far). Finish needs at least 3.`}
        </div>
      )}

      {drawing && (
        <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
          <button onClick={finishDraw} disabled={!canFinish} style={{
            flex: 1, padding: "6px 0", borderRadius: 5, fontSize: 12, fontWeight: 600,
            cursor: canFinish ? "pointer" : "default",
            background: canFinish ? "rgba(74,222,128,.25)" : "rgba(255,255,255,.04)",
            color: canFinish ? "#bdf7cf" : "#5c6b7a",
            border: `1px solid ${canFinish ? "#4ade80" : "rgba(140,175,210,.2)"}`,
          }}>Finish ({drawPts.length})</button>
          <button onClick={() => setDrawPts(drawPts.slice(0, -1))} disabled={!drawPts.length} style={smallBtn}>Undo point</button>
          <button onClick={cancelDraw} disabled={!drawPts.length} style={smallBtn}>Cancel</button>
        </div>
      )}
      {activeSpec?.footprint === "rect" && drawPts.length > 0 && (
        <div style={{ marginBottom: 12 }}><button onClick={cancelDraw} style={smallBtn}>Cancel</button></div>
      )}

      {propMode === "select" && !target && (
        <div style={{ fontSize: 11, color: "#8fa5bb", marginBottom: 10 }}>Click any prop in the yard to select it.</div>
      )}

      {target && (
        <div style={{ padding: 10, borderRadius: 6, marginBottom: 10, background: "rgba(255,255,255,.04)", border: "1px solid rgba(140,175,210,.2)" }}>
          <div style={{ fontSize: 11, color: "#8fa5bb", marginBottom: 8 }}>
            {selectedIdx != null ? "Selected" : "Last placed"}: <b style={{ color: "#dce8f5" }}>{targetSpec.label}</b>
          </div>
          <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
            <button onClick={() => { setBreakArm(false); setMoveArm(m => !m); }} style={{
              flex: 1, padding: "6px 0", borderRadius: 5, fontSize: 11.5, fontWeight: 600, cursor: "pointer",
              background: moveArm ? "rgba(250,204,21,.25)" : "rgba(255,255,255,.06)",
              color: moveArm ? "#fde68a" : "#cfe0f0",
              border: `1px solid ${moveArm ? "#facc15" : "rgba(140,175,210,.25)"}`,
            }}>{moveArm ? "Click the yard to drop it there" : "Move here…"}</button>
            {isWallRun(target) && (
              <button onClick={() => { setMoveArm(false); setBreakArm(b => !b); }} style={{
                flex: 1, padding: "6px 0", borderRadius: 5, fontSize: 11.5, fontWeight: 600, cursor: "pointer",
                background: breakArm ? "rgba(224,79,79,.25)" : "rgba(255,255,255,.06)",
                color: breakArm ? "#ffc9c9" : "#cfe0f0",
                border: `1px solid ${breakArm ? "#e04f4f" : "rgba(140,175,210,.25)"}`,
              }}>{breakArm ? "Click any wall/fence/road/rail to break it there" : "Break here…"}</button>
            )}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 4, marginBottom: 6 }}>
            <button onClick={() => nudgeMove(0, 1)} style={smallBtn} title="North">↑</button>
            <button onClick={() => nudgeMove(0, -1)} style={smallBtn} title="South">↓</button>
            <button onClick={() => nudgeMove(-1, 0)} style={smallBtn} title="West">←</button>
            <button onClick={() => nudgeMove(1, 0)} style={smallBtn} title="East">→</button>
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            {targetSpec.footprint !== "polyline" && (
              <>
                <button onClick={() => rotateTarget(-15)} style={smallBtn}>⟲15°</button>
                <button onClick={() => rotateTarget(15)} style={smallBtn}>⟳15°</button>
              </>
            )}
            {hasHeight(target, targetSpec) && (
              <>
                <button onClick={() => nudgeHeight(-1)} style={smallBtn}>H −1m</button>
                <button onClick={() => nudgeHeight(1)} style={smallBtn}>H +1m</button>
                <span style={{ fontSize: 10.5, color: "#7d94ab" }}>
                  {(target.h ?? targetSpec.h ?? (target.type === "compound_wall" ? 2 : 6)).toFixed(0)}m
                </span>
              </>
            )}
            <button onClick={deleteTarget} style={{ ...smallBtn, color: "#ffb4b4" }}>Delete</button>
          </div>
          {isStructure(targetSpec) && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
              <span style={{ fontSize: 11, color: "#8fa5bb" }}>Width / length</span>
              <button onClick={() => nudgeScale(1 / 1.15)} style={smallBtn}>−</button>
              <button onClick={() => nudgeScale(1.15)} style={smallBtn}>+</button>
              <span style={{ fontSize: 10.5, color: "#7d94ab" }}>{Math.round((target.scale || 1) * 100)}%</span>
            </div>
          )}
          {hasColor(target, targetSpec) && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
              <span style={{ fontSize: 11, color: "#8fa5bb" }}>Colour</span>
              <input type="color" value={target.color || targetSpec.color || "#c9cfd8"}
                onChange={e => setColor(e.target.value)}
                style={{ width: 34, height: 24, padding: 0, border: "1px solid rgba(140,175,210,.35)", borderRadius: 4, background: "none", cursor: "pointer" }} />
            </div>
          )}
        </div>
      )}

      <SaveRow edits={{ props: edits.props }} />
      <button onClick={() => setEdits(e => ({ ...e, props: [] }))} style={{
        width: "100%", padding: "6px 10px", cursor: "pointer", fontSize: 12,
        background: "rgba(255,255,255,.06)", color: "#cfe0f0",
        border: "1px solid rgba(140,175,210,.25)", borderRadius: 5,
      }}>Clear all props</button>
    </>
  );
}

export default function YardBuilderPage() {
  const [geofence, setGeofence] = useState(null);
  const [dxfLayout, setDxfLayout] = useState(null);

  useEffect(() => {
    let cancelled = false;
    // Cache-bust — plain static-file fetches, no HMR involvement, and stale
    // slot/layout JSON served across reloads has bitten this exact pattern
    // before (see YardLiveStatus3D.jsx's loader).
    const v = `?v=${Date.now()}`;
    Promise.all([
      fetch(SAHNEWAL_SITE.geofence + v).then(r => r.json()).catch(() => null),
      fetch(SAHNEWAL_SITE.layout + v).then(r => r.json()).catch(() => null),
    ]).then(([gf, dxf]) => {
      if (cancelled) return;
      setGeofence(gf);
      setDxfLayout(dxf);
    });
    return () => { cancelled = true; };
  }, []);

  const [tab, setTab] = useState("walls");
  const [mode, setMode] = useState("off");
  const [pending, setPending] = useState(null);
  const [propType, setPropType] = useState(null);
  const [drawPts, setDrawPts] = useState([]);
  const [propMode, setPropMode] = useState(null);
  const [selectedIdx, setSelectedIdx] = useState(null);
  const [moveArm, setMoveArm] = useState(false);
  const [breakArm, setBreakArm] = useState(false);
  const [pendingModelUrl, setPendingModelUrl] = useState(null); // custom_model: which uploaded .glb the next placement uses

  // One shared undo/redo history across both tools.
  const [edits, setEditsRaw, history] = useUndoable(EMPTY_EDITS);
  const setEdits = useCallback((e, label) => setEditsRaw(prev => (typeof e === "function" ? e(prev) : e), label), [setEditsRaw]);

  const switchTab = useCallback((next) => {
    if (next !== "walls") { setMode("off"); setPending(null); }
    if (next !== "props") {
      setPropType(null); setDrawPts([]); setPropMode(null);
      setSelectedIdx(null); setMoveArm(false); setBreakArm(false);
    }
    setTab(next);
  }, []);

  // Ctrl+Z/Y for the document history — skipped while mid-draw (drawPts
  // non-empty), where it instead steps back one clicked vertex, same
  // "smart undo" behaviour as the DICT harness this was adapted from.
  const drawPtsRef = React.useRef(drawPts);
  drawPtsRef.current = drawPts;
  useEffect(() => {
    const onKey = (e) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "z" || e.shiftKey) return;
      if (!drawPtsRef.current.length) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      setDrawPts(drawPtsRef.current.slice(0, -1));
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);
  const smartUndo = () => {
    if (drawPtsRef.current.length) setDrawPts(drawPtsRef.current.slice(0, -1));
    else history.undo();
  };

  const projection = useMemo(() => (geofence ? buildProjection(geofence.bounds) : null), [geofence]);
  const alignment = useMemo(
    () => (dxfLayout && geofence && projection ? computeDxfAlignment(dxfLayout, geofence, projection) : null),
    [dxfLayout, geofence, projection],
  );
  const editedLayout = useMemo(
    () => (dxfLayout ? applyEdits(dxfLayout, edits) : dxfLayout),
    [dxfLayout, edits],
  );

  const onPropMoved = useCallback((i, [nx, ny]) => {
    setEdits(e => {
      const props = e.props || [];
      const p = props[i]; const s = PROP_SPECS[p.type];
      let next;
      if (s.footprint === "point") next = { ...p, x: nx, y: ny };
      else {
        const cx = p.points.reduce((sum, q) => sum + q[0], 0) / p.points.length;
        const cy = p.points.reduce((sum, q) => sum + q[1], 0) / p.points.length;
        const dx = nx - cx, dy = ny - cy;
        next = { ...p, points: p.points.map(([x, y]) => [x + dx, y + dy]) };
      }
      const copy = [...props]; copy[i] = next;
      return { ...e, props: copy };
    });
    setMoveArm(false);
  }, [setEdits]);

  const onPropPicked = useCallback((i) => {
    if (propMode === "erase") setEdits(e => ({ ...e, props: (e.props || []).filter((_, k) => k !== i) }));
    else if (propMode === "select") setSelectedIdx(i);
  }, [propMode, setEdits]);

  const BREAKABLE_RUN_TYPES = useMemo(() => new Set(["compound_wall", "fence", "road", "rail", "security_wall"]), []);
  const onPropBreak = useCallback((_sel, [bx, by]) => {
    setEdits(e => {
      const props = e.props || [];
      let hit = null;
      props.forEach((p, i) => {
        if (!BREAKABLE_RUN_TYPES.has(p.type) || !p.points || p.points.length < 2) return;
        const pts = p.points;
        for (let k = 0; k + 1 < pts.length; k++) {
          const [ax, ay] = pts[k], [cx, cy] = pts[k + 1];
          const dx = cx - ax, dy = cy - ay;
          const L2 = dx * dx + dy * dy;
          if (L2 < 1e-6) continue;
          const t = Math.max(0, Math.min(1, ((bx - ax) * dx + (by - ay) * dy) / L2));
          const px = ax + dx * t, py = ay + dy * t;
          const d = Math.hypot(px - bx, py - by);
          if (!hit || d < hit.d) hit = { d, i, k, px, py, ux: dx / Math.sqrt(L2), uy: dy / Math.sqrt(L2), p, pts };
        }
      });
      if (!hit || hit.d > 8) return e;
      const GAP = 1.5;
      const left = [...hit.pts.slice(0, hit.k + 1), [hit.px - hit.ux * GAP, hit.py - hit.uy * GAP]];
      const right = [[hit.px + hit.ux * GAP, hit.py + hit.uy * GAP], ...hit.pts.slice(hit.k + 1)];
      const runLen = (l) => l.reduce((s, q, j) => (j ? s + Math.hypot(q[0] - l[j - 1][0], q[1] - l[j - 1][1]) : 0), 0);
      const pieces = [left, right]
        .filter(l => l.length >= 2 && runLen(l) > 0.6)
        .map(l => ({ ...hit.p, id: newPropId(hit.p.type), points: l }));
      setSelectedIdx(pieces.length ? hit.i : null);
      return { ...e, props: [...props.slice(0, hit.i), ...pieces, ...props.slice(hit.i + 1)] };
    });
  }, [BREAKABLE_RUN_TYPES, setEdits]);

  if (!geofence) {
    return (
      <div style={{ height: "100vh", display: "grid", placeItems: "center", background: "#0b121a", color: "#8fa5bb", fontFamily: "system-ui" }}>
        Loading Sahnewal yard…
      </div>
    );
  }

  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative", background: "#0b121a" }}>
      <div style={{
        position: "absolute", top: 12, left: 16, zIndex: 20,
        padding: "6px 12px", borderRadius: 8, background: "rgba(15,23,42,.7)",
        border: "1px solid rgba(255,255,255,.12)", color: "#7dd3fc",
        fontFamily: "system-ui, Segoe UI, sans-serif", fontSize: 11, fontWeight: 700,
        letterSpacing: .4, textTransform: "uppercase",
      }}>
        Yard Builder — Sahnewal (dev only, session-only edits)
      </div>

      <div style={{
        position: "absolute", top: 16, right: 16, width: 320, padding: 16,
        background: "rgba(11,18,26,.92)", border: "1px solid rgba(120,160,200,.25)",
        borderRadius: 10, color: "#dce8f5", backdropFilter: "blur(8px)",
        fontFamily: "system-ui, Segoe UI, sans-serif", zIndex: 10,
        maxHeight: "calc(100vh - 32px)", overflowY: "auto",
      }}>
        <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
          <button onClick={smartUndo} disabled={!history.canUndo && !drawPts.length} title="Ctrl+Z" style={{
            flex: 1, padding: "6px 0", borderRadius: 6, fontSize: 12,
            cursor: (history.canUndo || drawPts.length) ? "pointer" : "default",
            background: (history.canUndo || drawPts.length) ? "rgba(255,255,255,.08)" : "rgba(255,255,255,.03)",
            color: (history.canUndo || drawPts.length) ? "#cfe0f0" : "#4d5a68",
            border: "1px solid rgba(140,175,210,.22)",
          }}>&#8630; Undo</button>
          <button onClick={history.redo} disabled={!history.canRedo} title="Ctrl+Shift+Z" style={{
            flex: 1, padding: "6px 0", borderRadius: 6, fontSize: 12,
            cursor: history.canRedo ? "pointer" : "default",
            background: history.canRedo ? "rgba(255,255,255,.08)" : "rgba(255,255,255,.03)",
            color: history.canRedo ? "#cfe0f0" : "#4d5a68",
            border: "1px solid rgba(140,175,210,.22)",
          }}>Redo &#8631;</button>
          <span style={{ alignSelf: "center", fontSize: 10.5, color: "#7d94ab", minWidth: 44, textAlign: "right" }}>
            {history.depth} step{history.depth === 1 ? "" : "s"}
          </span>
        </div>

        <div style={{ fontSize: 10.5, color: "#7d94ab", lineHeight: 1.5, marginBottom: 12, padding: "8px 10px", borderRadius: 6, background: "rgba(224,165,79,.1)", border: "1px solid rgba(224,165,79,.25)" }}>
          Session-only. Nothing here is saved to yard-layout-sahnewal.json —
          use Export below to download the edit list.
        </div>

        <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
          {[["walls", "Walls"], ["props", "Props / Buildings"]].map(([k, label]) => (
            <button key={k} onClick={() => switchTab(k)} style={{
              flex: 1, padding: "7px 0", borderRadius: 6, cursor: "pointer",
              fontSize: 12, fontWeight: 600,
              background: tab === k ? "rgba(79,154,224,.28)" : "rgba(255,255,255,.05)",
              border: `1px solid ${tab === k ? "#4f9ae0" : "transparent"}`,
              color: tab === k ? "#eaf4ff" : "#9fb2c6",
            }}>{label}</button>
          ))}
        </div>

        {tab === "walls" && (
          <WallsTab mode={mode} setMode={setMode} edits={edits} setEdits={setEdits} layout={dxfLayout} pending={pending} />
        )}
        {tab === "props" && (
          <PropsTab
            activeType={propType} setActiveType={setPropType}
            propMode={propMode} setPropMode={setPropMode}
            selectedIdx={selectedIdx} setSelectedIdx={setSelectedIdx}
            moveArm={moveArm} setMoveArm={setMoveArm}
            breakArm={breakArm} setBreakArm={setBreakArm}
            edits={edits} setEdits={setEdits}
            drawPts={drawPts} setDrawPts={setDrawPts}
            setPendingModelUrl={setPendingModelUrl}
          />
        )}
      </div>

      <YardScene
        geofence={geofence}
        dxfLayout={editedLayout}
        containers={[]}
        selectedId={null}
        highlightedIds={null}
        onSelect={() => {}}
        onHover={() => {}}
        onPickBlock={() => {}}
        filterStatus="All"
        maxTier={6}
        getColor={() => "#1B5EA8"}
        liveEquipment={[]}
        selectedEquipmentId={null}
        onSelectEquipment={() => {}}
        followEquipmentId={null}
        followEquipmentMode={false}
        showBlockLabels={false}
        roadPainterActive={false}
        roadPoints={[]}
        onAddRoadPoint={() => {}}
        roadSegments={null}
      >
        <WallEditor
          layout={dxfLayout}
          alignment={alignment}
          mode={mode}
          edits={edits}
          onEdits={setEdits}
          pending={pending}
          onPending={setPending}
        />
        <PropsEditor
          edits={edits}
          onEdits={setEdits}
          alignment={alignment}
          activeType={propType}
          drawPts={drawPts}
          onDrawPts={setDrawPts}
          onPlaced={setSelectedIdx}
          pickMode={propMode}
          onPickProp={onPropPicked}
          selectedIdx={selectedIdx}
          moveArm={moveArm}
          onMoved={onPropMoved}
          breakArm={breakArm}
          onBreak={onPropBreak}
          pendingModelUrl={pendingModelUrl}
        />
      </YardScene>
    </div>
  );
}
