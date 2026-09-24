/**
 * Indian Army Tactical Terminal - Emergency SOS Module
 * MIL-STD-1472H Compliant Tactical Defense Interlock HUD
 * 
 * Interactivity Specification:
 * 1. Hold Spacebar for 2.0 seconds:
 *    - Activates non-intrusive Tactical HUD Interlock Overlay with 360° Circular Chrono-Ring
 *    - Displays microsecond timer (0.00s -> 2.00s), frequency lock (406.025 MHz), crypto key verification
 *    - Rising tactical charge tone audio sweep
 *    - Releasing Spacebar before 2.0s gracefully disengages interlock ("SAFETY INTERLOCK RESTORED // DISTRESS ABORTED")
 * 2. At 2.0 seconds:
 *    - Interlock commits with single sharp micro-bloom flash
 *    - HUD closes cleanly; Dashboard enters unified Combat Distress Mode
 *    - Integrated Emergency Command Strip reveals under top bar (transponder telemetry, SAR timer, QRF vector)
 *    - Card 1 badge switches to "COMBAT DISTRESS"
 *    - Card 3 (Map) renders pulsing distress beacon ring & vector line to nearest friendly QRF (BMS-02)
 *    - Dual-tone avionics master caution chime (880 Hz -> 440 Hz) with dedicated silence toggle
 *    - Priority-1 Emergency Mayday entry logged to BMS records
 */

let spacebarDownTime = 0;
let isSpacebarPressed = false;
let spacebarRaf = null;
let isSosActivated = false;
let sosElapsedTimerInterval = null;
let sosSecondsElapsed = 0;
let lastChargeToneTime = 0;

const HOLD_DURATION_MS = 2000; // Exactly 2.0 seconds
const CHRONO_CIRCUMFERENCE = 527.787; // 2 * PI * 84

function initEmergencySos() {
  window.addEventListener('keydown', (e) => {
    // Only react to Spacebar when user is not typing in an input or textarea
    if (e.code === 'Space' || e.key === ' ') {
      const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
      if (activeTag === 'input' || activeTag === 'textarea' || document.activeElement.isContentEditable) return;
      
      // Prevent standard browser page scroll on spacebar
      e.preventDefault();

      if (e.repeat) return; // Ignore native OS keyboard repeat

      if (!isSpacebarPressed && !isSosActivated) {
        startSosHoldSequence();
      }
    }
  });

  window.addEventListener('keyup', (e) => {
    if (e.code === 'Space' || e.key === ' ') {
      const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
      if (activeTag === 'input' || activeTag === 'textarea' || document.activeElement.isContentEditable) return;
      
      e.preventDefault();
      if (isSpacebarPressed) {
        cancelSosHoldSequence();
      }
    }
  });

  // Window blur failsafe (e.g. Alt-Tab while holding Spacebar)
  window.addEventListener('blur', () => {
    if (isSpacebarPressed) {
      cancelSosHoldSequence();
    }
  });
}

function startSosHoldSequence() {
  if (isSosActivated) return; // Already active in distress mode

  isSpacebarPressed = true;
  spacebarDownTime = performance.now();
  lastChargeToneTime = spacebarDownTime;

  // Reveal Tactical Interlock HUD Overlay
  const hud = document.getElementById('sos-interlock-hud');
  if (hud) {
    hud.classList.remove('hidden');
    // Force reflow for smooth opacity transition
    void hud.offsetWidth;
    hud.classList.add('hud-active');
  }

  // Header Key Pill feedback
  const pill = document.getElementById('sos-key-pill');
  if (pill) pill.classList.add('active-charging');

  // Reset Chrono-Ring & Readouts
  const ring = document.getElementById('sos-chrono-progress-ring');
  if (ring) ring.style.strokeDashoffset = `${CHRONO_CIRCUMFERENCE}`;

  const countdownEl = document.getElementById('sos-hud-countdown');
  if (countdownEl) countdownEl.textContent = '0.00s';

  const subtextEl = document.getElementById('sos-hud-subtext');
  if (subtextEl) subtextEl.textContent = 'HOLD SPACEBAR TO ENGAGE DISTRESS';

  const statusBanner = document.getElementById('sos-hud-status-banner');
  if (statusBanner) {
    statusBanner.className = 'px-4 py-1.5 rounded bg-red-950/90 border border-red-500/60 text-red-200 text-center font-bold tracking-wider';
    statusBanner.textContent = 'SAFETY INTERLOCK CHARGING // COSPAS-SARSAT 406.025 MHz';
  }

  // Initial tactical spool-up charge sound
  if (window.startInterlockAudioCharge) {
    window.startInterlockAudioCharge();
  }

  if (spacebarRaf) cancelAnimationFrame(spacebarRaf);
  spacebarRaf = requestAnimationFrame(updateSosHoldProgress);
}

function updateSosHoldProgress(currentTime) {
  if (!isSpacebarPressed) return;

  const elapsed = currentTime - spacebarDownTime;
  const progress = Math.min(1, elapsed / HOLD_DURATION_MS);

  // 1. Update 360° Circular Chrono-Ring Dial
  const ring = document.getElementById('sos-chrono-progress-ring');
  if (ring) {
    const offset = CHRONO_CIRCUMFERENCE * (1 - progress);
    ring.style.strokeDashoffset = `${offset.toFixed(2)}`;
  }

  // 2. High-Precision Microsecond Countdown Display
  const countdownEl = document.getElementById('sos-hud-countdown');
  if (countdownEl) {
    countdownEl.textContent = `${(elapsed / 1000).toFixed(2)}s`;
  }

  // 3. Header Progress Bar
  const progressBar = document.getElementById('sos-key-progress');
  if (progressBar) {
    progressBar.style.width = `${(progress * 100).toFixed(1)}%`;
  }

  // 4. Dynamic Military Interlock Phase Indicators
  const subtextEl = document.getElementById('sos-hud-subtext');
  const statusBanner = document.getElementById('sos-hud-status-banner');

  if (progress < 0.35) {
    if (subtextEl) subtextEl.textContent = 'SAFETY INTERLOCK CHARGING // HOLD SPACEBAR';
    if (statusBanner) statusBanner.textContent = 'PRIMING DISTRESS TRANSMITTER &bull; 406.025 MHz';
  } else if (progress < 0.75) {
    if (subtextEl) subtextEl.textContent = 'SYNCHRONIZING SATELLITE BURST // VHF 121.5 MHz';
    if (statusBanner) statusBanner.textContent = 'AUTHENTICATING MIL-STD-1472H ENCRYPTED BEACON';
  } else {
    if (subtextEl) subtextEl.textContent = 'CRITICAL OVERRIDE IMMINENT // COMMIT READY';
    if (statusBanner) statusBanner.textContent = 'RELEASE SPACEBAR TO ABORT IMMEDIATELY';
  }

  // 5. Update Active Charging Audio Modulation
  if (window.updateInterlockAudioCharge) {
    window.updateInterlockAudioCharge(progress);
  }

  // 6. 2.0 Seconds Reached: Trigger Combat Distress Mode
  if (progress >= 1.0) {
    triggerEmergencySosSuccess();
    return;
  }

  spacebarRaf = requestAnimationFrame(updateSosHoldProgress);
}

function cancelSosHoldSequence() {
  if (!isSpacebarPressed || isSosActivated) return;

  isSpacebarPressed = false;
  if (spacebarRaf) cancelAnimationFrame(spacebarRaf);

  const hud = document.getElementById('sos-interlock-hud');
  const ring = document.getElementById('sos-chrono-progress-ring');
  const progressBar = document.getElementById('sos-key-progress');
  const pill = document.getElementById('sos-key-pill');
  const countdownEl = document.getElementById('sos-hud-countdown');
  const subtextEl = document.getElementById('sos-hud-subtext');
  const statusBanner = document.getElementById('sos-hud-status-banner');

  // De-escalate UI
  if (pill) pill.classList.remove('active-charging');
  if (progressBar) progressBar.style.width = '0%';
  if (countdownEl) countdownEl.textContent = '0.00s';
  if (subtextEl) subtextEl.textContent = 'INTERLOCK RESTORED // SEQUENCE ABORTED';
  
  if (statusBanner) {
    statusBanner.className = 'px-4 py-1.5 rounded bg-amber-950/90 border border-amber-500/60 text-amber-300 text-center font-bold tracking-wider';
    statusBanner.textContent = 'SAFETY INTERLOCK RESTORED // NO TRANSMISSION SENT';
  }

  // Reverse ring
  if (ring) {
    ring.style.transition = 'stroke-dashoffset 0.25s cubic-bezier(0.2, 0.8, 0.4, 1)';
    ring.style.strokeDashoffset = `${CHRONO_CIRCUMFERENCE}`;
  }

  // Auditory Abort / De-escalation disarm tone
  if (window.abortInterlockAudioCharge) {
    window.abortInterlockAudioCharge();
  }

  // Fade HUD away
  setTimeout(() => {
    if (!isSpacebarPressed && !isSosActivated) {
      if (hud) {
        hud.classList.remove('hud-active');
        setTimeout(() => {
          if (!isSpacebarPressed && !isSosActivated) {
            hud.classList.add('hidden');
            if (ring) ring.style.transition = '';
          }
        }, 220);
      }
    }
  }, 320);
}

function triggerEmergencySosSuccess() {
  isSpacebarPressed = false;
  isSosActivated = true;
  if (spacebarRaf) cancelAnimationFrame(spacebarRaf);

  const hud = document.getElementById('sos-interlock-hud');
  const chassis = document.getElementById('rugged-frame');
  const commandStrip = document.getElementById('sos-command-strip');
  const statusBadge = document.getElementById('vehicle-status-badge');

  // 1. Instant HUD Dismissal & Micro Screen Bloom Flash
  if (hud) {
    hud.classList.remove('hud-active');
    hud.classList.add('hidden');
  }

  if (chassis) {
    chassis.classList.add('tactical-bloom-trigger', 'chassis-distress-active');
    setTimeout(() => {
      chassis.classList.remove('tactical-bloom-trigger');
    }, 400);
  }

  // Heavy Tactical Trigger Impact Sound (sub-bass punch + satellite ignition + modem burst)
  if (window.playDistressTriggerImpact) {
    window.playDistressTriggerImpact();
  }

  // 2. Dock Integrated Emergency Command Strip
  if (commandStrip) {
    commandStrip.classList.remove('hidden');
  }

  // 3. Switch Card 1 Vehicle Status Badge to COMBAT DISTRESS
  if (statusBadge) {
    statusBadge.className = 'px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-red-950 text-red-300 border border-red-500 tracking-wider animate-pulse flex items-center gap-1';
    statusBadge.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping"></span> COMBAT DISTRESS';
  }

  // 4. Activate Map Distress Radar Beacon Ring & QRF Vector on Card 3
  if (window.triggerMapDistressBeacon) {
    window.triggerMapDistressBeacon();
  }

  // 5. Start Military Avionics Master Warning Audio Chime (880 Hz -> 440 Hz dual tone)
  if (window.startEmergencyAudioLoop) {
    window.startEmergencyAudioLoop();
  }

  // 6. Start SAR Elapsed Clock & Burst Tracker
  sosSecondsElapsed = 0;
  const timerEl = document.getElementById('sos-alert-timer');
  const burstEl = document.getElementById('sos-burst-count');
  if (timerEl) timerEl.textContent = '00:00';
  if (burstEl) burstEl.textContent = '#01';

  if (sosElapsedTimerInterval) clearInterval(sosElapsedTimerInterval);
  sosElapsedTimerInterval = setInterval(() => {
    sosSecondsElapsed++;
    const m = String(Math.floor(sosSecondsElapsed / 60)).padStart(2, '0');
    const s = String(sosSecondsElapsed % 60).padStart(2, '0');
    if (timerEl) timerEl.textContent = `${m}:${s}`;

    // Burst increment every 15s (simulating standard satellite burst intervals)
    if (burstEl && sosSecondsElapsed % 15 === 0) {
      const burstNum = Math.floor(sosSecondsElapsed / 15) + 1;
      burstEl.textContent = `#${String(burstNum).padStart(2, '0')}`;
      if (window.playSatelliteBurstChime) {
        window.playSatelliteBurstChime();
      }
    }
  }, 1000);

  // 7. Auto-configure Tactical ECU Combat Survival Preset
  engageEmergencyEcuCountermeasures();

  // 8. Log Priority-1 Flash Mayday Entry to BMS logs
  const logsContainer = document.getElementById('logs-container');
  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
  
  if (logsContainer) {
    const logHtml = `
      <div class="p-2.5 rounded bg-red-950/80 border-l-4 border-red-500 text-white flex flex-wrap items-center justify-between gap-2 shadow-lg mb-2">
        <div class="flex items-center gap-2">
          <span class="px-1.5 py-0.5 rounded bg-red-600 text-white font-extrabold text-[10px] font-mono animate-pulse">FLASH-1</span>
          <span class="font-mono text-xs text-red-200">[${timeStr}] MAYDAY DISTRESS BEACON ACTIVE &bull; COSPAS 406.025 MHz / GUARD 121.5 MHz TRANSMITTING. GPS FIX: 34.2122° N, 77.5867° E.</span>
        </div>
        <span class="text-amber-300 font-mono text-[11px] font-bold">RESCUE VECTOR: BMS-02 (1.8 KM)</span>
      </div>
    `;
    logsContainer.insertAdjacentHTML('afterbegin', logHtml);
  }

  // Card 6 Notifications Live Feed update
  const notifContainer = document.querySelector('#view-home .space-y-2');
  if (notifContainer) {
    const notifHtml = `
      <div id="sos-notif-entry" class="flex items-center justify-between py-1 px-2 rounded bg-red-950/60 border border-red-500/50">
        <div class="flex items-center gap-2 truncate">
          <i data-lucide="radio" class="w-3.5 h-3.5 text-red-400 shrink-0 animate-pulse"></i>
          <span class="text-red-200 font-bold truncate text-xs">COMBAT DISTRESS TRANSMITTING [406 MHz]</span>
        </div>
        <span class="font-mono text-amber-400 text-[11px] shrink-0 font-bold">${timeStr}</span>
      </div>
    `;
    notifContainer.insertAdjacentHTML('afterbegin', notifHtml);
    if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();
  }

  // Toast Notification
  if (window.showToast) {
    window.showToast('COMBAT DISTRESS TRANSMITTED', 'Tactical emergency transponder active. 406.025 MHz / 121.5 MHz broadcasting.', 'error');
  }
}

/**
 * Automate Tactical Cockpit Countermeasures upon distress
 */
function engageEmergencyEcuCountermeasures() {
  // CTIS -> Sand/Emergency 14 PSI
  const ctisVal = document.getElementById('ctis-pressure-val');
  if (ctisVal) ctisVal.textContent = '14 PSI (SAND/EMERGENCY)';

  // Differential Lock -> Engaged
  const diffLockVal = document.getElementById('diff-lock-status');
  if (diffLockVal) {
    diffLockVal.textContent = 'ENGAGED (CROSS-AXLE)';
    diffLockVal.className = 'text-amber-400 font-bold';
  }

  // IR Blackout Mode
  const blackoutBadge = document.getElementById('blackout-mode-badge');
  if (blackoutBadge) {
    blackoutBadge.textContent = 'IR BLACKOUT: ENGAGED';
    blackoutBadge.className = 'text-amber-400 font-bold';
  }
}

function dismissEmergencySos() {
  isSosActivated = false;
  
  if (sosElapsedTimerInterval) {
    clearInterval(sosElapsedTimerInterval);
    sosElapsedTimerInterval = null;
  }

  // Stop Audio Alarm
  if (window.stopEmergencyAudioLoop) {
    window.stopEmergencyAudioLoop();
  }

  // Hide Command Strip
  const commandStrip = document.getElementById('sos-command-strip');
  if (commandStrip) commandStrip.classList.add('hidden');

  // Remove Chassis Glow
  const chassis = document.getElementById('rugged-frame');
  if (chassis) chassis.classList.remove('chassis-distress-active');

  // Restore Card 1 Badge
  const statusBadge = document.getElementById('vehicle-status-badge');
  if (statusBadge) {
    statusBadge.className = 'px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#0d3429] text-emerald-400 border border-emerald-500/40 tracking-wide';
    statusBadge.textContent = 'Operational';
  }

  // Clear Map Distress Pulse & Vector
  if (window.clearMapDistressBeacon) {
    window.clearMapDistressBeacon();
  }

  // Remove Notif Entry
  const notifEntry = document.getElementById('sos-notif-entry');
  if (notifEntry) notifEntry.remove();

  // Reset Pill & Progress
  const pill = document.getElementById('sos-key-pill');
  if (pill) pill.classList.remove('active-charging');

  const progressBar = document.getElementById('sos-key-progress');
  if (progressBar) progressBar.style.width = '0%';

  // Reset Silence button state
  const silenceLabel = document.getElementById('sos-silence-label');
  const silenceBtn = document.getElementById('sos-silence-btn');
  if (silenceLabel) silenceLabel.textContent = 'SILENCE AUDIO';
  if (silenceBtn) {
    silenceBtn.classList.add('bg-red-950/70', 'border-red-700/60', 'text-red-200');
    silenceBtn.classList.remove('bg-amber-950/80', 'border-amber-600', 'text-amber-300');
  }

  // De-escalation resolution chord feedback & Toast
  if (window.playStandDownTone) {
    window.playStandDownTone();
  }
  if (window.showToast) {
    window.showToast('DISTRESS STAND DOWN', 'Emergency beacon deactivated. System returned to tactical operational ready.', 'info');
  }
}

// Global Exports
window.initEmergencySos = initEmergencySos;
window.dismissEmergencySos = dismissEmergencySos;
window.triggerEmergencySosSuccess = triggerEmergencySosSuccess;
window.toggleEmergencyAlarmSilence = function() {
  if (window.toggleEmergencyAudioSilence) {
    window.toggleEmergencyAudioSilence();
  }
};

// Initialize on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initEmergencySos);
} else {
  initEmergencySos();
}

