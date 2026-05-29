const { createApp } = require('./api');
const { startAllWorkers, stopAllWorkers } = require('./workers/workerRegistry');
const { closeQueues } = require('./queues/queueManager');

const PORT = Number(process.env.TASK_QUEUE_PORT || 4001);

// ─── Task Result Handler ──────────────────────────────────────────────────────
// Replace this stub with your real DB write + tick() call.

async function onTaskResult(result) {
  console.log(
    `[Main] Result — task: ${result.taskExecutionId}, state: ${result.state}`,
    result.error ? `| error: ${result.error}` : '',
  );
  // TODO: await db.updateTaskState(result.taskExecutionId, result.state, result.resultPayload);
  // TODO: await tick(result.workflowExecutionId);
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────

async function main() {
  startAllWorkers();

  const app = createApp(onTaskResult);
  const server = app.listen(PORT, () => {
    console.log(`[Main] Task Queue running on port ${PORT}`);
    console.log(`[Main] Health:      http://localhost:${PORT}/health`);
    console.log(`[Main] Queue stats: http://localhost:${PORT}/api/v1/queues/stats`);
  });

  // ─── Graceful Shutdown ──────────────────────────────────────────────────

  const shutdown = async (signal) => {
    console.log(`\n[Main] ${signal} received — shutting down...`);

    server.close(async () => {
      try {
        await stopAllWorkers();
        await closeQueues();
        console.log('[Main] Clean shutdown complete.');
        process.exit(0);
      } catch (err) {
        console.error('[Main] Error during shutdown:', err);
        process.exit(1);
      }
    });

    setTimeout(() => {
      console.error('[Main] Forced shutdown after timeout.');
      process.exit(1);
    }, 15000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('uncaughtException', (err) => {
    console.error('[Main] Uncaught exception:', err);
    shutdown('uncaughtException');
  });
}

main().catch((err) => {
  console.error('[Main] Fatal startup error:', err);
  process.exit(1);
});
