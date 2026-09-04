import math
from typing import Dict, Any, List, Tuple

# Major global shipping lanes / tanker transit corridor coordinates
# (Corridor Name, List of [lat, lon] waypoints, typical corridor width in km)
GLOBAL_SHIPPING_CORRIDORS: List[Dict[str, Any]] = [
    {
        "name": "Strait of Malacca & Singapore Route",
        "waypoints": [[5.5, 95.3], [3.2, 100.5], [1.2, 103.8], [1.4, 104.5]],
        "typical_width_km": 25.0
    },
    {
        "name": "Cape Route / Mozambique Channel / Mauritius Corridor",
        "waypoints": [[-35.0, 20.0], [-28.0, 40.0], [-20.5, 57.5], [-12.0, 65.0], [5.0, 80.0]],
        "typical_width_km": 45.0
    },
    {
        "name": "Persian Gulf / Strait of Hormuz Corridor",
        "waypoints": [[29.5, 49.0], [27.0, 52.0], [26.5, 56.5], [23.5, 59.5]],
        "typical_width_km": 30.0
    },
    {
        "name": "Gulf of Mexico / Mississippi Delta Outer Shipping Fairway",
        "waypoints": [[24.5, -83.0], [27.5, -88.0], [29.0, -89.5], [28.5, -94.0]],
        "typical_width_km": 35.0
    },
    {
        "name": "English Channel / Dover Strait TSS",
        "waypoints": [[49.5, -4.0], [50.2, -1.0], [51.2, 1.5], [52.0, 2.8]],
        "typical_width_km": 18.0
    },
    {
        "name": "East China Sea / Taiwan Strait Corridor",
        "waypoints": [[22.0, 119.0], [25.5, 121.0], [30.5, 124.5], [34.0, 128.5]],
        "typical_width_km": 40.0
    },
    {
        "name": "Red Sea / Bab-el-Mandeb / Suez Transit Route",
        "waypoints": [[12.5, 43.5], [18.0, 40.0], [27.5, 34.0], [29.9, 32.5]],
        "typical_width_km": 25.0
    },
    {
        "name": "Bay of Biscay / Finisterre Traffic Separation Scheme",
        "waypoints": [[43.0, -9.5], [45.5, -7.0], [48.5, -5.5]],
        "typical_width_km": 30.0
    },
    {
        "name": "Sri Lanka Southern Coast Deep Sea Route",
        "waypoints": [[5.5, 79.5], [5.8, 80.5], [6.0, 81.5], [7.0, 82.5]],
        "typical_width_km": 20.0
    },
    {
        "name": "Gibraltar Strait & Western Mediterranean Fairway",
        "waypoints": [[36.0, -7.0], [35.9, -5.6], [36.5, -2.0], [37.5, 4.0]],
        "typical_width_km": 20.0
    }
]

# Major global coastal reference points for distance-to-shore approximation
COASTLINE_REF_POINTS: List[Tuple[float, float]] = [
    # Indian Ocean / Africa / Mauritius / Madagascar / Sri Lanka / India
    (-20.44, 57.75), (-20.15, 57.50), (-20.88, 55.45), (-18.15, 49.40), (-12.28, 49.30),
    (6.00, 80.20), (7.00, 81.80), (8.50, 77.00), (13.08, 80.27), (18.92, 72.83),
    (-4.05, 39.66), (-6.82, 39.28), (-25.96, 32.58), (-34.00, 18.45), (11.75, 43.15),
    # Gulf of Mexico / Caribbean / US East & Gulf Coast
    (29.25, -89.40), (28.95, -89.15), (29.95, -90.07), (29.76, -95.36), (26.07, -97.15),
    (27.95, -82.45), (25.76, -80.19), (21.16, -86.85), (19.17, -96.13), (23.11, -82.36),
    # Southeast Asia / Malacca / South China Sea
    (1.35, 103.82), (2.20, 102.25), (3.00, 101.40), (5.41, 100.33), (3.59, 98.67),
    (-6.20, 106.81), (10.76, 106.66), (14.60, 120.98), (22.28, 114.16), (24.48, 118.09),
    # Europe / UK / Mediterranean / Brittany
    (48.60, -4.77), (48.39, -4.48), (47.21, -1.55), (43.36, -8.41), (38.72, -9.14),
    (50.80, -1.10), (51.13, 1.31), (53.55, 9.99), (51.92, 4.48), (56.00, 3.20),
    (36.14, -5.35), (43.30, 5.37), (44.40, 8.93), (40.85, 14.26), (37.98, 23.72),
    # Middle East / Persian Gulf / Red Sea
    (26.22, 50.58), (25.28, 55.30), (27.18, 56.27), (23.61, 58.54), (21.49, 39.19)
]

def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculates great-circle distance between two points in km."""
    R = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2.0) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlambda / 2.0) ** 2
    return round(2.0 * R * math.asin(math.sqrt(min(1.0, a))), 2)

def distance_point_to_segment_km(p_lat: float, p_lon: float, a_lat: float, a_lon: float, b_lat: float, b_lon: float) -> float:
    """Calculates approximate perpendicular distance from point P to line segment AB in km."""
    d_ab = haversine_km(a_lat, a_lon, b_lat, b_lon)
    if d_ab < 0.1:
        return haversine_km(p_lat, p_lon, a_lat, a_lon)

    # Parametric projection on segment
    x_p, y_p = p_lon * math.cos(math.radians((a_lat + b_lat) / 2.0)), p_lat
    x_a, y_a = a_lon * math.cos(math.radians((a_lat + b_lat) / 2.0)), a_lat
    x_b, y_b = b_lon * math.cos(math.radians((a_lat + b_lat) / 2.0)), b_lat

    dx, dy = x_b - x_a, y_b - y_a
    t = max(0.0, min(1.0, ((x_p - x_a) * dx + (y_p - y_a) * dy) / (dx * dx + dy * dy + 1e-12)))

    proj_lat = a_lat + t * (b_lat - a_lat)
    proj_lon = a_lon + t * (b_lon - a_lon)
    return haversine_km(p_lat, p_lon, proj_lat, proj_lon)

def compute_spatial_priors(centroid_lat: float, centroid_lon: float) -> Dict[str, Any]:
    """
    Computes spatial distance priors for look-alike discrimination:
    1. Distance to nearest coastline (km)
    2. Distance to nearest major shipping lane (km)
    3. Look-alike prior risk multiplier
    """
    # 1. Distance to nearest coastline point
    min_coast_km = min(
        haversine_km(centroid_lat, centroid_lon, c_lat, c_lon)
        for c_lat, c_lon in COASTLINE_REF_POINTS
    )

    # 2. Distance to nearest shipping lane corridor
    min_lane_km = float('inf')
    nearest_corridor_name = "Undesignated High Seas"

    for corridor in GLOBAL_SHIPPING_CORRIDORS:
        waypoints = corridor["waypoints"]
        for i in range(len(waypoints) - 1):
            a_lat, a_lon = waypoints[i]
            b_lat, b_lon = waypoints[i + 1]
            d = distance_point_to_segment_km(centroid_lat, centroid_lon, a_lat, a_lon, b_lat, b_lon)
            if d < min_lane_km:
                min_lane_km = d
                nearest_corridor_name = corridor["name"]

    min_lane_km = round(min_lane_km, 1)
    min_coast_km = round(min_coast_km, 1)

    # 3. Look-alike probability multiplier
    # Spills overwhelmingly occur close to shipping corridors (< 30km) or coastlines (< 50km).
    # Open ocean > 200km away from any lane or coast has a strong look-alike prior (e.g. biogenic slicks / calm sea).
    if min_lane_km <= 25.0 or min_coast_km <= 35.0:
        spatial_prior_score = 0.95  # Very high likelihood of human maritime activity
        look_alike_risk_category = "High Anthropogenic Spill Probability (Near Lane / Coast)"
    elif min_lane_km <= 80.0 or min_coast_km <= 100.0:
        spatial_prior_score = 0.78  # Moderate maritime transit zone
        look_alike_risk_category = "Moderate Anthropogenic Corridor"
    elif min_lane_km <= 180.0:
        spatial_prior_score = 0.50  # Outer continental shelf / secondary lane
        look_alike_risk_category = "Intermediate Zone (Look-Alike Screening Required)"
    else:
        spatial_prior_score = 0.20  # Remote open ocean -> high chance of natural film / low wind look-alike
        look_alike_risk_category = "Remote Pelagic Basin (Elevated Look-Alike Prior)"

    return {
        "dist_to_coast_km": min_coast_km,
        "dist_to_shipping_lane_km": min_lane_km,
        "nearest_shipping_lane": nearest_corridor_name,
        "spatial_prior_score": spatial_prior_score,
        "look_alike_risk_category": look_alike_risk_category
    }
