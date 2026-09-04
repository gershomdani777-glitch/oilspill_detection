import io
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from typing import Dict, Any, List, Optional

def generate_incident_pdf_report(
    incident_id: str,
    incident_name: str,
    location: str,
    date_str: str,
    area_km2: float,
    confidence: float,
    vessels: List[Dict[str, Any]],
    provenance_str: str = "Live Satellite / AIS Analysis",
    investigative_brief: Optional[str] = None,
    spill_age_bucket: str = "<6h (Fresh Discharge)",
    spatial_priors: Optional[Dict[str, Any]] = None
) -> io.BytesIO:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=36,
        leftMargin=36,
        topMargin=32,
        bottomMargin=32
    )
    
    styles = getSampleStyleSheet()
    
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=16,
        leading=20,
        textColor=colors.HexColor('#18181b')
    )
    
    subtitle_style = ParagraphStyle(
        'DocSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=10,
        leading=13,
        textColor=colors.HexColor('#52525b')
    )
    
    meta_style = ParagraphStyle(
        'MetaStyle',
        parent=styles['Normal'],
        fontName='Courier',
        fontSize=8.0,
        leading=10.5,
        textColor=colors.HexColor('#27272a')
    )
    
    body_style = ParagraphStyle(
        'BodyStyle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.0,
        leading=11.5,
        textColor=colors.HexColor('#18181b')
    )

    brief_style = ParagraphStyle(
        'BriefStyle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=12.5,
        textColor=colors.HexColor('#09090b')
    )

    disclaimer_style = ParagraphStyle(
        'DisclaimerStyle',
        parent=styles['Normal'],
        fontName='Helvetica-Oblique',
        fontSize=7.0,
        leading=9.5,
        textColor=colors.HexColor('#71717a')
    )

    story = []
    
    story.append(Paragraph("MARITIME POLLUTION INTELLIGENCE & INCIDENT ATTRIBUTION DOSSIER", subtitle_style))
    story.append(Spacer(1, 3))
    story.append(Paragraph(f"IMO MARPOL Annex I Evidence Record: {incident_name}", title_style))
    story.append(Spacer(1, 6))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor('#18181b'), spaceBefore=1, spaceAfter=6))
    
    # Metadata Table with Spatial Priors & Spill Age Bucket
    priors = spatial_priors or {}
    coast_dist = f"{priors.get('dist_to_coast_km', 0.0):.1f} km" if 'dist_to_coast_km' in priors else "N/A"
    lane_name = priors.get('nearest_shipping_lane', 'Designated Corridor')
    lane_dist = f"{priors.get('dist_to_shipping_lane_km', 0.0):.1f} km" if 'dist_to_shipping_lane_km' in priors else "N/A"

    meta_data = [
        [
            Paragraph("<b>Incident Ref:</b>", body_style),
            Paragraph(incident_id, meta_style),
            Paragraph("<b>Acquisition Date:</b>", body_style),
            Paragraph(date_str, meta_style)
        ],
        [
            Paragraph("<b>Centroid Location:</b>", body_style),
            Paragraph(location, body_style),
            Paragraph("<b>Estimated Area:</b>", body_style),
            Paragraph(f"{area_km2:.2f} km²", meta_style)
        ],
        [
            Paragraph("<b>Spill Age Profile:</b>", body_style),
            Paragraph(f"<b>{spill_age_bucket}</b>", meta_style),
            Paragraph("<b>Radar Confidence:</b>", body_style),
            Paragraph(f"{int(confidence * 100)}%", meta_style)
        ],
        [
            Paragraph("<b>Coastline Distance:</b>", body_style),
            Paragraph(coast_dist, meta_style),
            Paragraph("<b>Nearest Shipping Lane:</b>", body_style),
            Paragraph(f"{lane_name} ({lane_dist})", meta_style)
        ]
    ]
    
    t_meta = Table(meta_data, colWidths=[120, 150, 120, 150])
    t_meta.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#f4f4f5')),
        ('PADDING', (0, 0), (-1, -1), 4),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e4e4e7')),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    story.append(t_meta)
    story.append(Spacer(1, 8))

    # LLM-Generated Investigative Narrative Brief (Component 1)
    if investigative_brief:
        story.append(Paragraph("FORENSIC INVESTIGATIVE BRIEF (LLM SYNTHESIS / OLLAMA)", subtitle_style))
        story.append(Spacer(1, 3))
        
        brief_paragraphs = [p for p in investigative_brief.split("\n\n") if p.strip()]
        brief_flowables = [Paragraph(bp.strip(), brief_style) for bp in brief_paragraphs]
        
        t_brief = Table([[bf] for bf in brief_flowables], colWidths=[540])
        t_brief.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#fafafa')),
            ('BOX', (0, 0), (-1, -1), 1.0, colors.HexColor('#18181b')),
            ('PADDING', (0, 0), (-1, -1), 6),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ]))
        story.append(t_brief)
        story.append(Spacer(1, 8))
    
    # Suspect Vessel Attribution Ranking (Component 4 Kinematics)
    story.append(Paragraph("POTENTIALLY ASSOCIATED VESSELS & KINEMATIC ANOMALIES", subtitle_style))
    story.append(Spacer(1, 4))
    
    vessel_table_data = [
        [
            Paragraph("<b>Rank</b>", body_style),
            Paragraph("<b>Vessel / Flag</b>", body_style),
            Paragraph("<b>Type / MMSI</b>", body_style),
            Paragraph("<b>Dist (km)</b>", body_style),
            Paragraph("<b>Speed Drop</b>", body_style),
            Paragraph("<b>Heading Anomaly</b>", body_style),
            Paragraph("<b>Score</b>", body_style),
        ]
    ]
    
    for idx, v in enumerate(vessels[:5]):
        kin = v.get("kinematic_anomalies", {})
        spd_drop = f"-{kin.get('speed_drop_knots', 0.0):.1f} kts" if kin.get("speed_drop_knots", 0.0) > 0.5 else "Steady"
        hdg_dev = f"{kin.get('heading_deviation_deg', 0.0):.1f}° dev" if kin.get("heading_deviation_deg", 0.0) > 3.0 else "Straight"

        vessel_table_data.append([
            Paragraph(f"#{idx+1}", meta_style),
            Paragraph(f"{v.get('name', 'Unknown')}<br/>({v.get('flag', 'Unknown')})", body_style),
            Paragraph(f"{v.get('vessel_type', 'Vessel')}<br/>{v.get('mmsi', '')}", meta_style),
            Paragraph(f"{v.get('distance_to_spill_km', 0):.1f}", meta_style),
            Paragraph(spd_drop, meta_style),
            Paragraph(hdg_dev, meta_style),
            Paragraph(f"<b>{v.get('attribution_score', 0):.1f}</b>", meta_style),
        ])
        
    t_vessels = Table(vessel_table_data, colWidths=[30, 125, 125, 55, 75, 75, 55])
    t_vessels.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#18181b')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#d4d4d8')),
        ('PADDING', (0, 0), (-1, -1), 3.5),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ]))
    story.append(t_vessels)
    story.append(Spacer(1, 8))

    story.append(Paragraph("ATTRIBUTION EVIDENCE TRAIL & KINEMATIC SUMMARY", subtitle_style))
    story.append(Spacer(1, 3))
    for idx, v in enumerate(vessels[:3]):
        ev = v.get("evidence_summary", "No details available.")
        story.append(Paragraph(f"• <b>Rank #{idx+1} ({v.get('name')}):</b> {ev}", body_style))
        story.append(Spacer(1, 2))
        
    story.append(Spacer(1, 6))
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor('#a1a1aa'), spaceBefore=1, spaceAfter=4))
    
    disclaimer_text = (
        "<b>ANALYTICAL NOTICE & LEGAL DISCLAIMER:</b> The attribution scores, kinematic signals, and LLM investigative narrative "
        "are analytical screening indicators ('potentially associated vessels' / 'suspects') derived from satellite SAR and AIS correlation. "
        "They do NOT constitute definitive proof of legal guilt or liability. Port State Control physical inspection under IMO MARPOL "
        "is required before enforcement action."
    )
    story.append(Paragraph(disclaimer_text, disclaimer_style))
    
    doc.build(story)
    buffer.seek(0)
    return buffer
