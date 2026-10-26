// The forest around the camp, built the way a terraforming builder would: a clearing with an organic rim,
// rolling forest floor in blended block palettes, custom branching trees in groves that stack back into the
// haze, mossy boulders and fallen logs, vanilla-style 3D clouds and a starry sky glimpsed through the canopy.
// Everything static is generated once and batched; the React scene mounts `group`.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { logGeometry } from './minecraft.js';

// Every block texture this file uses; main.jsx loads exactly these from assets/minecraft/block.
export const BLOCK_TEXTURES = [
  'grass_block_top', 'grass_block_side', 'dirt', 'coarse_dirt', 'dirt_path_top', 'rooted_dirt', 'podzol_top', 'podzol_side', 'moss_block',
  'stone', 'andesite', 'tuff', 'cobblestone', 'mossy_cobblestone', 'oak_log', 'oak_log_top', 'spruce_log', 'dark_oak_log', 'birch_log',
  'stripped_oak_log', 'stripped_oak_log_top', 'oak_leaves', 'dark_oak_leaves', 'birch_leaves', 'spruce_leaves', 'azalea_leaves',
  'flowering_azalea_leaves', 'vine', 'pink_petals', 'barrel_side', 'barrel_top', 'short_grass', 'fern', 'tall_grass_bottom', 'tall_grass_top',
  'large_fern_bottom', 'large_fern_top', 'poppy', 'dandelion', 'cornflower', 'azure_bluet', 'oxeye_daisy', 'sweet_berry_bush_stage3',
  'red_mushroom', 'brown_mushroom',
];

export const rng = (seed) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const hash = (x, z, s = 0) => {
  let h = Math.imul((x * 73856093) ^ (z * 19349663) ^ (s * 83492791), 1274126177);
  h ^= h >>> 15;
  h = Math.imul(h, 668265263);
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
};
const hash3 = (x, y, z, s) => hash(x * 31 + y * 7919, z - y * 131, s);

// Smooth value noise in [0, 1], and a three-octave sum of it for natural shapes.
function noise(x, z, scale, s) {
  const fx = x / scale, fz = z / scale, ix = Math.floor(fx), iz = Math.floor(fz), tx = fx - ix, tz = fz - iz;
  const sx = tx * tx * (3 - 2 * tx), sz = tz * tz * (3 - 2 * tz);
  const a = hash(ix, iz, s), b = hash(ix + 1, iz, s), c = hash(ix, iz + 1, s), d = hash(ix + 1, iz + 1, s);
  return a + (b - a) * sx + (c - a) * sz + (a - b - c + d) * sx * sz;
}
const fbm = (x, z, scale, s) => noise(x, z, scale, s) * 0.6 + noise(x, z, scale / 2, s + 1) * 0.28 + noise(x, z, scale / 4, s + 2) * 0.12;
const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

const CENTER = [1.5, -0.5];
const fromCenter = (x, z) => Math.hypot(x - CENTER[0], z - CENTER[1]);
// How squarely a spot sits in front of the camera (1 = dead centre of the default view, ~0.5 = edge of the
// widest orbit), used to spend detail only where it can be seen.
const inView = (x, z) => {
  const dx = x - 5.8, dz = z - 9.1;
  return (dx * -0.443 + dz * -0.896) / Math.hypot(dx, dz);
};
const onPath = (x, z, w = 1.3) => Math.abs(x - (z > -5 ? 1.5 : Math.sin(z * 0.24) * 2)) < w && z < 2 && z > -26;
const campFloor = (x, z) => Math.hypot((x - 1.6) / 3.7, (z - 0.8) / 3.0) + (noise(x, z, 3, 61) - 0.5) * 0.5;
const PROPS = [[3.65, -0.7], [2.35, 1.7], [0.9, 0.1], [4.9, -1.75], [-1.7, -1.4]];
// The moon's bearing and elevation from the default camera (CameraRig pins it to the upper right of the frame);
// trees that would stand in front of it are left out so it always shows through.
const MOON = { bearing: -0.21, elevation: 0.038 };
const hidesMoon = (x, z, top) => {
  const dx = x - 5.8, dz = z - 9.1, bearing = Math.atan2(dx, -dz);
  return Math.abs(bearing - MOON.bearing) < 0.14 && top > 2.95 + Math.hypot(dx, dz) * Math.tan(MOON.elevation + 0.07);
};
// Nearby trees on the line straight behind Vaskel would wall in his silhouette; the hazier valley canopy
// further back stays.
const crowdsHero = (x, z) => {
  const dx = x - 5.8, dz = z - 9.1;
  return Math.abs(Math.atan2(dx, -dz) + 0.505) < 0.13 && Math.hypot(dx, dz) < 27;
};

// Terrain: a flat clearing with an organic rim on a wooded hilltop. Rises crowd it left and right; behind it
// the ground drops into a forested valley, so the background is a sea of treetops receding into the haze
// below a strip of sky (from this camera the moon sits only ~2° above eye level).
const heights = new Map();
export function heightAt(x, z) {
  x = Math.floor(x);
  z = Math.floor(z);
  const key = x + ',' + z;
  if (heights.has(key)) return heights.get(key);
  const cx = x + 0.5, cz = z + 0.5, n = fbm(cx, cz, 12, 40), d = fbm(cx, cz, 5, 50);
  const camp = Math.hypot((cx - 1.4) / 6.2, (cz - 0.4) / 4.6) + (d - 0.5) * 0.45, near = smooth(-12, -4, cz);
  let f = (smooth(-3, -12, cx) * (2.2 + n * 4.5) + smooth(6, 13, cx) * (1.6 + n * 3.5)) * near;
  f += (d - 0.5) * 0.9 * Math.min(1, Math.max(0, camp - 1));
  f -= smooth(-5, -16, cz) * (7 + (n - 0.5) * 2.2);
  f += smooth(-30, -64, cz) * (2.5 + n * 3) + smooth(20, 34, Math.abs(cx - 1.5)) * (2 + n * 3) * (1 - near);
  let h = Math.floor(f);
  if (camp < 1) h = 0;
  h = Math.max(-9, Math.min(9, h));
  heights.set(key, h);
  return h;
}
const H = heightAt;
const steepness = (x, z) => {
  const y = H(x, z);
  return Math.max(Math.abs(y - H(x - 1, z)), Math.abs(y - H(x + 1, z)), Math.abs(y - H(x, z - 1)), Math.abs(y - H(x, z + 1)));
};

function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d'), r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,255,255,.55)');
  r.addColorStop(0.2, 'rgba(255,255,255,.12)');
  r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}
export const haloMap = glowTexture();

export function halo(x, y, z, size, color, parent) {
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloMap, color, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
  sprite.position.set(x, y, z);
  sprite.scale.set(size, size, 1);
  parent.add(sprite);
  return sprite;
}

// Minecraft's own cloud layer: every opaque pixel of environment/clouds.png is a cloud cell, extruded into one
// slab with only its outer faces (so the translucent surface never doubles up on itself), shaded like the
// game (bright tops, dimmer sides, dark undersides).
const CLOUD = { cell: 6, thick: 1.6, span: 64, y: 15, speed: 0.25 };
function cloudGeometry(solid, ox, oz) {
  const { cell, thick, span } = CLOUD, half = (span * cell) / 2;
  const at = (i, j) => solid[(((oz + j) % 256) + 256) % 256 * 256 + ((((ox + i) % 256) + 256) % 256)];
  const position = [], color = [], index = [];
  const face = (corners, shade) => {
    const base = position.length / 3;
    corners.forEach((p) => {
      position.push(...p);
      color.push(shade, shade, shade);
    });
    index.push(base, base + 1, base + 2, base, base + 2, base + 3);
  };
  for (let i = 0; i < span; i++) {
    for (let j = 0; j < span; j++) {
      if (!at(i, j)) continue;
      const x0 = i * cell - half, x1 = x0 + cell, z0 = j * cell - half, z1 = z0 + cell, y0 = 0, y1 = thick;
      face([[x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0]], 1);
      face([[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], 0.62);
      if (!at(i + 1, j)) face([[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]], 0.84);
      if (!at(i - 1, j)) face([[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], 0.84);
      if (!at(i, j + 1)) face([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], 0.76);
      if (!at(i, j - 1)) face([[x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [x1, y0, z0]], 0.76);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(color, 3));
  geometry.setIndex(index);
  geometry.computeBoundingSphere();
  return geometry;
}

export function buildWorld(images, { mobile }) {
  const group = new THREE.Group();
  const R = rng(2601026);

  // --- Textures: current 1.21.1 blocks at full detail; grayscale grass and foliage get vanilla tints.
  function paint(c, image, tint) {
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.drawImage(image, 0, 0, 16, 16, 0, 0, 16, 16);
    if (tint) {
      g.globalCompositeOperation = 'multiply';
      g.fillStyle = tint;
      g.fillRect(0, 0, 16, 16);
      g.globalCompositeOperation = 'destination-in';
      g.drawImage(image, 0, 0, 16, 16, 0, 0, 16, 16);
      g.globalCompositeOperation = 'source-over';
    }
  }
  const canvasTexture = (c, repeat = true) => {
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestMipmapNearestFilter;
    t.anisotropy = 4;
    if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  };
  function texture(name, tint) {
    const c = document.createElement('canvas');
    c.width = c.height = 16;
    paint(c, images[name], tint);
    return canvasTexture(c);
  }
  const GRASS = '#91bd59', FOLIAGE = '#77ab2f';
  const tex = {
    grass: texture('grass_block_top', GRASS), side: texture('grass_block_side'), soil: texture('dirt'), coarse: texture('coarse_dirt'),
    trail: texture('dirt_path_top'), rooted: texture('rooted_dirt'), podzol: texture('podzol_top'), podzolSide: texture('podzol_side'),
    moss: texture('moss_block'), stone: texture('stone'), andesite: texture('andesite'), tuff: texture('tuff'), cobble: texture('cobblestone'),
    mossy: texture('mossy_cobblestone'), log: texture('oak_log'), logTop: texture('oak_log_top'), spruce: texture('spruce_log'),
    darkLog: texture('dark_oak_log'), birchLog: texture('birch_log'), stripped: texture('stripped_oak_log'), strippedTop: texture('stripped_oak_log_top'),
    barrel: texture('barrel_side'), barrelTop: texture('barrel_top'),
    leaf: texture('oak_leaves', FOLIAGE), darkLeaf: texture('dark_oak_leaves', FOLIAGE), birchLeaf: texture('birch_leaves', '#80a755'),
    pine: texture('spruce_leaves', '#619961'), azalea: texture('azalea_leaves'), bloom: texture('flowering_azalea_leaves'),
    vine: texture('vine', FOLIAGE), petals: texture('pink_petals'),
  };

  // Dungeons-style grass lip: jagged columns of a top texture that hang over every exposed block edge.
  function fringeTexture(source) {
    const c = document.createElement('canvas');
    c.width = 16;
    c.height = 8;
    const g = c.getContext('2d'), r = rng(911);
    for (let x = 0; x < 16; x++) {
      const len = 2 + Math.floor(r() * 5);
      g.drawImage(source.image, x, 0, 1, len, x, 0, 1, len);
      g.fillStyle = 'rgba(16,40,8,.4)';
      g.fillRect(x, len - 1, 1, 1);
    }
    return canvasTexture(c, false);
  }

  const mat = (map, color = '#ffffff', extra = {}) => new THREE.MeshStandardMaterial({ map, color, roughness: 1, ...extra });
  const foliage = (map, color, glow) => mat(map, color, { alphaTest: 0.43, side: THREE.DoubleSide, emissiveMap: map, emissive: '#ffffff', emissiveIntensity: glow });
  const mats = {
    grass: mat(tex.grass), side: mat(tex.side), soil: mat(tex.soil), coarse: mat(tex.coarse), trail: mat(tex.trail), rooted: mat(tex.rooted),
    podzol: mat(tex.podzol), podzolSide: mat(tex.podzolSide), moss: mat(tex.moss), stone: mat(tex.stone), andesite: mat(tex.andesite),
    tuff: mat(tex.tuff), cobble: mat(tex.cobble), mossy: mat(tex.mossy), log: mat(tex.log), logTop: mat(tex.logTop), spruce: mat(tex.spruce),
    darkLog: mat(tex.darkLog), birchLog: mat(tex.birchLog), barrel: mat(tex.barrel), barrelTop: mat(tex.barrelTop),
    leaf: foliage(tex.leaf, '#ffffff', 0.1), leafDark: foliage(tex.leaf, '#a9bf93', 0.06), darkLeaf: foliage(tex.darkLeaf, '#c4d0b4', 0.07),
    birchLeaf: foliage(tex.birchLeaf, '#ffffff', 0.1), pine: foliage(tex.pine, '#ffffff', 0.08), pineDark: foliage(tex.pine, '#a9bcae', 0.05),
    azalea: foliage(tex.azalea, '#ffffff', 0.1), bloom: foliage(tex.bloom, '#ffffff', 0.14),
    vine: mat(tex.vine, '#ffffff', { alphaTest: 0.4, side: THREE.DoubleSide, emissiveMap: tex.vine, emissive: '#ffffff', emissiveIntensity: 0.08 }),
    fringe: mat(fringeTexture(tex.grass), '#ffffff', { alphaTest: 0.5, side: THREE.DoubleSide }),
    mossFringe: mat(fringeTexture(tex.moss), '#ffffff', { alphaTest: 0.5, side: THREE.DoubleSide }),
    iron: mat(null, '#303c43', { metalness: 0.55, roughness: 0.65 }),
    lantern: mat(null, '#ffdc93', { emissive: '#ffc279', emissiveIntensity: 3 }),
  };
  const ROCK = ['stone', 'stone', 'andesite', 'andesite', 'tuff', 'cobble', 'mossy'];

  const unit = new THREE.BoxGeometry(1, 1, 1);
  function box(w, h, d, x, y, z, material, parent = group) {
    const m = new THREE.Mesh(unit, material);
    m.scale.set(w, h, d);
    m.position.set(x, y, z);
    m.castShadow = m.receiveShadow = true;
    parent.add(m);
    return m;
  }
  const block = (x, y, z, material, parent) => box(1, 1, 1, x, y, z, material, parent);

  // --- Trees first, so the ground under spruces and dark oaks can turn to podzol.
  const trunks = new Set(), shade = [];
  const take = (x, z) => trunks.add(Math.floor(x) + ',' + Math.floor(z));
  const taken = (x, z) => trunks.has(x + ',' + z);

  // A ragged ellipsoid of leaf blocks; `pick` chooses each block's material (darker underneath, accents).
  function leafBlob(g, cx, cy, cz, rx, ry, rz, r, pick) {
    for (let dx = -Math.ceil(rx); dx <= Math.ceil(rx); dx++) {
      for (let dz = -Math.ceil(rz); dz <= Math.ceil(rz); dz++) {
        for (let dy = -Math.ceil(ry); dy <= Math.ceil(ry); dy++) {
          const d = (dx / rx) ** 2 + (dy / ry) ** 2 + (dz / rz) ** 2;
          if (d > 1 || d < 0.28 || (d > 0.62 && r() < 0.32)) continue;
          const material = pick(dy, r);
          if (material) block(Math.round(cx) + dx, Math.round(cy) + dy + 0.5, Math.round(cz) + dz, material, g);
        }
      }
    }
  }
  const oakPick = (dy, r) => (dy < 0 ? mats.leafDark : r() < 0.18 ? mats.leafDark : r() < 0.05 ? mats.bloom : mats.leaf);
  // Each tree group sits on the centre of its first trunk block, so whole-number offsets are block centres.
  const treeGroup = (x, z) => {
    const g = new THREE.Group();
    g.position.set(x + 0.5, H(x, z), z + 0.5);
    group.add(g);
    return g;
  };

  // Hero oak: 2×2 trunk with root flares, branches reaching out and up, a canopy of overlapping leaf blobs.
  function bigOak(x, z, size = 1) {
    const g = treeGroup(x, z), r = rng(x * 131 + z * 17 + 5), height = Math.round(5 + size * 2);
    for (const [dx, dz] of [[0, 0], [1, 0], [0, 1], [1, 1]]) take(x + dx, z + dz);
    for (let ly = -1; ly < height; ly++) for (const [dx, dz] of [[0, 0], [1, 0], [0, 1], [1, 1]]) block(dx, ly + 0.5, dz, mats.log, g);
    for (const [dx, dz] of [[-1, 0], [2, 1], [0, 2], [1, -1], [-1, 1], [2, 0], [1, 2], [0, -1]]) if (r() < 0.6) block(dx, 0.5, dz, mats.log, g);
    const canopy = [[0.5, height + 1, 0.5, 3.4 * size, 2.3 * size, 3.2 * size]];
    const branches = 3 + Math.floor(r() * 2), turn = r() * Math.PI * 2;
    for (let b = 0; b < branches; b++) {
      const a = turn + (b / branches) * Math.PI * 2 + (r() - 0.5) * 0.6, reach = Math.round((3 + r() * 1.5) * size);
      let bx = 0.5, by = height - 2 - Math.floor(r() * 2), bz = 0.5;
      for (let s = 1; s <= reach; s++) {
        bx = 0.5 + Math.cos(a) * (s + 0.5);
        bz = 0.5 + Math.sin(a) * (s + 0.5);
        if (s % 2 === 0) by++;
        block(Math.round(bx), by + 0.5, Math.round(bz), mats.log, g);
      }
      canopy.push([bx, by + 1, bz, 2.4 * size, 1.6 * size, 2.4 * size]);
    }
    for (const [cx, cy, cz, rx, ry, rz] of canopy) {
      leafBlob(g, cx, cy, cz, rx, ry, rz, r, oakPick);
    }
  }
  // Forest oak: a single trunk with a two-blob crown, the bulk of the woodland.
  function oak(x, z, size = 1) {
    const g = treeGroup(x, z), r = rng(x * 41 + z * 67 + 11), height = Math.round(4 + size * 2);
    take(x, z);
    for (let ly = 0; ly < height; ly++) block(0, ly + 0.5, 0, mats.log, g);
    leafBlob(g, 0, height, 0, 2.6 * size, 1.9 * size, 2.6 * size, r, oakPick);
    leafBlob(g, (r() - 0.5) * 2, height + 1.5 * size, (r() - 0.5) * 2, 1.7 * size, 1.3 * size, 1.7 * size, r, oakPick);
  }
  // Builder spruce: layered skirts that droop at their tips, narrowing to a spike.
  function spruce(x, z, size = 1) {
    const g = treeGroup(x, z), r = rng(x * 71 + z * 29 + 9), height = Math.round(7 * size + 2);
    take(x, z);
    shade.push([x, z]);
    for (let ly = 0; ly < height; ly++) block(0, ly + 0.5, 0, mats.spruce, g);
    const spread = Math.max(2, Math.round(3 * size));
    for (let ly = 2; ly <= height; ly++) {
      const tier = (ly - 2) % 3, rad = Math.max(0, Math.round((1 - (ly - 2) / (height - 1)) * spread) - (tier === 2 ? 1 : 0));
      for (let dx = -rad; dx <= rad; dx++) {
        for (let dz = -rad; dz <= rad; dz++) {
          const d = Math.abs(dx) + Math.abs(dz);
          if (d > rad + (rad > 1 ? 1 : 0) || (!dx && !dz && ly < height) || (d === rad + 1 && r() < 0.4)) continue;
          block(dx, ly + 0.5, dz, r() < 0.28 ? mats.pineDark : mats.pine, g);
          if (tier === 0 && rad >= 2 && d >= rad && r() < 0.5) block(dx, ly - 0.5, dz, mats.pineDark, g);
        }
      }
    }
    block(0, height + 1.5, 0, mats.pine, g);
    block(0, height + 2.5, 0, mats.pine, g);
  }
  function birch(x, z, size = 1) {
    const g = treeGroup(x, z), r = rng(x * 53 + z * 97 + 3), height = Math.round(5 + size * 2);
    take(x, z);
    for (let ly = 0; ly < height; ly++) block(0, ly + 0.5, 0, mats.birchLog, g);
    leafBlob(g, 0, height - 0.5, 0, 2.2 * size, 2.6 * size, 2.2 * size, r, (dy, rr) => (dy < -1 && rr() < 0.5 ? mats.leafDark : mats.birchLeaf));
  }
  function darkOak(x, z, size = 1) {
    const g = treeGroup(x, z), r = rng(x * 37 + z * 61 + 7), height = Math.round(3 + size * 2);
    shade.push([x, z]);
    for (const [dx, dz] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
      take(x + dx, z + dz);
      for (let ly = 0; ly < height; ly++) block(dx, ly + 0.5, dz, mats.darkLog, g);
    }
    leafBlob(g, 0.5, height + 0.5, 0.5, 3.6 * size, 1.6 * size, 3.6 * size, r, (dy, rr) => (dy < 0 || rr() < 0.2 ? mats.leafDark : mats.darkLeaf));
  }
  // Azalea bush: a low mound of plain and flowering azalea leaves sitting right on the ground.
  function azalea(x, z, size = 1) {
    const g = treeGroup(x, z), r = rng(x * 19 + z * 83 + 1);
    take(x, z);
    leafBlob(g, 0, 0.6, 0, 1.6 * size, 1.1 * size, 1.6 * size, r, (dy, rr) => (dy < -1 ? null : rr() < 0.3 ? mats.bloom : mats.azalea));
  }

  // Hero trees frame the clearing on both sides; azaleas fill the understorey at its edge.
  bigOak(-10, 1, 1.25);
  bigOak(13, -5, 1.1);
  bigOak(-12, -13, 1);
  [[-7, -2, 1], [9, -3, 0.9], [-9, -7, 0.9], [11, 2, 1], [-6, 5, 0.9], [6, -9, 0.8]].forEach((a) => azalea(...a));
  // The woodland: groves on a jittered grid, thinning with distance and kept to what the camera can see.
  for (let gx = -44; gx <= 44; gx += 4) {
    for (let gz = -60; gz <= 16; gz += 4) {
      const x = Math.round(gx + (hash(gx, gz, 80) - 0.5) * 3), z = Math.round(gz + (hash(gx, gz, 81) - 0.5) * 3);
      const d = fromCenter(x + 0.5, z + 0.5), view = inView(x + 0.5, z + 0.5);
      if (d < 8.5 || d > 62 || campFloor(x + 0.5, z + 0.5) < 1.8 || onPath(x + 0.5, z + 0.5, 2.4)) continue;
      if ([[0, 0], [1, 0], [0, 1], [1, 1], [-1, 0], [0, -1]].some(([dx, dz]) => taken(x + dx, z + dz))) continue;
      if (Math.hypot(x - 5.8, z - 9.1) < 7 || (view < 0.5 && d > 14)) continue;
      if (d > 30 && hash(gx, gz, 82) < (mobile ? 0.55 : 0.3)) continue;
      const kind = noise(x, z, 13, 90), size = 0.85 + hash(gx, gz, 83) * 0.4;
      if (hidesMoon(x + 0.5, z + 0.5, H(x, z) + 9.5 * size) || crowdsHero(x + 0.5, z + 0.5)) continue;
      if (kind < 0.38) spruce(x, z, size);
      else if (kind < 0.62) hash(gx, gz, 84) < 0.5 ? darkOak(x, z, size) : oak(x, z, size);
      else hash(gx, gz, 85) < 0.55 ? birch(x, z, size) : oak(x, z, size);
    }
  }

  // --- Mossy boulders: noisy blobs of stone, andesite, tuff and cobble with moss carpets on top.
  function boulder(x, z, radius, seed) {
    const y = H(x, z), r = rng(seed), tops = new Map(), reach = Math.ceil(radius);
    for (let dx = -reach; dx <= reach; dx++) {
      for (let dz = -reach; dz <= reach; dz++) {
        for (let dy = -1; dy <= reach; dy++) {
          const d = (dx / radius) ** 2 + ((dy + 0.4) / (radius * 0.8)) ** 2 + (dz / radius) ** 2 + (hash3(dx + x, dy, dz + z, seed) - 0.5) * 0.5;
          if (d > 1) continue;
          const by = y + dy, kind = ROCK[Math.floor(hash3(x + dx, by, z + dz, 7) * ROCK.length)];
          block(x + dx + 0.5, by + 0.5, z + dz + 0.5, dy >= reach - 1 && r() < 0.4 ? mats.mossy : mats[kind]);
          tops.set(dx + ',' + dz, Math.max(tops.get(dx + ',' + dz) ?? -99, by + 1));
          take(x + dx, z + dz);
        }
      }
    }
    for (const [k, top] of tops) {
      if (r() > 0.55) continue;
      const [dx, dz] = k.split(',').map(Number);
      box(1, 0.06, 1, x + dx + 0.5, top + 0.03, z + dz + 0.5, mats.moss);
    }
  }
  [[-5, -5, 1.5], [10, -8, 1.4], [-14, -4, 1.8], [7, -16, 1.6], [15, 5, 1.4], [-13, 8, 1.5], [-3, -20, 1.9]].forEach(([x, z, rad], i) => {
    if (!taken(x, z)) boulder(x, z, rad, 700 + i);
  });

  // --- Fallen logs, mossy on top, lying across the forest floor.
  const fallenSide = mat(tex.log), fallenEnd = mat(tex.logTop);
  for (const [x, z, length, yaw] of [[-6, -9, 4, 0.3], [9, -12, 3.5, 1.4], [-15, 2, 4, -0.5]]) {
    const y = H(x, z), log = new THREE.Mesh(logGeometry(length, 1, 1), [fallenSide, fallenEnd]);
    log.position.set(x + 0.5, y + 0.5, z + 0.5);
    log.rotation.y = yaw;
    log.castShadow = log.receiveShadow = true;
    group.add(log);
    const moss = new THREE.Mesh(new THREE.BoxGeometry(length * 0.7, 0.06, 1), mats.moss);
    moss.position.set(x + 0.5, y + 1.03, z + 0.5);
    moss.rotation.y = yaw;
    moss.receiveShadow = true;
    group.add(moss);
    for (let i = -Math.floor(length / 2); i <= Math.floor(length / 2); i++) take(x + Math.round(Math.cos(yaw) * i), z - Math.round(Math.sin(yaw) * i));
  }

  // --- Camp dressing: a stacked firewood pile and a barrel beside the chest.
  const firewood = new THREE.Group();
  firewood.position.set(-1.7, 0, -1.4);
  firewood.rotation.y = 0.5;
  group.add(firewood);
  const woodSide = mat(tex.stripped), woodEnd = mat(tex.strippedTop), woodGeo = new THREE.BoxGeometry(1.1, 0.3, 0.3);
  [[0, 0.15, -0.3], [0, 0.15, 0], [0, 0.15, 0.3], [0.05, 0.45, -0.15], [-0.05, 0.45, 0.15], [0, 0.75, 0]].forEach(([x, y, z]) => {
    const m = new THREE.Mesh(woodGeo, [woodEnd, woodEnd, woodSide, woodSide, woodSide, woodSide]);
    m.position.set(x, y, z);
    m.castShadow = m.receiveShadow = true;
    firewood.add(m);
  });
  const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.88, 0.88), [mats.barrel, mats.barrel, mats.barrelTop, mats.barrelTop, mats.barrel, mats.barrel]);
  barrel.position.set(4.9, 0.44, -1.75);
  barrel.rotation.y = -0.3;
  barrel.castShadow = barrel.receiveShadow = true;
  group.add(barrel);

  // A trail leads off into the woods, its lanterns glowing as soft lights between the trunks.
  for (const [x, z] of [[-3, -8], [2, -13], [-4, -20]]) {
    const y = H(x, z);
    box(0.12, 1.1, 0.12, x, y + 0.55, z, mats.log);
    const g = new THREE.Group();
    g.position.set(x, y + 1.15, z);
    group.add(g);
    box(0.26, 0.31, 0.26, 0, 0, 0, mats.lantern, g);
    box(0.36, 0.07, 0.36, 0, -0.2, 0, mats.iron, g);
    box(0.36, 0.09, 0.36, 0, 0.21, 0, mats.iron, g);
    halo(0, 0, 0, 0.8, '#ffd18c', g);
  }

  // --- Terrain surface: what tops each column, blending palettes the way builders do.
  const podzolNear = (x, z) => shade.some(([sx, sz]) => (x - sx) ** 2 + (z - sz) ** 2 < 7 + hash(x, z, 64) * 5);
  function surfaceAt(x, z) {
    const cx = x + 0.5, cz = z + 0.5, floor = campFloor(cx, cz);
    // The camp floor is clean dirt path; only its rim frays into coarse dirt and moss before the grass.
    if (floor < 0.92) return 'trail';
    if (floor < 1.08) return noise(x, z, 3, 62) < 0.55 ? 'coarse' : 'moss';
    if (onPath(cx, cz, 0.9 + hash(x, z, 1) * 0.3)) return 'trail';
    if (onPath(cx, cz, 1.6)) return noise(x, z, 2, 66) < 0.5 ? 'coarse' : 'rooted';
    if (steepness(x, z) >= 3) return ROCK[Math.floor(noise(x, z, 3, 67) * ROCK.length * 0.999)];
    if (podzolNear(x, z)) return noise(x, z, 3, 69) < 0.2 ? 'coarse' : 'podzol';
    if (noise(x, z, 5, 63) > 0.64) return 'moss';
    return 'grass';
  }
  const SIDE = { grass: 'side', moss: 'moss', podzol: 'podzolSide', trail: 'soil', coarse: 'coarse', rooted: 'rooted' };
  const LIPPED = { grass: 'fringe', moss: 'mossFringe' };
  const buckets = {};
  function quad(key, normal, vertices, shadeValue, tint = [1, 1, 1]) {
    const b = (buckets[key] ??= { p: [], n: [], u: [], c: [], i: [] }), idx = b.p.length / 3;
    vertices.forEach((p, i) => {
      b.p.push(...p);
      b.n.push(...normal);
      b.u.push(...[[0, 1], [1, 1], [0, 0], [1, 0]][i]);
      let ao = shadeValue;
      const x = Math.floor(p[0] - 0.001), z = Math.floor(p[2] - 0.001);
      if (normal[1] > 0) {
        const adjacent = [H(x - 1, z), H(x + 1, z), H(x, z - 1), H(x, z + 1)];
        ao *= 1 - Math.min(0.35, adjacent.filter((h) => h > p[1] + 0.01).length * 0.09);
      }
      b.c.push(ao * tint[0], ao * tint[1], ao * tint[2]);
    });
    if (normal[1] > 0) b.i.push(idx, idx + 2, idx + 1, idx + 1, idx + 2, idx + 3);
    else b.i.push(idx, idx + 1, idx + 2, idx + 1, idx + 3, idx + 2);
  }
  const surfaces = new Map();
  for (let x = -46; x < 47; x++) {
    for (let z = -64; z < 14; z++) {
      if (fromCenter(x + 0.5, z + 0.5) > 16 && inView(x + 0.5, z + 0.5) < 0.42) continue; // never on screen
      const y = H(x, z), top = surfaceAt(x, z), k = 0.9 + hash(x, z, 3) * 0.16, w = hash(x, z, 4) - 0.5;
      surfaces.set(x + ',' + z, top);
      const tint = top === 'grass' ? [k * (1 + w * 0.2), k, k * (1 - w * 0.22)] : [0.96 + k * 0.05, 0.96 + k * 0.05, 0.96 + k * 0.05];
      quad(top, [0, 1, 0], [[x, y, z], [x + 1, y, z], [x, y, z + 1], [x + 1, y, z + 1]], 1, tint);
      const sides = [
        [-1, 0, [-1, 0, 0], (a) => [[x, a + 1, z + 1], [x, a + 1, z], [x, a, z + 1], [x, a, z]]],
        [1, 0, [1, 0, 0], (a) => [[x + 1, a + 1, z], [x + 1, a + 1, z + 1], [x + 1, a, z], [x + 1, a, z + 1]]],
        [0, -1, [0, 0, -1], (a) => [[x, a + 1, z], [x + 1, a + 1, z], [x, a, z], [x + 1, a, z]]],
        [0, 1, [0, 0, 1], (a) => [[x + 1, a + 1, z + 1], [x, a + 1, z + 1], [x + 1, a, z + 1], [x, a, z + 1]]],
      ];
      for (const [dx, dz, n, v] of sides) {
        const low = Math.max(y - 6, H(x + dx, z + dz));
        // Top layer in its own side texture, a band of dirt, then a mixed stone palette deeper down.
        for (let a = low; a < y; a++) {
          const key = a === y - 1 ? SIDE[top] ?? top : a >= y - 2 ? 'soil' : ROCK[Math.floor(hash3(x + dx, a, z + dz, 9) * ROCK.length)];
          quad(key, n, v(a), a === y - 1 ? 0.78 : 0.65);
        }
        if (LIPPED[top] && low < y) {
          const fh = Math.min(0.5, y - low), lip = v(y - 1).map((p, i) => [p[0] + n[0] * 0.03, i < 2 ? y : y - fh, p[2] + n[2] * 0.03]);
          quad(LIPPED[top], n, lip, 0.9, tint);
        }
      }
    }
  }
  for (const [key, b] of Object.entries(buckets)) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(b.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(b.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(b.u, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(b.c, 3));
    g.setIndex(b.i);
    g.computeBoundingSphere();
    const material = mats[key].clone();
    material.vertexColors = true;
    const m = new THREE.Mesh(g, material);
    m.castShadow = !key.endsWith('ringe');
    m.receiveShadow = true;
    group.add(m);
  }

  // Pink-petal flower beds carpet a few spots around the clearing's edge.
  const matrix = new THREE.Matrix4(), quaternion = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1);
  const petals = [];
  for (const [px, pz] of [[5.8, -3.6], [-3.4, -3.6], [9.6, -2.2], [-1.5, -6.2]]) {
    for (let dx = -2; dx <= 2; dx++) {
      for (let dz = -2; dz <= 2; dz++) {
        const x = Math.floor(px) + dx, z = Math.floor(pz) + dz;
        if (Math.hypot(dx, dz) > 2.1 || hash(x, z, 74) < 0.3 || taken(x, z) || campFloor(x + 0.5, z + 0.5) < 1.1) continue;
        petals.push([x + 0.5, H(x, z) + 0.02, z + 0.5, Math.floor(hash(x, z, 75) * 4)]);
      }
    }
  }
  const petalMesh = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
    mat(tex.petals, '#ffffff', { alphaTest: 0.4, side: THREE.DoubleSide, emissiveMap: tex.petals, emissive: '#ffffff', emissiveIntensity: 0.12 }),
    petals.length,
  );
  petals.forEach(([x, y, z, turn], i) => petalMesh.setMatrixAt(i, matrix.compose(new THREE.Vector3(x, y, z), quaternion.setFromAxisAngle(up, (turn * Math.PI) / 2), one)));
  petalMesh.receiveShadow = true;
  group.add(petalMesh);
  const petalCells = new Set(petals.map(([x, , z]) => Math.floor(x) + ',' + Math.floor(z)));

  // --- Night sky: gradient dome, stars, a pixel crescent moon and Minecraft's own drifting cloud layer.
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(80, 24, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      vertexShader: 'varying vec3 d;void main(){d=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: 'varying vec3 d;void main(){vec3 c=mix(vec3(.035,.075,.2),vec3(.004,.01,.04),smoothstep(-.02,.7,d.y));gl_FragColor=vec4(c,1.);\n#include <colorspace_fragment>\n}',
    }),
  );
  sky.renderOrder = -10;
  group.add(sky);
  const starPositions = [], phases = [];
  for (let i = 0; i < 1100; i++) {
    const a = R() * Math.PI * 2, y = 0.12 + R() * 0.85, r = Math.sqrt(1 - y * y) * 69;
    starPositions.push(Math.cos(a) * r, y * 69, Math.sin(a) * r);
    phases.push(R() * 6.28);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
  starGeo.setAttribute('phase', new THREE.Float32BufferAttribute(phases, 1));
  const starTime = { value: 0 };
  const stars = new THREE.Points(starGeo, new THREE.ShaderMaterial({
    uniforms: { time: starTime },
    vertexShader: 'attribute float phase;uniform float time;varying float alpha;void main(){alpha=.5+.3*sin(time*.55+phase);gl_PointSize=1.5+mod(phase,1.)*1.7;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: 'varying float alpha;void main(){gl_FragColor=vec4(.5,.66,1.,alpha);}',
    transparent: true,
    depthWrite: false,
  }));
  stars.renderOrder = -8;
  group.add(stars);
  const moonCanvas = document.createElement('canvas');
  moonCanvas.width = moonCanvas.height = 32;
  const mg = moonCanvas.getContext('2d');
  mg.fillStyle = '#e1eac8';
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) if ((x - 16) ** 2 + (y - 16) ** 2 < 144 && (x - 20) ** 2 + (y - 12) ** 2 > 121) mg.fillRect(x, y, 1, 1);
  const moonTex = new THREE.CanvasTexture(moonCanvas);
  moonTex.colorSpace = THREE.SRGBColorSpace;
  moonTex.magFilter = THREE.NearestFilter;
  const moonMat = new THREE.SpriteMaterial({ map: moonTex, color: '#dce4dc', fog: false });
  moonMat.color.multiplyScalar(1.8); // just over the bloom threshold, for a soft moon glow
  const moon = new THREE.Sprite(moonMat);
  moon.scale.set(3.8, 3.8, 1);
  group.add(moon);

  const cloudPixels = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d');
    g.drawImage(images.clouds, 0, 0);
    const data = g.getImageData(0, 0, 256, 256).data, solid = new Uint8Array(256 * 256);
    for (let i = 0; i < solid.length; i++) solid[i] = data[i * 4 + 3] > 128 ? 1 : 0;
    return solid;
  })();
  const clouds = new THREE.Mesh(
    cloudGeometry(cloudPixels, 100, 60),
    new THREE.MeshBasicMaterial({ color: '#56688f', vertexColors: true, transparent: true, opacity: 0.78, fog: false }),
  );
  clouds.position.set(CENTER[0], CLOUD.y, CENTER[1] - 90);
  clouds.renderOrder = -6;
  group.add(clouds);
  let cloudShift = 0;

  // --- Batch every static unit box into instanced meshes per material, split into a "near" set around the
  // clearing that casts shadows and a "far" set that doesn't, so shadow passes only redraw what can shade it.
  group.updateMatrixWorld(true);
  const batches = new Map(), batched = [], position = new THREE.Vector3();
  group.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || o.geometry !== unit) return;
    position.setFromMatrixPosition(o.matrixWorld);
    const near = fromCenter(position.x, position.z) < 17, key = o.material.uuid + (near ? ':near' : ':far');
    if (!batches.has(key)) batches.set(key, { material: o.material, near, list: [] });
    batches.get(key).list.push(o);
    batched.push(o);
  });
  for (const { material, near, list } of batches.values()) {
    const mesh = new THREE.InstancedMesh(unit, material, list.length);
    list.forEach((o, i) => mesh.setMatrixAt(i, o.matrixWorld));
    mesh.castShadow = near && material !== mats.vine;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  batched.forEach((o) => o.parent.remove(o));

  // --- Undergrowth: full-size vanilla cross plants in clumps: grass and flowers in the open, ferns and
  // mushrooms under the trees, berry bushes along the woodland edge. Normals point up so plants take the light
  // of the ground they grow from (as in the game), and they sway in the breeze.
  const breeze = { value: 0 };
  const wind = (material) => {
    material.onBeforeCompile = (shader) => {
      shader.uniforms.campBreeze = breeze;
      shader.vertexShader = 'uniform float campBreeze;\n' + shader.vertexShader.replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\n#ifdef USE_INSTANCING\nfloat sway=campBreeze*.9+instanceMatrix[3].x*.7+instanceMatrix[3].z*.5;transformed.x+=sin(sway)*.035*position.y;transformed.z+=cos(sway*.8)*.02*position.y;\n#endif',
      );
    };
    material.customProgramCacheKey = () => 'camp-breeze-2';
    return material;
  };
  function crossGeometry(lift) {
    const plane = new THREE.PlaneGeometry(1.27, 1).translate(0, 0.5 + lift, 0);
    const geometry = mergeGeometries([plane.clone().rotateY(Math.PI / 4), plane.clone().rotateY(-Math.PI / 4)]);
    const normal = geometry.attributes.normal;
    for (let i = 0; i < normal.count; i++) normal.setXYZ(i, 0, 1, 0);
    return geometry;
  }
  const crosses = [crossGeometry(0), crossGeometry(1)];
  const plantMaterial = (name, tint, glow) => {
    const map = texture(name, tint);
    return wind(mat(map, '#ffffff', { alphaTest: 0.5, side: THREE.DoubleSide, emissiveMap: map, emissive: '#ffffff', emissiveIntensity: glow }));
  };
  const PLANTS = {
    grass: [['short_grass', GRASS]], fern: [['fern', GRASS]], berries: [['sweet_berry_bush_stage3']],
    redMushroom: [['red_mushroom']], brownMushroom: [['brown_mushroom']],
    tallGrass: [['tall_grass_bottom', GRASS], ['tall_grass_top', GRASS]], largeFern: [['large_fern_bottom', GRASS], ['large_fern_top', GRASS]],
    poppy: [['poppy']], dandelion: [['dandelion']], cornflower: [['cornflower']], bluet: [['azure_bluet']], daisy: [['oxeye_daisy']],
  };
  const FLOWERS = ['poppy', 'dandelion', 'cornflower', 'bluet', 'daisy'], SMALL = [...FLOWERS, 'berries', 'redMushroom', 'brownMushroom'];
  // Hand-placed flower patches where the camera sees them, each mixing two kinds like a builder's flower bed.
  const PATCHES = [[0.5, -4.4, 'poppy', 'dandelion'], [3.4, -4.8, 'cornflower', 'daisy'], [-4.6, -2.6, 'bluet', 'poppy'],
    [6.6, -2.4, 'dandelion', 'cornflower'], [8.6, -1.2, 'poppy', 'daisy'], [-2.4, -6.4, 'daisy', 'bluet']];
  const sites = Object.fromEntries(Object.keys(PLANTS).map((k) => [k, []]));
  for (let x = -30; x <= 32; x++) {
    for (let z = -40; z <= 9; z++) {
      const top = surfaces.get(x + ',' + z);
      if (!['grass', 'moss', 'podzol'].includes(top) || taken(x, z) || petalCells.has(x + ',' + z)) continue;
      const cx = x + 0.5, cz = z + 0.5;
      if (campFloor(cx, cz) < 1.2 || onPath(cx, cz, 1.8) || PROPS.some(([px, pz]) => Math.hypot(cx - px, cz - pz) < 1.8)) continue;
      if ((cz > 0.8 && cx > -4.5) || inView(cx, cz) < 0.45) continue; // the lens's own foreground, and off-screen
      const patch = top === 'grass' && PATCHES.find(([px, pz]) => Math.hypot(cx - px, cz - pz) < 1.8);
      const density = noise(x, z, 4.5, 11) * (fromCenter(cx, cz) > 20 ? 0.7 : 1) * (top === 'moss' ? 0.65 : 1);
      if (!patch && hash(x, z, 12) > density * 1.1 - 0.1) continue;
      let kind;
      const r = hash(x, z, 16);
      if (patch && hash(x, z, 25) < 0.8) kind = hash(x, z, 26) < 0.55 ? patch[2] : patch[3];
      else if (top === 'podzol') kind = r < 0.1 ? (r < 0.05 ? 'redMushroom' : 'brownMushroom') : r < 0.35 ? 'largeFern' : r < 0.8 ? 'fern' : 'grass';
      else if (top === 'grass' && noise(x, z, 6, 13) > 0.58 && hash(x, z, 14) < 0.8) {
        const pick = Math.min(0.999, Math.max(0, noise(x, z, 11, 15) * 2.2 - 0.6));
        kind = FLOWERS[Math.floor(pick * FLOWERS.length)];
      } else if (r < 0.05 && z < -1) kind = 'berries';
      else if (r < 0.08 && top === 'moss') kind = 'brownMushroom';
      else kind = z < -2 && r < 0.17 ? 'tallGrass' : z < -2 && r < 0.22 ? 'largeFern' : r < 0.4 ? 'fern' : 'grass';
      sites[kind].push([cx + (hash(x, z, 17) - 0.5) * 0.5, H(x, z), cz + (hash(x, z, 18) - 0.5) * 0.5, hash(x, z, 19), hash(x, z, 20)]);
    }
  }
  const tint = new THREE.Color();
  for (const [kind, layers] of Object.entries(PLANTS)) {
    const list = sites[kind];
    if (!list.length) continue;
    const small = SMALL.includes(kind), mushroom = kind.endsWith('Mushroom');
    layers.forEach(([name, color], level) => {
      const mesh = new THREE.InstancedMesh(crosses[level], plantMaterial(name, color, small ? 0.16 : 0.14), list.length);
      list.forEach(([x, y, z, a, b], i) => {
        const s = (mushroom ? 0.7 : small ? 0.82 : 0.86) + a * 0.2, k = 0.86 + b * 0.22, w = a - 0.5;
        quaternion.setFromAxisAngle(up, (b - 0.5) * 0.6);
        mesh.setMatrixAt(i, matrix.compose(new THREE.Vector3(x, y, z), quaternion, new THREE.Vector3(s, s, s)));
        mesh.setColorAt(i, small ? tint.setRGB(k, k, k) : tint.setRGB(k * (1 + w * 0.14), k, k * (1 - w * 0.14)));
      });
      mesh.receiveShadow = true;
      group.add(mesh);
    });
  }

  return {
    group,
    moon,
    oak: { side: tex.log, end: tex.logTop },
    tick(ambient) {
      breeze.value = ambient;
      starTime.value = ambient;
      // Clouds drift east like the game's; whenever they pass a whole cell the slab is rebuilt one texel on,
      // so the layer flows forever without popping.
      const travel = ambient * CLOUD.speed, whole = Math.floor(travel / CLOUD.cell);
      clouds.position.x = CENTER[0] + travel - whole * CLOUD.cell;
      if (whole !== cloudShift) {
        cloudShift = whole;
        clouds.geometry.dispose();
        clouds.geometry = cloudGeometry(cloudPixels, 100 - whole, 60);
      }
    },
    dispose() {
      group.traverse((o) => {
        o.geometry?.dispose();
        if (o.material) {
          for (const m of [o.material].flat()) {
            m.map?.dispose();
            m.dispose();
          }
        }
      });
    },
  };
}
