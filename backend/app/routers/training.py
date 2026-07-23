import uuid

import pandas as pd
from fastapi import APIRouter, BackgroundTasks, HTTPException

from app.schemas import TrainRequest, TrainResponse
from app.services.ml_service import train_model
from app.services.storage import DATASETS, TRAIN_JOBS, save_metadata
from app.utils.validation import validate_target_column

router = APIRouter(tags=["training"])


@router.post("/train", response_model=TrainResponse)
def start_training(payload: TrainRequest, background_tasks: BackgroundTasks):
    dataset = DATASETS.get(payload.dataset_id)
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    df = pd.read_csv(dataset["path"])
    validate_target_column(df, payload.target_column)

    job_id = str(uuid.uuid4())
    TRAIN_JOBS[job_id] = {
        "job_id": job_id,
        "dataset_id": payload.dataset_id,
        "target_column": payload.target_column,
        "status": "queued",
        "message": "Training request accepted",
        "task_type": None,
        "best_model": None,
    }
    save_metadata()
    background_tasks.add_task(train_model, job_id, df, payload.target_column)
    return TrainResponse(**TRAIN_JOBS[job_id])


@router.get("/train/{job_id}", response_model=TrainResponse)
def train_status(job_id: str):
    job = TRAIN_JOBS.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return TrainResponse(**job)


@router.get("/train", response_model=list[TrainResponse])
def list_train_jobs():
    return [TrainResponse(**job) for job in TRAIN_JOBS.values()]
