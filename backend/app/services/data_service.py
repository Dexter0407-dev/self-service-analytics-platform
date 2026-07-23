from typing import Any, Dict, List, Tuple

import pandas as pd
from fastapi import HTTPException
from pandas.api.types import is_numeric_dtype

from app.schemas import CleanRequest, CleanResponse, EdaResponse


def compute_numeric_stats(df: pd.DataFrame) -> Dict[str, Dict[str, float]]:
    stats: Dict[str, Dict[str, float]] = {}
    for col in df.columns:
        if is_numeric_dtype(df[col]):
            series = df[col].dropna()
            if len(series) == 0:
                continue
            stats[col] = {
                "mean": float(series.mean()),
                "std": float(series.std(ddof=0)),
                "min": float(series.min()),
                "max": float(series.max()),
            }
    return stats


def compute_outlier_counts(df: pd.DataFrame) -> Dict[str, int]:
    counts: Dict[str, int] = {}
    for col in df.columns:
        if not is_numeric_dtype(df[col]):
            continue
        series = df[col].dropna()
        if len(series) < 4:
            counts[col] = 0
            continue
        q1 = series.quantile(0.25)
        q3 = series.quantile(0.75)
        iqr = q3 - q1
        if iqr == 0:
            counts[col] = 0
            continue
        lower = q1 - 1.5 * iqr
        upper = q3 + 1.5 * iqr
        counts[col] = int(((series < lower) | (series > upper)).sum())
    return counts


def build_eda_response(dataset_id: str, df: pd.DataFrame, dataset: Dict[str, Any]) -> EdaResponse:
    return EdaResponse(
        dataset_id=dataset_id,
        columns=list(df.columns),
        dtypes={col: str(dtype) for col, dtype in df.dtypes.items()},
        null_counts={col: int(count) for col, count in df.isnull().sum().items()},
        numeric_stats=compute_numeric_stats(df),
        outlier_counts=compute_outlier_counts(df),
        sample_rows=df.head(5).to_dict(orient="records"),
        clean_log=dataset.get("clean_log", []),
        clean_summary=dataset.get("clean_summary", {}),
    )


def clean_dataframe(df: pd.DataFrame, payload: CleanRequest) -> Tuple[pd.DataFrame, List[str], Dict[str, Any], Dict[str, int]]:
    transformations: List[str] = []
    missing_summary: Dict[str, Any] = {}
    outlier_summary = {"removed": 0, "candidate_columns": 0}

    if payload.missing_strategy not in ["mean", "median", "mode", "drop"]:
        raise HTTPException(status_code=400, detail="Invalid missing strategy")

    if payload.missing_strategy == "drop":
        before = len(df)
        df = df.dropna()
        missing_summary["strategy"] = "drop"
        missing_summary["dropped_rows"] = before - len(df)
        transformations.append(f"Dropped {before - len(df)} rows with missing values")
    else:
        for col in df.columns:
            missing_count = int(df[col].isna().sum())
            if missing_count == 0:
                continue
            if payload.missing_strategy == "mean" and is_numeric_dtype(df[col]):
                value = df[col].mean()
                df[col] = df[col].fillna(value)
                transformations.append(
                    f"Imputed {missing_count} missing values in '{col}' with mean={value:.3f}"
                )
            elif payload.missing_strategy == "median" and is_numeric_dtype(df[col]):
                value = df[col].median()
                df[col] = df[col].fillna(value)
                transformations.append(
                    f"Imputed {missing_count} missing values in '{col}' with median={value:.3f}"
                )
            elif payload.missing_strategy == "mode":
                value = df[col].mode().iloc[0]
                df[col] = df[col].fillna(value)
                transformations.append(
                    f"Imputed {missing_count} missing values in '{col}' with mode={value}"
                )
            else:
                df[col] = df[col].fillna("missing")
                transformations.append(
                    f"Imputed {missing_count} missing values in '{col}' with placeholder 'missing'"
                )
        missing_summary["strategy"] = payload.missing_strategy
        missing_summary["counts"] = {
            col: int(df[col].isna().sum()) for col in df.columns if int(df[col].isna().sum()) > 0
        }

    if payload.encode_categoricals:
        categorical_cols = [
            col for col in df.columns if df[col].dtype == object or df[col].dtype.name == "category"
        ]
        for col in categorical_cols:
            before = df[col].nunique(dropna=False)
            df[col] = df[col].astype(str).astype("category")
            transformations.append(f"Encoded categorical column '{col}' with {before} categories")

    if payload.remove_outliers and payload.outlier_method == "zscore":
        numeric_cols = [col for col in df.columns if is_numeric_dtype(df[col])]
        outlier_candidates = 0
        for col in numeric_cols:
            std = df[col].std(ddof=0)
            if std == 0:
                continue
            zscore = (df[col] - df[col].mean()) / std
            mask = zscore.abs() <= payload.outlier_threshold
            outlier_candidates += int((~mask).sum() > 0)
            before = len(df)
            df = df[mask]
            outlier_summary["removed"] += before - len(df)
        outlier_summary["candidate_columns"] = outlier_candidates
        transformations.append(
            f"Removed outliers using z-score threshold {payload.outlier_threshold}"
        )

    return df, transformations, missing_summary, outlier_summary


def build_clean_response(
    dataset_id: str,
    df: pd.DataFrame,
    transformations: List[str],
    missing_summary: Dict[str, Any],
    outlier_summary: Dict[str, int],
) -> CleanResponse:
    return CleanResponse(
        dataset_id=dataset_id,
        cleaned_rows=len(df),
        transformations=transformations,
        missing_summary=missing_summary,
        outlier_summary=outlier_summary,
    )
