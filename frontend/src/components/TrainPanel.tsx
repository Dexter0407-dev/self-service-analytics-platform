import { useState } from 'react';
import { startTraining } from '../api/client';
import { useTrainingJob } from '../hooks/useTrainingJob';
import type { EdaResponse, TrainResponse } from '../types';

interface Props {
  datasetId: string;
  eda: EdaResponse;
  onCompleted: (job: TrainResponse) => void;
}

const MODEL_DESCRIPTIONS: Record<string, string> = {
  classification: 'LogisticRegression · RandomForestClassifier · XGBClassifier',
  regression: 'LinearRegression · RandomForestRegressor · XGBRegressor',
};

export default function TrainPanel({ datasetId, eda, onCompleted }: Props) {
  const [targetColumn, setTargetColumn] = useState(eda.columns[eda.columns.length - 1]);
  const [error, setError] = useState<string | null>(null);
  const { job, setJob, polling, startPolling } = useTrainingJob();

  const handleTrain = async () => {
    setError(null);
    try {
      const resp = await startTraining(datasetId, targetColumn);
      setJob(resp);
      startPolling(resp.job_id);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        'Failed to start training.';
      setError(msg);
    }
  };

  const isRunning = polling || job?.status === 'running' || job?.status === 'queued';
  const isCompleted = job?.status === 'completed';
  const isFailed = job?.status === 'failed';

  return (
    <div className="panel">
      <div className="panel__header">
        <h2>🤖 AutoML Training</h2>
        <p className="panel__subtitle">
          Select a target column. The system will automatically detect task type and compare
          multiple models using cross-validation.
        </p>
      </div>

      {/* Target Column Selection */}
      <div className="train-config">
        <div className="train-config__field">
          <label htmlFor="target-select" className="field-label">
            Target Column <span className="required">*</span>
          </label>
          <select
            id="target-select"
            className="select"
            value={targetColumn}
            onChange={(e) => setTargetColumn(e.target.value)}
            disabled={isRunning || isCompleted}
          >
            {eda.columns.map((col) => (
              <option key={col} value={col}>
                {col} — {eda.dtypes[col]}
              </option>
            ))}
          </select>
          <p className="field-hint">
            Choose the column your model should predict.
          </p>
        </div>

        {/* Model Candidates Info */}
        <div className="model-info-card">
          <h3 className="model-info-card__title">Models evaluated</h3>
          <div className="model-tag-group">
            {['LogisticRegression / LinearRegression', 'RandomForest', 'XGBoost'].map((m) => (
              <span key={m} className="model-tag">{m}</span>
            ))}
          </div>
          <p className="model-info-card__hint">
            Classification: {MODEL_DESCRIPTIONS.classification}
            <br />
            Regression: {MODEL_DESCRIPTIONS.regression}
          </p>
          <p className="model-info-card__hint">
            Best model is selected by F1 (classification) or RMSE (regression) via 3-fold cross-validation.
          </p>
        </div>
      </div>

      {error && <div className="error-box">⚠️ {error}</div>}

      {/* Progress */}
      {job && (
        <div className={`job-status job-status--${job.status}`}>
          <div className="job-status__header">
            <span className="job-status__icon">
              {job.status === 'queued' && '🕐'}
              {job.status === 'running' && <span className="spinner" />}
              {job.status === 'completed' && '✅'}
              {job.status === 'failed' && '❌'}
            </span>
            <div>
              <p className="job-status__title">
                {job.status === 'queued' && 'Training queued…'}
                {job.status === 'running' && 'Training in progress…'}
                {job.status === 'completed' && `Training complete — ${job.best_model}`}
                {job.status === 'failed' && 'Training failed'}
              </p>
              <p className="job-status__msg">{job.message}</p>
            </div>
          </div>

          {isRunning && (
            <div className="progress-bar">
              <div className="progress-bar__fill progress-bar__fill--animated" />
            </div>
          )}

          {isCompleted && job.task_type && (
            <div className="job-result-chips">
              <span className="badge badge--blue">Task: {job.task_type}</span>
              <span className="badge badge--purple">Best: {job.best_model}</span>
              <span className="badge badge--gray">Target: {job.target_column}</span>
            </div>
          )}
        </div>
      )}

      <div className="panel__actions">
        {!isCompleted && (
          <button
            className="btn btn--primary"
            onClick={handleTrain}
            disabled={isRunning}
          >
            {isRunning ? (
              <><span className="spinner" /> Training…</>
            ) : (
              '🚀 Start Training'
            )}
          </button>
        )}
        {isCompleted && (
          <button className="btn btn--primary" onClick={() => onCompleted(job!)}>
            View Results →
          </button>
        )}
        {isFailed && (
          <button className="btn btn--secondary" onClick={() => { setJob(null); setError(null); }}>
            Try Again
          </button>
        )}
      </div>
    </div>
  );
}
