/* =============================================================
   script.js – Hebrew Automation Survey | nakama-software
   =============================================================
   CONFIGURATION — Google Apps Script Web App URL:
   ============================================================= */
const GOOGLE_SCRIPT_URL = "https://script.google.com/a/macros/nakama-software.com/s/AKfycbzHmeczkJ2P2LbF2ACvX3n5KAz6YaVViyP2uWAZDU_d8-ELB4-bTajtMbAEKu_DeXRH/exec";

/* ============================================================= */

const TOTAL_SECTIONS = 4;
const FIRST_PROCESS_SECTION = 2;
const PROCESS_SECTIONS_SELECTOR = '.form-section[data-section="2"], .form-section[data-section="3"]';

// Required process fields, listed in section order so the first
// invalid one found is also the earliest section to jump back to.
const PROCESS_REQUIRED_FIELD_IDS = ['processName', 'processGoal', 'currentSteps', 'mainPainPoint'];

let currentSection = 1;
let isSubmitting = false;
let processesList = [];

/* ---------- DOM references ---------- */
const form = document.getElementById('surveyForm');
const btnNext = document.getElementById('btnNext');
const btnPrev = document.getElementById('btnPrev');
const btnAddProcess = document.getElementById('btnAddProcess');
const btnSubmit = document.getElementById('btnSubmit');
const finalActions = document.getElementById('finalActions');
const progressBarFill = document.getElementById('progressBarFill');
const progressLabel = document.getElementById('progressLabel');
const progressPercent = document.getElementById('progressPercent');
const successScreen = document.getElementById('successScreen');
const successMessage = document.getElementById('successMessage');
const errorBanner = document.getElementById('errorBanner');
const errorBannerText = document.getElementById('errorBannerText');
const errorClose = document.getElementById('errorClose');
const btnNewSurvey = document.getElementById('btnNewSurvey');
const processTracker = document.getElementById('processTracker');
const processTrackerTitle = document.getElementById('processTrackerTitle');
const processTrackerList = document.getElementById('processTrackerList');
const toast = document.getElementById('toast');
const summaryDepartment = document.getElementById('summaryDepartment');
const summaryRespondentNameRow = document.getElementById('summaryRespondentNameRow');
const summaryRespondentName = document.getElementById('summaryRespondentName');
const summaryProcessCount = document.getElementById('summaryProcessCount');
const summaryCurrentProcess = document.getElementById('summaryCurrentProcess');

const DEFAULT_ERROR_MESSAGE_HTML = errorBannerText.innerHTML;

/* ============================================================
   Section navigation
   ============================================================ */
function showSection(n) {
  document.querySelectorAll('.form-section').forEach(s => s.classList.remove('active'));
  const target = document.querySelector(`.form-section[data-section="${n}"]`);
  if (target) target.classList.add('active');

  currentSection = n;
  updateProgress();
  updateNavButtons();
  processTracker.style.display = n === 1 ? 'none' : 'block';
  if (n === TOTAL_SECTIONS) renderFinalSummary();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function updateProgress() {
  const pct = Math.round((currentSection / TOTAL_SECTIONS) * 100);
  progressBarFill.style.width = pct + '%';
  progressLabel.textContent = `שלב ${currentSection} מתוך ${TOTAL_SECTIONS}`;
  progressPercent.textContent = pct + '%';

  document.querySelectorAll('.nav-dot').forEach(dot => {
    const n = parseInt(dot.dataset.section);
    dot.classList.remove('active', 'completed');
    if (n === currentSection) dot.classList.add('active');
    else if (n < currentSection) dot.classList.add('completed');
  });
}

function updateNavButtons() {
  const isLastSection = currentSection === TOTAL_SECTIONS;
  btnPrev.style.display = currentSection > 1 ? 'inline-flex' : 'none';
  btnNext.style.display = isLastSection ? 'none' : 'inline-flex';
  finalActions.style.display = isLastSection ? 'flex' : 'none';
}

/* ============================================================
   Validation
   ============================================================ */
function getRequiredFieldsInSection(sectionNum) {
  const section = document.querySelector(`.form-section[data-section="${sectionNum}"]`);
  if (!section) return [];
  return Array.from(section.querySelectorAll('[required]'));
}

function validateSection(sectionNum) {
  const requiredFields = getRequiredFieldsInSection(sectionNum);
  let valid = true;

  requiredFields.forEach(field => {
    const errorEl = document.getElementById(field.id + '-error');
    if (!field.value.trim()) {
      field.classList.add('invalid');
      if (errorEl) errorEl.classList.add('visible');
      valid = false;
    } else {
      field.classList.remove('invalid');
      if (errorEl) errorEl.classList.remove('visible');
    }
  });

  if (!valid) {
    const firstInvalid = document.querySelector(`.form-section[data-section="${sectionNum}"] .invalid`);
    if (firstInvalid) firstInvalid.focus();
  }

  return valid;
}

/* General respondent details: department (text) + respondentType (radio). */
function validateGeneralFields() {
  let valid = true;

  const deptField = document.getElementById('department');
  const deptError = document.getElementById('department-error');
  if (!deptField.value.trim()) {
    deptField.classList.add('invalid');
    if (deptError) deptError.classList.add('visible');
    valid = false;
  } else {
    deptField.classList.remove('invalid');
    if (deptError) deptError.classList.remove('visible');
  }

  const respondentTypeChecked = document.querySelector('input[name="respondentType"]:checked');
  const respondentTypeError = document.getElementById('respondentType-error');
  if (!respondentTypeChecked) {
    if (respondentTypeError) respondentTypeError.classList.add('visible');
    valid = false;
  } else if (respondentTypeError) {
    respondentTypeError.classList.remove('visible');
  }

  if (!valid) {
    showSection(1);
    if (!deptField.value.trim()) deptField.focus();
  }

  return valid;
}

/* Used for "הבא" / nav-dot forward navigation: step 1 has special-cased
   fields (the respondentType radio group) that validateSection() can't
   check generically, so it always goes through validateGeneralFields(). */
function validateActiveSection() {
  return currentSection === 1 ? validateGeneralFields() : validateSection(currentSection);
}

/* Validates every required process/summary field across both process
   sections (not just the currently visible one), so "הוסף תהליך נוסף" /
   "שלח סקר" catch missing required fields even if the user jumped
   straight to the last section via the section-nav dots. Jumps to the
   first offending section so the user can fix it. */
function validateProcessFields() {
  let valid = true;
  let firstInvalidSection = null;

  PROCESS_REQUIRED_FIELD_IDS.forEach(id => {
    const field = document.getElementById(id);
    if (!field) return;
    const errorEl = document.getElementById(id + '-error');

    if (!field.value.trim()) {
      field.classList.add('invalid');
      if (errorEl) errorEl.classList.add('visible');
      valid = false;
      if (firstInvalidSection === null) {
        const section = field.closest('.form-section');
        if (section) firstInvalidSection = parseInt(section.dataset.section);
      }
    } else {
      field.classList.remove('invalid');
      if (errorEl) errorEl.classList.remove('visible');
    }
  });

  if (!valid && firstInvalidSection !== null) {
    showSection(firstInvalidSection);
    const firstInvalid = document.querySelector('.invalid');
    if (firstInvalid) firstInvalid.focus();
  }

  return valid;
}

/* Clear validation state on input */
form.addEventListener('input', e => {
  if (e.target.matches('[required]') && e.target.value.trim()) {
    e.target.classList.remove('invalid');
    const errorEl = document.getElementById(e.target.id + '-error');
    if (errorEl) errorEl.classList.remove('visible');
  }
});

/* ============================================================
   Navigation events
   ============================================================ */
btnNext.addEventListener('click', () => {
  if (validateActiveSection()) showSection(currentSection + 1);
});

btnPrev.addEventListener('click', () => {
  showSection(currentSection - 1);
});

document.querySelectorAll('.nav-dot').forEach(dot => {
  dot.addEventListener('click', () => {
    const target = parseInt(dot.dataset.section);
    if (target < currentSection) {
      showSection(target);
    } else if (target > currentSection) {
      if (validateActiveSection()) showSection(target);
    }
  });
});

/* ============================================================
   Respondent type -> department-manager conditional fields
   ============================================================ */
const DEPARTMENT_MANAGER_FIELD_IDS = [
  'departmentDescription', 'departmentResponsibilities', 'departmentEmployeeCount', 'departmentSubTeams'
];

document.querySelectorAll('input[name="respondentType"]').forEach(radio => {
  radio.addEventListener('change', () => {
    const group = document.getElementById('departmentManagerFields-group');
    const show = radio.value === 'מנהל מחלקה' && radio.checked;
    if (group) group.classList.toggle('visible', show);
    if (!show) {
      DEPARTMENT_MANAGER_FIELD_IDS.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
      });
    }
    const respondentTypeError = document.getElementById('respondentType-error');
    if (respondentTypeError) respondentTypeError.classList.remove('visible');
  });
});

/* ============================================================
   Generic "Other" field handler
   Applies to:
     - Checkboxes: data-other-target="<fieldId>"
     - Selects:    data-other-target="<fieldId>"  (triggers when value === "אחר")
   ============================================================ */
function initOtherFields() {
  /* Checkboxes with data-other-target */
  document.querySelectorAll('input[type="checkbox"][data-other-target]').forEach(cb => {
    cb.addEventListener('change', () => {
      toggleOtherContainer(cb.dataset.otherTarget, cb.checked);
    });
  });

  /* Selects with data-other-target */
  document.querySelectorAll('select[data-other-target]').forEach(sel => {
    sel.addEventListener('change', () => {
      toggleOtherContainer(sel.dataset.otherTarget, sel.value === 'אחר');
    });
  });
}

function toggleOtherContainer(targetId, show) {
  const container = document.getElementById(targetId + '-container');
  const input = document.getElementById(targetId);
  if (!container) return;
  container.classList.toggle('visible', show);
  if (!show && input) input.value = '';
}

/* ============================================================
   Conditional fields (yes/no triggers — not "other" pattern)
   ============================================================ */
document.querySelectorAll('input[name="manualCopy"]').forEach(radio => {
  radio.addEventListener('change', () => {
    const group = document.getElementById('manualCopyDetails-group');
    if (group) group.classList.toggle('visible', radio.value === 'כן' && radio.checked);
  });
});

document.querySelectorAll('input[name="hasApprovals"]').forEach(radio => {
  radio.addEventListener('change', () => {
    const group = document.getElementById('approvalDetails-group');
    if (group) group.classList.toggle('visible', radio.value === 'כן' && radio.checked);
  });
});

/* ============================================================
   Collect form data
   ============================================================ */
function getCheckedValues(name) {
  return Array.from(document.querySelectorAll(`input[name="${name}"]:checked`))
    .map(el => el.value);
}

function getRadioValue(name) {
  const el = document.querySelector(`input[name="${name}"]:checked`);
  return el ? el.value : '';
}

function val(id) {
  const el = document.getElementById(id);
  if (!el) return '';
  // Guard: only read .value from actual form controls, never from label/div/span
  const tag = el.tagName;
  if (tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') {
    console.error('[survey] val() called on non-input element:', id, tag);
    return '';
  }
  return el.value.trim();
}

/* General respondent details — filled once per survey session. */
function collectRespondentData() {
  return {
    respondentType:               getRadioValue('respondentType'),
    department:                   val('department'),
    team:                         val('team'),
    respondentName:               val('respondentName'),
    role:                         val('role'),
    contactPerson:                val('contactPerson'),
    departmentDescription:        val('departmentDescription'),
    departmentResponsibilities:   val('departmentResponsibilities'),
    departmentEmployeeCount:      val('departmentEmployeeCount'),
    departmentSubTeams:           val('departmentSubTeams')
  };
}

/* The process currently in the form fields (steps 2-3: פרטי התהליך + סיכום חופשי). */
function collectProcessData() {
  return {
    processName:           val('processName'),
    processGoal:           val('processGoal'),
    currentOwner:          val('currentOwner'),
    otherInvolved:         val('otherInvolved'),

    processStart:          val('processStart'),
    processStartOther:     val('processStartOther'),
    currentSteps:          val('currentSteps'),
    systemsUsed:           getCheckedValues('systemsUsed').filter(v => v !== 'אחר').join(', '),
    systemsUsedOther:      val('systemsUsedOther'),
    manualCopy:            getRadioValue('manualCopy'),
    manualCopyDetails:     val('manualCopyDetails'),

    hasFiles:              getRadioValue('hasFiles'),
    fileTypes:             getCheckedValues('fileTypes').filter(v => v !== 'אחר').join(', '),
    fileTypesOther:        val('fileTypesOther'),
    storageLocations:      getCheckedValues('storageLocations').filter(v => v !== 'אחר').join(', '),
    storageLocationsOther: val('storageLocationsOther'),
    hardToFind:            getRadioValue('hardToFind'),

    mainPainPoint:         val('mainPainPoint'),
    timeTaking:            val('timeTaking'),
    errorProne:            val('errorProne'),
    hardToTrack:           getRadioValue('hardToTrack'),
    duplicateEntry:        getRadioValue('duplicateEntry'),
    frequency:             document.getElementById('frequency').value,
    frequencyOther:        val('frequencyOther'),
    avgTime:               val('avgTime'),

    automationNeeds:       getCheckedValues('automationNeeds').filter(v => v !== 'אחר').join(', '),
    automationNeedsOther:  val('automationNeedsOther'),
    needsForm:             getRadioValue('needsForm'),
    needsDashboard:        getRadioValue('needsDashboard'),
    needsAlerts:           getRadioValue('needsAlerts'),
    reportNeeded:          val('reportNeeded'),

    hasApprovals:          getRadioValue('hasApprovals'),
    approvalDetails:       val('approvalDetails'),
    differentPermissions:  getRadioValue('differentPermissions'),
    sensitiveInfo:         getRadioValue('sensitiveInfo'),

    ratingManual:          getRadioValue('ratingManual'),
    ratingTime:            getRadioValue('ratingTime'),
    ratingErrors:          getRadioValue('ratingErrors'),
    ratingUrgency:         getRadioValue('ratingUrgency'),
    ratingPeople:          getRadioValue('ratingPeople'),

    freeSummary:           val('freeSummary')
  };
}

function isProcessEmpty(process) {
  return Object.values(process).every(v => !v || (typeof v === 'string' && v.trim() === ''));
}

function clearProcessFields() {
  document.querySelectorAll(PROCESS_SECTIONS_SELECTOR).forEach(section => {
    section.querySelectorAll('input, textarea, select').forEach(field => {
      if (field.type === 'checkbox' || field.type === 'radio') {
        field.checked = false;
      } else {
        field.value = '';
      }
      field.classList.remove('invalid');
    });
    section.querySelectorAll('.field-error.visible').forEach(el => el.classList.remove('visible'));
  });

  document.querySelectorAll('.conditional-field').forEach(el => {
    // Only clear conditional fields that live inside the process/summary
    // sections — the department-manager fields in step 1 must survive
    // "הוסף תהליך נוסף" since respondent details are kept.
    if (el.closest(PROCESS_SECTIONS_SELECTOR)) el.classList.remove('visible');
  });
  document.querySelectorAll('.other-field-container').forEach(el => el.classList.remove('visible'));
}

/* ============================================================
   Process tracker (list of processes already added in this session)
   ============================================================ */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function renderProcessTracker() {
  const count = processesList.length;

  if (count === 0) {
    processTrackerTitle.textContent = 'עדיין לא נוספו תהליכים נוספים.';
    processTrackerList.innerHTML = '';
    processTrackerList.classList.remove('visible');
    return;
  }

  processTrackerTitle.textContent = count === 1
    ? 'נוסף תהליך אחד לסקר'
    : `נוספו ${count} תהליכים לסקר`;

  processTrackerList.innerHTML = processesList
    .map((p, i) => `<li>תהליך ${i + 1}: ${escapeHtml(p.processName || '(ללא שם)')}</li>`)
    .join('');
  processTrackerList.classList.add('visible');
}

/* ============================================================
   Final step (סיום) summary
   ============================================================ */
function renderFinalSummary() {
  const department = val('department');
  const respondentName = val('respondentName');
  const currentProcessName = val('processName');

  summaryDepartment.textContent = department || '—';

  if (respondentName) {
    summaryRespondentNameRow.style.display = 'flex';
    summaryRespondentName.textContent = respondentName;
  } else {
    summaryRespondentNameRow.style.display = 'none';
  }

  summaryProcessCount.textContent = String(processesList.length);
  summaryCurrentProcess.textContent = currentProcessName || '—';
}

/* ============================================================
   Toast
   ============================================================ */
let toastTimer = null;
function showToast(message) {
  toast.textContent = message;
  toast.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('visible'), 3200);
}

/* ============================================================
   Add another process
   ============================================================ */
btnAddProcess.addEventListener('click', () => {
  if (!validateProcessFields()) return;

  processesList.push(collectProcessData());
  clearProcessFields();
  renderProcessTracker();
  showToast('התהליך נוסף. ניתן למלא תהליך נוסף.');
  showSection(FIRST_PROCESS_SECTION);
});

/* ============================================================
   Form submission
   ============================================================ */
function setSubmitLoading(loading) {
  const btnText = btnSubmit.querySelector('.btn-text');
  const btnSpinner = btnSubmit.querySelector('.btn-loading');
  btnSubmit.disabled = loading;
  btnText.style.display = loading ? 'none' : 'inline';
  btnSpinner.style.display = loading ? 'inline-flex' : 'none';
}

function showError(messageHtml) {
  errorBannerText.innerHTML = messageHtml || DEFAULT_ERROR_MESSAGE_HTML;
  errorBanner.style.display = 'flex';
}
function hideError() { errorBanner.style.display = 'none'; }

errorClose.addEventListener('click', hideError);

function buildSubmissionPayload(processes) {
  return {
    respondent: collectRespondentData(),
    processes: processes,
    createdAt: new Date().toISOString(),
    userAgent: navigator.userAgent,
    pageUrl: window.location.href
  };
}

async function submitSurvey(payload) {
  /*
    Google Apps Script Web Apps have CORS restrictions.
    Using fetch with mode: "no-cors" (opaque response) avoids the preflight block.
    We cannot read the response body, so we optimistically treat a network-error-free
    request as success.
  */
  const params = new URLSearchParams();
  params.append('payload', JSON.stringify(payload));

  await fetch(GOOGLE_SCRIPT_URL, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString()
  });
}

function processCountLabel(count) {
  return count === 1 ? 'נשמר תהליך אחד.' : `נשמרו ${count} תהליכים.`;
}

form.addEventListener('submit', async e => {
  e.preventDefault();
  if (isSubmitting) return;

  hideError();

  if (!validateGeneralFields()) return;

  const currentProcess = collectProcessData();
  const currentIsEmpty = isProcessEmpty(currentProcess);
  const processesToSubmit = processesList.slice();

  if (!currentIsEmpty) {
    if (!validateProcessFields()) return;
    processesToSubmit.push(currentProcess);
  }

  if (processesToSubmit.length === 0) {
    showError('יש למלא לפחות תהליך אחד לפני שליחת הסקר.');
    showSection(FIRST_PROCESS_SECTION);
    return;
  }

  isSubmitting = true;
  setSubmitLoading(true);

  try {
    const payload = buildSubmissionPayload(processesToSubmit);
    console.table(processesToSubmit);
    await submitSurvey(payload);

    form.style.display = 'none';
    document.querySelector('.form-nav-buttons').style.display = 'none';
    processTracker.style.display = 'none';
    successMessage.textContent = `הסקר נשלח בהצלחה. ${processCountLabel(processesToSubmit.length)}`;
    successScreen.style.display = 'block';
    window.scrollTo({ top: 0, behavior: 'smooth' });

  } catch (err) {
    console.error('Submission error:', err);
    showError();
  } finally {
    isSubmitting = false;
    setSubmitLoading(false);
  }
});

/* ============================================================
   Reset for a completely new survey (after success)
   ============================================================ */
btnNewSurvey.addEventListener('click', () => {
  form.reset();
  processesList = [];
  renderProcessTracker();

  // Hide all conditional fields (department-manager section + "yes" triggers)
  document.querySelectorAll('.conditional-field').forEach(el => el.classList.remove('visible'));

  // Hide and clear all "other" containers
  document.querySelectorAll('.other-field-container').forEach(el => {
    el.classList.remove('visible');
    const input = el.querySelector('input, textarea');
    if (input) input.value = '';
  });

  // Clear validation states
  document.querySelectorAll('.invalid').forEach(el => el.classList.remove('invalid'));
  document.querySelectorAll('.field-error.visible').forEach(el => el.classList.remove('visible'));

  hideError();
  successScreen.style.display = 'none';
  form.style.display = 'block';
  document.querySelector('.form-nav-buttons').style.display = 'flex';

  currentSection = 1;
  isSubmitting = false;
  setSubmitLoading(false);
  showSection(1);
});

/* ============================================================
   Init
   ============================================================ */
initOtherFields();
renderProcessTracker();
showSection(1);
