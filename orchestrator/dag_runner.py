import asyncio
import logging
from enum import Enum
from typing import Dict, List

from orchestrator.engine import DAG
from orchestrator.task_executor import execute_task_mock
from orchestrator.state_manager import StateManager

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
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class DAGRunner:
    """
    Main orchestration engine.
    Responsible for driving workflow execution
    based on DAG dependencies.
    """

    def __init__(self, run_id: str, definition: dict):
        self.run_id = run_id
        self.dag = DAG(definition)
        self.task_states: Dict[str, TaskStatus] = {}
        self.status = WorkflowStatus.CREATED
        self.stop_event = asyncio.Event()

    async def run(self):
        """Starts the workflow execution loop."""

        logger.info(f"Starting workflow run {self.run_id}")

        self.status = WorkflowStatus.RUNNING

        StateManager.create_workflow_run(
            self.run_id,
            self.dag.name
        )

        StateManager.log_event(
            self.run_id,
            "WORKFLOW_STARTED",
            f"Workflow {self.dag.name} started"
        )

        while not self.stop_event.is_set():

            # Pause logic
            if self.status == WorkflowStatus.PAUSED:
                await asyncio.sleep(1)
                continue

            ready_tasks = self._get_ready_tasks()

            if not ready_tasks:

                if self._is_complete():

                    logger.info(
                        f"Workflow {self.run_id} completed successfully."
                    )

                    self.status = WorkflowStatus.COMPLETED

                    StateManager.update_workflow_status(
                        self.run_id,
                        "COMPLETED"
                    )

                    StateManager.log_event(
                        self.run_id,
                        "WORKFLOW_COMPLETED",
                        f"Workflow {self.run_id} completed successfully"
                    )

                    break

                elif self._has_running():
                    await asyncio.sleep(0.5)

                else:

                    if self._has_failed():

                        logger.error(
                            f"Workflow {self.run_id} failed."
                        )

                        self.status = WorkflowStatus.FAILED

                        StateManager.update_workflow_status(
                            self.run_id,
                            "FAILED"
                        )

                        StateManager.log_event(
                            self.run_id,
                            "WORKFLOW_FAILED",
                            f"Workflow {self.run_id} failed"
                        )

                    else:
                        logger.warning(
                            f"Workflow {self.run_id} is stuck."
                        )

                    break

            else:

                for task_name in ready_tasks:

                    self.task_states[task_name] = TaskStatus.RUNNING

                    StateManager.create_task(
                        self.run_id,
                        task_name
                    )

                    StateManager.update_task_status(
                        self.run_id,
                        task_name,
                        "IN_PROGRESS"
                    )

                    StateManager.log_event(
                        self.run_id,
                        "TASK_STARTED",
                        f"{task_name} started"
                    )

                    asyncio.create_task(
                        self._execute_node(task_name)
                    )

                await asyncio.sleep(0.1)

    def _get_ready_tasks(self) -> List[str]:

        ready = []

        for task_name in self.dag.tasks:

            # Skip processed tasks
            if task_name in self.task_states:

                if self.task_states[task_name] in (
                    TaskStatus.COMPLETED,
                    TaskStatus.RUNNING,
                    TaskStatus.FAILED
                ):
                    continue

            # Check dependencies
            deps = self.dag.tasks[task_name].get(
                "depends_on",
                []
            )

            if all(
                self.task_states.get(dep) == TaskStatus.COMPLETED
                for dep in deps
            ):
                ready.append(task_name)

        return ready

    def _is_complete(self) -> bool:

        return all(
            self.task_states.get(task) == TaskStatus.COMPLETED
            for task in self.dag.tasks
        )

    def _has_running(self) -> bool:

        return any(
            state == TaskStatus.RUNNING
            for state in self.task_states.values()
        )

    def _has_failed(self) -> bool:

        return any(
            state == TaskStatus.FAILED
            for state in self.task_states.values()
        )

    async def _execute_node(self, task_name: str):

        task_def = self.dag.tasks[task_name]

        service = task_def.get(
            "service",
            task_def.get("type", "unknown")
        )

        logger.info(
            f"Executing task: {task_name} via {service}"
        )

        try:

            result = await execute_task_mock(
                service,
                task_name
            )

            if result["status"] == "SUCCESS":

                self.task_states[task_name] = TaskStatus.COMPLETED

                StateManager.update_task_status(
                    self.run_id,
                    task_name,
                    "COMPLETED"
                )

                StateManager.log_event(
                    self.run_id,
                    "TASK_COMPLETED",
                    f"{task_name} completed successfully"
                )

                logger.info(
                    f"Task {task_name} succeeded."
                )

            else:

                self.task_states[task_name] = TaskStatus.FAILED

                StateManager.update_task_status(
                    self.run_id,
                    task_name,
                    "FAILED",
                    result.get("error")
                )

                StateManager.log_event(
                    self.run_id,
                    "TASK_FAILED",
                    f"{task_name} failed"
                )

                logger.error(
                    f"Task {task_name} failed: {result.get('error')}"
                )

        except Exception as e:

            self.task_states[task_name] = TaskStatus.FAILED

            StateManager.update_task_status(
                self.run_id,
                task_name,
                "FAILED",
                str(e)
            )

            StateManager.log_event(
                self.run_id,
                "TASK_FAILED",
                f"{task_name} crashed with exception"
            )

            logger.error(
                f"Critical error executing {task_name}: {str(e)}"
            )

    def pause(self):

        self.status = WorkflowStatus.PAUSED

        StateManager.update_workflow_status(
            self.run_id,
            "PAUSED"
        )

        StateManager.log_event(
            self.run_id,
            "WORKFLOW_PAUSED",
            f"Workflow {self.run_id} paused"
        )

        logger.info(
            f"Workflow {self.run_id} paused."
        )

    def resume(self):

        self.status = WorkflowStatus.RUNNING

        StateManager.update_workflow_status(
            self.run_id,
            "RUNNING"
        )

        StateManager.log_event(
            self.run_id,
            "WORKFLOW_RESUMED",
            f"Workflow {self.run_id} resumed"
        )

        logger.info(
            f"Workflow {self.run_id} resumed."
        )

    def stop(self):

        self.stop_event.set()

        StateManager.update_workflow_status(
            self.run_id,
            "FAILED"
        )

        StateManager.log_event(
            self.run_id,
            "WORKFLOW_STOPPED",
            f"Workflow {self.run_id} stopped"
        )

        logger.info(
            f"Workflow {self.run_id} stopped."
        )


async def main():

    import yaml
    from pathlib import Path

    workflows_dir = (
        Path(__file__).resolve().parent.parent / "workflows"
    )

    yaml_path = workflows_dir / "order_workflow.yaml"

    if not yaml_path.exists():
        print(f"Workflow file not found: {yaml_path}")
        return

    with open(yaml_path, "r") as f:
        definition = yaml.safe_load(f)

    print(f"Loaded workflow: {definition['name']}")
    print(f"Tasks: {list(definition['tasks'].keys())}")
    print("---")

    runner = DAGRunner(
        run_id="run_001",
        definition=definition
    )

    await runner.run()


if __name__ == "__main__":
    asyncio.run(main())