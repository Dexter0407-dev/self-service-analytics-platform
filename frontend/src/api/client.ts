import axios from 'axios';
import type {
  CleanRequest,
  CleanResponse,
  DatasetInfo,
  EdaResponse,
  PredictionResponse,
  ResultsResponse,
  TrainResponse,
  UploadResponse,
} from '../types';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

const api = axios.create({ baseURL: BASE_URL });

// ─── Datasets ──────────────────────────────────────────────────────────────
export async function uploadDataset(file: File): Promise<UploadResponse> {
  const form = new FormData();
  form.append('file', file);
  const { data } = await api.post<UploadResponse>('/upload', form);
  return data;
}

export async function listDatasets(): Promise<DatasetInfo[]> {
  const { data } = await api.get<DatasetInfo[]>('/datasets');
  return data;
}

export async function getDataset(datasetId: string): Promise<DatasetInfo> {
  const { data } = await api.get<DatasetInfo>(`/datasets/${datasetId}`);
  return data;
}

// ─── EDA & Cleaning ────────────────────────────────────────────────────────
export async function getEda(datasetId: string): Promise<EdaResponse> {
  const { data } = await api.get<EdaResponse>(`/eda/${datasetId}`);
  return data;
}

export async function cleanDataset(
  datasetId: string,
  payload: CleanRequest
): Promise<CleanResponse> {
  const { data } = await api.post<CleanResponse>(`/clean/${datasetId}`, payload);
  return data;
}

// ─── Training ──────────────────────────────────────────────────────────────
export async function startTraining(
  datasetId: string,
  targetColumn: string
): Promise<TrainResponse> {
  const { data } = await api.post<TrainResponse>('/train', {
    dataset_id: datasetId,
    target_column: targetColumn,
  });
  return data;
}

export async function getTrainStatus(jobId: string): Promise<TrainResponse> {
  const { data } = await api.get<TrainResponse>(`/train/${jobId}`);
  return data;
}

// ─── Results ───────────────────────────────────────────────────────────────
export async function getResults(jobId: string): Promise<ResultsResponse> {
  const { data } = await api.get<ResultsResponse>(`/results/${jobId}`);
  return data;
}

// ─── Predict ───────────────────────────────────────────────────────────────
export async function runPrediction(
  jobId: string,
  datasetId: string,
  features: Record<string, unknown>
): Promise<PredictionResponse> {
  const { data } = await api.post<PredictionResponse>('/predict', {
    job_id: jobId,
    dataset_id: datasetId,
    features,
  });
  return data;
}
