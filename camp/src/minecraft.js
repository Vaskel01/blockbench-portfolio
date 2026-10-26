// Minecraft geometry helpers: pixel textures, block-model JSON elements, entity cubes and the player skin.
import * as THREE from 'three';

export const PX = 1 / 16;

// Crisp nearest-neighbour texture straight from a Minecraft PNG. Animated strips show one frame at a time.
// Model atlases (campfire, chest, skin) get no mipmaps: their small UV regions sit right next to unrelated
// pixels, and averaged mip levels would smear those neighbours into every face edge.
export function pixelTexture(image, { frames = 1, repeat = false } = {}) {
  const texture = new THREE.Texture(image);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  if (repeat) texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  if (frames > 1) setFrame(texture, 0, frames);
  texture.needsUpdate = true;
  return texture;
}

// Shows one 16px frame of a vertical animation strip. The window is inset by a sliver of a texel so nearest
// sampling at a face's edge can never pick up the neighbouring frame's border row (it drew a thin "X" of fire
// pixels above the campfire's crossed flame planes).
export function setFrame(texture, frame, frames) {
  const texel = 1 / (16 * frames);
  texture.repeat.set(1, 1 / frames - texel * 0.1);
  texture.offset.set(0, 1 - (frame + 1) / frames + texel * 0.05);
}

// Face corners in [top-left, top-right, bottom-left, bottom-right] order as seen from outside the block.
const FACES = {
  north: [[0, 0, -1], (a, b) => [[b[0], b[1], a[2]], [a[0], b[1], a[2]], [b[0], a[1], a[2]], [a[0], a[1], a[2]]]],
  south: [[0, 0, 1], (a, b) => [[a[0], b[1], b[2]], [b[0], b[1], b[2]], [a[0], a[1], b[2]], [b[0], a[1], b[2]]]],
  west: [[-1, 0, 0], (a, b) => [[a[0], b[1], a[2]], [a[0], b[1], b[2]], [a[0], a[1], a[2]], [a[0], a[1], b[2]]]],
  east: [[1, 0, 0], (a, b) => [[b[0], b[1], b[2]], [b[0], b[1], a[2]], [b[0], a[1], b[2]], [b[0], a[1], a[2]]]],
  up: [[0, 1, 0], (a, b) => [[a[0], b[1], a[2]], [b[0], b[1], a[2]], [a[0], b[1], b[2]], [b[0], b[1], b[2]]]],
  down: [[0, -1, 0], (a, b) => [[a[0], a[1], b[2]], [b[0], a[1], b[2]], [a[0], a[1], a[2]], [b[0], a[1], a[2]]]],
};

// Minecraft element rotation: around `origin` on one axis, optionally rescaled to keep the full block width.
function elementRotation({ origin, axis, angle, rescale }) {
  const r = (angle * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r), k = rescale ? 1 / c : 1;
  const [i, j] = axis === 'x' ? [1, 2] : axis === 'y' ? [2, 0] : [0, 1];
  const turn = (p) => {
    const q = [...p];
    q[i] = p[i] * c - p[j] * s;
    q[j] = p[i] * s + p[j] * c;
    return q;
  };
  return {
    point(p) {
      const d = p.map((v, n) => v - origin[n]);
      d[i] *= k;
      d[j] *= k;
      return turn(d).map((v, n) => v + origin[n]);
    },
    normal: turn,
  };
}

// Builds one BufferGeometry per texture variable ("log", "lit_log", "fire", ...) from block-model elements.
// The block is centred on x/z and stands on y = 0, in block units.
export function blockModel(elements) {
  const parts = {};
  for (const element of elements) {
    const rotation = element.rotation && elementRotation(element.rotation);
    for (const [name, face] of Object.entries(element.faces)) {
      const [normal, corners] = FACES[name];
      const part = (parts[face.texture.slice(1)] ??= { position: [], normal: [], uv: [], index: [] });
      const base = part.position.length / 3;
      // Pull each UV rectangle a hair inside its texel bounds so nearest sampling at a face's edge never
      // reads the neighbouring region of the texture (that drew dark seams and stray glow on the logs).
      const [a1, b1, a2, b2] = face.uv, inU = Math.sign(a2 - a1) * 0.02, inV = Math.sign(b2 - b1) * 0.02;
      const [u1, v1, u2, v2] = [a1 + inU, b1 + inV, a2 - inU, b2 - inV];
      const clockwise = [[u1, v1], [u2, v1], [u2, v2], [u1, v2]];
      const steps = (face.rotation || 0) / 90;
      corners(element.from, element.to).forEach((corner, n) => {
        const p = rotation ? rotation.point(corner) : corner;
        part.position.push((p[0] - 8) * PX, p[1] * PX, (p[2] - 8) * PX);
        part.normal.push(...(rotation ? rotation.normal(normal) : normal));
        const [u, v] = clockwise[([0, 1, 3, 2][n] - steps + 4) % 4];
        part.uv.push(u / 16, 1 - v / 16);
      });
      part.index.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
    }
  }
  const geometries = {};
  for (const [key, part] of Object.entries(parts)) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(part.position, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(part.normal, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(part.uv, 2));
    geometry.setIndex(part.index);
    geometry.computeBoundingSphere();
    geometries[key] = geometry;
  }
  return geometries;
}

// Vanilla template_campfire.json (Minecraft 1.21.1): four crossed logs, the ember bed and two crossed fire planes.
export const CAMPFIRE_ELEMENTS = [
  { from: [1, 0, 0], to: [5, 4, 16], faces: {
    north: { uv: [0, 4, 4, 8], texture: '#log' }, east: { uv: [0, 1, 16, 5], texture: '#lit_log' },
    south: { uv: [0, 4, 4, 8], texture: '#log' }, west: { uv: [16, 0, 0, 4], texture: '#log' },
    up: { uv: [0, 0, 16, 4], rotation: 90, texture: '#log' }, down: { uv: [0, 0, 16, 4], rotation: 90, texture: '#log' } } },
  { from: [0, 3, 11], to: [16, 7, 15], faces: {
    north: { uv: [16, 0, 0, 4], texture: '#lit_log' }, east: { uv: [0, 4, 4, 8], texture: '#log' },
    south: { uv: [0, 0, 16, 4], texture: '#lit_log' }, west: { uv: [0, 4, 4, 8], texture: '#log' },
    up: { uv: [0, 0, 16, 4], rotation: 180, texture: '#log' }, down: { uv: [0, 4, 16, 8], texture: '#lit_log' } } },
  { from: [11, 0, 0], to: [15, 4, 16], faces: {
    north: { uv: [0, 4, 4, 8], texture: '#log' }, east: { uv: [0, 0, 16, 4], texture: '#log' },
    south: { uv: [0, 4, 4, 8], texture: '#log' }, west: { uv: [16, 1, 0, 5], texture: '#lit_log' },
    up: { uv: [0, 0, 16, 4], rotation: 90, texture: '#log' }, down: { uv: [0, 0, 16, 4], rotation: 90, texture: '#log' } } },
  { from: [0, 3, 1], to: [16, 7, 5], faces: {
    north: { uv: [0, 0, 16, 4], texture: '#lit_log' }, east: { uv: [0, 4, 4, 8], texture: '#log' },
    south: { uv: [16, 0, 0, 4], texture: '#lit_log' }, west: { uv: [0, 4, 4, 8], texture: '#log' },
    up: { uv: [0, 0, 16, 4], rotation: 180, texture: '#log' }, down: { uv: [0, 4, 16, 8], texture: '#lit_log' } } },
  { from: [5, 0, 0], to: [11, 1, 16], faces: {
    north: { uv: [0, 15, 6, 16], texture: '#log' }, south: { uv: [10, 15, 16, 16], texture: '#log' },
    up: { uv: [0, 8, 16, 14], rotation: 90, texture: '#lit_log' }, down: { uv: [0, 8, 16, 14], rotation: 90, texture: '#log' } } },
  { from: [0.8, 1, 8], to: [15.2, 17, 8], rotation: { origin: [8, 8, 8], axis: 'y', angle: 45, rescale: true }, faces: {
    north: { uv: [0, 0, 16, 16], texture: '#fire' }, south: { uv: [0, 0, 16, 16], texture: '#fire' } } },
  { from: [8, 1, 0.8], to: [8, 17, 15.2], rotation: { origin: [8, 8, 8], axis: 'y', angle: 45, rescale: true }, faces: {
    west: { uv: [0, 0, 16, 16], texture: '#fire' }, east: { uv: [0, 0, 16, 16], texture: '#fire' } } },
];

// Minecraft entity cube with the standard box UV layout at (u, v). BoxGeometry faces are +x,-x,+y,-y,+z,-z,
// i.e. east, west, up, down, south, north. Block-entity textures (chests) are stored upside down, so their
// side faces are turned 180°; the player skin is not (`flipSides` false).
export function entityBox(w, h, d, u, v, { size = 64, inflate = 0, flipSides = true } = {}) {
  const geometry = new THREE.BoxGeometry((w + inflate) * PX, (h + inflate) * PX, (d + inflate) * PX);
  const uv = geometry.attributes.uv;
  const rects = flipSides
    ? [[u + d + w, v + d, d, h], [u, v + d, d, h], [u + d + w, v, w, d], [u + d, v, w, d], [u + 2 * d + w, v + d, w, h], [u + d, v + d, w, h]]
    : [[u, v + d, d, h], [u + d + w, v + d, d, h], [u + d, v, w, d], [u + d + w, v, w, d], [u + d, v + d, w, h], [u + 2 * d + w, v + d, w, h]];
  rects.forEach(([x, y, fw, fh], f) => {
    // A hair of inset keeps nearest sampling from bleeding into neighbouring regions.
    let a = (x + 0.02) / size, b = (x + fw - 0.02) / size, top = 1 - (y + 0.02) / size, bottom = 1 - (y + fh - 0.02) / size;
    if (flipSides && f !== 2 && f !== 3) [a, b, top, bottom] = [b, a, bottom, top];
    uv.setXY(f * 4, a, top);
    uv.setXY(f * 4 + 1, b, top);
    uv.setXY(f * 4 + 2, a, bottom);
    uv.setXY(f * 4 + 3, b, bottom);
  });
  return geometry;
}

// Box with block-scale UVs: bark grain runs along the longest side and the two end faces show the log rings.
export function logGeometry(w, h, d) {
  const geometry = new THREE.BoxGeometry(w, h, d), uv = geometry.attributes.uv;
  const long = w >= h && w >= d ? 0 : h >= d ? 1 : 2;
  const spans = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]], uAxis = [2, 2, 0, 0, 0, 0];
  for (let f = 0; f < 6; f++) {
    if (f >> 1 === long) continue;
    const [su, sv] = spans[f];
    for (let k = 0; k < 4; k++) {
      const i = f * 4 + k, a = uv.getX(i), b = uv.getY(i);
      if (uAxis[f] === long) uv.setXY(i, b * sv, a * su);
      else uv.setXY(i, a * su, b * sv);
    }
  }
  geometry.clearGroups();
  for (let f = 0; f < 6; f++) geometry.addGroup(f * 6, 6, f >> 1 === long ? 1 : 0);
  return geometry;
}
