// Portfolio scene: the Dark Hour, in the spirit of Persona 3, path-traced. Midnight has stopped: a student in a dark
// school blazer, headphones on and a sword hanging from one hand, stands in a block-built street of coffins and
// glossy blood-red puddles while his Persona rises behind him out of a spiral of shattered glass, its light catching
// him from behind and shining in the puddles. A giant moon hangs over the city, Tartarus twists up out of the
// skyline, blue butterflies drift past, and the shop clock reads twelve.
// `npm run render:scene persona` renders it; `bbmodel` exports it, `preview`/`quick` check it.
import { useMemo } from 'react';
import { Blocks, blockType, fill, ramp, tile } from './blocks.jsx';
import { Character, Decal, Dome, Orbit, Part, RAMPS, paintPerson, px, seeded, start } from './kit.jsx';

Object.assign(RAMPS, {
  asphalt: ['#05080a', '#0c1214', '#141c1e', '#1c2628', '#2a3836'],
  paving: ['#0a1210', '#16221e', '#203028', '#2c4034', '#44604c'],
  shopfront: ['#0a100e', '#141e1a', '#1e2c26', '#2a3c32', '#3e5646'],
  shutter: ['#0c1210', '#1a2420', '#26342e', '#34463e', '#4e6658'],
  glassDark: ['#020604', '#06100c', '#0c1c14', '#16301e', '#2a5032'],
  coffin: ['#1a0806', '#3a1410', '#52201a', '#6c2e22', '#944632'],
  coffinTrim: ['#1a0a06', '#3a1a10', '#5a2c18', '#7a4224', '#a86438'],
  blood: ['#2a0408', '#5a0a12', '#8a141e', '#b42a2a', '#e85a4a'],
  moon: ['#c8d870', '#dce88a', '#eef4aa', '#f8fbd0', '#ffffee'],
  tartarus: ['#040806', '#0a1610', '#122218', '#1c3424', '#34563a'],
  tartarusGlow: ['#2a5a1a', '#4a8a2a', '#7ac83a', '#aef06a', '#e8ffb0'],
  spirit: ['#0a3a6a', '#1a6ab0', '#3aa0e8', '#8ad4ff', '#e0f6ff'],
  shard: ['#4a8aaa', '#8ac8e0', '#c8ecff', '#eefaff', '#ffffff'],
  butterfly: ['#0a3a8a', '#1a6ae0', '#4aa8ff', '#9ad8ff', '#e8f8ff'],
  lampPost: ['#06090a', '#0e1416', '#182022', '#24302e', '#384a44'],
  clockFace: ['#4a5a3a', '#8a9a6a', '#c0cc96', '#dce6b4', '#f4f8dc'],
  skinPale: ['#4a3430', '#a07e72', '#d6b0a0', '#e8c8b8', '#fae2d4'],
  hairNavy: ['#04060c', '#0a1020', '#121c34', '#1c2a4a', '#2c3e66'],
  blazer: ['#05060a', '#0c0e16', '#141722', '#1e2230', '#2e3446'],
  shirt: ['#6a7078', '#a8b0b8', '#d4dae0', '#eceff2', '#ffffff'],
  phones: ['#0a0a0c', '#1e1e24', '#3a3a44', '#5a5a66', '#8a8a96'],
  armband: ['#3a0408', '#740a12', '#a8141c', '#d43a32', '#f27a66'],
});

const random = seeded(47);
// Where the moon hangs: its disc in the sky and the light it casts.
const MOON = [0.12, 0.42, -0.9];

// The student: dark blazer open over a white shirt, a crest on the breast, a red armband, navy hair with a long fringe
// falling over one eye.
const STUDENT = paintPerson({
  skin: RAMPS.skinPale, hair: RAMPS.hairNavy, eyes: '#5a7aa8', top: RAMPS.blazer, sleeves: 11,
  bottom: RAMPS.blazer, shoes: RAMPS.blazer, fringe: 2, longHair: 1, hairLayer: true,
  extra: ({ band, dot }) => {
    for (let j = 0; j < 10; j++) [3, 4].forEach((i) => dot('body', 'front', i, j, RAMPS.shirt[j === 0 ? 4 : 2]));
    [2, 5].forEach((i) => dot('body', 'front', i, 0, RAMPS.shirt[3]));
    [[6, 3, 4], [6, 4, 2], [5, 3, 2]].forEach(([i, j, t]) => dot('body', 'front', i, j, RAMPS.shirt[t]));
    band('leftArm', 2, 3, RAMPS.armband);
    // The fringe sweeps down over the right eye.
    [[5, 2], [6, 2], [7, 2], [5, 3], [6, 3], [6, 4], [7, 3], [7, 4], [5, 4]].forEach(([i, j]) => dot('head', 'front', i, j, RAMPS.hairNavy[j > 3 ? 1 : 2]));
    [1, 2].forEach((i) => dot('head', 'front', i, 3, RAMPS.hairNavy[1]));
  },
});

// The coffin a person becomes in the Dark Hour: tapered at head and foot, a lighter lid with a cross.
function Coffin({ at, yaw = 0, lean = 0 }) {
  return (
    <group name="coffin" position={at} rotation={[lean, yaw, lean * 0.5]}>
      <Part size={[9, 18, 6]} ramp="coffin" look={{ stains: true }} position={px(0, 9, 0)} />
      <Part size={[11, 5, 6]} ramp="coffin" position={px(0, 20.5, 0)} />
      <Part size={[9, 7, 6]} ramp="coffin" look={{ stains: true }} position={px(0, 26.5, 0)} />
      <Part size={[6, 2, 6]} ramp="coffin" position={px(0, 31, 0)} />
      <Part size={[7, 27, 0.6]} ramp="coffinTrim" position={px(0, 16.5, 3.2)} />
      <Part size={[1.2, 9, 0.6]} ramp="coffinTrim" look={{ shine: true }} position={px(0, 22, 3.7)} />
      <Part size={[5, 1.2, 0.6]} ramp="coffinTrim" look={{ shine: true }} position={px(0, 24, 3.7)} />
    </group>
  );
}

// The Persona: a towering spectral knight in light, armoured shoulders, arms flung wide, a visor slit burning white,
// a ring of light behind its head and a body that dissolves into flame below the waist.
function Persona() {
  const ring = useMemo(() => Array.from({ length: 18 }, (_, i) => (i / 18) * Math.PI * 2), []);
  const flames = useMemo(() => Array.from({ length: 26 }, (_, i) => ({ x: (random() - 0.5) * (10 - i * 0.25), y: -1 - i * 0.55 - random() * 2, size: 4.5 - i * 0.12 + random() * 1.5 })), []);
  const ghost = { ramp: 'spirit', glow: 2.2, opacity: 0.55 };
  return (
    <group name="persona" position={[-0.2, 3.1, -3.2]} rotation-y={0.2} scale={2}>
      <Part size={[10, 13, 6]} {...ghost} look={{ ridges: true }} position={px(0, 6.5, 0)} />
      <Part size={[12, 4, 7]} {...ghost} position={px(0, 13, 0)} />
      <Part size={[7, 7, 7]} {...ghost} position={px(0, 18.5, 0)} />
      <Part size={[8, 2, 8]} {...ghost} position={px(0, 22.6, 0)} />
      <Part size={[5, 1, 0.6]} ramp="shard" glow={3.2} position={px(0, 19, 3.7)} />
      {[-1, 1].map((side) => (
        <group key={side} name="persona_arm" position={px(side * 6.5, 12, 0)} rotation-z={side * 1.15}>
          <Part size={[7, 5, 7]} {...ghost} position={px(0, 1, 0)} />
          <Part size={[3.4, 14, 3.4]} {...ghost} position={px(0, -6, 0)} />
          <Part size={[4.4, 4, 4.4]} {...ghost} position={px(0, -14, 0)} />
        </group>
      ))}
      <group name="halo" position={px(0, 19, -4.5)}>
        {ring.map((a) => <Part key={a} size={[2.4, 2.4, 1]} ramp="shard" glow={2.2} opacity={0.9} position={px(Math.cos(a) * 11, Math.sin(a) * 11, 0)} rotation-z={a} />)}
      </group>
      {flames.map((f, i) => <Part key={i} size={[f.size, f.size * 1.4, f.size]} {...ghost} opacity={0.42 - i * 0.012} position={px(f.x, f.y, (random() - 0.5) * 4)} rotation={[i * 0.3, i, i * 0.2]} />)}
      <pointLight color="#4ab0ff" intensity={14} distance={14} decay={1.6} position={px(0, 6, 8)} />
    </group>
  );
}

// Blue butterflies drifting through the street.
function Butterflies() {
  const flock = [[-1.6, 2.6, 1.6, 0.4], [1.9, 3.3, 0.6, -0.6], [-0.4, 4.1, 0.9, 1.2], [2.6, 1.8, 2.4, 0.2]];
  return (
    <group name="butterflies">
      {flock.map(([x, y, z, r], i) => (
        <group key={i} name="butterfly" position={[x, y, z]} rotation={[0.3, r, 0.2]}>
          <Part size={[0.8, 0.8, 3]} ramp="blazer" />
          {[-1, 1].map((side) => (
            <group key={side} position={px(side * 0.4, 0, 0)} rotation-z={side * 0.6}>
              <Part size={[4, 0.3, 3.4]} ramp="butterfly" glow={2.2} position={px(side * 2.2, 0, -0.4)} />
              <Part size={[3, 0.3, 2.4]} ramp="butterfly" glow={2.2} position={px(side * 1.8, 0, 2)} />
            </group>
          ))}
        </group>
      ))}
    </group>
  );
}

// Tartarus twisting up out of the far city, dark masonry with green-lit seams; the city around it all dark.
function Skyline() {
  const segments = useMemo(() => Array.from({ length: 16 }, (_, i) => ({ y: i * 4.6, w: 22 - i * 1.15, twist: i * 0.2 })), []);
  const city = useMemo(() => Array.from({ length: 36 }, (_, i) => ({
    x: -110 + (i / 36) * 220 + random() * 6, z: -70 - random() * 60, w: 8 + random() * 12, h: 5 + random() * 9,
  })), []);
  return (
    <group name="skyline">
      <group name="tartarus" position={[-68, 0, -140]}>
        {segments.map((s, i) => (
          <group key={i} position={[0, s.y + 2.3, 0]} rotation-y={s.twist}>
            <Part size={[s.w * 16, 74, s.w * 16]} ramp="tartarus" look={{ bricks: [16, 8], res: 0.2 }} />
            <Part size={[s.w * 16 + 8, 6, 8]} ramp="tartarusGlow" glow={0.9} look={{ res: 0.2 }} position={[0, 1.6, (s.w * 16) / 32]} />
            {[-1, 1].map((side) => <Part key={side} size={[24, 90, 24]} ramp="tartarus" look={{ res: 0.2 }} position={[side * (s.w / 2 + 0.6), 1.2, 0]} rotation-z={-side * 0.45} />)}
          </group>
        ))}
        <Part size={[30, 260, 30]} ramp="tartarus" look={{ res: 0.2 }} position={[0, 82, 0]} />
        <Part size={[10, 120, 10]} ramp="tartarusGlow" glow={1.2} look={{ res: 0.2 }} position={[0, 94, 0]} />
      </group>
      {city.map((b, i) => (
        <Part key={i} size={[b.w * 16, b.h * 16, b.w * 12]} ramp="tartarus" look={{ windows: { cols: Math.max(2, Math.round(b.w / 2)), rows: Math.max(3, Math.round(b.h / 3)), glass: RAMPS.glassDark }, res: 0.25 }} position={[b.x, b.h / 2, b.z]} />
      ))}
      <Decal size={[1800, 1800]} ramp="moon" shape="disc" glow={1.5} fog={false} res={0.04} position={[MOON[0] * 300 + 1.6, MOON[1] * 300, MOON[2] * 300 + 4.3]} rotation-y={-0.1} />
    </group>
  );
}

// The block set: dark asphalt, paving, shop walls with dead windows, shutters and kerbs, all in the Dark Hour's green
// cast.
const TYPES = {
  asphalt: blockType({ all: tile('mottled', { colors: ramp('#141c1e', 0.05), amount: 0.3 }), roughness: 0.6 }),
  lane: blockType({ top: tile('flat', { colors: ramp('#c8ccb8', 0.05), speckle: 0.2 }), side: tile('mottled', { colors: ramp('#141c1e', 0.05) }) }),
  paving: blockType({ top: tile('tiles', { colors: ramp('#2c4034', 0.06), size: 8 }), side: tile('flat', { colors: ramp('#203028', 0.05) }) }),
  kerb: blockType({ all: tile('polished', { colors: ramp('#3e5646', 0.06) }) }),
  wall: blockType({ all: tile('masonry', { colors: ramp('#24342c', 0.06), rows: 4, unit: 8 }) }),
  wallPale: blockType({ all: tile('mottled', { colors: ramp('#34463c', 0.05), amount: 0.25 }) }),
  window: blockType({ side: tile('window', { colors: ramp('#1a2620', 0.06), glass: ramp('#0c1c14', 0.08) }), top: tile('flat', { colors: ramp('#24342c', 0.05) }), roughness: 0.25 }),
  shutter: blockType({ side: tile('planks', { colors: ramp('#34463e', 0.06) }), top: tile('flat', { colors: ramp('#24342c', 0.05) }), metalness: 0.3 }),
  roof: blockType({ all: tile('mottled', { colors: ramp('#101a14', 0.04), amount: 0.4 }) }),
};

// The street: a road with lane marks, a kerb, paving on the student's side, and a row of shops opposite with dead
// windows and shutters pulled down.
function streetBlocks() {
  const b = [];
  for (let x = -24; x <= 24; x++) {
    for (let z = -9; z <= -2; z++) b.push([x, -1, z, z === -6 && x % 4 < 2 ? 'lane' : 'asphalt']);
    b.push([x, -1, -1, 'kerb']);
    for (let z = 0; z <= 8; z++) b.push([x, -1, z, 'paving']);
  }
  let x = -24;
  while (x < 24) {
    const w = 4 + Math.floor(random() * 4);
    const h = 4 + Math.floor(random() * 4);
    const wall = random() < 0.5 ? 'wall' : 'wallPale';
    for (let i = 0; i < w; i++) {
      for (let y = 0; y < h; y++) {
        const front = y <= 1 ? (i > 0 && i < w - 1 ? 'shutter' : wall) : (y % 2 === 0 && i % 2 === 1 && i < w - 1 ? 'window' : wall);
        b.push([x + i, y, -10, front], [x + i, y, -15, wall]);
      }
      fill(b, [x + i, h, -15], [x + i, h, -10], 'roof');
    }
    for (let y = 0; y < h; y++) for (let z = -14; z <= -11; z++) b.push([x, y, z, wall], [x + w - 1, y, z, wall]);
    x += w;
  }
  return b;
}

// The student, sword hanging from his right hand, head bowed, headphones on, glass shards spiralling up off him.
function Student() {
  const shards = useMemo(() => Array.from({ length: 44 }, (_, i) => {
    const t = i / 44;
    const a = t * Math.PI * 6;
    const r = 0.5 + t * 1.0;
    return { at: [Math.cos(a) * r, 1.3 + t * 3.6, -0.5 + Math.sin(a) * r * 0.7], spin: [random() * 3, random() * 3, random() * 3], size: 0.8 + random() * 1.6 };
  }), []);
  return (
    <group name="summoning">
      <Character
        name="student" skin={STUDENT} position={[0, 0.75, 0.4]} rotation={[0, 0.35, 0]}
        pose={{
          body: [0.04, 0.12, 0], chest: [0.02, -0.12, 0.03], head: [0.35, -0.3, 0.08],
          rightArm: [-0.3, 0, -0.16], rightElbow: [-0.35, 0, 0], leftArm: [0.12, 0, 0.12], leftElbow: [-0.45, 0, 0],
          rightLeg: [0.06, 0, -0.05], leftLeg: [-0.14, 0, 0.08], leftKnee: [0.22, 0, 0],
        }}
        right={<group name="sword" position={px(0, -6.5, 0.5)} rotation-x={0.4}>
          <Part size={[1.3, 5, 1.3]} ramp="blazer" look={{ ridges: true }} />
          <Part size={[2, 1.6, 2]} ramp="metal" position={px(0, 3.2, 0)} />
          <Part size={[6, 1.3, 2.4]} ramp="metal" look={{ shine: true }} position={px(0, -3, 0)} />
          <Part size={[1.8, 24, 0.7]} ramp="metal" look={{ shine: true, scratches: true }} position={px(0, -15.5, 0)} />
        </group>}
        crown={<>
          <Part size={[9, 1.2, 1.8]} ramp="phones" position={px(0, 8.7, 0)} />
          {[-1, 1].map((side) => (
            <group key={side} position={px(side * 4.6, 4.4, 0)}>
              <Part size={[1.4, 4.4, 4.4]} ramp="phones" />
              <Part size={[0.6, 2.6, 2.6]} ramp="armband" position={px(side * 0.9, 0, 0)} />
              <Part size={[1, 4, 1]} ramp="phones" position={px(0, 3.6, 0)} />
            </group>
          ))}
        </>}
        chest={<Part size={[2, 3, 1]} ramp="phones" position={px(-2.4, -2, 2.4)} />}
      />
      {shards.map((s, i) => <Part key={i} size={[s.size, s.size * 1.6, 0.4]} ramp="shard" glow={2.2} opacity={0.85} position={s.at} rotation={s.spin} />)}
    </group>
  );
}

// Street furniture, coffins, glossy puddles and the midnight clock.
function Dressing() {
  const puddles = [[-1.4, 1.4, 40, 26], [1.8, -0.2, 26, 16], [-3.8, -2.8, 36, 20], [3.2, 2.8, 22, 14], [0.2, -4.6, 48, 24], [-5.5, 1.0, 20, 12]];
  return (
    <group name="dressing">
      {puddles.map(([x, z, w, d], i) => <Decal key={i} size={[w, d]} ramp="blood" shape="splotch" roughness={0.06} position={[x, 0.01, z]} rotation-x={-Math.PI / 2} />)}
      <Coffin at={[-2.4, 0, -0.2]} yaw={0.4} lean={-0.05} />
      <Coffin at={[2.6, 0, 1.0]} yaw={-0.5} />
      <Coffin at={[-4.6, 0, -4.2]} yaw={0.2} lean={0.04} />
      <Coffin at={[4.4, 0, -5.4]} yaw={-0.2} />
      <Coffin at={[0.9, 0, -7.4]} yaw={0.1} />
      <Coffin at={[-1.6, 0, 3.4]} yaw={0.9} lean={0.06} />
      {[[-5.2, -1.8], [5.6, -1.8]].map(([x, z]) => (
        <group key={x} name="street_lamp" position={[x, 0, z]}>
          <Part size={[2, 70, 2]} ramp="lampPost" look={{ shine: true }} position={px(0, 35, 0)} />
          <Part size={[12, 2, 2]} ramp="lampPost" position={px(-5, 69, 0)} />
          <Part size={[8, 3, 5]} ramp="lampPost" position={px(-10, 67.5, 0)} />
          <Part size={[6, 1, 3]} ramp="glassDark" position={px(-10, 65.6, 0)} />
        </group>
      ))}
      <group name="traffic_light" position={[-7.4, 0, -1.4]}>
        <Part size={[2, 56, 2]} ramp="lampPost" position={px(0, 28, 0)} />
        <Part size={[5, 14, 4]} ramp="lampPost" position={px(0, 56, 2)} />
        {[0, 1, 2].map((i) => <Part key={i} size={[3, 3, 1]} ramp="glassDark" position={px(0, 60 - i * 4, 4.2)} />)}
      </group>
      <group name="clock" position={[-4.5, 3.6, -9.9]}>
        <Part size={[18, 18, 2]} ramp="lampPost" />
        <Part size={[14, 14, 1]} ramp="clockFace" glow={0.5} position={px(0, 0, 1.2)} />
        {[0, 1, 2, 3].map((i) => <Part key={i} size={[1.4, 1.4, 0.6]} ramp="blazer" position={px(Math.sin((i * Math.PI) / 2) * 5.4, Math.cos((i * Math.PI) / 2) * 5.4, 1.9)} />)}
        <Part size={[1.2, 6, 0.6]} ramp="blazer" position={px(0, 3, 2)} />
        <Part size={[1.4, 4, 0.6]} ramp="blazer" position={px(0, 2, 2.2)} />
        <Part size={[2, 2, 0.8]} ramp="armband" position={px(0, 0, 2.4)} />
      </group>
    </group>
  );
}

function Scene() {
  const street = useMemo(streetBlocks, []);
  return (
    <>
      <Dome
        dome={[[90, '#020a06'], [40, '#071810'], [15, '#163a26'], [3, '#2e5a3c'], [0, '#3e6e44'], [-10, '#0c140e'], [-90, '#040806']]}
        sun={{ dir: MOON, color: '#e2ec9a', size: 0.09, intensity: 26, halo: 1.5 }} intensity={1}
      />
      <Blocks name="street" blocks={street} types={TYPES} />
      <Dressing />
      <Student />
      <Persona />
      <Butterflies />
      <Skyline />
      <Orbit azimuth={0.34} elevation={-0.17} distance={4.8} target={[0, 1.65, 0]} roll={-0.11} />
    </>
  );
}

start(Scene, {
  name: 'dark_hour', mode: 'pathtrace', fov: 52, far: 700, keep: () => ({ student: STUDENT }),
  trace: {
    samples: 320, bounces: 6,
    look: {
      exposure: 1.1, dof: { focus: 4.6, fStop: 2.0 },
      fog: { color: '#183a28', glow: '#8ab070', sun: MOON, density: 0.02, falloff: 0.04, base: 0, start: 6, power: 6, max: 0.9 },
      bloom: { intensity: 1.1, luminanceThreshold: 0.75, luminanceSmoothing: 0.3, radius: 0.85 },
      tone: { shadowTint: [0.86, 1.08, 0.96], highlightTint: [1.04, 1.08, 0.88], saturation: 1.06 },
      vignette: { offset: 0.25, darkness: 0.62 },
    },
  },
});
