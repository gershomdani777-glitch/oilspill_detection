import os
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
    COPERNICUS_CLIENT_ID: str = os.getenv('COPERNICUS_CLIENT_ID', '')
    COPERNICUS_CLIENT_SECRET: str = os.getenv('COPERNICUS_CLIENT_SECRET', '')
    COPERNICUS_MOCK_MODE: bool = True
    
    GFW_API_KEY: str = os.getenv('GFW_API_KEY', '')
    AIS_MOCK_MODE: bool = True
    
    MODEL_DEMO_MODE: bool = True
    
    DATABASE_URL: str = os.getenv('DATABASE_URL', 'sqlite:///./oilspill.db')
    
    CORS_ORIGINS: list[str] = ['*']

    class Config:
        env_file = '.env'
        extra = 'allow'

settings = Settings()
