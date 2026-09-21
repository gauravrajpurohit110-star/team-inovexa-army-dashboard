/**
 * Indian Army Tactical Terminal - Tactical Radar Canvas Module
 * Memory & CPU Optimized: Pauses animation loop when Map tab is inactive.
 */
let radarCanvas = null;
let radarCtx = null;
let radarAngle = 0;
let radarRunning = false;
let radarTargets = [
  { dist: 140, angle: 0.72, type: 'hostile', label: 'T-84' },
  { dist: 90, angle: 2.3, type: 'friendly', label: 'BMS-02' },
  { dist: 190, angle: 4.1, type: 'neutral', label: 'CIV' }
];

function initRadarCanvas() {
  radarCanvas = document.getElementById('radar-canvas');
  if (!radarCanvas) return;
  radarCtx = radarCanvas.getContext('2d');
  resizeRadarCanvas();
}

function resizeRadarCanvas() {
  if (!radarCanvas) {
    radarCanvas = document.getElementById('radar-canvas');
    if (radarCanvas) radarCtx = radarCanvas.getContext('2d');
  }
  if (!radarCanvas || !radarCanvas.parentElement) return;
  const rect = radarCanvas.parentElement.getBoundingClientRect();
  if (rect.width > 0 && rect.height > 0) {
    radarCanvas.width = rect.width;
    radarCanvas.height = rect.height;
  }
}

function startRadarLoop() {
  if (radarRunning) return;
  radarRunning = true;
  requestAnimationFrame(drawRadar);
}

function stopRadarLoop() {
  radarRunning = false;
}

function drawRadar() {
  if (window.currentTab !== 'map') {
    radarRunning = false;
    return;
  }
  radarRunning = true;
  if (!radarCanvas || !radarCtx) {
    initRadarCanvas();
  }
  if (!radarCanvas || !radarCtx) {
    requestAnimationFrame(drawRadar);
    return;
  }

  const w = radarCanvas.width;
  const h = radarCanvas.height;
  const cx = w / 2;
  const cy = h / 2;

  // Dark fading background for phosphor trails
  radarCtx.fillStyle = 'rgba(4, 13, 18, 0.15)';
  radarCtx.fillRect(0, 0, w, h);

  // Draw Grid Crosshairs
  radarCtx.strokeStyle = 'rgba(19, 53, 75, 0.5)';
  radarCtx.lineWidth = 1;
  radarCtx.beginPath();
  radarCtx.moveTo(0, cy);
  radarCtx.lineTo(w, cy);
  radarCtx.moveTo(cx, 0);
  radarCtx.lineTo(cx, h);
  radarCtx.stroke();

  // Draw Range Rings (500m, 1000m, 2000m)
  [60, 130, 210].forEach(r => {
    radarCtx.beginPath();
    radarCtx.arc(cx, cy, r, 0, Math.PI * 2);
    radarCtx.strokeStyle = 'rgba(0, 230, 118, 0.2)';
    radarCtx.stroke();
  });

  // Draw Radar Sweep Line
  radarAngle += 0.035;
  const sweepX = cx + Math.cos(radarAngle) * 260;
  const sweepY = cy + Math.sin(radarAngle) * 260;

  radarCtx.strokeStyle = '#00e676';
  radarCtx.lineWidth = 2;
  radarCtx.beginPath();
  radarCtx.moveTo(cx, cy);
  radarCtx.lineTo(sweepX, sweepY);
  radarCtx.stroke();

  // Render Targets on Radar
  radarTargets.forEach(tgt => {
    const tx = cx + Math.cos(tgt.angle) * tgt.dist;
    const ty = cy + Math.sin(tgt.angle) * tgt.dist;

    if (tgt.type === 'hostile') {
      radarCtx.fillStyle = '#ef4444';
      radarCtx.shadowColor = '#ef4444';
      radarCtx.shadowBlur = 8;
      radarCtx.fillRect(tx - 4, ty - 4, 8, 8);
      radarCtx.fillText(tgt.label, tx + 6, ty - 2);
    } else if (tgt.type === 'friendly') {
      radarCtx.fillStyle = '#00e676';
      radarCtx.shadowColor = '#00e676';
      radarCtx.shadowBlur = 8;
      radarCtx.beginPath();
      radarCtx.arc(tx, ty, 4, 0, Math.PI * 2);
      radarCtx.fill();
      radarCtx.fillText(tgt.label, tx + 6, ty - 2);
    }
    radarCtx.shadowBlur = 0;
  });

  requestAnimationFrame(drawRadar);
}

function pingRadarScan() {
  playBeep(1200, 0.15, 'sawtooth');
  showToast('RADAR PULSE EMITTED', 'Echo: 1 hostile, 1 friendly, 0 jamming detected.');
}

function toggleMapThermal() {
  playBeep(700, 0.05);
  showToast('MAP VIEWPORT', 'Satellite multispectral imaging engaged.');
}

window.initRadarCanvas = initRadarCanvas;
window.resizeRadarCanvas = resizeRadarCanvas;
window.startRadarLoop = startRadarLoop;
window.stopRadarLoop = stopRadarLoop;
window.pingRadarScan = pingRadarScan;
window.toggleMapThermal = toggleMapThermal;
