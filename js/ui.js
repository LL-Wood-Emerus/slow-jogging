/**
 * UI Controller & Event Handlers Module
 */

let runTimer = null;

function formatTime(sec) {
  const m = Math.floor(sec / 60).toString().padStart(2, '0');
  const s = Math.floor(sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function updateHUD() {
  const timerVal = document.getElementById('hud-timer-val');
  if (timerVal) timerVal.textContent = formatTime(state.remainingTime);
}

function startRunningTimer() {
  if (runTimer) clearInterval(runTimer);
  
  runTimer = setInterval(() => {
    if (state.screen !== 'running' || state.isPaused) return;

    state.remainingTime--;
    state.elapsedTime++;

    updateHUD();

    if (state.remainingTime <= 0) {
      finishRun();
    }
  }, 1000);
}

let selectionAnimFrame = null;
let celebrateAnimFrame = null;

/**
 * HOME SCREEN CHARACTER LAYOUT & SELECTION CONFIG
 * - Modify these parameters if character positions or names need adjustments in future updates.
 */
const HOME_CHAR_LAYOUT = {
  drawYRatio: 0.94,
  scaleUnselected: 170,
  scaleSelected: 200,
  nameTopUnselected: '40px',
  nameTopSelected: '-40px'
};

function updateCardSelectionDOM() {
  [0, 1, 2].forEach(idx => {
    const canvas = document.getElementById(`stage-char-canvas-${idx}`);
    if (canvas) {
      const card = canvas.closest('.char-select-card');
      if (card) {
        const isSelected = (state.charIndex === idx);
        const ring = card.querySelector('.char-ring');
        const nameTag = card.querySelector('.char-name-tag');
        if (isSelected) {
          card.classList.add('selected', 'scale-[1.05]');
          if (ring) ring.classList.remove('hidden');
          if (nameTag) nameTag.style.top = HOME_CHAR_LAYOUT.nameTopSelected;
        } else {
          card.classList.remove('selected', 'scale-[1.05]');
          if (ring) ring.classList.add('hidden');
          if (nameTag) nameTag.style.top = HOME_CHAR_LAYOUT.nameTopUnselected;
        }
      }
    }
  });
}

function startSelectionAnimation() {
  if (selectionAnimFrame) {
    cancelAnimationFrame(selectionAnimFrame);
    selectionAnimFrame = null;
  }

  updateCardSelectionDOM();

  const canvasList = [
    document.getElementById('stage-char-canvas-0'),
    document.getElementById('stage-char-canvas-1'),
    document.getElementById('stage-char-canvas-2')
  ];

  function loop(now) {
    if (state.screen === 'standby') {
      for (let idx = 0; idx < 3; idx++) {
        const canvas = canvasList[idx];
        if (canvas) {
          const ctx = canvas.getContext('2d');
          ctx.clearRect(0, 0, canvas.width, canvas.height);

          const isSelected = (state.charIndex === idx);
          const bounceY = isSelected ? -10 : 0;
          const scale = isSelected ? HOME_CHAR_LAYOUT.scaleSelected : HOME_CHAR_LAYOUT.scaleUnselected;
          const stateName = isSelected ? 'selection_loop' : 'sitting';

          charMgr.drawStateFrame(ctx, idx, stateName, now, canvas.width / 2, canvas.height * HOME_CHAR_LAYOUT.drawYRatio, scale, scale, bounceY, 0);
        }
      }
      selectionAnimFrame = requestAnimationFrame(loop);
    } else {
      selectionAnimFrame = null;
    }
  }

  selectionAnimFrame = requestAnimationFrame(loop);
}

function startCelebrateAnimation() {
  if (celebrateAnimFrame) cancelAnimationFrame(celebrateAnimFrame);

  const startTime = performance.now();
  function loop(now) {
    if (state.screen === 'celebrate') {
      const celebCanvas = document.getElementById('char-celebrate-canvas');
      if (celebCanvas) {
        const ctx = celebCanvas.getContext('2d');
        ctx.clearRect(0, 0, celebCanvas.width, celebCanvas.height);
        const elapsed = now - startTime;
        charMgr.drawStateFrame(ctx, state.charIndex, 'celebration', elapsed, celebCanvas.width / 2, celebCanvas.height * 0.95, 260, 260, -10, 0);
      }
      celebrateAnimFrame = requestAnimationFrame(loop);
    }
  }

  celebrateAnimFrame = requestAnimationFrame(loop);
}

function stopUIAnimations() {
  if (selectionAnimFrame) {
    cancelAnimationFrame(selectionAnimFrame);
    selectionAnimFrame = null;
  }
  if (celebrateAnimFrame) {
    cancelAnimationFrame(celebrateAnimFrame);
    celebrateAnimFrame = null;
  }
}

function switchScreen(screenName) {
  state.screen = screenName;
  stopUIAnimations();
  if (typeof stageRenderer !== 'undefined' && stageRenderer) {
    stageRenderer.cachedBgCanvas = null;
  }
  
  if (screenName !== 'celebrate') {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    const target = document.getElementById(`screen-${screenName}`);
    if (target) target.classList.remove('hidden');
  } else {
    // Keep running screen visible under celebrate overlay modal
    const runningScreen = document.getElementById('screen-running');
    if (runningScreen) runningScreen.classList.remove('hidden');
    const celebScreen = document.getElementById('screen-celebrate');
    if (celebScreen) celebScreen.classList.remove('hidden');
  }

  if (screenName === 'standby') {
    renderPreviewCanvases();
    startSelectionAnimation();
  } else if (screenName === 'celebrate') {
    startCelebrateAnimation();
  }
}

function startCountdown() {
  sceneMgr.pickRandomRunFrames();
  if (typeof stageRenderer !== 'undefined' && stageRenderer) {
    stageRenderer.cachedBgCanvas = null;
  }
  const settingsOverlay = document.getElementById('stage-settings-overlay');
  if (settingsOverlay) settingsOverlay.classList.add('hidden');
  const celebrateOverlay = document.getElementById('screen-celebrate');
  if (celebrateOverlay) celebrateOverlay.classList.add('hidden');

  if (runTimer) {
    clearInterval(runTimer);
    runTimer = null;
  }
  if (typeof speechTimer !== 'undefined' && speechTimer) {
    clearInterval(speechTimer);
  }

  state.remainingTime = state.targetTime;
  state.elapsedTime = 0;
  state.isPaused = false;
  state.isCountdown = true;

  updateHUD();
  switchScreen('running');
  stageRenderer.start();
  
  const countdownOverlay = document.getElementById('countdown-overlay');
  const numEl = document.getElementById('countdown-num');
  countdownOverlay.classList.remove('hidden');

  let count = 3;
  numEl.textContent = count;
  audio.playFx('beep');

  const countInterval = setInterval(() => {
    count--;
    if (count > 0) {
      numEl.textContent = count;
      audio.playFx('beep');
    } else if (count === 0) {
      numEl.textContent = 'GO!';
      audio.playFx('go');
    } else {
      clearInterval(countInterval);
      countdownOverlay.classList.add('hidden');
      state.isCountdown = false;

      updateHUD();
      audio.startAudio();
      startRunningTimer();
      startSpeechEngine();
      requestWakeLock();
    }
  }, 1000);
}

async function requestWakeLock() {
  try {
    if ('wakeLock' in navigator) {
      state.wakeLock = await navigator.wakeLock.request('screen');
    }
  } catch (err) {
    console.log('Wake Lock Error:', err);
  }
}

function finishRun() {
  state.screen = 'celebrate';
  audio.stopAudio();
  audio.playFx('victory');

  if (runTimer) {
    clearInterval(runTimer);
    runTimer = null;
  }
  if (typeof speechTimer !== 'undefined' && speechTimer) {
    clearInterval(speechTimer);
  }

  if (state.wakeLock) {
    state.wakeLock.release().catch(() => {});
    state.wakeLock = null;
  }

  const resTime = document.getElementById('res-time-val');
  if (resTime) resTime.textContent = formatTime(state.elapsedTime);

  switchScreen('celebrate');
}

function updateConfirmBtnState() {
  const btn = document.getElementById('btn-confirm-char');
  if (!btn) return;
  if (state.charIndex >= 0) {
    btn.disabled = false;
    btn.classList.remove('opacity-40', 'cursor-not-allowed', 'pointer-events-none', 'bg-slate-200', 'text-slate-400', 'border-slate-300', 'shadow-none');
    btn.classList.add('bg-white', 'text-rose-600', 'border-rose-600', 'shadow-lg', 'hover:bg-rose-50');
  } else {
    btn.disabled = true;
    btn.classList.remove('bg-white', 'text-rose-600', 'border-rose-600', 'shadow-lg', 'hover:bg-rose-50');
    btn.classList.add('opacity-40', 'cursor-not-allowed', 'pointer-events-none', 'bg-slate-200', 'text-slate-400', 'border-slate-300', 'shadow-none');
  }
}

function renderPreviewCanvases() {
  const charThumb = document.getElementById('selected-char-thumb');
  const charDesc = document.getElementById('selected-char-desc');
  if (state.charIndex >= 0 && characters[state.charIndex]) {
    if (charThumb) charThumb.textContent = characters[state.charIndex].icon;
    if (charDesc) charDesc.textContent = `已選擇夥伴：${characters[state.charIndex].name}`;
  } else {
    if (charThumb) charThumb.textContent = '❓';
    if (charDesc) charDesc.textContent = `尚未選擇夥伴`;
  }
  updateCardSelectionDOM();
  updateConfirmBtnState();
}

function updateSettingsScenePreview() {
  const bgEl = document.getElementById('settings-preview-bg');
  if (!bgEl) return;

  const runFrames = sceneMgr.getRunFrames();
  const getSrc = (fObj) => (fObj && fObj.image) ? fObj.image.src : 'assets/frame_empty.jpg';

  const f1 = getSrc(runFrames[0]);
  const f2 = getSrc(runFrames[1]);
  const f3 = getSrc(runFrames[2]);

  bgEl.innerHTML = `
    <img src="assets/base.jpeg" class="w-full h-full object-fill">
    <img src="${f1}" class="absolute left-[13.8%] top-[17.7%] w-[25.3%] rounded-md shadow-lg border-2 border-amber-900/30">
    <img src="${f2}" class="absolute left-[40.6%] top-[17.7%] w-[25.3%] rounded-md shadow-lg border-2 border-amber-900/30">
    <img src="${f3}" class="absolute left-[67.4%] top-[17.7%] w-[25.3%] rounded-md shadow-lg border-2 border-amber-900/30">
  `;
}

function syncBPMSliders(val) {
  const bpmDisplay = document.getElementById('bpm-display-val');
  const hudBpmVal = document.getElementById('hud-bpm-val');
  const drawerBpmVal = document.getElementById('drawer-bpm-val');
  const hudBtnTag = document.querySelector('#btn-start-run span:last-child');

  if (bpmDisplay) bpmDisplay.textContent = `${val} BPM`;
  if (hudBpmVal) hudBpmVal.textContent = val;
  if (drawerBpmVal) drawerBpmVal.textContent = val;
  if (hudBtnTag) hudBtnTag.textContent = `${val} BPM`;

  const sliders = ['bpm-slider', 'hud-bpm-slider', 'drawer-bpm-slider'];
  sliders.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = val;
  });
}

function syncAudioSliders(type, val) {
  if (type === 'bgm') {
    const ids = ['bgm-vol-slider', 'hud-bgm-slider'];
    ids.forEach(id => { const el = document.getElementById(id); if (el) el.value = val; });
    const txts = ['bgm-vol-val', 'hud-bgm-val'];
    txts.forEach(id => { const el = document.getElementById(id); if (el) el.textContent = `${val}%`; });
  } else if (type === 'metro') {
    const ids = ['metro-vol-slider', 'hud-metro-slider'];
    ids.forEach(id => { const el = document.getElementById(id); if (el) el.value = val; });
    const txts = ['metro-vol-val', 'hud-metro-val'];
    txts.forEach(id => { const el = document.getElementById(id); if (el) el.textContent = `${val}%`; });
  }
}

function initEvents() {
  // Stage 1: Character Cards Selection
  document.querySelectorAll('.char-select-card').forEach(card => {
    card.addEventListener('click', (e) => {
      e.stopPropagation();
      const target = e.currentTarget;
      state.charIndex = parseInt(target.dataset.char);
      renderPreviewCanvases();
    });
  });

  // Stage 1: Click outside characters to deselect
  const stageCharSelect = document.getElementById('stage-char-select');
  if (stageCharSelect) {
    stageCharSelect.addEventListener('click', (e) => {
      if (e.target.closest('.char-select-card') || e.target.closest('#btn-confirm-char')) {
        return;
      }
      state.charIndex = -1;
      renderPreviewCanvases();
    });
  }

  // Stage 1 -> Stage 2: Confirm Character Button
  const btnConfirmChar = document.getElementById('btn-confirm-char');
  const settingsOverlay = document.getElementById('stage-settings-overlay');
  if (btnConfirmChar && settingsOverlay) {
    btnConfirmChar.addEventListener('click', (e) => {
      e.stopPropagation();
      if (state.charIndex < 0) {
        return;
      }
      updateSettingsScenePreview();
      settingsOverlay.classList.remove('hidden');
    });
  }

  // Stage 2 -> Stage 1: Re-select Character Button
  const btnReselectChar = document.getElementById('btn-reselect-char');
  if (btnReselectChar && settingsOverlay) {
    btnReselectChar.addEventListener('click', () => {
      settingsOverlay.classList.add('hidden');
      state.charIndex = -1;
      renderPreviewCanvases();
    });
  }

  // Scene Option Buttons
  document.querySelectorAll('.scene-opt-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.scene-opt-btn').forEach(b => b.classList.remove('btn-active'));
      const target = e.currentTarget;
      target.classList.add('btn-active');
      state.sceneId = target.dataset.scene;
      updateSettingsScenePreview();
    });
  });

  // Time Option Buttons
  document.querySelectorAll('.time-opt-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.time-opt-btn').forEach(b => b.classList.remove('btn-active'));
      const target = e.currentTarget;
      target.classList.add('btn-active');
      state.targetTime = parseInt(target.dataset.time);
      state.remainingTime = state.targetTime;
    });
  });

  // Metronome Tone Option Buttons
  document.querySelectorAll('.tone-opt-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.tone-opt-btn').forEach(b => b.classList.remove('btn-active'));
      const target = e.currentTarget;
      target.classList.add('btn-active');
      state.metroTone = target.dataset.tone;
    });
  });

  // Mute BGM Toggle Button
  const btnMuteBgm = document.getElementById('btn-mute-bgm');
  if (btnMuteBgm) {
    btnMuteBgm.addEventListener('click', () => {
      const isMuted = (state.bgmVol === 0);
      const newVolVal = isMuted ? 60 : 0;
      syncAudioSliders('bgm', newVolVal);
      audio.setBgmVol(newVolVal / 100);
      btnMuteBgm.classList.toggle('bg-rose-500/20', !isMuted);
      btnMuteBgm.classList.toggle('text-rose-300', !isMuted);
    });
  }

  // BPM Slider
  const bpmSlider = document.getElementById('bpm-slider');
  const bpmVal = document.getElementById('bpm-display-val');
  if (bpmSlider) {
    bpmSlider.addEventListener('input', (e) => {
      state.bpm = parseInt(e.target.value);
      if (bpmVal) bpmVal.textContent = `${state.bpm} BPM`;
      syncBPMSliders(state.bpm);
    });
  }

  // Volume Sliders
  const bgmSlider = document.getElementById('bgm-vol-slider');
  const metroSlider = document.getElementById('metro-vol-slider');

  if (bgmSlider) {
    bgmSlider.addEventListener('input', (e) => {
      const vol = e.target.value / 100;
      document.getElementById('bgm-vol-val').textContent = `${e.target.value}%`;
      syncAudioSliders('bgm', e.target.value);
      audio.setBgmVol(vol);
    });
  }
  if (metroSlider) {
    metroSlider.addEventListener('input', (e) => {
      const vol = e.target.value / 100;
      document.getElementById('metro-vol-val').textContent = `${e.target.value}%`;
      syncAudioSliders('metro', e.target.value);
      audio.setMetroVol(vol);
    });
  }

  // HUD Sliders
  const hudBpmSlider = document.getElementById('hud-bpm-slider');
  const drawerBpmSlider = document.getElementById('drawer-bpm-slider');

  [hudBpmSlider, drawerBpmSlider].forEach(slider => {
    if (slider) {
      slider.addEventListener('input', (e) => {
        state.bpm = parseInt(e.target.value);
        syncBPMSliders(state.bpm);
      });
    }
  });

  const hudBgmSlider = document.getElementById('hud-bgm-slider');
  const hudMetroSlider = document.getElementById('hud-metro-slider');

  if (hudBgmSlider) {
    hudBgmSlider.addEventListener('input', (e) => {
      syncAudioSliders('bgm', e.target.value);
      audio.setBgmVol(e.target.value / 100);
    });
  }
  if (hudMetroSlider) {
    hudMetroSlider.addEventListener('input', (e) => {
      syncAudioSliders('metro', e.target.value);
      audio.setMetroVol(e.target.value / 100);
    });
  }

  // Audio Drawer Toggle
  const btnToggleDrawer = document.getElementById('btn-toggle-audio-panel');
  const btnCloseDrawer = document.getElementById('btn-close-audio-panel');
  const drawer = document.getElementById('audio-panel-drawer');

  if (btnToggleDrawer && drawer) {
    btnToggleDrawer.addEventListener('click', () => {
      drawer.classList.toggle('hidden');
    });
  }
  if (btnCloseDrawer && drawer) {
    btnCloseDrawer.addEventListener('click', () => {
      drawer.classList.add('hidden');
    });
  }

  // Pause Button
  const btnPause = document.getElementById('btn-pause-run');
  if (btnPause) {
    btnPause.addEventListener('click', () => {
      state.isPaused = !state.isPaused;
      document.getElementById('pause-icon').textContent = state.isPaused ? '▶️' : '⏸️';
      document.getElementById('pause-text').textContent = state.isPaused ? '繼續' : '暫停';
      
      if (!state.isPaused) {
        audio.startAudio();
      }
    });
  }

  // Cancel Button & Confirmation Modal (Yes / No Prompt)
  const btnCancel = document.getElementById('btn-cancel-run');
  const cancelModal = document.getElementById('cancel-confirm-modal');
  const btnCancelConfirmNo = document.getElementById('btn-cancel-confirm-no');
  const btnCancelConfirmYes = document.getElementById('btn-cancel-confirm-yes');
  let wasPausedBeforeCancelModal = false;

  if (btnCancel && cancelModal) {
    btnCancel.addEventListener('click', () => {
      wasPausedBeforeCancelModal = state.isPaused;
      state.isPaused = true;
      if (typeof audio !== 'undefined' && audio) audio.pauseAudio();
      cancelModal.classList.remove('hidden');
    });
  }

  if (btnCancelConfirmNo && cancelModal) {
    btnCancelConfirmNo.addEventListener('click', () => {
      cancelModal.classList.add('hidden');
      if (!wasPausedBeforeCancelModal) {
        state.isPaused = false;
        if (typeof audio !== 'undefined' && audio) audio.startAudio();
      }
    });
  }

  if (btnCancelConfirmYes && cancelModal) {
    btnCancelConfirmYes.addEventListener('click', () => {
      cancelModal.classList.add('hidden');
      resetToStandbyState();
    });
  }

  // Navigation Buttons
  document.getElementById('btn-start-run').addEventListener('click', startCountdown);
  document.getElementById('btn-run-again').addEventListener('click', startCountdown);
  document.getElementById('btn-back-standby').addEventListener('click', () => {
    resetToStandbyState();
  });

  window.addEventListener('resize', () => {
    stageRenderer.resize();
    renderPreviewCanvases();
  });
}

function resetToStandbyState() {
  // 1. Stop Web Audio metronome & BGM
  if (typeof audio !== 'undefined' && audio) {
    audio.stopAudio();
  }

  // 2. Stop Canvas animation loop & clear offscreen background cache
  if (typeof stageRenderer !== 'undefined' && stageRenderer) {
    stageRenderer.stop();
    stageRenderer.cachedBgCanvas = null;
  }

  // 3. Clear all intervals & timers
  if (runTimer) {
    clearInterval(runTimer);
    runTimer = null;
  }
  if (typeof speechTimer !== 'undefined' && speechTimer) {
    clearInterval(speechTimer);
    speechTimer = null;
  }

  // 4. Hide speech bubble
  const speechBubble = document.getElementById('speech-bubble');
  if (speechBubble) speechBubble.classList.add('hidden');

  // 5. Release Screen Wake Lock
  if (state.wakeLock) {
    state.wakeLock.release().catch(() => {});
    state.wakeLock = null;
  }

  // 6. Reset UI State Flags & Controls
  state.isPaused = false;
  state.isCountdown = false;
  state.charIndex = -1;

  const pauseIcon = document.getElementById('pause-icon');
  const pauseText = document.getElementById('pause-text');
  if (pauseIcon) pauseIcon.textContent = '⏸️';
  if (pauseText) pauseText.textContent = '暫停';

  // 7. Switch screen to Standby mode
  switchScreen('standby');
}
