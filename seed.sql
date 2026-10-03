-- ====================================================================
-- E-Commerce Management System - Seed Data
-- ====================================================================

-- 1. Categories
INSERT INTO Category (Category_ID, Category_Name) VALUES
(1, 'Electronics & Gadgets'),
(2, 'Fashion & Apparel'),
(3, 'Home & Living'),
(4, 'Books & Learning'),
(5, 'Fitness & Sports');

-- 2. Products
INSERT INTO Product (Product_ID, Product_Name, Price, Stock, Category_ID) VALUES
(101, 'MacBook Air M2 13-inch', 999.00, 15, 1),
(102, 'Sony WH-1000XM5 Wireless Headphones', 349.00, 24, 1),
(103, 'Samsung Galaxy S24 Ultra', 1199.00, 18, 1),
(104, 'Logitech MX Master 3S Mouse', 99.00, 40, 1),
(105, 'Classic Oxford Cotton Shirt', 45.00, 50, 2),
(106, 'Slim Fit Stretch Denim Jeans', 59.00, 35, 2),
(107, 'Breathable Running Shoes Pro', 85.00, 28, 2),
(108, 'Smart LED Desk Lamp', 38.00, 30, 3),
(109, 'Ergonomic Mesh Office Chair', 189.00, 12, 3),
(110, 'Stainless Steel Thermal Flask 1L', 24.00, 60, 3),
(111, 'Database System Concepts (Silberschatz)', 75.00, 20, 4),
(112, 'Clean Code: Agile Software Craftsmanship', 42.00, 25, 4),
(113, 'Python Crash Course (3rd Edition)', 36.00, 32, 4),
(114, 'Non-Slip Eco Yoga Mat', 29.00, 45, 5),
(115, 'Adjustable Dumbbell Set 20KG', 110.00, 10, 5);

-- 3. Customers (Including Capstone Team Members)
INSERT INTO Customer (Customer_ID, Name, Email, Phone, Address) VALUES
(1, 'M. Lekhana', 'lekhana.m@aditya.edu.in', '+91 98765 43210', 'Block A, Aditya University Campus, Surampalem, AP'),
(2, 'G. Navya Sri', 'navyasri.g@aditya.edu.in', '+91 98765 43211', 'Sai Nagar, Kakinada, Andhra Pradesh'),
(3, 'K. Satya Reshmee', 'satyareshmee.k@aditya.edu.in', '+91 98765 43212', 'Gandhi Road, Rajahmundry, Andhra Pradesh'),
(4, 'K. Dhanush', 'dhanush.k@aditya.edu.in', '+91 98765 43213', 'Main Street, Samalkot, Andhra Pradesh'),
(5, 'Prof. K. Rajendra', 'rajendra.k@aditya.edu.in', '+91 98765 43214', 'Faculty Quarters, Aditya University Campus, AP'),
(6, 'Rohan Verma', 'rohan.v@example.com', '+91 91234 56780', '42 Tech Park Avenue, Hyderabad, Telangana');

-- 4. Orders
INSERT INTO "Order" (Order_ID, Order_Date, Customer_ID, Total_Amount) VALUES
(1001, '2026-09-28 10:15:00', 1, 1074.00),
(1002, '2026-09-29 14:30:00', 2, 85.00),
(1003, '2026-09-30 09:45:00', 3, 111.00),
(1004, '2026-10-01 16:20:00', 4, 448.00),
(1005, '2026-10-02 11:10:00', 5, 264.00),
(1006, '2026-10-02 18:05:00', 6, 1298.00);

-- 5. Order_Items
INSERT INTO Order_Item (Order_Item_ID, Order_ID, Product_ID, Quantity) VALUES
(5001, 1001, 101, 1), -- MacBook Air ($999)
(5002, 1001, 111, 1), -- Database System Concepts ($75)
(5003, 1002, 107, 1), -- Running Shoes ($85)
(5004, 1003, 111, 1), -- Database System Concepts ($75)
(5005, 1003, 113, 1), -- Python Crash Course ($36)
(5006, 1004, 102, 1), -- Sony Headphones ($349)
(5007, 1004, 104, 1), -- Logitech Mouse ($99)
(5008, 1005, 109, 1), -- Office Chair ($189)
(5009, 1005, 111, 1), -- Database Book ($75)
(5010, 1006, 103, 1), -- Samsung Galaxy S24 ($1199)
(5011, 1006, 104, 1); -- Logitech Mouse ($99)

-- 6. Payments
INSERT INTO Payment (Payment_ID, Order_ID, Payment_Date, Amount, Status) VALUES
(9001, 1001, '2026-09-28 10:16:30', 1074.00, 'Completed'),
(9002, 1002, '2026-09-29 14:32:10', 85.00, 'Completed'),
(9003, 1003, '2026-09-30 09:47:00', 111.00, 'Completed'),
(9004, 1004, '2026-10-01 16:21:45', 448.00, 'Completed'),
(9005, 1005, '2026-10-02 11:12:00', 264.00, 'Completed'),
(9006, 1006, '2026-10-02 18:06:15', 1298.00, 'Pending');

-- 7. Deliveries
INSERT INTO Delivery (Delivery_ID, Order_ID, Delivery_Date, Status) VALUES
(8001, 1001, '2026-09-30 15:00:00', 'Delivered'),
(8002, 1002, '2026-10-01 12:30:00', 'Delivered'),
(8003, 1003, '2026-10-03 17:00:00', 'In Transit'),
(8004, 1004, '2026-10-04 14:00:00', 'In Transit'),
(8005, 1005, '2026-10-05 11:00:00', 'Processing'),
(8006, 1006, '2026-10-06 10:00:00', 'Pending');
