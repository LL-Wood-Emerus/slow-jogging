/**
 * State & Config Module
 */
const state = {
  screen: 'standby', // 'standby' | 'countdown' | 'running' | 'celebrate'
  charIndex: -1,     // -1: 未選擇 (0: Saya, 1: Sheath, 2: Hiiragi)
  isCountdown: false, // true during initial 3-second countdown
  sceneId: 'topic1', // 'topic1' ~ 'topic8'
  targetTime: 60,   // seconds (default 1 min for testing)
  remainingTime: 60,
  bpm: 180,
  bgmVol: 0.6,
  metroVol: 0.8,
  metroTone: 'woodblock', // 'woodblock' | 'rimshot' | 'tick' | 'beep'
  isPaused: false,
  elapsedTime: 0,
  wakeLock: null,
};

const characters = [
  { id: 'saya', name: 'Saya', icon: '🍵', title: '靜謐茶香白髮少女', color: '#1e293b' },
  { id: 'sheath', name: 'Sheath', icon: '⚡', title: '元氣滿滿雙馬尾妹', color: '#0284c7' },
  { id: 'hiiragi', name: 'Hiiragi', icon: '🌸', title: '悠閒療癒包包頭妹', color: '#e11d48' },
];
