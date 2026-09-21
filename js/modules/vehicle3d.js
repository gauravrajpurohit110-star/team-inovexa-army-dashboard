/**
 * Indian Army Tactical Terminal - 3D Interactive Vehicle Engine
 * Fully Lazy-Loaded, Memory Efficient with Asynchronous Model Decoding.
 */

let scene3d, camera3d, renderer3d, vehicle3dGroup, gridDisc3d;
let is3dRotating = true;
let isWireframeMode = false;
let isMouseDown = false;
let mousePrevX = 0, mousePrevY = 0;
let is3dInitialized = false;
let is3dLoopActive = false;

/**
 * Dynamically loads an external script and resolves when ready
 */
function loadScriptAsync(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.onload = () => resolve();
    script.onerror = (e) => reject(new Error(`Failed to load script: ${src}`));
    document.head.appendChild(script);
  });
}

/**
 * Lazy initializer for Three.js & GLTF runtime
 */
async function init3dVehicleLazy() {
  if (is3dInitialized) return;
  is3dInitialized = true;

  const wrapper = document.getElementById('vehicle-3d-wrapper');
  const canvas = document.getElementById('vehicle-3d-canvas');
  if (!canvas || !wrapper) return;

  try {
    // 1. Asynchronously load Three.js if not yet in window
    if (typeof THREE === 'undefined') {
      await loadScriptAsync('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js');
    }

    // 2. Asynchronously load GLTFLoader if not yet in THREE
    if (typeof THREE.GLTFLoader === 'undefined') {
      await loadScriptAsync('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js');
    }

    // 3. Build WebGL Scene & Camera
    const w = wrapper.clientWidth || 210;
    const h = wrapper.clientHeight || 185;

    scene3d = new THREE.Scene();
    scene3d.background = new THREE.Color(0x061017);

    camera3d = new THREE.PerspectiveCamera(36, w / h, 0.1, 100);
    camera3d.position.set(2.7, 1.3, 2.8);

    renderer3d = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
    renderer3d.setSize(w, h);
    renderer3d.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer3d.outputEncoding = THREE.sRGBEncoding;
    renderer3d.toneMapping = THREE.ACESFilmicToneMapping;
    renderer3d.toneMappingExposure = 1.35;

    // Studio Neutral Lighting for True-to-Life GLB Color Accuracy
    const ambLight = new THREE.AmbientLight(0xffffff, 2.2);
    scene3d.add(ambLight);

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 1.4);
    hemiLight.position.set(0, 10, 0);
    scene3d.add(hemiLight);

    const mainSun = new THREE.DirectionalLight(0xffffff, 2.5);
    mainSun.position.set(5, 8, 5);
    scene3d.add(mainSun);

    const frontFill = new THREE.DirectionalLight(0xffffff, 1.6);
    frontFill.position.set(-5, 4, -4);
    scene3d.add(frontFill);

    const backLight = new THREE.DirectionalLight(0xffffff, 1.2);
    backLight.position.set(0, 5, -6);
    scene3d.add(backLight);

    // Root vehicle group
    vehicle3dGroup = new THREE.Group();
    scene3d.add(vehicle3dGroup);

    // Holographic Radar Grid Disc Underneath
    const gridGeom = new THREE.CircleGeometry(2.3, 32);
    const gridMat = new THREE.MeshBasicMaterial({ color: 0x00e676, wireframe: true, transparent: true, opacity: 0.28 });
    gridDisc3d = new THREE.Mesh(gridGeom, gridMat);
    gridDisc3d.rotation.x = -Math.PI / 2;
    gridDisc3d.position.y = -0.62;
    scene3d.add(gridDisc3d);

    camera3d.lookAt(0, 0.15, 0);

    // Bind Interaction Events (Drag, Wheel, Touch)
    bindVehicleControls(canvas, wrapper);

    // Start Animation Loop
    resume3dLoop();

    // 4. Asynchronously load the 3D Army Vehicle GLB
    loadTacticalVehicleModel();

  } catch (err) {
    console.error('3D Engine Initialization Error:', err);
    hideLoader();
  }
}

function bindVehicleControls(canvas, wrapper) {
  canvas.addEventListener('dblclick', (e) => {
    e.stopPropagation();
    expand3dVehicleModal();
  });

  canvas.addEventListener('mousedown', (e) => {
    isMouseDown = true;
    mousePrevX = e.clientX;
    mousePrevY = e.clientY;
  });

  window.addEventListener('mouseup', () => { isMouseDown = false; });

  window.addEventListener('mousemove', (e) => {
    if (!isMouseDown || !vehicle3dGroup) return;
    const deltaX = e.clientX - mousePrevX;
    const deltaY = e.clientY - mousePrevY;
    mousePrevX = e.clientX;
    mousePrevY = e.clientY;

    vehicle3dGroup.rotation.y += deltaX * 0.015;
    camera3d.position.y = Math.max(0.5, Math.min(4.5, camera3d.position.y - deltaY * 0.015));
    camera3d.lookAt(0, 0.15, 0);
  });

  canvas.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
      isMouseDown = true;
      mousePrevX = e.touches[0].clientX;
      mousePrevY = e.touches[0].clientY;
    }
  });
  window.addEventListener('touchend', () => { isMouseDown = false; });
  window.addEventListener('touchmove', (e) => {
    if (!isMouseDown || !vehicle3dGroup || e.touches.length !== 1) return;
    const deltaX = e.touches[0].clientX - mousePrevX;
    const deltaY = e.touches[0].clientY - mousePrevY;
    mousePrevX = e.touches[0].clientX;
    mousePrevY = e.touches[0].clientY;
    vehicle3dGroup.rotation.y += deltaX * 0.015;
    camera3d.position.y = Math.max(0.5, Math.min(4.5, camera3d.position.y - deltaY * 0.015));
    camera3d.lookAt(0, 0.15, 0);
  });

  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    camera3d.position.z = Math.max(1.8, Math.min(6.5, camera3d.position.z + e.deltaY * 0.003));
    camera3d.position.x = Math.max(1.8, Math.min(6.5, camera3d.position.x + e.deltaY * 0.003));
    camera3d.lookAt(0, 0.15, 0);
  }, { passive: false });

  // Direct Drag & Drop of any external .glb / .gltf into the 3D viewport
  wrapper.addEventListener('dragover', (e) => {
    e.preventDefault();
    wrapper.classList.add('border-emerald-400', 'bg-emerald-950/20');
  });
  wrapper.addEventListener('dragleave', () => {
    wrapper.classList.remove('border-emerald-400', 'bg-emerald-950/20');
  });
  wrapper.addEventListener('drop', (e) => {
    e.preventDefault();
    wrapper.classList.remove('border-emerald-400', 'bg-emerald-950/20');
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      showToast('DROPPED FILE DETECTED', `Loading ${droppedFile.name}...`, 'info');
      const reader = new FileReader();
      reader.onload = (ev) => parseAndDisplayGLB(ev.target.result, droppedFile.name);
      reader.readAsArrayBuffer(droppedFile);
    }
  });
}

/**
 * Loads the tactical army vehicle GLB lazily
 */
async function loadTacticalVehicleModel() {
  // Strategy 1: Try direct binary fetch of GLB (fastest, lowest memory, streaming)
  try {
    const res = await fetch('./sample_2026-09-20T161027.542.glb');
    if (res.ok) {
      const buffer = await res.arrayBuffer();
      parseAndDisplayGLB(buffer, 'TACTICAL PATROL 4X4 (CUSTOM GLB)');
      return;
    }
  } catch (e) {
    // CORS or file:// protocol - proceed to fallback
  }

  // Strategy 2: Dynamically load Base64 data script for offline file:// protocol
  try {
    if (typeof window.SAMPLE_GLB_BASE64 === 'undefined' || !window.SAMPLE_GLB_BASE64) {
      // Try assets/models path first, then root path
      try {
        await loadScriptAsync('assets/models/sample_model_data.js');
      } catch (err1) {
        await loadScriptAsync('sample_model_data.js');
      }
    }

    if (window.SAMPLE_GLB_BASE64) {
      const base64Data = window.SAMPLE_GLB_BASE64;
      const res = await fetch('data:application/octet-stream;base64,' + base64Data);
      const buffer = await res.arrayBuffer();
      
      // Free the 18MB Base64 string from memory immediately after decoding
      window.SAMPLE_GLB_BASE64 = null;
      delete window.SAMPLE_GLB_BASE64;

      parseAndDisplayGLB(buffer, 'TACTICAL PATROL 4X4 (CUSTOM GLB)');
      return;
    }
  } catch (err) {
    console.warn('Fallback GLB loader error:', err);
  }

  // Strategy 3: Fallback procedural ALSV model if GLB could not be found
  buildArmadoALSVModel();
  hideLoader();
}

function hideLoader() {
  const loader = document.getElementById('vehicle-3d-loader');
  if (loader) {
    loader.style.opacity = '0';
    setTimeout(() => loader.style.display = 'none', 400);
  }
}

/**
 * Reusable GLB Parser with true-color sRGB and metalness rebalance
 */
function parseAndDisplayGLB(arrayBuffer, modelName) {
  if (typeof THREE === 'undefined' || typeof THREE.GLTFLoader === 'undefined') return;

  const loader = new THREE.GLTFLoader();
  loader.parse(arrayBuffer, '', function(gltf) {
    while (vehicle3dGroup.children.length > 0) {
      vehicle3dGroup.remove(vehicle3dGroup.children[0]);
    }
    const model = gltf.scene;

    // Enhance materials and ensure true-to-life colors from texture maps
    model.traverse(child => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        if (child.material) {
          child.material.side = THREE.DoubleSide;
          child.material.wireframe = isWireframeMode;

          // Ensure texture maps use sRGB encoding for rich vibrant colors
          if (child.material.map) {
            child.material.map.encoding = THREE.sRGBEncoding;
            child.material.map.needsUpdate = true;
          }

          // Balance metalness and roughness so army olive paint and camo colors pop brightly
          if (child.material.isMeshStandardMaterial || child.material.isMeshPhysicalMaterial) {
            if (child.material.metalness > 0.4) {
              child.material.metalness = 0.15;
            }
            if (child.material.roughness < 0.3) {
              child.material.roughness = 0.5;
            }
          }

          child.material.needsUpdate = true;
        }
      }
    });

    // Compute bounding box, auto-scale and center perfectly
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const targetScale = 3.35 / maxDim;
    model.scale.set(targetScale, targetScale, targetScale);

    // Re-center after scaling
    box.setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    model.position.x -= center.x;
    model.position.y -= center.y;
    model.position.z -= center.z;

    vehicle3dGroup.add(model);

    // Reset camera framing to showcase vehicle closer and larger
    camera3d.position.set(2.7, 1.3, 2.8);
    camera3d.lookAt(0, 0.15, 0);

    // Update HUD labels
    const cleanName = (modelName || 'CUSTOM VEHICLE').replace(/\.[^/.]+$/, '').toUpperCase();
    const titleBadge = document.getElementById('vehicle-3d-title');
    if (titleBadge) {
      titleBadge.textContent = '3D LIVE: ' + (cleanName.length > 12 ? 'TACTICAL 4x4' : cleanName);
    }
    const vehicleLabel = document.getElementById('vehicle-3d-model-label');
    if (vehicleLabel) {
      vehicleLabel.textContent = cleanName;
    }

    hideLoader();
    playBeep(1100, 0.08);
    showToast('3D GLB LOADED', `Active Model: ${cleanName}`, 'info');
  }, function(err) {
    console.error('GLTF parse error:', err);
    hideLoader();
    buildArmadoALSVModel();
    showToast('GLB LOAD ERROR', 'Using Armado ALSV backup model.', 'warn');
  });
}

/**
 * Procedural fallback model
 */
function buildArmadoALSVModel() {
  while (vehicle3dGroup.children.length > 0) {
    vehicle3dGroup.remove(vehicle3dGroup.children[0]);
  }

  const camoBodyMat = new THREE.MeshStandardMaterial({ color: 0x3d4d31, roughness: 0.65, metalness: 0.25 });
  const camoAccentMat = new THREE.MeshStandardMaterial({ color: 0x2e3b25, roughness: 0.7, metalness: 0.2 });
  const darkSteelMat = new THREE.MeshStandardMaterial({ color: 0x1a2218, roughness: 0.5, metalness: 0.6 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x182c38, roughness: 0.2, metalness: 0.8 });
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x111417, roughness: 0.9, metalness: 0.05 });
  const rimMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.35, metalness: 0.7 });
  const headlightMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
  const taillightMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
  const saffronMat = new THREE.MeshBasicMaterial({ color: 0xff9933 });
  const whiteMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const greenMat = new THREE.MeshBasicMaterial({ color: 0x138808 });

  // Skid Pan
  const skidMesh = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.25, 1.3), darkSteelMat);
  skidMesh.position.y = -0.15;
  vehicle3dGroup.add(skidMesh);

  // Cabin
  const cabinMesh = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.7, 1.4), camoBodyMat);
  cabinMesh.position.set(0.05, 0.45, 0);
  vehicle3dGroup.add(cabinMesh);

  // Hood
  const hoodMesh = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.42, 1.35), camoBodyMat);
  hoodMesh.position.set(-1.05, 0.25, 0);
  hoodMesh.rotation.z = 0.08;
  vehicle3dGroup.add(hoodMesh);

  // Cargo Bay
  const cargoMesh = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.55, 1.35), camoAccentMat);
  cargoMesh.position.set(0.95, 0.35, 0);
  vehicle3dGroup.add(cargoMesh);

  // Bullbar
  const barMesh = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.45, 1.45), darkSteelMat);
  barMesh.position.set(-1.68, 0.1, 0);
  vehicle3dGroup.add(barMesh);

  // Headlights
  [-0.5, 0.5].forEach(z => {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.16), headlightMat);
    hl.position.set(-1.63, 0.28, z);
    vehicle3dGroup.add(hl);
  });

  // Roof Weapon Mount
  const cupolaMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.38, 0.18, 16), darkSteelMat);
  cupolaMesh.position.set(0.1, 0.88, 0);
  vehicle3dGroup.add(cupolaMesh);

  const gunBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.55, 12), darkSteelMat);
  gunBarrel.position.set(-0.45, 1.04, 0);
  gunBarrel.rotation.z = Math.PI / 2;
  vehicle3dGroup.add(gunBarrel);

  // 4 Wheels
  const wheelPositions = [
    { x: -0.95, y: -0.22, z: 0.8 },
    { x: -0.95, y: -0.22, z: -0.8 },
    { x: 0.95, y: -0.22, z: 0.8 },
    { x: 0.95, y: -0.22, z: -0.8 }
  ];

  wheelPositions.forEach(pos => {
    const wGroup = new THREE.Group();
    wGroup.position.set(pos.x, pos.y, pos.z);
    const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.28, 20), tireMat);
    tire.rotation.x = Math.PI / 2;
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.29, 14), rimMat);
    rim.rotation.x = Math.PI / 2;
    wGroup.add(tire, rim);
    vehicle3dGroup.add(wGroup);
  });

  // Spare Tire
  const spareGroup = new THREE.Group();
  spareGroup.position.set(1.42, 0.38, 0);
  const spareTire = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.22, 18), tireMat);
  spareTire.rotation.z = Math.PI / 2;
  spareGroup.add(spareTire);
  vehicle3dGroup.add(spareGroup);

  // Tricolor stripe
  [-0.72, 0.72].forEach(z => {
    const flagGroup = new THREE.Group();
    flagGroup.position.set(0.05, 0.45, z);
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.035, 0.01), saffronMat);
    s.position.y = 0.035;
    const w = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.035, 0.01), whiteMat);
    const g = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.035, 0.01), greenMat);
    g.position.y = -0.035;
    flagGroup.add(s, w, g);
    vehicle3dGroup.add(flagGroup);
  });

  hideLoader();
}

/**
 * CPU / Battery Optimized Animation Loop
 * Only renders when Home tab is visible
 */
function animate3dVehicle() {
  if (!is3dLoopActive) return;

  requestAnimationFrame(animate3dVehicle);

  if (window.currentTab !== 'home' && !is3dModalOpen) return;

  if (is3dRotating && vehicle3dGroup && !isMouseDown) {
    vehicle3dGroup.rotation.y += is3dModalOpen ? 0.007 : 0.009;
  }

  if (renderer3d && scene3d && camera3d) {
    renderer3d.render(scene3d, camera3d);
  }
}

let is3dModalOpen = false;

function expand3dVehicleModal() {
  const modal = document.getElementById('vehicle-3d-modal');
  const modalWrapper = document.getElementById('vehicle-3d-modal-wrapper');
  const canvas = document.getElementById('vehicle-3d-canvas');
  if (!modal || !modalWrapper || !canvas) return;

  is3dModalOpen = true;
  modal.classList.remove('hidden');

  // Reparent the existing active Three.js canvas into the full-frame modal container
  modalWrapper.appendChild(canvas);
  canvas.style.width = '100%';
  canvas.style.height = '100%';

  // Resize Three.js renderer and aspect ratio to full frame
  setTimeout(() => {
    const w = modalWrapper.clientWidth || window.innerWidth;
    const h = modalWrapper.clientHeight || window.innerHeight;
    if (camera3d && renderer3d) {
      camera3d.aspect = w / h;
      camera3d.position.set(3.4, 1.6, 3.5);
      camera3d.lookAt(0, 0.2, 0);
      camera3d.updateProjectionMatrix();
      renderer3d.setSize(w, h);
    }
    if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();
  }, 50);

  playBeep(1050, 0.06);
  if (window.showToast) {
    showToast('TACTICAL 3D INSPECTION', 'Full-frame vehicle viewport active. Press ESC to return.', 'info');
  }
}

function close3dVehicleModal() {
  const modal = document.getElementById('vehicle-3d-modal');
  const normalWrapper = document.getElementById('vehicle-3d-wrapper');
  const canvas = document.getElementById('vehicle-3d-canvas');
  if (!modal || !normalWrapper || !canvas) return;

  is3dModalOpen = false;
  modal.classList.add('hidden');

  // Reparent canvas back to Card 1 in normal dashboard
  normalWrapper.insertBefore(canvas, normalWrapper.firstChild);
  canvas.style.width = '100%';
  canvas.style.height = '100%';

  setTimeout(() => {
    const w = normalWrapper.clientWidth || 210;
    const h = normalWrapper.clientHeight || 185;
    if (camera3d && renderer3d) {
      camera3d.aspect = w / h;
      camera3d.position.set(2.7, 1.3, 2.8);
      camera3d.lookAt(0, 0.15, 0);
      camera3d.updateProjectionMatrix();
      renderer3d.setSize(w, h);
    }
  }, 50);

  playBeep(700, 0.05);
}

function reset3dCameraView() {
  if (!camera3d || !vehicle3dGroup) return;
  if (is3dModalOpen) {
    camera3d.position.set(3.4, 1.6, 3.5);
    camera3d.lookAt(0, 0.2, 0);
  } else {
    camera3d.position.set(2.7, 1.3, 2.8);
    camera3d.lookAt(0, 0.15, 0);
  }
  vehicle3dGroup.rotation.y = 0;
  playBeep(800, 0.04);
}

// Global ESC key listener to exit 3D inspection modal
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && is3dModalOpen) {
    close3dVehicleModal();
  }
});

function resume3dLoop() {
  if (!is3dLoopActive) {
    is3dLoopActive = true;
    requestAnimationFrame(animate3dVehicle);
  }
}

function pause3dLoop() {
  is3dLoopActive = false;
}

function toggle3dRotate(e) {
  if (e) e.stopPropagation();
  is3dRotating = !is3dRotating;
  const btn = document.getElementById('btn-3d-rotate');
  if (btn) {
    btn.className = is3dRotating
      ? 'px-1.5 py-0.5 rounded bg-slate-800/80 hover:bg-slate-700 text-[10px] text-cyan-400 font-mono border border-cyan-500/30 transition-colors'
      : 'px-1.5 py-0.5 rounded bg-slate-800/80 hover:bg-slate-700 text-[10px] text-slate-500 font-mono border border-slate-600/30 transition-colors';
  }
  const modalBtn = document.getElementById('btn-modal-rotate');
  if (modalBtn) {
    modalBtn.className = is3dRotating
      ? 'px-3 py-1.5 rounded-lg bg-cyan-950 text-cyan-300 font-mono text-xs border border-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.4)] flex items-center gap-1.5 transition-all'
      : 'px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 font-mono text-xs border border-slate-600 flex items-center gap-1.5 transition-all';
  }
  playBeep(is3dRotating ? 900 : 600, 0.04);
}

function toggle3dWireframe(e) {
  if (e) e.stopPropagation();
  isWireframeMode = !isWireframeMode;
  const btn = document.getElementById('btn-3d-wire');
  if (btn) {
    btn.className = isWireframeMode
      ? 'px-1.5 py-0.5 rounded bg-emerald-950/80 text-[10px] text-emerald-300 font-mono border border-emerald-400 shadow-[0_0_8px_rgba(0,230,118,0.4)] transition-colors'
      : 'px-1.5 py-0.5 rounded bg-slate-800/80 hover:bg-slate-700 text-[10px] text-emerald-400 font-mono border border-emerald-500/30 transition-colors';
  }
  const modalBtn = document.getElementById('btn-modal-wire');
  if (modalBtn) {
    modalBtn.className = isWireframeMode
      ? 'px-3 py-1.5 rounded-lg bg-emerald-950 text-emerald-300 font-mono text-xs border border-emerald-400 shadow-[0_0_8px_rgba(0,230,118,0.4)] flex items-center gap-1.5 transition-all'
      : 'px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-400 font-mono text-xs border border-emerald-500/40 flex items-center gap-1.5 transition-all';
  }
  if (vehicle3dGroup) {
    vehicle3dGroup.traverse(child => {
      if (child.isMesh && child.material) {
        child.material.wireframe = isWireframeMode;
      }
    });
  }
  playBeep(850, 0.04);
}

function resize3dCanvas() {
  if (is3dModalOpen) {
    const modalWrapper = document.getElementById('vehicle-3d-modal-wrapper');
    if (!modalWrapper || !renderer3d || !camera3d) return;
    const w = modalWrapper.clientWidth;
    const h = modalWrapper.clientHeight;
    camera3d.aspect = w / h;
    camera3d.updateProjectionMatrix();
    renderer3d.setSize(w, h);
    return;
  }
  const wrapper = document.getElementById('vehicle-3d-wrapper');
  if (!wrapper || !renderer3d || !camera3d) return;
  const w = wrapper.clientWidth;
  const h = wrapper.clientHeight;
  camera3d.aspect = w / h;
  camera3d.updateProjectionMatrix();
  renderer3d.setSize(w, h);
}

window.addEventListener('resize', resize3dCanvas);

// Global exports
window.init3dVehicleLazy = init3dVehicleLazy;
window.resume3dLoop = resume3dLoop;
window.pause3dLoop = pause3dLoop;
window.toggle3dRotate = toggle3dRotate;
window.toggle3dWireframe = toggle3dWireframe;
window.resize3dCanvas = resize3dCanvas;
window.parseAndDisplayGLB = parseAndDisplayGLB;
window.expand3dVehicleModal = expand3dVehicleModal;
window.close3dVehicleModal = close3dVehicleModal;
window.reset3dCameraView = reset3dCameraView;
