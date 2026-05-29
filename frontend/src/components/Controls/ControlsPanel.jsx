import { useState } from 'react';
import { Pause, Play, XOctagon, AlertTriangle } from 'lucide-react';
import { pauseWorkflow, resumeWorkflow, terminateWorkflow } from '../../api/client';
import Modal from '../shared/Modal';

export function ControlsPanel({ workflowId, workflowState, onAction }) {
  const [loading, setLoading] = useState(null);
  const [showTerminateConfirm, setShowTerminateConfirm] = useState(false);

  const handleAction = async (action, apiFn) => {
    setLoading(action);
    try {
      await apiFn(workflowId);
      onAction?.(action);
    } catch (err) {
      console.error(`${action} failed:`, err);
    } finally {
      setLoading(null);
    }
  };

  const isRunning = workflowState === 'RUNNING';
  const isPaused = workflowState === 'PAUSED';
  const isTerminal = ['COMPLETED', 'FAILED', 'CANCELLED'].includes(workflowState);

  return (
    <div className="controls-panel">
      <h4 className="controls-panel__title">Workflow Controls</h4>
      <div className="controls-panel__actions">
        {isRunning && (
          <button
            className="btn btn-warning"
            onClick={() => handleAction('pause', pauseWorkflow)}
            disabled={loading === 'pause'}
          >
            <Pause size={14} />
            {loading === 'pause' ? 'Pausing…' : 'Pause'}
          </button>
        )}

        {isPaused && (
          <button
            className="btn btn-success"
            onClick={() => handleAction('resume', resumeWorkflow)}
            disabled={loading === 'resume'}
          >
            <Play size={14} />
            {loading === 'resume' ? 'Resuming…' : 'Resume'}
          </button>
        )}

        {!isTerminal && (
          <button
            className="btn btn-danger"
            onClick={() => setShowTerminateConfirm(true)}
            disabled={loading === 'terminate'}
          >
            <XOctagon size={14} />
            Terminate
          </button>
        )}

        {isTerminal && (
          <span className="controls-panel__terminal">
            Workflow is in terminal state
          </span>
        )}
      </div>

      {/* Terminate Confirmation */}
      <Modal
        isOpen={showTerminateConfirm}
        onClose={() => setShowTerminateConfirm(false)}
        title="Confirm Terminate"
      >
        <div className="terminate-confirm">
          <div className="terminate-confirm__warning">
            <AlertTriangle size={24} />
            <p>
              Are you sure you want to terminate this workflow? All pending tasks will be cancelled. In-progress tasks will be allowed to complete.
            </p>
          </div>
          <div className="form-actions">
            <button
              className="btn btn-ghost"
              onClick={() => setShowTerminateConfirm(false)}
            >
              Cancel
            </button>
            <button
              className="btn btn-danger"
              onClick={async () => {
                await handleAction('terminate', terminateWorkflow);
                setShowTerminateConfirm(false);
              }}
              disabled={loading === 'terminate'}
            >
              <XOctagon size={14} />
              {loading === 'terminate' ? 'Terminating…' : 'Yes, Terminate'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default ControlsPanel;
