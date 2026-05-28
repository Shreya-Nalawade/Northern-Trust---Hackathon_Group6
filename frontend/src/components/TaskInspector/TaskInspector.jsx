import { X, RotateCcw, Clock, AlertTriangle, CheckCircle2, Globe, User } from 'lucide-react';
import StateBadge from '../shared/StateBadge';
import JsonViewer from '../shared/JsonViewer';
import { formatElapsed } from '../../utils/helpers';
import { retryTask } from '../../api/client';
import { useState } from 'react';

export function TaskInspector({ task, onClose, onRetry }) {
  const [retrying, setRetrying] = useState(false);

  if (!task) return null;

  const handleRetry = async () => {
    setRetrying(true);
    try {
      await retryTask(task.id);
      onRetry?.();
    } catch (err) {
      console.error('Retry failed:', err);
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div className="task-inspector">
      {/* Header */}
      <div className="task-inspector__header">
        <div className="task-inspector__title-row">
          <h3 className="task-inspector__title">{task.task_id || task.label}</h3>
          <button className="task-inspector__close" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <div className="task-inspector__meta">
          <StateBadge state={task.state} isTask size="sm" />
          {task.type && (
            <span className="task-inspector__type">
              {task.type === 'http' ? <Globe size={12} /> : <User size={12} />}
              {task.type}
            </span>
          )}
          {task.service && (
            <span className="task-inspector__service">{task.service}</span>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="task-inspector__body">
        {/* Timing */}
        <div className="task-inspector__section">
          <h4 className="task-inspector__section-title">
            <Clock size={14} /> Timing
          </h4>
          <div className="task-inspector__grid">
            <div className="task-inspector__field">
              <span className="task-inspector__label">Elapsed</span>
              <span className="task-inspector__value">
                {formatElapsed(task.dispatched_at, task.completed_at)}
              </span>
            </div>
            <div className="task-inspector__field">
              <span className="task-inspector__label">Attempts</span>
              <span className="task-inspector__value">{task.attempt_number || 0}</span>
            </div>
          </div>
        </div>

        {/* Input Payload */}
        <div className="task-inspector__section">
          <JsonViewer data={task.input_payload} label="Input Payload" />
        </div>

        {/* Output Payload */}
        <div className="task-inspector__section">
          <JsonViewer data={task.result_payload} label="Output Payload" />
        </div>

        {/* Error Message */}
        {(task.state === 'FAILED' && (task.error || task.result_payload?.error)) && (
          <div className="task-inspector__section">
            <div className="task-inspector__error">
              <AlertTriangle size={14} />
              <div>
                <strong>Error</strong>
                <p>{task.error || task.result_payload?.error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Attempt History */}
        {task.attempts && task.attempts.length > 0 && (
          <div className="task-inspector__section">
            <h4 className="task-inspector__section-title">Attempt History</h4>
            <div className="task-inspector__attempts">
              {task.attempts.map((attempt, idx) => (
                <div key={idx} className={`task-inspector__attempt ${attempt.state === 'FAILED' ? 'task-inspector__attempt--failed' : ''}`}>
                  <div className="task-inspector__attempt-header">
                    <span className="task-inspector__attempt-num">
                      #{attempt.number || idx + 1}
                    </span>
                    <StateBadge state={attempt.state} isTask size="sm" />
                  </div>
                  <div className="task-inspector__attempt-time">
                    <Clock size={10} />
                    {formatElapsed(attempt.started_at, attempt.completed_at)}
                  </div>
                  {attempt.error && (
                    <div className="task-inspector__attempt-error">
                      <AlertTriangle size={10} /> {attempt.error}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Retry Button */}
        {task.state === 'FAILED' && (
          <div className="task-inspector__section">
            <button
              className="btn btn-warning btn-full"
              onClick={handleRetry}
              disabled={retrying}
            >
              <RotateCcw size={14} />
              {retrying ? 'Retrying…' : 'Retry This Task'}
            </button>
          </div>
        )}

        {/* Condition */}
        {task.condition && (
          <div className="task-inspector__section">
            <h4 className="task-inspector__section-title">Condition</h4>
            <code className="task-inspector__condition">{task.condition}</code>
          </div>
        )}
      </div>
    </div>
  );
}

export default TaskInspector;
