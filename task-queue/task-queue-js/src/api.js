const express = require('express');
const { dispatchReadyTask } = require('./orchestrator/orchestratorClient');
const { getQueueStats } = require('./queues/queueManager');

function createApp(onTaskResult) {
  const app = express();
  app.use(express.json());

  // ── Health ────────────────────────────────────────────────────────────────

  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // ── Queue Stats ───────────────────────────────────────────────────────────

  app.get('/api/v1/queues/stats', async (req, res) => {
    try {
      const stats = await getQueueStats();
      res.json(stats);
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch queue stats' });
    }
  });

  // ── Task Dispatch (called by orchestrator engine) ─────────────────────────
  // POST /api/v1/tasks/dispatch

  app.post('/api/v1/tasks/dispatch', async (req, res) => {
    const task = req.body;

    if (!task.taskExecutionId || !task.service || !task.endpoint) {
      return res.status(400).json({
        error: 'Missing required fields: taskExecutionId, service, endpoint',
      });
    }

    try {
      await dispatchReadyTask(task);
      res.status(202).json({ queued: true, taskExecutionId: task.taskExecutionId });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Task Result Callback (called by workers) ──────────────────────────────
  // POST /api/v1/internal/task-result

  app.post('/api/v1/internal/task-result', async (req, res) => {
    const result = req.body;

    if (!result.taskExecutionId || !result.state) {
      return res.status(400).json({
        error: 'Missing required fields: taskExecutionId, state',
      });
    }

    try {
      await onTaskResult(result);
      res.status(200).json({ received: true });
    } catch (err) {
      console.error('[API] Error handling task result:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ── Global Error Handler ──────────────────────────────────────────────────

  app.use((err, req, res, next) => {
    console.error('[API] Unhandled error:', err.message);
    res.status(500).json({ error: err.message });
  });

  return app;
}

module.exports = { createApp };
