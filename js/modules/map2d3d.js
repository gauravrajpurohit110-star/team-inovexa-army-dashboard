/**
 * Indian Army Tactical Terminal - Geospatial Battlespace Map Module
 * - Real Google Satellite, Hybrid, OpenTopoMap Color Elevation Relief & Dark Tactical Tiles
 * - Full-Bleed Upright Map (Zero diagonal screen skew / Zero black corners)
 * - Google Maps-Style Upward Arrow (^) Driving Forward Upward with Heading Tracking
 * - Live Offroad Mountain Movement Simulation (5 km/h - 40 km/h) in Ladakh Sector
 */

let tacticalMap = null;
let currentTileLayer = null;
let topoDemLayer = null;
let topoContourLayer = null;
let vehicleMarker = null;
let breadcrumbTrail = null;
let breadcrumbPoints = [];
let currentMapMode = '2d'; // '2d' or '3d'
let activeLayerKey = 'satellite';
let isDrivingActive = false; // Stopped by default (manual start/drive)
let driveInterval = null;

// Realistic Upward-Leading Offroad Mountain Route in Ladakh (Himalayan Valley to Ridge Pass)
// Heading is generally Northwards (0° / Upward) with authentic hairpin switchbacks
const OFFROAD_ROUTE = [
  { lat: 34.2050, lon: 77.5850, name: 'Valley Base Camp (Ladakh)', baseSpeed: 24 },
  { lat: 34.2085, lon: 77.5852, name: 'Dirt Trail Incline', baseSpeed: 36 },
  { lat: 34.2120, lon: 77.5855, name: 'Narrow Ridge Ascent', baseSpeed: 30 },
  { lat: 34.2145, lon: 77.5835, name: 'Hairpin Switchback 1', baseSpeed: 8 },   // Sharp switchback: slow crawl
  { lat: 34.2170, lon: 77.5870, name: 'Mountain Switchback 2', baseSpeed: 10 },  // Steep hairpin: slow crawl
  { lat: 34.2215, lon: 77.5872, name: 'High Plateau Straight', baseSpeed: 39 }, // Fast open plateau
  { lat: 34.2260, lon: 77.5875, name: 'Forward Pass Approach', baseSpeed: 32 },
  { lat: 34.2285, lon: 77.5850, name: 'Boulder Field Crawl', baseSpeed: 7 },    // Extreme rocky crawl
  { lat: 34.2320, lon: 77.5855, name: 'Peak Patrol Straight', baseSpeed: 38 },  // High speed summit road
  { lat: 34.2345, lon: 77.5858, name: 'Observation Ridge Crest', baseSpeed: 22 },
  { lat: 34.2325, lon: 77.5880, name: 'East Ridge Bypass', baseSpeed: 14 },
  { lat: 34.2280, lon: 77.5890, name: 'Valley Descent Trail', baseSpeed: 26 },
  { lat: 34.2200, lon: 77.5885, name: 'Checkpoint Alpha Sector', baseSpeed: 34 },
  { lat: 34.2100, lon: 77.5860, name: 'Base Return Link', baseSpeed: 28 }
];

let routeIndex = 0;
let routeT = 0; // interpolation fraction [0..1]
let currentLat = OFFROAD_ROUTE[0].lat;
let currentLon = OFFROAD_ROUTE[0].lon;
let currentHeading = 0; // degrees (North / straight UP)
let currentSpeed = 0; // km/h (Stationary when stopped)

// Tile Layer Providers
const MAP_LAYERS = {
  satellite: {
    name: 'SATELLITE',
    url: 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
    attribution: '&copy; Google Satellite Imagery',
    maxZoom: 20
  },
  hybrid: {
    name: 'HYBRID',
    url: 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
    attribution: '&copy; Google Hybrid (Sat + Roads)',
    maxZoom: 20
  },
  topo_color: {
    name: 'TOPO COLOR',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenTopoMap / Color Elevation Contours',
    subdomains: 'abc',
    maxZoom: 17
  },
  dark: {
    name: 'DARK TACTICAL',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; CartoDB Dark Matter / OSM',
    subdomains: 'abcd',
    maxZoom: 19
  },
  terrain: {
    name: 'TERRAIN',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; ESRI World Topo Shaded Relief',
    maxZoom: 19
  }
};

// Hypsometric Color Ramp for Physical Elevation Depth & Height Visualization
// Calibrated for Himalayan terrain in Ladakh (3,400m river valley to 5,000m+ peaks)
const HYPSO_COLOR_RAMP = [
  { elev: 3400, r: 10,  g: 45,  b: 85  }, // Deep Depression / River Bed (Deep Ocean Blue)
  { elev: 3650, r: 0,   g: 130, b: 200 }, // Lower River Valley (Vibrant Sky Cyan)
  { elev: 3820, r: 0,   g: 210, b: 140 }, // Valley Camp / Base Sector (Lush Emerald Teal)
  { elev: 3980, r: 90,  g: 225, b: 20  }, // Lower Mountain Slopes (Vivid Lime)
  { elev: 4150, r: 255, g: 215, b: 0   }, // Foothills & Lower Passes (Golden Yellow)
  { elev: 4320, r: 255, g: 130, b: 0   }, // Mountain Pass Incline (Fiery Tangerine Orange)
  { elev: 4520, r: 235, g: 45,  b: 65  }, // High Rocky Ridge Wall (Crimson Red)
  { elev: 4720, r: 160, g: 30,  b: 220 }, // Steep Mountain Crest (Electric Violet)
  { elev: 4950, r: 255, g: 255, b: 255 }  // Summit Peaks & Glacier Ice (Alpine Snow White)
];

function getElevationColor(e) {
  if (e <= HYPSO_COLOR_RAMP[0].elev) return [HYPSO_COLOR_RAMP[0].r, HYPSO_COLOR_RAMP[0].g, HYPSO_COLOR_RAMP[0].b];
  if (e >= HYPSO_COLOR_RAMP[HYPSO_COLOR_RAMP.length - 1].elev) {
    const last = HYPSO_COLOR_RAMP[HYPSO_COLOR_RAMP.length - 1];
    return [last.r, last.g, last.b];
  }
  for (let i = 0; i < HYPSO_COLOR_RAMP.length - 1; i++) {
    const p1 = HYPSO_COLOR_RAMP[i];
    const p2 = HYPSO_COLOR_RAMP[i + 1];
    if (e >= p1.elev && e <= p2.elev) {
      const t = (e - p1.elev) / (p2.elev - p1.elev);
      return [
        Math.round(p1.r + (p2.r - p1.r) * t),
        Math.round(p1.g + (p2.g - p1.g) * t),
        Math.round(p1.b + (p2.b - p1.b) * t)
      ];
    }
  }
  return [128, 128, 128];
}

const HYPSO_LUT_MIN = 3000;
const HYPSO_LUT_MAX = 5500;
const HYPSO_LUT_SIZE = HYPSO_LUT_MAX - HYPSO_LUT_MIN + 1;
const HYPSO_LUT_R = new Uint8Array(HYPSO_LUT_SIZE);
const HYPSO_LUT_G = new Uint8Array(HYPSO_LUT_SIZE);
const HYPSO_LUT_B = new Uint8Array(HYPSO_LUT_SIZE);

for (let m = HYPSO_LUT_MIN; m <= HYPSO_LUT_MAX; m++) {
  const [r, g, b] = getElevationColor(m);
  const idx = m - HYPSO_LUT_MIN;
  HYPSO_LUT_R[idx] = r;
  HYPSO_LUT_G[idx] = g;
  HYPSO_LUT_B[idx] = b;
}

let HypsometricDEMLayerClass = null;
function getHypsometricDEMLayerClass() {
  if (!HypsometricDEMLayerClass && typeof L !== 'undefined') {
    HypsometricDEMLayerClass = L.GridLayer.extend({
      createTile: function (coords, done) {
        const tile = document.createElement('canvas');
        tile.width = 256;
        tile.height = 256;
        const ctx = tile.getContext('2d');

        const z = coords.z;
        const x = coords.x;
        const y = coords.y;

        const img = new Image();
        img.crossOrigin = 'anonymous';

        img.onload = () => {
          try {
            const offC = document.createElement('canvas');
            offC.width = 256;
            offC.height = 256;
            const offCtx = offC.getContext('2d');
            offCtx.drawImage(img, 0, 0);
            const data = offCtx.getImageData(0, 0, 256, 256).data;

            const imgData = ctx.createImageData(256, 256);
            const out = imgData.data;

            for (let i = 0; i < data.length; i += 4) {
              const elev = Math.round((data[i] * 256 + data[i+1] + data[i+2]/256) - 32768);
              const clamped = Math.max(HYPSO_LUT_MIN, Math.min(HYPSO_LUT_MAX, elev));
              const idx = clamped - HYPSO_LUT_MIN;
              out[i]     = HYPSO_LUT_R[idx];
              out[i + 1] = HYPSO_LUT_G[idx];
              out[i + 2] = HYPSO_LUT_B[idx];
              out[i + 3] = 255;
            }
            ctx.putImageData(imgData, 0, 0);
          } catch (e) {
            ctx.fillStyle = '#0e2b3d';
            ctx.fillRect(0, 0, 256, 256);
          }
          done(null, tile);
        };

        img.onerror = () => {
          ctx.fillStyle = '#081a26';
          ctx.fillRect(0, 0, 256, 256);
          done(null, tile);
        };

        img.src = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/' + z + '/' + x + '/' + y + '.png';
        return tile;
      }
    });
  }
  return HypsometricDEMLayerClass;
}

/**
 * Dynamically loads Leaflet CSS & JS
 */
function ensureLeafletLoaded() {
  return new Promise((resolve) => {
    if (typeof L !== 'undefined') {
      resolve();
      return;
    }

    if (!document.querySelector('link[href*="leaflet.css"]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    if (!document.querySelector('script[src*="leaflet.js"]')) {
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.onload = () => resolve();
      document.head.appendChild(script);
    } else {
      const interval = setInterval(() => {
        if (typeof L !== 'undefined') {
          clearInterval(interval);
          resolve();
        }
      }, 50);
    }
  });
}

/**
 * Initialize Tactical Map
 */
async function initTacticalMap() {
  const container = document.getElementById('tactical-map-viewport');
  if (!container || tacticalMap) return;

  await ensureLeafletLoaded();

  try {
    tacticalMap = L.map('tactical-map-viewport', {
      center: [currentLat, currentLon],
      zoom: 15,
      zoomControl: false,
      attributionControl: false
    });

    // Default to Satellite Layer
    setMapLayer('satellite');

    // Add Glowing Tactical Breadcrumb Polyline
    breadcrumbTrail = L.polyline([[currentLat, currentLon]], {
      color: '#00e676',
      weight: 3.5,
      opacity: 0.85,
      dashArray: '6, 6'
    }).addTo(tacticalMap);

    // Add Google Maps-Style Upward Pointing Arrow Marker
    createVehicleMarker();

    // Add Tactical Contacts (Hostile T-84 & Friendly BMS-02)
    createTacticalContacts();

    // Ensure map viewport is perfectly upright (no diagonal container skew!)
    applyCameraTransform();

    // Initial Telemetry HUD readout (stationary)
    updateTelemetryHUD();

    // Start Live Offroad Driving Movement Simulation (controlled by isDrivingActive)
    startDrivingSimulation();

    // Invalidate size once DOM stabilizes
    setTimeout(() => {
      if (tacticalMap) tacticalMap.invalidateSize();
    }, 200);

  } catch (err) {
    console.error('Tactical Map Initialization Error:', err);
  }
}

/**
 * Switch Active Tile Layer (Satellite, Hybrid, Topo Color, Dark, Terrain)
 */
function setMapLayer(layerKey) {
  if (!MAP_LAYERS[layerKey] || !tacticalMap) return;
  activeLayerKey = layerKey;

  // Clean up any active layers
  if (currentTileLayer) {
    tacticalMap.removeLayer(currentTileLayer);
    currentTileLayer = null;
  }
  if (topoDemLayer) {
    tacticalMap.removeLayer(topoDemLayer);
    topoDemLayer = null;
  }
  if (topoContourLayer) {
    tacticalMap.removeLayer(topoContourLayer);
    topoContourLayer = null;
  }

  const legend = document.getElementById('topo-elevation-legend');
  const stage = document.getElementById('map-stage-wrapper');

  if (layerKey === 'topo_color') {
    // 1. Add Hypsometric Color Elevation DEM base layer (Depth: Blue/Cyan/Emerald -> Height: Orange/Red/White)
    const DemClass = getHypsometricDEMLayerClass();
    if (DemClass) {
      topoDemLayer = new DemClass({ maxZoom: 16 }).addTo(tacticalMap);
    }
    // 2. Add OpenTopoMap Contours & Hillshading on top with multiply blend for crisp elevation readings
    topoContourLayer = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
      maxZoom: 17,
      subdomains: 'abc',
      className: 'topo-contour-blend',
      opacity: 0.74,
      attribution: '&copy; OpenTopoMap & AWS Terrarium DEM'
    }).addTo(tacticalMap);

    if (legend) legend.classList.remove('hidden');
    if (stage) {
      stage.classList.add('topo-color-active');
      stage.classList.remove('satellite-active');
    }
  } else {
    const conf = MAP_LAYERS[layerKey];
    currentTileLayer = L.tileLayer(conf.url, {
      maxZoom: conf.maxZoom || 19,
      subdomains: conf.subdomains || 'abc',
      attribution: conf.attribution
    }).addTo(tacticalMap);

    if (legend) legend.classList.add('hidden');
    if (stage) {
      stage.classList.remove('topo-color-active');
      stage.classList.toggle('satellite-active', layerKey === 'satellite' || layerKey === 'hybrid');
    }
  }

  // Update UI button highlights
  document.querySelectorAll('[data-map-layer]').forEach(btn => {
    const key = btn.getAttribute('data-map-layer');
    if (key === layerKey) {
      btn.className = 'px-2 py-1 rounded bg-emerald-950/90 text-emerald-400 border border-emerald-500/60 font-mono text-[11px] font-semibold transition-all shadow-[0_0_8px_rgba(0,230,118,0.25)]';
    } else {
      btn.className = 'px-2 py-1 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border border-slate-700 font-mono text-[11px] transition-all';
    }
  });

  const layerLabel = document.getElementById('map-active-layer-name');
  if (layerLabel) layerLabel.textContent = MAP_LAYERS[layerKey].name;

  if (window.playBeep) window.playBeep(900, 0.04);
  if (window.showToast) window.showToast('MAP LAYER CHANGED', `Switched to ${MAP_LAYERS[layerKey].name} view.`, 'info');
}

/**
 * Creates Google Maps-style Navigation Arrow Marker
 * Arrow points straight UP (^) along travel vector, rotating naturally to trace road bends
 */
function createVehicleMarker() {
  if (!tacticalMap) return;

  const vehicleIcon = L.divIcon({
    className: 'tactical-vehicle-marker-wrapper',
    html: `
      <div id="vehicle-marker-dom" class="relative flex items-center justify-center pointer-events-auto cursor-pointer" style="width: 56px; height: 56px;" onclick="window.showVehicleMapPopup()">
        <!-- Radar Pulse Beacon Rings -->
        <div class="absolute inset-0 rounded-full border border-emerald-400/40 animate-ping pointer-events-none"></div>
        <div class="absolute inset-1 rounded-full bg-emerald-500/15 border border-emerald-400/60 pointer-events-none"></div>
        
        <!-- Google Maps Driving Direction Arrow: Points UP (^) along travel direction -->
        <div id="vehicle-arrow-direction" class="relative z-10 transition-transform duration-300 transform-origin-center" style="transform: rotate(${currentHeading}deg);">
          <svg width="38" height="38" viewBox="0 0 38 38" fill="none" xmlns="http://www.w3.org/2000/svg" class="drop-shadow-[0_0_10px_rgba(0,230,118,0.95)]">
            <!-- Tactical Navigation Arrow (Pointing straight UP: 0 degrees) -->
            <path d="M19 3L33 32L19 25L5 32L19 3Z" fill="#04271e" stroke="#00e676" stroke-width="2.6" stroke-linejoin="round"/>
            <path d="M19 8L28 27L19 22.5L10 27L19 8Z" fill="#00e676"/>
            <circle cx="19" cy="20.5" r="2.8" fill="#ffffff"/>
          </svg>
        </div>

        <!-- Dynamic Speed Badge Under Arrow (Fluctuates 5 - 40 KM/H) -->
        <div id="vehicle-speed-badge" class="absolute -bottom-2.5 px-1.5 py-0.2 rounded bg-black/90 border border-emerald-400/60 text-[9px] font-mono text-emerald-300 font-bold tracking-tight shadow whitespace-nowrap">
          ${Math.round(currentSpeed)} KM/H
        </div>
      </div>
    `,
    iconSize: [56, 56],
    iconAnchor: [28, 28]
  });

  vehicleMarker = L.marker([currentLat, currentLon], { icon: vehicleIcon, zIndexOffset: 1000 }).addTo(tacticalMap);

  updateVehiclePopup();
}

function updateVehiclePopup() {
  if (!vehicleMarker) return;
  const currentWpName = OFFROAD_ROUTE[routeIndex].name;
  vehicleMarker.bindPopup(`
    <div class="p-2 font-mono text-xs bg-[#071520] text-slate-100 border border-emerald-500/50 rounded-lg shadow-xl min-w-[220px]">
      <div class="flex items-center justify-between pb-1.5 border-b border-[#14364c] mb-1.5">
        <span class="font-bold text-emerald-400 flex items-center gap-1">
          <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          ALSV-08 (TACTICAL 4x4)
        </span>
        <span class="px-1.5 py-0.2 rounded bg-emerald-950 text-[10px] text-emerald-300 border border-emerald-500/40">LIVE PATROL</span>
      </div>
      <div class="space-y-1 text-[11px] text-slate-300">
        <div class="flex justify-between"><span class="text-slate-400">ROUTE SECTOR:</span><span class="text-white font-semibold">${currentWpName}</span></div>
        <div class="flex justify-between"><span class="text-slate-400">GPS COORDS:</span><span class="text-emerald-300">${currentLat.toFixed(4)}°N, ${currentLon.toFixed(4)}°E</span></div>
        <div class="flex justify-between"><span class="text-slate-400">CURRENT SPEED:</span><span class="text-cyan-400 font-bold">${Math.round(currentSpeed)} km/h (Offroad)</span></div>
        <div class="flex justify-between"><span class="text-slate-400">HEADING:</span><span class="text-slate-100">${Math.round(currentHeading)}° ${getCompassBearing(currentHeading)}</span></div>
        <div class="flex justify-between"><span class="text-slate-400">STATUS:</span><span class="text-emerald-400 font-bold">ALL-TERRAIN ACTIVE</span></div>
      </div>
    </div>
  `, { className: 'tactical-leaflet-popup' });
}

/**
 * Computes bearing (heading) between two coordinates in degrees [0..360]
 */
function calcBearing(lat1, lon1, lat2, lon2) {
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const y = Math.sin(dLon) * Math.cos(lat2 * Math.PI / 180);
  const x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) -
            Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos(dLon);
  let brng = Math.atan2(y, x) * 180 / Math.PI;
  return (brng + 360) % 360;
}

function getCompassBearing(deg) {
  const sectors = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return sectors[Math.round(deg / 45) % 8];
}

/**
 * Realistic Live Offroad Driving Movement Engine
 * Moves vehicle forward / upward along Ladakh mountain trail with speed varying 5 - 40 km/h
 */
function startDrivingSimulation() {
  if (driveInterval) clearInterval(driveInterval);

  driveInterval = setInterval(() => {
    if (!isDrivingActive || !tacticalMap) return;

    const fromWp = OFFROAD_ROUTE[routeIndex];
    const nextIdx = (routeIndex + 1) % OFFROAD_ROUTE.length;
    const toWp = OFFROAD_ROUTE[nextIdx];

    // Compute target bearing
    const targetHeading = calcBearing(fromWp.lat, fromWp.lon, toWp.lat, toWp.lon);
    
    // Smooth heading rotation
    let dH = targetHeading - currentHeading;
    if (dH > 180) dH -= 360;
    if (dH < -180) dH += 360;
    currentHeading = (currentHeading + dH * 0.25 + 360) % 360;

    // Realistic Offroad Speed Physics in India:
    // When turning sharply (hairpins/bends), speed drops to 5 - 12 km/h
    // On open mountain plateau straights, speed accelerates to 30 - 40 km/h
    const turnSeverity = Math.min(1, Math.abs(dH) / 45);
    const targetSpeed = toWp.baseSpeed * (1 - turnSeverity * 0.7) + (Math.random() * 2 - 1);
    const clampedTarget = Math.max(5.2, Math.min(40.0, targetSpeed));
    currentSpeed += (clampedTarget - currentSpeed) * 0.22;

    // Advance along route segment
    const step = (currentSpeed / 40.0) * 0.045 + 0.012;
    routeT += step;

    if (routeT >= 1.0) {
      routeT = 0;
      routeIndex = nextIdx;
    }

    // Interpolate coordinates
    currentLat = fromWp.lat + (toWp.lat - fromWp.lat) * routeT;
    currentLon = fromWp.lon + (toWp.lon - fromWp.lon) * routeT;

    // Update marker position on map
    if (vehicleMarker) {
      vehicleMarker.setLatLng([currentLat, currentLon]);
    }

    // Update breadcrumb polyline
    breadcrumbPoints.push([currentLat, currentLon]);
    if (breadcrumbPoints.length > 60) breadcrumbPoints.shift();
    if (breadcrumbTrail) {
      breadcrumbTrail.setLatLngs(breadcrumbPoints);
    }

    // Auto-pan map smoothly to follow vehicle
    tacticalMap.panTo([currentLat, currentLon], { animate: false });

    // Rotate arrow towards travel direction (heading)
    const arrowDom = document.getElementById('vehicle-arrow-direction');
    if (arrowDom) {
      arrowDom.style.transform = `rotate(${Math.round(currentHeading)}deg)`;
    }

    // Update Speed badge on arrow
    const speedBadge = document.getElementById('vehicle-speed-badge');
    if (speedBadge) {
      speedBadge.textContent = `${Math.round(currentSpeed)} KM/H`;
    }

    // Update Top-Left Floating HUD
    updateTelemetryHUD();

  }, 350);
}

/**
 * Applies 2D vs 3D transforms to #tactical-map-viewport
 * NOTE: Viewport stays 100% upright in 2D (NO diagonal container rotation!)
 */
function applyCameraTransform() {
  const viewport = document.getElementById('tactical-map-viewport');
  const stage = document.getElementById('map-stage-wrapper');
  if (!viewport) return;

  if (stage) {
    stage.classList.toggle('topo-color-active', activeLayerKey === 'topo_color');
    stage.classList.toggle('satellite-active', activeLayerKey === 'satellite' || activeLayerKey === 'hybrid');
  }

  if (currentMapMode === '3d') {
    // 3D Perspective Chase View: Pure forward pitch (NO Z-axis diagonal skew!)
    viewport.style.transform = 'rotateX(44deg) scale(1.18)';
  } else {
    // 2D Orthographic View: Perfectly upright, full-bleed
    viewport.style.transform = 'none';
  }
}

/**
 * Update HUD telemetry readouts
 */
function updateTelemetryHUD() {
  const latEl = document.getElementById('hud-live-lat');
  const lonEl = document.getElementById('hud-live-lon');
  const spdEl = document.getElementById('hud-live-speed');
  const secEl = document.getElementById('hud-live-sector');
  const hdgEl = document.getElementById('hud-live-heading');

  if (latEl) latEl.textContent = `${currentLat.toFixed(4)}° N`;
  if (lonEl) lonEl.textContent = `${currentLon.toFixed(4)}° E`;
  if (spdEl) spdEl.textContent = isDrivingActive ? `${Math.round(currentSpeed)} km/h` : '0 km/h (HALTED)';
  if (secEl) secEl.textContent = OFFROAD_ROUTE[routeIndex].name.toUpperCase();
  if (hdgEl) hdgEl.textContent = `${String(Math.round(currentHeading)).padStart(3, '0')}° ${getCompassBearing(currentHeading)}`;
}

/**
 * Toggle Live Driving Simulation (Play / Pause)
 */
function toggleDrivingSimulation() {
  isDrivingActive = !isDrivingActive;
  const btn = document.getElementById('btn-toggle-drive');
  if (btn) {
    btn.innerHTML = isDrivingActive
      ? '<i data-lucide="pause" class="w-3.5 h-3.5 text-amber-400"></i> PAUSE'
      : '<i data-lucide="play" class="w-3.5 h-3.5 text-emerald-400"></i> DRIVE';
  }
  if (!isDrivingActive) {
    currentSpeed = 0;
    const speedBadge = document.getElementById('vehicle-speed-badge');
    if (speedBadge) {
      speedBadge.textContent = '0 KM/H';
    }
    updateTelemetryHUD();
    updateVehiclePopup();
  }
  if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();

  if (window.showToast) {
    window.showToast('OFFROAD PATROL', isDrivingActive ? 'Vehicle patrol movement started.' : 'Vehicle movement stopped (Stationary).', 'info');
  }
  if (window.playBeep) window.playBeep(isDrivingActive ? 1000 : 700, 0.05);
}

/**
 * Toggle 2D vs 3D View
 */
function setMapMode(mode) {
  if (mode !== '2d' && mode !== '3d') return;
  currentMapMode = mode;

  const wrapper = document.getElementById('map-stage-wrapper');
  const btn2d = document.getElementById('btn-map-mode-2d');
  const btn3d = document.getElementById('btn-map-mode-3d');
  const modeBadge = document.getElementById('map-perspective-badge');

  if (mode === '3d') {
    if (wrapper) wrapper.classList.add('map-3d-perspective');
    if (btn3d) btn3d.className = 'px-3 py-1 rounded bg-emerald-500/25 border border-emerald-400 text-emerald-300 font-mono text-xs font-bold transition-all shadow-[0_0_12px_rgba(0,230,118,0.4)] flex items-center gap-1.5';
    if (btn2d) btn2d.className = 'px-3 py-1 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-slate-200 font-mono text-xs transition-all flex items-center gap-1.5';
    if (modeBadge) modeBadge.textContent = '3D TACTICAL PITCH (CHASE VIEW)';
    if (window.showToast) window.showToast('3D TACTICAL VIEW', 'Pitched 3D chase camera view engaged.', 'info');
  } else {
    if (wrapper) wrapper.classList.remove('map-3d-perspective');
    if (btn2d) btn2d.className = 'px-3 py-1 rounded bg-emerald-500/25 border border-emerald-400 text-emerald-300 font-mono text-xs font-bold transition-all shadow-[0_0_12px_rgba(0,230,118,0.4)] flex items-center gap-1.5';
    if (btn3d) btn3d.className = 'px-3 py-1 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-slate-200 font-mono text-xs transition-all flex items-center gap-1.5';
    if (modeBadge) modeBadge.textContent = '2D ORTHOGRAPHIC TOP-DOWN';
    if (window.showToast) window.showToast('2D ORTHOGRAPHIC VIEW', 'Top-down strategic grid map engaged.', 'info');
  }

  applyCameraTransform();
  if (window.playBeep) window.playBeep(mode === '3d' ? 950 : 750, 0.05);

  setTimeout(() => {
    if (tacticalMap) {
      tacticalMap.invalidateSize();
      tacticalMap.panTo([currentLat, currentLon]);
    }
  }, 150);
}

/**
 * Re-center Map on Vehicle Position
 */
function centerVehicle() {
  if (!tacticalMap) return;
  tacticalMap.setView([currentLat, currentLon], Math.max(tacticalMap.getZoom(), 15), {
    animate: true,
    duration: 0.6
  });
  if (window.playBeep) window.playBeep(1100, 0.05);
  if (window.showToast) window.showToast('VEHICLE RE-CENTERED', 'Camera locked onto ALSV-08 GPS beacon.', 'info');
}

function zoomMap(delta) {
  if (!tacticalMap) return;
  if (delta > 0) tacticalMap.zoomIn();
  else tacticalMap.zoomOut();
  if (window.playBeep) window.playBeep(850, 0.03);
}

function showVehicleMapPopup() {
  if (vehicleMarker) {
    updateVehiclePopup();
    vehicleMarker.openPopup();
  }
}

function invalidateMapSize() {
  if (tacticalMap) {
    tacticalMap.invalidateSize();
  }
}

/**
 * Tactical Contacts (Hostile T-84 & Friendly BMS-02)
 */
function createTacticalContacts() {
  if (!tacticalMap) return;

  // Hostile Tank Contact #T-84
  const hostileIcon = L.divIcon({
    className: 'tactical-hostile-marker',
    html: `
      <div class="relative flex flex-col items-center pointer-events-auto cursor-pointer">
        <div class="w-6 h-6 rounded bg-red-950/90 border-2 border-red-500 flex items-center justify-center shadow-[0_0_10px_rgba(239,68,68,0.7)] animate-pulse">
          <span class="text-red-400 font-mono font-bold text-[10px]">T-84</span>
        </div>
        <div class="mt-0.5 px-1 rounded bg-black/80 text-[8px] font-mono text-red-400 border border-red-500/40 whitespace-nowrap font-semibold">
          1.2 KM (HOSTILE)
        </div>
      </div>
    `,
    iconSize: [50, 40],
    iconAnchor: [25, 20]
  });

  const hostileMarker = L.marker([34.2215, 77.5992], { icon: hostileIcon }).addTo(tacticalMap);
  hostileMarker.bindPopup(`
    <div class="p-2 font-mono text-xs bg-[#190a0a] text-slate-100 border border-red-500/60 rounded-lg shadow-xl">
      <div class="text-red-400 font-bold flex items-center gap-1.5 pb-1 border-b border-red-900/50 mb-1">
        <span class="w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
        HOSTILE ARMOR CONTACT #T-84
      </div>
      <div class="text-[11px] text-slate-300 space-y-0.5">
        <div>BEARING: 042° NE | RANGE: 1,210 m</div>
        <div>SPEED: 18 km/h | ELEVATION: +140m</div>
        <div class="text-amber-400 font-semibold">IFF: CONFIRMED UNKNOWN / HOSTILE</div>
      </div>
    </div>
  `, { className: 'tactical-leaflet-popup' });

  // Friendly BMS-02 Patrol
  const friendlyIcon = L.divIcon({
    className: 'tactical-friendly-marker',
    html: `
      <div class="relative flex flex-col items-center pointer-events-auto cursor-pointer">
        <div class="w-6 h-6 rounded-full bg-cyan-950/90 border-2 border-cyan-400 flex items-center justify-center shadow-[0_0_8px_rgba(56,189,248,0.6)]">
          <span class="text-cyan-300 font-mono font-bold text-[9px]">02</span>
        </div>
        <div class="mt-0.5 px-1 rounded bg-black/80 text-[8px] font-mono text-cyan-300 border border-cyan-500/40 whitespace-nowrap">
          BMS-02 (FRIENDLY)
        </div>
      </div>
    `,
    iconSize: [50, 40],
    iconAnchor: [25, 20]
  });

  const friendlyMarker = L.marker([34.2045, 77.5742], { icon: friendlyIcon }).addTo(tacticalMap);
  friendlyMarker.bindPopup(`
    <div class="p-2 font-mono text-xs bg-[#081824] text-slate-100 border border-cyan-500/50 rounded-lg shadow-xl">
      <div class="text-cyan-400 font-bold pb-1 border-b border-cyan-900/50 mb-1">
        FRIENDLY PATROL BMS-02
      </div>
      <div class="text-[11px] text-slate-300 space-y-0.5">
        <div>RANGE: 1.8 KM SW</div>
        <div>COMMS: ENCRYPTED VHF CHANNEL 4</div>
        <div class="text-emerald-400">STATUS: CONVOY ESCORT</div>
      </div>
    </div>
  `, { className: 'tactical-leaflet-popup' });
}

// Global Exports
window.initTacticalMap = initTacticalMap;
window.setMapLayer = setMapLayer;
window.setMapMode = setMapMode;
window.centerVehicle = centerVehicle;
window.zoomMap = zoomMap;
window.showVehicleMapPopup = showVehicleMapPopup;
window.invalidateMapSize = invalidateMapSize;
window.toggleDrivingSimulation = toggleDrivingSimulation;
