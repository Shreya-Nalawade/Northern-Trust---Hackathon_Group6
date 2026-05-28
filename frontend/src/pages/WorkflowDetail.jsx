import { useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import WorkflowDAG from '../components/DAG/WorkflowDAG';
import TaskInspector from '../components/TaskInspector/TaskInspector';
import EventLog from '../components/EventLog/EventLog';
import ControlsPanel from '../components/Controls/ControlsPanel';
import StateBadge from '../components/shared/StateBadge';
import { useWorkflow } from '../hooks/useWorkflow';
import { truncateId, formatElapsed } from '../utils/helpers';

export function WorkflowDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { workflow, loading, refetch } = useWorkflow(id);
  const [selectedTask, setSelectedTask] = useState(null);

  const handleNodeClick = useCallback((taskData) => {
    setSelectedTask(taskData);
  }, []);

  const handleCloseInspector = useCallback(() => {
    setSelectedTask(null);
  }, []);

  if (loading) {
    return (
      <div className="page workflow-detail-page">
        <div className="page-loading">
          <div className="page-loading__spinner" />
          <span>Loading workflow…</span>
        </div>
      </div>
    );
  }

  if (!workflow) {
    return (
      <div className="page workflow-detail-page">
        <div className="page-empty">
          <h3>Workflow not found</h3>
          <button className="btn btn-primary" onClick={() => navigate('/')}>
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="workflow-detail-page">
      {/* Header */}
      <div className="workflow-detail__header">
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/')}>
          <ArrowLeft size={14} />
          Back
        </button>
        <div className="workflow-detail__info">
          <div className="workflow-detail__title-row">
            <h1 className="workflow-detail__title">
              {workflow.workflow_name || 'order-fulfillment'}
            </h1>
            <StateBadge state={workflow.state} size="lg" />
          </div>
          <div className="workflow-detail__meta">
            <code>{truncateId(workflow.id)}</code>
            {workflow.input_payload?.order_id && (
              <span>Order: {workflow.input_payload.order_id}</span>
            )}
            <span>{formatElapsed(workflow.started_at, workflow.completed_at)}</span>
          </div>
        </div>
        <ControlsPanel
          workflowId={workflow.id}
          workflowState={workflow.state}
          onAction={refetch}
        />
      </div>

      {/* Main content: DAG center, panels on sides */}
      <div className="workflow-detail__body">
        {/* Task Inspector on left when open */}
        {selectedTask && (
          <TaskInspector
            task={selectedTask}
            onClose={handleCloseInspector}
            onRetry={refetch}
          />
        )}

        {/* DAG in the center */}
        <div className="workflow-detail__dag">
          <WorkflowDAG
            tasks={workflow.tasks}
            onNodeClick={handleNodeClick}
          />
        </div>

        {/* Event Log on the right */}
        <div className="workflow-detail__log-panel">
          <EventLog workflowId={workflow.id} />
        </div>
      </div>
    </div>
  );
}

export default WorkflowDetail;
