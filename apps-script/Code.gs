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
  'מספר תהליך בסקר',
  'סה״כ תהליכים בסקר',
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

    var savedCount = saveSubmission(sheet, data);

    // Refresh the "דשבורד תיעדוף" prioritization dashboard after every
    // new response.
    //
    // PERFORMANCE NOTE: updateDashboard() re-reads and re-aggregates the
    // entire response sheet on every submission. That's fine for small
    // to medium survey volumes, but as the sheet grows into the
    // thousands of rows this can noticeably slow down doPost(). If
    // submissions start to feel slow, remove the call below and
    // instead either:
    //   1) run updateDashboard() manually from the "סקר אוטומציה" menu
    //      (see onOpen() further down), or
    //   2) install a time-based trigger that calls updateDashboard()
    //      on a schedule: Apps Script editor -> Triggers (clock icon)
    //      -> Add Trigger -> Choose function: updateDashboard ->
    //      Select event source: Time-driven -> pick an interval.
    //
    // A dashboard failure must never block saving the response, so
    // it's wrapped in its own try/catch and never rethrown.
    try {
      updateDashboard();
    } catch (dashErr) {
      Logger.log('updateDashboard error (response was still saved): ' + dashErr.toString());
    }

    return jsonResponse({ status: 'ok', message: 'Saved successfully', processesSaved: savedCount });

  } catch (err) {
    Logger.log('doPost error: ' + err.toString());
    return jsonResponse({ status: 'error', message: err.toString() });
  }
}

// ============================================================
//  saveSubmission
//
//  One employee/department may submit several processes in a single
//  survey session. The frontend sends payload.respondent (filled once)
//  plus payload.processes (an array, one entry per process). Each
//  process becomes its own row, with the respondent details duplicated
//  into every row. Returns the number of rows saved.
//
//  Backward compatible: if payload.processes isn't an array (the old,
//  pre-multi-process flat submission shape, where every field lived at
//  the top level of the payload), it's saved as a single row exactly
//  like before.
// ============================================================
function saveSubmission(sheet, data) {
  if (data && Array.isArray(data.processes) && data.processes.length > 0) {
    var respondent = data.respondent || {};
    var total = data.processes.length;

    data.processes.forEach(function (process, i) {
      appendProcessRow(sheet, {
        respondent: respondent,
        process: process,
        processNumber: i + 1,
        totalProcesses: total,
        createdAt: data.createdAt,
        userAgent: data.userAgent,
        pageUrl: data.pageUrl,
        rawJson: { respondent: respondent, process: process }
      });
    });

    return total;
  }

  // Legacy single-process payload: respondent + process fields all sat
  // together at the top level of `data`.
  appendProcessRow(sheet, {
    respondent: {
      department: data.department,
      team: data.team,
      respondentName: data.respondentName,
      role: data.role,
      contactPerson: data.contactPerson
    },
    process: data,
    processNumber: 1,
    totalProcesses: 1,
    createdAt: data.createdAt,
    userAgent: data.userAgent,
    pageUrl: data.pageUrl,
    rawJson: data
  });

  return 1;
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

// Appends a single process as one row, matching HEADERS exactly.
// opts: { respondent, process, processNumber, totalProcesses,
//         createdAt, userAgent, pageUrl, rawJson }
function appendProcessRow(sheet, opts) {
  var respondent = opts.respondent || {};
  var process = opts.process || {};

  var row = [
    new Date(),
    opts.createdAt                  || '',
    opts.processNumber              || '',
    opts.totalProcesses             || '',
    respondent.department           || '',
    respondent.team                 || '',
    respondent.respondentName       || '',
    respondent.role                 || '',
    respondent.contactPerson        || '',
    process.processName             || '',
    process.processGoal             || '',
    process.currentOwner            || '',
    process.otherInvolved           || '',
    process.processStart            || '',
    process.processStartOther       || '',
    process.currentSteps            || '',
    process.systemsUsed             || '',
    process.systemsUsedOther        || '',
    process.manualCopy              || '',
    process.manualCopyDetails       || '',
    process.hasFiles                || '',
    process.fileTypes               || '',
    process.fileTypesOther          || '',
    process.storageLocations        || '',
    process.storageLocationsOther   || '',
    process.hardToFind              || '',
    process.mainPainPoint           || '',
    process.timeTaking              || '',
    process.errorProne              || '',
    process.hardToTrack             || '',
    process.duplicateEntry          || '',
    process.frequency               || '',
    process.frequencyOther          || '',
    process.avgTime                 || '',
    process.automationNeeds         || '',
    process.automationNeedsOther    || '',
    process.needsForm               || '',
    process.needsDashboard          || '',
    process.needsAlerts             || '',
    process.reportNeeded            || '',
    process.hasApprovals            || '',
    process.approvalDetails         || '',
    process.differentPermissions    || '',
    process.sensitiveInfo           || '',
    process.ratingManual            || '',
    process.ratingTime              || '',
    process.ratingErrors            || '',
    process.ratingUrgency           || '',
    process.ratingPeople            || '',
    process.mainProblem             || '',
    process.desiredFuture           || '',
    process.successDefinition       || '',
    process.additionalNotes         || '',
    opts.pageUrl                    || '',
    opts.userAgent                  || '',
    JSON.stringify(opts.rawJson)
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

// ============================================================
//  Dashboard ("דשבורד תיעדוף") — automation priority summary
// ============================================================
var DASHBOARD_SHEET_NAME = 'דשבורד תיעדוף';

// Rating field -> Hebrew response-sheet header it reads from.
var RATING_FIELD_HEADERS = {
  manual:  'דירוג - כמה התהליך ידני',
  time:    'דירוג - כמה התהליך גוזל זמן',
  errors:  'דירוג - כמה שגיאות מתרחשות',
  urgency: 'דירוג - דחיפות השיפור',
  people:  'דירוג - כמות אנשים מושפעים'
};

// Priority score weights (must sum to 1).
var PRIORITY_WEIGHTS = {
  manual: 0.25,
  time: 0.25,
  errors: 0.20,
  urgency: 0.20,
  people: 0.10
};

// Charts show only the top N rows for readability; the tables above
// them always include every department / process / combination.
var DASHBOARD_CHART_TOP_N = 10;

// Column where the compact chart-source tables are written, kept far
// enough to the right that floating charts never cover them.
var DASHBOARD_CHART_DATA_COL = 16;

/**
 * Rebuilds the "דשבורד תיעדוף" sheet: summary tables by department,
 * process, and department+process — each sorted by a weighted
 * priority score — plus charts. Safe to call repeatedly: it fully
 * clears and rewrites the dashboard sheet every time it runs.
 */
function updateDashboard() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var responseSheet = ss.getSheetByName(SHEET_NAME);
  var dashboard = getOrCreateDashboardSheet(ss);

  if (!responseSheet || responseSheet.getLastRow() < 2) {
    renderEmptyDashboard(dashboard);
    return;
  }

  var data = responseSheet.getDataRange().getValues();
  var headerRow = data[0];
  var rows = parseResponseRows(headerRow, data.slice(1));

  if (!rows) {
    renderEmptyDashboard(
      dashboard,
      'לא נמצאו עמודות "שם המחלקה" ו/או "שם התהליך / המשימה" בגיליון "' + SHEET_NAME + '".'
    );
    return;
  }

  var byDepartment = summarize(rows, function (r) {
    return r.department ? { id: r.department, department: r.department, process: '' } : null;
  });
  var byProcess = summarize(rows, function (r) {
    return r.process ? { id: r.process, department: '', process: r.process } : null;
  });
  var byDeptProcess = summarize(rows, function (r) {
    if (!r.department || !r.process) return null;
    return { id: r.department + ' || ' + r.process, department: r.department, process: r.process };
  });

  renderDashboard(dashboard, byDepartment, byProcess, byDeptProcess);
}

// ------------------------------------------------------------
//  Data collection
// ------------------------------------------------------------
function parseResponseRows(headerRow, dataRows) {
  var idx = {
    department: headerRow.indexOf('שם המחלקה'),
    process: headerRow.indexOf('שם התהליך / המשימה')
  };
  Object.keys(RATING_FIELD_HEADERS).forEach(function (field) {
    idx[field] = headerRow.indexOf(RATING_FIELD_HEADERS[field]);
  });

  if (idx.department === -1 || idx.process === -1) return null;

  return dataRows.map(function (r) {
    var ratings = {};
    Object.keys(RATING_FIELD_HEADERS).forEach(function (field) {
      ratings[field] = idx[field] === -1 ? null : parseRatingValue(r[idx[field]]);
    });
    return {
      department: cleanText(r[idx.department]),
      process: cleanText(r[idx.process]),
      ratings: ratings
    };
  });
}

function cleanText(v) {
  return (v === null || v === undefined) ? '' : v.toString().trim();
}

// Returns a number 1-5, or null for empty/invalid values so they're
// safely excluded from averages instead of corrupting the math.
function parseRatingValue(v) {
  if (v === '' || v === null || v === undefined) return null;
  var n = Number(v);
  if (isNaN(n) || n < 1 || n > 5) return null;
  return n;
}

// ------------------------------------------------------------
//  Aggregation
// ------------------------------------------------------------
function summarize(rows, keyFn) {
  var groups = {};
  var fields = Object.keys(RATING_FIELD_HEADERS);

  rows.forEach(function (r) {
    var key = keyFn(r);
    if (!key) return;
    if (!groups[key.id]) {
      groups[key.id] = {
        department: key.department,
        process: key.process,
        responses: 0,
        sums: { manual: 0, time: 0, errors: 0, urgency: 0, people: 0 },
        counts: { manual: 0, time: 0, errors: 0, urgency: 0, people: 0 }
      };
    }
    var g = groups[key.id];
    g.responses += 1;
    fields.forEach(function (field) {
      var v = r.ratings[field];
      if (v !== null) {
        g.sums[field] += v;
        g.counts[field] += 1;
      }
    });
  });

  var summaries = Object.keys(groups).map(function (id) {
    var g = groups[id];
    var avg = {};
    fields.forEach(function (field) {
      avg[field] = g.counts[field] > 0 ? g.sums[field] / g.counts[field] : 0;
    });
    var score = round2(
      avg.manual  * PRIORITY_WEIGHTS.manual +
      avg.time    * PRIORITY_WEIGHTS.time +
      avg.errors  * PRIORITY_WEIGHTS.errors +
      avg.urgency * PRIORITY_WEIGHTS.urgency +
      avg.people  * PRIORITY_WEIGHTS.people
    );
    return {
      department: g.department,
      process: g.process,
      responses: g.responses,
      avgManual: round2(avg.manual),
      avgTime: round2(avg.time),
      avgErrors: round2(avg.errors),
      avgUrgency: round2(avg.urgency),
      avgPeople: round2(avg.people),
      score: score
    };
  });

  summaries.sort(function (a, b) { return b.score - a.score; });
  return summaries;
}

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// ------------------------------------------------------------
//  Sheet rendering
// ------------------------------------------------------------
function getOrCreateDashboardSheet(ss) {
  var sheet = ss.getSheetByName(DASHBOARD_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(DASHBOARD_SHEET_NAME);
  } else {
    sheet.getCharts().forEach(function (chart) { sheet.removeChart(chart); });
    sheet.clear();
  }
  return sheet;
}

function renderEmptyDashboard(sheet, message) {
  sheet.getRange(1, 1).setValue('דשבורד תיעדוף לאוטומציה ודיגיטציה').setFontWeight('bold').setFontSize(16);
  sheet.getRange(2, 1)
    .setValue(message || ('אין עדיין תשובות בגיליון "' + SHEET_NAME + '" להצגה בדשבורד.'))
    .setFontStyle('italic').setFontColor('#64748b');
  sheet.setFrozenRows(1);
  sheet.setColumnWidth(1, 360);
}

function renderDashboard(sheet, byDepartment, byProcess, byDeptProcess) {
  var row = 1;

  sheet.getRange(row, 1).setValue('דשבורד תיעדוף לאוטומציה ודיגיטציה').setFontWeight('bold').setFontSize(16);
  row += 1;
  sheet.getRange(row, 1)
    .setValue('עודכן לאחרונה: ' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm'))
    .setFontStyle('italic').setFontColor('#64748b');
  row += 2;

  var deptTable = writeSummaryTable(
    sheet, row, 'סיכום לפי מחלקה',
    ['מחלקה', 'כמות תשובות', 'ממוצע ידניות', 'ממוצע זמן', 'ממוצע שגיאות', 'ממוצע דחיפות', 'ממוצע השפעה על אנשים', 'ציון תיעדוף כולל'],
    byDepartment,
    function (g) { return [g.department, g.responses, g.avgManual, g.avgTime, g.avgErrors, g.avgUrgency, g.avgPeople, g.score]; }
  );
  row = deptTable.nextRow + 2;

  var processTable = writeSummaryTable(
    sheet, row, 'סיכום לפי תהליך',
    ['תהליך', 'כמות תשובות', 'ממוצע ידניות', 'ממוצע זמן', 'ממוצע שגיאות', 'ממוצע דחיפות', 'ממוצע השפעה על אנשים', 'ציון תיעדוף כולל'],
    byProcess,
    function (g) { return [g.process, g.responses, g.avgManual, g.avgTime, g.avgErrors, g.avgUrgency, g.avgPeople, g.score]; }
  );
  row = processTable.nextRow + 2;

  var comboTable = writeSummaryTable(
    sheet, row, 'סיכום לפי מחלקה ותהליך',
    ['מחלקה', 'תהליך', 'כמות תשובות', 'ממוצע ידניות', 'ממוצע זמן', 'ממוצע שגיאות', 'ממוצע דחיפות', 'ממוצע השפעה על אנשים', 'ציון תיעדוף כולל'],
    byDeptProcess,
    function (g) { return [g.department, g.process, g.responses, g.avgManual, g.avgTime, g.avgErrors, g.avgUrgency, g.avgPeople, g.score]; }
  );
  row = comboTable.nextRow + 2;

  var chartCol = DASHBOARD_CHART_DATA_COL;
  var chartRow = 1;

  var deptChartData = writeChartSourceTable(
    sheet, chartRow, chartCol, 'נתוני עזר לתרשים - מחלקות מובילות',
    ['מחלקה', 'ציון תיעדוף'],
    byDepartment.slice(0, DASHBOARD_CHART_TOP_N),
    function (g) { return [g.department, g.score]; }
  );
  chartRow = deptChartData.nextRow + 2;

  var processChartData = writeChartSourceTable(
    sheet, chartRow, chartCol, 'נתוני עזר לתרשים - תהליכים מובילים',
    ['תהליך', 'ציון תיעדוף'],
    byProcess.slice(0, DASHBOARD_CHART_TOP_N),
    function (g) { return [g.process, g.score]; }
  );
  chartRow = processChartData.nextRow + 2;

  var comboChartData = writeChartSourceTable(
    sheet, chartRow, chartCol, 'נתוני עזר לתרשים - שילובי מחלקה ותהליך מובילים',
    ['מחלקה ותהליך', 'ציון תיעדוף'],
    byDeptProcess.slice(0, DASHBOARD_CHART_TOP_N),
    function (g) { return [g.department + ' - ' + g.process, g.score]; }
  );
  chartRow = comboChartData.nextRow + 2;

  var ratingBreakdownData = writeChartSourceTable(
    sheet, chartRow, chartCol, 'נתוני עזר לתרשים - פירוט דירוגים ממוצעים לפי מחלקה',
    ['מחלקה', 'ידניות', 'זמן', 'שגיאות', 'דחיפות', 'השפעה על אנשים'],
    byDepartment.slice(0, DASHBOARD_CHART_TOP_N),
    function (g) { return [g.department, g.avgManual, g.avgTime, g.avgErrors, g.avgUrgency, g.avgPeople]; }
  );

  buildDashboardCharts(sheet, {
    deptChartData: deptChartData,
    processChartData: processChartData,
    comboChartData: comboChartData,
    ratingBreakdownData: ratingBreakdownData
  }, row);

  formatDashboard(sheet, chartCol);
}

function writeSummaryTable(sheet, startRow, title, headers, groups, mapper) {
  sheet.getRange(startRow, 1).setValue(title).setFontWeight('bold').setFontSize(13).setFontColor('#0b2d45');
  var headerRowIdx = startRow + 1;
  var numCols = headers.length;
  var headerRange = sheet.getRange(headerRowIdx, 1, 1, numCols);
  headerRange.setValues([headers]);
  headerRange.setFontWeight('bold').setBackground('#061b33').setFontColor('#ffffff');

  var firstDataRow = headerRowIdx + 1;
  var lastDataRow;

  if (groups.length > 0) {
    var values = groups.map(mapper);
    sheet.getRange(firstDataRow, 1, values.length, numCols).setValues(values);
    lastDataRow = firstDataRow + values.length - 1;
  } else {
    sheet.getRange(firstDataRow, 1).setValue('אין נתונים עדיין').setFontStyle('italic').setFontColor('#94a3b8');
    lastDataRow = firstDataRow;
  }

  return {
    titleRow: startRow,
    headerRow: headerRowIdx,
    firstDataRow: firstDataRow,
    lastDataRow: lastDataRow,
    numCols: numCols,
    rowCount: groups.length,
    nextRow: lastDataRow + 1
  };
}

function writeChartSourceTable(sheet, startRow, startCol, title, headers, groups, mapper) {
  sheet.getRange(startRow, startCol)
    .setValue(title).setFontWeight('bold').setFontStyle('italic').setFontColor('#64748b');
  var headerRowIdx = startRow + 1;
  var numCols = headers.length;
  sheet.getRange(headerRowIdx, startCol, 1, numCols).setValues([headers]).setFontWeight('bold');

  var firstDataRow = headerRowIdx + 1;
  var lastDataRow;
  if (groups.length > 0) {
    var values = groups.map(mapper);
    sheet.getRange(firstDataRow, startCol, values.length, numCols).setValues(values);
    lastDataRow = firstDataRow + values.length - 1;
  } else {
    lastDataRow = headerRowIdx;
  }

  return {
    startCol: startCol,
    headerRow: headerRowIdx,
    firstDataRow: firstDataRow,
    lastDataRow: lastDataRow,
    numCols: numCols,
    rowCount: groups.length,
    nextRow: lastDataRow + 1
  };
}

// ------------------------------------------------------------
//  Charts
// ------------------------------------------------------------
function buildDashboardCharts(sheet, t, chartsStartRow) {
  var leftCol = 1;
  var rightCol = 9;
  var secondRow = chartsStartRow + 20;

  if (t.deptChartData.rowCount > 0) {
    insertColumnChart(
      sheet, 'מחלקות מובילות לפי ציון תיעדוף',
      sheet.getRange(t.deptChartData.headerRow, t.deptChartData.startCol, t.deptChartData.rowCount + 1, 1),
      sheet.getRange(t.deptChartData.headerRow, t.deptChartData.startCol + 1, t.deptChartData.rowCount + 1, 1),
      chartsStartRow, leftCol, '#0891b2'
    );
  }

  if (t.processChartData.rowCount > 0) {
    insertColumnChart(
      sheet, 'תהליכים מובילים לפי ציון תיעדוף',
      sheet.getRange(t.processChartData.headerRow, t.processChartData.startCol, t.processChartData.rowCount + 1, 1),
      sheet.getRange(t.processChartData.headerRow, t.processChartData.startCol + 1, t.processChartData.rowCount + 1, 1),
      chartsStartRow, rightCol, '#16a34a'
    );
  }

  if (t.comboChartData.rowCount > 0) {
    insertBarChart(
      sheet, 'שילובי מחלקה ותהליך מובילים',
      sheet.getRange(t.comboChartData.headerRow, t.comboChartData.startCol, t.comboChartData.rowCount + 1, 1),
      sheet.getRange(t.comboChartData.headerRow, t.comboChartData.startCol + 1, t.comboChartData.rowCount + 1, 1),
      secondRow, leftCol, '#0e7490'
    );
  }

  if (t.ratingBreakdownData.rowCount > 0) {
    insertMultiSeriesColumnChart(
      sheet, 'פירוט דירוגים ממוצעים לפי מחלקה',
      sheet.getRange(
        t.ratingBreakdownData.headerRow, t.ratingBreakdownData.startCol,
        t.ratingBreakdownData.rowCount + 1, t.ratingBreakdownData.numCols
      ),
      secondRow, rightCol
    );
  }
}

function insertColumnChart(sheet, title, labelRange, valueRange, anchorRow, anchorCol, color) {
  var chart = sheet.newChart()
    .setChartType(Charts.ChartType.COLUMN)
    .addRange(labelRange)
    .addRange(valueRange)
    .setNumHeaders(1)
    .setPosition(anchorRow, anchorCol, 0, 0)
    .setOption('title', title)
    .setOption('legend', { position: 'none' })
    .setOption('width', 520)
    .setOption('height', 320)
    .setOption('colors', [color])
    .build();
  sheet.insertChart(chart);
}

function insertBarChart(sheet, title, labelRange, valueRange, anchorRow, anchorCol, color) {
  var chart = sheet.newChart()
    .setChartType(Charts.ChartType.BAR)
    .addRange(labelRange)
    .addRange(valueRange)
    .setNumHeaders(1)
    .setPosition(anchorRow, anchorCol, 0, 0)
    .setOption('title', title)
    .setOption('legend', { position: 'none' })
    .setOption('width', 520)
    .setOption('height', 320)
    .setOption('colors', [color])
    .build();
  sheet.insertChart(chart);
}

function insertMultiSeriesColumnChart(sheet, title, fullRange, anchorRow, anchorCol) {
  var chart = sheet.newChart()
    .setChartType(Charts.ChartType.COLUMN)
    .addRange(fullRange)
    .setNumHeaders(1)
    .setPosition(anchorRow, anchorCol, 0, 0)
    .setOption('title', title)
    .setOption('legend', { position: 'top' })
    .setOption('width', 520)
    .setOption('height', 320)
    .build();
  sheet.insertChart(chart);
}

// ------------------------------------------------------------
//  Formatting
// ------------------------------------------------------------
function formatDashboard(sheet, chartDataCol) {
  sheet.setFrozenRows(1);

  sheet.setColumnWidth(1, 210);
  sheet.setColumnWidth(2, 210);
  for (var c = 3; c <= 9; c++) {
    sheet.setColumnWidth(c, 140);
  }
  for (var sp = 10; sp < chartDataCol; sp++) {
    sheet.setColumnWidth(sp, 24);
  }
  for (var cc = chartDataCol; cc <= chartDataCol + 5; cc++) {
    sheet.setColumnWidth(cc, 150);
  }

  var lastRow = sheet.getLastRow();
  var lastCol = chartDataCol + 5;
  if (lastRow > 0) {
    try {
      sheet.getRange(1, 1, lastRow, lastCol).setTextDirection(SpreadsheetApp.TextDirection.RIGHT_TO_LEFT);
    } catch (e) {
      // setTextDirection isn't available in every Sheets locale/runtime; safe to skip.
    }
  }
}

// ------------------------------------------------------------
//  Custom menu
// ------------------------------------------------------------
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('סקר אוטומציה')
    .addItem('רענון דשבורד', 'updateDashboard')
    .addToUi();
}
