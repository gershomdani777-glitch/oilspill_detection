# Maritime Oil Spill Detection — Satellite SAR & AIS Intelligence Console

An interactive maritime intelligence platform combining Sentinel-1 SAR satellite acquisition, AI segmentation with look-alike rejection, AIS spatial-temporal correlation, explainable multi-factor attribution scoring, and historical incident replay.

Styled strictly according to the Langbase **"midnight aurora console"** design system (`#232324`, `#0e0e10`, `#181818`, `#5c5c61`, `#fafafa`).

---

## Key Features

1. **Live Monitoring Mode (`/`)**:
   - Draw regions or select maritime hotspots (e.g. Mauritius, Strait of Malacca, Gulf of Mexico, Persian Gulf).
   - Real-time pipeline status readout: `searching_copernicus` → `preprocessing` → `segmenting` → `filtering` → `querying_ais` → `scoring` → `complete`.
   - Spill MultiPolygon rendering with 40% fill, 2px outline, and detailed hover metadata.
   - Top suspect vessel markers with double-stroke rings, MMSI/IMO, speed/course, and rank badges.
   - Collapsible 380px Evidence & Attribution Dossier with 6-factor grayscale breakdown, plain-language evidence summaries, and PDF report export.
   - Optional CMEMS ocean currents & ERA5 wind backward drift envelope simulation.

2. **Historical Replay Mode (`/historical`)**:
   - 5 documented/reconstructed historical incidents:
     - MV Wakashio (Mauritius, 2020)
     - Deepwater Horizon MC-252 (Gulf of Mexico, 2010)
     - MT Sanchi Collision (East China Sea, 2018)
     - Amoco Cadiz Disaster (Brittany, France, 1978)
     - MT New Diamond Fire (Sri Lanka, 2020)
   - Step-by-step scrubbing timeline from `T-12h` to `T+1h` with play/pause and 1x/2x/4x speed controls.

3. **Attribution Engine**:
   - Strict formula: `0.30*proximity + 0.25*ais_gap + 0.15*vessel_type + 0.15*trajectory_alignment + 0.10*cargo_port_correlation + 0.05*historical_violation`.
   - AIS Gap Severity (0 = continuous, 1 = <2h, 2 = 2-6h, 3 = >6h).
   - Strict product copy rules: "potentially associated vessel" / "suspect", never "guilty" or "responsible".

4. **Security & Data Provenance**:
   - Zero provider credentials sent to or stored in the frontend.
   - Every result is tagged with provenance (`live_satellite`, `documented_fact`, `historical_record`, `demo_reconstruction`).
   - Every timestamp indicates its source (satellite acquisition overpass vs. AIS ingestion timestamp).

---

## Quick Start

### 1. Backend (FastAPI + Python 3.11+)

```powershell
# Navigate to backend directory
cd backend

# Install dependencies
pip install -r requirements.txt

# Run FastAPI development server
uvicorn app.main:app --reload --port 8000
```
Backend API will be live at `http://127.0.0.1:8000` (docs at `http://127.0.0.1:8000/docs`).

### 2. Frontend (React + Vite + TypeScript)

```powershell
# Navigate to frontend directory
cd frontend

# Run Vite dev server
npm run dev
```
Frontend console will be live at `http://localhost:3000`.

---

## Running Automated Tests

```powershell
$env:PYTHONPATH="backend"
python -m pytest backend/tests/ -v
```