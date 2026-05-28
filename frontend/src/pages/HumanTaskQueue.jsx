import { useState, useEffect, useCallback, useRef } from 'react';
import {
  UserCheck,
  DollarSign,
  Users,
  CheckCircle,
  XCircle,
  Clock,
  ShieldAlert,
} from 'lucide-react';
import TopBar from '../components/Layout/TopBar';
import Modal from '../components/shared/Modal';
import { listHumanTasks, approveHumanTask, rejectHumanTask } from '../api/client';
import { MOCK_HUMAN_TASKS } from '../utils/mockData';
import { truncateId } from '../utils/helpers';
import { format } from 'date-fns';

const POLL_INTERVAL = 3000;

export function HumanTaskQueue() {
  const [tasks, setTasks] = useState([]);
  const [rejectModal, setRejectModal] = useState(null);
  const [approveModal, setApproveModal] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [decidedBy, setDecidedBy] = useState('');
  const [actionLoading, setActionLoading] = useState(null);
  const pollRef = useRef(null);

  const fetchTasks = useCallback(async () => {
    try {
      const data = await listHumanTasks();
      setTasks(Array.isArray(data) ? data : []);
    } catch (err) {
      console.warn('[HumanTaskQueue] API unavailable, using mock data:', err.message);
      setTasks(MOCK_HUMAN_TASKS);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // Poll for new human tasks
  useEffect(() => {
    pollRef.current = setInterval(fetchTasks, POLL_INTERVAL);
    return () => clearInterval(pollRef.current);
  }, [fetchTasks]);


  const handleApprove = async (task) => {
    setActionLoading(task.id);
    try {
      await approveHumanTask(task.id, decidedBy || 'operator');
      setTasks((prev) => prev.filter((t) => t.id !== task.id));
    } catch (err) {
      console.warn('Approve failed (mock mode):', err.message);
      // In mock mode, still remove the task
      setTasks((prev) => prev.filter((t) => t.id !== task.id));
    } finally {
      setActionLoading(null);
      setApproveModal(null);
      setDecidedBy('');
    }
  };

  const handleReject = async (task) => {
    setActionLoading(task.id);
    try {
      await rejectHumanTask(task.id, rejectReason || 'Rejected by operator');
      setTasks((prev) => prev.filter((t) => t.id !== task.id));
    } catch (err) {
      console.warn('Reject failed (mock mode):', err.message);
      setTasks((prev) => prev.filter((t) => t.id !== task.id));
    } finally {
      setActionLoading(null);
      setRejectModal(null);
      setRejectReason('');
    }
  };

  return (
    <div className="page">
      <TopBar title="Approval Queue" />

      {/* Info Banner */}
      <div className="approval-banner">
        <ShieldAlert size={20} />
        <div>
          <strong>Human-in-the-loop approvals</strong>
          <p>High-value orders (over $500) require manual approval before proceeding.</p>
        </div>
        <span className="approval-banner__count">{tasks.length} pending</span>
      </div>

      {/* Task Cards */}
      {tasks.length === 0 ? (
        <div className="table-empty">
          <UserCheck size={40} />
          <h3>No pending approvals</h3>
          <p>All human tasks have been processed.</p>
        </div>
      ) : (
        <div className="approval-grid">
          {tasks.map((task) => (
            <div key={task.id} className="approval-card">
              <div className="approval-card__header">
                <span className="approval-card__badge">
                  <Clock size={12} /> Pending Approval
                </span>
                <span className="approval-card__time">
                  {task.created_at
                    ? format(new Date(task.created_at), 'MMM d, HH:mm')
                    : '—'}
                </span>
              </div>

              <div className="approval-card__body">
                <div className="approval-card__detail">
                  <DollarSign size={16} />
                  <div>
                    <span className="approval-card__label">Order Value</span>
                    <span className="approval-card__value approval-card__value--highlight">
                      ${task.order_value?.toLocaleString() || '—'}
                    </span>
                  </div>
                </div>

                <div className="approval-card__detail">
                  <Users size={16} />
                  <div>
                    <span className="approval-card__label">Assigned Team</span>
                    <span className="approval-card__value">{task.assignee || '—'}</span>
                  </div>
                </div>

                <div className="approval-card__detail">
                  <span className="approval-card__label">Order ID</span>
                  <span className="approval-card__value">{task.order_id || '—'}</span>
                </div>

                <div className="approval-card__detail">
                  <span className="approval-card__label">Workflow</span>
                  <code className="approval-card__code">{truncateId(task.workflow_execution_id)}</code>
                </div>
              </div>

              <div className="approval-card__actions">
                <button
                  className="btn btn-success btn-sm"
                  onClick={() => setApproveModal(task)}
                  disabled={actionLoading === task.id}
                >
                  <CheckCircle size={14} />
                  Approve
                </button>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => setRejectModal(task)}
                  disabled={actionLoading === task.id}
                >
                  <XCircle size={14} />
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Approve Modal */}
      <Modal
        isOpen={!!approveModal}
        onClose={() => { setApproveModal(null); setDecidedBy(''); }}
        title="Approve Task"
      >
        <div className="approval-modal">
          <p>Approve order <strong>{approveModal?.order_id}</strong> for <strong>${approveModal?.order_value?.toLocaleString()}</strong>?</p>
          <div className="form-group">
            <label className="form-label">Your Name</label>
            <input
              className="form-input"
              placeholder="e.g. Alice"
              value={decidedBy}
              onChange={(e) => setDecidedBy(e.target.value)}
            />
          </div>
          <div className="form-actions">
            <button className="btn btn-ghost" onClick={() => setApproveModal(null)}>
              Cancel
            </button>
            <button
              className="btn btn-success"
              onClick={() => handleApprove(approveModal)}
              disabled={actionLoading}
            >
              <CheckCircle size={14} />
              Confirm Approval
            </button>
          </div>
        </div>
      </Modal>

      {/* Reject Modal */}
      <Modal
        isOpen={!!rejectModal}
        onClose={() => { setRejectModal(null); setRejectReason(''); }}
        title="Reject Task"
      >
        <div className="approval-modal">
          <p>Reject order <strong>{rejectModal?.order_id}</strong>?</p>
          <div className="form-group">
            <label className="form-label">Rejection Reason</label>
            <textarea
              className="form-input form-textarea"
              placeholder="e.g. Fraud suspected, invalid address…"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
            />
          </div>
          <div className="form-actions">
            <button className="btn btn-ghost" onClick={() => setRejectModal(null)}>
              Cancel
            </button>
            <button
              className="btn btn-danger"
              onClick={() => handleReject(rejectModal)}
              disabled={actionLoading}
            >
              <XCircle size={14} />
              Confirm Rejection
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default HumanTaskQueue;
