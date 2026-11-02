"""
Email Report Service
--------------------
Fetches data from two stored procedures and sends a daily HTML email:

  Table 1 — Warehouse Container Details
      Procedure : GET_DASHBOARD_CONTAINERAGEING
      Columns   : (dynamic — first result set)

  Table 2 — Yard Inventory
      Procedure : GET_DASHBOARD_YARDINVENTORY_AUTOMAIL
      Columns   : YARDNAME, SIZE20, SIZE40, TOTAL, TEUS
"""

import os
import smtplib
import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from datetime import datetime
from typing import List, Dict, Any, Optional

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

# CC recipients — optional (leave blank or don't set in .env to skip CC)
REPORT_CC: List[str] = [
    e.strip()
    for e in os.getenv("REPORT_CC", "").split(",")
    if e.strip()
]


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
    """Warehouse Container Details from GET_DASHBOARD_CONTAINERAGEING."""
    rows = _exec_proc("GET_DASHBOARD_CONTAINERAGEING", fetch_all=True)
    logger.info("Container ageing rows fetched: %d", len(rows))
    return rows


def fetch_yard_inventory_data() -> List[Dict[str, Any]]:
    """Yard Inventory from GET_DASHBOARD_YARDINVENTORY_AUTOMAIL."""
    rows = _exec_proc("GET_DASHBOARD_YARDINVENTORY_AUTOMAIL", fetch_all=False)
    logger.info("Yard inventory rows fetched: %d", len(rows))
    return rows


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


def build_warehouse_table(rows: List[Dict[str, Any]]) -> str:
    """
    Table 1 — Warehouse Container Details.
    Columns are taken dynamically from the stored procedure result set.
    Grand Total row is bolded with a highlighted background.
    Header colour: dark green (#1b4332).
    """
    if not rows:
        return "<p style='color:#888;font-style:italic;'>No warehouse data available.</p>"

    columns = list(rows[0].keys())

    # ── Header ──
    header_cells = ""
    for i, col in enumerate(columns):
        align  = "left" if i == 0 else "center"
        label  = col.replace("_", " ").title()
        header_cells += (
            f'<th style="{_TH_BASE.format(align=align)}'
            f'background:#1b4332;color:#ffffff;">{label}</th>'
        )

    # ── Rows ──
    body_rows = ""
    for idx, row in enumerate(rows):
        is_total = _is_total_row(row)
        row_bg   = "#d8f3dc" if is_total else ("#f0f7f4" if idx % 2 == 0 else "#ffffff")
        border   = "#b7e4c7"
        fw       = "font-weight:700;" if is_total else ""

        cells = ""
        for i, col in enumerate(columns):
            val   = "" if row.get(col) is None else str(row[col])
            align = "left" if i == 0 else "center"
            cells += (
                f'<td style="{_TD_BASE.format(align=align, border=border)}'
                f'color:#1b4332;{fw}">{val}</td>'
            )
        body_rows += f'<tr style="background:{row_bg};">{cells}</tr>'

    return (
        f'<table cellpadding="0" cellspacing="0" border="0" style="{_TABLE_WRAP}">'
        f'<thead><tr>{header_cells}</tr></thead>'
        f'<tbody>{body_rows}</tbody>'
        f'</table>'
    )


def build_yard_inventory_table(rows: List[Dict[str, Any]]) -> str:
    """
    Table 2 — Yard Inventory.
    Fixed columns: YARDNAME → Row Labels, SIZE20 → 20, SIZE40 → 40,
                   TOTAL → Grand Total, TEUS → Tues.
    Header colour: dark teal (#0d6e6e).
    """
    if not rows:
        return "<p style='color:#888;font-style:italic;'>No yard inventory data available.</p>"

    # Display names matching the image exactly
    col_map = {
        "YARDNAME": "Row Labels",
        "SIZE20":   "20",
        "SIZE40":   "40",
        "TOTAL":    "Grand Total",
        "TEUS":     "Tues",
    }
    # Only show columns that exist in the result (safe fallback)
    columns = [c for c in col_map.keys() if c in rows[0]]

    # ── Header ──
    header_cells = ""
    for i, col in enumerate(columns):
        align  = "left" if i == 0 else "center"
        label  = col_map[col]
        header_cells += (
            f'<th style="{_TH_BASE.format(align=align)}'
            f'background:#0d6e6e;color:#ffffff;">{label}</th>'
        )

    # ── Rows ──
    body_rows = ""
    for idx, row in enumerate(rows):
        is_total = _is_total_row(row)
        row_bg   = "#e6f7f7" if is_total else ("#f0fbfb" if idx % 2 == 0 else "#ffffff")
        border   = "#b2dfdb"
        fw       = "font-weight:700;" if is_total else ""

        cells = ""
        for i, col in enumerate(columns):
            val   = "" if row.get(col) is None else str(row[col])
            align = "left" if i == 0 else "center"
            cells += (
                f'<td style="{_TD_BASE.format(align=align, border=border)}'
                f'color:#0d3b3b;{fw}">{val}</td>'
            )
        body_rows += f'<tr style="background:{row_bg};">{cells}</tr>'

    return (
        f'<table cellpadding="0" cellspacing="0" border="0" style="{_TABLE_WRAP}">'
        f'<thead><tr>{header_cells}</tr></thead>'
        f'<tbody>{body_rows}</tbody>'
        f'</table>'
    )


# ══════════════════════════════════════════════════════════════════════════════
# FULL EMAIL HTML
# ══════════════════════════════════════════════════════════════════════════════

def _section_label(text: str, color: str, border_color: str) -> str:
    return (
        f'<div style="display:inline-block;background:{color};'
        f'border-left:4px solid {border_color};'
        f'padding:7px 14px;border-radius:4px;margin-bottom:10px;">'
        f'<span style="font-size:14px;font-weight:700;color:{border_color};">'
        f'{text}</span></div>'
    )


def build_full_email_html(
    warehouse_rows: List[Dict[str, Any]],
    yard_rows: List[Dict[str, Any]],
) -> str:
    today_str   = datetime.now().strftime("%d %B %Y")
    report_time = datetime.now().strftime("%I:%M %p")

    warehouse_table = build_warehouse_table(warehouse_rows)
    yard_table      = build_yard_inventory_table(yard_rows)

    wh_label   = _section_label("Warehouse Container Details", "#d8f3dc", "#1b4332")
    yard_label = _section_label("Yard Inventory",              "#e0f2f1", "#0d6e6e")

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

        <!-- Header Banner -->
        <tr>
          <td style="background:linear-gradient(135deg,#1b4332 0%,#40916c 100%);
                     padding:26px 32px;">
            <h1 style="margin:0;color:#ffffff;font-size:21px;font-weight:700;
                       letter-spacing:0.4px;">
              📦 Container Ageing &amp; Yard Inventory Report
            </h1>
            <p style="margin:6px 0 0;color:#d8f3dc;font-size:13px;">
              Automated Daily Report &nbsp;·&nbsp; {today_str}
              &nbsp;·&nbsp; {report_time}
            </p>
          </td>
        </tr>

        <!-- ── Table 1: Warehouse Container Details ── -->
        <tr>
          <td style="padding:24px 32px 8px;">
            {wh_label}
            <p style="margin:4px 0 12px;color:#555;font-size:12px;">
              Report timing: 10:00 AM &nbsp;|&nbsp;
              Source: GET_DASHBOARD_CONTAINERAGEING
            </p>
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
          <td style="padding:24px 32px 8px;">
            {yard_label}
            <p style="margin:4px 0 12px;color:#555;font-size:12px;">
              Report timing: 10:00 AM &nbsp;|&nbsp;
              Source: GET_DASHBOARD_YARDINVENTORY_AUTOMAIL
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:0 32px 28px;">
            {yard_table}
          </td>
        </tr>

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
    Fetches both data sets, builds the HTML email, and sends it.
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

    # 1. Fetch data
    warehouse_rows = fetch_container_ageing_data()
    yard_rows      = fetch_yard_inventory_data()

    # 2. Build email
    today_str = datetime.now().strftime("%d %B %Y")
    subject   = f"Container Ageing & Yard Inventory Report — {today_str}"
    html_body = build_full_email_html(warehouse_rows, yard_rows)

    plain_text = (
        f"Container Ageing & Yard Inventory Report — {today_str}\n\n"
        f"Warehouse rows : {len(warehouse_rows)}\n"
        f"Yard rows      : {len(yard_rows)}\n\n"
        "Please view this email in an HTML-capable mail client for the full report."
    )

    # 3. Compose MIME
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"]    = SMTP_USER
    msg["To"]      = ", ".join(REPORT_RECIPIENTS)
    if REPORT_CC:
        msg["Cc"]  = ", ".join(REPORT_CC)
    msg.attach(MIMEText(plain_text, "plain"))
    msg.attach(MIMEText(html_body, "html"))

    # All addresses that should actually receive the email (TO + CC)
    all_recipients = REPORT_RECIPIENTS + REPORT_CC

    # 4. Send
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
