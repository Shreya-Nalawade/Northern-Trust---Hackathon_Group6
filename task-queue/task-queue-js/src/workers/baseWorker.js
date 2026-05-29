const { Worker } = require('bullmq');
const { redisConfig, ORCHESTRATOR_CALLBACK_URL } = require('../config');

// ─── HTTP Helper ──────────────────────────────────────────────────────────────

async function callService(baseUrl, endpoint, method, payload, timeoutMs) {
  const url = `${baseUrl}${endpoint}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Idempotency-Key': payload.taskExecutionId || '',
      },
      body: method !== 'GET' ? JSON.stringify(payload) : undefined,
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`HTTP ${res.status} from ${url}: ${body}`);
    }

    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

// ─── Orchestrator Result Reporter (with retry) ───────────────────────────────

async function reportResult(result, maxRetries = 3) {
  const url = `${ORCHESTRATOR_CALLBACK_URL}/api/v1/internal/task-result`;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(result),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      }

      return; // success
    } catch (err) {
      console.error(
        `[Worker] Failed to POST result to orchestrator (attempt ${attempt}/${maxRetries}):`,
        err.message,
      );

      if (attempt < maxRetries) {
        // exponential backoff: 500ms, 1000ms, 2000ms
        await new Promise((resolve) => setTimeout(resolve, 500 * Math.pow(2, attempt - 1)));
      } else {
        console.error(
          `[Worker] CRITICAL — Could not deliver result for task ${result.taskExecutionId} after ${maxRetries} attempts.`,
        );
      }
    }
  }
}

// ─── Worker Factory ───────────────────────────────────────────────────────────

function createServiceWorker(config) {
  const worker = new Worker(
    config.queueName,
    async (job) => {
      const { taskExecutionId, workflowExecutionId, taskId, endpoint, method, payload, timeoutMs } =
        job.data;

      console.log(
        `[${config.name}] Processing "${taskId}" (exec: ${taskExecutionId}, attempt: ${job.attemptsMade + 1})`,
      );

      await job.updateProgress(10);

      const serviceResponse = await callService(
        config.baseUrl,
        endpoint,
        method || 'POST',
        { ...payload, taskExecutionId },
        timeoutMs || 30000,
      );

      await job.updateProgress(100);

      console.log(`[${config.name}] "${taskId}" COMPLETED`);

      // Return data for the 'completed' event handler to report
      return {
        taskExecutionId,
        workflowExecutionId,
        state: 'COMPLETED',
        resultPayload: serviceResponse,
        completedAt: new Date().toISOString(),
      };
    },
    {
      connection: redisConfig,
      concurrency: config.concurrency,
      stalledInterval: 30000,
      maxStalledCount: 1,
    },
  );

  // ── Event Listeners ───────────────────────────────────────────────────────

  worker.on('active', (job) => {
    console.log(`[${config.name}] Job ${job.id} ACTIVE`);
  });

  // Report SUCCESS to orchestrator only once, after job completes
  worker.on('completed', (job, returnValue) => {
    console.log(`[${config.name}] Job ${job.id} COMPLETED — reporting to orchestrator`);
    reportResult(returnValue);
  });

  // Report FAILURE to orchestrator only when ALL retries are exhausted
  worker.on('failed', (job, err) => {
    const retriesLeft = (job?.opts?.attempts || 1) - (job?.attemptsMade || 0);

    if (retriesLeft > 0) {
      console.warn(
        `[${config.name}] Job ${job?.id} FAILED (${retriesLeft} retries left): ${err.message}`,
      );
      return; // BullMQ will retry — don't report yet
    }

    console.error(`[${config.name}] Job ${job?.id} PERMANENTLY FAILED: ${err.message}`);

    const { taskExecutionId, workflowExecutionId } = job?.data || {};
    reportResult({
      taskExecutionId,
      workflowExecutionId,
      state: 'FAILED',
      resultPayload: {},
      error: err.message,
      completedAt: new Date().toISOString(),
    });
  });

  worker.on('stalled', (jobId) => {
    console.warn(`[${config.name}] Job ${jobId} STALLED — will be retried`);
  });

  worker.on('error', (err) => {
    console.error(`[${config.name}] Worker error:`, err.message);
  });

  return worker;
}

module.exports = { createServiceWorker };
