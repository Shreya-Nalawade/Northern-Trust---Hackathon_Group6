import redis
import json

# Connect to your local Redis server
r = redis.Redis(host='localhost', port=6379, decode_responses=True)

# The exact payload contract your team agreed on
mock_task = {
    "task_id": "run_001_id_inv",
    "task_type": "inventory",
    "task_name": "reserve_inventory",
    "payload": {
        "order_id": "ORD-12345",
        "items": [{"sku": "NIKE-AIR-01", "qty": 1}]
    },
    "metadata": {
        "attempt": 1,
        "timestamp": "2026-05-28T17:35:00Z"
    }
}

# Push to the exact queue your worker is listening to
queue_name = "queue:inventory:reserve"
r.lpush(queue_name, json.dumps(mock_task))

print(f"Mock task successfully dropped into Redis queue: {queue_name}")