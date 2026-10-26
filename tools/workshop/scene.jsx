// Staged render for the home page's store teaser: Vaskel at the anvil, mid-strike on a glowing blade, in a dark
// forge lit only by the hot metal and its sparks. Not part of the site; `npm run render:workshop` bundles this
// and tools/render-workshop.mjs snapshots it to renders/workshop-vaskel.webp.
import { Canvas, useThree } from '@react-three/fiber';
import { Bloom, DepthOfField, EffectComposer, N8AO, ToneMapping, Vignette } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import { createRoot } from 'react-dom/client';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { SplitToneEffect } from '../../camp/src/effects.jsx';
import { PX, entityBox, logGeometry, pixelTexture } from '../../camp/src/minecraft.js';
import skinUrl from '../../renders/vaskel-skin.png';

// The home page section colour (--bg-2): the darks sink into it so the image melts into the section.
const PAGE = '#0f1327';
const BLOCKS = ['anvil', 'anvil_top', 'bricks', 'item_frame', 'polished_blackstone_bricks', 'spruce_planks', 'oak_planks',
  'dark_oak_log', 'stripped_oak_log', 'stripped_oak_log_top', 'barrel_side', 'barrel_top'];
const ITEMS = ['iron_sword', 'mace', 'diamond_sword', 'golden_sword', 'iron_pickaxe', 'iron_axe', 'shears', 'amethyst_shard',
  'writable_book', 'iron_ingot', 'eye_armor_trim_smithing_template', 'netherite_upgrade_smithing_template', 'filled_map'];
// Where the hammer meets the blade: the light, the sparks and the focus all start here.
const STRIKE = new THREE.Vector3(0.12, 1.03, 0.55);
const load = (src) => new Promise((resolve, reject) => {
  const image = new Image();
  image.onload = () => resolve(image);
  image.onerror = reject;
  image.src = src;
});
// Seeded, so every render scatters the sparks the same way.
const random = (() => { let s = 7; return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646; })();

// A model element in 16ths of a block, textured the way Minecraft auto-maps one: each face shows the patch of
// texture under its own footprint, so a thin waist keeps crisp, unstretched pixels.
function element(from, to) {
  const size = to.map((v, i) => (v - from[i]) * PX);
  const geometry = new THREE.BoxGeometry(...size);
  const [x0, y0, z0] = from;
  const [x1, y1, z1] = to;
  const rects = [[16 - z1, 16 - z0, y0, y1], [z0, z1, y0, y1], [x0, x1, 16 - z1, 16 - z0], [x0, x1, z0, z1], [x0, x1, y0, y1], [16 - x1, 16 - x0, y0, y1]];
  const uv = geometry.attributes.uv;
  rects.forEach(([u0, u1, v0, v1], face) => {
    for (let k = 0; k < 4; k++) {
      const i = face * 4 + k;
      uv.setXY(i, (u0 + uv.getX(i) * (u1 - u0)) / 16, (v0 + uv.getY(i) * (v1 - v0)) / 16);
    }
  });
  geometry.translate(...from.map((v, i) => v * PX + size[i] / 2 - 0.5));
  return geometry;
}

function useMaterials(images) {
  return useMemo(() => {
    const tex = (name, repeat) => {
      const texture = pixelTexture(images[name], { repeat: !!repeat });
      if (repeat) texture.repeat.set(...repeat);
      return texture;
    };
    const m = (map, extra = {}) => new THREE.MeshStandardMaterial({ map, roughness: 1, ...extra });
    const iron = { metalness: 0.55, roughness: 0.45 };
    return {
      anvil: m(tex('anvil'), iron), anvilTop: m(tex('anvil_top'), iron),
      wall: m(tex('bricks', [9, 5]), { color: '#8c8580' }), floor: m(tex('polished_blackstone_bricks', [10, 10]), { roughness: 0.8 }),
      frame: m(tex('item_frame')), top: m(tex('oak_planks', [3, 1.25])), board: m(tex('spruce_planks', [3, 1.4])), leg: m(tex('dark_oak_log')),
      beam: [m(tex('stripped_oak_log')), m(tex('stripped_oak_log_top'))],
      barrel: [m(tex('barrel_side')), m(tex('barrel_side')), m(tex('barrel_top')), m(tex('barrel_top')), m(tex('barrel_side')), m(tex('barrel_side'))],
      item: (name, extra = {}) => new THREE.MeshStandardMaterial({ map: pixelTexture(images[name]), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.9, ...extra }),
      // The blade fresh from the coals: its own pixels glow white-orange, hot enough to bloom.
      hot: new THREE.MeshStandardMaterial({ map: pixelTexture(images.iron_sword), alphaTest: 0.5, side: THREE.DoubleSide, emissiveMap: pixelTexture(images.iron_sword), emissive: '#ff7a1c', emissiveIntensity: 2.2, color: '#ffb46a' }),
      spark: new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffb04a').multiplyScalar(4), toneMapped: false }),
      ember: new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff6a1a').multiplyScalar(2.5), toneMapped: false }),
    };
  }, [images]);
}

// A vanilla anvil (base, foot, waist, face), turned so its long face is to the camera.
function Anvil({ t }) {
  const parts = useMemo(() => [element([2, 0, 2], [14, 4, 14]), element([4, 4, 3], [12, 5, 13]), element([6, 5, 4], [10, 10, 12]), element([3, 10, 0], [13, 16, 16])], []);
  const face = [t.anvil, t.anvil, t.anvilTop, t.anvil, t.anvil, t.anvil];
  return (
    <group position={[0.1, 0.5, 0.55]} rotation-y={Math.PI / 2}>
      {parts.map((g, i) => <mesh key={i} geometry={g} material={i === 3 ? face : t.anvil} castShadow receiveShadow />)}
    </group>
  );
}

// Streaks thrown off the strike, plus slower embers drifting through the dark.
function Sparks({ t }) {
  const streaks = useMemo(() => Array.from({ length: 34 }, () => {
    const dir = new THREE.Vector3(random() * 2 - 1, random() * 1.1 + 0.05, random() * 2 - 1).normalize();
    const reach = 0.1 + Math.pow(random(), 1.8) * 1.1;
    const length = 0.03 + random() * 0.09 * (1.2 - reach / 1.3);
    const at = STRIKE.clone().addScaledVector(dir, reach);
    const look = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
    return { at, look, length, thick: 0.004 + random() * 0.004 };
  }), []);
  const embers = useMemo(() => Array.from({ length: 22 }, () => ({
    at: [STRIKE.x + (random() * 2 - 1) * 2.6, 0.3 + random() * 2.6, STRIKE.z + (random() * 2 - 1) * 1.6],
    size: 0.006 + random() * 0.008,
  })), []);
  const unit = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  return (
    <>
      {streaks.map((s, i) => <mesh key={i} geometry={unit} material={t.spark} position={s.at} quaternion={s.look} scale={[s.thick, s.thick, s.length]} />)}
      {embers.map((e, i) => <mesh key={`e${i}`} geometry={unit} material={t.ember} position={e.at} scale={e.size} />)}
    </>
  );
}

// Framed pieces on the wall and one big frame close to the lens, thrown out of focus.
function Frame({ t, item, at, rotation, size = 0.8 }) {
  const unit = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  const plane = useMemo(() => new THREE.PlaneGeometry(1, 1), []);
  const art = useMemo(() => t.item(item, { side: THREE.FrontSide }), [t, item]);
  return (
    <group position={at} rotation={rotation} scale={size}>
      <mesh geometry={unit} material={t.frame} scale={[1, 1, 0.07]} castShadow receiveShadow />
      <mesh geometry={plane} material={art} position={[0, 0, 0.045]} scale={0.78} />
    </group>
  );
}

function Workshop({ t }) {
  const unit = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  const plane = useMemo(() => new THREE.PlaneGeometry(1, 1), []);
  const crossbar = useMemo(() => logGeometry(2.4, 0.2, 0.2), []);
  const Box = ({ at, size, material, rotation }) => <mesh geometry={unit} material={material} position={at} scale={size} rotation={rotation} castShadow receiveShadow />;
  const Item = ({ name, at, rotation = [0, 0, 0], size = 0.5 }) => <mesh geometry={plane} material={t.item(name)} position={at} rotation={rotation} scale={size} castShadow />;
  const flat = (turn) => [-Math.PI / 2, 0, turn];
  return (
    <>
      {/* Brick back wall and a blackstone floor; both fall off into the dark away from the anvil. */}
      <mesh geometry={plane} material={t.wall} position={[0, 2.5, -1.4]} scale={[9, 5, 1]} receiveShadow />
      <mesh geometry={plane} material={t.floor} rotation-x={-Math.PI / 2} position={[0, 0, 1]} scale={[10, 10, 1]} receiveShadow />
      <Frame t={t} item="eye_armor_trim_smithing_template" at={[-1.55, 2.35, -1.33]} rotation={[0, 0, 0.06]} size={0.62} />
      <Frame t={t} item="netherite_upgrade_smithing_template" at={[1.75, 2.55, -1.33]} rotation={[0, 0, -0.05]} size={0.7} />
      <Frame t={t} item="diamond_sword" at={[2.35, 1.75, -1.33]} rotation={[0, 0, 0.04]} size={0.5} />
      {/* Tool rack on the wall behind Vaskel. */}
      <mesh geometry={crossbar} material={t.beam} position={[-0.2, 2.75, -1.25]} castShadow />
      {[['iron_pickaxe', -1.0], ['iron_axe', -0.45], ['shears', 0.05], ['golden_sword', 0.55]].map(([name, x]) => (
        <Item key={name} name={name} at={[x, 2.35, -1.3]} size={0.5} />
      ))}
      {/* Workbench to the left with the raw materials, and a barrel in the shadows to the right. */}
      <group position={[-2.05, 0, 0.1]} rotation-y={0.35}>
        <Box at={[0, 0.9, 0]} size={[1.6, 0.14, 0.9]} material={t.top} />
        {[[-0.7, -0.35], [0.7, -0.35], [-0.7, 0.35], [0.7, 0.35]].map(([x, z]) => <Box key={`${x}${z}`} at={[x, 0.42, z]} size={[0.15, 0.84, 0.15]} material={t.leg} />)}
        <Item name="amethyst_shard" at={[0.35, 0.98, 0.15]} rotation={flat(-0.3)} size={0.3} />
        <Item name="iron_ingot" at={[0.0, 0.98, 0.2]} rotation={flat(0.4)} size={0.32} />
        <Item name="writable_book" at={[-0.4, 0.98, -0.05]} rotation={flat(0.2)} size={0.42} />
      </group>
      <Box at={[2.0, 0.44, 0.0]} size={[0.88, 0.88, 0.88]} material={t.barrel} rotation={[0, -0.4, 0]} />
      <Anvil t={t} />
      {/* The hot blade on the anvil face, and the light it throws. */}
      <mesh geometry={plane} material={t.hot} position={[STRIKE.x - 0.05, 1.005, STRIKE.z + 0.02]} rotation={flat(-Math.PI / 4 + 0.15)} scale={0.78} />
      <pointLight position={[STRIKE.x - 0.1, STRIKE.y + 0.06, STRIKE.z + 0.4]} color="#ff7a26" intensity={4} distance={9} decay={2} castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.002} />
      <pointLight position={[STRIKE.x, 0.4, STRIKE.z + 0.7]} color="#ff5a14" intensity={1.5} distance={4} decay={2} />
      <Frame t={t} item="filled_map" at={[-1.05, 0.75, 2.15]} rotation={[-0.7, 0.5, 0.3]} size={0.6} />
      <Sparks t={t} />
    </>
  );
}

// Vaskel behind the anvil at the moment of the strike: mace head down on the blade, left hand braced, eyes on the work.
function Vaskel({ images, t }) {
  const materials = useMemo(() => {
    const map = pixelTexture(images.skin);
    const body = new THREE.MeshStandardMaterial({ map, alphaTest: 0.5, roughness: 0.85 });
    const head = body.clone();
    head.emissiveMap = map;
    head.emissive.set('#ffffff');
    head.emissiveIntensity = 0.03;
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
  const mace = useMemo(() => t.item('mace', { metalness: 0.4, roughness: 0.5 }), [t]);
  const part = (pair, y, material) => pair.map((g, i) => <mesh key={i} geometry={g} material={material} position={[0, y, 0]} castShadow receiveShadow />);
  return (
    <group position={[0.2, 0.75, -0.25]} rotation-y={0.2}>
      <group rotation-x={0.18}>
        {part(parts.torso, 6 * PX, materials.body)}
        <group position={[0, 12 * PX, 0]} rotation={[0.5, -0.1, 0]}>{part(parts.head, 4 * PX, materials.head)}</group>
        <group position={[-5.5 * PX, 10 * PX, 0]} rotation={[-1.6, 0.3, 0.05]}>
          {part(parts.rightArm, -4 * PX, materials.body)}
          <mesh geometry={new THREE.PlaneGeometry(0.5, 0.5)} material={mace} position={[0, -0.64, -0.11]} rotation={[0, -Math.PI / 2, 2.56]} castShadow />
        </group>
        <group position={[5.5 * PX, 10 * PX, 0]} rotation={[-1.0, -0.35, 0.15]}>{part(parts.leftArm, -4 * PX, materials.body)}</group>
      </group>
      <group position={[-2 * PX, 0, 0]} rotation={[0.08, 0, -0.04]}>{part(parts.rightLeg, -6 * PX, materials.body)}</group>
      <group position={[2 * PX, 0, 0]} rotation={[-0.1, 0, 0.04]}>{part(parts.leftLeg, -6 * PX, materials.body)}</group>
    </group>
  );
}

// Close, slightly high and rolled off level, the way a cinematic insert shot would frame the strike.
function Framing() {
  const camera = useThree((s) => s.camera);
  useEffect(() => {
    camera.position.set(-1.25, 2.05, 3.35);
    camera.lookAt(0.25, 1.3, 0.05);
    camera.rotateZ(-0.14);
    camera.updateProjectionMatrix();
  }, [camera]);
  return null;
}

function Grade() {
  const grade = useMemo(() => new SplitToneEffect({ shadowTint: [0.78, 0.86, 1.3], highlightTint: [1.3, 1.04, 0.74], saturation: 1.06 }), []);
  return (
    <EffectComposer multisampling={4} frameBufferType={THREE.HalfFloatType}>
      <N8AO aoRadius={0.8} distanceFalloff={0.5} intensity={3.6} color="#020308" quality="high" />
      <DepthOfField target={STRIKE.toArray()} focusRange={2.2} bokehScale={5} resolutionScale={1} />
      <Bloom mipmapBlur intensity={1.0} luminanceThreshold={0.85} luminanceSmoothing={0.25} radius={0.8} />
      <primitive object={grade} />
      <Vignette offset={0.22} darkness={0.8} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
    </EffectComposer>
  );
}

function Scene({ images }) {
  const t = useMaterials(images);
  return (
    <>
      <color attach="background" args={[PAGE]} />
      <fogExp2 attach="fog" args={[PAGE, 0.11]} />
      <ambientLight color="#3a4a80" intensity={0.22} />
      {/* A faint cool rim from high behind, just enough to edge Vaskel and the frames against the dark. */}
      <directionalLight color="#6f88ff" intensity={0.4} position={[-3, 6, -5]} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-5} shadow-camera-right={5} shadow-camera-top={5} shadow-camera-bottom={-5} shadow-bias={-0.0003} />
      {/* Warm bounce off the coals from low front-left, and an orange forge rim from behind-right that edges every form. */}
      <pointLight position={[-0.9, 0.8, 1.9]} color="#ff8c3a" intensity={3.5} distance={6} decay={2} />
      <directionalLight color="#ff8a3a" intensity={2.2} position={[3, 2.6, -2.5]} />
      {/* Forge glow washing the brick wall behind him, so his silhouette sits against a warm halo. */}
      <pointLight position={[0.55, 1.15, -0.95]} color="#ff8c3a" intensity={3.4} distance={4} decay={1.6} />
      <Workshop t={t} />
      <Vaskel images={images} t={t} />
      <Framing />
      <Grade />
    </>
  );
}

Promise.all([...BLOCKS.map((n) => import(`../../assets/minecraft/block/${n}.png`)), ...ITEMS.map((n) => import(`../../assets/minecraft/item/${n}.png`))])
  .then((modules) => Promise.all([...modules.map((m) => load(m.default)), load(skinUrl)]))
  .then((loaded) => {
    const names = [...BLOCKS, ...ITEMS, 'skin'];
    const images = Object.fromEntries(names.map((n, i) => [n, loaded[i]]));
    createRoot(document.getElementById('root')).render(
      <Canvas shadows flat dpr={2} camera={{ fov: 40, near: 0.1, far: 60 }} gl={{ antialias: false, preserveDrawingBuffer: true }}>
        <Scene images={images} />
      </Canvas>,
    );
    setTimeout(() => document.body.setAttribute('data-ready', '1'), 6000);
  });
