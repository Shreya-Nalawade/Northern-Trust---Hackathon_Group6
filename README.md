# E-commerce Orchestrator Base

## Folder Structure
- `orchestrator/`: The core DAG engine and execution runner.
- `workflows/`: YAML definitions for complex order processes.
- `services/`: Skeletons for independent microservices (Payment, Inventory, Notifications).
- `state_manager/`: Logic for persisting workflow and task states.
- `api/`: The gateway for triggering and monitoring workflows.
- `frontend/`: The user interface dashboard.
- `shared/`: Shared configuration and environment variables.

## Running the Orchestrator
The orchestrator now runs as a FastAPI microservice.

1. `python -m venv venv`
2. `.\venv\Scripts\activate`
3. `pip install -r requirements.txt`
4. `cd orchestrator`
5. `either run dag_runner.py or start backend service using the following steps`
6. Start the service: `uvicorn app:app --reload`
7. Use the API (Port 8000) to trigger workflows:
   - `POST /runs`: Start a new execution.
   - `GET /runs/{id}`: Monitor status.
   - `POST /runs/{id}/pause`: Halt execution.

