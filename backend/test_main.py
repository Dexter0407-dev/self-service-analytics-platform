import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from fastapi.testclient import TestClient
from app.main import app
import time

client = TestClient(app)


def test_health():
    response = client.get('/health')
    assert response.status_code == 200
    assert response.json()['status'] == 'ok'


def test_upload_train_predict_flow():
    csv_content = 'feature,target\n1,0\n2,1\n3,0\n'
    files = {'file': ('sample.csv', csv_content, 'text/csv')}

    response = client.post('/upload', files=files)
    assert response.status_code == 200
    payload = response.json()
    assert 'dataset_id' in payload
    assert payload['rows'] == 3
    assert 'target' in payload['columns']

    dataset_id = payload['dataset_id']

    response = client.get(f'/datasets/{dataset_id}')
    assert response.status_code == 200
    dataset_info = response.json()
    assert dataset_info['dataset_id'] == dataset_id

    response = client.get(f'/eda/{dataset_id}')
    assert response.status_code == 200
    eda = response.json()
    assert eda['dataset_id'] == dataset_id
    assert 'feature' in eda['columns']
    assert eda['sample_rows'][0]['feature'] == 1

    response = client.post('/train', json={'dataset_id': dataset_id, 'target_column': 'target'})
    assert response.status_code == 200
    train = response.json()
    assert train['status'] == 'queued'
    assert 'job_id' in train

    job_id = train['job_id']
    status = None
    for _ in range(15):
        response = client.get(f'/train/{job_id}')
        assert response.status_code == 200
        status = response.json()
        if status['status'] in ['completed', 'failed']:
            break
        time.sleep(0.5)
    assert status is not None
    assert status['status'] == 'completed'

    response = client.post('/predict', json={
        'dataset_id': dataset_id,
        'job_id': job_id,
        'features': {'feature': 4},
    })
    assert response.status_code == 200
    prediction_payload = response.json()
    assert prediction_payload['job_id'] == job_id
    assert 'prediction' in prediction_payload

    response = client.get('/train')
    assert response.status_code == 200
    jobs = response.json()
    assert any(job['job_id'] == job_id for job in jobs)
