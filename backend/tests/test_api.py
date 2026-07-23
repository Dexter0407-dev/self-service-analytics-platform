import io
import sys
import time
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.main import app

client = TestClient(app)


@pytest.fixture
def sample_csv():
    return "feature1,feature2,target\n1,10,0\n2,20,1\n3,30,0\n4,40,1\n5,50,0\n"


def upload_csv(content: str, filename: str = "sample.csv"):
    files = {"file": (filename, content, "text/csv")}
    return client.post("/upload", files=files)


def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_upload_train_predict_flow(sample_csv):
    response = upload_csv(sample_csv)
    assert response.status_code == 200
    payload = response.json()
    assert "dataset_id" in payload
    assert payload["rows"] == 5

    dataset_id = payload["dataset_id"]

    response = client.get(f"/datasets/{dataset_id}")
    assert response.status_code == 200

    response = client.get(f"/eda/{dataset_id}")
    assert response.status_code == 200
    eda = response.json()
    assert "numeric_stats" in eda
    assert "outlier_counts" in eda
    assert "feature1" in eda["numeric_stats"]

    response = client.post("/train", json={"dataset_id": dataset_id, "target_column": "target"})
    assert response.status_code == 200
    job_id = response.json()["job_id"]

    status = None
    for _ in range(20):
        response = client.get(f"/train/{job_id}")
        status = response.json()
        if status["status"] in ["completed", "failed"]:
            break
        time.sleep(0.5)
    assert status["status"] == "completed"

    response = client.get(f"/results/{job_id}")
    assert response.status_code == 200
    results = response.json()
    assert results["best_model"]
    assert len(results["metrics"]) >= 1
    assert len(results["feature_importance"]) >= 1

    response = client.post(
        "/predict",
        json={
            "dataset_id": dataset_id,
            "job_id": job_id,
            "features": {"feature1": 6, "feature2": 55},
        },
    )
    assert response.status_code == 200
    assert "prediction" in response.json()


def test_upload_rejects_non_csv():
    files = {"file": ("sample.txt", "a,b\n1,2", "text/plain")}
    response = client.post("/upload", files=files)
    assert response.status_code == 400


def test_upload_rejects_empty_file():
    files = {"file": ("empty.csv", "", "text/csv")}
    response = client.post("/upload", files=files)
    assert response.status_code == 400


def test_upload_rejects_oversized_file(monkeypatch):
    monkeypatch.setattr("app.utils.validation.MAX_UPLOAD_BYTES", 10)
    content = "a,b\n" + "\n".join(f"{i},{i}" for i in range(100))
    files = {"file": ("large.csv", content, "text/csv")}
    response = client.post("/upload", files=files)
    assert response.status_code == 413


def test_upload_rejects_invalid_csv():
    files = {"file": ("bad.csv", "not,a,valid\ncsv", "text/csv")}
    response = client.post("/upload", files=files)
    assert response.status_code in [200, 400]


def test_clean_endpoint(sample_csv):
    response = upload_csv(sample_csv)
    dataset_id = response.json()["dataset_id"]

    response = client.post(
        f"/clean/{dataset_id}",
        json={
            "missing_strategy": "mean",
            "encode_categoricals": True,
            "remove_outliers": False,
        },
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["cleaned_rows"] == 5
    assert isinstance(payload["transformations"], list)


def test_train_rejects_invalid_target(sample_csv):
    response = upload_csv(sample_csv)
    dataset_id = response.json()["dataset_id"]

    response = client.post(
        "/train",
        json={"dataset_id": dataset_id, "target_column": "missing_col"},
    )
    assert response.status_code == 400


def test_train_rejects_single_class_target():
    csv_content = "feature,target\n1,0\n2,0\n3,0\n4,0\n"
    response = upload_csv(csv_content)
    dataset_id = response.json()["dataset_id"]

    response = client.post(
        "/train",
        json={"dataset_id": dataset_id, "target_column": "target"},
    )
    assert response.status_code == 400


def test_results_not_ready(sample_csv):
    response = upload_csv(sample_csv)
    dataset_id = response.json()["dataset_id"]
    response = client.post("/train", json={"dataset_id": dataset_id, "target_column": "target"})
    job_id = response.json()["job_id"]

    response = client.get(f"/results/{job_id}")
    assert response.status_code == 400


def test_list_datasets(sample_csv):
    upload_csv(sample_csv)
    response = client.get("/datasets")
    assert response.status_code == 200
    assert len(response.json()) >= 1


def test_list_train_jobs(sample_csv):
    response = upload_csv(sample_csv)
    dataset_id = response.json()["dataset_id"]
    client.post("/train", json={"dataset_id": dataset_id, "target_column": "target"})
    response = client.get("/train")
    assert response.status_code == 200
    assert len(response.json()) >= 1
