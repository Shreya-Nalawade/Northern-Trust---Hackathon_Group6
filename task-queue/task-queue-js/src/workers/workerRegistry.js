const { SERVICE_CONFIGS } = require('../config');
const { createServiceWorker } = require('./baseWorker');

const activeWorkers = [];

function startAllWorkers() {
  console.log('[Workers] Starting workers for all services...');

  for (const config of SERVICE_CONFIGS) {
    const worker = createServiceWorker(config);
    activeWorkers.push(worker);
    console.log(`[Workers] ✓ ${config.name} (concurrency: ${config.concurrency})`);
  }

  console.log(`[Workers] ${activeWorkers.length} workers active.`);
}

async function stopAllWorkers() {
  console.log('[Workers] Shutting down workers...');
  await Promise.all(activeWorkers.map((w) => w.close()));
  console.log('[Workers] All workers stopped.');
}

module.exports = { startAllWorkers, stopAllWorkers };
