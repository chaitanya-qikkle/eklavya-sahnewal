// Realistic shipping container palette.
// Picks a colour for a container based on ISO 6346 owner-code prefix
// (e.g. MSKU = Maersk navy, MSCU = MSC yellow). Status takes precedence
// so damaged / reefer / hazmat always read at a glance.

// Common carrier liveries (rough but recognisable on a yard).
const CARRIER_COLORS = {
  // Maersk family — deep navy
  MSK: "#0033A0", MAE: "#0033A0", MRK: "#0033A0", PON: "#0033A0", SAF: "#0033A0",
  // MSC — golden yellow
  MSC: "#E4A11B", MED: "#E4A11B",
  // CMA CGM — royal blue
  CMA: "#1F4E96", ECM: "#1F4E96", CXD: "#1F4E96",
  // Hapag-Lloyd — orange
  HLB: "#F58220", HLX: "#F58220", HAS: "#F58220", UAC: "#F58220",
  // COSCO — china red
  COS: "#D5212E", CCL: "#D5212E", CBH: "#D5212E", CSL: "#D5212E",
  // Evergreen — forest green
  EGH: "#147E3D", EIS: "#147E3D", EMC: "#147E3D", EIT: "#147E3D", EGS: "#147E3D",
  // ONE — magenta/pink
  ONE: "#E91E63", ONU: "#E91E63", NYK: "#E91E63", MOL: "#E91E63",
  // Hamburg Süd — red
  SUD: "#C8102E", HSD: "#C8102E", SUDU: "#C8102E",
  // ZIM — green
  ZIM: "#10A776", ZMO: "#10A776", ZCS: "#10A776",
  // Yang Ming — battleship grey/blue
  YML: "#3F5263", YMM: "#3F5263", YMA: "#3F5263",
  // HMM — light blue
  HMM: "#1B73B9", HDM: "#1B73B9",
  // OOCL — brick red
  OOL: "#9B2A2A", OOC: "#9B2A2A",
  // PIL — golden
  PIL: "#E0A82E",
  // K-Line — red
  KKF: "#E60012", KKL: "#E60012", KKT: "#E60012",
  // Triton lessor — steel blue
  TGH: "#2C6EB4", TCN: "#2C6EB4", TRI: "#2C6EB4",
  // Textainer lessor — muted steel
  TEM: "#5E6B78", TXG: "#5E6B78",
  // SeaCo lessor — sand
  SEG: "#B49464",
  // Beacon lessor — taupe
  BEA: "#7F6F5E",
};

// Anonymous palette used when owner code isn't in our table — classic
// weathered container colours you'd see at any CFS.
const ANON_PALETTE = [
  "#8B3A2F", // brick red
  "#B85C3A", // rust orange
  "#2E5C4D", // dark teal
  "#3A6E8F", // steel blue
  "#5C6B4B", // olive green
  "#6E4A2F", // brown
  "#8C7A5C", // sand
  "#A45B3A", // terracotta
  "#3F4D5C", // gunmetal
  "#5E4A6B", // muted purple
  "#7A6B3A", // mustard
  "#5C3A3A", // oxblood
];

// Status overrides — these always win so the operator can spot issues.
const STATUS_OVERRIDES = {
  damaged: "#6B3522",   // rust brown
  reefer:  "#E5E7EB",   // refrigerated containers are nearly always white
  hazmat:  "#FF6A00",   // bright hazard orange
  hold:    "#FFC107",   // amber on-hold
};

function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

// Returns a hex colour for a container.
// container: { containerNo, status, type, _fromDevice? }
export function realContainerColor(container) {
  if (!container) return "#8B3A2F";
  if (container._fromDevice) return "#F59E0B"; // amber pin for device-injected
  const status = String(container.status || "").toLowerCase();
  if (STATUS_OVERRIDES[status]) return STATUS_OVERRIDES[status];
  // RF reefer type also gets white even if status not set explicitly
  if (String(container.type || "").toUpperCase() === "RF") return STATUS_OVERRIDES.reefer;

  const cn = String(container.containerNo || container.id || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  // ISO 6346 owner code is the first 3 letters; equipment category is the 4th.
  const prefix3 = cn.slice(0, 3);
  if (CARRIER_COLORS[prefix3]) return CARRIER_COLORS[prefix3];
  const prefix4 = cn.slice(0, 4);
  if (CARRIER_COLORS[prefix4]) return CARRIER_COLORS[prefix4];

  // Deterministic anonymous colour so the same container always renders
  // the same shade across re-renders.
  const seed = cn || String(container.id || "");
  return ANON_PALETTE[hashStr(seed) % ANON_PALETTE.length];
}
