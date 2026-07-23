from typing import Any, Dict, List, Optional

from pydantic import BaseModel


class DatasetInfo(BaseModel):
    dataset_id: str
    filename: str
    rows: int
    columns: List[str]


class UploadResponse(DatasetInfo):
    pass


class EdaResponse(BaseModel):
    dataset_id: str
    columns: List[str]
    dtypes: dict
    null_counts: dict
    numeric_stats: Dict[str, Dict[str, float]]
    outlier_counts: Dict[str, int]
    sample_rows: List[dict]
    clean_log: Optional[List[str]] = None
    clean_summary: Optional[Dict[str, Any]] = None


class TrainRequest(BaseModel):
    dataset_id: str
    target_column: str


class TrainResponse(BaseModel):
    job_id: str
    dataset_id: str
    target_column: str
    status: str
    message: str
    best_model: Optional[str] = None
    task_type: Optional[str] = None


class PredictionRequest(BaseModel):
    dataset_id: str
    job_id: str
    features: dict


class PredictionResponse(BaseModel):
    job_id: str
    dataset_id: str
    prediction: object


class CleanRequest(BaseModel):
    missing_strategy: Optional[str] = "mean"
    encode_categoricals: Optional[bool] = True
    outlier_method: Optional[str] = "zscore"
    outlier_threshold: Optional[float] = 3.0
    remove_outliers: Optional[bool] = False


class CleanResponse(BaseModel):
    dataset_id: str
    cleaned_rows: int
    transformations: List[str]
    missing_summary: Dict[str, Any]
    outlier_summary: Dict[str, int]


class ResultMetric(BaseModel):
    name: str
    value: float


class FeatureImportanceEntry(BaseModel):
    feature: str
    importance: float


class ResultsResponse(BaseModel):
    job_id: str
    dataset_id: str
    target_column: str
    task_type: str
    best_model: str
    metrics: List[ResultMetric]
    feature_importance: List[FeatureImportanceEntry]
    sample_predictions: List[Dict[str, Any]]
