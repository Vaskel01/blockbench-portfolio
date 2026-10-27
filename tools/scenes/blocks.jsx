// Block-built worlds for the portfolio scenes: 16×16 block textures painted in code (bricks, concrete, terracotta,
// copper roofing, deepslate, cherry leaves, glass, lantern paper and more, in the style of the vanilla game), and a
// mesher that turns a list of blocks into a few meshes, skipping every face hidden against a solid neighbour. In a
// Blockbench export (?bbmodel) each visible block becomes its own cube instead, so the build stays editable.
import { useMemo } from 'react';
import * as THREE from 'three';
import { pixelCanvas, pixelMap, seeded } from './kit.jsx';

// Small palette helpers: a five-step ramp from a base colour, darkest to brightest.
export function ramp(hex, spread = 0.18) {
  const base = new THREE.Color(hex);
  const hsl = {};
  base.getHSL(hsl);
  return [-2, -1, 0, 1, 2].map((step) => {
    const c = new THREE.Color().setHSL(hsl.h, Math.min(1, hsl.s * (1 + step * 0.04)), Math.min(0.97, Math.max(0.02, hsl.l + step * spread * (step < 0 ? 0.9 : 0.7))));
    return `#${c.getHexString()}`;
  });
}

// Each painter fills a 16×16 tile through put(x, y, colour[, alpha]) with its own seeded random stream.
const PAINTERS = {
  // Running-bond masonry: courses `rows` tall, units `unit` wide, each its own tone, lit along the top.
  masonry: (put, r, { colors, rows = 4, unit = 8, mortar }) => {
    for (let y = 0, row = 0; y < 16; y += rows, row++) {
      const shift = row % 2 ? unit / 2 : 0;
      for (let x = -shift; x < 16; x += unit) {
        const tone = r() < 0.3 ? 3 : r() < 0.35 ? 1 : 2;
        for (let j = 0; j < rows; j++) {
          for (let i = 0; i < unit; i++) {
            const px = (x + i + 16) % 16;
            const line = i === unit - 1 || j === rows - 1;
            put(px, y + j, line ? mortar || colors[0] : j === 0 ? colors[Math.min(4, tone + 1)] : r() < 0.12 ? colors[Math.max(0, tone - 1)] : colors[tone]);
          }
        }
      }
    }
  },
  // Flat poured surface with sparse speckle.
  flat: (put, r, { colors, speckle = 0.08 }) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) put(x, y, r() < speckle ? colors[r() < 0.5 ? 1 : 3] : colors[2]);
  },
  // Grainy fired clay or gravel: heavier mottling.
  mottled: (put, r, { colors, amount = 0.45 }) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) put(x, y, r() < amount ? colors[[1, 3, 1, 3, 0, 4][Math.floor(r() * 6)]] : colors[2]);
  },
  // Square tiles with dark joints (deepslate tiles, paving, cut copper).
  tiles: (put, r, { colors, size = 8, patina }) => {
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const [i, j] = [x % size, y % size];
        let tone = i === size - 1 || j === size - 1 ? 0 : i === 0 || j === 0 ? 3 : r() < 0.15 ? 1 : 2;
        let color = colors[tone];
        if (patina && tone > 0 && r() < patina.amount) color = patina.colors[1 + Math.floor(r() * 3)];
        put(x, y, color);
      }
    }
  },
  // Planks: four boards with seams, grain and a nail head here and there.
  planks: (put, r, { colors }) => {
    for (let y = 0; y < 16; y += 4) {
      const tone = r() < 0.4 ? 3 : r() < 0.3 ? 1 : 2;
      for (let j = 0; j < 4; j++) for (let x = 0; x < 16; x++) put(x, y + j, j === 3 ? colors[0] : j === 0 ? colors[Math.min(4, tone + 1)] : r() < 0.18 ? colors[Math.max(0, tone - 1)] : colors[tone]);
      const seam = Math.floor(r() * 16);
      for (let j = 0; j < 3; j++) put(seam, y + j, colors[0]);
    }
  },
  // Log bark: vertical furrows.
  bark: (put, r, { colors }) => {
    for (let x = 0; x < 16; x++) {
      const tone = x % 4 === 0 ? 0 : x % 4 === 2 ? 3 : 2;
      for (let y = 0; y < 16; y++) put(x, y, r() < 0.2 ? colors[Math.max(0, tone - 1)] : colors[tone]);
    }
  },
  // Log end grain: rings around the heart.
  rings: (put, r, { colors, bark }) => {
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
        put(x, y, d > 6.5 ? bark[1] : colors[[2, 3, 2, 1][Math.floor(d) % 4]]);
      }
    }
  },
  // Leaves: clusters with clear gaps between, so light falls through.
  leaves: (put, r, { colors, blossom }) => {
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        if (r() < 0.07) continue;
        const flower = blossom && r() < 0.16;
        put(x, y, flower ? blossom[r() < 0.5 ? 3 : 2] : colors[[1, 2, 2, 3, 1][Math.floor(r() * 5)]]);
      }
    }
  },
  // Glass: a frame and a streak, the panes nearly clear.
  glass: (put, r, { colors }) => {
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const frame = x === 0 || y === 0 || x === 15 || y === 15;
        const streak = x + y === 10 || x + y === 11 || x + y === 20;
        put(x, y, frame ? colors[1] : streak ? colors[4] : colors[2], frame ? 255 : streak ? 150 : 60);
      }
    }
  },
  // A window in a wall: frame, mullions and dark glass, optionally lit from inside.
  window: (put, r, { colors, glass, lit }) => {
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const frame = x < 2 || x > 13 || y < 2 || y > 13 || x === 7 || x === 8 || y === 7;
        put(x, y, frame ? colors[x < 2 || y < 2 ? 3 : 1] : lit ? lit[x + y < 14 ? 3 : 2] : glass[x - y > 4 ? 2 : 1]);
      }
    }
  },
  // Paper lantern panel: ribs over glowing paper.
  lantern: (put, r, { colors }) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) put(x, y, y < 2 || y > 13 ? colors[0] : x % 4 === 0 ? colors[1] : colors[y < 8 ? 4 : 3]);
  },
  // Froglight / glowstone style light block: bright cells with darker seams.
  light: (put, r, { colors }) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) put(x, y, (x % 5 === 0 || y % 5 === 0) && r() < 0.7 ? colors[2] : colors[r() < 0.5 ? 4 : 3]);
  },
  // Wool / cloth weave.
  weave: (put, r, { colors }) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) put(x, y, colors[(x + y * 2) % 4 === 0 ? 3 : (x * 3 + y) % 5 === 0 ? 1 : 2]);
  },
  // Polished stone: a bevelled slab with a soft sheen.
  polished: (put, r, { colors }) => {
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const edge = x === 0 || y === 0 ? 4 : x === 15 || y === 15 ? 0 : x === 1 || y === 1 ? 3 : x === 14 || y === 14 ? 1 : 2;
        put(x, y, edge === 2 && r() < 0.1 ? colors[r() < 0.5 ? 1 : 3] : colors[edge]);
      }
    }
  },
  // Lattice screen: a grid of wooden bars over dark paper.
  lattice: (put, r, { colors, paper, step = 4 }) => {
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const [i, j] = [x % step, y % step];
        put(x, y, i === 0 || j === 0 ? colors[i === 0 && j === 0 ? 4 : 3] : i === 1 || j === 1 ? colors[1] : paper[j < step / 2 ? 2 : 1]);
      }
    }
  },
  // Iron bars: thin uprights on a clear background.
  bars: (put, r, { colors }) => {
    for (let y = 0; y < 16; y++) for (const x of [1, 2, 7, 8, 13, 14]) put(x, y, colors[x % 2 ? 3 : 1]);
    for (let x = 0; x < 16; x++) for (const y of [0, 15]) put(x, y, colors[2]);
  },
};

const tileCache = new Map();
// A painted block texture: `kind` names a painter, the rest are its options. Same spec, same canvas.
export function tile(kind, options = {}) {
  const key = kind + JSON.stringify(options);
  if (!tileCache.has(key)) {
    const { put, flush } = pixelCanvas(16, 16);
    PAINTERS[kind](put, seeded(options.seed || key.length * 97 + 13), options);
    tileCache.set(key, flush());
  }
  return tileCache.get(key);
}

// The block set: each type has top, side and bottom tiles plus how it renders. `see` marks blocks that never hide a
// neighbour's face (glass, leaves, bars), `glow` makes them emissive.
export function blockType({ top, side, bottom, all, glow = 0, see = false, roughness = 0.9, metalness = 0 }) {
  return { top: top || all, side: side || all, bottom: bottom || top || all, glow, see, roughness, metalness };
}

// Face corners of a unit block, bottom-left, bottom-right, top-right, top-left as seen from outside.
const FACES = [
  { dir: [1, 0, 0], face: 'side', corners: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]] },
  { dir: [-1, 0, 0], face: 'side', corners: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]] },
  { dir: [0, 1, 0], face: 'top', corners: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]] },
  { dir: [0, -1, 0], face: 'bottom', corners: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
  { dir: [0, 0, 1], face: 'side', corners: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]] },
  { dir: [0, 0, -1], face: 'side', corners: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]] },
];
const UVS = [[0, 0], [1, 0], [1, 1], [0, 1]];
const exportMode = typeof location !== 'undefined' && new URLSearchParams(location.search).has('bbmodel');

function material(canvas, type) {
  const map = pixelMap(canvas);
  const m = new THREE.MeshStandardMaterial({ map, roughness: type.roughness, metalness: type.metalness, alphaTest: 0.08 });
  if (type.see) Object.assign(m, { transparent: true, side: THREE.DoubleSide, depthWrite: true });
  if (type.glow) Object.assign(m, { emissiveMap: map, emissive: new THREE.Color('#ffffff'), emissiveIntensity: type.glow });
  return m;
}

// A build: `blocks` is a list of [x, y, z, type] in whole-block coordinates (block x spans x..x+1), `types` maps type
// names to blockType()s. Later blocks replace earlier ones at the same spot.
export function Blocks({ name = 'blocks', blocks, types, ...props }) {
  const meshes = useMemo(() => {
    const grid = new Map();
    for (const [x, y, z, t] of blocks) grid.set(`${x},${y},${z}`, [x, y, z, t]);
    const materials = new Map();
    const materialFor = (t, face) => {
      const key = `${t}:${face}`;
      if (!materials.has(key)) materials.set(key, material(types[t][face], types[t]));
      return materials.get(key);
    };
    const hidden = (x, y, z, dir, t) => {
      const n = grid.get(`${x + dir[0]},${y + dir[1]},${z + dir[2]}`);
      if (!n) return false;
      return !types[n[3]].see || n[3] === t;
    };
    if (exportMode) {
      // One cube per visible block; materials in BoxGeometry face order (+x, -x, +y, -y, +z, -z).
      const box = new THREE.BoxGeometry(1, 1, 1);
      return [...grid.values()].filter(([x, y, z, t]) => FACES.some((f) => !hidden(x, y, z, f.dir, t))).map(([x, y, z, t]) => ({
        key: `${x},${y},${z}`, geometry: box, material: FACES.map((f) => materialFor(t, f.face)), position: [x + 0.5, y + 0.5, z + 0.5], name: t,
      }));
    }
    const buckets = new Map();
    for (const [x, y, z, t] of grid.values()) {
      for (const f of FACES) {
        if (hidden(x, y, z, f.dir, t)) continue;
        const key = `${t}:${f.face}`;
        if (!buckets.has(key)) buckets.set(key, { position: [], normal: [], uv: [], index: [], t, face: f.face });
        const b = buckets.get(key);
        const base = b.position.length / 3;
        f.corners.forEach(([cx, cy, cz], i) => {
          b.position.push(x + cx, y + cy, z + cz);
          b.normal.push(...f.dir);
          b.uv.push(...UVS[i]);
        });
        b.index.push(base, base + 1, base + 2, base, base + 2, base + 3);
      }
    }
    return [...buckets.entries()].map(([key, b]) => {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(b.position, 3));
      geometry.setAttribute('normal', new THREE.Float32BufferAttribute(b.normal, 3));
      geometry.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2));
      geometry.setIndex(b.index);
      return { key, geometry, material: materialFor(b.t, b.face), position: [0, 0, 0], name: b.t };
    });
  }, [blocks, types]);
  return (
    <group name={name} {...props}>
      {meshes.map((m) => <mesh key={m.key} geometry={m.geometry} material={m.material} position={m.position} userData={{ name: m.name }} castShadow receiveShadow />)}
    </group>
  );
}

// Helpers for building: fill a box of blocks, or a hollow shell of walls.
export function fill(out, [x0, y0, z0], [x1, y1, z1], t) {
  for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) {
    for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) {
      for (let z = Math.min(z0, z1); z <= Math.max(z0, z1); z++) out.push([x, y, z, typeof t === 'function' ? t(x, y, z) : t]);
    }
  }
  return out;
}
