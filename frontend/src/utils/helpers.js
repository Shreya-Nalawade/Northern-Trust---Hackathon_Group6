// ─── Deep Merge ────────────────────────────────────────────────
export function mergeDeep(target, source) {
  if (!source) return target;
  const output = { ...target };
  for (const key of Object.keys(source)) {
    if (
      source[key] &&
      typeof source[key] === 'object' &&
      !Array.isArray(source[key]) &&
      target?.[key] &&
      typeof target[key] === 'object' &&
      !Array.isArray(target[key])
    ) {
      output[key] = mergeDeep(target[key], source[key]);
    } else {
      output[key] = source[key];
    }
  }
  return output;
}

// ─── Duration Formatting ───────────────────────────────────────
export function formatDuration(ms) {
  if (!ms && ms !== 0) return '—';
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) return `${minutes}m ${remainingSeconds}s`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

export function formatElapsed(startTime, endTime) {
  if (!startTime) return '—';
  const start = new Date(startTime).getTime();
  const end = endTime ? new Date(endTime).getTime() : Date.now();
  return formatDuration(end - start);
}

// ─── UUID Truncation ───────────────────────────────────────────
export function truncateId(id) {
  if (!id) return '—';
  return id.substring(0, 8);
}

// ─── State Color Mappings ──────────────────────────────────────
export const WORKFLOW_STATES = {
  RUNNING:   { label: 'Running',   color: '#3b82f6', bg: 'rgba(59,130,246,0.15)',  border: 'rgba(59,130,246,0.4)' },
  PAUSED:    { label: 'Paused',    color: '#f59e0b', bg: 'rgba(245,158,11,0.15)',  border: 'rgba(245,158,11,0.4)' },
  COMPLETED: { label: 'Completed', color: '#10b981', bg: 'rgba(16,185,129,0.15)',  border: 'rgba(16,185,129,0.4)' },
  FAILED:    { label: 'Failed',    color: '#ef4444', bg: 'rgba(239,68,68,0.15)',   border: 'rgba(239,68,68,0.4)' },
  CANCELLED: { label: 'Cancelled', color: '#6b7280', bg: 'rgba(107,114,128,0.15)', border: 'rgba(107,114,128,0.4)' },
};

export const TASK_STATES = {
  PENDING:       { label: 'Pending',       color: '#64748b', bg: 'rgba(100,116,139,0.15)', border: 'rgba(100,116,139,0.4)' },
  READY:         { label: 'Ready',         color: '#8b5cf6', bg: 'rgba(139,92,246,0.15)',  border: 'rgba(139,92,246,0.4)' },
  DISPATCHED:    { label: 'Dispatched',    color: '#06b6d4', bg: 'rgba(6,182,212,0.15)',   border: 'rgba(6,182,212,0.4)' },
  IN_PROGRESS:   { label: 'In Progress',   color: '#3b82f6', bg: 'rgba(59,130,246,0.15)',  border: 'rgba(59,130,246,0.4)' },
  COMPLETED:     { label: 'Completed',     color: '#10b981', bg: 'rgba(16,185,129,0.15)',  border: 'rgba(16,185,129,0.4)' },
  FAILED:        { label: 'Failed',        color: '#ef4444', bg: 'rgba(239,68,68,0.15)',   border: 'rgba(239,68,68,0.4)' },
  RETRYING:      { label: 'Retrying',      color: '#f97316', bg: 'rgba(249,115,22,0.15)',  border: 'rgba(249,115,22,0.4)' },
  SKIPPED:       { label: 'Skipped',       color: '#9ca3af', bg: 'rgba(156,163,175,0.15)', border: 'rgba(156,163,175,0.4)' },
  WAITING_HUMAN: { label: 'Awaiting Approval', color: '#a855f7', bg: 'rgba(168,85,247,0.15)', border: 'rgba(168,85,247,0.4)' },
  CANCELLED:     { label: 'Cancelled',     color: '#6b7280', bg: 'rgba(107,114,128,0.15)', border: 'rgba(107,114,128,0.4)' },
};

export function getStateConfig(state, isTask = false) {
  const map = isTask ? TASK_STATES : WORKFLOW_STATES;
  return map[state] || { label: state || 'Unknown', color: '#6b7280', bg: 'rgba(107,114,128,0.15)', border: 'rgba(107,114,128,0.4)' };
}

// ─── Event Type Labels ─────────────────────────────────────────
export const EVENT_TYPES = {
  WORKFLOW_STARTED:   { label: 'Workflow Started',   color: '#3b82f6', icon: '🚀' },
  WORKFLOW_COMPLETED: { label: 'Workflow Completed', color: '#10b981', icon: '✅' },
  WORKFLOW_FAILED:    { label: 'Workflow Failed',    color: '#ef4444', icon: '❌' },
  WORKFLOW_PAUSED:    { label: 'Workflow Paused',    color: '#f59e0b', icon: '⏸' },
  WORKFLOW_RESUMED:   { label: 'Workflow Resumed',   color: '#3b82f6', icon: '▶️' },
  WORKFLOW_CANCELLED: { label: 'Workflow Cancelled', color: '#6b7280', icon: '🚫' },
  TASK_STARTED:       { label: 'Task Started',       color: '#06b6d4', icon: '⚡' },
  TASK_COMPLETED:     { label: 'Task Completed',     color: '#10b981', icon: '✔️' },
  TASK_FAILED:        { label: 'Task Failed',        color: '#ef4444', icon: '💥' },
  TASK_RETRYING:      { label: 'Task Retrying',      color: '#f97316', icon: '🔄' },
  TASK_SKIPPED:       { label: 'Task Skipped',       color: '#9ca3af', icon: '⏭' },
  HUMAN_TASK_CREATED: { label: 'Approval Required',  color: '#a855f7', icon: '👤' },
  HUMAN_TASK_APPROVED:{ label: 'Task Approved',      color: '#10b981', icon: '👍' },
  HUMAN_TASK_REJECTED:{ label: 'Task Rejected',      color: '#ef4444', icon: '👎' },
};

export function getEventConfig(type) {
  return EVENT_TYPES[type] || { label: type || 'Unknown', color: '#6b7280', icon: '📋' };
}
