/**
 * Indian Army Tactical Terminal - Audio Synthesizer Module
 * Native Web Audio API - Zero external audio file dependencies.
 */
let audioContext = null;
let audioEnabled = true;

function getAudioContext() {
  if (!audioContext) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (AudioCtx) audioContext = new AudioCtx();
  }
  if (audioContext && audioContext.state === 'suspended') {
    audioContext.resume();
  }
  return audioContext;
}

function playBeep(freq = 800, duration = 0.06, type = 'sine') {
  if (!audioEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch (e) {
    console.warn('Audio feedback error', e);
  }
}

function playAlarmTone() {
  if (!audioEnabled) return;
  playBeep(980, 0.08, 'sawtooth');
  setTimeout(() => playBeep(1200, 0.12, 'sawtooth'), 100);
}

function toggleAudio() {
  audioEnabled = !audioEnabled;
  const label = document.getElementById('audio-label');
  const icon = document.getElementById('audio-icon');
  if (audioEnabled) {
    if (label) label.textContent = 'BEEP: ON';
    if (icon) icon.className = 'w-3.5 h-3.5 text-emerald-400';
    playBeep(1000, 0.05);
  } else {
    if (label) label.textContent = 'BEEP: MUTED';
    if (icon) icon.className = 'w-3.5 h-3.5 text-slate-500';
  }
}

window.playBeep = playBeep;
window.playAlarmTone = playAlarmTone;
window.toggleAudio = toggleAudio;
window.getAudioContext = getAudioContext;
