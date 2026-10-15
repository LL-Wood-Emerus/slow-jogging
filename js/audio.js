/**
 * Audio Engine Module (Web Audio Metronome + MP3 BGM Player - Zero Leak Node Graph)
 */
class AudioEngine {
  constructor() {
    this.ctx = null;
    this.metroTimer = null;
    this.nextNoteTime = 0;
    this.beatCount = 0;
    this.metroGainNode = null;
    this.masterGainNode = null;

    // HTML5 BGM MP3 Audio Player
    this.bgmAudio = new Audio();
    this.bgmAudio.loop = true;
    this.homeTrack = 'assets/BGM/home.mp3';
    this.currentTrackType = null; // 'home' | 'running' | null
    this.bgmTracks = {
      topic1: 'assets/BGM/topic1.mp3',
      topic2: 'assets/BGM/topic2.mp3',
      topic3: 'assets/BGM/topic3.mp3',
      topic4: 'assets/BGM/topic4.mp3',
      topic5: 'assets/BGM/topic5.mp3',
      topic6: 'assets/BGM/topic6.mp3',
      topic7: 'assets/BGM/topic7.mp3',
      topic8: 'assets/BGM/topic8.mp3'
    };
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
      this.masterGainNode = this.ctx.createGain();
      this.masterGainNode.connect(this.ctx.destination);

      this.metroGainNode = this.ctx.createGain();
      this.metroGainNode.gain.value = state.metroVol;
      this.metroGainNode.connect(this.masterGainNode);

      this.preRenderBuffers();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  preRenderBuffers() {
    const tones = ['woodblock', 'rimshot', 'tick', 'beep'];
    this.buffers = {};

    tones.forEach(tone => {
      this.buffers[tone] = {
        accent: this.renderToneBuffer(tone, true),
        regular: this.renderToneBuffer(tone, false)
      };
    });
  }

  renderToneBuffer(tone, isFirstBeat) {
    const sampleRate = this.ctx ? this.ctx.sampleRate : 44100;
    const duration = 0.05;
    const offlineCtx = new OfflineAudioContext(1, Math.ceil(sampleRate * duration), sampleRate);

    if (tone === 'woodblock') {
      const osc = offlineCtx.createOscillator();
      const gain = offlineCtx.createGain();
      const startFreq = isFirstBeat ? 1000 : 750;
      const endFreq = isFirstBeat ? 350 : 220;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(startFreq, 0);
      osc.frequency.exponentialRampToValueAtTime(endFreq, 0.025);

      gain.gain.setValueAtTime(0.6, 0);
      gain.gain.exponentialRampToValueAtTime(0.0001, 0.04);

      osc.connect(gain);
      gain.connect(offlineCtx.destination);
      osc.start(0);
      osc.stop(0.04);

      const noiseBufSize = Math.floor(sampleRate * 0.008);
      const noiseBuf = offlineCtx.createBuffer(1, noiseBufSize, sampleRate);
      const noiseData = noiseBuf.getChannelData(0);
      for (let i = 0; i < noiseBufSize; i++) {
        noiseData[i] = Math.random() * 2 - 1;
      }
      const whiteNoise = offlineCtx.createBufferSource();
      whiteNoise.buffer = noiseBuf;
      const filter = offlineCtx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = isFirstBeat ? 1400 : 950;
      filter.Q.value = 3;
      const noiseGain = offlineCtx.createGain();
      noiseGain.gain.setValueAtTime(0.35, 0);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, 0.008);

      whiteNoise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(offlineCtx.destination);
      whiteNoise.start(0);
      whiteNoise.stop(0.008);
    } else if (tone === 'rimshot') {
      const osc = offlineCtx.createOscillator();
      const gain = offlineCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(isFirstBeat ? 1200 : 900, 0);
      osc.frequency.exponentialRampToValueAtTime(100, 0.02);
      gain.gain.setValueAtTime(0.7, 0);
      gain.gain.exponentialRampToValueAtTime(0.001, 0.02);
      osc.connect(gain);
      gain.connect(offlineCtx.destination);
      osc.start(0);
      osc.stop(0.02);
    } else if (tone === 'tick') {
      const osc = offlineCtx.createOscillator();
      const gain = offlineCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(isFirstBeat ? 1800 : 1300, 0);
      gain.gain.setValueAtTime(0.4, 0);
      gain.gain.exponentialRampToValueAtTime(0.001, 0.015);
      osc.connect(gain);
      gain.connect(offlineCtx.destination);
      osc.start(0);
      osc.stop(0.015);
    } else if (tone === 'beep') {
      const osc = offlineCtx.createOscillator();
      const gain = offlineCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(isFirstBeat ? 1046.5 : 523.25, 0);
      gain.gain.setValueAtTime(0.5, 0);
      gain.gain.exponentialRampToValueAtTime(0.001, 0.03);
      osc.connect(gain);
      gain.connect(offlineCtx.destination);
      osc.start(0);
      osc.stop(0.03);
    }

    let renderedBuf = null;
    offlineCtx.startRendering().then(buf => {
      renderedBuf = buf;
    }).catch(e => console.warn('Offline render error:', e));

    return () => renderedBuf;
  }

  setMetroVol(vol) {
    state.metroVol = vol;
    if (this.metroGainNode) {
      this.metroGainNode.gain.setTargetAtTime(vol, this.ctx.currentTime, 0.05);
    }
  }

  getHomeBgmVol() {
    if (state.bgmVol <= 0.01) return 0;
    // Keep home screen BGM gentle and soft (approx 20% volume)
    return Math.min(0.22, state.bgmVol * 0.35);
  }

  setBgmVol(vol) {
    state.bgmVol = vol;
    if (this.bgmAudio) {
      if (this.currentTrackType === 'home') {
        this.bgmAudio.volume = this.getHomeBgmVol();
      } else {
        this.bgmAudio.volume = Math.max(0, Math.min(1, vol));
      }
    }
  }

  playHomeBgm() {
    this.currentTrackType = 'home';
    const homeSrc = this.homeTrack;
    const currentSrc = this.bgmAudio.src;

    if (!currentSrc || !currentSrc.endsWith(encodeURI(homeSrc))) {
      this.bgmAudio.src = homeSrc;
    }
    this.bgmAudio.volume = this.getHomeBgmVol();
    const playPromise = this.bgmAudio.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        // Autoplay policy fallback: resume playing on first user click/touch
        const onFirstInteract = () => {
          if (state.screen === 'standby' && this.currentTrackType === 'home') {
            this.bgmAudio.play().catch(() => {});
          }
          document.removeEventListener('pointerdown', onFirstInteract);
          document.removeEventListener('keydown', onFirstInteract);
        };
        document.addEventListener('pointerdown', onFirstInteract, { once: true });
        document.addEventListener('keydown', onFirstInteract, { once: true });
      });
    }
  }

  playBgm(sceneId) {
    this.currentTrackType = 'running';
    const trackSrc = this.bgmTracks[sceneId || state.sceneId] || this.bgmTracks.topic1;
    const currentSrc = this.bgmAudio.src;
    
    if (!currentSrc || !currentSrc.endsWith(encodeURI(trackSrc))) {
      this.bgmAudio.src = trackSrc;
    }
    this.bgmAudio.volume = state.bgmVol;
    this.bgmAudio.play().catch(e => console.warn('BGM autoplay blocked or loading:', e));
  }

  startAudio() {
    this.init();
    this.playBgm(state.sceneId);

    if (this.metroTimer) {
      clearTimeout(this.metroTimer);
      this.metroTimer = null;
    }
    if (this.ctx) {
      this.nextNoteTime = this.ctx.currentTime;
    }
    this.scheduleAudio();
  }

  pauseAudio() {
    // Keep BGM playing continuously during exercise pause, only stop metronome clicks
    if (this.metroTimer) {
      clearTimeout(this.metroTimer);
      this.metroTimer = null;
    }
  }

  stopBgm() {
    if (this.bgmAudio) {
      this.bgmAudio.pause();
      this.bgmAudio.currentTime = 0;
    }
  }

  stopAudio() {
    this.stopBgm();
    if (this.metroTimer) {
      clearTimeout(this.metroTimer);
      this.metroTimer = null;
    }
  }

  playClick(time) {
    if (state.metroVol <= 0.01) return;
    const isFirstBeat = (this.beatCount % 4 === 0);
    const tone = state.metroTone || 'woodblock';

    const tonePair = (this.buffers && this.buffers[tone]) ? this.buffers[tone] : (this.buffers && this.buffers.woodblock);
    if (!tonePair) return;

    const getBuffer = isFirstBeat ? tonePair.accent : tonePair.regular;
    const buffer = getBuffer ? getBuffer() : null;
    if (!buffer) return;

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(this.metroGainNode);
    source.onended = () => {
      try { source.disconnect(); } catch (e) {}
    };
    source.start(time);
  }

  scheduleAudio = () => {
    if (state.screen !== 'running' || state.isPaused) {
      this.metroTimer = null;
      return;
    }

    const safeBpm = Math.max(30, state.bpm || 180);
    const secondsPerBeat = 60.0 / safeBpm;
    const lookahead = 0.1;

    if (this.nextNoteTime < this.ctx.currentTime) {
      this.nextNoteTime = this.ctx.currentTime;
    }

    let metroIter = 0;
    while (this.nextNoteTime < this.ctx.currentTime + lookahead && metroIter < 8) {
      this.playClick(this.nextNoteTime);
      this.nextNoteTime += secondsPerBeat;
      this.beatCount++;
      metroIter++;
    }

    this.metroTimer = setTimeout(this.scheduleAudio, 25);
  };

  playFx(type) {
    this.init();
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    if (type === 'beep') {
      osc.frequency.setValueAtTime(600, now);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
      osc.connect(gain); gain.connect(this.masterGainNode);
      osc.onended = () => { try { osc.disconnect(); gain.disconnect(); } catch (e) {} };
      osc.start(now); osc.stop(now + 0.15);
    } else if (type === 'go') {
      osc.frequency.setValueAtTime(1000, now);
      gain.gain.setValueAtTime(0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
      osc.connect(gain); gain.connect(this.masterGainNode);
      osc.onended = () => { try { osc.disconnect(); gain.disconnect(); } catch (e) {} };
      osc.start(now); osc.stop(now + 0.4);
    } else if (type === 'victory') {
      const notes = [523.25, 659.25, 783.99, 1046.50];
      notes.forEach((freq, idx) => {
        const noteOsc = this.ctx.createOscillator();
        const noteGain = this.ctx.createGain();
        const noteTime = now + idx * 0.12;
        noteOsc.frequency.setValueAtTime(freq, noteTime);
        noteGain.gain.setValueAtTime(0.3, noteTime);
        noteGain.gain.exponentialRampToValueAtTime(0.01, noteTime + 0.3);
        noteOsc.connect(noteGain); noteGain.connect(this.masterGainNode);
        noteOsc.onended = () => { try { noteOsc.disconnect(); noteGain.disconnect(); } catch (e) {} };
        noteOsc.start(noteTime); noteOsc.stop(noteTime + 0.3);
      });
    }
  }
}

const audio = new AudioEngine();
