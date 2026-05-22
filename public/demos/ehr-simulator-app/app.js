/* ------------------------------------------------------------------ *
 *  Crestline EHR Simulator — ED Admission
 *  A small, dependency-free state machine that drives a 5-step
 *  emergency-department admission workflow with a branching allergy
 *  decision point. xAPI hooks are stubbed out for Phase 5.
 * ------------------------------------------------------------------ */

(() => {
  'use strict';

  // --------------------------- Patient data -------------------------
  const patient = {
    name: 'Rivera, Jamie',
    mrn: '00482910',
    dob: '1978-06-14',
    sex: 'F',
    age: 47,
    allergies: [
      { substance: 'Penicillin', reaction: 'Anaphylaxis', severity: 'Severe' },
      { substance: 'Latex', reaction: 'Contact dermatitis', severity: 'Mild' }
    ],
    chiefComplaint: 'Right-sided flank pain, onset ~6h ago',
    arrived: '08:14',
    provider: 'Chen, L. MD',
    bay: 'ED · Bay 4'
  };

  // The attempted order that will conflict with the penicillin allergy.
  const proposedOrder = {
    drug: 'Amoxicillin 500 mg PO',
    class: 'Aminopenicillin (beta-lactam)',
    indication: 'Suspected pyelonephritis — pending UA'
  };

  // -------------------------- Workflow spec -------------------------
  const steps = [
    {
      id: 'identify',
      short: 'Identify',
      title: 'Verify patient identity',
      subtitle: 'Confirm two patient identifiers before proceeding.',
      render: renderIdentify,
      validate: validateIdentify
    },
    {
      id: 'assess',
      short: 'Assess',
      title: 'Vitals & chief complaint',
      subtitle: 'Capture the triage snapshot and confirm the complaint.',
      render: renderAssess,
      validate: validateAssess
    },
    {
      id: 'orders',
      short: 'Orders',
      title: 'Medication order review',
      subtitle: 'Screen the proposed order against known allergies.',
      render: renderOrders,
      validate: validateOrders
    },
    {
      id: 'placement',
      short: 'Placement',
      title: 'Bed & service assignment',
      subtitle: 'Assign the right bed and notify the accepting team.',
      render: renderPlacement,
      validate: validatePlacement
    },
    {
      id: 'signoff',
      short: 'Sign-off',
      title: 'Admission summary',
      subtitle: 'Review the completed admission and sign off.',
      render: renderSignoff,
      validate: () => ({ ok: true })
    }
  ];

  // ------------------------- Session state --------------------------
  const defaultState = () => ({
    identifiers: { name: false, dob: false, mrn: false },
    vitals: { bp: '', hr: '', rr: '', temp: '', spo2: '' },
    complaintConfirmed: false,
    acuity: '',
    allergyAcknowledged: false,
    orderDecision: '',            // 'override' | 'cancel' | 'alternative'
    alternativeDrug: '',
    bed: '',
    service: '',
    handoffCalled: false,
    signedBy: '',
    toastTimer: null
  });

  let state = defaultState();
  let currentIndex = 0;

  // ------------------------- DOM references -------------------------
  const elApp       = document.getElementById('app');
  const elStepList  = document.getElementById('stepList');
  const elPanel     = document.getElementById('stepPanel');
  const elBack      = document.getElementById('backBtn');
  const elNext      = document.getElementById('nextBtn');
  const elProgress  = document.getElementById('progressLabel');
  const elToast     = document.getElementById('toast');
  const elRestart   = document.getElementById('restartBtn');

  // ----------------------------- Init -------------------------------
  function init() {
    // [xAPI] Emit "initialized" statement here (Phase 5)
    buildStepNav();
    attachGlobalHandlers();
    goTo(0, { silent: true });
  }

  function buildStepNav() {
    elStepList.innerHTML = steps.map((s, i) => `
      <li class="step-nav__item" data-index="${i}">
        <span class="step-nav__dot">${i + 1}</span>
        <span class="step-nav__label">
          <strong>${s.short}</strong>
          <em>${s.title}</em>
        </span>
      </li>
    `).join('');
  }

  function attachGlobalHandlers() {
    elBack.addEventListener('click', () => goTo(currentIndex - 1));
    elNext.addEventListener('click', onNext);
    elRestart.addEventListener('click', () => {
      if (!confirm('Restart the workflow? All entered data will be cleared.')) return;
      state = defaultState();
      // [xAPI] Emit "reset" statement here
      goTo(0);
      toast('Workflow restarted.');
    });
  }

  // ----------------------- Navigation logic -------------------------
  function onNext() {
    const step = steps[currentIndex];
    const result = step.validate();
    if (!result.ok) {
      toast(result.message || 'Please complete this step before continuing.', 'warn');
      return;
    }
    // [xAPI] Emit "completed step <id>" statement here

    if (currentIndex === steps.length - 1) {
      // Finished — jump back to start for replay.
      toast('Admission signed. Great work.', 'success');
      return;
    }
    goTo(currentIndex + 1);
  }

  function goTo(index, opts = {}) {
    if (index < 0 || index >= steps.length) return;
    currentIndex = index;
    const step = steps[index];

    // Render panel
    elPanel.innerHTML = '';
    const fragment = step.render();
    elPanel.appendChild(fragment);
    elPanel.scrollTop = 0;

    // Update nav classes
    [...elStepList.children].forEach((li, i) => {
      li.classList.toggle('is-current', i === index);
      li.classList.toggle('is-done', i < index);
      li.classList.toggle('is-upcoming', i > index);
    });

    // Update footer
    elBack.disabled = index === 0;
    elNext.textContent = index === steps.length - 1 ? 'Finish' : 'Next';
    elNext.innerHTML = (index === steps.length - 1)
      ? 'Finish <span aria-hidden="true">✓</span>'
      : 'Next <span aria-hidden="true">→</span>';
    elProgress.textContent = `Step ${index + 1} of ${steps.length}`;

    if (!opts.silent) {
      // [xAPI] Emit "experienced step <id>" statement here
    }
  }

  // --------------------------- Toast --------------------------------
  function toast(message, tone = 'info') {
    elToast.textContent = message;
    elToast.dataset.tone = tone;
    elToast.classList.add('is-visible');
    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(() => {
      elToast.classList.remove('is-visible');
    }, 3200);
  }

  // ------------------ Small templating helpers ----------------------
  function el(html) {
    const t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content;
  }

  function $(root, sel) { return root.querySelector(sel); }
  function $$(root, sel) { return [...root.querySelectorAll(sel)]; }

  // =========================== STEP 1 ===============================
  function renderIdentify() {
    const frag = el(`
      <div class="step">
        <header class="step__head">
          <p class="step__eyebrow">Step 1 · Identification</p>
          <h2 class="step__title">Verify patient identity</h2>
          <p class="step__sub">Confirm <strong>two</strong> identifiers with the patient or caregiver before proceeding. This is a Joint Commission patient-safety goal.</p>
        </header>

        <div class="step__grid">
          <div class="card">
            <h3 class="card__title">On record</h3>
            <dl class="kv">
              <dt>Name</dt><dd>${patient.name}</dd>
              <dt>DOB</dt><dd>${patient.dob} (${patient.age}y)</dd>
              <dt>MRN</dt><dd>${patient.mrn}</dd>
              <dt>Sex</dt><dd>${patient.sex}</dd>
            </dl>
          </div>

          <div class="card">
            <h3 class="card__title">Confirmed with patient</h3>
            <p class="card__help">Check each identifier you verified verbally.</p>
            <ul class="checklist">
              <li>
                <label>
                  <input type="checkbox" data-id="name" ${state.identifiers.name ? 'checked' : ''} />
                  <span>Full name</span>
                </label>
              </li>
              <li>
                <label>
                  <input type="checkbox" data-id="dob" ${state.identifiers.dob ? 'checked' : ''} />
                  <span>Date of birth</span>
                </label>
              </li>
              <li>
                <label>
                  <input type="checkbox" data-id="mrn" ${state.identifiers.mrn ? 'checked' : ''} />
                  <span>Medical record number (wristband)</span>
                </label>
              </li>
            </ul>
          </div>
        </div>

        <p class="step__hint">At least two must be confirmed to continue.</p>
      </div>
    `);

    $$(frag, 'input[type="checkbox"]').forEach(cb => {
      cb.addEventListener('change', (e) => {
        state.identifiers[e.target.dataset.id] = e.target.checked;
      });
    });

    return frag;
  }
  function validateIdentify() {
    const count = Object.values(state.identifiers).filter(Boolean).length;
    if (count < 2) return { ok: false, message: 'Confirm at least two patient identifiers.' };
    return { ok: true };
  }

  // =========================== STEP 2 ===============================
  function renderAssess() {
    const v = state.vitals;
    const frag = el(`
      <div class="step">
        <header class="step__head">
          <p class="step__eyebrow">Step 2 · Assessment</p>
          <h2 class="step__title">Vitals & chief complaint</h2>
          <p class="step__sub">Enter the triage vitals and confirm the complaint as stated by the patient.</p>
        </header>

        <div class="step__grid">
          <div class="card">
            <h3 class="card__title">Vitals (triage)</h3>
            <div class="field-grid">
              <label class="field">
                <span>Blood pressure</span>
                <input type="text" data-k="bp" placeholder="e.g., 138/86" value="${v.bp}" />
              </label>
              <label class="field">
                <span>Heart rate (bpm)</span>
                <input type="number" data-k="hr" placeholder="e.g., 96" value="${v.hr}" min="20" max="250" />
              </label>
              <label class="field">
                <span>Resp. rate</span>
                <input type="number" data-k="rr" placeholder="e.g., 18" value="${v.rr}" min="4" max="60" />
              </label>
              <label class="field">
                <span>Temp (°F)</span>
                <input type="number" step="0.1" data-k="temp" placeholder="e.g., 100.4" value="${v.temp}" />
              </label>
              <label class="field">
                <span>SpO₂ (%)</span>
                <input type="number" data-k="spo2" placeholder="e.g., 97" value="${v.spo2}" min="50" max="100" />
              </label>
            </div>
          </div>

          <div class="card">
            <h3 class="card__title">Chief complaint</h3>
            <blockquote class="quote">
              <p>"${patient.chiefComplaint}"</p>
              <cite>— Patient, on arrival</cite>
            </blockquote>
            <label class="check-inline">
              <input type="checkbox" id="confirmComplaint" ${state.complaintConfirmed ? 'checked' : ''} />
              <span>Confirmed with patient as stated</span>
            </label>

            <h3 class="card__title card__title--sub">Acuity (ESI)</h3>
            <div class="radio-row">
              ${[1, 2, 3, 4, 5].map(n => `
                <label class="pill-radio">
                  <input type="radio" name="acuity" value="${n}" ${state.acuity == n ? 'checked' : ''} />
                  <span>${n}</span>
                </label>
              `).join('')}
            </div>
            <p class="card__help">ESI 1 = resuscitation, 5 = non-urgent.</p>
          </div>
        </div>
      </div>
    `);

    $$(frag, 'input[data-k]').forEach(i => {
      i.addEventListener('input', (e) => {
        state.vitals[e.target.dataset.k] = e.target.value.trim();
      });
    });
    $(frag, '#confirmComplaint').addEventListener('change', (e) => {
      state.complaintConfirmed = e.target.checked;
    });
    $$(frag, 'input[name="acuity"]').forEach(r => {
      r.addEventListener('change', (e) => { state.acuity = e.target.value; });
    });

    return frag;
  }
  function validateAssess() {
    const v = state.vitals;
    const missing = ['bp', 'hr', 'rr', 'temp', 'spo2'].filter(k => !v[k]);
    if (missing.length) return { ok: false, message: `Enter all vitals (${missing.join(', ')}).` };
    if (!state.complaintConfirmed) return { ok: false, message: 'Confirm the chief complaint with the patient.' };
    if (!state.acuity) return { ok: false, message: 'Select an ESI acuity level.' };
    return { ok: true };
  }

  // =========================== STEP 3 ===============================
  function renderOrders() {
    const frag = el(`
      <div class="step">
        <header class="step__head">
          <p class="step__eyebrow">Step 3 · Orders</p>
          <h2 class="step__title">Medication order review</h2>
          <p class="step__sub">Screen the proposed order against the patient's documented allergies.</p>
        </header>

        <div class="alert alert--critical" role="alert">
          <div class="alert__icon" aria-hidden="true">!</div>
          <div>
            <p class="alert__title">Allergy conflict detected</p>
            <p class="alert__body">
              <strong>${proposedOrder.drug}</strong> (${proposedOrder.class})
              conflicts with the documented allergy to
              <strong>Penicillin</strong> — history of <em>anaphylaxis</em>.
            </p>
          </div>
        </div>

        <div class="step__grid">
          <div class="card">
            <h3 class="card__title">Proposed order</h3>
            <dl class="kv">
              <dt>Medication</dt><dd>${proposedOrder.drug}</dd>
              <dt>Class</dt><dd>${proposedOrder.class}</dd>
              <dt>Indication</dt><dd>${proposedOrder.indication}</dd>
              <dt>Ordered by</dt><dd>${patient.provider}</dd>
            </dl>
          </div>

          <div class="card">
            <h3 class="card__title">Allergies on file</h3>
            <ul class="allergy-list">
              ${patient.allergies.map(a => `
                <li class="allergy-list__item ${a.severity === 'Severe' ? 'is-severe' : ''}">
                  <strong>${a.substance}</strong>
                  <span>${a.reaction} · ${a.severity}</span>
                </li>
              `).join('')}
            </ul>
            <label class="check-inline">
              <input type="checkbox" id="ackAllergy" ${state.allergyAcknowledged ? 'checked' : ''} />
              <span>I have reviewed the patient's allergy history</span>
            </label>
          </div>
        </div>

        <div class="card card--decision">
          <h3 class="card__title">What will you do?</h3>
          <div class="choice-grid">
            <label class="choice">
              <input type="radio" name="decision" value="override" ${state.orderDecision === 'override' ? 'checked' : ''} />
              <div class="choice__body">
                <strong>Override and proceed</strong>
                <p>Document override reason; continue with amoxicillin.</p>
                <span class="choice__tag choice__tag--danger">Not recommended</span>
              </div>
            </label>
            <label class="choice">
              <input type="radio" name="decision" value="cancel" ${state.orderDecision === 'cancel' ? 'checked' : ''} />
              <div class="choice__body">
                <strong>Cancel the order</strong>
                <p>Notify Dr. Chen; await a new order.</p>
                <span class="choice__tag">Safe</span>
              </div>
            </label>
            <label class="choice">
              <input type="radio" name="decision" value="alternative" ${state.orderDecision === 'alternative' ? 'checked' : ''} />
              <div class="choice__body">
                <strong>Suggest an alternative</strong>
                <p>Choose a non-beta-lactam and route to pharmacy.</p>
                <span class="choice__tag choice__tag--good">Recommended</span>
              </div>
            </label>
          </div>

          <div class="alt-panel" id="altPanel" hidden>
            <label class="field">
              <span>Suggested alternative</span>
              <select id="altSelect">
                <option value="">— Select —</option>
                <option ${state.alternativeDrug === 'Ciprofloxacin 500 mg PO' ? 'selected' : ''}>Ciprofloxacin 500 mg PO</option>
                <option ${state.alternativeDrug === 'Trimethoprim-sulfamethoxazole DS PO' ? 'selected' : ''}>Trimethoprim-sulfamethoxazole DS PO</option>
                <option ${state.alternativeDrug === 'Nitrofurantoin 100 mg PO' ? 'selected' : ''}>Nitrofurantoin 100 mg PO</option>
              </select>
            </label>
            <p class="card__help">Selection will route to pharmacy for verification.</p>
          </div>
        </div>
      </div>
    `);

    const altPanel = $(frag, '#altPanel');
    const altSelect = $(frag, '#altSelect');

    $(frag, '#ackAllergy').addEventListener('change', (e) => {
      state.allergyAcknowledged = e.target.checked;
    });

    $$(frag, 'input[name="decision"]').forEach(r => {
      r.addEventListener('change', (e) => {
        state.orderDecision = e.target.value;
        altPanel.hidden = state.orderDecision !== 'alternative';
        if (state.orderDecision === 'override') {
          toast('Override flagged for pharmacy + risk review.', 'warn');
          // [xAPI] Emit "answered (unsafe-override)" statement here
        }
        if (state.orderDecision === 'cancel') {
          toast('Order cancelled. Dr. Chen notified.', 'info');
        }
        if (state.orderDecision === 'alternative') {
          toast('Alternatives loaded.', 'success');
        }
      });
    });
    // Initialize panel visibility
    altPanel.hidden = state.orderDecision !== 'alternative';

    altSelect.addEventListener('change', (e) => {
      state.alternativeDrug = e.target.value;
    });

    return frag;
  }
  function validateOrders() {
    if (!state.allergyAcknowledged) return { ok: false, message: 'Acknowledge the allergy review first.' };
    if (!state.orderDecision) return { ok: false, message: 'Choose how to handle the flagged order.' };
    if (state.orderDecision === 'override') {
      return { ok: false, message: 'Overriding a severe allergy alert is blocked in this simulation. Pick a safer path.' };
    }
    if (state.orderDecision === 'alternative' && !state.alternativeDrug) {
      return { ok: false, message: 'Select an alternative medication.' };
    }
    return { ok: true };
  }

  // =========================== STEP 4 ===============================
  function renderPlacement() {
    const beds = [
      { id: 'ED-04', label: 'ED · Bay 4 (current)', note: 'Monitored, near nursing station' },
      { id: 'OBS-12', label: 'Observation · 12', note: '≤ 23h stay, telemetry available' },
      { id: 'MED-207', label: 'Med-Surg · 207', note: 'Inpatient, private room' }
    ];
    const services = ['Hospitalist', 'Urology', 'Internal Medicine'];

    const frag = el(`
      <div class="step">
        <header class="step__head">
          <p class="step__eyebrow">Step 4 · Placement</p>
          <h2 class="step__title">Bed &amp; service assignment</h2>
          <p class="step__sub">Assign a bed and the accepting service, then call handoff.</p>
        </header>

        <div class="step__grid">
          <div class="card">
            <h3 class="card__title">Available beds</h3>
            <ul class="bed-list">
              ${beds.map(b => `
                <li>
                  <label class="bed-option">
                    <input type="radio" name="bed" value="${b.id}" ${state.bed === b.id ? 'checked' : ''} />
                    <div>
                      <strong>${b.label}</strong>
                      <span>${b.note}</span>
                    </div>
                  </label>
                </li>
              `).join('')}
            </ul>
          </div>

          <div class="card">
            <h3 class="card__title">Accepting service</h3>
            <div class="radio-row radio-row--stack">
              ${services.map(s => `
                <label class="pill-radio pill-radio--wide">
                  <input type="radio" name="service" value="${s}" ${state.service === s ? 'checked' : ''} />
                  <span>${s}</span>
                </label>
              `).join('')}
            </div>

            <h3 class="card__title card__title--sub">Handoff</h3>
            <label class="check-inline">
              <input type="checkbox" id="handoff" ${state.handoffCalled ? 'checked' : ''} />
              <span>Called report to accepting team (SBAR documented)</span>
            </label>
          </div>
        </div>
      </div>
    `);

    $$(frag, 'input[name="bed"]').forEach(r => {
      r.addEventListener('change', (e) => { state.bed = e.target.value; });
    });
    $$(frag, 'input[name="service"]').forEach(r => {
      r.addEventListener('change', (e) => { state.service = e.target.value; });
    });
    $(frag, '#handoff').addEventListener('change', (e) => {
      state.handoffCalled = e.target.checked;
    });

    return frag;
  }
  function validatePlacement() {
    if (!state.bed) return { ok: false, message: 'Assign a bed.' };
    if (!state.service) return { ok: false, message: 'Select an accepting service.' };
    if (!state.handoffCalled) return { ok: false, message: 'Document the handoff call.' };
    return { ok: true };
  }

  // =========================== STEP 5 ===============================
  function renderSignoff() {
    const v = state.vitals;
    const orderSummary = state.orderDecision === 'alternative'
      ? `Alternative ordered: <strong>${state.alternativeDrug}</strong> (routed to pharmacy).`
      : 'Original order cancelled; awaiting new order from Dr. Chen.';

    const frag = el(`
      <div class="step">
        <header class="step__head">
          <p class="step__eyebrow">Step 5 · Sign-off</p>
          <h2 class="step__title">Admission summary</h2>
          <p class="step__sub">Review the record, then sign to complete the admission.</p>
        </header>

        <div class="summary-grid">
          <section class="summary-block">
            <h3>Patient</h3>
            <p>${patient.name} · ${patient.sex} · DOB ${patient.dob} (${patient.age}y) · MRN ${patient.mrn}</p>
            <p class="summary-block__meta">Arrived ${patient.arrived} · ${patient.bay} · ${patient.provider}</p>
          </section>

          <section class="summary-block">
            <h3>Triage</h3>
            <p>BP ${v.bp} · HR ${v.hr} · RR ${v.rr} · Temp ${v.temp}°F · SpO₂ ${v.spo2}%</p>
            <p class="summary-block__meta">ESI ${state.acuity} · ${patient.chiefComplaint}</p>
          </section>

          <section class="summary-block">
            <h3>Allergy review</h3>
            <p>${orderSummary}</p>
            <p class="summary-block__meta">Allergies acknowledged prior to ordering.</p>
          </section>

          <section class="summary-block">
            <h3>Disposition</h3>
            <p>Bed <strong>${state.bed}</strong> · Service <strong>${state.service}</strong></p>
            <p class="summary-block__meta">Handoff to accepting team completed.</p>
          </section>
        </div>

        <div class="card card--signoff">
          <h3 class="card__title">Sign to complete</h3>
          <label class="field">
            <span>Type your name</span>
            <input type="text" id="signName" placeholder="e.g., Morgan Lee, RN" value="${state.signedBy}" />
          </label>
          <p class="card__help">Your signature is simulated — no PHI is stored.</p>
        </div>
      </div>
    `);

    $(frag, '#signName').addEventListener('input', (e) => {
      state.signedBy = e.target.value;
    });

    return frag;
  }

  // Validation for signoff handled in onNext finish-branch check:
  const _origOnNext = onNext;
  // Replace with signed-check variant
  elNext && (elNext.onclick = null); // safety; we'll rely on addEventListener in attachGlobalHandlers

  // Wrap validate for step 5 so Finish requires a signature
  steps[4].validate = () => {
    if (!state.signedBy || state.signedBy.trim().length < 2) {
      return { ok: false, message: 'Enter your name to sign the admission.' };
    }
    // [xAPI] Emit "completed scenario" statement here
    return { ok: true };
  };

  // ---------------------------- Boot --------------------------------
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
