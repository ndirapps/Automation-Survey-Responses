/* =============================================================
   script.js – Hebrew Automation Survey | nakama-software
   =============================================================
   CONFIGURATION — Google Apps Script Web App URL:
   ============================================================= */
const GOOGLE_SCRIPT_URL = "https://script.google.com/a/macros/nakama-software.com/s/AKfycbzHmeczkJ2P2LbF2ACvX3n5KAz6YaVViyP2uWAZDU_d8-ELB4-bTajtMbAEKu_DeXRH/exec";

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
  if (validateSection(currentSection)) showSection(currentSection + 1);
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

function collectFormData() {
  return {
    // Section 1
    department:           val('department'),
    team:                 val('team'),
    respondentName:       val('respondentName'),
    role:                 val('role'),
    contactPerson:        val('contactPerson'),

    // Section 2
    processName:          val('processName'),
    processGoal:          val('processGoal'),
    currentOwner:         val('currentOwner'),
    otherInvolved:        val('otherInvolved'),

    // Section 3
    processStart:         val('processStart'),
    processStartOther:    val('processStartOther'),
    currentSteps:         val('currentSteps'),
    systemsUsed:          getCheckedValues('systemsUsed').filter(v => v !== 'אחר').join(', '),
    systemsUsedOther:     val('systemsUsedOther'),
    manualCopy:           getRadioValue('manualCopy'),
    manualCopyDetails:    val('manualCopyDetails'),

    // Section 4
    hasFiles:             getRadioValue('hasFiles'),
    fileTypes:            getCheckedValues('fileTypes').filter(v => v !== 'אחר').join(', '),
    fileTypesOther:       val('fileTypesOther'),
    storageLocations:     getCheckedValues('storageLocations').filter(v => v !== 'אחר').join(', '),
    storageLocationsOther:val('storageLocationsOther'),
    hardToFind:           getRadioValue('hardToFind'),

    // Section 5
    mainPainPoint:        val('mainPainPoint'),
    timeTaking:           val('timeTaking'),
    errorProne:           val('errorProne'),
    hardToTrack:          getRadioValue('hardToTrack'),
    duplicateEntry:       getRadioValue('duplicateEntry'),
    frequency:            document.getElementById('frequency').value,
    frequencyOther:       val('frequencyOther'),
    avgTime:              val('avgTime'),

    // Section 6
    automationNeeds:      getCheckedValues('automationNeeds').filter(v => v !== 'אחר').join(', '),
    automationNeedsOther: val('automationNeedsOther'),
    needsForm:            getRadioValue('needsForm'),
    needsDashboard:       getRadioValue('needsDashboard'),
    needsAlerts:          getRadioValue('needsAlerts'),
    reportNeeded:         val('reportNeeded'),

    // Section 7
    hasApprovals:         getRadioValue('hasApprovals'),
    approvalDetails:      val('approvalDetails'),
    differentPermissions: getRadioValue('differentPermissions'),
    sensitiveInfo:        getRadioValue('sensitiveInfo'),

    // Section 8
    ratingManual:         getRadioValue('ratingManual'),
    ratingTime:           getRadioValue('ratingTime'),
    ratingErrors:         getRadioValue('ratingErrors'),
    ratingUrgency:        getRadioValue('ratingUrgency'),
    ratingPeople:         getRadioValue('ratingPeople'),

    // Section 9
    mainProblem:          val('mainProblem'),
    desiredFuture:        val('desiredFuture'),
    successDefinition:    val('successDefinition'),
    additionalNotes:      val('additionalNotes'),

    // Metadata
    createdAt:  new Date().toISOString(),
    userAgent:  navigator.userAgent,
    pageUrl:    window.location.href
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

function showError() { errorBanner.style.display = 'flex'; }
function hideError() { errorBanner.style.display = 'none'; }

errorClose.addEventListener('click', hideError);

async function submitSurvey(data) {
  /*
    Google Apps Script Web Apps have CORS restrictions.
    Using fetch with mode: "no-cors" (opaque response) avoids the preflight block.
    We cannot read the response body, so we optimistically treat a network-error-free
    request as success.
  */
  const params = new URLSearchParams();
  params.append('payload', JSON.stringify(data));

  await fetch(GOOGLE_SCRIPT_URL, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString()
  });
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
    console.table(data);
    await submitSurvey(data);

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

  // Hide all conditional fields
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
initOtherFields();
showSection(1);
