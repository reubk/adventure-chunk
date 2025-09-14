from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from app.api import endpoints
import os

# Load environment variables from .env file
import pathlib
env_path = pathlib.Path(__file__).parent.parent / '.env'
print(f"Looking for .env file at: {env_path}")
print(f".env file exists: {env_path.exists()}")
load_dotenv(env_path)

# Debug: Print environment variables
print(f"MAPBOX_API_KEY loaded: {os.getenv('MAPBOX_API_KEY') is not None}")
print(f"MAPTILER_API_KEY loaded: {os.getenv('MAPTILER_API_KEY') is not None}")

app = FastAPI(title="Adventure Chunk API")

# Configure CORS to allow the frontend to communicate with the backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # The default port for Vite React dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include the API router
app.include_router(endpoints.router, prefix="/api")

@app.get("/")
def read_root():
    return {"message": "Welcome to the Adventure Chunk API!"}
