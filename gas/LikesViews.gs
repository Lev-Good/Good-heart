/**
 * ============================================================
 * לייקים וצפיות לאתר "לב טוב דיגיטל"
 * ============================================================
 * שרת ספירת לייקים ("אהבתי") וצפיות לכל פרויקט באתר.
 * הנתונים נשמרים בגיליון Google Sheets שנוצר אוטומטית בדרייב שלכם.
 *
 * איך פורסים:
 * 1. נכנסים ל-https://script.google.com → "פרויקט חדש".
 * 2. מדביקים את כל הקוד הזה בקובץ Code.gs.
 * 3. מריצים ידנית פעם אחת את הפונקציה setup() כדי ליצור את הגיליון
 *    (בשורת התפריטים בוחרים setup → Run → מאשרים הרשאות).
 * 4. פורסים: Deploy → New deployment → Web app
 *    - Execute as: Me (החשבון שלכם)
 *    - Who has access: Anyone
 * 5. מעתיקים את כתובת ה-Web App ומדביקים אותה באתר:
 *    index.html → const LIKES_URL = 'הכתובת שלכם';
 *
 * איך האתר מתקשר איתו:
 * - קריאה:   GET .../exec?action=counts&callback=cb      → תשובה JSONP
 * - לייק:    GET .../exec?action=like&id=xxx&visitor=yyy
 * - ביטול:   GET .../exec?action=unlike&id=xxx&visitor=yyy
 * - צפייה:   GET .../exec?action=view&id=xxx&visitor=yyy
 *
 * הספירה היא של מבקרים שונים (לפי מזהה מבקר ייחודי) — כך שאם אותו
 * מבקר לוחץ לייק פעמים רבות, זה נספר רק פעם אחת.
 * ============================================================
 */

var CONFIG = {
  SPREADSHEET_FILE_NAME: 'ליקים וצפיות - לב טוב דיגיטל',
  LIKES_SHEET: 'ליקים',
  VIEWS_SHEET: 'צפיות'
};

/**
 * הפעלה ידנית ראשונית — יוצר את הגיליון אם טרם נוצר ומחזיר את כתובתו.
 */
function setup() {
  return getSpreadsheet_().getUrl();
}

function getSpreadsheet_() {
  var files = DriveApp.getFilesByName(CONFIG.SPREADSHEET_FILE_NAME);
  var ss;
  if (files.hasNext()) {
    ss = SpreadsheetApp.open(files.next());
  } else {
    ss = SpreadsheetApp.create(CONFIG.SPREADSHEET_FILE_NAME);
  }
  ensureSheets_(ss);
  return ss;
}

function ensureSheets_(ss) {
  if (!ss.getSheetByName(CONFIG.LIKES_SHEET)) {
    ss.insertSheet(CONFIG.LIKES_SHEET).appendRow(['timestamp', 'project', 'visitor']);
  }
  if (!ss.getSheetByName(CONFIG.VIEWS_SHEET)) {
    ss.insertSheet(CONFIG.VIEWS_SHEET).appendRow(['timestamp', 'project', 'visitor']);
  }
}

function doGet(e) {
  var p = e.parameter || {};
  var action = String(p.action || 'counts');
  var id = String(p.id || '').slice(0, 60);
  var visitor = String(p.visitor || '').slice(0, 60);

  try {
    if (action === 'like' && id && visitor) {
      getSpreadsheet_().getSheetByName(CONFIG.LIKES_SHEET).appendRow([new Date(), id, visitor]);
    } else if (action === 'unlike' && id && visitor) {
      removeRows_(CONFIG.LIKES_SHEET, id, visitor);
    } else if (action === 'view' && id && visitor) {
      getSpreadsheet_().getSheetByName(CONFIG.VIEWS_SHEET).appendRow([new Date(), id, visitor]);
    }
  } catch (err) {
    // לא להפיל את התשובה בגלל שגיאת כתיבה לגיליון
  }

  var data = getCounts_();
  var callback = String(p.callback || '');
  return respond_(callback, data);
}

function getCounts_() {
  var out = { likes: {}, views: {} };
  try {
    var ss = getSpreadsheet_();
    out.likes = countDistinct_(ss.getSheetByName(CONFIG.LIKES_SHEET));
    out.views = countDistinct_(ss.getSheetByName(CONFIG.VIEWS_SHEET));
  } catch (err) {
    out.error = String(err);
  }
  return out;
}

// סופר כמה מבקרים שונים (לפי מזהה מבקר) אהבו/צפו בכל פרויקט
function countDistinct_(sheet) {
  var counts = {};
  if (!sheet) return counts;
  var values = sheet.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    var rowId = String(values[i][1] || '').trim();
    var rowVisitor = String(values[i][2] || '').trim();
    if (!rowId || !rowVisitor) continue;
    if (!counts[rowId]) counts[rowId] = {};
    counts[rowId][rowVisitor] = true;
  }
  var result = {};
  for (var key in counts) result[key] = Object.keys(counts[key]).length;
  return result;
}

// מחיקת שורות מסוימות (לביטול לייק של אותו מבקר)
function removeRows_(sheetName, id, visitor) {
  var sheet = getSpreadsheet_().getSheetByName(sheetName);
  if (!sheet) return;
  var values = sheet.getDataRange().getValues();
  if (values.length <= 1) return;
  var keep = [values[0]]; // שורת הכותרת
  for (var i = 1; i < values.length; i++) {
    var rowId = String(values[i][1] || '').trim();
    var rowVisitor = String(values[i][2] || '').trim();
    if (rowId === id && rowVisitor === visitor) continue; // למחוק
    keep.push(values[i]);
  }
  sheet.clearContents();
  if (keep.length) {
    sheet.getRange(1, 1, keep.length, keep[0].length).setValues(keep);
  }
}

function respond_(callback, data) {
  var json = JSON.stringify(data);
  if (callback) {
    var safe = String(callback).replace(/[^A-Za-z0-9_$]/g, '');
    return ContentService.createTextOutput(safe + '(' + json + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}
