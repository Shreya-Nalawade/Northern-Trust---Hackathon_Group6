from fastapi import FastAPI, BackgroundTasks, HTTPException
from pydantic import BaseModel
from typing import Dict, Any
import uuid
import yaml
from pathlib import Path

from dag_runner import DAGRunner

# Resolve the workflows directory (sibling to orchestrator/)
WORKFLOWS_DIR = Path(__file__).resolve().parent.parent / "workflows"

app = FastAPI(title="Workflow Orchestrator Service")

@app.get("/")
async def root():
    return {
        "service": "Workflow Orchestrator",
        "status": "online",
        "documentation": "/docs"
    }

# In-memory storage for active runners (in production, use Redis/DB state)
active_runs: Dict[str, DAGRunner] = {}

class RunRequest(BaseModel):
    workflow_definition: Dict[str, Any]

@app.post("/runs")
async def start_run(req: RunRequest, background_tasks: BackgroundTasks):
    run_id = str(uuid.uuid4())
    runner = DAGRunner(run_id, req.workflow_definition)
    active_runs[run_id] = runner
    
    # Start the runner in the background
    background_tasks.add_task(runner.run)
    
    return {"run_id": run_id, "status": "STARTED"}

@app.get("/templates")
async def list_templates():
    """List all available YAML workflow templates."""
    templates = [f.stem for f in WORKFLOWS_DIR.glob("*.yaml")]
    return {"templates": templates}

@app.post("/runs/from-template/{template_name}")
async def start_from_template(template_name: str, background_tasks: BackgroundTasks):
    """Load a workflow from a YAML file and start execution."""
    yaml_path = WORKFLOWS_DIR / f"{template_name}.yaml"
    if not yaml_path.exists():
        raise HTTPException(status_code=404, detail=f"Template '{template_name}' not found")
    
    with open(yaml_path, "r") as f:
        definition = yaml.safe_load(f)
    
    run_id = str(uuid.uuid4())
    runner = DAGRunner(run_id, definition)
    active_runs[run_id] = runner
    background_tasks.add_task(runner.run)
    
    return {"run_id": run_id, "template": template_name, "status": "STARTED"}

@app.get("/runs/{run_id}")
async def get_run_status(run_id: str):
    runner = active_runs.get(run_id)
    if not runner:
        raise HTTPException(status_code=404, detail="Run not found")
    
    return {
        "run_id": run_id,
        "status": runner.status.value,
        "tasks": {name: status.value for name, status in runner.task_states.items()}
    }

@app.post("/runs/{run_id}/pause")
async def pause_run(run_id: str):
    runner = active_runs.get(run_id)
    if runner:
        runner.pause()
        return {"message": "Paused"}
    raise HTTPException(status_code=404)

@app.post("/runs/{run_id}/resume")
async def resume_run(run_id: str):
    runner = active_runs.get(run_id)
    if runner:
        runner.resume()
        return {"message": "Resumed"}
    raise HTTPException(status_code=404)
