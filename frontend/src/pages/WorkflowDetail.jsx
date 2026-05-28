import { useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import TopBar from '../components/Layout/TopBar';
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
      <div className="page">
        <TopBar title="Workflow Detail" />
        <div className="page-loading">
          <div className="page-loading__spinner" />
          <span>Loading workflow…</span>
        </div>
      </div>
    );
  }

  if (!workflow) {
    return (
      <div className="page">
        <TopBar title="Workflow Detail" />
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
    <div className="page workflow-detail-page">
      {/* Header */}
      <div className="workflow-detail__header">
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/')}>
          <ArrowLeft size={16} />
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
            <span className="workflow-detail__id">
              <code>{truncateId(workflow.id)}</code>
            </span>
            {workflow.input_payload?.order_id && (
              <span className="workflow-detail__order">
                Order: {workflow.input_payload.order_id}
              </span>
            )}
            <span className="workflow-detail__elapsed">
              Duration: {formatElapsed(workflow.started_at, workflow.completed_at)}
            </span>
          </div>
        </div>
        <ControlsPanel
          workflowId={workflow.id}
          workflowState={workflow.state}
          onAction={refetch}
        />
      </div>

      {/* Main Content */}
      <div className={`workflow-detail__content ${selectedTask ? 'workflow-detail__content--with-inspector' : ''}`}>
        {/* DAG Area */}
        <div className="workflow-detail__dag">
          <WorkflowDAG
            tasks={workflow.tasks}
            onNodeClick={handleNodeClick}
          />
        </div>

        {/* Task Inspector (conditional) */}
        {selectedTask && (
          <TaskInspector
            task={selectedTask}
            onClose={handleCloseInspector}
            onRetry={refetch}
          />
        )}
      </div>

      {/* Event Log */}
      <div className="workflow-detail__log">
        <EventLog workflowId={workflow.id} />
      </div>
    </div>
  );
}

export default WorkflowDetail;
