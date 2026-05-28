import os
import json
import psycopg2
from psycopg2.extras import RealDictCursor
import logging
import time
from dotenv import load_dotenv

from pathlib import Path
env_path = Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path=env_path)

DATABASE_URL = os.getenv("DATABASE_URL")
logger = logging.getLogger("OrchestratorDB")

_db_conn = None

class ConnectionProxy:
    def __init__(self, conn):
        self._conn = conn
    def __getattr__(self, name):
        return getattr(self._conn, name)
    def __enter__(self):
        return self._conn.__enter__()
    def __exit__(self, exc_type, exc_val, exc_tb):
        return self._conn.__exit__(exc_type, exc_val, exc_tb)
    def close(self):
        # Do not close the cached physical connection
        pass

def get_db_connection():
    global _db_conn
    if not DATABASE_URL:
        raise ValueError("DATABASE_URL environment variable is not set")
    
    # Check if connection is still alive
    if _db_conn is not None:
        try:
            with _db_conn.cursor() as cur:
                cur.execute("SELECT 1;")
            return ConnectionProxy(_db_conn)
        except Exception:
            try:
                _db_conn.close()
            except Exception:
                pass
            _db_conn = None
            
    # Connect with retry
    retries = 3
    delay = 0.5
    for attempt in range(retries):
        try:
            _db_conn = psycopg2.connect(DATABASE_URL)
            return ConnectionProxy(_db_conn)
        except psycopg2.OperationalError as e:
            if attempt == retries - 1:
                logger.error(f"Failed to connect to database after {retries} attempts: {e}")
                raise e
            logger.warning(f"Database connection attempt {attempt + 1} failed. Retrying in {delay}s... Error: {e}")
            time.sleep(delay)

def get_or_create_workflow_definition(name: str, definition_yaml: str) -> str:
    """Gets existing definition ID or inserts a new one."""
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM workflow_definitions WHERE name = %s LIMIT 1;", (name,))
            row = cur.fetchone()
            if row:
                return str(row[0])
            
            cur.execute(
                "INSERT INTO workflow_definitions (name, definition_yaml) VALUES (%s, %s) RETURNING id;",
                (name, definition_yaml)
            )
            new_id = cur.fetchone()[0]
            conn.commit()
            return str(new_id)
    except Exception as e:
        conn.rollback()
        logger.error(f"Error in get_or_create_workflow_definition: {e}")
        raise e
    finally:
        conn.close()

def save_workflow_execution(run_id: str, definition_id: str, state: str, order_id: str, customer_id: str, input_payload: dict):
    conn = get_db_connection()
    try:
        db_state = 'RUNNING' if state == 'CREATED' else state
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO workflow_executions (id, workflow_definition_id, workflow_state, order_id, customer_id, input_payload, started_at)
                VALUES (%s, %s, %s, %s, %s, %s, NOW())
                ON CONFLICT (id) DO UPDATE SET
                    workflow_state = EXCLUDED.workflow_state,
                    completed_at = CASE WHEN EXCLUDED.workflow_state IN ('COMPLETED', 'FAILED', 'CANCELLED') THEN NOW() ELSE workflow_executions.completed_at END,
                    error_message = EXCLUDED.error_message;
                """,
                (run_id, definition_id, db_state, order_id, customer_id, json.dumps(input_payload))
            )
            conn.commit()
    except Exception as e:
        conn.rollback()
        logger.error(f"Error in save_workflow_execution: {e}")
        raise e
    finally:
        conn.close()

def update_workflow_state(run_id: str, state: str, error_message: str = None):
    conn = get_db_connection()
    try:
        db_state = 'RUNNING' if state == 'CREATED' else state
        with conn.cursor() as cur:
            if error_message:
                cur.execute(
                    """
                    UPDATE workflow_executions
                    SET workflow_state = %s, error_message = %s, completed_at = NOW()
                    WHERE id = %s;
                    """,
                    (db_state, error_message, run_id)
                )
            elif db_state in ('COMPLETED', 'FAILED', 'CANCELLED'):
                cur.execute(
                    """
                    UPDATE workflow_executions
                    SET workflow_state = %s, completed_at = NOW()
                    WHERE id = %s;
                    """,
                    (db_state, run_id)
                )
            else:
                cur.execute(
                    """
                    UPDATE workflow_executions
                    SET workflow_state = %s
                    WHERE id = %s;
                    """,
                    (db_state, run_id)
                )
            conn.commit()
    except Exception as e:
        conn.rollback()
        logger.error(f"Error in update_workflow_state: {e}")
        raise e
    finally:
        conn.close()

def save_task_execution(task_id: str, run_id: str, task_name: str, task_type: str, service_name: str, state: str, retry_count: int, input_payload: dict, result_payload: dict = None, error_message: str = None, started_at: str = None, completed_at: str = None):
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO task_executions (id, workflow_execution_id, task_id, task_name, task_type, service_name, task_state, retry_count, input_payload, result_payload, error_message, started_at, completed_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (id) DO UPDATE SET
                    task_state = EXCLUDED.task_state,
                    retry_count = EXCLUDED.retry_count,
                    input_payload = EXCLUDED.input_payload,
                    result_payload = EXCLUDED.result_payload,
                    error_message = EXCLUDED.error_message,
                    started_at = COALESCE(EXCLUDED.started_at, task_executions.started_at),
                    completed_at = EXCLUDED.completed_at;
                """,
                (
                    task_id,
                    run_id,
                    task_name,
                    task_name,
                    task_type,
                    service_name,
                    state,
                    retry_count,
                    json.dumps(input_payload) if input_payload else None,
                    json.dumps(result_payload) if result_payload else None,
                    error_message,
                    started_at,
                    completed_at
                )
            )
            conn.commit()
    except Exception as e:
        conn.rollback()
        logger.error(f"Error in save_task_execution: {e}")
        raise e
    finally:
        conn.close()

def save_human_task(ht_id: str, task_exec_id: str, status: str, decision_notes: str = None):
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO human_tasks (id, task_execution_id, status, decision_notes, created_at)
                VALUES (%s, %s, %s, %s, NOW())
                ON CONFLICT (id) DO UPDATE SET
                    status = EXCLUDED.status,
                    decision_notes = EXCLUDED.decision_notes,
                    approved_at = CASE WHEN EXCLUDED.status IN ('APPROVED', 'REJECTED') THEN NOW() ELSE human_tasks.approved_at END;
                """,
                (ht_id, task_exec_id, status, decision_notes)
            )
            conn.commit()
    except Exception as e:
        conn.rollback()
        logger.error(f"Error in save_human_task: {e}")
        raise e
    finally:
        conn.close()

def save_workflow_event(event_id: str, run_id: str, task_exec_id: str, event_type: str, message: str, payload: dict):
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO workflow_events (id, workflow_execution_id, task_execution_id, event_type, message, event_payload, created_at)
                VALUES (%s, %s, %s, %s, %s, %s, NOW());
                """,
                (event_id, run_id, task_exec_id, event_type, message, json.dumps(payload) if payload else None)
            )
            conn.commit()
    except Exception as e:
        conn.rollback()
        logger.error(f"Error in save_workflow_event: {e}")
        raise e
    finally:
        conn.close()
