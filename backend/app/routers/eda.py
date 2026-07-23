import pandas as pd
from fastapi import APIRouter, HTTPException

from app.config import UPLOAD_DIR
from app.schemas import CleanRequest, CleanResponse, EdaResponse
from app.services.data_service import build_clean_response, build_eda_response, clean_dataframe
from app.services.storage import DATASETS, get_dataset, save_metadata

router = APIRouter(tags=["eda"])


@router.get("/eda/{dataset_id}", response_model=EdaResponse)
def get_eda(dataset_id: str):
    dataset = get_dataset(dataset_id)
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    df = pd.read_csv(dataset["path"])
    return build_eda_response(dataset_id, df, dataset)


@router.post("/clean/{dataset_id}", response_model=CleanResponse)
def clean_dataset(dataset_id: str, payload: CleanRequest):
    dataset = get_dataset(dataset_id)
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    df = pd.read_csv(dataset["path"])
    df, transformations, missing_summary, outlier_summary = clean_dataframe(df, payload)

    saved_path = UPLOAD_DIR / f"{dataset_id}_{dataset['filename']}"
    df.to_csv(saved_path, index=False)
    dataset["path"] = str(saved_path)
    dataset["rows"] = len(df)
    dataset["columns"] = list(df.columns)
    dataset["clean_log"] = transformations
    dataset["clean_summary"] = {
        "missing_strategy": payload.missing_strategy,
        "encode_categoricals": payload.encode_categoricals,
        "remove_outliers": payload.remove_outliers,
        "outlier_method": payload.outlier_method,
        "outlier_threshold": payload.outlier_threshold,
    }
    save_metadata()

    return build_clean_response(dataset_id, df, transformations, missing_summary, outlier_summary)
