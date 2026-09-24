/**
 * Indian Army Tactical Terminal - Main Application Controller
 */

// Initialize Tab Registry
const tabs = ['home', 'map', 'waypoints', 'routes', 'camera', 'logs', 'settings'];
window.tabs = tabs;
window.currentTab = 'home';

function switchTab(tabId) {
  if (!tabs.includes(tabId)) return;
  window.currentTab = tabId;
  if (window.playTacticalClick) window.playTacticalClick();
  else if (window.playBeep) window.playBeep(750, 0.04);

  // Hide all view sections
  tabs.forEach(t => {
    const viewEl = document.getElementById(`view-${t}`);
    if (viewEl) viewEl.classList.add('hidden');
    
    // Reset nav button styling
    const navBtn = document.getElementById(`nav-${t}`);
    if (navBtn) {
      navBtn.className = 'flex flex-col items-center justify-center py-1.5 sm:py-2 px-1 rounded-lg border border-transparent hover:border-[#14364c] hover:bg-[#091a27] text-slate-400 hover:text-slate-200 transition-all';
      const icon = navBtn.querySelector('i');
      if (icon) icon.classList.remove('text-emerald-400');
    }
  });

  // Show selected view
  const activeView = document.getElementById(`view-${tabId}`);
  if (activeView) activeView.classList.remove('hidden');

  // Highlight active nav button
  const activeNav = document.getElementById(`nav-${tabId}`);
  if (activeNav) {
    activeNav.className = 'flex flex-col items-center justify-center py-1.5 sm:py-2 px-1 rounded-lg border border-emerald-500/80 bg-[#07281f] text-emerald-400 transition-all shadow-[0_0_10px_rgba(0,230,118,0.2)]';
    const icon = activeNav.querySelector('i');
    if (icon) icon.classList.add('text-emerald-400');
  }

  // Manage Active Animation Loops & Video for Memory & CPU efficiency
  const previewVideo = document.getElementById('mission-preview-video');
  if (tabId === 'home') {
    if (window.resume3dLoop) window.resume3dLoop();
    if (window.stopFlirLoop) window.stopFlirLoop();
    if (previewVideo && !previewVideo.paused) previewVideo.pause();
  } else if (tabId === 'map') {
    if (window.initTacticalMap) window.initTacticalMap();
    if (window.invalidateMapSize) setTimeout(window.invalidateMapSize, 120);
    if (window.stopFlirLoop) window.stopFlirLoop();
    if (previewVideo && !previewVideo.paused) previewVideo.pause();
  } else if (tabId === 'routes') { // PREVIEW TAB
    if (previewVideo) {
      previewVideo.play().then(() => updatePreviewPlayUI(true)).catch(() => updatePreviewPlayUI(false));
    }
    if (window.stopFlirLoop) window.stopFlirLoop();
  } else if (tabId === 'camera') {
    if (window.resizeFlirCanvas) window.resizeFlirCanvas();
    if (window.startFlirLoop) window.startFlirLoop();
    if (previewVideo && !previewVideo.paused) previewVideo.pause();
  } else {
    if (window.stopFlirLoop) window.stopFlirLoop();
    if (previewVideo && !previewVideo.paused) previewVideo.pause();
  }
}

// ==========================================
// TACTICAL MISSION VIDEO PREVIEW CONTROLLER
// ==========================================
function togglePreviewPlay() {
  const video = document.getElementById('mission-preview-video');
  if (!video) return;

  if (video.paused) {
    video.play();
    updatePreviewPlayUI(true);
    playBeep(900, 0.04);
  } else {
    video.pause();
    updatePreviewPlayUI(false);
    playBeep(600, 0.04);
  }
}

function updatePreviewPlayUI(isPlaying) {
  const btn = document.getElementById('btn-preview-play');
  const label = document.getElementById('label-preview-play');
  const icon = document.getElementById('icon-preview-play');
  const bigOverlay = document.getElementById('preview-big-play-overlay');
  const statusEl = document.getElementById('preview-video-status');

  if (isPlaying) {
    if (label) label.textContent = 'PAUSE';
    if (icon) icon.setAttribute('data-lucide', 'pause');
    if (bigOverlay) bigOverlay.classList.add('opacity-0', 'pointer-events-none');
    if (statusEl) {
      statusEl.textContent = 'STREAMING LIVE HD';
      statusEl.className = 'text-emerald-400 font-bold';
    }
  } else {
    if (label) label.textContent = 'PLAY';
    if (icon) icon.setAttribute('data-lucide', 'play');
    if (bigOverlay) bigOverlay.classList.remove('opacity-0', 'pointer-events-none');
    if (statusEl) {
      statusEl.textContent = 'PAUSED';
      statusEl.className = 'text-amber-400 font-bold';
    }
  }
  if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();
}

function restartPreviewVideo() {
  const video = document.getElementById('mission-preview-video');
  if (!video) return;
  video.currentTime = 0;
  video.play();
  updatePreviewPlayUI(true);
  playBeep(950, 0.04);
}

function togglePreviewMute() {
  const video = document.getElementById('mission-preview-video');
  const icon = document.getElementById('icon-preview-mute');
  if (!video) return;
  video.muted = !video.muted;
  if (icon) {
    icon.setAttribute('data-lucide', video.muted ? 'volume-x' : 'volume-2');
    if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();
  }
  playBeep(700, 0.04);
}

function togglePreviewFullscreen() {
  const video = document.getElementById('mission-preview-video');
  if (!video) return;
  if (video.requestFullscreen) {
    video.requestFullscreen();
  } else if (video.webkitRequestFullscreen) {
    video.webkitRequestFullscreen();
  }
}

// Bind Video Timeupdate & Scrubber
function initPreviewVideoEvents() {
  const video = document.getElementById('mission-preview-video');
  const scrubber = document.getElementById('preview-video-scrubber');
  const scrubLabel = document.getElementById('preview-scrub-label');
  const timeEl = document.getElementById('preview-video-time');

  if (!video) return;

  video.addEventListener('timeupdate', () => {
    if (!video.duration) return;
    const progress = (video.currentTime / video.duration) * 100;
    if (scrubber) scrubber.value = progress;
    if (scrubLabel) scrubLabel.textContent = `${Math.round(progress)}%`;

    if (timeEl) {
      const curM = String(Math.floor(video.currentTime / 60)).padStart(2, '0');
      const curS = String(Math.floor(video.currentTime % 60)).padStart(2, '0');
      const durM = String(Math.floor(video.duration / 60)).padStart(2, '0');
      const durS = String(Math.floor(video.duration % 60)).padStart(2, '0');
      timeEl.textContent = `${curM}:${curS} / ${durM}:${durS}`;
    }
  });

  if (scrubber) {
    scrubber.addEventListener('input', (e) => {
      if (!video.duration) return;
      const targetTime = (e.target.value / 100) * video.duration;
      video.currentTime = targetTime;
    });
  }

  video.addEventListener('play', () => updatePreviewPlayUI(true));
  video.addEventListener('pause', () => updatePreviewPlayUI(false));
}

// Toast notification component
function showToast(title, msg, type = 'info') {
  const toast = document.getElementById('tactical-toast');
  const toastTitle = document.getElementById('toast-title');
  const toastMsg = document.getElementById('toast-msg');
  const toastIcon = document.getElementById('toast-icon');
  if (!toast || !toastTitle || !toastMsg || !toastIcon) return;

  toastTitle.textContent = title;
  toastMsg.textContent = msg;

  if (type === 'warn') {
    toast.firstElementChild.className = 'bg-[#1e1309] border-2 border-amber-500 rounded-xl px-4 py-3 shadow-2xl flex items-center gap-3';
    toastIcon.className = 'w-5 h-5 text-amber-400 shrink-0';
    playAlarmTone();
  } else {
    toast.firstElementChild.className = 'bg-[#0b1d28] border-2 border-emerald-500 rounded-xl px-4 py-3 shadow-2xl flex items-center gap-3';
    toastIcon.className = 'w-5 h-5 text-emerald-400 shrink-0';
    playBeep(800, 0.05);
  }

  toast.classList.remove('translate-y-24', 'opacity-0', 'pointer-events-none');
  setTimeout(() => {
    toast.classList.add('translate-y-24', 'opacity-0', 'pointer-events-none');
  }, 3500);
}

// Chassis display toggle & Fullscreen
let chassisVisible = true;
function toggleChassis() {
  chassisVisible = !chassisVisible;
  const frame = document.getElementById('rugged-frame');
  const leftBar = document.getElementById('left-physical-bar');
  const rightBar = document.getElementById('right-physical-bar');
  const label = document.getElementById('bezel-mode-label');

  if (chassisVisible) {
    if (frame) frame.className = 'w-full max-w-[1440px] rounded-[28px] chassis-surface p-3 sm:p-5 md:p-6 shadow-[0_25px_70px_rgba(0,0,0,0.95)] border-4 border-[#252e3b] relative transition-all duration-300';
    if (leftBar) leftBar.classList.remove('md:hidden');
    if (rightBar) rightBar.classList.remove('md:hidden');
    if (label) label.textContent = 'CHASSIS: VISIBLE';
  } else {
    if (frame) frame.className = 'w-full max-w-full rounded-none p-0 shadow-none border-none relative bg-transparent';
    if (leftBar) leftBar.classList.add('md:hidden');
    if (rightBar) rightBar.classList.add('md:hidden');
    if (label) label.textContent = 'CHASSIS: HIDDEN (FULL SCREEN)';
  }
  playBeep(650, 0.05);
}

function toggleFullScreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => {});
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
  }
}

let screenPowerOn = true;
function toggleScreenPower() {
  screenPowerOn = !screenPowerOn;
  const viewport = document.getElementById('tab-viewport');
  if (!screenPowerOn) {
    if (viewport) viewport.style.opacity = '0.05';
    showToast('DISPLAY STANDBY', 'Night power saving activated.', 'warn');
  } else {
    if (viewport) viewport.style.opacity = '1';
    showToast('DISPLAY RESUMED', 'Normal illumination active.', 'info');
  }
}

// Global Window Bindings
window.switchTab = switchTab;
window.showToast = showToast;
window.toggleChassis = toggleChassis;
window.toggleFullScreen = toggleFullScreen;
window.toggleScreenPower = toggleScreenPower;
window.togglePreviewPlay = togglePreviewPlay;
window.restartPreviewVideo = restartPreviewVideo;
window.togglePreviewMute = togglePreviewMute;
window.togglePreviewFullscreen = togglePreviewFullscreen;

// Lifecycle Initialization
document.addEventListener('DOMContentLoaded', () => {
  // Render Lucide icons
  if (window.lucide && window.lucide.createIcons) {
    window.lucide.createIcons();
  }

  // Handle initial tab from URL hash (e.g. #routes, #map, #camera, #settings)
  const hashTab = window.location.hash ? window.location.hash.replace('#', '') : '';
  if (tabs.includes(hashTab)) {
    switchTab(hashTab);
  }

  // Initialize Tactical Video Preview Event Listeners
  initPreviewVideoEvents();

  // Window Resize Listeners
  window.addEventListener('resize', () => {
    if (window.resize3dCanvas) window.resize3dCanvas();
    if (window.invalidateMapSize) window.invalidateMapSize();
    if (window.resizeFlirCanvas) window.resizeFlirCanvas();
  });

  // Lazy load 3D vehicle on idle or after first paint
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(() => {
      if (window.init3dVehicleLazy) window.init3dVehicleLazy();
    });
  } else {
    setTimeout(() => {
      if (window.init3dVehicleLazy) window.init3dVehicleLazy();
    }, 50);
  }
});
