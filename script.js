// --- Supabase Connection ---
const SUPABASE_URL = 'https://esusfxriizpgepmqjkah.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVzdXNmeHJpaXpwZ2VwbXFqa2FoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA1NjQ4MDYsImV4cCI6MjEwNjE0MDgwNn0.l58qkx-CzvL55Ym5mN0pa9fTrqK6Xo8UY0pOpaLmi-4';
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let customersData = [];
let productsData = [];
let salesData = [];
let currentGrandTotalValue = 0;

// --- Formatter & Utils ---
const money = n => `${Number(n || 0).toLocaleString('en-US')}\u00A0៛`;
const esc = s => String(s ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));

function getBadge(status) {
    if(status === 'Unpaid') return `<span class="status-badge" style="background:rgba(245,158,11,0.1); color:#f59e0b;">ជំពាក់</span>`;
    return `<span class="status-badge success">ទូទាត់រួច</span>`;
}

function showToast(message, type = 'success') {
  const toast = document.getElementById("toast"); if(!toast) return;
  toast.innerText = message; toast.className = "show " + type;
  setTimeout(() => { toast.className = toast.className.replace("show " + type, ""); }, 3000);
}

function formatDateForInput(d) {
    return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}

// --- មុខងារ UI & Navigation ---
function toggleSidebar() {
  document.getElementById('adminSidebar').classList.toggle('active');
  document.querySelector('.sidebar-overlay').classList.toggle('active');
}

function toggleDarkMode() {
  document.body.classList.toggle('dark-mode');
  const icon = document.getElementById('darkModeIcon');
  if (document.body.classList.contains('dark-mode')) { icon.classList.replace('bx-moon', 'bx-sun'); } 
  else { icon.classList.replace('bx-sun', 'bx-moon'); }
  if(document.getElementById('dashboardTab').classList.contains('active')) updateChart(); 
}

function openTab(tabId) {
  document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
  
  document.getElementById(tabId).classList.add('active');
  const activeBtn = document.querySelector(`.nav-item[data-tab="${tabId}"]`);
  if(activeBtn) activeBtn.classList.add('active');

  if(window.innerWidth <= 900) { 
      document.getElementById('adminSidebar').classList.remove('active');
      document.querySelector('.sidebar-overlay').classList.remove('active');
  }

  if(tabId === 'dashboardTab') loadDashboard();
  if(tabId === 'historyTab') performSearch(); 
}

function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

// --- មុខងារ Role (Admin/Sales) ---
window.applyRole = function() {
    let role = document.getElementById('userRole').value;
    let adminEls = document.querySelectorAll('.admin-only');
    
    if (role === 'sales') {
        adminEls.forEach(el => el.style.display = 'none');
        document.getElementById('cashier').value = 'Sales Rep';
        openTab('invoiceTab'); // បើក Tab លក់ឱ្យ Sales ពេលប្តូរ Role
    } else {
        adminEls.forEach(el => el.style.display = '');
        document.getElementById('cashier').value = 'Admin';
    }
    
    performSearch();
    loadRecentHistory();
};

window.onload = async function() {
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('view') === 'client') localStorage.setItem('appMode', 'client');
  if (urlParams.get('view') === 'admin') localStorage.removeItem('appMode');

  if (localStorage.getItem('appMode') === 'client' || urlParams.get('view') === 'client') {
    document.getElementById('adminSidebar').style.display = 'none';
    document.getElementById('topbar').style.display = 'none';
    document.getElementById('mainView').style.marginLeft = '0';
    document.getElementById('mainView').style.padding = '0';
    document.getElementById('mainView').style.width = '100%';
    openTab('clientSearchTab');
  } else {
    document.getElementById('date').valueAsDate = new Date();
    await loadSalesData(); // ទាញទិន្នន័យលក់ជាមុនសិន
    await loadCustomers();
    await loadProducts(() => resetFormRows());
    loadDashboard();
    performSearch();
    loadRecentHistory();
  }
};

async function refreshAllData() {
    await loadSalesData();
    loadDashboard();
    renderCustomers();
    performSearch();
    loadRecentHistory();
}

// --- មុខងារសុវត្ថិភាពសម្រាប់ប៊ូតុងកែប្រែ (Data Attributes) ---
window.handleEditBtn = function(btn) {
    openEditSale(
        btn.getAttribute('data-id'),
        btn.getAttribute('data-item'),
        btn.getAttribute('data-qty'),
        btn.getAttribute('data-price'),
        btn.getAttribute('data-discount'),
        btn.getAttribute('data-status')
    );
};

window.handleCopyBtn = function(btn) {
    duplicateSale(
        btn.getAttribute('data-cname'),
        btn.getAttribute('data-phone'),
        btn.getAttribute('data-addr'),
        btn.getAttribute('data-item'),
        btn.getAttribute('data-qty'),
        btn.getAttribute('data-price'),
        btn.getAttribute('data-discount')
    );
};

// --- Data Fetchers ---
async function loadSalesData() {
    const { data, error } = await db.from('sale-history').select('*').order('id', { ascending: false }).limit(5000);
    if (!error) salesData = data || [];
}

async function loadProducts(callback) {
  const { data, error } = await db.from('products').select('*');
  if (!error) {
    productsData = data.map(p => ({ name: p['Product Name'] || p.name, price: parseFloat(String(p['Price'] || p.price).replace(/,/g, '')) || 0 }));
    let datalist = document.getElementById('productListOptions');
    if(datalist) {
       let opts = '';
       productsData.forEach(p => { if (p && p.name) opts += `<option value="${esc(p.name)}">`; });
       datalist.innerHTML = opts;
    }
    renderProducts();
  }
  if (typeof callback === 'function') callback();
}

async function loadCustomers() {
  const { data, error } = await db.from('customer_name').select('*');
  if (!error) {
    customersData = data.map(c => ({ name: c.name || c.customer_name, phone: c.phone || "", address: c.address || "" }));
    let datalist = document.getElementById('customerListOptions');
    if(datalist) {
       let opts = '';
       customersData.forEach(c => { if (c && c.name) opts += `<option value="${esc(c.name)}">`; });
       datalist.innerHTML = opts;
    }
    renderCustomers();
  }
}

function exportToCSV() {
  let role = document.getElementById('userRole').value;
  let exportData = role === 'sales' ? salesData.filter(s => s.cashier === document.getElementById('cashier').value) : salesData;
  if(!exportData || exportData.length === 0) { showToast("គ្មានទិន្នន័យសម្រាប់ Export", "error"); return; }
  
  let csvContent = "data:text/csv;charset=utf-8,\uFEFF"; 
  csvContent += "លេខវិក្កយបត្រ,ថ្ងៃទី,អតិថិជន,មុខទំនិញ,ចំនួន,តម្លៃ/ឯកតា,បញ្ចុះតម្លៃ,សរុបទឹកប្រាក់,ស្ថានភាព\r\n";
  exportData.forEach(row => {
    let inv = `INV-${String(row.id).padStart(4, '0')}`;
    let arr = [ inv, row.date || "", row.customer_name || "Walk-in", row.item || "", row.qty || 0, row.price || 0, row.Discount || 0, row.Total || 0, row.status || "Paid" ];
    let rowStr = arr.map(e => `"${String(e).replace(/"/g, '""')}"`).join(",");
    csvContent += rowStr + "\r\n";
  });
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `Sales_Report_${new Date().toISOString().slice(0,10)}.csv`);
  document.body.appendChild(link); link.click(); document.body.removeChild(link);
}

function copyClientLink() {
  let clientUrl = window.location.origin + window.location.pathname + "?view=client";
  if(navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(clientUrl).then(() => showToast("Copied Link!", "success"));
  } else { prompt("Copy this link:", clientUrl); }
}

// --- Render Table Views ---
function renderProducts() {
  let kw = (document.getElementById('searchProduct').value || '').toLowerCase().trim();
  let tbody = document.getElementById('productsTableBody'); if(!tbody) return;
  let filtered = productsData.filter(p => p && p.name && p.name.toString().toLowerCase().includes(kw));
  
  if (filtered.length === 0) { tbody.innerHTML = '<tr><td colspan="5" class="text-center muted pt-4 pb-4">No products found.</td></tr>'; return; }
  
  let html = '';
  filtered.forEach((p, index) => {
    let sku = `SKU-${String(index+1).padStart(4, '0')}`;
    html += `<tr><td><div class="user-cell"><div class="item-icon"><i class='bx bx-package'></i></div><div><b style="color:var(--text);">${esc(p.name)}</b><br><small class="muted">${sku}</small></div></div></td><td class="muted">ទូទៅ</td><td class="text-right"><b style="color:var(--text);">${money(p.price)}</b></td><td><span class="status-badge success">In Stock</span></td></tr>`;
  });
  tbody.innerHTML = html; 
}

function renderCustomers() {
  let kw = (document.getElementById('searchCustomer').value || '').toLowerCase().trim();
  let tbody = document.getElementById('customersTableBody'); if(!tbody) return;
  let filtered = customersData.filter(c => c && ((c.name && c.name.toString().toLowerCase().includes(kw)) || (c.phone && c.phone.toString().includes(kw))));
  
  if (filtered.length === 0) { tbody.innerHTML = '<tr><td colspan="5" class="text-center muted pt-4 pb-4">រកមិនឃើញអតិថិជន</td></tr>'; return; }
  
  let html = '';
  filtered.forEach(c => {
    let initial = c.name ? c.name.trim().substring(0, 2).toUpperCase() : 'អ';
    
    let cSales = salesData.filter(s => s.customer_name === c.name);
    let totalSpent = cSales.reduce((sum, s) => sum + (s.Total || 0), 0);
    let totalUnpaid = cSales.filter(s => s.status === 'Unpaid').reduce((sum, s) => sum + (s.Total || 0), 0);
    
    let debtBadge = totalUnpaid > 0 
        ? `<span class="status-badge" style="background:rgba(245,158,11,0.1); color:#f59e0b;">ជំពាក់ ${money(totalUnpaid)}</span>` 
        : `<span class="status-badge success">គ្មានបំណុល</span>`;

    html += `<tr>
        <td><div class="user-cell"><div class="user-icon">${esc(initial)}</div><b style="color:var(--text);">${esc(c.name)}</b></div></td>
        <td class="muted">${esc(c.phone || '-')}</td>
        <td class="text-right"><b style="color:var(--primary);">${money(totalSpent)}</b></td>
        <td class="text-center">${debtBadge}</td>
        <td class="text-center"><button class="btn outline small" onclick="viewCustomer('${esc(c.name)}')"><i class='bx bx-show'></i> លម្អិត</button></td>
    </tr>`;
  });
  tbody.innerHTML = html;
}

// --- Invoice Entry Logic ---
function onCustomerSelect() {
  let val = document.getElementById('customerInput').value.trim();
  let found = customersData.find(c => c && c.name && c.name.toLowerCase() === val.toLowerCase());
  if (found) { document.getElementById('phone').value = found.phone || ""; document.getElementById('address').value = found.address || ""; }
}

function onProductSelect(input) {
  let row = input.closest('tr'); let val = input.value.trim();
  let priceInput = row.querySelector('.item-price');
  let found = productsData.find(p => p && p.name && p.name.toLowerCase() === val.toLowerCase());
  if (found) priceInput.value = found.price;
  calculateRow(priceInput);
}

function addItemRow(item='', qty=1, price=0, discount=0) {
  let tbody = document.getElementById('itemTable'); let tr = document.createElement('tr');
  let amount = (qty * price) - discount;
  tr.innerHTML = `
    <td style="padding: 10px;"><input type="text" class="form-input item-input" list="productListOptions" placeholder="Search..." value="${esc(item)}" oninput="onProductSelect(this)"></td>
    <td style="padding: 10px;"><input type="number" class="form-input item-qty text-center" value="${qty}" oninput="calculateRow(this)" style="padding: 10px 8px;"></td>
    <td style="padding: 10px;"><input type="number" class="form-input item-price text-right" value="${price}" oninput="calculateRow(this)" style="padding: 10px 8px; min-width: 90px;"></td>
    <td style="padding: 10px;"><input type="number" class="form-input item-discount text-right" value="${discount}" oninput="calculateRow(this)" style="padding: 10px 8px;"></td>
    <td style="padding: 10px;"><input type="text" class="form-input item-amount text-right" readonly value="${money(Math.max(0,amount))}" style="border:none; background:transparent; font-weight:bold; color:var(--text); padding: 10px 4px;"></td>
    <td class="text-center no-print" style="padding: 10px;"><button class="btn outline small" style="color:var(--danger); border-color:var(--danger);" onclick="removeRow(this)"><i class='bx bx-trash'></i></button></td>
  `;
  tbody.appendChild(tr); calculateGrandTotal();
}

function removeRow(btn) { if(confirm("តើអ្នកពិតជាចង់លុបជួរនេះមែនទេ?")) { btn.closest('tr').remove(); calculateGrandTotal(); } }

function calculateRow(input) {
  let row = input.closest('tr');
  let qty = parseFloat(row.querySelector('.item-qty').value) || 0; 
  let price = parseFloat(row.querySelector('.item-price').value) || 0; 
  let discount = parseFloat(row.querySelector('.item-discount').value) || 0;
  let amount = (qty * price) - discount; 
  row.querySelector('.item-amount').value = money(Math.max(0, amount));
  calculateGrandTotal();
}

function calculateGrandTotal() {
  let rows = document.querySelectorAll('#itemTable tr'); let total = 0;
  rows.forEach(row => {
    let qty = parseFloat(row.querySelector('.item-qty').value) || 0; 
    let price = parseFloat(row.querySelector('.item-price').value) || 0; 
    let discount = parseFloat(row.querySelector('.item-discount').value) || 0;
    let amount = (qty * price) - discount; if (amount > 0) total += amount;
  });
  currentGrandTotalValue = total; 
  document.getElementById('grandTotal').innerText = money(total);
  calculateChange();
}

function calculateChange() {
    let receivedEl = document.getElementById('cashReceived'); let changeEl = document.getElementById('cashChange');
    if(!receivedEl || !changeEl) return;
    let received = parseFloat(receivedEl.value) || 0; let change = received - currentGrandTotalValue;
    changeEl.value = (received === 0 || change < 0) ? "0 ៛" : money(change);
}

function resetFormRows() {
  document.getElementById('itemTable').innerHTML = ''; for(let i = 0; i < 3; i++) addItemRow();
  document.getElementById('cashReceived').value = ''; document.getElementById('cashChange').value = '0 ៛';
  calculateGrandTotal();
}

// --- CRUD Operations ---
async function saveData() {
  let items = [];
  let dateVal = document.getElementById('date').value; let cashierVal = document.getElementById('cashier').value;
  let customerVal = document.getElementById('customerInput').value.trim(); let phoneVal = document.getElementById('phone').value; let addressVal = document.getElementById('address').value;
  let statusVal = document.getElementById('paymentStatus') ? document.getElementById('paymentStatus').value : 'Paid';

  document.querySelectorAll('#itemTable tr').forEach(row => {
    let prodName = row.querySelector('.item-input').value.trim();
    let qty = parseFloat(row.querySelector('.item-qty').value) || 0; 
    let price = parseFloat(row.querySelector('.item-price').value) || 0; 
    let discount = parseFloat(row.querySelector('.item-discount').value) || 0;
    let amount = (qty * price) - discount;
    if (prodName !== "") { items.push({ date: dateVal, cashier: cashierVal, customer_name: customerVal, phone: phoneVal, address: addressVal, item: prodName, qty: qty, price: price, Discount: discount, Total: Math.max(0, amount), status: statusVal }); }
  });

  if (items.length === 0) { showToast("សូមបញ្ចូលមុខទំនិញយ៉ាងហោចណាស់ 1!", "error"); return; }
  let btnSave = document.getElementById('btnSave'); btnSave.innerHTML = "Saving..."; btnSave.disabled = true;

  const { error } = await db.from('sale-history').insert(items);
  if (error) { 
      showToast("រក្សាទុកបរាជ័យ!", "error"); console.error(error); 
  } else {
    showToast("រក្សាទុកជោគជ័យ!", "success");
    document.getElementById('customerInput').value = ''; document.getElementById('phone').value = ''; document.getElementById('address').value = '';
    resetFormRows(); 
    await refreshAllData(); 
  }
  btnSave.innerHTML = "<i class='bx bx-save'></i> រក្សាទុកការលក់"; btnSave.disabled = false;
}

async function deleteSaleEntry(id) {
  if(confirm("តើអ្នកពិតជាចង់លុបទិន្នន័យនេះមែនទេ?")) {
    const { error } = await db.from('sale-history').delete().eq('id', id);
    if(error) { showToast("លុបបរាជ័យ!", "error"); } else { showToast("លុបជោគជ័យ!", "success"); await refreshAllData(); }
  }
}

function openEditSale(id, item, qty, price, discount, status) {
  document.getElementById('editSaleId').value = id; 
  document.getElementById('editSaleItem').value = item;
  document.getElementById('editSaleQty').value = qty || 1; 
  document.getElementById('editSalePrice').value = price || 0;
  document.getElementById('editSaleDiscount').value = discount || 0;
  if(document.getElementById('editPaymentStatus')) document.getElementById('editPaymentStatus').value = status || 'Paid';
  calculateEditTotal(); openModal('editSaleModal');
}

async function saveEditedSale() {
  let id = document.getElementById('editSaleId').value; 
  let qty = parseFloat(document.getElementById('editSaleQty').value) || 0; 
  let price = parseFloat(document.getElementById('editSalePrice').value) || 0; 
  let discount = parseFloat(document.getElementById('editSaleDiscount').value) || 0;
  let statusVal = document.getElementById('editPaymentStatus') ? document.getElementById('editPaymentStatus').value : 'Paid';
  let total = Math.max(0, (qty * price) - discount);
  
  const { error } = await db.from('sale-history').update({ qty: qty, price: price, Discount: discount, Total: total, status: statusVal }).eq('id', id);
  if(error) { showToast("កែប្រែបរាជ័យ!", "error"); } else { showToast("កែប្រែជោគជ័យ!", "success"); closeModal('editSaleModal'); await refreshAllData(); }
}

function calculateEditTotal() {
  let qty = parseFloat(document.getElementById('editSaleQty').value) || 0; let price = parseFloat(document.getElementById('editSalePrice').value) || 0; let discount = parseFloat(document.getElementById('editSaleDiscount').value) || 0;
  document.getElementById('editSaleTotal').value = money(Math.max(0, (qty * price) - discount));
}

// --- ប្រវត្តិបញ្ចូលថ្មីៗ (ផ្នែកខាងស្តាំ Invoice) ---
function loadRecentHistory() {
  let container = document.getElementById('recentHistoryContainer');
  if(!container) return;

  // Filter for Sales role
  let role = document.getElementById('userRole') ? document.getElementById('userRole').value : 'admin';
  let cashierName = document.getElementById('cashier').value;
  let displayData = role === 'sales' ? salesData.filter(s => s.cashier === cashierName) : salesData;

  if (!displayData || displayData.length === 0) {
    container.innerHTML = '<div class="text-center muted pt-4 pb-4">គ្មានប្រវត្តិបញ្ចូលទេ</div>';
    return;
  }

  let html = '';
  displayData.slice(0, 15).forEach(item => {
    let invNo = `INV-${String(item.id).padStart(4, '0')}`;
    let safeItemName = encodeURIComponent(item.item || '');
    
    html += `
      <div class="activity-item" style="padding: 12px; border-bottom: 1px solid var(--line); display: flex; justify-content: space-between; align-items: center; gap: 10px;">
        <div class="user-cell" style="display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0;">
          <div class="item-icon" style="width: 32px; height: 32px; flex-shrink: 0; border-radius: 8px; background: rgba(79,70,229,0.1); color: var(--primary); display: grid; place-items: center;"><i class='bx bx-receipt'></i></div>
          <div style="min-width: 0;">
            <b style="color:var(--text); font-size:13px; display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${esc(item.customer_name || 'Walk-in')}</b>
            <small class="muted block" style="margin-top:2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${invNo} • ${esc(item.item || '')}</small>
          </div>
        </div>
        <div style="text-align: right; flex-shrink: 0;">
          <b style="color:var(--text); font-size:14px; display:block; margin-bottom:6px; white-space: nowrap;">${money(item.Total)}</b>
          <button class="btn outline small" style="padding:4px 8px; font-size:11px; white-space: nowrap;" 
            data-id="${item.id}" 
            data-item="${esc(item.item)}" 
            data-qty="${item.qty || 1}" 
            data-price="${item.price || 0}" 
            data-discount="${item.Discount || 0}" 
            data-status="${esc(item.status || 'Paid')}" 
            onclick="handleEditBtn(this)">
            <i class='bx bx-edit'></i> កែប្រែ
          </button>
        </div>
      </div>
    `;
  });
  container.innerHTML = html;
}

// --- History Search & Edit ---
function performSearch() {
  let kw = document.getElementById('searchKeyword').value.trim().toLowerCase();
  let startDate = document.getElementById('searchStartDate').value; let endDate = document.getElementById('searchEndDate').value;
  let tbody = document.getElementById('searchResultsTable'); let summary = document.getElementById('searchSummary');
  if(!tbody) return;

  // Filter based on role
  let role = document.getElementById('userRole') ? document.getElementById('userRole').value : 'admin';
  let cashierName = document.getElementById('cashier').value;
  let filteredData = role === 'sales' ? salesData.filter(s => s.cashier === cashierName) : salesData;

  if(kw) filteredData = filteredData.filter(s => (s.customer_name||'').toLowerCase().includes(kw) || (s.phone||'').includes(kw));
  
  if (startDate || endDate) {
    let start = startDate ? new Date(startDate) : new Date('1970-01-01'); start.setHours(0,0,0,0);
    let end = endDate ? new Date(endDate) : new Date('2100-01-01'); end.setHours(23,59,59,999);
    filteredData = filteredData.filter(item => { if (!item.date) return false; let itemDate = new Date(item.date); return itemDate >= start && itemDate <= end; });
  }

  let totalSpent = 0; let html = '';
  filteredData.forEach(item => {
    totalSpent += item.Total || 0; 
    let invNo = `INV-${String(item.id).padStart(4, '0')}`;
    let safeItemName = encodeURIComponent(item.item || '');
    let safeCusName = encodeURIComponent(item.customer_name || '');
    let safePhone = encodeURIComponent(item.phone || '');
    let safeAddr = encodeURIComponent(item.address || '');
    
    // Hide Delete button if user is sales rep
    let deleteBtn = role === 'admin' ? `<button class="btn outline small" style="color:var(--danger); border-color:var(--danger);" onclick="deleteSaleEntry(${item.id})"><i class='bx bx-trash'></i></button>` : '';

    html += `<tr>
        <td class="muted">${item.date || '-'}</td>
        <td><b>${esc(item.customer_name || 'Walk-in')}</b><br><small class="muted">${invNo}</small></td>
        <td>${esc(item.item || '')}</td>
        <td class="text-center">${item.qty || 0}</td>
        <td class="text-right"><b style="color:var(--text);">${money(item.Total)}</b></td>
        <td>${getBadge(item.status)}</td>
        <td style="white-space: nowrap;">
            <button class="btn outline small" data-cname="${safeCusName}" data-phone="${safePhone}" data-addr="${safeAddr}" data-item="${safeItemName}" data-qty="${item.qty}" data-price="${item.price}" data-discount="${item.Discount}" onclick="handleCopyBtn(this)" title="ចម្លងវិក្កយបត្រ"><i class='bx bx-copy'></i></button>
            <button class="btn outline small" data-id="${item.id}" data-item="${safeItemName}" data-qty="${item.qty}" data-price="${item.price}" data-discount="${item.Discount}" data-status="${esc(item.status || 'Paid')}" onclick="handleEditBtn(this)"><i class='bx bx-edit'></i></button>
            ${deleteBtn}
        </td>
    </tr>`;
  });

  tbody.innerHTML = html || '<tr><td colspan="7" class="text-center muted pt-4 pb-4">គ្មានទិន្នន័យក្នុងចន្លោះកាលបរិច្ឆេទនេះទេ</td></tr>';
  if (filteredData.length > 0) { 
      let cName = kw ? (filteredData[0].customer_name || 'ទាំងអស់') : 'ទាំងអស់';
      summary.style.color = "var(--primary)"; summary.innerText = `លទ្ធផល: ${cName} | សរុបទឹកប្រាក់: ${money(totalSpent)}`; 
  } else { 
      summary.style.color = "var(--danger)"; summary.innerText = "គ្មានទិន្នន័យក្នុងចន្លោះកាលបរិច្ឆេទនេះទេ!"; 
  }
}

async function performClientSearch() {
  let kw = document.getElementById('clientKeyword').value.trim();
  let startDate = document.getElementById('clientStartDate').value; let endDate = document.getElementById('clientEndDate').value;
  let btn = document.getElementById('btnClientSearch'); let tbody = document.getElementById('clientResultsTable'); let summary = document.getElementById('clientSummary');
  
  if (!kw) { showToast("សូមបញ្ចូលឈ្មោះ ឬលេខទូរស័ព្ទដើម្បីស្វែងរក!", "error"); return; }
  btn.innerHTML = "កំពុងស្វែងរក..."; btn.disabled = true; tbody.innerHTML = '<tr><td colspan="5" class="text-center muted pt-4">កំពុងទាញយកទិន្នន័យ...</td></tr>'; summary.innerText = "";

  let query = db.from('sale-history').select('*').or(`customer_name.ilike.%${kw}%,phone.ilike.%${kw}%`).order('id', { ascending: false });
  const { data, error } = await query;

  if (error || !data || data.length === 0) {
    btn.innerHTML = "<i class='bx bx-search'></i> ស្វែងរកវិក្កយបត្រ"; btn.disabled = false; tbody.innerHTML = '';
    summary.innerText = "រកមិនឃើញទិន្នន័យបញ្ជាទិញទេ!"; summary.style.color = "var(--danger)"; return;
  }

  let filteredData = data;
  if (startDate || endDate) {
    let start = startDate ? new Date(startDate) : new Date('1970-01-01'); start.setHours(0,0,0,0);
    let end = endDate ? new Date(endDate) : new Date('2100-01-01'); end.setHours(23,59,59,999);
    filteredData = data.filter(item => { if (!item.date) return false; let itemDate = new Date(item.date); return itemDate >= start && itemDate <= end; });
  }

  btn.innerHTML = "<i class='bx bx-search'></i> ស្វែងរកវិក្កយបត្រ"; btn.disabled = false;
  if (filteredData.length === 0) { tbody.innerHTML = ''; summary.innerText = "រកមិនឃើញទិន្នន័យបញ្ជាទិញទេ!"; summary.style.color = "var(--danger)"; return; }

  let totalSpent = 0; let cName = filteredData[0].customer_name; let html = '';
  filteredData.forEach(item => {
    totalSpent += item.Total || 0; 
    html += `<tr><td>${item.date || '-'}</td><td><b>${esc(item.item || '-')}</b></td><td class="text-center">${item.qty || 0}</td><td class="text-right">${money(item.price)}</td><td class="text-right"><b style="color:var(--text);">${money(item.Total)}</b></td></tr>`;
  });
  tbody.innerHTML = html; summary.style.color = "var(--success)"; summary.innerText = `លោក/លោកស្រី៖ ${cName} | ចំណាយសរុប៖ ${money(totalSpent)}`;
}

// --- មុខងារបន្ទាប់បន្សំផ្សេងៗ ---
async function saveNewCustomer() {
  let name = document.getElementById('newCustName').value; let phone = document.getElementById('newCustPhone').value; let address = document.getElementById('newCustAddress').value;
  if (!name.trim()) return;
  const { error } = await db.from('customer_name').insert([{ customer_name: name, phone: phone, address: address }]);
  if (!error) { showToast("Customer Added!"); closeModal('customerModal'); loadCustomers(); }
}
async function saveNewProduct() {
  let name = document.getElementById('newProdName').value; let price = parseFloat(document.getElementById('newProdPrice').value) || 0;
  if (!name.trim()) return;
  const { error } = await db.from('products').insert([{ "Product Name": name, "Price": price }]);
  if (!error) { showToast("Product Added!"); closeModal('productModal'); loadProducts(); }
}
function duplicateSale(cName, phone, addr, item, qty, price, discount) {
    document.getElementById('customerInput').value = cName || ""; document.getElementById('phone').value = phone || ""; document.getElementById('address').value = addr || "";
    document.getElementById('itemTable').innerHTML = ''; addItemRow(item, qty, price, discount); openTab('invoiceTab'); showToast("បានចម្លងទិន្នន័យទៅវិក្កយបត្រថ្មី!", "success");
}

function viewCustomer(cName) {
    let cSales = salesData.filter(s => s.customer_name === cName);
    let totalSpent = cSales.reduce((sum, s) => sum + (s.Total || 0), 0);
    let lastDate = cSales.length > 0 ? cSales[0].date : '-';
    document.getElementById('modalCusName').innerText = cName; document.getElementById('modalCusOrders').innerText = cSales.length; document.getElementById('modalCusSpent').innerText = money(totalSpent); document.getElementById('modalCusLastDate').innerText = lastDate;
    openModal('customerDetailModal');
}

// --- Dashboard Chart (Admin Only) ---
function setChartFilter(type) {
    let startInput = document.getElementById('chartStartDate'); let endInput = document.getElementById('chartEndDate');
    let today = new Date(); let start = new Date(); let end = new Date();
    
    if(type === 'thisMonth') { start = new Date(today.getFullYear(), today.getMonth(), 1); }
    else if(type === 'lastMonth') { start = new Date(today.getFullYear(), today.getMonth() - 1, 1); end = new Date(today.getFullYear(), today.getMonth(), 0); }
    else if(type === 'last3Months') { start = new Date(today.getFullYear(), today.getMonth() - 2, 1); }
    else if(type === 'thisYear') { start = new Date(today.getFullYear(), 0, 1); }
    
    startInput.value = formatDateForInput(start); endInput.value = formatDateForInput(end);
    updateChart();
}

let salesChartInstance = null;
let hourlyChartInstance = null; // អថេរសម្រាប់ក្រាហ្វិកម៉ោងលក់ដាច់

function updateChart() {
  const startDate = document.getElementById('chartStartDate').value; const endDate = document.getElementById('chartEndDate').value;
  let filteredData = salesData;
  let dateLabel = "ទិន្នន័យទាំងអស់";
  
  if (startDate || endDate) {
    let start = startDate ? new Date(startDate) : new Date('1970-01-01'); start.setHours(0,0,0,0);
    let end = endDate ? new Date(endDate) : new Date('2100-01-01'); end.setHours(23,59,59,999);
    filteredData = salesData.filter(item => { if (!item.date) return false; let itemDate = new Date(item.date); return itemDate >= start && itemDate <= end; });
    if(startDate && endDate) dateLabel = `${startDate} ដល់ ${endDate}`; else if(startDate) dateLabel = `ចាប់ពី ${startDate}`; else if(endDate) dateLabel = `រហូតដល់ ${endDate}`;
  }

  let totalSales = 0; let unpaidCount = 0;
  filteredData.forEach(item => { totalSales += (item.Total || 0); if(item.status === 'Unpaid') unpaidCount++; });
  let uniqueOrders = new Set(filteredData.map(d => `${d.date}_${d.customer_name}`)).size;

  if(document.getElementById('dashSalesTotal')) document.getElementById('dashSalesTotal').innerText = money(totalSales);
  if(document.getElementById('dashOrders')) document.getElementById('dashOrders').innerText = uniqueOrders;
  if(document.getElementById('unpaidCountLabel')) document.getElementById('unpaidCountLabel').innerText = unpaidCount;
  if(document.getElementById('dateRangeLabelSales')) document.getElementById('dateRangeLabelSales').innerHTML = `<i class='bx bx-calendar'></i> ${dateLabel}`;
  if(document.getElementById('dateRangeLabelOrders')) document.getElementById('dateRangeLabelOrders').innerHTML = `<i class='bx bx-calendar'></i> ${dateLabel}`;

  // 1. ក្រាហ្វិកខ្សែ (ចំណូលសរុបប្រចាំថ្ងៃ)
  const groupedByDate = {};
  filteredData.forEach(item => { const dateStr = item.date || 'មិនស្គាល់'; groupedByDate[dateStr] = (groupedByDate[dateStr] || 0) + (item.Total || 0); });
  const sortedDates = Object.keys(groupedByDate).sort((a,b) => new Date(a) - new Date(b));
  const chartValues = sortedDates.map(date => groupedByDate[date]);

  const ctx = document.getElementById('salesChart');
  const isDarkMode = document.body.classList.contains('dark-mode');
  const gridColor = isDarkMode ? '#334155' : '#e2e8f0'; const textColor = isDarkMode ? '#94a3b8' : '#64748b';

  if(ctx) {
      if(salesChartInstance) salesChartInstance.destroy();
      salesChartInstance = new Chart(ctx, {
        type: 'line',
        data: { labels: sortedDates.length > 0 ? sortedDates : ['គ្មានទិន្នន័យ'], datasets: [{ label: 'ចំណូលសរុប (៛)', data: chartValues.length > 0 ? chartValues : [0], borderColor: '#4f46e5', backgroundColor: 'rgba(79, 70, 229, 0.1)', borderWidth: 2, fill: true, tension: 0.3, pointBackgroundColor: '#4f46e5' }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, grid: { color: gridColor }, ticks: { color: textColor, callback: value => Number(value).toLocaleString() + ' ៛' } }, x: { grid: { display: false }, ticks: { color: textColor } } } }
      });
  }

  // 2. ក្រាហ្វិកសសរ (ម៉ោងដែលលក់ដាច់បំផុត)
  const hourlyCtx = document.getElementById('hourlySalesChart');
  if(hourlyCtx) {
      if(hourlyChartInstance) hourlyChartInstance.destroy();
      
      let hourlyData = new Array(13).fill(0); // 6ព្រឹក ដល់ 6ល្ងាច (13 ម៉ោង)
      filteredData.forEach(item => {
          let h = 10; 
          if(item.created_at) { h = new Date(item.created_at).getHours(); } 
          else { h = (item.id % 9) + 8; } // Mock លេខម៉ោងសម្រាប់ទិន្នន័យចាស់ៗដែលអត់មានម៉ោង
          
          let idx = h - 6;
          if(idx >= 0 && idx <= 12) { hourlyData[idx] += (item.Total || 0); }
      });

      hourlyChartInstance = new Chart(hourlyCtx, {
          type: 'bar',
          data: {
              labels: ['6 ព្រឹក', '7 ព្រឹក', '8 ព្រឹក', '9 ព្រឹក', '10 ព្រឹក', '11 ព្រឹក', '12 ថ្ងៃ', '1 រសៀល', '2 រសៀល', '3 រសៀល', '4 រសៀល', '5 ល្ងាច', '6 ល្ងាច'],
              datasets: [{ label: 'ចំណូល (៛)', data: hourlyData, backgroundColor: '#8b5cf6', borderRadius: 4 }]
          },
          options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, grid: { color: gridColor }, ticks: { color: textColor, callback: value => Number(value).toLocaleString() } }, x: { grid: { display: false }, ticks: { color: textColor } } } }
      });
  }
}

function loadDashboard() {
  if(!salesData) return;
  let prodCount = {}; let cusCount = {};
  let currentMonthSales = 0; let lastMonthSales = 0; 
  let today = new Date(); let currentMonth = today.getMonth(); let currentYear = today.getFullYear();
  let lastMonth = currentMonth === 0 ? 11 : currentMonth - 1; let lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;

  salesData.forEach(row => {
    if(row.date) {
        let d = new Date(row.date);
        if(d.getMonth() === currentMonth && d.getFullYear() === currentYear) currentMonthSales += (row.Total || 0);
        if(d.getMonth() === lastMonth && d.getFullYear() === lastMonthYear) lastMonthSales += (row.Total || 0);
    }
    let pName = row.item; if(pName) { prodCount[pName] = (prodCount[pName] || 0) + (row.qty || 1); }
    let cName = row.customer_name; if(cName && cName !== 'Walk-in') { cusCount[cName] = (cusCount[cName] || 0) + (row.Total || 0); }
  });

  let growthText = "កើនឡើង"; let growthClass = "up";
  if(lastMonthSales > 0) {
      let percent = ((currentMonthSales - lastMonthSales) / lastMonthSales) * 100;
      if(percent < 0) { growthText = `ធ្លាក់ចុះ ${Math.abs(percent).toFixed(1)}%`; growthClass = "danger"; } else { growthText = `កើនឡើង ${percent.toFixed(1)}%`; growthClass = "up"; }
  }

  if(document.getElementById('dashSalesMonth')) document.getElementById('dashSalesMonth').innerText = money(currentMonthSales);
  if(document.getElementById('dashCustomers')) document.getElementById('dashCustomers').innerText = customersData.length;
  let momEl = document.getElementById('momGrowth'); if(momEl) { momEl.innerHTML = `<i class='bx bx-${growthClass==="up"?"up":"down"}-arrow-alt'></i> ${growthText}`; momEl.className = `trend ${growthClass}`; }

  let sortedProducts = Object.keys(prodCount).map(k => ({ name: k, qty: prodCount[k] })).sort((a,b) => b.qty - a.qty).slice(0, 5);
  let pContainer = document.getElementById('topProductsContainer');
  if(pContainer) {
      let htmlP = '';
      sortedProducts.forEach((p, index) => { htmlP += `<tr><td><div class="user-cell"><div class="item-icon" style="background:rgba(245, 158, 11, 0.1); color:#f59e0b; width:24px; height:24px; font-size:12px; font-weight:bold;">${index + 1}</div><b style="font-size: 13px;">${esc(p.name)}</b></div></td><td class="text-center"><b>${p.qty}</b></td></tr>`; });
      pContainer.innerHTML = htmlP || '<tr><td colspan="2" class="text-center muted pt-4">គ្មានទិន្នន័យ</td></tr>';
  }

  let sortedCus = Object.keys(cusCount).map(k => ({ name: k, spent: cusCount[k] })).sort((a,b) => b.spent - a.spent).slice(0, 5);
  let cContainer = document.getElementById('topCustomersContainer');
  if(cContainer) {
      let htmlC = '';
      sortedCus.forEach((c, index) => { 
        let initial = c.name.substring(0, 2).toUpperCase();
        htmlC += `<tr><td><div class="user-cell"><div class="user-icon" style="width:28px;height:28px;font-size:11px;">${esc(initial)}</div><b style="font-size: 13px;">${esc(c.name)}</b></div></td><td class="text-right" style="color:var(--success); font-weight:bold;">${money(c.spent)}</td></tr>`; 
      });
      cContainer.innerHTML = htmlC || '<tr><td colspan="2" class="text-center muted pt-4">គ្មានទិន្នន័យ</td></tr>';
  }
  
  if(!document.getElementById('chartStartDate').value) setChartFilter('thisMonth'); else updateChart();
}
