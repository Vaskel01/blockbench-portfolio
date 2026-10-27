// Portfolio scene: a wushu duel in a mountain temple courtyard at golden hour, path-traced. A fighter in red silk flies
// in with a side kick, jian swept back; a fighter in blue braces low and takes it on his staff, and the strike flashes
// between them. Behind: a temple built block by block (red lacquer pillars, lattice walls, a stepped copper-green
// roof with flicked-up eaves), glowing lanterns, a cherry tree shedding petals, a weapon rack from the Wushu pack and
// hazy mountains. `npm run render:scene wushu` renders it; `bbmodel` exports it, `preview`/`quick` check it.
import { useMemo } from 'react';
import { Blocks, blockType, fill, ramp, tile } from './blocks.jsx';
import { Character, Dome, Orbit, Part, RAMPS, paintPerson, px, seeded, start } from './kit.jsx';

Object.assign(RAMPS, {
  stone: ['#5d5a57', '#8f8a82', '#aaa398', '#c2baab', '#dcd3c2'],
  lacquer: ['#3a0a0c', '#6e1418', '#9e2024', '#c43a32', '#e8705a'],
  teal: ['#0c2a32', '#16525e', '#227684', '#3aa0a8', '#86d6d0'],
  mountain: ['#3a5a66', '#4e727c', '#668c94', '#86a8ac', '#b4ccca'],
  bamboo: ['#4a3a10', '#8a7020', '#b49a34', '#d4bc54', '#f2e08c'],
  blossom: ['#7a2a4a', '#c45482', '#e682a8', '#f6aecb', '#ffe2ee'],
  dust: ['#8a7458', '#a88e6c', '#c4aa86', '#d8c2a0', '#ece0c8'],
  flash: ['#ffb040', '#ffd070', '#fff0b0', '#fffce8', '#ffffff'],
  skinTan: ['#4a2a1a', '#a0603a', '#d08a58', '#e8a874', '#ffcfa0'],
  skinFair: ['#5a3424', '#b87a56', '#e2a47c', '#f2bf98', '#ffdcc0'],
  hairBlack: ['#07070a', '#121118', '#1c1a24', '#2a2734', '#3e3a4c'],
  silkRed: ['#4a0a12', '#8e1420', '#c4222e', '#e8484a', '#ff8a7a'],
  silkBlue: ['#0a1e3e', '#173e74', '#2462a8', '#3e8ad0', '#86c0f0'],
  clothBlack: ['#08080c', '#15151c', '#202029', '#2c2c38', '#40404e'],
  clothGrey: ['#22242c', '#3a3d48', '#4e5260', '#666b7a', '#8a8f9e'],
  linen: ['#7a7060', '#b8ac94', '#d8ccb2', '#ebe1c8', '#faf4e2'],
});

const random = seeded(17);

// The block set: courtyard paving, stone platform, lacquered pillars, lattice, copper roofing, gold trim and a cherry
// tree.
const TYPES = {
  paving: blockType({ top: tile('tiles', { colors: ramp('#b8b0a2', 0.06), size: 8 }), side: tile('masonry', { colors: ramp('#a39b8e', 0.07), rows: 8, unit: 16 }) }),
  pavingDark: blockType({ top: tile('tiles', { colors: ramp('#958d80', 0.06), size: 8, seed: 3 }), side: tile('masonry', { colors: ramp('#8b8478', 0.07), rows: 8, unit: 16 }) }),
  platform: blockType({ all: tile('masonry', { colors: ramp('#9c968c', 0.07), rows: 8, unit: 8 }), top: tile('tiles', { colors: ramp('#b0a99c', 0.05), size: 16 }) }),
  lacquer: blockType({ side: tile('polished', { colors: ramp('#a82228', 0.09) }), top: tile('polished', { colors: ramp('#8a1a20', 0.09) }), roughness: 0.55 }),
  lacquerDark: blockType({ all: tile('planks', { colors: ramp('#6a1418', 0.08) }), roughness: 0.6 }),
  lattice: blockType({ all: tile('lattice', { colors: ramp('#9a2a22', 0.1), paper: ramp('#3a1a10', 0.06) }) }),
  door: blockType({ all: tile('lattice', { colors: ramp('#b83a26', 0.1), paper: ramp('#e8c890', 0.06), step: 5 }), glow: 0.15 }),
  gold: blockType({ all: tile('polished', { colors: ramp('#e2a32e', 0.12) }), roughness: 0.35, metalness: 0.6 }),
  teal: blockType({ all: tile('tiles', { colors: ramp('#2a8a8a', 0.1), size: 4 }), roughness: 0.6 }),
  roof: blockType({ all: tile('tiles', { colors: ramp('#3d9a7e', 0.09), size: 4, patina: { colors: ramp('#62c2a2', 0.08), amount: 0.12 } }), roughness: 0.5 }),
  ridge: blockType({ all: tile('masonry', { colors: ramp('#8e4028', 0.08), rows: 4, unit: 4 }) }),
  cherryLog: blockType({ side: tile('bark', { colors: ramp('#5a3436', 0.08) }), top: tile('rings', { colors: ramp('#c8848e', 0.08), bark: ramp('#5a3436', 0.08) }) }),
  stoneLantern: blockType({ side: tile('lattice', { colors: ramp('#9c968c', 0.07), paper: ramp('#ffd890', 0.05), step: 8 }), top: tile('polished', { colors: ramp('#9c968c', 0.07) }), glow: 1.4 }),
  cherryLeaves: blockType({ all: tile('leaves', { colors: ramp('#ef9ec0', 0.08), blossom: ramp('#fff0f6', 0.04) }), see: true }),
};

// The temple: a stone platform with steps, six lacquered pillars on the front row, lattice walls and doors between,
// a red beam with a painted teal band, gold brackets, and a stepped copper roof with flicked-up corners and a ridge.
function templeBlocks() {
  const b = [];
  const [back, front] = [-22, -14];
  fill(b, [-14, 0, back], [14, 1, front], 'platform');
  fill(b, [-5, 0, front + 1], [5, 0, front + 2], 'platform');
  fill(b, [-5, 1, front + 1], [5, 1, front + 1], 'platform');
  const pillars = [-12, -7, -3, 3, 7, 12];
  for (const x of pillars) {
    fill(b, [x, 2, front], [x, 7, front], 'lacquer');
    b.push([x, 2, front, 'gold'], [x, 7, front, 'gold']);
  }
  for (let x = -12; x <= 12; x++) {
    if (pillars.includes(x)) continue;
    for (let y = 2; y <= 7; y++) b.push([x, y, front - 1, Math.abs(x) <= 2 ? (y <= 6 ? 'door' : 'lacquerDark') : y <= 3 ? 'lacquerDark' : 'lattice']);
  }
  fill(b, [-13, 8, front], [13, 8, front], 'lacquer');
  fill(b, [-13, 9, front], [13, 9, front], 'teal');
  for (let x = -13; x <= 13; x += 2) b.push([x, 9, front + 1, 'gold']);
  fill(b, [-13, 8, back + 1], [13, 9, front - 1], 'lacquerDark');
  // Roof: each course a block higher and further back, front and back slopes meeting at the ridge.
  const ridgeZ = Math.round((back + front) / 2);
  for (let r = 0; r <= 5; r++) {
    const y = 10 + r;
    const zf = front + 2 - r;
    const zb = back - 2 + r;
    if (zf < ridgeZ || zb > ridgeZ) break;
    fill(b, [-15 + Math.min(r, 1), y, zf], [15 - Math.min(r, 1), y, zf], 'roof');
    fill(b, [-15 + Math.min(r, 1), y, zb], [15 - Math.min(r, 1), y, zb], 'roof');
    fill(b, [-14, y, zb + 1], [14, y, zf - 1], 'lacquerDark');
  }
  fill(b, [-14, 16, ridgeZ - 1], [14, 16, ridgeZ + 1], 'ridge');
  fill(b, [-13, 17, ridgeZ], [13, 17, ridgeZ], 'roof');
  for (const side of [-1, 1]) {
    // Flicked-up eave corners and ridge-end ornaments.
    b.push([side * 16, 11, front + 2, 'roof'], [side * 17, 12, front + 2, 'roof'], [side * 17, 13, front + 3, 'gold']);
    b.push([side * 16, 11, back - 2, 'roof'], [side * 17, 12, back - 2, 'roof']);
    b.push([side * 14, 17, ridgeZ, 'roof'], [side * 14, 18, ridgeZ, 'roof'], [side * 13, 19, ridgeZ, 'roof'], [side * 13, 20, ridgeZ, 'gold']);
  }
  b.push([0, 18, ridgeZ, 'gold']);
  return b;
}

// Courtyard paving in a checker of light and dark slabs, and a cherry tree: a crooked trunk and blossom crowns with
// gaps.
function groundBlocks() {
  const b = [];
  for (let x = -20; x <= 20; x++) for (let z = -14; z <= 12; z++) b.push([x, -1, z, (Math.floor(x / 2) + Math.floor(z / 2)) % 2 ? 'paving' : 'pavingDark']);
  const trunk = [[-7, 0, -5], [-7, 1, -5], [-7, 2, -5], [-6, 3, -5], [-6, 4, -5], [-5, 5, -5], [-8, 4, -5], [-9, 5, -5]];
  trunk.forEach(([x, y, z]) => b.push([x, y, z, 'cherryLog']));
  // Stone lanterns flanking the steps.
  for (const x of [-7, 7]) {
    fill(b, [x, 0, -11], [x, 1, -11], 'platform');
    b.push([x, 2, -11, 'stoneLantern'], [x, 3, -11, 'roof']);
  }
  const crown = (cx, cy, cz, r) => {
    for (let x = -r; x <= r; x++) for (let y = -r; y <= r; y++) for (let z = -r; z <= r; z++) {
      if (x * x + y * y * 1.6 + z * z <= r * r + 0.5 && random() > 0.18) b.push([cx + x, cy + y, cz + z, 'cherryLeaves']);
    }
  };
  crown(-6, 7, -6, 3);
  crown(-10, 6, -6, 2);
  crown(-3, 7, -5, 2);
  // A low branch right in front of the lens, thrown out of focus.
  crown(-4, 5, 2, 1);
  return b;
}

// Fighter in red: mandarin collar and cuffs in gold, a diagonal gold closure with frog buttons, black sash and
// trousers, cloth shoes with white soles, hair up in a topknot, teeth bared.
const RED = paintPerson({
  skin: RAMPS.skinTan, hair: RAMPS.hairBlack, eyes: '#2a1810', top: RAMPS.silkRed, sleeves: 10, hairLayer: true,
  bottom: RAMPS.clothBlack, shoes: RAMPS.clothBlack, belt: RAMPS.clothBlack, fringe: 1, face: { brows: 'fierce', mouth: 'shout' },
  extra: ({ band, dot }) => {
    band('body', 0, 0, RAMPS.gold);
    for (let j = 1; j < 9; j++) dot('body', 'front', Math.min(6, 3 + Math.floor(j / 2)), j, RAMPS.gold[j % 3 === 0 ? 4 : 2]);
    ['rightArm', 'leftArm'].forEach((arm) => band(arm, 8, 9, RAMPS.gold));
    ['rightLeg', 'leftLeg'].forEach((leg) => band(leg, 11, 11, RAMPS.linen));
    band('body', 9, 9, RAMPS.gold, ['front']);
    band('jacket', 0, 1, RAMPS.gold);
  },
});

// Fighter in blue: tunic with white cuffs and collar, a linen sash, grey trousers, black shoes, a red headband.
const BLUE = paintPerson({
  skin: RAMPS.skinFair, hair: RAMPS.hairBlack, eyes: '#1a1410', top: RAMPS.silkBlue, sleeves: 10, hairLayer: true,
  bottom: RAMPS.clothGrey, shoes: RAMPS.clothBlack, belt: RAMPS.linen, fringe: 1, face: { brows: 'fierce', mouth: 'line' },
  extra: ({ band, dot }) => {
    band('body', 0, 0, RAMPS.linen);
    for (let j = 1; j < 9; j++) dot('body', 'front', 3, j, RAMPS.silkBlue[j % 3 === 0 ? 4 : 0]);
    ['rightArm', 'leftArm'].forEach((arm) => band(arm, 8, 9, RAMPS.linen));
    band('head', 1, 1, RAMPS.red);
    band('hat', 1, 1, RAMPS.red);
    ['rightLeg', 'leftLeg'].forEach((leg) => band(leg, 11, 11, RAMPS.linen));
  },
});

// A jian from the Wushu pack: gold pommel and red tassel, wrapped grip, a gold guard, and a ridged steel blade.
function Jian() {
  return (
    <group>
      <Part size={[1.4, 4, 1.4]} ramp="clothBlack" look={{ ridges: true }} />
      <Part size={[2.2, 2, 2.2]} ramp="gold" position={px(0, 3, 0)} />
      <Part size={[1, 5, 1]} ramp="red" position={px(0.6, 5.5, 0.6)} rotation={[0.3, 0, -0.4]} />
      <Part size={[6, 1.6, 2.4]} ramp="gold" look={{ shine: true }} position={px(0, -2.8, 0)} />
      <Part size={[2.2, 18, 0.8]} ramp="metal" look={{ shine: true, scratches: true }} position={px(0, -12.6, 0)} />
      <Part size={[1.2, 2, 0.8]} ramp="metal" position={px(0, -22.4, 0)} />
    </group>
  );
}

// A long staff: red lacquer with gold caps and bands.
function Staff() {
  return (
    <group>
      <Part size={[40, 2, 2]} ramp="lacquer" look={{ shine: true }} />
      {[-20.5, 20.5].map((x) => <Part key={x} size={[2, 2.4, 2.4]} ramp="gold" position={px(x, 0, 0)} />)}
      {[-12, -5, 5, 12].map((x) => <Part key={x} size={[1, 2.3, 2.3]} ramp="gold" position={px(x, 0, 0)} />)}
    </group>
  );
}

function Fighters() {
  return (
    <>
      {/* Red: airborne, right leg driving into the staff, torso thrown back, jian swept up behind. */}
      <Character
        name="fighter_red" skin={RED} position={[-0.92, 1.66, 0]} rotation={[0, Math.PI / 2 - 0.22, 0.04]}
        pose={{
          body: [-0.42, 0, 0], chest: [0.12, 0.3, 0], head: [0.45, -0.3, 0],
          rightArm: [2.5, 0, -0.45], rightElbow: [-0.55, 0, 0], leftArm: [-1.4, 0, 0.5], leftElbow: [-1.35, 0, 0],
          rightLeg: [-1.57, 0, 0], leftLeg: [-0.7, 0, 0.08], leftKnee: [1.8, 0, 0],
        }}
        right={<group name="jian" position={px(0, -6.5, 0.5)} rotation-x={-0.4}><Jian /></group>}
        crown={<>
          <Part size={[3.4, 3, 3.4]} ramp="hairBlack" position={px(0, 9.2, -1.2)} />
          <Part size={[6, 0.7, 0.7]} ramp="gold" position={px(0, 9.4, -1.2)} rotation-y={0.4} />
        </>}
        chest={<>
          <Part size={[1.6, 7, 0.6]} ramp="clothBlack" position={px(3.2, -6, 2.4)} rotation={[0.9, 0, 0.3]} />
          <Part size={[1.6, 6, 0.6]} ramp="clothBlack" position={px(2, -5.5, 2.4)} rotation={[1.1, 0, -0.1]} />
        </>}
      />
      {/* Blue: braced low, knees bent, staff held across in both hands to take the kick. */}
      <Character
        name="fighter_blue" skin={BLUE} position={[0.3, 0.62, -0.1]} rotation={[0, -Math.PI / 2 + 1.0, 0]}
        pose={{
          body: [-0.2, 0, 0], chest: [0.05, -0.15, 0], head: [0.1, -0.35, 0],
          rightArm: [-0.75, 0, 0.25], rightElbow: [-0.9, 0, 0], leftArm: [-1.9, 0, -0.2], leftElbow: [-0.55, 0, 0],
          rightLeg: [0.45, 0, -0.3], rightKnee: [0.7, 0, 0], leftLeg: [-0.6, 0, 0.3], leftKnee: [0.85, 0, 0],
        }}
        chest={<group name="staff" position={px(0, 3, 7.5)} rotation={[-0.15, 0, Math.PI / 2]}><Staff /></group>}
        crown={<>
          <Part size={[1.6, 6, 0.6]} ramp="red" position={px(-0.8, 3.4, -4.4)} rotation={[0.6, 0, 0.15]} />
          <Part size={[1.6, 5, 0.6]} ramp="red" position={px(0.9, 3.6, -4.4)} rotation={[0.9, 0, -0.2]} />
        </>}
      />
    </>
  );
}

// The moment of contact: a burst of light where foot meets staff (a real light, so it catches both fighters), dust
// kicked up from the stance, and petals in the air.
function Impact() {
  const streaks = useMemo(() => Array.from({ length: 12 }, (_, i) => (i / 12) * Math.PI * 2 + 0.2), []);
  const puffs = useMemo(() => Array.from({ length: 10 }, (_, i) => {
    const a = (i / 10) * Math.PI * 2;
    return { at: [0.32 + Math.cos(a) * (0.5 + random() * 0.3), 0.1 + random() * 0.14, -0.1 + Math.sin(a) * (0.5 + random() * 0.25)], size: 4 + random() * 6 };
  }), []);
  const fallen = useMemo(() => Array.from({ length: 160 }, () => [-8 + random() * 12, 0.04, -9 + random() * 13, random() * 3]), []);
  const petals = useMemo(() => Array.from({ length: 90 }, () => ({
    at: [-6 + random() * 11, 0.3 + random() * 4.5, -6 + random() * 10], spin: [random() * 3, random() * 3, random() * 3], size: 0.8 + random() * 0.6,
  })), []);
  return (
    <group name="impact">
      <group position={[-0.16, 1.66, 0.12]}>
        {streaks.map((a) => <Part key={a} size={[0.7, 4 + (a * 7) % 3, 0.7]} ramp="flash" glow={6} position={[Math.cos(a) * 0.22, Math.sin(a) * 0.22, 0]} rotation-z={a - Math.PI / 2} />)}
        <Part size={[2.6, 2.6, 2.6]} ramp="flash" glow={10} rotation={[0.6, 0.6, 0]} />
        <pointLight color="#ffd890" intensity={6} distance={6} decay={2} />
      </group>
      {puffs.map((p, i) => <Part key={i} size={[p.size, p.size * 0.7, p.size]} ramp="dust" opacity={0.45} position={p.at} rotation-y={i} />)}
      {petals.map((p, i) => <Part key={`p${i}`} size={[p.size, p.size, 0.2]} ramp="blossom" glow={0.6} position={p.at} rotation={p.spin} />)}
      {fallen.map(([x, y, z, r], i) => <Part key={`f${i}`} size={[1.4, 0.2, 1.4]} ramp="blossom" position={[x, y, z]} rotation-y={r} />)}
    </group>
  );
}

// A weapon rack holding pieces of the Wushu pack: red-tassel spear, bamboo staff, guandao and trident.
function WeaponRack() {
  return (
    <group name="weapon_rack" position={[4.6, 0, -6]} rotation-y={-0.35}>
      {[-1, 1].map((side) => <Part key={side} size={[3, 40, 3]} ramp="wood" look={{ grain: true }} position={[side * 1.1, 1.25, 0]} />)}
      {[0.55, 2.2].map((y) => <Part key={y} size={[40, 3, 3]} ramp="wood" look={{ grain: true }} position={[0, y, 0]} />)}
      <group name="spear" position={[-0.75, 1.45, 0.15]} rotation-z={0.08}>
        <Part size={[1.6, 44, 1.6]} ramp="bamboo" look={{ grain: true }} />
        <Part size={[2.4, 6, 1]} ramp="metal" look={{ shine: true }} position={px(0, 25, 0)} />
        {[-1, 0, 1].map((i) => <Part key={i} size={[1, 5, 1]} ramp="red" position={px(i * 1.1, 19, 0)} rotation-z={i * 0.35} />)}
      </group>
      <group name="staff" position={[-0.2, 1.5, 0.15]} rotation-z={-0.05}>
        <Part size={[2, 46, 2]} ramp="bamboo" look={{ planks: 10 }} />
      </group>
      <group name="guandao" position={[0.35, 1.5, 0.15]} rotation-z={0.06}>
        <Part size={[1.8, 42, 1.8]} ramp="handle" look={{ shine: true }} />
        <Part size={[2.4, 3, 2.4]} ramp="gold" position={px(0, 21, 0)} />
        <Part size={[5, 12, 1]} ramp="metal" look={{ shine: true }} position={px(1.5, 28, 0)} rotation-z={-0.2} />
        <Part size={[3, 4, 1]} ramp="metal" position={px(3, 34, 0)} rotation-z={-0.6} />
      </group>
      <group name="trident" position={[0.9, 1.45, 0.15]} rotation-z={-0.08}>
        <Part size={[1.6, 40, 1.6]} ramp="bamboo" />
        <Part size={[7, 1.6, 1.6]} ramp="gold" position={px(0, 20, 0)} />
        {[-3, 0, 3].map((x) => <Part key={x} size={[1.2, x ? 5 : 7, 1.2]} ramp="metal" position={px(x, 23 + (x ? 0 : 1), 0)} />)}
      </group>
    </group>
  );
}

// Lanterns hanging under the eaves, each a real light.
function Lanterns() {
  return (
    <group name="lanterns">
      {[-9.5, -5, 5, 9.5].map((x) => (
        <group key={x} name="lantern" position={[x, 6.6, -12.6]}>
          <Part size={[1, 14, 1]} ramp="iron" position={px(0, 15, 0)} />
          <Part size={[6, 2, 6]} ramp="gold" position={px(0, 7.5, 0)} />
          <Part size={[10, 12, 10]} ramp="lacquer" look={{ ribs: [3, 99] }} glow={3.5} />
          <Part size={[6, 2, 6]} ramp="gold" position={px(0, -7, 0)} />
          <Part size={[2, 8, 2]} ramp="red" position={px(0, -12, 0)} />
          <pointLight color="#ff8c48" intensity={4} distance={8} decay={2} />
        </group>
      ))}
    </group>
  );
}

// Far mountains in the haze, and a pagoda on a peak.
function Backdrop() {
  const peaks = useMemo(() => Array.from({ length: 14 }, (_, i) => ({ x: -140 + i * 22 + random() * 10, z: -130 - random() * 50, h: 30 + random() * 40, w: 24 + random() * 20 })), []);
  return (
    <group name="backdrop">
      {peaks.map((p, i) => (
        <group key={i} name="mountain" position={[p.x, 0, p.z]}>
          {[1, 0.7, 0.42].map((f, j) => <Part key={j} size={[p.w * 16 * f, p.h * 16 * (0.45 + j * 0.05), p.w * 12 * f]} ramp="mountain" look={{ noise: 0.06, edge: false, res: 0.12 }} position={[j * 1.2 - 1, p.h * (j * 0.33 + 0.22), 0]} />)}
        </group>
      ))}
      <group name="pagoda" position={[30, 22, -95]}>
        {[0, 1, 2, 3, 4].map((i) => (
          <group key={i} position={[0, i * 2, 0]}>
            <Part size={[48 - i * 7, 24, 48 - i * 7]} ramp="lacquer" look={{ res: 0.25 }} />
            <Part size={[64 - i * 8, 5, 64 - i * 8]} ramp="teal" look={{ res: 0.25 }} position={[0, 0.9, 0]} />
          </group>
        ))}
      </group>
    </group>
  );
}

function Scene() {
  const temple = useMemo(templeBlocks, []);
  const ground = useMemo(groundBlocks, []);
  return (
    <>
      <Dome
        dome={[[90, '#3f78c6'], [40, '#6fa0dc'], [14, '#a8cce8'], [4, '#ffe0b0'], [0, '#ffc890'], [-10, '#b08a68'], [-90, '#5a4636']]}
        sun={{ dir: [-0.72, 0.26, -0.45], color: '#ffc884', size: 0.05, intensity: 520, halo: 5 }} intensity={0.9}
      />
      <Blocks name="temple" blocks={temple} types={TYPES} />
      <Blocks name="courtyard" blocks={ground} types={TYPES} />
      <Lanterns />
      <WeaponRack />
      <Fighters />
      <Impact />
      <Backdrop />
      <Orbit azimuth={0.08} elevation={-0.09} distance={5.4} target={[-0.25, 1.55, 0]} roll={-0.12} />
    </>
  );
}

start(Scene, {
  name: 'wushu_courtyard', mode: 'pathtrace', fov: 52, far: 400, keep: () => ({ fighter_red: RED, fighter_blue: BLUE }),
  trace: {
    samples: 320, bounces: 5,
    look: {
      exposure: 1.0, dof: { focus: 5.4, fStop: 2.2 },
      fog: { color: '#c9b8a4', glow: '#ffcc88', sun: [-0.72, 0.26, -0.45], density: 0.02, falloff: 0.045, base: 0, start: 7, power: 4, max: 0.9 },
      bloom: { intensity: 0.7, luminanceThreshold: 0.9, luminanceSmoothing: 0.2, radius: 0.75 },
      tone: { shadowTint: [0.92, 0.97, 1.12], highlightTint: [1.08, 1.02, 0.92], saturation: 1.12 },
      vignette: { offset: 0.3, darkness: 0.5 },
    },
  },
});
