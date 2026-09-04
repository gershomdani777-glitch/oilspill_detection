import os
from typing import List
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = 'Maritime Oil Spill Detection'
    API_V1_STR: str = '/api/v1'
    
    # Supabase Configuration
    SUPABASE_URL: str = os.getenv('SUPABASE_URL', 'https://qgvxjnlwtvgsdjixglvv.supabase.co')
    SUPABASE_KEY: str = os.getenv('SUPABASE_KEY', '') # Public anon key
    SUPABASE_SERVICE_ROLE_KEY: str = os.getenv('SUPABASE_SERVICE_ROLE_KEY', '') # Strict server-side only
    SUPABASE_DB_URL: str = os.getenv('SUPABASE_DB_URL', '')
    
    # Credentials kept strictly server-side
    COPERNICUS_CLIENT_ID: str = os.getenv('COPERNICUS_CLIENT_ID', 'sh-cac79dc4-c668-4608-b58b-b5148d4255ae')
    COPERNICUS_CLIENT_SECRET: str = os.getenv('COPERNICUS_CLIENT_SECRET', 'cPvV84ajjhBL4E3brKlPTwPH4ru3hI9q')
    COPERNICUS_MOCK_MODE: bool = False
    
    GFW_API_KEY: str = os.getenv('GFW_API_KEY', '')
    AIS_MOCK_MODE: bool = True
    
    MODEL_DEMO_MODE: bool = True
    DATABASE_URL: str = os.getenv('DATABASE_URL', 'sqlite:///./oilspill.db')
    CORS_ORIGINS: List[str] = ['*']

    # --- AUTOMATED MONITORING & SENTINEL-1 UPGRADE CONFIGURATION ---
    SATELLITE_POLL_INTERVAL_MINUTES: int = 15
    COPERNICUS_PRODUCT_TIMELINESS: str = "NRT"  # Near Real Time (NRT) vs Standard (ST)
    SCENE_MATCH_OVERLAP_THRESHOLD: float = 0.70  # Min 70% IoU/overlap for same scene identity
    SENTINEL_LOOKBACK_DAYS: int = 14
    MAX_SCENES_PER_REGION: int = 12
    MAX_CONCURRENT_PROCESSING_JOBS: int = 4
    MAX_CONCURRENT_GPU_JOBS: int = 1  # Dedicated semaphore for U-Net/ResNet model inference
    MAX_REGION_AREA_KM2: float = 500000.0
    RAW_PRODUCT_RETENTION_DAYS: int = 7  # Derived polygons & AIS retained indefinitely
    
    # AIS & Attribution Configuration
    AIS_SEARCH_RADIUS_KM: float = 50.0
    AIS_PRIMARY_WINDOW_BEFORE_HOURS: float = 6.0
    AIS_PRIMARY_WINDOW_AFTER_HOURS: float = 1.0
    AIS_HISTORICAL_WINDOW_HOURS: float = 12.0
    MODEL_CONFIDENCE_THRESHOLD: float = 0.75

    class Config:
        env_file = '.env'
        extra = 'allow'

settings = Settings()
