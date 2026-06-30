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

var SHEET_NAME = 'תגובות';

var HEADERS = [
  'חותמת זמן',
  'מחלקה',
  'צוות / יחידה',
  'שם ממלא הסקר',
  'תפקיד',
  'איש קשר',
  'שם התהליך',
  'מטרת התהליך',
  'מי מבצע',
  'מי מעורב',
  'איך התהליך מתחיל',
  'אחר – תחילת תהליך',
  'שלבי העבודה כיום',
  'מערכות / כלים',
  'אחר – מערכות / כלים',
  'העתקת מידע ידנית',
  'מאיפה לאיפה',
  'יש קבצים',
  'סוגי קבצים',
  'אחר – סוגי קבצים',
  'מיקום אחסון',
  'אחר – מיקום אחסון',
  'קשה למצוא מסמכים',
  'החלק הכי ידני / מורכב',
  'מה לוקח הכי הרבה זמן',
  'איפה קורות שגיאות',
  'קשה לעקוב סטטוס',
  'כפילויות',
  'תדירות',
  'אחר – תדירות',
  'זמן ממוצע לביצוע',
  'צרכי אוטומציה',
  'אחר – צרכי אוטומציה',
  'צריך טופס דיגיטלי',
  'צריך דשבורד',
  'צריך התראות',
  'נדרש דוח',
  'יש אישורים',
  'מי מאשר',
  'הרשאות שונות',
  'מידע רגיש',
  'דירוג ידניות',
  'דירוג זמן',
  'דירוג שגיאות',
  'דירוג דחיפות',
  'דירוג מושפעים',
  'הבעיה המרכזית',
  'מה היה רצוי',
  'מה ייחשב הצלחה',
  'הערות',
  'User Agent',
  'JSON גולמי'
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
    var headerRange = sheet.getRange(1, 1, 1, HEADERS.length);
    headerRange.setValues([HEADERS]);
    headerRange.setFontWeight('bold');
    headerRange.setBackground('#061b33');
    headerRange.setFontColor('#ffffff');
    sheet.setFrozenRows(1);
    sheet.setColumnWidths(1, HEADERS.length, 160);
  }
}

function appendRow(sheet, d) {
  var row = [
    d.createdAt              || new Date().toISOString(),
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
