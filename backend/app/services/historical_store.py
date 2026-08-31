from typing import List, Dict, Any, Optional
from ..models.schemas import HistoricalIncidentSummary, ReplayTimelineResponse, ReplayStep, ProvenanceType
import math

class HistoricalStore:
    def __init__(self):
        self.incidents: Dict[str, Dict[str, Any]] = {
            "inc-wakashio-2020": {
                "incident_id": "inc-wakashio-2020",
                "name": "MV Wakashio Grounding & Reef Impact",
                "date": "2020-07-25",
                "location": "Pointe d'Esny, Mauritius (Indian Ocean)",
                "summary": "Bulk carrier MV Wakashio struck a coral reef spilling ~1,000 tonnes of heavy VLSFO bunker fuel along the southeastern coast of Mauritius.",
                "provenance": ProvenanceType.DOCUMENTED_FACT,
                "coordinates": [-20.4431, 57.7478],
                "area_km2": 26.8,
                "vessel_name": "MV WAKASHIO (IMO 9337119)",
                "timeline_steps": [
                    {"label": "T-12h", "time": "2020-07-25T07:30:00Z", "spill_scale": 0.2, "vessel_offset": [-0.25, -0.30]},
                    {"label": "T-6h", "time": "2020-07-25T13:30:00Z", "spill_scale": 0.35, "vessel_offset": [-0.12, -0.15]},
                    {"label": "T-3h", "time": "2020-07-25T16:30:00Z", "spill_scale": 0.5, "vessel_offset": [-0.05, -0.06]},
                    {"label": "T-1h", "time": "2020-07-25T18:30:00Z", "spill_scale": 0.75, "vessel_offset": [-0.01, -0.01]},
                    {"label": "Spill", "time": "2020-07-25T19:30:00Z", "spill_scale": 1.0, "vessel_offset": [0.0, 0.0]},
                    {"label": "T+1h", "time": "2020-07-25T20:30:00Z", "spill_scale": 1.4, "vessel_offset": [0.0, 0.0]}
                ]
            },
            "inc-deepwater-2010": {
                "incident_id": "inc-deepwater-2010",
                "name": "Deepwater Horizon MC-252 Blowout",
                "date": "2010-04-20",
                "location": "Mississippi Canyon, Gulf of Mexico",
                "summary": "Subsea well blowout and drilling rig explosion releasing 4.9 million barrels of crude oil across thousands of square kilometers.",
                "provenance": ProvenanceType.DOCUMENTED_FACT,
                "coordinates": [28.7366, -88.3659],
                "area_km2": 6800.0,
                "vessel_name": "DEEPWATER HORIZON / DISCOVERER ENTERPRISE",
                "timeline_steps": [
                    {"label": "T-12h", "time": "2010-04-20T09:00:00Z", "spill_scale": 0.3, "vessel_offset": [0.01, 0.01]},
                    {"label": "T-6h", "time": "2010-04-20T15:00:00Z", "spill_scale": 0.45, "vessel_offset": [0.0, 0.0]},
                    {"label": "T-3h", "time": "2010-04-20T18:00:00Z", "spill_scale": 0.65, "vessel_offset": [0.0, 0.0]},
                    {"label": "T-1h", "time": "2010-04-20T20:00:00Z", "spill_scale": 0.85, "vessel_offset": [0.0, 0.0]},
                    {"label": "Spill", "time": "2010-04-20T21:45:00Z", "spill_scale": 1.0, "vessel_offset": [0.0, 0.0]},
                    {"label": "T+1h", "time": "2010-04-20T22:45:00Z", "spill_scale": 1.6, "vessel_offset": [0.0, 0.0]}
                ]
            },
            "inc-sanchi-2018": {
                "incident_id": "inc-sanchi-2018",
                "name": "MT Sanchi Condensate Collision",
                "date": "2018-01-06",
                "location": "East China Sea (160 nm off Shanghai)",
                "summary": "Panamanian-flagged tanker MT Sanchi carrying 136,000 tonnes of natural gas condensate collided with bulk carrier CF Crystal and drifted ablaze.",
                "provenance": ProvenanceType.DOCUMENTED_FACT,
                "coordinates": [30.8500, 124.9500],
                "area_km2": 115.4,
                "vessel_name": "MT SANCHI (IMO 9356608)",
                "timeline_steps": [
                    {"label": "T-12h", "time": "2018-01-06T00:00:00Z", "spill_scale": 0.2, "vessel_offset": [-0.35, -0.25]},
                    {"label": "T-6h", "time": "2018-01-06T06:00:00Z", "spill_scale": 0.35, "vessel_offset": [-0.18, -0.12]},
                    {"label": "T-3h", "time": "2018-01-06T09:00:00Z", "spill_scale": 0.5, "vessel_offset": [-0.08, -0.05]},
                    {"label": "T-1h", "time": "2018-01-06T11:00:00Z", "spill_scale": 0.75, "vessel_offset": [-0.02, -0.01]},
                    {"label": "Spill", "time": "2018-01-06T12:00:00Z", "spill_scale": 1.0, "vessel_offset": [0.0, 0.0]},
                    {"label": "T+1h", "time": "2018-01-06T13:00:00Z", "spill_scale": 1.5, "vessel_offset": [0.02, 0.03]}
                ]
            },
            "inc-amoco-1978": {
                "incident_id": "inc-amoco-1978",
                "name": "Amoco Cadiz Supertanker Disaster",
                "date": "1978-03-16",
                "location": "Portsall, Brittany, France",
                "summary": "VLCC Amoco Cadiz suffered steering failure and ran aground on Portsall Rocks releasing 220,880 tonnes of light crude along 360 km of coastline.",
                "provenance": ProvenanceType.DOCUMENTED_FACT,
                "coordinates": [48.6000, -4.7667],
                "area_km2": 320.0,
                "vessel_name": "AMOCO CADIZ (IMO 7336422)",
                "timeline_steps": [
                    {"label": "T-12h", "time": "1978-03-16T09:00:00Z", "spill_scale": 0.25, "vessel_offset": [-0.28, 0.22]},
                    {"label": "T-6h", "time": "1978-03-16T15:00:00Z", "spill_scale": 0.4, "vessel_offset": [-0.14, 0.10]},
                    {"label": "T-3h", "time": "1978-03-16T18:00:00Z", "spill_scale": 0.6, "vessel_offset": [-0.05, 0.03]},
                    {"label": "T-1h", "time": "1978-03-16T20:00:00Z", "spill_scale": 0.8, "vessel_offset": [-0.01, 0.01]},
                    {"label": "Spill", "time": "1978-03-16T21:04:00Z", "spill_scale": 1.0, "vessel_offset": [0.0, 0.0]},
                    {"label": "T+1h", "time": "1978-03-16T22:04:00Z", "spill_scale": 1.6, "vessel_offset": [0.0, 0.0]}
                ]
            },
            "inc-newdiamond-2020": {
                "incident_id": "inc-newdiamond-2020",
                "name": "MT New Diamond Engine Explosion",
                "date": "2020-09-03",
                "location": "Sangamankanda, Eastern Sri Lanka",
                "summary": "Fully laden 300,000 DWT VLCC carrying 270,000 tonnes of Kuwait crude suffered boiler explosion 38 nm off Sangamankanda Point; bunker leak contained.",
                "provenance": ProvenanceType.MODEL_RECONSTRUCTION,
                "coordinates": [7.0500, 82.3500],
                "area_km2": 4.5,
                "vessel_name": "MT NEW DIAMOND (IMO 9191424)",
                "timeline_steps": [
                    {"label": "T-12h", "time": "2020-09-02T19:00:00Z", "spill_scale": 0.2, "vessel_offset": [-0.20, -0.15]},
                    {"label": "T-6h", "time": "2020-09-03T01:00:00Z", "spill_scale": 0.35, "vessel_offset": [-0.09, -0.07]},
                    {"label": "T-3h", "time": "2020-09-03T04:00:00Z", "spill_scale": 0.5, "vessel_offset": [-0.04, -0.03]},
                    {"label": "T-1h", "time": "2020-09-03T06:00:00Z", "spill_scale": 0.75, "vessel_offset": [-0.01, -0.01]},
                    {"label": "Spill", "time": "2020-09-03T07:00:00Z", "spill_scale": 1.0, "vessel_offset": [0.0, 0.0]},
                    {"label": "T+1h", "time": "2020-09-03T08:00:00Z", "spill_scale": 1.3, "vessel_offset": [0.0, 0.0]}
                ]
            }
        }

    def list_incidents(self) -> List[HistoricalIncidentSummary]:
        results = []
        for inc in self.incidents.values():
            results.append(HistoricalIncidentSummary(
                incident_id=inc["incident_id"],
                name=inc["name"],
                date=inc["date"],
                location=inc["location"],
                summary=inc["summary"],
                provenance=inc["provenance"],
                coordinates=inc["coordinates"],
                area_km2=inc["area_km2"],
                vessel_name=inc["vessel_name"]
            ))
        return results

    def get_replay_timeline(self, incident_id: str) -> Optional[ReplayTimelineResponse]:
        inc = self.incidents.get(incident_id)
        if not inc:
            return None
            
        c_lat, c_lon = inc["coordinates"]
        timeline: List[ReplayStep] = []
        area_km2 = inc.get("area_km2", 20.0)
        
        # Base angular radius scaled relative to area
        r_deg = max(0.025, math.sqrt(area_km2) * 0.008)
        
        for step in inc["timeline_steps"]:
            v_lat = round(float(c_lat + step["vessel_offset"][0]), 5)
            v_lon = round(float(c_lon + step["vessel_offset"][1]), 5)
            
            vessel_positions = [{
                "mmsi": "999000123",
                "name": inc["vessel_name"],
                "lat": v_lat,
                "lon": v_lon,
                "course": 45.0,
                "speed": 0.0 if (step["label"] in ["Spill", "T+1h"] and "Grounding" in inc["name"]) else 11.5
            }]
            
            # Generate realistic multi-lobed satellite slick polygon for each step
            scale = step.get("spill_scale", 1.0)
            angles = [i * (2 * math.pi / 24) for i in range(24)]
            coords_main = []
            r_base = r_deg * scale
            for a in angles:
                elongation = 1.4 * math.cos(a - 0.4)
                wobble = 0.15 * math.sin(3 * a) + 0.1 * math.cos(5 * a)
                r = r_base * (1.0 + 0.35 * elongation + wobble)
                lon = c_lon + r * math.cos(a)
                lat = c_lat + r * math.sin(a)
                coords_main.append([round(float(lon), 5), round(float(lat), 5)])
            coords_main.append(coords_main[0])
            
            spill_state = {
                "type": "Polygon",
                "coordinates": [coords_main]
            }
                
            timeline.append(ReplayStep(
                step_label=step["label"],
                timestamp=step["time"],
                spill_state=spill_state,
                vessel_positions=vessel_positions
            ))
            
        return ReplayTimelineResponse(
            incident_id=inc["incident_id"],
            name=inc["name"],
            date=inc["date"],
            location=inc["location"],
            provenance=inc["provenance"],
            area_km2=inc["area_km2"],
            vessel_name=inc["vessel_name"],
            timeline=timeline
        )

historical_store = HistoricalStore()
