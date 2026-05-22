"""Build the Five-Phase Framework downloadable PDF for the resources page.

Uses the portfolio's Magical Forest palette.
Run: python3 scripts/build-five-phase-pdf.py
Output: public/resources/downloads/five-phase-framework.pdf
"""
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.colors import HexColor, Color
from reportlab.lib.units import inch
from reportlab.pdfgen import canvas
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether
)
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER
import os

# ---- Palette ----
PAPER      = HexColor('#F8EFE0')
CREAM      = HexColor('#FBF5EC')
COCOA      = HexColor('#553824')
COCOA_70   = Color(85/255, 56/255, 36/255, alpha=0.72)
COCOA_45   = Color(85/255, 56/255, 36/255, alpha=0.45)
TERRACOTTA = HexColor('#A9522F')
AVOCADO    = HexColor('#6F8B3C')
MUSTARD    = HexColor('#D9A441')
ESPRESSO   = HexColor('#3D2615')

# ---- Phase definitions ----
PHASES = [
    {
        "num": "01",
        "title": "Discover",
        "color": TERRACOTTA,
        "pitch": "Name the behavior you actually want to move. Everything else follows.",
        "activities": [
            "Sponsor interview — what metric, what timeline, what counts as success",
            "SME action-mapping session — the 3-5 decisions learners actually get wrong",
            "Learner context — modality, device, time available, prior knowledge",
            "Kirkpatrick L3/L4 sanity check — can we attribute behavior change to this work?",
        ],
        "outputs": [
            "One-page problem statement the sponsor signs",
            "Three measurable behaviors training will move",
            "A list of what this project is NOT solving",
        ],
        "heuristic": "If Discovery takes less than a week, either the problem is trivial or you're skipping it.",
    },
    {
        "num": "02",
        "title": "Design",
        "color": AVOCADO,
        "pitch": "Design for the decision moment, not the content library.",
        "activities": [
            "Modality decision — Rise, Storyline, code, blended, or job aid",
            "Scenario skeletons — the moments a learner chooses and the feedback for each branch",
            "Assessment design — one good question per behavior beats ten generic ones",
            "Accessibility + localization pass before a single slide is built",
        ],
        "outputs": [
            "Storyboard or design doc the SME reviews in under 30 minutes",
            "Modality rationale the sponsor can defend",
            "Evaluation plan mapped to L1–L4",
        ],
        "heuristic": "If a SME can't describe the scenario back to you in their own words, it isn't ready to build.",
    },
    {
        "num": "03",
        "title": "Build",
        "color": MUSTARD,
        "pitch": "Build the smallest useful thing, review it fast, and only then polish.",
        "activities": [
            "Pre-build: asset library, template, voice guide — set once, reused everywhere",
            "Build: drafts end-to-end before any single slide is polished",
            "Polish: accessibility, motion, transitions, audio, and last-mile review",
            "AI-assisted scaffolding where it saves days without compromising voice",
        ],
        "outputs": [
            "A reviewable v0.5 before you've invested in motion or audio",
            "A single style guide other builders on your team can follow",
            "Version-controlled source files (even in Rise — name conventions count)",
        ],
        "heuristic": "Polish the whole thing a quarter inch, not one corner an inch.",
    },
    {
        "num": "04",
        "title": "Deliver",
        "color": TERRACOTTA,
        "pitch": "Delivery is a design problem. Comms, cadence, and manager enablement belong in the ID's lane.",
        "activities": [
            "Launch comms — from, subject, timing, CTA — written by the ID, not copy-pasted",
            "Manager enablement — a one-pager so they can reinforce the behavior",
            "Pilot cohort — real learners, real feedback, before the org-wide rollout",
            "LMS QA pass — launch conditions, reporting tags, completion logic",
        ],
        "outputs": [
            "A pilot readout the sponsor can use in their next leadership review",
            "A launch kit anyone can run without calling you",
            "A known list of things to fix in v1.1",
        ],
        "heuristic": "The training is only as good as the context the learner encounters it in.",
    },
    {
        "num": "05",
        "title": "Measure",
        "color": AVOCADO,
        "pitch": "If you can't defend the number, you can't defend the program.",
        "activities": [
            "L1 — reaction signals, not smile sheets",
            "L2 — knowledge check tied to the behavior, not the content",
            "L3 — behavior change observed on the floor, in the ticket, or in the system log",
            "L4 — the business metric the sponsor signed on Day 1",
        ],
        "outputs": [
            "A dashboard the sponsor checks without you in the room",
            "A before/after story that names what you'd change in v2",
            "A documented what-I'd-change list — because there's always one",
        ],
        "heuristic": "Treat evaluation as a design input, not an afterthought. Start in Discovery, not at launch.",
    },
]

# ---- Styles ----
styles = {
    "title": ParagraphStyle(
        "title", fontName="Helvetica-Bold", fontSize=26, leading=30,
        textColor=COCOA, alignment=TA_LEFT, spaceAfter=4,
    ),
    "subtitle": ParagraphStyle(
        "subtitle", fontName="Helvetica-Oblique", fontSize=12, leading=16,
        textColor=COCOA_70, alignment=TA_LEFT, spaceAfter=18,
    ),
    "kicker": ParagraphStyle(
        "kicker", fontName="Helvetica-Bold", fontSize=8, leading=10,
        textColor=COCOA_45, alignment=TA_LEFT, spaceAfter=2,
    ),
    "phase_num": ParagraphStyle(
        "phase_num", fontName="Helvetica-Bold", fontSize=34, leading=36,
        textColor=COCOA, alignment=TA_LEFT,
    ),
    "phase_title": ParagraphStyle(
        "phase_title", fontName="Helvetica-Bold", fontSize=18, leading=22,
        textColor=COCOA, alignment=TA_LEFT,
    ),
    "pitch": ParagraphStyle(
        "pitch", fontName="Helvetica-Oblique", fontSize=11.5, leading=15,
        textColor=COCOA_70, alignment=TA_LEFT, spaceAfter=10,
    ),
    "label": ParagraphStyle(
        "label", fontName="Helvetica-Bold", fontSize=8.5, leading=10,
        textColor=COCOA_45, alignment=TA_LEFT, spaceAfter=3,
    ),
    "list_item": ParagraphStyle(
        "list_item", fontName="Helvetica", fontSize=10, leading=13,
        textColor=COCOA, alignment=TA_LEFT, leftIndent=12, spaceAfter=2,
        bulletIndent=0,
    ),
    "heuristic": ParagraphStyle(
        "heuristic", fontName="Helvetica-Oblique", fontSize=10, leading=13.5,
        textColor=ESPRESSO, alignment=TA_LEFT,
    ),
    "body": ParagraphStyle(
        "body", fontName="Helvetica", fontSize=10.5, leading=14,
        textColor=COCOA, alignment=TA_LEFT, spaceAfter=6,
    ),
    "footer_note": ParagraphStyle(
        "footer_note", fontName="Helvetica", fontSize=8.5, leading=11,
        textColor=COCOA_45, alignment=TA_CENTER,
    ),
}


def page_background(c: canvas.Canvas, doc):
    """Paint the paper background + decorative top band on every page."""
    w, h = LETTER
    c.setFillColor(PAPER)
    c.rect(0, 0, w, h, fill=1, stroke=0)

    # Top band
    c.setFillColor(MUSTARD)
    c.rect(0, h - 0.35 * inch, w, 0.35 * inch, fill=1, stroke=0)

    # Footer band
    c.setFillColor(ESPRESSO)
    c.rect(0, 0, w, 0.45 * inch, fill=1, stroke=0)
    c.setFillColor(CREAM)
    c.setFont("Helvetica", 8)
    c.drawCentredString(w / 2, 0.17 * inch,
                        "Parker Lee  ·  parkerlee.dev  ·  The Five-Phase Framework")


def bullet_list(items):
    return [Paragraph(f"•  {item}", styles["list_item"]) for item in items]


def phase_flowable(phase):
    """Return a KeepTogether block for a single phase."""
    swatch = Table(
        [[Paragraph(phase["num"], styles["phase_num"])]],
        colWidths=[0.9 * inch], rowHeights=[0.9 * inch],
    )
    swatch.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), phase["color"]),
        ("TEXTCOLOR",  (0, 0), (-1, -1), CREAM),
        ("VALIGN",     (0, 0), (-1, -1), "MIDDLE"),
        ("ALIGN",      (0, 0), (-1, -1), "CENTER"),
        ("ROUNDEDCORNERS", [8, 8, 8, 8]),
    ]))

    header = Table(
        [[swatch, [
            Paragraph("Phase", styles["kicker"]),
            Paragraph(phase["title"], styles["phase_title"]),
            Paragraph(phase["pitch"], styles["pitch"]),
        ]]],
        colWidths=[1.1 * inch, 5.5 * inch],
    )
    header.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (1, 0), (1, 0), 10),
    ]))

    activities = [Paragraph("Activities", styles["label"])] + bullet_list(phase["activities"])
    outputs    = [Paragraph("Outputs",    styles["label"])] + bullet_list(phase["outputs"])

    two_col = Table(
        [[activities, outputs]],
        colWidths=[3.25 * inch, 3.25 * inch],
    )
    two_col.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))

    heuristic_block = Table(
        [[[Paragraph("Heuristic", styles["label"]),
           Paragraph(phase["heuristic"], styles["heuristic"])]]],
        colWidths=[6.6 * inch],
    )
    heuristic_block.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), CREAM),
        ("BOX",        (0, 0), (-1, -1), 0.5, COCOA_45),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))

    return KeepTogether([
        header,
        Spacer(1, 8),
        two_col,
        Spacer(1, 10),
        heuristic_block,
        Spacer(1, 18),
    ])


def build():
    out_dir = os.path.join(os.path.dirname(__file__), "..", "public", "resources", "downloads")
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.abspath(os.path.join(out_dir, "five-phase-framework.pdf"))

    doc = SimpleDocTemplate(
        out_path, pagesize=LETTER,
        leftMargin=0.75 * inch, rightMargin=0.75 * inch,
        topMargin=0.9 * inch, bottomMargin=0.8 * inch,
        title="The Five-Phase Framework",
        author="Parker Lee",
    )

    story = [
        Paragraph("The Five-Phase Framework", styles["title"]),
        Paragraph(
            "A working template for instructional design that earns its budget. "
            "Discover → Design → Build → Deliver → Measure.",
            styles["subtitle"],
        ),
        Paragraph(
            "Use this as a canvas, not a checklist. Copy the phase names into a doc, fill in what applies "
            "to your project, and cross out what doesn't. The goal is to make every phase a conscious "
            "decision — especially the measurement one.",
            styles["body"],
        ),
        Spacer(1, 12),
    ]

    for phase in PHASES:
        story.append(phase_flowable(phase))

    story.append(Spacer(1, 6))
    story.append(Paragraph(
        "Parker Lee — Senior Learning Experience Designer.  Find more at parkerlee.dev/resources.",
        styles["footer_note"],
    ))

    doc.build(story, onFirstPage=page_background, onLaterPages=page_background)
    print(f"Wrote {out_path}")


if __name__ == "__main__":
    build()
