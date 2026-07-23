// ─── Dataset ───────────────────────────────────────────────────────────────
export interface UploadResponse {
  dataset_id: string;
  filename: string;
  rows: number;
  columns: string[];
}

export interface DatasetInfo {
  dataset_id: string;
  filename: string;
  rows: number;
  columns: string[];
}

// ─── EDA ───────────────────────────────────────────────────────────────────
export interface NumericStats {
  mean: number;
  std: number;
  min: number;
  max: number;
}

export interface EdaResponse {
  dataset_id: string;
  columns: string[];
  dtypes: Record<string, string>;
  null_counts: Record<string, number>;
  numeric_stats: Record<string, NumericStats>;
  outlier_counts: Record<string, number>;
  sample_rows: Record<string, unknown>[];
  clean_log?: string[];
  clean_summary?: Record<string, unknown>;
}

// ─── Clean ─────────────────────────────────────────────────────────────────
export type MissingStrategy = 'mean' | 'median' | 'mode' | 'drop';

export interface CleanRequest {
  missing_strategy: MissingStrategy;
  encode_categoricals: boolean;
  remove_outliers: boolean;
  outlier_method?: string;
  outlier_threshold?: number;
}

export interface CleanResponse {
  dataset_id: string;
  cleaned_rows: number;
  transformations: string[];
  missing_summary: Record<string, unknown>;
  outlier_summary: Record<string, number>;
}

// ─── Training ──────────────────────────────────────────────────────────────
export type JobStatus = 'queued' | 'running' | 'completed' | 'failed';

export interface TrainResponse {
  job_id: string;
  dataset_id: string;
  target_column: string;
  status: JobStatus;
  message: string;
  best_model?: string;
  task_type?: string;
}

// ─── Results ───────────────────────────────────────────────────────────────
export interface ResultMetric {
  name: string;
  value: number;
}

export interface FeatureImportanceEntry {
  feature: string;
  importance: number;
}

export interface ResultsResponse {
  job_id: string;
  dataset_id: string;
  target_column: string;
  task_type: string;
  best_model: string;
  metrics: ResultMetric[];
  feature_importance: FeatureImportanceEntry[];
  sample_predictions: Record<string, unknown>[];
}

// ─── Prediction ────────────────────────────────────────────────────────────
export interface PredictionResponse {
  job_id: string;
  dataset_id: string;
  prediction: unknown;
}

// ─── Workflow Step ─────────────────────────────────────────────────────────
export type WorkflowStep = 'upload' | 'clean' | 'eda' | 'train' | 'results';
