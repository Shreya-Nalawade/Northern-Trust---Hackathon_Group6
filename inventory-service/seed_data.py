import os
import psycopg2
from dotenv import load_dotenv

# Load environment variables from the .env file FIRST
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

def seed_db():
    if not DATABASE_URL:
        print("Error: DATABASE_URL environment variable is not set.")
        return

    conn = None
    try:
        # Connect to the Neon PostgreSQL DB
        print("Connecting to PostgreSQL Database to seed data...")
        conn = psycopg2.connect(DATABASE_URL)
        cursor = conn.cursor()
        
        # Clear existing data for a fresh hackathon run
        print("Clearing existing inventory items and reservations...")
        cursor.execute("TRUNCATE TABLE inventory_items, inventory_reservations CASCADE;")
        
        # Mock datasets
        mock_items = [
            ("NIKE-AIR-01", "Nike Air Shoes", 50, 0),
            ("SKU-PROD-200", "Mechanical Keyboard", 1, 0),
            ("SKU-PROD-300", "USB-C Cable", 0, 0),
            ("SKU-101", "Test Product 101", 100, 0),
            ("SKU-102", "Test Product 102", 100, 0)
        ]
        
        # Insert items
        print("Seeding new SKU entries...")
        for item in mock_items:
            cursor.execute(
                """
                INSERT INTO inventory_items (sku, product_name, available_quantity, reserved_quantity)
                VALUES (%s, %s, %s, %s)
                """,
                item
            )
        
        # Commit changes
        conn.commit()
        print("PostgreSQL successfully seeded with inventory items!")
        cursor.close()
        
    except Exception as e:
        print(f"Error seeding database: {e}")
        if conn:
            conn.rollback()
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    seed_db()