import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Filter,
  ChevronRight,
  RefreshCw,
  Activity,
  CheckCircle2,
  PauseCircle,
  XCircle,
} from 'lucide-react';
import TopBar from '../components/Layout/TopBar';
import StateBadge from '../components/shared/StateBadge';
import StartWorkflowModal from '../components/shared/StartWorkflowModal';
import { useWorkflowList } from '../hooks/useWorkflowList';
import { truncateId, formatElapsed } from '../utils/helpers';
import { format } from 'date-fns';

const STATE_FILTERS = [
  { value: '', label: 'All States' },
  { value: 'RUNNING', label: 'Running' },
  { value: 'PAUSED', label: 'Paused' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'FAILED', label: 'Failed' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

export function WorkflowList() {
  const [stateFilter, setStateFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showStartModal, setShowStartModal] = useState(false);
  const navigate = useNavigate();

  const params = {};
  if (stateFilter) params.state = stateFilter;
  params.limit = 50;

  const { workflows, total, loading, refetch } = useWorkflowList(params);

  // Client-side search
  const filtered = workflows.filter((w) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      w.id?.toLowerCase().includes(q) ||
      w.workflow_name?.toLowerCase().includes(q) ||
      w.input_payload?.order_id?.toLowerCase().includes(q)
    );
  });

  // Stats
  const stats = {
    running: workflows.filter((w) => w.state === 'RUNNING').length,
    paused: workflows.filter((w) => w.state === 'PAUSED').length,
    completed: workflows.filter((w) => w.state === 'COMPLETED').length,
    failed: workflows.filter((w) => w.state === 'FAILED').length,
  };

  return (
    <div className="page">
      <TopBar title="Workflow Dashboard" onNewWorkflow={() => setShowStartModal(true)} />

      {/* Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card stat-card--blue">
          <div className="stat-card__icon"><Activity size={20} /></div>
          <div className="stat-card__content">
            <span className="stat-card__value">{stats.running}</span>
            <span className="stat-card__label">Running</span>
          </div>
        </div>
        <div className="stat-card stat-card--amber">
          <div className="stat-card__icon"><PauseCircle size={20} /></div>
          <div className="stat-card__content">
            <span className="stat-card__value">{stats.paused}</span>
            <span className="stat-card__label">Paused</span>
          </div>
        </div>
        <div className="stat-card stat-card--green">
          <div className="stat-card__icon"><CheckCircle2 size={20} /></div>
          <div className="stat-card__content">
            <span className="stat-card__value">{stats.completed}</span>
            <span className="stat-card__label">Completed</span>
          </div>
        </div>
        <div className="stat-card stat-card--red">
          <div className="stat-card__icon"><XCircle size={20} /></div>
          <div className="stat-card__content">
            <span className="stat-card__value">{stats.failed}</span>
            <span className="stat-card__label">Failed</span>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="filter-bar">
        <div className="filter-bar__search">
          <Search size={16} />
          <input
            type="text"
            placeholder="Search by ID, name, or order…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="filter-bar__input"
          />
        </div>
        <div className="filter-bar__controls">
          <div className="filter-bar__select-wrapper">
            <Filter size={14} />
            <select
              value={stateFilter}
              onChange={(e) => setStateFilter(e.target.value)}
              className="filter-bar__select"
            >
              {STATE_FILTERS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={refetch}>
            <RefreshCw size={14} />
            Refresh
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="table-wrapper">
        {loading ? (
          <div className="table-loading">
            <RefreshCw size={24} className="animate-spin" />
            <span>Loading workflows…</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="table-empty">
            <Activity size={40} />
            <h3>No workflows found</h3>
            <p>Start a new workflow or adjust your filters.</p>
          </div>
        ) : (
          <table className="workflow-table">
            <thead>
              <tr>
                <th>Execution ID</th>
                <th>Workflow</th>
                <th>Order</th>
                <th>State</th>
                <th>Started</th>
                <th>Duration</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((wf) => (
                <tr
                  key={wf.id}
                  className="workflow-table__row"
                  onClick={() => navigate(`/workflow/${wf.id}`)}
                >
                  <td className="workflow-table__id">
                    <code>{truncateId(wf.id)}</code>
                  </td>
                  <td className="workflow-table__name">
                    {wf.workflow_name || 'order-fulfillment'}
                  </td>
                  <td className="workflow-table__order">
                    {wf.input_payload?.order_id || '—'}
                    {wf.input_payload?.total_value && (
                      <span className="workflow-table__amount">
                        ${wf.input_payload.total_value.toLocaleString()}
                      </span>
                    )}
                  </td>
                  <td>
                    <StateBadge state={wf.state} />
                  </td>
                  <td className="workflow-table__date">
                    {wf.started_at
                      ? format(new Date(wf.started_at), 'MMM d, HH:mm:ss')
                      : '—'}
                  </td>
                  <td className="workflow-table__duration">
                    {formatElapsed(wf.started_at, wf.completed_at)}
                  </td>
                  <td>
                    <ChevronRight size={16} className="workflow-table__chevron" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <StartWorkflowModal
        isOpen={showStartModal}
        onClose={() => setShowStartModal(false)}
        onSuccess={refetch}
      />
    </div>
  );
}

export default WorkflowList;
