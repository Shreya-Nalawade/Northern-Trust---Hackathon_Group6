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
  RUNNING:   { label: 'Running',   color: '#0070f3', bg: 'rgba(0,112,243,0.1)',    border: 'rgba(0,112,243,0.25)' },
  PAUSED:    { label: 'Paused',    color: '#f5a623', bg: 'rgba(245,166,35,0.1)',   border: 'rgba(245,166,35,0.25)' },
  COMPLETED: { label: 'Completed', color: '#00a67e', bg: 'rgba(0,166,126,0.1)',    border: 'rgba(0,166,126,0.25)' },
  FAILED:    { label: 'Failed',    color: '#e5484d', bg: 'rgba(229,72,77,0.1)',    border: 'rgba(229,72,77,0.25)' },
  CANCELLED: { label: 'Cancelled', color: '#666',    bg: 'rgba(102,102,102,0.1)',  border: 'rgba(102,102,102,0.25)' },
};

export const TASK_STATES = {
  PENDING:       { label: 'Pending',       color: '#666',    bg: 'rgba(102,102,102,0.1)',  border: 'rgba(102,102,102,0.25)' },
  READY:         { label: 'Ready',         color: '#7c3aed', bg: 'rgba(124,58,237,0.1)',   border: 'rgba(124,58,237,0.25)' },
  DISPATCHED:    { label: 'Dispatched',    color: '#06b6d4', bg: 'rgba(6,182,212,0.1)',    border: 'rgba(6,182,212,0.25)' },
  IN_PROGRESS:   { label: 'In Progress',   color: '#0070f3', bg: 'rgba(0,112,243,0.1)',    border: 'rgba(0,112,243,0.25)' },
  COMPLETED:     { label: 'Completed',     color: '#00a67e', bg: 'rgba(0,166,126,0.1)',    border: 'rgba(0,166,126,0.25)' },
  FAILED:        { label: 'Failed',        color: '#e5484d', bg: 'rgba(229,72,77,0.1)',    border: 'rgba(229,72,77,0.25)' },
  RETRYING:      { label: 'Retrying',      color: '#f5a623', bg: 'rgba(245,166,35,0.1)',   border: 'rgba(245,166,35,0.25)' },
  SKIPPED:       { label: 'Skipped',       color: '#555',    bg: 'rgba(85,85,85,0.1)',     border: 'rgba(85,85,85,0.25)' },
  WAITING_HUMAN: { label: 'Awaiting Approval', color: '#7c3aed', bg: 'rgba(124,58,237,0.1)', border: 'rgba(124,58,237,0.25)' },
  CANCELLED:     { label: 'Cancelled',     color: '#666',    bg: 'rgba(102,102,102,0.1)',  border: 'rgba(102,102,102,0.25)' },
};

export function getStateConfig(state, isTask = false) {
  const map = isTask ? TASK_STATES : WORKFLOW_STATES;
  return map[state] || { label: state || 'Unknown', color: '#666', bg: 'rgba(102,102,102,0.1)', border: 'rgba(102,102,102,0.25)' };
}

// ─── Event Type Labels ─────────────────────────────────────────
export const EVENT_TYPES = {
  WORKFLOW_STARTED:   { label: 'Started',    color: '#0070f3', icon: '→' },
  WORKFLOW_COMPLETED: { label: 'Completed',  color: '#00a67e', icon: '✓' },
  WORKFLOW_FAILED:    { label: 'Failed',     color: '#e5484d', icon: '✗' },
  WORKFLOW_PAUSED:    { label: 'Paused',     color: '#f5a623', icon: '‖' },
  WORKFLOW_RESUMED:   { label: 'Resumed',    color: '#0070f3', icon: '→' },
  WORKFLOW_CANCELLED: { label: 'Cancelled',  color: '#666',    icon: '⊘' },
  TASK_STARTED:       { label: 'Started',    color: '#06b6d4', icon: '→' },
  TASK_COMPLETED:     { label: 'Completed',  color: '#00a67e', icon: '✓' },
  TASK_FAILED:        { label: 'Failed',     color: '#e5484d', icon: '✗' },
  TASK_RETRYING:      { label: 'Retrying',   color: '#f5a623', icon: '↻' },
  TASK_SKIPPED:       { label: 'Skipped',    color: '#555',    icon: '—' },
  HUMAN_TASK_CREATED: { label: 'Approval',   color: '#7c3aed', icon: '?' },
  HUMAN_TASK_APPROVED:{ label: 'Approved',   color: '#00a67e', icon: '✓' },
  HUMAN_TASK_REJECTED:{ label: 'Rejected',   color: '#e5484d', icon: '✗' },
};

export function getEventConfig(type) {
  return EVENT_TYPES[type] || { label: type || 'Unknown', color: '#666', icon: '·' };
}
