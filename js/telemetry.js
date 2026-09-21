/**
 * Indian Army Tactical Terminal - Real-Time Clock & Telemetry Simulation
 */
function updateClock() {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  
  const clockEl = document.getElementById('digital-clock');
  if (clockEl) clockEl.textContent = `${hours}:${minutes}:${seconds}`;

  const dateEl = document.getElementById('digital-date');
  if (dateEl) {
    const day = now.getDate();
    const month = now.toLocaleString('en-US', { month: 'short' });
    const year = now.getFullYear();
    dateEl.textContent = `${day} ${month} ${year}`;
  }
}
setInterval(updateClock, 1000);
updateClock();

// ==========================================
// LIVE WEATHER MODULE - SITAPURA, JAIPUR
// Lat: 26.7725, Lon: 75.8450 (RIICO Industrial Area, Sitapura, Jaipur)
// Free Open-Meteo API (No Key, Client-Side CORS enabled)
// ==========================================
const WMO_CODE_MAP = {
  0: { label: 'Clear Sky', icon: 'sun' },
  1: { label: 'Mainly Clear', icon: 'sun' },
  2: { label: 'Partly Cloudy', icon: 'cloud-sun' },
  3: { label: 'Overcast', icon: 'cloud' },
  45: { label: 'Fog', icon: 'cloud-fog' },
  48: { label: 'Depositing Rime Fog', icon: 'cloud-fog' },
  51: { label: 'Light Drizzle', icon: 'cloud-drizzle' },
  53: { label: 'Moderate Drizzle', icon: 'cloud-drizzle' },
  55: { label: 'Dense Drizzle', icon: 'cloud-drizzle' },
  61: { label: 'Slight Rain', icon: 'cloud-rain' },
  63: { label: 'Moderate Rain', icon: 'cloud-rain' },
  65: { label: 'Heavy Rain', icon: 'cloud-rain' },
  71: { label: 'Slight Snow', icon: 'snowflake' },
  80: { label: 'Slight Showers', icon: 'cloud-rain' },
  81: { label: 'Moderate Showers', icon: 'cloud-rain' },
  82: { label: 'Violent Showers', icon: 'cloud-lightning' },
  95: { label: 'Thunderstorm', icon: 'cloud-lightning' },
  96: { label: 'Thunderstorm w/ Hail', icon: 'cloud-lightning' }
};

let lastWeatherFetchTime = 0;
const WEATHER_CACHE_MS = 5 * 60 * 1000; // Cache 5 minutes

async function fetchSitapuraWeather(force = false) {
  const now = Date.now();
  if (!force && now - lastWeatherFetchTime < WEATHER_CACHE_MS) return;

  const syncIcon = document.getElementById('weather-sync-icon');
  if (syncIcon) syncIcon.classList.add('animate-spin');

  const lat = 26.7725;
  const lon = 75.8450;
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m&hourly=temperature_2m,weather_code&timezone=auto`;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Weather API returned HTTP ${res.status}`);
    const data = await res.json();
    lastWeatherFetchTime = Date.now();

    const curr = data.current;
    if (!curr) return;

    // 1. Update Temperature
    const tempEl = document.getElementById('weather-temp');
    if (tempEl) tempEl.textContent = `${Math.round(curr.temperature_2m)}°C`;

    // 2. Weather Condition Text
    const wInfo = WMO_CODE_MAP[curr.weather_code] || { label: 'Tactical Clear', icon: 'sun' };
    const condEl = document.getElementById('weather-cond');
    if (condEl) condEl.textContent = `${wInfo.label} (Sitapura)`;

    // 3. Humidity
    const humEl = document.getElementById('weather-humidity');
    if (humEl) humEl.textContent = `${curr.relative_humidity_2m}%`;

    // 4. Wind Speed
    const windEl = document.getElementById('weather-wind');
    if (windEl) windEl.textContent = `${Math.round(curr.wind_speed_10m)} km/h`;

    // 5. Visibility (Estimated or default tactical range)
    const visEl = document.getElementById('weather-visibility');
    if (visEl) {
      const estVis = curr.weather_code >= 45 && curr.weather_code <= 48 ? '3.5 km' : (curr.weather_code > 60 ? '6.0 km' : '10+ km');
      visEl.textContent = estVis;
    }

    // 6. Hourly Forecast (Next 4 time slots)
    if (data.hourly && data.hourly.time && data.hourly.temperature_2m) {
      const hourlyContainer = document.getElementById('weather-hourly-container');
      if (hourlyContainer) {
        const currentHour = new Date().getHours();
        let html = '';
        for (let i = 0; i < 4; i++) {
          const targetHour = (currentHour + i) % 24;
          const label = i === 0 ? 'Now' : `+${i}h`;
          const tempVal = Math.round(data.hourly.temperature_2m[targetHour] || curr.temperature_2m);
          const codeVal = data.hourly.weather_code ? data.hourly.weather_code[targetHour] : 0;
          const slotInfo = WMO_CODE_MAP[codeVal] || { label: 'Clear', icon: 'sun' };
          const iconColor = i === 0 ? 'text-amber-400' : 'text-cyan-400';

          html += `
            <div class="flex flex-col items-center">
              <span class="text-[10px] text-[#6a8b9f]">${label} (${String(targetHour).padStart(2, '0')}:00)</span>
              <i data-lucide="${slotInfo.icon}" class="w-4 h-4 ${iconColor} my-1"></i>
              <span class="font-bold text-slate-200 font-mono">${tempVal}°</span>
            </div>
          `;
        }
        hourlyContainer.innerHTML = html;
        if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();
      }
    }

    if (window.showToast && force) {
      showToast('WEATHER SYNCED', `Sitapura, Jaipur: ${Math.round(curr.temperature_2m)}°C, ${wInfo.label}`, 'info');
    }
  } catch (err) {
    console.warn('Sitapura Weather fetch error:', err);
    // Offline fallback graceful retain
    const condEl = document.getElementById('weather-cond');
    if (condEl && condEl.textContent.includes('Loading')) {
      condEl.textContent = 'Sitapura (Cached/Offline)';
    }
  } finally {
    if (syncIcon) {
      setTimeout(() => syncIcon.classList.remove('animate-spin'), 600);
    }
  }
}

function refreshLiveWeather() {
  playBeep(920, 0.04);
  fetchSitapuraWeather(true);
}
window.refreshLiveWeather = refreshLiveWeather;
window.fetchSitapuraWeather = fetchSitapuraWeather;

// Initial weather fetch on startup and periodic 10m update
setTimeout(() => fetchSitapuraWeather(false), 800);
setInterval(() => fetchSitapuraWeather(false), 10 * 60 * 1000);

// Quick Tactical HUD Actions
function inspectVehicle() {
  playBeep(900, 0.05);
  showToast('MAHINDRA ARMADO ALSV', 'Armoured Light Specialist Vehicle (4x4) | 215hp Turbo Diesel | STANAG L-II Protected', 'info');
}

function showCommsQuickModal() {
  showToast('RADIO VHF/UHF', 'Frequency hopping active. 256-bit AES encryption verified.', 'info');
}

function captureTargetSnapshot() {
  playBeep(1100, 0.08);
  showToast('SNAPSHOT RECORDED', 'Thermal image logged to encrypted SSD sector 4.', 'info');
}

function addCurrentPositionWaypoint() {
  playBeep(950, 0.05);
  showToast('WAYPOINT STORED', "Marked WP-04 at 34°12'44\"N 77°35'12\"E", 'info');
}

function clearLogsUI() {
  const logs = document.getElementById('logs-container');
  if (logs) {
    logs.innerHTML = '<div class="text-slate-500 font-mono p-4 text-center">Log view cleared for tactical silence. Internal storage untouched.</div>';
  }
  playBeep(500, 0.05);
}

function toggleNightFilter() {
  const body = document.body;
  if (body.classList.contains('hue-rotate-90')) {
    body.classList.remove('hue-rotate-90');
    showToast('NVG OFF', 'Normal color palette restored.');
  } else {
    body.classList.add('hue-rotate-90');
    showToast('NVG ON', 'Green phosphor night filter applied.');
  }
}

// ==========================================
// TACTICAL DASHBOARD SETTINGS CONTROLLER
// Real Military Terminal Diagnostic & Actuation Controls
// ==========================================

const terminalSettings = {
  driveMode: '4h',             // '2h', '4h', '4l', 'diff_lock'
  ctisTerrain: 'highway',      // 'highway' (36 psi), 'cross_country' (28 psi), 'sand_mud' (20 psi), 'emergency' (14 psi)
  suspensionRideHeight: 280,   // mm (220 to 360)
  headlightsMode: 'ir_blackout', // 'normal', 'ir_blackout', 'stealth_off', 'high_beam'
  exhaustBypass: false,
  flirThermalMode: 'white_hot', // 'white_hot', 'black_hot', 'ironbow'
  winchClutch: 'locked',
  speedGovernor: 110,          // km/h
  smokeDischargeReady: true,
  audioBuzzerVol: 80,
  gpsConstellation: 'all',     // 'all' (GPS+NavIC+GLONASS), 'navic_only', 'gps_only'
  masterArm: false
};

function setDriveMode(mode) {
  terminalSettings.driveMode = mode;
  ['2h', '4h', '4l', 'diff_lock'].forEach(m => {
    const btn = document.getElementById(`btn-drive-${m}`);
    if (btn) {
      if (m === mode) {
        btn.className = 'px-2.5 py-1 rounded bg-amber-950/90 text-amber-300 border border-amber-500 font-mono text-[11px] font-bold shadow-[0_0_8px_rgba(245,158,11,0.4)] transition-all';
      } else {
        btn.className = 'px-2.5 py-1 rounded bg-slate-900/80 hover:bg-slate-800 text-slate-400 font-mono text-[11px] border border-slate-700 transition-all';
      }
    }
  });

  const titles = {
    '2h': '2WD HIGH (Highway Economical Patrol)',
    '4h': '4WD HIGH (All-Wheel Torque Split 50:50)',
    '4l': '4WD LOW (Crawl Ratio 2.72:1 Engaged)',
    'diff_lock': '4WD LOW + FRONT & REAR AXLE E-LOCKERS ENGAGED'
  };

  playBeep(mode === 'diff_lock' ? 620 : 850, 0.05);
  showToast('DRIVETRAIN SHIFT', titles[mode] || mode, mode === 'diff_lock' ? 'warn' : 'info');
}

function setCtisPressure(mode) {
  terminalSettings.ctisTerrain = mode;
  const psiMap = { 'highway': 36, 'cross_country': 28, 'sand_mud': 20, 'emergency': 14 };
  const targetPsi = psiMap[mode] || 32;

  ['highway', 'cross_country', 'sand_mud', 'emergency'].forEach(m => {
    const btn = document.getElementById(`btn-ctis-${m}`);
    if (btn) {
      if (m === mode) {
        btn.className = 'px-2 py-1 rounded bg-emerald-950/90 text-emerald-300 border border-emerald-400 font-mono text-[11px] font-bold shadow-[0_0_8px_rgba(0,230,118,0.3)] transition-all';
      } else {
        btn.className = 'px-2 py-1 rounded bg-slate-900/80 hover:bg-slate-800 text-slate-400 font-mono text-[11px] border border-slate-700 transition-all';
      }
    }
  });

  const psiDisplay = document.getElementById('ctis-live-psi-display');
  if (psiDisplay) psiDisplay.textContent = `${targetPsi} PSI`;

  playBeep(900, 0.05);
  showToast('CTIS AIR COMPRESSOR', `Target Inflation: ${targetPsi} PSI (${mode.toUpperCase().replace('_', ' ')})`, 'info');
}

function setLightingBlackout(mode) {
  terminalSettings.headlightsMode = mode;
  ['normal', 'ir_blackout', 'stealth_off'].forEach(m => {
    const btn = document.getElementById(`btn-light-${m}`);
    if (btn) {
      if (m === mode) {
        btn.className = 'px-2 py-1 rounded bg-cyan-950/90 text-cyan-300 border border-cyan-400 font-mono text-[11px] font-bold shadow-[0_0_8px_rgba(6,182,212,0.3)] transition-all';
      } else {
        btn.className = 'px-2 py-1 rounded bg-slate-900/80 hover:bg-slate-800 text-slate-400 font-mono text-[11px] border border-slate-700 transition-all';
      }
    }
  });

  const descriptions = {
    'normal': 'Standard Combat White LED Lighting',
    'ir_blackout': 'MIL-SPEC IR Blackout Marker Mode (Night Vision Compatible)',
    'stealth_off': 'Total Emissive Blackout (All Exterior & Interior Lights Cut)'
  };

  playBeep(780, 0.05);
  showToast('LIGHTING MASTER SWITCH', descriptions[mode] || mode, mode === 'stealth_off' ? 'warn' : 'info');
}

function adjustSuspensionHeight(val) {
  terminalSettings.suspensionRideHeight = val;
  const label = document.getElementById('val-suspension-height');
  if (label) label.textContent = `${val} mm`;
}

function toggleMasterArm() {
  terminalSettings.masterArm = !terminalSettings.masterArm;
  const statusEl = document.getElementById('val-master-arm');
  const btn = document.getElementById('btn-toggle-master-arm');
  if (terminalSettings.masterArm) {
    if (statusEl) {
      statusEl.textContent = 'HOT (ARMED)';
      statusEl.className = 'px-2 py-0.5 rounded bg-red-950 text-red-400 font-mono font-bold text-[11px] border border-red-500/50 animate-pulse';
    }
    if (btn) btn.textContent = 'ENGAGE SAFE';
    playAlarmTone();
    showToast('WEAPON SYSTEM WARNING', 'Master Arm Safety OFF. Autocannon and RCWS trigger circuit live!', 'warn');
  } else {
    if (statusEl) {
      statusEl.textContent = 'SAFE (INHIBITED)';
      statusEl.className = 'px-2 py-0.5 rounded bg-slate-800 text-emerald-400 font-mono font-bold text-[11px] border border-slate-600';
    }
    if (btn) btn.textContent = 'ARM SYSTEM';
    playBeep(600, 0.05);
    showToast('WEAPON SYSTEM', 'Master Arm SAFE active. All firing solenoids locked.', 'info');
  }
}

function triggerSmokeScreen() {
  playBeep(1200, 0.15, 'sawtooth');
  setTimeout(() => playBeep(900, 0.1, 'sawtooth'), 150);
  showToast('COUNTERMEASURES FIRED', 'Multispectral aerosol 81mm smoke screen salvos discharged. IR/Visual obscured for 45s.', 'warn');

  const logs = document.getElementById('logs-container');
  if (logs) {
    const timeStr = new Date().toLocaleTimeString();
    logs.insertAdjacentHTML('afterbegin', `
      <div class="p-2 rounded bg-amber-950/40 border-l-4 border-amber-500 text-slate-200 flex justify-between">
        <span>[${timeStr}] COUNTERMEASURE: 81mm Defensive smoke grenades salvo launched.</span>
        <span class="text-amber-400 font-bold">SMOKE</span>
      </div>
    `);
  }
}

function runFullCanbusDiagnostic() {
  playBeep(1000, 0.08);
  showToast('CAN-BUS DIAGNOSTIC STARTED', 'Pinging 18 onboard ECUs, Transmission TCM, and ABS sensors...', 'info');

  const diagBtn = document.getElementById('btn-run-diagnostic');
  if (diagBtn) diagBtn.textContent = 'RUNNING...';

  setTimeout(() => {
    if (diagBtn) diagBtn.textContent = 'RUN DIAGNOSTIC';
    playBeep(1100, 0.05);
    showToast('DIAGNOSTIC VERIFIED', '18/18 ECUs OK. DTC Error Codes: 0. Bus Health 99.8%.', 'info');
  }, 1200);
}

function setBacklightIntensity(val) {
  const terminalBezel = document.querySelector('.crt-overlay');
  if (terminalBezel) {
    terminalBezel.style.filter = `brightness(${val}%)`;
  }
  const label = document.getElementById('val-backlight-percent');
  if (label) label.textContent = `${val}%`;
}

function setSpeedGovernor(val) {
  terminalSettings.speedGovernor = val;
  const label = document.getElementById('val-speed-gov');
  if (label) label.textContent = `${val} km/h`;
}

// Global Window Exports
window.inspectVehicle = inspectVehicle;
window.showCommsQuickModal = showCommsQuickModal;
window.captureTargetSnapshot = captureTargetSnapshot;
window.addCurrentPositionWaypoint = addCurrentPositionWaypoint;
window.clearLogsUI = clearLogsUI;
window.toggleNightFilter = toggleNightFilter;
window.setDriveMode = setDriveMode;
window.setCtisPressure = setCtisPressure;
window.setLightingBlackout = setLightingBlackout;
window.adjustSuspensionHeight = adjustSuspensionHeight;
window.toggleMasterArm = toggleMasterArm;
window.triggerSmokeScreen = triggerSmokeScreen;
window.runFullCanbusDiagnostic = runFullCanbusDiagnostic;
window.setBacklightIntensity = setBacklightIntensity;
window.setSpeedGovernor = setSpeedGovernor;

