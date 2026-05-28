import uuid
import yaml
import asyncio
import socketio
from pathlib import Path
from typing import Dict, Any, Optional, List
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from dag_runner import DAGRunner

# ─── Config ─────────────────────────────────────────────────────
WORKFLOWS_DIR = Path(__file__).resolve().parent.parent / "workflows"

# ─── Socket.IO ──────────────────────────────────────────────────
sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins="*",
    logger=False,
    engineio_logger=False,
)

# Track subscriptions: socket_id -> set of workflow_ids
subscriptions: Dict[str, set] = {}

@sio.event
async def connect(sid, environ):
    subscriptions[sid] = set()

@sio.event
async def disconnect(sid):
    subscriptions.pop(sid, None)

@sio.event
async def subscribe(sid, workflow_id):
    if sid in subscriptions:
        subscriptions[sid].add(workflow_id)

@sio.event
async def unsubscribe(sid, workflow_id):
    if sid in subscriptions:
        subscriptions[sid].discard(workflow_id)


def broadcast_update(run_id: str, data: dict):
    """Send a workflow:update event to all subscribers of this run."""
    for sid, subs in subscriptions.items():
        if run_id in subs:
            asyncio.create_task(sio.emit("workflow:update", data, to=sid))


# ─── FastAPI App ────────────────────────────────────────────────
app = FastAPI(title="Workflow Orchestrator Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Wrap with Socket.IO ASGI app
socket_app = socketio.ASGIApp(sio, app)

# ─── In-Memory State ───────────────────────────────────────────
active_runs: Dict[str, DAGRunner] = {}


# ─── Pydantic Models ───────────────────────────────────────────

class StartWorkflowRequest(BaseModel):
    workflow: str = "order-fulfillment"
    input: Dict[str, Any] = {}

class HumanTaskApproveRequest(BaseModel):
    decided_by: str = "operator"

class HumanTaskRejectRequest(BaseModel):
    reason: str = "Rejected by operator"


# ─── Health Check ───────────────────────────────────────────────

@app.get("/")
async def root():
    return {
        "service": "Workflow Orchestrator",
        "status": "online",
        "documentation": "/docs",
    }


# ─── Workflow Endpoints ─────────────────────────────────────────

@app.post("/api/v1/workflows/start")
async def start_workflow(req: StartWorkflowRequest):
    """Start a new workflow execution."""
    # Load workflow definition
    template_name = req.workflow.replace(" ", "-").lower()
    yaml_path = WORKFLOWS_DIR / f"{template_name}.yaml"

    # Try finding the YAML file, fall back to first available
    if not yaml_path.exists():
        yamls = list(WORKFLOWS_DIR.glob("*.yaml"))
        if not yamls:
            raise HTTPException(status_code=404, detail=f"No workflow templates found")
        yaml_path = yamls[0]

    with open(yaml_path, "r") as f:
        definition = yaml.safe_load(f)

    run_id = str(uuid.uuid4())
    runner = DAGRunner(
        run_id=run_id,
        definition=definition,
        input_payload=req.input,
        on_update=broadcast_update,
    )
    active_runs[run_id] = runner

    # Start in background
    asyncio.create_task(runner.run())

    return runner.to_summary()


@app.get("/api/v1/workflows")
async def list_workflows(
    state: Optional[str] = Query(None, description="Filter by workflow state"),
    limit: Optional[int] = Query(50, description="Max results to return"),
):
    """List all workflow executions with optional filtering."""
    executions = []
    for runner in active_runs.values():
        summary = runner.to_summary()
        if state and summary["state"] != state.upper():
            continue
        executions.append(summary)

    # Sort by started_at descending (newest first)
    executions.sort(key=lambda x: x.get("started_at") or "", reverse=True)

    if limit:
        executions = executions[:limit]

    return {
        "executions": executions,
        "total": len(executions),
    }


@app.get("/api/v1/workflows/{workflow_id}")
async def get_workflow(workflow_id: str):
    """Get full workflow detail including all task states."""
    runner = active_runs.get(workflow_id)
    if not runner:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return runner.to_detail()


@app.get("/api/v1/workflows/{workflow_id}/logs")
async def get_workflow_logs(workflow_id: str):
    """Get the event log for a workflow."""
    runner = active_runs.get(workflow_id)
    if not runner:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return {"events": runner.events}


@app.post("/api/v1/workflows/{workflow_id}/pause")
async def pause_workflow(workflow_id: str):
    """Pause a running workflow."""
    runner = active_runs.get(workflow_id)
    if not runner:
        raise HTTPException(status_code=404, detail="Workflow not found")
    runner.pause()
    return {"message": "Workflow paused"}


@app.post("/api/v1/workflows/{workflow_id}/resume")
async def resume_workflow(workflow_id: str):
    """Resume a paused workflow."""
    runner = active_runs.get(workflow_id)
    if not runner:
        raise HTTPException(status_code=404, detail="Workflow not found")
    runner.resume()
    return {"message": "Workflow resumed"}


@app.post("/api/v1/workflows/{workflow_id}/terminate")
async def terminate_workflow(workflow_id: str):
    """Terminate a workflow and cancel pending tasks."""
    runner = active_runs.get(workflow_id)
    if not runner:
        raise HTTPException(status_code=404, detail="Workflow not found")
    runner.terminate()
    return {"message": "Workflow terminated"}


# ─── Task Endpoints ─────────────────────────────────────────────

@app.post("/api/v1/tasks/{task_id}/retry")
async def retry_task(task_id: str):
    """Retry a failed task by its execution ID."""
    for runner in active_runs.values():
        for te in runner.task_executions.values():
            if te.id == task_id:
                success = await runner.retry_task(task_id)
                if success:
                    return {"message": f"Task {task_id} retried"}
                else:
                    raise HTTPException(status_code=400, detail="Task cannot be retried")
    raise HTTPException(status_code=404, detail="Task not found")


# ─── Human Task Endpoints ───────────────────────────────────────

@app.get("/api/v1/human-tasks")
async def list_human_tasks():
    """List all pending human tasks across all workflows."""
    tasks = []
    for runner in active_runs.values():
        for ht in runner.human_tasks.values():
            if ht.status == "PENDING":
                tasks.append(ht.to_dict())
    return tasks


@app.post("/api/v1/human-tasks/{human_task_id}/approve")
async def approve_human_task(human_task_id: str, req: HumanTaskApproveRequest):
    """Approve a human-in-the-loop task."""
    for runner in active_runs.values():
        if human_task_id in runner.human_tasks:
            success = runner.resolve_human_task(human_task_id, approved=True, decided_by=req.decided_by)
            if success:
                return {"message": "Task approved"}
            else:
                raise HTTPException(status_code=400, detail="Task cannot be approved")
    raise HTTPException(status_code=404, detail="Human task not found")


@app.post("/api/v1/human-tasks/{human_task_id}/reject")
async def reject_human_task(human_task_id: str, req: HumanTaskRejectRequest):
    """Reject a human-in-the-loop task."""
    for runner in active_runs.values():
        if human_task_id in runner.human_tasks:
            success = runner.resolve_human_task(human_task_id, approved=False, reason=req.reason)
            if success:
                return {"message": "Task rejected"}
            else:
                raise HTTPException(status_code=400, detail="Task cannot be rejected")
    raise HTTPException(status_code=404, detail="Human task not found")


# ─── Template Endpoints (bonus) ─────────────────────────────────

@app.get("/api/v1/templates")
async def list_templates():
    """List all available YAML workflow templates."""
    templates = [f.stem for f in WORKFLOWS_DIR.glob("*.yaml")]
    return {"templates": templates}
