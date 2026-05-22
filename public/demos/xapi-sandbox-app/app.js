/**
 * xAPI Sandbox — Crestline Health allergy verification micro-check.
 *
 * Emits real xAPI 1.0.3 statements into an in-memory mock LRS, renders
 * the feed, and aggregates a tiny analytics dashboard off the same stream.
 *
 * To point at a real LRS (e.g. Yet Analytics SQL LRS via Docker):
 *   1. Run:  docker run --rm -p 8080:8080 yetanalytics/lrsql:latest
 *   2. Replace mockLRS.post() with a fetch to /xapi/statements using
 *      Basic auth per the xAPI spec. Keep the statement shape identical.
 */

const ACTOR = {
  objectType: 'Agent',
  name: 'Jordan Park, RN',
  mbox: 'mailto:jpark@crestline.example',
};

const ACTIVITY_BASE = 'https://crestline.example/xapi/activities';
const LESSON_ID = `${ACTIVITY_BASE}/allergy-verification`;
const QUESTION_ID = `${ACTIVITY_BASE}/allergy-verification/q1`;

const VERBS = {
  launched: { id: 'http://adlnet.gov/expapi/verbs/launched', display: 'launched' },
  answered: { id: 'http://adlnet.gov/expapi/verbs/answered', display: 'answered' },
  passed: { id: 'http://adlnet.gov/expapi/verbs/passed', display: 'passed' },
  failed: { id: 'http://adlnet.gov/expapi/verbs/failed', display: 'failed' },
  completed: { id: 'http://adlnet.gov/expapi/verbs/completed', display: 'completed' },
};

// --- Live LRS (Learning Locker) ---------------------------------------------
const LRS_STORAGE_KEY = 'xapiSandbox:lrs';

function loadLiveConfig() {
  try {
    const raw = localStorage.getItem(LRS_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveLiveConfig(cfg) {
  localStorage.setItem(LRS_STORAGE_KEY, JSON.stringify(cfg));
}

function basicAuthHeader(key, secret) {
  if (!key || !secret) return null;
  const token = btoa(`${key}:${secret}`);
  return `Basic ${token}`;
}

function normalizeAuthHeader(auth) {
  if (!auth) return null;
  const trimmed = String(auth).trim();
  if (!trimmed) return null;
  return trimmed.startsWith('Basic ') ? trimmed : `Basic ${trimmed}`;
}

async function postToLearningLocker({ baseUrl, authHeader, key, secret, statement }) {
  const auth = normalizeAuthHeader(authHeader) ?? basicAuthHeader(key, secret);
  if (!auth) {
    throw new Error('Missing Authorization header (or client key/secret) for Live LRS.');
  }

  const url = `${String(baseUrl || '').replace(/\/+$/, '')}/data/xAPI/statements`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: auth,
      'X-Experience-API-Version': '1.0.3',
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify([statement]),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Live LRS error (${res.status}): ${text || res.statusText}`);
  }

  return res;
}

// --- Mock LRS ---------------------------------------------------------------
const mockLRS = {
  statements: [],
  subscribers: [],
  post(stmt) {
    this.statements.push(stmt);
    this.subscribers.forEach((fn) => fn(stmt));
    return Promise.resolve({ id: stmt.id, status: 200 });
  },
  subscribe(fn) { this.subscribers.push(fn); },
};

function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function buildStatement({ verb, activityId, activityName, result, context }) {
  return {
    id: uuid(),
    actor: ACTOR,
    verb: {
      id: verb.id,
      display: { 'en-US': verb.display },
    },
    object: {
      id: activityId,
      objectType: 'Activity',
      definition: {
        name: { 'en-US': activityName },
        type: 'http://adlnet.gov/expapi/activities/lesson',
      },
    },
    ...(result ? { result } : {}),
    ...(context ? { context } : {}),
    timestamp: new Date().toISOString(),
  };
}

// --- State tracking for dashboard ------------------------------------------
const state = {
  attempts: 0,
  completions: 0,
  passes: 0,
  fails: 0,
  decisionMs: [],
  currentLaunchedAt: null,
  lessonStarted: false,
};

// --- Rendering --------------------------------------------------------------
const feed = document.getElementById('feed');
const statementCount = document.getElementById('statementCount');
const mAttempts = document.getElementById('mAttempts');
const mCompletions = document.getElementById('mCompletions');
const mPassRate = document.getElementById('mPassRate');
const mAvgTime = document.getElementById('mAvgTime');
const endpointSelect = document.getElementById('endpoint');
const liveConfigWrap = document.getElementById('liveConfig');
const lrsBaseInput = document.getElementById('lrsBase');
const lrsKeyInput = document.getElementById('lrsKey');
const lrsSecretInput = document.getElementById('lrsSecret');

function renderDashboard() {
  mAttempts.textContent = state.attempts;
  mCompletions.textContent = state.completions;
  const scored = state.passes + state.fails;
  mPassRate.textContent = scored === 0 ? '—' : `${Math.round((state.passes / scored) * 100)}%`;
  if (state.decisionMs.length === 0) {
    mAvgTime.textContent = '—';
  } else {
    const avg = state.decisionMs.reduce((a, b) => a + b, 0) / state.decisionMs.length;
    mAvgTime.textContent = `${(avg / 1000).toFixed(1)}s`;
  }
}

function syntaxHighlight(json) {
  return json
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, (match) => {
      let cls = 'n';
      if (/^"/.test(match)) cls = /:$/.test(match) ? 'k' : 's';
      else if (/true|false|null/.test(match)) cls = 'n';
      return `<span class="${cls}">${match}</span>`;
    });
}

const CHOICE_LABELS = {
  safe: 'Hold the order and page the attending',
  override: 'Proceed — approve the amoxicillin order',
  ignore: 'Administer and monitor the patient',
};

function prettyChoice(raw) {
  return CHOICE_LABELS[raw] ?? raw;
}

function formatDuration(iso) {
  if (!iso) return null;
  const m = /PT(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?/.exec(iso);
  if (!m) return iso;
  const mins = m[1] ? parseFloat(m[1]) : 0;
  const secs = m[2] ? parseFloat(m[2]) : 0;
  if (mins >= 1) return `${mins}m ${Math.round(secs)}s`;
  return `${secs.toFixed(1)}s`;
}

function formatScore(score) {
  if (!score) return null;
  if (typeof score.scaled === 'number') return `${Math.round(score.scaled * 100)}%`;
  if (typeof score.raw === 'number') {
    const max = typeof score.max === 'number' ? score.max : 100;
    return `${Math.round((score.raw / max) * 100)}%`;
  }
  return null;
}

function toSimplified(stmt) {
  const verbId = stmt.verb.id;
  const objectName = stmt.object.definition?.name?.['en-US'] ?? stmt.object.id;
  const who = stmt.actor.name ?? 'Learner';
  const result = stmt.result;

  if (verbId.endsWith('/launched')) {
    return {
      icon: '🚀',
      action: 'Started',
      variant: 'start',
      what: objectName,
      detail: 'Opened the micro-lesson',
    };
  }
  if (verbId.endsWith('/answered')) {
    const correct = result?.success === true;
    const choiceText = result?.response ? prettyChoice(result.response) : null;
    const dur = formatDuration(result?.duration);
    const detailParts = [];
    if (choiceText) detailParts.push(`Chose: "${choiceText}"`);
    if (dur) detailParts.push(`Took ${dur}`);
    return {
      icon: correct ? '✍️' : '✍️',
      action: 'Answered',
      variant: 'answer',
      what: objectName,
      detail: detailParts.join(' · ') || null,
    };
  }
  if (verbId.endsWith('/passed')) {
    const pct = formatScore(result?.score) ?? '100%';
    return {
      icon: '✅',
      action: 'Passed',
      variant: 'pass',
      what: objectName,
      detail: `Score: ${pct} — safe decision`,
    };
  }
  if (verbId.endsWith('/failed')) {
    const pct = formatScore(result?.score) ?? '0%';
    return {
      icon: '❌',
      action: 'Failed',
      variant: 'fail',
      what: objectName,
      detail: `Score: ${pct} — unsafe decision`,
    };
  }
  if (verbId.endsWith('/completed')) {
    const dur = formatDuration(result?.duration);
    return {
      icon: '🏁',
      action: 'Completed',
      variant: 'complete',
      what: objectName,
      detail: dur ? `Session duration: ${dur}` : 'Session finished',
    };
  }
  return {
    icon: '•',
    action: stmt.verb.display['en-US'] ?? 'Event',
    variant: 'start',
    what: objectName,
    detail: null,
  };
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function renderStatement(stmt) {
  const empty = feed.querySelector('.feed__empty');
  if (empty) empty.remove();

  const li = document.createElement('li');
  const simple = toSimplified(stmt);
  li.className = `statement statement--${simple.variant}`;

  const time = new Date(stmt.timestamp).toLocaleTimeString([], { hour12: false });
  const verbDisplay = stmt.verb.display['en-US'];
  const who = stmt.actor.name ?? 'Learner';
  const pretty = JSON.stringify(stmt, null, 2);

  li.innerHTML = `
    <div class="statement__plain">
      <span class="statement__icon" aria-hidden="true">${simple.icon}</span>
      <div class="statement__main">
        <div class="statement__headline">
          <span class="statement__who">${escapeHtml(who)}</span>
          <span class="statement__action statement__action--${simple.variant}">${escapeHtml(simple.action)}</span>
        </div>
        <p class="statement__what">${escapeHtml(simple.what)}</p>
        ${simple.detail ? `<p class="statement__detail">${escapeHtml(simple.detail)}</p>` : ''}
        <div class="statement__foot">
          <span class="statement__ts">${time}</span>
          <button type="button" class="statement__toggle" aria-expanded="false">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 4l-4 8 4 8M16 4l4 8-4 8"/></svg>
            <span class="statement__toggle-label">Show raw xAPI</span>
          </button>
        </div>
      </div>
    </div>
    <div class="statement__raw" hidden>
      <div class="statement__raw-head">
        <span class="statement__raw-label">xAPI statement · JSON</span>
        <span class="statement__raw-verb">${escapeHtml(verbDisplay)}</span>
      </div>
      <pre class="statement__raw-json">${syntaxHighlight(pretty)}</pre>
    </div>
  `;

  const toggle = li.querySelector('.statement__toggle');
  const raw = li.querySelector('.statement__raw');
  const label = li.querySelector('.statement__toggle-label');
  toggle.addEventListener('click', () => {
    const open = raw.hasAttribute('hidden') ? false : true;
    if (open) {
      raw.setAttribute('hidden', '');
      toggle.setAttribute('aria-expanded', 'false');
      label.textContent = 'Show raw xAPI';
    } else {
      raw.removeAttribute('hidden');
      toggle.setAttribute('aria-expanded', 'true');
      label.textContent = 'Hide raw xAPI';
    }
  });

  feed.prepend(li);
  statementCount.textContent = `${mockLRS.statements.length} statement${mockLRS.statements.length === 1 ? '' : 's'}`;
}

mockLRS.subscribe(renderStatement);

// --- Emission helpers -------------------------------------------------------
async function emit(config) {
  const stmt = buildStatement(config);
  mockLRS.post(stmt);

  const mode = endpointSelect?.value ?? 'mock';
  if (mode === 'live') {
    const cfg = loadLiveConfig();
    const baseUrl = cfg?.baseUrl ?? 'http://localhost:8080';
    const authHeader = cfg?.authHeader ?? '';
    const key = cfg?.key ?? '';
    const secret = cfg?.secret ?? '';
    await postToLearningLocker({ baseUrl, authHeader, key, secret, statement: stmt });
  }

  return stmt;
}

// --- Lesson flow ------------------------------------------------------------
const steps = Array.from(document.querySelectorAll('.lesson__step'));
const dots = Array.from(document.querySelectorAll('.progress-dot'));

function showStep(n) {
  steps.forEach((s) => {
    s.hidden = Number(s.dataset.step) !== n;
  });
  dots.forEach((d) => {
    d.dataset.active = Number(d.dataset.dot) <= Math.min(n, 3) ? 'true' : 'false';
  });
}

function resetLesson() {
  state.currentLaunchedAt = null;
  state.lessonStarted = false;
  showStep(1);
}

document.getElementById('restart').addEventListener('click', () => {
  resetLesson();
});

document.querySelector('[data-action="launch"]').addEventListener('click', async () => {
  state.attempts += 1;
  state.lessonStarted = true;
  state.currentLaunchedAt = Date.now();
  await emit({
    verb: VERBS.launched,
    activityId: LESSON_ID,
    activityName: 'Allergy Verification Micro-check',
    context: {
      platform: 'Crestline xAPI Sandbox',
      contextActivities: {
        parent: [{ id: `${ACTIVITY_BASE}/ed-admission-training`, objectType: 'Activity' }],
      },
    },
  });
  renderDashboard();
  showStep(2);
});

document.querySelectorAll('.choice').forEach((btn) => {
  btn.addEventListener('click', async () => {
    const choice = btn.dataset.choice;
    const correct = btn.dataset.correct === 'true';
    const tookMs = state.currentLaunchedAt ? Date.now() - state.currentLaunchedAt : 0;
    state.decisionMs.push(tookMs);

    await emit({
      verb: VERBS.answered,
      activityId: QUESTION_ID,
      activityName: 'Question 1 — Proposed order with allergy conflict',
      result: {
        response: choice,
        success: correct,
        duration: `PT${(tookMs / 1000).toFixed(1)}S`,
      },
    });

    await emit({
      verb: correct ? VERBS.passed : VERBS.failed,
      activityId: QUESTION_ID,
      activityName: 'Question 1 — Proposed order with allergy conflict',
      result: {
        success: correct,
        score: { scaled: correct ? 1 : 0 },
      },
    });

    if (correct) state.passes += 1; else state.fails += 1;

    const heading = document.getElementById('resultHeading');
    const body = document.getElementById('resultBody');
    if (correct) {
      heading.innerHTML = 'Good catch.';
      body.textContent = 'Amoxicillin is a penicillin-class antibiotic. Holding the order and escalating is the reliable reflex — stop, check, reroute.';
    } else if (choice === 'override') {
      heading.innerHTML = 'Not safe.';
      body.textContent = 'Amoxicillin is a penicillin. Cross-reactivity risk with documented anaphylaxis is too high — this order needs to be held and escalated.';
    } else {
      heading.innerHTML = 'Not safe.';
      body.textContent = 'Administering with a documented anaphylaxis history is never the answer. Hold the order and page the attending first.';
    }

    renderDashboard();
    showStep(3);
  });
});

document.querySelector('[data-action="complete"]').addEventListener('click', async () => {
  const tookMs = state.currentLaunchedAt ? Date.now() - state.currentLaunchedAt : 0;
  await emit({
    verb: VERBS.completed,
    activityId: LESSON_ID,
    activityName: 'Allergy Verification Micro-check',
    result: {
      completion: true,
      duration: `PT${(tookMs / 1000).toFixed(1)}S`,
    },
  });
  state.completions += 1;
  renderDashboard();
  showStep(4);
});

// Init
if (endpointSelect) endpointSelect.value = 'mock'; // never restore "live" on load — avoid surprising portfolio visitors
const saved = loadLiveConfig();
const lrsAuthInput = document.getElementById('lrsAuth');
if (lrsBaseInput) lrsBaseInput.value = saved?.baseUrl ?? 'http://localhost:8080';
if (lrsKeyInput) lrsKeyInput.value = saved?.key ?? '';
if (lrsSecretInput) lrsSecretInput.value = saved?.secret ?? '';
if (lrsAuthInput) lrsAuthInput.value = saved?.authHeader ?? '';

function syncLiveConfigFromInputs() {
  const next = {
    baseUrl: lrsBaseInput?.value?.trim() || 'http://localhost:8080',
    key: lrsKeyInput?.value?.trim() || '',
    secret: lrsSecretInput?.value || '',
    authHeader: lrsAuthInput?.value?.trim() || '',
  };
  saveLiveConfig(next);
}

function updateLiveUI() {
  const mode = endpointSelect?.value ?? 'mock';
  if (liveConfigWrap) liveConfigWrap.hidden = mode !== 'live';
}

endpointSelect?.addEventListener('change', updateLiveUI);
lrsBaseInput?.addEventListener('input', syncLiveConfigFromInputs);
lrsKeyInput?.addEventListener('input', syncLiveConfigFromInputs);
lrsSecretInput?.addEventListener('input', syncLiveConfigFromInputs);
lrsAuthInput?.addEventListener('input', syncLiveConfigFromInputs);

updateLiveUI();
showStep(1);
renderDashboard();
