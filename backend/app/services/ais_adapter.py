import math
import logging
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional
import httpx
from .attribution import (
    calculate_haversine_distance,
    classify_ais_gap_severity,
    compute_proximity_score,
    compute_ais_gap_score,
    compute_vessel_type_score,
    compute_kinematic_sub_signals,
    compute_attribution_score,
    generate_evidence_summary
)
from ..models.schemas import VesselAttribution, VesselPositionPoint, ScoreBreakdown, ProvenanceType
from ..config import settings

logger = logging.getLogger("ais_adapter")

GFW_BASE_URL = "https://gateway.api.globalfishingwatch.org/v3"

def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlambda / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))

def bearing_deg(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    p1, p2 = map(math.radians, (lat1, lat2))
    dl = math.radians(lon2 - lon1)
    x = math.sin(dl) * math.cos(p2)
    y = math.cos(p1) * math.sin(p2) - math.sin(p1) * math.cos(p2) * math.cos(dl)
    return (math.degrees(math.atan2(x, y)) + 360) % 360

class AISAdapter:
    def __init__(self):
        self.provider_name = "Global Fishing Watch (GFW) / Research AIS Stream"
        self.gfw_token = settings.GFW_API_KEY or ""

    def query_vessels(
        self,
        centroid_lat: float,
        centroid_lon: float,
        overpass_time_str: str,
        search_radius_km: float = 50.0,
        start_hours_back: float = 6.0,
        end_hours_forward: float = 1.0
    ) -> List[VesselAttribution]:
        try:
            t_spill = datetime.fromisoformat(overpass_time_str.replace("Z", "+00:00"))
        except Exception:
            t_spill = datetime.now(timezone.utc)

        # Baseline candidate vessels with explicit kinematic profiles
        candidates = [
            {
                "mmsi": "636019842",
                "imo": "9421881",
                "name": "NORDIC GLORY",
                "vessel_type": "Crude Oil Tanker",
                "flag": "Liberia",
                "cargo": "Crude Petroleum (115,000 DWT)",
                "dist_km": 4.2,
                "gap_hours": 5.5,
                "cargo_corr": 90.0,
                "hist_violation": 0.0,
                "heading": 42.0,
                "speed": 11.4,
                # Explicit Kinematic Anomaly Profile (Component 4)
                "speed_drop_knots": 8.9,
                "initial_speed_knots": 13.8,
                "min_speed_knots": 2.1,
                "heading_deviation_deg": 42.5
            },
            {
                "mmsi": "353891000",
                "imo": "9382217",
                "name": "OCEAN VOYAGER",
                "vessel_type": "Chemical / Oil Tanker",
                "flag": "Panama",
                "cargo": "Refined Bunker Fuel",
                "dist_km": 14.8,
                "gap_hours": 1.5,
                "cargo_corr": 70.0,
                "hist_violation": 0.0,
                "heading": 55.0,
                "speed": 13.8,
                "speed_drop_knots": 4.2,
                "initial_speed_knots": 14.0,
                "min_speed_knots": 7.8,
                "heading_deviation_deg": 18.0
            },
            {
                "mmsi": "249822000",
                "imo": "9612923",
                "name": "PACIFIC TITAN",
                "vessel_type": "Bulk Carrier",
                "flag": "Malta",
                "cargo": "Iron Ore (Ballast / Fuel Only)",
                "dist_km": 28.5,
                "gap_hours": 0.2,
                "cargo_corr": 20.0,
                "hist_violation": 0.0,
                "heading": 210.0,
                "speed": 10.2,
                "speed_drop_knots": 1.1,
                "initial_speed_knots": 10.5,
                "min_speed_knots": 9.4,
                "heading_deviation_deg": 6.0
            },
            {
                "mmsi": "477123900",
                "imo": "9813456",
                "name": "EVER PRIDE",
                "vessel_type": "Container Ship",
                "flag": "Hong Kong",
                "cargo": "Containerized Freight",
                "dist_km": 39.1,
                "gap_hours": 0.1,
                "cargo_corr": 10.0,
                "hist_violation": 0.0,
                "heading": 185.0,
                "speed": 18.5,
                "speed_drop_knots": 0.4,
                "initial_speed_knots": 18.8,
                "min_speed_knots": 18.4,
                "heading_deviation_deg": 2.0
            },
            {
                "mmsi": "228037600",
                "imo": "8934521",
                "name": "BLUE MARLIN",
                "vessel_type": "General Cargo",
                "flag": "France",
                "cargo": "General Packaged Freight",
                "dist_km": 46.2,
                "gap_hours": 0.0,
                "cargo_corr": 5.0,
                "hist_violation": 0.0,
                "heading": 90.0,
                "speed": 12.0,
                "speed_drop_knots": 0.0,
                "initial_speed_knots": 12.0,
                "min_speed_knots": 12.0,
                "heading_deviation_deg": 0.5
            }
        ]

        # Filter candidates by dynamic search radius
        matched = [c for c in candidates if c["dist_km"] <= search_radius_km]
        if not matched:
            matched = candidates[:3]

        results: List[VesselAttribution] = []

        for c in matched:
            dist_km = float(c["dist_km"])
            gap_hrs = float(c["gap_hours"])
            v_type = c["vessel_type"]
            gap_sev = classify_ais_gap_severity(gap_hrs)

            # Component 4: Explicit Kinematic Sub-Signal Computation
            kinematics = compute_kinematic_sub_signals(
                speed_drop_knots=c["speed_drop_knots"],
                initial_speed_knots=c["initial_speed_knots"],
                min_speed_knots=c["min_speed_knots"],
                heading_deviation_deg=c["heading_deviation_deg"],
                distance_to_spill_km=dist_km
            )

            # Standard 6-Factor Attribution Scores
            s_prox = compute_proximity_score(dist_km, search_radius_km)
            s_gap = compute_ais_gap_score(gap_sev)
            s_type = compute_vessel_type_score(v_type)
            s_traj = kinematics["trajectory_score"]
            s_cargo = float(c["cargo_corr"])
            s_hist = float(c["hist_violation"])

            score, breakdown = compute_attribution_score(
                proximity=s_prox,
                ais_gap=s_gap,
                vessel_type=s_type,
                trajectory_alignment=s_traj,
                cargo_port_correlation=s_cargo,
                historical_violation=s_hist
            )

            # Generate synthetic track points calibrated relative to centroid
            angle_rad = math.radians(float(c["heading"]))
            d_lat = (dist_km / 111.0) * math.cos(angle_rad)
            d_lon = (dist_km / (111.0 * max(0.2, abs(math.cos(math.radians(centroid_lat)))))) * math.sin(angle_rad)
            v_lat = centroid_lat + d_lat
            v_lon = centroid_lon + d_lon

            history_points: List[VesselPositionPoint] = []
            num_steps = 6
            step_hrs = max(0.5, (start_hours_back + end_hours_forward) / num_steps)
            
            for i in range(num_steps):
                t_offset = (i - num_steps + 1) * step_hrs
                t_point = t_spill + timedelta(hours=t_offset)
                dt_h = (num_steps - 1 - i) * step_hrs
                
                # Speed at this step
                if i >= num_steps - 2:
                    curr_spd = c["min_speed_knots"]
                else:
                    curr_spd = c["initial_speed_knots"]
                    
                p_lat = v_lat - (curr_spd * 1.852 * dt_h / 111.0) * math.cos(angle_rad)
                p_lon = v_lon - (curr_spd * 1.852 * dt_h / 111.0) * math.sin(angle_rad)

                history_points.append(VesselPositionPoint(
                    lat=round(float(p_lat), 5),
                    lon=round(float(p_lon), 5),
                    timestamp=t_point.strftime("%Y-%m-%dT%H:%M:%SZ"),
                    course=float(c["heading"]),
                    speed=round(float(curr_spd), 1)
                ))

            evidence_str = generate_evidence_summary(
                vessel_type=v_type,
                distance_km=dist_km,
                gap_hours=gap_hrs,
                trajectory_alignment="strong" if s_traj >= 70 else ("moderate" if s_traj >= 40 else "weak"),
                cargo=c["cargo"],
                score=score,
                kinematic_narrative=kinematics["kinematic_narrative"]
            )

            results.append(VesselAttribution(
                mmsi=c["mmsi"],
                imo=c["imo"],
                name=c["name"],
                vessel_type=v_type,
                flag=c["flag"],
                cargo=c["cargo"],
                distance_to_spill_km=round(dist_km, 1),
                position_history=history_points,
                ais_gap_severity=gap_sev,
                attribution_score=score,
                score_breakdown=breakdown,
                evidence_summary=evidence_str,
                provenance=ProvenanceType.DEMO_RECONSTRUCTION,
                kinematic_anomalies=kinematics
            ))

        # Rank vessels by attribution score descending
        results.sort(key=lambda v: v.attribution_score, reverse=True)
        return results

ais_adapter = AISAdapter()
