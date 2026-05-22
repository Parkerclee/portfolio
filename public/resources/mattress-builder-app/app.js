/* Halcyon Sleep — Build-a-Mattress
 * Rebuilt from a Storyline original. Plain JS state machine.
 * xAPI-style emit() placeholders noted throughout — wire to LRS in a host app.
 */
(function () {
  'use strict';

  // ---------- Data ----------
  const SLEEPERS = [
    {
      id: 'hot-side',
      icon: '🔥',
      name: 'The hot sleeper',
      note: 'Sleeps warm, wakes up sweaty, often sleeps on their side.',
      recommendedLayers: ['gel', 'memo', 'core'],
    },
    {
      id: 'back-pain',
      icon: '🪨',
      name: 'The achy back',
      note: 'Lower back tension in the morning. Wants firmer support.',
      recommendedLayers: ['memo', 'core', 'base'],
    },
    {
      id: 'light-combo',
      icon: '🪶',
      name: 'The light combo sleeper',
      note: 'Switches positions all night. Under 160 lbs.',
      recommendedLayers: ['gel', 'memo', 'core'],
    },
    {
      id: 'couple',
      icon: '👫',
      name: 'The couple',
      note: 'Different sleep styles, wants to reduce motion transfer.',
      recommendedLayers: ['gel', 'memo', 'core', 'base'],
    },
  ];

  const LAYERS = {
    gel: {
      id: 'gel',
      name: 'Cooling gel grid',
      short: 'Top comfort · 2"',
      swatch: 'swatch--gel',
      classTag: 'layer--gel',
      label: 'Gel grid',
      kicker: 'Top comfort',
      script: '"The grid on top stays cool because air moves freely through it — it\'s the first thing a hot sleeper notices."',
      why: 'Channels airflow, dissipates heat. The feature guests can literally feel by touching the mattress on the floor.',
    },
    memo: {
      id: 'memo',
      name: 'Transition memory foam',
      short: 'Pressure relief · 2"',
      swatch: 'swatch--memo',
      classTag: 'layer--memo',
      label: 'Memory foam',
      kicker: 'Pressure relief',
      script: '"Below the grid is a responsive foam that adapts to pressure points — so shoulders and hips sink just enough, without feeling stuck."',
      why: 'Bridges top-layer softness and core support. This is the layer most people mean when they say "memory foam."',
    },
    core: {
      id: 'core',
      name: 'Support core',
      short: 'Spinal alignment · 6"',
      swatch: 'swatch--core',
      classTag: 'layer--core',
      label: 'Support core',
      kicker: 'Spinal alignment',
      script: '"The support core is the workhorse — it holds the spine in neutral alignment all night, which is what your lower back actually wants."',
      why: 'This is the structural answer to back pain. Skip it and the mattress feels like a couch cushion.',
    },
    base: {
      id: 'base',
      name: 'Reinforced base',
      short: 'Edge + motion · 2"',
      swatch: 'swatch--base',
      classTag: 'layer--base',
      label: 'Reinforced base',
      kicker: 'Edge support + motion isolation',
      script: '"The base layer reinforces the edges so you can sit without sliding off — and it absorbs motion so your partner doesn\'t wake up when you do."',
      why: 'The quiet-couple selling point. Skipped in budget builds; noticed every single night when it\'s missing.',
    },
  };

  const LAYER_ORDER = ['gel', 'memo', 'core', 'base']; // top → bottom

  // ---------- State ----------
  const state = {
    step: 1,          // 1: pick sleeper · 2: build · 3: talking points · 4: quiz · 5: summary
    sleeperId: null,
    layers: new Set(),
    quizAnswer: null,
    quizCorrect: false,
  };

  // ---------- xAPI emit placeholder ----------
  function emit(verb, object, extra) {
    // In a host app, POST to /xapi/statements. Here we just log.
    // { actor, verb, object, result }
    // eslint-disable-next-line no-console
    console.info('[xAPI]', verb, object, extra || '');
  }

  // ---------- DOM refs ----------
  const $panel         = document.getElementById('panel');
  const $stack         = document.getElementById('mattress-stack');
  const $canvasLabel   = document.getElementById('canvas-label');
  const $sleeperMeta   = document.getElementById('sleeper-meta');
  const $sleeperChip   = document.getElementById('sleeper-chip');
  const $sleeperNote   = document.getElementById('sleeper-note');
  const $dots          = document.querySelectorAll('.step-indicator .dot');
  const $btnBack       = document.getElementById('btn-back');
  const $btnNext       = document.getElementById('btn-next');
  const $hint          = document.getElementById('footer-hint');

  // ---------- Render helpers ----------
  function renderStack() {
    $stack.innerHTML = '';
    // Render in top→bottom order, but CSS uses column-reverse so push top-first
    LAYER_ORDER.forEach(id => {
      if (state.layers.has(id)) {
        const layer = LAYERS[id];
        const el = document.createElement('div');
        el.className = `layer ${layer.classTag}`;
        el.innerHTML = `<span class="layer__label">${layer.label}</span>`;
        $stack.appendChild(el);
      }
    });
  }

  function renderSleeperMeta() {
    if (!state.sleeperId) {
      $sleeperMeta.hidden = true;
      $canvasLabel.textContent = 'Pick a sleeper profile to begin';
      return;
    }
    const s = SLEEPERS.find(x => x.id === state.sleeperId);
    $sleeperMeta.hidden = false;
    $sleeperChip.textContent = `${s.icon}  ${s.name}`;
    $sleeperNote.textContent = s.note;
    $canvasLabel.textContent = state.step === 2
      ? 'Add the layers that fit this sleeper'
      : state.step === 3
        ? 'Here\'s what to say about each layer'
        : state.step === 4
          ? 'One quick check before the floor'
          : 'Your build';
  }

  function renderDots() {
    $dots.forEach(d => {
      const n = Number(d.dataset.step);
      d.classList.toggle('is-active', n === state.step || (state.step === 5 && n === 4));
      d.classList.toggle('is-done', n < state.step);
    });
  }

  function updateFooter() {
    $btnBack.disabled = state.step === 1 || state.step === 5;

    if (state.step === 1) {
      $btnNext.disabled = !state.sleeperId;
      $btnNext.textContent = 'Next';
      $hint.textContent = state.sleeperId
        ? 'Nice. Click Next to start building.'
        : 'Pick a sleeper profile to unlock the layers.';
    } else if (state.step === 2) {
      const ok = hasMinimumStack();
      $btnNext.disabled = !ok;
      $btnNext.textContent = 'See talking points';
      $hint.textContent = ok
        ? 'Looks solid. Review your talking points next.'
        : 'Add at least a support core and one comfort layer.';
    } else if (state.step === 3) {
      $btnNext.disabled = false;
      $btnNext.textContent = 'Quick check';
      $hint.textContent = 'Read these like you\'d say them on the floor — out loud, once each.';
    } else if (state.step === 4) {
      $btnNext.disabled = state.quizAnswer === null;
      $btnNext.textContent = 'Finish';
      $hint.textContent = state.quizAnswer === null
        ? 'Pick the answer that uses the best layer.'
        : state.quizCorrect ? 'Exactly right.' : 'Close. Review and try again or continue.';
    } else {
      $btnNext.disabled = true;
      $btnNext.textContent = 'Done';
      $hint.textContent = 'Print this page or start over to build again.';
    }
  }

  function hasMinimumStack() {
    // Must have support core + at least one of gel/memo
    return state.layers.has('core') && (state.layers.has('gel') || state.layers.has('memo'));
  }

  // ---------- Step renderers ----------
  function renderStep() {
    renderStack();
    renderSleeperMeta();
    renderDots();
    updateFooter();

    switch (state.step) {
      case 1: return renderStep1();
      case 2: return renderStep2();
      case 3: return renderStep3();
      case 4: return renderStep4();
      case 5: return renderStep5();
    }
  }

  function renderStep1() {
    $panel.innerHTML = `
      <p class="panel__eyebrow">Step 1 · Discover</p>
      <h2 class="panel__title">Who are we building this for?</h2>
      <p class="panel__lede">The same four layers serve very different bodies. Start by matching the sleeper — the layers follow.</p>
      <div class="profiles" role="radiogroup" aria-label="Sleeper profiles">
        ${SLEEPERS.map(s => `
          <button type="button" class="profile ${state.sleeperId === s.id ? 'is-selected' : ''}"
                  role="radio" aria-checked="${state.sleeperId === s.id}" data-id="${s.id}">
            <span class="profile__icon" aria-hidden="true">${s.icon}</span>
            <h3 class="profile__name">${s.name}</h3>
            <p class="profile__note">${s.note}</p>
          </button>
        `).join('')}
      </div>
    `;
    $panel.querySelectorAll('.profile').forEach(btn => {
      btn.addEventListener('click', () => {
        state.sleeperId = btn.dataset.id;
        emit('selected', 'sleeper-profile', state.sleeperId);
        // Preload recommended layers so people see a starting point
        const rec = SLEEPERS.find(s => s.id === state.sleeperId).recommendedLayers;
        state.layers = new Set(rec);
        renderStep();
      });
    });
  }

  function renderStep2() {
    const sleeper = SLEEPERS.find(s => s.id === state.sleeperId);
    $panel.innerHTML = `
      <p class="panel__eyebrow">Step 2 · Build</p>
      <h2 class="panel__title">Stack the layers</h2>
      <p class="panel__lede">Click a layer to add or remove it. Layers marked <strong>Recommended</strong> are the ones we\'d pitch to this sleeper first.</p>
      <div class="layer-picker">
        ${LAYER_ORDER.map(id => {
          const l = LAYERS[id];
          const added = state.layers.has(id);
          const recommended = sleeper.recommendedLayers.includes(id);
          return `
            <button type="button"
                    class="layer-option ${added ? 'is-added' : ''} ${recommended ? 'is-recommended' : ''}"
                    data-id="${id}"
                    aria-pressed="${added}">
              <span class="swatch ${l.swatch}" aria-hidden="true"></span>
              <span class="layer-option__body">
                <h4>${l.name}</h4>
                <p>${l.short}</p>
              </span>
              <span class="layer-option__toggle" aria-hidden="true">${added ? '−' : '+'}</span>
            </button>
          `;
        }).join('')}
      </div>
    `;
    $panel.querySelectorAll('.layer-option').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        if (state.layers.has(id)) state.layers.delete(id);
        else state.layers.add(id);
        emit('toggled', `layer:${id}`, { added: state.layers.has(id) });
        renderStep();
      });
    });
  }

  function renderStep3() {
    const added = LAYER_ORDER.filter(id => state.layers.has(id));
    $panel.innerHTML = `
      <p class="panel__eyebrow">Step 3 · Translate</p>
      <h2 class="panel__title">What to say about each layer</h2>
      <p class="panel__lede">These are the talking points your team can use on the floor. Say them out loud — the phrasing sticks faster that way.</p>
      <div class="talking-points">
        ${added.map(id => {
          const l = LAYERS[id];
          return `
            <div class="tp tp--${id}">
              <div class="tp__rule"></div>
              <div>
                <p class="tp__kicker">${l.kicker} · ${l.name}</p>
                <p class="tp__script">${l.script}</p>
                <p class="tp__why"><strong>Why this works:</strong> ${l.why}</p>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
    emit('viewed', 'talking-points', { count: added.length });
  }

  function renderStep4() {
    const q = {
      prompt: 'A guest says they wake up hot in the middle of the night. Which layer do you lead with?',
      choices: [
        { id: 'gel',  label: 'The cooling gel grid — it pulls heat off the body.', correct: true },
        { id: 'memo', label: 'The memory foam — it relieves pressure points.', correct: false },
        { id: 'core', label: 'The support core — it aligns the spine.', correct: false },
        { id: 'base', label: 'The reinforced base — it stops motion transfer.', correct: false },
      ],
    };
    $panel.innerHTML = `
      <p class="panel__eyebrow">Step 4 · Check</p>
      <h2 class="panel__title">Quick check</h2>
      <p class="quiz-q">${q.prompt}</p>
      <div class="choices">
        ${q.choices.map(c => `
          <button type="button" class="choice" data-id="${c.id}" data-correct="${c.correct}">
            ${c.label}
          </button>
        `).join('')}
      </div>
      <div class="feedback" id="feedback" role="status" aria-live="polite"></div>
    `;
    const $fb = $panel.querySelector('#feedback');
    $panel.querySelectorAll('.choice').forEach(btn => {
      btn.addEventListener('click', () => {
        if (state.quizAnswer) return; // lock after first answer
        state.quizAnswer = btn.dataset.id;
        state.quizCorrect = btn.dataset.correct === 'true';
        $panel.querySelectorAll('.choice').forEach(b => b.disabled = true);
        btn.classList.add(state.quizCorrect ? 'is-correct' : 'is-wrong');
        if (!state.quizCorrect) {
          const right = $panel.querySelector('[data-correct="true"]');
          right && right.classList.add('is-correct');
        }
        $fb.classList.add('is-visible', state.quizCorrect ? 'is-correct' : 'is-incorrect');
        $fb.innerHTML = state.quizCorrect
          ? `<p class="feedback__title">Exactly.</p><p>Hot sleepers feel the top layer first — that\'s where the differentiator lives. Lead with the grid, then the foam for why they\'ll actually sleep through the night.</p>`
          : `<p class="feedback__title">Close, but lead with what they\'ll feel first.</p><p>The cooling gel grid is the layer a hot sleeper notices in the first ten seconds. The other layers matter — but they\'re not the opener.</p>`;
        emit('answered', 'check-for-understanding', { answer: state.quizAnswer, correct: state.quizCorrect });
        updateFooter();
      });
    });
  }

  function renderStep5() {
    const s = SLEEPERS.find(x => x.id === state.sleeperId);
    const added = LAYER_ORDER.filter(id => state.layers.has(id));
    $panel.innerHTML = `
      <p class="panel__eyebrow">Summary</p>
      <h2 class="panel__title">Your build for ${s.name.toLowerCase()}</h2>
      <p class="panel__lede">This is the shape of the conversation. On the floor, you\'d narrate top-down — guests follow along if you do.</p>
      <div class="summary__grid">
        <div class="summary__stat">
          <p class="k">Layers in this build</p>
          <p class="v">${added.length} of 4</p>
        </div>
        <div class="summary__stat">
          <p class="k">Quick check</p>
          <p class="v">${state.quizAnswer ? (state.quizCorrect ? 'Correct on first try' : 'Reviewed feedback') : 'Skipped'}</p>
        </div>
        <div class="summary__stat">
          <p class="k">Layers you skipped</p>
          <p class="v">${LAYER_ORDER.filter(id => !state.layers.has(id)).map(id => LAYERS[id].label).join(', ') || 'None — full stack'}</p>
        </div>
      </div>
      <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:6px;">
        <button type="button" id="btn-restart" class="btn btn--ghost">Start over</button>
        <button type="button" id="btn-print" class="btn btn--primary">Print this build</button>
      </div>
    `;
    $panel.querySelector('#btn-restart').addEventListener('click', restart);
    $panel.querySelector('#btn-print').addEventListener('click', () => window.print());
    emit('completed', 'mattress-builder', { layers: added, correct: state.quizCorrect });
  }

  // ---------- Nav ----------
  function next() {
    if (state.step === 4 && state.quizAnswer === null) return;
    state.step = Math.min(5, state.step + 1);
    renderStep();
  }
  function back() {
    state.step = Math.max(1, state.step - 1);
    renderStep();
  }
  function restart() {
    state.step = 1;
    state.sleeperId = null;
    state.layers.clear();
    state.quizAnswer = null;
    state.quizCorrect = false;
    renderStep();
  }

  $btnNext.addEventListener('click', next);
  $btnBack.addEventListener('click', back);

  // ---------- Boot ----------
  renderStep();
})();
