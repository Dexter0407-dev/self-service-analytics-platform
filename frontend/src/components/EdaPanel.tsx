import { useEffect, useState } from 'react';
import { getEda } from '../api/client';
import type { EdaResponse } from '../types';

interface Props {
  datasetId: string;
  onProceed: (eda: EdaResponse) => void;
}

export default function EdaPanel({ datasetId, onProceed }: Props) {
  const [eda, setEda] = useState<EdaResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'stats' | 'sample'>('overview');

  useEffect(() => {
    setLoading(true);
    getEda(datasetId)
      .then(setEda)
      .catch((err) => {
        const msg =
          (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
          'Failed to load EDA.';
        setError(msg);
      })
      .finally(() => setLoading(false));
  }, [datasetId]);

  if (loading)
    return (
      <div className="panel panel--loading">
        <span className="spinner spinner--lg" />
        <p>Analysing dataset…</p>
      </div>
    );

  if (error) return <div className="panel error-box">⚠️ {error}</div>;
  if (!eda) return null;

  const totalNulls = Object.values(eda.null_counts).reduce((a, b) => a + b, 0);
  const totalOutliers = Object.values(eda.outlier_counts).reduce((a, b) => a + b, 0);
  const numericCols = Object.keys(eda.numeric_stats);
  const categoricalCols = eda.columns.filter((c) => !numericCols.includes(c));

  return (
    <div className="panel">
      <div className="panel__header">
        <h2>🔍 Exploratory Data Analysis</h2>
        <p className="panel__subtitle">
          Automated summary of <strong>{eda.columns.length}</strong> columns across your dataset.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="kpi-row">
        <div className="kpi-card">
          <span className="kpi-card__icon">🔢</span>
          <span className="kpi-card__value">{eda.columns.length}</span>
          <span className="kpi-card__label">Columns</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-card__icon">📊</span>
          <span className="kpi-card__value">{numericCols.length}</span>
          <span className="kpi-card__label">Numeric</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-card__icon">🏷️</span>
          <span className="kpi-card__value">{categoricalCols.length}</span>
          <span className="kpi-card__label">Categorical</span>
        </div>
        <div className={`kpi-card ${totalNulls > 0 ? 'kpi-card--warn' : 'kpi-card--ok'}`}>
          <span className="kpi-card__icon">{totalNulls > 0 ? '⚠️' : '✅'}</span>
          <span className="kpi-card__value">{totalNulls.toLocaleString()}</span>
          <span className="kpi-card__label">Missing Values</span>
        </div>
        <div className={`kpi-card ${totalOutliers > 0 ? 'kpi-card--warn' : 'kpi-card--ok'}`}>
          <span className="kpi-card__icon">{totalOutliers > 0 ? '📌' : '✅'}</span>
          <span className="kpi-card__value">{totalOutliers.toLocaleString()}</span>
          <span className="kpi-card__label">Outliers (IQR)</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        {(['overview', 'stats', 'sample'] as const).map((t) => (
          <button
            key={t}
            className={`tab ${activeTab === t ? 'active' : ''}`}
            onClick={() => setActiveTab(t)}
          >
            {t === 'overview' && '📋 Column Overview'}
            {t === 'stats' && '📈 Numeric Stats'}
            {t === 'sample' && '👁️ Sample Rows'}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {activeTab === 'overview' && (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Column</th>
                  <th>Type</th>
                  <th>Missing</th>
                  <th>Outliers</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {eda.columns.map((col) => {
                  const nullCount = eda.null_counts[col] ?? 0;
                  const outlierCount = eda.outlier_counts[col] ?? 0;
                  const dtype = eda.dtypes[col] ?? 'unknown';
                  return (
                    <tr key={col}>
                      <td><span className="col-name">{col}</span></td>
                      <td><span className={`type-badge type-badge--${dtype.includes('int') || dtype.includes('float') ? 'num' : 'cat'}`}>{dtype}</span></td>
                      <td>
                        {nullCount > 0
                          ? <span className="warn-text">{nullCount}</span>
                          : <span className="ok-text">0</span>}
                      </td>
                      <td>
                        {outlierCount > 0
                          ? <span className="warn-text">{outlierCount}</span>
                          : <span className="ok-text">—</span>}
                      </td>
                      <td>
                        {nullCount === 0 && outlierCount === 0
                          ? <span className="badge badge--green">Clean</span>
                          : nullCount > 0 && outlierCount > 0
                          ? <span className="badge badge--red">Issues</span>
                          : <span className="badge badge--yellow">Review</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'stats' && (
          numericCols.length === 0 ? (
            <p className="empty-state">No numeric columns found.</p>
          ) : (
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Column</th>
                    <th>Mean</th>
                    <th>Std Dev</th>
                    <th>Min</th>
                    <th>Max</th>
                  </tr>
                </thead>
                <tbody>
                  {numericCols.map((col) => {
                    const s = eda.numeric_stats[col];
                    return (
                      <tr key={col}>
                        <td><span className="col-name">{col}</span></td>
                        <td>{s.mean.toFixed(3)}</td>
                        <td>{s.std.toFixed(3)}</td>
                        <td>{s.min.toFixed(3)}</td>
                        <td>{s.max.toFixed(3)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        )}

        {activeTab === 'sample' && (
          eda.sample_rows.length === 0 ? (
            <p className="empty-state">No sample rows available.</p>
          ) : (
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    {eda.columns.map((col) => <th key={col}>{col}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {eda.sample_rows.map((row, i) => (
                    <tr key={i}>
                      {eda.columns.map((col) => (
                        <td key={col}>{String(row[col] ?? '—')}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>

      {eda.clean_log && eda.clean_log.length > 0 && (
        <div className="clean-log-notice">
          <p className="label">🧹 Cleaning was applied to this dataset:</p>
          <ul>
            {eda.clean_log.map((entry, i) => <li key={i}>{entry}</li>)}
          </ul>
        </div>
      )}

      <div className="panel__actions">
        <button className="btn btn--primary" onClick={() => onProceed(eda)}>
          Proceed to Training →
        </button>
      </div>
    </div>
  );
}
