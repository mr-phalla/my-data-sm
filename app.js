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
let ADMIN_PIN = localStorage.getItem('admin_pin') || "8888";

// 🌟 ការកំណត់ Telegram Bot 🌟
const TELEGRAM_BOT_TOKEN = '8991576226:AAHuuY-kmUkn22BroT6COg6lQBVRrg7RoUQ'; 
const TELEGRAM_CHAT_ID = '802636074';// សូមប្រាកដថាលេខ Chat ID នេះគឺជារបស់បងពិតប្រាកដដែលយកពី @userinfobot

// ==========================================
// 🌟 Utility Functions 🌟
// ==========================================
function getInvoiceNo(item) {
    if (item.invoice_no) return item.invoice_no;
    let validId = item.id ? String(item.id) : "0";
    return item.id ? `INV-${validId.padStart(5, '0')}` : `INV-00000`;
}

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

// 🌟 មុខងារសម្រាប់បញ្ជូនសារទៅកាន់ Telegram (Advanced Version) 🌟
async function sendToTelegram(message, type = 'sale', data = null) {
    if(!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return;
    
    let url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    let finalMessage = message;
    
    // បង្កើតទម្រង់សារឱ្យកាន់តែសម្បូរបែប ទៅតាមប្រភេទសកម្មភាព
    if (type === 'sale' && data) {
        let itemsText = '';
        data.items.forEach(item => {
            itemsText += `➖ ${item.qty} x ${item.prodName} (${money(item.price)})\n`;
        });
        
        finalMessage = `🛍 <b>ការលក់ថ្មីចូលប្រព័ន្ធ!</b>\n\n`;
        finalMessage += `🧾 លេខវិក្កយបត្រ: #${data.invoiceNo}\n`;
        finalMessage += `👤 អតិថិជន: <b>${data.customerName || 'Walk-in'}</b>\n`;
        if (data.phone) finalMessage += `📱 ទូរស័ព្ទ: ${data.phone}\n`;
        finalMessage += `---------------------------------\n`;
        finalMessage += `🛒 <b>ទំនិញលក់ចេញ:</b>\n${itemsText}`;
        finalMessage += `---------------------------------\n`;
        finalMessage += `💰 សរុបទឹកប្រាក់: <b>${money(data.total)}</b>\n`;
        if (data.discount > 0) finalMessage += `🔻 បញ្ចុះតម្លៃ: ${money(data.discount)}\n`;
        finalMessage += `💵 បានទទួល: ${money(data.paid)}\n`;
        
        if (data.status === 'Unpaid') {
            let debt = data.total - data.discount - data.paid;
            finalMessage += `⚠️ <b>ជំពាក់សរុប: ${money(debt)}</b>\n`;
            if (data.dueDate) finalMessage += `🗓 ថ្ងៃសន្យាសង: ${data.dueDate}\n`;
        } else {
            finalMessage += `✅ <b>ស្ថានភាព: ទូទាត់រួច</b>\n`;
        }
        finalMessage += `\n👤 អ្នកបញ្ចូល: ${data.cashier}\n`;
        finalMessage += `⏰ ម៉ោង: ${new Date().toLocaleTimeString('en-US', {hour12: true})}\n`;
        finalMessage += `🔗 <a href="${window.location.href.split('?')[0]}">បើកប្រព័ន្ធ CRM</a>`;
    } 
    else if (type === 'expense' && data) {
        finalMessage = `💸 <b>មានការចំណាយថ្មីត្រូវបានកត់ត្រា!</b>\n\n`;
        finalMessage += `🏷 ប្រភេទ: <b>${data.category}</b>\n`;
        finalMessage += `👤 អ្នកចំណាយ: <b>${data.spender || 'មិនបញ្ជាក់'}</b>\n`;
        finalMessage += `💰 ទឹកប្រាក់: <b style="color:red;">${money(data.amount)}</b>\n`;
        if (data.note) finalMessage += `📝 កំណត់សម្គាល់: ${data.note}\n`;
        finalMessage += `\n⏰ ម៉ោង: ${new Date().toLocaleTimeString('en-US', {hour12: true})}\n`;
    }

    try {
        await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                chat_id: TELEGRAM_CHAT_ID, 
                text: finalMessage, 
                parse_mode: 'HTML',
                disable_web_page_preview: true
            })
        });
    } catch (err) {
        console.error("មិនអាចផ្ញើសារទៅ Telegram បានទេ:", err);
    }
}

function formatDateForInput(d) {
    return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}
window.handleCropTypeChange = function(selectEl, labelId, inputId) {
    let val = selectEl.value;
    let label = document.getElementById(labelId);
    let input = document.getElementById(inputId);
    if(!label || !input) return;
    
    let newText = "ទំហំ/ចំនួនដាំដុះ ";
    let newPlaceholder = "ឧ. 10 ឬ 500";

    if(val === 'ទុរេន' || val === 'តាង៉ែន' || val === 'ស្វាយកែវរមៀត') {
        newText = "ចំនួន (ដើម) ";
        newPlaceholder = "ឧ. 500";
    } else if (val === 'ស្វាយចន្ទី' || val === 'ស្រូវ' || val === 'ពុទ្រា' || val === 'ផ្សេងៗ') {
        newText = "ទំហំដី (ហិកតា) ";
        newPlaceholder = "ឧ. 10";
    }
    
    for (let i = 0; i < label.childNodes.length; i++) {
        if (label.childNodes[i].nodeType === 3) { 
            label.childNodes[i].nodeValue = newText;
            break;
        }
    }
    input.placeholder = newPlaceholder;
};

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

const originalOpenTab = function(tabId) {
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
};

window.openTab = function(tabId) {
    originalOpenTab(tabId);
    if(tabId === 'branchTab') renderBranchOps();
};

function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

function togglePasswordVisibility() {
    let passInput = document.getElementById('loginPass');
    if (passInput.type === "password") { passInput.type = "text"; } else { passInput.type = "password"; }
}

// ==========================================
// 🌟 Authentication & Init 🌟
// ==========================================
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
    if(typeof updateCustomerDatalist === 'function') updateCustomerDatalist();
}

// ==========================================
// 🌟 មុខងារផលិតផល (Products) 🌟
// ==========================================
async function loadProducts(callback) {
  const { data, error } = await db.from(TABLE_PRODUCTS).select('*').order('id', { ascending: true });
  
  if (!error) {
    productsData = data.map(p => {
        let uVal = p.unit_value ? String(p.unit_value).replace('.0', '') : '';
        let uMea = p.unit_measure || '';
        let pType = p.package_type || '';
        let display_unit = p['Unit'] || p.unit || "";
        if (!display_unit && uVal && uMea && pType) display_unit = `${uVal}${uMea}/${pType}`;
        else if (!display_unit && uVal && uMea) display_unit = `${uVal}${uMea}`;

        // 🌟 ចាប់យកទិន្នន័យពី Column ថ្មី prod_status
        let currentStatus = p.prod_status || 'active';

        return { 
            id: p.id, 
            name: p['Product Name'] || p.name, 
            price: parseFloat(String(p['Price'] || p.price).replace(/,/g, '')) || 0,
            base_price: parseFloat(p.base_price) || 0, 
            wholesale_price: parseFloat(p.wholesale_price) || parseFloat(p.Wholesale_price) || 0, 
            status: currentStatus, 
            unit: display_unit,
            package_type: p['package_type'] || "",
            unit_value: p['unit_value'] || 0,
            unit_measure: p['unit_measure'] || "",
            standard_unit_value: p['standard_unit_value'] || 0,
            standard_unit_measure: p['standard_unit_measure'] || "",
            category: p.agro_chemicals || "ផ្សេងៗ",
            usage_guide: p.usage_guide || ""
        };
    });
    
    let activeProducts = productsData.filter(p => p.status !== 'inactive');
    let uniqueNames = [...new Set(activeProducts.map(p => p.name).filter(Boolean))];
    let datalist = document.getElementById('productListOptions');
    if(datalist) { let opts = ''; uniqueNames.forEach(name => { opts += `<option value="${esc(name)}">`; }); datalist.innerHTML = opts; }

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

window.renderProducts = function() {
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
        let baseDisplay = p.base_price > 0 ? `<b style="color:var(--danger);">${money(p.base_price)}</b>` : `<span class="muted">-</span>`;
        let wsDisplay = p.wholesale_price > 0 ? `<b style="color:#0ea5e9;">${money(p.wholesale_price)}</b>` : `<span class="muted">-</span>`;
        
        let isInactive = p.status === 'inactive';
        let statusBtnHtml = isInactive ? 
            `<button class="btn outline small" style="background:rgba(239,68,68,0.1); color:var(--danger); border-color:var(--danger);" onclick="toggleProductStatus('${p.id}', 'active')" title="ចុចเพื่อបើកលក់វិញ"><i class='bx bx-hide'></i> បិទលក់</button>` :
            `<button class="btn outline small" style="background:rgba(16,185,129,0.1); color:var(--success); border-color:var(--success);" onclick="toggleProductStatus('${p.id}', 'inactive')" title="ចុចเพื่อបិទលក់"><i class='bx bx-show'></i> បើកលក់</button>`;
        
        let rowStyle = isInactive ? 'opacity: 0.5; background: rgba(0,0,0,0.02);' : '';

        html += `<tr style="${rowStyle}">
            <td><b>${esc(p.name)}</b>${p.unit ? `<br><small class="muted">ខ្នាត: ${esc(p.unit)}</small>` : ''}<br>${catBadge}</td>
            <td class="text-right">${baseDisplay}</td>
            <td class="text-right">${wsDisplay}</td>
            <td class="text-right"><b style="color:var(--text);">${money(p.price)}</b></td>
            <td class="text-center">${statusBtnHtml}</td>
            <td class="text-center" style="white-space: nowrap;">
                <button class="btn outline small" style="border-color:#10b981; color:#10b981; margin-right: 5px;" onclick="copyProductInfo('${p.id}')"><i class='bx bx-share-alt'></i> Share</button>
                <button class="btn outline small" style="border-color:#f59e0b; color:#f59e0b;" onclick="openEditProduct('${p.id}')"><i class='bx bx-edit'></i> កែប្រែ</button>
            </td>
        </tr>`;
    });
    
    tbody.innerHTML = html || '<tr><td colspan="6" class="text-center muted pt-4 pb-4">គ្មានទិន្នន័យទំនិញទេ</td></tr>';
}

window.openEditProduct = function(id) {
    let p = productsData.find(prod => String(prod.id) === String(id));
    if(!p) return;
    document.getElementById('editProdId').value = p.id;
    document.getElementById('editProdName').value = p.name;
    document.getElementById('editProdBasePrice').value = p.base_price || '';
    document.getElementById('editProdWholesalePrice').value = p.wholesale_price || ''; 
    document.getElementById('editProdPrice').value = p.price || '';
    document.getElementById('editProdCategory').value = p.category || 'other';
    let statusEl = document.getElementById('editProdStatus');
    if(statusEl) statusEl.value = p.status || 'active'; 
    document.getElementById('editProdUnitValue').value = p.unit_value || '';
    document.getElementById('editProdUnitMeasure').value = p.unit_measure || 'ml';
    document.getElementById('editProdPackage').value = p.package_type || 'Bottle';
    document.getElementById('editProdStdValue').value = p.standard_unit_value || '';
    document.getElementById('editProdStdMeasure').value = p.standard_unit_measure || 'L';
    document.getElementById('editProdUsage').value = p.usage_guide || '';
    openModal('editProductModal');
};

window.saveEditedProduct = async function() {
    let id = document.getElementById('editProdId').value;
    let name = document.getElementById('editProdName').value.trim();
    let basePrice = parseFloat(document.getElementById('editProdBasePrice').value) || 0;
    let wsPrice = parseFloat(document.getElementById('editProdWholesalePrice').value) || 0; 
    let price = parseFloat(document.getElementById('editProdPrice').value) || 0;
    let category = document.getElementById('editProdCategory').value;
    let pStatus = document.getElementById('editProdStatus') ? document.getElementById('editProdStatus').value : 'active'; 
    let unitValue = parseFloat(document.getElementById('editProdUnitValue').value) || null;
    let unitMeasure = document.getElementById('editProdUnitMeasure').value;
    let packageType = document.getElementById('editProdPackage').value;
    let stdValue = parseFloat(document.getElementById('editProdStdValue').value) || null;
    let stdMeasure = document.getElementById('editProdStdMeasure').value;
    let usageGuide = document.getElementById('editProdUsage').value.trim();

    if(!name) { showToast("សូមបញ្ចូលឈ្មោះទំនិញ!", "error"); return; }
    let btnSave = document.querySelector('#editProductModal .btn.primary');
    let originalText = btnSave.innerHTML; btnSave.innerHTML = "កំពុងរក្សាទុក..."; btnSave.disabled = true;

    let updateData = { 
        "Product Name": name, 
        "Price": price, 
        "base_price": basePrice, 
        "wholesale_price": wsPrice, 
        "prod_status": pStatus, 
        "agro_chemicals": category, 
        "unit_value": unitValue, 
        "unit_measure": unitMeasure, 
        "package_type": packageType, 
        "standard_unit_value": stdValue, 
        "standard_unit_measure": stdMeasure, 
        "usage_guide": usageGuide 
    };
    
    const { error } = await db.from(TABLE_PRODUCTS).update(updateData).eq('id', id);
    
    if(!error){ 
        showToast("កែប្រែទំនិញជោគជ័យ!", "success"); 
        closeModal('editProductModal'); 
        await loadProducts(); 
    } else { 
        showToast("បរាជ័យក្នុងការកែប្រែ សូមពិនិត្យ Database!", "error"); 
        console.error("Supabase Error:", error); 
    }
    btnSave.innerHTML = originalText; btnSave.disabled = false;
};

window.deleteProduct = async function() {
    let id = document.getElementById('editProdId').value;
    if(confirm("តើអ្នកពិតជាចង់លុបទំនិញនេះមែនទេ? បញ្ជាក់៖ វានឹងបាត់ពីបញ្ជីមុខទំនិញជារៀងរហូត!")) {
        const { error } = await db.from(TABLE_PRODUCTS).delete().eq('id', id);
        if(!error){
            showToast("បានលុបទំនិញជោគជ័យ!", "success");
            closeModal('editProductModal');
            await loadProducts(); 
        } else {
            showToast("លុបមិនបានជោគជ័យទេ!", "error");
            console.error(error);
        }
    }
};

window.saveNewProduct = async function() { 
    let name = document.getElementById('newProdName').value.trim(); 
    let price = parseFloat(document.getElementById('newProdPrice').value) || 0; 
    let basePrice = parseFloat(document.getElementById('newProdBasePrice').value) || 0; 
    let wsPrice = parseFloat(document.getElementById('newProdWholesalePrice').value) || 0; 
    let category = document.getElementById('newProdCategory').value;
    let unitValue = parseFloat(document.getElementById('newProdUnitValue').value) || null;
    let unitMeasure = document.getElementById('newProdUnitMeasure').value;
    let packageType = document.getElementById('newProdPackage').value;
    let stdValue = parseFloat(document.getElementById('newProdStdValue').value) || null;
    let stdMeasure = document.getElementById('newProdStdMeasure').value;
    let usageGuide = document.getElementById('newProdUsage').value.trim();

    if(!name) { showToast("សូមបញ្ចូលឈ្មោះទំនិញ!", "error"); return; }

    let newProductData = { 
        "Product Name": name, 
        "Price": price, 
        "base_price": basePrice, 
        "wholesale_price": wsPrice, 
        "prod_status": "active", 
        "agro_chemicals": category, 
        "unit_value": unitValue, 
        "unit_measure": unitMeasure, 
        "package_type": packageType, 
        "standard_unit_value": stdValue, 
        "standard_unit_measure": stdMeasure, 
        "usage_guide": usageGuide 
    };
    
    let btnSave = document.querySelector('#productModal .btn.primary');
    let originalText = btnSave.innerHTML; btnSave.innerHTML = "កំពុងរក្សាទុក..."; btnSave.disabled = true;

    const { error } = await db.from(TABLE_PRODUCTS).insert([newProductData]); 
    if(!error){
        showToast("បានបន្ថែមទំនិញថ្មីជោគជ័យ!", "success"); 
        document.getElementById('newProdName').value = ''; 
        document.getElementById('newProdPrice').value = ''; 
        document.getElementById('newProdBasePrice').value = ''; 
        document.getElementById('newProdWholesalePrice').value = ''; 
        document.getElementById('newProdUnitValue').value = ''; 
        document.getElementById('newProdStdValue').value = ''; 
        document.getElementById('newProdUsage').value = '';
        closeModal('productModal'); await loadProducts();
    } else { showToast("បរាជ័យក្នុងការបន្ថែម សូមពិនិត្យ Database!", "error"); }
    btnSave.innerHTML = originalText; btnSave.disabled = false;
}

window.toggleProductStatus = async function(id, newStatus) {
    let p = productsData.find(prod => String(prod.id) === String(id));
    if(!p) return;

    let actionName = newStatus === 'inactive' ? 'បិទការលក់' : 'បើកលក់វិញ';
    if(confirm(`តើអ្នកពិតជាចង់ ${actionName} ទំនិញ "${p.name}" នេះមែនទេ?`)) {
        let targetId = !isNaN(id) ? Number(id) : id;
        const { data, error } = await db.from(TABLE_PRODUCTS).update({ 
            prod_status: newStatus
        }).eq('id', targetId).select();

        if(!error) {
            showToast(`បាន${actionName}ជោគជ័យ!`, "success");
            p.status = newStatus; 
            if (typeof renderProducts === 'function') renderProducts();
        } else {
            console.error("Supabase Error Details:", error);
            showToast("កំហុស: " + (error.message || "មិនអាចកែប្រែបាន"), "error");
        }
    }
};

window.copyProductInfo = function(id) {
    let p = productsData.find(prod => String(prod.id) === String(id));
    if(!p) return;
    
    let text = `📦 មុខទំនិញ: ${p.name}\n`;
    if(p.unit) text += `📐 ខ្នាត/ចំណុះ: ${p.unit}\n`;
    text += `💰 តម្លៃលក់រាយ: ${money(p.price)}\n`;
    if(p.wholesale_price > 0) text += `🤝 តម្លៃបោះដុំ: ${money(p.wholesale_price)}\n`;
    if(p.usage_guide) text += `📌 របៀបប្រើប្រាស់: ${p.usage_guide}\n`;
    text += `\n🙏 សូមអរគុណសម្រាប់ការគាំទ្រហាងយើងខ្ញុំ!`;
    
    if(navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(() => showToast("បានចម្លងព័ត៌មានទំនិញ!", "success"));
    } else { prompt("Copy ព័ត៌មានខាងក្រោម:", text); }
};

window.exportProductsCSV = function() {
    if(!productsData || productsData.length===0){showToast("គ្មានទិន្នន័យ","error");return;} 
    let csvContent="data:text/csv;charset=utf-8,\uFEFF"; 
    csvContent+="ឈ្មោះទំនិញ,ប្រភេទ,ខ្នាត,តម្លៃក្រុមហ៊ុន,តម្លៃបោះដុំ,តម្លៃលក់រាយ,របៀបប្រើប្រាស់,ស្ថានភាព\r\n"; 
    
    productsData.forEach(p => { 
        let stat = p.status === 'inactive' ? 'បិទលក់' : 'បើកលក់';
        let arr = [p.name || "", p.category || "", p.unit || "", p.base_price || 0, p.wholesale_price || 0, p.price || 0, p.usage_guide || "", stat]; 
        let rowStr = arr.map(e => `"${String(e).replace(/"/g,'""')}"`).join(","); 
        csvContent += rowStr + "\r\n"; 
    }); 
    
    const encodedUri = encodeURI(csvContent); 
    const link = document.createElement("a"); 
    link.setAttribute("href", encodedUri); 
    link.setAttribute("download", `Products_List_${new Date().toISOString().slice(0,10)}.csv`); 
    document.body.appendChild(link); 
    link.click(); 
    document.body.removeChild(link); 
};


// ==========================================
// 🌟 មុខងារអតិថិជន (Customers) 🌟
// ==========================================
async function loadCustomers() {
  const { data, error } = await db.from(TABLE_CUSTOMERS).select('*');
  if (!error) {
    customersData = data.map(c => ({ 
        name: String(c.name || c['customer name'] || c.customer_name || ""), 
        phone: String(c.phone || c['phone '] || ""), 
        address: String(c.address || ""),
        crop: String(c.crop_type || ""),
        crop_size: String(c.crop_size || "") // 🌟 ទាញយកទំហំដី
    }));
    updateCustomerDatalist(); 
    renderCustomers();
  }
}

// 🌟 មុខងារថ្មីសម្រាប់ប្រមូលឈ្មោះម៉ូយទាំងអស់ ទាំងក្នុងបញ្ជី និងក្នុងប្រវត្តិលក់ 🌟
window.updateCustomerDatalist = function() {
    let datalist = document.getElementById('customerListOptions');
    if(!datalist) return;
    
    let uniqueNames = new Set();
    
    // ១. ទាញឈ្មោះពី Customers Data
    if(customersData) {
        customersData.forEach(c => {
            if (c && c.name && c.name.trim() !== '') {
                uniqueNames.add(c.name.trim());
            }
        });
    }
    
    // ២. ទាញឈ្មោះពី Sales Data ក្រែងលោគាត់ទិញហើយ តែយើងភ្លេចចុច Add Customer
    if(salesData) {
        salesData.forEach(s => {
            let cName = (s.customer_name || s['customer-name'] || '').trim();
            if (cName !== '' && cName.toLowerCase() !== 'walk-in') {
                uniqueNames.add(cName);
            }
        });
    }
    
    let opts = '';
    // តម្រៀបតាមអក្ខរក្រម
    let sortedNames = Array.from(uniqueNames).sort();
    sortedNames.forEach(name => {
        // បិទ Tag </option> ឱ្យជិត ការពារ Browser លាក់អក្សរ
        opts += `<option value="${esc(name)}"></option>`; 
    });
    datalist.innerHTML = opts;
};
window.renderCustomers = function() {
    let tbody = document.getElementById('customersTableBody');
    if (!tbody) return;
    
    let kw = document.getElementById('searchCustomer') ? String(document.getElementById('searchCustomer').value).toLowerCase().trim() : '';
    let cleanKw = kw.replace(/\s/g, '');
    let filterType = document.getElementById('filterCustomer') ? document.getElementById('filterCustomer').value : 'all';
    
    let cusStats = {};
    let debtNewTotal = 0; let debtMediumTotal = 0; let debtOldTotal = 0;
    let now = new Date();

    if (salesData && salesData.length > 0) {
        salesData.forEach(row => {
            let cName = String(row.customer_name || row['customer-name'] || 'Walk-in').trim();
            let total = parseFloat(row.total || row.Total || 0);
            let status = cleanStatus(row.status).toLowerCase();
            let paid = (status === 'paid') ? total : parseFloat(row.paid_amount || 0);
            
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
                
                if (diffDays <= 15) debtNewTotal += debtAmount;
                else if (diffDays <= 30) debtMediumTotal += debtAmount;
                else debtOldTotal += debtAmount;
            }
        });
    }

    if(document.getElementById('debtNew')) document.getElementById('debtNew').innerText = money(debtNewTotal);
    if(document.getElementById('debtMedium')) document.getElementById('debtMedium').innerText = money(debtMediumTotal);
    if(document.getElementById('debtOld')) document.getElementById('debtOld').innerText = money(debtOldTotal);

    let filteredData = customersData;
    if (kw) {
        filteredData = customersData.filter(c => {
            let cName = String(c.name || '').toLowerCase(); // 🌟 ការពារគាំង
            let cPhone = String(c.phone || '').toLowerCase().replace(/\s/g, '');
            return cName.includes(kw) || cPhone.includes(cleanKw);
        });
    }
    
    let finalFilteredData = filteredData.filter(c => {
        let stats = cusStats[String(c.name).trim()] || { spent: 0, debt: 0, orders: 0, lastDate: '-' };
        if (filterType === 'debt') return stats.debt > 0;
        if (filterType === 'vip') return stats.spent >= 15000000;
        return true;
    });

    let html = '';
    finalFilteredData.forEach(c => {
        let stats = cusStats[String(c.name).trim()] || { spent: 0, debt: 0, orders: 0, lastDate: '-' };
        let debtBadge = stats.debt > 0 ? `<span class="status-badge" style="background:rgba(239,68,68,0.1); color:#ef4444;">ជំពាក់: ${money(stats.debt)}</span>` : `<span class="status-badge success">គ្មានបំណុល</span>`;

        let tierBadge = `<span class="status-badge" style="background: linear-gradient(135deg, #d97706, #b45309); color: white;"><i class='bx bx-medal'></i> Bronze</span>`;
        if (stats.spent >= 50000000) tierBadge = `<span class="status-badge" style="background: linear-gradient(135deg, #f59e0b, #fbbf24); color: white;"><i class='bx bx-medal'></i> Gold VIP</span>`;
        else if (stats.spent >= 15000000) tierBadge = `<span class="status-badge" style="background: linear-gradient(135deg, #94a3b8, #cbd5e1); color: white;"><i class='bx bx-medal'></i> Silver</span>`;

        let sizeText = c.crop_size ? ` - ${esc(c.crop_size)}` : '';
        let cropBadge = c.crop ? `<br><span class="status-badge" style="background:#dcfce7; color:#16a34a; margin-top:4px; display:inline-block; font-size:11px;"><i class='bx bx-leaf'></i> ${esc(c.crop)}${sizeText}</span>` : '';

        html += `<tr>
            <td><b>${esc(c.name)}</b>${c.address ? `<br><small class="muted"><i class='bx bx-map'></i> ${esc(c.address)}</small>` : ''}${cropBadge}</td>
            <td>${esc(c.phone) || '-'}</td>
            <td class="text-right"><b style="color:var(--success);">${money(stats.spent)}</b></td>
            <td class="text-center">${tierBadge}</td>
            <td class="text-center">${debtBadge}</td>
            <td class="text-center" style="white-space: nowrap;">
                <button class="btn outline small" style="border-color:#f59e0b; color:#f59e0b; margin-right:5px;" onclick="openEditCustomer('${esc(c.name)}', '${esc(c.phone)}', '${esc(c.address)}', '${esc(c.crop)}')"><i class='bx bx-edit'></i> កែប្រែ</button>
                <button class="btn outline small" onclick="viewCustomerDetail('${esc(c.name)}', ${stats.orders}, ${stats.spent}, '${stats.lastDate}')"><i class='bx bx-show'></i> លម្អិត</button>
            </td>
        </tr>`;
    });
    
    tbody.innerHTML = html || '<tr><td colspan="6" class="text-center muted pt-4 pb-4">គ្មានទិន្នន័យអតិថិជនទេ</td></tr>';
};

window.viewCustomerDetail = function(name, orders, spent, lastDate) {
    document.getElementById('modalCusName').innerText = name;
    document.getElementById('modalCusOrders').innerText = orders;
    document.getElementById('modalCusSpent').innerText = money(spent);
    document.getElementById('modalCusLastDate').innerText = lastDate || '-';
    
    let btnArea = document.getElementById('modalDebtActionArea');
    btnArea.innerHTML = '';

    let customerSales = salesData.filter(row => {
        let cName = (row.customer_name || row['customer-name'] || '').trim();
        return cName.toLowerCase() === name.trim().toLowerCase();
    });

    let unpaidItems = customerSales.filter(row => cleanStatus(row.status).toLowerCase() === 'unpaid');
    if (unpaidItems.length > 0) {
        let totalDebt = unpaidItems.reduce((sum, item) => sum + (parseFloat(item.total || 0) - parseFloat(item.paid_amount || 0)), 0);
        btnArea.innerHTML = `<div style="text-align:center; margin-bottom:15px;"><p style="color:var(--danger); font-weight:600; margin-bottom:10px;">កំពុងជំពាក់ប្រាក់សរុប: ${money(totalDebt)}</p><button class="btn primary" style="background:#2AABEE; color:white; width:100%; justify-content:center;" onclick="copyCustomerDebtStatement('${esc(name)}')"><i class='bx bxl-telegram'></i> ចម្លងសារទារបំណុលម៉ូយនេះ</button></div>`;
    } else {
        btnArea.innerHTML = `<div style="text-align:center; margin-bottom:15px;"><p style="color:var(--success); font-weight:600; margin-top:10px;">✅ អតិថិជននេះគ្មានបំណុលជំពាក់ទេ</p></div>`;
    }

    let historyHtml = '';
    customerSales.sort((a,b) => new Date(b.date) - new Date(a.date)).forEach(item => {
        let invNo = getInvoiceNo(item);
        let badge = cleanStatus(item.status).toLowerCase() === 'unpaid' ? `<span class="status-badge" style="background:rgba(239,68,68,0.1); color:#ef4444;">ជំពាក់</span>` : `<span class="status-badge success">ទូទាត់រួច</span>`;
        
        historyHtml += `<tr>
            <td><small class="muted block">${item.date || '-'}</small><b>${invNo}</b></td>
            <td>${esc(item.item)}</td>
            <td class="text-center">${item.qty}</td>
            <td class="text-right"><b>${money(item.total)}</b></td>
            <td class="text-center">${badge}</td>
        </tr>`;
    });
    document.getElementById('modalCusHistoryTable').innerHTML = historyHtml || '<tr><td colspan="5" class="text-center muted pt-4">មិនទាន់មានប្រវត្តិទិញទេ</td></tr>';

    openModal('customerDetailModal');
};

window.saveNewCustomer = async function() { 
    let name=document.getElementById('newCustName').value; 
    let phone=document.getElementById('newCustPhone').value; 
    let address=document.getElementById('newCustAddress').value; 
    let crop=document.getElementById('newCustCrop') ? document.getElementById('newCustCrop').value : ''; 
    let cropSize=document.getElementById('newCustCropSize') ? document.getElementById('newCustCropSize').value : ''; // 🌟
    if(!name.trim()) return; 
    
    let btn = document.querySelector('#customerModal .btn.primary');
    let oldTxt = btn.innerHTML; btn.innerHTML = "រក្សាទុក..."; btn.disabled = true;

    const {error} = await db.from(TABLE_CUSTOMERS).insert([{customer_name:name, phone:phone, address:address, crop_type:crop, crop_size:cropSize}]); 
    if(!error){ showToast("បានបន្ថែមអតិថិជនជោគជ័យ!"); closeModal('customerModal'); loadCustomers(); } 
    btn.innerHTML = oldTxt; btn.disabled = false;
};

window.openEditCustomer = function(name, phone, address, crop, cropSize) {
    document.getElementById('editCustOldName').value = name;
    document.getElementById('editCustName').value = name;
    document.getElementById('editCustPhone').value = phone;
    document.getElementById('editCustAddress').value = address;
    
    let cropSelect = document.getElementById('editCustCrop');
    if(cropSelect) {
        cropSelect.value = (crop && crop !== 'undefined') ? crop : ''; 
        if(typeof handleCropTypeChange === 'function') handleCropTypeChange(cropSelect, 'lblEditCropSize', 'editCustCropSize');
    }
    
    let cropSizeInput = document.getElementById('editCustCropSize');
    if(cropSizeInput) {
        cropSizeInput.value = (cropSize && cropSize !== 'undefined') ? cropSize : '';
    }
    
    openModal('editCustomerModal');
};

window.saveEditedCustomer = async function() {
    let oldName = document.getElementById('editCustOldName').value;
    let newName = document.getElementById('editCustName').value.trim();
    let newPhone = document.getElementById('editCustPhone').value.trim();
    let newAddress = document.getElementById('editCustAddress').value.trim();
    let newCrop = document.getElementById('editCustCrop') ? document.getElementById('editCustCrop').value : '';
    let newCropSize = document.getElementById('editCustCropSize') ? document.getElementById('editCustCropSize').value : ''; // 🌟
    
    if(!newName) { showToast("សូមបញ្ចូលឈ្មោះអតិថិជន!", "error"); return; }
    
    let btn = document.querySelector('#editCustomerModal .btn.primary');
    let oldTxt = btn.innerHTML; btn.innerHTML = "កំពុងរក្សាទុក..."; btn.disabled = true;
    
    const { error } = await db.from(TABLE_CUSTOMERS)
        .update({ customer_name: newName, phone: newPhone, address: newAddress, crop_type: newCrop, crop_size: newCropSize }) // 🌟
        .eq('customer_name', oldName);
        
    if(!error) {
        showToast("កែប្រែជោគជ័យ!", "success");
        closeModal('editCustomerModal');
        loadCustomers();
    } else {
        showToast("កែប្រែបរាជ័យ!", "error");
        console.error(error);
    }
    btn.innerHTML = oldTxt; btn.disabled = false;
};

window.deleteCustomer = async function() {
    let oldName = document.getElementById('editCustOldName').value;
    if(confirm(`តើអ្នកពិតជាចង់លុបអតិថិជន "${oldName}" មែនទេ? (ចំណាំ៖ វាមិនលុបវិក្កយបត្ររបស់គាត់ទេ តែនឹងលុបឈ្មោះចេញពីបញ្ជីម៉ូយ)`)) {
        const { error } = await db.from(TABLE_CUSTOMERS).delete().eq('customer_name', oldName);
        if(!error) {
            showToast("លុបអតិថិជនជោគជ័យ!", "success");
            closeModal('editCustomerModal');
            loadCustomers();
        } else { showToast("លុបបរាជ័យ!", "error"); }
    }
};

window.copyCustomerDebtStatement = function(customerName) {
    let customerUnpaidItems = salesData.filter(row => { return (row.customer_name || row['customer-name'] || '').toLowerCase() === customerName.toLowerCase() && cleanStatus(row.status).toLowerCase() === 'unpaid'; });
    if (customerUnpaidItems.length === 0) { showToast("គ្មានទិន្នន័យជំពាក់ទេ", "error"); return; }

    let text = `📢 ជូនដំណឹងដល់អតិថិជន: ${customerName}\nបញ្ជីវិក្កយបត្រដែលនៅខ្វះខាតការទូទាត់ប្រាក់៖\n------------------------------------\n`;
    let grandTotalDebt = 0;
    customerUnpaidItems.forEach(item => {
        let invNo = getInvoiceNo(item);
        let rev = parseFloat(item.total || item.Total || 0);
        let paid = parseFloat(item.paid_amount || 0);
        let debt = rev - paid; grandTotalDebt += debt;
        text += `▪️ វិក្កយបត្រ: ${invNo} (${item.date || '-'})\n   - ទំនិញ: ${item.item} (${item.qty} x ${item.price}៛)\n   - ទឹកប្រាក់ខ្វះ: ${money(debt)}\n`;
    });
    text += `------------------------------------\n💰 សរុបទឹកប្រាក់ត្រូវទូទាត់សង: ${money(grandTotalDebt)}\n🙏 សូមអរគុណ!`;

    if (navigator.clipboard && window.isSecureContext) { navigator.clipboard.writeText(text).then(() => showToast("បានចម្លងសារទារបំណុលរួចរាល់!", "success")); } else { prompt("Copy សារទារបំណុល៖", text); }
};

window.exportCustomersCSV = function() {
    if(!customersData || customersData.length===0){showToast("គ្មានទិន្នន័យ","error");return;} 
    let csvContent="data:text/csv;charset=utf-8,\uFEFF"; 
    csvContent+="អតិថិជន,លេខទូរស័ព្ទ,អាសយដ្ឋាន,ប្រភេទដំណាំ,ទិញសរុប(ដង),ចំណាយសរុប(៛),កំពុងជំពាក់(៛)\r\n"; 
    
    let cusStats = {};
    salesData.forEach(row => {
        let cName = (row.customer_name || row['customer-name'] || 'Walk-in').trim();
        let total = parseFloat(row.total || 0);
        let paid = cleanStatus(row.status).toLowerCase() === 'paid' ? total : parseFloat(row.paid_amount || 0);
        if (!cusStats[cName]) cusStats[cName] = { spent: 0, debt: 0, orders: 0 };
        cusStats[cName].spent += total;
        cusStats[cName].orders += 1;
        cusStats[cName].debt += (total - paid);
    });

    customersData.forEach(c => { 
        let stats = cusStats[c.name.trim()] || { spent: 0, debt: 0, orders: 0 };
        let arr=[c.name||"", c.phone||"", c.address||"", c.crop||"", stats.orders, stats.spent, stats.debt]; 
        let rowStr=arr.map(e=>`"${String(e).replace(/"/g,'""')}"`).join(","); 
        csvContent+=rowStr+"\r\n"; 
    }); 
    
    const encodedUri=encodeURI(csvContent); 
    const link=document.createElement("a"); 
    link.setAttribute("href",encodedUri); 
    link.setAttribute("download",`Customers_Report_${new Date().toISOString().slice(0,10)}.csv`); 
    document.body.appendChild(link); 
    link.click(); 
    document.body.removeChild(link); 
};

window.onCustomerSelect = function() {
  let val = String(document.getElementById('customerInput').value).trim();
  let found = customersData.find(c => c && String(c.name).toLowerCase() === val.toLowerCase());
  
  let assistantBox = document.getElementById('smartAssistantBox');
  let assistantText = document.getElementById('smartAssistantText');
  let iconBox = assistantBox ? assistantBox.querySelector('i') : null; 

  if (found) { 
      document.getElementById('phone').value = found.phone || ""; 
      document.getElementById('address').value = found.address || ""; 
      
      if(document.getElementById('saleCropType')) {
          let cropSelect = document.getElementById('saleCropType');
          cropSelect.value = found.crop || "";
          if(typeof handleCropTypeChange === 'function') handleCropTypeChange(cropSelect, 'lblSaleSize', 'saleCropSize');
      }
      if(document.getElementById('saleCropSize')) {
          document.getElementById('saleCropSize').value = found.crop_size || "";
      }

      if(assistantBox && assistantText) {
          let cusSales = salesData.filter(s => String(s.customer_name || s['customer-name'] || '').trim().toLowerCase() === val.toLowerCase());
          
          if(cusSales.length > 0) {
              let todayStr = new Date().toISOString().slice(0, 10);
              let overdueSales = cusSales.filter(s => cleanStatus(s.status).toLowerCase() === 'unpaid' && s.due_date && s.due_date <= todayStr);
              
              let totalOverdueDebt = 0;
              overdueSales.forEach(s => {
                  let rev = parseFloat(s.total || s.Total || 0);
                  let paid = parseFloat(s.paid_amount || 0);
                  totalOverdueDebt += (rev - paid);
              });

              let advice = "";
              
              if (totalOverdueDebt > 0) {
                  assistantBox.style.background = '#fef2f2';
                  assistantBox.style.borderColor = '#fecaca';
                  assistantBox.style.borderLeft = '4px solid #ef4444';
                  assistantBox.style.color = '#991b1b';
                  if(iconBox) { iconBox.className = 'bx bx-alarm-exclamation bx-tada'; iconBox.style.color = '#ef4444'; }
                  
                  advice += `<div style="color: #ef4444; font-size: 15px; font-weight: 700; margin-bottom: 8px; border-bottom: 1px dashed #fca5a5; padding-bottom: 6px;">
                                ⚠️ ប្រយ័ត្ន! ម៉ូយនេះជំពាក់លុយហួសកំណត់សងចំនួន ${money(totalOverdueDebt)}!
                                <br><small style="color: #991b1b; font-weight: 500;">(សូមសួរនាំទារលុយចាស់សិន មុននឹងសម្រេចចិត្តលក់ជំពាក់ថែម)</small>
                             </div>`;
              } else {
                  assistantBox.style.background = '#eef2ff';
                  assistantBox.style.borderColor = '#c7d2fe';
                  assistantBox.style.borderLeft = '4px solid #4f46e5';
                  assistantBox.style.color = '#3730a3';
                  if(iconBox) { iconBox.className = 'bx bx-bulb'; iconBox.style.color = '#f59e0b'; }
              }

              let itemCounts = {};
              let lastHerbicide = null;
              let lastFertilizer = null;
              
              cusSales.forEach(s => {
                  if(s.item) itemCounts[s.item] = (itemCounts[s.item] || 0) + (parseFloat(s.qty || 1));
                  if(s.date) {
                      let d = new Date(s.date);
                      let cat = String(s.agro_chemicals || '').toLowerCase();
                      if(cat.includes('herbicide') || cat.includes('ស្មៅ')) { 
                          if(!lastHerbicide || d > lastHerbicide) lastHerbicide = d; 
                      }
                      if(cat.includes('fertilizer') || cat.includes('ជី')) { 
                          if(!lastFertilizer || d > lastFertilizer) lastFertilizer = d; 
                      }
                  }
              });

              let topItems = Object.keys(itemCounts).sort((a,b) => itemCounts[b] - itemCounts[a]).slice(0, 2);
              advice += `អតិថិជនចាស់! ម៉ូយនេះឧស្សាហ៍ទិញ៖ ${topItems.map(i => `<b style="color:var(--primary);">${esc(i)}</b>`).join(', ')}។<br>`;
              
              let now = new Date();
              if(lastHerbicide) {
                  let diffDays = Math.ceil(Math.abs(now - lastHerbicide) / (1000 * 60 * 60 * 24));
                  if(diffDays >= 10 && diffDays <= 45) {
                      advice += `<span style="color: #d97706; margin-top:5px; display:inline-block;"><i class='bx bx-check-shield'></i> គាត់បាញ់ថ្នាំស្មៅ <b>${diffDays} ថ្ងៃមុន</b> ដល់ពេលគួរនិយាយ Upsell លក់ <b>ជីបំប៉ន ឬជីទឹក</b> បន្ថែមហើយ!</span>`;
                  }
              } else if (lastFertilizer) {
                  let diffDays = Math.ceil(Math.abs(now - lastFertilizer) / (1000 * 60 * 60 * 24));
                  if(diffDays >= 15 && diffDays <= 40) {
                      advice += `<span style="color: #059669; margin-top:5px; display:inline-block;"><i class='bx bx-bug'></i> គាត់ដាក់ជី <b>${diffDays} ថ្ងៃមុន</b> គួរណែនាំ <b>ថ្នាំការពារសត្វល្អិត ឬថ្នាំផ្សិត</b> បន្ថែម!</span>`;
                  }
              }
              
              assistantText.innerHTML = advice;
              assistantBox.style.display = 'flex';
          } else {
              assistantBox.style.display = 'none';
          }
      }

  } else {
      document.getElementById('phone').value = ""; 
      document.getElementById('address').value = ""; 
      if(document.getElementById('saleCropType')) document.getElementById('saleCropType').value = "";
      if(document.getElementById('saleCropSize')) document.getElementById('saleCropSize').value = "";
      if(assistantBox) assistantBox.style.display = 'none';
  }
};

window.onProductSelect = function(input) {
  let row = input.closest('tr'); 
  let val = input.value.trim();
  let priceInput = row.querySelector('.item-price');
  
  let variations = productsData.filter(p => p && p.name && p.name.toLowerCase() === val.toLowerCase());
  
  if (variations.length > 0) { 
      let v = variations[0];
      let guideBox = document.getElementById('productGuideBox');
      let guideText = document.getElementById('productGuideText');
      if (guideBox && v.usage_guide) {
          guideText.innerHTML = `<b style="color:var(--primary);">${esc(v.name)}:</b> ${esc(v.usage_guide)}`;
          guideBox.style.display = 'flex';
      } else if (guideBox) {
          guideBox.style.display = 'none';
      }

      let unitContainer = row.querySelector('.unit-container');
      if (variations.length > 1) {
          let selectHTML = `<select class="form-input item-unit" style="padding: 9px 4px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px;" onchange="onUnitChange(this)">`;
          variations.forEach(vOpt => { selectHTML += `<option value="${esc(vOpt.unit)}" data-price="${vOpt.price}" data-pkg="${esc(vOpt.package_type)}" data-uv="${vOpt.unit_value}" data-um="${esc(vOpt.unit_measure)}" data-suv="${vOpt.standard_unit_value}" data-sum="${esc(vOpt.standard_unit_measure)}">${esc(vOpt.unit)}</option>`; });
          selectHTML += `</select>`; unitContainer.innerHTML = selectHTML;
      } else {
          unitContainer.innerHTML = `<input type="text" class="form-input item-unit" value="${esc(v.unit)}" readonly style="padding: 10px 8px; background:#f1f5f9; color:var(--muted);">`;
      }
      
      if(priceInput) priceInput.value = v.price; 
      if(row.querySelector('.item-pkg')) row.querySelector('.item-pkg').value = v.package_type || "";
      if(row.querySelector('.item-uv')) row.querySelector('.item-uv').value = v.unit_value || 0;
      if(row.querySelector('.item-um')) row.querySelector('.item-um').value = v.unit_measure || "";
      if(row.querySelector('.item-suv')) row.querySelector('.item-suv').value = v.standard_unit_value || 0;
      if(row.querySelector('.item-sum')) row.querySelector('.item-sum').value = v.standard_unit_measure || "";
  }
  calculateRow(priceInput);
};

window.addItemRow = function(item='', unit='', qty=1, price=0, pkg='', uv=0, um='', suv=0, sum='') {
  let tbody = document.getElementById('itemTable'); 
  let tr = document.createElement('tr');
  let amount = (qty * price); 
  
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
    <td style="padding: 10px;"><input type="text" class="form-input item-amount text-right" readonly value="${money(Math.max(0,amount))}" style="border:none; background:transparent; font-weight:bold; color:var(--text); padding: 10px 4px;"></td>
    <td class="text-center no-print" style="padding: 10px;"><button class="btn outline small no-print" style="color:var(--danger); border-color:var(--danger);" onclick="removeRow(this)"><i class='bx bx-trash'></i></button></td>
  `;
  tbody.appendChild(tr); 
  calculateGrandTotal();
};

window.removeRow = function(btn) { 
    if(confirm("តើអ្នកពិតជាចង់លុបជួរនេះមែនទេ?")) { 
        btn.closest('tr').remove(); 
        calculateGrandTotal(); 
    } 
};

window.calculateRow = function(input) {
  let row = input.closest('tr');
  if(input.value < 0) input.value = 0; 
  let qty = parseFloat(row.querySelector('.item-qty').value) || 0; 
  let price = parseFloat(row.querySelector('.item-price').value) || 0; 
  let amount = qty * price; 
  row.querySelector('.item-amount').value = money(Math.max(0, amount));
  calculateGrandTotal();
};

window.calculateGrandTotal = function() {
  let rows = document.querySelectorAll('#itemTable tr'); 
  let subtotalRevenue = 0;
  let totalCost = 0;

  rows.forEach(row => {
    let prodName = row.querySelector('.item-input').value.trim();
    let qty = parseFloat(row.querySelector('.item-qty').value) || 0; 
    let price = parseFloat(row.querySelector('.item-price').value) || 0; 
    let amount = qty * price; 
    
    let prodObj = productsData.find(p => p.name === prodName);
    let basePrice = prodObj && prodObj.base_price > 0 ? prodObj.base_price : price;
    
    totalCost += (basePrice * qty);
    subtotalRevenue += amount;
  });
  
  let globalDiscountEl = document.getElementById('globalDiscount');
  let globalDiscount = globalDiscountEl ? parseFloat(globalDiscountEl.value) || 0 : 0;
  let totalRevenue = Math.max(0, subtotalRevenue - globalDiscount);
  let totalProfit = totalRevenue - totalCost;

  currentGrandTotalValue = totalRevenue; 
  let branchBonusValue = totalProfit > 0 ? totalProfit * 0.40 : 0; 

  if(document.getElementById('grandTotal')) document.getElementById('grandTotal').innerText = money(totalRevenue);
  if(document.getElementById('invoiceTotalProfit')) document.getElementById('invoiceTotalProfit').innerText = money(totalProfit);
  if(document.getElementById('branchBonusTotal')) document.getElementById('branchBonusTotal').innerText = money(branchBonusValue);

  calculateChange();
};

window.calculateChange = function() {
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
};

window.toggleDueDate = function() {
    let status = document.getElementById('paymentStatus').value;
    let dueInput = document.getElementById('dueDate');
    if (status === 'Unpaid') {
        dueInput.style.display = 'block';
        let tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
        dueInput.value = formatDateForInput(tomorrow);
    } else {
        dueInput.style.display = 'none';
        dueInput.value = '';
    }
};

window.resetFormRows = function() {
  let tbody = document.getElementById('itemTable');
  if(tbody) tbody.innerHTML = ''; 
  for(let i = 0; i < 3; i++) addItemRow();
  
  let receivedEl = document.getElementById('cashReceived');
  if(receivedEl) receivedEl.value = ''; 
  
  let changeEl = document.getElementById('cashChange');
  if(changeEl) changeEl.value = '0 ៛';
  
  let discountEl = document.getElementById('globalDiscount');
  if(discountEl) discountEl.value = '';

  let box = document.getElementById('smartAssistantBox');
  if(box) box.style.display = 'none';
  
  calculateGrandTotal();
};

window.saveData = async function() {
  let items = [];
  let dateEl = document.getElementById('date');
  let dateVal = dateEl ? dateEl.value : new Date().toISOString().slice(0,10); 
  
  if (!dateVal) { showToast("សូមជ្រើសរើសកាលបរិច្ឆេទលក់!", "error"); return; }

  let cashierVal = document.getElementById('cashier') ? document.getElementById('cashier').value : 'Admin';
  let customerVal = document.getElementById('customerInput') ? document.getElementById('customerInput').value.trim() : ''; 
  let phoneVal = document.getElementById('phone') ? document.getElementById('phone').value : ''; 
  let addressVal = document.getElementById('address') ? document.getElementById('address').value : '';
  let statusVal = document.getElementById('paymentStatus') ? document.getElementById('paymentStatus').value : 'Paid';
  let cropTypeVal = document.getElementById('saleCropType') ? document.getElementById('saleCropType').value : ''; 
  let cropSizeVal = document.getElementById('saleCropSize') ? document.getElementById('saleCropSize').value : ''; 

  // 🌟 ទាញយកថ្ងៃសន្យាសងនៅខាងក្រៅ Loop ដើម្បីកុំឱ្យ Error "dueDateVal is not defined" 🌟
  let dueDateEl = document.getElementById('dueDate');
  let dueDateVal = (statusVal === 'Unpaid' && dueDateEl && dueDateEl.value) ? dueDateEl.value : null;

  let globalDiscountEl = document.getElementById('globalDiscount');
  let globalDiscount = globalDiscountEl ? parseFloat(globalDiscountEl.value) || 0 : 0;

  let cashReceivedEl = document.getElementById('cashReceived');
  let totalCashReceived = cashReceivedEl ? (parseFloat(cashReceivedEl.value) || 0) : 0;
  let remainingCashToApply = totalCashReceived;

  let maxId = 0;
  let maxInvNum = 0;
  if (salesData && salesData.length > 0) {
      maxId = salesData.reduce((max, p) => (p.id && p.id > max ? p.id : max), 0);
      salesData.forEach(s => {
          let invStr = s.invoice_no || '';
          if(invStr.startsWith('INV-')) {
              let num = parseInt(invStr.replace('INV-', ''));
              if(num > maxInvNum) maxInvNum = num;
          } else if (s.id && !s.invoice_no) {
              if (s.id > maxInvNum) maxInvNum = s.id;
          }
      });
  }
  let currentInvoiceNo = `INV-${String(maxInvNum + 1).padStart(5, '0')}`;

  let subtotalInvoice = 0;
  let activeRows = [];
  document.querySelectorAll('#itemTable tr').forEach(row => {
    let inputEl = row.querySelector('.item-input');
    if (!inputEl) return;
    let prodName = inputEl.value.trim();
    if (prodName !== "") { 
        let qty = parseFloat(row.querySelector('.item-qty').value) || 0; 
        let price = parseFloat(row.querySelector('.item-price').value) || 0; 
        subtotalInvoice += (qty * price);
        activeRows.push({ row, prodName, qty, price });
    }
  });

  if (activeRows.length === 0) { showToast("សូមបញ្ចូលមុខទំនិញយ៉ាងហោចណាស់ 1!", "error"); return; }
  let totalDiscountApplied = 0;

  activeRows.forEach((data, index) => {
        let amount = data.qty * data.price;
        let rowDiscount = 0;
        
        if (globalDiscount > 0) {
            if (index === activeRows.length - 1) { rowDiscount = globalDiscount - totalDiscountApplied; } 
            else { rowDiscount = subtotalInvoice > 0 ? Math.round((amount / subtotalInvoice) * globalDiscount) : 0; }
        }
        totalDiscountApplied += rowDiscount;
        
        let finalAmount = Math.max(0, amount - rowDiscount);
        let rowPaid = 0;
        
        if (statusVal === 'Paid') { rowPaid = finalAmount; } 
        else {
            if (remainingCashToApply >= finalAmount) { rowPaid = finalAmount; remainingCashToApply -= finalAmount; } 
            else if (remainingCashToApply > 0) { rowPaid = remainingCashToApply; remainingCashToApply = 0; }
        }

        let prodObj = productsData.find(p => p.name === data.prodName);
        let currentBasePrice = prodObj && prodObj.base_price > 0 ? prodObj.base_price : data.price;

        maxId++; 
        items.push({ 
            id: maxId,
            invoice_no: currentInvoiceNo, 
            date: dateVal, cashier: cashierVal, customer_name: customerVal, phone: phoneVal, address: addressVal, 
            crop_type: cropTypeVal,
            crop_size: cropSizeVal, 
            item: data.prodName, 
            unit: data.row.querySelector('.item-unit') ? data.row.querySelector('.item-unit').value.trim() : '', 
            package_type: data.row.querySelector('.item-pkg') ? data.row.querySelector('.item-pkg').value.trim() : '', 
            unit_value: data.row.querySelector('.item-uv') ? parseFloat(data.row.querySelector('.item-uv').value) || 0 : 0, 
            unit_measure: data.row.querySelector('.item-um') ? data.row.querySelector('.item-um').value.trim() : '', 
            standard_unit_value: data.row.querySelector('.item-suv') ? parseFloat(data.row.querySelector('.item-suv').value) || 0 : 0, 
            standard_unit_measure: data.row.querySelector('.item-sum') ? data.row.querySelector('.item-sum').value.trim() : '', 
            qty: data.qty, price: data.price, discount: rowDiscount, total: finalAmount, paid_amount: rowPaid, status: statusVal,
            due_date: dueDateVal, // 🌟 ប្រើប្រាស់អថេរដែលប្រកាសខាងក្រៅ
            base_price: currentBasePrice
        });
  });

  let btnSave = document.getElementById('btnSave'); 
  if(btnSave) { btnSave.innerHTML = "Saving..."; btnSave.disabled = true; }

  const { error } = await db.from(TABLE_SALES).insert(items);
  if (error) { 
      showToast("រក្សាទុកបរាជ័យ! សូមពិនិត្យ Database", "error"); console.error(error); 
  } else {
    showToast("រក្សាទុកជោគជ័យ!", "success");
    
    // 🌟 ផ្ញើវិក្កយបត្រលម្អិតចូល Telegram 
    let saleDataObj = {
        invoiceNo: currentInvoiceNo,
        customerName: customerVal,
        phone: phoneVal,
        items: activeRows,
        total: subtotalInvoice,
        discount: globalDiscount,
        paid: totalCashReceived,
        status: statusVal,
        dueDate: dueDateVal,
        cashier: cashierVal
    };
    sendToTelegram('', 'sale', saleDataObj);
    
    // 🌟 បញ្ចប់ការផ្ញើ & ជម្រះប្រអប់ឱ្យស្អាត ដើម្បីវាយបញ្ចូលបន្ត 🌟
    if(document.getElementById('customerInput')) document.getElementById('customerInput').value = ''; 
    if(document.getElementById('phone')) document.getElementById('phone').value = ''; 
    if(document.getElementById('address')) document.getElementById('address').value = '';
    if(document.getElementById('saleCropType')) document.getElementById('saleCropType').value = ''; 
    if(document.getElementById('saleCropSize')) document.getElementById('saleCropSize').value = ''; 
    resetFormRows(); 
    await refreshAllData(); 
  }
  if(btnSave) { btnSave.innerHTML = "<i class='bx bx-save'></i> រក្សាទុកការលក់"; btnSave.disabled = false; }
};

window.copyInvoiceToTelegram = function() {
    let dateVal = document.getElementById('date').value;
    let cName = document.getElementById('customerInput').value || 'Walk-in';
    let grandTotal = document.getElementById('grandTotal').innerText;
    let globalDiscountEl = document.getElementById('globalDiscount');
    let globalDiscount = globalDiscountEl ? parseFloat(globalDiscountEl.value) || 0 : 0;
    
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
    text += `------------------------\n`;
    if(globalDiscount > 0) {
        text += `🔻 បញ្ចុះតម្លៃសរុប: ${money(globalDiscount)}\n`;
    }
    text += `💰 សរុបទឹកប្រាក់: ${grandTotal}\n💵 ប្រាក់ទទួលបាន: ${money(paid)}\n`;
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

// 🌟 មុខងារទាញយករូបភាពវិក្កយបត្រ (កែប្រែថ្មី ឱ្យចេញវិក្កយបត្រតូចស្អាតដូច Print) 🌟
window.downloadInvoiceImage = function() {
    let dateVal = document.getElementById('date').value || '-';
    let cusName = document.getElementById('customerInput').value || 'Walk-in';
    let cusPhone = document.getElementById('phone').value || '-';
    let statusEl = document.getElementById('paymentStatus');
    let statusText = statusEl.options[statusEl.selectedIndex].text;
    
    let grandTotal = document.getElementById('grandTotal').innerText;
    let globalDiscount = parseFloat(document.getElementById('globalDiscount').value) || 0;
    
    let printItemsHtml = '';
    let hasItems = false;
    
    document.querySelectorAll('#itemTable tr').forEach(row => {
        let item = row.querySelector('.item-input').value;
        if(item) {
            hasItems = true;
            let qty = row.querySelector('.item-qty').value;
            let price = row.querySelector('.item-price').value;
            let amount = row.querySelector('.item-amount').value;
            let unit = row.querySelector('.item-unit').value;
            let unitDisplay = unit ? ` (${unit})` : '';
            
            printItemsHtml += `<tr style="border-bottom: 1px dotted #ccc;">
                <td style="padding: 4px 2px; width: 45%;">${esc(item)}${unitDisplay}</td>
                <td style="padding: 4px 2px; width: 15%; text-align: center;">${qty}</td>
                <td style="padding: 4px 2px; width: 20%; text-align: right;">${money(price)}</td>
                <td style="padding: 4px 2px; width: 20%; text-align: right;">${amount}</td>
            </tr>`;
        }
    });

    if(!hasItems) { showToast("សូមបញ្ចូលមុខទំនិញជាមុនសិន!", "error"); return; }

    let discountHtml = globalDiscount > 0 ? `<div style="margin-top: 5px; color: var(--danger);">បញ្ចុះតម្លៃ: <b>-${money(globalDiscount)}</b></div>` : '';

    // បង្កើតកូដ HTML វិក្កយបត្រតូចសម្រាប់ថតរូប
    let printContent = `
    <html><head><title>Invoice Capture</title>
    <link href="https://fonts.googleapis.com/css2?family=Kantumruy+Pro:wght@400;600&display=swap" rel="stylesheet">
    <style>
        body { font-family: 'Kantumruy Pro', sans-serif; font-size: 13px; padding: 15px; width: 350px; color: #000; background: white; margin: 0 auto; }
        table { width: 100%; border-collapse: collapse; table-layout: fixed; margin-top: 10px; }
        td, th { word-wrap: break-word; font-size: 12px; color: #000; }
        .border-bottom { border-bottom: 1px dashed #000; padding-bottom: 8px; margin-bottom: 8px; }
    </style>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>
    </head><body>
      <div id="captureArea" style="background: white; padding: 10px;">
        <div style="text-align: center;" class="border-bottom">
            <h1 style="margin: 0; font-size: 20px; color: #1e3a8a;">ស្រែមាស ចំការលើ</h1>
            <p style="margin: 4px 0 0; font-size: 12px;">អាសយដ្ឋាន: ចំការលើ, កំពង់ចាម<br>ទូរស័ព្ទ: 088 433 7888</p>
            <h2 style="margin: 8px 0 0; font-size: 16px;">វិក្កយបត្រ (INVOICE)</h2>
            <p style="margin: 4px 0; font-size: 12px;">កាលបរិច្ឆេទ: <b>${dateVal}</b></p>
        </div>
        <div class="border-bottom" style="font-size: 12px;">
            អតិថិជន: <b>${esc(cusName)}</b><br>
            ទូរស័ព្ទ: ${esc(cusPhone)}<br>
            ស្ថានភាព: <b>${statusText}</b>
        </div>
        <table style="margin-bottom: 8px;">
            <thead style="border-bottom: 1px dashed #000;">
                <tr><th style="text-align:left; padding-bottom:4px;">មុខទំនិញ</th><th style="padding-bottom:4px;">ចំនួន</th><th style="text-align:right; padding-bottom:4px;">តម្លៃ</th><th style="text-align:right; padding-bottom:4px;">សរុប</th></tr>
            </thead>
            <tbody>${printItemsHtml}</tbody>
        </table>
        <div style="border-top: 1px dashed #000; padding-top: 8px; text-align:right; font-size: 14px;">
            ${discountHtml}
            <div style="margin-top: 5px;">សរុបទឹកប្រាក់: <b style="font-size: 18px;">${grandTotal}</b></div>
        </div>
        <div style="text-align: center; margin-top: 20px; font-weight: bold; border-top: 1px dashed #000; padding-top: 15px;">
            🙏 សូមអរគុណសម្រាប់ការគាំទ្រ!
        </div>
      </div>
      <script>
        window.onload = function() {
            setTimeout(() => {
                html2canvas(document.getElementById('captureArea'), { scale: 3 }).then(canvas => {
                    let link = document.createElement('a');
                    link.download = 'Invoice_${esc(cusName)}_${dateVal}.png';
                    link.href = canvas.toDataURL('image/png');
                    link.click();
                    window.close();
                });
            }, 500);
        };
      </script>
    </body></html>`;

    let captureWindow = window.open('', '', 'width=400,height=600');
    captureWindow.document.write(printContent);
    captureWindow.document.close();
    showToast("កំពុងរៀបចំទាញយករូបភាព...", "success");
};

// ==========================================
// 🌟 ប្រវត្តិការលក់ (Sale History) 🌟
// ==========================================
window.loadRecentHistory = function() {
  let container = document.getElementById('recentHistoryContainer');
  if(!container) return;
  if (!salesData || salesData.length === 0) { container.innerHTML = '<div class="text-center muted pt-4 pb-4">គ្មានប្រវត្តិបញ្ចូលទេ</div>'; return; }

  let html = '';
  let todayStr = new Date().toISOString().slice(0, 10); 

  salesData.slice(0, 15).forEach(item => {
    let invNo = typeof getInvoiceNo === 'function' ? getInvoiceNo(item) : (item.id ? `INV-${String(item.id).padStart(5, '0')}` : `INV-00000`);
    let cName = item.customer_name || item['customer-name'] || 'Walk-in';
    let rowTotal = parseFloat(item.total || item.Total || 0);
    
    let isOldInvoice = (item.date && item.date < todayStr);
    let editBtnHtml = isOldInvoice ? 
        `<button class="btn outline small" style="color:var(--danger); border-color:var(--danger);" onclick="unlockAndEdit('${item.id}', this)" data-item="${esc(item.item)}" data-qty="${item.qty || 1}" data-price="${item.price || 0}" data-discount="${item.discount || item.Discount || 0}" data-status="${esc(item.status || 'Paid')}"><i class='bx bx-lock-open-alt'></i> ដោះសោរ</button>` :
        `<button class="btn outline small" data-id="${item.id}" data-item="${esc(item.item)}" data-qty="${item.qty || 1}" data-price="${item.price || 0}" data-discount="${item.discount || item.Discount || 0}" data-status="${esc(item.status || 'Paid')}" onclick="handleEditBtn(this)"><i class='bx bx-edit'></i> កែប្រែ</button>`;

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
          ${editBtnHtml}
        </div>
      </div>
    `;
  });
  container.innerHTML = html;
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

window.performSearch = function() {
  let kw = document.getElementById('searchKeyword') ? document.getElementById('searchKeyword').value.trim().toLowerCase() : '';
  let cleanKw = kw.replace(/\s/g, ''); 
  let startDate = document.getElementById('searchStartDate') ? document.getElementById('searchStartDate').value : ''; 
  let endDate = document.getElementById('searchEndDate') ? document.getElementById('searchEndDate').value : '';
  let tbody = document.getElementById('searchResultsTable'); 
  let summary = document.getElementById('searchSummary');
  if(!tbody) return;

  let filteredData = salesData;
  if (kw) { filteredData = filteredData.filter(item => { let cName = (item.customer_name || item['customer-name'] || '').toLowerCase(); let phone = (item.phone || '').toLowerCase().replace(/\s/g, ''); return cName.includes(kw) || phone.includes(cleanKw); }); }
  
  let defaultStart = startDate ? startDate : '2026-01-01';
  let start = new Date(defaultStart); start.setHours(0,0,0,0);
  let end = endDate ? new Date(endDate) : new Date('2100-01-01'); end.setHours(23,59,59,999);
  
  filteredData = filteredData.filter(item => { if (!item.date) return false; let itemDate = new Date(item.date); return itemDate >= start && itemDate <= end; });

  let totalSpent = 0; 
  let invoices = {}; 
  
  filteredData.forEach(item => {
      let invNo = typeof getInvoiceNo === 'function' ? getInvoiceNo(item) : (item.id ? `INV-${String(item.id).padStart(5, '0')}` : `INV-00000`);
      if (!invoices[invNo]) {
          invoices[invNo] = {
              invNo: invNo, date: item.date || '-', customer: item.customer_name || item['customer-name'] || 'Walk-in',
              phone: item.phone || '', address: item.address || '',
              items: [], grandTotal: 0, paidTotal: 0
          };
      }
      invoices[invNo].items.push(item);
      
      let rowTotal = parseFloat(item.total || item.Total || 0);
      let isPaid = cleanStatus(item.status).toLowerCase() === 'paid';
      let rowPaid = isPaid ? rowTotal : parseFloat(item.paid_amount || 0);
      
      invoices[invNo].grandTotal += rowTotal;
      invoices[invNo].paidTotal += rowPaid;
      totalSpent += rowTotal; 
  });

  let html = '';
  let invoiceKeys = Object.keys(invoices).sort((a,b) => b.localeCompare(a)); 
  
  if (currentHistoryFilter === 'unpaid') {
      invoiceKeys = invoiceKeys.filter(k => (invoices[k].grandTotal - invoices[k].paidTotal) > 0);
      totalSpent = 0; invoiceKeys.forEach(k => totalSpent += (invoices[k].grandTotal - invoices[k].paidTotal));
  }

  invoiceKeys.forEach(invNo => {
      let inv = invoices[invNo];
      let debt = inv.grandTotal - inv.paidTotal;
      let isUnpaid = debt > 0;
      let badge = isUnpaid ? `<span class="status-badge" style="background:rgba(239,68,68,0.1); color:#ef4444;">ជំពាក់ ${money(debt)}</span>` : `<span class="status-badge success">ទូទាត់រួច</span>`;
      
      let actionButtons = `<button class="btn outline small" onclick="viewInvoiceDetail('${invNo}')" title="មើលលម្អិត និងបោះពុម្ព"><i class='bx bx-list-ul'></i> លម្អិត</button>`;
      
      if (isUnpaid) { actionButtons = `<button class="btn primary small" onclick="openInvoicePayment('${invNo}', ${inv.paidTotal}, ${inv.grandTotal})" style="background:var(--success); border-color:var(--success); margin-right:5px;"><i class='bx bx-wallet'></i> សងលុយ</button>` + actionButtons; }

      html += `<tr><td class="muted">${inv.date}</td><td><b>${invNo}</b></td><td><b>${esc(inv.customer)}</b></td><td class="text-center">${inv.items.length} មុខ</td><td class="text-right"><b style="color:var(--text);">${money(inv.grandTotal)}</b></td><td class="text-center">${badge}</td><td class="text-center" style="white-space: nowrap;">${actionButtons}</td></tr>`;
  });

  tbody.innerHTML = html || `<tr><td colspan="7" class="text-center muted pt-4 pb-4">គ្មានទិន្នន័យចាប់ពីថ្ងៃទី ${defaultStart} ទេ</td></tr>`;
  if(summary) { let summaryText = currentHistoryFilter === 'unpaid' ? `សរុបប្រាក់កំពុងជំពាក់: ${money(totalSpent)}` : `សរុបទឹកប្រាក់លទ្ធផល: ${money(totalSpent)}`; summary.style.color = currentHistoryFilter === 'unpaid' ? "var(--warning)" : "var(--primary)"; summary.innerText = summaryText; }
};

window.openInvoicePayment = function(invNo, currentPaid, totalAmount) {
    let remaining = totalAmount - currentPaid;
    document.getElementById('paySaleId').value = invNo; 
    document.getElementById('paySaleTotal').value = totalAmount;
    document.getElementById('paySaleCurrentPaid').value = currentPaid;
    document.getElementById('payRemainingAmount').innerText = money(remaining);
    document.getElementById('payNewAmount').value = '';
    openModal('partialPaymentModal');
};

window.savePartialPayment = async function() {
    let invNo = document.getElementById('paySaleId').value;
    let total = parseFloat(document.getElementById('paySaleTotal').value);
    let currentPaid = parseFloat(document.getElementById('paySaleCurrentPaid').value);
    let newPay = parseFloat(document.getElementById('payNewAmount').value);
    
    if (!newPay || newPay <= 0) { showToast("សូមបញ្ចូលទឹកប្រាក់ឱ្យបានត្រឹមត្រូវ!", "error"); return; }
    
    let btn = document.querySelector('#partialPaymentModal .btn.primary');
    let oldText = btn.innerHTML; btn.innerHTML = "កំពុងរក្សាទុក..."; btn.disabled = true;

    let items = salesData.filter(s => getInvoiceNo(s) === invNo && cleanStatus(s.status).toLowerCase() !== 'paid');
    let remainingToDistribute = newPay;
    let updatePromises = [];

    for (let s of items) {
        if (remainingToDistribute <= 0) break;
        let itemTotal = parseFloat(s.total || 0);
        let itemPaid = parseFloat(s.paid_amount || 0);
        let itemDebt = itemTotal - itemPaid;
        
        if (itemDebt > 0) {
            let payForThisItem = Math.min(itemDebt, remainingToDistribute);
            let newItemPaid = itemPaid + payForThisItem;
            let newStatus = newItemPaid >= itemTotal ? 'Paid' : 'Unpaid';
            updatePromises.push(db.from(TABLE_SALES).update({ status: newStatus, paid_amount: newItemPaid }).eq('id', s.id));
            remainingToDistribute -= payForThisItem;
        }
    }

    await Promise.all(updatePromises);
    btn.innerHTML = oldText; btn.disabled = false;
    showToast("បានកត់ត្រាប្រាក់សងជោគជ័យ!", "success");
    closeModal('partialPaymentModal');
    await refreshAllData();
};

window.viewInvoiceDetail = function(invNo) {
    let items = salesData.filter(s => getInvoiceNo(s) === invNo);
    if(items.length === 0) return;
    
    let first = items[0];
    document.getElementById('detailInvNo').innerText = invNo;
    
    // 🌟 បង្ហាញប្រភេទដំណាំ និងទំហំដីនៅជាប់ឈ្មោះអតិថិជន
    let cNameDisplay = first.customer_name || 'Walk-in';
    let extraInfo = [];
    if (first.crop_type) extraInfo.push(first.crop_type);
    if (first.crop_size) extraInfo.push(first.crop_size);
    
    if (extraInfo.length > 0) {
        cNameDisplay += ` <span style="font-size: 11px; background: #e0e7ff; color: #4f46e5; padding: 2px 6px; border-radius: 4px; margin-left: 5px;">${esc(extraInfo.join(' - '))}</span>`;
    }
    
    document.getElementById('detailCusName').innerHTML = cNameDisplay;
    document.getElementById('detailDate').innerText = first.date;
    
    let grandTotal = 0; let paidTotal = 0; let html = '';
    let todayStr = new Date().toISOString().slice(0, 10);
    
    items.forEach(item => {
        let itemTotal = parseFloat(item.total || 0);
        let isPaid = cleanStatus(item.status).toLowerCase() === 'paid';
        let itemPaid = isPaid ? itemTotal : parseFloat(item.paid_amount || 0);
        grandTotal += itemTotal; paidTotal += itemPaid;
        
        let isOldInvoice = (item.date && item.date < todayStr);
        let actionButtons = '';
        if (isOldInvoice) {
            actionButtons = `<button class="btn outline small" style="color:var(--danger); border-color:var(--danger); margin-right:5px;" onclick="unlockAndEdit('${item.id}', this)" data-item="${esc(item.item)}" data-qty="${item.qty || 1}" data-price="${item.price || 0}" data-discount="${item.discount || 0}" data-status="${esc(item.status)}"><i class='bx bx-lock-open-alt'></i></button><button class="btn outline small" style="color:var(--danger); border-color:var(--danger);" onclick="unlockAndDelete('${item.id}')"><i class='bx bx-trash'></i></button>`;
        } else {
            actionButtons = `<button class="btn outline small" data-id="${item.id}" data-item="${esc(item.item)}" data-qty="${item.qty || 1}" data-price="${item.price || 0}" data-discount="${item.discount || 0}" data-status="${esc(item.status)}" onclick="handleEditBtn(this)" style="margin-right:5px;"><i class='bx bx-edit'></i></button><button class="btn outline small" data-id="${item.id}" onclick="deleteSaleEntry('${item.id}')"><i class='bx bx-trash'></i></button>`;
        }

        html += `<tr><td>${esc(item.item)}</td><td class="text-center">${item.qty}</td><td class="text-right">${money(item.price)}</td><td class="text-right">${money(item.discount || 0)}</td><td class="text-right"><b style="color:var(--text);">${money(itemTotal)}</b></td><td class="text-center" style="white-space: nowrap;">${actionButtons}</td></tr>`;
    });
    
    let debt = grandTotal - paidTotal;
    document.getElementById('detailGrandTotal').innerText = money(grandTotal);
    document.getElementById('detailPaid').innerText = money(paidTotal);
    document.getElementById('detailDebt').innerText = money(debt);
    
    let badge = debt > 0 ? `<span class="status-badge" style="background:rgba(239,68,68,0.1); color:#ef4444;">ជំពាក់</span>` : `<span class="status-badge success">ទូទាត់រួច</span>`;
    document.getElementById('detailStatus').innerHTML = badge;
    document.getElementById('detailItemsTable').innerHTML = html;
    openModal('invoiceDetailModal');
};
window.reprintCurrentInvoice = function() {
    let invNo = document.getElementById('detailInvNo').innerText;
    let items = salesData.filter(s => getInvoiceNo(s) === invNo);
    if(items.length === 0) return;
    
    let first = items[0];
    let grandTotal = 0; let paidTotal = 0; let printItemsHtml = '';
    
    items.forEach(item => {
        let rowTotal = parseFloat(item.total || 0);
        grandTotal += rowTotal;
        let isPaid = cleanStatus(item.status).toLowerCase() === 'paid';
        paidTotal += isPaid ? rowTotal : parseFloat(item.paid_amount || 0);
        
        let unitDisplay = item.unit ? ` (${item.unit})` : '';
        printItemsHtml += `<tr style="border-bottom: 1px dotted #ccc;">
            <td style="padding: 2px 1px; width: 45%;">${esc(item.item)}${unitDisplay}</td>
            <td style="padding: 2px 1px; width: 15%; text-align: center;">${item.qty}</td>
            <td style="padding: 2px 1px; width: 20%; text-align: right;">${money(item.price)}</td>
            <td style="padding: 2px 1px; width: 20%; text-align: right;">${money(rowTotal)}</td>
        </tr>`;
    });
    
    let debt = grandTotal - paidTotal;
    let statusText = debt > 0 ? 'Unpaid / ជំពាក់' : 'Paid / ទូទាត់រួច';
    
    let printContent = `
    <html><head><title>Reprint Invoice</title>
    <link href="https://fonts.googleapis.com/css2?family=Kantumruy+Pro:wght@400;600&display=swap" rel="stylesheet">
    <style>
        @page { margin: 0; size: 80mm auto; }
        body { font-family: 'Kantumruy Pro', sans-serif; font-size: 11px; padding: 2mm; width: 76mm; color: #000; background: white; }
        table { width: 100%; border-collapse: collapse; table-layout: fixed; }
        td, th { word-wrap: break-word; font-size: 10px; color: #000; }
        .border-bottom { border-bottom: 1px dashed #000; padding-bottom: 5px; margin-bottom: 5px; }
    </style>
    </head><body>
        <div style="text-align: center;" class="border-bottom">
            <h1 style="margin: 0; font-size: 16px;">ស្រែមាស ចំការលើ</h1>
            <p style="margin: 2px 0 0; font-size: 10px;">អាសយដ្ឋាន: ចំការលើ, កំពង់ចាម<br>ទូរស័ព្ទ: 088 433 7888</p>
            <h2 style="margin: 5px 0 0; font-size: 14px;">វិក្កយបត្រ (INVOICE) - ថតចម្លង</h2>
            <p style="margin: 2px 0; font-size: 10px;">កាលបរិច្ឆេទ: ${first.date || '-'}</p>
            <p style="margin: 2px 0; font-size: 10px;">លេខ: <b>${invNo}</b></p>
        </div>
        <div class="border-bottom" style="font-size: 10px;">
            អតិថិជន: <b>${esc(first.customer_name || 'Walk-in')}</b><br>
            ទូរស័ព្ទ: ${esc(first.phone || '-')}<br>
            ស្ថានភាព: <b>${statusText}</b>
        </div>
        <table style="margin-bottom: 5px;">
            <thead style="border-bottom: 1px dashed #000;">
                <tr><th style="text-align:left;">មុខទំនិញ</th><th>ចំនួន</th><th style="text-align:right;">តម្លៃ</th><th style="text-align:right;">សរុប</th></tr>
            </thead>
            <tbody>${printItemsHtml}</tbody>
        </table>
        <div style="border-top: 1px dashed #000; padding-top: 5px; text-align:right; font-size: 12px;">
            សរុបទឹកប្រាក់: <b>${money(grandTotal)}</b>
        </div>
        <div style="text-align: center; margin-top: 15px; font-weight: bold; border-top: 1px dashed #000; padding-top: 10px;">
            🙏 សូមអរគុណសម្រាប់ការគាំទ្រ!
        </div>
    </body></html>`;

    let printWindow = window.open('', '', 'width=400,height=600');
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 500);
};

window.copyHistoricalInvoiceToTelegram = function() {
    let invNo = document.getElementById('detailInvNo').innerText;
    let items = salesData.filter(s => getInvoiceNo(s) === invNo);
    if(items.length === 0) return;
    
    let first = items[0];
    let cName = first.customer_name || first['customer-name'] || 'Walk-in';
    let dateVal = first.date || '-';
    
    let text = `📝 វិក្កយបត្រ (INVOICE)\n📅 ថ្ងៃទី: ${dateVal}\n🧾 លេខវិក្កយបត្រ: ${invNo}\n👤 អតិថិជន: ${cName}\n------------------------\n`;
    
    let grandTotal = 0; let paidTotal = 0; let totalDiscount = 0;
    
    items.forEach(item => {
        let rowTotal = parseFloat(item.total || 0);
        grandTotal += rowTotal;
        totalDiscount += parseFloat(item.discount || 0);
        
        let isPaid = cleanStatus(item.status).toLowerCase() === 'paid';
        paidTotal += isPaid ? rowTotal : parseFloat(item.paid_amount || 0);
        
        let qty = item.qty || 1;
        let price = item.price || 0;
        let unitDisplay = item.unit ? ` (${item.unit})` : '';
        text += `🔹 ${item.item}${unitDisplay} (${qty} x ${price}៛) = ${money(rowTotal)}\n`;
    });
    
    text += `------------------------\n`;
    if (totalDiscount > 0) { text += `🔻 បញ្ចុះតម្លៃសរុប: ${money(totalDiscount)}\n`; }
    text += `💰 សរុបទឹកប្រាក់: ${money(grandTotal)}\n`;
    
    let debt = grandTotal - paidTotal;
    if (debt > 0) {
        text += `💵 បានទូទាត់សង: ${money(paidTotal)}\n`;
        text += `⚠️ នៅខ្វះ/ជំពាក់: ${money(debt)}\n`;
    } else {
        text += `✅ ស្ថានភាព: បានទូទាត់រួចរាល់\n`;
    }
    
    text += `\n🙏 សូមអរគុណសម្រាប់ការគាំទ្រហាងយើងខ្ញុំ!`;

    if(navigator.clipboard && window.isSecureContext) { 
        navigator.clipboard.writeText(text).then(() => showToast("បានចម្លងវិក្កយបត្រចាស់ចូល Telegram ជោគជ័យ!", "success"));
    } else { prompt("Copy សារវិក្កយបត្រខាងក្រោម៖", text); }
};

window.exportToCSV = function() { 
    if(!salesData || salesData.length===0){showToast("គ្មានទិន្នន័យ","error");return;} 
    let csvContent="data:text/csv;charset=utf-8,\uFEFF"; 
    csvContent+="វិក្កយបត្រ,ថ្ងៃទី,អតិថិជន,មុខទំនិញ,ចំនួន,តម្លៃ/ឯកតា,បញ្ចុះតម្លៃ,សរុបទឹកប្រាក់,ស្ថានភាព\r\n"; 
    
    salesData.forEach(row=>{ 
        let inv = getInvoiceNo(row);
        let arr=[inv,row.date||"",row.customer_name||row['customer-name']||"Walk-in",row.item||"",row.qty||0,row.price||0,row.discount||row.Discount||0,row.total||row.Total||0,cleanStatus(row.status)]; 
        let rowStr=arr.map(e=>`"${String(e).replace(/"/g,'""')}"`).join(","); 
        csvContent+=rowStr+"\r\n"; 
    }); 
    
    const encodedUri=encodeURI(csvContent); 
    const link=document.createElement("a"); 
    link.setAttribute("href",encodedUri); 
    link.setAttribute("download",`Sales_Report_${new Date().toISOString().slice(0,10)}.csv`); 
    document.body.appendChild(link); 
    link.click(); 
    document.body.removeChild(link); 
};

window.handleEditBtn = function(btn) { openEditSale(btn.getAttribute('data-id'), btn.getAttribute('data-item'), btn.getAttribute('data-qty'), btn.getAttribute('data-price'), btn.getAttribute('data-discount'), btn.getAttribute('data-status')); };
window.openEditSale = function(id, item, qty, price, discount, status) { document.getElementById('editSaleId').value = id; document.getElementById('editSaleItem').value = item; document.getElementById('editSaleQty').value = qty || 1; document.getElementById('editSalePrice').value = price || 0; document.getElementById('editSaleDiscount').value = discount || 0; if(document.getElementById('editPaymentStatus')) document.getElementById('editPaymentStatus').value = cleanStatus(status); calculateEditTotal(); openModal('editSaleModal'); }
window.saveEditedSale = async function() { 
    let id = document.getElementById('editSaleId').value; 
    let item = salesData.find(s => String(s.id) === String(id));
    let todayStr = new Date().toISOString().slice(0, 10);
    
    if(item && item.date && item.date < todayStr) {
        if (window.unlockedInvoiceId !== String(id)) {
            showToast("ប្រព័ន្ធបានចាក់សោរ! វិក្កយបត្រចាស់មិនអាចកែប្រែបានទេ!", "error");
            return;
        }
    }
    window.unlockedInvoiceId = null; 

    let qty = parseFloat(document.getElementById('editSaleQty').value) || 0; 
    let price = parseFloat(document.getElementById('editSalePrice').value) || 0; 
    let discount = parseFloat(document.getElementById('editSaleDiscount').value) || 0; 
    let statusVal = document.getElementById('editPaymentStatus') ? document.getElementById('editPaymentStatus').value : 'Paid'; 
    let total = Math.max(0, (qty * price) - discount); 
    const { error } = await db.from(TABLE_SALES).update({ qty: qty, price: price, discount: discount, total: total, status: statusVal }).eq('id', id); 
    if(error) { showToast("កែប្រែបរាជ័យ!", "error"); } else { showToast("កែប្រែជោគជ័យ!", "success"); closeModal('editSaleModal'); await refreshAllData(); } 
}

window.calculateEditTotal = function() { let qty = parseFloat(document.getElementById('editSaleQty').value) || 0; let price = parseFloat(document.getElementById('editSalePrice').value) || 0; let discount = parseFloat(document.getElementById('editSaleDiscount').value) || 0; document.getElementById('editSaleTotal').value = money(Math.max(0, (qty * price) - discount)); }

window.deleteSaleEntry = async function(id) { 
    let item = salesData.find(s => String(s.id) === String(id));
    let todayStr = new Date().toISOString().slice(0, 10);
    
    if(item && item.date && item.date < todayStr) {
        if (window.unlockedInvoiceId !== String(id)) {
            showToast("ប្រព័ន្ធបានចាក់សោរ! វិក្កយបត្រចាស់មិនអាចលុបបានទេ!", "error");
            return;
        }
    }
    window.unlockedInvoiceId = null;

    if(confirm("តើអ្នកពិតជាចង់លុបទិន្នន័យនេះមែនទេ?")) { 
        const { error } = await db.from(TABLE_SALES).delete().eq('id', id); 
        if(error) { showToast("លុបបរាជ័យ!", "error"); } else { showToast("លុបជោគជ័យ!", "success"); await refreshAllData(); } 
    } 
}

window.unlockAndEdit = function(id, btn) {
    let pass = prompt("🔒 សូមបញ្ចូលលេខកូដថៅកែ (PIN) ដើម្បីដោះសោរកែប្រែ៖");
    if(pass === ADMIN_PIN) {
        window.unlockedInvoiceId = String(id); 
        openEditSale(id, btn.getAttribute('data-item'), btn.getAttribute('data-qty'), btn.getAttribute('data-price'), btn.getAttribute('data-discount'), btn.getAttribute('data-status'));
    } else if(pass !== null) { showToast("លេខកូដមិនត្រឹមត្រូវទេ!", "error"); }
};

window.unlockAndDelete = function(id) {
    let pass = prompt("🔒 សូមបញ្ចូលលេខកូដថៅកែ (PIN) ដើម្បីដោះសោរលុប៖");
    if(pass === ADMIN_PIN) {
        window.unlockedInvoiceId = String(id); 
        deleteSaleEntry(id);
    } else if(pass !== null) { showToast("លេខកូដមិនត្រឹមត្រូវទេ!", "error"); }
};

// ==========================================
// 🌟 មុខងារគ្រប់គ្រងចំណាយ (Expenses) 🌟
// ==========================================
async function loadExpenses() {
    const { data, error } = await db.from(TABLE_EXPENSES).select('*').order('date', { ascending: false });
    if (!error) {
        expensesData = data;
        renderExpenses();
    } else {
        console.log("សូមបង្កើត Table 'expenses' នៅក្នុង Supabase ជាមុនសិន។", error);
    }
}

function getFilteredExpenses() {
    let startDate = document.getElementById('expenseStartDate');
    let endDate = document.getElementById('expenseEndDate');
    
    let today = new Date();
    let start = startDate && startDate.value ? new Date(startDate.value) : new Date(today.getFullYear(), today.getMonth(), 1);
    start.setHours(0,0,0,0);
    let end = endDate && endDate.value ? new Date(endDate.value) : new Date(today.getFullYear(), today.getMonth() + 1, 0);
    end.setHours(23,59,59,999);

    if(startDate && !startDate.value) startDate.value = formatDateForInput(start);
    if(endDate && !endDate.value) endDate.value = formatDateForInput(end);

    return {
        start: start,
        end: end,
        data: expensesData.filter(exp => {
            if(!exp.date) return false;
            let d = new Date(exp.date);
            return d >= start && d <= end;
        }).sort((a,b) => new Date(b.date) - new Date(a.date)) 
    };
}

let expenseChartInstance = null;

window.renderExpenses = function() {
    let tbody = document.getElementById('expenseTableBody');
    if (!tbody) return;
    
    let filterObj = getFilteredExpenses();
    let periodExps = filterObj.data;
    
    let html = '';
    let totalExp = 0;
    let totalRevPeriod = 0;
    
    if(salesData) {
        salesData.forEach(row => {
            if(row.date) {
                let d = new Date(row.date);
                if(d >= filterObj.start && d <= filterObj.end) {
                    totalRevPeriod += parseFloat(row.total || row.Total || 0);
                }
            }
        });
    }

    let catExpSummary = {}; 

    periodExps.forEach(exp => {
        let amt = parseFloat(exp.amount || 0);
        totalExp += amt;
        catExpSummary[exp.category] = (catExpSummary[exp.category] || 0) + amt;
        
        let catBadge = `<span class="status-badge" style="background:#f1f5f9; color:#475569;">${esc(exp.category)}</span>`;
        if (exp.category === 'សាំង/ធ្វើដំណើរ') catBadge = `<span class="status-badge" style="background:#fee2e2; color:#ef4444;"><i class='bx bx-gas-pump'></i> ${esc(exp.category)}</span>`;
        else if (exp.category === 'ថ្លៃឈ្នួលដឹកជញ្ជូន') catBadge = `<span class="status-badge" style="background:#e0e7ff; color:#4f46e5;"><i class='bx bx-bus'></i> ${esc(exp.category)}</span>`;
        else if (exp.category === 'កាហ្វេ/អាហារភ្ញៀវ') catBadge = `<span class="status-badge" style="background:#fef3c7; color:#d97706;"><i class='bx bx-coffee'></i> ${esc(exp.category)}</span>`;
        else if (exp.category === 'ចុះទីផ្សារ/ប្រូម៉ូសិន') catBadge = `<span class="status-badge" style="background:#fce7f3; color:#db2777;"><i class='bx bx-target-lock'></i> ${esc(exp.category)}</span>`;
        else if (exp.category === 'បញ្ចុះតម្លៃពិសេសម៉ូយ') catBadge = `<span class="status-badge" style="background:#dcfce7; color:#16a34a;"><i class='bx bx-gift'></i> ${esc(exp.category)}</span>`;
        else if (exp.category === 'កាតទូរស័ព្ទ/អ៊ីនធឺណិត') catBadge = `<span class="status-badge" style="background:#ede9fe; color:#7c3aed;"><i class='bx bx-wifi'></i> ${esc(exp.category)}</span>`;
        
        let refDisplay = '';
        let cleanNote = exp.note || '';
        let refMatch = cleanNote.match(/^\[Ref:(.+?)\]\s*/);
        if(refMatch) {
            refDisplay = `<span class="muted block" style="font-size: 11px;"><i class='bx bx-receipt'></i> Ref: <b>${esc(refMatch[1])}</b></span>`;
            cleanNote = cleanNote.replace(refMatch[0], ''); 
        }
        
        let spenderDisplay = exp.spender ? `<b style="color:var(--text); font-size:13px;">${esc(exp.spender)}</b>` : `<span class="muted">-</span>`;

        html += `<tr>
            <td>${exp.date || '-'}</td>
            <td>${spenderDisplay}</td>
            <td>${catBadge}</td>
            <td>${refDisplay}${esc(cleanNote)}</td>
            <td class="text-right"><b style="color:var(--danger);">${money(exp.amount)}</b></td>
            <td class="text-center" style="white-space: nowrap;">
                <button class="btn outline small" style="border-color:#f59e0b; color:#f59e0b; margin-right:5px;" onclick="openEditExpense('${exp.id}')" title="កែប្រែ"><i class='bx bx-edit'></i></button>
                <button class="btn outline small" style="border-color:var(--danger); color:var(--danger);" onclick="deleteExpense('${exp.id}')" title="លុប"><i class='bx bx-trash'></i></button>
            </td>
        </tr>`;
    });
    
    tbody.innerHTML = html || '<tr><td colspan="6" class="text-center muted pt-4 pb-4">មិនមានទិន្នន័យចំណាយក្នុងថ្ងៃដែលបានជ្រើសរើសទេ</td></tr>';
    
    if(document.getElementById('totalExpenseAmount')) document.getElementById('totalExpenseAmount').innerText = money(totalExp);
    if(document.getElementById('expDashRevenue')) document.getElementById('expDashRevenue').innerText = money(totalRevPeriod);
    if(document.getElementById('expDashExpense')) document.getElementById('expDashExpense').innerText = money(totalExp);
    
    if(document.getElementById('expenseProgressBar')) {
        let ratio = 0;
        if(totalRevPeriod > 0) { ratio = (totalExp / totalRevPeriod) * 100; }
        let barColor = 'var(--success)';
        if(ratio > 30) barColor = 'var(--warning)';
        if(ratio > 50) barColor = 'var(--danger)'; 
        
        document.getElementById('expenseProgressBar').style.width = Math.min(ratio, 100) + '%';
        document.getElementById('expenseProgressBar').style.background = barColor;
        document.getElementById('expenseRatioText').innerHTML = `ចាយអស់ <b style="color:${barColor}; font-size:16px;">${ratio.toFixed(1)}%</b> នៃចំណូល`;
    }

    const ctxExp = document.getElementById('expensePieChart');
    if(ctxExp) {
        if(expenseChartInstance) expenseChartInstance.destroy();
        expenseChartInstance = new Chart(ctxExp, {
            type: 'pie',
            data: {
                labels: Object.keys(catExpSummary).length > 0 ? Object.keys(catExpSummary) : ['គ្មានទិន្នន័យ'],
                datasets: [{
                    data: Object.values(catExpSummary).length > 0 ? Object.values(catExpSummary) : [1],
                    backgroundColor: ['#ef4444', '#4f46e5', '#d97706', '#db2777', '#16a34a', '#7c3aed', '#64748b']
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { boxWidth: 12, font: { size: 11 } } } } }
        });
    }
};

window.saveNewExpense = async function() {
    let dateStr = document.getElementById('expDate').value || new Date().toISOString().slice(0,10);
    let cat = document.getElementById('expCategory').value;
    let amt = parseFloat(document.getElementById('expAmount').value) || 0;
    let rawNote = document.getElementById('expNote').value.trim();
    let refNum = document.getElementById('expRef').value.trim();
    let spender = document.getElementById('expSpender') ? document.getElementById('expSpender').value.trim() : '';
    
    if(amt <= 0) { showToast("សូមបញ្ចូលទឹកប្រាក់ឱ្យបានត្រឹមត្រូវ!", "error"); return; }
    
    let finalNote = rawNote;
    if(refNum !== '') { finalNote = `[Ref:${refNum}] ${rawNote}`; }
    
    let btn = document.querySelector('#expenseModal .btn.primary');
    let oldTxt = btn.innerHTML; btn.innerHTML = "រក្សាទុក..."; btn.disabled = true;

    const { error } = await db.from(TABLE_EXPENSES).insert([{ date: dateStr, category: cat, amount: amt, note: finalNote, spender: spender }]);
    btn.innerHTML = oldTxt; btn.disabled = false;

    if(!error) {
        showToast("រក្សាទុកចំណាយជោគជ័យ!", "success");
        // 🌟 ផ្ញើរបាយការណ៍ចំណាយចូល Telegram
        sendToTelegram('', 'expense', { category: cat, spender: spender, amount: amt, note: finalNote });
        closeModal('expenseModal');
        document.getElementById('expAmount').value = '';
        document.getElementById('expNote').value = '';
        document.getElementById('expRef').value = '';
        if(document.getElementById('expSpender')) document.getElementById('expSpender').value = '';
        await loadExpenses();
        loadDashboard(); 
    } else { showToast("បរាជ័យ សូមពិនិត្យ Database", "error"); console.error(error); }
};

window.openEditExpense = function(id) {
    let exp = expensesData.find(e => String(e.id) === String(id));
    if(!exp) return;
    
    document.getElementById('editExpId').value = exp.id;
    document.getElementById('editExpDate').value = exp.date;
    document.getElementById('editExpCategory').value = exp.category;
    document.getElementById('editExpAmount').value = exp.amount;
    if(document.getElementById('editExpSpender')) document.getElementById('editExpSpender').value = exp.spender || '';
    
    let rawNote = exp.note || '';
    let refNum = '';
    let refMatch = rawNote.match(/^\[Ref:(.+?)\]\s*/);
    if(refMatch) {
        refNum = refMatch[1];
        rawNote = rawNote.replace(refMatch[0], '');
    }
    if(document.getElementById('editExpRef')) document.getElementById('editExpRef').value = refNum;
    if(document.getElementById('editExpNote')) document.getElementById('editExpNote').value = rawNote;
    
    openModal('editExpenseModal');
};

window.saveEditedExpense = async function() {
    let id = document.getElementById('editExpId').value;
    let dateStr = document.getElementById('editExpDate').value;
    let cat = document.getElementById('editExpCategory').value;
    let amt = parseFloat(document.getElementById('editExpAmount').value) || 0;
    let rawNote = document.getElementById('editExpNote') ? document.getElementById('editExpNote').value.trim() : '';
    let refNum = document.getElementById('editExpRef') ? document.getElementById('editExpRef').value.trim() : '';
    let spender = document.getElementById('editExpSpender') ? document.getElementById('editExpSpender').value.trim() : '';
    
    if(amt <= 0) { showToast("សូមបញ្ចូលទឹកប្រាក់ឱ្យបានត្រឹមត្រូវ!", "error"); return; }
    
    let finalNote = rawNote;
    if(refNum !== '') { finalNote = `[Ref:${refNum}] ${rawNote}`; }
    
    let btn = document.querySelector('#editExpenseModal .btn.primary');
    let oldTxt = btn.innerHTML; btn.innerHTML = "កំពុងរក្សាទុក..."; btn.disabled = true;

    const { error } = await db.from(TABLE_EXPENSES).update({ date: dateStr, category: cat, amount: amt, note: finalNote, spender: spender }).eq('id', id);
    btn.innerHTML = oldTxt; btn.disabled = false;
    
    if(!error) {
        showToast("កែប្រែចំណាយជោគជ័យ!", "success");
        closeModal('editExpenseModal');
        await loadExpenses();
        loadDashboard(); 
    } else { showToast("បរាជ័យក្នុងការកែប្រែ!", "error"); console.error(error); }
};

window.deleteExpense = async function(id) {
    if(confirm("តើអ្នកពិតជាចង់លុបទិន្នន័យចំណាយនេះមែនទេ?")) {
        const { error } = await db.from(TABLE_EXPENSES).delete().eq('id', id);
        if(!error) { showToast("លុបជោគជ័យ!", "success"); await loadExpenses(); }
    }
};

window.copyExpenseReport = function() {
    let filterObj = getFilteredExpenses();
    let periodExps = filterObj.data.sort((a,b) => new Date(a.date) - new Date(b.date)); 

    if(periodExps.length === 0) { showToast("គ្មានចំណាយក្នុងចន្លោះពេលនេះទេ!", "error"); return; }

    let catSum = {};
    let total = 0;
    let datesWorked = new Set();

    periodExps.forEach(exp => {
        let amt = parseFloat(exp.amount || 0);
        catSum[exp.category] = (catSum[exp.category] || 0) + amt;
        total += amt;
        datesWorked.add(exp.date);
    });

    let datesArr = [...datesWorked];
    let firstDate = datesArr[0];
    let lastDate = datesArr[datesArr.length - 1];

    let startInput = document.getElementById('expenseStartDate') ? document.getElementById('expenseStartDate').value : "-";
    let endInput = document.getElementById('expenseEndDate') ? document.getElementById('expenseEndDate').value : "-";

    let text = `📋 របាយការណ៍ចំណាយបេសកកម្ម\n📅 ថ្ងៃទី: ${startInput} ដល់ ${endInput}\n`;
    text += `------------------------------------\n`;
    text += `កាលបរិច្ឆេទសរុប: ${datesArr.length} ថ្ងៃ\n`;
    text += `⏱ (ពីថ្ងៃ ${firstDate} ដល់ ${lastDate})\n\n`;
    
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
    let filterObj = getFilteredExpenses();
    let periodExps = filterObj.data;

    if(periodExps.length === 0) { showToast("គ្មានទិន្នន័យទេ","error"); return; } 
    
    let csvContent="data:text/csv;charset=utf-8,\uFEFF"; 
    csvContent+="កាលបរិច្ឆេទ,អ្នកចំណាយ,ប្រភេទចំណាយ,កំណត់សម្គាល់,ទឹកប្រាក់\r\n"; 

    periodExps.forEach(row=>{ 
        let cleanNote = row.note ? row.note.replace(/^\[Ref:(.+?)\]\s*/, '') : '';
        let arr=[row.date||"", row.spender||"", row.category||"", cleanNote, row.amount||0]; 
        let rowStr=arr.map(e=>`"${String(e).replace(/"/g,'""')}"`).join(","); 
        csvContent+=rowStr+"\r\n"; 
    }); 
    
    const encodedUri=encodeURI(csvContent); 
    const link=document.createElement("a"); 
    link.setAttribute("href",encodedUri); 
    
    let startInput = document.getElementById('expenseStartDate') ? document.getElementById('expenseStartDate').value : 'start';
    let endInput = document.getElementById('expenseEndDate') ? document.getElementById('expenseEndDate').value : 'end';
    
    link.setAttribute("download",`Expense_Report_${startInput}_to_${endInput}.csv`); 
    document.body.appendChild(link); 
    link.click(); 
    document.body.removeChild(link); 
};


// ==========================================
// 🌟 មុខងារ Dashboard & Reports 🌟
// ==========================================
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

  let currentQuarter = Math.floor(currentMonth / 3); 
  let currentYearSalesTotal = 0;
  let yearlyBonusTotal = 0;
  let quarterBonusTotal = 0;

  salesData.forEach(row => {
      let rowTotal = parseFloat(row.total || row.Total || 0); 
      let rowQty = parseFloat(row.qty || 1);
      
      if(row.date) {
          let d = new Date(row.date);
          if(d.getFullYear() === currentYear) {
              currentYearSalesTotal += rowTotal;
              
              let historicalBasePrice = parseFloat(row.base_price) > 0 ? parseFloat(row.base_price) : (parseFloat(row.price) || 0);
              let rowCost = historicalBasePrice * rowQty;
              let rowProfit = rowTotal - rowCost;
              let rowBonus = rowProfit > 0 ? rowProfit * 0.40 : 0;
              
              yearlyBonusTotal += rowBonus;

              if (Math.floor(d.getMonth() / 3) === currentQuarter) {
                  quarterBonusTotal += rowBonus;
              }
          }
      }
  });

  let currentYearExpenses = 0;
  expensesData.forEach(exp => {
      if(exp.date && new Date(exp.date).getFullYear() === currentYear) {
          currentYearExpenses += parseFloat(exp.amount || 0);
      }
  });

  let yearlyTarget = parseFloat(localStorage.getItem('salesTarget_' + currentYear)) || 0; 
  let targetProgress = 0;
  if (yearlyTarget > 0) {
      targetProgress = (currentYearSalesTotal / yearlyTarget) * 100;
  }
  
  let netEarnings = yearlyBonusTotal - currentYearExpenses; 
  
  if(document.getElementById('targetProgressBar')) {
      document.getElementById('targetYearLabel').innerText = currentYear;
      document.getElementById('targetProgressBar').style.width = Math.min(targetProgress, 100) + '%';
      document.getElementById('targetPercentage').innerText = targetProgress.toFixed(1) + '%';
      
      if(document.getElementById('targetCurrentSales')) document.getElementById('targetCurrentSales').innerText = money(currentYearSalesTotal);
      
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

      if(document.getElementById('myCommission')) {
          document.getElementById('myCommission').innerHTML = `ត្រីមាសនេះ (Q${currentQuarter + 1}): <br><b style="font-size:18px; color:var(--success);">${money(quarterBonusTotal)}</b>`;
      }
      if(document.getElementById('dashboardExpenses')) document.getElementById('dashboardExpenses').innerText = money(currentYearExpenses);
      
      // 🌟 បង្ហាញចំណេញសុទ្ធមានទាំង រៀល និង ដុល្លារ
      if(document.getElementById('netEarnings')) {
          let storedRate = localStorage.getItem('exchangeRate');
          let exRate = (storedRate && !isNaN(storedRate) && parseFloat(storedRate) > 0) ? parseFloat(storedRate) : 4100;
          let netUsd = netEarnings / exRate;
          let sign = netEarnings < 0 ? "-" : "";
          let usdFormatted = `${sign}$${Math.abs(netUsd).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
          
          document.getElementById('netEarnings').innerHTML = `${money(netEarnings)} <span style="font-size: 13px; color: #f8fafc; font-weight: 500; margin-left: 4px;">(${usdFormatted})</span>`;
      }
  } // <-- ត្រូវប្រាកដថាមានសញ្ញា } នេះនៅទីនេះ ដើម្បីបិទលក្ខខណ្ឌខាងលើកុំឱ្យគាំង


  let followUpContainer = document.getElementById('followUpContainer');
  
  // 🌟 ទាញយកបញ្ជីនេះមកប្រកាសនៅខាងក្រៅសិន ដើម្បីកុំឱ្យប្រព័ន្ធកណ្តឹងលោត Error គាំង
  let dormantCustomers = [];
  let cusPhonesFromSales = {}; 

  if(followUpContainer) {
      let now = new Date();
      let cusLastDates = {};
      
      salesData.forEach(s => {
          let cName = (s.customer_name || s['customer-name'] || '').trim();
          if (cName !== '' && cName !== 'Walk-in' && s.date) {
              if (!cusLastDates[cName] || new Date(s.date) > new Date(cusLastDates[cName].date)) {
                  cusLastDates[cName] = { date: s.date, category: (s.agro_chemicals || 'ផ្សេងៗ').toLowerCase() };
              }
              if (s.phone && s.phone.trim() !== '' && s.phone.trim() !== '-') {
                  cusPhonesFromSales[cName] = s.phone.trim();
              }
          }
      });

      Object.keys(cusLastDates).forEach(cName => {
          let lastOrderInfo = cusLastDates[cName];
          let lastOrderDate = new Date(lastOrderInfo.date);
          let diffDays = Math.ceil(Math.abs(now - lastOrderDate) / (1000 * 60 * 60 * 24));
          let cat = lastOrderInfo.category;
          let threshold = 30;
          let reason = `បាត់មុខ ${diffDays} ថ្ងៃ`;
          let badgeStyle = `background:#fef3c7; color:#d97706;`;

          if (cat.includes('herbicide') || cat.includes('ស្មៅ')) { threshold = 15; reason = `ដល់ពេលដាក់ជី (${diffDays}ថ្ងៃ)`; badgeStyle = `background:#d1fae5; color:#10b981;`; }
          else if (cat.includes('fertilizer') || cat.includes('ជី')) { threshold = 20; reason = `តាមដានសត្វល្អិត (${diffDays}ថ្ងៃ)`; badgeStyle = `background:#e0e7ff; color:#4f46e5;`; }
          else if (cat.includes('insecticide') || cat.includes('fungicide') || cat.includes('សត្វល្អិត') || cat.includes('ផ្សិត')) { threshold = 15; reason = `សួរនាំលទ្ធផល (${diffDays}ថ្ងៃ)`; badgeStyle = `background:#fee2e2; color:#ef4444;`; }

          if(diffDays >= threshold) dormantCustomers.push({ name: cName, days: diffDays, lastDate: lastOrderInfo.date, reason: reason, badgeStyle: badgeStyle, urgency: diffDays - threshold });
      });
      
      let htmlFollowUp = '';
      dormantCustomers.sort((a,b) => b.urgency - a.urgency).slice(0, 8).forEach(c => {
          let custObj = customersData.find(cust => cust.name.trim().toLowerCase() === c.name.toLowerCase());
          let phoneInfo = custObj ? (custObj.phone || '').trim() : '';
          if (phoneInfo === '' || phoneInfo === '-') phoneInfo = cusPhonesFromSales[c.name] || '';
          let phoneDisplay = (phoneInfo !== '') ? phoneInfo : 'គ្មានលេខ';
          let callBtn = (phoneInfo !== '') ? `<a href="tel:${phoneInfo}" class="btn outline small" style="border-color:var(--success); color:var(--success); white-space: nowrap;"><i class='bx bx-phone-call'></i> ខល</a>` : `<button class="btn outline small" style="border-color:var(--line); color:var(--muted); background: rgba(0,0,0,0.02); cursor:not-allowed; white-space: nowrap;" disabled><i class='bx bx-phone-off'></i> អត់លេខ</button>`;

          htmlFollowUp += `<tr><td style="white-space: nowrap;"><b style="color: var(--text);">${esc(c.name)}</b><br><small class="muted">${phoneDisplay}</small></td><td class="text-center" style="white-space: nowrap;"><span class="status-badge" style="${c.badgeStyle} white-space: nowrap;">${c.reason}</span></td><td class="text-right" style="white-space: nowrap;">${callBtn}</td></tr>`;
      });
      followUpContainer.innerHTML = htmlFollowUp || '<tr><td colspan="3" class="text-center muted pt-4">មិនមានអតិថិជនត្រូវ Follow up ទេ</td></tr>';
  }

 let overdueDashContainer = document.getElementById('dashOverdueContainer');
  let overdueModalContainer = document.getElementById('overdueContainer'); 
  let notiFollowUpContainer = document.getElementById('notiFollowUpContainer');
  let notiBadge = document.getElementById('notificationBadge');
  
  let todayStr = new Date().toISOString().slice(0, 10);
  let overdueInvoices = salesData.filter(s => cleanStatus(s.status) === 'Unpaid' && s.due_date && s.due_date <= todayStr);
  let htmlOverdue = '';
  let debtCusCount = 0;
  
  if(overdueInvoices.length > 0) {
    let debtByCus = {};
    overdueInvoices.forEach(inv => {
        let cName = (inv.customer_name || 'អត់ឈ្មោះ').trim();
        let debt = parseFloat(inv.total || 0) - parseFloat(inv.paid_amount || 0);
        if(debt > 0) {
            if(!debtByCus[cName]) debtByCus[cName] = { amount: 0, phone: inv.phone, invNo: typeof getInvoiceNo === 'function' ? getInvoiceNo(inv) : `INV-${inv.id}` };
            debtByCus[cName].amount += debt;
        }
    });
    
    debtCusCount = Object.keys(debtByCus).length;

    Object.keys(debtByCus).forEach(cName => {
        let data = debtByCus[cName];
        let callBtn = data.phone ? `<a href="tel:${data.phone}" class="btn outline small" style="border-color:var(--success); color:var(--success); padding:4px 8px;"><i class='bx bx-phone-call'></i></a>` : `<span class="muted" style="font-size:11px;">អត់លេខ</span>`;
        htmlOverdue += `<tr>
            <td><b style="font-size:13px;">${esc(cName)}</b><br><small class="muted">${data.invNo}</small></td>
            <td class="text-right"><b style="color:var(--danger); font-size:14px;">${money(data.amount)}</b></td>
            <td class="text-center">${callBtn}</td>
        </tr>`;
    });
  }
  
  let emptyMsg = '<tr><td colspan="3" class="text-center muted pt-4 pb-4"><i class="bx bx-check-circle" style="font-size:30px; color:var(--success); display:block; margin-bottom:10px;"></i>គ្មានបំណុលហួសកំណត់ទេ</td></tr>';
  if (overdueDashContainer) overdueDashContainer.innerHTML = htmlOverdue || emptyMsg;
  if (overdueModalContainer) overdueModalContainer.innerHTML = htmlOverdue || emptyMsg;

  // 🌟 រុញទិន្នន័យ Follow-up ចូលទៅក្នុងកណ្តឹង
  if(notiFollowUpContainer) {
      let htmlFollowUpModal = '';
      dormantCustomers.sort((a,b) => b.urgency - a.urgency).forEach(c => {
          let custObj = customersData.find(cust => cust.name.trim().toLowerCase() === c.name.toLowerCase());
          let phoneInfo = custObj ? (custObj.phone || '').trim() : '';
          if (phoneInfo === '' || phoneInfo === '-') phoneInfo = cusPhonesFromSales[c.name] || '';
          let phoneDisplay = (phoneInfo !== '') ? phoneInfo : 'គ្មានលេខ';
          let callBtn = (phoneInfo !== '') ? `<a href="tel:${phoneInfo}" class="btn outline small" style="border-color:var(--success); color:var(--success); white-space: nowrap;"><i class='bx bx-phone-call'></i> ខល</a>` : `<span class="muted" style="font-size:11px;">អត់លេខ</span>`;

          htmlFollowUpModal += `<tr><td><b style="color: var(--text); font-size:13px;">${esc(c.name)}</b><br><small class="muted">${phoneDisplay}</small></td><td class="text-center"><span class="status-badge" style="${c.badgeStyle}">${c.reason}</span></td><td class="text-center">${callBtn}</td></tr>`;
      });
      notiFollowUpContainer.innerHTML = htmlFollowUpModal || '<tr><td colspan="3" class="text-center muted pt-4 pb-4">មិនមានអតិថិជនត្រូវ Follow up ទេ</td></tr>';
  }

  // 🌟 បូកសរុបចំនួនកណ្តឹង (ជំពាក់ + Follow-up)
  let totalNotiCount = debtCusCount + dormantCustomers.length;
  if(totalNotiCount > 0 && notiBadge) { 
      notiBadge.style.display = 'block'; 
      notiBadge.innerText = totalNotiCount; 
  } else if (notiBadge) { 
      notiBadge.style.display = 'none'; 
  }

  let chartStartDateEl = document.getElementById('chartStartDate');
  if(chartStartDateEl && !chartStartDateEl.value) window.applyGlobalFilter('thisMonth'); else window.updateChart();
}

let salesChartInstance = null;
window.updateChart = function() {
  const startDate = document.getElementById('chartStartDate') ? document.getElementById('chartStartDate').value : ''; 
  const endDate = document.getElementById('chartEndDate') ? document.getElementById('chartEndDate').value : '';
  let filteredData = salesData;
  let dateLabel = "ទិន្នន័យទាំងអស់";
  
  let start = startDate ? new Date(startDate) : new Date('1970-01-01'); start.setHours(0,0,0,0);
  let end = endDate ? new Date(endDate) : new Date('2100-01-01'); end.setHours(23,59,59,999);

  if (startDate || endDate) {
    filteredData = salesData.filter(item => { if (!item.date) return false; let itemDate = new Date(item.date); return itemDate >= start && itemDate <= end; });
    if(startDate && endDate) dateLabel = `${startDate} ដល់ ${endDate}`; else if(startDate) dateLabel = `ចាប់ពី ${startDate}`; else if(endDate) dateLabel = `រហូតដល់ ${endDate}`;
  }

  let totalSales = 0; let cashCollected = 0; let outstandingDebt = 0; 
  let unpaidCount = 0; let catRev = {}; let prodStats = {}; let cusCount = {}; 
  
  let groupedByDate = {};
  let bonusByDate = {}; 
  let expenseByDate = {}; 

  if (expensesData) {
      expensesData.forEach(exp => {
          if(exp.date) {
              let d = new Date(exp.date);
              if (d >= start && d <= end) {
                  expenseByDate[exp.date] = (expenseByDate[exp.date] || 0) + parseFloat(exp.amount || 0);
              }
          }
      });
  }

  filteredData.forEach(item => { 
      const dateStr = item.date || 'មិនស្គាល់'; 
      let rev = parseFloat(item.total || item.Total || 0);
      let paidAmt = cleanStatus(item.status) === 'Paid' ? rev : parseFloat(item.paid_amount || 0);
      let rowQty = parseFloat(item.qty || item.Qty || 1);
      let cusName = item.customer_name || item['customer-name'] || 'Walk-in';
      let categoryName = item.agro_chemicals || 'ផ្សេងៗ'; 
      
      totalSales += rev; 
      cashCollected += paidAmt;
      outstandingDebt += (rev - paidAmt);
      
      if(cleanStatus(item.status) === 'Unpaid') unpaidCount++; 
      
      let historicalBasePrice = parseFloat(item.base_price) > 0 ? parseFloat(item.base_price) : (parseFloat(item.price) || 0);
      let rowCost = historicalBasePrice * rowQty;
      let rowProfit = rev - rowCost;
      let rowBonus = rowProfit > 0 ? rowProfit * 0.40 : 0;

      groupedByDate[dateStr] = (groupedByDate[dateStr] || 0) + rev; 
      bonusByDate[dateStr] = (bonusByDate[dateStr] || 0) + rowBonus; 
      
      catRev[categoryName] = (catRev[categoryName] || 0) + rev;
      if(item.item) {
          if(!prodStats[item.item]) prodStats[item.item] = { qty: 0, revenue: 0 };
          prodStats[item.item].qty += rowQty;
          prodStats[item.item].revenue += rev; 
      }
      if(cusName !== 'Walk-in') cusCount[cusName] = (cusCount[cusName] || 0) + rev;
  });

  if(document.getElementById('dashSalesTotal')) document.getElementById('dashSalesTotal').innerText = money(totalSales);
  if(document.getElementById('dashCashCollected')) document.getElementById('dashCashCollected').innerText = money(cashCollected);
  if(document.getElementById('dashOutstanding')) document.getElementById('dashOutstanding').innerText = money(outstandingDebt);
  if(document.getElementById('dateRangeLabelSales')) document.getElementById('dateRangeLabelSales').innerHTML = `<i class='bx bx-calendar'></i> ${dateLabel}`;

  let sortedCus = Object.keys(cusCount).map(k => ({ name: k, spent: cusCount[k] })).sort((a,b) => b.spent - a.spent).slice(0, 5);
  let cContainer = document.getElementById('topCustomersContainer');
  if(cContainer) {
      let htmlC = '';
      sortedCus.forEach((c) => { 
        let initial = c.name.substring(0, 2).toUpperCase();
        let badge = '';
        if (c.spent >= 50000000) badge = `<span class="status-badge" style="background: linear-gradient(135deg, #f59e0b, #fbbf24); color: white; padding: 2px 6px; font-size: 9px;"><i class='bx bx-medal'></i> Gold</span>`;
        else if (c.spent >= 15000000) badge = `<span class="status-badge" style="background: linear-gradient(135deg, #94a3b8, #cbd5e1); color: white; padding: 2px 6px; font-size: 9px;"><i class='bx bx-medal'></i> Silver</span>`;
        htmlC += `<tr><td><div class="user-cell"><div class="user-icon" style="width:28px;height:28px;font-size:11px;">${esc(initial)}</div><b style="font-size: 13px;">${esc(c.name)}</b> ${badge}</div></td><td class="text-right" style="color:var(--success); font-weight:bold;">${money(c.spent)}</td></tr>`; 
      });
      cContainer.innerHTML = htmlC || '<tr><td colspan="2" class="text-center muted pt-4">គ្មានទិន្នន័យ</td></tr>';
  }

  let sortedProducts = Object.keys(prodStats).map(k => ({ name: k, qty: prodStats[k].qty, revenue: prodStats[k].revenue })).sort((a,b) => b.revenue - a.revenue).slice(0, 5);
  let pContainer = document.getElementById('topProductsContainer');
  if(pContainer) {
      let htmlP = '';
      sortedProducts.forEach((p, index) => { 
          htmlP += `<tr>
              <td><div class="user-cell"><div class="item-icon" style="background:rgba(245, 158, 11, 0.1); color:#f59e0b; width:24px; height:24px; font-size:12px; font-weight:bold;">${index + 1}</div><b style="font-size: 13px;">${esc(p.name)}</b></div></td>
              <td class="text-center"><b>${p.qty}</b></td>
              <td class="text-right"><b style="color:var(--success);">${money(p.revenue)}</b></td>
          </tr>`; 
      });
      pContainer.innerHTML = htmlP || '<tr><td colspan="3" class="text-center muted pt-4">គ្មានទិន្នន័យ</td></tr>';
  }

  let allDates = new Set([...Object.keys(groupedByDate), ...Object.keys(expenseByDate)]);
  const sortedDates = Array.from(allDates).sort((a,b) => new Date(a) - new Date(b));
  const chartValues = sortedDates.map(date => groupedByDate[date] || 0);
  const bonusValues = sortedDates.map(date => bonusByDate[date] || 0);
  const expenseValues = sortedDates.map(date => expenseByDate[date] || 0);

  const ctx = document.getElementById('salesChart'); 
  if(ctx) {
      if(salesChartInstance) salesChartInstance.destroy();
      const isDarkMode = document.body.classList.contains('dark-mode');
      const gridColor = isDarkMode ? '#334155' : '#e2e8f0'; const textColor = isDarkMode ? '#94a3b8' : '#64748b';
    
      salesChartInstance = new Chart(ctx, {
        type: 'line',
        data: { 
            labels: sortedDates.length > 0 ? sortedDates : ['គ្មានទិន្នន័យ'], 
            datasets: [
                { 
                    label: 'ចំណូលសរុប (៛)', 
                    data: chartValues.length > 0 ? chartValues : [0], 
                    borderColor: '#4f46e5', backgroundColor: 'rgba(79, 70, 229, 0.1)', borderWidth: 2, fill: true, tension: 0.3, pointBackgroundColor: '#4f46e5' 
                },
                { 
                    label: 'Bonus សាខា (៛)', 
                    data: bonusValues.length > 0 ? bonusValues : [0], 
                    borderColor: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.1)', borderWidth: 2, fill: true, tension: 0.3, pointBackgroundColor: '#10b981' 
                },
                { 
                    label: 'ចំណាយសរុប (៛)', 
                    data: expenseValues.length > 0 ? expenseValues : [0], 
                    borderColor: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.1)', borderWidth: 2, fill: true, tension: 0.3, pointBackgroundColor: '#ef4444' 
                }
            ] 
        },
        options: { 
            responsive: true, maintainAspectRatio: false, 
            plugins: { legend: { display: true, position: 'top', labels: { usePointStyle: true, boxWidth: 8 } } }, 
            scales: { y: { beginAtZero: true, grid: { color: gridColor }, ticks: { color: textColor, callback: value => Number(value).toLocaleString() + ' ៛' } }, x: { grid: { display: false }, ticks: { color: textColor } } } 
        }
      });
  }
  
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
};

window.applyGlobalFilter = function(type) {
    let startInput = document.getElementById('chartStartDate'); 
    let endInput = document.getElementById('chartEndDate');
    if(!startInput || !endInput) return;
    
    if(type === 'custom') return; 
    
    let today = new Date(); let start = new Date(); let end = new Date();
    
    if(type === 'thisMonth') { start = new Date(today.getFullYear(), today.getMonth(), 1); }
    else if(type === 'lastMonth') { start = new Date(today.getFullYear(), today.getMonth() - 1, 1); end = new Date(today.getFullYear(), today.getMonth(), 0); }
    else if(type === 'last3Months') { start = new Date(today.getFullYear(), today.getMonth() - 2, 1); }
    else if(type === 'thisYear') { start = new Date(today.getFullYear(), 0, 1); }
    else if(type === 'all') { startInput.value = ''; endInput.value = ''; updateChart(); return; }
    
    startInput.value = formatDateForInput(start); 
    endInput.value = formatDateForInput(end);
    updateChart();
};

window.handleCustomDate = function() {
    let quickFilter = document.getElementById('quickDateFilter');
    if(quickFilter) quickFilter.value = 'custom';
    updateChart();
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

window.openTargetModal = function() {
    let currentYear = new Date().getFullYear();
    document.getElementById('modalTargetYear').innerText = currentYear;
    
    let existingTargetRiel = parseFloat(localStorage.getItem('salesTarget_' + currentYear)) || 0;
    let isUSD = localStorage.getItem('salesTargetCurrency_' + currentYear) === 'USD';
    let exRate = parseFloat(localStorage.getItem('exchangeRate')) || 4100;
    
    if (isUSD && existingTargetRiel > 0) {
        document.getElementById('targetInputAmount').value = existingTargetRiel / exRate;
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
    let exRate = parseFloat(localStorage.getItem('exchangeRate')) || 4100;
    
    if (amount <= 0) { showToast("សូមបញ្ចូលទឹកប្រាក់គោលដៅ!", "error"); return; }

    let finalTargetRiel = amount;
    if (currency === 'USD') { finalTargetRiel = amount * exRate; }
    
    localStorage.setItem('salesTarget_' + currentYear, finalTargetRiel);
    localStorage.setItem('salesTargetCurrency_' + currentYear, currency);
    
    closeModal('targetModal');
    showToast("បានកំណត់គោលដៅប្រចាំឆ្នាំជោគជ័យ!", "success");
    loadDashboard(); 
};

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
    let grandTotalRevenue = 0;
    
    filteredData.forEach(row => {
        let cat = row.agro_chemicals || 'ផ្សេងៗ';
        if (cat === categoryName && row.item) {
            let rowQty = parseFloat(row.qty || row.Qty || 1);
            let rev = parseFloat(row.total || row.Total || 0);
            let stdValue = parseFloat(row.standard_unit_value || 0);
            let stdMeasure = (row.standard_unit_measure || '').trim();
            let dateStr = row.date || '';
            let pkg = (row.package_type || '').trim();
            
            if (!pkg && row.unit) {
                let u = row.unit.toLowerCase();
                if (u.includes('btl') || u.includes('bottle')) pkg = 'Bottle';
                else if (u.includes('pack') || u.includes('pc')) pkg = 'Pack';
                else if (u.includes('bag')) pkg = 'Bag';
                else if (u.includes('can')) pkg = 'Can';
            }
            
            let unitDisplay = row.unit ? ` (${row.unit})` : '';
            let itemName = row.item + unitDisplay; 
            let totalStdValue = rowQty * stdValue;

            if (!prodCountInCategory[itemName]) {
                prodCountInCategory[itemName] = { stdTotal: 0, stdMeasure: stdMeasure, sortQty: 0, revenue: 0, lastDate: '', pkg: pkg };
            }
            
            prodCountInCategory[itemName].sortQty += rowQty; 
            prodCountInCategory[itemName].revenue += rev;
            grandTotalRevenue += rev;
            
            if (dateStr) {
                if (!prodCountInCategory[itemName].lastDate || new Date(dateStr) > new Date(prodCountInCategory[itemName].lastDate)) {
                    prodCountInCategory[itemName].lastDate = dateStr;
                }
            }

            if(stdValue > 0 && stdMeasure !== '') {
                prodCountInCategory[itemName].stdTotal += totalStdValue;
                prodCountInCategory[itemName].stdMeasure = stdMeasure;
                grandTotalByMeasure[stdMeasure] = (grandTotalByMeasure[stdMeasure] || 0) + totalStdValue;
            } else {
                prodCountInCategory[itemName].stdTotal += rowQty;
                prodCountInCategory[itemName].stdMeasure = 'ឯកតា';
                grandTotalByMeasure['ឯកតា'] = (grandTotalByMeasure['ឯកតា'] || 0) + rowQty;
            }
        }
    });

    let sortedProds = Object.keys(prodCountInCategory)
        .map(k => ({ name: k, ...prodCountInCategory[k] }))
        .sort((a,b) => b.sortQty - a.sortQty);

    let maxQty = sortedProds.length > 0 ? sortedProds[0].sortQty : 0;

    let tbody = document.getElementById('categoryDetailTableBody');
    let html = '';
    
    sortedProds.forEach((p, index) => {
        let stdDisplay = '';
        if (p.stdTotal > 0 && p.stdMeasure !== 'ឯកតា') {
            stdDisplay = `<small style="color: var(--primary); font-size: 12px; margin-left: 5px; font-weight: 500;">(ស្មើនឹង ${p.stdTotal.toLocaleString('en-US', {maximumFractionDigits: 2})} ${p.stdMeasure})</small>`;
        }
        
        let pkgDisplay = p.pkg ? `<span style="font-size: 13px; color: var(--muted); font-weight: 500; margin-left: 4px;">${esc(p.pkg)}</span>` : '';
        
        let percent = maxQty > 0 ? (p.sortQty / maxQty) * 100 : 0;
        let dateDisplay = p.lastDate ? `<small style="color: var(--warning); display: block; margin-top: 4px;"><i class='bx bx-time'></i> លក់ចុងក្រោយ: ${p.lastDate}</small>` : `<small class="muted block">មិនទាន់មានទិន្នន័យ</small>`;

        html += `<tr style="border-bottom: 1px solid var(--line);">
            <td style="padding: 12px 10px; width: 45%;">
                <b style="font-size: 13px; color: var(--text);">${esc(p.name)}</b>
                ${dateDisplay}
            </td>
            <td class="text-right" style="padding: 12px 10px; width: 30%;">
                <div style="display: flex; justify-content: flex-end; align-items: baseline;">
                    <b style="color:var(--success); font-size:16px;">${p.sortQty}</b>${pkgDisplay}
                    ${stdDisplay}
                </div>
                <div style="width: 100%; background: #e2e8f0; height: 6px; border-radius: 3px; margin-top: 6px; overflow: hidden; display: flex; justify-content: flex-end;">
                    <div style="width: ${percent}%; background: var(--primary); height: 100%; border-radius: 3px;"></div>
                </div>
            </td>
            <td class="text-right" style="padding: 12px 10px; width: 25%;">
                <b style="font-size: 14px; color: var(--text);">${money(p.revenue)}</b>
            </td>
        </tr>`;
    });

    let totalStdStr = Object.keys(grandTotalByMeasure).map(m => `${grandTotalByMeasure[m].toLocaleString('en-US', {maximumFractionDigits: 2})} ${m}`).join(' & ');
    let totalBadge = document.getElementById('modalCatTotalStd');
    if(totalBadge) {
        if (totalStdStr !== '') {
            totalBadge.innerHTML = `<span style="background: var(--surface); color: var(--text); padding: 6px 14px; border-radius: 8px; border: 1px solid var(--line); font-size: 13px; font-weight: 600; box-shadow: var(--shadow-sm);"><i class='bx bx-pie-chart-alt' style="color: var(--primary);"></i> សរុប: ${totalStdStr}</span>`;
        } else {
            totalBadge.innerHTML = '';
        }
    }

    if (sortedProds.length > 0) {
        html += `<tr style="background-color: var(--sidebar-hover); border-top: 2px solid var(--line);">
            <td colspan="2" class="text-right"><b style="font-size: 14px; color: var(--text);">សរុបចំណូលប្រភេទនេះ:</b></td>
            <td class="text-right"><b style="color:var(--success); font-size:16px;">${money(grandTotalRevenue)}</b></td>
        </tr>`;
    }

    tbody.innerHTML = html || '<tr><td colspan="3" class="text-center muted pt-4">គ្មានទិន្នន័យមុខទំនិញ</td></tr>';
    openModal('categoryDetailModal');
};

window.viewProductDetail = function(productName) {
    document.getElementById('modalProdName').innerText = productName;

    const startDate = document.getElementById('chartStartDate').value; 
    const endDate = document.getElementById('chartEndDate').value;
    let filteredData = salesData;
    
    if (startDate || endDate) {
      let start = startDate ? new Date(startDate) : new Date('1970-01-01'); start.setHours(0,0,0,0);
      let end = endDate ? new Date(endDate) : new Date('2100-01-01'); end.setHours(23,59,59,999);
      filteredData = salesData.filter(item => { if (!item.date) return false; let itemDate = new Date(item.date); return itemDate >= start && itemDate <= end; });
    }

    let unitCountForProd = {};
    let grandTotalByMeasure = {}; 
    let grandTotalRevenue = 0;
    
    filteredData.forEach(row => {
        if (row.item === productName) {
            let rowQty = parseFloat(row.qty || row.Qty || 1);
            let rev = parseFloat(row.total || row.Total || 0);
            let stdValue = parseFloat(row.standard_unit_value || 0);
            let stdMeasure = (row.standard_unit_measure || '').trim();
            let dateStr = row.date || '';
            let pkg = (row.package_type || '').trim();
            
            if (!pkg && row.unit) {
                let u = row.unit.toLowerCase();
                if (u.includes('btl') || u.includes('bottle')) pkg = 'Bottle';
                else if (u.includes('pack') || u.includes('pc')) pkg = 'Pack';
                else if (u.includes('bag')) pkg = 'Bag';
                else if (u.includes('can')) pkg = 'Can';
            }
            
            let unitName = row.unit ? row.unit : 'មិនបញ្ជាក់ខ្នាត'; 
            let totalStdValue = rowQty * stdValue;

            if (!unitCountForProd[unitName]) {
                unitCountForProd[unitName] = { stdTotal: 0, stdMeasure: stdMeasure, sortQty: 0, revenue: 0, lastDate: '', pkg: pkg };
            }
            
            unitCountForProd[unitName].sortQty += rowQty; 
            unitCountForProd[unitName].revenue += rev;
            grandTotalRevenue += rev;
            
            if (dateStr) {
                if (!unitCountForProd[unitName].lastDate || new Date(dateStr) > new Date(unitCountForProd[unitName].lastDate)) {
                    unitCountForProd[unitName].lastDate = dateStr;
                }
            }

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

    let maxQty = sortedUnits.length > 0 ? sortedUnits[0].sortQty : 0;

    let tbody = document.getElementById('productDetailTableBody');
    let html = '';
    
    sortedUnits.forEach((u, index) => {
        let displayVal = '';
        if(u.stdMeasure !== 'ឯកតា' && u.stdTotal > 0) {
            displayVal = `<small style="color: var(--muted); font-size: 12px; margin-left: 5px; font-weight: 500;">(ស្មើនឹង ${u.stdTotal.toLocaleString('en-US', {maximumFractionDigits: 2})} ${u.stdMeasure})</small>`;
        }
        
        let pkgDisplay = u.pkg ? `<span style="font-size: 13px; color: var(--muted); font-weight: 500; margin-left: 4px;">${esc(u.pkg)}</span>` : '';

        let percent = maxQty > 0 ? (u.sortQty / maxQty) * 100 : 0;
        let dateDisplay = u.lastDate ? `<small style="color: var(--warning); display: block; margin-top: 4px;"><i class='bx bx-time'></i> លក់ចុងក្រោយ: ${u.lastDate}</small>` : `<small class="muted block">មិនទាន់មានទិន្នន័យ</small>`;

        html += `<tr style="border-bottom: 1px solid var(--line);">
            <td style="padding: 12px 10px; width: 45%;">
                <b style="font-size: 13px; color: var(--text);">${esc(u.name)}</b>
                ${dateDisplay}
            </td>
            <td class="text-right" style="padding: 12px 10px; width: 30%;">
                <div style="display: flex; justify-content: flex-end; align-items: baseline;">
                    <b style="color:var(--success); font-size:16px;">${u.sortQty}</b>${pkgDisplay}
                    ${displayVal}
                </div>
                <div style="width: 100%; background: #e2e8f0; height: 6px; border-radius: 3px; margin-top: 6px; overflow: hidden; display: flex; justify-content: flex-end;">
                    <div style="width: ${percent}%; background: var(--primary); height: 100%; border-radius: 3px;"></div>
                </div>
            </td>
            <td class="text-right" style="padding: 12px 10px; width: 25%;">
                <b style="font-size: 14px; color: var(--text);">${money(u.revenue)}</b>
            </td>
        </tr>`;
    });

    let totalStdStr = Object.keys(grandTotalByMeasure).map(m => `${grandTotalByMeasure[m].toLocaleString('en-US', {maximumFractionDigits: 2})} ${m}`).join(' & ');
        
    let totalBadge = document.getElementById('modalProdTotalStd');
    if(totalBadge) {
        if (totalStdStr !== '') {
            totalBadge.innerHTML = `<span style="background: var(--surface); color: var(--text); padding: 6px 14px; border-radius: 8px; border: 1px solid var(--line); font-size: 13px; font-weight: 600; box-shadow: var(--shadow-sm);"><i class='bx bx-pie-chart-alt' style="color: var(--primary);"></i> សរុប: ${totalStdStr}</span>`;
        } else {
            totalBadge.innerHTML = '';
        }
    }

    if (sortedUnits.length > 0) {
        html += `<tr style="background-color: var(--sidebar-hover); border-top: 2px solid var(--line);">
            <td colspan="2" class="text-right"><b style="font-size: 14px; color: var(--text);">ចំណូលសរុបទំនិញនេះ:</b></td>
            <td class="text-right"><b style="color:var(--success); font-size:16px;">${money(grandTotalRevenue)}</b></td>
        </tr>`;
    }

    tbody.innerHTML = html || '<tr><td colspan="3" class="text-center muted pt-4">គ្មានទិន្នន័យខ្នាត</td></tr>';
    openModal('productDetailModal');
};

// ==========================================
// 🌟 ប្រតិបត្តិការសាខា (Branch Ops / Daily Recon) 🌟
// ==========================================
window.renderBranchOps = function() {
    if(!salesData || !expensesData) return;
    
    let startInput = document.getElementById('reconStartDate');
    let endInput = document.getElementById('reconEndDate');
    
    let todayStr = new Date().toISOString().slice(0, 10);
    
    // បើអត់ទាន់រើសថ្ងៃ កំណត់យកថ្ងៃនេះជាគោល
    if (startInput && !startInput.value) startInput.value = todayStr;
    if (endInput && !endInput.value) endInput.value = todayStr;
    
    let startDate = startInput ? startInput.value : todayStr;
    let endDate = endInput ? endInput.value : todayStr;
    
    // 🌟 មុខងារចាប់យក "ថ្ងៃវាយបញ្ចូលក្នុងប្រព័ន្ធ" (System Entry Date)
    const getEntryDate = (item) => {
        if (item.created_at) {
            let d = new Date(item.created_at);
            return formatDateForInput(d); 
        }
        return item.date || '1970-01-01'; 
    };
    
    // 🌟 ចម្រាញ់ទិន្នន័យយកតាម "ថ្ងៃវាយបញ្ចូល" មិនមែនថ្ងៃលើវិក្កយបត្រទេ
    let targetSales = salesData.filter(s => {
        let eDate = getEntryDate(s);
        return eDate >= startDate && eDate <= endDate;
    });
    let targetExpenses = expensesData.filter(e => {
        let eDate = getEntryDate(e);
        return eDate >= startDate && eDate <= endDate;
    });
    
    // គណនាការលក់ដែលវាយបញ្ចូលក្នុងចន្លោះថ្ងៃនេះ
    let reconRev = 0; let reconPaid = 0; let reconCount = 0;
    targetSales.forEach(s => {
        let rev = parseFloat(s.total || 0);
        let paid = cleanStatus(s.status).toLowerCase() === 'paid' ? rev : parseFloat(s.paid_amount || 0);
        reconRev += rev; reconPaid += paid; reconCount++;
    });
    let reconUnpaid = reconRev - reconPaid;
    
    // គណនាចំណាយដែលវាយបញ្ចូល
    let reconExpense = 0;
    targetExpenses.forEach(e => { reconExpense += parseFloat(e.amount || 0); });
    
    // ទាញយកលុយដកចេញ (CASH OUT) 
    let depositInput = document.getElementById('depositBankAmt');
    let depositAmt = depositInput ? (parseFloat(depositInput.value) || 0) : 0;
    
    let officeInput = document.getElementById('headOfficeAmt');
    let officeAmt = officeInput ? (parseFloat(officeInput.value) || 0) : 0;
    
    let saveBoxInput = document.getElementById('shopSaveBox');
    let saveBoxAmt = saveBoxInput ? (parseFloat(saveBoxInput.value) || 0) : 0;
    
    // គណនាលទ្ធផលផ្ទៀងផ្ទាត់
    let totalCashOut = reconExpense + depositAmt + officeAmt + saveBoxAmt;
    let balance = reconPaid - totalCashOut;
    
    let balanceHtml = '';
    if (balance === 0) {
        balanceHtml = `<span style="color:var(--success); font-weight:bold;"><i class='bx bx-check-circle'></i> ត្រឹមត្រូវ (Balanced)</span>`;
    } else if (balance > 0) {
        balanceHtml = `<span style="color:var(--danger); font-weight:bold;"><i class='bx bx-error'></i> លុយសល់ក្រៅ ${money(balance)}</span>`;
    } else {
        balanceHtml = `<span style="color:var(--danger); font-weight:bold;"><i class='bx bx-error'></i> លុយខ្វះ ${money(Math.abs(balance))}</span>`;
    }
    
    let dateDisplay = startDate === endDate ? startDate : `${startDate} ដល់ ${endDate}`;

    let reconContainer = document.getElementById('dailyReconContainer');
    if(reconContainer) {
        reconContainer.innerHTML = `
            <div style="margin-bottom: 15px;">
                <div style="display:flex; justify-content:space-between; margin-bottom:8px;"><span class="muted">កាលបរិច្ឆេទវាយបញ្ចូល:</span> <b style="color:var(--primary);">${dateDisplay}</b></div>
                <div style="display:flex; justify-content:space-between; margin-bottom:8px;"><span class="muted">ចំនួនវិក្កយបត្រសរុប:</span> <b>${reconCount}</b></div>
                <div style="display:flex; justify-content:space-between; margin-bottom:8px;"><span class="muted">សរុបការលក់ (Revenue):</span> <b style="color:var(--text);">${money(reconRev)}</b></div>
                <div style="display:flex; justify-content:space-between; margin-bottom:8px; border-top: 1px dashed var(--line); padding-top: 8px;"><span class="muted">ប្រាក់ភ្ញៀវជំពាក់ថ្មី:</span> <b style="color:var(--warning);">${money(reconUnpaid)}</b></div>
            </div>

            <div style="background: rgba(16,185,129,0.05); padding: 12px; border-radius: 8px; border: 1px solid #a7f3d0; margin-bottom: 15px;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span style="font-weight: 600; color:var(--success);">I. សាច់ប្រាក់ចូល (CASH IN):</span> 
                    <b style="color:var(--success); font-size:16px;">${money(reconPaid)}</b>
                </div>
            </div>

            <div style="background: rgba(239,68,68,0.05); padding: 12px; border-radius: 8px; border: 1px solid #fecaca; margin-bottom: 15px;">
                <div style="display:flex; justify-content:space-between; margin-bottom:10px; border-bottom: 1px solid #fecaca; padding-bottom: 8px;">
                    <span style="font-weight: 600; color:var(--danger);">II. សាច់ប្រាក់ចេញ (CASH OUT):</span> 
                    <b style="color:var(--danger); font-size:16px;">${money(totalCashOut)}</b>
                </div>
                <div style="display:flex; justify-content:space-between; margin-bottom:6px;"><span class="muted" style="font-size:13px;">- ចំណាយទូទៅ (Expense):</span> <b>${money(reconExpense)}</b></div>
                <div style="display:flex; justify-content:space-between; margin-bottom:6px;"><span class="muted" style="font-size:13px;">- ដាក់ធនាគារ (Deposit):</span> <b>${money(depositAmt)}</b></div>
                <div style="display:flex; justify-content:space-between; margin-bottom:6px;"><span class="muted" style="font-size:13px;">- ប្រគល់ក្រុមហ៊ុន (Company):</span> <b>${money(officeAmt)}</b></div>
                <div style="display:flex; justify-content:space-between; margin-bottom:0;"><span class="muted" style="font-size:13px;">- ទុកក្នុងហាង (Save Box):</span> <b>${money(saveBoxAmt)}</b></div>
            </div>
            
            <div style="display:flex; justify-content:space-between; align-items: center; padding: 10px; background: var(--sidebar-hover); border-radius: 8px;">
                <span style="font-weight: bold; color:var(--text);">III. លទ្ធផលផ្ទៀងផ្ទាត់ (Balance):</span>
                ${balanceHtml}
            </div>
        `;
    }

    // 🌟 ទាញប្រវត្តិថ្ងៃមានការវាយបញ្ចូល មកតម្រៀបជាបញ្ជីនៅខាងស្តាំ
    let historyContainer = document.getElementById('reconHistoryContainer');
    if(historyContainer) {
        let groupedHistory = {};
        salesData.forEach(s => {
            let eDate = getEntryDate(s);
            if(eDate) {
                if(!groupedHistory[eDate]) groupedHistory[eDate] = 0;
                groupedHistory[eDate] += parseFloat(s.total || 0);
            }
        });

        // តម្រៀបពីថ្មីទៅចាស់ (យកតែ ២០ ថ្ងៃចុងក្រោយ)
        let sortedDates = Object.keys(groupedHistory).sort((a,b) => new Date(b) - new Date(a)).slice(0, 20);
        
        let hHtml = '';
        sortedDates.forEach(d => {
            let dateRev = groupedHistory[d];
            hHtml += `<tr style="border-bottom: 1px solid var(--line);">
                <td style="padding: 12px;"><b>${d}</b></td>
                <td class="text-right" style="padding: 12px;"><b style="color:var(--success);">${money(dateRev)}</b></td>
                <td class="text-center" style="padding: 12px;">
                    <button class="btn outline small" style="border-color: var(--primary); color: var(--primary);" onclick="viewHistoricalRecon('${d}')"><i class='bx bx-check-shield'></i> ផ្ទៀងផ្ទាត់</button>
                </td>
            </tr>`;
        });
        historyContainer.innerHTML = hHtml || '<tr><td colspan="3" class="text-center muted pt-4">មិនទាន់មានប្រតិបត្តិការទេ</td></tr>';
    }
};

window.viewHistoricalRecon = function(targetDate) {
    let startInput = document.getElementById('reconStartDate');
    let endInput = document.getElementById('reconEndDate');
    
    if(startInput) startInput.value = targetDate;
    if(endInput) endInput.value = targetDate;
    
    if(document.getElementById('depositBankAmt')) document.getElementById('depositBankAmt').value = '';
    if(document.getElementById('headOfficeAmt')) document.getElementById('headOfficeAmt').value = '';
    if(document.getElementById('shopSaveBox')) document.getElementById('shopSaveBox').value = '';
    
    renderBranchOps();
};
// ==========================================
// 🌟 Settings, Portal & Backup 🌟
// ==========================================

// --- ១. មុខងារ Client Portal ---
window.copyClientLink = function() { 
    let currentUrl = window.location.href.split('?')[0]; 
    let clientUrl = currentUrl + "?view=client"; 
    if(navigator.clipboard && window.isSecureContext) { navigator.clipboard.writeText(clientUrl).then(() => showToast("បាន Copy Link ម៉ូយ!", "success")); } else { prompt("Copy Link ខាងក្រោមនេះផ្ញើឲ្យម៉ូយ:", clientUrl); } 
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

    let totalSpent = 0; let totalDebt = 0;
    let actualName = allMySales[0].customer_name || 'អតិថិជន';

    allMySales.forEach(item => {
        let rev = parseFloat(item.total || item.Total || 0);
        let cleanStatusText = cleanStatus(item.status).toLowerCase();
        let paid = (cleanStatusText === 'paid') ? rev : parseFloat(item.paid_amount || 0);
        totalSpent += rev; totalDebt += (rev - paid); 
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
            let invNo = getInvoiceNo(item);
            let badge = debt > 0 ? `<span class="status-badge" style="background:rgba(239,68,68,0.1); color:#ef4444;">ជំពាក់ ${money(debt)}</span>` : `<span class="status-badge success">ទូទាត់រួច</span>`;
            html += `<tr><td class="muted">${item.date || '-'}</td><td><b>${invNo}</b></td><td>${esc(item.item)} <br><small class="muted">${item.qty} x ${item.price}៛</small></td><td class="text-right"><b style="color:var(--text);">${money(rev)}</b></td><td class="text-center">${badge}</td></tr>`;
        });
        html += `</tbody></table></div>`;
    } else {
        html = `<div class="text-center muted pt-4 pb-4" style="border: 1px dashed var(--line); border-radius: 8px; margin-top: 15px;">គ្មានវិក្កយបត្រថ្មីចាប់ពីថ្ងៃទី ${defaultStart} ទេ!</div>`;
    }

    let summaryHtml = `
    <div style="text-align: center; margin-bottom: 24px; margin-top: 10px;"><h2 style="margin:0 0 10px; color:var(--primary);">សួស្តី, ${esc(actualName)}</h2></div>
    <div class="stats-grid" style="grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px;">
        <div class="stat-card" style="padding: 15px;"><div><span>ទិញទំនិញសរុប</span><strong style="font-size:20px; color:var(--success);">${money(totalSpent)}</strong></div></div>
        <div class="stat-card" style="padding: 15px; border-color: var(--danger-bg); background: rgba(239,68,68,0.02);"><div><span>បំណុលកំពុងជំពាក់</span><strong style="font-size:20px; color:var(--danger);">${money(totalDebt)}</strong></div></div>
    </div><h3 style="margin-bottom: 10px; font-size: 15px;">ប្រវត្តិទិញទំនិញរបស់អ្នក៖</h3>`;
    container.innerHTML = summaryHtml + html;
};

window.handleGlobalSearch = function(event) {
    if (event.key === 'Enter') {
        event.preventDefault(); 
        let keyword = document.getElementById('globalSearchInput').value;
        let historySearchInput = document.getElementById('searchKeyword');
        if (historySearchInput) historySearchInput.value = keyword;
        openTab('historyTab');
        document.getElementById('globalSearchInput').value = '';
    }
};

// --- ២. មុខងារ Security (PIN & Password) ---
window.updateAdminPin = function() {
    let oldP = document.getElementById('oldPin').value;
    let newP = document.getElementById('newPin').value;
    if(oldP !== ADMIN_PIN) { showToast("PIN ចាស់មិនត្រឹមត្រូវទេ!", "error"); return; }
    if(newP.length < 4) { showToast("PIN ថ្មីត្រូវមានយ៉ាងហោចណាស់ ៤ ខ្ទង់!", "error"); return; }
    
    ADMIN_PIN = newP;
    localStorage.setItem('admin_pin', newP);
    showToast("បានផ្លាស់ប្តូរ PIN ជោគជ័យ!", "success");
    document.getElementById('oldPin').value = '';
    document.getElementById('newPin').value = '';
};

window.updateAccountPassword = async function() {
    let newPass = document.getElementById('newAccPassword').value;
    if(newPass.length < 6) { showToast("ពាក្យសម្ងាត់ត្រូវមានយ៉ាងហោចណាស់ ៦ ខ្ទង់!", "error"); return; }
    
    if(confirm("តើអ្នកពិតជាចង់ផ្លាស់ប្តូរពាក្យសម្ងាត់ (Password) ចូលគណនីមែនទេ?")) {
        let btn = document.querySelector('#settingsTab .btn[onclick="updateAccountPassword()"]');
        let oldText = btn.innerHTML; btn.innerHTML = "កំពុងប្តូរ..."; btn.disabled = true;

        const { data, error } = await db.auth.updateUser({ password: newPass });
        if(error) { showToast("បរាជ័យ: " + error.message, "error"); } 
        else { showToast("បានផ្លាស់ប្តូរពាក្យសម្ងាត់ជោគជ័យ!", "success"); document.getElementById('newAccPassword').value = ''; }
        
        btn.innerHTML = oldText; btn.disabled = false;
    }
};

// --- ៣. មុខងារ Backup ---
window.exportAllDataBackup = function() {
    let backup = {
        exportDate: new Date().toLocaleString(),
        totalSales: salesData.length,
        totalCustomers: customersData.length,
        totalProducts: productsData.length,
        totalExpenses: expensesData.length,
        customers: customersData,
        products: productsData,
        sales: salesData,
        expenses: expensesData
    };
    let dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backup, null, 2));
    let link = document.createElement('a');
    link.setAttribute("href", dataStr);
    link.setAttribute("download", `StockFlow_Backup_${new Date().toISOString().slice(0,10)}.json`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    showToast("ទាញយក Backup ជោគជ័យ!", "success");
};

// --- ៤. មុខងារកំណត់វិក្កយបត្រ (Print Settings) ---
window.getShopSettings = function() {
    return {
        name: localStorage.getItem('shopName') || "ស្រែមាស ចំការលើ",
        phone: localStorage.getItem('shopPhone') || "088 433 7888",
        address: localStorage.getItem('shopAddress') || "ចំការលើ, កំពង់ចាម"
    };
};

window.savePrintSettings = function() {
    localStorage.setItem('shopName', document.getElementById('settingShopName').value);
    localStorage.setItem('shopPhone', document.getElementById('settingShopPhone').value);
    localStorage.setItem('shopAddress', document.getElementById('settingShopAddress').value);
    showToast("បានរក្សាទុកព័ត៌មានហាង!", "success");
};

window.loadPrintSettings = function() {
    let s = getShopSettings();
    if(document.getElementById('settingShopName')) document.getElementById('settingShopName').value = s.name;
    if(document.getElementById('settingShopPhone')) document.getElementById('settingShopPhone').value = s.phone;
    if(document.getElementById('settingShopAddress')) document.getElementById('settingShopAddress').value = s.address;
};

// អនុញ្ញាតឱ្យទាញទិន្នន័យហាងរាល់ពេលចូលផ្ទាំង Settings
let existingOpenTab = window.openTab;
window.openTab = function(tabId) {
    existingOpenTab(tabId);
    if(tabId === 'settingsTab') loadPrintSettings();
};

// --- 🌟 ធ្វើឱ្យមុខងារ Print ប្រើឈ្មោះហាងថ្មីដោយស្វ័យប្រវត្តិ (Dynamic Print Override) 🌟 ---
window.prepareAndPrint = function(isQuotation) {
    let s = getShopSettings();
    document.getElementById('printDate').innerText = document.getElementById('date').value || '-';
    document.getElementById('printCusName').innerText = document.getElementById('customerInput').value || 'Walk-in';
    document.getElementById('printCusPhone').innerText = document.getElementById('phone').value || '-';
    document.getElementById('printCusAddress').innerText = document.getElementById('address').value || '-';
    document.getElementById('printCashier').innerText = document.getElementById('cashier').value || 'Admin';
    
    let statusEl = document.getElementById('paymentStatus');
    document.getElementById('printStatus').innerText = statusEl.options[statusEl.selectedIndex].text;

    // បញ្ចូលឈ្មោះហាងចូលផ្ទាំង Print HTML
    let wrapper = document.querySelector('.invoice-print-wrapper');
    if(wrapper) {
        let h1 = wrapper.querySelector('h1');
        let p = wrapper.querySelector('p');
        if(h1) h1.innerText = s.name;
        if(p) p.innerHTML = `អាសយដ្ឋាន: ${esc(s.address)}<br>ទូរស័ព្ទ: ${esc(s.phone)}`;
    }

    let titleEl = document.getElementById('printMainTitle');
    let originalText = titleEl.innerText;
    titleEl.innerText = isQuotation ? "សម្រង់តម្លៃ (QUOTATION)" : "វិក្កយបត្រ (INVOICE)";
    window.print();
    titleEl.innerText = originalText;
};

window.downloadInvoiceImage = function() {
    let s = getShopSettings();
    let dateVal = document.getElementById('date').value || '-';
    let cusName = document.getElementById('customerInput').value || 'Walk-in';
    let cusPhone = document.getElementById('phone').value || '-';
    let statusEl = document.getElementById('paymentStatus');
    let statusText = statusEl.options[statusEl.selectedIndex].text;
    
    let grandTotal = document.getElementById('grandTotal').innerText;
    let globalDiscount = parseFloat(document.getElementById('globalDiscount').value) || 0;
    
    let printItemsHtml = ''; let hasItems = false;
    document.querySelectorAll('#itemTable tr').forEach(row => {
        let item = row.querySelector('.item-input').value;
        if(item) {
            hasItems = true;
            let qty = row.querySelector('.item-qty').value;
            let price = row.querySelector('.item-price').value;
            let amount = row.querySelector('.item-amount').value;
            let unit = row.querySelector('.item-unit').value;
            let unitDisplay = unit ? ` (${unit})` : '';
            printItemsHtml += `<tr style="border-bottom: 1px dotted #ccc;"><td style="padding: 4px 2px; width: 45%;">${esc(item)}${unitDisplay}</td><td style="padding: 4px 2px; width: 15%; text-align: center;">${qty}</td><td style="padding: 4px 2px; width: 20%; text-align: right;">${money(price)}</td><td style="padding: 4px 2px; width: 20%; text-align: right;">${amount}</td></tr>`;
        }
    });
    if(!hasItems) { showToast("សូមបញ្ចូលមុខទំនិញជាមុនសិន!", "error"); return; }

    let discountHtml = globalDiscount > 0 ? `<div style="margin-top: 5px; color: var(--danger);">បញ្ចុះតម្លៃ: <b>-${money(globalDiscount)}</b></div>` : '';

    let printContent = `
    <html><head><title>Invoice Capture</title>
    <link href="https://fonts.googleapis.com/css2?family=Kantumruy+Pro:wght@400;600&display=swap" rel="stylesheet">
    <style>body { font-family: 'Kantumruy Pro', sans-serif; font-size: 13px; padding: 15px; width: 350px; color: #000; background: white; margin: 0 auto; } table { width: 100%; border-collapse: collapse; table-layout: fixed; margin-top: 10px; } td, th { word-wrap: break-word; font-size: 12px; color: #000; } .border-bottom { border-bottom: 1px dashed #000; padding-bottom: 8px; margin-bottom: 8px; }</style>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>
    </head><body>
      <div id="captureArea" style="background: white; padding: 10px;">
        <div style="text-align: center;" class="border-bottom">
            <h1 style="margin: 0; font-size: 20px; color: #1e3a8a;">${esc(s.name)}</h1>
            <p style="margin: 4px 0 0; font-size: 12px;">អាសយដ្ឋាន: ${esc(s.address)}<br>ទូរស័ព្ទ: ${esc(s.phone)}</p>
            <h2 style="margin: 8px 0 0; font-size: 16px;">វិក្កយបត្រ (INVOICE)</h2>
            <p style="margin: 4px 0; font-size: 12px;">កាលបរិច្ឆេទ: <b>${dateVal}</b></p>
        </div>
        <div class="border-bottom" style="font-size: 12px;">អតិថិជន: <b>${esc(cusName)}</b><br>ទូរស័ព្ទ: ${esc(cusPhone)}<br>ស្ថានភាព: <b>${statusText}</b></div>
        <table style="margin-bottom: 8px;"><thead style="border-bottom: 1px dashed #000;"><tr><th style="text-align:left; padding-bottom:4px;">មុខទំនិញ</th><th style="padding-bottom:4px;">ចំនួន</th><th style="text-align:right; padding-bottom:4px;">តម្លៃ</th><th style="text-align:right; padding-bottom:4px;">សរុប</th></tr></thead><tbody>${printItemsHtml}</tbody></table>
        <div style="border-top: 1px dashed #000; padding-top: 8px; text-align:right; font-size: 14px;">${discountHtml}<div style="margin-top: 5px;">សរុបទឹកប្រាក់: <b style="font-size: 18px;">${grandTotal}</b></div></div>
        <div style="text-align: center; margin-top: 20px; font-weight: bold; border-top: 1px dashed #000; padding-top: 15px;">🙏 សូមអរគុណសម្រាប់ការគាំទ្រ!</div>
      </div>
      <script>window.onload = function() { setTimeout(() => { html2canvas(document.getElementById('captureArea'), { scale: 3 }).then(canvas => { let link = document.createElement('a'); link.download = 'Invoice_${esc(cusName)}_${dateVal}.png'; link.href = canvas.toDataURL('image/png'); link.click(); window.close(); }); }, 500); };</script>
    </body></html>`;

    let captureWindow = window.open('', '', 'width=400,height=600');
    captureWindow.document.write(printContent);
    captureWindow.document.close();
    showToast("កំពុងរៀបចំទាញយករូបភាព...", "success");
};

window.reprintCurrentInvoice = function() {
    let s = getShopSettings();
    let invNo = document.getElementById('detailInvNo').innerText;
    let items = salesData.filter(sale => getInvoiceNo(sale) === invNo);
    if(items.length === 0) return;
    
    let first = items[0];
    let grandTotal = 0; let paidTotal = 0; let printItemsHtml = '';
    
    items.forEach(item => {
        let rowTotal = parseFloat(item.total || 0); grandTotal += rowTotal;
        let isPaid = cleanStatus(item.status).toLowerCase() === 'paid';
        paidTotal += isPaid ? rowTotal : parseFloat(item.paid_amount || 0);
        let unitDisplay = item.unit ? ` (${item.unit})` : '';
        printItemsHtml += `<tr style="border-bottom: 1px dotted #ccc;"><td style="padding: 2px 1px; width: 45%;">${esc(item.item)}${unitDisplay}</td><td style="padding: 2px 1px; width: 15%; text-align: center;">${item.qty}</td><td style="padding: 2px 1px; width: 20%; text-align: right;">${money(item.price)}</td><td style="padding: 2px 1px; width: 20%; text-align: right;">${money(rowTotal)}</td></tr>`;
    });
    
    let debt = grandTotal - paidTotal;
    let statusText = debt > 0 ? 'Unpaid / ជំពាក់' : 'Paid / ទូទាត់រួច';
    
    let printContent = `
    <html><head><title>Reprint Invoice</title>
    <link href="https://fonts.googleapis.com/css2?family=Kantumruy+Pro:wght@400;600&display=swap" rel="stylesheet">
    <style>@page { margin: 0; size: 80mm auto; } body { font-family: 'Kantumruy Pro', sans-serif; font-size: 11px; padding: 2mm; width: 76mm; color: #000; background: white; } table { width: 100%; border-collapse: collapse; table-layout: fixed; } td, th { word-wrap: break-word; font-size: 10px; color: #000; } .border-bottom { border-bottom: 1px dashed #000; padding-bottom: 5px; margin-bottom: 5px; }</style>
    </head><body>
        <div style="text-align: center;" class="border-bottom">
            <h1 style="margin: 0; font-size: 16px;">${esc(s.name)}</h1>
            <p style="margin: 2px 0 0; font-size: 10px;">អាសយដ្ឋាន: ${esc(s.address)}<br>ទូរស័ព្ទ: ${esc(s.phone)}</p>
            <h2 style="margin: 5px 0 0; font-size: 14px;">វិក្កយបត្រ (INVOICE) - ថតចម្លង</h2>
            <p style="margin: 2px 0; font-size: 10px;">កាលបរិច្ឆេទ: ${first.date || '-'}</p><p style="margin: 2px 0; font-size: 10px;">លេខ: <b>${invNo}</b></p>
        </div>
        <div class="border-bottom" style="font-size: 10px;">អតិថិជន: <b>${esc(first.customer_name || 'Walk-in')}</b><br>ទូរស័ព្ទ: ${esc(first.phone || '-')}<br>ស្ថានភាព: <b>${statusText}</b></div>
        <table style="margin-bottom: 5px;"><thead style="border-bottom: 1px dashed #000;"><tr><th style="text-align:left;">មុខទំនិញ</th><th>ចំនួន</th><th style="text-align:right;">តម្លៃ</th><th style="text-align:right;">សរុប</th></tr></thead><tbody>${printItemsHtml}</tbody></table>
        <div style="border-top: 1px dashed #000; padding-top: 5px; text-align:right; font-size: 12px;">សរុបទឹកប្រាក់: <b>${money(grandTotal)}</b></div>
        <div style="text-align: center; margin-top: 15px; font-weight: bold; border-top: 1px dashed #000; padding-top: 10px;">🙏 សូមអរគុណសម្រាប់ការគាំទ្រ!</div>
    </body></html>`;

    let printWindow = window.open('', '', 'width=400,height=600');
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 500);
};
// --- ៥. មុខងារអត្រាប្តូរប្រាក់ (Exchange Rate) ---
window.saveExchangeRate = function() {
    let exRate = document.getElementById('settingExchangeRate').value;
    if(!exRate || isNaN(exRate) || parseFloat(exRate) <= 0) {
        showToast("សូមបញ្ចូលអត្រាប្តូរប្រាក់ឱ្យបានត្រឹមត្រូវ!", "error");
        return;
    }
    localStorage.setItem('exchangeRate', exRate);
    showToast("បានរក្សាទុកអត្រាប្តូរប្រាក់ជោគជ័យ!", "success");
    loadDashboard(); // Refresh Dashboard ឱ្យដូរលេខរៀល/ដុល្លារ
};

// កែមុខងារ loadPrintSettings ឱ្យទាញយក Exchange Rate មកបង្ហាញផងដែរ
let oldLoadPrintSettings = window.loadPrintSettings;
window.loadPrintSettings = function() {
    if(oldLoadPrintSettings) oldLoadPrintSettings();
    let exRate = localStorage.getItem('exchangeRate') || "4100";
    if(document.getElementById('settingExchangeRate')) document.getElementById('settingExchangeRate').value = exRate;
};

// --- ៦. មុខងារ Restore Backup (បញ្ជូលទិន្នន័យពី JSON) ---
window.handleRestoreBackup = function(event) {
    let file = event.target.files[0];
    if(!file) return;

    let pass = prompt("🔒 ការទាញទិន្នន័យពី Backup នឹងលុបទិន្នន័យចាស់ក្នុងប្រព័ន្ធចេញទាំងអស់។\nសូមបញ្ចូលលេខកូដថៅកែ (PIN) ដើម្បីបន្ត៖");
    if(pass !== ADMIN_PIN) {
        showToast("លេខកូដមិនត្រឹមត្រូវទេ! ប្រតិបត្តិការត្រូវបានលុបចោល។", "error");
        event.target.value = ''; // Reset file input
        return;
    }

    let reader = new FileReader();
    reader.onload = async function(e) {
        try {
            let backupData = JSON.parse(e.target.result);
            if(!backupData.sales || !backupData.products || !backupData.customers || !backupData.expenses) {
                showToast("ឯកសារ Backup មិនត្រឹមត្រូវទេ!", "error");
                return;
            }

            if(confirm("តើអ្នកពិតជាចង់បញ្ចូលទិន្នន័យពី File នេះមែនទេ? សកម្មភាពនេះមិនអាចត្រឡប់ថយក្រោយបានទេ!")) {
                showToast("កំពុងសម្អាតទិន្នន័យចាស់ និងបញ្ជូលទិន្នន័យថ្មី...", "success");
                
                // 1. លុបទិន្នន័យចាស់ចេញពី Supabase ឱ្យអស់សិន
                await db.from(TABLE_SALES).delete().neq('id', 0);
                await db.from(TABLE_PRODUCTS).delete().neq('id', 0);
                await db.from(TABLE_EXPENSES).delete().neq('id', 0);
                
                // 🌟 ប្រើឈ្មោះ column 'customer_name' ជំនួស 'id' ដើម្បីការពារ Error 🌟
                await db.from(TABLE_CUSTOMERS).delete().neq('customer_name', 'DummyNameToForceDeleteAll');

                // 2. បញ្ចូលទិន្នន័យថ្មី
                if(backupData.products.length > 0) await db.from(TABLE_PRODUCTS).insert(backupData.products);
                if(backupData.customers.length > 0) await db.from(TABLE_CUSTOMERS).insert(backupData.customers);
                if(backupData.expenses.length > 0) await db.from(TABLE_EXPENSES).insert(backupData.expenses);
                
                // សម្រាប់ Sales Data ត្រូវបំបែកជាដុំតូចៗ (Batches) បើវាមានច្រើន
                let chunkSize = 500;
                for (let i = 0; i < backupData.sales.length; i += chunkSize) {
                    let chunk = backupData.sales.slice(i, i + chunkSize);
                    await db.from(TABLE_SALES).insert(chunk);
                }

                showToast("ទាញទិន្នន័យត្រឡប់មកវិញ (Restore) ជោគជ័យ!", "success");
                await refreshAllData(); // Load data ចូល UI វិញ
            }
        } catch (error) {
            console.error(error);
            showToast("មានកំហុសក្នុងការអានឯកសារ Backup!", "error");
        }
        event.target.value = ''; // Reset file input
    };
    reader.readAsText(file);
};

// --- ៧. មុខងារ Factory Reset (លុបទិន្នន័យទាំងអស់) ---
window.factoryResetSystem = async function() {
    let pass = prompt("⚠️ គ្រោះថ្នាក់ (Danger Zone)!\nតើអ្នកពិតជាចង់លុបទិន្នន័យទាំងអស់ (លក់ ចំណាយ ទំនិញ អតិថិជន) ចេញពីប្រព័ន្ធមែនទេ?\nសកម្មភាពនេះមិនអាចត្រឡប់ថយក្រោយបានទេ!\n\nសូមបញ្ចូលលេខកូដថៅកែ (PIN) ដើម្បីបន្ត៖");
    
    if(pass === ADMIN_PIN) {
        let finalConfirm = confirm("⚠️ ការព្រមានចុងក្រោយ!\nទិន្នន័យនឹងត្រូវលុបចោលទាំងស្រុង។ តើអ្នកចង់បន្តមែនទេ?");
        if(finalConfirm) {
            showToast("កំពុងលុបទិន្នន័យ... សូមរង់ចាំ!", "warning");
            
            // Delete all records from Supabase tables
            await db.from(TABLE_SALES).delete().neq('id', 0);
            await db.from(TABLE_PRODUCTS).delete().neq('id', 0);
            await db.from(TABLE_EXPENSES).delete().neq('id', 0);
            
            // 🌟 កែលក្ខខណ្ឌលុបអតិថិជន 🌟
            await db.from(TABLE_CUSTOMERS).delete().neq('customer_name', 'DummyNameToForceDeleteAll');
            showToast("បានលុបទិន្នន័យទាំងអស់ជោគជ័យ (Factory Reset)!", "success");
            await refreshAllData();
        }
    } else if(pass !== null) {
        showToast("លេខកូដមិនត្រឹមត្រូវទេ! ប្រតិបត្តិការត្រូវបានលុបចោល។", "error");
    }
};
