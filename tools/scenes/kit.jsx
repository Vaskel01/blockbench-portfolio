// Shared kit for the staged renders: the store teaser (workshop.jsx) and the portfolio scenes. Hand-painted voxel
// parts in the style of Vaskel's packs, painted player skins on a posable figure, the post-processing grade, and the
// capture that hands a finished WebP (or a Blockbench project) back to tools/render-scene.mjs. None of this ships
// with the site.
import { Canvas, useThree } from '@react-three/fiber';
import { Bloom, EffectComposer, N8AO, ToneMapping, Vignette } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import { createRoot } from 'react-dom/client';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { SplitToneEffect } from '../../camp/src/effects.jsx';
import { PX, entityBox, pixelTexture } from '../../camp/src/minecraft.js';
import { exportBBModel } from './bbmodel.js';
import { renderTraced, skyDome } from './pathtrace.js';

export { PX, pixelTexture };

// Five-step colour ramps, darkest (outline) to brightest (edge highlight), in the saturated, hand-picked style of
// Vaskel's own packs rather than vanilla's noisy block textures. Scenes add their own with Object.assign(RAMPS, ...).
export const RAMPS = {
  wood: ['#2c1912', '#683c27', '#7b4a2f', '#8e5937', '#c48a59'],
  lightWood: ['#5a3a1e', '#b07c45', '#c8955a', '#d6a56a', '#f6d8a0'],
  handle: ['#1b1220', '#33223a', '#4a3253', '#62466e', '#82658f'],
  gold: ['#6b3a12', '#b8651c', '#e89a2c', '#f8c24a', '#fff0a0'],
  metal: ['#2b3140', '#5a6478', '#8b96ab', '#bcc6d8', '#eef3fb'],
  iron: ['#1d212b', '#363d4d', '#4f586b', '#6c778c', '#9aa6bb'],
  canvas: ['#7a6a55', '#b8a88c', '#d9cbb0', '#eee3cc', '#fffaf0'],
  bristle: ['#5a3a1e', '#8a6a42', '#b8925c', '#d8b884', '#f2dcae'],
  gem: ['#0a3a4a', '#0f7a8a', '#1fc0d0', '#7af0f0', '#e0ffff'],
  red: ['#5a0f1a', '#a3202a', '#e0383a', '#ff6a5a', '#ffb0a0'],
  blue: ['#0f1f5a', '#1f48b0', '#2f7ae8', '#5aaaff', '#b0dcff'],
  yellow: ['#7a4a0a', '#c88a10', '#f0c020', '#ffe060', '#fff6b0'],
  lime: ['#1f4a0f', '#3f8a1a', '#62c02a', '#9ae84a', '#d8ffa0'],
  purple: ['#2a0f4a', '#5a1f9a', '#8a3ad8', '#b86aff', '#e4c0ff'],
  white: ['#6a7080', '#b0b6c4', '#e2e6ee', '#f5f7fa', '#ffffff'],
};

export const load = (src) => new Promise((resolve, reject) => {
  const image = new Image();
  image.onload = () => resolve(image);
  image.onerror = reject;
  image.src = src;
});

// Seeded random streams, so every render paints and scatters things the same way.
export function seeded(seed) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}
const random = seeded(11);
const pick = (n) => Math.floor(random() * n);

// Texels per model pixel on the props: twice the skin's density, so each face has room for painted detail.
export const D = 2;

const rgbCache = new Map();
function rgb(hex) {
  if (!rgbCache.has(hex)) rgbCache.set(hex, [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)));
  return rgbCache.get(hex);
}

// A pixel canvas painted texel by texel into an ImageData buffer; flush() writes it out and returns the canvas.
// Untouched texels stay clear; `alpha` paints a translucent one (glass).
export function pixelCanvas(w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(w, h);
  const put = (x, y, color, alpha = 255) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const [r, g, b] = rgb(color);
    const i = (y * w + x) * 4;
    image.data[i] = r;
    image.data[i + 1] = g;
    image.data[i + 2] = b;
    image.data[i + 3] = alpha;
  };
  const flush = () => {
    ctx.putImageData(image, 0, 0);
    return canvas;
  };
  return { canvas, put, flush };
}

export function pixelMap(canvas) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  return texture;
}

// Paints one box face: lit from above (highlight row, mid body dithered into a darker foot), edged with the ramp's
// outline colour, then the look's detail. Wood gets grain streaks and knots; metal gets a shine stripe, pressed
// ridges, rivets and scratches; canvas gets a weave; bristles get strands; paint gets a glint and a swirl; anything
// can carry specks of spattered paint. Building surfaces get bricks, tiles, planks, roof-tile ribs, concrete noise,
// cracks, rain stains and rows of windows.
function faceTexture(fw, fh, ramp, kind, look) {
  // `res` scales the texel density down for distant scenery that would only waste texels.
  const density = D * (look.res || 1);
  const [w, h] = [Math.max(1, Math.round(fw * density)), Math.max(1, Math.round(fh * density))];
  const { put, flush } = pixelCanvas(w, h);
  const edge = w > 2 && h > 2 && look.edge !== false;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let tone;
      if (kind === 'top') tone = edge && (y === 0 || x === 0) ? 4 : edge && (y === h - 1 || x === w - 1) ? 2 : 3;
      else if (kind === 'bottom') tone = 1;
      else {
        const t = h < 3 ? 0 : y / (h - 1);
        tone = t < 0.6 ? 2 : look.grain && t < 0.8 ? ((x + y) % 2 ? 2 : 1) : 1;
        if (edge) tone = y === 0 ? 4 : y === h - 1 ? 0 : x === 0 || x === w - 1 ? 1 : tone;
      }
      put(x, y, ramp[tone]);
    }
  }
  const inner = (x, y) => !edge || (x > 0 && y > 0 && x < w - 1 && y < h - 1);
  const dot = (x, y, color) => inner(x, y) && put(x, y, color);
  const along = h > w;
  if (look.grain) {
    for (let n = Math.ceil((w * h) / 9); n > 0; n--) {
      const length = 2 + pick(5);
      let [x, y] = [pick(w), pick(h)];
      const color = ramp[random() < 0.65 ? 1 : 3];
      for (let i = 0; i < length; i++, along ? y++ : x++) dot(x, y, color);
    }
    if (look.knots && w * h > 80) {
      const [x, y] = [2 + pick(w - 4), 2 + pick(h - 4)];
      [[0, -1], [-1, 0], [1, 0], [0, 1], [1, 1], [-1, 1]].forEach(([dx, dy]) => dot(x + dx, y + dy, ramp[1]));
      dot(x, y, ramp[0]);
      dot(x - 1, y - 1, ramp[3]);
    }
  }
  if (look.shine && kind === 'side' && w > 4) {
    const x = Math.max(1, Math.floor(w * 0.22));
    for (let y = 1; y < h - 1; y++) {
      dot(x, y, ramp[y < h / 2 ? 4 : 3]);
      dot(x + 1, y, ramp[3]);
    }
  }
  if (look.ridges && kind === 'side' && h > 8) {
    [0.3, 0.68].forEach((t) => {
      const y = Math.round(h * t);
      for (let x = 1; x < w - 1; x++) {
        dot(x, y, ramp[3]);
        dot(x, y + 1, ramp[1]);
      }
    });
  }
  if (look.rivets && kind === 'side' && w > 6 && h > 6) {
    [[2, 2], [w - 3, 2], [2, h - 4], [w - 3, h - 4]].forEach(([x, y]) => {
      dot(x, y, ramp[4]);
      dot(x, y + 1, ramp[0]);
    });
  }
  if (look.scratches && w * h > 40) {
    for (let n = 2 + pick(2); n > 0; n--) {
      const [x, y] = [2 + pick(w - 4), 2 + pick(h - 4)];
      dot(x, y, ramp[3]);
      dot(x + 1, y + 1, ramp[3]);
      dot(x + 2, y + 1, ramp[1]);
    }
  }
  if (look.weave) {
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) if ((x + y * 2) % 4 === 0) dot(x, y, ramp[kind === 'top' ? 2 : 3]);
  }
  if (look.bristle) {
    for (let x = 0; x < w; x += 2) for (let y = 1; y < h - 1; y++) dot(x, y, ramp[3]);
  }
  if (look.gloss && kind === 'top' && w > 3) {
    for (let x = 1; x < w - 1; x++) { dot(x, 1, ramp[1]); dot(x, h - 2, ramp[3]); }
    const [gx, gy] = [Math.floor(w * 0.28), Math.floor(h * 0.3)];
    [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [0, 2]].forEach(([dx, dy]) => dot(gx + dx, gy + dy, ramp[4]));
    if (w > 8) for (let i = 0; i < Math.floor(w / 2); i++) dot(Math.floor(w * 0.45) + i, Math.floor(h * 0.62) + Math.round(Math.sin(i * 0.9)), ramp[1]);
  }
  if (look.spatter && kind !== 'bottom') {
    const paint = RAMPS[look.spatter];
    for (let n = Math.ceil((w * h) / 70); n > 0; n--) {
      const [x, y] = [1 + pick(w - 2), 1 + pick(Math.max(1, Math.floor(h * 0.6)))];
      dot(x, y, paint[2]);
      if (random() < 0.5) dot(x + 1, y, paint[3]);
      if (random() < 0.3) dot(x, y + 1, paint[1]);
    }
  }
  // Masonry: running-bond bricks or square flagstones, each unit its own tone with a lit top edge and a mortar line.
  const units = (uw, uh, bond, mortar) => {
    for (let y = 0, row = 0; y < h; y += uh, row++) {
      const shift = bond && row % 2 ? Math.floor(uw / 2) : 0;
      for (let x = -shift; x < w; x += uw) {
        const tone = random() < 0.3 ? 3 : random() < 0.35 ? 1 : 2;
        for (let j = 0; j < uh; j++) {
          for (let i = 0; i < uw; i++) {
            const line = i === uw - 1 || j === uh - 1;
            put(x + i, y + j, line ? mortar : j === 0 || i === 0 ? ramp[Math.min(4, tone + 1)] : ramp[tone]);
          }
        }
        if (uw > 5 && uh > 4 && random() < 0.35) put(x + 1 + pick(uw - 3), y + 1 + pick(uh - 3), ramp[Math.max(0, tone - 1)]);
      }
    }
  };
  if (look.bricks && kind !== 'bottom') units(look.bricks[0], look.bricks[1], true, look.mortar || ramp[0]);
  if (look.tiles && kind !== 'bottom') units(look.tiles, look.tiles, false, look.mortar || ramp[1]);
  if (look.planks && kind !== 'bottom') {
    const size = look.planks;
    for (let y = 0; y < h; y += size) {
      const tone = 2 + (random() < 0.4 ? 1 : 0) - (random() < 0.3 ? 1 : 0);
      for (let j = 0; j < size; j++) for (let x = 0; x < w; x++) put(x, y + j, j === size - 1 ? ramp[0] : j === 0 ? ramp[tone + 1] : ramp[tone]);
      for (let n = Math.ceil(w / 6); n > 0; n--) {
        const [x0, y0, length] = [pick(w), y + 1 + pick(Math.max(1, size - 2)), 3 + pick(6)];
        for (let i = 0; i < length; i++) put(x0 + i, y0, ramp[Math.max(0, tone - 1)]);
      }
      if (random() < 0.5) {
        const x = pick(w);
        for (let j = 0; j < size - 1; j++) put(x, y + j, ramp[0]);
      }
    }
  }
  // Glazed roof tiles: rounded ribs running down the slope, broken into overlapping courses.
  if (look.ribs && kind !== 'bottom') {
    const [spacing, course] = look.ribs;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = x % spacing;
        const j = y % course;
        let tone = i === 0 ? 3 : i === spacing - 1 ? 1 : 2;
        if (j === course - 1) tone = 0;
        else if (j === 0 && i < spacing - 1) tone = 4;
        put(x, y, ramp[tone]);
      }
    }
  }
  if (look.noise) {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (random() < look.noise) dot(x, y, ramp[random() < 0.6 ? 1 : 3]);
  }
  if (look.stains && kind === 'side') {
    for (let n = Math.ceil(w / 10); n > 0; n--) {
      const [x, length] = [pick(w), Math.floor(h * (0.15 + random() * 0.4))];
      for (let y = 1; y < length; y++) if (y % 3 !== 2) dot(x, y, ramp[1]);
    }
  }
  if (look.cracks) {
    for (let n = look.cracks; n > 0; n--) {
      let [x, y] = [pick(w), pick(h)];
      for (let i = 6 + pick(10); i > 0; i--) {
        dot(x, y, ramp[0]);
        x += pick(3) - 1;
        y += random() < 0.5 ? 1 : 0;
      }
    }
  }
  // Lattice screens: a grid of lit bars over dark gaps.
  if (look.lattice && kind === 'side') {
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const [i, j] = [x % look.lattice, y % look.lattice];
        put(x, y, i === 0 || j === 0 ? ramp[i === 0 && j === 0 ? 4 : 3] : i === 1 || j === 1 ? ramp[1] : ramp[0]);
      }
    }
  }
  // A painted motif repeated along the face: small diamonds in the ramp's lights over its base.
  if (look.motif && kind === 'side') {
    const step = look.motif;
    const cy = Math.floor(h / 2);
    for (let cx = Math.floor(step / 2); cx < w; cx += step) {
      [[0, 0, 4], [-1, 0, 3], [1, 0, 3], [0, -1, 3], [0, 1, 3], [-2, 0, 1], [2, 0, 1], [0, -2, 1], [0, 2, 1]].forEach(([dx, dy, tone]) => dot(cx + dx, cy + dy, ramp[tone]));
    }
  }
  // Windows: a grid of frames with dark glass; some panes catch the light or are lit from inside.
  if (look.windows && kind === 'side') {
    const { cols, rows, glass, lit = 0, light = glass[3], frame = ramp[0] } = look.windows;
    const [cw, ch] = [Math.floor(w / cols), Math.floor(h / rows)];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const [x0, y0] = [c * cw + Math.ceil(cw * 0.25), r * ch + Math.ceil(ch * 0.2)];
        const [ww, wh] = [Math.max(2, Math.floor(cw * 0.5)), Math.max(2, Math.floor(ch * 0.55))];
        const on = random() < lit;
        for (let j = -1; j <= wh; j++) {
          for (let i = -1; i <= ww; i++) {
            const border = i < 0 || j < 0 || i === ww || j === wh;
            put(x0 + i, y0 + j, border ? frame : on ? light : j === 0 || i === ww - 1 - j ? glass[2] : glass[1]);
          }
        }
        if (!on && ww > 3) put(x0 + 1, y0 + 1, glass[3]);
      }
    }
  }
  return pixelMap(flush());
}

// One hand-painted box, sized in model pixels. `faces` swaps in a ready material for a face (+x, -x, +y, -y, +z, -z).
// `ramp` is a RAMPS name or a five-colour array; `glow` makes the paint emissive (lanterns, lamps, spirits),
// `opacity` below 1 makes it translucent, and `fog={false}` keeps sky objects (suns, moons) clear of the haze.
export function Part({ size: [w, h, d], ramp, look = {}, faces = {}, glow = 0, opacity = 1, fog = true, ...props }) {
  const [geometry, material] = useMemo(() => {
    const colors = typeof ramp === 'string' ? RAMPS[ramp] : ramp;
    const dims = [[d, h, 'side'], [d, h, 'side'], [w, d, 'top'], [w, d, 'bottom'], [w, h, 'side'], [w, h, 'side']];
    const materials = dims.map(([fw, fh, kind], i) => {
      if (faces[i]) return faces[i];
      const map = faceTexture(fw, fh, colors, kind, look);
      const material = new THREE.MeshStandardMaterial({ map, roughness: look.gloss ? 0.35 : 0.85, metalness: look.shine ? 0.2 : 0 });
      if (glow) Object.assign(material, { emissiveMap: map, emissive: new THREE.Color('#ffffff'), emissiveIntensity: glow });
      if (opacity < 1) Object.assign(material, { transparent: true, opacity, depthWrite: false });
      if (!fog) material.fog = false;
      return material;
    });
    return [new THREE.BoxGeometry(w * PX, h * PX, d * PX), materials];
  }, []);
  const name = typeof ramp === 'string' ? ramp : 'part';
  return <mesh geometry={geometry} material={material} userData={{ name }} castShadow={opacity === 1} receiveShadow {...props} />;
}

// Paint as a flat, cut-out decal laid over a surface: 'drips' is a film along the top edge with runs of paint
// hanging from it, each ending in a rounded bead; 'splotch' is an irregular smear with a wet highlight; 'film' is
// solid paint; 'disc' is a round pixel-art body (a moon), lit from the upper left and pocked with craters.
function decalTexture(w, h, ramp, shape) {
  const { put, flush } = pixelCanvas(w, h);
  if (shape === 'film') {
    for (let x = 0; x < w; x++) for (let y = 0; y < h; y++) put(x, y, ramp[y === 0 ? 3 : 2]);
  } else if (shape === 'drips') {
    for (let x = 0; x < w; x++) { put(x, 0, ramp[2]); put(x, 1, ramp[1]); }
    for (let x = 0; x < w;) {
      const width = 1 + pick(3);
      const length = random() < 0.3 ? 0 : Math.floor(h * (0.25 + random() * 0.75)) - 2;
      for (let i = 0; i < width; i++) {
        for (let y = 2; y < length; y++) put(x + i, y, ramp[i === 0 ? 3 : i === width - 1 ? 1 : 2]);
      }
      if (length > 3) {
        for (let i = -1; i <= width; i++) put(x + i, length, ramp[i < 1 ? 3 : 2]);
        for (let i = 0; i < width; i++) put(x + i, length + 1, ramp[1]);
      }
      x += width + 1 + pick(2);
    }
  } else if (shape === 'disc') {
    const [cx, cy, r] = [w / 2, h / 2, Math.min(w, h) / 2 - 0.5];
    const craters = Array.from({ length: 9 }, () => [cx + (random() - 0.5) * r * 1.3, cy + (random() - 0.5) * r * 1.3, r * (0.06 + random() * 0.13)]);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const [dx, dy] = [x + 0.5 - cx, y + 0.5 - cy];
        const d = Math.hypot(dx, dy);
        if (d > r) continue;
        const light = -(dx + dy) / (r * 2.8);
        let tone = d > r - 1.2 ? 2 : light > 0.18 ? 4 : light > -0.12 ? 3 : 2;
        const crater = craters.find(([kx, ky, kr]) => Math.hypot(x + 0.5 - kx, y + 0.5 - ky) < kr);
        if (crater) tone = Math.hypot(x - 0.5 - crater[0], y - 0.5 - crater[1]) > crater[2] ? 3 : 1;
        put(x, y, ramp[tone]);
      }
    }
  } else {
    const blobs = Array.from({ length: 6 }, (_, i) => [w * (0.2 + random() * 0.6), h * (0.2 + random() * 0.6), Math.min(w, h) * (i ? 0.12 + random() * 0.16 : 0.3)]);
    const inside = (x, y) => blobs.some(([cx, cy, r]) => (x - cx) ** 2 + (y - cy) ** 2 < r * r);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (!inside(x + 0.5, y + 0.5)) continue;
        const rim = !inside(x + 1.5, y + 0.5) || !inside(x + 0.5, y + 1.5);
        const lit = !inside(x - 0.5, y + 0.5) || !inside(x + 0.5, y - 0.5);
        put(x, y, ramp[rim ? 1 : lit ? 3 : 2]);
      }
    }
    const [cx, cy] = blobs[0];
    put(Math.floor(cx) - 1, Math.floor(cy) - 1, ramp[4]);
  }
  return pixelMap(flush());
}

// A decal plane sized in model pixels, facing +z of its own frame. `res` scales its texel density down, and
// `fog={false}` keeps a sky body clear of the haze.
export function Decal({ size: [w, h], ramp, shape, glow = 0, res = 1, fog = true, roughness = 0.35, ...props }) {
  const material = useMemo(() => {
    const map = decalTexture(Math.max(1, Math.round(w * D * res)), Math.max(1, Math.round(h * D * res)), typeof ramp === 'string' ? RAMPS[ramp] : ramp, shape);
    const material = new THREE.MeshStandardMaterial({ map, alphaTest: 0.5, roughness, polygonOffset: true, polygonOffsetFactor: -2 });
    if (glow) Object.assign(material, { emissiveMap: map, emissive: new THREE.Color('#ffffff'), emissiveIntensity: glow, side: THREE.DoubleSide });
    if (!fog) material.fog = false;
    return material;
  }, []);
  const plane = useMemo(() => new THREE.PlaneGeometry(w * PX, h * PX), []);
  return <mesh geometry={plane} material={material} userData={{ name: `paint_${typeof ramp === 'string' ? ramp : 'part'}` }} receiveShadow {...props} />;
}

// Shorthand for positions in model pixels.
export const px = (...v) => v.map((n) => n * PX);

// Paints a 64×64 player skin in the vanilla layout. `draw` gets the canvas painter and every body part's face
// rectangles ([x, y, w, h] for top, bottom, right, front, left, back); `shade` fills a rectangle lit from above.
export function paintSkin(draw) {
  const { put, flush } = pixelCanvas(64, 64);
  const box = (u, v, w, h, d) => ({
    top: [u + d, v, w, d], bottom: [u + d + w, v, w, d], right: [u, v + d, d, h],
    front: [u + d, v + d, w, h], left: [u + d + w, v + d, d, h], back: [u + 2 * d + w, v + d, w, h],
  });
  const parts = {
    head: box(0, 0, 8, 8, 8), hat: box(32, 0, 8, 8, 8),
    body: box(16, 16, 8, 12, 4), jacket: box(16, 32, 8, 12, 4),
    rightArm: box(40, 16, 4, 12, 4), rightSleeve: box(40, 32, 4, 12, 4),
    leftArm: box(32, 48, 4, 12, 4), leftSleeve: box(48, 48, 4, 12, 4),
    rightLeg: box(0, 16, 4, 12, 4), rightPants: box(0, 32, 4, 12, 4),
    leftLeg: box(16, 48, 4, 12, 4), leftPants: box(0, 48, 4, 12, 4),
  };
  const sides = ['top', 'bottom', 'right', 'front', 'left', 'back'];
  // Fill rows y0..y1 (inclusive, relative to each face's top) of every side face of a part.
  const band = (part, y0, y1, ramp, faces = ['right', 'front', 'left', 'back']) => faces.forEach((f) => {
    const [x, y, w, h] = parts[part][f];
    for (let j = Math.max(0, y0); j <= Math.min(h - 1, y1); j++) {
      for (let i = 0; i < w; i++) put(x + i, y + j, ramp[j === y0 && y0 === 0 ? 3 : j === h - 1 ? 1 : 2]);
    }
  });
  const cap = (part, face, ramp) => {
    const [x, y, w, h] = parts[part][face];
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) put(x + i, y + j, ramp[face === 'top' ? (i === 0 || j === 0 ? 3 : 2) : 1]);
  };
  const dotAt = (part, face, i, j, color) => {
    const [x, y] = parts[part][face];
    put(x + i, y + j, color);
  };
  draw({ put, parts, sides, band, cap, dot: dotAt });
  return flush();
}

// The usual person: skin, hair with a fringe, eyes and mouth, a top with sleeves, trousers with a belt line and
// shoes. `face` sets the expression (brows: calm, fierce or raised; mouth: line, grin, shout or smirk), `hairLayer`
// repeats the hair on the skin's second layer so it stands proud of the head, and `extra` paints anything on top
// (sashes, scarves, straps, emblems).
export function paintPerson({ skin, hair, eyes = '#2b2f3a', top, sleeves = 12, bottom, shoes, belt, fringe = 2, longHair = 0, face = {}, hairLayer = false, extra }) {
  return paintSkin((p) => {
    const { band, cap, dot } = p;
    band('head', 0, 7, skin);
    cap('head', 'bottom', skin);
    // Hair: the crown, a fringe across the brow, the sides above the ears and the back.
    cap('head', 'top', hair);
    band('head', 0, fringe - 1, hair, ['front']);
    band('head', 0, 3 + longHair, hair, ['right', 'left']);
    band('head', 0, 6 + Math.min(1, longHair), hair, ['back']);
    for (let i = 0; i < 8; i += 3) dot('head', 'front', i, fringe, hair[1]);
    if (hairLayer) {
      cap('hat', 'top', hair);
      band('hat', 0, Math.max(0, fringe - 1), hair, ['front']);
      [0, 2, 5, 7].forEach((i) => dot('hat', 'front', i, fringe, hair[1]));
      band('hat', 0, 2 + longHair, hair, ['right', 'left']);
      band('hat', 0, 5 + longHair, hair, ['back']);
    }
    // Face: two-tone eyes with a lit corner, brows, a nose shadow and the mouth.
    [[1, eyes], [2, '#ffffff'], [5, '#ffffff'], [6, eyes]].forEach(([i, color]) => dot('head', 'front', i, 4, color));
    const brows = { calm: [[1, 3], [2, 3], [5, 3], [6, 3]], fierce: [[1, 2], [2, 3], [5, 3], [6, 2]], raised: [[1, 2], [2, 2], [5, 2], [6, 2]] }[face.brows || 'calm'];
    brows.forEach(([i, j]) => dot('head', 'front', i, j, face.brows ? hair[1] : skin[1]));
    dot('head', 'front', 3, 5, skin[1]);
    const mouths = {
      line: [[3, 6, skin[0]], [4, 6, skin[0]]],
      grin: [[2, 6, skin[0]], [3, 6, '#f4f0ea'], [4, 6, '#f4f0ea'], [5, 6, skin[0]]],
      shout: [[2, 6, '#3a0e0e'], [3, 6, '#f4f0ea'], [4, 6, '#f4f0ea'], [5, 6, '#3a0e0e'], [3, 7, '#5a1a1a'], [4, 7, '#5a1a1a']],
      smirk: [[4, 6, skin[0]], [5, 6, skin[0]], [5, 5, skin[1]]],
    };
    mouths[face.mouth || 'line'].forEach(([i, j, color]) => dot('head', 'front', i, j, color));
    // Clothes.
    band('body', 0, 11, top);
    cap('body', 'top', top);
    cap('body', 'bottom', bottom);
    ['rightArm', 'leftArm'].forEach((arm) => {
      band(arm, 0, 11, skin);
      band(arm, 0, sleeves - 1, top);
      cap(arm, 'top', top);
      cap(arm, 'bottom', skin);
    });
    ['rightLeg', 'leftLeg'].forEach((leg) => {
      band(leg, 0, 11, bottom);
      band(leg, 10, 11, shoes);
      cap(leg, 'top', bottom);
      cap(leg, 'bottom', shoes);
    });
    if (belt) band('body', 10, 11, belt);
    extra?.(p);
  });
}

// A posable player: hips at the group origin (so stand it at y = 0.75), torso, head, arms and legs on their joints.
// `pose` holds each joint's [x, y, z] rotation; `right` and `left` are rendered in that hand's frame (the fist sits at
// y = -10.5 px); `crown` is rendered in the head's frame (its base at y = 0) and `chest` in the torso's (hips at
// y = 0). Vaskel's slim arms are 3 px wide; classic arms are 4.
export function Figure({ skin, slim = false, glow = 0, name = 'figure', pose = {}, right, left, crown, chest, ...props }) {
  const materials = useMemo(() => {
    const map = pixelTexture(skin);
    const body = new THREE.MeshStandardMaterial({ map, alphaTest: 0.5, roughness: 0.85 });
    const head = body.clone();
    head.emissiveMap = map;
    head.emissive.set('#ffffff');
    head.emissiveIntensity = glow;
    return { body, head };
  }, [skin]);
  const arm = slim ? 3 : 4;
  const parts = useMemo(() => {
    const layered = (w, h, d, base, overlay) => [entityBox(w, h, d, ...base, { flipSides: false }), entityBox(w, h, d, ...overlay, { flipSides: false, inflate: 0.5 })];
    return {
      torso: layered(8, 12, 4, [16, 16], [16, 32]), head: layered(8, 8, 8, [0, 0], [32, 0]),
      rightArm: layered(arm, 12, 4, [40, 16], [40, 32]), leftArm: layered(arm, 12, 4, [32, 48], [48, 48]),
      rightLeg: layered(4, 12, 4, [0, 16], [0, 32]), leftLeg: layered(4, 12, 4, [16, 48], [0, 48]),
    };
  }, []);
  const part = (pair, y, material, label) => pair.map((g, i) => <mesh key={i} geometry={g} material={material} userData={{ name: i ? `${label}_layer` : label }} position={[0, y, 0]} castShadow receiveShadow />);
  const shoulder = (4 + arm / 2) * PX;
  return (
    <group name={name} {...props}>
      <group rotation={pose.body || [0, 0, 0]}>
        {part(parts.torso, 6 * PX, materials.body, 'body')}
        {chest}
        <group name="head" position={[0, 12 * PX, 0]} rotation={pose.head || [0, 0, 0]}>{part(parts.head, 4 * PX, materials.head, 'head')}{crown}</group>
        <group name="right_arm" position={[-shoulder, 10 * PX, 0]} rotation={pose.rightArm || [0, 0, 0]}>
          {part(parts.rightArm, -4 * PX, materials.body, 'right_arm')}
          {right}
        </group>
        <group name="left_arm" position={[shoulder, 10 * PX, 0]} rotation={pose.leftArm || [0, 0, 0]}>
          {part(parts.leftArm, -4 * PX, materials.body, 'left_arm')}
          {left}
        </group>
      </group>
      <group name="right_leg" position={[-2 * PX, 0, 0]} rotation={pose.rightLeg || [0, 0, 0]}>{part(parts.rightLeg, -6 * PX, materials.body, 'right_leg')}</group>
      <group name="left_leg" position={[2 * PX, 0, 0]} rotation={pose.leftLeg || [0, 0, 0]}>{part(parts.leftLeg, -6 * PX, materials.body, 'left_leg')}</group>
    </group>
  );
}

// One segment of a bendy limb or torso: rows r0..r1 of the part's vanilla faces. The first segment keeps the part's
// top face and the last its bottom face; inner ends show a sliver of the side, under the joint cube when bent.
function segmentBox(w, h, d, u, v, r0, r1, inflate = 0, size = 64) {
  const hs = r1 - r0;
  const geometry = new THREE.BoxGeometry((w + inflate) * PX, (hs + inflate) * PX, (d + inflate) * PX);
  const uv = geometry.attributes.uv;
  const sy = v + d + r0;
  const rects = [
    [u, sy, d, hs], [u + d + w, sy, d, hs],
    r0 === 0 ? [u + d, v, w, d] : [u + d, sy, w, 1],
    r1 === h ? [u + d + w, v, w, d] : [u + d, sy + hs - 1, w, 1],
    [u + d, sy, w, hs], [u + 2 * d + w, sy, w, hs],
  ];
  rects.forEach(([x, y, fw, fh], f) => {
    const [a, b, top, bottom] = [(x + 0.02) / size, (x + fw - 0.02) / size, 1 - (y + 0.02) / size, 1 - (y + fh - 0.02) / size];
    uv.setXY(f * 4, a, top);
    uv.setXY(f * 4 + 1, b, top);
    uv.setXY(f * 4 + 2, a, bottom);
    uv.setXY(f * 4 + 3, b, bottom);
  });
  return geometry;
}

// A posable player with bendy limbs, for action poses: the torso bends at the waist, arms at the elbows, legs at the
// knees, each joint bridged by a cube turned halfway. Hips sit at the group origin (stand it at y = 0.75). `pose`
// holds [x, y, z] rotations for body (at the hips), chest (waist), head, rightArm/leftArm (shoulders),
// rightElbow/leftElbow, rightLeg/leftLeg (hips) and rightKnee/leftKnee. `right` and `left` render in the forearm's
// frame with the fist at y = -6.5 px; `crown` in the head's frame; `chest` in the upper torso's (waist at y = 0).
export function Character({ skin, slim = false, glow = 0, name = 'character', pose = {}, right, left, crown, chest, ...props }) {
  const materials = useMemo(() => {
    const map = pixelTexture(skin);
    const body = new THREE.MeshStandardMaterial({ map, alphaTest: 0.5, roughness: 0.8 });
    const head = body.clone();
    if (glow) Object.assign(head, { emissiveMap: map, emissive: new THREE.Color('#ffffff'), emissiveIntensity: glow });
    return { body, head };
  }, [skin]);
  const arm = slim ? 3 : 4;
  const geo = useMemo(() => {
    const seg = (w, [u, v], [ou, ov], r0, r1) => [segmentBox(w, 12, 4, u, v, r0, r1), segmentBox(w, 12, 4, ou, ov, r0, r1, 0.5)];
    const limb = (w, base, over) => ({ upper: seg(w, base, over, 0, 6), lower: seg(w, base, over, 6, 12), joint: seg(w * 0.98, base, over, 4, 8) });
    return {
      head: [entityBox(8, 8, 8, 0, 0, { flipSides: false }), entityBox(8, 8, 8, 32, 0, { flipSides: false, inflate: 0.5 })],
      torso: { upper: seg(8, [16, 16], [16, 32], 0, 6), lower: seg(8, [16, 16], [16, 32], 6, 12), joint: seg(7.9, [16, 16], [16, 32], 4, 8) },
      rightArm: limb(arm, [40, 16], [40, 32]), leftArm: limb(arm, [32, 48], [48, 48]),
      rightLeg: limb(4, [0, 16], [0, 32]), leftLeg: limb(4, [16, 48], [0, 48]),
    };
  }, []);
  const zero = [0, 0, 0];
  const mesh = (pair, y, label, material = materials.body) => pair.map((g, i) => <mesh key={i} geometry={g} material={material} userData={{ name: i ? `${label}_layer` : label }} position={[0, y, 0]} castShadow receiveShadow />);
  const joint = (pair, angle, label) => {
    const r = angle || zero;
    if (Math.abs(r[0]) + Math.abs(r[1]) + Math.abs(r[2]) < 0.05) return null;
    return <group rotation={r.map((a) => -a / 2)}>{mesh(pair, 0, label)}</group>;
  };
  const shoulder = (4 + arm / 2) * PX;
  const armRig = (side, g, label) => {
    const key = side < 0 ? 'right' : 'left';
    const bend = pose[`${key}Elbow`];
    return (
      <group name={`${key}_arm`} position={[side * shoulder, 4 * PX, 0]} rotation={pose[`${key}Arm`] || zero}>
        {mesh(g.upper, -1 * PX, `${label}_upper`)}
        <group name={`${key}_elbow`} position={[0, -4 * PX, 0]} rotation={bend || zero}>
          {joint(g.joint, bend, `${label}_elbow`)}
          {mesh(g.lower, -3 * PX, `${label}_lower`)}
          {side < 0 ? right : left}
        </group>
      </group>
    );
  };
  const legRig = (side, g, label) => {
    const key = side < 0 ? 'right' : 'left';
    const bend = pose[`${key}Knee`];
    return (
      <group name={`${key}_leg`} position={[side * 2 * PX, 0, 0]} rotation={pose[`${key}Leg`] || zero}>
        {mesh(g.upper, -3 * PX, `${label}_upper`)}
        <group name={`${key}_knee`} position={[0, -6 * PX, 0]} rotation={bend || zero}>
          {joint(g.joint, bend, `${label}_knee`)}
          {mesh(g.lower, -3 * PX, `${label}_lower`)}
        </group>
      </group>
    );
  };
  return (
    <group name={name} {...props}>
      <group name="body" rotation={pose.body || zero}>
        {mesh(geo.torso.lower, 3 * PX, 'hips')}
        <group name="chest" position={[0, 6 * PX, 0]} rotation={pose.chest || zero}>
          {joint(geo.torso.joint, pose.chest, 'waist')}
          {mesh(geo.torso.upper, 3 * PX, 'chest')}
          {chest}
          <group name="head" position={[0, 6 * PX, 0]} rotation={pose.head || zero}>{mesh(geo.head, 4 * PX, 'head', materials.head)}{crown}</group>
          {armRig(-1, geo.rightArm, 'right_arm')}
          {armRig(1, geo.leftArm, 'left_arm')}
        </group>
      </group>
      {legRig(-1, geo.rightLeg, 'right_leg')}
      {legRig(1, geo.leftLeg, 'left_leg')}
    </group>
  );
}

// An orbit camera: azimuth and elevation in radians around a target, with an optional roll for a tilted frame.
export function Orbit({ azimuth, elevation, distance, target, roll = 0 }) {
  const camera = useThree((s) => s.camera);
  useEffect(() => {
    camera.position.set(target[0] + Math.sin(azimuth) * Math.cos(elevation) * distance, target[1] + Math.sin(elevation) * distance, target[2] + Math.cos(azimuth) * Math.cos(elevation) * distance);
    camera.lookAt(...target);
    if (roll) camera.rotateZ(roll);
    camera.updateProjectionMatrix();
  }, [camera]);
  return null;
}

// A vertical gradient sky behind everything: `stops` are [position 0 (top) to 1 (bottom), colour].
export function Sky({ stops }) {
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 4;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 0, 512);
    stops.forEach(([at, color]) => gradient.addColorStop(at, color));
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 4, 512);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    scene.background = texture;
  }, [scene]);
  return null;
}

// A sky dome for path-traced scenes: an HDR gradient by elevation with a sun or moon disc, used as both background
// and environment, so the sky lights the scene and the sun casts soft shadows. See skyDome() in pathtrace.js.
export function Dome({ dome, sun, intensity = 1 }) {
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    const texture = skyDome({ dome, sun });
    scene.background = texture;
    scene.environment = texture;
    scene.environmentIntensity = intensity;
    scene.backgroundIntensity = 1;
  }, [scene]);
  return null;
}

// Ambient occlusion where forms meet, optional bloom for lamps and glows, a split-tone grade, an optional vignette,
// then ACES tone mapping.
export function Grade({ ao, bloom, tone, vignette }) {
  const grade = useMemo(() => new SplitToneEffect(tone), []);
  return (
    <EffectComposer multisampling={8} frameBufferType={THREE.HalfFloatType}>
      <N8AO {...ao} />
      {bloom ? <Bloom mipmapBlur {...bloom} /> : <></>}
      <primitive object={grade} />
      {vignette ? <Vignette {...vignette} /> : <></>}
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
    </EffectComposer>
  );
}

// Takes the finished frame once the scene has settled. 'frame' mode downsamples the 2x render to the window size;
// 'cutout' mode also renders a flat white silhouette onto a clear background and uses its alpha to cut the figure
// out of the graded frame, then trims the empty margin. With ?bbmodel the scene is exported as a Blockbench project
// instead; `keep` names the textures (skins, paintings) that keep their own file rather than joining the atlas.
// 'pathtrace' mode stops the rasteriser and traces the frame on the GPU instead (see pathtrace.js); with ?preview it
// falls back to a quick rasterised frame for checking the composition.
function Capture({ mode, keep, name, trace }) {
  const { gl, scene, camera, setFrameloop } = useThree();
  useEffect(() => {
    const query = new URLSearchParams(location.search);
    if (query.has('bbmodel')) {
      const timer = setTimeout(() => report('BBMODEL', JSON.stringify(exportBBModel(scene, { name, keep }))), 1500);
      return () => clearTimeout(timer);
    }
    const [w, h] = [gl.domElement.width / gl.getPixelRatio(), gl.domElement.height / gl.getPixelRatio()];
    if (mode === 'pathtrace' && !query.has('preview')) {
      setFrameloop('never');
      const samples = Number(query.get('samples')) || trace.samples;
      // ?hide=a,b leaves those named groups out, for checking parts of a scene on their own.
      const hidden = (query.get('hide') || '').split(',');
      scene.traverse((o) => { if (o.name && hidden.includes(o.name)) o.visible = false; });
      const timer = setTimeout(() => renderTraced(gl, scene, camera, { ...trace, samples }).then(() => finish(gl.domElement.toDataURL('image/png'), null, w, h)), 50);
      return () => clearTimeout(timer);
    }
    if (mode === 'pathtrace') gl.toneMapping = THREE.ACESFilmicToneMapping;
    const timer = setTimeout(() => {
      const colorPass = gl.domElement.toDataURL('image/png');
      if (mode !== 'cutout') {
        finish(colorPass, null, w, h);
        return;
      }
      scene.background = null;
      scene.traverse((object) => {
        if (!object.isMesh) return;
        const flat = (m) => new THREE.MeshBasicMaterial({ color: '#ffffff', map: m.map, alphaTest: m.alphaTest, side: m.side });
        object.material = Array.isArray(object.material) ? object.material.map(flat) : flat(object.material);
      });
      gl.setRenderTarget(null);
      gl.setClearColor(0x000000, 0);
      gl.autoClear = true;
      gl.render(scene, camera);
      finish(colorPass, gl.domElement.toDataURL('image/png'), w, h);
    }, 5000);
    return () => clearTimeout(timer);
  }, []);
  return null;
}

function report(kind, text) {
  const result = document.createElement('pre');
  result.id = 'result';
  result.hidden = true;
  result.textContent = `${kind}:${text}`;
  document.body.append(result);
}

// Downsample the 2x pass; for a cutout, cut it with the mask, trim the empty margin and pad it. Hands back a WebP.
async function finish(colorUrl, maskUrl, w, h) {
  const color = await load(colorUrl);
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const ctx = out.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(color, 0, 0, w, h);
  if (!maskUrl) {
    report('WEBP', out.toDataURL('image/webp', 0.92));
    return;
  }
  const mask = await load(maskUrl);
  ctx.globalCompositeOperation = 'destination-in';
  ctx.drawImage(mask, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);
  let [x0, y0, x1, y1] = [w, h, 0, 0];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] > 8) [x0, y0, x1, y1] = [Math.min(x0, x), Math.min(y0, y), Math.max(x1, x), Math.max(y1, y)];
    }
  }
  const pad = 16;
  const crop = document.createElement('canvas');
  crop.width = x1 - x0 + 1 + pad * 2;
  crop.height = y1 - y0 + 1 + pad * 2;
  crop.getContext('2d').drawImage(out, x0, y0, x1 - x0 + 1, y1 - y0 + 1, pad, pad, x1 - x0 + 1, y1 - y0 + 1);
  report('WEBP', crop.toDataURL('image/webp', 0.95));
}

// Errors land in the DOM too, so the render script can print them from a headless run.
addEventListener('error', (e) => report('ERROR', `${e.message}\n${e.error?.stack || ''}`));
addEventListener('unhandledrejection', (e) => report('ERROR', `${e.reason?.message || e.reason}\n${e.reason?.stack || ''}`));

// Loads the scene's images, then renders it at 2x into a canvas the size of the window and arms the capture.
// Path-traced scenes pass `trace`: { samples, bounces, look } (see renderTraced).
export function start(Scene, { name, images = {}, mode = 'frame', fov = 30, far = 60, keep = () => ({}), trace }) {
  const entries = Object.entries(images);
  Promise.all(entries.map(([, url]) => load(url))).then((loaded) => {
    const ready = Object.fromEntries(entries.map(([key], i) => [key, loaded[i]]));
    createRoot(document.getElementById('root')).render(
      <Canvas shadows flat dpr={mode === 'pathtrace' ? 1 : 2} camera={{ fov, near: 0.1, far }} gl={{ alpha: true, antialias: true, preserveDrawingBuffer: true }}>
        <Scene images={ready} />
        <Capture mode={mode} keep={keep(ready)} name={name} trace={trace} />
      </Canvas>,
    );
  });
}
