// --- Supabase Connection ---
const SUPABASE_URL = 'https://esusfxriizpgepmqjkah.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVzdXNmeHJpaXpwZ2VwbXFqa2FoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA1NjQ4MDYsImV4cCI6MjEwNjE0MDgwNn0.l58qkx-CzvL55Ym5mN0pa9fTrqK6Xo8UY0pOpaLmi-4';
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const TABLE_SALES = 'sale-history'; 
const TABLE_PRODUCTS = 'products';
const TABLE_CUSTOMERS = 'customer_name';
const TABLE_EXPENSES = 'expenses'; 

let customersData = [];
let productsData = [];
let salesData = [];
let expensesData = []; 
let currentGrandTotalValue = 0;

const money = n => `${Number(n || 0).toLocaleString('en-US')}\u00A0៛`;
const esc = s => String(s ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));

function cleanStatus(statusStr) { return String(statusStr || 'Paid').replace(/'/g, ''); }

function getBadge(status) {
    let s = cleanStatus(status);
    if(s === 'Unpaid') return `<span class="status-badge" style="background:rgba(245,158,11,0.1); color:#f59e0b;">ជំពាក់</span>`;
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
  const isClientView = urlParams.get('view') === 'client';

  if (isClientView) {
    document.getElementById('customLoginModal').style.display = 'none';
    if(document.getElementById('adminSidebar')) document.getElementById('adminSidebar').style.display = 'none';
    if(document.getElementById('topbar')) document.getElementById('topbar').style.display = 'none';
    document.getElementById('appShell').style.display = 'flex';
    document.getElementById('mainView').style.marginLeft = '0';
    document.getElementById('mainView').style.padding = '0';
    document.getElementById('mainView').style.width = '100%';
    
    await loadSalesData();
    openTab('clientSearchTab');
  } else {
    document.getElementById('customLoginModal').style.display = 'flex';
    document.getElementById('appShell').style.display = 'none';
    document.getElementById('date').valueAsDate = new Date();
    
    await loadCustomers();
    await loadProducts(() => resetFormRows());
    await refreshAllData();
  }
};

async function refreshAllData() {
    await loadSalesData();
    await loadExpenses(); 
    loadDashboard();
    renderCustomers();
    performSearch();
    loadRecentHistory();
}

async function loadSalesData() {
    let allData = [];
    let from = 0;
    let step = 1000;
    let keepFetching = true;

    while (keepFetching) {
        let to = from + step - 1;
        const { data, error } = await db.from(TABLE_SALES)
            .select('*')
            .order('id', { ascending: false })
            .range(from, to);

        if (error) {
            console.error("កំហុសក្នុងការទាញទិន្នន័យ៖", error);
            keepFetching = false;
        } else {
            if (data && data.length > 0) {
                allData = allData.concat(data); 
                from += step;
                if (data.length < step) keepFetching = false;
            } else {
                keepFetching = false;
            }
        }
    }
    salesData = allData;
    console.log(`ទាញយកទិន្នន័យបានសម្រេច៖ ${salesData.length} ជួរ`);
}

async function loadProducts(callback) {
  const { data, error } = await db.from(TABLE_PRODUCTS).select('*');
  if (!error) {
    productsData = data.map(p => {
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
            standard_unit_measure: p['standard_unit_measure'] || "",
            category: p.agro_chemicals || "ផ្សេងៗ"
        };
    });
    
    let uniqueNames = [...new Set(productsData.map(p => p.name).filter(Boolean))];
    let datalist = document.getElementById('productListOptions');
    if(datalist) {
       let opts = '';
       uniqueNames.forEach(name => { opts += `<option value="${esc(name)}">`; });
       datalist.innerHTML = opts;
    }

    let uniqueCategories = [...new Set(productsData.map(p => p.category).filter(c => c !== "ផ្សេងៗ"))];
    let catSelect = document.getElementById('filterCategory');
    if(catSelect) {
        let catOpts = '<option value="all">គ្រប់ប្រភេទទាំងអស់</option>';
        uniqueCategories.forEach(c => { catOpts += `<option value="${esc(c)}">${esc(c)}</option>`; });
        catOpts += '<option value="ផ្សេងៗ">ផ្សេងៗ</option>';
        catSelect.innerHTML = catOpts;
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

function onCustomerSelect() {
  let val = document.getElementById('customerInput').value.trim();
  let found = customersData.find(c => c && c.name && c.name.toLowerCase() === val.toLowerCase());
  if (found) { document.getElementById('phone').value = found.phone || ""; document.getElementById('address').value = found.address || ""; }
}

function onProductSelect(input) {
  let row = input.closest('tr'); 
  let val = input.value.trim();
  let priceInput = row.querySelector('.item-price');
  
  let variations = productsData.filter(p => p && p.name && p.name.toLowerCase() === val.toLowerCase());
  
  if (variations.length > 0) { 
      let unitContainer = row.querySelector('.unit-container');
      
      if (variations.length > 1) {
          let selectHTML = `<select class="form-input item-unit" style="padding: 9px 4px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px;" onchange="onUnitChange(this)">`;
          variations.forEach(v => {
              selectHTML += `<option value="${esc(v.unit)}" data-price="${v.price}" data-pkg="${esc(v.package_type)}" data-uv="${v.unit_value}" data-um="${esc(v.unit_measure)}" data-suv="${v.standard_unit_value}" data-sum="${esc(v.standard_unit_measure)}">${esc(v.unit)}</option>`;
          });
          selectHTML += `</select>`;
          unitContainer.innerHTML = selectHTML;
      } else {
          let v = variations[0];
          unitContainer.innerHTML = `<input type="text" class="form-input item-unit" value="${esc(v.unit)}" readonly style="padding: 10px 8px; background:#f1f5f9; color:var(--muted);">`;
      }
      
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

function onUnitChange(selectEl) {
    let row = selectEl.closest('tr');
    let selectedOption = selectEl.options[selectEl.selectedIndex];
    
    let priceInput = row.querySelector('.item-price');
    if(priceInput) priceInput.value = selectedOption.getAttribute('data-price');
    
    if(row.querySelector('.item-pkg')) row.querySelector('.item-pkg').value = selectedOption.getAttribute('data-pkg') || "";
    if(row.querySelector('.item-uv')) row.querySelector('.item-uv').value = selectedOption.getAttribute('data-uv') || 0;
    if(row.querySelector('.item-um')) row.querySelector('.item-um').value = selectedOption.getAttribute('data-um') || "";
    if(row.querySelector('.item-suv')) row.querySelector('.item-suv').value = selectedOption.getAttribute('data-suv') || 0;
    if(row.querySelector('.item-sum')) row.querySelector('.item-sum').value = selectedOption.getAttribute('data-sum') || "";
    
    calculateRow(priceInput);
}

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

function calculateChange() {
    let receivedEl = document.getElementById('cashReceived'); 
    let changeEl = document.getElementById('cashChange');
    let statusEl = document.getElementById('paymentStatus');
    
    if(!receivedEl || !changeEl) return;
    
    let labelEl = changeEl.previousElementSibling; 
    let received = parseFloat(receivedEl.value) || 0; 
    let change = received - currentGrandTotalValue;
    
    if (receivedEl.value === '') {
        changeEl.value = "0 ៛";
        changeEl.style.color = "var(--text)";
        if(labelEl) labelEl.innerText = "ប្រាក់អាប់ (៛)";
    } else if (change >= 0) {
        changeEl.value = money(change);
        changeEl.style.color = "var(--success)"; 
        if(labelEl) labelEl.innerText = "ប្រាក់អាប់ (៛)";
        if(statusEl) statusEl.value = 'Paid';
    } else {
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

async function saveData() {
  let items = [];
  let dateVal = document.getElementById('date').value; 
  let cashierVal = document.getElementById('cashier').value;
  let customerVal = document.getElementById('customerInput').value.trim(); 
  let phoneVal = document.getElementById('phone').value; 
  let addressVal = document.getElementById('address').value;
  let statusVal = document.getElementById('paymentStatus') ? document.getElementById('paymentStatus').value : 'Paid';

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
        
        let rowPaid = 0;
        if (statusVal === 'Paid') {
            rowPaid = finalAmount; 
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
            date: dateVal, cashier: cashierVal, customer_name: customerVal, phone: phoneVal, address: addressVal, 
            item: prodName, 
            unit: row.querySelector('.item-unit') ? row.querySelector('.item-unit').value.trim() : '', 
            package_type: row.querySelector('.item-pkg') ? row.querySelector('.item-pkg').value.trim() : '', 
            unit_value: row.querySelector('.item-uv') ? parseFloat(row.querySelector('.item-uv').value) || 0 : 0, 
            unit_measure: row.querySelector('.item-um') ? row.querySelector('.item-um').value.trim() : '', 
            standard_unit_value: row.querySelector('.item-suv') ? parseFloat(row.querySelector('.item-suv').value) || 0 : 0, 
            standard_unit_measure: row.querySelector('.item-sum') ? row.querySelector('.item-sum').value.trim() : '', 
            qty: qty, price: price, discount: discount, total: finalAmount, paid_amount: rowPaid, status: statusVal 
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

function loadDashboard() {
  if(!salesData) return;
  
  let currentMonthSales = 0; let lastMonthSales = 0; 
  let today = new Date(); let currentMonth = today.getMonth(); let currentYear = today.getFullYear();
  let lastMonth = currentMonth === 0 ? 11 : currentMonth - 1; let lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;

  salesData.forEach(row => {
    let rowTotal = parseFloat(row.total || row.Total || 0); 
    if(row.date) {
        let d = new Date(row.date);
        if(d.getMonth() === currentMonth && d.getFullYear() === currentYear) currentMonthSales += rowTotal;
        if(d.getMonth() === lastMonth && d.getFullYear() === lastMonthYear) lastMonthSales += rowTotal;
    }
  });

  let growthText = "កើនឡើង"; let growthClass = "up";
  if(lastMonthSales > 0) {
      let percent = ((currentMonthSales - lastMonthSales) / lastMonthSales) * 100;
      if(percent < 0) { growthText = `ធ្លាក់ចុះ ${Math.abs(percent).toFixed(1)}%`; growthClass = "danger"; } else { growthText = `កើនឡើង ${percent.toFixed(1)}%`; growthClass = "up"; }
  }

  if(document.getElementById('dashSalesMonth')) document.getElementById('dashSalesMonth').innerText = money(currentMonthSales);
  if(document.getElementById('dashCustomers')) document.getElementById('dashCustomers').innerText = customersData.length;
  let momEl = document.getElementById('momGrowth'); if(momEl) { momEl.innerHTML = `<i class='bx bx-${growthClass==="up"?"up":"down"}-arrow-alt'></i> ${growthText}`; momEl.className = `trend ${growthClass}`; }

  // --- ការគណនា Sales Target ប្រចាំឆ្នាំ និងចំណេញសុទ្ធ ---
  let currentYearSales = 0;
  salesData.forEach(row => {
      let rowTotal = parseFloat(row.total || row.Total || 0); 
      if(row.date) {
          let d = new Date(row.date);
          if(d.getFullYear() === currentYear) {
              currentYearSales += rowTotal;
          }
      }
  });

  let currentYearExpenses = 0;
  expensesData.forEach(exp => {
      if(exp.date) {
          let d = new Date(exp.date);
          if(d.getFullYear() === currentYear) {
              currentYearExpenses += parseFloat(exp.amount || 0);
          }
      }
  });

  let yearlyTarget = parseFloat(localStorage.getItem('salesTarget_' + currentYear)) || 0; 
  let commissionRate = 0.03; // កម្រៃជើងសារ 3%
  
  let targetProgress = 0;
  if (yearlyTarget > 0) {
      targetProgress = (currentYearSales / yearlyTarget) * 100;
  }
  let myCommissionAmount = currentYearSales * commissionRate;
  let netEarnings = myCommissionAmount - currentYearExpenses;
  
  if(document.getElementById('targetProgressBar')) {
      document.getElementById('targetYearLabel').innerText = currentYear;
      document.getElementById('targetProgressBar').style.width = Math.min(targetProgress, 100) + '%';
      document.getElementById('targetPercentage').innerText = targetProgress.toFixed(1) + '%';
      
      if(document.getElementById('targetCurrentSales')) document.getElementById('targetCurrentSales').innerText = money(currentYearSales);
      
      if(document.getElementById('targetAmountDisplay')) {
          let isUSD = localStorage.getItem('salesTargetCurrency_' + currentYear) === 'USD';
          if (yearlyTarget > 0) {
              if(isUSD) {
                  let usdAmount = yearlyTarget / 4100;
                  document.getElementById('targetAmountDisplay').innerText = money(yearlyTarget) + ` ($${usdAmount.toLocaleString('en-US')})`;
              } else {
                  document.getElementById('targetAmountDisplay').innerText = money(yearlyTarget);
              }
          } else {
              document.getElementById('targetAmountDisplay').innerText = "មិនទាន់កំណត់ (ចុចប៊ូតុងកែប្រែ)";
          }
      }

      if(document.getElementById('myCommission')) document.getElementById('myCommission').innerText = money(myCommissionAmount);
      if(document.getElementById('dashboardExpenses')) document.getElementById('dashboardExpenses').innerText = money(currentYearExpenses);
      if(document.getElementById('netEarnings')) document.getElementById('netEarnings').innerText = money(netEarnings);
  }

  // --- រំលឹកអតិថិជន Follow-up ---
  let followUpContainer = document.getElementById('followUpContainer');
  if(followUpContainer) {
      let now = new Date();
      let dormantCustomers = [];
      let cusLastDates = {};
      let cusPhonesFromSales = {}; 
      
      salesData.forEach(s => {
          let cName = (s.customer_name || s['customer-name'] || '').trim();
          if (cName !== '' && cName !== 'Walk-in' && s.date) {
              if (!cusLastDates[cName] || new Date(s.date) > new Date(cusLastDates[cName])) {
                  cusLastDates[cName] = s.date;
              }
              if (s.phone && s.phone.trim() !== '' && s.phone.trim() !== '-') {
                  cusPhonesFromSales[cName] = s.phone.trim();
              }
          }
      });

      Object.keys(cusLastDates).forEach(cName => {
          let lastOrderDate = new Date(cusLastDates[cName]);
          let diffTime = Math.abs(now - lastOrderDate);
          let diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          
          if(diffDays > 30) {
              dormantCustomers.push({ name: cName, days: diffDays, lastDate: cusLastDates[cName] });
          }
      });
      
      let htmlFollowUp = '';
      dormantCustomers.sort((a,b) => b.days - a.days).slice(0, 8).forEach(c => {
          let custObj = customersData.find(cust => cust.name.trim().toLowerCase() === c.name.toLowerCase());
          let phoneInfo = custObj ? (custObj.phone || '').trim() : '';
          
          if (phoneInfo === '' || phoneInfo === '-') {
              phoneInfo = cusPhonesFromSales[c.name] || '';
          }
          
          let phoneDisplay = (phoneInfo !== '') ? phoneInfo : 'គ្មានលេខ';
          
          let callBtn = '';
          if (phoneInfo !== '') {
              callBtn = `<a href="tel:${phoneInfo}" class="btn outline small" style="border-color:var(--success); color:var(--success); white-space: nowrap;"><i class='bx bx-phone-call'></i> ខល</a>`;
          } else {
              callBtn = `<button class="btn outline small" style="border-color:var(--line); color:var(--muted); background: rgba(0,0,0,0.02); cursor:not-allowed; white-space: nowrap;" title="អតិថិជននេះមិនមានលេខទូរស័ព្ទទេ" disabled><i class='bx bx-phone-off'></i> អត់លេខ</button>`;
          }

          htmlFollowUp += `
            <tr>
              <td style="white-space: nowrap;"><b style="color: var(--text);">${esc(c.name)}</b><br><small class="muted">${phoneDisplay}</small></td>
              <td class="text-center" style="white-space: nowrap;"><span class="status-badge" style="background:#fef3c7; color:#d97706; white-space: nowrap;">បាត់មុខ ${c.days} ថ្ងៃ</span></td>
              <td class="text-right" style="white-space: nowrap;">${callBtn}</td>
            </tr>`;
      });
      
      followUpContainer.innerHTML = htmlFollowUp || '<tr><td colspan="3" class="text-center muted pt-4">មិនមានអតិថិជនត្រូវ Follow up ទេ</td></tr>';
  }

  // ហៅការគូរក្រាហ្វិក និងតារាងដែលរត់តាម Filter
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
  let catRev = {}; 
  let prodCount = {}; let cusCount = {}; let catCount = {};

  filteredData.forEach(item => { 
      let rev = parseFloat(item.total || item.Total || 0);
      let rowQty = parseFloat(item.qty || item.Qty || 1);
      let cusName = item.customer_name || item['customer-name'] || 'Walk-in';
      let categoryName = item.agro_chemicals || 'ផ្សេងៗ'; 
      
      totalSales += rev; 
      
      let cleanStat = cleanStatus(item.status);
      if(cleanStat === 'Unpaid') unpaidCount++; 
      
      catRev[categoryName] = (catRev[categoryName] || 0) + rev;
      if(item.item) prodCount[item.item] = (prodCount[item.item] || 0) + rowQty;
      if(cusName !== 'Walk-in') cusCount[cusName] = (cusCount[cusName] || 0) + rev;
      catCount[categoryName] = (catCount[categoryName] || 0) + rowQty;
  });
  
  let uniqueOrders = new Set(filteredData.map(d => `${d.date}_${d.customer_name || d['customer-name']}`)).size;

  if(document.getElementById('dashSalesTotal')) document.getElementById('dashSalesTotal').innerText = money(totalSales);
  if(document.getElementById('dashOrders')) document.getElementById('dashOrders').innerText = uniqueOrders;
  if(document.getElementById('unpaidCountLabel')) document.getElementById('unpaidCountLabel').innerText = unpaidCount;
  if(document.getElementById('dateRangeLabelSales')) document.getElementById('dateRangeLabelSales').innerHTML = `<i class='bx bx-calendar'></i> ${dateLabel}`;
  if(document.getElementById('dateRangeLabelOrders')) document.getElementById('dateRangeLabelOrders').innerHTML = `<i class='bx bx-calendar'></i> ${dateLabel}`;

  // --- បង្ហាញអតិថិជន VIP ---
  let sortedCus = Object.keys(cusCount).map(k => ({ name: k, spent: cusCount[k] })).sort((a,b) => b.spent - a.spent).slice(0, 5);
  let cContainer = document.getElementById('topCustomersContainer');
  if(cContainer) {
      let htmlC = '';
      sortedCus.forEach((c, index) => { 
        let initial = c.name.substring(0, 2).toUpperCase();
        let badge = '';
        if (c.spent >= 50000000) badge = `<span class="status-badge" style="background: linear-gradient(135deg, #f59e0b, #fbbf24); color: white; padding: 2px 6px; font-size: 9px;"><i class='bx bx-medal'></i> Gold</span>`;
        else if (c.spent >= 15000000) badge = `<span class="status-badge" style="background: linear-gradient(135deg, #94a3b8, #cbd5e1); color: white; padding: 2px 6px; font-size: 9px;"><i class='bx bx-medal'></i> Silver</span>`;
        
        htmlC += `<tr><td><div class="user-cell"><div class="user-icon" style="width:28px;height:28px;font-size:11px;">${esc(initial)}</div><b style="font-size: 13px;">${esc(c.name)}</b> ${badge}</div></td><td class="text-right" style="color:var(--success); font-weight:bold;">${money(c.spent)}</td></tr>`; 
      });
      cContainer.innerHTML = htmlC || '<tr><td colspan="2" class="text-center muted pt-4">គ្មានទិន្នន័យ</td></tr>';
  }

  // --- បង្ហាញមុខទំនិញលក់ដាច់បំផុត ---
  let sortedProducts = Object.keys(prodCount).map(k => ({ name: k, qty: prodCount[k] })).sort((a,b) => b.qty - a.qty).slice(0, 5);
  let pContainer = document.getElementById('topProductsContainer');
  if(pContainer) {
      let htmlP = '';
      sortedProducts.forEach((p, index) => { 
          htmlP += `<tr>
              <td><div class="user-cell"><div class="item-icon" style="background:rgba(245, 158, 11, 0.1); color:#f59e0b; width:24px; height:24px; font-size:12px; font-weight:bold;">${index + 1}</div><b style="font-size: 13px;">${esc(p.name)}</b></div></td>
              <td class="text-center"><b>${p.qty}</b></td>
              <td class="text-center" style="white-space: nowrap;">
                  <button class="btn outline small" style="border-color:var(--primary); color:var(--primary);" onclick="viewProductDetail('${esc(p.name)}')"><i class='bx bx-show'></i> Detail</button>
              </td>
          </tr>`; 
      });
      pContainer.innerHTML = htmlP || '<tr><td colspan="3" class="text-center muted pt-4">គ្មានទិន្នន័យ</td></tr>';
  }
  // --- បង្ហាញប្រភេទថ្នាំលក់ដាច់ (ទម្រង់ដើមធម្មតាវិញ) ---
  let sortedCats = Object.keys(catCount).map(k => ({ name: k, qty: catCount[k] })).sort((a,b) => b.qty - a.qty).slice(0, 5);
  let catContainer = document.getElementById('topCategoriesContainer');
  if(catContainer) {
      let htmlCat = '';
      sortedCats.forEach((c, index) => { 
          htmlCat += `<tr>
              <td><div class="user-cell"><div class="item-icon" style="background:#e0e7ff; color:#4f46e5; width:24px; height:24px; font-size:12px; font-weight:bold;">${index + 1}</div><b style="font-size: 13px;">${esc(c.name)}</b></div></td>
              <td class="text-center"><b>${c.qty}</b></td>
              <td class="text-center" style="white-space: nowrap;">
                  <button class="btn outline small" style="border-color:var(--primary); color:var(--primary);" onclick="viewCategoryDetail('${esc(c.name)}')"><i class='bx bx-show'></i> Detail</button>
              </td>
          </tr>`; 
      });
      catContainer.innerHTML = htmlCat || '<tr><td colspan="3" class="text-center muted pt-4">គ្មានទិន្នន័យ</td></tr>';
  }

  const groupedByDate = {};
  filteredData.forEach(item => { 
      const dateStr = item.date || 'មិនស្គាល់'; 
      groupedByDate[dateStr] = (groupedByDate[dateStr] || 0) + parseFloat(item.total || item.Total || 0); 
  });
  const sortedDates = Object.keys(groupedByDate).sort((a,b) => new Date(a) - new Date(b));
  const chartValues = sortedDates.map(date => groupedByDate[date]);

  // គូរក្រាហ្វិកខ្សែ
  const ctx = document.getElementById('salesChart'); 
  if(ctx) {
      if(salesChartInstance) salesChartInstance.destroy();
      const isDarkMode = document.body.classList.contains('dark-mode');
      const gridColor = isDarkMode ? '#334155' : '#e2e8f0'; const textColor = isDarkMode ? '#94a3b8' : '#64748b';
    
      salesChartInstance = new Chart(ctx, {
        type: 'line',
        data: { labels: sortedDates.length > 0 ? sortedDates : ['គ្មានទិន្នន័យ'], datasets: [{ label: 'ចំណូលសរុប (៛)', data: chartValues.length > 0 ? chartValues : [0], borderColor: '#4f46e5', backgroundColor: 'rgba(79, 70, 229, 0.1)', borderWidth: 2, fill: true, tension: 0.3, pointBackgroundColor: '#4f46e5' }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, grid: { color: gridColor }, ticks: { color: textColor, callback: value => Number(value).toLocaleString() + ' ៛' } }, x: { grid: { display: false }, ticks: { color: textColor } } } }
      });
  }
  
  // គូរក្រាហ្វិករង្វង់
  const ctxPie = document.getElementById('categoryRevChart');
  if(ctxPie) {
      if(window.categoryRevChartInstance) window.categoryRevChartInstance.destroy();
      window.categoryRevChartInstance = new Chart(ctxPie, {
          type: 'doughnut',
          data: {
              labels: Object.keys(catRev).length > 0 ? Object.keys(catRev) : ['គ្មានទិន្នន័យ'],
              datasets: [{
                  data: Object.values(catRev).length > 0 ? Object.values(catRev) : [1],
                  backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#64748b']
              }]
          },
          options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { boxWidth: 12 } } }, cutout: '60%' }
      });
  }
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

function loadRecentHistory() {
  let container = document.getElementById('recentHistoryContainer');
  if(!container) return;
  if (!salesData || salesData.length === 0) { container.innerHTML = '<div class="text-center muted pt-4 pb-4">គ្មានប្រវត្តិបញ្ចូលទេ</div>'; return; }

  let html = '';
  salesData.slice(0, 15).forEach(item => {
    let invNo = `INV-${String(item.id).padStart(4, '0')}`;
    let cName = item.customer_name || item['customer-name'] || 'Walk-in';
    let rowTotal = parseFloat(item.total || item.Total || 0);
    
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

window.performSearch = function() {
  let kw = document.getElementById('searchKeyword') ? document.getElementById('searchKeyword').value.trim().toLowerCase() : '';
  let cleanKw = kw.replace(/\s/g, ''); 
  let startDate = document.getElementById('searchStartDate') ? document.getElementById('searchStartDate').value : ''; 
  let endDate = document.getElementById('searchEndDate') ? document.getElementById('searchEndDate').value : '';
  let tbody = document.getElementById('searchResultsTable'); 
  let summary = document.getElementById('searchSummary');
  if(!tbody) return;

  let filteredData = salesData;
  
  if (kw) {
      filteredData = filteredData.filter(item => {
          let cName = (item.customer_name || item['customer-name'] || '').toLowerCase();
          let phone = (item.phone || '').toLowerCase().replace(/\s/g, '');
          return cName.includes(kw) || phone.includes(cleanKw);
      });
  }
  
  let defaultStart = startDate ? startDate : '2026-01-01';
  let start = new Date(defaultStart); start.setHours(0,0,0,0);
  let end = endDate ? new Date(endDate) : new Date('2100-01-01'); end.setHours(23,59,59,999);
  
  filteredData = filteredData.filter(item => { 
      if (!item.date) return false; 
      let itemDate = new Date(item.date); 
      return itemDate >= start && itemDate <= end; 
  });
  
  if (currentHistoryFilter === 'unpaid') {
      filteredData = filteredData.filter(item => cleanStatus(item.status) === 'Unpaid');
  }

  let totalSpent = 0; let html = '';
  filteredData.forEach(item => {
    let rowTotal = parseFloat(item.total || item.Total || 0);
    totalSpent += rowTotal; 
    let invNo = `INV-${String(item.id).padStart(4, '0')}`;
    let cName = item.customer_name || item['customer-name'] || 'Walk-in';

    let actionButtons = `<button class="btn outline small" data-id="${item.id}" onclick="deleteSaleEntry(${item.id})"><i class='bx bx-trash'></i></button>`;
    
    if (cleanStatus(item.status) === 'Unpaid') {
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
        <td style="white-space: nowrap;">${actionButtons}</td>
    </tr>`;
  });

  tbody.innerHTML = html || `<tr><td colspan="7" class="text-center muted pt-4 pb-4">គ្មានទិន្នន័យចាប់ពីថ្ងៃទី ${defaultStart} ទេ</td></tr>`;
  
  if(summary) {
      let summaryText = currentHistoryFilter === 'unpaid' ? `សរុបប្រាក់កំពុងជំពាក់: ${money(totalSpent)}` : `សរុបទឹកប្រាក់លទ្ធផល: ${money(totalSpent)}`;
      summary.style.color = currentHistoryFilter === 'unpaid' ? "var(--warning)" : "var(--primary)"; 
      summary.innerText = summaryText; 
  }
};

window.handleEditBtn = function(btn) { openEditSale(btn.getAttribute('data-id'), btn.getAttribute('data-item'), btn.getAttribute('data-qty'), btn.getAttribute('data-price'), btn.getAttribute('data-discount'), btn.getAttribute('data-status')); };
function openEditSale(id, item, qty, price, discount, status) { document.getElementById('editSaleId').value = id; document.getElementById('editSaleItem').value = item; document.getElementById('editSaleQty').value = qty || 1; document.getElementById('editSalePrice').value = price || 0; document.getElementById('editSaleDiscount').value = discount || 0; if(document.getElementById('editPaymentStatus')) document.getElementById('editPaymentStatus').value = cleanStatus(status); calculateEditTotal(); openModal('editSaleModal'); }
async function saveEditedSale() { let id = document.getElementById('editSaleId').value; let qty = parseFloat(document.getElementById('editSaleQty').value) || 0; let price = parseFloat(document.getElementById('editSalePrice').value) || 0; let discount = parseFloat(document.getElementById('editSaleDiscount').value) || 0; let statusVal = document.getElementById('editPaymentStatus') ? document.getElementById('editPaymentStatus').value : 'Paid'; let total = Math.max(0, (qty * price) - discount); const { error } = await db.from(TABLE_SALES).update({ qty: qty, price: price, discount: discount, total: total, status: statusVal }).eq('id', id); if(error) { showToast("កែប្រែបរាជ័យ!", "error"); } else { showToast("កែប្រែជោគជ័យ!", "success"); closeModal('editSaleModal'); await refreshAllData(); } }
function calculateEditTotal() { let qty = parseFloat(document.getElementById('editSaleQty').value) || 0; let price = parseFloat(document.getElementById('editSalePrice').value) || 0; let discount = parseFloat(document.getElementById('editSaleDiscount').value) || 0; document.getElementById('editSaleTotal').value = money(Math.max(0, (qty * price) - discount)); }
async function deleteSaleEntry(id) { if(confirm("តើអ្នកពិតជាចង់លុបទិន្នន័យនេះមែនទេ?")) { const { error } = await db.from(TABLE_SALES).delete().eq('id', id); if(error) { showToast("លុបបរាជ័យ!", "error"); } else { showToast("លុបជោគជ័យ!", "success"); await refreshAllData(); } } }

function exportToCSV() { if(!salesData || salesData.length===0){showToast("គ្មានទិន្នន័យ","error");return;} let csvContent="data:text/csv;charset=utf-8,\uFEFF"; csvContent+="វិក្កយបត្រ,ថ្ងៃទី,អតិថិជន,មុខទំនិញ,ចំនួន,តម្លៃ/ឯកតា,បញ្ចុះតម្លៃ,សរុបទឹកប្រាក់,ស្ថានភាព\r\n"; salesData.forEach(row=>{ let inv=`INV-${String(row.id).padStart(4,'0')}`; let arr=[inv,row.date||"",row.customer_name||row['customer-name']||"Walk-in",row.item||"",row.qty||0,row.price||0,row.discount||row.Discount||0,row.total||row.Total||0,cleanStatus(row.status)]; let rowStr=arr.map(e=>`"${String(e).replace(/"/g,'""')}"`).join(","); csvContent+=rowStr+"\r\n"; }); const encodedUri=encodeURI(csvContent); const link=document.createElement("a"); link.setAttribute("href",encodedUri); link.setAttribute("download",`Sales_Report_${new Date().toISOString().slice(0,10)}.csv`); document.body.appendChild(link); link.click(); document.body.removeChild(link); }

window.copyClientLink = function() { 
    let currentUrl = window.location.href.split('?')[0]; 
    let clientUrl = currentUrl + "?view=client"; 
    
    if(navigator.clipboard && window.isSecureContext) { 
        navigator.clipboard.writeText(clientUrl).then(() => showToast("បាន Copy Link ម៉ូយ!", "success")); 
    } else { 
        prompt("Copy Link ខាងក្រោមនេះផ្ញើឲ្យម៉ូយ:", clientUrl); 
    } 
};

async function saveNewCustomer() { let name=document.getElementById('newCustName').value; let phone=document.getElementById('newCustPhone').value; let address=document.getElementById('newCustAddress').value; if(!name.trim())return; const {error}=await db.from(TABLE_CUSTOMERS).insert([{customer_name:name, phone:phone, address:address}]); if(!error){showToast("បានបន្ថែម!"); closeModal('customerModal'); loadCustomers();} }

async function saveNewProduct() { 
    let name = document.getElementById('newProdName').value.trim(); 
    let price = parseFloat(document.getElementById('newProdPrice').value) || 0; 
    let category = document.getElementById('newProdCategory').value;
    
    let unitValue = parseFloat(document.getElementById('newProdUnitValue').value) || null;
    let unitMeasure = document.getElementById('newProdUnitMeasure').value;
    let packageType = document.getElementById('newProdPackage').value;
    
    let stdValue = parseFloat(document.getElementById('newProdStdValue').value) || null;
    let stdMeasure = document.getElementById('newProdStdMeasure').value;

    if(!name) { showToast("សូមបញ្ចូលឈ្មោះទំនិញ!", "error"); return; }

    let newProductData = {
        "Product Name": name, "Price": price, "agro_chemicals": category, "unit_value": unitValue, "unit_measure": unitMeasure, "package_type": packageType, "standard_unit_value": stdValue, "standard_unit_measure": stdMeasure
    };

    let btnSave = document.querySelector('#productModal .btn.primary');
    let originalText = btnSave.innerHTML;
    btnSave.innerHTML = "កំពុងរក្សាទុក..."; btnSave.disabled = true;

    const { error } = await db.from(TABLE_PRODUCTS).insert([newProductData]); 
    
    if(!error){
        showToast("បានបន្ថែមទំនិញថ្មីជោគជ័យ!", "success"); 
        document.getElementById('newProdName').value = ''; document.getElementById('newProdPrice').value = ''; document.getElementById('newProdUnitValue').value = ''; document.getElementById('newProdStdValue').value = '';
        closeModal('productModal'); 
        await loadProducts();
    } else { showToast("បរាជ័យក្នុងការបន្ថែម សូមពិនិត្យ Database!", "error"); }
    btnSave.innerHTML = originalText; btnSave.disabled = false;
}

function renderProducts() {
    let tbody = document.getElementById('productsTableBody');
    if (!tbody) return;
    
    let kw = document.getElementById('searchProduct') ? document.getElementById('searchProduct').value.toLowerCase().trim() : '';
    let cat = document.getElementById('filterCategory') ? document.getElementById('filterCategory').value : 'all';
    
    let filteredData = productsData;
    
    if (cat !== 'all') { filteredData = filteredData.filter(p => p.category === cat); }
    if (kw) { filteredData = filteredData.filter(p => p.name.toLowerCase().includes(kw)); }
    
    let badge = document.getElementById('productCountBadge');
    if(badge) badge.innerText = filteredData.length;

    let html = '';
    filteredData.forEach(p => {
        let catBadge = p.category !== 'ផ្សេងៗ' ? `<span class="status-badge" style="background:#e0e7ff; color:#4f46e5; margin-top:6px; display:inline-block; font-size:10px;"><i class='bx bx-purchase-tag'></i> ${esc(p.category)}</span>` : '';
        
        // 🌟 បន្ថែមប៊ូតុង Detail នៅក្នុងជួរ <td> ចុងក្រោយ 🌟
        html += `<tr>
            <td><b>${esc(p.name)}</b>${p.unit ? `<br><small class="muted">ខ្នាត: ${esc(p.unit)}</small>` : ''}<br>${catBadge}</td>
            <td class="text-right"><b style="color:var(--text);">${money(p.price)}</b></td>
            <td class="text-center"><span class="status-badge success">មានក្នុងស្តុក</span></td>
            <td class="text-center" style="white-space: nowrap;">
                <button class="btn outline small" style="border-color:var(--primary); color:var(--primary);" onclick="viewProductDetail('${esc(p.name)}')"><i class='bx bx-show'></i> Detail</button>
            </td>
        </tr>`;
    });
    
    // ប្តូរ colspan ពី 3 ទៅ 4
    tbody.innerHTML = html || '<tr><td colspan="4" class="text-center muted pt-4 pb-4">គ្មានទិន្នន័យទំនិញទេ</td></tr>';
}

function renderCustomers() {
    let tbody = document.getElementById('customersTableBody');
    if (!tbody) return;
    
    let kw = document.getElementById('searchCustomer') ? document.getElementById('searchCustomer').value.toLowerCase().trim() : '';
    let cleanKw = kw.replace(/\s/g, '');
    let filteredData = customersData;
    
    if (kw) {
        filteredData = customersData.filter(c => {
            let cName = (c.name || '').toLowerCase();
            let cPhone = (c.phone || '').toLowerCase().replace(/\s/g, '');
            return cName.includes(kw) || cPhone.includes(cleanKw);
        });
    }

    let cusStats = {};
    let debtNewTotal = 0;
    let debtMediumTotal = 0;
    let debtOldTotal = 0;
    let now = new Date();

    if (salesData && salesData.length > 0) {
        salesData.forEach(row => {
            let cName = (row.customer_name || row['customer-name'] || 'Walk-in').trim();
            let total = parseFloat(row.total || row.Total || 0);
            let status = cleanStatus(row.status).toLowerCase();
            
            let paid = 0;
            if (status === 'paid') {
                paid = total; 
            } else {
                paid = parseFloat(row.paid_amount || 0);
            }
            
            if (!cusStats[cName]) { cusStats[cName] = { spent: 0, debt: 0, orders: 0, lastDate: row.date }; }
            
            cusStats[cName].spent += total;
            cusStats[cName].orders += 1;
            
            let debtAmount = total - paid;
            cusStats[cName].debt += debtAmount;
            
            if (row.date && new Date(row.date) > new Date(cusStats[cName].lastDate)) { cusStats[cName].lastDate = row.date; }

            if (debtAmount > 0 && row.date) {
                let saleDate = new Date(row.date);
                let diffTime = Math.abs(now - saleDate);
                let diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                
                if (diffDays <= 15) {
                    debtNewTotal += debtAmount;
                } else if (diffDays > 15 && diffDays <= 30) {
                    debtMediumTotal += debtAmount;
                } else {
                    debtOldTotal += debtAmount;
                }
            }
        });
    }

    if(document.getElementById('debtNew')) document.getElementById('debtNew').innerText = money(debtNewTotal);
    if(document.getElementById('debtMedium')) document.getElementById('debtMedium').innerText = money(debtMediumTotal);
    if(document.getElementById('debtOld')) document.getElementById('debtOld').innerText = money(debtOldTotal);

    let html = '';
    filteredData.forEach(c => {
        let stats = cusStats[c.name.trim()] || { spent: 0, debt: 0, orders: 0, lastDate: '-' };
        let debtBadge = stats.debt > 0 ? `<span class="status-badge" style="background:rgba(239,68,68,0.1); color:#ef4444;">ជំពាក់: ${money(stats.debt)}</span>` : `<span class="status-badge success">គ្មានបំណុល</span>`;

        let tierBadge = `<span class="status-badge" style="background: linear-gradient(135deg, #d97706, #b45309); color: white;"><i class='bx bx-medal'></i> Bronze</span>`;
        if (stats.spent >= 50000000) {
            tierBadge = `<span class="status-badge" style="background: linear-gradient(135deg, #f59e0b, #fbbf24); color: white;"><i class='bx bx-medal'></i> Gold VIP</span>`;
        } else if (stats.spent >= 15000000) {
            tierBadge = `<span class="status-badge" style="background: linear-gradient(135deg, #94a3b8, #cbd5e1); color: white;"><i class='bx bx-medal'></i> Silver</span>`;
        }

        html += `<tr>
            <td><b>${esc(c.name)}</b>${c.address ? `<br><small class="muted"><i class='bx bx-map'></i> ${esc(c.address)}</small>` : ''}</td>
            <td>${esc(c.phone) || '-'}</td>
            <td class="text-right"><b style="color:var(--success);">${money(stats.spent)}</b></td>
            <td class="text-center">${tierBadge}</td>
            <td class="text-center">${debtBadge}</td>
            <td class="text-center"><button class="btn outline small" onclick="viewCustomerDetail('${esc(c.name)}', ${stats.orders}, ${stats.spent}, '${stats.lastDate}')"><i class='bx bx-show'></i> មើលប្រវត្តិ</button></td>
        </tr>`;
    });
    
    tbody.innerHTML = html || '<tr><td colspan="6" class="text-center muted pt-4 pb-4">គ្មានទិន្នន័យអតិថិជនទេ</td></tr>';
}

window.viewCustomerDetail = function(name, orders, spent, lastDate) {
    document.getElementById('modalCusName').innerText = name;
    document.getElementById('modalCusOrders').innerText = orders;
    document.getElementById('modalCusSpent').innerText = money(spent);
    document.getElementById('modalCusLastDate').innerText = lastDate || '-';
    
    let modalCard = document.querySelector('#customerDetailModal .modal-card');
    let existingBtnArea = document.getElementById('modalDebtActionArea');
    if (existingBtnArea) existingBtnArea.remove();

    let customerUnpaidItems = salesData.filter(row => {
        let cName = (row.customer_name || row['customer-name'] || '').trim();
        return cName.toLowerCase() === name.trim().toLowerCase() && cleanStatus(row.status).toLowerCase() === 'unpaid';
    });

    let btnArea = document.createElement('div');
    btnArea.id = 'modalDebtActionArea';
    btnArea.style.marginTop = '20px';
    btnArea.style.textAlign = 'center';

    if (customerUnpaidItems.length > 0) {
        let totalDebt = customerUnpaidItems.reduce((sum, item) => {
            let rev = parseFloat(item.total || item.Total || 0);
            let paid = parseFloat(item.paid_amount || 0);
            return sum + (rev - paid);
        }, 0);

        btnArea.innerHTML = `<p style="color:var(--danger); font-weight:600; margin-bottom:10px;">កំពុងជំពាក់ប្រាក់សរុប: ${money(totalDebt)}</p><button class="btn primary" style="background:#2AABEE; color:white; width:100%; justify-content:center;" onclick="copyCustomerDebtStatement('${esc(name)}')"><i class='bx bxl-telegram'></i> ចម្លងសារទារបំណុលម៉ូយនេះ</button>`;
    } else {
        btnArea.innerHTML = `<p style="color:var(--success); font-weight:600; margin-top:10px;">✅ អតិថិជននេះគ្មានបំណុលជំពាក់ទេ</p>`;
    }

    modalCard.appendChild(btnArea);
    openModal('customerDetailModal');
};

window.copyInvoiceToTelegram = function() {
    let dateVal = document.getElementById('date').value;
    let cName = document.getElementById('customerInput').value || 'Walk-in';
    let grandTotal = document.getElementById('grandTotal').innerText;
    let paid = document.getElementById('cashReceived').value || 0;
    let changeEl = document.getElementById('cashChange');
    let changeText = changeEl.previousElementSibling ? changeEl.previousElementSibling.innerText : '';
    
    let text = `📝 វិក្កយបត្រ (INVOICE)\n📅 ថ្ងៃទី: ${dateVal}\n👤 អតិថិជន: ${cName}\n------------------------\n`;
    
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
    
    text += `------------------------\n💰 សរុបទឹកប្រាក់: ${grandTotal}\n💵 ប្រាក់ទទួលបាន: ${money(paid)}\n`;
    if (changeText.includes('ជំពាក់')) { text += `⚠️ ${changeText}: ${changeEl.value}\n`; }
    text += `\n🙏 សូមអរគុណសម្រាប់ការគាំទ្រ!`;

    if(navigator.clipboard && window.isSecureContext) { navigator.clipboard.writeText(text).then(() => showToast("បានចម្លង! អាច Paste ក្នុង Telegram បាន", "success"));
    } else { alert("Copy Text:\n\n" + text); }
};

window.prepareAndPrint = function(isQuotation) {
    document.getElementById('printDate').innerText = document.getElementById('date').value || '-';
    document.getElementById('printCusName').innerText = document.getElementById('customerInput').value || 'Walk-in';
    document.getElementById('printCusPhone').innerText = document.getElementById('phone').value || '-';
    document.getElementById('printCusAddress').innerText = document.getElementById('address').value || '-';
    document.getElementById('printCashier').innerText = document.getElementById('cashier').value || 'Admin';
    
    let statusEl = document.getElementById('paymentStatus');
    document.getElementById('printStatus').innerText = statusEl.options[statusEl.selectedIndex].text;

    let titleEl = document.getElementById('printMainTitle');
    let originalText = titleEl.innerText;

    if (isQuotation) {
        titleEl.innerText = "សម្រង់តម្លៃ (QUOTATION)";
    } else {
        titleEl.innerText = "វិក្កយបត្រ (INVOICE)";
    }

    window.print();
    titleEl.innerText = originalText;
};

let currentHistoryFilter = 'all';
window.setHistoryFilter = function(type) {
    currentHistoryFilter = type;
    document.getElementById('tabAllHistory').classList.remove('active');
    document.getElementById('tabUnpaidHistory').classList.remove('active');
    if(type === 'all') document.getElementById('tabAllHistory').classList.add('active');
    else document.getElementById('tabUnpaidHistory').classList.add('active');
    performSearch(); 
};

window.markAsPaid = async function(id, totalAmount) {
    if(confirm("តើអតិថិជនពិតជាបានទូទាត់ប្រាក់សងរួចរាល់មែនទេ?")) {
        const { error } = await db.from(TABLE_SALES).update({ status: 'Paid', paid_amount: totalAmount }).eq('id', id);
        if (error) { showToast("កំហុសក្នុងការកែប្រែទិន្នន័យ!", "error"); } else { showToast("បញ្ជាក់ការទូទាត់ជោគជ័យ!", "success"); await refreshAllData(); }
    }
};

window.generateDailyReport = function() {
    if (!salesData || salesData.length === 0) { showToast("គ្មានទិន្នន័យលក់ទេ!", "error"); return; }
    let todayStr = new Date().toISOString().slice(0, 10);
    let todaySales = salesData.filter(item => item.date === todayStr);
    let reportDate = todayStr;
    if (todaySales.length === 0) { reportDate = "សរុបទិន្នន័យថ្មីៗ"; todaySales = salesData.slice(0, 20); }

    let totalOrders = new Set(todaySales.map(d => `${d.date}_${d.customer_name || d['customer-name']}`)).size;
    let totalRevenue = 0; let totalCollected = 0; let totalUnpaid = 0; let itemsSummary = {};

    todaySales.forEach(item => {
        let rev = parseFloat(item.total || item.Total || 0);
        let cleanStat = cleanStatus(item.status).toLowerCase();
        
        let paid = (cleanStat === 'paid') ? rev : parseFloat(item.paid_amount || 0);
        let unpaid = rev - paid;
        
        totalRevenue += rev; totalCollected += paid; totalUnpaid += unpaid;
        let prodName = item.item || 'ផ្សេងៗ'; let qty = item.qty || 1;
        itemsSummary[prodName] = (itemsSummary[prodName] || 0) + qty;
    });

    let text = `📊 របាយការណ៍ការលក់ប្រចាំថ្ងៃ\n📅 កាលបរិច្ឆេទ: ${reportDate}\n------------------------------------\n🧾 ចំនួនវិក្កយបត្រ: ${totalOrders} ដង\n💰 ចំណូលសរុប: ${money(totalRevenue)}\n💵 ប្រាក់បានប្រមូលសរុប: ${money(totalCollected)}\n`;
    if (totalUnpaid > 0) { text += `⚠️ ទឹកប្រាក់ជំពាក់សរុប: ${money(totalUnpaid)}\n`; }
    text += `------------------------------------\n🔥 ទំនិញលក់បានសរុប:\n`;
    for (let [pName, pQty] of Object.entries(itemsSummary)) { text += `▪️ ${pName}: ${pQty}\n`; }
    text += `\n🙏 គោរពជូនដំណឹងដល់ថៅកែ!`;

    if (navigator.clipboard && window.isSecureContext) { navigator.clipboard.writeText(text).then(() => showToast("បានចម្លងរបាយការណ៍សម្រាប់ផ្ញើឱ្យថៅកែ!", "success")); } else { prompt("Copy របាយការណ៍ខាងក្រោម៖", text); }
};

window.copyCustomerDebtStatement = function(customerName) {
    let customerUnpaidItems = salesData.filter(row => { return (row.customer_name || row['customer-name'] || '').toLowerCase() === customerName.toLowerCase() && cleanStatus(row.status).toLowerCase() === 'unpaid'; });
    if (customerUnpaidItems.length === 0) { showToast("គ្មានទិន្នន័យជំពាក់ទេ", "error"); return; }

    let text = `📢 ជូនដំណឹងដល់អតិថិជន: ${customerName}\nបញ្ជីវិក្កយបត្រដែលនៅខ្វះខាតការទូទាត់ប្រាក់៖\n------------------------------------\n`;
    let grandTotalDebt = 0;
    customerUnpaidItems.forEach(item => {
        let invNo = `INV-${String(item.id).padStart(4, '0')}`;
        let rev = parseFloat(item.total || item.Total || 0);
        let paid = parseFloat(item.paid_amount || 0);
        let debt = rev - paid; grandTotalDebt += debt;
        text += `▪️ វិក្កយបត្រ: ${invNo} (${item.date || '-'})\n   - ទំនិញ: ${item.item} (${item.qty} x ${item.price}៛)\n   - ទឹកប្រាក់ខ្វះ: ${money(debt)}\n`;
    });
    text += `------------------------------------\n💰 សរុបទឹកប្រាក់ត្រូវទូទាត់សង: ${money(grandTotalDebt)}\n🙏 សូមអរគុណ!`;

    if (navigator.clipboard && window.isSecureContext) { navigator.clipboard.writeText(text).then(() => showToast("បានចម្លងសារទារបំណុលរួចរាល់!", "success")); } else { prompt("Copy សារទារបំណុល៖", text); }
};

window.searchClientPortal = function() {
    let kw = document.getElementById('clientSearchInput').value.trim().toLowerCase();
    let cleanKw = kw.replace(/\s+/g, ''); 
    let startDate = document.getElementById('clientStartDate').value;
    let endDate = document.getElementById('clientEndDate').value;
    let container = document.getElementById('clientResultContainer');
    
    if(!kw) {
        container.innerHTML = '<div class="text-center muted pt-4 pb-4"><i class="bx bx-receipt" style="font-size: 40px; color: var(--line); margin-bottom: 10px; display: block;"></i>សូមបញ្ចូលលេខទូរស័ព្ទ ឬឈ្មោះរបស់អ្នក...</div>';
        return;
    }

    container.innerHTML = '<div class="text-center muted pt-4 pb-4">កំពុងស្វែងរក...</div>';

    let allMySales = salesData.filter(row => {
        let cName = (row.customer_name || row['customer-name'] || '').toLowerCase();
        let phone = (row.phone || '').toLowerCase();
        let cleanPhone = phone.replace(/\s+/g, ''); 
        
        return (cName.includes(kw) || (cleanPhone !== '' && cleanPhone.includes(cleanKw)));
    });

    if(allMySales.length === 0) {
        container.innerHTML = '<div class="text-center muted pt-4 pb-4" style="color:var(--danger);"><i class="bx bx-error-circle" style="font-size: 40px; margin-bottom: 10px; display: block;"></i>រកមិនឃើញទិន្នន័យទេ! សូមពិនិត្យលេខទូរស័ព្ទ ឬឈ្មោះម្តងទៀត។</div>';
        return;
    }

    let totalSpent = 0; 
    let totalDebt = 0;
    let actualName = allMySales[0].customer_name || 'អតិថិជន';

    allMySales.forEach(item => {
        let rev = parseFloat(item.total || item.Total || 0);
        let cleanStatusText = cleanStatus(item.status).toLowerCase();
        
        let paid = (cleanStatusText === 'paid') ? rev : parseFloat(item.paid_amount || 0);
        let debt = rev - paid;

        totalSpent += rev; 
        totalDebt += debt; 
    });

    let defaultStart = startDate ? startDate : '2026-01-01';
    let start = new Date(defaultStart); start.setHours(0,0,0,0);
    let end = endDate ? new Date(endDate) : new Date('2100-01-01'); end.setHours(23,59,59,999);

    let displaySales = allMySales.filter(item => { 
        if (!item.date) return false; 
        let itemDate = new Date(item.date); 
        return itemDate >= start && itemDate <= end; 
    });

    let html = '';
    if (displaySales.length > 0) {
        html = `<div class="table-scroll"><table class="data-table mt-4"><thead><tr><th>ថ្ងៃទី</th><th>វិក្កយបត្រ</th><th>មុខទំនិញ</th><th class="text-right">សរុប (៛)</th><th class="text-center">ស្ថានភាព</th></tr></thead><tbody>`;
        
        displaySales.forEach(item => {
            let rev = parseFloat(item.total || item.Total || 0);
            let cleanStatusText = cleanStatus(item.status).toLowerCase();
            
            let paid = (cleanStatusText === 'paid') ? rev : parseFloat(item.paid_amount || 0);
            let debt = rev - paid;

            let invNo = `INV-${String(item.id).padStart(4, '0')}`;
            let badge = debt > 0 ? `<span class="status-badge" style="background:rgba(239,68,68,0.1); color:#ef4444;">ជំពាក់ ${money(debt)}</span>` : `<span class="status-badge success">ទូទាត់រួច</span>`;

            html += `<tr><td class="muted">${item.date || '-'}</td><td><b>${invNo}</b></td><td>${esc(item.item)} <br><small class="muted">${item.qty} x ${item.price}៛</small></td><td class="text-right"><b style="color:var(--text);">${money(rev)}</b></td><td class="text-center">${badge}</td></tr>`;
        });
        html += `</tbody></table></div>`;
    } else {
        html = `<div class="text-center muted pt-4 pb-4" style="border: 1px dashed var(--line); border-radius: 8px; margin-top: 15px;">គ្មានវិក្កយបត្រថ្មីចាប់ពីថ្ងៃទី ${defaultStart} ទេ!<br><small>សូមរើស "កាលបរិច្ឆេទ" ខាងលើ ដើម្បីមើលទិន្នន័យចាស់ៗ</small></div>`;
    }

    let summaryHtml = `
    <div style="text-align: center; margin-bottom: 24px; margin-top: 10px;"><h2 style="margin:0 0 10px; color:var(--primary);">សួស្តី, ${esc(actualName)}</h2></div>
    <div class="stats-grid" style="grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px;">
        <div class="stat-card" style="padding: 15px;"><div><span>ទិញទំនិញសរុប (តាំងពីដើម)</span><strong style="font-size:20px; color:var(--success);">${money(totalSpent)}</strong></div></div>
        <div class="stat-card" style="padding: 15px; border-color: var(--danger-bg); background: rgba(239,68,68,0.02);"><div><span>បំណុលកំពុងជំពាក់</span><strong style="font-size:20px; color:var(--danger);">${money(totalDebt)}</strong></div></div>
    </div><h3 style="margin-bottom: 10px; font-size: 15px;">ប្រវត្តិទិញទំនិញរបស់អ្នក៖</h3>`;

    container.innerHTML = summaryHtml + html;
};

async function loadExpenses() {
    const { data, error } = await db.from(TABLE_EXPENSES).select('*').order('date', { ascending: false });
    if (!error) {
        expensesData = data;
        renderExpenses();
    } else {
        console.log("សូមបង្កើត Table 'expenses' នៅក្នុង Supabase ជាមុនសិន។", error);
    }
}

function renderExpenses() {
    let tbody = document.getElementById('expenseTableBody');
    if (!tbody) return;
    
    let html = '';
    let totalExp = 0;
    
    let today = new Date();
    let currentMonth = today.getMonth();
    let currentYear = today.getFullYear();
    
    expensesData.forEach(exp => {
        if(exp.date) {
            let expDate = new Date(exp.date);
            if(expDate.getMonth() === currentMonth && expDate.getFullYear() === currentYear) {
                totalExp += parseFloat(exp.amount || 0);
            }
        }
        
        let catBadge = `<span class="status-badge" style="background:#f1f5f9; color:#475569;">${esc(exp.category)}</span>`;
        if(exp.category === 'សាំង/ធ្វើដំណើរ') catBadge = `<span class="status-badge" style="background:#fee2e2; color:#ef4444;"><i class='bx bx-gas-pump'></i> ${esc(exp.category)}</span>`;
        else if(exp.category === 'កាហ្វេ/អាហារ') catBadge = `<span class="status-badge" style="background:#fef3c7; color:#d97706;"><i class='bx bx-coffee'></i> ${esc(exp.category)}</span>`;
        
        html += `<tr>
            <td>${exp.date || '-'}</td>
            <td>${catBadge}</td>
            <td>${esc(exp.note || '')}</td>
            <td class="text-right"><b style="color:var(--danger);">${money(exp.amount)}</b></td>
            <td class="text-center"><button class="btn outline small" onclick="deleteExpense(${exp.id})"><i class='bx bx-trash'></i></button></td>
        </tr>`;
    });
    
    tbody.innerHTML = html || '<tr><td colspan="5" class="text-center muted pt-4 pb-4">មិនមានទិន្នន័យចំណាយទេ</td></tr>';
    if(document.getElementById('totalExpenseAmount')) document.getElementById('totalExpenseAmount').innerText = money(totalExp);
}

window.saveNewExpense = async function() {
    let dateStr = document.getElementById('expDate').value || new Date().toISOString().slice(0,10);
    let cat = document.getElementById('expCategory').value;
    let amt = parseFloat(document.getElementById('expAmount').value) || 0;
    let note = document.getElementById('expNote').value.trim();
    
    if(amt <= 0) { showToast("សូមបញ្ចូលទឹកប្រាក់ឱ្យបានត្រឹមត្រូវ!", "error"); return; }
    
    const { error } = await db.from(TABLE_EXPENSES).insert([{ date: dateStr, category: cat, amount: amt, note: note }]);
    if(!error) {
        showToast("រក្សាទុកចំណាយជោគជ័យ!", "success");
        closeModal('expenseModal');
        document.getElementById('expAmount').value = '';
        document.getElementById('expNote').value = '';
        await loadExpenses();
    } else {
        showToast("បរាជ័យ សូមពិនិត្យ Table ក្នុង Supabase", "error");
        console.error(error);
    }
};

window.deleteExpense = async function(id) {
    if(confirm("តើអ្នកពិតជាចង់លុបទិន្នន័យចំណាយនេះមែនទេ?")) {
        const { error } = await db.from(TABLE_EXPENSES).delete().eq('id', id);
        if(!error) { showToast("លុបជោគជ័យ!", "success"); await loadExpenses(); }
    }
};

window.handleGlobalSearch = function(event) {
    if (event.key === 'Enter') {
        event.preventDefault(); 
        let keyword = document.getElementById('globalSearchInput').value;
        let historySearchInput = document.getElementById('searchKeyword');
        
        if (historySearchInput) {
            historySearchInput.value = keyword;
        }
        
        openTab('historyTab');
        document.getElementById('globalSearchInput').value = '';
    }
};

window.copyExpenseReport = function() {
    let today = new Date();
    let currentMonth = today.getMonth(); 
    let currentYear = today.getFullYear();
    
    let currentMonthExps = expensesData.filter(exp => {
        if(!exp.date) return false;
        let d = new Date(exp.date);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    if(currentMonthExps.length === 0) { 
        showToast("គ្មានចំណាយក្នុងខែនេះទេ!", "error"); 
        return; 
    }

    let catSum = {};
    let total = 0;
    let datesWorked = new Set();

    currentMonthExps.sort((a,b) => new Date(a.date) - new Date(b.date)); 

    currentMonthExps.forEach(exp => {
        let amt = parseFloat(exp.amount || 0);
        catSum[exp.category] = (catSum[exp.category] || 0) + amt;
        total += amt;
        datesWorked.add(exp.date);
    });

    let datesArr = [...datesWorked];
    let firstDate = datesArr[0];
    let lastDate = datesArr[datesArr.length - 1];

    let text = `📋 របាយការណ៍ចំណាយបេសកកម្មខែ ${currentMonth + 1}/${currentYear}\n`;
    text += `------------------------------------\n`;
    text += `📅 ចំនួនថ្ងៃចុះមូលដ្ឋាន: ${datesArr.length} ថ្ងៃ\n`;
    text += `⏱ (ចន្លោះពីថ្ងៃ ${firstDate} ដល់ ${lastDate})\n\n`;
    
    text += `សរុបចំណាយតាមប្រភេទ:\n`;
    for(let [cat, val] of Object.entries(catSum)) {
        text += `🔹 ${cat}: ${money(val)}\n`;
    }
    text += `------------------------------------\n`;
    text += `💰 សរុបទឹកប្រាក់ត្រូវ Clear: ${money(total)}\n\n`;
    text += `🙏 សូមមេត្តាពិនិត្យ និងទូទាត់!`;

    if(navigator.clipboard && window.isSecureContext) { 
        navigator.clipboard.writeText(text).then(() => showToast("បានចម្លងរបាយការណ៍!", "success")); 
    } else { 
        prompt("Copy របាយការណ៍ខាងក្រោម៖", text); 
    }
};

window.exportExpensesCSV = function() {
    let today = new Date();
    let currentMonth = today.getMonth(); 
    let currentYear = today.getFullYear();
    
    let currentMonthExps = expensesData.filter(exp => {
        if(!exp.date) return false;
        let d = new Date(exp.date);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    if(currentMonthExps.length === 0) { showToast("គ្មានទិន្នន័យទេ","error"); return; } 
    
    let csvContent="data:text/csv;charset=utf-8,\uFEFF"; 
    csvContent+="កាលបរិច្ឆេទ,ប្រភេទចំណាយ,កំណត់សម្គាល់,ទឹកប្រាក់\r\n"; 

    currentMonthExps.forEach(row=>{ 
        let arr=[row.date||"", row.category||"", row.note||"", row.amount||0]; 
        let rowStr=arr.map(e=>`"${String(e).replace(/"/g,'""')}"`).join(","); 
        csvContent+=rowStr+"\r\n"; 
    }); 
    
    const encodedUri=encodeURI(csvContent); 
    const link=document.createElement("a"); 
    link.setAttribute("href",encodedUri); 
    link.setAttribute("download",`Expense_Report_Month_${currentMonth+1}_${currentYear}.csv`); 
    document.body.appendChild(link); 
    link.click(); 
    document.body.removeChild(link); 
};

window.openTargetModal = function() {
    let currentYear = new Date().getFullYear();
    document.getElementById('modalTargetYear').innerText = currentYear;
    
    let existingTargetRiel = parseFloat(localStorage.getItem('salesTarget_' + currentYear)) || 0;
    let isUSD = localStorage.getItem('salesTargetCurrency_' + currentYear) === 'USD';
    
    if (isUSD && existingTargetRiel > 0) {
        document.getElementById('targetInputAmount').value = existingTargetRiel / 4100;
        document.getElementById('targetInputCurrency').value = 'USD';
    } else {
        document.getElementById('targetInputAmount').value = existingTargetRiel > 0 ? existingTargetRiel : '';
        document.getElementById('targetInputCurrency').value = 'KHR';
    }
    
    openModal('targetModal');
};

window.saveYearlyTarget = function() {
    let currentYear = new Date().getFullYear();
    let amount = parseFloat(document.getElementById('targetInputAmount').value) || 0;
    let currency = document.getElementById('targetInputCurrency').value;
    
    if (amount <= 0) {
        showToast("សូមបញ្ចូលទឹកប្រាក់គោលដៅ!", "error");
        return;
    }

    let finalTargetRiel = amount;
    if (currency === 'USD') {
        finalTargetRiel = amount * 4100;
    }
    
    localStorage.setItem('salesTarget_' + currentYear, finalTargetRiel);
    localStorage.setItem('salesTargetCurrency_' + currentYear, currency);
    
    closeModal('targetModal');
    showToast("បានកំណត់គោលដៅប្រចាំឆ្នាំជោគជ័យ!", "success");
    loadDashboard(); 
};

// --- មុខងារសម្រាប់ទាញមើលមុខទំនិញលម្អិតតាមប្រភេទ ---
window.viewCategoryDetail = function(categoryName) {
    document.getElementById('modalCatName').innerText = categoryName;

    const startDate = document.getElementById('chartStartDate').value; 
    const endDate = document.getElementById('chartEndDate').value;
    let filteredData = salesData;
    
    if (startDate || endDate) {
      let start = startDate ? new Date(startDate) : new Date('1970-01-01'); start.setHours(0,0,0,0);
      let end = endDate ? new Date(endDate) : new Date('2100-01-01'); end.setHours(23,59,59,999);
      filteredData = salesData.filter(item => { if (!item.date) return false; let itemDate = new Date(item.date); return itemDate >= start && itemDate <= end; });
    }

    let prodCountInCategory = {};
    let grandTotalByMeasure = {}; 
    
    filteredData.forEach(row => {
        let cat = row.agro_chemicals || 'ផ្សេងៗ';
        if (cat === categoryName && row.item) {
            let rowQty = parseFloat(row.qty || row.Qty || 1);
            let stdValue = parseFloat(row.standard_unit_value || 0);
            let stdMeasure = (row.standard_unit_measure || '').trim();
            
            let unitDisplay = row.unit ? ` (${row.unit})` : '';
            let itemName = row.item + unitDisplay; 
            
            let totalStdValue = rowQty * stdValue;

            if (!prodCountInCategory[itemName]) {
                prodCountInCategory[itemName] = { qty: 0, stdTotal: 0, stdMeasure: stdMeasure };
            }
            
            prodCountInCategory[itemName].qty += rowQty;
            
            if(stdValue > 0 && stdMeasure !== '') {
                prodCountInCategory[itemName].stdTotal += totalStdValue;
                prodCountInCategory[itemName].stdMeasure = stdMeasure;
                grandTotalByMeasure[stdMeasure] = (grandTotalByMeasure[stdMeasure] || 0) + totalStdValue;
            }
        }
    });

    let sortedProds = Object.keys(prodCountInCategory)
        .map(k => ({ name: k, ...prodCountInCategory[k] }))
        .sort((a,b) => b.qty - a.qty);

    let tbody = document.getElementById('categoryDetailTableBody');
    let html = '';
    
    sortedProds.forEach((p, index) => {
        let stdDisplay = '';
        if (p.stdTotal > 0 && p.stdMeasure !== '') {
            stdDisplay = `<br><small style="color: var(--primary); font-weight: 500;">(ស្មើនឹង ${p.stdTotal.toLocaleString('en-US', {maximumFractionDigits: 2})} ${p.stdMeasure})</small>`;
        }

        html += `<tr>
            <td>
                <div class="user-cell">
                    <b style="font-size: 13px;">${esc(p.name)}</b>
                </div>
            </td>
            <td class="text-right">
                <b style="color:var(--success); font-size:15px;">${p.qty}</b>
                ${stdDisplay}
            </td>
        </tr>`;
    });

    // 🌟 បង្ហាញសរុបរួម (Kg/L) នៅប្រអប់ខាងលើស្តាំនៃ Modal 🌟
    let totalStdStr = Object.keys(grandTotalByMeasure)
        .map(m => `${grandTotalByMeasure[m].toLocaleString('en-US', {maximumFractionDigits: 2})} ${m}`)
        .join(' & ');
        
    let totalBadge = document.getElementById('modalCatTotalStd');
    if(totalBadge) {
        if (totalStdStr !== '') {
            totalBadge.innerHTML = `<span style="background: rgba(16,185,129,0.1); color: var(--success); padding: 5px 12px; border-radius: 20px; border: 1px solid rgba(16,185,129,0.3); font-size: 13px;"><i class='bx bx-pie-chart-alt'></i> សរុប: ${totalStdStr}</span>`;
        } else {
            totalBadge.innerHTML = '';
        }
    }

    tbody.innerHTML = html || '<tr><td colspan="2" class="text-center muted pt-4">គ្មានទិន្នន័យមុខទំនិញ</td></tr>';
    
    openModal('categoryDetailModal');
};

// --- 🌟 មុខងារសម្រាប់ទាញមើលលម្អិតតាមមុខទំនិញ (Product Details បំបែកតាមខ្នាត) 🌟 ---
window.viewProductDetail = function(productName) {
    document.getElementById('modalProdName').innerText = productName;

    const startDate = document.getElementById('chartStartDate').value; 
    const endDate = document.getElementById('chartEndDate').value;
    let filteredData = salesData;
    
    // ចម្រាញ់ទិន្នន័យតាមថ្ងៃខែ
    if (startDate || endDate) {
      let start = startDate ? new Date(startDate) : new Date('1970-01-01'); start.setHours(0,0,0,0);
      let end = endDate ? new Date(endDate) : new Date('2100-01-01'); end.setHours(23,59,59,999);
      filteredData = salesData.filter(item => { if (!item.date) return false; let itemDate = new Date(item.date); return itemDate >= start && itemDate <= end; });
    }

    let unitCountForProd = {};
    let grandTotalByMeasure = {}; 
    
    // បូកសរុបបំបែកតាមខ្នាត
    filteredData.forEach(row => {
        if (row.item === productName) {
            let rowQty = parseFloat(row.qty || row.Qty || 1);
            let stdValue = parseFloat(row.standard_unit_value || 0);
            let stdMeasure = (row.standard_unit_measure || '').trim();
            
            let unitName = row.unit ? row.unit : 'មិនបញ្ជាក់ខ្នាត'; 
            let totalStdValue = rowQty * stdValue;

            if (!unitCountForProd[unitName]) {
                unitCountForProd[unitName] = { stdTotal: 0, stdMeasure: stdMeasure, sortQty: 0 };
            }
            
            unitCountForProd[unitName].sortQty += rowQty; 

            if(stdValue > 0 && stdMeasure !== '') {
                unitCountForProd[unitName].stdTotal += totalStdValue;
                unitCountForProd[unitName].stdMeasure = stdMeasure;
                grandTotalByMeasure[stdMeasure] = (grandTotalByMeasure[stdMeasure] || 0) + totalStdValue;
            } else {
                unitCountForProd[unitName].stdTotal += rowQty;
                unitCountForProd[unitName].stdMeasure = 'ឯកតា';
                grandTotalByMeasure['ឯកតា'] = (grandTotalByMeasure['ឯកតា'] || 0) + rowQty;
            }
        }
    });

    let sortedUnits = Object.keys(unitCountForProd)
        .map(k => ({ name: k, ...unitCountForProd[k] }))
        .sort((a,b) => b.sortQty - a.sortQty);

    let tbody = document.getElementById('productDetailTableBody');
    let html = '';
    
    sortedUnits.forEach((u, index) => {
        let displayVal = '';
        if(u.stdMeasure !== 'ឯកតា' && u.stdTotal > 0) {
            displayVal = `<br><small style="color: var(--primary); font-weight: 500;">(ស្មើនឹង ${u.stdTotal.toLocaleString('en-US', {maximumFractionDigits: 2})} ${u.stdMeasure})</small>`;
        }

        html += `<tr>
            <td><div class="user-cell"><b style="font-size: 13px;">${esc(u.name)}</b></div></td>
            <td class="text-right"><b style="color:var(--success); font-size:15px;">${u.sortQty}</b>${displayVal}</td>
        </tr>`;
    });

    // បង្ហាញសរុបរួម (Kg/L) នៅប្រអប់ខាងលើស្តាំ
    let totalStdStr = Object.keys(grandTotalByMeasure).map(m => `${grandTotalByMeasure[m].toLocaleString('en-US', {maximumFractionDigits: 2})} ${m}`).join(' & ');
        
    let totalBadge = document.getElementById('modalProdTotalStd');
    if(totalBadge) {
        if (totalStdStr !== '') {
            totalBadge.innerHTML = `<span style="background: rgba(16,185,129,0.1); color: var(--success); padding: 5px 12px; border-radius: 20px; border: 1px solid rgba(16,185,129,0.3); font-size: 13px;"><i class='bx bx-pie-chart-alt'></i> សរុប: ${totalStdStr}</span>`;
        } else {
            totalBadge.innerHTML = '';
        }
    }

    tbody.innerHTML = html || '<tr><td colspan="2" class="text-center muted pt-4">គ្មានទិន្នន័យខ្នាត</td></tr>';
    
    openModal('productDetailModal');
};
