/**
 * Indian Army Tactical Terminal - Emergency SOS Module
 * 
 * Interactivity Specification:
 * 1. Hold Spacebar for 2.0 seconds:
 *    - Shifts whole terminal frame upside (-320px) revealing overhead cockpit SOS console
 *    - Tactical combat glove / arm reaches upward toward the mushroom SOS switch
 *    - Releasing Spacebar before 2.0s reverses the hand and restores normal frame view smoothly
 * 2. At 2.0 seconds:
 *    - Hand touches and presses down the physical SOS switch
 *    - Switch triggers visual indentation, mechanical click, and audio alarm sirens
 *    - Frame shifts back down to normal
 *    - Emergency SOS Alert Banner activates on dashboard with live GPS coords & elapsed distress timer
 *    - Pushes a Priority-1 Emergency Mayday entry into terminal BMS logs
 */

let spacebarDownTime = 0;
let isSpacebarPressed = false;
let spacebarRaf = null;
let isSosActivated = false;
let sosElapsedTimerInterval = null;
let sosSecondsElapsed = 0;

const HOLD_DURATION_MS = 2000; // 2 seconds

function initEmergencySos() {
  window.addEventListener('keydown', (e) => {
    // Only react to Spacebar when user is not typing in an input or textarea
    if (e.code === 'Space' || e.key === ' ') {
      const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
      if (activeTag === 'input' || activeTag === 'textarea') return;
      
      // Prevent standard browser page scroll on spacebar
      e.preventDefault();

      if (e.repeat) return; // Ignore native OS keyboard repeat

      if (!isSpacebarPressed) {
        startSosHoldSequence();
      }
    }
  });

  window.addEventListener('keyup', (e) => {
    if (e.code === 'Space' || e.key === ' ') {
      const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
      if (activeTag === 'input' || activeTag === 'textarea') return;
      
      e.preventDefault();
      if (isSpacebarPressed) {
        cancelSosHoldSequence();
      }
    }
  });

  // Also support clicking/holding the physical SOS button on-screen directly for touch/mouse
  const physicalBtn = document.getElementById('sos-physical-btn');
  if (physicalBtn) {
    physicalBtn.addEventListener('mousedown', () => {
      triggerEmergencySosSuccess();
    });
    physicalBtn.addEventListener('touchstart', () => {
      triggerEmergencySosSuccess();
    });
  }
}

function startSosHoldSequence() {
  if (isSosActivated) return; // Already active

  isSpacebarPressed = true;
  spacebarDownTime = performance.now();

  const consoleEl = document.getElementById('overhead-sos-console');
  if (consoleEl) {
    consoleEl.classList.remove('hidden');
    consoleEl.classList.add('flex');
  }

  const pill = document.getElementById('sos-key-pill');
  if (pill) pill.classList.add('active-charging');

  // Play audio priming buzz
  if (window.playBeep) window.playBeep(440, 0.08, 'sawtooth');

  // Cancel any running animation frames
  if (spacebarRaf) cancelAnimationFrame(spacebarRaf);
  spacebarRaf = requestAnimationFrame(updateSosHoldProgress);
}

function updateSosHoldProgress(currentTime) {
  if (!isSpacebarPressed) return;

  const elapsed = currentTime - spacebarDownTime;
  const progress = Math.min(1, elapsed / HOLD_DURATION_MS);

  // Apply smooth progress to:
  // 1. Frame shift upside (move entire stage or frame up)
  const stage = document.getElementById('frame-viewport-stage');
  const hand = document.getElementById('sos-operator-hand');
  const progressBar = document.getElementById('sos-key-progress');
  const countdownEl = document.getElementById('sos-sequence-countdown');
  const statusEl = document.getElementById('sos-sequence-status');

  // Progress Bar in Header
  if (progressBar) {
    progressBar.style.width = `${(progress * 100).toFixed(1)}%`;
  }

  // Shift whole terminal stage upwards (0 -> -320px) to showcase the overhead roof console
  const shiftY = progress * -320;
  if (stage) {
    stage.style.transform = `translateY(${shiftY}px)`;
  }

  // Hand travels upward towards the button (-280px bottom to 30px bottom)
  // Distance to travel: ~260px
  if (hand) {
    const handTravelY = progress * -275;
    hand.style.transform = `translateX(-50%) translateY(${handTravelY}px)`;
  }

  if (countdownEl) {
    countdownEl.textContent = `${(elapsed / 1000).toFixed(1)}s / 2.0s`;
  }

  if (statusEl) {
    statusEl.textContent = progress < 0.7 
      ? 'OPENING OVERHEAD CONSOLE & DEPLOYING ACTUATOR...'
      : 'ARM EXTENDING // CONTACT IMMINENT...';
  }

  // Pulsing pitch tone as countdown charges
  if (Math.floor(elapsed / 300) !== Math.floor((elapsed - 16) / 300)) {
    if (window.playBeep) window.playBeep(500 + progress * 500, 0.04, 'sine');
  }

  if (progress >= 1.0) {
    // 2.0 seconds reached: Hand presses button!
    triggerEmergencySosSuccess();
    return;
  }

  spacebarRaf = requestAnimationFrame(updateSosHoldProgress);
}

function cancelSosHoldSequence() {
  isSpacebarPressed = false;
  if (spacebarRaf) cancelAnimationFrame(spacebarRaf);

  const stage = document.getElementById('frame-viewport-stage');
  const hand = document.getElementById('sos-operator-hand');
  const progressBar = document.getElementById('sos-key-progress');
  const pill = document.getElementById('sos-key-pill');
  const consoleEl = document.getElementById('overhead-sos-console');
  const countdownEl = document.getElementById('sos-sequence-countdown');
  const statusEl = document.getElementById('sos-sequence-status');

  if (pill) pill.classList.remove('active-charging');
  if (progressBar) progressBar.style.width = '0%';
  if (countdownEl) countdownEl.textContent = '0.0s / 2.0s';
  if (statusEl) statusEl.textContent = 'SEQUENCE CANCELLED // RELEASE DETECTED';

  // Smoothly animate the hand reversing back and the whole frame sliding down
  if (stage) {
    stage.style.transition = 'transform 0.35s cubic-bezier(0.25, 1, 0.5, 1)';
    stage.style.transform = 'translateY(0px)';
  }
  if (hand) {
    hand.style.transition = 'transform 0.35s cubic-bezier(0.25, 1, 0.5, 1)';
    hand.style.transform = 'translateX(-50%) translateY(0px)';
  }

  if (window.playBeep) window.playBeep(320, 0.08, 'sine');

  setTimeout(() => {
    if (!isSpacebarPressed && !isSosActivated) {
      if (consoleEl) {
        consoleEl.classList.add('hidden');
        consoleEl.classList.remove('flex');
      }
      if (stage) stage.style.transition = '';
      if (hand) hand.style.transition = '';
    }
  }, 380);
}

function triggerEmergencySosSuccess() {
  isSpacebarPressed = false;
  isSosActivated = true;
  if (spacebarRaf) cancelAnimationFrame(spacebarRaf);

  const hand = document.getElementById('sos-operator-hand');
  const physicalBtn = document.getElementById('sos-physical-btn');
  const touchRing = document.getElementById('hand-touch-ring');
  const statusEl = document.getElementById('sos-sequence-status');

  // 1. Hand reaches maximum push depth & button visually depresses
  if (hand) {
    hand.style.transform = 'translateX(-50%) translateY(-290px)';
  }
  if (physicalBtn) {
    physicalBtn.classList.add('sos-switch-pressed');
  }
  if (touchRing) {
    touchRing.setAttribute('opacity', '1');
  }
  if (statusEl) {
    statusEl.textContent = 'SOS SWITCH DEPRESSED! BROADCASTING DISTRESS MAYDAY!';
  }

  // 2. Heavy mechanical actuation audio + Alarm tone
  if (window.playBeep) {
    window.playBeep(180, 0.15, 'triangle'); // Mechanical thud
    setTimeout(() => {
      if (window.playAlarmTone) window.playAlarmTone();
    }, 120);
  }

  // 3. After button press impact (400ms), reverse hand and shift frame back to show dashboard alert
  setTimeout(() => {
    const stage = document.getElementById('frame-viewport-stage');
    const consoleEl = document.getElementById('overhead-sos-console');

    if (touchRing) touchRing.setAttribute('opacity', '0');
    if (physicalBtn) physicalBtn.classList.remove('sos-switch-pressed');

    if (stage) {
      stage.style.transition = 'transform 0.45s cubic-bezier(0.2, 0.9, 0.4, 1)';
      stage.style.transform = 'translateY(0px)';
    }
    if (hand) {
      hand.style.transition = 'transform 0.45s cubic-bezier(0.2, 0.9, 0.4, 1)';
      hand.style.transform = 'translateX(-50%) translateY(0px)';
    }

    // Switch to Home view if on another tab so the user instantly sees the emergency alert
    if (window.switchTab) window.switchTab('home');

    // 4. Reveal Dashboard Emergency Banner
    const banner = document.getElementById('sos-dashboard-alert-banner');
    if (banner) {
      banner.classList.remove('hidden');
    }

    // Add Strobe effect to chassis
    const frame = document.getElementById('rugged-frame');
    if (frame) {
      frame.classList.add('sos-active-alarm-strobe');
    }

    // Start Emergency Elapsed Clock
    sosSecondsElapsed = 0;
    const timerEl = document.getElementById('sos-alert-timer');
    if (timerEl) timerEl.textContent = '00:00';

    if (sosElapsedTimerInterval) clearInterval(sosElapsedTimerInterval);
    sosElapsedTimerInterval = setInterval(() => {
      sosSecondsElapsed++;
      const m = String(Math.floor(sosSecondsElapsed / 60)).padStart(2, '0');
      const s = String(sosSecondsElapsed % 60).padStart(2, '0');
      if (timerEl) timerEl.textContent = `${m}:${s}`;
      
      // Periodic soft alert beep every 6 seconds
      if (sosSecondsElapsed % 6 === 0 && window.playAlarmTone) {
        window.playAlarmTone();
      }
    }, 1000);

    // 5. Append Priority-1 Log Entry
    const logsContainer = document.getElementById('logs-container');
    if (logsContainer) {
      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
      const logHtml = `
        <div class="p-2 rounded bg-red-900/60 border-l-4 border-red-500 text-white flex justify-between animate-pulse">
          <span>[${timeStr}] MAYDAY DISTRESS BEACON ACTIVATED VIA COCKPIT ROOF SOS SWITCH. TRANSMITTING COSPAS-SARSAT 406 MHz.</span>
          <span class="text-red-300 font-extrabold">EMERGENCY</span>
        </div>
      `;
      logsContainer.insertAdjacentHTML('afterbegin', logHtml);
    }

    // Toast alert
    if (window.showToast) {
      showToast('EMERGENCY SOS TRANSMITTED', 'Overhead cockpit distress switch activated. Mayday beacon active.', 'warn');
    }

    setTimeout(() => {
      if (consoleEl) {
        consoleEl.classList.add('hidden');
        consoleEl.classList.remove('flex');
      }
      if (stage) stage.style.transition = '';
      if (hand) hand.style.transition = '';
    }, 500);

  }, 450);
}

function dismissEmergencySos() {
  isSosActivated = false;
  if (sosElapsedTimerInterval) {
    clearInterval(sosElapsedTimerInterval);
    sosElapsedTimerInterval = null;
  }

  const banner = document.getElementById('sos-dashboard-alert-banner');
  if (banner) banner.classList.add('hidden');

  const frame = document.getElementById('rugged-frame');
  if (frame) frame.classList.remove('sos-active-alarm-strobe');

  const pill = document.getElementById('sos-key-pill');
  if (pill) pill.classList.remove('active-charging');

  const progressBar = document.getElementById('sos-key-progress');
  if (progressBar) progressBar.style.width = '0%';

  if (window.playBeep) window.playBeep(600, 0.08, 'sine');
  if (window.showToast) {
    showToast('SOS STAND DOWN', 'Emergency beacon deactivated. System returned to tactical ready.', 'info');
  }
}

// Global Exports
window.initEmergencySos = initEmergencySos;
window.dismissEmergencySos = dismissEmergencySos;
window.triggerEmergencySosSuccess = triggerEmergencySosSuccess;

// Initialize on DOM ready or immediate
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initEmergencySos);
} else {
  initEmergencySos();
}
