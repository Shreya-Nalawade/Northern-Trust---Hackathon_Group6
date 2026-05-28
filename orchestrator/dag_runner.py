import asyncio
import logging
from datetime import datetime
from enum import Enum
from typing import Dict, List, Any

from engine import DAG
from task_executor import execute_task_remote, execute_task_mock

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class WorkflowStatus(Enum):
    CREATED = "CREATED"
    RUNNING = "RUNNING"
    PAUSED = "PAUSED"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"

class TaskStatus(Enum):
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    SUCCESS = "SUCCESS"
    FAILED = "FAILED"

class DAGRunner:
    """
    Main orchestration engine.
    Responsible for driving the workflow execution based on DAG dependencies.
    """
    def __init__(self, run_id: str, definition: dict):
        self.run_id = run_id
        self.dag = DAG(definition)
        self.task_states: Dict[str, TaskStatus] = {}
        self.status = WorkflowStatus.CREATED
        self.stop_event = asyncio.Event()

    async def run(self):
        """Starts the main execution loop."""
        logger.info(f"Starting workflow run {self.run_id}")
        self.status = WorkflowStatus.RUNNING
        
        while not self.stop_event.is_set():
            # Handle Pause Logic
            if self.status == WorkflowStatus.PAUSED:
                await asyncio.sleep(1)
                continue

            ready_tasks = self._get_ready_tasks()
            
            if not ready_tasks:
                if self._is_complete():
                    logger.info(f"Workflow {self.run_id} completed successfully.")
                    self.status = WorkflowStatus.COMPLETED
                    break
                elif self._has_running():
                    await asyncio.sleep(0.5)
                else:
                    if self._has_failed():
                        logger.error(f"Workflow {self.run_id} failed.")
                        self.status = WorkflowStatus.FAILED
                    else:
                        logger.warning(f"Workflow {self.run_id} is stuck.")
                    break
            else:
                for task_name in ready_tasks:
                    self.task_states[task_name] = TaskStatus.RUNNING
                    asyncio.create_task(self._execute_node(task_name))
                
                await asyncio.sleep(0.1)

    def _get_ready_tasks(self) -> List[str]:
        ready = []
        for task_name in self.dag.tasks:
            # Skip if already processed
            if task_name in self.task_states:
                if self.task_states[task_name] in (TaskStatus.SUCCESS, TaskStatus.RUNNING, TaskStatus.FAILED):
                    continue
            
            # Check dependencies
            deps = self.dag.tasks[task_name].get("depends_on", [])
            if all(self.task_states.get(d) == TaskStatus.SUCCESS for d in deps):
                ready.append(task_name)
        return ready

    def _is_complete(self) -> bool:
        return all(self.task_states.get(t) == TaskStatus.SUCCESS for t in self.dag.tasks)

    def _has_running(self) -> bool:
        return any(s == TaskStatus.RUNNING for s in self.task_states.values())

    def _has_failed(self) -> bool:
        return any(s == TaskStatus.FAILED for s in self.task_states.values())

    async def _execute_node(self, task_name: str):
        task_def = self.dag.tasks[task_name]
        service = task_def.get("service", task_def.get("type", "unknown"))
        
        logger.info(f"Executing task: {task_name} via {service}")
        
        # In a real microservices env, we call the remote service
        # For now, we provide both remote and mock options
        try:
            # result = await execute_task_remote(service, task_name, task_def.get("payload", {}))
            result = await execute_task_mock(service, task_name)
            
            if result["status"] == "SUCCESS":
                self.task_states[task_name] = TaskStatus.SUCCESS
                logger.info(f"Task {task_name} succeeded.")
            else:
                self.task_states[task_name] = TaskStatus.FAILED
                logger.error(f"Task {task_name} failed: {result.get('error')}")
        except Exception as e:
            self.task_states[task_name] = TaskStatus.FAILED
            logger.error(f"Critical error executing {task_name}: {str(e)}")

    def pause(self):
        self.status = WorkflowStatus.PAUSED
        logger.info(f"Workflow {self.run_id} paused.")

    def resume(self):
        self.status = WorkflowStatus.RUNNING
        logger.info(f"Workflow {self.run_id} resumed.")

    def stop(self):
        self.stop_event.set()
        logger.info(f"Workflow {self.run_id} stopped.")

async def main():
    import yaml
    from pathlib import Path

    # Load workflow from YAML file
    workflows_dir = Path(__file__).resolve().parent.parent / "workflows"
    yaml_path = workflows_dir / "order_workflow.yaml"

    if not yaml_path.exists():
        print(f"Workflow file not found: {yaml_path}")
        return

    with open(yaml_path, "r") as f:
        definition = yaml.safe_load(f)

    print(f"Loaded workflow: {definition['name']}")
    print(f"Tasks: {list(definition['tasks'].keys())}")
    print("---")

    runner = DAGRunner(run_id="run_001", definition=definition)
    await runner.run()

if __name__ == "__main__":
    asyncio.run(main())
