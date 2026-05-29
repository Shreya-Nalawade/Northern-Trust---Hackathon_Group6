const { dispatchTask } = require('../queues/queueManager');

/**
 * Dispatch a READY task to the appropriate service queue.
 * Called by the orchestrator tick() when a task transitions to READY.
 */
async function dispatchReadyTask(task) {
  const jobData = {
    taskExecutionId: task.taskExecutionId,
    workflowExecutionId: task.workflowExecutionId,
    taskId: task.taskId,
    service: task.service,
    endpoint: task.endpoint,
    method: task.method || 'POST',
    payload: task.payload,
    timeoutMs: task.timeoutMs || 30000,
    attemptNumber: task.attemptNumber || 1,
  };

  await dispatchTask(jobData);
}

/**
 * Retry a failed task — increment attempt number and re-dispatch.
 * Caller must reset DB state to PENDING before calling this.
 */
async function retryTask(task) {
  console.log(`[Orchestrator] Retrying "${task.taskId}" (attempt ${(task.attemptNumber || 1) + 1})`);
  await dispatchReadyTask({
    ...task,
    attemptNumber: (task.attemptNumber || 1) + 1,
  });
}

module.exports = { dispatchReadyTask, retryTask };
