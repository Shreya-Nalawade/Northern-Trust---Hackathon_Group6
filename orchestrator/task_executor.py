import httpx
import logging
import asyncio

logger = logging.getLogger(__name__)

async def execute_task_remote(service_name: str, task_name: str, payload: dict) -> dict:
    """
    Executes a task by calling a remote microservice via HTTP.
    In the microservices architecture, each service (payment, inventory, etc.)
    exposes an endpoint to handle task execution.
    """
    url = f"http://{service_name}-service:8000/execute"
    
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

async def execute_task_mock(task_type: str, task_name: str) -> dict:
    """
    Fallback mock executor for testing orchestrator logic 
    without running the full microservice cluster.
    """
    await asyncio.sleep(1) # Simulate network latency
    return {
        "status": "SUCCESS",
        "logs": f"Successfully simulated {task_type} for {task_name}"
    }
