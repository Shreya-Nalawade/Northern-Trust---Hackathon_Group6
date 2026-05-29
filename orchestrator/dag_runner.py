import asyncio
import logging
import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Dict, List, Any, Optional, Callable
import json

from orchestrator.engine import DAG
from orchestrator.task_executor import execute_task
from orchestrator.state_manager import StateManager

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def _fire_db(func, *args):
    """Run synchronous DB functions in a threadpool so they don't block the async event loop."""
    try:
        loop = asyncio.get_running_loop()
        loop.run_in_executor(None, func, *args)
    except Exception as e:
        logger.error(f"Failed to queue DB operation: {e}")


class WorkflowStatus(str, Enum):
    CREATED = "CREATED"
    RUNNING = "RUNNING"
    PAUSED = "PAUSED"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"


class TaskState(str, Enum):
    PENDING = "PENDING"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    SKIPPED = "SKIPPED"
    WAITING_HUMAN = "WAITING_HUMAN"
    CANCELLED = "CANCELLED"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _make_task_id() -> str:
    return f"task-{uuid.uuid4().hex[:8]}"


class TaskExecution:
    """Rich task state object that matches the frontend's expected shape."""

    def __init__(self, task_name: str, task_def: dict):
        self.id: str = _make_task_id()
        self.task_id: str = task_name
        self.type: str = task_def.get("type", "http")
        self.service: Optional[str] = task_def.get("service")
        self.state: TaskState = TaskState.PENDING
        self.depends_on: List[str] = task_def.get("depends_on", [])
        self.condition: Optional[str] = task_def.get("condition")
        self.trigger: Optional[str] = task_def.get("trigger")
        self.assignee: Optional[str] = task_def.get("assignee")
        self.input_payload: Optional[dict] = None
        self.result_payload: Optional[dict] = None
        self.error: Optional[str] = None
        self.attempt_number: int = 0
        self.dispatched_at: Optional[str] = None
        self.completed_at: Optional[str] = None
        self.attempts: List[dict] = []

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "task_id": self.task_id,
            "type": self.type,
            "service": self.service,
            "state": self.state.value,
            "depends_on": self.depends_on,
            "condition": self.condition,
            "trigger": self.trigger,
            "input_payload": self.input_payload,
            "result_payload": self.result_payload,
            "error": self.error,
            "attempt_number": self.attempt_number,
            "dispatched_at": self.dispatched_at,
            "completed_at": self.completed_at,
            "attempts": self.attempts,
        }


class HumanTask:
    """Represents a human-in-the-loop approval task."""

    def __init__(self, task_exec: TaskExecution, workflow_id: str, workflow_name: str, input_payload: dict):
        self.id: str = f"ht-{uuid.uuid4().hex[:8]}"
        self.task_execution_id: str = task_exec.id
        self.workflow_execution_id: str = workflow_id
        self.workflow_name: str = workflow_name
        self.task_id: str = task_exec.task_id
        self.assignee: str = task_exec.assignee or "ops-team"
        self.status: str = "PENDING"
        self.order_value: Optional[float] = input_payload.get("total_value")
        self.order_id: Optional[str] = input_payload.get("order_id")
        self.created_at: str = _now()

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "task_execution_id": self.task_execution_id,
            "workflow_execution_id": self.workflow_execution_id,
            "workflow_name": self.workflow_name,
            "task_id": self.task_id,
            "assignee": self.assignee,
            "status": self.status,
            "order_value": self.order_value,
            "order_id": self.order_id,
            "created_at": self.created_at,
        }


class DAGRunner:
    """
    Main orchestration engine.
    Drives workflow execution based on DAG dependencies.
    Tracks rich task state, events, human tasks, and supports pause/resume/terminate/retry.
    """

    def __init__(
        self,
        run_id: str,
        definition: dict,
        input_payload: Optional[dict] = None,
        on_update: Optional[Callable] = None,
    ):
        self.run_id = run_id
        self.dag = DAG(definition)
        self.workflow_name = definition.get("name", "unknown")
        self.status = WorkflowStatus.CREATED
        self.input_payload: dict = input_payload or {}
        self.started_at: Optional[str] = None
        self.completed_at: Optional[str] = None
        self.stop_event = asyncio.Event()

        # Neon DB Integration: Create Workflow Run record (in background thread)
        _fire_db(StateManager.create_workflow_run, self.run_id, self.workflow_name)

        # Rich task tracking
        self.task_executions: Dict[str, TaskExecution] = {}
        for task_name, task_def in self.dag.tasks.items():
            # Neon DB Integration: Create Task record
            _fire_db(StateManager.create_task, self.run_id, task_name)
            
            te = TaskExecution(task_name, task_def)
            te.input_payload = self._build_task_input(task_name)
            self.task_executions[task_name] = te

        # Event log
        self.events: List[dict] = []

        # Human tasks
        self.human_tasks: Dict[str, HumanTask] = {}

        # Callback for real-time updates (Socket.IO)
        self._on_update = on_update

    def _build_task_input(self, task_name: str) -> Optional[dict]:
        """Build task-specific input from workflow input."""
        ip = self.input_payload
        task_inputs = {
            "validate-order": {"order_id": ip.get("order_id")},
            "process-payment": {"order_id": ip.get("order_id"), "amount": ip.get("total_value")},
            "check-inventory": {"items": ip.get("items", [])},
            "reserve-stock": {"items": ip.get("items", []), "order_id": ip.get("order_id")},
            "ship-order": {"order_id": ip.get("order_id")},
            "send-confirmation": {"order_id": ip.get("order_id"), "customer_id": ip.get("customer_id")},
            "cancel-order": {"order_id": ip.get("order_id")},
        }
        return task_inputs.get(task_name, {"order_id": ip.get("order_id")})

    def _emit_event(self, event_type: str, payload: Optional[dict] = None):
        event = {
            "id": f"evt-{uuid.uuid4().hex[:8]}",
            "event_type": event_type,
            "payload": payload or {},
            "created_at": _now(),
        }
        self.events.append(event)
        
        # Neon DB Integration: Log event
        message_str = json.dumps(payload) if payload else ""
        _fire_db(StateManager.log_event, self.run_id, event_type, message_str)
        
        logger.info(f"[{self.run_id}] Event: {event_type} {payload or ''}")

    def _notify_update(self):
        """Send a state patch via the callback (for Socket.IO)."""
        if self._on_update:
            try:
                self._on_update(self.run_id, self.to_summary())
            except Exception as e:
                logger.warning(f"Update callback error: {e}")

    def _update_task_state(self, task_name: str, state: TaskState, error: str = None):
        """Helper to update state in memory and Neon DB"""
        te = self.task_executions[task_name]
        te.state = state
        if error:
            te.error = error
            
        # Neon DB Integration: Update Task Status
        _fire_db(StateManager.update_task_status, self.run_id, task_name, state.value, error)

    def _update_workflow_state(self, state: WorkflowStatus, error: str = None):
        """Helper to update state in memory and Neon DB"""
        self.status = state
        # Neon DB Integration: Update Workflow Status
        _fire_db(StateManager.update_workflow_status, self.run_id, state.value, error)

    def _check_condition(self, task_exec: TaskExecution) -> bool:
        """Evaluate a task's condition against the workflow input."""
        condition = task_exec.condition
        if not condition:
            return True
        try:
            # Simple evaluation: "total_value > 500"
            local_vars = {**self.input_payload}
            return bool(eval(condition, {"__builtins__": {}}, local_vars))
        except Exception as e:
            logger.warning(f"Condition eval failed for {task_exec.task_id}: {e}")
            return True  # default to running

    async def run(self):
        """Starts the main execution loop."""
        logger.info(f"Starting workflow run {self.run_id}")
        self._update_workflow_state(WorkflowStatus.RUNNING)
        self.started_at = _now()
        self._emit_event("WORKFLOW_STARTED", {
            "workflow": self.workflow_name,
            "order_id": self.input_payload.get("order_id"),
        })
        self._notify_update()

        while not self.stop_event.is_set():
            # Handle Pause Logic
            if self.status == WorkflowStatus.PAUSED:
                await asyncio.sleep(1)
                continue

            ready_tasks = self._get_ready_tasks()

            if not ready_tasks:
                if self._is_complete():
                    logger.info(f"Workflow {self.run_id} completed successfully.")
                    self._update_workflow_state(WorkflowStatus.COMPLETED)
                    self.completed_at = _now()
                    self._emit_event("WORKFLOW_COMPLETED", {"workflow": self.workflow_name})
                    self._notify_update()
                    break
                elif self._has_running() or self._has_waiting_human():
                    await asyncio.sleep(0.5)
                else:
                    if self._has_failed():
                        logger.error(f"Workflow {self.run_id} failed.")
                        self._update_workflow_state(WorkflowStatus.FAILED, "A task failed")
                        self.completed_at = _now()
                        self._emit_event("WORKFLOW_FAILED", {"workflow": self.workflow_name})
                    else:
                        logger.warning(f"Workflow {self.run_id} is stuck.")
                        self._update_workflow_state(WorkflowStatus.FAILED, "Workflow is stuck")
                        self.completed_at = _now()
                    self._notify_update()
                    break
            else:
                for task_name in ready_tasks:
                    asyncio.create_task(self._execute_node(task_name))

                await asyncio.sleep(0.1)

    def _get_ready_tasks(self) -> List[str]:
        ready = []
        for task_name, te in self.task_executions.items():
            # Skip if already processed or is a failure-trigger task
            if te.state not in (TaskState.PENDING,):
                continue
            if te.trigger and te.trigger.startswith("on_failure_of:"):
                continue

            # Check dependencies
            deps = te.depends_on
            if all(
                self.task_executions[d].state in (TaskState.COMPLETED, TaskState.SKIPPED)
                for d in deps
                if d in self.task_executions
            ):
                ready.append(task_name)
        return ready

    def _is_complete(self) -> bool:
        for name, te in self.task_executions.items():
            if te.trigger and te.trigger.startswith("on_failure_of:"):
                continue
            if te.state not in (TaskState.COMPLETED, TaskState.SKIPPED, TaskState.CANCELLED):
                return False
        return True

    def _has_running(self) -> bool:
        return any(te.state == TaskState.IN_PROGRESS for te in self.task_executions.values())

    def _has_waiting_human(self) -> bool:
        return any(te.state == TaskState.WAITING_HUMAN for te in self.task_executions.values())

    def _has_failed(self) -> bool:
        return any(te.state == TaskState.FAILED for te in self.task_executions.values())

    async def _execute_node(self, task_name: str):
        te = self.task_executions[task_name]
        task_def = self.dag.get_task_def(task_name)

        # Check condition — skip if not met
        if not self._check_condition(te):
            self._update_task_state(task_name, TaskState.SKIPPED)
            te.completed_at = _now()
            self._emit_event("TASK_SKIPPED", {
                "task_id": task_name,
                "reason": f"Condition not met: {te.condition}",
            })
            self._notify_update()
            return

        # Human task — pause and wait for approval
        if te.type == "human":
            self._update_task_state(task_name, TaskState.WAITING_HUMAN)
            te.dispatched_at = _now()
            ht = HumanTask(te, self.run_id, self.workflow_name, self.input_payload)
            self.human_tasks[ht.id] = ht
            self._emit_event("HUMAN_TASK_CREATED", {
                "task_id": task_name,
                "human_task_id": ht.id,
                "assignee": ht.assignee,
            })
            self._notify_update()
            return

        # HTTP task — execute
        self._update_task_state(task_name, TaskState.IN_PROGRESS)
        te.dispatched_at = _now()
        te.attempt_number += 1

        attempt = {
            "number": te.attempt_number,
            "state": "IN_PROGRESS",
            "started_at": _now(),
        }
        te.attempts.append(attempt)

        self._emit_event("TASK_STARTED", {"task_id": task_name})
        self._notify_update()

        service = te.service or te.type
        logger.info(f"Executing task: {task_name} via {service}")

        try:
            result = await execute_task(service, task_name, te.input_payload)

            if result.get("status") == "SUCCESS":
                self._update_task_state(task_name, TaskState.COMPLETED)
                te.result_payload = result.get("result", result)
                te.completed_at = _now()
                attempt["state"] = "COMPLETED"
                attempt["completed_at"] = _now()
                self._emit_event("TASK_COMPLETED", {
                    "task_id": task_name,
                    **(te.result_payload if isinstance(te.result_payload, dict) else {}),
                })
                logger.info(f"Task {task_name} succeeded.")
            else:
                error_msg = result.get("error", "Unknown error")
                self._update_task_state(task_name, TaskState.FAILED, error_msg)
                te.result_payload = {"error": error_msg}
                te.completed_at = _now()
                attempt["state"] = "FAILED"
                attempt["completed_at"] = _now()
                attempt["error"] = error_msg
                self._emit_event("TASK_FAILED", {"task_id": task_name, "error": error_msg})
                logger.error(f"Task {task_name} failed: {error_msg}")

                # Fire failure-triggered tasks
                await self._handle_failure_triggers(task_name)

        except Exception as e:
            error_msg = str(e)
            self._update_task_state(task_name, TaskState.FAILED, error_msg)
            te.completed_at = _now()
            attempt["state"] = "FAILED"
            attempt["completed_at"] = _now()
            attempt["error"] = error_msg
            self._emit_event("TASK_FAILED", {"task_id": task_name, "error": error_msg})
            logger.error(f"Critical error executing {task_name}: {error_msg}")

            await self._handle_failure_triggers(task_name)

        self._notify_update()

    async def _handle_failure_triggers(self, failed_task: str):
        """Fire any tasks that have on_failure_of trigger for the failed task."""
        trigger_tasks = self.dag.get_failure_trigger_tasks(failed_task)
        for trigger_name in trigger_tasks:
            te = self.task_executions.get(trigger_name)
            if te and te.state == TaskState.PENDING:
                asyncio.create_task(self._execute_node(trigger_name))

        # Cancel downstream tasks that can no longer proceed
        self._cancel_downstream(failed_task)

    def _cancel_downstream(self, failed_task: str):
        """Cancel all tasks that transitively depend on the failed task."""
        visited = set()
        queue = list(self.dag.get_downstream_tasks(failed_task))
        while queue:
            name = queue.pop(0)
            if name in visited:
                continue
            visited.add(name)
            te = self.task_executions.get(name)
            if te and te.state == TaskState.PENDING:
                self._update_task_state(name, TaskState.CANCELLED)
                te.completed_at = _now()
                queue.extend(self.dag.get_downstream_tasks(name))

    # ─── Control Methods ────────────────────────────────────────────

    def pause(self):
        if self.status == WorkflowStatus.RUNNING:
            self._update_workflow_state(WorkflowStatus.PAUSED)
            self._emit_event("WORKFLOW_PAUSED", {"workflow": self.workflow_name})
            self._notify_update()
            logger.info(f"Workflow {self.run_id} paused.")

    def resume(self):
        if self.status == WorkflowStatus.PAUSED:
            self._update_workflow_state(WorkflowStatus.RUNNING)
            self._emit_event("WORKFLOW_RESUMED", {"workflow": self.workflow_name})
            self._notify_update()
            logger.info(f"Workflow {self.run_id} resumed.")

    def terminate(self):
        """Stop the workflow and cancel all pending tasks."""
        self.stop_event.set()
        self._update_workflow_state(WorkflowStatus.CANCELLED)
        self.completed_at = _now()
        for te in self.task_executions.values():
            if te.state in (TaskState.PENDING, TaskState.WAITING_HUMAN):
                self._update_task_state(te.task_id, TaskState.CANCELLED)
                te.completed_at = _now()
        # Remove pending human tasks
        for ht_id, ht in list(self.human_tasks.items()):
            if ht.status == "PENDING":
                ht.status = "CANCELLED"
        self._emit_event("WORKFLOW_CANCELLED", {"workflow": self.workflow_name})
        self._notify_update()
        logger.info(f"Workflow {self.run_id} terminated.")

    def stop(self):
        self.terminate()

    async def retry_task(self, task_execution_id: str) -> bool:
        """Retry a failed task by its execution id."""
        te = None
        for t in self.task_executions.values():
            if t.id == task_execution_id:
                te = t
                break
        if not te or te.state != TaskState.FAILED:
            return False

        # Reset task state
        self._update_task_state(te.task_id, TaskState.PENDING)
        te.result_payload = None
        te.completed_at = None

        # Un-cancel downstream tasks
        self._uncancel_downstream(te.task_id)

        # If workflow was failed, set it back to running
        if self.status == WorkflowStatus.FAILED:
            self._update_workflow_state(WorkflowStatus.RUNNING)
            self.completed_at = None
            self.stop_event.clear()

        self._emit_event("TASK_RETRYING", {"task_id": te.task_id})
        self._notify_update()

        # Re-execute
        asyncio.create_task(self._execute_node(te.task_id))

        # Restart the main loop if it had stopped
        if self.status == WorkflowStatus.RUNNING:
            asyncio.create_task(self.run())

        return True

    def _uncancel_downstream(self, task_name: str):
        """Reset cancelled downstream tasks to pending."""
        queue = list(self.dag.get_downstream_tasks(task_name))
        visited = set()
        while queue:
            name = queue.pop(0)
            if name in visited:
                continue
            visited.add(name)
            te = self.task_executions.get(name)
            if te and te.state == TaskState.CANCELLED:
                self._update_task_state(name, TaskState.PENDING)
                te.completed_at = None
                queue.extend(self.dag.get_downstream_tasks(name))

    def resolve_human_task(self, human_task_id: str, approved: bool, decided_by: str = None, reason: str = None) -> bool:
        """Resolve a human task (approve/reject)."""
        ht = self.human_tasks.get(human_task_id)
        if not ht or ht.status != "PENDING":
            return False

        te = self.task_executions.get(ht.task_id)
        if not te:
            return False

        if approved:
            ht.status = "APPROVED"
            self._update_task_state(te.task_id, TaskState.COMPLETED)
            te.completed_at = _now()
            te.result_payload = {"approved": True, "decided_by": decided_by or "operator"}
            self._emit_event("HUMAN_TASK_APPROVED", {
                "task_id": te.task_id,
                "decided_by": decided_by or "operator",
            })
        else:
            ht.status = "REJECTED"
            self._update_task_state(te.task_id, TaskState.FAILED, reason or "Rejected by operator")
            te.completed_at = _now()
            te.result_payload = {"rejected": True, "reason": reason}
            self._emit_event("HUMAN_TASK_REJECTED", {
                "task_id": te.task_id,
                "reason": reason or "Rejected by operator",
            })
            self._cancel_downstream(te.task_id)

        self._notify_update()
        return True

    # ─── Serialization ──────────────────────────────────────────────

    def to_summary(self) -> dict:
        """Return the workflow list summary shape."""
        return {
            "id": self.run_id,
            "workflow_name": self.workflow_name,
            "state": self.status.value,
            "input_payload": self.input_payload,
            "started_at": self.started_at,
            "completed_at": self.completed_at,
        }

    def to_detail(self) -> dict:
        """Return the full workflow detail shape (with tasks)."""
        return {
            **self.to_summary(),
            "tasks": [te.to_dict() for te in self.task_executions.values()],
        }