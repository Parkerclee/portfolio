"""Build the Kirkpatrick L1-L4 Planning Canvas as a printable PDF.

Landscape, single page, four columns × three rows with prompt text in the
header of each cell so a sponsor and ID can fill it in together.

Run: python3 scripts/build-kirkpatrick-canvas-pdf.py
"""
from reportlab.lib.pagesizes import LETTER, landscape
from reportlab.lib.colors import HexColor, Color
from reportlab.lib.units import inch
from reportlab.pdfgen import canvas
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, KeepTogether
)
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER
import os

# Palette
PAPER      = HexColor('#F8EFE0')
CREAM      = HexColor('#FBF5EC')
COCOA      = HexColor('#553824')
COCOA_70   = Color(85/255, 56/255, 36/255, alpha=0.72)
COCOA_45   = Color(85/255, 56/255, 36/255, alpha=0.45)
COCOA_15   = Color(85/255, 56/255, 36/255, alpha=0.15)
TERRACOTTA = HexColor('#A9522F')
AVOCADO    = HexColor('#6F8B3C')
MUSTARD    = HexColor('#D9A441')
ESPRESSO   = HexColor('#3D2615')

LEVELS = [
    {
        "num": "L1",
        "title": "Reaction",
        "color": MUSTARD,
        "question": "How are learners responding — in the moment?",
        "examples": "Signal: engaged, confused, rushing through. Skip the smile sheet.",
    },
    {
        "num": "L2",
        "title": "Learning",
        "color": TERRACOTTA,
        "question": "What knowledge or skill did they actually gain?",
        "examples": "Signal: scenario-based check tied to the behavior, not the content.",
    },
    {
        "num": "L3",
        "title": "Behavior",
        "color": AVOCADO,
        "question": "Is the behavior showing up on the floor, in the ticket, or in the system log?",
        "examples": "Signal: observable change in actions 30-90 days post-training.",
    },
    {
        "num": "L4",
        "title": "Results",
        "color": ESPRESSO,
        "question": "What business metric did we move — the one the sponsor signed on Day 1?",
        "examples": "Signal: the number leadership already reviews. No new KPIs.",
    },
]

ROWS = [
    {
        "label": "What we'll measure",
        "prompt": "Name one specific measure per level. Not a category — a metric.",
    },
    {
        "label": "How we'll capture it",
        "prompt": "Data source, instrument, or system. xAPI statement ID if applicable.",
    },
    {
        "label": "Who owns the signal",
        "prompt": "A named human, not a team. Someone who'll still care in 90 days.",
    },
]


styles = {
    "title": ParagraphStyle(
        "title", fontName="Helvetica-Bold", fontSize=22, leading=26,
        textColor=COCOA, alignment=TA_LEFT, spaceAfter=2,
    ),
    "subtitle": ParagraphStyle(
        "subtitle", fontName="Helvetica-Oblique", fontSize=10.5, leading=14,
        textColor=COCOA_70, alignment=TA_LEFT, spaceAfter=8,
    ),
    "level_num": ParagraphStyle(
        "level_num", fontName="Helvetica-Bold", fontSize=13, leading=14,
        textColor=CREAM, alignment=TA_LEFT,
    ),
    "level_title": ParagraphStyle(
        "level_title", fontName="Helvetica-Bold", fontSize=13.5, leading=15,
        textColor=CREAM, alignment=TA_LEFT,
    ),
    "level_q": ParagraphStyle(
        "level_q", fontName="Helvetica-Oblique", fontSize=9, leading=11.5,
        textColor=CREAM, alignment=TA_LEFT,
    ),
    "row_label": ParagraphStyle(
        "row_label", fontName="Helvetica-Bold", fontSize=10, leading=12,
        textColor=COCOA, alignment=TA_LEFT,
    ),
    "row_prompt": ParagraphStyle(
        "row_prompt", fontName="Helvetica-Oblique", fontSize=8.5, leading=10.5,
        textColor=COCOA_70, alignment=TA_LEFT,
    ),
    "cell_hint": ParagraphStyle(
        "cell_hint", fontName="Helvetica-Oblique", fontSize=8, leading=10,
        textColor=COCOA_45, alignment=TA_LEFT,
    ),
    "footer": ParagraphStyle(
        "footer", fontName="Helvetica", fontSize=8, leading=10,
        textColor=CREAM, alignment=TA_CENTER,
    ),
    "rail": ParagraphStyle(
        "rail", fontName="Helvetica-Oblique", fontSize=9.5, leading=12,
        textColor=COCOA_70, alignment=TA_LEFT,
    ),
}


def page_background(c, doc):
    w, h = landscape(LETTER)
    c.setFillColor(PAPER)
    c.rect(0, 0, w, h, fill=1, stroke=0)
    # Top band
    c.setFillColor(MUSTARD)
    c.rect(0, h - 0.3 * inch, w, 0.3 * inch, fill=1, stroke=0)
    # Footer band
    c.setFillColor(ESPRESSO)
    c.rect(0, 0, w, 0.38 * inch, fill=1, stroke=0)
    c.setFillColor(CREAM)
    c.setFont("Helvetica", 8)
    c.drawCentredString(w / 2, 0.14 * inch,
                        "Parker Lee  ·  parkerlee.dev  ·  Kirkpatrick L1-L4 Planning Canvas")


def build_header_cell(level):
    inner = Table(
        [
            [Paragraph(f"{level['num']} — {level['title']}", styles["level_title"])],
            [Paragraph(level["question"], styles["level_q"])],
        ],
        colWidths=[2.35 * inch],
    )
    inner.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), level["color"]),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
    ]))
    return inner


def build_row_label_cell(row):
    return Table(
        [[Paragraph(row["label"], styles["row_label"])],
         [Paragraph(row["prompt"], styles["row_prompt"])]],
        colWidths=[1.2 * inch],
        style=TableStyle([
            ("TOPPADDING", (0, 0), (-1, -1), 2),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
            ("LEFTPADDING", (0, 0), (-1, -1), 2),
            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ]),
    )


def build_cell(hint):
    """A fillable cell with a faint hint prompt for guidance."""
    return Table(
        [[Paragraph(hint, styles["cell_hint"])]],
        colWidths=[2.35 * inch],
        rowHeights=[1.4 * inch],
        style=TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), CREAM),
            ("BOX",        (0, 0), (-1, -1), 0.5, COCOA_15),
            ("LEFTPADDING", (0, 0), (-1, -1), 8),
            ("RIGHTPADDING", (0, 0), (-1, -1), 8),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ]),
    )


def build():
    out_dir = os.path.join(os.path.dirname(__file__), "..", "public", "resources", "downloads")
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.abspath(os.path.join(out_dir, "kirkpatrick-canvas.pdf"))

    doc = SimpleDocTemplate(
        out_path, pagesize=landscape(LETTER),
        leftMargin=0.5 * inch, rightMargin=0.5 * inch,
        topMargin=0.65 * inch, bottomMargin=0.6 * inch,
        title="Kirkpatrick L1-L4 Planning Canvas",
        author="Parker Lee",
    )

    story = [
        Paragraph("Kirkpatrick L1-L4 Planning Canvas", styles["title"]),
        Paragraph(
            "Fill this in with your sponsor, before Design begins. Every measure needs a data source "
            "and a human owner. If L3 or L4 come out blank, say so out loud — usually the business "
            "metric isn't actually tied to the behavior the training is meant to move.",
            styles["subtitle"],
        ),
        Spacer(1, 4),
    ]

    # Build a single table with row labels + 4 level columns
    header_row = [Paragraph("", styles["row_label"])]  # corner cell
    header_row.extend([build_header_cell(lvl) for lvl in LEVELS])

    table_rows = [header_row]

    # Cell hints per level to guide the sponsor fill-in
    hints = {
        "What we'll measure": {
            "L1": "e.g., completion signal + one open-ended prompt",
            "L2": "e.g., 3 scenario questions tied to the decisions",
            "L3": "e.g., observable change in system logs / QA scores",
            "L4": "e.g., the metric already on the sponsor's dashboard",
        },
        "How we'll capture it": {
            "L1": "In-course poll. xAPI statement: 'reacted'",
            "L2": "In-course assessment. xAPI: 'answered / passed'",
            "L3": "Source system. xAPI: 'performed' at 30-90 days",
            "L4": "Reporting pipeline → sponsor dashboard",
        },
        "Who owns the signal": {
            "L1": "ID (first week)",
            "L2": "ID + L&D lead",
            "L3": "Team manager + analytics partner",
            "L4": "Sponsor / business owner",
        },
    }

    for row in ROWS:
        data_row = [build_row_label_cell(row)]
        for lvl in LEVELS:
            data_row.append(build_cell(hints[row["label"]][lvl["num"]]))
        table_rows.append(data_row)

    grid = Table(
        table_rows,
        colWidths=[1.3 * inch] + [2.45 * inch] * 4,
    )
    grid.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("LEFTPADDING", (0, 0), (-1, -1), 2),
        ("RIGHTPADDING", (0, 0), (-1, -1), 2),
    ]))
    story.append(grid)

    story.append(Spacer(1, 10))
    story.append(Paragraph(
        "<b>Rail:</b>  If two or more cells in L3 / L4 are blank, pause the project and renegotiate the scope "
        "with the sponsor. The program is unmeasurable as designed — that's a design decision you want to "
        "make on purpose, not by accident.",
        styles["rail"],
    ))

    doc.build(story, onFirstPage=page_background, onLaterPages=page_background)
    print(f"Wrote {out_path}")


if __name__ == "__main__":
    build()
