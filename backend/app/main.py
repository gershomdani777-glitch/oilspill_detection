from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from .config import settings
from .api.endpoints import router, active_connections

app = FastAPI(
    title="Maritime Oil Spill Detection API",
    description="Interactive satellite SAR segmentation + AIS correlation + explainable attribution intelligence",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix=settings.API_V1_STR)

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
    return {"status": "ok", "service": "maritime-oilspill-detection-api"}
