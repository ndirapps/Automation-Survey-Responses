// ============================================================
//  Code.gs – Google Apps Script Web App
//  Automation & Digitization Process Mapping Survey
// ============================================================
//
//  SETUP:
//  1. Open your Google Sheet.
//  2. Copy the Sheet ID from the URL:
//     https://docs.google.com/spreadsheets/d/  <<<SHEET_ID>>>  /edit
//  3. Paste it below as SPREADSHEET_ID.
//  4. Go to Extensions → Apps Script and paste this entire file.
//  5. Deploy → New deployment → Web App
//     Execute as: Me
//     Who has access: Anyone (or "Anyone in your organization" for internal use)
//  6. Copy the Web App URL and paste it into script.js as GOOGLE_SCRIPT_URL.
//
// ============================================================

// ▼▼▼ PASTE YOUR GOOGLE SHEET ID HERE ▼▼▼
var SPREADSHEET_ID = 'YOUR_SPREADSHEET_ID_HERE';
// ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲

// Optional: set a shared token for a minimal extra check.
// Because the frontend JavaScript is public, this is NOT real security.
// It only prevents totally accidental submissions. Leave empty to disable.
var SHARED_TOKEN = '';

// Name of the sheet (tab) within the spreadsheet.
var SHEET_NAME = 'תגובות';

// Column headers — order must match the row array built in doPost().
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
  'שלבי העבודה כיום',
  'מערכות / כלים',
  'העתקת מידע ידנית',
  'מאיפה לאיפה',
  'יש קבצים',
  'סוגי קבצים',
  'מיקום אחסון',
  'קשה למצוא מסמכים',
  'החלק הכי מעיק',
  'מה לוקח הכי הרבה זמן',
  'איפה קורות טעויות',
  'קשה לעקוב סטטוס',
  'כפילויות',
  'תדירות',
  'זמן ממוצע לביצוע',
  'צרכי אוטומציה',
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
  'דירוג טעויות',
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
//  doPost – main entry point
// ============================================================
function doPost(e) {
  try {
    var data = parsePayload(e);

    // Optional token check
    if (SHARED_TOKEN && data.token !== SHARED_TOKEN) {
      return jsonResponse({ status: 'error', message: 'Unauthorized' }, 403);
    }

    var sheet = getOrCreateSheet();
    ensureHeaders(sheet);
    appendRow(sheet, data);

    return jsonResponse({ status: 'ok', message: 'Saved successfully' });

  } catch (err) {
    Logger.log('doPost error: ' + err.toString());
    return jsonResponse({ status: 'error', message: err.toString() }, 500);
  }
}

// ============================================================
//  parsePayload – supports URLEncoded (from fetch no-cors)
//  and raw JSON body
// ============================================================
function parsePayload(e) {
  if (!e) throw new Error('No event object received');

  // URLSearchParams form: payload=<json string>
  if (e.parameter && e.parameter.payload) {
    return JSON.parse(e.parameter.payload);
  }

  // Raw JSON body (alternative approach)
  if (e.postData && e.postData.contents) {
    var raw = e.postData.contents;
    // Try JSON first
    try { return JSON.parse(raw); } catch (_) {}
    // Try as URLSearchParams
    var params = {};
    raw.split('&').forEach(function(pair) {
      var parts = pair.split('=');
      if (parts.length === 2) {
        params[decodeURIComponent(parts[0])] = decodeURIComponent(parts[1].replace(/\+/g, ' '));
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
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }
  return sheet;
}

function ensureHeaders(sheet) {
  if (sheet.getLastRow() === 0) {
    var headerRange = sheet.getRange(1, 1, 1, HEADERS.length);
    headerRange.setValues([HEADERS]);
    headerRange.setFontWeight('bold');
    headerRange.setBackground('#1a3a5c');
    headerRange.setFontColor('#ffffff');
    sheet.setFrozenRows(1);
    // Auto-resize columns for readability
    sheet.setColumnWidths(1, HEADERS.length, 160);
  }
}

function appendRow(sheet, d) {
  // Build the row in the same order as HEADERS
  var row = [
    d.createdAt           || new Date().toISOString(),
    d.department          || '',
    d.team                || '',
    d.respondentName      || '',
    d.role                || '',
    d.contactPerson       || '',
    d.processName         || '',
    d.processGoal         || '',
    d.currentOwner        || '',
    d.otherInvolved       || '',
    d.processStart        || '',
    d.currentSteps        || '',
    d.systemsUsed         || '',
    d.manualCopy          || '',
    d.manualCopyDetails   || '',
    d.hasFiles            || '',
    d.fileTypes           || '',
    d.storageLocations    || '',
    d.hardToFind          || '',
    d.mainPainPoint       || '',
    d.timeTaking          || '',
    d.errorProne          || '',
    d.hardToTrack         || '',
    d.duplicateEntry      || '',
    d.frequency           || '',
    d.avgTime             || '',
    d.automationNeeds     || '',
    d.needsForm           || '',
    d.needsDashboard      || '',
    d.needsAlerts         || '',
    d.reportNeeded        || '',
    d.hasApprovals        || '',
    d.approvalDetails     || '',
    d.differentPermissions|| '',
    d.sensitiveInfo       || '',
    d.ratingManual        || '',
    d.ratingTime          || '',
    d.ratingErrors        || '',
    d.ratingUrgency       || '',
    d.ratingPeople        || '',
    d.mainProblem         || '',
    d.desiredFuture       || '',
    d.successDefinition   || '',
    d.additionalNotes     || '',
    d.userAgent           || '',
    JSON.stringify(d)
  ];

  sheet.appendRow(row);
}

// ============================================================
//  Helper: build a JSON ContentService response
// ============================================================
function jsonResponse(obj, statusCode) {
  var output = ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
  // Note: ContentService does not support custom HTTP status codes.
  // Errors are communicated via the status field in the JSON body.
  return output;
}

// ============================================================
//  doGet – simple health-check endpoint
// ============================================================
function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({ status: 'ok', message: 'Survey endpoint is live' }))
    .setMimeType(ContentService.MimeType.JSON);
}
