import { useState } from 'react';
import CleanPanel from './components/CleanPanel';
import EdaPanel from './components/EdaPanel';
import ErrorBanner from './components/ErrorBanner';
import ResultsView from './components/ResultsView';
import TrainPanel from './components/TrainPanel';
import UploadZone from './components/UploadZone';
import WorkflowStepper from './components/WorkflowStepper';
import type {
  EdaResponse,
  TrainResponse,
  UploadResponse,
  WorkflowStep,
} from './types';

export default function App() {
  const [step, setStep] = useState<WorkflowStep>('upload');
  const [completed, setCompleted] = useState<Set<WorkflowStep>>(new Set());
  const [globalError, setGlobalError] = useState<string | null>(null);

  // Data flowing through the workflow
  const [dataset, setDataset] = useState<UploadResponse | null>(null);
  const [eda, setEda] = useState<EdaResponse | null>(null);
  const [trainJob, setTrainJob] = useState<TrainResponse | null>(null);

  const markComplete = (s: WorkflowStep) =>
    setCompleted((prev) => new Set([...prev, s]));

  const goTo = (s: WorkflowStep) => setStep(s);

  // ── Step handlers ────────────────────────────────────────────────────────

  const handleUploaded = (data: UploadResponse) => {
    setDataset(data);
    setEda(null);
    setTrainJob(null);
    markComplete('upload');
    goTo('clean');
  };

  const handleCleaned = () => {
    markComplete('clean');
    goTo('eda');
  };

  const handleSkipClean = () => {
    markComplete('clean');
    goTo('eda');
  };

  const handleEdaProceed = (edaData: EdaResponse) => {
    setEda(edaData);
    markComplete('eda');
    goTo('train');
  };

  const handleTrainCompleted = (job: TrainResponse) => {
    setTrainJob(job);
    markComplete('train');
    goTo('results');
  };

  return (
    <div className="app">
      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="app-header">
        <div className="app-header__inner">
          <div className="app-header__brand">
            <span className="app-header__logo">🧠</span>
            <div>
              <h1 className="app-header__title">Self-Service Analytics</h1>
              <p className="app-header__sub">AutoML Platform — Upload · Clean · Analyse · Train · Predict</p>
            </div>
          </div>
          {dataset && (
            <div className="app-header__dataset-pill">
              <span className="app-header__dataset-icon">📄</span>
              <span className="app-header__dataset-name">{dataset.filename}</span>
              <span className="badge">{dataset.rows.toLocaleString()} rows</span>
            </div>
          )}
        </div>
      </header>

      {/* ── Stepper ─────────────────────────────────────────────── */}
      <div className="stepper-bar">
        <WorkflowStepper
          current={step}
          completed={completed}
          onNavigate={goTo}
        />
      </div>

      {/* ── Global Error ────────────────────────────────────────── */}
      <div className="app-body">
        <ErrorBanner message={globalError} onDismiss={() => setGlobalError(null)} />

        {/* ── Step: Upload ──────────────────────────────────────── */}
        {step === 'upload' && (
          <div className="step-panel">
            <div className="step-panel__header">
              <h2>📂 Upload Dataset</h2>
              <p className="step-panel__sub">Start by uploading a CSV file. Max 50 MB.</p>
            </div>
            <UploadZone onUploaded={handleUploaded} />
          </div>
        )}

        {/* ── Step: Clean ───────────────────────────────────────── */}
        {step === 'clean' && dataset && (
          <CleanPanel
            datasetId={dataset.dataset_id}
            onCleaned={handleCleaned}
            onSkip={handleSkipClean}
          />
        )}

        {/* ── Step: EDA ─────────────────────────────────────────── */}
        {step === 'eda' && dataset && (
          <EdaPanel
            datasetId={dataset.dataset_id}
            onProceed={handleEdaProceed}
          />
        )}

        {/* ── Step: Train ───────────────────────────────────────── */}
        {step === 'train' && dataset && eda && (
          <TrainPanel
            datasetId={dataset.dataset_id}
            eda={eda}
            onCompleted={handleTrainCompleted}
          />
        )}

        {/* ── Step: Results ─────────────────────────────────────── */}
        {step === 'results' && trainJob && (
          <ResultsView job={trainJob} />
        )}

        {/* ── Restart ───────────────────────────────────────────── */}
        {step === 'results' && (
          <div className="restart-bar">
            <button
              className="btn btn--outline"
              onClick={() => {
                setDataset(null);
                setEda(null);
                setTrainJob(null);
                setCompleted(new Set());
                goTo('upload');
              }}
            >
              ↩ Start Over with a New Dataset
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
