/* =============================================================
   script.js – Hebrew Automation Survey
   =============================================================
   CONFIGURATION — paste your deployed Web App URL here:
   ============================================================= */
const GOOGLE_SCRIPT_URL = 'YOUR_GOOGLE_SCRIPT_URL_HERE';
// Example:
// const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby.../exec';

/* ============================================================= */

const TOTAL_SECTIONS = 9;
let currentSection = 1;
let isSubmitting = false;

/* ---------- DOM references ---------- */
const form = document.getElementById('surveyForm');
const btnNext = document.getElementById('btnNext');
const btnPrev = document.getElementById('btnPrev');
const btnSubmit = document.getElementById('btnSubmit');
const progressBarFill = document.getElementById('progressBarFill');
const progressLabel = document.getElementById('progressLabel');
const progressPercent = document.getElementById('progressPercent');
const successScreen = document.getElementById('successScreen');
const errorBanner = document.getElementById('errorBanner');
const errorClose = document.getElementById('errorClose');
const btnNewSurvey = document.getElementById('btnNewSurvey');

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
  btnPrev.style.display = currentSection > 1 ? 'inline-flex' : 'none';
  btnNext.style.display = currentSection < TOTAL_SECTIONS ? 'inline-flex' : 'none';
  btnSubmit.style.display = currentSection === TOTAL_SECTIONS ? 'inline-flex' : 'none';
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

/* Clear validation state on input */
form.addEventListener('input', e => {
  if (e.target.matches('[required]')) {
    if (e.target.value.trim()) {
      e.target.classList.remove('invalid');
      const errorEl = document.getElementById(e.target.id + '-error');
      if (errorEl) errorEl.classList.remove('visible');
    }
  }
});

/* ============================================================
   Navigation events
   ============================================================ */
btnNext.addEventListener('click', () => {
  if (validateSection(currentSection)) {
    showSection(currentSection + 1);
  }
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
      if (validateSection(currentSection)) showSection(target);
    }
  });
});

/* ============================================================
   Conditional fields
   ============================================================ */

// "מעתיקים מידע ידנית?" → show details textarea when כן
document.querySelectorAll('input[name="manualCopy"]').forEach(radio => {
  radio.addEventListener('change', () => {
    const group = document.getElementById('manualCopyDetails-group');
    if (group) {
      group.classList.toggle('visible', radio.value === 'כן' && radio.checked);
    }
  });
});

// "האם יש אישורים?" → show details textarea when כן
document.querySelectorAll('input[name="hasApprovals"]').forEach(radio => {
  radio.addEventListener('change', () => {
    const group = document.getElementById('approvalDetails-group');
    if (group) {
      group.classList.toggle('visible', radio.value === 'כן' && radio.checked);
    }
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

function collectFormData() {
  return {
    // Section 1
    department: document.getElementById('department').value.trim(),
    team: document.getElementById('team').value.trim(),
    respondentName: document.getElementById('respondentName').value.trim(),
    role: document.getElementById('role').value.trim(),
    contactPerson: document.getElementById('contactPerson').value.trim(),

    // Section 2
    processName: document.getElementById('processName').value.trim(),
    processGoal: document.getElementById('processGoal').value.trim(),
    currentOwner: document.getElementById('currentOwner').value.trim(),
    otherInvolved: document.getElementById('otherInvolved').value.trim(),

    // Section 3
    processStart: document.getElementById('processStart').value,
    currentSteps: document.getElementById('currentSteps').value.trim(),
    systemsUsed: getCheckedValues('systemsUsed').join(', '),
    manualCopy: getRadioValue('manualCopy'),
    manualCopyDetails: document.getElementById('manualCopyDetails').value.trim(),

    // Section 4
    hasFiles: getRadioValue('hasFiles'),
    fileTypes: getCheckedValues('fileTypes').join(', '),
    storageLocations: getCheckedValues('storageLocations').join(', '),
    hardToFind: getRadioValue('hardToFind'),

    // Section 5
    mainPainPoint: document.getElementById('mainPainPoint').value.trim(),
    timeTaking: document.getElementById('timeTaking').value.trim(),
    errorProne: document.getElementById('errorProne').value.trim(),
    hardToTrack: getRadioValue('hardToTrack'),
    duplicateEntry: getRadioValue('duplicateEntry'),
    frequency: document.getElementById('frequency').value,
    avgTime: document.getElementById('avgTime').value.trim(),

    // Section 6
    automationNeeds: getCheckedValues('automationNeeds').join(', '),
    needsForm: getRadioValue('needsForm'),
    needsDashboard: getRadioValue('needsDashboard'),
    needsAlerts: getRadioValue('needsAlerts'),
    reportNeeded: document.getElementById('reportNeeded').value.trim(),

    // Section 7
    hasApprovals: getRadioValue('hasApprovals'),
    approvalDetails: document.getElementById('approvalDetails').value.trim(),
    differentPermissions: getRadioValue('differentPermissions'),
    sensitiveInfo: getRadioValue('sensitiveInfo'),

    // Section 8 – ratings
    ratingManual: getRadioValue('ratingManual'),
    ratingTime: getRadioValue('ratingTime'),
    ratingErrors: getRadioValue('ratingErrors'),
    ratingUrgency: getRadioValue('ratingUrgency'),
    ratingPeople: getRadioValue('ratingPeople'),

    // Section 9
    mainProblem: document.getElementById('mainProblem').value.trim(),
    desiredFuture: document.getElementById('desiredFuture').value.trim(),
    successDefinition: document.getElementById('successDefinition').value.trim(),
    additionalNotes: document.getElementById('additionalNotes').value.trim(),

    // Metadata
    createdAt: new Date().toISOString(),
    userAgent: navigator.userAgent,
    pageUrl: window.location.href
  };
}

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

function showError() {
  errorBanner.style.display = 'flex';
}

function hideError() {
  errorBanner.style.display = 'none';
}

errorClose.addEventListener('click', hideError);

async function submitSurvey(data) {
  /*
    Google Apps Script Web Apps have CORS restrictions when deployed as "Anyone".
    We use fetch with mode: "no-cors" (opaque response) to avoid the preflight block.
    With no-cors, we cannot read the response body, so we optimistically assume
    success after the request completes without a network error.

    If the script URL is not configured, we fall through to an error.
  */

  if (!GOOGLE_SCRIPT_URL || GOOGLE_SCRIPT_URL === 'YOUR_GOOGLE_SCRIPT_URL_HERE') {
    console.error('GOOGLE_SCRIPT_URL is not configured in script.js');
    throw new Error('כתובת ה-Google Script לא הוגדרה. פנו למנהל המערכת.');
  }

  const params = new URLSearchParams();
  params.append('payload', JSON.stringify(data));

  await fetch(GOOGLE_SCRIPT_URL, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString()
  });
  // With no-cors we receive an opaque response; the request reached the server.
}

form.addEventListener('submit', async e => {
  e.preventDefault();

  if (isSubmitting) return;

  if (!validateSection(TOTAL_SECTIONS)) return;

  isSubmitting = true;
  hideError();
  setSubmitLoading(true);

  try {
    const data = collectFormData();
    await submitSurvey(data);

    // Show success
    form.style.display = 'none';
    document.querySelector('.form-nav-buttons').style.display = 'none';
    successScreen.style.display = 'block';
    window.scrollTo({ top: 0, behavior: 'smooth' });

  } catch (err) {
    console.error('Submission error:', err);
    showError();
    isSubmitting = false;
    setSubmitLoading(false);
  }
});

/* ============================================================
   Reset for new survey
   ============================================================ */
btnNewSurvey.addEventListener('click', () => {
  form.reset();
  // Hide conditional fields
  document.querySelectorAll('.conditional-field').forEach(el => el.classList.remove('visible'));
  // Clear invalid states
  document.querySelectorAll('.invalid').forEach(el => el.classList.remove('invalid'));
  document.querySelectorAll('.field-error.visible').forEach(el => el.classList.remove('visible'));

  successScreen.style.display = 'none';
  form.style.display = 'block';
  document.querySelector('.form-nav-buttons').style.display = 'flex';

  currentSection = 1;
  isSubmitting = false;
  showSection(1);
});

/* ============================================================
   Init
   ============================================================ */
showSection(1);
