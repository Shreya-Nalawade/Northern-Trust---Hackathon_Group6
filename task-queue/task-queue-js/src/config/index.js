// ─── Redis Connection ─────────────────────────────────────────────────────────

const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: Number(process.env.REDIS_PORT || 6379),
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null, // required by BullMQ
};

// ─── Orchestrator Callback URL ────────────────────────────────────────────────

const ORCHESTRATOR_CALLBACK_URL =
  process.env.ORCHESTRATOR_URL || 'http://localhost:4000';

// ─── Service Registry ─────────────────────────────────────────────────────────

const SERVICE_CONFIGS = [
  {
    name: 'payment-service',
    baseUrl: process.env.PAYMENT_SERVICE_URL || 'http://localhost:3001',
    queueName: 'payment-service',
    concurrency: 5,
  },
  {
    name: 'inventory-service',
    baseUrl: process.env.INVENTORY_SERVICE_URL || 'http://localhost:3002',
    queueName: 'inventory-service',
    concurrency: 10,
  },
  {
    name: 'shipping-service',
    baseUrl: process.env.SHIPPING_SERVICE_URL || 'http://localhost:3003',
    queueName: 'shipping-service',
    concurrency: 5,
  },
  {
    name: 'notification-service',
    baseUrl: process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3004',
    queueName: 'notification-service',
    concurrency: 20,
  },
  {
    name: 'approval-service',
    baseUrl: process.env.APPROVAL_SERVICE_URL || 'http://localhost:3005',
    queueName: 'approval-service',
    concurrency: 3,
  },
];

const DEFAULT_JOB_OPTIONS = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 1000, // 1s → 2s → 4s
  },
  removeOnComplete: { count: 500 },
  removeOnFail: { count: 200 },
};

module.exports = { redisConfig, ORCHESTRATOR_CALLBACK_URL, SERVICE_CONFIGS, DEFAULT_JOB_OPTIONS };
