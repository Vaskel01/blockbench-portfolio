// Boots the forest camp: mounts React Three Fiber onto the page's existing <canvas> and wires the HTML
// controls (hotspots, sound, pause, reset, keyboard, dragging) to the shared camp state.
import { createRoot, extend } from '@react-three/fiber';
import * as THREE from 'three';
import { App } from './App.jsx';
import { createCampAudio } from './audio.js';
import { camp } from './camp.js';
import { BLOCK_TEXTURES } from './world.js';
// Minecraft 1.21.1 textures and Vaskel's skin, inlined as data URLs by the bundler (works from file://).
import chest from '../../assets/minecraft/entity/chest/normal.png';
import clouds from '../../assets/minecraft/environment/clouds.png';
import skin from '../../renders/vaskel-skin.png';

// createRoot (unlike <Canvas>) does not register three's classes as JSX elements by itself.
extend(THREE);

const $ = (selector) => document.querySelector(selector);
const world = $('#campWorld'), canvas = $('#campCanvas'), still = $('#campStill'), loading = $('#campLoading'), status = $('#campStatus'), tag = $('#makerTag');
const soundButton = $('#campSound'), motionButton = $('#campMotion'), resetButton = $('#campReset'), feature = $('#campFeature');
const hotspotButtons = [...document.querySelectorAll('[data-camp-action]')];
const reducedMotion = matchMedia('(prefers-reduced-motion:reduce)');
const mobile = matchMedia('(max-width:900px)').matches || (navigator.deviceMemory || 8) <= 4;

function fallback() {
  loading?.remove();
  canvas.hidden = true;
  still.hidden = false;
  tag.hidden = true;
  $('#campHotspots').hidden = true;
  [soundButton, motionButton, resetButton, $('#campGuide')].forEach((b) => (b.hidden = true));
  $('.camp-hint').textContent = 'Take a look around the workshop below.';
}

const webgl2 = () => {
  try {
    return !!document.createElement('canvas').getContext('webgl2');
  } catch {
    return false;
  }
};

// Block textures come from a bundled glob import, so any PNG in assets/minecraft/block is available by name.
const blockTexture = (name) => import(`../../assets/minecraft/block/${name}.png`).then((module) => module.default);
const loadImage = (src) => new Promise((resolve, reject) => {
  const image = new Image();
  image.onload = () => resolve(image);
  image.onerror = reject;
  image.src = src;
});
async function loadImages() {
  const names = [...BLOCK_TEXTURES, 'campfire_log', 'campfire_log_lit', 'campfire_fire'];
  const sources = [...(await Promise.all(names.map(async (name) => [name, await blockTexture(name)]))), ['chest', chest], ['clouds', clouds], ['skin', skin]];
  return Object.fromEntries(await Promise.all(sources.map(async ([name, src]) => [name, await loadImage(src)])));
}

async function boot() {
  if (!webgl2()) return fallback();
  let images;
  try {
    images = await loadImages();
  } catch {
    return fallback();
  }

  const abort = new AbortController();
  const on = (el, type, fn, options = {}) => el.addEventListener(type, fn, { ...options, signal: abort.signal });
  const audio = createCampAudio(soundButton);
  let three = null, inView = true, pageVisible = !document.hidden;
  const wake = () => three?.invalidate();

  // Messages appear as Minecraft chat: "<Vaskel> ..." lines that stack up, then fade like the in-game chat.
  // Messages with no speaker are shown as grey system lines.
  const describe = (message, speaker = 'Vaskel') => {
    const line = document.createElement('p');
    line.className = 'mc-line' + (speaker ? '' : ' mc-system');
    line.textContent = speaker ? `<${speaker}> ${message}` : message;
    status.append(line);
    audio.cue('chat');
    while (status.children.length > 4) status.firstElementChild.remove();
    const chatting = () => $('#camp').classList.toggle('chatting', status.children.length > 0);
    chatting();
    setTimeout(() => line.classList.add('fade'), 6000);
    setTimeout(() => {
      line.remove();
      chatting();
    }, 6700);
  };

  function action(kind) {
    if (kind === 'wave') {
      camp.waveAt = camp.clock;
      audio.cue('wave');
      describe('Hey there. Welcome to my little workshop.');
    } else if (kind === 'fire') {
      camp.fireAt = camp.clock;
      audio.cue('fire');
      describe('A few more sparks for the evening.');
    } else if (kind === 'chest') {
      camp.chestOpen = !camp.chestOpen;
      feature.hidden = !camp.chestOpen;
      audio.cue(camp.chestOpen ? 'chestOpen' : 'chestClose');
      describe(camp.chestOpen ? 'A peek at something from the workshop.' : 'Saved for the next adventure.');
    }
    wake();
  }

  function updateLoop() {
    const active = inView && pageVisible;
    audio.setActive(active);
    config.frameloop = !active ? 'never' : camp.moving ? 'always' : 'demand';
    three?.setFrameloop(config.frameloop);
    if (active) wake();
  }

  function setMotion(value) {
    camp.moving = value;
    motionButton.textContent = value ? 'Pause' : 'Resume';
    motionButton.setAttribute('aria-pressed', String(!value));
    motionButton.setAttribute('aria-label', value ? 'Pause ambient animations' : 'Resume ambient animations');
    updateLoop();
  }

  function reset() {
    camp.orbit.targetYaw = camp.orbit.targetPitch = 0;
    camp.turnTarget = 0;
    describe('View reset.', null);
    wake();
  }

  // Hotspot buttons and the maker tag follow their 3D anchors every frame.
  const anchor = new THREE.Vector3(), lift = new THREE.Vector3();
  function overlay(camera, size) {
    const project = (point) => {
      const p = point.project(camera);
      return { x: ((p.x + 1) * size.width) / 2, y: ((1 - p.y) * size.height) / 2, z: p.z };
    };
    const anchors = {
      wave: () => camp.refs.head.getWorldPosition(anchor).add(lift.set(0, 0.67, 0)),
      fire: () => anchor.copy(camp.refs.fire.position).add(lift.set(0, 1.75, 0)),
      chest: () => anchor.copy(camp.refs.chest.position).add(lift.set(0, 1.15, 0)),
    };
    for (const button of hotspotButtons) {
      const target = anchors[button.dataset.campAction];
      if (!target || !camp.refs.head) continue;
      const p = project(target());
      button.style.left = THREE.MathUtils.clamp(p.x, 18, size.width - 18) + 'px';
      button.style.top = p.y + 'px';
      button.hidden = p.z > 1 || p.x < -20 || p.x > size.width + 35 || p.y < 25 || p.y > size.height - 25;
    }
    if (camp.refs.head) {
      const p = project(camp.refs.head.localToWorld(anchor.set(0, 0.73, 0)));
      tag.style.left = p.x + 'px';
      tag.style.top = p.y - 11 + 'px';
    }
  }

  // R3F re-applies defaults for any option a later configure() call omits, so resizes pass the whole config.
  const root = createRoot(canvas);
  const measure = () => ({ width: world.clientWidth, height: world.clientHeight, top: 0, left: 0 });
  camp.moving = !reducedMotion.matches;
  const config = {
    gl: { antialias: false, alpha: false, stencil: false, powerPreference: 'high-performance' },
    dpr: [1, mobile ? 2 : 1.5],
    shadows: true,
    flat: true, // tone mapping happens once, in the post-processing stack
    frameloop: camp.moving ? 'always' : 'demand',
    camera: { fov: 36, near: 0.1, far: 140 },
    onCreated: (state) => {
      three = state;
      updateLoop();
    },
  };
  root.configure({ ...config, size: measure() });
  root.render(<App images={images} mobile={mobile} audio={audio} overlay={overlay} onFirstFrame={() => loading?.remove()} />);
  setMotion(camp.moving);

  // --- Pointer: click a prop to interact, drag Vaskel to turn him, drag anywhere else to look around.
  const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2();
  const drag = { id: null, startX: 0, startY: 0, lastX: 0, lastY: 0, moved: 0, kind: null };
  function hit(e) {
    if (!three) return null;
    const r = canvas.getBoundingClientRect();
    pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, (-(e.clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(pointer, three.camera);
    const pickables = ['wave', 'fire', 'chest'].map((k) => camp.refs[k]).filter(Boolean);
    const hits = raycaster.intersectObjects(pickables, true).filter((h) => h.object.isMesh);
    let object = hits[0]?.object;
    while (object && !object.userData.action) object = object.parent;
    return object?.userData.action || null;
  }
  on(canvas, 'pointerdown', (e) => {
    if (e.button !== 0 || drag.id !== null) return;
    audio.unlock();
    canvas.focus({ preventScroll: true });
    Object.assign(drag, { id: e.pointerId, startX: e.clientX, startY: e.clientY, lastX: e.clientX, lastY: e.clientY, moved: 0, kind: hit(e) });
    camp.dragging = drag.kind;
    canvas.setPointerCapture(e.pointerId);
    wake();
  });
  on(canvas, 'pointermove', (e) => {
    if (drag.id === null) {
      canvas.style.cursor = hit(e) ? 'pointer' : 'grab';
      return;
    }
    if (e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.lastX, dy = e.clientY - drag.lastY;
    drag.lastX = e.clientX;
    drag.lastY = e.clientY;
    drag.moved = Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY);
    if (drag.moved < 6) return;
    if (drag.kind === 'wave') camp.turnTarget = THREE.MathUtils.clamp(camp.turnTarget + dx * 0.012, -1.2, 1.2);
    else {
      camp.orbit.targetYaw = THREE.MathUtils.clamp(camp.orbit.targetYaw - dx * 0.003, -0.35, 0.35);
      camp.orbit.targetPitch = THREE.MathUtils.clamp(camp.orbit.targetPitch + dy * 0.002, -0.13, 0.18);
    }
    wake();
  });
  function release(e, cancel = false) {
    if (drag.id === null || e.pointerId !== drag.id) return;
    if (!cancel && drag.moved < 6 && drag.kind) action(drag.kind);
    if (canvas.hasPointerCapture(drag.id)) canvas.releasePointerCapture(drag.id);
    drag.id = null;
    camp.dragging = null;
    wake();
  }
  on(canvas, 'pointerup', (e) => release(e));
  on(canvas, 'pointercancel', (e) => release(e, true));
  on(canvas, 'lostpointercapture', (e) => drag.id !== null && release(e, true));

  // --- Keyboard alternatives (listed in the Camp guide).
  on(canvas, 'keydown', (e) => {
    if (e.repeat) return;
    const keys = { w: 'wave', f: 'fire', o: 'chest', ' ': 'wave', Enter: 'wave' };
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (keys[key]) {
      e.preventDefault();
      action(keys[key]);
    } else if (e.key.startsWith('Arrow')) {
      e.preventDefault();
      const o = camp.orbit;
      o.targetYaw = THREE.MathUtils.clamp(o.targetYaw + (e.key === 'ArrowLeft' ? -0.08 : e.key === 'ArrowRight' ? 0.08 : 0), -0.35, 0.35);
      o.targetPitch = THREE.MathUtils.clamp(o.targetPitch + (e.key === 'ArrowUp' ? -0.04 : e.key === 'ArrowDown' ? 0.04 : 0), -0.13, 0.18);
      wake();
    } else if (key === 'r') reset();
  });

  // --- HTML controls.
  on(soundButton, 'click', () => audio.toggle());
  on(motionButton, 'click', () => setMotion(!camp.moving));
  on(resetButton, 'click', reset);
  hotspotButtons.forEach((b) => on(b, 'click', () => action(b.dataset.campAction)));
  on(feature.querySelector('.feature-close'), 'click', () => {
    camp.chestOpen = false;
    feature.hidden = true;
    audio.cue('chestClose');
    wake();
  });
  on(feature.querySelector('[data-camp-pack]'), 'click', () => {
    feature.hidden = true;
    camp.chestOpen = false;
    audio.cue('chestClose');
    wake();
    window.goToPack?.('wushu');
  });
  on(reducedMotion, 'change', () => setMotion(!reducedMotion.matches));

  // --- Only render while the camp is on screen and the tab is visible.
  const observer = new IntersectionObserver(([entry]) => {
    inView = entry.isIntersecting;
    updateLoop();
  });
  observer.observe($('#camp'));
  on(document, 'visibilitychange', () => {
    pageVisible = !document.hidden;
    updateLoop();
  });
  const resizeObserver = new ResizeObserver(() => {
    if (world.clientWidth && world.clientHeight) root.configure({ ...config, size: measure() });
    wake();
  });
  resizeObserver.observe(world);

  function dispose() {
    abort.abort();
    observer.disconnect();
    resizeObserver.disconnect();
    audio.dispose();
    root.unmount();
  }
  on(window, 'pagehide', (e) => !e.persisted && dispose());
  on(canvas, 'webglcontextlost', (e) => {
    e.preventDefault();
    dispose();
    fallback();
  });
}

boot();
