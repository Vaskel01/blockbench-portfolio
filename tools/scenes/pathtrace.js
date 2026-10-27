// Path-traced finals for the portfolio scenes, on the GPU through three-gpu-pathtracer: real bounced light, soft sun
// shadows from a sky dome, emissive surfaces that light their surroundings, and a physical camera with depth of field.
// The traced frame is then composited with height fog (from a rasterised depth pass), bloom, the split-tone grade, a
// vignette and ACES tone mapping. Render tool only; nothing here ships with the site.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { PhysicalCamera, WebGLPathTracer } from 'three-gpu-pathtracer';
import { BlendFunction, BloomEffect, Effect, EffectAttribute, EffectComposer, EffectPass, RenderPass, ToneMappingEffect, ToneMappingMode, VignetteEffect } from 'postprocessing';
import { SplitToneEffect } from '../../camp/src/effects.jsx';

const nextPow2 = (n) => 2 ** Math.ceil(Math.log2(Math.max(1, n)));

// The path tracer samples every texture from one layered array at a single size, so the scene's many small pixel
// textures (block tiles, painted part faces, skins) are packed into one atlas and every UV is pointed at its patch.
// The atlas is sampled nearest-neighbour, so pixel art stays crisp right up to the lens.
export function atlasScene(scene) {
  const meshes = [];
  scene.traverse((o) => o.isMesh && o.visible && meshes.push(o));
  const listOf = (m) => (Array.isArray(m) ? m : [m]);
  const images = new Set();
  meshes.forEach((mesh) => listOf(mesh.material).forEach((m) => m.map?.image && images.add(m.map.image)));
  const sizeOf = (image) => [image.naturalWidth || image.width, image.naturalHeight || image.height];
  const area = [...images].reduce((sum, image) => sum + sizeOf(image)[0] * sizeOf(image)[1], 0);
  const width = Math.min(8192, Math.max(1024, nextPow2(Math.sqrt(area) * 1.15)));
  const at = new Map();
  let [x, y, row] = [0, 0, 0];
  for (const image of [...images].sort((a, b) => sizeOf(b)[1] - sizeOf(a)[1])) {
    const [w, h] = sizeOf(image);
    if (x + w > width) [x, y, row] = [0, y + row, 0];
    at.set(image, [x, y, w, h]);
    x += w;
    row = Math.max(row, h);
  }
  const height = nextPow2(y + row);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  for (const [image, [ox, oy]] of at) ctx.drawImage(image, ox, oy);
  const atlas = new THREE.CanvasTexture(canvas);
  atlas.colorSpace = THREE.SRGBColorSpace;
  atlas.magFilter = atlas.minFilter = THREE.NearestFilter;
  atlas.generateMipmaps = false;

  // Once every face samples the atlas, materials differ only in their settings, so identical ones are merged: a few
  // dozen materials instead of one per painted face.
  const swapped = new Map();
  const swap = (m) => {
    const emissive = m.emissive || new THREE.Color(0);
    const key = [!!m.map, m.color.getHex(), m.roughness ?? 0.9, m.metalness ?? 0, emissive.getHex(), m.emissiveIntensity ?? 0, !!m.emissiveMap,
      m.transparent, m.opacity, m.alphaTest, m.side].join('|');
    if (!swapped.has(key)) {
      swapped.set(key, new THREE.MeshStandardMaterial({
        map: m.map ? atlas : null, color: m.color, roughness: m.roughness ?? 0.9, metalness: m.metalness ?? 0,
        emissive, emissiveIntensity: m.emissiveIntensity ?? 0, emissiveMap: m.emissiveMap ? atlas : null,
        transparent: m.transparent, opacity: m.opacity, alphaTest: m.alphaTest, side: m.side,
      }));
    }
    return swapped.get(key);
  };
  const inset = 0.01;
  for (const mesh of meshes) {
    const geometry = mesh.geometry.clone();
    const uv = geometry.attributes.uv;
    const index = geometry.index;
    const materials = listOf(mesh.material);
    const groups = Array.isArray(mesh.material) && geometry.groups.length ? geometry.groups : [{ start: 0, count: index ? index.count : uv.count, materialIndex: 0 }];
    for (const g of groups) {
      const image = materials[g.materialIndex]?.map?.image;
      if (!image) continue;
      const [ox, oy, w, h] = at.get(image);
      const seen = new Set();
      for (let i = g.start; i < g.start + g.count; i++) {
        const vi = index ? index.getX(i) : i;
        if (seen.has(vi)) continue;
        seen.add(vi);
        const [u, v] = [uv.getX(vi), uv.getY(vi)];
        uv.setXY(vi, (ox + inset + u * (w - 2 * inset)) / width, 1 - (oy + inset + (1 - v) * (h - 2 * inset)) / height);
      }
    }
    uv.needsUpdate = true;
    // The tracer's scene merger indexes materials by mesh, so every mesh must end up with exactly one material and
    // no face groups. A painted part's six face materials usually merge into one here; where they genuinely differ,
    // the mesh is split by face group into child meshes.
    const swappedList = materials.map(swap);
    if (swappedList.every((m) => m === swappedList[0])) {
      geometry.clearGroups();
      mesh.geometry = geometry;
      mesh.material = swappedList[0];
      continue;
    }
    const parts = geometry.groups.map((g) => {
      const sub = new THREE.BufferGeometry();
      for (const key in geometry.attributes) sub.setAttribute(key, geometry.attributes[key]);
      sub.setIndex(Array.from({ length: g.count }, (_, i) => index.getX(g.start + i)));
      return new THREE.Mesh(sub, swappedList[g.materialIndex]);
    });
    mesh.geometry = parts[0].geometry;
    mesh.material = parts[0].material;
    parts.slice(1).forEach((p) => mesh.add(p));
  }
  // Finally bake everything sharing a material into one world-space mesh: the tracer gets a handful of meshes rather
  // than hundreds (past a few hundred its scene merge breaks down), and the originals are hidden.
  scene.updateMatrixWorld(true);
  const byMaterial = new Map();
  scene.traverseVisible((o) => {
    if (!o.isMesh) return;
    if (!byMaterial.has(o.material)) byMaterial.set(o.material, []);
    byMaterial.get(o.material).push(o);
  });
  for (const [material, group] of byMaterial) {
    const geometries = group.map((o) => {
      const g = new THREE.BufferGeometry();
      ['position', 'normal', 'uv'].forEach((key) => g.setAttribute(key, o.geometry.attributes[key].clone()));
      g.setIndex(o.geometry.index ? o.geometry.index.clone() : null);
      return g.applyMatrix4(o.matrixWorld);
    });
    group.forEach((o) => { o.visible = false; });
    scene.add(new THREE.Mesh(mergeGeometries(geometries), material));
  }
  return [width, height];
}

// The sky as an HDR equirect dome: a gradient by elevation (`dome`: [degrees, colour] from high to low) and a sun or
// moon disc with a soft halo. It is the background and lights the scene, so the sun casts soft shadows.
export function skyDome({ dome, sun }) {
  const [W, H] = [1024, 512];
  const data = new Float32Array(W * H * 4);
  const stops = dome.map(([deg, hex]) => [deg, new THREE.Color(hex)]);
  const sunDir = sun && new THREE.Vector3(...sun.dir).normalize();
  const sunColor = sun && new THREE.Color(sun.color);
  const c = new THREE.Color();
  const dir = new THREE.Vector3();
  for (let j = 0; j < H; j++) {
    const theta = ((j + 0.5) / H - 0.5) * Math.PI;
    const deg = THREE.MathUtils.radToDeg(theta);
    let k = stops.findIndex(([d]) => d <= deg);
    if (k <= 0) c.copy(stops[k === 0 ? 0 : stops.length - 1][1]);
    else c.copy(stops[k - 1][1]).lerp(stops[k][1], (stops[k - 1][0] - deg) / (stops[k - 1][0] - stops[k][0]));
    for (let i = 0; i < W; i++) {
      const phi = ((i + 0.5) / W - 0.5) * Math.PI * 2;
      dir.set(Math.cos(theta) * Math.cos(phi), Math.sin(theta), Math.cos(theta) * Math.sin(phi));
      let [r, g, b] = [c.r, c.g, c.b];
      if (sunDir) {
        const angle = Math.acos(Math.min(1, dir.dot(sunDir)));
        const disc = angle < sun.size ? sun.intensity : 0;
        const halo = sun.halo * Math.exp(-((angle / (sun.size * 6)) ** 2));
        r += sunColor.r * (disc + halo);
        g += sunColor.g * (disc + halo);
        b += sunColor.b * (disc + halo);
      }
      data.set([r, g, b, 1], (j * W + i) * 4);
    }
  }
  const texture = new THREE.DataTexture(data, W, H, THREE.RGBAFormat, THREE.FloatType);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.colorSpace = THREE.LinearSRGBColorSpace;
  texture.magFilter = texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

// The traced frame, scaled by exposure, replacing the rasterised colour. Now and then a light path comes back NaN or
// infinite and poisons that pixel's running average; such pixels take the average of their valid neighbours, and
// fireflies are clamped so one hot sample can't blow out the bloom.
class TracedEffect extends Effect {
  constructor(map, exposure, size) {
    super('TracedEffect', /* glsl */ `
      uniform sampler2D traced;
      uniform float exposure;
      uniform vec2 texel;
      vec3 fetch(const in vec2 at) {
        vec3 c = texture2D(traced, at).rgb;
        return any(isnan(c)) || any(isinf(c)) ? vec3(-1.0) : c;
      }
      void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
        vec3 c = fetch(uv);
        if (c.r < 0.0) {
          vec3 sum = vec3(0.0);
          float n = 0.0;
          for (int x = -1; x <= 1; x++) for (int y = -1; y <= 1; y++) {
            vec3 s = fetch(uv + vec2(x, y) * texel);
            if (s.r >= 0.0) { sum += s; n += 1.0; }
          }
          c = n > 0.0 ? sum / n : vec3(0.0);
        }
        outputColor = vec4(min(c, vec3(48.0)) * exposure, 1.0);
      }`, {
      blendFunction: BlendFunction.SET,
      uniforms: new Map([['traced', new THREE.Uniform(map)], ['exposure', new THREE.Uniform(exposure)], ['texel', new THREE.Uniform(new THREE.Vector2(1 / size.x, 1 / size.y))]]),
    });
  }
}

// Height fog along each view ray, brighter toward the sun or moon, from the rasterised depth.
class FogEffect extends Effect {
  constructor(camera, { color, glow = color, sun = [0, 1, 0], density = 0.02, falloff = 0.08, base = 0, start = 4, power = 6, max = 0.92 }) {
    super('FogEffect', /* glsl */ `
      uniform vec3 fogColor;
      uniform vec3 glowColor;
      uniform vec3 sunDir;
      uniform float density;
      uniform float falloff;
      uniform float baseY;
      uniform float startDist;
      uniform float glowPower;
      uniform float maxFog;
      uniform vec2 tanHalf;
      uniform mat4 camWorld;
      void mainImage(const in vec4 inputColor, const in vec2 uv, const in float depth, out vec4 outputColor) {
        if (depth >= 0.99999) { outputColor = inputColor; return; }
        float viewZ = getViewZ(depth);
        vec3 viewPos = vec3((uv * 2.0 - 1.0) * tanHalf * -viewZ, viewZ);
        vec3 world = (camWorld * vec4(viewPos, 1.0)).xyz;
        vec3 eye = (camWorld * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        vec3 ray = normalize(world - eye);
        float dist = max(length(viewPos) - startDist, 0.0);
        float h = eye.y - baseY;
        float dy = world.y - eye.y;
        float amount = density * exp(-falloff * max(h, 0.0)) * dist;
        if (abs(dy) > 0.01) amount *= (1.0 - exp(-falloff * dy)) / (falloff * dy);
        float f = clamp(1.0 - exp(-amount), 0.0, maxFog);
        float glow = pow(max(dot(ray, sunDir), 0.0), glowPower);
        outputColor = vec4(mix(inputColor.rgb, mix(fogColor, glowColor, glow), f), inputColor.a);
      }`, {
      attributes: EffectAttribute.DEPTH,
      uniforms: new Map([
        ['fogColor', new THREE.Uniform(new THREE.Color(color))], ['glowColor', new THREE.Uniform(new THREE.Color(glow))],
        ['sunDir', new THREE.Uniform(new THREE.Vector3(...sun).normalize())], ['density', new THREE.Uniform(density)],
        ['falloff', new THREE.Uniform(falloff)], ['baseY', new THREE.Uniform(base)], ['startDist', new THREE.Uniform(start)],
        ['glowPower', new THREE.Uniform(power)], ['maxFog', new THREE.Uniform(max)],
        ['tanHalf', new THREE.Uniform(new THREE.Vector2(Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect, Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))))],
        ['camWorld', new THREE.Uniform(camera.matrixWorld.clone())],
      ]),
    });
  }
}

// Traces the scene to `samples` samples per pixel, then composites it into the canvas. `look` holds the dof (focus
// distance and f-stop), exposure, fog, bloom, tone (split-tone grade) and vignette settings.
export function renderTraced(gl, scene, camera, { samples = 256, bounces = 6, look = {} }) {
  const cam = new PhysicalCamera(camera.fov, camera.aspect, camera.near, camera.far);
  cam.position.copy(camera.position);
  cam.quaternion.copy(camera.quaternion);
  cam.fStop = look.dof?.fStop ?? 16;
  cam.focusDistance = look.dof?.focus ?? 10;
  cam.apertureBlades = 6;
  cam.updateProjectionMatrix();
  cam.updateMatrixWorld();

  const [aw, ah] = atlasScene(scene);
  const tracer = new WebGLPathTracer(gl);
  const arrayTexture = tracer._pathTracer.material.textures;
  arrayTexture.minFilter = arrayTexture.magFilter = THREE.NearestFilter;
  tracer.textureSize.set(aw, ah);
  // Small tiles, one per task, so no single GPU draw runs long enough for Windows to reset the driver.
  tracer.tiles.set(4, 4);
  tracer.bounces = bounces;
  tracer.filterGlossyFactor = 0.5;
  Object.assign(tracer, { renderDelay: 0, minSamples: 0, fadeDuration: 0, renderToCanvas: false, rasterizeScene: false, dynamicLowRes: false });
  tracer.setScene(scene, cam);

  return new Promise((resolve, reject) => {
    gl.domElement.addEventListener('webglcontextlost', () => reject(new Error(`GPU context lost after ${tracer.samples} samples`)), { once: true });
    const pixel = new Float32Array(4);
    let calls = 0;
    const step = () => {
      tracer.renderSample();
      // Read one pixel back after every full sample: it waits for the GPU to drain, so draw calls never pile up
      // into one long batch that Windows would kill.
      if (++calls % (tracer.tiles.x * tracer.tiles.y) === 0) gl.readRenderTargetPixels(tracer.target, 0, 0, 1, 1, pixel);
      if (tracer.samples < samples) {
        setTimeout(step, 0);
        return;
      }
      const size = gl.getDrawingBufferSize(new THREE.Vector2());
      const composer = new EffectComposer(gl, { frameBufferType: THREE.HalfFloatType, multisampling: 0 });
      composer.addPass(new RenderPass(scene, cam));
      composer.addPass(new EffectPass(cam, new TracedEffect(tracer.target.texture, look.exposure ?? 1, size)));
      const effects = [];
      if (look.fog) effects.push(new FogEffect(cam, look.fog));
      if (look.bloom) effects.push(new BloomEffect({ mipmapBlur: true, ...look.bloom }));
      effects.push(new SplitToneEffect(look.tone));
      if (look.vignette) effects.push(new VignetteEffect(look.vignette));
      effects.push(new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC }));
      composer.addPass(new EffectPass(cam, ...effects));
      composer.setSize(size.x / gl.getPixelRatio(), size.y / gl.getPixelRatio(), true);
      composer.render();
      resolve();
    };
    step();
  });
}
