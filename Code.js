// ==================== ១. WEB APP ====================
function doGet(e) {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('ស្រែមាស - ប្រព័ន្ធបញ្ចូលទិន្នន័យលក់')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// ==================== ២. រក្សាទុកទិន្នន័យ (SAVE DATA) ====================
function saveData(payload) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Data");
    if (!sheet) return "Error: រកមិនឃើញ Tab 'Data'!";

    payload.items.forEach(function(item) {
      sheet.appendRow([
        payload.date, 
        payload.cashier, 
        payload.customer, 
        payload.phone, 
        payload.address, 
        item.name, 
        item.qty, 
        item.price, 
        item.discount, 
        item.amount
      ]);
    });

    return "រក្សាទុកទិន្នន័យបានជោគជ័យ!";
  } catch (e) { 
    return "Error: " + e.toString(); 
  }
}

// ==================== ៣. មុខងារស្វែងរកប្រវត្តិទិញ (WEB APP) ====================
function searchCustomerHistoryWebApp(customerKey, startDateStr, endDateStr) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Data");
    if (!sheet) return { success: false, message: "រកមិនឃើញ Tab ឈ្មោះ 'Data' ក្នុង Google Sheet ទេ!" };
    
    var data = sheet.getDataRange().getValues();
    if (data.length <= 1) return { success: false, message: "មិនទាន់មានទិន្នន័យទិញដូរក្នុងប្រព័ន្ធទេ" };

    var keyClean = customerKey ? customerKey.toString().replace(/\s+/g, '').toLowerCase() : "";
    
    var startDate = startDateStr ? parseCustomDate(startDateStr) : null;
    var endDate = endDateStr ? parseCustomDate(endDateStr) : null;
    if (endDate) endDate.setHours(23, 59, 59, 999);

    var totalSpent = 0, results = [], custName = "", custPhone = "";

    function cleanNum(val) {
      if (typeof val === 'number') return val;
      if (!val) return 0;
      return parseFloat(val.toString().replace(/[^0-9.-]/g, '')) || 0;
    }

    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      if (!row || !row[0]) continue;

      var rawName = (row[2] || "").toString();
      var rawPhone = (row[3] || "").toString();

      var nameClean = rawName.replace(/\s+/g, '').toLowerCase();
      var phoneClean = rawPhone.replace(/\s+/g, '');

      if (keyClean === "" || nameClean.includes(keyClean) || phoneClean.includes(keyClean)) {
        
        var rowDate = new Date(row[0]);
        if (!isNaN(rowDate.getTime())) {
          if (startDate && rowDate < startDate) continue;
          if (endDate && rowDate > endDate) continue;
        }

        if (!custName) { custName = rawName; custPhone = rawPhone; }

        var dateFormatted = "";
        if (row[0] instanceof Date) {
          dateFormatted = Utilities.formatDate(row[0], Session.getScriptTimeZone(), "yyyy-MM-dd");
        } else {
          dateFormatted = row[0].toString();
        }

        var amt = cleanNum(row[9]);
        totalSpent += amt;

        results.push({
          date: dateFormatted,
          customer: rawName,
          item: row[5] || "ផ្សេងៗ",
          qty: cleanNum(row[6]),
          price: cleanNum(row[7]),
          amount: amt
        });
      }
    }

    if (results.length === 0) return { success: false, message: "រកមិនឃើញទិន្នន័យទិញដូរសម្រាប់ឈ្មោះ/លេខនេះទេ!" };

    return {
      success: true,
      customerName: custName || customerKey,
      customerPhone: custPhone,
      totalSpent: totalSpent,
      items: results
    };
  } catch (e) { 
    return { success: false, message: "កំហុសក្នុងទិន្នន័យ Sheet៖ " + e.toString() }; 
  }
}

function parseCustomDate(str) {
  try {
    var p = str.split(/[-/.]/);
    if (p.length === 3) {
      if (p[0].length === 2 && p[2].length === 4) return new Date(p[2], p[1] - 1, p[0]);
      if (p[0].length === 4 && p[2].length === 2) return new Date(p[0], p[1] - 1, p[2]);
    }
    var d = new Date(str);
    return isNaN(d.getTime()) ? null : d;
  } catch(e) { return null; }
}

// ==================== ៤. មុខងារបន្ថែមអតិថិជន និងទំនិញ ====================
function getCustomersList() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Customers");
  if (!sheet) return [];
  return sheet.getDataRange().getValues().slice(1).filter(r => r[0]).map(r => ({ name: r[0], phone: r[1] || "", address: r[2] || "" }));
}

function addCustomer(data) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Customers");
  if (!sheet) {
    sheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet("Customers");
    sheet.appendRow(["Customer Name", "Phone", "Address"]);
  }
  sheet.appendRow([data.name, data.phone, data.address]);
  return { message: "បន្ថែមអតិថិជនបានជោគជ័យ!" };
}

function getItemsList() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Items");
  if (!sheet) return [];
  return sheet.getDataRange().getValues().slice(1).filter(r => r[0]).map(r => ({ name: r[0], price: r[1] || 0 }));
}

function addNewProduct(data) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Items");
  if (!sheet) {
    sheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet("Items");
    sheet.appendRow(["Item Name", "Price"]);
  }
  sheet.appendRow([data.name, data.price]);
  return { message: "បន្ថែមមុខទំនិញបានជោគជ័យ!" };
}
