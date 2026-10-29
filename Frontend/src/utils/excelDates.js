import * as XLSX from 'xlsx'

// Excel exports: turn date-looking text cells into REAL Excel dates (numeric
// serial + number format) so Excel's Date Filter / sorting works on them.
//
// Recognised (whole cell only):
//   dd-mm-yyyy | dd/mm/yyyy        [HH:mm[:ss]]
//   yyyy-mm-dd                     [ T HH:mm[:ss[.fff]]] [Z]
// Anything else (container numbers, free text, headers) is left untouched.

const DMY = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/
const YMD = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)?$/

// Month label as used by the month-wise exports, e.g. "Oct-2026"
const MON_YEAR = /^([A-Za-z]{3})-(\d{4})$/
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

// Empty-value placeholders the UI formatters write ("—", "-", and the
// mojibake form "â€”" seen when the source file was mis-decoded).
const PLACEHOLDER = /^(?:[-–—]|â€”|â€“|N\/A)$/i

const DATE_FMT = 'dd/mm/yyyy'
const MONTH_FMT = 'mmm-yyyy'
const DATETIME_FMT = 'dd/mm/yyyy hh:mm'
const DATETIME_SEC_FMT = 'dd/mm/yyyy hh:mm:ss'

// -> { serial, fmt } or null
export function parseDateCell(val) {
  const str = String(val).trim()
  if (!str) return null

  const my = str.match(MON_YEAR)
  if (my) {
    const mIdx = MONTHS.indexOf(my[1].toLowerCase())
    if (mIdx === -1) return null
    return { serial: Date.UTC(+my[2], mIdx, 1) / 86400000 + 25569, fmt: MONTH_FMT }
  }

  let y, m, d, h, mi, s, hasTime, hasSec
  let match = str.match(DMY)
  if (match) {
    d = +match[1]; m = +match[2]; y = +match[3]
    hasTime = match[4] !== undefined
    hasSec = match[6] !== undefined
    h = +(match[4] || 0); mi = +(match[5] || 0); s = +(match[6] || 0)
  } else {
    match = str.match(YMD)
    if (!match) return null
    y = +match[1]; m = +match[2]; d = +match[3]
    hasTime = match[4] !== undefined
    hasSec = match[6] !== undefined
    h = +(match[4] || 0); mi = +(match[5] || 0); s = +(match[6] || 0)
  }

  if (m < 1 || m > 12 || d < 1 || d > 31 || h > 23 || mi > 59 || s > 59) return null
  if (y < 1900 || y > 2200) return null

  // Date.UTC with the local fields -> no timezone shift once Excel renders it.
  const ms = Date.UTC(y, m - 1, d, h, mi, s)
  const chk = new Date(ms)
  if (chk.getUTCMonth() !== m - 1 || chk.getUTCDate() !== d) return null // e.g. 31-02-2026

  const fmt = !hasTime ? DATE_FMT : hasSec ? DATETIME_SEC_FMT : DATETIME_FMT
  return { serial: ms / 86400000 + 25569, fmt }
}

// Mutates every sheet of the workbook in place.
export function convertSheetDates(ws) {
  if (!ws || !ws['!ref']) return
  const range = XLSX.utils.decode_range(ws['!ref'])
  const dateCols = new Set()

  for (let r = range.s.r; r <= range.e.r; r++) {
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c })]
      if (!cell || cell.t !== 's' || typeof cell.v !== 'string') continue
      const parsed = parseDateCell(cell.v)
      if (!parsed) continue
      cell.t = 'n'
      cell.v = parsed.serial
      cell.z = parsed.fmt
      delete cell.w
      dateCols.add(c)
    }
  }

  // A date column should hold only dates (or blanks) so Excel's Date Filter
  // works: "—" / "-" placeholders for missing dates become empty cells.
  if (dateCols.size) {
    for (let r = range.s.r; r <= range.e.r; r++) {
      dateCols.forEach((c) => {
        const addr = XLSX.utils.encode_cell({ r, c })
        const cell = ws[addr]
        if (cell && cell.t === 's' && PLACEHOLDER.test(String(cell.v).trim()) && r > range.s.r) {
          delete ws[addr]
        }
      })
    }
  }

  // Keep date columns wide enough (otherwise Excel shows ####).
  if (dateCols.size) {
    const cols = ws['!cols'] || []
    dateCols.forEach((c) => {
      const cur = cols[c] || {}
      cols[c] = { ...cur, wch: Math.max(cur.wch || 0, 19) }
    })
    ws['!cols'] = cols
  }
}

// Drop-in replacement for XLSX.writeFile(wb, filename).
export function writeXlsx(wb, filename, opts) {
  Object.values(wb.Sheets || {}).forEach(convertSheetDates)
  return XLSX.writeFile(wb, filename, opts)
}
