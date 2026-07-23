import { useState } from 'react';
import { cleanDataset } from '../api/client';
import type { CleanRequest, CleanResponse, MissingStrategy } from '../types';

interface Props {
  datasetId: string;
  onCleaned: (result: CleanResponse) => void;
  onSkip: () => void;
}

export default function CleanPanel({ datasetId, onCleaned, onSkip }: Props) {
  const [missingStrategy, setMissingStrategy] = useState<MissingStrategy>('mean');
  const [encodeCategoricals, setEncodeCategoricals] = useState(true);
  const [removeOutliers, setRemoveOutliers] = useState(false);
  const [outlierThreshold, setOutlierThreshold] = useState(3.0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CleanResponse | null>(null);

  const handleClean = async () => {
    setLoading(true);
    setError(null);
    const payload: CleanRequest = {
      missing_strategy: missingStrategy,
      encode_categoricals: encodeCategoricals,
      remove_outliers: removeOutliers,
      outlier_method: 'zscore',
      outlier_threshold: outlierThreshold,
    };
    try {
      const res = await cleanDataset(datasetId, payload);
      setResult(res);
      onCleaned(res);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        'Cleaning failed.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="panel">
      <div className="panel__header">
        <h2>🧹 Dataset Cleaning</h2>
        <p className="panel__subtitle">
          Configure how to handle missing values, categorical encoding, and outliers before analysis.
        </p>
      </div>

      <div className="clean-grid">
        {/* Missing Values */}
        <div className="clean-card">
          <h3 className="clean-card__title">Missing Values</h3>
          <div className="option-group">
            {(['mean', 'median', 'mode', 'drop'] as MissingStrategy[]).map((s) => (
              <label key={s} className={`option-label ${missingStrategy === s ? 'selected' : ''}`}>
                <input
                  type="radio"
                  name="missing"
                  value={s}
                  checked={missingStrategy === s}
                  onChange={() => setMissingStrategy(s)}
                />
                <span className="option-label__text">
                  {s === 'mean' && '📊 Impute with mean'}
                  {s === 'median' && '📏 Impute with median'}
                  {s === 'mode' && '🔢 Impute with mode'}
                  {s === 'drop' && '🗑️ Drop rows'}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Categorical Encoding */}
        <div className="clean-card">
          <h3 className="clean-card__title">Categorical Columns</h3>
          <label className="toggle-label">
            <div className={`toggle ${encodeCategoricals ? 'on' : ''}`} onClick={() => setEncodeCategoricals(!encodeCategoricals)}>
              <div className="toggle__thumb" />
            </div>
            <span>Encode categorical columns</span>
          </label>
          <p className="clean-card__hint">
            Converts text columns to numeric categories for model compatibility.
          </p>
        </div>

        {/* Outlier Removal */}
        <div className="clean-card">
          <h3 className="clean-card__title">Outliers</h3>
          <label className="toggle-label">
            <div className={`toggle ${removeOutliers ? 'on' : ''}`} onClick={() => setRemoveOutliers(!removeOutliers)}>
              <div className="toggle__thumb" />
            </div>
            <span>Remove outliers (Z-score)</span>
          </label>
          {removeOutliers && (
            <div className="slider-group">
              <label className="slider-label">
                Threshold: <strong>{outlierThreshold}σ</strong>
              </label>
              <input
                type="range"
                min="1.5"
                max="5"
                step="0.5"
                value={outlierThreshold}
                onChange={(e) => setOutlierThreshold(parseFloat(e.target.value))}
                className="slider"
              />
              <div className="slider-ticks">
                <span>1.5σ</span><span>5σ</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {error && <div className="error-box">⚠️ {error}</div>}

      {result && (
        <div className="clean-result">
          <h3>✅ Cleaning Complete</h3>
          <div className="clean-result__meta">
            <span className="badge badge--green">{result.cleaned_rows.toLocaleString()} rows remaining</span>
          </div>
          {result.transformations.length > 0 && (
            <div className="clean-result__log">
              <p className="label">Transformations applied:</p>
              <ul>
                {result.transformations.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="panel__actions">
        <button className="btn btn--secondary" onClick={onSkip} disabled={loading}>
          Skip Cleaning
        </button>
        <button className="btn btn--primary" onClick={handleClean} disabled={loading}>
          {loading ? <><span className="spinner" />Cleaning…</> : '🧹 Clean Dataset'}
        </button>
      </div>
    </div>
  );
}
