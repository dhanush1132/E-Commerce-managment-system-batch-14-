#!/usr/bin/env python3
"""
Database Management System - REST Backend & Web Server
Department of Computer Science & Engineering
E-Commerce Relational Prototype
"""

import os
import sys
import json
import sqlite3
from urllib.parse import urlparse, parse_qs
from http.server import HTTPServer, SimpleHTTPRequestHandler

PORT = int(os.environ.get("PORT", 8000))
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "ecommerce.db")
SCHEMA_PATH = os.path.join(BASE_DIR, "schema.sql")
SEED_PATH = os.path.join(BASE_DIR, "seed.sql")
PUBLIC_DIR = os.path.join(BASE_DIR, "public")

VALID_TABLES = ["Customer", "Product", "Category", "Order", "Order_Item", "Payment", "Delivery"]
PK_MAP = {
    "Customer": "Customer_ID",
    "Product": "Product_ID",
    "Category": "Category_ID",
    "Order": "Order_ID",
    "Order_Item": "Order_Item_ID",
    "Payment": "Payment_ID",
    "Delivery": "Delivery_ID"
}

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn

def init_db(force=False):
    db_exists = os.path.exists(DB_PATH)
    if not db_exists or force:
        if force and db_exists:
            try:
                os.remove(DB_PATH)
            except Exception as e:
                print(f"Warning removing DB: {e}")
        print(f"Initializing database from {SCHEMA_PATH} and {SEED_PATH}...")
        conn = get_db()
        with open(SCHEMA_PATH, "r", encoding="utf-8") as f:
            conn.executescript(f.read())
        with open(SEED_PATH, "r", encoding="utf-8") as f:
            conn.executescript(f.read())
        conn.commit()
        conn.close()
        print("Database initialized successfully.")

class RequestHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=PUBLIC_DIR, **kwargs)

    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def send_json(self, data, status=200):
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.end_headers()
        self.wfile.write(json.dumps(data, default=str).encode("utf-8"))

    def read_json_body(self):
        content_length = int(self.headers.get("Content-Length", 0))
        if content_length > 0:
            body = self.rfile.read(content_length).decode("utf-8")
            return json.loads(body)
        return {}

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/")

        if path == "/api/summary":
            self.handle_summary()
            return
        elif path == "/api/tables":
            self.handle_tables_meta()
            return
        elif path.startswith("/api/table/"):
            table_name = path.replace("/api/table/", "")
            self.handle_table_get(table_name)
            return
        elif path == "/api/project-info":
            self.send_json({
                "project_title": "Database Management System",
                "department": "Department of Computer Science & Engineering",
                "supervisor": "Mr. K. RAJENDRA",
                "team": [
                    {"name": "M. Lekhana", "roll": "25b11cs562", "role": "Requirements & Documentation"},
                    {"name": "G. Navya Sri", "roll": "25b11cs321", "role": "Entities, Attributes & Table Design"},
                    {"name": "K. Satya Reshmee", "roll": "25b11cs468", "role": "ER Diagram & Relationship Modeling"},
                    {"name": "K. Dhanush", "roll": "25b11cs456", "role": "Keys, Integration & Presentation"}
                ],
                "entities": VALID_TABLES
            })
            return

        # Serve static frontend
        super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/")

        try:
            if path == "/api/checkout":
                self.handle_checkout()
                return
            elif path == "/api/query":
                self.handle_query()
                return
            elif path == "/api/reset":
                init_db(force=True)
                self.send_json({"success": True, "message": "Database reset to original seed state."})
                return
            elif path.startswith("/api/table/"):
                table_name = path.replace("/api/table/", "")
                self.handle_table_insert(table_name)
                return
            else:
                self.send_json({"error": "Endpoint not found"}, status=404)
        except Exception as e:
            self.send_json({"error": str(e)}, status=500)

    def do_PUT(self):
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/")
        # format: /api/table/<table_name>/<id>
        parts = path.split("/")
        if len(parts) == 5 and parts[1] == "api" and parts[2] == "table":
            table_name = parts[3]
            record_id = parts[4]
            self.handle_table_update(table_name, record_id)
        else:
            self.send_json({"error": "Invalid PUT route format"}, status=400)

    def do_DELETE(self):
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/")
        # format: /api/table/<table_name>/<id>
        parts = path.split("/")
        if len(parts) == 5 and parts[1] == "api" and parts[2] == "table":
            table_name = parts[3]
            record_id = parts[4]
            self.handle_table_delete(table_name, record_id)
        else:
            self.send_json({"error": "Invalid DELETE route format"}, status=400)

    # ------------------ HANDLERS ------------------

    def handle_summary(self):
        conn = get_db()
        counts = {}
        for t in VALID_TABLES:
            quoted_t = f'"{t}"' if t == "Order" else t
            cur = conn.execute(f"SELECT COUNT(*) as cnt FROM {quoted_t}")
            counts[t] = cur.fetchone()["cnt"]

        # Total revenue
        cur = conn.execute('SELECT COALESCE(SUM(Total_Amount), 0) as total FROM "Order"')
        total_revenue = round(cur.fetchone()["total"], 2)

        # Low stock products (< 15)
        cur = conn.execute("SELECT COUNT(*) as cnt FROM Product WHERE Stock < 15")
        low_stock = cur.fetchone()["cnt"]

        # Pending Deliveries
        cur = conn.execute("SELECT COUNT(*) as cnt FROM Delivery WHERE Status != 'Delivered'")
        pending_deliveries = cur.fetchone()["cnt"]

        conn.close()
        self.send_json({
            "counts": counts,
            "total_revenue": total_revenue,
            "low_stock": low_stock,
            "pending_deliveries": pending_deliveries
        })

    def handle_tables_meta(self):
        conn = get_db()
        tables_meta = []
        for t in VALID_TABLES:
            quoted_t = f'"{t}"' if t == "Order" else t
            cur = conn.execute(f"SELECT COUNT(*) as cnt FROM {quoted_t}")
            count = cur.fetchone()["cnt"]
            
            # Pragma table info for columns
            info_cur = conn.execute(f"PRAGMA table_info({quoted_t})")
            columns = []
            for col in info_cur.fetchall():
                columns.append({
                    "cid": col["cid"],
                    "name": col["name"],
                    "type": col["type"],
                    "notnull": bool(col["notnull"]),
                    "pk": bool(col["pk"])
                })
            
            # Foreign keys info
            fk_cur = conn.execute(f"PRAGMA foreign_key_list({quoted_t})")
            fks = []
            for fk in fk_cur.fetchall():
                fks.append({
                    "from": fk["from"],
                    "to_table": fk["table"],
                    "to_column": fk["to"]
                })

            tables_meta.append({
                "table_name": t,
                "count": count,
                "pk_field": PK_MAP.get(t),
                "columns": columns,
                "foreign_keys": fks
            })

        conn.close()
        self.send_json({"tables": tables_meta})

    def handle_table_get(self, table_name):
        if table_name not in VALID_TABLES:
            self.send_json({"error": f"Invalid table '{table_name}'"}, status=400)
            return

        quoted_t = f'"{table_name}"' if table_name == "Order" else table_name
        conn = get_db()

        # Custom enrichment for better display
        if table_name == "Product":
            query = """
                SELECT p.*, c.Category_Name 
                FROM Product p 
                LEFT JOIN Category c ON p.Category_ID = c.Category_ID
                ORDER BY p.Product_ID ASC
            """
        elif table_name == "Order":
            query = """
                SELECT o.*, c.Name as Customer_Name, c.Email as Customer_Email,
                       p.Status as Payment_Status, d.Status as Delivery_Status
                FROM "Order" o
                LEFT JOIN Customer c ON o.Customer_ID = c.Customer_ID
                LEFT JOIN Payment p ON o.Order_ID = p.Order_ID
                LEFT JOIN Delivery d ON o.Order_ID = d.Order_ID
                ORDER BY o.Order_ID DESC
            """
        elif table_name == "Order_Item":
            query = """
                SELECT oi.*, p.Product_Name, p.Price, (oi.Quantity * p.Price) as Item_Subtotal
                FROM Order_Item oi
                LEFT JOIN Product p ON oi.Product_ID = p.Product_ID
                ORDER BY oi.Order_ID DESC, oi.Order_Item_ID ASC
            """
        elif table_name == "Payment":
            query = """
                SELECT py.*, c.Name as Customer_Name, o.Total_Amount as Order_Amount
                FROM Payment py
                LEFT JOIN "Order" o ON py.Order_ID = o.Order_ID
                LEFT JOIN Customer c ON o.Customer_ID = c.Customer_ID
                ORDER BY py.Payment_ID DESC
            """
        elif table_name == "Delivery":
            query = """
                SELECT d.*, c.Name as Customer_Name, c.Address as Customer_Address
                FROM Delivery d
                LEFT JOIN "Order" o ON d.Order_ID = o.Order_ID
                LEFT JOIN Customer c ON o.Customer_ID = c.Customer_ID
                ORDER BY d.Delivery_ID DESC
            """
        else:
            query = f"SELECT * FROM {quoted_t} ORDER BY 1 ASC"

        cur = conn.execute(query)
        rows = [dict(r) for r in cur.fetchall()]
        conn.close()
        self.send_json({"table": table_name, "rows": rows, "count": len(rows)})

    def handle_table_insert(self, table_name):
        if table_name not in VALID_TABLES:
            self.send_json({"error": f"Invalid table '{table_name}'"}, status=400)
            return

        body = self.read_json_body()
        quoted_t = f'"{table_name}"' if table_name == "Order" else table_name
        pk = PK_MAP.get(table_name)

        # Remove PK if provided as empty or auto-increment
        if pk in body and (body[pk] is None or body[pk] == "" or body[pk] == 0):
            del body[pk]

        if not body:
            self.send_json({"error": "Empty payload"}, status=400)
            return

        cols = list(body.keys())
        placeholders = ", ".join(["?"] * len(cols))
        col_names = ", ".join([f'"{c}"' for c in cols])
        values = [body[c] for c in cols]

        conn = get_db()
        try:
            cur = conn.execute(f"INSERT INTO {quoted_t} ({col_names}) VALUES ({placeholders})", values)
            new_id = cur.lastrowid
            conn.commit()
            conn.close()
            self.send_json({"success": True, "inserted_id": new_id, "message": f"Record created in {table_name}"})
        except Exception as e:
            conn.close()
            self.send_json({"error": f"Failed to insert: {str(e)}"}, status=400)

    def handle_table_update(self, table_name, record_id):
        if table_name not in VALID_TABLES:
            self.send_json({"error": f"Invalid table '{table_name}'"}, status=400)
            return

        body = self.read_json_body()
        quoted_t = f'"{table_name}"' if table_name == "Order" else table_name
        pk = PK_MAP.get(table_name)

        if not body:
            self.send_json({"error": "Empty payload for update"}, status=400)
            return

        # Do not allow modifying PK itself in update
        if pk in body:
            del body[pk]

        set_clauses = [f'"{k}" = ?' for k in body.keys()]
        values = list(body.values())
        values.append(record_id)

        conn = get_db()
        try:
            cur = conn.execute(f"UPDATE {quoted_t} SET {', '.join(set_clauses)} WHERE \"{pk}\" = ?", values)
            if cur.rowcount == 0:
                conn.close()
                self.send_json({"error": f"Record with {pk}={record_id} not found"}, status=404)
                return
            conn.commit()
            conn.close()
            self.send_json({"success": True, "message": f"Updated record {record_id} in {table_name}"})
        except Exception as e:
            conn.close()
            self.send_json({"error": f"Update failed: {str(e)}"}, status=400)

    def handle_table_delete(self, table_name, record_id):
        if table_name not in VALID_TABLES:
            self.send_json({"error": f"Invalid table '{table_name}'"}, status=400)
            return

        quoted_t = f'"{table_name}"' if table_name == "Order" else table_name
        pk = PK_MAP.get(table_name)

        conn = get_db()
        try:
            cur = conn.execute(f"DELETE FROM {quoted_t} WHERE \"{pk}\" = ?", (record_id,))
            if cur.rowcount == 0:
                conn.close()
                self.send_json({"error": f"Record with {pk}={record_id} not found"}, status=404)
                return
            conn.commit()
            conn.close()
            self.send_json({"success": True, "message": f"Deleted record {record_id} from {table_name}"})
        except sqlite3.IntegrityError as e:
            conn.close()
            self.send_json({"error": f"Cannot delete due to Foreign Key constraint: {str(e)}"}, status=409)
        except Exception as e:
            conn.close()
            self.send_json({"error": f"Delete failed: {str(e)}"}, status=400)

    def handle_checkout(self):
        """
        Transactional order placement connecting:
        Customer -> Order -> Order_Items -> Payment -> Delivery
        and decrementing Product stock.
        """
        data = self.read_json_body()
        customer_id = data.get("customer_id")
        new_customer = data.get("customer")  # optional new customer info dict
        items = data.get("items", [])  # list of { product_id, quantity }
        payment_method = data.get("payment_method", "Completed")

        if not items:
            self.send_json({"error": "Cart is empty"}, status=400)
            return

        conn = get_db()
        try:
            conn.execute("BEGIN TRANSACTION")

            # 1. Customer resolution
            if not customer_id and new_customer:
                cur = conn.execute(
                    "INSERT INTO Customer (Name, Email, Phone, Address) VALUES (?, ?, ?, ?)",
                    (new_customer["Name"], new_customer["Email"], new_customer["Phone"], new_customer["Address"])
                )
                customer_id = cur.lastrowid
            elif not customer_id:
                # Default to customer 1 if not specified
                customer_id = 1

            # Verify customer exists
            cust_row = conn.execute("SELECT * FROM Customer WHERE Customer_ID = ?", (customer_id,)).fetchone()
            if not cust_row:
                raise Exception(f"Customer with ID {customer_id} does not exist.")

            # 2. Check stock and calculate total
            total_amount = 0.0
            order_items_to_insert = []
            for item in items:
                pid = item["product_id"]
                qty = int(item["quantity"])
                p_row = conn.execute("SELECT Product_ID, Product_Name, Price, Stock FROM Product WHERE Product_ID = ?", (pid,)).fetchone()
                if not p_row:
                    raise Exception(f"Product ID {pid} not found.")
                if p_row["Stock"] < qty:
                    raise Exception(f"Insufficient stock for '{p_row['Product_Name']}'. Available: {p_row['Stock']}, requested: {qty}.")
                
                subtotal = p_row["Price"] * qty
                total_amount += subtotal
                order_items_to_insert.append({
                    "product_id": pid,
                    "quantity": qty,
                    "unit_price": p_row["Price"],
                    "name": p_row["Product_Name"],
                    "new_stock": p_row["Stock"] - qty
                })

            total_amount = round(total_amount, 2)

            # 3. Create Order
            cur = conn.execute(
                'INSERT INTO "Order" (Customer_ID, Total_Amount, Order_Date) VALUES (?, ?, CURRENT_TIMESTAMP)',
                (customer_id, total_amount)
            )
            order_id = cur.lastrowid

            # 4. Insert Order_Items and update Product stock
            for oi in order_items_to_insert:
                conn.execute(
                    "INSERT INTO Order_Item (Order_ID, Product_ID, Quantity) VALUES (?, ?, ?)",
                    (order_id, oi["product_id"], oi["quantity"])
                )
                conn.execute(
                    "UPDATE Product SET Stock = ? WHERE Product_ID = ?",
                    (oi["new_stock"], oi["product_id"])
                )

            # 5. Insert Payment
            cur = conn.execute(
                "INSERT INTO Payment (Order_ID, Amount, Status, Payment_Date) VALUES (?, ?, ?, CURRENT_TIMESTAMP)",
                (order_id, total_amount, payment_method)
            )
            payment_id = cur.lastrowid

            # 6. Insert Delivery
            cur = conn.execute(
                "INSERT INTO Delivery (Order_ID, Delivery_Date, Status) VALUES (?, datetime('now', '+3 days'), 'Processing')",
                (order_id,)
            )
            delivery_id = cur.lastrowid

            conn.commit()

            self.send_json({
                "success": True,
                "message": "Order successfully placed and relational records created!",
                "order": {
                    "Order_ID": order_id,
                    "Customer_ID": customer_id,
                    "Customer_Name": cust_row["Name"],
                    "Customer_Email": cust_row["Email"],
                    "Total_Amount": total_amount,
                    "Items_Count": len(order_items_to_insert),
                    "Payment_ID": payment_id,
                    "Payment_Status": payment_method,
                    "Delivery_ID": delivery_id,
                    "Delivery_Status": "Processing",
                    "Items": order_items_to_insert
                }
            })
        except Exception as e:
            conn.rollback()
            self.send_json({"error": str(e)}, status=400)
        finally:
            conn.close()

    def handle_query(self):
        """
        Live SQL query runner for Capstone demo queries
        """
        data = self.read_json_body()
        query = data.get("query", "").strip()

        if not query:
            self.send_json({"error": "Query string cannot be empty"}, status=400)
            return

        conn = get_db()
        try:
            cur = conn.execute(query)
            if cur.description:
                columns = [col[0] for col in cur.description]
                rows = [list(r) for r in cur.fetchall()]
                conn.commit()
                conn.close()
                self.send_json({
                    "success": True,
                    "is_select": True,
                    "columns": columns,
                    "rows": rows,
                    "row_count": len(rows)
                })
            else:
                affected = cur.rowcount
                conn.commit()
                conn.close()
                self.send_json({
                    "success": True,
                    "is_select": False,
                    "affected_rows": affected,
                    "message": f"Query executed successfully. Affected rows: {affected}"
                })
        except Exception as e:
            conn.close()
            self.send_json({"error": f"SQL Error: {str(e)}"}, status=400)

def main():
    def main():
        init_db()
    os.makedirs(PUBLIC_DIR, exist_ok=True)

    # Use the hosting platform's PORT when deployed.
    # Use port 8000 when running locally.
    port = int(os.environ.get("PORT", 8000))

    # Listen on all network interfaces
    server_address = ("0.0.0.0", port)
    httpd = HTTPServer(server_address, RequestHandler)

    print("================================================================")
    print("  DATABASE MANAGEMENT SYSTEM (PROTOTYPE)")
    print("  Dept. of Computer Science & Engineering")
    print(f"  Server running on port: {port}")
    print("================================================================")

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping server...")
        httpd.server_close()

if __name__ == "__main__":
    if "--init-only" in sys.argv:
        init_db(force=True)
        print("Initialization complete.")
    else:
        main()
