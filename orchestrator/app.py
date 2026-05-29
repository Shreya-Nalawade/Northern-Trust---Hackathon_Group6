from fastapi import FastAPI, BackgroundTasks, HTTPException
from pydantic import BaseModel
from typing import Dict, Any
import uuid
import yaml
from pathlib import Path

from orchestrator.dag_runner import DAGRunner
from orchestrator.db import SessionLocal
from sqlalchemy import text

WORKFLOWS_DIR = Path(__file__).resolve().parent.parent / "workflows"

app = FastAPI(title="Workflow Orchestrator Service")

active_runs: Dict[str, DAGRunner] = {}


class RunRequest(BaseModel):
    workflow_definition: Dict[str, Any]


@app.get("/")
async def root():

    return {
        "service": "Workflow Orchestrator",
        "status": "online",
        "documentation": "/docs"
    }


@app.get("/templates")
async def list_templates():

    templates = [
        f.stem
        for f in WORKFLOWS_DIR.glob("*.yaml")
    ]

    return {
        "templates": templates
    }


@app.post("/runs")
async def start_run(
    req: RunRequest,
    background_tasks: BackgroundTasks
):

    run_id = str(uuid.uuid4())

    runner = DAGRunner(
        run_id,
        req.workflow_definition
    )

    active_runs[run_id] = runner

    background_tasks.add_task(
        runner.run
    )

    return {
        "run_id": run_id,
        "status": "STARTED"
    }


@app.post("/runs/from-template/{template_name}")
async def start_from_template(
    template_name: str,
    background_tasks: BackgroundTasks
):

    yaml_path = WORKFLOWS_DIR / f"{template_name}.yaml"

    if not yaml_path.exists():

        raise HTTPException(
            status_code=404,
            detail=f"Template '{template_name}' not found"
        )

    with open(yaml_path, "r") as f:

        definition = yaml.safe_load(f)

    run_id = str(uuid.uuid4())

    runner = DAGRunner(
        run_id,
        definition
    )

    active_runs[run_id] = runner

    background_tasks.add_task(
        runner.run
    )

    return {
        "run_id": run_id,
        "template": template_name,
        "status": "STARTED"
    }


@app.get("/runs/{run_id}")
async def get_run_status(run_id: str):

    runner = active_runs.get(run_id)

    if not runner:

        raise HTTPException(
            status_code=404,
            detail="Run not found"
        )

    return {
        "run_id": run_id,
        "status": runner.status.value,
        "tasks": {
            name: status.value
            for name, status in runner.task_states.items()
        }
    }


@app.post("/runs/{run_id}/pause")
async def pause_run(run_id: str):

    runner = active_runs.get(run_id)

    if not runner:

        raise HTTPException(status_code=404)

    runner.pause()

    return {
        "message": "Paused"
    }


@app.post("/runs/{run_id}/resume")
async def resume_run(run_id: str):

    runner = active_runs.get(run_id)

    if not runner:

        raise HTTPException(status_code=404)

    runner.resume()

    return {
        "message": "Resumed"
    }


@app.get("/runs/{run_id}/events")
async def get_events(run_id: str):

    db = None

    try:

        db = SessionLocal()

        query = text("""
            SELECT
                event_type,
                message,
                created_at
            FROM workflow_events
            WHERE workflow_execution_id::text = :run_id
            ORDER BY created_at
        """)

        result = db.execute(
            query,
            {
                "run_id": run_id
            }
        )

        events = []

        for row in result:

            events.append({
                "event_type": row[0],
                "message": row[1],
                "created_at": str(row[2])
            })

        return {
            "run_id": run_id,
            "events": events
        }

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

    finally:

        if db:
            db.close()