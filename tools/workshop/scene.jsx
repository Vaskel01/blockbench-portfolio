// Staged render for the home page's store teaser: Vaskel painting at an easel, brush in one hand and palette in
// the other, paint buckets at his feet, rendered as a transparent cutout so it sits straight on the page. Not part
// of the site; `npm run render:workshop` bundles this and tools/render-workshop.mjs snapshots it.
import { Canvas, useThree } from '@react-three/fiber';
import { Bloom, EffectComposer, N8AO, SMAA, ToneMapping } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import { createRoot } from 'react-dom/client';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { SplitToneEffect } from '../../camp/src/effects.jsx';
import { PX, entityBox, pixelTexture } from '../../camp/src/minecraft.js';
import skinUrl from '../../renders/vaskel-skin.png';
import paintingUrl from '../../assets/minecraft/painting/pond.png';

// The store section's colour (--bg-2): the graded pass is rendered over it, so any edge blending matches the page.
const PAGE = '#0f1327';
const BLOCKS = ['spruce_planks', 'oak_planks'];
// Canvas height in pixels; the width follows the painting's aspect.
const CANVAS = 20;
// Placement: [x, z, yaw] where yaw 0 faces the camera side and +PI/2 faces +x.
const EASEL = [-0.55, 0.35, 0.25];
const VASKEL = [0.45, 0.5, -0.45];
// Paint buckets around the easel and his feet: [x, z, yaw, paint colour, size in px].
const BUCKETS = [
  [-1.15, 0.85, 0.3, '#e8493a', 7], [-0.2, 1.05, -0.2, '#3fa4e8', 6], [1.0, 1.0, 0.5, '#f2b63c', 7],
  [-1.2, 0.05, -0.4, '#5cc46a', 6], [0.05, 0.55, 0.9, '#b45cf0', 5],
];
const PAINT = ['#e8493a', '#f2b63c', '#3fa4e8', '#5cc46a', '#f4f1ea'];

const load = (src) => new Promise((resolve, reject) => {
  const image = new Image();
  image.onload = () => resolve(image);
  image.onerror = reject;
  image.src = src;
});

// A box sized in pixels whose faces tile their texture at 16 px per block, so thin sticks keep crisp wood grain.
function stick(w, h, d) {
  const geometry = new THREE.BoxGeometry(w * PX, h * PX, d * PX);
  const sizes = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  const uv = geometry.attributes.uv;
  sizes.forEach(([u, v], face) => {
    for (let k = 0; k < 4; k++) uv.setXY(face * 4 + k, (uv.getX(face * 4 + k) * u) / 16, (uv.getY(face * 4 + k) * v) / 16);
  });
  return geometry;
}

const plain = (color, extra) => new THREE.MeshStandardMaterial({ color, roughness: 0.9, ...extra });

function useMaterials(images) {
  return useMemo(() => {
    const wood = (name, color) => new THREE.MeshStandardMaterial({ map: pixelTexture(images[name], { repeat: true }), roughness: 0.95, color });
    return {
      leg: wood('spruce_planks'), ledge: wood('oak_planks'), palette: wood('oak_planks', '#e8cfa0'),
      canvas: plain('#efe6d2'), painting: new THREE.MeshStandardMaterial({ map: pixelTexture(images.painting), roughness: 0.85 }),
      handle: plain('#3b2a1d'), metal: plain('#b9bec4', { metalness: 0.7, roughness: 0.35 }), tin: plain('#8d949c', { metalness: 0.75, roughness: 0.4 }),
      paint: PAINT.map((c) => plain(c, { roughness: 0.35 })),
    };
  }, [images]);
}

// A three-legged studio easel: two splayed front legs, a back prop, the canvas ledge and a top clamp.
function Easel({ t, images }) {
  const g = useMemo(() => ({
    leg: stick(1.6, 35, 1.6), ledge: stick(20, 1.6, 3.5), clamp: stick(6, 1.6, 2.4), cross: stick(15, 1.4, 1.4),
    canvas: new THREE.BoxGeometry((CANVAS * images.painting.width) / images.painting.height * PX, CANVAS * PX, PX),
  }), [images]);
  const canvasFaces = [t.canvas, t.canvas, t.canvas, t.canvas, t.painting, t.canvas];
  return (
    <group position={[EASEL[0], 0, EASEL[1]]} rotation-y={EASEL[2]}>
      {[-1, 1].map((side) => <mesh key={side} geometry={g.leg} material={t.leg} position={[side * 0.38, 1.05, 0.05]} rotation={[-0.12, 0, side * 0.13]} castShadow receiveShadow />)}
      <mesh geometry={g.leg} material={t.leg} position={[0, 1.0, -0.38]} rotation={[0.33, 0, 0]} castShadow receiveShadow />
      <mesh geometry={g.cross} material={t.leg} position={[0, 0.55, 0.12]} castShadow receiveShadow />
      <mesh geometry={g.ledge} material={t.ledge} position={[0, 0.95, 0.13]} castShadow receiveShadow />
      {/* The canvas rests on the ledge, leaning back with the legs. */}
      <mesh geometry={g.canvas} material={canvasFaces} position={[0, 0.95 + (CANVAS * PX) / 2 + 0.05, 0.02]} rotation-x={-0.12} castShadow receiveShadow />
      <mesh geometry={g.clamp} material={t.ledge} position={[0, 1.05 + CANVAS * PX, -0.03]} rotation-x={-0.12} castShadow receiveShadow />
    </group>
  );
}

// A voxel paint tin: metal body with a coloured label band, a rim, the paint surface inside and a wire handle,
// with a drip running down one side.
function Bucket({ at, yaw, color, size }) {
  const paint = useMemo(() => plain(color, { roughness: 0.3 }), [color]);
  const t = useMemo(() => ({ tin: plain('#c3c9d0', { metalness: 0.6, roughness: 0.35 }), dark: plain('#2b2f36', { metalness: 0.5, roughness: 0.5 }) }), []);
  const g = useMemo(() => ({
    body: stick(size, size, size), band: stick(size + 0.2, size * 0.3, size + 0.2), rim: stick(size + 0.4, 0.6, size + 0.4),
    surface: stick(size - 1, 0.3, size - 1), wire: stick(0.4, size * 0.55, 0.4), bar: stick(size - 0.6, 0.4, 0.4), drip: stick(1.2, size * 0.45, 0.3),
  }), [size]);
  const h = size * PX;
  return (
    <group position={[at[0], 0, at[1]]} rotation-y={yaw}>
      <mesh geometry={g.body} material={t.tin} position={[0, h / 2, 0]} castShadow receiveShadow />
      <mesh geometry={g.band} material={paint} position={[0, h * 0.45, 0]} castShadow receiveShadow />
      <mesh geometry={g.rim} material={t.dark} position={[0, h, 0]} castShadow receiveShadow />
      <mesh geometry={g.surface} material={paint} position={[0, h + 0.3 * PX, 0]} receiveShadow />
      <mesh geometry={g.drip} material={paint} position={[size * 0.2 * PX, h - (size * 0.22) * PX, (size / 2 + 0.25) * PX]} />
      {/* Wire handle, flipped back over the rim. */}
      {[-1, 1].map((s) => <mesh key={s} geometry={g.wire} material={t.dark} position={[s * (size / 2 - 0.3) * PX, h + size * 0.2 * PX, -size * 0.15 * PX]} rotation-x={-0.6} castShadow />)}
      <mesh geometry={g.bar} material={t.dark} position={[0, h + size * 0.4 * PX, -size * 0.32 * PX]} castShadow />
    </group>
  );
}

// A voxel paintbrush: dark handle, metal ferrule, bristles loaded with paint.
function Brush({ t }) {
  const g = useMemo(() => ({ handle: stick(0.9, 11, 0.9), ferrule: stick(1.3, 2, 1.3), bristle: stick(1.1, 2.4, 1.1) }), []);
  return (
    <group>
      <mesh geometry={g.handle} material={t.handle} position={[0, 2 * PX, 0]} castShadow />
      <mesh geometry={g.ferrule} material={t.metal} position={[0, -4.5 * PX, 0]} castShadow />
      <mesh geometry={g.bristle} material={t.paint[1]} position={[0, -6.7 * PX, 0]} castShadow />
    </group>
  );
}

// A wooden palette with dabs of paint.
function Palette({ t }) {
  const board = useMemo(() => stick(10, 0.7, 7), []);
  const dab = useMemo(() => stick(1.6, 0.6, 1.6), []);
  const dabs = [[-3, -1.8], [-0.5, -2.4], [2, -1.6], [3, 0.8], [-2.6, 1.2]];
  return (
    <group>
      <mesh geometry={board} material={t.palette} castShadow receiveShadow />
      {dabs.map(([x, z], i) => <mesh key={i} geometry={dab} material={t.paint[i]} position={[x * PX, 0.6 * PX, z * PX]} castShadow />)}
    </group>
  );
}

// Vaskel at the easel: brush to the canvas, palette hand low, head turned to the work. His screen face glows a
// little so the bloom picks it up.
function Vaskel({ images, t }) {
  const materials = useMemo(() => {
    const map = pixelTexture(images.skin);
    const body = new THREE.MeshStandardMaterial({ map, alphaTest: 0.5, roughness: 0.85 });
    const head = body.clone();
    head.emissiveMap = map;
    head.emissive.set('#ffffff');
    head.emissiveIntensity = 0.35;
    return { body, head };
  }, [images]);
  const parts = useMemo(() => {
    const layered = (w, h, d, base, overlay) => [entityBox(w, h, d, ...base, { flipSides: false }), entityBox(w, h, d, ...overlay, { flipSides: false, inflate: 0.5 })];
    return {
      torso: layered(8, 12, 4, [16, 16], [16, 32]), head: layered(8, 8, 8, [0, 0], [32, 0]),
      rightArm: layered(3, 12, 4, [40, 16], [40, 32]), leftArm: layered(3, 12, 4, [32, 48], [48, 48]),
      rightLeg: layered(4, 12, 4, [0, 16], [0, 32]), leftLeg: layered(4, 12, 4, [16, 48], [0, 48]),
    };
  }, []);
  const part = (pair, y, material) => pair.map((g, i) => <mesh key={i} geometry={g} material={material} position={[0, y, 0]} castShadow receiveShadow />);
  const [x, z, yaw] = VASKEL;
  return (
    <group position={[x, 0.75, z]} rotation-y={yaw}>
      <group rotation-x={0.04}>
        {part(parts.torso, 6 * PX, materials.body)}
        <group position={[0, 12 * PX, 0]} rotation={[0.05, -0.45, 0]}>{part(parts.head, 4 * PX, materials.head)}</group>
        <group position={[-5.5 * PX, 10 * PX, 0]} rotation={[-1.6, 0, -0.5]}>
          {part(parts.rightArm, -4 * PX, materials.body)}
          <group position={[0, -10.5 * PX, 0.5 * PX]} rotation-x={-0.35}><Brush t={t} /></group>
        </group>
        <group position={[5.5 * PX, 10 * PX, 0]} rotation={[-0.75, -0.25, 0.08]}>
          {part(parts.leftArm, -4 * PX, materials.body)}
          <group position={[1 * PX, -10.5 * PX, 2.5 * PX]} rotation={[0.75, 0.2, 0]}><Palette t={t} /></group>
        </group>
      </group>
      <group position={[-2 * PX, 0, 0]} rotation={[0.06, 0, -0.02]}>{part(parts.rightLeg, -6 * PX, materials.body)}</group>
      <group position={[2 * PX, 0, 0]} rotation={[-0.06, 0, 0.02]}>{part(parts.leftLeg, -6 * PX, materials.body)}</group>
    </group>
  );
}

function Framing() {
  const camera = useThree((s) => s.camera);
  useEffect(() => {
    const [azimuth, elevation, distance, target] = [-0.3, 0.2, 7.0, [0, 1.05, 0.35]];
    camera.position.set(target[0] + Math.sin(azimuth) * Math.cos(elevation) * distance, target[1] + Math.sin(elevation) * distance, target[2] + Math.cos(azimuth) * Math.cos(elevation) * distance);
    camera.lookAt(...target);
    camera.updateProjectionMatrix();
  }, [camera]);
  return null;
}

// Ambient occlusion where the forms meet, a soft bloom on the screen face and paint, a gentle warm/cool grade.
function Grade() {
  const grade = useMemo(() => new SplitToneEffect({ shadowTint: [0.9, 0.96, 1.18], highlightTint: [1.12, 1.02, 0.9], saturation: 1.1 }), []);
  return (
    <EffectComposer multisampling={8} frameBufferType={THREE.HalfFloatType}>
      <N8AO aoRadius={0.5} distanceFalloff={0.5} intensity={2.4} color="#05070f" quality="ultra" />
      <Bloom mipmapBlur intensity={0.55} luminanceThreshold={0.8} luminanceSmoothing={0.25} radius={0.6} />
      <primitive object={grade} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <SMAA />
    </EffectComposer>
  );
}

// The graded pass needs an opaque background, so the cutout is taken in two passes once the scene has settled: the
// graded frame over the page colour, then a flat white silhouette rendered by hand onto a clear background, whose
// alpha becomes the cutout's mask.
function Capture() {
  const { gl, scene, camera } = useThree();
  useEffect(() => {
    const timer = setTimeout(() => {
      const colorPass = gl.domElement.toDataURL('image/png');
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
      finish(colorPass, gl.domElement.toDataURL('image/png'), gl.domElement.width / 2, gl.domElement.height / 2);
    }, 5000);
    return () => clearTimeout(timer);
  }, []);
  return null;
}

// Downsample both 2x passes, cut the colour pass with the mask, trim the empty margin and hand back a WebP.
async function finish(colorUrl, maskUrl, w, h) {
  const [color, mask] = await Promise.all([load(colorUrl), load(maskUrl)]);
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const ctx = out.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(color, 0, 0, w, h);
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
  const result = document.createElement('pre');
  result.id = 'result';
  result.hidden = true;
  result.textContent = 'WEBP:' + crop.toDataURL('image/webp', 0.92);
  document.body.append(result);
}

// Studio lighting for a cutout: warm key from front-left, cool rim from behind, soft sky/ground fill.
function Scene({ images }) {
  const t = useMaterials(images);
  return (
    <>
      <color attach="background" args={[PAGE]} />
      <hemisphereLight args={['#c9d6ff', '#4a3a30', 0.9]} />
      <directionalLight color="#ffe2bf" intensity={2.6} position={[-4, 6, 6]} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-3} shadow-camera-right={3} shadow-camera-top={4} shadow-camera-bottom={-1} shadow-bias={-0.0004} shadow-normalBias={0.02} />
      <directionalLight color="#8fb0ff" intensity={1.8} position={[4, 4, -5]} />
      <directionalLight color="#ffd0a0" intensity={0.5} position={[5, 2, 4]} />
      <Easel t={t} images={images} />
      <Vaskel images={images} t={t} />
      {BUCKETS.map(([x, z, yaw, color, size], i) => <Bucket key={i} at={[x, z]} yaw={yaw} color={color} size={size} />)}
      <Framing />
      <Grade />
      <Capture />
    </>
  );
}

Promise.all([...BLOCKS.map((n) => import(`../../assets/minecraft/block/${n}.png`))])
  .then((modules) => Promise.all([...modules.map((m) => load(m.default)), load(paintingUrl), load(skinUrl)]))
  .then((loaded) => {
    const names = [...BLOCKS, 'painting', 'skin'];
    const images = Object.fromEntries(names.map((n, i) => [n, loaded[i]]));
    createRoot(document.getElementById('root')).render(
      <Canvas shadows flat dpr={2} camera={{ fov: 30, near: 0.1, far: 60 }} gl={{ alpha: true, antialias: true, preserveDrawingBuffer: true }}>
        <Scene images={images} />
      </Canvas>,
    );
  });
