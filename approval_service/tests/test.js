/**
 * Approval Service — Integration Test Suite
 *
 * Prerequisites:
 *   1. npm install
 *   2. docker-compose up -d redis postgres   (or have Redis + Postgres running)
 *   3. node src/index.js                     (in another terminal)
 *   4. node tests/test.js                    (run this file)
 *
 * Tests all REST endpoints, validation, auth, idempotency, and error handling.
 */

const BASE = process.env.BASE_URL || 'http://localhost:3005';

// ─── Helpers ────────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;

function assert(condition, testName) {
  if (condition) {
    console.log(`  ✅  ${testName}`);
    passed++;
  } else {
    console.error(`  ❌  ${testName}`);
    failed++;
  }
}

async function request(method, path, body = null, headers = {}) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  const data = await res.json();
  return { status: res.status, data };
}

function randomUUID() {
  // Simple v4-ish UUID for testing (crypto.randomUUID may not be available in older Node)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// ─── Tests ──────────────────────────────────────────────────────────────────
async function run() {
  console.log(`\n🧪  Approval Service Test Suite`);
  console.log(`   Target: ${BASE}\n`);

  // ── 1. Health Check ─────────────────────────────────────────────────────
  console.log('── Health Check ──');
  {
    const { status, data } = await request('GET', '/health');
    assert(status === 200, 'GET /health returns 200');
    assert(data.service === 'approval-service', 'Health response has correct service name');
    assert(data.status === 'ok', 'Health status is "ok"');
    assert(data.db === 'connected', 'DB is connected');
  }

  // ── 2. Create Task (REST) ──────────────────────────────────────────────
  console.log('\n── Create Task (POST /human-tasks) ──');
  const taskExecId = randomUUID();
  const workflowExecId = randomUUID();
  let createdTaskId;

  {
    const { status, data } = await request('POST', '/human-tasks', {
      task_execution_id: taskExecId,
      workflow_execution_id: workflowExecId,
      task_id: 'manual-approval',
      assignee: 'test-team',
      input: { order_id: 'ORD-TEST-001', total_value: 500, customer_id: 'CUST-1' },
    });
    assert(status === 201, 'POST /human-tasks returns 201');
    assert(data.id !== undefined, 'Response contains task id');
    assert(data.status === 'PENDING', 'Task status is PENDING');
    assert(data.assignee === 'test-team', 'Assignee is correct');
    assert(data.order_id === 'ORD-TEST-001', 'Order ID is correct');
    assert(data.total_value == 500, 'Total value is correct');
    createdTaskId = data.id;
  }

  // ── 3. Falsy-value fix: total_value = 0 ────────────────────────────────
  console.log('\n── Falsy-Value Bug Fix (total_value=0) ──');
  {
    const execId = randomUUID();
    const { status, data } = await request('POST', '/human-tasks', {
      task_execution_id: execId,
      workflow_execution_id: randomUUID(),
      task_id: 'zero-value-test',
      input: { order_id: 'ORD-ZERO', total_value: 0 },
    });
    assert(status === 201, 'POST with total_value=0 returns 201');
    assert(data.total_value === 0 || data.total_value === '0', 'total_value=0 is preserved (not null)');
  }

  // ── 4. Idempotency ────────────────────────────────────────────────────
  console.log('\n── Idempotency (duplicate task_execution_id) ──');
  {
    const { status, data } = await request('POST', '/human-tasks', {
      task_execution_id: taskExecId, // same as earlier
      workflow_execution_id: workflowExecId,
      task_id: 'manual-approval',
      assignee: 'test-team',
      input: { order_id: 'ORD-TEST-001', total_value: 500 },
    });
    assert(status === 201, 'Idempotent retry returns 201');
    assert(data.id === createdTaskId, 'Returns the SAME task (not a duplicate)');
  }

  // ── 5. Get Single Task ─────────────────────────────────────────────────
  console.log('\n── Get Single Task (GET /human-tasks/:id) ──');
  {
    const { status, data } = await request('GET', `/human-tasks/${createdTaskId}`);
    assert(status === 200, 'GET /human-tasks/:id returns 200');
    assert(data.id === createdTaskId, 'Correct task returned');
    assert(data.status === 'PENDING', 'Status is still PENDING');
  }

  // ── 6. List Tasks ─────────────────────────────────────────────────────
  console.log('\n── List Tasks (GET /human-tasks) ──');
  {
    const { status, data } = await request('GET', '/human-tasks');
    assert(status === 200, 'GET /human-tasks returns 200');
    assert(Array.isArray(data.tasks), 'Response has tasks array');
    assert(typeof data.total === 'number', 'Response has total count');
    assert(data.tasks.length > 0, 'At least one task exists');
  }

  // ── 7. List with Filters ──────────────────────────────────────────────
  console.log('\n── List with Filters ──');
  {
    const { status, data } = await request('GET', '/human-tasks?status=PENDING&assignee=test-team');
    assert(status === 200, 'Filtered list returns 200');
    assert(data.tasks.every((t) => t.status === 'PENDING'), 'All results have status=PENDING');
    assert(data.tasks.every((t) => t.assignee === 'test-team'), 'All results have assignee=test-team');
  }

  // ── 8. UUID Validation ────────────────────────────────────────────────
  console.log('\n── UUID Validation ──');
  {
    const { status, data } = await request('GET', '/human-tasks/not-a-uuid');
    assert(status === 400, 'Invalid UUID returns 400');
    assert(data.error.includes('UUID'), 'Error message mentions UUID');
  }
  {
    const { status } = await request('POST', '/human-tasks/not-a-uuid/approve', { decided_by: 'test' });
    assert(status === 400, 'Approve with invalid UUID returns 400');
  }

  // ── 9. Missing Required Fields ────────────────────────────────────────
  console.log('\n── Request Validation ──');
  {
    const { status, data } = await request('POST', '/human-tasks', {
      task_id: 'missing-fields',
    });
    assert(status === 400, 'Missing required fields returns 400');
    assert(data.error.includes('required'), 'Error mentions required fields');
  }
  {
    const { status, data } = await request('POST', '/human-tasks', {
      task_execution_id: 'not-a-uuid',
      workflow_execution_id: 'also-not-uuid',
      task_id: 'bad-uuids',
    });
    assert(status === 400, 'Non-UUID execution IDs returns 400');
    assert(data.error.includes('valid UUIDs'), 'Error mentions valid UUIDs');
  }

  // ── 10. 404 for non-existent task ─────────────────────────────────────
  console.log('\n── 404 Handling ──');
  {
    const fakeId = randomUUID();
    const { status } = await request('GET', `/human-tasks/${fakeId}`);
    assert(status === 404, 'Non-existent task returns 404');
  }

  // ── 11. Approve Task ──────────────────────────────────────────────────
  console.log('\n── Approve Task (POST /human-tasks/:id/approve) ──');
  {
    const { status, data } = await request('POST', `/human-tasks/${createdTaskId}/approve`, {
      decided_by: 'test-user',
    });
    assert(status === 200, 'Approve returns 200');
    assert(data.status === 'APPROVED', 'Response status is APPROVED');
    assert(data.task.decided_by === 'test-user', 'decided_by is correct');
    assert(data.task.decided_at !== null, 'decided_at is set');
  }

  // ── 12. Double-Approve Prevention ─────────────────────────────────────
  console.log('\n── Double-Approve Prevention ──');
  {
    const { status, data } = await request('POST', `/human-tasks/${createdTaskId}/approve`, {
      decided_by: 'another-user',
    });
    assert(status === 404, 'Double-approve returns 404 (already decided)');
    assert(data.error.includes('already decided'), 'Error mentions already decided');
  }

  // ── 13. Reject a different Task ───────────────────────────────────────
  console.log('\n── Reject Task (POST /human-tasks/:id/reject) ──');
  const rejectExecId = randomUUID();
  let rejectTaskId;
  {
    const { data } = await request('POST', '/human-tasks', {
      task_execution_id: rejectExecId,
      workflow_execution_id: randomUUID(),
      task_id: 'reject-test',
      input: { order_id: 'ORD-REJ-001', total_value: 9999 },
    });
    rejectTaskId = data.id;
  }
  {
    const { status, data } = await request('POST', `/human-tasks/${rejectTaskId}/reject`, {
      decided_by: 'manager',
      reason: 'Suspicious order value',
    });
    assert(status === 200, 'Reject returns 200');
    assert(data.status === 'REJECTED', 'Response status is REJECTED');
    assert(data.task.decided_by === 'manager', 'decided_by is correct');
    assert(data.task.reject_reason === 'Suspicious order value', 'Reject reason is stored');
  }

  // ── 14. Verify approved/rejected task states ──────────────────────────
  console.log('\n── Verify Final States ──');
  {
    const { data } = await request('GET', `/human-tasks/${createdTaskId}`);
    assert(data.status === 'APPROVED', 'First task is APPROVED');
  }
  {
    const { data } = await request('GET', `/human-tasks/${rejectTaskId}`);
    assert(data.status === 'REJECTED', 'Second task is REJECTED');
  }

  // ── Summary ───────────────────────────────────────────────────────────
  console.log(`\n${'─'.repeat(50)}`);
  console.log(`  Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
  if (failed > 0) {
    console.log('  ⚠️  Some tests failed!\n');
    process.exit(1);
  } else {
    console.log('  🎉  All tests passed!\n');
    process.exit(0);
  }
}

run().catch((err) => {
  console.error('\n💥  Test suite crashed:', err.message);
  console.error('    Make sure the approval service is running: node src/index.js');
  process.exit(1);
});
