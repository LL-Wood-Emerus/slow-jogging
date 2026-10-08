/**
 * Speech Bubble Encouragement Engine Module (Dynamic Character Speech JSON)
 */
let characterSpeechData = {};

async function loadSpeechData() {
  try {
    const res = await fetch('assets/speech.json');
    if (res.ok) {
      characterSpeechData = await res.json();
    }
  } catch (e) {
    console.warn('Could not load assets/speech.json, fallback to default speech phrases', e);
  }
}

// Load speech config on module script load
loadSpeechData();

let speechTimer = null;

function triggerRandomSpeech() {
  const bubble = document.getElementById('speech-bubble');
  const textEl = document.getElementById('speech-text');
  if (!bubble || !textEl || state.screen !== 'running' || state.isPaused) return;

  const charObj = (state.charIndex >= 0 && characters[state.charIndex]) ? characters[state.charIndex] : null;
  const charId = charObj ? charObj.id : 'default';

  const list = (characterSpeechData && characterSpeechData[charId])
    ? characterSpeechData[charId]
    : ((characterSpeechData && characterSpeechData.default) ? characterSpeechData.default : [
        '保持 180 步頻！腳掌輕輕著地~ ✨',
        '超慢跑不喘不累，輕鬆享受過程！🌸',
        '太棒了！熱量正在持續燃燒🔥'
      ]);

  const phrase = list[Math.floor(Math.random() * list.length)];
  textEl.textContent = phrase;
  bubble.classList.remove('hidden');

  setTimeout(() => {
    bubble.classList.add('hidden');
  }, 4500);
}

function startSpeechEngine() {
  if (speechTimer) clearInterval(speechTimer);
  triggerRandomSpeech();
  speechTimer = setInterval(triggerRandomSpeech, 14000);
}
