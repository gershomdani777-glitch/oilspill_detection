from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from .config import settings
from .api.endpoints import router, active_connections
from .services.monitoring_scheduler import monitoring_scheduler

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: start background monitoring loop
    await monitoring_scheduler.start()
    yield
    # Shutdown: stop background monitoring loop
    await monitoring_scheduler.stop()

app = FastAPI(
    title="Maritime Oil Spill Detection API",
    description="Automated Sentinel-1 C-SAR coastal monitoring + U-Net/EfficientNet-B4 segmentation + AIS attribution + 3D Globe intelligence",
    version="2.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount router under both /api/v1 and /api for full endpoint compatibility
app.include_router(router, prefix=settings.API_V1_STR)
app.include_router(router, prefix="/api")

@app.websocket("/ws/jobs/{job_id}")
async def websocket_job_status(websocket: WebSocket, job_id: str):
    await websocket.accept()
    if job_id not in active_connections:
        active_connections[job_id] = []
    active_connections[job_id].append(websocket)
    try:
        while True:
            _ = await websocket.receive_text()
    except WebSocketDisconnect:
        if job_id in active_connections and websocket in active_connections[job_id]:
            active_connections[job_id].remove(websocket)

@app.get("/health")
async def health_check():
    return {
        "status": "ok",
        "service": "maritime-oilspill-detection-api",
        "version": "2.0.0",
        "poll_interval_minutes": settings.SATELLITE_POLL_INTERVAL_MINUTES,
        "copernicus_timeliness": settings.COPERNICUS_PRODUCT_TIMELINESS
    }
