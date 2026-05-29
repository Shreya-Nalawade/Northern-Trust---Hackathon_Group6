const { Queue, QueueEvents } = require('bullmq');
const { redisConfig, SERVICE_CONFIGS, DEFAULT_JOB_OPTIONS } = require('../config');

// ─── Queue Registry ───────────────────────────────────────────────────────────

const queues = new Map();
const queueEvents = new Map();

for (const svc of SERVICE_CONFIGS) {
  const q = new Queue(svc.queueName, {
    connection: redisConfig,
    defaultJobOptions: DEFAULT_JOB_OPTIONS,
  });

  const qe = new QueueEvents(svc.queueName, { connection: redisConfig });

  queues.set(svc.name, q);
  queueEvents.set(svc.name, qe);
}

// ─── Dispatch ─────────────────────────────────────────────────────────────────

/**
 * Push a task onto the correct service queue.
 * jobId = taskExecutionId so BullMQ deduplicates on retry.
 */
async function dispatchTask(data) {
  const queue = queues.get(data.service);
  if (!queue) {
    throw new Error(`No queue registered for service: ${data.service}`);
  }

  const job = await queue.add(data.taskExecutionId, data, {
    jobId: data.taskExecutionId,
  });

  console.log(`[QueueManager] Dispatched "${data.taskId}" → ${data.service} (job ${job.id})`);
  return job.id;
}

// ─── Queue Stats ──────────────────────────────────────────────────────────────

async function getQueueStats() {
  const stats = {};
  for (const [name, queue] of queues.entries()) {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
    ]);
    stats[name] = { waiting, active, completed, failed, delayed };
  }
  return stats;
}

// ─── Graceful Shutdown ────────────────────────────────────────────────────────

async function closeQueues() {
  await Promise.all([
    ...[...queues.values()].map((q) => q.close()),
    ...[...queueEvents.values()].map((qe) => qe.close()),
  ]);
  console.log('[QueueManager] All queues closed.');
}

module.exports = { queues, dispatchTask, getQueueStats, closeQueues };
