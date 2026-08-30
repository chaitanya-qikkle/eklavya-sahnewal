import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import Navbar from "../../../components/layout/Navbar";
import YardOverview3D from "./YardOverview3D";
import { useGetYard3dInventoryQuery, useGetEquipmentQuery, useGetLocationSlotsQuery } from "../../../store/api/ymsApi";
import { realContainerColor } from "../scene/realContainerColor";

// Parse "lat lng,lat lng,..." (ESS_MST_SLOT.LatLong format) into [{lat,lng}, ...]
function parseSlotLatLong(raw) {
  if (!raw || typeof raw !== "string") return [];
  return raw
    .trim()
    .split(",")
    .map((tok) => {
      const parts = tok.trim().split(/\s+/);
      if (parts.length < 2) return null;
      const a = parseFloat(parts[0]);
      const b = parseFloat(parts[1]);
      if (!isFinite(a) || !isFinite(b)) return null;
      // lat is the smaller-magnitude coordinate (~30 here), lng the larger (~75)
      return Math.abs(a) < Math.abs(b) ? { lat: a, lng: b } : { lat: b, lng: a };
    })
    .filter(Boolean);
}

// Build CAD-style block geometry (cx, cy, w, h in local metres) from raw
// GET_ESS_MST_SLOT_LIST rows, replacing the old static yard-layout-sahnewal.json.
// Projection: simple equirectangular, anchored at the overall slot-set centroid —
// good enough for a schematic yard canvas (not survey-grade).
function buildBlocksFromSlots(slotRows) {
  if (!Array.isArray(slotRows) || slotRows.length === 0) return [];

  const parsed = slotRows
    .map((row) => {
      const blockName = String(row?.BlockName ?? row?.BLOCKNAME ?? "").trim();
      const rowLabel = String(row?.Row ?? row?.ROW ?? "").trim();
      const colLabel = String(row?.Column ?? row?.COLUMN ?? "").trim();
      const polygon = parseSlotLatLong(String(row?.LatLong ?? row?.LATLONG ?? ""));
      if (!blockName || polygon.length < 3) return null;
      return { blockName, rowLabel, colLabel, polygon };
    })
    .filter(Boolean);

  if (!parsed.length) return [];

  // Anchor for the projection = centroid of every slot vertex across the whole yard.
  let sumLat = 0, sumLng = 0, count = 0;
  parsed.forEach((s) => s.polygon.forEach((p) => { sumLat += p.lat; sumLng += p.lng; count++; }));
  const anchorLat = sumLat / count;
  const anchorLng = sumLng / count;
  const cosLat = Math.cos((anchorLat * Math.PI) / 180);
  const M_PER_DEG_LAT = 110540; // metres per degree latitude (~constant)
  const M_PER_DEG_LNG = 111320 * cosLat; // metres per degree longitude at this latitude

  const project = (lat, lng) => ({
    x: (lng - anchorLng) * M_PER_DEG_LNG,
    y: (lat - anchorLat) * M_PER_DEG_LAT,
  });

  // Group by block name.
  const byBlock = new Map();
  parsed.forEach((s) => {
    if (!byBlock.has(s.blockName)) byBlock.set(s.blockName, []);
    byBlock.get(s.blockName).push(s);
  });

  return Array.from(byBlock.entries()).map(([blockName, slots]) => {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    const rowSet = new Set();
    const colSet = new Set();
    slots.forEach((s) => {
      if (s.rowLabel) rowSet.add(s.rowLabel);
      if (s.colLabel) colSet.add(s.colLabel);
      s.polygon.forEach((p) => {
        const { x, y } = project(p.lat, p.lng);
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      });
    });

    return {
      id: blockName,
      name: blockName,
      zone: "Import",
      cx: (minX + maxX) / 2,
      cy: (minY + maxY) / 2,
      w: Math.max(maxX - minX, 1),
      h: Math.max(maxY - minY, 1),
      angle: 0,
      slotRowCount: rowSet.size || 1,
      slotColCount: colSet.size || 1,
    };
  });
}

// ─── Constants ────────────────────────────────────────────────────────────────
const STATUS_COLORS = {
  full:    { bg: "#22c55e", label: "Full"    },
  empty:   { bg: "#94a3b8", label: "Empty"   },
  damaged: { bg: "#ef4444", label: "Damaged" },
  hold:    { bg: "#f59e0b", label: "Hold"    },
  reefer:  { bg: "#06b6d4", label: "Reefer"  },
  hazmat:  { bg: "#a855f7", label: "Hazmat"  },
};

// Real-world container livery colours keyed by the BIC owner prefix
// (first 3 letters of the container number). Used by the "line" colour mode
// to make the 3D yard read like a real terminal.
const SHIPPING_LINES = {
  MSC: { color: "#E8A93C", label: "MSC"          }, // mustard/yellow
  MED: { color: "#E8A93C", label: "MSC"          },
  MSK: { color: "#7CA9D2", label: "Maersk"       }, // Maersk light blue
  MAE: { color: "#7CA9D2", label: "Maersk"       },
  MRK: { color: "#7CA9D2", label: "Maersk"       },
  MRS: { color: "#7CA9D2", label: "Maersk"       },
  SUD: { color: "#C0392B", label: "Hamburg Süd"  }, // deep red
  CMA: { color: "#3C5A8C", label: "CMA CGM"      }, // navy blue
  CMC: { color: "#3C5A8C", label: "CMA CGM"      },
  COS: { color: "#D81E2A", label: "COSCO"        }, // red
  CSL: { color: "#D81E2A", label: "COSCO"        },
  CSP: { color: "#D81E2A", label: "COSCO"        },
  CBH: { color: "#D81E2A", label: "COSCO"        },
  OOL: { color: "#E8E8E8", label: "OOCL"         }, // white
  OOC: { color: "#E8E8E8", label: "OOCL"         },
  HLB: { color: "#E97132", label: "Hapag-Lloyd"  }, // orange
  HLC: { color: "#E97132", label: "Hapag-Lloyd"  },
  HLX: { color: "#E97132", label: "Hapag-Lloyd"  },
  UAC: { color: "#E97132", label: "Hapag-Lloyd"  },
  EGH: { color: "#1B7E3D", label: "Evergreen"    }, // green
  EIT: { color: "#1B7E3D", label: "Evergreen"    },
  EMC: { color: "#1B7E3D", label: "Evergreen"    },
  EGS: { color: "#1B7E3D", label: "Evergreen"    },
  ONE: { color: "#E91E63", label: "ONE"          }, // magenta
  TCN: { color: "#E91E63", label: "ONE"          },
  YML: { color: "#5DADE2", label: "Yang Ming"    }, // sky blue
  YMM: { color: "#5DADE2", label: "Yang Ming"    },
  HMM: { color: "#1F77B4", label: "HMM"          }, // blue
  HDM: { color: "#1F77B4", label: "HMM"          },
  ZIM: { color: "#2E8540", label: "ZIM"          }, // dark green
  ZCS: { color: "#2E8540", label: "ZIM"          },
  PIL: { color: "#BDC3C7", label: "PIL"          }, // light grey
  APH: { color: "#E97132", label: "Hapag-Lloyd"  }, // ex-APL → Hapag
  APZ: { color: "#E97132", label: "Hapag-Lloyd"  },
  // Leasing companies
  TGH: { color: "#D0D3D4", label: "Triton"       },
  TRI: { color: "#D0D3D4", label: "Triton"       },
  TLL: { color: "#D0D3D4", label: "Triton"       },
  TGC: { color: "#D0D3D4", label: "Triton"       },
  TEM: { color: "#A6ACAF", label: "Textainer"    },
  SEG: { color: "#F4D03F", label: "Seaco"        },
  SEK: { color: "#F4D03F", label: "Seaco"        },
  BMO: { color: "#85929E", label: "Beacon"       },
  BSI: { color: "#85929E", label: "Beacon"       },
  GLD: { color: "#909497", label: "Genstar"      },
};
const LINE_DEFAULT = { color: "#8E9AAA", label: "Other" };

function getLineInfo(containerNo) {
  if (!containerNo) return LINE_DEFAULT;
  const prefix = String(containerNo).slice(0, 3).toUpperCase();
  return SHIPPING_LINES[prefix] || LINE_DEFAULT;
}

const SIZES = ["20ft", "40ft"];
const TYPES = ["GP", "HC", "RF", "OT", "FR"];
const COMMODITIES = ["Electronics", "Textiles", "Machinery", "Food", "Chemicals", "Auto Parts"];
const CUSTOMERS = Array.from({ length: 12 }, (_, i) => `Shipper ${String.fromCharCode(65 + i)}`);

const CANVAS_W = 920, CANVAS_H = 520;

// Capacity/spec defaults (block geometry now comes from GET_ESS_MST_SLOT_LIST
// via buildBlocksFromSlots(); rows/slots counts are derived from distinct
// Row/Column values per block, maxTiers falls back to 4 when not specified here).
const BLOCK_SPECS = {};

// ─── Data ─────────────────────────────────────────────────────────────────────
function generateContainers(blocks) {
  const containers = [];
  const statuses = Object.keys(STATUS_COLORS);
  let id = 1;
  (blocks || []).forEach(block => {
    for (let row = 1; row <= block.rows; row++) {
      let slot = 1;
      while (slot <= block.slots) {
        let size = Math.random() > 0.5 ? "20ft" : "40ft";
        if (slot === block.slots) size = "20ft";

        const stackHeight = Math.min(block.maxTiers, Math.floor(Math.random() * (block.maxTiers + 1)));

        for (let tier = 1; tier <= stackHeight; tier++) {
          if (Math.random() > 0.15) {
            containers.push({
              id: `CNT-${String(id++).padStart(5,"0")}`,
              containerNo: `${["CSPU","MSKU","TGHU","HLCU"][Math.floor(Math.random()*4)]}${Math.floor(Math.random()*9000000)+1000000}`,
              block: block.id, blockName: block.name, zone: block.zone,
              row, slot, tier,
              status: statuses[Math.floor(Math.random() ** 1.4 * statuses.length)],
              size, type: TYPES[Math.floor(Math.random() * TYPES.length)],
              weight: Math.floor(Math.random() * 22000) + 2000,
              customer: CUSTOMERS[Math.floor(Math.random() * CUSTOMERS.length)],
              commodity: COMMODITIES[Math.floor(Math.random() * COMMODITIES.length)],
              vessel: `MV ${["Pacific Star","Ocean Dawn","Triton","Atlas"][Math.floor(Math.random()*4)]}`,
              eta: new Date(Date.now() + (Math.random()-0.5)*14*86400000).toISOString().split("T")[0],
              arrivalDate: new Date(Date.now() - Math.random()*15*86400000).toISOString().split("T")[0],
              dwellDays: Math.floor(Math.random() * 20),
              seal: `SL${Math.floor(Math.random()*99999)+10000}`,
            });
          }
        }
        slot += size === "40ft" ? 2 : 1;
      }
    }
  });
  return containers;
}

// Transform a TBL_CONTAINER_INVENTORY row (joined with ESS_MST_LOCATION) into
// the container shape expected by the 3D yard renderer.
function mapInventoryRow(row, idx) {
  // Supports both container-live-status fields (MASTERTABLE, CONTAINER_SIZE, CONTAINER_TYPE)
  // and yard-3d-inventory fields (LOCATION_NAME, SLOT_NAME, etc.)
  const sizeCode = String(row.CONTAINER_SIZE ?? row.ContainerSize ?? "").toUpperCase();
  const size = sizeCode.includes("20") ? "20ft" : sizeCode.includes("40") ? "40ft" : "40ft";
  const typeCode = String(row.CONTAINER_TYPE ?? row.ContainerType ?? "GP").toUpperCase();
  const type = ["GP", "HC", "RF", "OT", "FR"].includes(typeCode) ? typeCode : "GP";

  const rawStatus = String(row.INVENTORY_STATUS ?? row.ContainerStatus ?? "").toLowerCase();
  let status = "full";
  if (rawStatus.includes("empty")) status = "empty";
  else if (rawStatus.includes("damage")) status = "damaged";
  else if (rawStatus.includes("hold")) status = "hold";
  else if (rawStatus.includes("reefer") || type === "RF") status = "reefer";
  else if (rawStatus.includes("hazmat") || rawStatus.includes("hazard")) status = "hazmat";

  // BLOCK_NAME from ESS_MST_LOCATION join; SLOT_BLOCK from ESS_MST_BLOCK join (SP_YARD_3D_INVENTORY)
  const block = String(
    row.BLOCK_NAME ?? row.SLOT_BLOCK ?? row.BlockName ?? ""
  ).trim();
  const rowNo = parseInt(row.ROW_NO ?? row.SLOT_ROW ?? 0, 10) || 1;
  const colName = String(row.COLUMN_NAME ?? row.SLOT_COL ?? "").trim();
  const slot = parseInt(colName.replace(/\D/g, ""), 10) || 1;
  const tier = parseInt(row.STACK_NO ?? 1, 10) || 1;

  // locationName: try every possible field name the SP may return
  const locationName =
    (row.MASTERTABLE && row.MASTERTABLE !== "EMPTY-YARD" ? row.MASTERTABLE : null) ??
    row.LOCATION_NAME ??
    row.SLOT_NAME ??
    row.LOCATION_NAME_20FT ??
    row.ContainerLocationName ??
    "-";

  const containerNo = row.CONTAINER_NO ?? row.ContainerNo ?? "";
  const inventoryId = row.INVENTORY_ID ?? row.CONTAINER_ID ?? idx;

  return {
    id: `CNT-${inventoryId}`,
    containerNo,
    block,
    blockName: block ? `BLOCK-${block}` : "-",
    zone: "Import",
    row: rowNo,
    slot,
    tier,
    status,
    size,
    type,
    weight: 0,
    customer: "-",
    commodity: "-",
    vessel: "-",
    eta: "-",
    arrivalDate: row.GATE_IN_DATE ? String(row.GATE_IN_DATE).split("T")[0] : "-",
    dwellDays: Number.isFinite(row.DWELL_DAYS) ? Math.max(0, row.DWELL_DAYS) : 0,
    seal: "-",
    isoCode: row.ISO_CODE ?? "-",
    locationName,
  };
}

function getDwellColor(d) { return d<=3?"#22c55e":d<=7?"#f59e0b":"#ef4444"; }
function getContainerColor(c, mode) {
  if (mode==="line")  return getLineInfo(c.containerNo).color;
  if (mode==="dwell") return getDwellColor(c.dwellDays);
  if (mode==="size")  return c.size==="20ft"?"#6366f1":"#f97316";
  if (mode==="type")  return ({GP:"#22c55e",HC:"#06b6d4",RF:"#a855f7",OT:"#f59e0b",FR:"#ef4444"})[c.type]||"#94a3b8";
  // default "status" mode → real shipping-line paint colour
  return realContainerColor(c);
}

// Distinct shipping lines that appear in the current container list — used to
// build a compact legend without showing 30+ identical entries for the same line.
function getActiveLines(containers) {
  const seen = new Map();
  for (const c of containers || []) {
    const info = getLineInfo(c.containerNo);
    if (info === LINE_DEFAULT) continue;
    if (!seen.has(info.label)) seen.set(info.label, info.color);
  }
  if (!seen.size) seen.set(LINE_DEFAULT.label, LINE_DEFAULT.color);
  return Array.from(seen, ([label, color]) => ({ label, color }));
}

// ─── Overview Canvas ──────────────────────────────────────────────────────────
function YardOverviewCanvas({ layoutData, containers, filterStatus, filterZone, maxTier, colorMode, highlightedIds, onDrillBlock }) {
  const canvasRef = useRef(null);
  const [zoom, setZoom] = useState(0.75);
  const [pan, setPan] = useState({ x: 30, y: 15 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState(null);
  const [hoverBlock, setHoverBlock] = useState(null);
  const [tooltip, setTooltip] = useState(null);
  // touch pinch-zoom
  const lastTouchDist = useRef(null);
  const lastTouchMid = useRef(null);

  const canvasBlocks = useMemo(() => {
    const cadBlocks = layoutData?.blocks;
    if (!Array.isArray(cadBlocks) || cadBlocks.length === 0) return [];

    // Fit to block extents (not the full DXF bounds) so blocks are readable.
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    cadBlocks.forEach(b => {
      minX = Math.min(minX, b.cx - b.w / 2);
      maxX = Math.max(maxX, b.cx + b.w / 2);
      minY = Math.min(minY, b.cy - b.h / 2);
      maxY = Math.max(maxY, b.cy + b.h / 2);
    });

    const dx = Math.max(1e-6, maxX - minX);
    const dy = Math.max(1e-6, maxY - minY);
    const pad = 28;
    const s = Math.min((CANVAS_W - pad * 2) / dx, (CANVAS_H - pad * 2) / dy);
    const ox = (CANVAS_W - dx * s) / 2;
    const oy = (CANVAS_H - dy * s) / 2;

    return cadBlocks.map(b => {
      const spec = BLOCK_SPECS[b.id] || { maxTiers: 4 };
      const centerX = (b.cx - minX) * s + ox;
      const centerY = (maxY - b.cy) * s + oy; // invert Y for canvas
      const bw = Math.max(6, b.w * s);
      const bd = Math.max(6, b.h * s);
      return {
        id: b.id,
        name: b.name || `BLOCK-${b.id}`,
        zone: b.zone || "Import",
        rows: b.slotRowCount || 1,
        slots: b.slotColCount || 1,
        maxTiers: spec.maxTiers || 4,
        centerX,
        centerY,
        cw: bw,
        ch: bd,
        anchorShiftX: 0,
        anchorShiftY: 0,
        angle: -(b.angle || 0), // mirror due to Y inversion
      };
    });
  }, [layoutData]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    // Background
    ctx.fillStyle = "#0b1628";
    ctx.fillRect(-pan.x/zoom, -pan.y/zoom, CANVAS_W/zoom + pan.x/zoom*2, CANVAS_H/zoom + pan.y/zoom*2);

    // Grid
    ctx.fillStyle = "rgba(59,130,246,0.05)";
    for (let x=0; x<CANVAS_W; x+=24) for (let y=0; y<CANVAS_H; y+=24) {
      ctx.beginPath(); ctx.arc(x,y,0.8,0,Math.PI*2); ctx.fill();
    }

    // Draw blocks
    canvasBlocks.forEach(block => {
      const blockCtrs = containers.filter(c =>
        c.block===block.id && c.tier<=maxTier &&
        (filterStatus==="All"||c.status===filterStatus) &&
        (filterZone==="All"||c.zone===filterZone)
      );
      const isHov = hoverBlock===block.id;
      const zc = block.zone==="Import"?"#3b82f6":block.zone==="Export"?"#ef4444":"#22c55e";

      const cw = block.cw;
      const ch = block.ch;
      const x0 = -cw/2, y0 = -ch/2;

      ctx.save();
      ctx.translate(block.centerX, block.centerY);
      ctx.rotate(block.angle);
      ctx.translate(block.anchorShiftX || 0, block.anchorShiftY || 0);

      // Block bg
      ctx.fillStyle = isHov?"rgba(59,130,246,0.16)":"rgba(13,24,44,0.88)";
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(x0,y0,cw,ch,5/zoom);
      else ctx.rect(x0,y0,cw,ch);
      ctx.fill();
      ctx.strokeStyle = isHov?"#3b82f6cc":zc+"66";
      ctx.lineWidth = isHov?2/zoom:1/zoom;
      ctx.stroke();

      // Block name
      ctx.fillStyle = isHov?"#60a5fa":zc;
      ctx.font = `bold ${9/zoom}px 'JetBrains Mono',monospace`;
      ctx.textAlign = "left";
      ctx.fillText(block.name, x0+6, y0+13);

      // Occupancy badge
      const totalCap = block.rows*block.slots*block.maxTiers;
      const occ = totalCap ? Math.round(blockCtrs.length/totalCap*100) : 0;
      const bc = occ>85?"#ef4444":occ>65?"#f59e0b":"#22c55e";
      ctx.fillStyle = bc+"33";
      if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(x0+cw-42,y0+3,40,13,3); ctx.fill(); }
      ctx.fillStyle=bc; ctx.font=`bold ${8/zoom}px monospace`; ctx.textAlign="center";
      ctx.fillText(`${occ}%`,x0+cw-22,y0+12);

      // Container cells
      const pad = 6, topPad = 17;
      const availW = cw - pad*2;
      const availH = ch - topPad - 4;
      const cellW = Math.max(3, (availW/block.slots) - 1.5);
      const cellH = Math.max(2, (availH/block.rows) - 2);

      const byPos = {};
      blockCtrs.forEach(c => {
        const k=`${c.row}-${c.slot}`; if(!byPos[k]) byPos[k]=[]; byPos[k].push(c);
      });

      const skipSlots = new Set();

      for (let row=1; row<=block.rows; row++) {
        for (let slot=1; slot<=block.slots; slot++) {
          if (skipSlots.has(`${row}-${slot}`)) continue;

          const cx = x0 + pad + (slot-1)*(cellW+1.5);
          const cy = y0 + topPad + (row-1)*(cellH+2);
          const stack = byPos[`${row}-${slot}`]||[];

          if (!stack.length) {
            ctx.fillStyle = "rgba(255,255,255,0.03)";
            ctx.fillRect(cx,cy,cellW,cellH);
          } else {
            const topC = stack[stack.length-1];
            let color = getContainerColor(topC, colorMode);
            const isHL = highlightedIds ? highlightedIds.has(topC.id) : true;
            if (!isHL) color = "#1e293b";

            let drawW = cellW;
            if (topC.size === "40ft") {
              drawW = cellW * 2 + 1.5;
              skipSlots.add(`${row}-${slot+1}`);
            }

            // Stack depth shadow
            const depth = Math.min(stack.length, 3);
            for (let d=depth-1; d>=0; d--) {
              ctx.fillStyle = d===depth-1 ? color : color+"55";
              ctx.fillRect(cx + d*0.5, cy - d*0.8, drawW, cellH);
            }
            if (highlightedIds && highlightedIds.has(topC.id)) {
              ctx.strokeStyle="#fbbf24"; ctx.lineWidth=0.8/zoom;
              ctx.strokeRect(cx,cy,drawW,cellH);
            }
          }
        }
      }

      // Drill hint on hover
      if (isHov) {
        ctx.fillStyle="rgba(59,130,246,0.12)";
        ctx.font=`${7/zoom}px monospace`; ctx.textAlign="left";
        ctx.fillStyle="#60a5fa";
        ctx.fillText(`${blockCtrs.length} ctrs — click to expand`,x0+6,y0+ch-4);
      }

      ctx.restore();
    });

    ctx.restore();
  }, [zoom, pan, containers, filterStatus, filterZone, maxTier, colorMode, highlightedIds, hoverBlock, canvasBlocks]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    draw();
  }, [draw]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ro = new ResizeObserver(() => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      draw();
    });
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [draw]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const handleWheelEvent = (e) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const mx=e.clientX-rect.left, my=e.clientY-rect.top;
      const delta = e.deltaY<0?1.13:0.88;
      const nz = Math.min(6, Math.max(0.35, zoom*delta));
      setPan(p=>({ x:mx-(mx-p.x)*(nz/zoom), y:my-(my-p.y)*(nz/zoom) }));
      setZoom(nz);
    };
    
    canvas.addEventListener('wheel', handleWheelEvent, { passive: false });
    return () => canvas.removeEventListener('wheel', handleWheelEvent);
  }, [zoom]);

  const getBlockAt = useCallback((mx, my) => {
    const wx=(mx-pan.x)/zoom, wy=(my-pan.y)/zoom;
    for (const b of canvasBlocks) {
      const dx = wx - b.centerX;
      const dy = wy - b.centerY;
      const ca = Math.cos(-b.angle);
      const sa = Math.sin(-b.angle);
      const rx = dx * ca - dy * sa;
      const ry = dx * sa + dy * ca;
      if (Math.abs(rx) <= b.cw / 2 && Math.abs(ry) <= b.ch / 2) return b;
    }
    return null;
  }, [zoom, pan, canvasBlocks]);

  const handleMouseDown = useCallback((e) => {
    setIsPanning(true);
    setPanStart({x:e.clientX-pan.x, y:e.clientY-pan.y});
  }, [pan]);

  const handleMouseMove = useCallback((e) => {
    if (isPanning && panStart) {
      setPan({ x:e.clientX-panStart.x, y:e.clientY-panStart.y });
      return;
    }
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mx=e.clientX-rect.left, my=e.clientY-rect.top;
    const b = getBlockAt(mx, my);
    setHoverBlock(b?.id||null);
    setTooltip(b?{x:mx,y:my,block:b}:null);
  }, [isPanning, panStart, getBlockAt]);

  const handleMouseUp = useCallback(() => { setIsPanning(false); setPanStart(null); }, []);

  const handleClick = useCallback((e) => {
    if (Math.abs(e.movementX)+Math.abs(e.movementY)>4) return;
    const rect=canvasRef.current.getBoundingClientRect();
    const b=getBlockAt(e.clientX-rect.left, e.clientY-rect.top);
    if (b) onDrillBlock(b.id);
  }, [getBlockAt, onDrillBlock]);

  // Touch handlers for mobile pan + pinch-zoom
  const handleTouchStart = useCallback((e) => {
    if (e.touches.length === 1) {
      const t = e.touches[0];
      setIsPanning(true);
      setPanStart({ x: t.clientX - pan.x, y: t.clientY - pan.y });
      lastTouchDist.current = null;
    } else if (e.touches.length === 2) {
      setIsPanning(false);
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      lastTouchDist.current = Math.sqrt(dx * dx + dy * dy);
      lastTouchMid.current = {
        x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
        y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
      };
    }
  }, [pan]);

  const handleTouchMove = useCallback((e) => {
    e.preventDefault();
    if (e.touches.length === 1 && isPanning && panStart) {
      const t = e.touches[0];
      setPan({ x: t.clientX - panStart.x, y: t.clientY - panStart.y });
    } else if (e.touches.length === 2 && lastTouchDist.current !== null) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const delta = dist / lastTouchDist.current;
      const mid = lastTouchMid.current;
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect || !mid) return;
      const mx = mid.x - rect.left;
      const my = mid.y - rect.top;
      setZoom(z => {
        const nz = Math.min(6, Math.max(0.35, z * delta));
        setPan(p => ({ x: mx - (mx - p.x) * (nz / z), y: my - (my - p.y) * (nz / z) }));
        return nz;
      });
      lastTouchDist.current = dist;
    }
  }, [isPanning, panStart]);

  const handleTouchEnd = useCallback((e) => {
    if (e.touches.length === 0) {
      setIsPanning(false);
      setPanStart(null);
      lastTouchDist.current = null;
    }
    // single tap → click block
    if (e.changedTouches.length === 1 && lastTouchDist.current === null) {
      const t = e.changedTouches[0];
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const b = getBlockAt(t.clientX - rect.left, t.clientY - rect.top);
      if (b) onDrillBlock(b.id);
    }
  }, [getBlockAt, onDrillBlock]);

  const resetView = () => { setZoom(0.75); setPan({x:30,y:15}); };

  return (
    <div style={{position:"relative",width:"100%",height:"100%",background:"#0b1628",overflow:"hidden"}}>
      <canvas ref={canvasRef} style={{
        width:"100%", height:"100%", display:"block",
        cursor: isPanning?"grabbing":"crosshair",
        touchAction: "none",
      }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp} onClick={handleClick}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      />

      {/* Zoom controls — larger on mobile */}
      <div style={{position:"absolute",right:14,bottom:14,display:"flex",flexDirection:"column",gap:5}}>
        {[["+",()=>setZoom(z=>Math.min(6,z*1.25))],["−",()=>setZoom(z=>Math.max(0.35,z/1.25))],["⊡",resetView]].map(([l,fn])=>(
          <button key={l} onClick={fn} style={{
            width:"clamp(36px,8vw,44px)",height:"clamp(36px,8vw,44px)",
            borderRadius:8,background:"rgba(10,18,36,0.95)",
            border:"1px solid #2d4a6e",color:"#c8d8ea",
            fontSize:l==="⊡"?12:20,
            cursor:"pointer",fontFamily:"monospace",fontWeight:700,
            display:"flex",alignItems:"center",justifyContent:"center",
            boxShadow:"0 2px 8px rgba(0,0,0,0.5)",
          }}>{l}</button>
        ))}
        <div style={{fontSize:9,color:"#7fa8cc",textAlign:"center",fontFamily:"monospace",marginTop:1}}>
          {Math.round(zoom*100)}%
        </div>
      </div>

      {/* Tooltip — desktop only */}
      {tooltip && !isPanning && (
        <div style={{
          position:"absolute",left:tooltip.x+14,top:tooltip.y-12,
          background:"rgba(10,18,36,0.97)",border:"1px solid #2d4a6e",
          borderRadius:8,padding:"8px 12px",pointerEvents:"none",
          fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:"#c8d8ea",
          boxShadow:"0 8px 24px rgba(0,0,0,0.7)",zIndex:50,
        }}>
          <div style={{fontWeight:800,color:"#eef3f8",marginBottom:3}}>{tooltip.block.name}</div>
          <div style={{color:"#7fa8cc",fontSize:9}}>
            {containers.filter(c=>c.block===tooltip.block.id).length} containers · {tooltip.block.zone}
          </div>
          <div style={{color:"#3b82f6",fontSize:9,marginTop:3}}>Tap to drill in →</div>
        </div>
      )}

      {/* Mini legend — hidden on very small screens */}
      <div className="mobile-legend" style={{
        position:"absolute",left:14,bottom:14,
        background:"rgba(10,18,36,0.92)",border:"1px solid #1e3a5f",
        borderRadius:8,padding:"8px 10px",fontFamily:"'JetBrains Mono',monospace",
      }}>
        <div style={{fontSize:8,color:"#4d7a9e",marginBottom:5,letterSpacing:"0.1em"}}>LEGEND</div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap",maxWidth:220}}>
          {Object.entries(STATUS_COLORS).map(([s,sc])=>(
            <div key={s} style={{display:"flex",alignItems:"center",gap:4}}>
              <div style={{width:10,height:6,background:sc.bg,borderRadius:1}}/>
              <span style={{fontSize:8,color:"#adc8e0"}}>{sc.label}</span>
            </div>
          ))}
        </div>
        <div style={{fontSize:8,color:"#4d7a9e",marginTop:5}}>
          Pinch = zoom · Drag = pan · Tap block = expand
        </div>
      </div>
    </div>
  );
}

// ─── Block Detail Drill-down ──────────────────────────────────────────────────
function BlockDetailView({ blockId, blocks, containers, highlightedIds, selectedId, onSelect, colorMode, maxTierView, onBack }) {
  const block = (blocks || []).find(b=>b.id===blockId);
  const grid = useMemo(()=>{
    const g={};
    (containers || []).filter(c=>c.block===blockId&&c.tier<=maxTierView).forEach(c=>{
      const k=`${c.row}-${c.slot}`; if(!g[k]) g[k]=[]; g[k].push(c);
    });
    Object.values(g).forEach(s=>s.sort((a,b)=>a.tier-b.tier));
    return g;
  },[containers, blockId, maxTierView]);

  if (!block) return null;
  const zc = block.zone==="Import"?"#3b82f6":block.zone==="Export"?"#ef4444":"#22c55e";

  return (
    <div style={{padding:"14px 18px",overflowY:"auto",height:"100%"}}>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
        <button onClick={onBack} style={{
          background:"rgba(59,130,246,0.1)",border:"1px solid #2d4a6e",color:"#7fa8cc",
          cursor:"pointer",borderRadius:6,padding:"5px 12px",fontSize:10,
          fontFamily:"'JetBrains Mono',monospace",
        }}>← Yard Overview</button>
        <div style={{width:8,height:8,borderRadius:"50%",background:zc,boxShadow:`0 0 6px ${zc}`}}/>
        <span style={{fontSize:14,fontWeight:800,color:"#eef3f8",fontFamily:"'JetBrains Mono',monospace"}}>{block.name}</span>
        <span style={{fontSize:9,padding:"2px 10px",borderRadius:10,background:`${zc}22`,color:zc,border:`1px solid ${zc}44`,fontFamily:"monospace"}}>{block.zone}</span>
        <span style={{fontSize:9,color:"#7fa8cc",marginLeft:"auto",fontFamily:"monospace"}}>
          {containers.filter(c=>c.block===block.id).length} containers · {block.rows}R × {block.slots}S × {block.maxTiers}T
        </span>
      </div>

      <div style={{overflowX:"auto"}}>
        {/* Slot numbers header */}
        <div style={{display:"flex",gap:2,marginBottom:3,marginLeft:28}}>
          {Array.from({length:block.slots},(_,i)=>i+1).map(s=>(
            <div key={s} style={{width:22,fontSize:7,color:"#4d7a9e",fontFamily:"monospace",textAlign:"center",flexShrink:0}}>{s}</div>
          ))}
        </div>

        {Array.from({length:block.rows},(_,i)=>i+1).map(row=>{
          const skipSlots = new Set();
          return (
          <div key={row} style={{display:"flex",gap:2,alignItems:"flex-end",marginBottom:3}}>
            <span style={{width:24,fontSize:8,color:"#7fa8cc",fontFamily:"monospace",textAlign:"right",flexShrink:0,paddingRight:4}}>R{row}</span>
            {Array.from({length:block.slots},(_,j)=>j+1).map(slot=>{
              if (skipSlots.has(slot)) return null;

              const stack=grid[`${row}-${slot}`]||[];
              const has40ft = stack.some(c=>c.size==="40ft");
              if (has40ft) skipSlots.add(slot+1);

              return (
                <div key={slot} style={{display:"flex",flexDirection:"column-reverse",gap:1,minWidth:has40ft?46:22}}>
                  {stack.length===0?(
                    <div style={{width:22,height:12,borderRadius:2,background:"#0d1b2e",border:"1px solid #1e3a5f",opacity:0.55}}/>
                  ):stack.map(c=>{
                    const bg=getContainerColor(c,colorMode);
                    const isHL=highlightedIds?highlightedIds.has(c.id):true;
                    const isSel=c.id===selectedId;
                    const is40=c.size==="40ft";
                    return (
                      <div key={c.id} onClick={()=>onSelect(c)}
                        title={`${c.containerNo} | ${c.status} | T${c.tier} | ${c.size}`}
                        style={{
                          width:is40?46:22,height:12,
                          background:isHL?bg:"#1a2840",opacity:isHL?1:0.28,
                          border:`1.5px solid ${isSel?"#fff":isHL&&highlightedIds?"#fbbf24":"transparent"}`,
                          borderRadius:2,cursor:"pointer",flexShrink:0,
                          boxShadow:isSel?`0 0 7px ${bg}`:"none",
                          display:"flex",alignItems:"center",justifyContent:"center",
                          transition:"all 0.1s",
                        }}>
                        {c.status==="hold"&&<span style={{fontSize:6,color:"#fff",fontWeight:700}}>H</span>}
                        {c.status==="damaged"&&<span style={{fontSize:6,color:"#fff",fontWeight:700}}>!</span>}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )})}
      </div>

      <div style={{marginTop:10,fontSize:8,color:"#4d7a9e",fontFamily:"monospace",borderTop:"1px solid #1e3a5f",paddingTop:7}}>
        Columns = slots · Stacked cells = tiers (bottom→top) · H=Hold · !=Damaged · Click any cell for details
      </div>
    </div>
  );
}

// ─── Container Detail Panel ───────────────────────────────────────────────────
function ContainerDetailPanel({ container, onClose }) {
  if (!container) return null;
  const sc = STATUS_COLORS[container.status];
  const dc = getDwellColor(container.dwellDays);
  return (
    <div style={{
      position:"fixed",
      right:"max(8px, env(safe-area-inset-right, 8px))",
      bottom:"max(30px, env(safe-area-inset-bottom, 30px))",
      width:"min(300px, calc(100vw - 16px))",
      background:"rgba(8,14,28,0.97)",border:`1px solid ${sc.bg}55`,
      borderRadius:14,padding:14,zIndex:900,
      backdropFilter:"blur(24px)",
      boxShadow:`0 0 32px ${sc.bg}22,0 16px 48px rgba(0,0,0,0.9)`,
      fontFamily:"'JetBrains Mono',monospace",
      maxHeight:"55vh",
      overflowY:"auto",
    }}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <div>
          <div style={{fontSize:8,color:"#7fa8cc",letterSpacing:"0.1em"}}>CONTAINER</div>
          <div style={{fontSize:13,fontWeight:800,color:"#eef3f8"}}>{container.containerNo}</div>
        </div>
        <button onClick={onClose} style={{
          background:"rgba(255,255,255,0.07)",border:"1px solid #2d4a6e",color:"#c8d8ea",
          cursor:"pointer",borderRadius:6,width:26,height:26,fontSize:14,
          display:"flex",alignItems:"center",justifyContent:"center",
        }}>×</button>
      </div>

      <div style={{display:"inline-flex",alignItems:"center",gap:6,
        background:`${sc.bg}1a`,border:`1px solid ${sc.bg}44`,
        borderRadius:6,padding:"3px 10px",marginBottom:12}}>
        <div style={{width:6,height:6,borderRadius:"50%",background:sc.bg,boxShadow:`0 0 5px ${sc.bg}`}}/>
        <span style={{fontSize:9,color:sc.bg,fontWeight:700,textTransform:"uppercase"}}>{sc.label}</span>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:5,marginBottom:10}}>
        {[
          ["Location",`${container.blockName} R${container.row}·S${container.slot}·T${container.tier}`],
          ["Zone",container.zone],["Size/Type",`${container.size}/${container.type}`],
          ["Weight",`${container.weight.toLocaleString()} kg`],
          ["Customer",container.customer],["Commodity",container.commodity],
          ["Vessel",container.vessel],["Seal",container.seal],
          ["Arrived",container.arrivalDate],["ETD",container.eta],
        ].map(([k,v])=>(
          <div key={k} style={{background:"rgba(255,255,255,0.05)",borderRadius:5,padding:"6px 8px"}}>
            <div style={{fontSize:7,color:"#7fa8cc",marginBottom:2}}>{k.toUpperCase()}</div>
            <div style={{fontSize:9,color:"#dde8f2",fontWeight:600}}>{v}</div>
          </div>
        ))}
      </div>

      <div style={{borderTop:"1px solid #1e3a5f",paddingTop:8,marginBottom:10}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
          <span style={{fontSize:8,color:"#7fa8cc"}}>DWELL TIME</span>
          <span style={{fontSize:9,color:dc,fontWeight:700}}>{container.dwellDays} days</span>
        </div>
        <div style={{height:4,background:"#1e3a5f",borderRadius:2,overflow:"hidden"}}>
          <div style={{width:`${Math.min(container.dwellDays/20*100,100)}%`,height:"100%",background:dc,borderRadius:2,transition:"width 0.4s"}}/>
        </div>
      </div>

      <div style={{display:"flex",gap:5}}>
        {["Move","Hold","Release"].map(a=>(
          <button key={a} style={{
            flex:1,padding:"5px 0",borderRadius:5,border:"1px solid #2d4a6e",
            background:"rgba(255,255,255,0.04)",color:"#adc8e0",cursor:"pointer",
            fontSize:9,fontFamily:"'JetBrains Mono',monospace",transition:"all 0.12s",
          }}
          onMouseEnter={e=>{e.target.style.background="rgba(59,130,246,0.18)";e.target.style.borderColor="#3b82f6";e.target.style.color="#60a5fa";}}
          onMouseLeave={e=>{e.target.style.background="rgba(255,255,255,0.04)";e.target.style.borderColor="#2d4a6e";e.target.style.color="#adc8e0";}}
          >{a}</button>
        ))}
      </div>
    </div>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({label,value,sub,color="#3b82f6",icon}) {
  return (
    <div style={{background:"rgba(13,24,44,0.88)",border:`1px solid ${color}33`,borderRadius:8,padding:"10px 12px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
        <div>
          <div style={{fontSize:8,color:"#adc8e0",letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:3}}>{label}</div>
          <div style={{fontSize:20,fontWeight:800,color:"#f8fafc",fontFamily:"'JetBrains Mono',monospace",lineHeight:1}}>{value}</div>
          {sub&&<div style={{fontSize:8,color:"#7fa8cc",marginTop:3}}>{sub}</div>}
        </div>
        {icon&&<div style={{fontSize:16,opacity:0.55}}>{icon}</div>}
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function YardVisualization3D() {
  const [containers, setContainers] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedContainer, setSelectedContainer] = useState(null);
  const { data: slotListResp } = useGetLocationSlotsQuery();
  const layoutData = useMemo(() => {
    const rows = Array.isArray(slotListResp?.data) ? slotListResp.data : [];
    if (!rows.length) return null;
    return { blocks: buildBlocksFromSlots(rows) };
  }, [slotListResp]);
  const [maxTier, setMaxTier] = useState(4);
  const [filterZone, setFilterZone] = useState("All");
  const [filterStatus, setFilterStatus] = useState("All");
  const [filterBlock, setFilterBlock] = useState("All");
  const [colorMode, setColorMode] = useState("status");
  const [searchResults, setSearchResults] = useState(null);
  const [activeTab, setActiveTab] = useState("yard");
  const [viewMode, setViewMode] = useState("overview");
  const [drillBlock, setDrillBlock] = useState(null);

  const [sidebarOpen, setSidebarOpen] = useState(true);



  const { data: equipmentApi } = useGetEquipmentQuery();

  const yardBlocks = useMemo(() => {
    const cadBlocks = layoutData?.blocks;
    if (!Array.isArray(cadBlocks) || cadBlocks.length === 0) return [];
    return cadBlocks.map(b => {
      const spec = BLOCK_SPECS[b.id] || { maxTiers: 4 };
      return {
        id: b.id,
        name: b.name || `BLOCK-${b.id}`,
        zone: b.zone || "Import",
        rows: b.slotRowCount || 1,
        slots: b.slotColCount || 1,
        maxTiers: spec.maxTiers || 4,
      };
    });
  }, [layoutData]);

  // Inventory source: TBL_CONTAINER_INVENTORY with block/row/col/tier resolved
  const { data: inventoryApi, isFetching: isInventoryFetching } = useGetYard3dInventoryQuery(undefined, {
    pollingInterval: 60000,
    refetchOnFocus: true,
  });

  useEffect(() => {
    const rows = Array.isArray(inventoryApi?.data) ? inventoryApi.data : [];
    if (!rows.length) {
      console.warn("[3DYard] inventory API returned 0 rows", inventoryApi);
      setContainers([]);
      return;
    }
    console.log("[3DYard] inventory sample row:", rows[0]);
    const mapped = rows.map(mapInventoryRow);
    const withBlock = mapped.filter(c => c.block);
    console.log(`[3DYard] ${rows.length} rows → ${mapped.length} mapped → ${withBlock.length} have a block`);
    setContainers(mapped);
  }, [inventoryApi]);

  const zoneOptions = useMemo(() => {
    const zones = Array.from(new Set(yardBlocks.map(b => b.zone).filter(Boolean)));
    return zones.length ? zones : ["Import", "Export"];
  }, [yardBlocks]);

  const stats = useMemo(()=>{
    const total=containers.length; // real inventory only (no device containers)
    const byStatus={};
    Object.keys(STATUS_COLORS).forEach(s=>{byStatus[s]=containers.filter(c=>c.status===s).length;});
    const avgDwell=total ? Math.round(containers.reduce((a,c)=>a+c.dwellDays,0)/total) : 0;
    const overdwell=containers.filter(c=>c.dwellDays>7).length;
    const capacity=yardBlocks.reduce((a,b)=>a+b.rows*b.slots*b.maxTiers,0);
    return {total,byStatus,avgDwell,overdwell,capacity,occupancy:capacity?Math.round(total/capacity*100):0};
  },[containers, yardBlocks]);

  const filteredContainers = useMemo(()=>{
    let c = containers;
    if (filterZone!=="All") c=c.filter(x=>x.zone===filterZone);
    if (filterStatus!=="All") c=c.filter(x=>x.status===filterStatus);
    if (filterBlock!=="All") c=c.filter(x=>x.block===filterBlock);
    return c;
  },[containers,filterZone,filterStatus,filterBlock]);

  const handleSearch = useCallback((q)=>{
    setSearchQuery(q);
    if (!q.trim()) { setSearchResults(null); return; }
    const r=containers.filter(c=>
      c.containerNo.toLowerCase().includes(q.toLowerCase())||
      c.customer.toLowerCase().includes(q.toLowerCase())||
      c.vessel.toLowerCase().includes(q.toLowerCase())||
      c.seal.toLowerCase().includes(q.toLowerCase())
    );
    setSearchResults(new Set(r.map(x=>x.id)));
    if (r.length===1) setSelectedContainer(r[0]);
  },[containers]);

  const handleDrillBlock = useCallback((bid)=>{
    setDrillBlock(bid); setViewMode("detail"); setFilterBlock(bid);
  },[]);

  const handleBack = useCallback(()=>{
    setViewMode("overview"); setDrillBlock(null); setFilterBlock("All");
  },[]);

  const TIER_LABELS = ["Ground","Tier 1","Tier 2","Tier 3"];

  const headerBtn = (active, onClick, children, activeColor="#ef4444") => (
    <button onClick={onClick} style={{
      padding:"4px 11px",borderRadius:5,fontSize:10,fontWeight:700,cursor:"pointer",
      fontFamily:"'JetBrains Mono',monospace",transition:"all 0.12s",
      background: active ? activeColor : "transparent",
      border: active ? `1px solid ${activeColor}` : "1px solid transparent",
      color: active ? "#fff" : "#c8d8ea",
    }}>{children}</button>
  );

  const filterBtn = (active, onClick, children, color="#3b82f6") => (
    <button onClick={onClick} style={{
      padding:"3px 10px",borderRadius:5,fontSize:9,fontWeight:600,cursor:"pointer",
      fontFamily:"'JetBrains Mono',monospace",transition:"all 0.12s",
      background: active ? `${color}22` : "transparent",
      border: `1px solid ${active ? color+"66" : "transparent"}`,
      color: active ? color : "#adc8e0",
    }}>{children}</button>
  );

  const [showMobileControls, setShowMobileControls] = useState(false);

  return (
    <div style={{height:"100vh",display:"flex",flexDirection:"column",background:"#0b1628",fontFamily:"'JetBrains Mono',monospace",color:"#eef3f8",overflow:"hidden"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700;800&display=swap');
        ::-webkit-scrollbar{width:4px;height:4px}
        ::-webkit-scrollbar-track{background:#0b1628}
        ::-webkit-scrollbar-thumb{background:#2d4a6e;border-radius:2px}
        *{box-sizing:border-box}
        .yard-desktop-only { display:flex; }
        .yard-mobile-only  { display:none; }
        .yard-mobile-legend{ display:flex; }
        .mobile-hide       { display:flex; }
        @media (max-width: 767px) {
          .yard-desktop-only { display:none !important; }
          .yard-mobile-only  { display:flex !important; }
          .yard-mobile-legend{ display:none !important; }
          .mobile-legend     { display:none !important; }
          .mobile-hide       { display:none !important; }
        }
      `}</style>

      <Navbar />

      {/* ══ TOP BAR — Desktop ══ */}
      <div className="yard-desktop-only" style={{
        background:"rgba(8,14,28,0.98)",borderBottom:"1px solid #1e3a5f",
        flexShrink:0,alignItems:"center",flexWrap:"wrap",
        padding:"0 8px",gap:0,minHeight:52,zIndex:10,overflowX:"auto",
      }}>
        {/* Logo */}
        <div style={{display:"flex",alignItems:"center",gap:8,paddingRight:14,borderRight:"1px solid #1e3a5f",marginRight:12,flexShrink:0}}>
          <div style={{width:32,height:32,borderRadius:8,background:"linear-gradient(135deg,#3b82f6,#1e40af)",
            display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:14,color:"#fff",
            boxShadow:"0 0 14px #3b82f644"}}>Y</div>
          <div>
            <div style={{fontSize:10,fontWeight:800,color:"#f8fafc",letterSpacing:"0.05em"}}>YARD OS</div>
            <div style={{fontSize:7,color:"#3b82f6",letterSpacing:"0.2em"}}>3D YARD MGT</div>
          </div>
        </div>
        {/* Tier */}
        <div style={{display:"flex",gap:2,marginRight:10,flexShrink:0}}>
          {TIER_LABELS.map((t,i)=>{const tv=i===0?1:i+1;const ia=maxTier===tv||(i===3&&maxTier===4);return <span key={i}>{headerBtn(ia,()=>setMaxTier(tv),t)}</span>;})}
        </div>
        <div style={{width:1,height:26,background:"#1e3a5f",marginRight:10,flexShrink:0}}/>
        {/* Zone */}
        <div style={{display:"flex",gap:2,marginRight:10,flexShrink:0}}>
          {["All",...zoneOptions].map(z=>{const zc=z==="Import"?"#3b82f6":z==="Export"?"#ef4444":z==="Transit"?"#22c55e":"#94a3b8";return <span key={z}>{filterBtn(filterZone===z,()=>setFilterZone(z),z,zc)}</span>;})}
        </div>
        <div style={{width:1,height:26,background:"#1e3a5f",marginRight:10,flexShrink:0}}/>
        {/* Status */}
        <div style={{display:"flex",gap:2,marginRight:10,flexShrink:0}}>
          {filterBtn(filterStatus==="All",()=>setFilterStatus("All"),"All","#94a3b8")}
          {Object.entries(STATUS_COLORS).map(([s,sc])=>(
            <button key={s} onClick={()=>setFilterStatus(filterStatus===s?"All":s)} style={{padding:"3px 8px",borderRadius:5,fontSize:9,fontWeight:600,cursor:"pointer",fontFamily:"'JetBrains Mono',monospace",transition:"all 0.12s",background:filterStatus===s?`${sc.bg}22`:"transparent",border:`1px solid ${filterStatus===s?sc.bg+"66":"transparent"}`,color:filterStatus===s?sc.bg:"#adc8e0",display:"flex",alignItems:"center",gap:4,flexShrink:0}}>
              <div style={{width:5,height:5,borderRadius:"50%",background:sc.bg}}/>{sc.label}
            </button>
          ))}
        </div>
        <div style={{width:1,height:26,background:"#1e3a5f",marginRight:10,flexShrink:0}}/>
        {/* Block */}
        <div style={{display:"flex",gap:2,marginRight:10,flexShrink:0,overflowX:"auto",maxWidth:"25vw"}}>
          {filterBtn(filterBlock==="All",()=>{setFilterBlock("All");handleBack();},"All Blks","#94a3b8")}
          {yardBlocks.map(b=>{const zc=b.zone==="Import"?"#3b82f6":b.zone==="Export"?"#ef4444":"#22c55e";return <span key={b.id}>{filterBtn(filterBlock===b.id,()=>handleDrillBlock(b.id),b.name,zc)}</span>;})}
        </div>
        <div style={{flex:1}}/>
        {/* Color mode */}
        <div style={{display:"flex",gap:2,marginRight:10,flexShrink:0}}>
          {[["status","Status"],["line","Line"],["dwell","Dwell"],["size","Size"],["type","Type"]].map(([v,l])=><span key={v}>{filterBtn(colorMode===v,()=>setColorMode(v),l,"#6366f1")}</span>)}
        </div>
        <div style={{width:1,height:26,background:"#1e3a5f",marginRight:10,flexShrink:0}}/>
        {/* View toggle */}
        <div style={{display:"flex",gap:2,marginRight:10,flexShrink:0}}>
          {[["overview","🗺 Map"],["detail","⊞ Grid"]].map(([v,l])=><span key={v}>{filterBtn(viewMode===v,()=>{setViewMode(v);if(v==="overview"){setDrillBlock(null);setFilterBlock("All");}},l,"#3b82f6")}</span>)}
        </div>
        <div style={{width:1,height:26,background:"#1e3a5f",marginRight:10,flexShrink:0}}/>
        {/* Search */}
        <div style={{position:"relative",width:200,marginRight:10}}>
          <input value={searchQuery} onChange={e=>handleSearch(e.target.value)} placeholder="Search container…" style={{width:"100%",height:30,background:"rgba(255,255,255,0.06)",border:`1px solid ${searchResults!==null?"#3b82f6":"#1e3a5f"}`,borderRadius:6,padding:"0 30px 0 10px",color:"#eef3f8",fontSize:9,fontFamily:"'JetBrains Mono',monospace",outline:"none"}}/>
          <span style={{position:"absolute",right:8,top:"50%",transform:"translateY(-50%)",color:"#4d7a9e",fontSize:11}}>🔍</span>
          {searchResults!==null&&(<div style={{position:"absolute",right:0,top:"calc(100%+3px)",background:"rgba(8,14,28,0.98)",border:"1px solid #1e3a5f",borderRadius:5,padding:"2px 8px",fontSize:9,color:"#7fa8cc",whiteSpace:"nowrap",zIndex:20}}>{searchResults.size} result{searchResults.size!==1?"s":""} <button onClick={()=>{setSearchQuery("");setSearchResults(null);}} style={{marginLeft:6,background:"none",border:"none",color:"#ef4444",cursor:"pointer",fontSize:9}}>✕</button></div>)}
        </div>
        {/* Nav tabs */}
        <div style={{display:"flex",gap:2,flexShrink:0}}>
          {[["yard","🗂 Yard"],["analytics","📊"],["alerts","🔔"]].map(([v,l])=><span key={v}>{filterBtn(activeTab===v,()=>setActiveTab(v),l,"#a5b4fc")}</span>)}
        </div>
      </div>

      {/* ══ TOP BAR — Mobile ══ */}
      <div className="yard-mobile-only" style={{
        background:"rgba(8,14,28,0.98)",borderBottom:"1px solid #1e3a5f",
        flexShrink:0,alignItems:"center",
        padding:"0 10px",gap:8,height:50,zIndex:10,
      }}>
        {/* Title */}
        <div style={{display:"flex",alignItems:"center",gap:6,flex:1,minWidth:0}}>
          <div style={{width:28,height:28,borderRadius:7,background:"linear-gradient(135deg,#3b82f6,#1e40af)",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:13,color:"#fff",flexShrink:0}}>Y</div>
          <div style={{minWidth:0}}>
            <div style={{fontSize:10,fontWeight:800,color:"#f8fafc",letterSpacing:"0.04em",whiteSpace:"nowrap"}}>YARD OS</div>
            <div style={{fontSize:7,color:"#3b82f6",letterSpacing:"0.15em"}}>3D YARD MGT</div>
          </div>
        </div>

        {/* Search input */}
        <div style={{position:"relative",flex:"0 0 130px"}}>
          <input value={searchQuery} onChange={e=>handleSearch(e.target.value)} placeholder="Search…" style={{width:"100%",height:32,background:"rgba(255,255,255,0.08)",border:`1px solid ${searchResults!==null?"#3b82f6":"#2d4a6e"}`,borderRadius:8,padding:"0 28px 0 10px",color:"#eef3f8",fontSize:12,fontFamily:"'JetBrains Mono',monospace",outline:"none"}}/>
          <span style={{position:"absolute",right:8,top:"50%",transform:"translateY(-50%)",color:"#4d7a9e",fontSize:12}}>🔍</span>
        </div>

        {/* Nav tabs */}
        <div style={{display:"flex",gap:3,flexShrink:0}}>
          {[["yard","🗂"],["analytics","📊"],["alerts","🔔"]].map(([v,l])=>(
            <button key={v} onClick={()=>setActiveTab(v)} style={{width:32,height:32,borderRadius:7,border:`1px solid ${activeTab===v?"#a5b4fc66":"transparent"}`,background:activeTab===v?"rgba(165,180,252,0.15)":"transparent",color:activeTab===v?"#a5b4fc":"#7fa8cc",fontSize:14,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>{l}</button>
          ))}
        </div>

        {/* Filters toggle */}
        <button onClick={()=>setShowMobileControls(v=>!v)} style={{width:32,height:32,borderRadius:7,border:`1px solid ${showMobileControls?"#3b82f666":"#2d4a6e"}`,background:showMobileControls?"rgba(59,130,246,0.15)":"transparent",color:showMobileControls?"#60a5fa":"#7fa8cc",fontSize:14,cursor:"pointer",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>⚙</button>
      </div>

      {/* ══ MOBILE FILTERS SHEET ══ */}
      {showMobileControls && (
        <div className="yard-mobile-only" style={{
          background:"rgba(6,11,22,0.99)",borderBottom:"1px solid #1e3a5f",
          flexShrink:0,flexDirection:"column",gap:12,padding:"12px 14px",zIndex:9,overflowY:"auto",maxHeight:"55vh",
        }}>
          {/* Tier */}
          <div>
            <div style={{fontSize:9,color:"#4d7a9e",letterSpacing:"0.14em",marginBottom:6,textTransform:"uppercase"}}>Tier View</div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              {TIER_LABELS.map((t,i)=>{const tv=i===0?1:i+1;const ia=maxTier===tv||(i===3&&maxTier===4);return(
                <button key={i} onClick={()=>setMaxTier(tv)} style={{padding:"8px 16px",borderRadius:8,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"'JetBrains Mono',monospace",background:ia?"#ef4444":"rgba(255,255,255,0.07)",border:`1px solid ${ia?"#ef4444":"#2d4a6e"}`,color:ia?"#fff":"#c8d8ea",minHeight:40}}>{t}</button>
              );})}
            </div>
          </div>
          {/* Zone */}
          <div>
            <div style={{fontSize:9,color:"#4d7a9e",letterSpacing:"0.14em",marginBottom:6,textTransform:"uppercase"}}>Zone</div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              {["All",...zoneOptions].map(z=>{const zc=z==="Import"?"#3b82f6":z==="Export"?"#ef4444":z==="Transit"?"#22c55e":"#94a3b8";const ia=filterZone===z;return(
                <button key={z} onClick={()=>setFilterZone(z)} style={{padding:"8px 16px",borderRadius:8,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"'JetBrains Mono',monospace",background:ia?`${zc}22`:"rgba(255,255,255,0.07)",border:`1px solid ${ia?zc+"66":"#2d4a6e"}`,color:ia?zc:"#c8d8ea",minHeight:40}}>{z}</button>
              );})}
            </div>
          </div>
          {/* Status */}
          <div>
            <div style={{fontSize:9,color:"#4d7a9e",letterSpacing:"0.14em",marginBottom:6,textTransform:"uppercase"}}>Status</div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              {[["All","#94a3b8"],...Object.entries(STATUS_COLORS).map(([s,sc])=>[s,sc.bg])].map(([s,col])=>{const ia=filterStatus===s;return(
                <button key={s} onClick={()=>setFilterStatus(ia&&s!=="All"?"All":s)} style={{padding:"8px 14px",borderRadius:8,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"'JetBrains Mono',monospace",background:ia?`${col}22`:"rgba(255,255,255,0.07)",border:`1px solid ${ia?col+"66":"#2d4a6e"}`,color:ia?col:"#c8d8ea",display:"flex",alignItems:"center",gap:6,minHeight:40}}>
                  <div style={{width:7,height:7,borderRadius:"50%",background:col,flexShrink:0}}/>
                  {s==="All"?"All":STATUS_COLORS[s]?.label||s}
                </button>
              );})}
            </div>
          </div>
          {/* Color mode */}
          <div>
            <div style={{fontSize:9,color:"#4d7a9e",letterSpacing:"0.14em",marginBottom:6,textTransform:"uppercase"}}>Color By</div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              {[["status","Status"],["line","Line"],["dwell","Dwell"],["size","Size"],["type","Type"]].map(([v,l])=>{const ia=colorMode===v;return(
                <button key={v} onClick={()=>setColorMode(v)} style={{padding:"8px 16px",borderRadius:8,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"'JetBrains Mono',monospace",background:ia?"#6366f122":"rgba(255,255,255,0.07)",border:`1px solid ${ia?"#6366f166":"#2d4a6e"}`,color:ia?"#818cf8":"#c8d8ea",minHeight:40}}>{l}</button>
              );})}
            </div>
          </div>
          {/* View mode */}
          <div>
            <div style={{fontSize:9,color:"#4d7a9e",letterSpacing:"0.14em",marginBottom:6,textTransform:"uppercase"}}>View Mode</div>
            <div style={{display:"flex",gap:6}}>
              {[["overview","🗺 Map"],["detail","⊞ Grid"]].map(([v,l])=>{const ia=viewMode===v;return(
                <button key={v} onClick={()=>{setViewMode(v);if(v==="overview"){setDrillBlock(null);setFilterBlock("All");}setShowMobileControls(false);}} style={{flex:1,padding:"10px",borderRadius:8,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"'JetBrains Mono',monospace",background:ia?"rgba(59,130,246,0.2)":"rgba(255,255,255,0.07)",border:`1px solid ${ia?"#3b82f666":"#2d4a6e"}`,color:ia?"#60a5fa":"#c8d8ea",minHeight:44}}>{l}</button>
              );})}
            </div>
          </div>
          {/* Legend */}
          <div style={{display:"flex",gap:8,flexWrap:"wrap",paddingTop:8,borderTop:"1px solid #1e3a5f"}}>
            {Object.entries(STATUS_COLORS).map(([s,sc])=>(
              <div key={s} style={{display:"flex",alignItems:"center",gap:5}}>
                <div style={{width:10,height:7,background:sc.bg,borderRadius:2}}/>
                <span style={{fontSize:10,color:"#adc8e0"}}>{sc.label}</span>
              </div>
            ))}
          </div>
          {/* Done button */}
          <button onClick={()=>setShowMobileControls(false)} style={{width:"100%",padding:"12px",borderRadius:10,fontSize:13,fontWeight:800,cursor:"pointer",fontFamily:"'JetBrains Mono',monospace",background:"linear-gradient(135deg,#3b82f6,#1e40af)",border:"none",color:"#fff",marginTop:4}}>Done ✓</button>
        </div>
      )}

      {/* ══ CONTENT ══ */}
      <div style={{flex:1,display:"flex",overflow:"hidden"}}>

        {activeTab==="yard" && <>
          {/* Sidebar - collapsible, hide on mobile */}
          <div style={{
            width: sidebarOpen ? 168 : 32,
            flexShrink:0,background:"rgba(8,14,28,0.97)",
            borderRight:"1px solid #1e3a5f",
            padding: sidebarOpen ? "10px 8px" : "10px 4px",
            overflowY: sidebarOpen ? "auto" : "hidden",
            display:"flex",flexDirection:"column",gap:5,
            transition:"width 0.18s ease",
            position:"relative",
          }} className="mobile-hide">
            {/* collapse toggle */}
            <button onClick={()=>setSidebarOpen(v=>!v)} style={{
              position:"absolute",top:8,right:4,width:20,height:20,
              background:"rgba(30,58,95,0.8)",border:"1px solid #2d4a6e",
              borderRadius:4,color:"#60a5fa",cursor:"pointer",fontSize:10,
              display:"flex",alignItems:"center",justifyContent:"center",
              flexShrink:0,zIndex:2,padding:0,
            }}>{sidebarOpen ? "◀" : "▶"}</button>
            {!sidebarOpen && <div style={{flex:1}}/>}
            {sidebarOpen && <>
            <div style={{fontSize:7,color:"#4d7a9e",letterSpacing:"0.16em",marginBottom:1,marginTop:8}}>YARD STATUS</div>
            <StatCard label="Total CTRs" value={stats.total.toLocaleString()} sub={`of ${stats.capacity} cap`} icon="📦" color="#3b82f6"/>
            <StatCard label="Occupancy" value={`${stats.occupancy}%`} sub={`${stats.total} active`} icon="📊"
              color={stats.occupancy>85?"#ef4444":stats.occupancy>65?"#f59e0b":"#22c55e"}/>
            <StatCard label="Avg Dwell" value={`${stats.avgDwell}d`} sub={`${stats.overdwell} overdwell`} icon="⏱"
              color={stats.avgDwell>7?"#ef4444":"#f59e0b"}/>

            <div style={{fontSize:7,color:"#4d7a9e",letterSpacing:"0.16em",margin:"5px 0 1px"}}>BY STATUS</div>
            {Object.entries(STATUS_COLORS).map(([s,sc])=>(
              <div key={s} onClick={()=>setFilterStatus(filterStatus===s?"All":s)}
                style={{display:"flex",alignItems:"center",justifyContent:"space-between",
                  padding:"4px 7px",borderRadius:5,cursor:"pointer",
                  background:filterStatus===s?`${sc.bg}18`:"rgba(255,255,255,0.03)",
                  border:`1px solid ${filterStatus===s?sc.bg+"44":"transparent"}`,
                }}>
                <div style={{display:"flex",alignItems:"center",gap:5}}>
                  <div style={{width:7,height:7,borderRadius:"50%",background:sc.bg}}/>
                  <span style={{fontSize:8,color:"#c8d8ea"}}>{sc.label}</span>
                </div>
                <span style={{fontSize:10,fontWeight:700,color:sc.bg}}>{stats.byStatus[s]||0}</span>
              </div>
            ))}

            <div style={{fontSize:7,color:"#4d7a9e",letterSpacing:"0.16em",margin:"5px 0 1px"}}>BY ZONE</div>
            {zoneOptions.map(zone=>{
              const cnt=filteredContainers.filter(c=>c.zone===zone).length;
              const zc=zone==="Import"?"#3b82f6":zone==="Export"?"#ef4444":"#22c55e";
              return (
                <div key={zone} onClick={()=>setFilterZone(filterZone===zone?"All":zone)}
                  style={{display:"flex",alignItems:"center",justifyContent:"space-between",
                    padding:"4px 7px",borderRadius:5,cursor:"pointer",
                    background:filterZone===zone?`${zc}18`:"rgba(255,255,255,0.03)",
                    border:`1px solid ${filterZone===zone?zc+"44":"transparent"}`,
                  }}>
                  <div style={{display:"flex",alignItems:"center",gap:5}}>
                    <div style={{width:7,height:7,borderRadius:"50%",background:zc}}/>
                    <span style={{fontSize:8,color:"#c8d8ea"}}>{zone}</span>
                  </div>
                  <span style={{fontSize:10,fontWeight:700,color:zc}}>{cnt}</span>
                </div>
              );
            })}

            {/* Legend */}
            <div style={{marginTop:"auto",paddingTop:8,borderTop:"1px solid #1e3a5f"}}>
              <div style={{fontSize:7,color:"#4d7a9e",letterSpacing:"0.16em",marginBottom:4}}>COLOUR MODE: {colorMode.toUpperCase()}</div>
              {colorMode==="status"&&Object.entries(STATUS_COLORS).map(([s,sc])=>(
                <div key={s} style={{display:"flex",alignItems:"center",gap:4,marginBottom:2}}>
                  <div style={{width:11,height:6,background:sc.bg,borderRadius:1}}/>
                  <span style={{fontSize:8,color:"#adc8e0"}}>{sc.label}</span>
                </div>
              ))}
              {colorMode==="dwell"&&[["≤3d","#22c55e"],["4–7d","#f59e0b"],[">7d","#ef4444"]].map(([l,c])=>(
                <div key={l} style={{display:"flex",alignItems:"center",gap:4,marginBottom:2}}>
                  <div style={{width:11,height:6,background:c,borderRadius:1}}/>
                  <span style={{fontSize:8,color:"#adc8e0"}}>{l}</span>
                </div>
              ))}
              {colorMode==="size"&&[["20ft","#6366f1"],["40ft","#f97316"]].map(([l,c])=>(
                <div key={l} style={{display:"flex",alignItems:"center",gap:4,marginBottom:2}}>
                  <div style={{width:11,height:6,background:c,borderRadius:1}}/>
                  <span style={{fontSize:8,color:"#adc8e0"}}>{l}</span>
                </div>
              ))}
              {colorMode==="type"&&[["GP","#22c55e"],["HC","#06b6d4"],["RF","#a855f7"],["OT","#f59e0b"],["FR","#ef4444"]].map(([l,c])=>(
                <div key={l} style={{display:"flex",alignItems:"center",gap:4,marginBottom:2}}>
                  <div style={{width:11,height:6,background:c,borderRadius:1}}/>
                  <span style={{fontSize:8,color:"#adc8e0"}}>{l}</span>
                </div>
              ))}
              {colorMode==="line"&&getActiveLines(containers).map(({label,color})=>(
                <div key={label} style={{display:"flex",alignItems:"center",gap:4,marginBottom:2}}>
                  <div style={{width:11,height:6,background:color,borderRadius:1,border:"1px solid rgba(0,0,0,0.25)"}}/>
                  <span style={{fontSize:8,color:"#adc8e0"}}>{label}</span>
                </div>
              ))}
            </div>
            </>}
          </div>

          {/* Main area */}
          <div style={{flex:1,overflow:"hidden",position:"relative"}}>
            <YardOverview3D
              layoutData={layoutData}
              site="sahnewal"
              containers={filteredContainers}
              filterStatus={filterStatus}
              filterZone={filterZone}
              maxTier={maxTier}
              colorMode={colorMode}
              highlightedIds={searchResults}
              selectedId={selectedContainer?.id}
              onSelect={setSelectedContainer}
              onDrillBlock={(id) => drillBlock && drillBlock === id ? handleBack() : handleDrillBlock(id)}
              drillBlock={drillBlock}
              getContainerColor={getContainerColor}
              YARD_BLOCKS={yardBlocks}
            />
            {drillBlock && (
              <div style={{ position:"absolute", top:16, left:16, zIndex:10 }}>
                <button 
                  onClick={handleBack} 
                  style={{ background:"rgba(10,18,36,0.9)", padding:"8px 16px", borderRadius:6, color:"#60a5fa", border:"1px solid #3b82f6", cursor:"pointer", fontFamily:"'JetBrains Mono',monospace", fontWeight:700, fontSize:11, boxShadow:"0 4px 12px rgba(0,0,0,0.5)"}}>
                   ← BACK TO OVERVIEW
                </button>
              </div>
            )}
            
            {viewMode!=="overview" && !drillBlock && (
              /* All-blocks detail */
              <div style={{overflowY:"auto",height:"100%",padding:"14px 16px"}}>
                {zoneOptions.map(zone=>{
                  const zBlocks=yardBlocks.filter(b=>b.zone===zone&&(filterZone==="All"||filterZone===zone));
                  if (!zBlocks.length) return null;
                  const zc=zone==="Import"?"#3b82f6":zone==="Export"?"#ef4444":"#22c55e";
                  return (
                    <div key={zone} style={{marginBottom:22}}>
                      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                        <div style={{height:1,flex:1,background:`linear-gradient(to right,${zc}44,transparent)`}}/>
                        <span style={{fontSize:9,fontWeight:700,color:zc,padding:"2px 12px",borderRadius:20,
                          border:`1px solid ${zc}44`,background:`${zc}11`}}>
                          {zone==="Import"?"🔵":zone==="Export"?"🔴":"🟢"} {zone.toUpperCase()} ZONE
                        </span>
                        <div style={{height:1,flex:1,background:`linear-gradient(to left,${zc}44,transparent)`}}/>
                      </div>
                      <div style={{display:"flex",flexWrap:"wrap",gap:10}}>
                        {zBlocks.map(block=>(
                          <div key={block.id} style={{background:"rgba(13,24,44,0.85)",border:`1px solid ${zc}33`,borderRadius:8,padding:"9px 11px",minWidth:0}}>
                            <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:7}}>
                              <div style={{width:6,height:6,borderRadius:"50%",background:zc}}/>
                              <span style={{color:"#eef3f8",fontSize:10,fontWeight:700}}>{block.name}</span>
                              <button onClick={()=>handleDrillBlock(block.id)} style={{
                                marginLeft:"auto",background:"transparent",border:"1px solid #2d4a6e",
                                color:"#7fa8cc",cursor:"pointer",borderRadius:4,padding:"1px 7px",fontSize:8,
                                fontFamily:"'JetBrains Mono',monospace",
                              }}>Expand</button>
                            </div>
                            {Array.from({length:block.rows},(_,ri)=>ri+1).map(row=>{
                              const rowCtrs=filteredContainers.filter(c=>c.block===block.id&&c.row===row&&c.tier<=maxTier);
                              const bySlot={};
                              rowCtrs.forEach(c=>{if(!bySlot[c.slot])bySlot[c.slot]=[];bySlot[c.slot].push(c);});
                              const skipSlots = new Set();
                              return (
                                <div key={row} style={{display:"flex",gap:2,marginBottom:2,alignItems:"flex-end"}}>
                                  <span style={{width:16,fontSize:7,color:"#4d7a9e",textAlign:"right",flexShrink:0,fontFamily:"monospace"}}>{row}</span>
                                  {Array.from({length:block.slots},(_,si)=>si+1).map(slot=>{
                                    if (skipSlots.has(slot)) return null;

                                    const stack=bySlot[slot]||[];
                                    const has40ft = stack.some(c=>c.size==="40ft");
                                    if (has40ft) skipSlots.add(slot+1);

                                    return (
                                      <div key={slot} style={{display:"flex",flexDirection:"column-reverse",gap:1,minWidth:has40ft?46:22}}>
                                        {stack.length===0?(
                                          <div style={{width:22,height:12,borderRadius:2,background:"#0d1b2e",border:"1px solid #1e3a5f",opacity:0.55}}/>
                                        ):stack.sort((a,b)=>a.tier-b.tier).map(c=>{
                                          const bg=getContainerColor(c,colorMode);
                                          const is40 = c.size==="40ft";
                                          return (
                                            <div key={c.id} onClick={()=>setSelectedContainer(c)}
                                              title={`${c.containerNo} | ${c.size}`}
                                              style={{
                                                width:is40?46:22,height:12,
                                                background:"#1a2840",border:`1.5px solid ${bg}`,borderRadius:2,
                                                cursor:"pointer",boxShadow:`0 0 4px ${bg}66`,
                                                display:"flex",alignItems:"center",justifyContent:"center",
                                              }}>
                                              {c.status==="hold"&&<span style={{fontSize:5,color:"#fff",fontWeight:700}}>H</span>}
                                              {c.status==="damaged"&&<span style={{fontSize:5,color:"#fff",fontWeight:700}}>!</span>}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    );
                                  })}
                                </div>
                              );
                            })}
                            <div style={{marginTop:5,fontSize:8,color:"#4d7a9e",fontFamily:"monospace"}}>
                              {filteredContainers.filter(c=>c.block===block.id).length} CTRs
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>}

        {activeTab==="analytics" && (
          <div style={{flex:1,padding:20,display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(270px,1fr))",gap:12,overflowY:"auto",alignContent:"start"}}>
            <div style={{background:"rgba(13,24,44,0.85)",border:"1px solid #1e3a5f",borderRadius:10,padding:16}}>
              <div style={{fontSize:9,color:"#adc8e0",letterSpacing:"0.1em",marginBottom:12}}>BLOCK OCCUPANCY</div>
              {yardBlocks.map(b=>{
                const cnt=filteredContainers.filter(c=>c.block===b.id).length;
                const cap=b.rows*b.slots*b.maxTiers;
                const pct=cap?Math.round(cnt/cap*100):0;
                const col=pct>85?"#ef4444":pct>65?"#f59e0b":"#22c55e";
                return (
                  <div key={b.id} style={{marginBottom:9}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                      <span style={{fontSize:9,color:"#b8d0e8"}}>{b.name}</span>
                      <span style={{fontSize:9,color:col,fontWeight:700}}>{pct}%</span>
                    </div>
                    <div style={{height:5,background:"#1e3a5f",borderRadius:3,overflow:"hidden"}}>
                      <div style={{width:`${pct}%`,height:"100%",background:col,borderRadius:3}}/>
                    </div>
                    <div style={{fontSize:7,color:"#4d7a9e",marginTop:2}}>{cnt}/{cap} TEU</div>
                  </div>
                );
              })}
            </div>

            <div style={{background:"rgba(13,24,44,0.85)",border:"1px solid #1e3a5f",borderRadius:10,padding:16}}>
              <div style={{fontSize:9,color:"#adc8e0",letterSpacing:"0.1em",marginBottom:12}}>DWELL DISTRIBUTION</div>
              {[["0–3d Fresh",0,3,"#22c55e"],["4–7d Normal",4,7,"#f59e0b"],["8–14d Warning",8,14,"#f97316"],["15+d Critical",15,999,"#ef4444"]].map(([l,mn,mx,c])=>{
                const cnt=filteredContainers.filter(x=>x.dwellDays>=mn&&x.dwellDays<=mx).length;
                const pct=filteredContainers.length?Math.round(cnt/filteredContainers.length*100):0;
                return (
                  <div key={l} style={{display:"flex",alignItems:"center",gap:9,marginBottom:9}}>
                    <div style={{width:7,height:7,borderRadius:"50%",background:c,flexShrink:0}}/>
                    <div style={{flex:1}}>
                      <div style={{display:"flex",justifyContent:"space-between"}}>
                        <span style={{fontSize:9,color:"#b8d0e8"}}>{l}</span>
                        <span style={{fontSize:9,color:c,fontWeight:700}}>{cnt}</span>
                      </div>
                      <div style={{height:4,background:"#1e3a5f",borderRadius:2,overflow:"hidden",marginTop:2}}>
                        <div style={{width:`${pct}%`,height:"100%",background:c,borderRadius:2}}/>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{background:"rgba(13,24,44,0.85)",border:"1px solid #1e3a5f",borderRadius:10,padding:16}}>
              <div style={{fontSize:9,color:"#adc8e0",letterSpacing:"0.1em",marginBottom:12}}>STATUS BREAKDOWN</div>
              {Object.entries(STATUS_COLORS).map(([s,sc])=>{
                const cnt=filteredContainers.filter(c=>c.status===s).length;
                const pct=filteredContainers.length?Math.round(cnt/filteredContainers.length*100):0;
                return (
                  <div key={s} style={{marginBottom:8}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                      <span style={{fontSize:9,color:sc.bg}}>{sc.label}</span>
                      <span style={{fontSize:9,color:"#b8d0e8"}}>{cnt} ({pct}%)</span>
                    </div>
                    <div style={{height:5,background:"#1e3a5f",borderRadius:3,overflow:"hidden"}}>
                      <div style={{width:`${pct}%`,height:"100%",background:sc.bg,borderRadius:3}}/>
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{background:"rgba(13,24,44,0.85)",border:"1px solid #1e3a5f",borderRadius:10,padding:16}}>
              <div style={{fontSize:9,color:"#adc8e0",letterSpacing:"0.1em",marginBottom:12}}>TOP CUSTOMERS</div>
              {Object.entries(filteredContainers.reduce((a,c)=>{a[c.customer]=(a[c.customer]||0)+1;return a;},{}))
                .sort((a,b)=>b[1]-a[1]).slice(0,8).map(([cust,cnt],i)=>(
                <div key={cust} style={{display:"flex",alignItems:"center",gap:7,marginBottom:7}}>
                  <span style={{fontSize:7,color:"#4d7a9e",width:14}}>#{i+1}</span>
                  <span style={{fontSize:8,color:"#b8d0e8",flex:1}}>{cust}</span>
                  <div style={{width:52,height:4,background:"#1e3a5f",borderRadius:2,overflow:"hidden"}}>
                    <div style={{width:`${Math.min(cnt/filteredContainers.length*400,100)}%`,height:"100%",background:"#3b82f6",borderRadius:2}}/>
                  </div>
                  <span style={{fontSize:9,color:"#3b82f6",fontWeight:700,width:24,textAlign:"right"}}>{cnt}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab==="alerts" && (
          <div style={{flex:1,padding:22,overflowY:"auto"}}>
            <div style={{fontSize:9,color:"#adc8e0",letterSpacing:"0.1em",marginBottom:12}}>ACTIVE ALERTS</div>
            {[
              {level:"critical",icon:"🔴",msg:`${stats.byStatus.damaged} containers marked DAMAGED — inspection required`,time:"Now"},
              {level:"critical",icon:"🔴",msg:`${stats.overdwell} containers exceed 7-day dwell threshold`,time:"Now"},
              {level:"warning",icon:"🟡",msg:`${stats.byStatus.hold} containers on HOLD — verify release authorization`,time:"Now"},
              {level:"warning",icon:"🟡",msg:"Block D approaching capacity — pre-allocate overflow space",time:"2m ago"},
              {level:"info",icon:"🔵",msg:`${stats.byStatus.reefer} reefer containers — verify power connections`,time:"5m ago"},
              {level:"info",icon:"🔵",msg:"MV Pacific Star arriving tomorrow — pre-plan space allocation",time:"10m ago"},
            ].map((a,i)=>(
              <div key={i} style={{
                display:"flex",alignItems:"flex-start",gap:11,padding:"11px 14px",borderRadius:7,marginBottom:7,
                background:a.level==="critical"?"rgba(239,68,68,0.08)":a.level==="warning"?"rgba(245,158,11,0.08)":"rgba(59,130,246,0.08)",
                border:`1px solid ${a.level==="critical"?"#ef444422":a.level==="warning"?"#f59e0b22":"#3b82f622"}`,
              }}>
                <span style={{fontSize:13}}>{a.icon}</span>
                <div style={{flex:1}}>
                  <div style={{fontSize:10,color:"#eef3f8"}}>{a.msg}</div>
                  <div style={{fontSize:8,color:"#7fa8cc",marginTop:2}}>{a.time}</div>
                </div>
                <button style={{background:"none",border:"1px solid #1e3a5f",color:"#adc8e0",
                  borderRadius:4,padding:"2px 9px",cursor:"pointer",fontSize:8,fontFamily:"'JetBrains Mono',monospace"}}>Ack</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Container Detail Panel */}
      <ContainerDetailPanel container={selectedContainer} onClose={()=>setSelectedContainer(null)}/>

      {/* Status bar */}
      <div style={{
        height:28,background:"rgba(6,11,22,0.99)",borderTop:"1px solid #1e3a5f",
        display:"flex",alignItems:"center",paddingInline:10,gap:12,flexShrink:0,
        fontSize:9,color:"#7fa8cc",fontFamily:"'JetBrains Mono',monospace",zIndex:10,
        overflowX:"auto",whiteSpace:"nowrap",
      }}>
        <span style={{display:"flex",alignItems:"center",gap:4,color:"#22c55e",flexShrink:0}}>
          <span style={{width:5,height:5,borderRadius:"50%",background:"#22c55e",display:"inline-block",boxShadow:"0 0 5px #22c55e"}}/>
          LIVE
        </span>
        <span style={{color:"#c8d8ea",flexShrink:0}}>YARD_001</span>
        <span style={{color:"#4d7a9e",flexShrink:0}} className="mobile-hide">·</span>
        <span className="mobile-hide">{stats.total.toLocaleString()} containers · {stats.occupancy}% occupied</span>
        <span style={{color:"#4d7a9e",flexShrink:0}} className="mobile-hide">·</span>
        <span className="mobile-hide">Avg dwell {stats.avgDwell}d</span>
        <span style={{color:"#4d7a9e",flexShrink:0}} className="mobile-hide">·</span>
        <span style={{color:"#f59e0b",flexShrink:0}} className="mobile-hide">{stats.overdwell} overdwell</span>
        <div style={{marginLeft:"auto",display:"flex",gap:14,color:"#4d7a9e",flexShrink:0}}>
          <span className="mobile-hide">Zone:{filterZone}</span>
          <span className="mobile-hide">Status:{filterStatus}</span>
          <span className="mobile-hide">Block:{filterBlock}</span>
          <span>T:1–{maxTier}</span>
          <span style={{color:"#2d4a6e"}}>{new Date().toLocaleTimeString()}</span>
        </div>
      </div>
    </div>
  );
}
