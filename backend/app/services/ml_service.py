from typing import Any, Dict, List, Tuple

import joblib
import numpy as np
import pandas as pd
from pandas.api.types import is_float_dtype, is_integer_dtype
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.linear_model import LinearRegression, LogisticRegression
from sklearn.metrics import accuracy_score, f1_score, mean_squared_error, r2_score
from sklearn.model_selection import KFold, StratifiedKFold, cross_val_score
from sklearn.preprocessing import LabelEncoder
from xgboost import XGBClassifier, XGBRegressor

from app.config import MODEL_DIR
from app.schemas import FeatureImportanceEntry, ResultMetric, ResultsResponse
from app.services.storage import TRAIN_JOBS, get_dataset, save_metadata


def load_job_model(job_id: str) -> dict:
    job = TRAIN_JOBS.get(job_id)
    if not job or "model_path" not in job:
        raise ValueError("Model not available")
    return joblib.load(job["model_path"])


def predict_model(model_data: dict, features: dict):
    model = model_data["model"]
    columns = model_data["columns"]
    X = pd.DataFrame([features])
    X = pd.get_dummies(X, drop_first=True)
    for col in columns:
        if col not in X.columns:
            X[col] = 0
    X = X[columns]
    pred = model.predict(X)
    if len(pred) == 1:
        first = pred[0]
        return first.item() if hasattr(first, "item") else first
    return pred.tolist()


def select_task_type(y: pd.Series) -> str:
    if y.isnull().all():
        raise ValueError("Target column contains only null values")
    if y.dtype == object or y.dtype.name == "category":
        return "classification"
    if is_integer_dtype(y) or is_float_dtype(y):
        if y.nunique() <= 10:
            return "classification"
        return "regression"
    return "classification"


def build_metrics(y_true: pd.Series, y_pred: np.ndarray, task_type: str) -> Dict[str, float]:
    if task_type == "classification":
        y_true_encoded = (
            LabelEncoder().fit_transform(y_true.astype(str))
            if y_true.dtype == object or y_true.dtype.name == "category"
            else y_true
        )
        y_pred_labels = np.round(y_pred).astype(int) if y_pred.ndim == 1 else y_pred
        return {
            "accuracy": float(accuracy_score(y_true_encoded, y_pred_labels)),
            "f1_score": float(f1_score(y_true_encoded, y_pred_labels, average="macro", zero_division=0)),
        }
    return {
        "rmse": float(np.sqrt(mean_squared_error(y_true.astype(float), y_pred.astype(float)))),
        "r2": float(r2_score(y_true.astype(float), y_pred.astype(float))),
    }


def get_cv_strategy(task_type: str, y: pd.Series):
    if len(y) < 4:
        return None
    if task_type == "classification":
        min_class_count = int(y.value_counts().min())
        n_splits = min(3, min_class_count)
        if n_splits < 2:
            return None
        return StratifiedKFold(n_splits=n_splits, shuffle=True, random_state=42)
    return KFold(n_splits=min(3, len(y)), shuffle=True, random_state=42)


def score_model(model: Any, X: pd.DataFrame, y: pd.Series, task_type: str) -> float:
    predictions = model.predict(X)
    if task_type == "classification":
        predictions = np.round(predictions).astype(int) if predictions.ndim == 1 else predictions
        encoded = (
            LabelEncoder().fit_transform(y.astype(str))
            if y.dtype == object or y.dtype.name == "category"
            else y
        )
        return float(f1_score(encoded, predictions, average="macro", zero_division=0))
    return float(-np.sqrt(mean_squared_error(y.astype(float), predictions.astype(float))))


def build_feature_importance(model: Any, columns: List[str]) -> List[Tuple[str, float]]:
    if hasattr(model, "feature_importances_"):
        importances = model.feature_importances_
        return sorted(zip(columns, importances), key=lambda x: x[1], reverse=True)
    if hasattr(model, "coef_"):
        coefs = np.abs(model.coef_)
        coeffs = coefs if coefs.ndim == 1 else np.mean(coefs, axis=0)
        return sorted(zip(columns, coeffs), key=lambda x: x[1], reverse=True)
    return [(col, 0.0) for col in columns]


def train_model(job_id: str, df: pd.DataFrame, target_column: str) -> None:
    TRAIN_JOBS[job_id]["status"] = "running"
    TRAIN_JOBS[job_id]["message"] = "Training in progress"
    save_metadata()

    try:
        X = df.drop(columns=[target_column])
        y = df[target_column]
        if X.shape[1] == 0:
            raise ValueError("Dataset must contain at least one feature column")
        if len(df) < 2:
            raise ValueError("Dataset must contain at least two rows")
        if y.isnull().all():
            raise ValueError("Target column contains only null values")
        if y.nunique(dropna=True) <= 1:
            raise ValueError("Target column has only one unique value")

        task_type = select_task_type(y)
        if task_type == "classification":
            y_processed = LabelEncoder().fit_transform(y.astype(str))
        else:
            y_processed = y.astype(float)

        X_encoded = pd.get_dummies(X, drop_first=True)
        if X_encoded.empty:
            raise ValueError("No usable features found after encoding")

        candidates = []
        if task_type == "classification":
            candidates = [
                ("LogisticRegression", LogisticRegression(max_iter=200)),
                ("RandomForestClassifier", RandomForestClassifier(n_estimators=50, random_state=42)),
                ("XGBClassifier", XGBClassifier(eval_metric="logloss", verbosity=0)),
            ]
            scoring = "f1_macro"
        else:
            candidates = [
                ("LinearRegression", LinearRegression()),
                ("RandomForestRegressor", RandomForestRegressor(n_estimators=50, random_state=42)),
                ("XGBRegressor", XGBRegressor(objective="reg:squarederror", verbosity=0)),
            ]
            scoring = "neg_root_mean_squared_error"

        best_score = None
        best_model = None
        best_name = None

        cv = get_cv_strategy(task_type, pd.Series(y_processed))
        for name, model in candidates:
            try:
                if cv is not None:
                    scores = cross_val_score(model, X_encoded, y_processed, cv=cv, scoring=scoring)
                    mean_score = float(np.mean(scores))
                else:
                    model.fit(X_encoded, y_processed)
                    mean_score = score_model(model, X_encoded, pd.Series(y_processed), task_type)
                if best_score is None or mean_score > best_score:
                    best_score = mean_score
                    best_model = model
                    best_name = name
            except Exception:
                continue

        if best_model is None:
            raise ValueError("Failed to train any candidate model")

        best_model.fit(X_encoded, y_processed)
        model_path = MODEL_DIR / f"{job_id}.joblib"
        joblib.dump({"model": best_model, "columns": list(X_encoded.columns)}, model_path)

        TRAIN_JOBS[job_id]["model_path"] = str(model_path)
        TRAIN_JOBS[job_id]["status"] = "completed"
        TRAIN_JOBS[job_id]["message"] = "Training completed successfully"
        TRAIN_JOBS[job_id]["best_model"] = best_name
        TRAIN_JOBS[job_id]["task_type"] = task_type
        save_metadata()
    except Exception as exc:
        TRAIN_JOBS[job_id]["status"] = "failed"
        TRAIN_JOBS[job_id]["message"] = f"Training failed: {exc}"
        save_metadata()


def build_results_response(job_id: str, job: dict) -> ResultsResponse:
    model_data = load_job_model(job_id)
    model = model_data["model"]
    columns = model_data["columns"]
    dataset = get_dataset(job["dataset_id"])
    df = pd.read_csv(dataset["path"])
    X = df.drop(columns=[job["target_column"]])
    y = df[job["target_column"]]
    X_encoded = pd.get_dummies(X, drop_first=True)
    for col in columns:
        if col not in X_encoded.columns:
            X_encoded[col] = 0
    X_encoded = X_encoded[columns]
    predictions = model.predict(X_encoded)
    metrics = build_metrics(y, predictions, job["task_type"])
    feature_importance = build_feature_importance(model, columns)
    sample_predictions = []
    for i, (_, row) in enumerate(X.head(5).iterrows()):
        sample_predictions.append(
            {
                **{col: row[col] for col in X.columns},
                "prediction": predictions[i].item() if hasattr(predictions[i], "item") else predictions[i],
            }
        )

    return ResultsResponse(
        job_id=job_id,
        dataset_id=job["dataset_id"],
        target_column=job["target_column"],
        task_type=job["task_type"],
        best_model=job["best_model"],
        metrics=[ResultMetric(name=name, value=value) for name, value in metrics.items()],
        feature_importance=[
            FeatureImportanceEntry(feature=col, importance=float(importance))
            for col, importance in feature_importance
        ],
        sample_predictions=sample_predictions,
    )
