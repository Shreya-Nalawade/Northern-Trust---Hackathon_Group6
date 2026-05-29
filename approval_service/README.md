# Approval Service

Human task microservice for the Workflow Orchestrator. Handles pause/resume of workflows that require manual operator decisions.

**Port:** `3005`

---

## How it fits in the architecture

```
Orchestrator Engine
       │  dispatches human_task job
       ▼
 BullMQ Queue ("approval-service")
       │
       ▼
 Approval Service Worker  ──► PostgreSQL (human_tasks)
       │                             │
       │                     REST API (dashboard)
       │                             │
       └──── resultsQueue ◄── Approve / Reject
                │
                ▼
         Orchestrator Engine
         (resumes workflow)
```

When the DAG executor hits a task of `type: human`, it pushes a job onto the
`approval-service` BullMQ queue. The approval service:

1. Picks up the job and inserts a row into `human_tasks` (status = `PENDING`).
2. Emits a `human_task:created` Socket.IO event to all dashboard clients.
3. Returns `{ status: "WAITING_HUMAN" }` so the orchestrator parks the workflow.

When an operator approves or rejects via the dashboard (REST call), the service:

1. Updates the row to `APPROVED` / `REJECTED`.
2. Posts a result onto the `orchestrator-results` queue.
3. Emits a `human_task:resolved` Socket.IO event.
4. The orchestrator picks up the result and resumes (or fails) the workflow.

---

## REST API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/human-tasks` | List tasks (`?status=PENDING&assignee=ops-team`) |
| GET | `/human-tasks/:id` | Get single task |
| POST | `/human-tasks` | Create task directly (REST alternative to queue) |
| POST | `/human-tasks/:id/approve` | Approve — body `{ decided_by }` |
| POST | `/human-tasks/:id/reject` | Reject — body `{ decided_by, reason }` |

---

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3005` | HTTP listen port |
| `REDIS_HOST` | `localhost` | Redis hostname |
| `REDIS_PORT` | `6379` | Redis port |
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5432/orchestrator` | PostgreSQL connection string |

---

## Quick start (standalone)

```bash
# Start dependencies
docker run -d -p 6379:6379 redis:7-alpine
docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=postgres postgres:16-alpine

# Install and run
npm install
node src/index.js
```

## Quick start (docker-compose with full stack)

```bash
docker-compose up
```

---

## BullMQ job payload (sent by orchestrator)

```json
{
  "task_execution_id": "uuid",
  "workflow_execution_id": "uuid",
  "task_id": "manual-approval",
  "assignee": "ops-team",
  "input": {
    "order_id": "ORD-001",
    "customer_id": "CUST-42",
    "total_value": 1200,
    "items": [...]
  }
}
```

## Result posted to orchestrator-results queue

```json
{
  "task_execution_id": "uuid",
  "workflow_execution_id": "uuid",
  "task_id": "manual-approval",
  "state": "COMPLETED",
  "result": {
    "human_task_id": "uuid",
    "decision": "APPROVED",
    "decided_by": "alice",
    "reason": null
  }
}
```

`state` is `COMPLETED` on approval, `FAILED` on rejection — the orchestrator's
`on_failure` handler then triggers `cancel-order` as per the YAML definition.

---

## Socket.IO events emitted

| Event | Payload | When |
|-------|---------|------|
| `human_task:created` | Full task row | New task inserted |
| `human_task:resolved` | `{ id, status, decided_by, reject_reason, workflow_execution_id }` | Approve/reject called |
