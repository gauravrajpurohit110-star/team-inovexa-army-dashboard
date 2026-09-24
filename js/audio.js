/**
 * Indian Army Tactical Terminal - Audio Synthesizer Module
 * Native Web Audio API - Zero external audio file dependencies.
 * Implements MIL-STD-1472H compliant auditory cues & avionics master warnings.
 */
let audioContext = null;
let audioEnabled = true;
let emergencyAlarmInterval = null;
let isEmergencySilenced = false;

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

/**
 * Authentic Military Avionics Dual-Tone Master Warning Chime
 * F-16 / Armored Combat Vehicle BMS Master Caution Chime (880 Hz -> 440 Hz dual chord)
 */
function playAvionicsMasterWarning() {
  if (!audioEnabled || isEmergencySilenced) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const t = ctx.currentTime;
    
    // First High Chime (880 Hz, A5)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(880, t);
    gain1.gain.setValueAtTime(0.12, t);
    gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(t);
    osc1.stop(t + 0.16);

    // Second Low Harmonic Chime (440 Hz, A4) with subtle overtone
    const t2 = t + 0.11;
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(440, t2);
    gain2.gain.setValueAtTime(0.14, t2);
    gain2.gain.exponentialRampToValueAtTime(0.001, t2 + 0.32);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(t2);
    osc2.stop(t2 + 0.32);

  } catch (e) {
    console.warn('Avionics warning audio error', e);
  }
}

/**
 * Tactical Interlock Charging Tone (sweeps up as Spacebar is held)
 */
function playInterlockChargeTone(progress) {
  if (!audioEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const freq = 280 + (progress * 520); // 280 Hz -> 800 Hz
    playBeep(freq, 0.05, 'sine');
  } catch (e) {
    // ignore
  }
}

function playAlarmTone() {
  playAvionicsMasterWarning();
}

/**
 * Continuous distress alarm loop with interval
 */
function startEmergencyAudioLoop() {
  isEmergencySilenced = false;
  if (emergencyAlarmInterval) clearInterval(emergencyAlarmInterval);
  
  // Initial dual-tone chime
  playAvionicsMasterWarning();

  // Periodic chime every 4.2 seconds
  emergencyAlarmInterval = setInterval(() => {
    if (!isEmergencySilenced) {
      playAvionicsMasterWarning();
    }
  }, 4200);
}

function stopEmergencyAudioLoop() {
  if (emergencyAlarmInterval) {
    clearInterval(emergencyAlarmInterval);
    emergencyAlarmInterval = null;
  }
  isEmergencySilenced = false;
}

function toggleEmergencyAudioSilence() {
  isEmergencySilenced = !isEmergencySilenced;
  const label = document.getElementById('sos-silence-label');
  const icon = document.getElementById('sos-silence-icon');
  const btn = document.getElementById('sos-silence-btn');

  if (isEmergencySilenced) {
    if (label) label.textContent = 'ALARM SILENCED';
    if (btn) {
      btn.classList.remove('bg-red-950/70', 'border-red-700/60', 'text-red-200');
      btn.classList.add('bg-amber-950/80', 'border-amber-600', 'text-amber-300');
    }
    if (window.showToast) {
      window.showToast('ALARM SILENCED', 'Acoustic siren silenced. Visual distress transponder remains active.', 'info');
    }
  } else {
    if (label) label.textContent = 'SILENCE AUDIO';
    if (btn) {
      btn.classList.add('bg-red-950/70', 'border-red-700/60', 'text-red-200');
      btn.classList.remove('bg-amber-950/80', 'border-amber-600', 'text-amber-300');
    }
    playAvionicsMasterWarning();
  }
  return isEmergencySilenced;
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

// Global Exports
window.playBeep = playBeep;
window.playAlarmTone = playAlarmTone;
window.playAvionicsMasterWarning = playAvionicsMasterWarning;
window.playInterlockChargeTone = playInterlockChargeTone;
window.startEmergencyAudioLoop = startEmergencyAudioLoop;
window.stopEmergencyAudioLoop = stopEmergencyAudioLoop;
window.toggleEmergencyAudioSilence = toggleEmergencyAudioSilence;
window.toggleAudio = toggleAudio;
window.getAudioContext = getAudioContext;
