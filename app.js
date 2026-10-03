/**
 * Database Management System - Frontend Application Logic
 * Department of Computer Science & Engineering
 * E-Commerce Relational Prototype
 */

// Global State
const state = {
    activeTab: 'storefront',
    activeTable: 'Customer',
    tablesMeta: [],
    tablesData: {},
    categories: [],
    products: [],
    customers: [],
    cart: [],
    isOffline: false,
    selectedCategory: null,
    searchQuery: '',
    sortBy: 'featured',
    editMode: false,
    editRecordId: null,
    lastPlacedOrder: null
};

// Preset Capstone Queries
const PRESET_QUERIES = {
    1: `-- 1. Full Order Master (4-Table JOIN: Order + Customer + Payment + Delivery)
SELECT 
    o.Order_ID, 
    o.Order_Date, 
    c.Name AS Customer_Name, 
    c.Email, 
    o.Total_Amount, 
    p.Status AS Payment_Status, 
    d.Status AS Delivery_Status, 
    d.Delivery_Date
FROM "Order" o
JOIN Customer c ON o.Customer_ID = c.Customer_ID
LEFT JOIN Payment p ON o.Order_ID = p.Order_ID
LEFT JOIN Delivery d ON o.Order_ID = d.Order_ID
ORDER BY o.Order_ID DESC;`,

    2: `-- 2. Category Sales & Revenue Breakdown (Aggregation & GROUP BY)
SELECT 
    c.Category_ID,
    c.Category_Name, 
    COUNT(DISTINCT oi.Order_ID) AS Total_Orders_Placed,
    SUM(oi.Quantity) AS Units_Sold,
    ROUND(SUM(oi.Quantity * p.Price), 2) AS Total_Revenue
FROM Category c
JOIN Product p ON c.Category_ID = p.Category_ID
JOIN Order_Item oi ON p.Product_ID = oi.Product_ID
GROUP BY c.Category_ID, c.Category_Name
ORDER BY Total_Revenue DESC;`,

    3: `-- 3. Customer Spending & Purchase History
SELECT 
    c.Customer_ID, 
    c.Name, 
    c.Email, 
    COUNT(o.Order_ID) AS Total_Orders, 
    ROUND(COALESCE(SUM(o.Total_Amount), 0), 2) AS Lifetime_Spent
FROM Customer c
LEFT JOIN "Order" o ON c.Customer_ID = o.Customer_ID
GROUP BY c.Customer_ID
ORDER BY Lifetime_Spent DESC;`,

    4: `-- 4. Active Deliveries Fulfillment List (Filtering WHERE Status != 'Delivered')
SELECT 
    d.Delivery_ID, 
    d.Order_ID, 
    c.Name AS Customer_Name, 
    c.Phone, 
    c.Address, 
    d.Delivery_Date, 
    d.Status AS Delivery_Status
FROM Delivery d
JOIN "Order" o ON d.Order_ID = o.Order_ID
JOIN Customer c ON o.Customer_ID = c.Customer_ID
WHERE d.Status != 'Delivered'
ORDER BY d.Delivery_Date ASC;`,

    5: `-- 5. Low Inventory Stock Alert (< 20 units remaining)
SELECT 
    p.Product_ID, 
    p.Product_Name, 
    c.Category_Name, 
    p.Price, 
    p.Stock,
    CASE 
        WHEN p.Stock = 0 THEN 'OUT OF STOCK' 
        WHEN p.Stock < 15 THEN 'CRITICAL' 
        ELSE 'LOW' 
    END AS Stock_Alert_Level
FROM Product p
JOIN Category c ON p.Category_ID = c.Category_ID
WHERE p.Stock < 20
ORDER BY p.Stock ASC;`
};

// -------------------------------------------------------------
// Initialization
// -------------------------------------------------------------

document.addEventListener('DOMContentLoaded', async () => {
    initIcons();
    await checkBackendConnection();
    await loadInitialData();
    setupEventListeners();
    loadPresetQuery(1);
});

function initIcons() {
    if (window.lucide) {
        window.lucide.createIcons();
    }
}

async function checkBackendConnection() {
    try {
        const res = await fetch('/api/summary', { signal: AbortSignal.timeout(2000) });
        if (res.ok) {
            state.isOffline = false;
            updateStatusBadge(true);
        } else {
            throw new Error("Backend responded with non-200");
        }
    } catch (e) {
        state.isOffline = true;
        updateStatusBadge(false);
        console.warn("Backend offline or running file://, using in-memory mock DBMS engine.");
        initMockData();
    }
}

function updateStatusBadge(isOnline) {
    const badge = document.getElementById('backend-status');
    const badgeText = document.getElementById('backend-status-text');
    if (!badge || !badgeText) return;

    if (isOnline) {
        badge.className = "flex items-center gap-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-full font-medium";
        badgeText.textContent = "SQLite REST API Active";
    } else {
        badge.className = "flex items-center gap-1.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2.5 py-1 rounded-full font-medium";
        badgeText.textContent = "Offline Mock Mode";
    }
}

async function loadInitialData() {
    await Promise.all([
        refreshSummaryStats(),
        loadCategories(),
        loadProducts(),
        loadCustomers(),
        loadTablesMeta()
    ]);
    renderStorefront();
    renderEntityTabs();
    loadTable(state.activeTable);
}

function setupEventListeners() {
    // Keyboard shortcut for SQL execution
    const sqlTextarea = document.getElementById('sql-input');
    if (sqlTextarea) {
        sqlTextarea.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                executeCurrentQuery();
            }
        });
    }
}

// -------------------------------------------------------------
// Navigation & Tab Switching
// -------------------------------------------------------------

function switchTab(tabId) {
    state.activeTab = tabId;

    // Update Tab Buttons
    document.querySelectorAll('.nav-tab').forEach(btn => {
        btn.classList.remove('bg-sky-600', 'text-white');
        btn.classList.add('text-slate-300', 'hover:text-white', 'hover:bg-slate-800');
    });

    const activeBtn = document.getElementById(`nav-tab-${tabId}`);
    if (activeBtn) {
        activeBtn.classList.add('bg-sky-600', 'text-white');
        activeBtn.classList.remove('text-slate-300', 'hover:text-white', 'hover:bg-slate-800');
    }

    // Update Tab Content Sections
    document.querySelectorAll('.tab-content').forEach(section => {
        section.classList.remove('active');
    });

    const targetSection = document.getElementById(`tab-${tabId}`);
    if (targetSection) {
        targetSection.classList.add('active');
    }

    // Refresh context if needed
    if (tabId === 'dbms') {
        refreshSummaryStats();
        loadTable(state.activeTable);
    } else if (tabId === 'storefront') {
        loadProducts();
    }

    initIcons();
}

// -------------------------------------------------------------
// Data Fetching & API Communication
// -------------------------------------------------------------

async function refreshSummaryStats() {
    try {
        let data;
        if (!state.isOffline) {
            const res = await fetch('/api/summary');
            data = await res.json();
        } else {
            data = getMockSummary();
        }

        const revEl = document.getElementById('stat-revenue');
        const ordEl = document.getElementById('stat-orders');
        const custEl = document.getElementById('stat-customers');
        const delEl = document.getElementById('stat-deliveries');

        if (revEl) revEl.textContent = `$${(data.total_revenue || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
        if (ordEl) ordEl.textContent = data.counts?.Order || 0;
        if (custEl) custEl.textContent = data.counts?.Customer || 0;
        if (delEl) delEl.textContent = data.pending_deliveries || 0;
    } catch (e) {
        console.error("Failed to refresh stats:", e);
    }
}

async function loadCategories() {
    try {
        if (!state.isOffline) {
            const res = await fetch('/api/table/Category');
            const data = await res.json();
            state.categories = data.rows || [];
        } else {
            state.categories = mockDB.Category;
        }
        renderCategoryPills();
    } catch (e) {
        console.error("Error loading categories:", e);
    }
}

async function loadProducts() {
    try {
        if (!state.isOffline) {
            const res = await fetch('/api/table/Product');
            const data = await res.json();
            state.products = data.rows || [];
        } else {
            state.products = mockDB.Product.map(p => {
                const cat = mockDB.Category.find(c => c.Category_ID === p.Category_ID);
                return { ...p, Category_Name: cat ? cat.Category_Name : '' };
            });
        }
        renderProductsGrid();
    } catch (e) {
        console.error("Error loading products:", e);
    }
}

async function loadCustomers() {
    try {
        if (!state.isOffline) {
            const res = await fetch('/api/table/Customer');
            const data = await res.json();
            state.customers = data.rows || [];
        } else {
            state.customers = mockDB.Customer;
        }
        populateCustomerSelect();
    } catch (e) {
        console.error("Error loading customers:", e);
    }
}

async function loadTablesMeta() {
    try {
        if (!state.isOffline) {
            const res = await fetch('/api/tables');
            const data = await res.json();
            state.tablesMeta = data.tables || [];
        } else {
            state.tablesMeta = getMockTablesMeta();
        }
    } catch (e) {
        console.error("Error loading tables meta:", e);
    }
}

// -------------------------------------------------------------
// Storefront Rendering & Interactions
// -------------------------------------------------------------

function renderCategoryPills() {
    const container = document.getElementById('storefront-category-pills');
    if (!container) return;

    let html = `
        <button onclick="filterCategory(null)" class="cat-pill ${state.selectedCategory === null ? 'bg-sky-600 text-white font-semibold' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'} px-3.5 py-1.5 rounded-lg text-xs transition whitespace-nowrap">
            All (${state.products.length})
        </button>
    `;

    state.categories.forEach(cat => {
        const count = state.products.filter(p => p.Category_ID === cat.Category_ID).length;
        const isActive = state.selectedCategory === cat.Category_ID;
        html += `
            <button onclick="filterCategory(${cat.Category_ID})" class="cat-pill ${isActive ? 'bg-sky-600 text-white font-semibold' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'} px-3.5 py-1.5 rounded-lg text-xs transition whitespace-nowrap">
                ${escapeHtml(cat.Category_Name)} (${count})
            </button>
        `;
    });

    container.innerHTML = html;
}

function filterCategory(catId) {
    state.selectedCategory = catId;
    renderCategoryPills();
    renderProductsGrid();
}

function handleStoreSearch() {
    const input = document.getElementById('store-search-input');
    state.searchQuery = input ? input.value.trim().toLowerCase() : '';
    renderProductsGrid();
}

function handleStoreSort() {
    const select = document.getElementById('store-sort-select');
    state.sortBy = select ? select.value : 'featured';
    renderProductsGrid();
}

function renderProductsGrid() {
    const grid = document.getElementById('store-products-grid');
    if (!grid) return;

    let list = [...state.products];

    // Filter by Category
    if (state.selectedCategory !== null) {
        list = list.filter(p => p.Category_ID === state.selectedCategory);
    }

    // Filter by Search Query
    if (state.searchQuery) {
        list = list.filter(p => 
            p.Product_Name.toLowerCase().includes(state.searchQuery) ||
            (p.Category_Name && p.Category_Name.toLowerCase().includes(state.searchQuery))
        );
    }

    // Sort
    if (state.sortBy === 'price-asc') {
        list.sort((a, b) => a.Price - b.Price);
    } else if (state.sortBy === 'price-desc') {
        list.sort((a, b) => b.Price - a.Price);
    } else if (state.sortBy === 'stock-desc') {
        list.sort((a, b) => b.Stock - a.Stock);
    }

    if (list.length === 0) {
        grid.innerHTML = `
            <div class="col-span-full py-12 text-center text-slate-400">
                <i data-lucide="package-x" class="w-12 h-12 mx-auto text-slate-300 mb-2"></i>
                <p class="font-medium text-sm">No products found matching your criteria</p>
                <button onclick="clearStoreFilters()" class="mt-3 text-xs text-sky-600 hover:underline">Clear all filters</button>
            </div>
        `;
        initIcons();
        return;
    }

    grid.innerHTML = list.map(p => {
        const isOutOfStock = p.Stock <= 0;
        const isLowStock = p.Stock > 0 && p.Stock < 15;
        const categoryName = p.Category_Name || (state.categories.find(c => c.Category_ID === p.Category_ID)?.Category_Name || 'General');

        return `
            <div class="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition flex flex-col justify-between group">
                <div class="p-5 space-y-3">
                    <div class="flex items-center justify-between text-xs">
                        <span class="bg-slate-100 text-slate-700 font-medium px-2 py-0.5 rounded text-[11px]">
                            ${escapeHtml(categoryName)}
                        </span>
                        <span class="font-mono text-slate-400 text-[10px]">#PID-${p.Product_ID}</span>
                    </div>

                    <h3 class="font-bold text-slate-900 text-sm group-hover:text-sky-600 transition leading-snug">
                        ${escapeHtml(p.Product_Name)}
                    </h3>

                    <div class="flex items-baseline justify-between pt-1">
                        <div class="text-lg font-extrabold text-slate-900 font-mono">
                            $${Number(p.Price).toFixed(2)}
                        </div>
                        <div>
                            ${isOutOfStock 
                                ? `<span class="bg-red-50 text-red-600 text-[11px] font-bold px-2 py-0.5 rounded border border-red-200">Out of Stock</span>`
                                : isLowStock 
                                ? `<span class="bg-amber-50 text-amber-700 text-[11px] font-medium px-2 py-0.5 rounded border border-amber-200">Only ${p.Stock} left</span>`
                                : `<span class="bg-emerald-50 text-emerald-700 text-[11px] font-medium px-2 py-0.5 rounded border border-emerald-200">In Stock (${p.Stock})</span>`
                            }
                        </div>
                    </div>
                </div>

                <div class="p-4 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between">
                    <div class="text-[11px] text-slate-500">
                        FK: <code class="font-mono text-slate-700">Cat_ID:${p.Category_ID}</code>
                    </div>
                    <button onclick="addToCart(${p.Product_ID})" ${isOutOfStock ? 'disabled' : ''} class="flex items-center gap-1.5 bg-sky-600 hover:bg-sky-500 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-xs font-semibold px-3 py-1.5 rounded-lg shadow-sm transition">
                        <i data-lucide="plus" class="w-3.5 h-3.5"></i>
                        <span>Add to Cart</span>
                    </button>
                </div>
            </div>
        `;
    }).join('');

    initIcons();
}

function clearStoreFilters() {
    state.selectedCategory = null;
    state.searchQuery = '';
    const input = document.getElementById('store-search-input');
    if (input) input.value = '';
    renderCategoryPills();
    renderProductsGrid();
}

// -------------------------------------------------------------
// Shopping Cart Logic
// -------------------------------------------------------------

function toggleCartDrawer() {
    const drawer = document.getElementById('cart-drawer');
    const overlay = document.getElementById('cart-drawer-overlay');
    if (!drawer || !overlay) return;

    const isOpen = !drawer.classList.contains('translate-x-full');
    if (isOpen) {
        drawer.classList.add('translate-x-full');
        overlay.classList.add('hidden');
    } else {
        drawer.classList.remove('translate-x-full');
        overlay.classList.remove('hidden');
        renderCart();
    }
}

function addToCart(productId) {
    const product = state.products.find(p => p.Product_ID === productId);
    if (!product || product.Stock <= 0) {
        showToast("Product is out of stock", "error");
        return;
    }

    const existing = state.cart.find(item => item.product_id === productId);
    if (existing) {
        if (existing.quantity >= product.Stock) {
            showToast(`Cannot add more than ${product.Stock} units in stock`, "warning");
            return;
        }
        existing.quantity += 1;
    } else {
        state.cart.push({
            product_id: product.Product_ID,
            product_name: product.Product_Name,
            price: Number(product.Price),
            quantity: 1,
            max_stock: product.Stock
        });
    }

    updateCartBadge();
    showToast(`Added '${product.Product_Name}' to cart!`, "success");
    renderCart();
}

function updateCartQuantity(productId, delta) {
    const item = state.cart.find(i => i.product_id === productId);
    if (!item) return;

    item.quantity += delta;
    if (item.quantity > item.max_stock) {
        item.quantity = item.max_stock;
        showToast(`Maximum stock limit is ${item.max_stock}`, "warning");
    }

    if (item.quantity <= 0) {
        state.cart = state.cart.filter(i => i.product_id !== productId);
    }

    updateCartBadge();
    renderCart();
}

function removeCartItem(productId) {
    state.cart = state.cart.filter(i => i.product_id !== productId);
    updateCartBadge();
    renderCart();
}

function updateCartBadge() {
    const count = state.cart.reduce((sum, item) => sum + item.quantity, 0);
    const badge = document.getElementById('cart-badge-count');
    if (badge) badge.textContent = count;

    const checkoutBtn = document.getElementById('btn-checkout');
    if (checkoutBtn) {
        checkoutBtn.disabled = state.cart.length === 0;
    }
}

function renderCart() {
    const list = document.getElementById('cart-items-list');
    const subtotalEl = document.getElementById('cart-subtotal');
    const taxEl = document.getElementById('cart-tax');
    const totalEl = document.getElementById('cart-total');
    if (!list) return;

    if (state.cart.length === 0) {
        list.innerHTML = `
            <div class="py-16 text-center text-slate-400">
                <i data-lucide="shopping-cart" class="w-12 h-12 mx-auto text-slate-300 mb-2"></i>
                <p class="font-medium text-xs">Your cart is empty</p>
                <p class="text-[11px] text-slate-400 mt-1">Browse products and add items to simulate a DBMS transaction!</p>
            </div>
        `;
        if (subtotalEl) subtotalEl.textContent = '$0.00';
        if (taxEl) taxEl.textContent = '$0.00';
        if (totalEl) totalEl.textContent = '$0.00';
        initIcons();
        return;
    }

    let subtotal = 0;
    list.innerHTML = state.cart.map(item => {
        const itemTotal = item.price * item.quantity;
        subtotal += itemTotal;
        return `
            <div class="bg-slate-50 p-3 rounded-lg border border-slate-200 flex items-center justify-between gap-3 text-xs">
                <div class="flex-1 min-w-0">
                    <h4 class="font-bold text-slate-900 truncate">${escapeHtml(item.product_name)}</h4>
                    <p class="text-slate-500 font-mono text-[11px]">$${item.price.toFixed(2)} each</p>
                </div>
                <div class="flex items-center space-x-2">
                    <button onclick="updateCartQuantity(${item.product_id}, -1)" class="w-6 h-6 rounded bg-white border border-slate-300 text-slate-700 flex items-center justify-center font-bold hover:bg-slate-100">-</button>
                    <span class="font-mono font-bold w-5 text-center">${item.quantity}</span>
                    <button onclick="updateCartQuantity(${item.product_id}, 1)" class="w-6 h-6 rounded bg-white border border-slate-300 text-slate-700 flex items-center justify-center font-bold hover:bg-slate-100">+</button>
                </div>
                <div class="text-right min-w-[60px]">
                    <div class="font-mono font-bold text-slate-900">$${itemTotal.toFixed(2)}</div>
                    <button onclick="removeCartItem(${item.product_id})" class="text-[10px] text-red-500 hover:underline">Remove</button>
                </div>
            </div>
        `;
    }).join('');

    const tax = subtotal * 0.05;
    const total = subtotal + tax;

    if (subtotalEl) subtotalEl.textContent = `$${subtotal.toFixed(2)}`;
    if (taxEl) taxEl.textContent = `$${tax.toFixed(2)}`;
    if (totalEl) totalEl.textContent = `$${total.toFixed(2)}`;

    initIcons();
}

// -------------------------------------------------------------
// Checkout Modal & Atomic Transaction Simulation
// -------------------------------------------------------------

function populateCustomerSelect() {
    const select = document.getElementById('checkout-customer-select');
    if (!select) return;

    select.innerHTML = state.customers.map(c => `
        <option value="${c.Customer_ID}">
            ID #${c.Customer_ID} - ${escapeHtml(c.Name)} (${escapeHtml(c.Email)})
        </option>
    `).join('');
}

function openCheckoutModal() {
    if (state.cart.length === 0) return;
    toggleCartDrawer(); // Close drawer
    populateCustomerSelect();
    const modal = document.getElementById('checkout-modal');
    if (modal) modal.classList.remove('hidden');
    initIcons();
}

function closeCheckoutModal() {
    const modal = document.getElementById('checkout-modal');
    if (modal) modal.classList.add('hidden');
}

function toggleNewCustomerFields() {
    const container = document.getElementById('new-customer-fields');
    const link = document.getElementById('toggle-cust-link');
    const select = document.getElementById('checkout-customer-select');
    if (!container || !link) return;

    const isHidden = container.classList.contains('hidden');
    if (isHidden) {
        container.classList.remove('hidden');
        link.textContent = "- Use Existing Customer";
        if (select) select.disabled = true;
    } else {
        container.classList.add('hidden');
        link.textContent = "+ New Customer";
        if (select) select.disabled = false;
    }
}

async function handleCheckoutSubmit(e) {
    e.preventDefault();

    const isNew = !document.getElementById('new-customer-fields').classList.contains('hidden');
    const paymentStatus = document.getElementById('checkout-payment-status').value;

    let payload = {
        items: state.cart.map(i => ({ product_id: i.product_id, quantity: i.quantity })),
        payment_method: paymentStatus
    };

    if (isNew) {
        const name = document.getElementById('new-cust-name').value.trim();
        const email = document.getElementById('new-cust-email').value.trim();
        const phone = document.getElementById('new-cust-phone').value.trim();
        const address = document.getElementById('new-cust-address').value.trim();

        if (!name || !email || !phone || !address) {
            showToast("Please fill all customer fields", "warning");
            return;
        }

        payload.customer = { Name: name, Email: email, Phone: phone, Address: address };
    } else {
        const customerId = parseInt(document.getElementById('checkout-customer-select').value);
        payload.customer_id = customerId;
    }

    const submitBtn = document.getElementById('btn-confirm-order');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<span class="animate-spin mr-1">⏳</span> Committing Transaction...`;
    }

    try {
        let result;
        if (!state.isOffline) {
            const res = await fetch('/api/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            result = await res.json();
            if (!res.ok) throw new Error(result.error || "Checkout failed");
        } else {
            result = mockCheckout(payload);
        }

        // Order placed successfully!
        state.lastPlacedOrder = result.order;
        state.cart = [];
        updateCartBadge();
        closeCheckoutModal();

        // Refresh app state
        await Promise.all([
            refreshSummaryStats(),
            loadProducts(),
            loadCustomers(),
            loadTable(state.activeTable)
        ]);

        showOrderSuccessModal(result.order);
        showToast("Order transaction successfully committed!", "success");
    } catch (err) {
        showToast(err.message, "error");
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = `<i data-lucide="check" class="w-4 h-4"></i> <span>Confirm & Commit Order</span>`;
            initIcons();
        }
    }
}

function showOrderSuccessModal(order) {
    const modal = document.getElementById('order-success-modal');
    const content = document.getElementById('order-receipt-content');
    if (!modal || !content) return;

    content.innerHTML = `
        <div class="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-2">
            <div class="flex justify-between items-center pb-2 border-b border-slate-200">
                <span class="text-slate-500">Order Primary Key:</span>
                <span class="badge-pk font-mono text-xs">🔑 Order_ID: #${order.Order_ID}</span>
            </div>
            <div class="flex justify-between items-center">
                <span class="text-slate-500">Customer (FK &rarr; Customer):</span>
                <span class="font-bold text-slate-800">#${order.Customer_ID} - ${escapeHtml(order.Customer_Name)}</span>
            </div>
            <div class="flex justify-between items-center">
                <span class="text-slate-500">Total Billed:</span>
                <span class="font-mono font-bold text-slate-900">$${Number(order.Total_Amount).toFixed(2)}</span>
            </div>
            <div class="flex justify-between items-center">
                <span class="text-slate-500">Payment Record:</span>
                <span class="badge-fk">🔗 Payment_ID: #${order.Payment_ID} (${order.Payment_Status})</span>
            </div>
            <div class="flex justify-between items-center">
                <span class="text-slate-500">Delivery Tracking:</span>
                <span class="badge-fk">🔗 Delivery_ID: #${order.Delivery_ID} (${order.Delivery_Status})</span>
            </div>
            <div class="flex justify-between items-center">
                <span class="text-slate-500">Items Cascaded:</span>
                <span class="font-semibold text-slate-700">${order.Items_Count || order.Items?.length} items inserted into Order_Item</span>
            </div>
        </div>
        <p class="text-[11px] text-slate-500 italic text-center">
            All 5 relational tables were automatically updated adhering to primary/foreign key constraints.
        </p>
    `;

    modal.classList.remove('hidden');
    initIcons();
}

function closeOrderSuccessModal() {
    const modal = document.getElementById('order-success-modal');
    if (modal) modal.classList.add('hidden');
}

function viewOrderInAdmin() {
    closeOrderSuccessModal();
    switchTab('dbms');
    switchEntityTable('Order');
    if (state.lastPlacedOrder) {
        showOrderDossier(state.lastPlacedOrder.Order_ID);
    }
}

// -------------------------------------------------------------
// DBMS Admin Console (7 Tables CRUD & Relational Inspector)
// -------------------------------------------------------------

const ENTITY_CONFIG = {
    Customer: { icon: 'users', label: '1. Customer', pk: 'Customer_ID', fks: [] },
    Product: { icon: 'package', label: '2. Product', pk: 'Product_ID', fks: [{ col: 'Category_ID', target: 'Category' }] },
    Category: { icon: 'tag', label: '3. Category', pk: 'Category_ID', fks: [] },
    Order: { icon: 'shopping-cart', label: '4. Order', pk: 'Order_ID', fks: [{ col: 'Customer_ID', target: 'Customer' }] },
    Order_Item: { icon: 'list-ordered', label: '5. Order_Item', pk: 'Order_Item_ID', fks: [{ col: 'Order_ID', target: 'Order' }, { col: 'Product_ID', target: 'Product' }] },
    Payment: { icon: 'credit-card', label: '6. Payment', pk: 'Payment_ID', fks: [{ col: 'Order_ID', target: 'Order' }] },
    Delivery: { icon: 'truck', label: '7. Delivery', pk: 'Delivery_ID', fks: [{ col: 'Order_ID', target: 'Order' }] }
};

function renderEntityTabs() {
    const container = document.getElementById('dbms-entity-tabs');
    if (!container) return;

    container.innerHTML = Object.keys(ENTITY_CONFIG).map(tableName => {
        const config = ENTITY_CONFIG[tableName];
        const isActive = state.activeTable === tableName;
        return `
            <button onclick="switchEntityTable('${tableName}')" class="flex items-center gap-2 px-4 py-3 border-b-2 text-xs font-semibold whitespace-nowrap transition ${
                isActive 
                ? 'border-sky-600 text-sky-600 bg-sky-50/50' 
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
            }">
                <i data-lucide="${config.icon}" class="w-4 h-4"></i>
                <span>${config.label}</span>
            </button>
        `;
    }).join('');

    initIcons();
}

function switchEntityTable(tableName) {
    state.activeTable = tableName;
    renderEntityTabs();

    // Update headings
    const heading = document.getElementById('current-table-heading');
    const labelBtn = document.getElementById('btn-add-record-label');
    const keysSummary = document.getElementById('table-keys-summary');

    if (heading) heading.textContent = `${tableName} Entity Table`;
    if (labelBtn) labelBtn.textContent = `Add ${tableName}`;
    
    const meta = state.tablesMeta.find(t => t.table_name === tableName);
    if (keysSummary && meta) {
        const pk = meta.pk_field;
        const fks = meta.foreign_keys?.map(f => `${f.from}&rarr;${f.to_table}`).join(', ') || 'None';
        keysSummary.innerHTML = `<span class="badge-pk">PK: ${pk}</span> ${fks !== 'None' ? `<span class="badge-fk ml-1">FK: ${fks}</span>` : ''}`;
    }

    // Clear search
    const search = document.getElementById('dbms-table-search');
    if (search) search.value = '';

    loadTable(tableName);
}

async function loadTable(tableName) {
    try {
        let rows = [];
        if (!state.isOffline) {
            const res = await fetch(`/api/table/${tableName}`);
            const data = await res.json();
            rows = data.rows || [];
        } else {
            rows = getMockTableRows(tableName);
        }

        state.tablesData[tableName] = rows;
        renderCurrentTable(rows);
    } catch (e) {
        console.error(`Error loading table ${tableName}:`, e);
        showToast(`Failed to load ${tableName}`, "error");
    }
}

function renderCurrentTable(rows) {
    const thead = document.getElementById('dbms-table-head');
    const tbody = document.getElementById('dbms-table-body');
    const countBadge = document.getElementById('table-row-count-badge');
    if (!thead || !tbody) return;

    if (countBadge) countBadge.textContent = `${rows.length} rows`;

    if (!rows || rows.length === 0) {
        thead.innerHTML = `<tr><th class="px-4 py-3 text-slate-400">No records</th></tr>`;
        tbody.innerHTML = `
            <tr>
                <td class="px-4 py-8 text-center text-slate-400">
                    No records found in this entity table. Click "Add Record" to insert one.
                </td>
            </tr>
        `;
        return;
    }

    const columns = Object.keys(rows[0]);
    const pkCol = ENTITY_CONFIG[state.activeTable]?.pk;

    // Table Header
    thead.innerHTML = `
        <tr>
            ${columns.map(col => {
                const isPk = col === pkCol;
                const isFk = col.endsWith('_ID') && !isPk;
                return `
                    <th class="px-4 py-3 whitespace-nowrap">
                        <div class="flex items-center gap-1.5">
                            <span>${escapeHtml(col)}</span>
                            ${isPk ? `<span class="badge-pk">PK</span>` : ''}
                            ${isFk ? `<span class="badge-fk">FK</span>` : ''}
                        </div>
                    </th>
                `;
            }).join('')}
            <th class="px-4 py-3 text-right">Actions</th>
        </tr>
    `;

    // Table Rows
    tbody.innerHTML = rows.map(row => {
        const pkVal = row[pkCol];
        const isOrderTable = state.activeTable === 'Order';

        return `
            <tr class="hover:bg-slate-50 transition font-mono text-xs">
                ${columns.map(col => {
                    let val = row[col];
                    const isPk = col === pkCol;
                    const isFk = col.endsWith('_ID') && !isPk;

                    // Formatter for status
                    if (col === 'Status' || col === 'Payment_Status' || col === 'Delivery_Status') {
                        let color = 'bg-slate-100 text-slate-700';
                        if (val === 'Completed' || val === 'Delivered') color = 'bg-emerald-50 text-emerald-700 border border-emerald-200';
                        if (val === 'Pending' || val === 'Processing' || val === 'In Transit') color = 'bg-amber-50 text-amber-700 border border-amber-200';
                        if (val === 'Failed' || val === 'Cancelled') color = 'bg-red-50 text-red-700 border border-red-200';
                        return `<td class="px-4 py-3 whitespace-nowrap"><span class="px-2 py-0.5 rounded text-[10px] font-bold ${color}">${val}</span></td>`;
                    }

                    // Formatter for Amount / Price
                    if (col === 'Price' || col === 'Total_Amount' || col === 'Amount' || col === 'Item_Subtotal') {
                        return `<td class="px-4 py-3 whitespace-nowrap font-bold text-slate-800">$${Number(val).toFixed(2)}</td>`;
                    }

                    return `
                        <td class="px-4 py-3 whitespace-nowrap text-slate-700">
                            ${isPk ? `<span class="font-bold text-slate-900 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">${val}</span>` : ''}
                            ${isFk ? `<span class="text-sky-700 bg-sky-50 px-1.5 py-0.5 rounded border border-sky-200">${val}</span>` : ''}
                            ${!isPk && !isFk ? escapeHtml(val ?? '') : ''}
                        </td>
                    `;
                }).join('')}

                <td class="px-4 py-3 whitespace-nowrap text-right space-x-1 font-sans">
                    ${isOrderTable ? `
                        <button onclick="showOrderDossier(${pkVal})" title="View Connected Relational Records" class="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded text-[11px] font-semibold transition border border-indigo-200">
                            Inspect
                        </button>
                    ` : ''}
                    <button onclick="openEditRecordModal(${pkVal})" title="Edit Record" class="px-2 py-1 bg-sky-50 hover:bg-sky-100 text-sky-700 rounded text-[11px] font-medium transition border border-sky-200">
                        Edit
                    </button>
                    <button onclick="deleteRecord('${state.activeTable}', ${pkVal})" title="Delete Record" class="px-2 py-1 bg-red-50 hover:bg-red-100 text-red-600 rounded text-[11px] font-medium transition border border-red-200">
                        Del
                    </button>
                </td>
            </tr>
        `;
    }).join('');

    initIcons();
}

function filterCurrentTable() {
    const input = document.getElementById('dbms-table-search');
    const q = input ? input.value.trim().toLowerCase() : '';
    const allRows = state.tablesData[state.activeTable] || [];

    if (!q) {
        renderCurrentTable(allRows);
        return;
    }

    const filtered = allRows.filter(row => {
        return Object.values(row).some(v => String(v).toLowerCase().includes(q));
    });

    renderCurrentTable(filtered);
}

// -------------------------------------------------------------
// CRUD Operations (Add, Edit, Delete)
// -------------------------------------------------------------

function openAddRecordModal() {
    state.editMode = false;
    state.editRecordId = null;

    const modal = document.getElementById('crud-modal');
    const title = document.getElementById('crud-modal-title');
    const fieldsContainer = document.getElementById('crud-form-fields');
    if (!modal || !title || !fieldsContainer) return;

    title.textContent = `Add Record to ${state.activeTable}`;

    const meta = state.tablesMeta.find(t => t.table_name === state.activeTable);
    const columns = meta ? meta.columns : [];

    fieldsContainer.innerHTML = buildFormFields(columns, null);
    modal.classList.remove('hidden');
    initIcons();
}

function openEditRecordModal(id) {
    state.editMode = true;
    state.editRecordId = id;

    const modal = document.getElementById('crud-modal');
    const title = document.getElementById('crud-modal-title');
    const fieldsContainer = document.getElementById('crud-form-fields');
    if (!modal || !title || !fieldsContainer) return;

    title.textContent = `Edit Record #${id} in ${state.activeTable}`;

    const meta = state.tablesMeta.find(t => t.table_name === state.activeTable);
    const columns = meta ? meta.columns : [];
    const pkCol = ENTITY_CONFIG[state.activeTable]?.pk;

    const existingRow = (state.tablesData[state.activeTable] || []).find(r => r[pkCol] == id);
    if (!existingRow) {
        showToast("Record not found", "error");
        return;
    }

    fieldsContainer.innerHTML = buildFormFields(columns, existingRow);
    modal.classList.remove('hidden');
    initIcons();
}

function closeCrudModal() {
    const modal = document.getElementById('crud-modal');
    if (modal) modal.classList.add('hidden');
}

function buildFormFields(columns, existingData) {
    const pkCol = ENTITY_CONFIG[state.activeTable]?.pk;

    return columns.map(col => {
        const colName = col.name;
        const isPk = col.pk || colName === pkCol;
        const val = existingData ? existingData[colName] ?? '' : '';

        // Primary key field
        if (isPk) {
            return `
                <div class="space-y-1">
                    <label class="block font-bold text-slate-700 text-xs">
                        ${escapeHtml(colName)} <span class="badge-pk">PK</span>
                    </label>
                    <input type="text" name="${colName}" value="${val}" ${state.editMode ? 'readonly' : 'placeholder="Auto-incremented (leave blank)"'} class="w-full bg-slate-100 border border-slate-300 rounded p-1.5 text-xs text-slate-600 font-mono">
                </div>
            `;
        }

        // Foreign Key selector: Category_ID
        if (colName === 'Category_ID') {
            return `
                <div class="space-y-1">
                    <label class="block font-bold text-slate-700 text-xs">
                        Category_ID <span class="badge-fk">FK &rarr; Category</span>
                    </label>
                    <select name="Category_ID" class="w-full bg-white border border-slate-300 rounded p-1.5 text-xs font-mono">
                        ${state.categories.map(c => `
                            <option value="${c.Category_ID}" ${val == c.Category_ID ? 'selected' : ''}>
                                #${c.Category_ID} - ${escapeHtml(c.Category_Name)}
                            </option>
                        `).join('')}
                    </select>
                </div>
            `;
        }

        // Foreign Key selector: Customer_ID
        if (colName === 'Customer_ID') {
            return `
                <div class="space-y-1">
                    <label class="block font-bold text-slate-700 text-xs">
                        Customer_ID <span class="badge-fk">FK &rarr; Customer</span>
                    </label>
                    <select name="Customer_ID" class="w-full bg-white border border-slate-300 rounded p-1.5 text-xs font-mono">
                        ${state.customers.map(c => `
                            <option value="${c.Customer_ID}" ${val == c.Customer_ID ? 'selected' : ''}>
                                #${c.Customer_ID} - ${escapeHtml(c.Name)}
                            </option>
                        `).join('')}
                    </select>
                </div>
            `;
        }

        // Status field with presets
        if (colName === 'Status') {
            let options = ['Pending', 'Processing', 'Delivered', 'Cancelled'];
            if (state.activeTable === 'Payment') {
                options = ['Completed', 'Pending', 'Failed', 'Refunded'];
            }
            return `
                <div class="space-y-1">
                    <label class="block font-bold text-slate-700 text-xs">${colName}</label>
                    <select name="${colName}" class="w-full bg-white border border-slate-300 rounded p-1.5 text-xs">
                        ${options.map(opt => `<option value="${opt}" ${val === opt ? 'selected' : ''}>${opt}</option>`).join('')}
                    </select>
                </div>
            `;
        }

        // General numeric or text inputs
        const isNumeric = col.type.includes('INT') || col.type.includes('REAL');
        const inputType = isNumeric ? 'number' : 'text';
        const step = col.type.includes('REAL') ? 'step="0.01"' : '';

        return `
            <div class="space-y-1">
                <label class="block font-bold text-slate-700 text-xs">${escapeHtml(colName)}</label>
                <input type="${inputType}" ${step} name="${colName}" value="${val}" required class="w-full bg-white border border-slate-300 rounded p-1.5 text-xs font-mono">
            </div>
        `;
    }).join('');
}

async function handleCrudSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);
    const payload = {};

    formData.forEach((value, key) => {
        if (value !== "") {
            payload[key] = value;
        }
    });

    const pkCol = ENTITY_CONFIG[state.activeTable]?.pk;

    try {
        if (state.editMode) {
            // Update
            if (!state.isOffline) {
                const res = await fetch(`/api/table/${state.activeTable}/${state.editRecordId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const resData = await res.json();
                if (!res.ok) throw new Error(resData.error || "Update failed");
            } else {
                mockUpdateRecord(state.activeTable, state.editRecordId, payload);
            }
            showToast(`Updated record #${state.editRecordId} in ${state.activeTable}`, "success");
        } else {
            // Insert
            if (!state.isOffline) {
                const res = await fetch(`/api/table/${state.activeTable}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const resData = await res.json();
                if (!res.ok) throw new Error(resData.error || "Insert failed");
            } else {
                mockInsertRecord(state.activeTable, payload);
            }
            showToast(`New record inserted into ${state.activeTable}`, "success");
        }

        closeCrudModal();

        // Refresh Data
        await Promise.all([
            refreshSummaryStats(),
            loadCategories(),
            loadProducts(),
            loadCustomers(),
            loadTable(state.activeTable)
        ]);
    } catch (err) {
        showToast(err.message, "error");
    }
}

async function deleteRecord(tableName, id) {
    if (!confirm(`Are you sure you want to delete record #${id} from '${tableName}'?`)) {
        return;
    }

    try {
        if (!state.isOffline) {
            const res = await fetch(`/api/table/${tableName}/${id}`, {
                method: 'DELETE'
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Delete failed");
        } else {
            mockDeleteRecord(tableName, id);
        }

        showToast(`Record #${id} deleted from ${tableName}`, "success");

        await Promise.all([
            refreshSummaryStats(),
            loadCategories(),
            loadProducts(),
            loadCustomers(),
            loadTable(state.activeTable)
        ]);
    } catch (err) {
        showToast(err.message, "error");
    }
}

async function resetDatabase() {
    if (!confirm("This will reset the database back to initial seed data. Continue?")) {
        return;
    }

    try {
        if (!state.isOffline) {
            const res = await fetch('/api/reset', { method: 'POST' });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Reset failed");
        } else {
            initMockData();
        }

        showToast("Database successfully reset to initial seed state!", "success");
        await loadInitialData();
    } catch (err) {
        showToast(err.message, "error");
    }
}

// -------------------------------------------------------------
// Order Relational Dossier (Drill-Down Inspector)
// -------------------------------------------------------------

async function showOrderDossier(orderId) {
    const modal = document.getElementById('order-dossier-modal');
    const title = document.getElementById('dossier-title');
    const content = document.getElementById('dossier-content');
    if (!modal || !content) return;

    if (title) title.textContent = `Order #${orderId} - Relational Dossier`;

    // Fetch related records: Order, Customer, Order_Items, Payment, Delivery
    let orderRow, customerRow, items, paymentRow, deliveryRow;

    if (!state.isOffline) {
        const orderRes = await fetch(`/api/table/Order`);
        const orderData = await orderRes.json();
        orderRow = (orderData.rows || []).find(o => o.Order_ID == orderId);

        const itemsRes = await fetch(`/api/table/Order_Item`);
        const itemsData = await itemsRes.json();
        items = (itemsData.rows || []).filter(oi => oi.Order_ID == orderId);

        const payRes = await fetch(`/api/table/Payment`);
        const payData = await payRes.json();
        paymentRow = (payData.rows || []).find(p => p.Order_ID == orderId);

        const delRes = await fetch(`/api/table/Delivery`);
        const delData = await delRes.json();
        deliveryRow = (delData.rows || []).find(d => d.Order_ID == orderId);

        if (orderRow) {
            const custRes = await fetch(`/api/table/Customer`);
            const custData = await custRes.json();
            customerRow = (custData.rows || []).find(c => c.Customer_ID == orderRow.Customer_ID);
        }
    } else {
        orderRow = mockDB.Order.find(o => o.Order_ID == orderId);
        if (orderRow) {
            customerRow = mockDB.Customer.find(c => c.Customer_ID == orderRow.Customer_ID);
        }
        items = mockDB.Order_Item.filter(oi => oi.Order_ID == orderId).map(oi => {
            const prod = mockDB.Product.find(p => p.Product_ID == oi.Product_ID);
            return {
                ...oi,
                Product_Name: prod ? prod.Product_Name : 'Item',
                Price: prod ? prod.Price : 0,
                Item_Subtotal: prod ? prod.Price * oi.Quantity : 0
            };
        });
        paymentRow = mockDB.Payment.find(p => p.Order_ID == orderId);
        deliveryRow = mockDB.Delivery.find(d => d.Order_ID == orderId);
    }

    if (!orderRow) {
        showToast("Order details could not be found", "error");
        return;
    }

    content.innerHTML = `
        <!-- Order Master Info -->
        <div class="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100 flex items-center justify-between">
            <div>
                <span class="badge-pk">🔑 Order_ID: #${orderRow.Order_ID}</span>
                <div class="text-xs text-slate-500 mt-1">Placed On: <span class="font-mono text-slate-700">${orderRow.Order_Date}</span></div>
            </div>
            <div class="text-right">
                <span class="text-xs text-slate-500">Total Billed:</span>
                <div class="text-lg font-extrabold text-indigo-900 font-mono">$${Number(orderRow.Total_Amount).toFixed(2)}</div>
            </div>
        </div>

        <!-- Customer Connected Record -->
        <div class="bg-white p-3.5 rounded-xl border border-slate-200">
            <h4 class="font-bold text-slate-900 text-xs mb-2 flex items-center gap-1.5">
                <i data-lucide="user" class="w-4 h-4 text-sky-600"></i>
                <span>Customer Record (FK Order.Customer_ID &rarr; Customer.Customer_ID)</span>
            </h4>
            ${customerRow ? `
                <div class="grid grid-cols-2 gap-2 text-xs">
                    <div><span class="text-slate-500">Name:</span> <strong class="text-slate-800">${escapeHtml(customerRow.Name)}</strong></div>
                    <div><span class="text-slate-500">Email:</span> <span class="font-mono text-slate-700">${escapeHtml(customerRow.Email)}</span></div>
                    <div><span class="text-slate-500">Phone:</span> <span class="font-mono text-slate-700">${escapeHtml(customerRow.Phone)}</span></div>
                    <div><span class="text-slate-500">Address:</span> <span class="text-slate-700">${escapeHtml(customerRow.Address)}</span></div>
                </div>
            ` : `<span class="text-slate-400 italic">No customer attached.</span>`}
        </div>

        <!-- Order Items -->
        <div class="bg-white p-3.5 rounded-xl border border-slate-200">
            <h4 class="font-bold text-slate-900 text-xs mb-2 flex items-center gap-1.5">
                <i data-lucide="list-ordered" class="w-4 h-4 text-violet-600"></i>
                <span>Purchased Line Items (Order_Item table)</span>
            </h4>
            <div class="divide-y divide-slate-100 font-mono text-xs">
                ${items.map(i => `
                    <div class="py-2 flex items-center justify-between">
                        <div>
                            <span class="font-sans font-bold text-slate-800">${escapeHtml(i.Product_Name || `Product #${i.Product_ID}`)}</span>
                            <div class="text-[11px] text-slate-400 font-mono">ID: #${i.Order_Item_ID} • Qty: ${i.Quantity} @ $${Number(i.Price || 0).toFixed(2)}</div>
                        </div>
                        <div class="font-bold text-slate-900">$${Number(i.Item_Subtotal || 0).toFixed(2)}</div>
                    </div>
                `).join('')}
            </div>
        </div>

        <!-- Payment & Delivery Split Grid -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <!-- Payment -->
            <div class="bg-white p-3.5 rounded-xl border border-slate-200">
                <h4 class="font-bold text-slate-900 text-xs mb-2 flex items-center gap-1.5">
                    <i data-lucide="credit-card" class="w-4 h-4 text-amber-600"></i>
                    <span>Payment Record</span>
                </h4>
                ${paymentRow ? `
                    <div class="space-y-1 text-xs">
                        <div class="flex justify-between"><span class="text-slate-500">Payment_ID:</span> <span class="badge-pk">#${paymentRow.Payment_ID}</span></div>
                        <div class="flex justify-between"><span class="text-slate-500">Status:</span> <span class="font-bold text-emerald-600">${paymentRow.Status}</span></div>
                        <div class="flex justify-between"><span class="text-slate-500">Amount:</span> <span class="font-mono font-bold">$${Number(paymentRow.Amount).toFixed(2)}</span></div>
                        <div class="flex justify-between"><span class="text-slate-500">Date:</span> <span class="font-mono text-slate-600 text-[11px]">${paymentRow.Payment_Date}</span></div>
                    </div>
                ` : `<span class="text-slate-400 italic">No payment record found.</span>`}
            </div>

            <!-- Delivery -->
            <div class="bg-white p-3.5 rounded-xl border border-slate-200">
                <h4 class="font-bold text-slate-900 text-xs mb-2 flex items-center gap-1.5">
                    <i data-lucide="truck" class="w-4 h-4 text-teal-600"></i>
                    <span>Delivery Record</span>
                </h4>
                ${deliveryRow ? `
                    <div class="space-y-1 text-xs">
                        <div class="flex justify-between"><span class="text-slate-500">Delivery_ID:</span> <span class="badge-pk">#${deliveryRow.Delivery_ID}</span></div>
                        <div class="flex justify-between"><span class="text-slate-500">Status:</span> <span class="font-bold text-teal-600">${deliveryRow.Status}</span></div>
                        <div class="flex justify-between"><span class="text-slate-500">Delivery Date:</span> <span class="font-mono text-slate-600 text-[11px]">${deliveryRow.Delivery_Date || 'Pending'}</span></div>
                    </div>
                ` : `<span class="text-slate-400 italic">No delivery record found.</span>`}
            </div>
        </div>
    `;

    modal.classList.remove('hidden');
    initIcons();
}

function closeDossierModal() {
    const modal = document.getElementById('order-dossier-modal');
    if (modal) modal.classList.add('hidden');
}

// -------------------------------------------------------------
// Live SQL Query Console Logic
// -------------------------------------------------------------

function loadPresetQuery(index) {
    const textarea = document.getElementById('sql-input');
    if (textarea && PRESET_QUERIES[index]) {
        textarea.value = PRESET_QUERIES[index];
    }
}

async function executeCurrentQuery() {
    const textarea = document.getElementById('sql-input');
    const query = textarea ? textarea.value.trim() : '';

    if (!query) {
        showToast("Please enter an SQL query to execute", "warning");
        return;
    }

    const startTime = performance.now();
    const thead = document.getElementById('sql-results-head');
    const tbody = document.getElementById('sql-results-body');
    const metaBar = document.getElementById('query-meta-bar');
    const infoEl = document.getElementById('query-result-info');
    const timeEl = document.getElementById('query-execution-time');

    try {
        let result;
        if (!state.isOffline) {
            const res = await fetch('/api/query', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query })
            });
            result = await res.json();
            if (!res.ok) throw new Error(result.error || "Query failed");
        } else {
            result = mockExecuteQuery(query);
        }

        const endTime = performance.now();
        const duration = Math.round(endTime - startTime);

        if (metaBar) metaBar.classList.remove('hidden');
        if (timeEl) timeEl.textContent = `${duration} ms`;

        if (result.is_select) {
            const { columns, rows } = result;
            if (infoEl) infoEl.textContent = `${rows.length} rows returned`;

            if (columns.length === 0 || rows.length === 0) {
                thead.innerHTML = `<tr><th class="px-4 py-3 text-slate-400">Empty Result Set</th></tr>`;
                tbody.innerHTML = `<tr><td class="px-4 py-6 text-center text-slate-400">The query returned 0 rows.</td></tr>`;
                return;
            }

            thead.innerHTML = `
                <tr>
                    ${columns.map(c => `<th class="px-4 py-2.5 font-semibold text-slate-700 font-mono text-[11px]">${escapeHtml(c)}</th>`).join('')}
                </tr>
            `;

            tbody.innerHTML = rows.map(r => `
                <tr class="hover:bg-slate-50 transition font-mono text-[11px]">
                    ${r.map(val => `<td class="px-4 py-2 text-slate-700 whitespace-nowrap">${escapeHtml(val ?? 'NULL')}</td>`).join('')}
                </tr>
            `).join('');
        } else {
            if (infoEl) infoEl.textContent = `Statement executed successfully`;
            thead.innerHTML = `<tr><th class="px-4 py-3 text-slate-700">Execution Status</th></tr>`;
            tbody.innerHTML = `
                <tr>
                    <td class="px-4 py-4 text-emerald-600 font-semibold">
                        ${escapeHtml(result.message || "Query executed successfully.")}
                    </td>
                </tr>
            `;
            // Refresh tables after mutating query
            loadInitialData();
        }

        showToast("Query executed successfully!", "success");
    } catch (err) {
        if (metaBar) metaBar.classList.remove('hidden');
        if (infoEl) infoEl.textContent = "Error executing query";
        thead.innerHTML = `<tr><th class="px-4 py-3 text-red-600">SQL Execution Error</th></tr>`;
        tbody.innerHTML = `<tr><td class="px-4 py-4 text-red-600 font-mono text-xs">${escapeHtml(err.message)}</td></tr>`;
        showToast(err.message, "error");
    }
}

// -------------------------------------------------------------
// Team Modal & Utilities
// -------------------------------------------------------------

function openTeamModal() {
    const modal = document.getElementById('team-modal');
    if (modal) modal.classList.remove('hidden');
    initIcons();
}

function closeTeamModal() {
    const modal = document.getElementById('team-modal');
    if (modal) modal.classList.add('hidden');
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast-slide flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-xs font-semibold text-white pointer-events-auto transition ${
        type === 'success' ? 'bg-emerald-600' :
        type === 'error' ? 'bg-red-600' :
        type === 'warning' ? 'bg-amber-600' : 'bg-slate-800'
    }`;

    let icon = 'info';
    if (type === 'success') icon = 'check-circle';
    if (type === 'error') icon = 'alert-octagon';
    if (type === 'warning') icon = 'alert-triangle';

    toast.innerHTML = `
        <i data-lucide="${icon}" class="w-4 h-4"></i>
        <span>${escapeHtml(message)}</span>
    `;

    container.appendChild(toast);
    initIcons();

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// -------------------------------------------------------------
// In-Memory Mock Database Engine (Offline / Direct Browser Fallback)
// -------------------------------------------------------------

let mockDB = {};

function initMockData() {
    mockDB = {
        Category: [
            { Category_ID: 1, Category_Name: 'Electronics & Gadgets' },
            { Category_ID: 2, Category_Name: 'Fashion & Apparel' },
            { Category_ID: 3, Category_Name: 'Home & Living' },
            { Category_ID: 4, Category_Name: 'Books & Learning' },
            { Category_ID: 5, Category_Name: 'Fitness & Sports' }
        ],
        Product: [
            { Product_ID: 101, Product_Name: 'MacBook Air M2 13-inch', Price: 999.00, Stock: 15, Category_ID: 1 },
            { Product_ID: 102, Product_Name: 'Sony WH-1000XM5 Wireless Headphones', Price: 349.00, Stock: 24, Category_ID: 1 },
            { Product_ID: 103, Product_Name: 'Samsung Galaxy S24 Ultra', Price: 1199.00, Stock: 18, Category_ID: 1 },
            { Product_ID: 104, Product_Name: 'Logitech MX Master 3S Mouse', Price: 99.00, Stock: 40, Category_ID: 1 },
            { Product_ID: 105, Product_Name: 'Classic Oxford Cotton Shirt', Price: 45.00, Stock: 50, Category_ID: 2 },
            { Product_ID: 106, Product_Name: 'Slim Fit Stretch Denim Jeans', Price: 59.00, Stock: 35, Category_ID: 2 },
            { Product_ID: 107, Product_Name: 'Breathable Running Shoes Pro', Price: 85.00, Stock: 28, Category_ID: 2 },
            { Product_ID: 108, Product_Name: 'Smart LED Desk Lamp', Price: 38.00, Stock: 30, Category_ID: 3 },
            { Product_ID: 109, Product_Name: 'Ergonomic Mesh Office Chair', Price: 189.00, Stock: 12, Category_ID: 3 },
            { Product_ID: 110, Product_Name: 'Stainless Steel Thermal Flask 1L', Price: 24.00, Stock: 60, Category_ID: 3 },
            { Product_ID: 111, Product_Name: 'Database System Concepts (Silberschatz)', Price: 75.00, Stock: 20, Category_ID: 4 },
            { Product_ID: 112, Product_Name: 'Clean Code: Agile Software Craftsmanship', Price: 42.00, Stock: 25, Category_ID: 4 },
            { Product_ID: 113, Product_Name: 'Python Crash Course (3rd Edition)', Price: 36.00, Stock: 32, Category_ID: 4 },
            { Product_ID: 114, Product_Name: 'Non-Slip Eco Yoga Mat', Price: 29.00, Stock: 45, Category_ID: 5 },
            { Product_ID: 115, Product_Name: 'Adjustable Dumbbell Set 20KG', Price: 110.00, Stock: 10, Category_ID: 5 }
        ],
        Customer: [
            { Customer_ID: 1, Name: 'M. Lekhana', Email: 'lekhana.m@aditya.edu.in', Phone: '+91 98765 43210', Address: 'Block A, Aditya University Campus, Surampalem, AP' },
            { Customer_ID: 2, Name: 'G. Navya Sri', Email: 'navyasri.g@aditya.edu.in', Phone: '+91 98765 43211', Address: 'Sai Nagar, Kakinada, Andhra Pradesh' },
            { Customer_ID: 3, Name: 'K. Satya Reshmee', Email: 'satyareshmee.k@aditya.edu.in', Phone: '+91 98765 43212', Address: 'Gandhi Road, Rajahmundry, Andhra Pradesh' },
            { Customer_ID: 4, Name: 'K. Dhanush', Email: 'dhanush.k@aditya.edu.in', Phone: '+91 98765 43213', Address: 'Main Street, Samalkot, Andhra Pradesh' },
            { Customer_ID: 5, Name: 'Prof. K. Rajendra', Email: 'rajendra.k@aditya.edu.in', Phone: '+91 98765 43214', Address: 'Faculty Quarters, Aditya University Campus, AP' },
            { Customer_ID: 6, Name: 'Rohan Verma', Email: 'rohan.v@example.com', Phone: '+91 91234 56780', Address: '42 Tech Park Avenue, Hyderabad, Telangana' }
        ],
        Order: [
            { Order_ID: 1001, Order_Date: '2026-09-28 10:15:00', Customer_ID: 1, Total_Amount: 1074.00 },
            { Order_ID: 1002, Order_Date: '2026-09-29 14:30:00', Customer_ID: 2, Total_Amount: 85.00 },
            { Order_ID: 1003, Order_Date: '2026-09-30 09:45:00', Customer_ID: 3, Total_Amount: 111.00 },
            { Order_ID: 1004, Order_Date: '2026-10-01 16:20:00', Customer_ID: 4, Total_Amount: 448.00 },
            { Order_ID: 1005, Order_Date: '2026-10-02 11:10:00', Customer_ID: 5, Total_Amount: 264.00 },
            { Order_ID: 1006, Order_Date: '2026-10-02 18:05:00', Customer_ID: 6, Total_Amount: 1298.00 }
        ],
        Order_Item: [
            { Order_Item_ID: 5001, Order_ID: 1001, Product_ID: 101, Quantity: 1 },
            { Order_Item_ID: 5002, Order_ID: 1001, Product_ID: 111, Quantity: 1 },
            { Order_Item_ID: 5003, Order_ID: 1002, Product_ID: 107, Quantity: 1 },
            { Order_Item_ID: 5004, Order_ID: 1003, Product_ID: 111, Quantity: 1 },
            { Order_Item_ID: 5005, Order_ID: 1003, Product_ID: 113, Quantity: 1 },
            { Order_Item_ID: 5006, Order_ID: 1004, Product_ID: 102, Quantity: 1 },
            { Order_Item_ID: 5007, Order_ID: 1004, Product_ID: 104, Quantity: 1 },
            { Order_Item_ID: 5008, Order_ID: 1005, Product_ID: 109, Quantity: 1 },
            { Order_Item_ID: 5009, Order_ID: 1005, Product_ID: 111, Quantity: 1 },
            { Order_Item_ID: 5010, Order_ID: 1006, Product_ID: 103, Quantity: 1 },
            { Order_Item_ID: 5011, Order_ID: 1006, Product_ID: 104, Quantity: 1 }
        ],
        Payment: [
            { Payment_ID: 9001, Order_ID: 1001, Payment_Date: '2026-09-28 10:16:30', Amount: 1074.00, Status: 'Completed' },
            { Payment_ID: 9002, Order_ID: 1002, Payment_Date: '2026-09-29 14:32:10', Amount: 85.00, Status: 'Completed' },
            { Payment_ID: 9003, Order_ID: 1003, Payment_Date: '2026-09-30 09:47:00', Amount: 111.00, Status: 'Completed' },
            { Payment_ID: 9004, Order_ID: 1004, Payment_Date: '2026-10-01 16:21:45', Amount: 448.00, Status: 'Completed' },
            { Payment_ID: 9005, Order_ID: 1005, Payment_Date: '2026-10-02 11:12:00', Amount: 264.00, Status: 'Completed' },
            { Payment_ID: 9006, Order_ID: 1006, Payment_Date: '2026-10-02 18:06:15', Amount: 1298.00, Status: 'Pending' }
        ],
        Delivery: [
            { Delivery_ID: 8001, Order_ID: 1001, Delivery_Date: '2026-09-30 15:00:00', Status: 'Delivered' },
            { Delivery_ID: 8002, Order_ID: 1002, Delivery_Date: '2026-10-01 12:30:00', Status: 'Delivered' },
            { Delivery_ID: 8003, Order_ID: 1003, Delivery_Date: '2026-10-03 17:00:00', Status: 'In Transit' },
            { Delivery_ID: 8004, Order_ID: 1004, Delivery_Date: '2026-10-04 14:00:00', Status: 'In Transit' },
            { Delivery_ID: 8005, Order_ID: 1005, Delivery_Date: '2026-10-05 11:00:00', Status: 'Processing' },
            { Delivery_ID: 8006, Order_ID: 1006, Delivery_Date: '2026-10-06 10:00:00', Status: 'Pending' }
        ]
    };
}

function getMockSummary() {
    const counts = {};
    Object.keys(mockDB).forEach(k => counts[k] = mockDB[k].length);
    const totalRev = mockDB.Order.reduce((sum, o) => sum + Number(o.Total_Amount), 0);
    const lowStock = mockDB.Product.filter(p => p.Stock < 15).length;
    const pendingDel = mockDB.Delivery.filter(d => d.Status !== 'Delivered').length;
    return {
        counts,
        total_revenue: totalRev,
        low_stock: lowStock,
        pending_deliveries: pendingDel
    };
}

function getMockTablesMeta() {
    return Object.keys(ENTITY_CONFIG).map(tableName => {
        const pk = ENTITY_CONFIG[tableName].pk;
        const sampleRow = mockDB[tableName]?.[0] || {};
        const columns = Object.keys(sampleRow).map(k => ({
            name: k,
            pk: k === pk,
            type: typeof sampleRow[k] === 'number' ? (Number.isInteger(sampleRow[k]) ? 'INTEGER' : 'REAL') : 'TEXT'
        }));
        return {
            table_name: tableName,
            pk_field: pk,
            columns,
            foreign_keys: ENTITY_CONFIG[tableName].fks.map(f => ({ from: f.col, to_table: f.target, to_column: f.col }))
        };
    });
}

function getMockTableRows(tableName) {
    return (mockDB[tableName] || []).map(r => ({ ...r }));
}

function mockInsertRecord(tableName, record) {
    const pkCol = ENTITY_CONFIG[tableName].pk;
    const maxId = mockDB[tableName].reduce((m, r) => Math.max(m, Number(r[pkCol]) || 0), 0);
    record[pkCol] = maxId + 1;
    mockDB[tableName].push(record);
}

function mockUpdateRecord(tableName, id, record) {
    const pkCol = ENTITY_CONFIG[tableName].pk;
    const index = mockDB[tableName].findIndex(r => r[pkCol] == id);
    if (index !== -1) {
        mockDB[tableName][index] = { ...mockDB[tableName][index], ...record };
    }
}

function mockDeleteRecord(tableName, id) {
    const pkCol = ENTITY_CONFIG[tableName].pk;
    mockDB[tableName] = mockDB[tableName].filter(r => r[pkCol] != id);
}

function mockCheckout(payload) {
    let customerId = payload.customer_id;
    if (payload.customer) {
        const maxCust = mockDB.Customer.reduce((m, c) => Math.max(m, c.Customer_ID), 0);
        customerId = maxCust + 1;
        mockDB.Customer.push({
            Customer_ID: customerId,
            ...payload.customer
        });
    }

    const customer = mockDB.Customer.find(c => c.Customer_ID == customerId);
    let total = 0;
    const maxOrder = mockDB.Order.reduce((m, o) => Math.max(m, o.Order_ID), 1000);
    const orderId = maxOrder + 1;

    let maxOi = mockDB.Order_Item.reduce((m, oi) => Math.max(m, oi.Order_Item_ID), 5000);

    payload.items.forEach(item => {
        const prod = mockDB.Product.find(p => p.Product_ID == item.product_id);
        if (prod) {
            prod.Stock -= item.quantity;
            total += prod.Price * item.quantity;
            maxOi += 1;
            mockDB.Order_Item.push({
                Order_Item_ID: maxOi,
                Order_ID: orderId,
                Product_ID: prod.Product_ID,
                Quantity: item.quantity
            });
        }
    });

    total = Math.round(total * 1.05 * 100) / 100;

    mockDB.Order.push({
        Order_ID: orderId,
        Order_Date: new Date().toISOString().replace('T', ' ').substring(0, 19),
        Customer_ID: customerId,
        Total_Amount: total
    });

    const maxPay = mockDB.Payment.reduce((m, p) => Math.max(m, p.Payment_ID), 9000);
    const paymentId = maxPay + 1;
    mockDB.Payment.push({
        Payment_ID: paymentId,
        Order_ID: orderId,
        Payment_Date: new Date().toISOString().replace('T', ' ').substring(0, 19),
        Amount: total,
        Status: payload.payment_method
    });

    const maxDel = mockDB.Delivery.reduce((m, d) => Math.max(m, d.Delivery_ID), 8000);
    const deliveryId = maxDel + 1;
    mockDB.Delivery.push({
        Delivery_ID: deliveryId,
        Order_ID: orderId,
        Delivery_Date: '2026-10-06 12:00:00',
        Status: 'Processing'
    });

    return {
        success: true,
        order: {
            Order_ID: orderId,
            Customer_ID: customerId,
            Customer_Name: customer.Name,
            Customer_Email: customer.Email,
            Total_Amount: total,
            Items_Count: payload.items.length,
            Payment_ID: paymentId,
            Payment_Status: payload.payment_method,
            Delivery_ID: deliveryId,
            Delivery_Status: 'Processing'
        }
    };
}

function mockExecuteQuery(query) {
    const q = query.trim().toUpperCase();
    if (q.includes('FULL ORDER') || q.includes('ORDER_MASTER') || (q.includes('FROM "ORDER"') && q.includes('JOIN CUSTOMER'))) {
        return {
            is_select: true,
            columns: ['Order_ID', 'Order_Date', 'Customer_Name', 'Email', 'Total_Amount', 'Payment_Status', 'Delivery_Status', 'Delivery_Date'],
            rows: mockDB.Order.map(o => {
                const cust = mockDB.Customer.find(c => c.Customer_ID == o.Customer_ID);
                const pay = mockDB.Payment.find(p => p.Order_ID == o.Order_ID);
                const del = mockDB.Delivery.find(d => d.Order_ID == o.Order_ID);
                return [
                    o.Order_ID,
                    o.Order_Date,
                    cust ? cust.Name : 'Unknown',
                    cust ? cust.Email : '',
                    `$${o.Total_Amount.toFixed(2)}`,
                    pay ? pay.Status : 'Pending',
                    del ? del.Status : 'Pending',
                    del ? del.Delivery_Date : 'Pending'
                ];
            })
        };
    }

    if (q.includes('CATEGORY') && (q.includes('REVENUE') || q.includes('SUM'))) {
        return {
            is_select: true,
            columns: ['Category_ID', 'Category_Name', 'Total_Orders_Placed', 'Units_Sold', 'Total_Revenue'],
            rows: mockDB.Category.map(c => {
                const prods = mockDB.Product.filter(p => p.Category_ID == c.Category_ID);
                const pids = prods.map(p => p.Product_ID);
                const ois = mockDB.Order_Item.filter(oi => pids.includes(oi.Product_ID));
                const units = ois.reduce((s, i) => s + i.Quantity, 0);
                const rev = ois.reduce((s, i) => {
                    const pr = prods.find(p => p.Product_ID == i.Product_ID);
                    return s + (pr ? pr.Price * i.Quantity : 0);
                }, 0);
                return [c.Category_ID, c.Category_Name, ois.length, units, `$${rev.toFixed(2)}`];
            })
        };
    }

    // Default return all rows of product
    return {
        is_select: true,
        columns: ['Product_ID', 'Product_Name', 'Price', 'Stock', 'Category_ID'],
        rows: mockDB.Product.slice(0, 10).map(p => [p.Product_ID, p.Product_Name, `$${p.Price.toFixed(2)}`, p.Stock, p.Category_ID])
    };
}
