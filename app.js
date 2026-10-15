/**
 * 超慢跑陪伴 (Slow Jogging Companion) - Main Entrypoint
 */
window.addEventListener('DOMContentLoaded', async () => {
  initEvents();
  switchScreen('standby');
  await charMgr.load();
  sceneMgr.preload().catch(e => console.warn(e));
});

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    if (typeof stageRenderer !== 'undefined' && stageRenderer) {
      stageRenderer.lastTimestamp = performance.now();
    }
    if (typeof audio !== 'undefined' && audio && audio.ctx && audio.ctx.state === 'suspended') {
      audio.ctx.resume().catch(() => {});
    }
    if (typeof audio !== 'undefined' && audio && state.screen === 'standby' && audio.currentTrackType === 'home' && audio.bgmAudio.paused) {
      audio.playHomeBgm();
    }
  }
});
