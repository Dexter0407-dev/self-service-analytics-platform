import json
import logging
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Any, Dict

from app.config import (
    AZURE_STORAGE_CONNECTION_STRING,
    AZURE_STORAGE_CONTAINER,
    BASE_STORAGE,
    METADATA_FILE,
    MODEL_DIR,
    STORAGE_BACKEND,
    UPLOAD_DIR,
)

logger = logging.getLogger(__name__)

DATASETS: Dict[str, Dict[str, Any]] = {}
TRAIN_JOBS: Dict[str, Dict[str, Any]] = {}


class StorageBackend(ABC):
    @abstractmethod
    def read_bytes(self, path: str) -> bytes:
        pass

    @abstractmethod
    def write_bytes(self, path: str, content: bytes) -> str:
        pass

    @abstractmethod
    def write_text(self, path: str, content: str) -> str:
        pass

    @abstractmethod
    def exists(self, path: str) -> bool:
        pass


class LocalStorageBackend(StorageBackend):
    def read_bytes(self, path: str) -> bytes:
        return Path(path).read_bytes()

    def write_bytes(self, path: str, content: bytes) -> str:
        file_path = Path(path)
        file_path.parent.mkdir(parents=True, exist_ok=True)
        file_path.write_bytes(content)
        return str(file_path)

    def write_text(self, path: str, content: str) -> str:
        file_path = Path(path)
        file_path.parent.mkdir(parents=True, exist_ok=True)
        file_path.write_text(content, encoding="utf-8")
        return str(file_path)

    def exists(self, path: str) -> bool:
        return Path(path).exists()


class BlobStorageBackend(StorageBackend):
    def __init__(self, connection_string: str, container_name: str):
        from azure.storage.blob import BlobServiceClient

        self._client = BlobServiceClient.from_connection_string(connection_string)
        self._container = container_name
        self._container_client = self._client.get_container_client(container_name)
        try:
            self._container_client.create_container()
        except Exception:
            pass

    def _blob_name(self, path: str) -> str:
        normalized = path.replace("\\", "/")
        if normalized.startswith(str(BASE_STORAGE).replace("\\", "/")):
            return normalized[len(str(BASE_STORAGE).replace("\\", "/")) :].lstrip("/")
        return Path(path).name

    def read_bytes(self, path: str) -> bytes:
        blob = self._container_client.download_blob(self._blob_name(path))
        return blob.readall()

    def write_bytes(self, path: str, content: bytes) -> str:
        blob_name = self._blob_name(path)
        self._container_client.upload_blob(blob_name, content, overwrite=True)
        return path

    def write_text(self, path: str, content: str) -> str:
        return self.write_bytes(path, content.encode("utf-8"))

    def exists(self, path: str) -> bool:
        blob_name = self._blob_name(path)
        return self._container_client.get_blob_client(blob_name).exists()


def get_storage_backend() -> StorageBackend:
    if STORAGE_BACKEND == "azure":
        if not AZURE_STORAGE_CONNECTION_STRING:
            raise RuntimeError("AZURE_STORAGE_CONNECTION_STRING is required for azure storage")
        return BlobStorageBackend(AZURE_STORAGE_CONNECTION_STRING, AZURE_STORAGE_CONTAINER)
    return LocalStorageBackend()


storage_backend = get_storage_backend()


def load_metadata() -> None:
    if not METADATA_FILE.exists():
        return
    try:
        data = json.loads(METADATA_FILE.read_text(encoding="utf-8"))
        DATASETS.update(data.get("datasets", {}))
        TRAIN_JOBS.update(data.get("train_jobs", {}))
    except (json.JSONDecodeError, OSError) as exc:
        logger.warning("Failed to load metadata: %s", exc)


def save_metadata() -> None:
    METADATA_FILE.write_text(
        json.dumps({"datasets": DATASETS, "train_jobs": TRAIN_JOBS}, indent=2),
        encoding="utf-8",
    )


def get_dataset(dataset_id: str) -> Dict[str, Any] | None:
    return DATASETS.get(dataset_id)


def get_train_job(job_id: str) -> Dict[str, Any] | None:
    return TRAIN_JOBS.get(job_id)


def dataset_info(dataset: Dict[str, Any]) -> Dict[str, Any]:
    return {k: v for k, v in dataset.items() if k != "path"}


load_metadata()
