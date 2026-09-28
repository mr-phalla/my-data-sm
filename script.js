const SUPABASE_URL = 'https://esusfxriizpgepmqjkah.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVzdXNmeHJpaXpwZ2VwbXFqa2FoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA1NjQ4MDYsImV4cCI6MjEwNjE0MDgwNn0.l58qkx-CzvL55Ym5mN0pa9fTrqK6Xo8UY0pOpaLmi-4';
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let customersData = [];
let productsData = [];

// --- មុខងារ Toast Notification ---
function showToast(message, type = 'success') {
  const toast = document.getElementById("toast");
  if(!toast) return;
  toast.innerText = message;
  toast.className = "show " + type;
  setTimeout(function(){ toast.className = toast.className.replace("show " + type, ""); }, 3000);
}

function switchTab(tabId, btnElement) {
  document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
  
  document.getElementById(tabId).classList.add('active');
  if(btnElement) btnElement.classList.add('active');
}

function openModal(id) { 
  let modal = document.getElementById(id);
  if(modal) modal.style.display = 'flex'; 
}
function closeModal(id) { 
  let modal = document.getElementById(id);
  if(modal) modal.style.display = 'none'; 
}

window.onload = function() {
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('view') === 'client') localStorage.setItem('appMode', 'client');
  if (urlParams.get('view') === 'admin') localStorage.removeItem('appMode');

  const isClientView = (localStorage.getItem('appMode') === 'client' || urlParams.get('view') === 'client');

  if (isClientView) {
    document.getElementById('adminSidebar').style.display = 'none';
    switchTab('clientSearchTab');
  } else {
    document.getElementById('date').valueAsDate = new Date();
    loadCustomers();
    loadProducts(function() { resetFormRows(); });
    loadRecentHistory(); // ហៅទិន្នន័យប្រវត្តិបញ្ចូលថ្មីៗ
  }
};

function copyClientLink() {
  let clientUrl = window.location.origin + window.location.pathname + "?view=client";
  if(navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(clientUrl).then(() => {
      showToast("បានចម្លង Link លក់សម្រាប់ភ្ញៀវជោគជ័យ!");
    });
  } else {
    prompt("សូមចម្លង Link ខាងក្រោមនេះផ្ញើជូនភ្ញៀវ៖", clientUrl);
  }
}

// ទាញយកទិន្នន័យមុខទំនិញ
async function loadProducts(callback) {
  const { data, error } = await db.from('products').select('*');
  if (error) { 
    console.error(error); 
    productsData = []; 
  } else {
    productsData = data.map(p => ({
      name: p['Product Name'] || p.name, 
      price: parseFloat(String(p['Price'] || p.price).replace(/,/g, '')) || 0
    }));
    
    let datalist = document.getElementById('productListOptions');
    if(datalist) {
       datalist.innerHTML = '';
       productsData.forEach(p => { 
         if (p && p.name) { 
           let opt = document.createElement('option'); 
           opt.value = p.name; 
           datalist.appendChild(opt); 
         } 
       });
    }
    renderProducts();
  }
  if (typeof callback === 'function') callback();
}

function renderProducts() {
  let kw = (document.getElementById('searchProduct').value || '').toLowerCase().trim();
  let container = document.getElementById('productsListContainer');
  if(!container) return;
  container.innerHTML = '';
  if (!Array.isArray(productsData) || productsData.length === 0) {
    container.innerHTML = '<div class="no-data-msg">ពុំទាន់មានទិន្នន័យមុខទំនិញឡើយ</div>'; return;
  }
  let filtered = productsData.filter(p => p && p.name && p.name.toString().toLowerCase().includes(kw));
  filtered.forEach(p => {
    container.innerHTML += `<div class="list-item-ui"><div class="item-icon-box">📦</div><div class="item-info"><div class="item-title">${p.name}</div><div class="item-sub">${p.price.toLocaleString()} ៛</div></div></div>`;
  });
}

// ទាញយកទិន្នន័យអតិថិជន
async function loadCustomers() {
  const { data, error } = await db.from('customer_name').select('*');
  if (error) { 
    console.error(error); 
    customersData = []; 
  } else {
    customersData = data.map(c => ({
      name: c.name || c.customer_name,
      phone: c.phone || "",
      address: c.address || ""
    }));
    
    let datalist = document.getElementById('customerListOptions');
    if(datalist) {
       datalist.innerHTML = '';
       customersData.forEach(c => { 
         if (c && c.name) { 
           let opt = document.createElement('option'); 
           opt.value = c.name; 
           datalist.appendChild(opt); 
         } 
       });
    }
    renderCustomers();
  }
}

function renderCustomers() {
  let kw = (document.getElementById('searchCustomer').value || '').toLowerCase().trim();
  let container = document.getElementById('customersListContainer');
  if(!container) return;
  container.innerHTML = '';
  let filtered = customersData.filter(c => c && ((c.name && c.name.toString().toLowerCase().includes(kw)) || (c.phone && c.phone.toString().includes(kw))));
  filtered.forEach(c => {
    let prefix = c.name ? c.name.trim().substring(0, 2) : 'អ';
    container.innerHTML += `<div class="list-item-ui"><div class="avatar-circle">${prefix}</div><div class="item-info"><div class="item-title">${c.name}</div><div class="item-sub">${c.phone || 'គ្មានលេខទូរស័ព្ទ'}</div></div></div>`;
  });
}

function onCustomerSelect() {
  let val = document.getElementById('customerInput').value.trim();
  let found = customersData.find(c => c && c.name && c.name.toLowerCase() === val.toLowerCase());
  if (found) {
    document.getElementById('phone').value = found.phone || "";
    document.getElementById('address').value = found.address || "";
  }
}

function onProductSelect(input) {
  let row = input.closest('tr');
  let val = input.value.trim();
  let priceInput = row.querySelector('.item-price');
  let found = productsData.find(p => p && p.name && p.name.toLowerCase() === val.toLowerCase());
  if (found) priceInput.value = found.price;
  calculateRow(priceInput);
}

function addItemRow() {
  let tbody = document.getElementById('itemTable');
  let tr = document.createElement('tr');
  tr.innerHTML = `
    <td><input type="text" class="item-input" list="productListOptions" placeholder="🔍 ស្វែងរក..." oninput="onProductSelect(this)"></td>
    <td><input type="number" class="item-qty text-center" value="1" oninput="calculateRow(this)"></td>
    <td><input type="number" class="item-price text-right" oninput="calculateRow(this)"></td>
    <td><input type="number" class="item-discount text-right" oninput="calculateRow(this)" value="0"></td>
    <td><input type="text" class="item-amount text-right" readonly value="0 ៛"></td>
    <td class="text-center"><button class="btn-action btn-remove" onclick="removeRow(this)">X</button></td>
  `;
  tbody.appendChild(tr);
}

function removeRow(btn) { 
  if(confirm("តើអ្នកពិតជាចង់លុបជួរនេះមែនទេ?")) {
    btn.closest('tr').remove(); 
    calculateGrandTotal(); 
  }
}

function calculateRow(input) {
  let row = input.closest('tr');
  let qty = parseFloat(row.querySelector('.item-qty').value) || 0;
  let price = parseFloat(row.querySelector('.item-price').value) || 0;
  let discount = parseFloat(row.querySelector('.item-discount').value) || 0;
  let amount = (qty * price) - discount;
  row.querySelector('.item-amount').value = (amount < 0 ? 0 : amount).toLocaleString() + " ៛";
  calculateGrandTotal();
}

function calculateGrandTotal() {
  let rows = document.querySelectorAll('#itemTable tr');
  let total = 0;
  rows.forEach(row => {
    let qty = parseFloat(row.querySelector('.item-qty').value) || 0;
    let price = parseFloat(row.querySelector('.item-price').value) || 0;
    let discount = parseFloat(row.querySelector('.item-discount').value) || 0;
    let amount = (qty * price) - discount;
    if (amount > 0) total += amount;
  });
  document.getElementById('grandTotal').innerText = total.toLocaleString() + " ៛";
}

function resetFormRows() {
  document.getElementById('itemTable').innerHTML = '';
  for(let i = 0; i < 3; i++) addItemRow();
  calculateGrandTotal();
}

// មុខងារបញ្ចូលទិន្នន័យវិក្កយបត្រថ្មី
async function saveData() {
  let items = [];
  let dateVal = document.getElementById('date').value;
  let cashierVal = document.getElementById('cashier').value;
  let customerVal = document.getElementById('customerInput').value.trim();
  let phoneVal = document.getElementById('phone').value;
  let addressVal = document.getElementById('address').value;

  document.querySelectorAll('#itemTable tr').forEach(row => {
    let prodName = row.querySelector('.item-input').value.trim();
    let qty = parseFloat(row.querySelector('.item-qty').value) || 0;
    let price = parseFloat(row.querySelector('.item-price').value) || 0;
    let discount = parseFloat(row.querySelector('.item-discount').value) || 0;
    let amount = (qty * price) - discount;
    
    if (prodName !== "") { 
      items.push({ 
        date: dateVal,
        cashier: cashierVal,
        customer_name: customerVal,
        phone: phoneVal,
        address: addressVal,
        item: prodName, 
        qty: qty,
        price: price,
        Discount: discount,
        Total: amount < 0 ? 0 : amount 
      }); 
    }
  });

  if (items.length === 0) { showToast("សូមបញ្ចូលមុខទំនិញយ៉ាងហោចណាស់ 1!", "error"); return; }
  
  let btnSave = document.getElementById('btnSave');
  btnSave.innerText = "SAVING..."; btnSave.disabled = true;

  const { error } = await db.from('sale-history').insert(items);

  if (error) {
    showToast("មានបញ្ហាក្នុងការរក្សាទុកទិន្នន័យ!", "error");
  } else {
    showToast("រក្សាទុកវិក្កយបត្ររួចរាល់!", "success");
    document.getElementById('customerInput').value = ''; 
    document.getElementById('phone').value = ''; 
    document.getElementById('address').value = '';
    resetFormRows(); 
    loadRecentHistory();
  }
  btnSave.innerText = "💾 រក្សាទុក (Save)"; btnSave.disabled = false;
}

// --- មុខងារផ្នែកខាងស្តាំ (ប្រវត្តិបញ្ចូលទំនិញថ្មីៗ) ---
async function loadRecentHistory() {
  let container = document.getElementById('recentHistoryContainer');
  if(!container) return;
  container.innerHTML = '<div style="text-align:center; padding: 20px; color:#888;">កំពុងទាញយក...</div>';

  const { data, error } = await db.from('sale-history').select('*').order('id', { ascending: false }).limit(15);
  
  if (error || !data || data.length === 0) {
    container.innerHTML = '<div style="text-align:center; padding: 20px; color:#888;">គ្មានប្រវត្តិបញ្ចូលទេ</div>';
    return;
  }

  container.innerHTML = '';
  data.forEach(item => {
    let amount = item.Total || 0;
    container.innerHTML += `
      <div class="recent-card">
        <div class="recent-header">
          <span>${item.date || ''}</span>
          <span style="color:var(--mac-blue);">${item.customer_name || ''}</span>
        </div>
        <div class="recent-body">
          <span style="width:50%; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${item.item || ''}</span>
          <span style="color:#34c759;">${amount.toLocaleString()} ៛</span>
        </div>
        <div class="recent-actions">
          <button class="btn-action-sm btn-edit" onclick="openEditSale(${item.id}, '${item.item}', ${item.qty}, ${item.price}, ${item.Discount})">កែប្រែ</button>
          <button class="btn-action-sm btn-delete" onclick="deleteSaleEntry(${item.id})">លុប</button>
        </div>
      </div>
    `;
  });
}

async function deleteSaleEntry(id) {
  if(confirm("តើអ្នកពិតជាចង់លុបទិន្នន័យនេះចេញពី Database មែនទេ?")) {
    const { error } = await db.from('sale-history').delete().eq('id', id);
    if(error) {
      showToast("មិនអាចលុបបានទេ!", "error");
    } else {
      showToast("លុបបានជោគជ័យ!", "success");
      loadRecentHistory();
    }
  }
}

function openEditSale(id, item, qty, price, discount) {
  document.getElementById('editSaleId').value = id;
  document.getElementById('editSaleItem').value = item;
  document.getElementById('editSaleQty').value = qty || 1;
  document.getElementById('editSalePrice').value = price || 0;
  document.getElementById('editSaleDiscount').value = discount || 0;
  calculateEditTotal();
  openModal('editSaleModal');
}

function calculateEditTotal() {
  let qty = parseFloat(document.getElementById('editSaleQty').value) || 0;
  let price = parseFloat(document.getElementById('editSalePrice').value) || 0;
  let discount = parseFloat(document.getElementById('editSaleDiscount').value) || 0;
  let total = (qty * price) - discount;
  document.getElementById('editSaleTotal').value = (total < 0 ? 0 : total).toLocaleString() + " ៛";
}

async function saveEditedSale() {
  let id = document.getElementById('editSaleId').value;
  let qty = parseFloat(document.getElementById('editSaleQty').value) || 0;
  let price = parseFloat(document.getElementById('editSalePrice').value) || 0;
  let discount = parseFloat(document.getElementById('editSaleDiscount').value) || 0;
  let total = (qty * price) - discount;
  if(total < 0) total = 0;

  const { error } = await db.from('sale-history').update({ qty: qty, price: price, Discount: discount, Total: total }).eq('id', id);
  
  if(error) {
    showToast("មានបញ្ហាក្នុងការកែប្រែ!", "error");
  } else {
    showToast("កែប្រែជោគជ័យ!", "success");
    closeModal('editSaleModal');
    loadRecentHistory();
  }
}

async function saveNewCustomer() {
  let name = document.getElementById('newCustName').value;
  let phone = document.getElementById('newCustPhone').value;
  let address = document.getElementById('newCustAddress').value;
  if (!name.trim()) return;
  
  const { error } = await db.from('customer_name').insert([{ customer_name: name, phone: phone, address: address }]);
  if (!error) {
    showToast("បានរក្សាទុកអតិថិជន!"); 
    closeModal('customerModal');
    document.getElementById('newCustName').value = ''; 
    document.getElementById('newCustPhone').value = ''; 
    document.getElementById('newCustAddress').value = '';
    loadCustomers();
  }
}

async function saveNewProduct() {
  let name = document.getElementById('newProdName').value;
  let price = parseFloat(document.getElementById('newProdPrice').value) || 0;
  if (!name.trim()) return;

  const { error } = await db.from('products').insert([{ "Product Name": name, "Price": price }]);
  if (!error) {
    showToast("បានរក្សាទុកមុខទំនិញ!"); 
    closeModal('productModal');
    document.getElementById('newProdName').value = ''; 
    document.getElementById('newProdPrice').value = '0'; 
    loadProducts();
  }
}

async function performSearch() {
  let kw = document.getElementById('searchKeyword').value.trim();
  let startDate = document.getElementById('searchStartDate').value;
  let endDate = document.getElementById('searchEndDate').value;
  
  let btn = document.getElementById('btnSearchSubmit');
  let tbody = document.getElementById('searchResultsTable');
  let summary = document.getElementById('searchSummary');
  btn.innerText = "កំពុងស្វែងរក..."; btn.disabled = true;
  tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">កំពុងទាញយកទិន្នន័យ...</td></tr>';
  summary.innerText = "";

  let query = db.from('sale-history').select('*');
  if (startDate) query = query.gte('date', startDate);
  if (endDate) query = query.lte('date', endDate);
  if (kw) query = query.or(`customer_name.ilike.%${kw}%,phone.ilike.%${kw}%`);

  const { data, error } = await query;
  btn.innerText = "ស្វែងរក"; btn.disabled = false; tbody.innerHTML = '';

  if (error || !data || data.length === 0) {
    summary.innerText = "រកមិនឃើញទិន្នន័យទេ!"; summary.style.color = "#ff3b30"; return;
  }
  
  let totalSpent = 0;
  let cName = data[0].customer_name;
  data.forEach(item => {
    totalSpent += item.Total || 0; 
    tbody.innerHTML += `<tr><td>${item.date || '-'}</td><td>${item.customer_name || '-'}</td><td>${item.item || '-'}</td><td class="text-center">${item.qty || 0}</td><td class="text-right">${(item.Total || 0).toLocaleString()} ៛</td></tr>`;
  });
  
  summary.style.color = "#34c759";
  summary.innerText = `អតិថិជន: ${cName} | សរុប: ${totalSpent.toLocaleString()} ៛`;
}

async function performClientSearch() {
  let kw = document.getElementById('clientKeyword').value.trim();
  let startDate = document.getElementById('clientStartDate').value;
  let endDate = document.getElementById('clientEndDate').value;
  
  let btn = document.getElementById('btnClientSearch');
  let tbody = document.getElementById('clientResultsTable');
  let summary = document.getElementById('clientSummary');
  
  if (!kw) { showToast("សូមបញ្ចូលឈ្មោះ ឬលេខទូរស័ព្ទដើម្បីស្វែងរក!", "error"); return; }
  
  btn.innerText = "⏳ កំពុងស្វែងរក..."; btn.disabled = true;
  tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 15px;">កំពុងទាញយកទិន្នន័យ...</td></tr>';
  summary.innerText = "";

  let query = db.from('sale-history').select('*').or(`customer_name.ilike.%${kw}%,phone.ilike.%${kw}%`);
  if (startDate) query = query.gte('date', startDate);
  if (endDate) query = query.lte('date', endDate);

  const { data, error } = await query;
  btn.innerText = "🔎 ស្វែងរក"; btn.disabled = false; tbody.innerHTML = '';

  if (error || !data || data.length === 0) {
    summary.innerText = "រកមិនឃើញទិន្នន័យបញ្ជាទិញទេ!"; summary.style.color = "#ff3b30"; return;
  }

  let totalSpent = 0;
  let cName = data[0].customer_name;
  data.forEach(item => {
    totalSpent += item.Total || 0; 
    tbody.innerHTML += `<tr><td>${item.date || '-'}</td><td>${item.item || '-'}</td><td class="text-center">${item.qty || 0}</td><td class="text-right">${(item.price || 0).toLocaleString()} ៛</td><td class="text-right" style="color:#34c759; font-weight:600;">${(item.Total || 0).toLocaleString()} ៛</td></tr>`;
  });
  
  summary.style.color = "#34c759"; summary.innerText = `លោក/លោកស្រី៖ ${cName} | ចំណាយសរុប៖ ${totalSpent.toLocaleString()} ៛`;
}

async function openReportModal() {
  openModal('reportModal');
  document.getElementById('dashSales').innerText = "...";
  document.getElementById('dashOrders').innerText = "...";
  document.getElementById('topProductsContainer').innerHTML = '<div style="text-align:center; padding: 15px; color: var(--text-sub);">កំពុងទាញយកទិន្នន័យ...</div>';
  
  const { data, error } = await db.from('sale-history').select('*');
  if(error || !data) {
     document.getElementById('topProductsContainer').innerHTML = '<div class="no-data-msg">មានបញ្ហាទាញទិន្នន័យ</div>'; return;
  }

  let totalSales = 0;
  let prodCount = {};
  
  data.forEach(row => {
    totalSales += row.Total || 0;
    let pName = row.item;
    if(pName) {
       prodCount[pName] = (prodCount[pName] || 0) + (row.qty || 1);
    }
  });

  let uniqueOrders = new Set(data.map(d => `${d.date}_${d.customer_name}`)).size;
  
  document.getElementById('dashSales').innerText = totalSales.toLocaleString() + " ៛";
  document.getElementById('dashOrders').innerText = uniqueOrders;

  let sortedProducts = Object.keys(prodCount).map(k => ({ name: k, qty: prodCount[k] })).sort((a,b) => b.qty - a.qty).slice(0, 5);
  
  let container = document.getElementById('topProductsContainer');
  container.innerHTML = '';
  if (sortedProducts.length === 0) { container.innerHTML = '<div class="no-data-msg">គ្មានទិន្នន័យលក់ទេ</div>'; return; }
  
  sortedProducts.forEach(p => { 
    container.innerHTML += `<div class="list-item-ui"><div class="item-icon-box" style="margin:0; background:rgba(255,149,0,0.1); color:#ff9500;">🔥</div><div class="item-info" style="margin-left:15px;"><div class="item-title">${p.name}</div><div class="item-sub">លក់បានសរុប: ${p.qty}</div></div></div>`; 
  });
}
