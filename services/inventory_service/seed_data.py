import os
from pymongo import MongoClient
from dotenv import load_dotenv

# Load environment variables from the .env file FIRST
load_dotenv()

# Load MongoDB connection string (Now it will successfully grab your Atlas URI)
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
MONGO_DB_NAME = os.getenv("MONGO_DB_NAME", "ecommerce_orchestrator")

def seed_db():
    try:
        # Connect to the MongoDB Cluster
        client = MongoClient(MONGO_URI)
        db = client[MONGO_DB_NAME]
        
        # Target the specific collection
        inventory_collection = db["inventory_items"]
        
        # Clear existing data for a fresh hackathon run
        inventory_collection.delete_many({})
        
        # Mock datasets as JSON-like document dictionaries
        mock_items = [
            {"sku": "NIKE-AIR-01", "product_name": "Nike Air Shoes", "available_quantity": 50, "reserved_quantity": 0},
            {"sku": "SKU-PROD-200", "product_name": "Mechanical Keyboard", "available_quantity": 1, "reserved_quantity": 0},
            {"sku": "SKU-PROD-300", "product_name": "USB-C Cable", "available_quantity": 0, "reserved_quantity": 0}
        ]
        
        inventory_collection.insert_many(mock_items)
        print("MongoDB successfully seeded with inventory collections and SKUs!")
        
    except Exception as e:
        print(f"Error seeding MongoDB: {e}")

if __name__ == "__main__":
    seed_db()