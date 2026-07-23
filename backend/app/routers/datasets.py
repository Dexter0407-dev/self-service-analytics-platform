import uuid

import pandas as pd
from fastapi import APIRouter, File, HTTPException, UploadFile

from app.config import UPLOAD_DIR
from app.schemas import DatasetInfo, UploadResponse
from app.services.storage import DATASETS, dataset_info, save_metadata
from app.utils.validation import validate_csv_filename, validate_upload_size

router = APIRouter(tags=["datasets"])


@router.post("/upload", response_model=UploadResponse)
async def upload_dataset(file: UploadFile = File(...)):
    validate_csv_filename(file.filename)
    contents = await file.read()
    validate_upload_size(contents)

    dataset_id = str(uuid.uuid4())
    path = UPLOAD_DIR / f"{dataset_id}_{file.filename}"
    path.write_bytes(contents)

    try:
        df = pd.read_csv(path)
    except Exception as exc:
        path.unlink(missing_ok=True)
        raise HTTPException(status_code=400, detail=f"Invalid CSV file: {exc}") from exc

    if len(df) == 0:
        path.unlink(missing_ok=True)
        raise HTTPException(status_code=400, detail="CSV file contains no data rows")

    DATASETS[dataset_id] = {
        "dataset_id": dataset_id,
        "filename": file.filename,
        "rows": len(df),
        "columns": list(df.columns),
        "path": str(path),
    }
    save_metadata()
    return UploadResponse(**DATASETS[dataset_id])


@router.get("/datasets", response_model=list[DatasetInfo])
def list_datasets():
    return [DatasetInfo(**dataset_info(dataset)) for dataset in DATASETS.values()]


@router.get("/datasets/{dataset_id}", response_model=DatasetInfo)
def get_dataset(dataset_id: str):
    dataset = DATASETS.get(dataset_id)
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    return DatasetInfo(**dataset_info(dataset))
