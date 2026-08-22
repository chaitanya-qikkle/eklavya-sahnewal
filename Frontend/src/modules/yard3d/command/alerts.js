// Alert engine — uses ONLY fields present in the backend response:
//   INVENTORY_STATUS  → hold / hazmat / damaged
//   CONTAINER_TYPE    → "RF" for reefers
//   DWELL_DAYS        → over-dwell flag
//   BLOCK_NAME        → block proximity for hazmat near reefer
//
// No synthetic vessels, cutoffs, tariffs, temperatures.

import { T, STATUS_LABELS } from "./theme";

export const SEVERITY = {
  danger: {
    id: "danger", label: "Danger", color: T.red,
    bg: "rgba(220,38,38,0.08)", border: "rgba(220,38,38,0.35)", rank: 0,
  },
  warn: {
    id: "warn",   label: "Warn",   color: T.amber,
    bg: "rgba(217,119,6,0.08)",  border: "rgba(217,119,6,0.35)",  rank: 1,
  },
  info: {
    id: "info",   label: "Info",   color: T.cyan,
    bg: "rgba(8,145,178,0.08)",  border: "rgba(8,145,178,0.35)",  rank: 2,
  },
};

export const buildAlerts = (containers) => {
  const alerts = [];
  const hazByBlock = new Map();

  for (const c of containers) {
    // Over-dwell — DWELL_DAYS
    if (c.dwellDays >= 7) {
      alerts.push({
        id: `dwell-${c.id}`,
        severity: c.dwellDays >= 14 ? "danger" : "warn",
        type: "overdwell",
        title: "Over-dwell zone",
        body: `${c.containerNo || "—"} parked ${c.dwellDays}d at ${c.block || "-"}`,
        containerId: c.id,
        containerNo: c.containerNo,
      });
    }

    // Customs hold — derived from INVENTORY_STATUS
    if (c.status === "hold") {
      alerts.push({
        id: `hold-${c.id}`,
        severity: "warn",
        type: "hold",
        title: "Customs hold",
        body: `${c.containerNo || "—"} under hold at ${c.block || "-"}`,
        containerId: c.id,
        containerNo: c.containerNo,
      });
    }

    // Damaged container — derived from INVENTORY_STATUS
    if (c.status === "damaged") {
      alerts.push({
        id: `dmg-${c.id}`,
        severity: "danger",
        type: "damaged",
        title: "Damaged container",
        body: `${c.containerNo || "—"} flagged damaged · ${c.block || "-"}`,
        containerId: c.id,
        containerNo: c.containerNo,
      });
    }

    if (c.status === "hazmat" && c.block) {
      const arr = hazByBlock.get(c.block) || [];
      arr.push(c);
      hazByBlock.set(c.block, arr);
    }
  }

  // Reefer near hazmat in same block
  for (const c of containers) {
    if (c.status === "hazmat" || !c.block) continue;
    if (c.status !== "reefer" && c.type !== "RF") continue;
    const hz = hazByBlock.get(c.block);
    if (hz && hz.length) {
      alerts.push({
        id: `hzx-${c.id}`,
        severity: "info",
        type: "hazmat",
        title: "Hazmat proximity",
        body: `Reefer ${c.containerNo} near hazmat in ${c.block}`,
        containerId: c.id,
        containerNo: c.containerNo,
      });
    }
  }

  return alerts.sort((a, b) => SEVERITY[a.severity].rank - SEVERITY[b.severity].rank);
};

// Aggregations
export const groupByStatus = (containers) => {
  const out = {};
  for (const k of Object.keys(STATUS_LABELS)) out[k] = 0;
  for (const c of containers) out[c.status] = (out[c.status] || 0) + 1;
  return out;
};

export const groupByBlock = (containers) => {
  const map = new Map();
  for (const c of containers) {
    const key = c.block || "(unassigned)";
    if (!map.has(key)) map.set(key, 0);
    map.set(key, map.get(key) + 1);
  }
  return Array.from(map.entries())
    .map(([block, count]) => ({ block, count }))
    .sort((a, b) => b.count - a.count);
};

export const groupBySizeType = (containers) => {
  const map = new Map();
  for (const c of containers) {
    const sz = c.size === "20ft" ? "20" : "40";
    const key = `${sz}${c.type || "GP"}`;
    map.set(key, (map.get(key) || 0) + 1);
  }
  return Array.from(map.entries())
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count);
};
