import os
import json
import uuid
import logging
import time
from datetime import datetime
import redis
from pymongo import MongoClient, ReturnDocument
import httpx
import os
from dotenv import load_dotenv

# Load environment variables FIRST before any connections
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger("InventoryWorker")

# Load environment variables
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
DB_NAME = os.getenv("MONGO_DB_NAME", "ecommerce_orchestrator")
REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", 6379))
REDIS_QUEUE = os.getenv("REDIS_QUEUE", "queue:inventory:reserve")
ORCHESTRATOR_CALLBACK_URL = os.getenv("ORCHESTRATOR_CALLBACK_URL", "http://localhost:8000/api/v1/tasks/callback")

def get_mongo_db():
    """Establishes the MongoDB client connection."""
    client = MongoClient(MONGO_URI)
    return client[DB_NAME]

def send_callback(payload: dict):
    """Sends the result back to the core Orchestrator via HTTP."""
    try:
        with httpx.Client() as client:
            response = client.post(ORCHESTRATOR_CALLBACK_URL, json=payload, timeout=5.0)
            if response.status_code == 200:
                logger.info(f"✅ Callback accepted by orchestrator for task: {payload['task_id']}")
            else:
                logger.error(f"⚠️ Orchestrator rejected callback: {response.status_code} - {response.text}")
    except Exception as e:
        logger.error(f"❌ Failed to reach orchestrator at {ORCHESTRATOR_CALLBACK_URL}: {e}")

def process_inventory_task(task_data: dict):
    """Handles MongoDB document updates for inventory reservation."""
    task_id = task_data.get("task_id")
    payload = task_data.get("payload", {})
    order_id = payload.get("order_id")
    items = payload.get("items", [])
    
    logger.info(f"📦 Processing task {task_id} for Order: {order_id}")
    
    db = get_mongo_db()
    inventory_items = db["inventory_items"]
    reservations = db["inventory_reservations"]
    
    stock_available = True
    insufficient_items = []
    processed_skus = []
    
    # 1. Verify Stock Availability
    for item in items:
        sku = item["sku"]
        qty = item["qty"]
        
        product = inventory_items.find_one({"sku": sku})
        
        if not product or product.get("available_quantity", 0) < qty:
            stock_available = False
            insufficient_items.append({
                "sku": sku,
                "requested": qty,
                "available": product.get("available_quantity", 0) if product else 0
            })

    # 2. Process Success Path (Atomic Operations)
    if stock_available:
        for item in items:
            sku = item["sku"]
            qty = item["qty"]
            
            # Use MongoDB's $inc operator for safe atomic updates
            inventory_items.find_one_and_update(
                {"sku": sku},
                {"$inc": {"available_quantity": -qty, "reserved_quantity": qty}},
                return_document=ReturnDocument.AFTER
            )
            
            # Log reservation success
            reservations.insert_one({
                "order_id": order_id,
                "sku": sku,
                "quantity": qty,
                "reservation_status": "RESERVED",
                "created_at": datetime.utcnow()
            })
            processed_skus.append(sku)
            
        sku_list_str = ", ".join(processed_skus)
        callback_payload = {
            "task_id": task_id,
            "status": "SUCCESS",
            "result": {
                "tracking_id": f"WH-{uuid.uuid4().hex[:4].upper()}",
                "reserved_at": datetime.utcnow().isoformat() + "Z"
            },
            "logs": f"Inventory locked for SKU: {sku_list_str}",
            "error": None
        }
        
    # 3. Process Failure Path (Out of Stock)
    else:
        for item in items:
            reservations.insert_one({
                "order_id": order_id,
                "sku": item["sku"],
                "quantity": item["qty"],
                "reservation_status": "FAILED",
                "created_at": datetime.utcnow()
            })
            
        callback_payload = {
            "task_id": task_id,
            "status": "FAILED",
            "result": None,
            "logs": f"Inventory check failed. Insufficient items.",
            "error": {
                "code": "OUT_OF_STOCK",
                "message": "Requested quantities exceed current stock.",
                "details": insufficient_items
            }
        }

    # 4. Fire the callback to the core orchestrator
    send_callback(callback_payload)

def start_worker():
    """Continuously listens to the Redis queue for new tasks."""
    logger.info(f"🚀 Starting Inventory Redis Worker (MongoDB Version). Listening on queue: {REDIS_QUEUE}")
    
    try:
        redis_client = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, db=0, decode_responses=True)
        redis_client.ping()
        logger.info("📡 Connected to Redis successfully.")
    except Exception as e:
        logger.error(f"❌ Could not connect to Redis: {e}")
        return

    while True:
        try:
            # Block until a task is pushed to the Redis list
            result = redis_client.blpop(REDIS_QUEUE, timeout=0)
            if result:
                queue_name, message_data = result
                task_json = json.loads(message_data)
                process_inventory_task(task_json)
        except json.JSONDecodeError:
            logger.error(f"⚠️ Received invalid JSON from Redis: {message_data}")
        except Exception as e:
            logger.error(f"⚠️ Worker loop encountered an error: {e}")
            time.sleep(2)

if __name__ == "__main__":
    start_worker()