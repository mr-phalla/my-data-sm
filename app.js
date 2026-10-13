// --- Supabase Connection ---
const SUPABASE_URL = 'https://esusfxriizpgepmqjkah.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVzdXNmeHJpaXpwZ2VwbXFqa2FoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA1NjQ4MDYsImV4cCI6MjEwNjE0MDgwNn0.l58qkx-CzvL55Ym5mN0pa9fTrqK6Xo8UY0pOpaLmi-4';
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ឈ្មោះ Table ក្នុង Supabase (បើលោកអ្នកប្រើឈ្មោះ Data សូមដូរ 'sale-history' ទៅ 'Data')
const TABLE_SALES = 'sale-history'; 
const TABLE_PRODUCTS = 'products';
const TABLE_CUSTOMERS = 'customer_name';

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

function togglePasswordVisibility() {
    let passInput = document.getElementById('loginPass');
    if (passInput.type === "password") { passInput.type = "text"; } else { passInput.type = "password"; }
}

// --- មុខងារ Login ---
window.executeLogin = async function() {
    let user = document.getElementById('loginUser').value.trim();
    let pass = document.getElementById('loginPass').value.trim();
    let btn = document.querySelector('.btn-login');
    let originalBtnText = btn.innerHTML;
    
    btn.innerHTML = "Log in ... <i class='bx bx-loader-alt bx-spin'></i>";
    btn.disabled = true;

    const { data, error } = await db.auth.signInWithPassword({ email: user, password: pass });

    if (error) {
        showToast("Email ឬ Password មិនត្រឹមត្រូវទេ!", "error");
        btn.innerHTML = originalBtnText;
        btn.disabled = false;
    } else {
        document.getElementById('customLoginModal').style.display = 'none';
        document.getElementById('appShell').style.display = 'flex';
        document.getElementById('date').valueAsDate = new Date();
        refreshAllData();
        showToast("ចូលគណនីបានជោគជ័យ!", "success");
        btn.innerHTML = originalBtnText;
        btn.disabled = false;
    }
};

window.handleLogout = async function() {
    if(confirm("តើអ្នកចង់ចាកចេញពីប្រព័ន្ធមែនទេ?")) {
        await db.auth.signOut(); 
        document.getElementById('customLoginModal').style.display = 'flex';
        document.getElementById('appShell').style.display = 'none';
        document.getElementById('loginPass').value = '';
    }
};

window.onload = async function() {
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('view') === 'client') localStorage.setItem('appMode', 'client');
  if (urlParams.get('view') === 'admin') localStorage.removeItem('appMode');

  if (localStorage.getItem('appMode') === 'client' || urlParams.get('view') === 'client') {
    document.getElementById('customLoginModal').style.display = 'none';
    document.getElementById('adminSidebar').style.display = 'none';
    document.getElementById('topbar').style.display = 'none';
    document.getElementById('appShell').style.display = 'flex';
    document.getElementById('mainView').style.marginLeft = '0';
    document.getElementById('mainView').style.padding = '0';
    document.getElementById('mainView').style.width = '100%';
    openTab('clientSearchTab');
  } else {
    document.getElementById('customLoginModal').style.display = 'flex';
    document.getElementById('date').valueAsDate = new Date();
    await loadCustomers();
    await loadProducts(() => resetFormRows());
    await refreshAllData();
  }
};

async function refreshAllData() {
    await loadSalesData();
    loadDashboard();
    renderCustomers();
    performSearch();
    loadRecentHistory();
}

// --- Data Fetching ---
async function loadSalesData() {
    const { data, error } = await db.from(TABLE_SALES).select('*').order('id', { ascending: false }).limit(300);
    if (!error) salesData = data || [];
}

// ១. កែប្រែ loadProducts ឲ្យបង្ហាញឈ្មោះទំនិញតែមួយ (មិនជាន់គ្នា) និងបង្កើតទម្រង់ខ្នាតស្អាត
async function loadProducts(callback) {
  const { data, error } = await db.from(TABLE_PRODUCTS).select('*');
  if (!error) {
    productsData = data.map(p => {
        // រៀបចំទម្រង់ ខ្នាត/ប្រភេទ (ឧទាហរណ៍ 250ml/Bottle) បើអត់មានសរសេរក្នុងកូឡោន Unit
        let uVal = p.unit_value ? String(p.unit_value).replace('.0', '') : '';
        let uMea = p.unit_measure || '';
        let pType = p.package_type || '';
        let display_unit = p['Unit'] || p.unit || "";
        
        if (!display_unit && uVal && uMea && pType) display_unit = `${uVal}${uMea}/${pType}`;
        else if (!display_unit && uVal && uMea) display_unit = `${uVal}${uMea}`;

        return { 
            name: p['Product Name'] || p.name, 
            price: parseFloat(String(p['Price'] || p.price).replace(/,/g, '')) || 0,
            unit: display_unit,
            package_type: p['package_type'] || "",
            unit_value: p['unit_value'] || 0,
            unit_measure: p['unit_measure'] || "",
            standard_unit_value: p['standard_unit_value'] || 0,
            standard_unit_measure: p['standard_unit_measure'] || ""
        };
    });
    
    // ចម្រាញ់យកតែឈ្មោះទំនិញដែលមិនជាន់គ្នា ដាក់ក្នុង Datalist Search
    let uniqueNames = [...new Set(productsData.map(p => p.name).filter(Boolean))];
    let datalist = document.getElementById('productListOptions');
    if(datalist) {
       let opts = '';
       uniqueNames.forEach(name => { opts += `<option value="${esc(name)}">`; });
       datalist.innerHTML = opts;
    }
    if (typeof renderProducts === 'function') renderProducts();
  }
  if (typeof callback === 'function') callback();
}

async function loadCustomers() {
  const { data, error } = await db.from(TABLE_CUSTOMERS).select('*');
  if (!error) {
    customersData = data.map(c => ({ 
        name: c.name || c['customer name'] || c.customer_name, 
        phone: c.phone || c['phone '] || "", 
        address: c.address || "" 
    }));
    let datalist = document.getElementById('customerListOptions');
    if(datalist) {
       let opts = '';
       customersData.forEach(c => { if (c && c.name) opts += `<option value="${esc(c.name)}">`; });
       datalist.innerHTML = opts;
    }
    renderCustomers();
  }
}

// --- Invoice Functions ---
function onCustomerSelect() {
  let val = document.getElementById('customerInput').value.trim();
  let found = customersData.find(c => c && c.name && c.name.toLowerCase() === val.toLowerCase());
  if (found) { document.getElementById('phone').value = found.phone || ""; document.getElementById('address').value = found.address || ""; }
}

// ៣. កែប្រែ onProductSelect ឲ្យចាប់យកខ្នាត និងតម្លៃទាំងអស់របស់មុខទំនិញ
function onProductSelect(input) {
  let row = input.closest('tr'); 
  let val = input.value.trim();
  let priceInput = row.querySelector('.item-price');
  
  // ស្វែងរកទំនិញទាំងអស់ដែលមានឈ្មោះដូចគ្នា
  let variations = productsData.filter(p => p && p.name && p.name.toLowerCase() === val.toLowerCase());
  
  if (variations.length > 0) { 
      let unitContainer = row.querySelector('.unit-container');
      
      // បើមានខ្នាតច្រើនជាង១ យើងប្តូរវាទៅជា Dropdown (Select) ឲ្យរើស
      if (variations.length > 1) {
          let selectHTML = `<select class="form-input item-unit" style="padding: 9px 4px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px;" onchange="onUnitChange(this)">`;
          variations.forEach(v => {
              selectHTML += `<option value="${esc(v.unit)}" data-price="${v.price}" data-pkg="${esc(v.package_type)}" data-uv="${v.unit_value}" data-um="${esc(v.unit_measure)}" data-suv="${v.standard_unit_value}" data-sum="${esc(v.standard_unit_measure)}">${esc(v.unit)}</option>`;
          });
          selectHTML += `</select>`;
          unitContainer.innerHTML = selectHTML;
      } else {
          // បើមានខ្នាតតែមួយ រក្សាទុកជា Input អានបានតែម្យ៉ាង (Readonly) ធម្មតា
          let v = variations[0];
          unitContainer.innerHTML = `<input type="text" class="form-input item-unit" value="${esc(v.unit)}" readonly style="padding: 10px 8px; background:#f1f5f9; color:var(--muted);">`;
      }
      
      // ទាញយកតម្លៃ (Price) និងទិន្នន័យផ្សេងៗនៃខ្នាតដំបូងគេមកបង្ហាញសិន
      let v = variations[0];
      if(priceInput) priceInput.value = v.price; 
      if(row.querySelector('.item-pkg')) row.querySelector('.item-pkg').value = v.package_type || "";
      if(row.querySelector('.item-uv')) row.querySelector('.item-uv').value = v.unit_value || 0;
      if(row.querySelector('.item-um')) row.querySelector('.item-um').value = v.unit_measure || "";
      if(row.querySelector('.item-suv')) row.querySelector('.item-suv').value = v.standard_unit_value || 0;
      if(row.querySelector('.item-sum')) row.querySelector('.item-sum').value = v.standard_unit_measure || "";
  }
  calculateRow(priceInput);
}
// ៤. មុខងារថ្មី សម្រាប់ពេលអ្នកប្រើប្រាស់ផ្លាស់ប្តូរខ្នាត (Dropdown) នោះតម្លៃលុយនឹងដូរតាម
function onUnitChange(selectEl) {
    let row = selectEl.closest('tr');
    let selectedOption = selectEl.options[selectEl.selectedIndex];
    
    // ចាប់យកតម្លៃលុយថ្មី ទៅតាមខ្នាតដែលបានរើស
    let priceInput = row.querySelector('.item-price');
    if(priceInput) priceInput.value = selectedOption.getAttribute('data-price');
    
    // ផ្លាស់ប្តូរទិន្នន័យលាក់ (Hidden Inputs) ដើម្បីឲ្យ Save ចូល Database ត្រូវ
    if(row.querySelector('.item-pkg')) row.querySelector('.item-pkg').value = selectedOption.getAttribute('data-pkg') || "";
    if(row.querySelector('.item-uv')) row.querySelector('.item-uv').value = selectedOption.getAttribute('data-uv') || 0;
    if(row.querySelector('.item-um')) row.querySelector('.item-um').value = selectedOption.getAttribute('data-um') || "";
    if(row.querySelector('.item-suv')) row.querySelector('.item-suv').value = selectedOption.getAttribute('data-suv') || 0;
    if(row.querySelector('.item-sum')) row.querySelector('.item-sum').value = selectedOption.getAttribute('data-sum') || "";
    
    // គណនាលុយសរុបឡើងវិញ
    calculateRow(priceInput);
}

// ២. កែប្រែ addItemRow ដើម្បីងាយស្រួលប្តូរ input ទៅជា select ពេលមានខ្នាតច្រើន
function addItemRow(item='', unit='', qty=1, price=0, discount=0, pkg='', uv=0, um='', suv=0, sum='') {
  let tbody = document.getElementById('itemTable'); 
  let tr = document.createElement('tr');
  let amount = (qty * price) - discount;
  
  tr.innerHTML = `
    <td style="padding: 10px;">
        <input type="text" class="form-input item-input" list="productListOptions" placeholder="Search..." value="${esc(item)}" oninput="onProductSelect(this)">
        <input type="hidden" class="item-pkg" value="${esc(pkg)}">
        <input type="hidden" class="item-uv" value="${uv}">
        <input type="hidden" class="item-um" value="${esc(um)}">
        <input type="hidden" class="item-suv" value="${suv}">
        <input type="hidden" class="item-sum" value="${esc(sum)}">
    </td>
    <td style="padding: 10px;" class="unit-container">
        <input type="text" class="form-input item-unit" placeholder="ឧ. 450ml/btl" value="${esc(unit)}" readonly style="padding: 10px 8px; background:#f1f5f9; color:var(--muted);">
    </td>
    <td style="padding: 10px;"><input type="number" class="form-input item-qty text-center" value="${qty}" oninput="calculateRow(this)" style="padding: 10px 8px;"></td>
    <td style="padding: 10px;"><input type="number" class="form-input item-price text-right" value="${price}" oninput="calculateRow(this)" style="padding: 10px 8px; min-width: 90px;"></td>
    <td style="padding: 10px;"><input type="number" class="form-input item-discount text-right" value="${discount}" oninput="calculateRow(this)" style="padding: 10px 8px;"></td>
    <td style="padding: 10px;"><input type="text" class="form-input item-amount text-right" readonly value="${money(Math.max(0,amount))}" style="border:none; background:transparent; font-weight:bold; color:var(--text); padding: 10px 4px;"></td>
    <td class="text-center no-print" style="padding: 10px;"><button class="btn outline small" style="color:var(--danger); border-color:var(--danger);" onclick="removeRow(this)"><i class='bx bx-trash'></i></button></td>
  `;
  tbody.appendChild(tr); 
  calculateGrandTotal();
}

function removeRow(btn) { 
    if(confirm("តើអ្នកពិតជាចង់លុបជួរនេះមែនទេ?")) { 
        btn.closest('tr').remove(); 
        calculateGrandTotal(); 
    } 
}

function calculateRow(input) {
  let row = input.closest('tr');
  if(input.value < 0) input.value = 0; 
  let qty = parseFloat(row.querySelector('.item-qty').value) || 0; 
  let price = parseFloat(row.querySelector('.item-price').value) || 0; 
  let discount = parseFloat(row.querySelector('.item-discount').value) || 0;
  let amount = (qty * price) - discount; 
  row.querySelector('.item-amount').value = money(Math.max(0, amount));
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
  currentGrandTotalValue = total; 
  document.getElementById('grandTotal').innerText = money(total);
  calculateChange();
}

// ១. ជំនួសមុខងារ calculateChange ឲ្យវាឆ្លាតវៃជាងមុន អាចប្រាប់ពីលុយអាប់ ឬលុយខ្វះ
function calculateChange() {
    let receivedEl = document.getElementById('cashReceived'); 
    let changeEl = document.getElementById('cashChange');
    let statusEl = document.getElementById('paymentStatus');
    
    if(!receivedEl || !changeEl) return;
    
    let labelEl = changeEl.previousElementSibling; // ចាប់យកអក្សរពីលើប្រអប់ (ប្រាក់អាប់)
    let received = parseFloat(receivedEl.value) || 0; 
    let change = received - currentGrandTotalValue;
    
    if (receivedEl.value === '') {
        changeEl.value = "0 ៛";
        changeEl.style.color = "var(--text)";
        if(labelEl) labelEl.innerText = "ប្រាក់អាប់ (៛)";
    } else if (change >= 0) {
        // ករណីលុយគ្រប់ ឬលើស
        changeEl.value = money(change);
        changeEl.style.color = "var(--success)"; 
        if(labelEl) labelEl.innerText = "ប្រាក់អាប់ (៛)";
        if(statusEl) statusEl.value = 'Paid';
    } else {
        // ករណីលុយមិនគ្រប់ (ជំពាក់)
        changeEl.value = money(Math.abs(change));
        changeEl.style.color = "var(--warning)"; 
        if(labelEl) labelEl.innerText = "នៅខ្វះ/ជំពាក់ (៛)";
        if(statusEl) statusEl.value = 'Unpaid';
    }
}

function resetFormRows() {
  document.getElementById('itemTable').innerHTML = ''; 
  for(let i = 0; i < 3; i++) addItemRow();
  document.getElementById('cashReceived').value = ''; 
  document.getElementById('cashChange').value = '0 ៛';
  calculateGrandTotal();
}

// ២. ជំនួសមុខងារ saveData ដើម្បីឲ្យវាបញ្ជូនចំនួនលុយដែលបានបង់ (paid_amount) ទៅកាន់ DB
async function saveData() {
  let items = [];
  let dateVal = document.getElementById('date').value; 
  let cashierVal = document.getElementById('cashier').value;
  let customerVal = document.getElementById('customerInput').value.trim(); 
  let phoneVal = document.getElementById('phone').value; 
  let addressVal = document.getElementById('address').value;
  let statusVal = document.getElementById('paymentStatus') ? document.getElementById('paymentStatus').value : 'Paid';

  // ចាប់យកប្រាក់ដែលទទួលបានសរុប ដើម្បីយកទៅបែងចែកកាត់កងក្នុងវិក្កយបត្រ
  let totalCashReceived = parseFloat(document.getElementById('cashReceived').value) || 0;
  let remainingCashToApply = totalCashReceived;

  document.querySelectorAll('#itemTable tr').forEach(row => {
    let prodName = row.querySelector('.item-input').value.trim();
    if (prodName !== "") { 
        let qty = parseFloat(row.querySelector('.item-qty').value) || 0; 
        let price = parseFloat(row.querySelector('.item-price').value) || 0; 
        let discount = parseFloat(row.querySelector('.item-discount').value) || 0;
        let amount = (qty * price) - discount;
        let finalAmount = Math.max(0, amount);
        
        // គណនាប្រាក់ដែលអតិថិជនបានបង់លើទំនិញនីមួយៗ (Partial Payment Distribution)
        let rowPaid = 0;
        if (statusVal === 'Paid') {
            rowPaid = finalAmount; // បើទូទាត់រួច គឺចាត់ទុកថាបានលុយពេញ
        } else {
            if (remainingCashToApply >= finalAmount) {
                rowPaid = finalAmount;
                remainingCashToApply -= finalAmount;
            } else if (remainingCashToApply > 0) {
                rowPaid = remainingCashToApply;
                remainingCashToApply = 0;
            }
        }
        
        items.push({ 
            date: dateVal, 
            cashier: cashierVal, 
            customer_name: customerVal, 
            phone: phoneVal, 
            address: addressVal, 
            item: prodName, 
            unit: row.querySelector('.item-unit') ? row.querySelector('.item-unit').value.trim() : '', 
            package_type: row.querySelector('.item-pkg') ? row.querySelector('.item-pkg').value.trim() : '', 
            unit_value: row.querySelector('.item-uv') ? parseFloat(row.querySelector('.item-uv').value) || 0 : 0, 
            unit_measure: row.querySelector('.item-um') ? row.querySelector('.item-um').value.trim() : '', 
            standard_unit_value: row.querySelector('.item-suv') ? parseFloat(row.querySelector('.item-suv').value) || 0 : 0, 
            standard_unit_measure: row.querySelector('.item-sum') ? row.querySelector('.item-sum').value.trim() : '', 
            qty: qty, 
            price: price, 
            discount: discount, 
            total: finalAmount, 
            paid_amount: rowPaid, // បញ្ចូលទៅ DB
            status: statusVal 
        }); 
    }
  });

  if (items.length === 0) { showToast("សូមបញ្ចូលមុខទំនិញយ៉ាងហោចណាស់ 1!", "error"); return; }
  let btnSave = document.getElementById('btnSave'); btnSave.innerHTML = "Saving..."; btnSave.disabled = true;

  const { error } = await db.from(TABLE_SALES).insert(items);
  if (error) { 
      showToast("រក្សាទុកបរាជ័យ សូមពិនិត្យមើល Column ក្នុង Supabase!", "error"); console.error(error); 
  } else {
    showToast("រក្សាទុកជោគជ័យ!", "success");
    document.getElementById('customerInput').value = ''; document.getElementById('phone').value = ''; document.getElementById('address').value = '';
    resetFormRows(); 
    await refreshAllData(); 
  }
  btnSave.innerHTML = "<i class='bx bx-save'></i> រក្សាទុកការលក់"; btnSave.disabled = false;
}
// --- Dashboard & Analytics ---
function loadDashboard() {
  if(!salesData) return;
  let prodCount = {}; let cusCount = {};
  let currentMonthSales = 0; let lastMonthSales = 0; 
  let today = new Date(); let currentMonth = today.getMonth(); let currentYear = today.getFullYear();
  let lastMonth = currentMonth === 0 ? 11 : currentMonth - 1; let lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;

  salesData.forEach(row => {
    let rowTotal = row.total || row.Total || 0; // Support both cases
    let rowQty = row.qty || row.Qty || 1;
    let cusName = row.customer_name || row['customer-name'] || 'Walk-in';

    if(row.date) {
        let d = new Date(row.date);
        if(d.getMonth() === currentMonth && d.getFullYear() === currentYear) currentMonthSales += rowTotal;
        if(d.getMonth() === lastMonth && d.getFullYear() === lastMonthYear) lastMonthSales += rowTotal;
    }
    
    if(row.item) prodCount[row.item] = (prodCount[row.item] || 0) + rowQty;
    if(cusName !== 'Walk-in') cusCount[cusName] = (cusCount[cusName] || 0) + rowTotal;
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

let salesChartInstance = null;
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
  filteredData.forEach(item => { 
      totalSales += (item.total || item.Total || 0); 
      if(item.status === 'Unpaid') unpaidCount++; 
  });
  
  let uniqueOrders = new Set(filteredData.map(d => `${d.date}_${d.customer_name || d['customer-name']}`)).size;

  if(document.getElementById('dashSalesTotal')) document.getElementById('dashSalesTotal').innerText = money(totalSales);
  if(document.getElementById('dashOrders')) document.getElementById('dashOrders').innerText = uniqueOrders;
  if(document.getElementById('unpaidCountLabel')) document.getElementById('unpaidCountLabel').innerText = unpaidCount;
  if(document.getElementById('dateRangeLabelSales')) document.getElementById('dateRangeLabelSales').innerHTML = `<i class='bx bx-calendar'></i> ${dateLabel}`;
  if(document.getElementById('dateRangeLabelOrders')) document.getElementById('dateRangeLabelOrders').innerHTML = `<i class='bx bx-calendar'></i> ${dateLabel}`;

  const groupedByDate = {};
  filteredData.forEach(item => { 
      const dateStr = item.date || 'មិនស្គាល់'; 
      groupedByDate[dateStr] = (groupedByDate[dateStr] || 0) + (item.total || item.Total || 0); 
  });
  const sortedDates = Object.keys(groupedByDate).sort((a,b) => new Date(a) - new Date(b));
  const chartValues = sortedDates.map(date => groupedByDate[date]);

  const ctx = document.getElementById('salesChart'); if(!ctx) return;
  if(salesChartInstance) salesChartInstance.destroy();

  const isDarkMode = document.body.classList.contains('dark-mode');
  const gridColor = isDarkMode ? '#334155' : '#e2e8f0'; const textColor = isDarkMode ? '#94a3b8' : '#64748b';

  salesChartInstance = new Chart(ctx, {
    type: 'line',
    data: { labels: sortedDates.length > 0 ? sortedDates : ['គ្មានទិន្នន័យ'], datasets: [{ label: 'ចំណូលសរុប (៛)', data: chartValues.length > 0 ? chartValues : [0], borderColor: '#4f46e5', backgroundColor: 'rgba(79, 70, 229, 0.1)', borderWidth: 2, fill: true, tension: 0.3, pointBackgroundColor: '#4f46e5' }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, grid: { color: gridColor }, ticks: { color: textColor, callback: value => Number(value).toLocaleString() + ' ៛' } }, x: { grid: { display: false }, ticks: { color: textColor } } } }
  });
}

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

// --- Other UI & History ---
function loadRecentHistory() {
  let container = document.getElementById('recentHistoryContainer');
  if(!container) return;
  if (!salesData || salesData.length === 0) { container.innerHTML = '<div class="text-center muted pt-4 pb-4">គ្មានប្រវត្តិបញ្ចូលទេ</div>'; return; }

  let html = '';
  salesData.slice(0, 15).forEach(item => {
    let invNo = `INV-${String(item.id).padStart(4, '0')}`;
    let cName = item.customer_name || item['customer-name'] || 'Walk-in';
    let rowTotal = item.total || item.Total || 0;
    
    html += `
      <div class="activity-item" style="padding: 12px; border-bottom: 1px solid var(--line); display: flex; justify-content: space-between; align-items: center; gap: 10px;">
        <div class="user-cell" style="display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0;">
          <div class="item-icon" style="width: 32px; height: 32px; flex-shrink: 0; border-radius: 8px; background: rgba(79,70,229,0.1); color: var(--primary); display: grid; place-items: center;"><i class='bx bx-receipt'></i></div>
          <div style="min-width: 0;">
            <b style="color:var(--text); font-size:13px; display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${esc(cName)}</b>
            <small class="muted block" style="margin-top:2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${invNo} • ${esc(item.item || '')}</small>
          </div>
        </div>
        <div style="text-align: right; flex-shrink: 0;">
          <b style="color:var(--text); font-size:14px; display:block; margin-bottom:6px; white-space: nowrap;">${money(rowTotal)}</b>
          <button class="btn outline small" data-id="${item.id}" data-item="${esc(item.item)}" data-qty="${item.qty || 1}" data-price="${item.price || 0}" data-discount="${item.discount || item.Discount || 0}" data-status="${esc(item.status || 'Paid')}" onclick="handleEditBtn(this)">
            <i class='bx bx-edit'></i> កែប្រែ
          </button>
        </div>
      </div>
    `;
  });
  container.innerHTML = html;
}

async function performSearch() {
  let kw = document.getElementById('searchKeyword').value.trim();
  let startDate = document.getElementById('searchStartDate').value; let endDate = document.getElementById('searchEndDate').value;
  let tbody = document.getElementById('searchResultsTable'); let summary = document.getElementById('searchSummary');
  let btn = document.getElementById('btnSearchSubmit');
  if(!tbody) return;

  btn.innerHTML = "កំពុងស្វែងរក..."; btn.disabled = true;
  tbody.innerHTML = '<tr><td colspan="7" class="text-center muted pt-4 pb-4">កំពុងទាញយកទិន្នន័យ...</td></tr>';
  
  let query = db.from(TABLE_SALES).select('*').order('id', { ascending: false });
  if (kw) query = query.or(`customer_name.ilike.%${kw}%,phone.ilike.%${kw}%`);

  const { data, error } = await query;
  if (error || !data || data.length === 0) {
    btn.innerHTML = "ស្វែងរក"; btn.disabled = false; tbody.innerHTML = '<tr><td colspan="7" class="text-center muted pt-4 pb-4">រកមិនឃើញទិន្នន័យទេ</td></tr>';
    summary.innerText = "រកមិនឃើញទិន្នន័យទេ!"; summary.style.color = "var(--danger)"; return;
  }

  let filteredData = data;
  if (startDate || endDate) {
    let start = startDate ? new Date(startDate) : new Date('1970-01-01'); start.setHours(0,0,0,0);
    let end = endDate ? new Date(endDate) : new Date('2100-01-01'); end.setHours(23,59,59,999);
    filteredData = data.filter(item => { if (!item.date) return false; let itemDate = new Date(item.date); return itemDate >= start && itemDate <= end; });
  }

  let totalSpent = 0; let html = '';
  filteredData.forEach(item => {
    let rowTotal = item.total || item.Total || 0;
    totalSpent += rowTotal; 
    let invNo = `INV-${String(item.id).padStart(4, '0')}`;
    let cName = item.customer_name || item['customer-name'] || 'Walk-in';

    html += `<tr>
        <td class="muted">${item.date || '-'}</td>
        <td><b>${esc(cName)}</b><br><small class="muted">${invNo}</small></td>
        <td>${esc(item.item || '')}</td>
        <td class="text-center">${item.qty || 0}</td>
        <td class="text-right"><b style="color:var(--text);">${money(rowTotal)}</b></td>
        <td>${getBadge(item.status)}</td>
        <td style="white-space: nowrap;">
            <button class="btn outline small" data-id="${item.id}" onclick="deleteSaleEntry(${item.id})"><i class='bx bx-trash'></i></button>
        </td>
    </tr>`;
  });

  tbody.innerHTML = html || '<tr><td colspan="7" class="text-center muted pt-4 pb-4">គ្មានទិន្នន័យទេ</td></tr>';
  btn.innerHTML = "ស្វែងរក"; btn.disabled = false;
  summary.style.color = "var(--primary)"; summary.innerText = `សរុបទឹកប្រាក់លទ្ធផល: ${money(totalSpent)}`; 
}

// Modal actions & exports...
window.handleEditBtn = function(btn) { openEditSale(btn.getAttribute('data-id'), btn.getAttribute('data-item'), btn.getAttribute('data-qty'), btn.getAttribute('data-price'), btn.getAttribute('data-discount'), btn.getAttribute('data-status')); };
function openEditSale(id, item, qty, price, discount, status) { document.getElementById('editSaleId').value = id; document.getElementById('editSaleItem').value = item; document.getElementById('editSaleQty').value = qty || 1; document.getElementById('editSalePrice').value = price || 0; document.getElementById('editSaleDiscount').value = discount || 0; if(document.getElementById('editPaymentStatus')) document.getElementById('editPaymentStatus').value = status || 'Paid'; calculateEditTotal(); openModal('editSaleModal'); }
async function saveEditedSale() { let id = document.getElementById('editSaleId').value; let qty = parseFloat(document.getElementById('editSaleQty').value) || 0; let price = parseFloat(document.getElementById('editSalePrice').value) || 0; let discount = parseFloat(document.getElementById('editSaleDiscount').value) || 0; let statusVal = document.getElementById('editPaymentStatus') ? document.getElementById('editPaymentStatus').value : 'Paid'; let total = Math.max(0, (qty * price) - discount); const { error } = await db.from(TABLE_SALES).update({ qty: qty, price: price, discount: discount, total: total, status: statusVal }).eq('id', id); if(error) { showToast("កែប្រែបរាជ័យ!", "error"); } else { showToast("កែប្រែជោគជ័យ!", "success"); closeModal('editSaleModal'); await refreshAllData(); } }
function calculateEditTotal() { let qty = parseFloat(document.getElementById('editSaleQty').value) || 0; let price = parseFloat(document.getElementById('editSalePrice').value) || 0; let discount = parseFloat(document.getElementById('editSaleDiscount').value) || 0; document.getElementById('editSaleTotal').value = money(Math.max(0, (qty * price) - discount)); }
async function deleteSaleEntry(id) { if(confirm("តើអ្នកពិតជាចង់លុបទិន្នន័យនេះមែនទេ?")) { const { error } = await db.from(TABLE_SALES).delete().eq('id', id); if(error) { showToast("លុបបរាជ័យ!", "error"); } else { showToast("លុបជោគជ័យ!", "success"); await refreshAllData(); } } }

// Utilities
function exportToCSV() { if(!salesData || salesData.length===0){showToast("គ្មានទិន្នន័យ","error");return;} let csvContent="data:text/csv;charset=utf-8,\uFEFF"; csvContent+="វិក្កយបត្រ,ថ្ងៃទី,អតិថិជន,មុខទំនិញ,ចំនួន,តម្លៃ/ឯកតា,បញ្ចុះតម្លៃ,សរុបទឹកប្រាក់,ស្ថានភាព\r\n"; salesData.forEach(row=>{ let inv=`INV-${String(row.id).padStart(4,'0')}`; let arr=[inv,row.date||"",row.customer_name||row['customer-name']||"Walk-in",row.item||"",row.qty||0,row.price||0,row.discount||row.Discount||0,row.total||row.Total||0,row.status||"Paid"]; let rowStr=arr.map(e=>`"${String(e).replace(/"/g,'""')}"`).join(","); csvContent+=rowStr+"\r\n"; }); const encodedUri=encodeURI(csvContent); const link=document.createElement("a"); link.setAttribute("href",encodedUri); link.setAttribute("download",`Sales_Report_${new Date().toISOString().slice(0,10)}.csv`); document.body.appendChild(link); link.click(); document.body.removeChild(link); }
function copyClientLink() { let clientUrl = window.location.origin + window.location.pathname + "?view=client"; if(navigator.clipboard && window.isSecureContext) { navigator.clipboard.writeText(clientUrl).then(() => showToast("Copied!", "success")); } else { prompt("Copy this link:", clientUrl); } }
async function saveNewCustomer() { let name=document.getElementById('newCustName').value; let phone=document.getElementById('newCustPhone').value; let address=document.getElementById('newCustAddress').value; if(!name.trim())return; const {error}=await db.from(TABLE_CUSTOMERS).insert([{customer_name:name, phone:phone, address:address}]); if(!error){showToast("បានបន្ថែម!"); closeModal('customerModal'); loadCustomers();} }
async function saveNewProduct() { let name=document.getElementById('newProdName').value; let price=parseFloat(document.getElementById('newProdPrice').value)||0; if(!name.trim())return; const {error}=await db.from(TABLE_PRODUCTS).insert([{"Product Name":name, "Price":price}]); if(!error){showToast("បានបន្ថែម!"); closeModal('productModal'); loadProducts();} }

// --- មុខងារសម្រាប់បង្ហាញទិន្នន័យទំនិញ (Missing Function) ---
function renderProducts() {
    let tbody = document.getElementById('productsTableBody');
    if (!tbody) return;
    
    let kw = document.getElementById('searchProduct') ? document.getElementById('searchProduct').value.toLowerCase().trim() : '';
    let filteredData = productsData;
    
    if (kw) {
        filteredData = productsData.filter(p => p.name.toLowerCase().includes(kw));
    }
    
    // Update count badge
    let badge = document.getElementById('productCountBadge');
    if(badge) badge.innerText = filteredData.length;

    let html = '';
    filteredData.forEach(p => {
        html += `
        <tr>
            <td>
                <b>${esc(p.name)}</b>
                ${p.unit ? `<br><small class="muted">ខ្នាត: ${esc(p.unit)}</small>` : ''}
            </td>
            <td class="text-right"><b style="color:var(--text);">${money(p.price)}</b></td>
            <td><span class="status-badge success">មានក្នុងស្តុក</span></td>
        </tr>`;
    });
    
    tbody.innerHTML = html || '<tr><td colspan="3" class="text-center muted pt-4 pb-4">គ្មានទិន្នន័យទំនិញទេ</td></tr>';
}

// ៣. ជំនួសមុខងារ renderCustomers ឲ្យវាគណនាបំណុលជំពាក់បានសុក្រឹត
function renderCustomers() {
    let tbody = document.getElementById('customersTableBody');
    if (!tbody) return;
    
    let kw = document.getElementById('searchCustomer') ? document.getElementById('searchCustomer').value.toLowerCase().trim() : '';
    let filteredData = customersData;
    
    if (kw) {
        filteredData = customersData.filter(c => 
            (c.name && c.name.toLowerCase().includes(kw)) || 
            (c.phone && c.phone.includes(kw))
        );
    }

    let cusStats = {};
    if (salesData && salesData.length > 0) {
        salesData.forEach(row => {
            let cName = row.customer_name || row['customer-name'] || 'Walk-in';
            let total = row.total || row.Total || 0;
            let status = row.status || 'Paid';
            
            // ទាញយកប្រាក់ដែលបានបង់ 
            let paid = 0;
            if (row.paid_amount !== undefined && row.paid_amount !== null) {
                paid = row.paid_amount;
            } else {
                // សម្រាប់ទិន្នន័យចាស់ៗដែលអត់មាន paid_amount
                paid = (status.toLowerCase() === 'paid') ? total : 0;
            }
            
            if (!cusStats[cName]) {
                cusStats[cName] = { spent: 0, debt: 0, orders: 0, lastDate: row.date };
            }
            
            cusStats[cName].spent += total;
            cusStats[cName].orders += 1;
            
            // បំណុល = សរុប - លុយដែលបានបង់ (ទោះបង់មួយភាគក៏វាដកឲ្យដែរ)
            cusStats[cName].debt += (total - paid);
            
            if (row.date && new Date(row.date) > new Date(cusStats[cName].lastDate)) {
                cusStats[cName].lastDate = row.date;
            }
        });
    }

    let html = '';
    filteredData.forEach(c => {
        let stats = cusStats[c.name] || { spent: 0, debt: 0, orders: 0, lastDate: '-' };
        
        let debtBadge = stats.debt > 0 
            ? `<span class="status-badge" style="background:rgba(239,68,68,0.1); color:#ef4444;">ជំពាក់: ${money(stats.debt)}</span>` 
            : `<span class="status-badge success">គ្មានបំណុល</span>`;

        html += `
        <tr>
            <td>
                <b>${esc(c.name)}</b>
                ${c.address ? `<br><small class="muted"><i class='bx bx-map'></i> ${esc(c.address)}</small>` : ''}
            </td>
            <td>${esc(c.phone) || '-'}</td>
            <td class="text-right"><b style="color:var(--success);">${money(stats.spent)}</b></td>
            <td class="text-center">${debtBadge}</td>
            <td class="text-center">
                <button class="btn outline small" onclick="viewCustomerDetail('${esc(c.name)}', ${stats.orders}, ${stats.spent}, '${stats.lastDate}')">
                    <i class='bx bx-show'></i> មើលប្រវត្តិ
                </button>
            </td>
        </tr>`;
    });
    
    tbody.innerHTML = html || '<tr><td colspan="5" class="text-center muted pt-4 pb-4">គ្មានទិន្នន័យអតិថិជនទេ</td></tr>';
}

// --- មុខងារសម្រាប់មើលប្រវត្តិអតិថិជន (Modal Action) ---
window.viewCustomerDetail = function(name, orders, spent, lastDate) {
    document.getElementById('modalCusName').innerText = name;
    document.getElementById('modalCusOrders').innerText = orders;
    document.getElementById('modalCusSpent').innerText = money(spent);
    document.getElementById('modalCusLastDate').innerText = lastDate || '-';
    openModal('customerDetailModal');
};
// --- ១. មុខងារចម្លងវិក្កយបត្រជា Text សម្រាប់ Telegram ---
window.copyInvoiceToTelegram = function() {
    let dateVal = document.getElementById('date').value;
    let cName = document.getElementById('customerInput').value || 'Walk-in';
    let grandTotal = document.getElementById('grandTotal').innerText;
    let paid = document.getElementById('cashReceived').value || 0;
    let changeEl = document.getElementById('cashChange');
    let changeText = changeEl.previousElementSibling ? changeEl.previousElementSibling.innerText : '';
    
    let text = `📝 វិក្កយបត្រ (INVOICE)\n`;
    text += `📅 ថ្ងៃទី: ${dateVal}\n`;
    text += `👤 អតិថិជន: ${cName}\n`;
    text += `------------------------\n`;
    
    let hasItems = false;
    document.querySelectorAll('#itemTable tr').forEach(row => {
        let item = row.querySelector('.item-input').value;
        if(item) {
            hasItems = true;
            let qty = row.querySelector('.item-qty').value;
            let price = row.querySelector('.item-price').value;
            let amount = row.querySelector('.item-amount').value;
            text += `🔹 ${item} (${qty} x ${price}៛) = ${amount}\n`;
        }
    });
    
    if(!hasItems) { showToast("មិនទាន់មានទំនិញទេ!", "error"); return; }
    
    text += `------------------------\n`;
    text += `💰 សរុបទឹកប្រាក់: ${grandTotal}\n`;
    text += `💵 ប្រាក់ទទួលបាន: ${money(paid)}\n`;
    
    if (changeText.includes('ជំពាក់')) {
         text += `⚠️ ${changeText}: ${changeEl.value}\n`;
    }
    
    text += `\n🙏 សូមអរគុណសម្រាប់ការគាំទ្រ!`;

    if(navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(() => showToast("បានចម្លង! អាច Paste ក្នុង Telegram បាន", "success"));
    } else {
        alert("Copy Text:\n\n" + text);
    }
};

// --- ២. មុខងារចម្រោះ (Filter) វិក្កយបត្រជំពាក់ ---
let currentHistoryFilter = 'all';
window.setHistoryFilter = function(type) {
    currentHistoryFilter = type;
    document.getElementById('tabAllHistory').classList.remove('active');
    document.getElementById('tabUnpaidHistory').classList.remove('active');
    
    if(type === 'all') document.getElementById('tabAllHistory').classList.add('active');
    else document.getElementById('tabUnpaidHistory').classList.add('active');
    
    performSearch(); // ហៅមុខងារស្វែងរកម្តងទៀត
};

// --- ៣. កែសម្រួលមុខងារ performSearch និងបន្ថែមប៊ូតុង "សងរួច" ---
// (សូមជំនួសមុខងារ performSearch ចាស់ដោយកូដនេះ)
window.performSearch = async function() {
  let kw = document.getElementById('searchKeyword').value.trim();
  let startDate = document.getElementById('searchStartDate').value; 
  let endDate = document.getElementById('searchEndDate').value;
  let tbody = document.getElementById('searchResultsTable'); 
  let summary = document.getElementById('searchSummary');
  let btn = document.getElementById('btnSearchSubmit');
  if(!tbody) return;

  btn.innerHTML = "កំពុងស្វែងរក..."; btn.disabled = true;
  tbody.innerHTML = '<tr><td colspan="7" class="text-center muted pt-4 pb-4">កំពុងទាញយកទិន្នន័យ...</td></tr>';
  
  let query = db.from(TABLE_SALES).select('*').order('id', { ascending: false });
  if (kw) query = query.or(`customer_name.ilike.%${kw}%,phone.ilike.%${kw}%`);

  const { data, error } = await query;
  if (error || !data || data.length === 0) {
    btn.innerHTML = "ស្វែងរក"; btn.disabled = false; 
    tbody.innerHTML = '<tr><td colspan="7" class="text-center muted pt-4 pb-4">រកមិនឃើញទិន្នន័យទេ</td></tr>';
    summary.innerText = "រកមិនឃើញទិន្នន័យទេ!"; summary.style.color = "var(--danger)"; return;
  }

  let filteredData = data;
  
  // ចម្រោះតាមថ្ងៃខែ
  if (startDate || endDate) {
    let start = startDate ? new Date(startDate) : new Date('1970-01-01'); start.setHours(0,0,0,0);
    let end = endDate ? new Date(endDate) : new Date('2100-01-01'); end.setHours(23,59,59,999);
    filteredData = filteredData.filter(item => { if (!item.date) return false; let itemDate = new Date(item.date); return itemDate >= start && itemDate <= end; });
  }
  
  // ចម្រោះតាមស្ថានភាព (ជំពាក់)
  if (currentHistoryFilter === 'unpaid') {
      filteredData = filteredData.filter(item => item.status === 'Unpaid');
  }

  let totalSpent = 0; let html = '';
  filteredData.forEach(item => {
    let rowTotal = item.total || item.Total || 0;
    totalSpent += rowTotal; 
    let invNo = `INV-${String(item.id).padStart(4, '0')}`;
    let cName = item.customer_name || item['customer-name'] || 'Walk-in';

    // ប៊ូតុងសកម្មភាព (Action Buttons)
    let actionButtons = `<button class="btn outline small" data-id="${item.id}" onclick="deleteSaleEntry(${item.id})"><i class='bx bx-trash'></i></button>`;
    
    // បើវិក្កយបត្រនេះជំពាក់ បន្ថែមប៊ូតុង "សងរួច" ពណ៌បៃតង
    if (item.status === 'Unpaid') {
        actionButtons = `
            <button class="btn primary small" onclick="markAsPaid(${item.id}, ${rowTotal})" style="background:var(--success); border-color:var(--success); margin-right:5px; padding: 5px 8px;" title="ចុចទីនេះបើអតិថិជនសងលុយរួច"><i class='bx bx-check'></i> សងរួច</button>
            ${actionButtons}
        `;
    }

    html += `<tr>
        <td class="muted">${item.date || '-'}</td>
        <td><b>${esc(cName)}</b><br><small class="muted">${invNo}</small></td>
        <td>${esc(item.item || '')}</td>
        <td class="text-center">${item.qty || 0}</td>
        <td class="text-right"><b style="color:var(--text);">${money(rowTotal)}</b></td>
        <td>${getBadge(item.status)}</td>
        <td style="white-space: nowrap;">
            ${actionButtons}
        </td>
    </tr>`;
  });

  tbody.innerHTML = html || '<tr><td colspan="7" class="text-center muted pt-4 pb-4">គ្មានទិន្នន័យទេ</td></tr>';
  btn.innerHTML = "ស្វែងរក"; btn.disabled = false;
  
  let summaryText = currentHistoryFilter === 'unpaid' ? `សរុបប្រាក់កំពុងជំពាក់: ${money(totalSpent)}` : `សរុបទឹកប្រាក់លទ្ធផល: ${money(totalSpent)}`;
  summary.style.color = currentHistoryFilter === 'unpaid' ? "var(--warning)" : "var(--primary)"; 
  summary.innerText = summaryText; 
};

// --- ៤. មុខងារចុចប៊ូតុងសងរួច (Update to DB) ---
window.markAsPaid = async function(id, totalAmount) {
    if(confirm("តើអតិថិជនពិតជាបានទូទាត់ប្រាក់សងរួចរាល់មែនទេ?")) {
        // ដូរ Status ទៅជា Paid ហើយបញ្ចូលលុយដែលបានបង់ (paid_amount) ឲ្យស្មើនឹងលុយសរុប
        const { error } = await db.from(TABLE_SALES).update({ 
            status: 'Paid', 
            paid_amount: totalAmount 
        }).eq('id', id);
        
        if (error) {
            showToast("កំហុសក្នុងការកែប្រែទិន្នន័យ!", "error");
        } else {
            showToast("បញ្ជាក់ការទូទាត់ជោគជ័យ!", "success");
            await refreshAllData(); // ហៅទិន្នន័យថ្មីមកបង្ហាញ
        }
    }
};
// --- មុខងារទី១៖ ចម្លងរបាយការណ៍ប្រចាំថ្ងៃ (Daily Report for Boss) ---
window.generateDailyReport = function() {
    if (!salesData || salesData.length === 0) {
        showToast("គ្មានទិន្នន័យលក់ទេ!", "error");
        return;
    }

    // យកថ្ងៃនេះជាទម្រង់ YYYY-MM-DD ឬប្រើថ្ងៃចុងក្រោយដែលមានក្នុងប្រព័ន្ធ
    let todayStr = new Date().toISOString().slice(0, 10);
    
    // ចម្រោះយកតែទិន្នន័យដែលលក់ក្នុងថ្ងៃនេះ (ឬអាចប្ដូរតាមតម្រូវការ)
    let todaySales = salesData.filter(item => item.date === todayStr);
    
    // បើថ្ងៃនេះអត់ទាន់មានទិន្នន័យ អាចទាញយកទិន្នន័យចុងក្រោយមកធ្វើជា Report ជំនួស
    let reportDate = todayStr;
    if (todaySales.length === 0) {
        reportDate = "សរុបទិន្នន័យថ្មីៗ";
        todaySales = salesData.slice(0, 20); // យក 20 ប្រតិបត្តិការចុងក្រោយ
    }

    let totalOrders = new Set(todaySales.map(d => `${d.date}_${d.customer_name || d['customer-name']}`)).size;
    let totalRevenue = 0;
    let totalCollected = 0;
    let totalUnpaid = 0;

    let itemsSummary = {};

    todaySales.forEach(item => {
        let rev = item.total || item.Total || 0;
        let paid = item.paid_amount !== undefined ? item.paid_amount : ((item.status === 'Paid') ? rev : 0);
        let unpaid = rev - paid;

        totalRevenue += rev;
        totalCollected += paid;
        totalUnpaid += unpaid;

        let prodName = item.item || 'ផ្សេងៗ';
        let qty = item.qty || 1;
        itemsSummary[prodName] = (itemsSummary[prodName] || 0) + qty;
    });

    let text = `📊 របាយការណ៍ការលក់ប្រចាំថ្ងៃ\n`;
    text += `📅 កាលបរិច្ឆេទ: ${reportDate}\n`;
    text += `------------------------------------\n`;
    text += `🧾 ចំនួនវិក្កយបត្រ: ${totalOrders} ដង\n`;
    text += `💰 ចំណូលសរុប: ${money(totalRevenue)}\n`;
    text += `💵 ប្រាក់បានប្រមូលសរុប: ${money(totalCollected)}\n`;
    if (totalUnpaid > 0) {
        text += `⚠️ ទឹកប្រាក់ជំពាក់សរុប: ${money(totalUnpaid)}\n`;
    }
    text += `------------------------------------\n`;
    text += `🔥 ទំនិញលក់បានសរុប:\n`;
    
    for (let [pName, pQty] of Object.entries(itemsSummary)) {
        text += `▪️ ${pName}: ${pQty}\n`;
    }
    
    text += `\n🙏 គោរពជូនដំណឹងដល់ថៅកែ!`;

    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(() => {
            showToast("បានចម្លងរបាយការណ៍សម្រាប់ផ្ញើឱ្យថៅកែ!", "success");
        });
    } else {
        prompt("Copy របាយការណ៍ខាងក្រោម៖", text);
    }
};

// --- មុខងារទី២៖ ចម្លងរបាយការណ៍បំណុលម៉ូយម្នាក់ៗ (Customer Debt Statement) ---
window.viewCustomerDetail = function(name, orders, spent, lastDate) {
    document.getElementById('modalCusName').innerText = name;
    document.getElementById('modalCusOrders').innerText = orders;
    document.getElementById('modalCusSpent').innerText = money(spent);
    document.getElementById('modalCusLastDate').innerText = lastDate || '-';
    
    // បន្ថែមផ្ទាំងប៊ូតុង Copy វិក្កយបត្រជំពាក់ក្នុង Modal ប្រវត្តិអតិថិជន
    let modalCard = document.querySelector('#customerDetailModal .modal-card');
    let existingBtnArea = document.getElementById('modalDebtActionArea');
    if (existingBtnArea) existingBtnArea.remove();

    // រកមើលវិក្កយបត្រដែលអតិថិជននេះកំពុងជំពាក់
    let customerUnpaidItems = salesData.filter(row => {
        let cName = row.customer_name || row['customer-name'] || '';
        let status = row.status || 'Paid';
        return cName.toLowerCase() === name.toLowerCase() && status.toLowerCase() === 'unpaid';
    });

    let btnArea = document.createElement('div');
    btnArea.id = 'modalDebtActionArea';
    btnArea.style.marginTop = '20px';
    btnArea.style.textAlign = 'center';

    if (customerUnpaidItems.length > 0) {
        let totalDebt = customerUnpaidItems.reduce((sum, item) => {
            let rev = item.total || item.Total || 0;
            let paid = item.paid_amount !== undefined ? item.paid_amount : 0;
            return sum + (rev - paid);
        }, 0);

        btnArea.innerHTML = `
            <p style="color:var(--danger); font-weight:600; margin-bottom:10px;">កំពុងជំពាក់ប្រាក់សរុប: ${money(totalDebt)}</p>
            <button class="btn primary" style="background:#2AABEE; color:white; width:100%; justify-content:center;" onclick="copyCustomerDebtStatement('${esc(name)}')">
                <i class='bx bxl-telegram'></i> ចម្លងសារទារបំណុលម៉ូយនេះ
            </button>
        `;
    } else {
        btnArea.innerHTML = `<p style="color:var(--success); font-weight:600; margin-top:10px;">✅ អតិថិជននេះគ្មានបំណុលជំពាក់ទេ</p>`;
    }

    modalCard.appendChild(btnArea);
    openModal('customerDetailModal');
};

// មុខងារបង្កើតអត្ថបទសារទារបំណុល
window.copyCustomerDebtStatement = function(customerName) {
    let customerUnpaidItems = salesData.filter(row => {
        let cName = row.customer_name || row['customer-name'] || '';
        let status = row.status || 'Paid';
        return cName.toLowerCase() === customerName.toLowerCase() && status.toLowerCase() === 'unpaid';
    });

    if (customerUnpaidItems.length === 0) {
        showToast("គ្មានទិន្នន័យជំពាក់ទេ", "error");
        return;
    }

    let text = `📢 ជូនដំណឹងដល់អតិថិជន: ${customerName}\n`;
    text += `បញ្ជីវិក្កយបត្រដែលនៅខ្វះខាតការទូទាត់ប្រាក់៖\n`;
    text += `------------------------------------\n`;

    let grandTotalDebt = 0;
    customerUnpaidItems.forEach(item => {
        let invNo = `INV-${String(item.id).padStart(4, '0')}`;
        let rev = item.total || item.Total || 0;
        let paid = item.paid_amount !== undefined ? item.paid_amount : 0;
        let debt = rev - paid;
        grandTotalDebt += debt;

        text += `▪️ វិក្កយបត្រ: ${invNo} (${item.date || '-'})\n`;
        text += `   - ទំនិញ: ${item.item} (${item.qty} x ${item.price}៛)\n`;
        text += `   - ទឹកប្រាក់ខ្វះ: ${money(debt)}\n`;
    });

    text += `------------------------------------\n`;
    text += `💰 សរុបទឹកប្រាក់ត្រូវទូទាត់សង: ${money(grandTotalDebt)}\n`;
    text += `🙏 សូមអរគុណ!`;

    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(() => {
            showToast("បានចម្លងសារទារបំណុលរួចរាល់!", "success");
        });
    } else {
        prompt("Copy សារទារបំណុល៖", text);
    }
};
