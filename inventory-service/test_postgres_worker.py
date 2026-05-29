import os
import psycopg2
from dotenv import load_dotenv
from seed_data import seed_db
from redis_worker import process_inventory_task

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

def get_current_stock(sku):
    conn = psycopg2.connect(DATABASE_URL)
    cursor = conn.cursor()
    cursor.execute("SELECT available_quantity, reserved_quantity FROM inventory_items WHERE sku = %s;", (sku,))
    row = cursor.fetchone()
    cursor.close()
    conn.close()
    return row if row else (0, 0)

def get_reservations(order_id, sku):
    conn = psycopg2.connect(DATABASE_URL)
    cursor = conn.cursor()
    cursor.execute(
        "SELECT quantity, reservation_status FROM inventory_reservations WHERE order_id = %s AND sku = %s ORDER BY created_at DESC;",
        (order_id, sku)
    )
    rows = cursor.fetchall()
    cursor.close()
    conn.close()
    return rows

def test_postgresql_workflow():
    print("--------------------------------------------------")
    print("Running PostgreSQL Inventory Worker Unit Test...")
    print("--------------------------------------------------")
    
    # 1. Seed database to start clean
    seed_db()
    
    sku = "NIKE-AIR-01"
    initial_avail, initial_res = get_current_stock(sku)
    print(f"Initial Stock: Available={initial_avail}, Reserved={initial_res}")
    
    # 2. Test Success Path (Reservation of 5 items)
    success_task = {
        "task_id": "test_success_task_id",
        "payload": {
            "order_id": "TEST-ORDER-111",
            "items": [{"sku": sku, "qty": 5}]
        }
    }
    
    print("\nExecuting success path (requesting 5 Nike Air Shoes)...")
    process_inventory_task(success_task)
    
    new_avail, new_res = get_current_stock(sku)
    print(f"Post-Success Stock: Available={new_avail}, Reserved={new_res}")
    
    assert new_avail == initial_avail - 5, f"Expected available stock to be {initial_avail - 5}, got {new_avail}"
    assert new_res == initial_res + 5, f"Expected reserved stock to be {initial_res + 5}, got {new_res}"
    
    reservations = get_reservations("TEST-ORDER-111", sku)
    print(f"Database reservations for TEST-ORDER-111: {reservations}")
    assert len(reservations) == 1, "Expected 1 reservation record"
    assert reservations[0][0] == 5, "Expected quantity to be 5"
    assert reservations[0][1] == "RESERVED", "Expected status to be 'RESERVED'"
    
    # 3. Test Failure Path (Requesting 100 items - exceeds available 45)
    fail_task = {
        "task_id": "test_failure_task_id",
        "payload": {
            "order_id": "TEST-ORDER-222",
            "items": [{"sku": sku, "qty": 100}]
        }
    }
    
    print("\nExecuting failure path (requesting 100 Nike Air Shoes)...")
    process_inventory_task(fail_task)
    
    final_avail, final_res = get_current_stock(sku)
    print(f"Post-Failure Stock: Available={final_avail}, Reserved={final_res}")
    
    assert final_avail == new_avail, "Expected available stock to remain unchanged"
    assert final_res == new_res, "Expected reserved stock to remain unchanged"
    
    fail_reservations = get_reservations("TEST-ORDER-222", sku)
    print(f"Database reservations for TEST-ORDER-222: {fail_reservations}")
    assert len(fail_reservations) == 1, "Expected 1 reservation record"
    assert fail_reservations[0][0] == 100, "Expected quantity to be 100"
    assert fail_reservations[0][1] == "FAILED", "Expected status to be 'FAILED'"
    
    print("\n--------------------------------------------------")
    print("All PostgreSQL Inventory workflow tests passed!")
    print("--------------------------------------------------")

if __name__ == "__main__":
    test_postgresql_workflow()
