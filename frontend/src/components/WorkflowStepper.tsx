import type { WorkflowStep } from '../types';

const STEPS: { key: WorkflowStep; label: string; icon: string }[] = [
  { key: 'upload', label: 'Upload', icon: '📂' },
  { key: 'clean', label: 'Clean', icon: '🧹' },
  { key: 'eda', label: 'EDA', icon: '🔍' },
  { key: 'train', label: 'Train', icon: '🤖' },
  { key: 'results', label: 'Results', icon: '📊' },
];

interface Props {
  current: WorkflowStep;
  completed: Set<WorkflowStep>;
  onNavigate: (step: WorkflowStep) => void;
}

export default function WorkflowStepper({ current, completed, onNavigate }: Props) {
  const currentIndex = STEPS.findIndex((s) => s.key === current);

  return (
    <nav className="stepper" aria-label="Workflow steps">
      {STEPS.map((step, idx) => {
        const isDone = completed.has(step.key);
        const isActive = step.key === current;
        const isReachable = idx <= currentIndex || isDone;

        return (
          <div key={step.key} className="stepper__item">
            <button
              className={`stepper__btn ${isActive ? 'active' : ''} ${isDone ? 'done' : ''} ${!isReachable ? 'disabled' : ''}`}
              onClick={() => isReachable && onNavigate(step.key)}
              disabled={!isReachable}
              aria-current={isActive ? 'step' : undefined}
            >
              <span className="stepper__icon">
                {isDone && !isActive ? '✅' : step.icon}
              </span>
              <span className="stepper__label">{step.label}</span>
            </button>
            {idx < STEPS.length - 1 && (
              <div className={`stepper__connector ${isDone ? 'done' : ''}`} />
            )}
          </div>
        );
      })}
    </nav>
  );
}
