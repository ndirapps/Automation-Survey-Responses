// ============================================================
//  Code.gs – Google Apps Script Web App
//  Automation & Digitization Process Mapping Survey
//  nakama-software
// ============================================================

// ▼▼▼ PASTE YOUR GOOGLE SHEET ID HERE ▼▼▼
var SPREADSHEET_ID = 'YOUR_SPREADSHEET_ID_HERE';
// ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲

// Optional shared token — NOT real security (frontend JS is public).
// Leave empty to disable.
var SHARED_TOKEN = '';

var SHEET_NAME = 'תשובות הסקר';

var HEADERS = [
  'תאריך שמירה',
  'תאריך יצירה באתר',
  'שם המחלקה',
  'שם הצוות / היחידה',
  'שם ממלא הסקר',
  'תפקיד',
  'איש קשר להמשך בירור',
  'שם התהליך / המשימה',
  'מטרת התהליך',
  'מי מבצע את התהליך כיום',
  'מי עוד מעורב בתהליך',
  'איך התהליך מתחיל',
  'פירוט אחר - התחלת תהליך',
  'תיאור שלבי העבודה כיום',
  'מערכות / כלים בשימוש',
  'פירוט אחר - מערכות / כלים',
  'האם מעתיקים מידע ידנית',
  'פירוט העתקת מידע',
  'האם יש קבצים או מסמכים',
  'סוגי קבצים / מסמכים',
  'פירוט אחר - סוגי קבצים / מסמכים',
  'איפה המידע או המסמכים נשמרים',
  'פירוט אחר - מיקום אחסון',
  'האם קשה למצוא מידע או מסמכים',
  'החלק הכי ידני, מורכב או מסורבל בתהליך',
  'השלב שלוקח הכי הרבה זמן',
  'שלב שבו מתרחשות שגיאות',
  'האם קשה לעקוב אחרי סטטוס הטיפול',
  'האם יש כפילויות או הזנה חוזרת',
  'תדירות התהליך',
  'פירוט אחר - תדירות',
  'זמן ביצוע ממוצע',
  'חלקים רצויים לאוטומציה',
  'פירוט אחר - אוטומציה',
  'האם נדרש טופס דיגיטלי',
  'האם נדרש מסך מעקב / דשבורד',
  'האם נדרשות התראות אוטומטיות',
  'האם צריך להפיק דוח או מסמך בסיום',
  'האם יש אישורים בתהליך',
  'פירוט אישורים וסדר אישור',
  'האם יש הרשאות שונות למשתמשים',
  'האם יש מידע רגיש או חסוי',
  'דירוג - כמה התהליך ידני',
  'דירוג - כמה התהליך גוזל זמן',
  'דירוג - כמה שגיאות מתרחשות',
  'דירוג - דחיפות השיפור',
  'דירוג - כמות אנשים מושפעים',
  'הבעיה המרכזית כיום',
  'המצב הרצוי בעתיד',
  'מה ייחשב הצלחה',
  'הערות נוספות',
  'כתובת עמוד האתר',
  'פרטי דפדפן / משתמש',
  'JSON מלא'
];

// ============================================================
//  doPost
// ============================================================
function doPost(e) {
  try {
    var data = parsePayload(e);

    if (SHARED_TOKEN && data.token !== SHARED_TOKEN) {
      return jsonResponse({ status: 'error', message: 'Unauthorized' });
    }

    var sheet = getOrCreateSheet();
    ensureHeaders(sheet);
    appendRow(sheet, data);

    return jsonResponse({ status: 'ok', message: 'Saved successfully' });

  } catch (err) {
    Logger.log('doPost error: ' + err.toString());
    return jsonResponse({ status: 'error', message: err.toString() });
  }
}

// ============================================================
//  parsePayload
// ============================================================
function parsePayload(e) {
  if (!e) throw new Error('No event object received');

  if (e.parameter && e.parameter.payload) {
    return JSON.parse(e.parameter.payload);
  }

  if (e.postData && e.postData.contents) {
    var raw = e.postData.contents;
    try { return JSON.parse(raw); } catch (_) {}
    var params = {};
    raw.split('&').forEach(function(pair) {
      var idx = pair.indexOf('=');
      if (idx !== -1) {
        var key = pair.substring(0, idx);
        var value = pair.substring(idx + 1);
        params[decodeURIComponent(key)] = decodeURIComponent(value.replace(/\+/g, ' '));
      }
    });
    if (params.payload) return JSON.parse(params.payload);
    return params;
  }

  throw new Error('Could not parse payload');
}

// ============================================================
//  Sheet helpers
// ============================================================
function getOrCreateSheet() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);
  return sheet;
}

function ensureHeaders(sheet) {
  if (sheet.getLastRow() === 0) {
    writeHeaderRow(sheet);
    return;
  }

  // Self-heal: if the first row doesn't match the current Hebrew headers
  // (e.g. an older deployment left stale/English headers), replace it
  // without touching any existing data rows below it.
  var existing = sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0];
  var matches = existing.length === HEADERS.length &&
    existing.every(function (value, i) { return value === HEADERS[i]; });
  if (!matches) {
    writeHeaderRow(sheet);
  }
}

function writeHeaderRow(sheet) {
  var headerRange = sheet.getRange(1, 1, 1, HEADERS.length);
  headerRange.setValues([HEADERS]);
  headerRange.setFontWeight('bold');
  headerRange.setBackground('#061b33');
  headerRange.setFontColor('#ffffff');
  sheet.setFrozenRows(1);
  sheet.setColumnWidths(1, HEADERS.length, 160);
}

function appendRow(sheet, d) {
  var row = [
    new Date(),
    d.createdAt              || '',
    d.department             || '',
    d.team                   || '',
    d.respondentName         || '',
    d.role                   || '',
    d.contactPerson          || '',
    d.processName            || '',
    d.processGoal            || '',
    d.currentOwner           || '',
    d.otherInvolved          || '',
    d.processStart           || '',
    d.processStartOther      || '',
    d.currentSteps           || '',
    d.systemsUsed            || '',
    d.systemsUsedOther       || '',
    d.manualCopy             || '',
    d.manualCopyDetails      || '',
    d.hasFiles               || '',
    d.fileTypes              || '',
    d.fileTypesOther         || '',
    d.storageLocations       || '',
    d.storageLocationsOther  || '',
    d.hardToFind             || '',
    d.mainPainPoint          || '',
    d.timeTaking             || '',
    d.errorProne             || '',
    d.hardToTrack            || '',
    d.duplicateEntry         || '',
    d.frequency              || '',
    d.frequencyOther         || '',
    d.avgTime                || '',
    d.automationNeeds        || '',
    d.automationNeedsOther   || '',
    d.needsForm              || '',
    d.needsDashboard         || '',
    d.needsAlerts            || '',
    d.reportNeeded           || '',
    d.hasApprovals           || '',
    d.approvalDetails        || '',
    d.differentPermissions   || '',
    d.sensitiveInfo          || '',
    d.ratingManual           || '',
    d.ratingTime             || '',
    d.ratingErrors           || '',
    d.ratingUrgency          || '',
    d.ratingPeople           || '',
    d.mainProblem            || '',
    d.desiredFuture          || '',
    d.successDefinition      || '',
    d.additionalNotes        || '',
    d.pageUrl                || '',
    d.userAgent              || '',
    JSON.stringify(d)
  ];

  sheet.appendRow(row);
}

// ============================================================
//  Response helper
// ============================================================
function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================
//  doGet – health check
// ============================================================
function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({ status: 'ok', message: 'Survey endpoint is live' }))
    .setMimeType(ContentService.MimeType.JSON);
}
