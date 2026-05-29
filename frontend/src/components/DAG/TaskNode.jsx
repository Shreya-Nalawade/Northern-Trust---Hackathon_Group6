import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { getStateConfig, formatElapsed } from '../../utils/helpers';
import {
  Globe, User, Clock, Zap, GitBranch, Layers,
} from 'lucide-react';

const TYPE_ICONS = {
  http: Globe,
  human: User,
  timer: Clock,
  event: Zap,
  condition: GitBranch,
  parallel: Layers,
};

function TaskNodeComponent({ data, selected }) {
  const stateConfig = getStateConfig(data.state, true);
  const Icon = TYPE_ICONS[data.type] || Globe;
  const isActive = data.state === 'IN_PROGRESS' || data.state === 'DISPATCHED';
  const isTrigger = !!data.trigger;

  return (
    <div
      className={`task-node ${selected ? 'task-node--selected' : ''} ${isActive ? 'task-node--active' : ''} ${isTrigger ? 'task-node--trigger' : ''}`}
      style={{
        borderColor: stateConfig.border,
        '--node-color': stateConfig.color,
        '--node-bg': stateConfig.bg,
      }}
    >
      <div
        className="task-node__state-bar"
        style={{ backgroundColor: stateConfig.color }}
      />

      <div className="task-node__body">
        <div className="task-node__header">
          <Icon size={13} style={{ color: stateConfig.color, flexShrink: 0 }} />
          <span className="task-node__name">{data.task_id || data.label}</span>
        </div>

        <div className="task-node__meta">
          <span
            className="task-node__state"
            style={{ color: stateConfig.color }}
          >
            {stateConfig.label}
          </span>
          {data.dispatched_at && (
            <span className="task-node__time">
              <Clock size={10} />
              {formatElapsed(data.dispatched_at, data.completed_at)}
            </span>
          )}
        </div>

        {data.service && (
          <div className="task-node__service">{data.service}</div>
        )}

        {data.type === 'human' && data.state !== 'SKIPPED' && (
          <div className="task-node__human-badge">
            <User size={10} /> Requires Approval
          </div>
        )}
      </div>

      {/* Vertical handles: top for incoming, bottom for outgoing */}
      <Handle type="target" position={Position.Top} className="task-node__handle" />
      <Handle type="source" position={Position.Bottom} className="task-node__handle" />
    </div>
  );
}

export const TaskNode = memo(TaskNodeComponent);
export default TaskNode;
