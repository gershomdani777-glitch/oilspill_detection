import io
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from typing import Dict, Any, List

def generate_incident_pdf_report(
    incident_id: str,
    incident_name: str,
    location: str,
    date_str: str,
    area_km2: float,
    confidence: float,
    vessels: List[Dict[str, Any]],
    provenance_str: str = "Live Satellite / AIS Analysis"
) -> io.BytesIO:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=36,
        leftMargin=36,
        topMargin=36,
        bottomMargin=36
    )
    
    styles = getSampleStyleSheet()
    
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=18,
        leading=22,
        textColor=colors.HexColor('#232324')
    )
    
    subtitle_style = ParagraphStyle(
        'DocSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=11,
        leading=14,
        textColor=colors.HexColor('#5c5c61')
    )
    
    meta_style = ParagraphStyle(
        'MetaStyle',
        parent=styles['Normal'],
        fontName='Courier',
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor('#454546')
    )
    
    body_style = ParagraphStyle(
        'BodyStyle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=12,
        textColor=colors.HexColor('#232324')
    )

    disclaimer_style = ParagraphStyle(
        'DisclaimerStyle',
        parent=styles['Normal'],
        fontName='Helvetica-Oblique',
        fontSize=7.5,
        leading=10.5,
        textColor=colors.HexColor('#696970')
    )

    story = []
    
    story.append(Paragraph("MARITIME INTELLIGENCE & SATELLITE SPILL DOSSIER", subtitle_style))
    story.append(Spacer(1, 4))
    story.append(Paragraph(f"Incident Report: {incident_name}", title_style))
    story.append(Spacer(1, 8))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor('#232324'), spaceBefore=1, spaceAfter=8))
    
    meta_data = [
        [
            Paragraph("<b>Incident Identifier:</b>", body_style),
            Paragraph(incident_id, meta_style),
            Paragraph("<b>Acquisition Date:</b>", body_style),
            Paragraph(date_str, meta_style)
        ],
        [
            Paragraph("<b>Geographic Location:</b>", body_style),
            Paragraph(location, body_style),
            Paragraph("<b>Estimated Area:</b>", body_style),
            Paragraph(f"{area_km2:.2f} km²", meta_style)
        ],
        [
            Paragraph("<b>AI Confidence:</b>", body_style),
            Paragraph(f"{int(confidence * 100)}%", meta_style),
            Paragraph("<b>Data Provenance:</b>", body_style),
            Paragraph(f"[{provenance_str}]", meta_style)
        ]
    ]
    
    t_meta = Table(meta_data, colWidths=[120, 150, 110, 160])
    t_meta.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#f4f4f5')),
        ('PADDING', (0, 0), (-1, -1), 5),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e4e4e7')),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    story.append(t_meta)
    story.append(Spacer(1, 12))
    
    story.append(Paragraph("POTENTIALLY ASSOCIATED VESSELS (TOP SUSPECT RANKING)", subtitle_style))
    story.append(Spacer(1, 6))
    
    vessel_table_data = [
        [
            Paragraph("<b>Rank</b>", body_style),
            Paragraph("<b>Vessel / Flag</b>", body_style),
            Paragraph("<b>Type / MMSI</b>", body_style),
            Paragraph("<b>Dist (km)</b>", body_style),
            Paragraph("<b>AIS Gap</b>", body_style),
            Paragraph("<b>Score</b>", body_style),
        ]
    ]
    
    for idx, v in enumerate(vessels[:5]):
        gap_label = ["None", "< 2h", "2-6h", "> 6h"][v.get("ais_gap_severity", 0)]
        vessel_table_data.append([
            Paragraph(f"#{idx+1}", meta_style),
            Paragraph(f"{v.get('name', 'Unknown')}<br/>({v.get('flag', 'Unknown')})", body_style),
            Paragraph(f"{v.get('vessel_type', 'Vessel')}<br/>{v.get('mmsi', '')}", meta_style),
            Paragraph(f"{v.get('distance_to_spill_km', 0):.1f}", meta_style),
            Paragraph(gap_label, meta_style),
            Paragraph(f"<b>{v.get('attribution_score', 0):.1f}</b>", meta_style),
        ])
        
    t_vessels = Table(vessel_table_data, colWidths=[35, 145, 145, 65, 75, 75])
    t_vessels.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#232324')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#d4d4d8')),
        ('PADDING', (0, 0), (-1, -1), 4.5),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ]))
    story.append(t_vessels)
    story.append(Spacer(1, 10))

    story.append(Paragraph("ANALYTICAL EVIDENCE SUMMARY", subtitle_style))
    story.append(Spacer(1, 4))
    for idx, v in enumerate(vessels[:3]):
        ev = v.get("evidence_summary", "No details available.")
        story.append(Paragraph(f"• <b>Rank #{idx+1} ({v.get('name')}):</b> {ev}", body_style))
        story.append(Spacer(1, 3))
        
    story.append(Spacer(1, 10))
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor('#a1a1aa'), spaceBefore=1, spaceAfter=6))
    
    disclaimer_text = (
        "<b>ANALYTICAL NOTICE & LEGAL DISCLAIMER:</b> The attribution scores and vessel associations presented in this "
        "report are derived purely from automated satellite SAR feature extraction and historical AIS spatial-temporal "
        "correlation models. They represent analytical screening indicators ('potentially associated vessels' / 'suspects') "
        "and do NOT constitute definitive proof of legal liability, guilt, or intentional discharge. Ground verification "
        "and competent maritime authority inspection are required before enforcement action."
    )
    story.append(Paragraph(disclaimer_text, disclaimer_style))
    
    doc.build(story)
    buffer.seek(0)
    return buffer
