// Light-theme design tokens for the Yard Command Center.
// Mirrors the AdminDashboard / DeveloperDashboard palette so the page sits
// naturally beside them visually.

export const T = {
  bg:        "#f0f4ff",
  bg2:       "#e8eeff",
  card:      "#ffffff",
  cardSoft:  "linear-gradient(145deg, #ffffff, #f8faff)",
  border:    "rgba(148,163,184,0.22)",
  borderHi:  "rgba(100,116,139,0.38)",

  text:      "#0f172a",
  textDim:   "#374151",
  textMute:  "#6b7280",

  cyan:      "#0891b2",
  blue:      "#2563eb",
  indigo:    "#4f46e5",
  purple:    "#7c3aed",
  pink:      "#db2777",
  red:       "#dc2626",
  orange:    "#ea580c",
  amber:     "#d97706",
  emerald:   "#059669",
  teal:      "#0d9488",
  slate:     "#64748b",

  accent:    "#0891b2",
  danger:    "#dc2626",
  warn:      "#d97706",
  info:      "#0891b2",
  ok:        "#059669",

  shadow:    "0 2px 12px -2px rgba(99,102,241,0.10), 0 1px 3px rgba(0,0,0,0.06)",
  shadowLg:  "0 8px 24px rgba(99,102,241,0.15), 0 2px 8px rgba(0,0,0,0.08)",
};

// Status colour reference, used everywhere we show a status pill or dot.
export const STATUS_COLORS = {
  full:    T.blue,
  empty:   T.slate,
  damaged: T.red,
  hold:    T.amber,
  reefer:  T.cyan,
  hazmat:  T.orange,
};

export const STATUS_LABELS = {
  full:    "Full",
  empty:   "Empty",
  damaged: "Damaged",
  hold:    "Hold",
  reefer:  "Reefer",
  hazmat:  "Hazmat",
};
