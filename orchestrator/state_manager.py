from sqlalchemy import text
from orchestrator.db import SessionLocal
from datetime import datetime
import uuid


class StateManager:

    @staticmethod
    def create_workflow_run(run_id: str, workflow_name: str):

        try:

            db = SessionLocal()

            db.execute(
                text("""
                    INSERT INTO workflow_executions (
                        id,
                        workflow_state,
                        started_at
                    )
                    VALUES (
                        :id,
                        'RUNNING',
                        :started_at
                    )
                """),
                {
                    "id": run_id,
                    "started_at": datetime.utcnow()
                }
            )

            db.commit()
            db.close()

        except Exception as e:

            print("WORKFLOW INSERT ERROR:", str(e))

    @staticmethod
    def create_task(run_id: str, task_name: str):

        try:

            db = SessionLocal()

            db.execute(
                text("""
                    INSERT INTO task_executions (
                        id,
                        workflow_execution_id,
                        task_id,
                        task_name,
                        task_state
                    )
                    VALUES (
                        :id,
                        :workflow_execution_id,
                        :task_id,
                        :task_name,
                        'PENDING'
                    )
                """),
                {
                    "id": str(uuid.uuid4()),
                    "workflow_execution_id": run_id,
                    "task_id": task_name,
                    "task_name": task_name
                }
            )

            db.commit()
            db.close()

        except Exception as e:

            print("TASK INSERT ERROR:", str(e))

    @staticmethod
    def update_task_status(
        run_id: str,
        task_name: str,
        status: str,
        error_message=None
    ):

        db = SessionLocal()

        db.execute(
            text("""
                UPDATE task_executions
                SET
                    task_state = :status,
                    error_message = :error_message
                WHERE workflow_execution_id = :run_id
                AND task_name = :task_name
            """),
            {
                "status": status,
                "error_message": error_message,
                "run_id": run_id,
                "task_name": task_name
            }
        )

        db.commit()
        db.close()
    @staticmethod
    def update_workflow_status(
        run_id: str,
        status: str,
        error_message=None
    ):

        try:

            db = SessionLocal()

            db.execute(
                text("""
                    UPDATE workflow_executions
                    SET
                        workflow_state = :status,
                        error_message = :error_message
                    WHERE id = :run_id
                """),
                {
                    "status": status,
                    "error_message": error_message,
                    "run_id": run_id
                }
            )

            db.commit()
            db.close()

        except Exception as e:

            print("WORKFLOW STATUS UPDATE ERROR:", str(e))
    @staticmethod
    def log_event(
        run_id: str,
        event_type: str,
        message: str
    ):

        try:

            db = SessionLocal()

            db.execute(
                text("""
                    INSERT INTO workflow_events (
                        workflow_execution_id,
                        event_type,
                        message
                    )
                    VALUES (
                        :workflow_execution_id,
                        :event_type,
                        :message
                    )
                """),
                {
                    "workflow_execution_id": run_id,
                    "event_type": event_type,
                    "message": message
                }
            )

            db.commit()
            db.close()

        except Exception as e:

            print("EVENT INSERT ERROR:", str(e))