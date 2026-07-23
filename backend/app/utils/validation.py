import pandas as pd
from fastapi import HTTPException
from pandas.api.types import is_numeric_dtype

from app.config import MAX_UPLOAD_BYTES, MAX_UPLOAD_MB


def validate_upload_size(content: bytes) -> None:
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File exceeds maximum upload size of {MAX_UPLOAD_MB}MB",
        )


def validate_csv_filename(filename: str | None) -> None:
    if not filename or not filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Please upload a CSV file")


def validate_target_column(df: pd.DataFrame, target_column: str) -> None:
    if target_column not in df.columns:
        raise HTTPException(status_code=400, detail="Target column not found")

    target = df[target_column]
    if target.isnull().all():
        raise HTTPException(status_code=400, detail="Target column contains only null values")

    if len(df) == 0:
        raise HTTPException(status_code=400, detail="Dataset is empty after cleaning")

    if len(df) < 2:
        raise HTTPException(status_code=400, detail="Dataset must contain at least two rows")

    feature_cols = [col for col in df.columns if col != target_column]
    if not feature_cols:
        raise HTTPException(status_code=400, detail="Dataset must contain at least one feature column")

    if target.nunique(dropna=True) <= 1:
        raise HTTPException(status_code=400, detail="Target column has only one unique value")

    if not (
        is_numeric_dtype(target)
        or target.dtype == object
        or target.dtype.name == "category"
        or target.dtype.name == "bool"
    ):
        raise HTTPException(
            status_code=400,
            detail="Target column must be numeric or categorical",
        )
