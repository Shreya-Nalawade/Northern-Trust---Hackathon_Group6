import httpx
import logging
import asyncio
from typing import Optional

logger = logging.getLogger(__name__)

async def execute_task_remote(service_name: str, task_name: str, payload: dict) -> dict:
    """
    Executes a task by calling a remote microservice via HTTP.
    In the microservices architecture, each service (payment, inventory, etc.)
    exposes an endpoint to handle task execution.
    """
    url = f"http://{service_name}:8000/execute"
    
    async with httpx.AsyncClient() as client:
        try:
            logger.info(f"Dispatching task '{task_name}' to {url}")
            response = await client.post(url, json={
                "task_name": task_name,
                "payload": payload
            }, timeout=30.0)
            
            if response.status_code == 200:
                return response.json()
            else:
                return {
                    "status": "FAILED",
                    "error": f"Service returned status {response.status_code}: {response.text}"
                }
        except Exception as e:
            logger.error(f"Failed to connect to {service_name} service: {str(e)}")
            return {
                "status": "FAILED",
                "error": f"Connection error: {str(e)}"
            }

async def execute_task_mock(service_name: str, task_name: str, payload: Optional[dict] = None) -> dict:
    """
    Mock executor for testing orchestrator logic 
    without running the full microservice cluster.
    Simulates realistic delays and results per service type.
    """
    # Simulate varying latencies per service
    delays = {
        "order-service": 1.0,
        "payment-service": 2.0,
        "inventory-service": 1.5,
        "shipping-service": 2.5,
        "notification-service": 0.8,
    }
    delay = delays.get(service_name, 1.0)
    await asyncio.sleep(delay)
    
    # Simulate realistic results per task
    results = {
        "validate-order": {"valid": True, "message": "Order validated successfully"},
        "process-payment": {"transaction_id": f"TXN-{id(task_name) % 9999:04d}", "status": "charged"},
        "check-inventory": {"available": True, "warehouse": "WH-EAST"},
        "reserve-stock": {"reserved": True, "reservation_id": f"RSV-{id(task_name) % 9999:04d}"},
        "ship-order": {"tracking_number": f"TRACK-{id(task_name) % 99999:05d}", "carrier": "FastShip"},
        "send-confirmation": {"email_sent": True, "channel": "email"},
        "cancel-order": {"cancelled": True},
    }
    
    return {
        "status": "SUCCESS",
        "result": results.get(task_name, {"completed": True}),
    }

# Toggle: set to True to attempt real HTTP calls first, falling back to mock
USE_REAL_SERVICES = False

async def execute_task(service_name: str, task_name: str, payload: Optional[dict] = None) -> dict:
    """
    Unified task executor. Tries real services if enabled, otherwise uses mock.
    """
    if USE_REAL_SERVICES:
        result = await execute_task_remote(service_name, task_name, payload or {})
        if result.get("status") != "FAILED" or "Connection error" not in result.get("error", ""):
            return result
        logger.warning(f"Real service unavailable for {service_name}, falling back to mock")
    
    return await execute_task_mock(service_name, task_name, payload)
