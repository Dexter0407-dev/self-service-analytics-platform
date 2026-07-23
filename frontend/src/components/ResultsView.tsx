import { useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { getResults, runPrediction } from '../api/client';
import type { ResultsResponse, TrainResponse } from '../types';

interface Props {
  job: TrainResponse;
}

const PALETTE = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f59e0b',
  '#10b981', '#3b82f6', '#ef4444', '#14b8a6',
];

export default function ResultsView({ job }: Props) {
  const [results, setResults] = useState<ResultsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'metrics' | 'importance' | 'predictions' | 'predict'>('metrics');

  // Prediction form state
  const [featureValues, setFeatureValues] = useState<Record<string, string>>({});
  const [predicting, setPredicting] = useState(false);
  const [predResult, setPredResult] = useState<unknown>(null);
  const [predError, setPredError] = useState<string | null>(null);

  useEffect(() => {
    getResults(job.job_id)
      .then((r) => {
        setResults(r);
        // Initialise feature form from first sample row (excluding target)
        if (r.sample_predictions.length > 0) {
          const firstRow = r.sample_predictions[0];
          const init: Record<string, string> = {};
          Object.keys(firstRow)
            .filter((k) => k !== 'prediction')
            .forEach((k) => { init[k] = ''; });
          setFeatureValues(init);
        }
      })
      .catch((err) => {
        const msg =
          (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
          'Failed to load results.';
        setError(msg);
      })
      .finally(() => setLoading(false));
  }, [job.job_id]);

  const handlePredict = async () => {
    if (!results) return;
    setPredicting(true);
    setPredError(null);
    setPredResult(null);
    const features: Record<string, unknown> = {};
    Object.entries(featureValues).forEach(([k, v]) => {
      features[k] = v === '' ? null : isNaN(Number(v)) ? v : Number(v);
    });
    try {
      const resp = await runPrediction(job.job_id, job.dataset_id, features);
      setPredResult(resp.prediction);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        'Prediction failed.';
      setPredError(msg);
    } finally {
      setPredicting(false);
    }
  };

  if (loading)
    return (
      <div className="panel panel--loading">
        <span className="spinner spinner--lg" />
        <p>Loading results…</p>
      </div>
    );

  if (error) return <div className="panel error-box">⚠️ {error}</div>;
  if (!results) return null;

  const importanceData = results.feature_importance.slice(0, 12).map((f) => ({
    name: f.feature.length > 18 ? f.feature.slice(0, 16) + '…' : f.feature,
    fullName: f.feature,
    value: parseFloat(f.importance.toFixed(4)),
  }));

  return (
    <div className="panel">
      <div className="panel__header">
        <h2>📊 Training Results</h2>
        <div className="results-meta">
          <span className="badge badge--blue">Task: {results.task_type}</span>
          <span className="badge badge--purple">Model: {results.best_model}</span>
          <span className="badge badge--gray">Target: {results.target_column}</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        {(['metrics', 'importance', 'predictions', 'predict'] as const).map((t) => (
          <button
            key={t}
            className={`tab ${activeTab === t ? 'active' : ''}`}
            onClick={() => setActiveTab(t)}
          >
            {t === 'metrics' && '🎯 Metrics'}
            {t === 'importance' && '📊 Feature Importance'}
            {t === 'predictions' && '👁️ Sample Predictions'}
            {t === 'predict' && '⚡ Predict'}
          </button>
        ))}
      </div>

      <div className="tab-content">
        {/* ── Metrics Tab ── */}
        {activeTab === 'metrics' && (
          <div className="metrics-section">
            <div className="metrics-grid">
              {results.metrics.map((m) => (
                <div key={m.name} className="metric-card">
                  <span className="metric-card__name">{m.name.toUpperCase()}</span>
                  <span className="metric-card__value">
                    {m.value < 1 ? (m.value * 100).toFixed(1) + '%' : m.value.toFixed(4)}
                  </span>
                  <div className="metric-card__bar">
                    <div
                      className="metric-card__bar-fill"
                      style={{ width: `${Math.min(Math.abs(m.value) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="model-summary">
              <h3>Model Summary</h3>
              <table className="data-table">
                <tbody>
                  <tr><td>Algorithm</td><td><strong>{results.best_model}</strong></td></tr>
                  <tr><td>Task Type</td><td><strong>{results.task_type}</strong></td></tr>
                  <tr><td>Target Column</td><td><strong>{results.target_column}</strong></td></tr>
                  <tr><td>Features Used</td><td><strong>{results.feature_importance.length}</strong></td></tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Feature Importance Tab ── */}
        {activeTab === 'importance' && (
          <div className="chart-section">
            {importanceData.length === 0 ? (
              <p className="empty-state">No feature importance data available.</p>
            ) : (
              <>
                <h3 className="chart-title">Top {importanceData.length} Features by Importance</h3>
                <ResponsiveContainer width="100%" height={Math.max(300, importanceData.length * 36)}>
                  <BarChart
                    data={importanceData}
                    layout="vertical"
                    margin={{ top: 8, right: 40, left: 0, bottom: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                    <XAxis
                      type="number"
                      domain={[0, 'auto']}
                      tick={{ fontSize: 12, fill: '#64748b' }}
                      tickFormatter={(v) => v.toFixed(3)}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={130}
                      tick={{ fontSize: 12, fill: '#334155' }}
                    />
                    <Tooltip
                      formatter={(value: number, _: string, props) => [
                        value.toFixed(4),
                        props.payload?.fullName ?? 'Importance',
                      ]}
                      contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}
                    />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={28}>
                      {importanceData.map((_, index) => (
                        <Cell key={index} fill={PALETTE[index % PALETTE.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>

                {/* Table below chart */}
                <div className="table-scroll" style={{ marginTop: '1.5rem' }}>
                  <table className="data-table">
                    <thead>
                      <tr><th>#</th><th>Feature</th><th>Importance</th></tr>
                    </thead>
                    <tbody>
                      {results.feature_importance.map((f, i) => (
                        <tr key={f.feature}>
                          <td>{i + 1}</td>
                          <td><span className="col-name">{f.feature}</span></td>
                          <td>
                            <div className="inline-bar">
                              <div
                                className="inline-bar__fill"
                                style={{
                                  width: `${(f.importance / (results.feature_importance[0]?.importance || 1)) * 100}%`,
                                  background: PALETTE[i % PALETTE.length],
                                }}
                              />
                              <span>{f.importance.toFixed(4)}</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Sample Predictions Tab ── */}
        {activeTab === 'predictions' && (
          <div className="table-scroll">
            {results.sample_predictions.length === 0 ? (
              <p className="empty-state">No sample predictions available.</p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    {Object.keys(results.sample_predictions[0]).map((k) => (
                      <th key={k} className={k === 'prediction' ? 'th-highlight' : ''}>
                        {k === 'prediction' ? '🎯 Prediction' : k}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {results.sample_predictions.map((row, i) => (
                    <tr key={i}>
                      {Object.entries(row).map(([k, v]) => (
                        <td key={k} className={k === 'prediction' ? 'td-highlight' : ''}>
                          {String(v ?? '—')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* ── Predict Tab ── */}
        {activeTab === 'predict' && (
          <div className="predict-form">
            <p className="panel__subtitle">
              Enter feature values to run a live prediction using the trained model.
            </p>
            <div className="predict-grid">
              {Object.keys(featureValues).map((col) => (
                <div key={col} className="predict-field">
                  <label className="field-label">{col}</label>
                  <input
                    className="input"
                    type="text"
                    placeholder="Enter value"
                    value={featureValues[col]}
                    onChange={(e) =>
                      setFeatureValues((prev) => ({ ...prev, [col]: e.target.value }))
                    }
                  />
                </div>
              ))}
            </div>

            {predError && <div className="error-box">⚠️ {predError}</div>}

            {predResult !== null && (
              <div className="pred-result">
                <span className="pred-result__label">Prediction</span>
                <span className="pred-result__value">{String(predResult)}</span>
              </div>
            )}

            <div className="panel__actions">
              <button
                className="btn btn--primary"
                onClick={handlePredict}
                disabled={predicting}
              >
                {predicting ? <><span className="spinner" /> Predicting…</> : '⚡ Run Prediction'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
