/**
 * Indian Army Tactical Terminal - Forward Optical Camera & 3D LiDAR Sensor Module
 * - High-Definition Optical EO Camera (gemini_generated_video_0d19fe96.mp4)
 * - 3D Adaptive LiDAR Point-Cloud Reconstruction (gemini_generated_video_0d19fe96_20260920233844.mp4)
 * - Zero-Lag Sub-Frame Time-Sync Engine (shifts between sensors at exact same timestamp)
 * - Pure Tactical Military Sensor HUD (NO media player scrubber/bars, 100% live sensor display)
 * - Multi-Channel Modes: EO CAMERA, 3D LIDAR, DUAL SPLIT, PICTURE-IN-PICTURE (PiP)
 * - Sensor Palettes: DAYLIGHT EO, NIGHT VISION (NVG PHOSPHOR), FLIR WHITE-HOT THERMAL
 */

let currentOpticChannel = 'camera'; // 'camera', 'lidar', 'split', 'pip'
let currentPalette = 'day'; // 'day', 'nvg', 'thermal'
let pipSubChannel = 'lidar';
let opticSyncRaf = null;
let isReticleVisible = true;
const OPTIC_LOOP_DURATION = 10.0; // Synchronized 10-second offroad loop

function getVideos() {
  return {
    vCam: document.getElementById('optic-video-camera'),
    vLidar: document.getElementById('optic-video-lidar'),
    vPip: document.getElementById('optic-video-pip')
  };
}

/**
 * Initializes and starts both videos playing in synchronized lockstep silently
 */
async function playOpticVideos() {
  const { vCam, vLidar, vPip } = getVideos();
  if (!vCam || !vLidar) return;

  try {
    vCam.muted = true;
    vLidar.muted = true;

    // Align initial timestamps
    const cur = vCam.currentTime || 0;
    vLidar.currentTime = cur % OPTIC_LOOP_DURATION;

    const promises = [vCam.play(), vLidar.play()];
    if (vPip && vPip.src) promises.push(vPip.play());
    await Promise.all(promises);

    startOpticSyncLoop();
  } catch (err) {
    console.warn('Sensor stream auto-play pending user gesture:', err);
  }
}

function pauseOpticVideos() {
  const { vCam, vLidar, vPip } = getVideos();
  if (vCam) vCam.pause();
  if (vLidar) vLidar.pause();
  if (vPip) vPip.pause();
  if (opticSyncRaf) {
    cancelAnimationFrame(opticSyncRaf);
    opticSyncRaf = null;
  }
}

/**
 * Continuous Sub-Frame Time-Sync Engine (Keeps Camera & LiDAR tightly locked)
 * Updates live military HUD readouts without any video player UI
 */
function startOpticSyncLoop() {
  if (opticSyncRaf) cancelAnimationFrame(opticSyncRaf);

  function syncTick() {
    if (window.currentTab !== 'camera') {
      pauseOpticVideos();
      return;
    }

    const { vCam, vLidar, vPip } = getVideos();
    if (vCam && vLidar) {
      // Determine master reference
      const master = (currentOpticChannel === 'lidar') ? vLidar : vCam;
      const slave = (currentOpticChannel === 'lidar') ? vCam : vLidar;

      // Handle 10-second boundary loop in exact lockstep
      if (master.currentTime >= OPTIC_LOOP_DURATION) {
        vCam.currentTime = 0;
        vLidar.currentTime = 0;
        if (vPip) vPip.currentTime = 0;
      }

      // Sub-frame drift correction: keep slave video within 40ms of master
      const targetTime = master.currentTime % OPTIC_LOOP_DURATION;
      const diff = Math.abs(slave.currentTime - targetTime);
      if (diff > 0.045) {
        slave.currentTime = targetTime;
      }

      // Sync PiP video if active
      if (vPip && (currentOpticChannel === 'pip')) {
        if (Math.abs(vPip.currentTime - targetTime) > 0.045) {
          vPip.currentTime = targetTime;
        }
      }

      // Update Tactical Military HUD Readouts (Live clock, frame count, sync delta)
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, '0');
      const mins = String(now.getMinutes()).padStart(2, '0');
      const secs = String(now.getSeconds()).padStart(2, '0');
      const dec = Math.floor((targetTime * 10) % 10);

      const clockEl = document.getElementById('optic-live-clock');
      if (clockEl) {
        clockEl.textContent = `${hours}:${mins}:${secs}.${dec} IST`;
      }

      const frameEl = document.getElementById('optic-frame-display');
      if (frameEl) {
        const frameNum = Math.floor(targetTime * 24) + 1280;
        frameEl.textContent = `FRM: #${frameNum}`;
      }

      const syncOffset = document.getElementById('optic-sync-offset');
      if (syncOffset) {
        syncOffset.textContent = `< ${(diff * 1000).toFixed(1)} ms (LOCKED)`;
      }

      // Dynamic vehicle speed fluctuation (tactical offroad telemetry)
      const speedEl = document.getElementById('optic-hud-speed');
      if (speedEl) {
        const spd = (31 + Math.sin(targetTime * 3) * 3).toFixed(0);
        speedEl.textContent = `${spd} KM/H`;
      }
    }

    opticSyncRaf = requestAnimationFrame(syncTick);
  }

  opticSyncRaf = requestAnimationFrame(syncTick);
}

/**
 * Switch Sensor Channels with ZERO Lag:
 * Both videos run simultaneously in the DOM, so switching is instantaneous!
 */
function setOpticChannel(channel) {
  if (channel !== 'camera' && channel !== 'lidar' && channel !== 'split' && channel !== 'pip') return;
  currentOpticChannel = channel;

  const { vCam, vLidar, vPip } = getVideos();
  const feedBox = document.getElementById('camera-feed-box');
  const pipBox = document.getElementById('optic-pip-box');
  const modeBadge = document.getElementById('optic-mode-badge');
  const titleEl = document.getElementById('optic-feed-title');
  const telemTag = document.getElementById('optic-telemetry-tag');
  const lidarMeta = document.getElementById('optic-lidar-meta');

  // Align timestamps immediately upon shift
  if (vCam && vLidar) {
    const cur = (channel === 'lidar' ? vCam.currentTime : vLidar.currentTime) % OPTIC_LOOP_DURATION;
    vCam.currentTime = cur;
    vLidar.currentTime = cur;
  }

  // Reset stage classes
  if (feedBox) feedBox.classList.remove('optic-split-active');
  if (pipBox) pipBox.classList.add('hidden');

  if (channel === 'camera') {
    // Show Camera Full-Screen
    if (vCam) {
      vCam.style.opacity = '1';
      vCam.style.pointerEvents = 'auto';
      vCam.style.width = '100%';
      vCam.style.left = '0';
    }
    if (vLidar) {
      vLidar.style.opacity = '0';
      vLidar.style.pointerEvents = 'none';
      vLidar.style.width = '100%';
      vLidar.style.left = '0';
    }
    if (modeBadge) {
      modeBadge.className = 'px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-500/50 font-mono text-[11px] font-semibold flex items-center gap-1';
      modeBadge.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span> EO OPTICAL CAMERA';
    }
    if (titleEl) titleEl.textContent = 'FORWARD SENSOR FEED (EO)';
    if (telemTag) telemTag.textContent = 'EO OPTICAL CAMERA';
    if (lidarMeta) lidarMeta.classList.add('hidden');

  } else if (channel === 'lidar') {
    // Show 3D Adaptive LiDAR Full-Screen
    if (vCam) {
      vCam.style.opacity = '0';
      vCam.style.pointerEvents = 'none';
      vCam.style.width = '100%';
      vCam.style.left = '0';
    }
    if (vLidar) {
      vLidar.style.opacity = '1';
      vLidar.style.pointerEvents = 'auto';
      vLidar.style.width = '100%';
      vLidar.style.left = '0';
    }
    if (modeBadge) {
      modeBadge.className = 'px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/50 font-mono text-[11px] font-semibold flex items-center gap-1';
      modeBadge.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping"></span> 3D ADAPTIVE LIDAR';
    }
    if (titleEl) titleEl.textContent = '3D ADAPTIVE LIDAR SENSOR';
    if (telemTag) telemTag.textContent = '3D ADAPTIVE LIDAR (LOCAL ORIN)';
    if (lidarMeta) lidarMeta.classList.remove('hidden');

  } else if (channel === 'split') {
    // Side-by-Side Dual Synchronized Split View
    if (feedBox) feedBox.classList.add('optic-split-active');
    if (vCam) {
      vCam.style.opacity = '1';
      vCam.style.pointerEvents = 'auto';
    }
    if (vLidar) {
      vLidar.style.opacity = '1';
      vLidar.style.pointerEvents = 'auto';
    }
    if (modeBadge) {
      modeBadge.className = 'px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-500/50 font-mono text-[11px] font-semibold flex items-center gap-1';
      modeBadge.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-purple-400 animate-ping"></span> DUAL SPLIT: EO + LIDAR';
    }
    if (titleEl) titleEl.textContent = 'DUAL SYNCHRONIZED SENSOR FEED';
    if (telemTag) telemTag.textContent = 'DUAL EO + 3D LIDAR SYNC';
    if (lidarMeta) lidarMeta.classList.remove('hidden');

  } else if (channel === 'pip') {
    // Picture-in-Picture Inset View
    if (vCam) {
      vCam.style.opacity = '1';
      vCam.style.pointerEvents = 'auto';
      vCam.style.width = '100%';
      vCam.style.left = '0';
    }
    if (vLidar) {
      vLidar.style.opacity = '0';
      vLidar.style.pointerEvents = 'none';
    }
    if (pipBox) {
      pipBox.classList.remove('hidden');
      if (vPip) {
        vPip.src = 'gemini_generated_video_0d19fe96_20260920233844.mp4';
        vPip.currentTime = (vCam ? vCam.currentTime : 0) % OPTIC_LOOP_DURATION;
        vPip.play().catch(() => {});
      }
    }
    if (modeBadge) {
      modeBadge.className = 'px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-500/50 font-mono text-[11px] font-semibold flex items-center gap-1';
      modeBadge.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping"></span> CAMERA + LIDAR PiP';
    }
    if (titleEl) titleEl.textContent = 'PRIMARY EO SENSOR (LIDAR PiP)';
  }

  // Update Toolbar Channel Button Styles
  ['cam', 'lidar', 'split', 'pip'].forEach(chKey => {
    const btn = document.getElementById(`btn-chan-${chKey}`);
    const isActive = (chKey === 'cam' && channel === 'camera') || (chKey === channel);
    if (btn) {
      if (isActive) {
        btn.className = 'px-2.5 py-1 rounded bg-emerald-950 text-emerald-300 border border-emerald-500/60 text-xs font-semibold flex items-center gap-1 transition-all shadow-[0_0_8px_rgba(0,230,118,0.25)]';
      } else {
        btn.className = 'px-2 py-1 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-slate-200 text-xs font-semibold flex items-center gap-1 transition-all';
      }
    }
  });

  if (window.playBeep) window.playBeep(channel === 'lidar' ? 1050 : 850, 0.04);
  if (window.showToast) {
    const names = { camera: 'EO OPTICAL CAMERA', lidar: '3D ADAPTIVE LIDAR', split: 'DUAL SPLIT VIEW', pip: 'PICTURE-IN-PICTURE' };
    window.showToast('FEED SHIFTED', `Switched to ${names[channel]} (0ms sync).`, 'info');
  }
}

/**
 * Tactical Optical Sensor Filters (Daylight, Night Vision NVG, FLIR Thermal)
 */
function setOpticPalette(palette) {
  if (palette !== 'day' && palette !== 'nvg' && palette !== 'thermal') return;
  currentPalette = palette;

  const { vCam, vLidar, vPip } = getVideos();
  const paletteName = document.getElementById('optic-palette-name');

  const filterMap = {
    day: 'none',
    nvg: 'brightness(1.2) contrast(1.4) hue-rotate(85deg) saturate(2.5)',
    thermal: 'grayscale(1) invert(0.9) contrast(1.7)'
  };

  const cssFilter = filterMap[palette] || 'none';
  if (vCam) vCam.style.filter = cssFilter;
  if (vLidar) vLidar.style.filter = palette === 'day' ? 'none' : cssFilter;
  if (vPip) vPip.style.filter = cssFilter;

  if (paletteName) {
    const titles = { day: 'DAYLIGHT EO', nvg: 'NVG PHOSPHOR', thermal: 'FLIR THERMAL' };
    paletteName.textContent = titles[palette];
  }

  // Update button active state
  ['day', 'nvg', 'flir'].forEach(pKey => {
    const btn = document.getElementById(`btn-palette-${pKey}`);
    const isActive = (pKey === 'flir' && palette === 'thermal') || (pKey === palette);
    if (btn) {
      if (isActive) {
        btn.className = 'px-2 py-1 rounded bg-emerald-950 text-emerald-300 border border-emerald-500/60 text-[11px] font-semibold';
      } else {
        btn.className = 'px-2 py-1 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-400 text-[11px] font-semibold';
      }
    }
  });

  if (window.playBeep) window.playBeep(980, 0.04);
}

/**
 * Swap Main Feed & Inset Feed when in PiP Mode
 */
function swapPipChannel() {
  pipSubChannel = pipSubChannel === 'lidar' ? 'camera' : 'lidar';
  const { vCam, vLidar, vPip } = getVideos();
  const pipLabel = document.getElementById('pip-channel-label');

  if (pipSubChannel === 'lidar') {
    if (vCam) vCam.style.opacity = '1';
    if (vLidar) vLidar.style.opacity = '0';
    if (vPip) vPip.src = 'gemini_generated_video_0d19fe96_20260920233844.mp4';
    if (pipLabel) pipLabel.textContent = '3D LIDAR PiP';
  } else {
    if (vCam) vCam.style.opacity = '0';
    if (vLidar) vLidar.style.opacity = '1';
    if (vPip) vPip.src = 'gemini_generated_video_0d19fe96.mp4';
    if (pipLabel) pipLabel.textContent = 'EO CAMERA PiP';
  }
  if (vPip && vCam) {
    vPip.currentTime = vCam.currentTime % OPTIC_LOOP_DURATION;
    vPip.play().catch(() => {});
  }
  if (window.playBeep) window.playBeep(920, 0.04);
}

function toggleOpticReticle() {
  isReticleVisible = !isReticleVisible;
  const reticle = document.getElementById('optic-reticle-layer');
  if (reticle) reticle.style.opacity = isReticleVisible ? '1' : '0';
  if (window.playBeep) window.playBeep(800, 0.03);
}

function toggleLaserRangefinder() {
  if (window.playBeep) window.playBeep(1400, 0.08, 'square');
  if (window.showToast) window.showToast('LRF PING', 'Target range confirmed: 1,248 meters.');
}

// Backwards-compatible stubs for existing terminal hooks
window.initFlirCanvas = () => {};
window.resizeFlirCanvas = () => {};
window.startFlirLoop = () => { playOpticVideos(); };
window.stopFlirLoop = () => { pauseOpticVideos(); };
window.cycleFlirMode = () => { setOpticChannel(currentOpticChannel === 'camera' ? 'lidar' : 'camera'); };
window.toggleLaserRangefinder = toggleLaserRangefinder;
window.adjustZoom = (delta) => {
  if (window.playBeep) window.playBeep(900 + delta * 150, 0.05);
  if (window.showToast) window.showToast('OPTICAL ZOOM', `Magnification: ${delta > 0 ? '+1x' : '-1x'}`);
};

// Global exports
window.setOpticChannel = setOpticChannel;
window.setOpticPalette = setOpticPalette;
window.toggleOpticReticle = toggleOpticReticle;
window.swapPipChannel = swapPipChannel;
window.playOpticVideos = playOpticVideos;
window.pauseOpticVideos = pauseOpticVideos;
