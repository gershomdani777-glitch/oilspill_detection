import math
from typing import Dict, Any, Tuple
from ..models.schemas import ScoreBreakdown

def calculate_haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    a = math.sin(delta_phi / 2.0)**2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

def classify_ais_gap_severity(gap_duration_hours: float) -> int:
    if gap_duration_hours < 0.5:
        return 0
    elif gap_duration_hours < 2.0:
        return 1
    elif gap_duration_hours < 6.0:
        return 2
    else:
        return 3

def compute_proximity_score(distance_km: float, search_radius_km: float = 50.0) -> float:
    if search_radius_km <= 0:
        return 0.0
    score = 100.0 * (1.0 - (distance_km / search_radius_km))
    return max(0.0, min(100.0, score))

def compute_ais_gap_score(gap_severity: int) -> float:
    mapping = {0: 0.0, 1: 35.0, 2: 70.0, 3: 100.0}
    return mapping.get(gap_severity, 0.0)

def compute_vessel_type_score(vessel_type: str) -> float:
    vtype = vessel_type.lower()
    if any(k in vtype for k in ['tanker', 'crude', 'bunker', 'petroleum', 'chemical']):
        return 100.0
    elif any(k in vtype for k in ['bulk', 'ore', 'carrier']):
        return 80.0
    elif any(k in vtype for k in ['cargo', 'container', 'freight']):
        return 50.0
    else:
        return 20.0

def compute_trajectory_score(trajectory_alignment: str) -> float:
    traj = trajectory_alignment.lower()
    if traj == 'strong':
        return 100.0
    elif traj == 'moderate':
        return 60.0
    elif traj == 'weak':
        return 20.0
    else:
        return 0.0

def compute_attribution_score(
    proximity: float,
    ais_gap: float,
    vessel_type: float,
    trajectory_alignment: float,
    cargo_port_correlation: float,
    historical_violation: float
) -> Tuple[float, ScoreBreakdown]:
    prox = max(0.0, min(100.0, proximity))
    gap = max(0.0, min(100.0, ais_gap))
    vtype = max(0.0, min(100.0, vessel_type))
    traj = max(0.0, min(100.0, trajectory_alignment))
    cargo = max(0.0, min(100.0, cargo_port_correlation))
    hist = max(0.0, min(100.0, historical_violation))

    final_score = (
        0.30 * prox +
        0.25 * gap +
        0.15 * vtype +
        0.15 * traj +
        0.10 * cargo +
        0.05 * hist
    )
    final_score = round(max(0.0, min(100.0, final_score)), 1)
    
    breakdown = ScoreBreakdown(
        proximity=round(prox, 1),
        ais_gap=round(gap, 1),
        vessel_type=round(vtype, 1),
        trajectory_alignment=round(traj, 1),
        cargo_port_correlation=round(cargo, 1),
        historical_violation=round(hist, 1)
    )
    return final_score, breakdown

def generate_evidence_summary(
    vessel_type: str,
    distance_km: float,
    gap_hours: float,
    trajectory_alignment: str,
    cargo: str,
    score: float
) -> str:
    parts = [f'{vessel_type.capitalize()}']
    parts.append(f'{distance_km:.1f} km from spill centroid')
    
    if gap_hours >= 0.5:
        parts.append(f'{gap_hours:.1f} h AIS gap overlapping the attribution window')
    else:
        parts.append('continuous AIS broadcast during overpass')
        
    if trajectory_alignment.lower() in ['strong', 'moderate']:
        parts.append(f'{trajectory_alignment.lower()} track alignment with spill axis')
        
    if cargo and cargo.lower() not in ['unknown', 'none', 'unladen']:
        parts.append(f'manifested cargo: {cargo}')

    summary_sentence = ', '.join(parts) + '.'
    return summary_sentence
