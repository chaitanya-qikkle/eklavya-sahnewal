
import io
import os
import re
import smtplib
import logging
from email.mime.application import MIMEApplication
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from datetime import datetime
from typing import List, Dict, Any, Optional

from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter

from utils.db_utils import SQLManager

logger = logging.getLogger(__name__)


# ── SMTP Config (from .env) ───────────────────────────────────────────────────
SMTP_HOST     = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT     = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER     = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SMTP_USE_TLS  = os.getenv("SMTP_USE_TLS", "true").lower() == "true"

# TO recipients — required
REPORT_RECIPIENTS: List[str] = [
    e.strip()
    for e in os.getenv("REPORT_RECIPIENTS", "adil.sayyad@qikkle.com").split(",")
    if e.strip()
]

REPORT_CC: List[str] = [
    e.strip()
    for e in os.getenv("REPORT_CC", "").split(",")
    if e.strip()
]

# ── Excel / procedure config ──────────────────────────────────────────────────
EXCEL_FILE_NAME = os.getenv("REPORT_EXCEL_NAME", "Automailer_report_in_OCR.xlsx")

PROC_WAREHOUSE_SUMMARY = "GET_DASHBOARD_WAREHOUSE_AUTOMAIL"   # YARDNAME, SIZE20, SIZE40, TOTAL, TEUS
PROC_YARD_SUMMARY      = "GET_DASHBOARD_YARDINVENTORY_AUTOMAIL"
PROC_YARD_DETAILS      = "GET_DASHBOARD_YARDINVENTORY_DETAILS_AUTOMAIL"

PROC_WAREHOUSE_DETAILS = os.getenv(
    "WAREHOUSE_DETAILS_PROC", "GET_DASHBOARD_WAREHOUSE_DETAILS_AUTOMAIL"
)

WAREHOUSE_BLOCK_ORDER = ["EXP-EX", "OWH"]


# ══════════════════════════════════════════════════════════════════════════════
# DATA FETCHING
# ══════════════════════════════════════════════════════════════════════════════

def _exec_proc(proc_name: str, fetch_all: bool = False) -> List[Dict[str, Any]]:
    """Helper — executes a stored procedure and returns the first result set."""
    db = SQLManager()
    try:
        result = db.execute_query(
            f"EXEC {proc_name}",
            fetch_all=fetch_all,
        )
        if result.get("status") != "success":
            logger.error("[%s] Procedure failed: %s", proc_name, result.get("message"))
            return []

        data = result.get("data", [])

        if fetch_all:
            # data is a list of result sets → take the first one
            return data[0] if data else []
        else:
            return data if isinstance(data, list) else []

    except Exception as exc:
        logger.exception("[%s] Error: %s", proc_name, exc)
        return []
    finally:
        db.close_connection()


def fetch_container_ageing_data() -> List[Dict[str, Any]]:
    """Warehouse summary (EXP-EX / OWH) from GET_DASHBOARD_WAREHOUSE_AUTOMAIL."""
    rows = _exec_proc(PROC_WAREHOUSE_SUMMARY, fetch_all=False)
    logger.info("Container ageing rows fetched: %d", len(rows))
    return rows


def fetch_yard_inventory_data() -> List[Dict[str, Any]]:
    """Yard Inventory summary from GET_DASHBOARD_YARDINVENTORY_AUTOMAIL."""
    rows = _exec_proc(PROC_YARD_SUMMARY, fetch_all=False)
    logger.info("Yard inventory rows fetched: %d", len(rows))
    return rows


def fetch_yard_details_data() -> List[Dict[str, Any]]:
    """Yard container list (for Excel) from GET_DASHBOARD_YARDINVENTORY_DETAILS_AUTOMAIL."""
    rows = _exec_proc(PROC_YARD_DETAILS, fetch_all=False)
    logger.info("Yard detail rows fetched: %d", len(rows))
    return rows


def fetch_warehouse_details_data() -> List[Dict[str, Any]]:
    """Warehouse container list (for Excel) from the warehouse details procedure."""
    rows = _exec_proc(PROC_WAREHOUSE_DETAILS, fetch_all=False)
    logger.info("Warehouse detail rows fetched: %d", len(rows))
    return rows


# ══════════════════════════════════════════════════════════════════════════════
# EXCEL BUILDER
# ══════════════════════════════════════════════════════════════════════════════

_XL_HEADER_FILL = PatternFill("solid", fgColor="7F7F7F")
_XL_HEADER_FONT = Font(bold=True, color="FFFFFF")
_XL_TITLE_FILL  = PatternFill("solid", fgColor="7F7F7F")
_XL_THIN        = Side(style="thin", color="000000")
_XL_BORDER      = Border(left=_XL_THIN, right=_XL_THIN, top=_XL_THIN, bottom=_XL_THIN)
_XL_CENTER      = Alignment(horizontal="center", vertical="center")


def _get(row: Dict[str, Any], *names: str) -> Any:
    """Case-insensitive column lookup (ContNo / CONTNO / contno all work)."""
    lowered = {str(k).lower(): v for k, v in row.items()}
    for n in names:
        if n.lower() in lowered:
            return lowered[n.lower()]
    return None


def _size_int(value: Any) -> int:
    """'20', '20HQ', 20 → 20 ;  '40', '40HQ' → 40 ;  anything else → 0."""
    m = re.match(r"\s*(\d+)", str(value or ""))
    return int(m.group(1)) if m else 0


def _fmt_dt(value: Any) -> str:
    if value is None or value == "":
        return ""
    if isinstance(value, datetime):
        return value.strftime("%d-%m-%Y %H:%M")
    return str(value)


def _to_int(value: Any) -> int:
    try:
        return int(value or 0)
    except (TypeError, ValueError):
        return 0


def _normalise_details(rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Convert raw SP rows to clean dicts used by the Excel sheets."""
    out = []
    for r in rows:
        out.append({
            "cont":    _get(r, "ContNo") or "",
            "process": _get(r, "Process") or "",
            "size":    _size_int(_get(r, "ContainerSize", "Size")),
            "gate_in": _fmt_dt(_get(r, "GateInDate")),
            "loc":     _get(r, "Location") or "—",
            "block":   _get(r, "BlockName") or "—",
        })
    return out


def _style_title(ws, row: int, text: str, ncols: int) -> None:
    c = ws.cell(row=row, column=1, value=text)
    c.font = Font(bold=True)


def _write_summary(ws, start_row: int, title: str, last_header: str,
                   data: List[tuple]) -> int:
    """
    Writes:   title row / header row / data rows / Grand Total row.
    data = [(label, n20, n40, total, teus), ...]
    Returns the row number of the Grand Total row.
    """
    _style_title(ws, start_row, title, 5)

    hdr_row = start_row + 1
    for i, h in enumerate(["Row Labels", 20, 40, "Grand Total", last_header], start=1):
        c = ws.cell(row=hdr_row, column=i, value=h)
        c.fill, c.font, c.alignment, c.border = (
            _XL_HEADER_FILL, _XL_HEADER_FONT, _XL_CENTER, _XL_BORDER)

    r = hdr_row
    for label, n20, n40, total, teus in data:
        r += 1
        for i, v in enumerate([label, n20, n40, total, teus], start=1):
            c = ws.cell(row=r, column=i, value=v)
            c.alignment, c.border = _XL_CENTER, _XL_BORDER

    r += 1
    totals = [
        "Grand Total",
        sum(d[1] for d in data),
        sum(d[2] for d in data),
        sum(d[3] for d in data),
        sum(d[4] for d in data),
    ]
    for i, v in enumerate(totals, start=1):
        c = ws.cell(row=r, column=i, value=v)
        c.font, c.alignment, c.border = Font(bold=True), _XL_CENTER, _XL_BORDER
    return r


def _write_detail_table(ws, header_row: int, details: List[Dict[str, Any]],
                        with_block_col: bool) -> None:
    headers = ["Container No", "Process", "Size", "Location", "Gate In"]
    if with_block_col:
        headers.append("Location")          # BlockName (EXP-EX / OWH …)

    for i, h in enumerate(headers, start=1):
        c = ws.cell(row=header_row, column=i, value=h)
        c.fill, c.font, c.alignment, c.border = (
            _XL_HEADER_FILL, _XL_HEADER_FONT, _XL_CENTER, _XL_BORDER)

    r = header_row
    for d in details:
        r += 1
        vals = [d["cont"], d["process"], d["size"], d["loc"], d["gate_in"]]
        if with_block_col:
            vals.append(d["block"])
        for i, v in enumerate(vals, start=1):
            c = ws.cell(row=r, column=i, value=v)
            c.alignment, c.border = _XL_CENTER, _XL_BORDER

    if details:
        ws.auto_filter.ref = f"A{header_row}:{get_column_letter(len(headers))}{r}"


def _set_widths(ws, widths: List[float]) -> None:
    for i, w in enumerate(widths, start=1):
        ws.column_dimensions[get_column_letter(i)].width = w


def build_excel_report(
    yard_summary_rows: List[Dict[str, Any]],
    yard_detail_rows: List[Dict[str, Any]],
    warehouse_detail_rows: List[Dict[str, Any]],
) -> bytes:
    """
    Builds Automailer_report_in_OCR.xlsx in memory and returns the bytes.

    Sheet 1 'Yard Inventory'     : summary (row 3-…) + container list
    Sheet 2 'Warehouse Location' : summary per block (row 3-…) + container list
    TEUs = (20ft × 1) + (40ft × 2)
    """
    wb = Workbook()

    # ── Sheet 1 : Yard Inventory ──────────────────────────────────────────────
    ws1 = wb.active
    ws1.title = "Yard Inventory"

    yard_data = []
    for r in yard_summary_rows:
        n20 = _to_int(_get(r, "SIZE20"))
        n40 = _to_int(_get(r, "SIZE40"))
        total = _to_int(_get(r, "TOTAL")) or (n20 + n40)
        teus = _to_int(_get(r, "TEUS")) or (n20 + 2 * n40)
        label = _get(r, "PROCESS", "YARDNAME") or ""
        yard_data.append((label, n20, n40, total, teus))

    total_row = _write_summary(ws1, 3, "Count of Container No", "Tues", yard_data)
    _write_detail_table(ws1, total_row + 2, _normalise_details(yard_detail_rows),
                        with_block_col=False)
    _set_widths(ws1, [20.4, 14.8, 8, 22, 18])

    # ── Sheet 2 : Warehouse Location ──────────────────────────────────────────
    ws2 = wb.create_sheet("Warehouse Location")
    wh = _normalise_details(warehouse_detail_rows)

    # summary = count per block, computed from the same rows as the list below
    blocks: Dict[str, List[int]] = {}
    for d in wh:
        b = blocks.setdefault(d["block"], [0, 0])
        if d["size"] == 20:
            b[0] += 1
        elif d["size"] == 40:
            b[1] += 1

    def _block_sort(name: str):
        return (WAREHOUSE_BLOCK_ORDER.index(name), "") if name in WAREHOUSE_BLOCK_ORDER \
            else (len(WAREHOUSE_BLOCK_ORDER), name)

    wh_data = [
        (name, c20, c40, c20 + c40, c20 + 2 * c40)
        for name, (c20, c40) in sorted(blocks.items(), key=lambda kv: _block_sort(kv[0]))
    ]

    total_row = _write_summary(ws2, 3, "Warehouse Container Details.", "Total Tues", wh_data)
    # sample file me header row 12 hai (2 blocks ke saath) → total_row + 5
    _write_detail_table(ws2, max(12, total_row + 5), wh, with_block_col=True)
    _set_widths(ws2, [20.4, 14.8, 8, 22, 18, 12])

    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


# ══════════════════════════════════════════════════════════════════════════════
# HTML TABLE BUILDERS
# ══════════════════════════════════════════════════════════════════════════════

# ── Shared style constants ────────────────────────────────────────────────────
_TH_BASE  = "padding:10px 16px;text-align:{align};font-weight:600;font-size:13px;white-space:nowrap;"
_TD_BASE  = "padding:9px 16px;text-align:{align};font-size:13px;border-bottom:1px solid {border};"
_TABLE_WRAP = (
    "border-collapse:collapse;width:100%;max-width:680px;"
    "border-radius:8px;overflow:hidden;"
    "box-shadow:0 2px 8px rgba(0,0,0,0.10);"
    "font-family:Arial,Helvetica,sans-serif;"
)


def _is_total_row(row: Dict[str, Any]) -> bool:
    """True if any cell value looks like a Grand-Total label."""
    for v in row.values():
        if v and "total" in str(v).lower():
            return True
    return False


def _build_summary_table(rows, empty_msg, head_bg, row_a, row_total, border, text_color):
    """Common builder for the fixed-column summary tables (warehouse + yard)."""
    if not rows:
        return f"<p style='color:#888;font-style:italic;'>{empty_msg}</p>"

    # Procedure first column: PROCESS / YARDNAME (case-insensitive)
    keys = {str(k).upper(): k for k in rows[0].keys()}
    first_key = next((keys[n] for n in ("YARDNAME", "PROCESS", "BLOCKNAME") if n in keys),
                     list(rows[0].keys())[0])
    num_keys = [keys[n] for n in ("SIZE20", "SIZE40", "TOTAL", "TEUS") if n in keys]
    labels = {"SIZE20": "20", "SIZE40": "40", "TOTAL": "Grand Total", "TEUS": "Tues"}
    columns = [first_key] + num_keys

    display_rows = list(rows)
    if not any(_is_total_row(r) for r in rows):
        gt = {first_key: "Grand Total"}
        for k in num_keys:
            gt[k] = sum(_to_int(r.get(k)) for r in rows)
        display_rows.append(gt)

    header_cells = ""
    for i, col in enumerate(columns):
        align = "left" if i == 0 else "center"
        label = "Row Labels" if i == 0 else labels[str(col).upper()]
        header_cells += (
            f'<th style="{_TH_BASE.format(align=align)}'
            f'background:{head_bg};color:#ffffff;">{label}</th>'
        )

    body_rows = ""
    for idx, row in enumerate(display_rows):
        is_total = _is_total_row(row)
        row_bg = row_total if is_total else (row_a if idx % 2 == 0 else "#ffffff")
        fw = "font-weight:700;" if is_total else ""
        cells = ""
        for i, col in enumerate(columns):
            val = "" if row.get(col) is None else str(row[col])
            align = "left" if i == 0 else "center"
            cells += (
                f'<td style="{_TD_BASE.format(align=align, border=border)}'
                f'color:{text_color};{fw}">{val}</td>'
            )
        body_rows += f'<tr style="background:{row_bg};">{cells}</tr>'

    return (
        f'<table cellpadding="0" cellspacing="0" border="0" style="{_TABLE_WRAP}">'
        f'<thead><tr>{header_cells}</tr></thead>'
        f'<tbody>{body_rows}</tbody>'
        f'</table>'
    )


def build_warehouse_table(rows: List[Dict[str, Any]]) -> str:
    """Table 1 — Warehouse Container Details (EXP-EX / OWH). Header: dark green."""
    return _build_summary_table(
        rows, "No warehouse data available.",
        head_bg="#1b4332", row_a="#f0f7f4", row_total="#d8f3dc",
        border="#b7e4c7", text_color="#1b4332",
    )


def build_yard_inventory_table(rows: List[Dict[str, Any]]) -> str:
    """Table 2 — Yard Inventory (PROCESS / YARDNAME). Header: dark teal."""
    return _build_summary_table(
        rows, "No yard inventory data available.",
        head_bg="#0d6e6e", row_a="#f0fbfb", row_total="#e6f7f7",
        border="#b2dfdb", text_color="#0d3b3b",
    )


# ══════════════════════════════════════════════════════════════════════════════
# FULL EMAIL HTML
# ══════════════════════════════════════════════════════════════════════════════

def _section_label(text: str, color: str, border_color: str) -> str:
    return (
        f'<div style="display:inline-block;background:{color};'
        f'border-left:4px solid {border_color};'
        f'padding:7px 14px;border-radius:4px;">'
        f'<span style="font-size:14px;font-weight:700;color:{border_color};">'
        f'{text}</span></div>'
    )


def build_full_email_html(
    warehouse_rows: List[Dict[str, Any]],
    yard_rows: List[Dict[str, Any]],
    has_attachment: bool = False,
) -> str:
    today_str   = datetime.now().strftime("%d %B %Y")
    report_time = datetime.now().strftime("%I:%M %p")

    warehouse_table = build_warehouse_table(warehouse_rows)
    yard_table      = build_yard_inventory_table(yard_rows)

    wh_label   = _section_label("Warehouse Container Details", "#d8f3dc", "#1b4332")
    yard_label = _section_label("Yard Inventory",              "#e0f2f1", "#0d6e6e")

    attach_note = ""
    if has_attachment:
        attach_note = (
            '<tr><td style="padding:0 32px 24px;">'
            '<p style="margin:0;font-size:13px;color:#444;">'
            f'📎 Detailed container list attached: <strong>{EXCEL_FILE_NAME}</strong> '
            '(sheets: Yard Inventory, Warehouse Location)'
            '</p></td></tr>'
        )

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>Container Ageing Report</title>
</head>
<body style="margin:0;padding:0;background:#f4f6f8;
             font-family:Arial,Helvetica,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" border="0"
         style="background:#f4f6f8;padding:30px 0;">
    <tr><td align="center">

      <!-- ── Card ── -->
      <table width="720" cellpadding="0" cellspacing="0" border="0"
             style="background:#ffffff;border-radius:12px;
                    box-shadow:0 4px 16px rgba(0,0,0,0.10);
                    overflow:hidden;max-width:720px;width:100%;">

        <!-- ── Table 1: Warehouse Container Details ── -->
        <tr>
          <td style="padding:24px 32px 12px;">
            {wh_label}
          </td>
        </tr>
        <tr>
          <td style="padding:0 32px 28px;">
            {warehouse_table}
          </td>
        </tr>

        <!-- Divider -->
        <tr>
          <td style="padding:0 32px;">
            <hr style="border:none;border-top:1px solid #e8e8e8;margin:0;"/>
          </td>
        </tr>

        <!-- ── Table 2: Yard Inventory ── -->
        <tr>
          <td style="padding:24px 32px 12px;">
            {yard_label}
          </td>
        </tr>
        <tr>
          <td style="padding:0 32px 28px;">
            {yard_table}
          </td>
        </tr>

        <!-- Attachment note -->
        {attach_note}

        <!-- Footer -->
        <tr>
          <td style="background:#f8faf9;padding:16px 32px;
                     border-top:1px solid #e0e0e0;">
            <p style="margin:0;color:#888;font-size:12px;text-align:center;">
              This is an automated email generated by the
              <strong>YMS — Yard Management System</strong>.
              Please do not reply to this email.
            </p>
          </td>
        </tr>

      </table>
      <!-- /Card -->

    </td></tr>
  </table>

</body>
</html>"""


# ══════════════════════════════════════════════════════════════════════════════
# MAIN ENTRY POINT
# ══════════════════════════════════════════════════════════════════════════════

def send_container_ageing_report() -> bool:
    """
    Fetches all data sets, builds the HTML email + Excel attachment, sends it.
    Returns True on success, False on any failure.
    """
    if not REPORT_RECIPIENTS:
        logger.error(
            "No recipients configured. "
            "Set REPORT_RECIPIENTS in .env  e.g.  REPORT_RECIPIENTS=a@x.com,b@x.com"
        )
        return False

    if not SMTP_USER or not SMTP_PASSWORD:
        logger.error("SMTP credentials missing. Set SMTP_USER and SMTP_PASSWORD in .env")
        return False

    # 1. Fetch data (email tables)
    warehouse_rows = fetch_container_ageing_data()
    yard_rows      = fetch_yard_inventory_data()

    # 1b. Fetch data (Excel sheets)
    yard_detail_rows      = fetch_yard_details_data()
    warehouse_detail_rows = fetch_warehouse_details_data()

    # 2. Build Excel (failure should not stop the email itself)
    excel_bytes: Optional[bytes] = None
    try:
        excel_bytes = build_excel_report(yard_rows, yard_detail_rows, warehouse_detail_rows)
        logger.info("Excel built: %s (%d bytes)", EXCEL_FILE_NAME, len(excel_bytes))
    except Exception as exc:
        logger.exception("Excel generation failed — email will be sent without attachment: %s", exc)

    # 3. Build email
    today_str = datetime.now().strftime("%d %B %Y")
    subject   = f"Container Ageing & Yard Inventory Report — {today_str}"
    html_body = build_full_email_html(
        warehouse_rows, yard_rows, has_attachment=excel_bytes is not None
    )

    plain_text = (
        f"Container Ageing & Yard Inventory Report — {today_str}\n\n"
        f"Warehouse rows       : {len(warehouse_rows)}\n"
        f"Yard rows            : {len(yard_rows)}\n"
        f"Yard containers      : {len(yard_detail_rows)}\n"
        f"Warehouse containers : {len(warehouse_detail_rows)}\n\n"
        "Please view this email in an HTML-capable mail client for the full report."
    )

    # 4. Compose MIME  (mixed → [alternative(plain+html), attachment])
    msg = MIMEMultipart("mixed")
    msg["Subject"] = subject
    msg["From"]    = SMTP_USER
    msg["To"]      = ", ".join(REPORT_RECIPIENTS)
    if REPORT_CC:
        msg["Cc"]  = ", ".join(REPORT_CC)

    body = MIMEMultipart("alternative")
    body.attach(MIMEText(plain_text, "plain"))
    body.attach(MIMEText(html_body, "html"))
    msg.attach(body)

    if excel_bytes:
        part = MIMEApplication(
            excel_bytes,
            _subtype="vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            Name=EXCEL_FILE_NAME,
        )
        part.add_header("Content-Disposition", "attachment", filename=EXCEL_FILE_NAME)
        msg.attach(part)

    # All addresses that should actually receive the email (TO + CC)
    all_recipients = REPORT_RECIPIENTS + REPORT_CC

    # 5. Send
    try:
        if SMTP_USE_TLS:
            server = smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=30)
            server.ehlo()
            server.starttls()
            server.ehlo()
        else:
            server = smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, timeout=30)

        server.login(SMTP_USER, SMTP_PASSWORD)
        server.sendmail(SMTP_USER, all_recipients, msg.as_string())
        server.quit()

        logger.info("Report sent TO  : %s", ", ".join(REPORT_RECIPIENTS))
        if REPORT_CC:
            logger.info("Report sent CC  : %s", ", ".join(REPORT_CC))
        return True

    except smtplib.SMTPAuthenticationError:
        logger.error(
            "SMTP auth failed — for Gmail use an App Password, not your account password"
        )
        return False
    except smtplib.SMTPException as exc:
        logger.exception("SMTP error: %s", exc)
        return False
    except Exception as exc:
        logger.exception("Unexpected error sending report: %s", exc)
        return False