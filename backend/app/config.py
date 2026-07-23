import os
import tempfile
from pathlib import Path

MAX_UPLOAD_MB = int(os.getenv("MAX_UPLOAD_MB", "50"))
MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024

CORS_ORIGINS = [
    origin.strip()
    for origin in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
    if origin.strip()
]

STORAGE_BACKEND = os.getenv("STORAGE_BACKEND", "local")
AZURE_STORAGE_CONNECTION_STRING = os.getenv("AZURE_STORAGE_CONNECTION_STRING", "")
AZURE_STORAGE_CONTAINER = os.getenv("AZURE_STORAGE_CONTAINER", "self-service-data")

if "DATA_STORAGE_DIR" in os.environ:
    BASE_STORAGE = Path(os.environ["DATA_STORAGE_DIR"])
else:
    BASE_STORAGE = Path(__file__).resolve().parents[2] / "storage"

METADATA_FILE = BASE_STORAGE / "metadata.json"
UPLOAD_DIR = BASE_STORAGE / "self_service_uploads"
MODEL_DIR = BASE_STORAGE / "self_service_models"

BASE_STORAGE.mkdir(parents=True, exist_ok=True)
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
MODEL_DIR.mkdir(parents=True, exist_ok=True)
