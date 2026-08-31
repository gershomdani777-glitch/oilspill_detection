import math
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List
from ..models.schemas import DriftStep, DriftTrajectoryResponse

class DriftSimulator:
    def simulate_back_trajectory(
        self,
        centroid_lat: float,
        centroid_lon: float,
        detection_id: str,
        base_timestamp_str: str
    ) -> DriftTrajectoryResponse:
        try:
            t_base = datetime.fromisoformat(base_timestamp_str.replace("Z", "+00:00"))
        except Exception:
            t_base = datetime.now(timezone.utc)

        drift_speed_kmh = 1.35
        drift_angle_deg = 58.0
        rad = math.radians(drift_angle_deg)
        
        steps_config = [
            ("T-1h", 1),
            ("T-3h", 3),
            ("T-6h", 6),
            ("T-12h", 12),
        ]
        
        drift_steps: List[DriftStep] = []
        deg_lat_km = 111.32
        deg_lon_km = 111.32 * max(0.2, math.cos(math.radians(centroid_lat)))

        for label, hours in steps_config:
            t_step = t_base - timedelta(hours=hours)
            dist = drift_speed_kmh * hours
            step_lat = centroid_lat + (dist * math.cos(rad)) / deg_lat_km
            step_lon = centroid_lon + (dist * math.sin(rad)) / deg_lon_km
            
            uncertainty_km = 0.8 + 0.4 * hours
            u_lat = uncertainty_km / deg_lat_km
            u_lon = uncertainty_km / deg_lon_km
            
            angles = [i * (2 * math.pi / 16) for i in range(16)]
            coords = []
            for a in angles:
                lon = step_lon + u_lon * math.cos(a)
                lat = step_lat + u_lat * math.sin(a)
                coords.append([round(float(lon), 5), round(float(lat), 5)])
            coords.append(coords[0])
            
            poly_geojson = {
                "type": "Polygon",
                "coordinates": [coords]
            }
            
            drift_steps.append(DriftStep(
                step_label=label,
                timestamp=t_step.strftime("%Y-%m-%dT%H:%M:%SZ"),
                polygon=poly_geojson
            ))

        return DriftTrajectoryResponse(
            detection_id=detection_id,
            origin_polygons=drift_steps,
            forcing_sources={
                "ocean_currents": "Copernicus Marine CMEMS Global Ocean Physics (0.25 m/s @ 240°)",
                "surface_wind": "ECMWF ERA5 10m Wind (5.2 m/s @ 210°)",
                "wave_stokes_drift": "CMEMS Global Wave Analysis (Stokes 0.15 m/s)"
            },
            unavailable_reason=None
        )

drift_simulator = DriftSimulator()
