from fastapi import APIRouter, HTTPException

from app.schemas import PredictionRequest, PredictionResponse, ResultsResponse
from app.services.ml_service import build_results_response, predict_model, load_job_model
from app.services.storage import TRAIN_JOBS

router = APIRouter(tags=["predictions"])


@router.post("/predict", response_model=PredictionResponse)
def predict(payload: PredictionRequest):
    job = TRAIN_JOBS.get(payload.job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.get("status") != "completed":
        raise HTTPException(status_code=400, detail="Model training is not completed")
    if payload.dataset_id != job.get("dataset_id"):
        raise HTTPException(status_code=400, detail="Dataset and job do not match")

    model_data = load_job_model(payload.job_id)
    prediction = predict_model(model_data, payload.features)
    return PredictionResponse(
        job_id=payload.job_id,
        dataset_id=payload.dataset_id,
        prediction=prediction,
    )


@router.get("/results/{job_id}", response_model=ResultsResponse)
def get_results(job_id: str):
    job = TRAIN_JOBS.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.get("status") != "completed":
        raise HTTPException(status_code=400, detail="Model training is not completed")
    return build_results_response(job_id, job)
