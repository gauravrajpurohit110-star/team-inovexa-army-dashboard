/**
 * Indian Army Tactical Terminal - Defense-Grade Audio Synthesizer Module
 * Native Web Audio API - Zero external audio file dependencies.
 * Implements MIL-STD-1472H compliant auditory warning signals,
 * avionics master caution chimes, military radio squelch, and mechanical tactile feedback.
 */

let audioContext = null;
let audioEnabled = true;
let emergencyAlarmInterval = null;
let isEmergencySilenced = false;

// Active interlock charging synth nodes
let chargeOsc = null;
let chargeGain = null;
let chargeLfo = null;
let chargeLfoGain = null;
let lastCriticalChirpProgress = 0;

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

/**
 * Standard tactical tone with anti-pop envelope
 */
function playBeep(freq = 800, duration = 0.06, type = 'sine') {
  if (!audioEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.08, ctx.currentTime + 0.005);
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
 * Tactical Mechanical Switch Click
 * Realistic dual-transient military switch actuation (160 Hz chassis thud + 2.8 kHz micro spring snap)
 */
function playTacticalClick() {
  if (!audioEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const t = ctx.currentTime;

    // Transient 1: Mechanical Contact Snap (Bandpassed micro-click)
    const oscSnap = ctx.createOscillator();
    const gainSnap = ctx.createGain();
    oscSnap.type = 'triangle';
    oscSnap.frequency.setValueAtTime(2800, t);
    oscSnap.frequency.exponentialRampToValueAtTime(600, t + 0.015);
    gainSnap.gain.setValueAtTime(0.09, t);
    gainSnap.gain.exponentialRampToValueAtTime(0.001, t + 0.018);
    oscSnap.connect(gainSnap);
    gainSnap.connect(ctx.destination);
    oscSnap.start(t);
    oscSnap.stop(t + 0.02);

    // Transient 2: Low-frequency Chassis Contact Thud
    const oscThud = ctx.createOscillator();
    const gainThud = ctx.createGain();
    oscThud.type = 'sine';
    oscThud.frequency.setValueAtTime(180, t);
    oscThud.frequency.exponentialRampToValueAtTime(60, t + 0.025);
    gainThud.gain.setValueAtTime(0.10, t);
    gainThud.gain.exponentialRampToValueAtTime(0.001, t + 0.028);
    oscThud.connect(gainThud);
    gainThud.connect(ctx.destination);
    oscThud.start(t);
    oscThud.stop(t + 0.03);
  } catch (e) {
    // ignore
  }
}

/**
 * 1. SOS HOLD SEQUENCE: Active Spool-up / Charging Synth
 * Continuously charges pitch 220 Hz -> 920 Hz with accelerating LFO warble
 */
function startInterlockAudioCharge() {
  if (!audioEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    stopInterlockAudioCharge();

    const t = ctx.currentTime;
    lastCriticalChirpProgress = 0;

    chargeOsc = ctx.createOscillator();
    chargeOsc.type = 'sawtooth';
    chargeOsc.frequency.setValueAtTime(220, t);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(650, t);
    filter.Q.setValueAtTime(4.0, t);

    chargeLfo = ctx.createOscillator();
    chargeLfo.type = 'sine';
    chargeLfo.frequency.setValueAtTime(3.5, t);

    chargeLfoGain = ctx.createGain();
    chargeLfoGain.gain.setValueAtTime(15, t);

    chargeLfo.connect(chargeOsc.frequency);

    chargeGain = ctx.createGain();
    chargeGain.gain.setValueAtTime(0.001, t);
    chargeGain.gain.linearRampToValueAtTime(0.09, t + 0.08);

    chargeOsc.connect(filter);
    filter.connect(chargeGain);
    chargeGain.connect(ctx.destination);

    chargeOsc.start(t);
    chargeLfo.start(t);
  } catch (e) {
    console.warn('Interlock charge audio error', e);
  }
}

function updateInterlockAudioCharge(progress) {
  if (!audioEnabled || !chargeOsc || !chargeLfo) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const t = ctx.currentTime;

    const freq = 220 + (progress * 700);
    chargeOsc.frequency.setTargetAtTime(freq, t, 0.04);

    const lfoRate = 3.5 + (progress * 18.5);
    chargeLfo.frequency.setTargetAtTime(lfoRate, t, 0.04);

    if (progress >= 0.75 && progress - lastCriticalChirpProgress >= 0.08) {
      lastCriticalChirpProgress = progress;
      playBeep(1380 + (progress * 300), 0.035, 'square');
    }
  } catch (e) {
    // ignore
  }
}

function stopInterlockAudioCharge() {
  try {
    if (chargeGain && audioContext) {
      const t = audioContext.currentTime;
      chargeGain.gain.cancelScheduledValues(t);
      chargeGain.gain.linearRampToValueAtTime(0.001, t + 0.05);
      setTimeout(() => {
        if (chargeOsc) {
          try { chargeOsc.stop(); chargeOsc.disconnect(); } catch (e) {}
          chargeOsc = null;
        }
        if (chargeLfo) {
          try { chargeLfo.stop(); chargeLfo.disconnect(); } catch (e) {}
          chargeLfo = null;
        }
        chargeGain = null;
      }, 60);
    } else {
      if (chargeOsc) { try { chargeOsc.stop(); } catch (e) {} chargeOsc = null; }
      if (chargeLfo) { try { chargeLfo.stop(); } catch (e) {} chargeLfo = null; }
      chargeGain = null;
    }
  } catch (e) {}
}

/**
 * 2. SOS ABORT / RELEASE TONE
 * Pitch drops down to 140 Hz, then plays two soft de-escalation tones
 */
function abortInterlockAudioCharge() {
  if (!audioEnabled) return;
  stopInterlockAudioCharge();
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const t = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(540, t);
    osc.frequency.exponentialRampToValueAtTime(140, t + 0.18);
    gain.gain.setValueAtTime(0.08, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.20);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.20);

    setTimeout(() => {
      playBeep(480, 0.06, 'sine');
      setTimeout(() => playBeep(320, 0.08, 'sine'), 70);
    }, 120);
  } catch (e) {}
}

/**
 * 3. SOS TRIGGER COMMIT IMPACT (At 2.0s Threshold)
 * Heavy sub-bass tactical contact thump + satellite carrier ignition burst + data blip
 */
function playDistressTriggerImpact() {
  stopInterlockAudioCharge();
  if (!audioEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const t = ctx.currentTime;

    // Layer 1: Sub-bass hydraulic impact thump (75 Hz -> 25 Hz)
    const oscSub = ctx.createOscillator();
    const gainSub = ctx.createGain();
    oscSub.type = 'sine';
    oscSub.frequency.setValueAtTime(75, t);
    oscSub.frequency.exponentialRampToValueAtTime(25, t + 0.35);
    gainSub.gain.setValueAtTime(0.25, t);
    gainSub.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
    oscSub.connect(gainSub);
    gainSub.connect(ctx.destination);
    oscSub.start(t);
    oscSub.stop(t + 0.40);

    // Layer 2: High-voltage satellite transponder arc / capacitor ignition
    const oscArc = ctx.createOscillator();
    const gainArc = ctx.createGain();
    oscArc.type = 'sawtooth';
    oscArc.frequency.setValueAtTime(1600, t);
    oscArc.frequency.exponentialRampToValueAtTime(400, t + 0.15);
    gainArc.gain.setValueAtTime(0.12, t);
    gainArc.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    oscArc.connect(gainArc);
    gainArc.connect(ctx.destination);
    oscArc.start(t);
    oscArc.stop(t + 0.18);

    // Layer 3: Cryptographic data transmission chirp (2.2 kHz -> 2.8 kHz)
    setTimeout(() => {
      playBeep(2200, 0.04, 'square');
      setTimeout(() => playBeep(2800, 0.05, 'square'), 50);
    }, 160);
  } catch (e) {
    console.warn('Distress trigger impact error', e);
  }
}

/**
 * 4. CONTINUOUS COMBAT DISTRESS STATE:
 * Authentic Military Avionics Dual-Tone Master Warning Chime (F-16 / BMS standard)
 * 940 Hz [A#5] high chime + 520 Hz [C5] low chime with harmonic overtone decay
 */
function playAvionicsMasterWarning() {
  if (!audioEnabled || isEmergencySilenced) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const t = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const osc1Harm = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1Harm.type = 'triangle';
    osc1.frequency.setValueAtTime(940, t);
    osc1Harm.frequency.setValueAtTime(1410, t);
    gain1.gain.setValueAtTime(0.13, t);
    gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.18);

    osc1.connect(gain1);
    osc1Harm.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(t);
    osc1Harm.start(t);
    osc1.stop(t + 0.18);
    osc1Harm.stop(t + 0.18);

    const t2 = t + 0.11;
    const osc2 = ctx.createOscillator();
    const osc2Harm = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2Harm.type = 'triangle';
    osc2.frequency.setValueAtTime(520, t2);
    osc2Harm.frequency.setValueAtTime(780, t2);
    gain2.gain.setValueAtTime(0.15, t2);
    gain2.gain.exponentialRampToValueAtTime(0.001, t2 + 0.35);

    osc2.connect(gain2);
    osc2Harm.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(t2);
    osc2Harm.start(t2);
    osc2.stop(t2 + 0.35);
    osc2Harm.stop(t2 + 0.35);
  } catch (e) {
    console.warn('Avionics warning audio error', e);
  }
}

/**
 * Satellite Transponder Burst Chime (Triggered every 15s in distress mode)
 */
function playSatelliteBurstChime() {
  if (!audioEnabled || isEmergencySilenced) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1920, t);
    osc.frequency.exponentialRampToValueAtTime(2400, t + 0.05);
    gain.gain.setValueAtTime(0.07, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.06);
  } catch (e) {}
}

/**
 * 5. STAND DOWN (De-escalation Resolution Chord)
 * Ascending & resolving military 3-tone chime (G5 -> E5 -> C5)
 */
function playStandDownTone() {
  if (!audioEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const t = ctx.currentTime;

    const notes = [
      { f: 784, d: 0.10, dt: 0 },
      { f: 659, d: 0.12, dt: 0.10 },
      { f: 523, d: 0.28, dt: 0.22 }
    ];

    notes.forEach(n => {
      const startT = t + n.dt;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(n.f, startT);
      gain.gain.setValueAtTime(0.09, startT);
      gain.gain.exponentialRampToValueAtTime(0.001, startT + n.d);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startT);
      osc.stop(startT + n.d);
    });
  } catch (e) {}
}

/**
 * 6. MILITARY RADIO COMMS SOUND:
 * Bandpassed white noise squelch burst + authentic 1200 Hz Roger beep
 */
function playRadioCommsSound() {
  if (!audioEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const t = ctx.currentTime;

    const bufferSize = Math.floor(ctx.sampleRate * 0.045);
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const whiteNoise = ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;

    const bandpass = ctx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.setValueAtTime(1400, t);
    bandpass.Q.setValueAtTime(2.5, t);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.06, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.045);

    whiteNoise.connect(bandpass);
    bandpass.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    whiteNoise.start(t);

    setTimeout(() => {
      playBeep(1200, 0.05, 'sine');
    }, 45);
  } catch (e) {}
}

/**
 * 7. PNEUMATIC VALVE & ACTUATOR SOUND:
 * Used for CTIS (Tire pressure release) and Differential Lock solenoids
 */
function playPneumaticActuatorSound(isDeflate = true) {
  if (!audioEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const t = ctx.currentTime;

    const dur = isDeflate ? 0.14 : 0.08;
    const bufferSize = Math.floor(ctx.sampleRate * dur);
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const noiseSrc = ctx.createBufferSource();
    noiseSrc.buffer = noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(3200, t);
    filter.frequency.exponentialRampToValueAtTime(800, t + dur);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.07, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);

    noiseSrc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noiseSrc.start(t);

    setTimeout(() => {
      playBeep(210, 0.04, 'triangle');
    }, Math.floor(dur * 1000 * 0.7));
  } catch (e) {}
}

/**
 * 8. RADAR / SONAR PING SOUND:
 * Clean 1480 Hz resonant acoustic ping with tail (for GPS lock / Waypoint pings)
 */
function playRadarPingSound() {
  if (!audioEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const t = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1480, t);
    gain.gain.setValueAtTime(0.10, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.35);
  } catch (e) {}
}

/**
 * Continuous distress alarm loop with interval
 */
function startEmergencyAudioLoop() {
  isEmergencySilenced = false;
  if (emergencyAlarmInterval) clearInterval(emergencyAlarmInterval);
  
  playAvionicsMasterWarning();

  emergencyAlarmInterval = setInterval(() => {
    if (!isEmergencySilenced) {
      playAvionicsMasterWarning();
    }
  }, 4800);
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
    playTacticalClick();
  } else {
    if (label) label.textContent = 'BEEP: MUTED';
    if (icon) icon.className = 'w-3.5 h-3.5 text-slate-500';
  }
}

// Global Exports
window.playBeep = playBeep;
window.playTacticalClick = playTacticalClick;
window.playAlarmTone = playAvionicsMasterWarning;
window.playAvionicsMasterWarning = playAvionicsMasterWarning;
window.startInterlockAudioCharge = startInterlockAudioCharge;
window.updateInterlockAudioCharge = updateInterlockAudioCharge;
window.stopInterlockAudioCharge = stopInterlockAudioCharge;
window.abortInterlockAudioCharge = abortInterlockAudioCharge;
window.playDistressTriggerImpact = playDistressTriggerImpact;
window.playSatelliteBurstChime = playSatelliteBurstChime;
window.playStandDownTone = playStandDownTone;
window.playRadioCommsSound = playRadioCommsSound;
window.playPneumaticActuatorSound = playPneumaticActuatorSound;
window.playRadarPingSound = playRadarPingSound;
window.startEmergencyAudioLoop = startEmergencyAudioLoop;
window.stopEmergencyAudioLoop = stopEmergencyAudioLoop;
window.toggleEmergencyAudioSilence = toggleEmergencyAudioSilence;
window.toggleAudio = toggleAudio;
window.getAudioContext = getAudioContext;

