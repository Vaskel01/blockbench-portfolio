// Portfolio scene: a parkour leap across the rooftops of a ruined city at sunset, in the spirit of Dying Light 2,
// path-traced. From low on the landing roof the camera looks up as a runner in a hooded jacket and scarf sails over
// the gap, silhouetted against a low sun. The take-off roof has a stairwell under a UV safe-zone lamp, AC units, a
// satellite dish, laundry and a red banner; the street below has infected; further down, a plank bridge and laundry
// cross the canyon toward a hazy skyline with a church spire and a windmill. Every building is built from blocks.
// `npm run render:scene parkour` renders it; `bbmodel` exports it, `preview`/`quick` check it.
import { useMemo } from 'react';
import { Blocks, blockType, fill, ramp, tile } from './blocks.jsx';
import { Character, Dome, Orbit, PX, Part, RAMPS, paintPerson, px, seeded, start } from './kit.jsx';

Object.assign(RAMPS, {
  concrete: ['#3e3634', '#6a5c56', '#86766c', '#a08e80', '#c2ae9c'],
  plaster: ['#4a3a30', '#8a7058', '#a88a6c', '#c4a684', '#e2c6a0'],
  brick: ['#2e1610', '#5a2a1c', '#7a3a26', '#954a32', '#c06c4a'],
  tar: ['#141214', '#221e20', '#2e2a2a', '#3c3634', '#544a46'],
  rust: ['#2a1208', '#5a2a12', '#7e3e1a', '#a05828', '#d08848'],
  steel: ['#1e2228', '#3a4048', '#56606a', '#7a848e', '#a8b2ba'],
  glass: ['#101624', '#1c2a40', '#2c4060', '#ffb070', '#ffd8a0'],
  skyline: ['#3a2a3e', '#5a3e52', '#7a5262', '#9a6a72', '#c48a86'],
  uv: ['#2a0a5a', '#5a1ab0', '#8a3aff', '#b87aff', '#e8c8ff'],
  sun: ['#ff7a3a', '#ff9a4a', '#ffbe6a', '#ffdc96', '#fff2d0'],
  banner: ['#3a0808', '#701010', '#a01c1c', '#c83a2c', '#ec6a50'],
  cloth: ['#3a4a5a', '#5a7088', '#7a94aa', '#a0b8c8', '#d0e0ea'],
  clothWarm: ['#5a4a2a', '#8a7444', '#b09a60', '#cdb880', '#ece0b0'],
  canvasGreen: ['#1c2a1a', '#344a2e', '#4a6440', '#62805a', '#8aa882'],
  dust: ['#6a5248', '#8a6e60', '#a88a78', '#c4a690', '#e0c6ac'],
  bird: ['#0a0808', '#141010', '#1e1818', '#2a2222', '#3a3030'],
  jacket: ['#1e1a10', '#3e3420', '#5a4a2c', '#76623a', '#a08852'],
  hood: ['#14161a', '#24282e', '#343a42', '#4a525c', '#68727e'],
  cargo: ['#1a1810', '#33301e', '#4a4630', '#625c40', '#847c58'],
  boots: ['#120c08', '#22160e', '#342218', '#4a3222', '#664834'],
  scarf: ['#3a0c0a', '#6e1a14', '#9a2a20', '#c04434', '#e8705a'],
  strap: ['#1a1008', '#3a2414', '#523420', '#6c472c', '#8e6240'],
  skinRunner: ['#4a2c1e', '#9a6448', '#c48562', '#dca07a', '#f4c4a0'],
  hairBrown: ['#100a06', '#22160e', '#342218', '#4a3020', '#644430'],
  infected: ['#1a2018', '#3a4434', '#56604a', '#727c62', '#9aa486'],
  rags: ['#1a1614', '#2e2824', '#423a34', '#58504a', '#746a62'],
});

const random = seeded(31);
// Roof A (the take-off) tops out at y = 0, roof B (the landing) at -2, the street lies at -11.
const STREET = -11;

// The runner: olive jacket with darker panels and a raised collar, red scarf, a chest strap, fingerless gloves,
// cargo trousers with kneepads, worn boots.
const RUNNER = paintPerson({
  skin: RAMPS.skinRunner, hair: RAMPS.hairBrown, eyes: '#1a2a30', top: RAMPS.jacket, sleeves: 11,
  bottom: RAMPS.cargo, shoes: RAMPS.boots, belt: RAMPS.strap, fringe: 1, hairLayer: true, face: { brows: 'fierce', mouth: 'grin' },
  extra: ({ band, dot }) => {
    band('body', 0, 1, RAMPS.scarf);
    band('head', 7, 7, RAMPS.scarf, ['front', 'right', 'left', 'back']);
    // Stubble and a scar.
    [1, 2, 5, 6].forEach((i) => dot('head', 'front', i, 6, RAMPS.skinRunner[1]));
    dot('head', 'front', 6, 2, RAMPS.skinRunner[0]);
    // Chest strap running across from the right shoulder to the left hip, with a buckle.
    for (let j = 2; j < 11; j++) dot('body', 'front', Math.min(7, Math.floor((j - 2) * 0.8)), j, RAMPS.strap[j % 2 ? 2 : 3]);
    dot('body', 'front', 3, 6, RAMPS.steel[4]);
    // Jacket panels: darker side panels and a centre zip.
    ['front', 'back'].forEach((f) => { for (let j = 2; j < 10; j++) { dot('body', f, 0, j, RAMPS.jacket[1]); dot('body', f, 7, j, RAMPS.jacket[1]); } });
    for (let j = 2; j < 10; j++) dot('body', 'front', 4, j, RAMPS.jacket[0]);
    // Fingerless gloves and elbow patches.
    ['rightArm', 'leftArm'].forEach((arm) => { band(arm, 10, 11, RAMPS.hood); band(arm, 5, 5, RAMPS.jacket, ['right', 'left']); });
    // Kneepads.
    ['rightLeg', 'leftLeg'].forEach((leg) => band(leg, 4, 6, RAMPS.hood, ['front']));
  },
});

// An infected: grey-green skin, sunken eyes, torn rags.
const INFECTED = paintPerson({
  skin: RAMPS.infected, hair: RAMPS.rags, eyes: '#c8d040', top: RAMPS.rags, sleeves: 6,
  bottom: RAMPS.rags, shoes: RAMPS.infected, fringe: 1, face: { mouth: 'shout' },
  extra: ({ dot }) => {
    [[2, 9], [5, 10], [1, 7], [6, 6]].forEach(([i, j]) => dot('body', 'front', i, j, RAMPS.infected[2]));
    [2, 5].forEach((i) => dot('head', 'front', i, 4, '#e8f060'));
    [3, 4].forEach((i) => dot('head', 'front', i, 6, '#3a0a0a'));
  },
});

// Rooftop clutter.
function ACUnit({ at, yaw = 0 }) {
  return (
    <group name="ac_unit" position={at} rotation-y={yaw}>
      <Part size={[18, 12, 14]} ramp="steel" look={{ ridges: true, rivets: true, scratches: true }} position={px(0, 6, 0)} />
      <Part size={[12, 1, 12]} ramp="steel" look={{ lattice: 3 }} position={px(-1, 12.5, 0)} />
      <Part size={[4, 6, 4]} ramp="rust" position={px(9, 3, 3)} />
    </group>
  );
}

function SatelliteDish({ at, yaw = 0 }) {
  return (
    <group name="satellite_dish" position={at} rotation-y={yaw}>
      <Part size={[2, 14, 2]} ramp="steel" position={px(0, 7, 0)} />
      <group position={px(0, 15, 1)} rotation-x={-0.5}>
        <Part size={[16, 16, 2]} ramp="metal" look={{ shine: true, scratches: true }} />
        <Part size={[1, 1, 10]} ramp="steel" position={px(0, 0, 5)} />
      </group>
    </group>
  );
}

// The stairwell shed with a UV lamp on a pole beside it: the safe zone's purple glow.
function Stairwell({ at }) {
  return (
    <group name="stairwell" position={at}>
      <Part size={[40, 40, 34]} ramp="plaster" look={{ stains: true, cracks: 4, noise: 0.04 }} position={px(0, 20, 0)} />
      <Part size={[44, 3, 38]} ramp="concrete" position={px(0, 41.5, 0)} />
      <Part size={[14, 26, 1]} ramp="rust" look={{ planks: 6 }} position={px(8, 13, 17.2)} />
      <group name="uv_lamp" position={px(-26, 0, 14)}>
        <Part size={[2, 52, 2]} ramp="steel" position={px(0, 26, 0)} />
        <Part size={[12, 2, 2]} ramp="steel" position={px(5, 51, 0)} />
        <Part size={[8, 5, 6]} ramp="steel" position={px(10, 49, 0)} />
        <Part size={[6, 2, 4]} ramp="uv" glow={3.2} position={px(10, 46.4, 0)} />
        <pointLight color="#a45cff" intensity={6} distance={10} decay={2} position={px(10, 44, 0)} />
      </group>
    </group>
  );
}

// Laundry strung between two poles, and a red banner on a mast.
function Laundry({ at, yaw = 0 }) {
  const cloths = [['cloth', 6, 10], ['clothWarm', 8, 12], ['banner', 5, 8], ['cloth', 7, 11], ['clothWarm', 6, 9]];
  return (
    <group name="laundry" position={at} rotation-y={yaw}>
      {[-30, 30].map((x) => <Part key={x} size={[2, 34, 2]} ramp="wood" look={{ grain: true }} position={px(x, 17, 0)} />)}
      <Part size={[60, 0.5, 0.5]} ramp="tar" position={px(0, 32, 0)} />
      {cloths.map(([ramp, w, h], i) => <Part key={i} size={[w, h, 0.5]} ramp={ramp} look={{ weave: true }} position={px(-22 + i * 11, 32 - h / 2, 0)} rotation={[0.15, 0, (i % 2 ? 1 : -1) * 0.06]} />)}
    </group>
  );
}

function Banner({ at }) {
  return (
    <group name="banner" position={at}>
      <Part size={[2, 60, 2]} ramp="steel" position={px(0, 30, 0)} />
      <Part size={[22, 30, 0.6]} ramp="banner" look={{ weave: true }} position={px(12, 44, 0)} rotation-y={-0.25} />
      <Part size={[8, 8, 0.8]} ramp="sun" position={px(12, 46, 0.5)} rotation={[0, -0.25, Math.PI / 4]} />
    </group>
  );
}

// A water tower on stilts, and an old windmill pumping on a far roof.
function WaterTower({ at }) {
  return (
    <group name="water_tower" position={at}>
      {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([x, z]) => <Part key={`${x}${z}`} size={[2, 30, 2]} ramp="rust" position={px(x * 10, 15, z * 10)} />)}
      <Part size={[26, 28, 26]} ramp="wood" look={{ planks: 6 }} position={px(0, 44, 0)} />
      {[34, 54].map((y) => <Part key={y} size={[27, 1.5, 27]} ramp="steel" position={px(0, y, 0)} />)}
      <Part size={[30, 6, 30]} ramp="tar" position={px(0, 61, 0)} />
      <Part size={[18, 5, 18]} ramp="tar" position={px(0, 66, 0)} />
    </group>
  );
}

function Windmill({ at }) {
  return (
    <group name="windmill" position={at}>
      <Part size={[4, 80, 4]} ramp="steel" position={px(0, 40, 0)} />
      <group position={px(0, 80, 3)} rotation-z={0.35}>
        {[0, 1, 2, 3].map((i) => (
          <group key={i} rotation-z={(i * Math.PI) / 2}>
            <Part size={[3, 34, 1]} ramp="steel" position={px(0, 17, 0)} />
            <Part size={[8, 24, 0.5]} ramp="clothWarm" look={{ weave: true }} position={px(5, 22, 0)} />
          </group>
        ))}
        <Part size={[6, 6, 6]} ramp="rust" />
      </group>
    </group>
  );
}

// The block set for the city: brick and plaster walls, windows (some lit), tar roofs, concrete parapets, asphalt and
// paving.
const TYPES = {
  brick: blockType({ all: tile('masonry', { colors: ramp('#8e4a32', 0.08), rows: 4, unit: 8 }) }),
  brickDark: blockType({ all: tile('masonry', { colors: ramp('#6a3a2e', 0.08), rows: 4, unit: 8, seed: 5 }) }),
  plaster: blockType({ all: tile('mottled', { colors: ramp('#b49678', 0.06), amount: 0.25 }) }),
  concrete: blockType({ all: tile('flat', { colors: ramp('#8c8279', 0.06), speckle: 0.1 }) }),
  window: blockType({ side: tile('window', { colors: ramp('#5a4a40', 0.08), glass: ramp('#22324a', 0.1) }), top: tile('flat', { colors: ramp('#8c8279', 0.06) }), roughness: 0.3 }),
  windowLit: blockType({ side: tile('window', { colors: ramp('#5a4a40', 0.08), glass: ramp('#22324a', 0.1), lit: ramp('#ffb070', 0.08) }), top: tile('flat', { colors: ramp('#8c8279', 0.06) }), glow: 1.6 }),
  roof: blockType({ all: tile('mottled', { colors: ramp('#3a3432', 0.05), amount: 0.4 }) }),
  parapet: blockType({ all: tile('polished', { colors: ramp('#9a8f86', 0.06) }) }),
  asphalt: blockType({ all: tile('mottled', { colors: ramp('#2c2a2e', 0.05), amount: 0.3 }) }),
  paving: blockType({ top: tile('tiles', { colors: ramp('#7a746e', 0.05), size: 8 }), side: tile('flat', { colors: ramp('#6a645e', 0.05) }) }),
};

// A block building: walls from the street up to `top`, windows every third course (some lit), a tar roof and a
// parapet ring. Only the shell is built, so the mesher keeps it light.
function building(b, [x0, x1], [z0, z1], top, wall, lit = 0.15) {
  for (let y = STREET; y < top; y++) {
    for (let x = x0; x <= x1; x++) {
      for (let z = z0; z <= z1; z++) {
        const edgeX = x === x0 || x === x1;
        const edgeZ = z === z0 || z === z1;
        if (!edgeX && !edgeZ) continue;
        const corner = edgeX && edgeZ;
        const along = edgeX ? z : x;
        const isWindow = !corner && (y - STREET) % 3 === 1 && along % 2 === 0 && y < top - 1;
        b.push([x, y, z, isWindow ? (random() < lit ? 'windowLit' : 'window') : wall]);
      }
    }
  }
  fill(b, [x0, top - 1, z0], [x1, top - 1, z1], 'roof');
  for (let x = x0; x <= x1; x++) b.push([x, top, z0, 'parapet'], [x, top, z1, 'parapet']);
  for (let z = z0; z <= z1; z++) b.push([x0, top, z, 'parapet'], [x1, top, z, 'parapet']);
}

// The two roofs either side of the gap, the street below and the buildings lining it toward the sun.
function cityBlocks() {
  const b = [];
  building(b, [-15, -3], [-12, 6], 0, 'brick', 0.12);
  building(b, [3, 17], [-12, 10], -2, 'plaster', 0.12);
  fill(b, [-2, STREET - 1, -60], [2, STREET - 1, 14], 'asphalt');
  fill(b, [-2, STREET, -60], [-2, STREET, 14], 'paving');
  fill(b, [2, STREET, -60], [2, STREET, 14], 'paving');
  let z = -14;
  for (let i = 0; i < 5; i++) {
    const d = 8 + Math.floor(random() * 6);
    building(b, [-14 + Math.floor(random() * 3), -3], [z - d, z - 1], -4 + Math.floor(random() * 9), random() < 0.5 ? 'brickDark' : 'plaster', 0.2);
    building(b, [3, 15 - Math.floor(random() * 3)], [z - d, z - 1], -5 + Math.floor(random() * 10), random() < 0.5 ? 'concrete' : 'brick', 0.2);
    z -= d + 1;
  }
  return b;
}

// The runner at the top of the leap: lead knee driving forward, trailing leg stretched back, one arm reaching for
// the far roof and the other swung back, scarf tails and backpack flying.
function Runner() {
  return (
    <Character
      name="runner" skin={RUNNER} position={[0.4, 1.35, -1.2]} rotation={[0, Math.PI / 2 - 0.35, 0.08]}
      pose={{
        body: [0.42, 0, 0], chest: [0.12, -0.15, 0], head: [-0.45, 0.2, 0],
        rightArm: [-2.35, 0, -0.2], rightElbow: [-0.25, 0, 0], leftArm: [0.95, 0, 0.25], leftElbow: [-0.6, 0, 0],
        rightLeg: [0.85, 0, -0.05], rightKnee: [0.5, 0, 0], leftLeg: [-1.45, 0, 0.05], leftKnee: [1.35, 0, 0],
      }}
      chest={<>
        <Part size={[9, 11, 4]} ramp="canvasGreen" look={{ weave: true, ridges: true }} position={px(0, 0.5, -4.4)} />
        <Part size={[7, 3, 1.2]} ramp="strap" position={px(0, 4, -6.8)} />
        <Part size={[2, 2, 2.4]} ramp="steel" position={px(-2.2, 2.5, 2.6)} />
        <Part size={[1.4, 1.4, 0.6]} ramp="uv" glow={4} position={px(-2.2, 2.5, 3.9)} />
        <Part size={[2, 8, 0.8]} ramp="scarf" position={px(1.5, 5, -3.6)} rotation={[-1.2, 0, 0.25]} />
        <Part size={[2, 6, 0.8]} ramp="scarf" position={px(-0.5, 5.5, -3.4)} rotation={[-1.4, 0, -0.1]} />
      </>}
      crown={<Part size={[9, 4, 3]} ramp="hood" look={{ weave: true }} position={px(0, 0.4, -4.6)} />}
    />
  );
}

// Rooftop dressing on both roofs, a plank bridge and laundry across the street further down, and infected below.
function Dressing() {
  const shamblers = [[-0.4, -16, 2.6], [1.0, -20, -2.4], [0.2, -26, 0.3], [-0.8, -31, 2.9]];
  return (
    <group name="dressing">
      <Stairwell at={[-8.5, 0, -6]} />
      <ACUnit at={[-5, 0, -9.6]} yaw={0.2} />
      <ACUnit at={[-11.5, 0, 2]} yaw={-0.3} />
      <SatelliteDish at={[-4.4, 0, 3.4]} yaw={0.6} />
      <Laundry at={[-9.5, 0, -1.4]} yaw={0.3} />
      <Banner at={[-4.2, 0, -10.8]} />
      {[[-4.6, 0.6], [-5.2, 1.1], [-4.7, 1.2]].map(([x, z], i) => <Part key={i} size={[10, 10, 10]} ramp="wood" look={{ planks: 4 }} position={[x, 5 * PX + (i === 2 ? 10 * PX : 0), z]} rotation-y={i * 0.4} />)}
      <WaterTower at={[9, -2, -6]} />
      <ACUnit at={[6.2, -2, 2.4]} yaw={-0.4} />
      <ACUnit at={[11, -2, 6]} yaw={0.3} />
      <Part size={[30, 2, 6]} ramp="wood" look={{ planks: 3 }} position={[5.4, -2 + PX, -1.8]} rotation-y={0.6} />
      <group name="plank_bridge" position={[0.5, -1, -20]}>
        {[-1, 0, 1].map((i) => <Part key={i} size={[90, 2, 5]} ramp="wood" look={{ planks: 3, grain: true }} position={px(0, 0, i * 5.4)} />)}
      </group>
      <group name="laundry_line" position={[0.5, -2.5, -15]}>
        <Part size={[80, 0.5, 0.5]} ramp="tar" />
        {[['banner', 6, 10], ['cloth', 7, 12], ['clothWarm', 6, 9], ['cloth', 5, 8]].map(([r, w, h], i) => <Part key={i} size={[w, h, 0.5]} ramp={r} look={{ weave: true }} position={px(-26 + i * 16, -h / 2, 0)} />)}
      </group>
      {shamblers.map(([x, z, yaw], i) => (
        <Character
          key={i} name="infected" skin={INFECTED} position={[x, STREET + 0.75, z]} rotation={[0, yaw, 0]}
          pose={{ body: [0.3, 0, 0.1], head: [-0.15, 0.3, 0.2], rightArm: [-1.4, 0, -0.1], rightElbow: [-0.3, 0, 0], leftArm: [-1.1, 0, 0.2], leftElbow: [-0.5, 0, 0], rightLeg: [0.3, 0, 0], rightKnee: [0.2, 0, 0], leftLeg: [-0.3, 0, 0] }}
        />
      ))}
    </group>
  );
}

// The skyline toward the sun: hazy towers, a church spire, the windmill, crows.
function Skyline() {
  const towers = useMemo(() => Array.from({ length: 34 }, (_, i) => ({
    x: -120 + (i / 34) * 240 + random() * 8, z: -90 - random() * 80, w: 8 + random() * 14, d: 8 + random() * 10, h: 12 + random() * 30,
  })), []);
  const crows = useMemo(() => Array.from({ length: 11 }, () => [-12 + random() * 16, 6 + random() * 7, -20 - random() * 20, random()]), []);
  return (
    <group name="skyline">
      {towers.map((t, i) => (
        <Part key={i} size={[t.w * 16, t.h * 16, t.d * 16]} ramp="skyline" look={{ windows: { cols: Math.max(2, Math.round(t.w / 2)), rows: Math.max(3, Math.round(t.h / 3)), glass: RAMPS.glass, lit: 0.12, light: '#ffb070' }, res: 0.25 }} position={[t.x, STREET + t.h / 2, t.z]} />
      ))}
      <group name="church" position={[-30, STREET, -110]}>
        <Part size={[120, 420, 120]} ramp="skyline" look={{ windows: { cols: 2, rows: 6, glass: RAMPS.glass }, res: 0.3 }} position={[0, 13.1, 0]} />
        {[0, 1, 2, 3].map((i) => <Part key={i} size={[110 - i * 26, 40, 110 - i * 26]} ramp="tar" look={{ res: 0.3 }} position={[0, 27.5 + i * 2.5, 0]} />)}
        <Part size={[4, 60, 4]} ramp="steel" position={[0, 37, 0]} />
        <Part size={[16, 4, 4]} ramp="steel" position={[0, 37.7, 0]} />
      </group>
      <Part size={[160, 420, 160]} ramp="skyline" look={{ windows: { cols: 3, rows: 7, glass: RAMPS.glass }, res: 0.3 }} position={[28, STREET + 13, -95]} />
      <Windmill at={[28, STREET + 26.2, -95]} />
      {crows.map(([x, y, z, r], i) => (
        <group key={i} name="crow" position={[x, y, z]} rotation={[0, r, (r - 0.5) * 0.4]}>
          <Part size={[4, 2, 2]} ramp="bird" />
          <Part size={[5, 1, 3]} ramp="bird" position={px(-3.5, 1, 0)} rotation-z={0.5} />
          <Part size={[5, 1, 3]} ramp="bird" position={px(3.5, 1, 0)} rotation-z={-0.5} />
        </group>
      ))}
    </group>
  );
}

const SUN = [-0.62, 0.2, -0.76];

function Scene() {
  const city = useMemo(cityBlocks, []);
  return (
    <>
      <Dome
        dome={[[90, '#262c66'], [35, '#5a4888'], [16, '#c45e7e'], [7, '#ff9256'], [1, '#ffd08a'], [-6, '#6a3c3a'], [-90, '#24181c']]}
        sun={{ dir: SUN, color: '#ffb070', size: 0.06, intensity: 300, halo: 7 }} intensity={1}
      />
      <Blocks name="city" blocks={city} types={TYPES} />
      <Dressing />
      <Runner />
      <Skyline />
      <Orbit azimuth={0.85} elevation={-0.24} distance={5.2} target={[0.2, 1.25, -1.3]} roll={0.14} />
    </>
  );
}

start(Scene, {
  name: 'rooftop_run', mode: 'pathtrace', fov: 56, far: 600, keep: () => ({ runner: RUNNER, infected: INFECTED }),
  trace: {
    samples: 320, bounces: 5,
    look: {
      exposure: 0.9, dof: { focus: 5.2, fStop: 2.4 },
      fog: { color: '#d88a66', glow: '#ffc080', sun: SUN, density: 0.016, falloff: 0.03, base: STREET, start: 8, power: 4, max: 0.88 },
      bloom: { intensity: 0.9, luminanceThreshold: 0.85, luminanceSmoothing: 0.25, radius: 0.8 },
      tone: { shadowTint: [0.86, 0.9, 1.18], highlightTint: [1.16, 1.0, 0.86], saturation: 1.12 },
      vignette: { offset: 0.28, darkness: 0.55 },
    },
  },
});
