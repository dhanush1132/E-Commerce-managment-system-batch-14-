-- ====================================================================
-- E-Commerce Database Management System - Relational Schema
-- Department of Computer Science & Engineering
-- ====================================================================

-- Enable Foreign Key constraints in SQLite
PRAGMA foreign_keys = ON;

-- 1. Category Entity
-- Category (Category_ID, Category_Name)
CREATE TABLE IF NOT EXISTS Category (
    Category_ID INTEGER PRIMARY KEY AUTOINCREMENT,
    Category_Name TEXT NOT NULL UNIQUE
);

-- 2. Product Entity
-- Product (Product_ID, Product_Name, Price, Stock, Category_ID)
-- FK Product.Category_ID -> Category
CREATE TABLE IF NOT EXISTS Product (
    Product_ID INTEGER PRIMARY KEY AUTOINCREMENT,
    Product_Name TEXT NOT NULL,
    Price REAL NOT NULL CHECK(Price >= 0),
    Stock INTEGER NOT NULL DEFAULT 0 CHECK(Stock >= 0),
    Category_ID INTEGER NOT NULL,
    FOREIGN KEY (Category_ID) REFERENCES Category(Category_ID) ON DELETE RESTRICT ON UPDATE CASCADE
);

-- 3. Customer Entity
-- Customer (Customer_ID, Name, Email, Phone, Address)
CREATE TABLE IF NOT EXISTS Customer (
    Customer_ID INTEGER PRIMARY KEY AUTOINCREMENT,
    Name TEXT NOT NULL,
    Email TEXT NOT NULL UNIQUE,
    Phone TEXT NOT NULL,
    Address TEXT NOT NULL
);

-- 4. Order Entity
-- Order (Order_ID, Order_Date, Customer_ID, Total_Amount)
-- FK Order.Customer_ID -> Customer
-- Note: 'Order' is a reserved SQL keyword, so table name is quoted as "Order"
CREATE TABLE IF NOT EXISTS "Order" (
    Order_ID INTEGER PRIMARY KEY AUTOINCREMENT,
    Order_Date DATETIME DEFAULT CURRENT_TIMESTAMP,
    Customer_ID INTEGER NOT NULL,
    Total_Amount REAL NOT NULL DEFAULT 0.0 CHECK(Total_Amount >= 0),
    FOREIGN KEY (Customer_ID) REFERENCES Customer(Customer_ID) ON DELETE CASCADE ON UPDATE CASCADE
);

-- 5. Order_Item Entity
-- Order_Item (Order_Item_ID, Order_ID, Product_ID, Quantity)
-- FK Order_Item.Order_ID -> Order, Order_Item.Product_ID -> Product
CREATE TABLE IF NOT EXISTS Order_Item (
    Order_Item_ID INTEGER PRIMARY KEY AUTOINCREMENT,
    Order_ID INTEGER NOT NULL,
    Product_ID INTEGER NOT NULL,
    Quantity INTEGER NOT NULL CHECK(Quantity > 0),
    FOREIGN KEY (Order_ID) REFERENCES "Order"(Order_ID) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (Product_ID) REFERENCES Product(Product_ID) ON DELETE RESTRICT ON UPDATE CASCADE
);

-- 6. Payment Entity
-- Payment (Payment_ID, Order_ID, Payment_Date, Amount, Status)
-- FK Payment.Order_ID -> Order
CREATE TABLE IF NOT EXISTS Payment (
    Payment_ID INTEGER PRIMARY KEY AUTOINCREMENT,
    Order_ID INTEGER NOT NULL UNIQUE,
    Payment_Date DATETIME DEFAULT CURRENT_TIMESTAMP,
    Amount REAL NOT NULL CHECK(Amount >= 0),
    Status TEXT NOT NULL CHECK(Status IN ('Completed', 'Pending', 'Failed', 'Refunded')),
    FOREIGN KEY (Order_ID) REFERENCES "Order"(Order_ID) ON DELETE CASCADE ON UPDATE CASCADE
);

-- 7. Delivery Entity
-- Delivery (Delivery_ID, Order_ID, Delivery_Date, Status)
-- FK Delivery.Order_ID -> Order
CREATE TABLE IF NOT EXISTS Delivery (
    Delivery_ID INTEGER PRIMARY KEY AUTOINCREMENT,
    Order_ID INTEGER NOT NULL UNIQUE,
    Delivery_Date DATETIME,
    Status TEXT NOT NULL CHECK(Status IN ('Pending', 'Processing', 'In Transit', 'Delivered', 'Cancelled')),
    FOREIGN KEY (Order_ID) REFERENCES "Order"(Order_ID) ON DELETE CASCADE ON UPDATE CASCADE
);

-- Create Indexes for foreign key relationships to optimize queries
CREATE INDEX IF NOT EXISTS idx_product_category ON Product(Category_ID);
CREATE INDEX IF NOT EXISTS idx_order_customer ON "Order"(Customer_ID);
CREATE INDEX IF NOT EXISTS idx_order_item_order ON Order_Item(Order_ID);
CREATE INDEX IF NOT EXISTS idx_order_item_product ON Order_Item(Product_ID);
CREATE INDEX IF NOT EXISTS idx_payment_order ON Payment(Order_ID);
CREATE INDEX IF NOT EXISTS idx_delivery_order ON Delivery(Order_ID);
