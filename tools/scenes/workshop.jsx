// Staged render for the home page's store teaser: Vaskel painting at an easel, brush in one hand and palette in
// the other, paint buckets at his feet, every prop hand-painted in the style of his packs. Rendered as a transparent
// cutout so it sits straight on the page. `npm run render:workshop` renders it to renders/workshop-vaskel.webp;
// `npm run render:scene workshop bbmodel` exports it as a Blockbench project.
import { useMemo } from 'react';
import * as THREE from 'three';
import { Decal, Figure, Grade, Orbit, PX, Part, pixelTexture, px, start } from './kit.jsx';
import skinUrl from '../../renders/vaskel-skin.png';
import paintingUrl from '../../assets/minecraft/painting/pond.png';

// The store section's colour (--bg-2): the graded pass is rendered over it, so any edge blending matches the page.
const PAGE = '#0f1327';
// Canvas height in pixels; the width follows the painting's aspect.
const CANVAS = 20;
// Placement: [x, z, yaw] where yaw 0 faces the camera side and +PI/2 faces +x.
const EASEL = [-0.55, 0.35, 0.25];
const VASKEL = [0.45, 0.5, -0.45];
// Paint buckets around the easel and his feet: [x, z, yaw, paint colour, size in px].
const BUCKETS = [
  [-1.15, 0.85, 0.3, 'red', 7], [-0.2, 1.05, -0.2, 'blue', 6], [1.0, 1.0, 0.5, 'yellow', 7],
  [-1.2, 0.05, -0.4, 'lime', 6], [0.05, 0.55, 0.9, 'purple', 5],
];

// A three-legged studio easel: splayed front legs with gold bolts, a back prop, a lipped ledge holding a paint tube
// and a spare brush, the canvas, and a top clamp.
function Easel({ images }) {
  const width = Math.round((CANVAS * images.painting.width) / images.painting.height);
  const paintingFace = useMemo(() => new THREE.MeshStandardMaterial({ map: pixelTexture(images.painting), roughness: 0.85 }), [images]);
  const wood = { grain: true, knots: true };
  return (
    <group name="easel" position={[EASEL[0], 0, EASEL[1]]} rotation-y={EASEL[2]}>
      {[-1, 1].map((side) => <Part key={side} size={[2, 35, 2]} ramp="wood" look={wood} position={[side * 0.38, 1.05, 0.05]} rotation={[-0.12, 0, side * 0.13]} />)}
      <Part size={[2, 34, 2]} ramp="wood" look={wood} position={[0, 1.0, -0.38]} rotation={[0.33, 0, 0]} />
      <Part size={[15, 2, 2]} ramp="wood" look={wood} position={[0, 0.55, 0.12]} />
      {[-1, 1].map((side) => <Part key={side} size={[1, 1, 1]} ramp="gold" position={[side * 0.36, 0.55, 0.2]} />)}
      {/* Ledge with a front lip, a paint tube and a spare brush resting on it. */}
      <Part size={[20, 2, 4]} ramp="wood" look={{ ...wood, spatter: 'red' }} position={[0, 0.95, 0.13]} />
      <Part size={[20, 1, 1]} ramp="wood" look={wood} position={[0, 0.95 + 1.5 * PX, 0.13 + 1.5 * PX]} />
      {[-1, 1].map((side) => <Part key={side} size={[1, 1, 1]} ramp="gold" position={[side * 0.6, 0.95, 0.13 + 2.1 * PX]} />)}
      <group name="paint_tube" position={[0.42, 0.95 + 1.5 * PX, 0.13]} rotation-y={0.3}>
        <Part size={[4, 1.4, 1.6]} ramp="metal" look={{ shine: true, scratches: true, spatter: 'red' }} />
        <Part size={[1, 1.2, 1.2]} ramp="red" position={px(2.4, 0, 0)} />
      </group>
      <group name="spare_brush" position={[-0.4, 0.95 + 1.5 * PX, 0.12]} rotation={[0, -0.15, Math.PI / 2]}>
        <Part size={[0.8, 7, 0.8]} ramp="handle" look={{ shine: true }} />
        <Part size={[1, 1.2, 1]} ramp="metal" position={px(0, -4, 0)} />
        <Part size={[1, 1.4, 1]} ramp="blue" look={{ bristle: true }} position={px(0, -5.2, 0)} />
      </group>
      {/* The canvas rests on the ledge, leaning back with the legs; its edges and back are woven primed canvas. */}
      <group name="canvas" position={[0, 0.95 + (CANVAS * PX) / 2 + 0.06, 0.02]} rotation-x={-0.12}>
        <Part size={[width, CANVAS, 1]} ramp="canvas" look={{ weave: true }} faces={{ 4: paintingFace }} />
      </group>
      <Part size={[6, 2, 3]} ramp="wood" look={wood} position={[0, 1.07 + CANVAS * PX, -0.03]} rotation-x={-0.12} />
    </group>
  );
}

// A paint tin: thin foot ring, pressed-metal body with ridges, rivets, scratches and spattered paint, an open rim
// around a glossy paint surface, paint spilling over the rim's front and running down the side, and a
// wooden-gripped wire handle on gold lugs.
function Bucket({ at, yaw, color, size: s }) {
  const h = s * PX;
  const rim = s + 0.8;
  const spill = Math.round(s * 0.7);
  return (
    <group name={`bucket_${color}`} position={[at[0], 0, at[1]]} rotation-y={yaw}>
      <Part size={[s + 0.6, 0.6, s + 0.6]} ramp="iron" look={{ scratches: true }} position={px(0, 0.3, 0)} />
      <Part size={[s, s, s]} ramp="metal" look={{ shine: true, ridges: true, rivets: true, spatter: color }} position={px(0, s / 2 + 0.3, 0)} />
      {/* The rim is a ring of four bars, so the paint inside shows. */}
      {[-1, 1].map((side) => <Part key={`x${side}`} size={[0.8, 1, rim]} ramp="iron" look={{ scratches: true }} position={px(side * (rim / 2 - 0.4), s + 0.6, 0)} />)}
      {[-1, 1].map((side) => <Part key={`z${side}`} size={[rim - 1.6, 1, 0.8]} ramp="iron" look={{ scratches: true }} position={px(0, s + 0.6, side * (rim / 2 - 0.4))} />)}
      <Part size={[s - 0.2, 0.4, s - 0.2]} ramp={color} look={{ gloss: true }} position={px(0, s + 0.55, 0)} />
      {/* One continuous spill: across the top of the front rim, down its face, then running down the body. */}
      <Decal size={[spill, 0.8]} ramp={color} shape="film" position={px(0, s + 1.12, rim / 2 - 0.4)} rotation-x={-Math.PI / 2} />
      <Decal size={[spill, 1]} ramp={color} shape="film" position={px(0, s + 0.6, rim / 2 + 0.02)} />
      <Decal size={[spill, s * 0.75]} ramp={color} shape="drips" position={px(0, s + 0.1 - (s * 0.75) / 2, s / 2 + 0.02)} />
      {[-1, 1].map((side) => <Part key={side} size={[0.6, 1, 1]} ramp="gold" position={px(side * (rim / 2 + 0.3), s - 0.5, 0)} />)}
      {/* Wire handle laid back over the rim, with a wooden grip. */}
      {[-1, 1].map((side) => <Part key={side} size={[0.5, s * 0.6, 0.5]} ramp="iron" position={[side * (rim / 2 + 0.3) * PX, h + s * 0.18 * PX, -s * 0.16 * PX]} rotation-x={-0.6} />)}
      <Part size={[rim + 0.6, 0.5, 0.5]} ramp="iron" position={px(0, s + s * 0.42, -s * 0.33)} />
      <Part size={[3, 1, 1]} ramp="wood" look={{ grain: true }} position={px(0, s + s * 0.42, -s * 0.33)} />
    </group>
  );
}

// A paintbrush in Vaskel's banded style: lacquered handle with gold rings, metal ferrule, bristles dipped in yellow.
function Brush() {
  return (
    <group>
      <Part size={[0.9, 10, 0.9]} ramp="handle" look={{ shine: true, spatter: 'yellow' }} position={px(0, 2.5, 0)} />
      {[5.5, 1].map((y) => <Part key={y} size={[1.1, 0.8, 1.1]} ramp="gold" position={px(0, y, 0)} />)}
      <Part size={[1.3, 2, 1.3]} ramp="metal" look={{ shine: true, scratches: true }} position={px(0, -3.5, 0)} />
      <Part size={[1.2, 1.4, 1.2]} ramp="bristle" look={{ bristle: true }} position={px(0, -5.2, 0)} />
      <Part size={[1.1, 1.2, 1.1]} ramp="yellow" look={{ gloss: true, bristle: true }} position={px(0, -6.4, 0)} />
    </group>
  );
}

// A wooden palette: the grained board, a thumb hole picked out in dark wood, glossy dabs of each paint and a
// mixed smear.
function Palette() {
  const dabs = [['red', -3, -1.8], ['yellow', -0.5, -2.4], ['blue', 2, -1.6], ['lime', 3, 0.8], ['white', -2.6, 1.2], ['purple', 0.4, 1.6]];
  return (
    <group>
      <Part size={[10, 0.8, 7]} ramp="lightWood" look={{ grain: true, knots: true }} />
      <Part size={[1.6, 0.85, 1.6]} ramp="wood" position={px(3.2, 0, 2.2)} />
      {dabs.map(([color, x, z]) => <Part key={color} size={[1.6, 0.7, 1.6]} ramp={color} look={{ gloss: true }} position={px(x, 0.6, z)} />)}
      <Decal size={[3, 2]} ramp="purple" shape="splotch" position={px(-1, 0.42, 0.2)} rotation-x={-Math.PI / 2} />
    </group>
  );
}

// Vaskel at the easel: brush to the canvas, palette hand low, head turned to the work, paint on both hands. His
// screen face glows a little, like a lit screen.
function Vaskel({ images }) {
  const [x, z, yaw] = VASKEL;
  return (
    <Figure
      name="vaskel" skin={images.skin} slim glow={0.15} position={[x, 0.75, z]} rotation={[0, yaw, 0]}
      pose={{ body: [0.04, 0, 0], head: [0.05, -0.45, 0], rightArm: [-1.6, 0, -0.5], leftArm: [-0.75, -0.25, 0.08], rightLeg: [0.06, 0, -0.02], leftLeg: [-0.06, 0, 0.02] }}
      right={<>
        <Decal size={[3, 3]} ramp="yellow" shape="splotch" position={px(0, -8.6, 2.3)} />
        <Decal size={[4, 3]} ramp="blue" shape="splotch" position={px(-1.8, -8.2, 0.4)} rotation-y={-Math.PI / 2} />
        <Decal size={[3, 3.5]} ramp="yellow" shape="splotch" position={px(0, -10.3, 0)} rotation-x={Math.PI / 2} />
        <Decal size={[2.5, 2.5]} ramp="red" shape="splotch" position={px(1.8, -9, -0.6)} rotation-y={Math.PI / 2} />
        <group name="brush" position={[0, -10.5 * PX, 0.5 * PX]} rotation-x={-0.35}><Brush /></group>
      </>}
      left={<>
        <Decal size={[3, 3]} ramp="red" shape="splotch" position={px(0, -8.8, 2.3)} />
        <Decal size={[4, 3]} ramp="lime" shape="splotch" position={px(1.8, -8.4, 0)} rotation-y={Math.PI / 2} />
        <Decal size={[3, 2.5]} ramp="purple" shape="splotch" position={px(-1.8, -9.2, 0.6)} rotation-y={-Math.PI / 2} />
        <group name="palette" position={[1 * PX, -10.5 * PX, 2.5 * PX]} rotation={[0.75, 0.2, 0]}><Palette /></group>
      </>}
    />
  );
}

// Studio lighting for a cutout: warm key from front-left, cool rim from behind, soft sky/ground fill.
function Scene({ images }) {
  return (
    <>
      <color attach="background" args={[PAGE]} />
      <hemisphereLight args={['#c9d6ff', '#4a3a30', 0.9]} />
      <directionalLight color="#ffe2bf" intensity={2.6} position={[-4, 6, 6]} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-3} shadow-camera-right={3} shadow-camera-top={4} shadow-camera-bottom={-1} shadow-bias={-0.0004} shadow-normalBias={0.02} />
      <directionalLight color="#8fb0ff" intensity={1.8} position={[4, 4, -5]} />
      <directionalLight color="#ffd0a0" intensity={0.5} position={[5, 2, 4]} />
      <Easel images={images} />
      <Vaskel images={images} />
      {BUCKETS.map(([x, z, yaw, color, size]) => <Bucket key={color} at={[x, z]} yaw={yaw} color={color} size={size} />)}
      <Orbit azimuth={-0.3} elevation={0.2} distance={6.4} target={[0, 1.05, 0.35]} />
      {/* Ambient occlusion where the forms meet and a gentle warm/cool grade; no bloom, so the cutout has no glow. */}
      <Grade
        ao={{ aoRadius: 0.5, distanceFalloff: 0.5, intensity: 2.4, color: '#05070f', quality: 'ultra' }}
        tone={{ shadowTint: [0.9, 0.96, 1.18], highlightTint: [1.12, 1.02, 0.9], saturation: 1.1 }}
      />
    </>
  );
}

start(Scene, {
  name: 'vaskel_easel', mode: 'cutout', fov: 30, images: { painting: paintingUrl, skin: skinUrl },
  keep: (images) => ({ vaskel_skin: images.skin, painting: images.painting }),
});
