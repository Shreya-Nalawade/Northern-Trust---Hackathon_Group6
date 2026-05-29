import { useState } from 'react';
import { Play, Package } from 'lucide-react';
import { startWorkflow } from '../../api/client';
import Modal from './Modal';

export function StartWorkflowModal({ isOpen, onClose, onSuccess }) {
  const [orderId, setOrderId] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [totalValue, setTotalValue] = useState('');
  const [items, setItems] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const payload = {
      workflow: 'order-fulfillment',
      input: {
        order_id: orderId || `ORD-${Date.now().toString(36).toUpperCase()}`,
        customer_id: customerId || `CUST-${Math.floor(Math.random() * 999).toString().padStart(3, '0')}`,
        total_value: parseFloat(totalValue) || 150,
        items: items
          ? items.split(',').map((s) => {
              const [name, qty] = s.trim().split(':');
              const sku = name.trim().startsWith('SKU-') ? name.trim() : 'SKU-101';
              return { sku, quantity: parseInt(qty, 10) || 1 };
            })
          : [{ sku: 'SKU-101', quantity: 1 }],
      },
    };

    try {
      await startWorkflow(payload);
      onSuccess?.();
      handleClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setOrderId('');
    setCustomerId('');
    setTotalValue('');
    setItems('');
    setError(null);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Start New Workflow">
      <form onSubmit={handleSubmit} className="start-workflow-form">
        <div className="form-group">
          <label className="form-label">
            <Package size={14} />
            Workflow
          </label>
          <input
            className="form-input"
            value="order-fulfillment"
            disabled
          />
        </div>

        <div className="form-group">
          <label className="form-label">Order ID</label>
          <input
            className="form-input"
            placeholder="e.g. ORD-001 (auto-generated if empty)"
            value={orderId}
            onChange={(e) => setOrderId(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label className="form-label">Customer ID</label>
          <input
            className="form-input"
            placeholder="e.g. CUST-042 (auto-generated if empty)"
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label className="form-label">Total Value ($)</label>
          <input
            className="form-input"
            type="number"
            step="0.01"
            placeholder="e.g. 150 (orders > $500 need approval)"
            value={totalValue}
            onChange={(e) => setTotalValue(e.target.value)}
          />
          <p className="form-hint">Orders over $500 will require manual approval</p>
        </div>

        <div className="form-group">
          <label className="form-label">Items (SKU:qty, comma-separated)</label>
          <input
            className="form-input"
            placeholder="e.g. SKU-101:2, SKU-102:1"
            value={items}
            onChange={(e) => setItems(e.target.value)}
          />
          <p className="form-hint">Leave blank to use default SKU-101 qty=1</p>
        </div>

        {error && (
          <div className="form-error">
            {error}
          </div>
        )}

        <div className="form-actions">
          <button type="button" className="btn btn-ghost" onClick={handleClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            <Play size={14} />
            {loading ? 'Starting…' : 'Start Workflow'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default StartWorkflowModal;
