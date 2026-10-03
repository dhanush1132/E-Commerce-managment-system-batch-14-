# Database Management System (E-Commerce Prototype)

**Department of Computer Science & Engineering**

---

## 👥 Project Team & Supervision

- **Supervisor:** Mr. K. RAJENDRA (Assistant Professor, Dept. of CSE)
- **Team Members:**
  1. **M. Lekhana** (`25B11CS562`) — *Requirements & Documentation*
  2. **G. Navya Sri** (`25B11CS321`) — *Entities, Attributes & Table Design*
  3. **K. Satya Reshmee** (`25B11CS468`) — *ER Diagram & Relationship Modeling*
  4. **K. Dhanush** (`25B11CS456`) — *Keys, Integration & Presentation*

---

## 🏗️ Relational Database Schema & Entities

Core relational database model with 7 interconnected tables:

| Entity | Primary Key (PK) | Foreign Keys (FK) | Additional Attributes | Description |
| :--- | :--- | :--- | :--- | :--- |
| **`Category`** | `Category_ID` | — | `Category_Name` | Product classification taxonomy |
| **`Product`** | `Product_ID` | `Category_ID` &rarr; `Category` | `Product_Name`, `Price`, `Stock` | Products catalog with stock tracking |
| **`Customer`** | `Customer_ID` | — | `Name`, `Email`, `Phone`, `Address` | Buyer contact and shipping information |
| **`Order`** | `Order_ID` | `Customer_ID` &rarr; `Customer` | `Order_Date`, `Total_Amount` | Master order transactions |
| **`Order_Item`** | `Order_Item_ID` | `Order_ID` &rarr; `Order`<br>`Product_ID` &rarr; `Product` | `Quantity` | Bridge table connecting Orders & Products |
| **`Payment`** | `Payment_ID` | `Order_ID` &rarr; `Order` | `Payment_Date`, `Amount`, `Status` | Payment settlement records |
| **`Delivery`** | `Delivery_ID` | `Order_ID` &rarr; `Order` | `Delivery_Date`, `Status` | Logistics tracking & fulfillment |

---

## 🚀 How to Run the Website Prototype

### Step 1: Start the Backend Server
The backend is written in pure Python 3 using built-in standard libraries (`http.server` + `sqlite3`). No `pip install` or `npm install` needed!

```bash
python server.py
```

### Step 2: Open in Web Browser
Open your browser and navigate to:
```
http://localhost:8000
```

*(Note: The web prototype also supports double-clicking `public/index.html` to run in standalone browser mode with an embedded in-memory database fallback!)*

---

## 🌟 Prototype Features

1. **🛍️ Customer Storefront**:
   - Filter by product categories and live text search.
   - Real-time stock status (In Stock, Low Stock, Out of Stock).
   - Interactive shopping cart with subtotal and tax calculation.
   - Transactional checkout: placing an order executes an atomic transaction writing to `Order`, `Order_Item`, `Payment`, `Delivery`, and decrements `Product.Stock`.
   - Order confirmation receipt highlighting generated relational keys.

2. **🗄️ DBMS Admin Console (7 Entity Tables)**:
   - Dedicated interactive tables for all 7 entities.
   - Primary Key (`🔑 PK`) and Foreign Key (`🔗 FK`) color-coded tags.
   - Real-time row filtering and search.
   - Complete CRUD (Add, Edit, Delete) with foreign key reference selectors.
   - **Order Relational Dossier**: Click "Inspect" on any order to see its customer information, ordered line items, payment status, and delivery tracking in one comprehensive view.
   - One-click "Reset Seed DB" button.

3. **🗺️ Interactive ER Diagram & Schema Visualizer**:
   - Visual architectural database mapping.
   - Detailed attribute breakdowns and relationship cardinality labels (1 : M, 1 : 1).

4. **⚡ Live SQL Query Playground**:
   - Run custom queries against the live `ecommerce.db` SQLite database.
   - Pre-loaded demo queries:
     - 4-Table JOIN (Order + Customer + Payment + Delivery)
     - Category sales & revenue aggregation (`GROUP BY`, `SUM`)
     - Customer spending analysis
     - Pending delivery dispatch lists
     - Low stock alert notifications (`WHERE Stock < 20`)

5. **📑 Project Overview & Documentation**:
   - Problem statement, objectives, and team contributions.
