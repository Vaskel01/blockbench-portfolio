// Staged render for the home page's store teaser: Vaskel at a crafting table in a cosy lantern-lit workshop.
// Not part of the site; `npm run render:workshop` bundles this and tools/render-workshop.mjs snapshots it
// to renders/workshop-vaskel.webp.
import { Canvas, useThree } from '@react-three/fiber';
import { createRoot } from 'react-dom/client';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { PostFX } from '../../camp/src/effects.jsx';
import { PX, entityBox, logGeometry, pixelTexture } from '../../camp/src/minecraft.js';
import skinUrl from '../../renders/vaskel-skin.png';
import chestUrl from '../../assets/minecraft/entity/chest/normal.png';

const BLOCKS = ['oak_planks', 'spruce_planks', 'stripped_oak_log', 'stripped_oak_log_top', 'crafting_table_top', 'crafting_table_front',
  'crafting_table_side', 'smithing_table_top', 'smithing_table_front', 'smithing_table_side', 'smithing_table_bottom', 'bookshelf', 'glass',
  'barrel_side', 'barrel_top', 'cobblestone'];
const ITEMS = ['diamond_sword', 'iron_axe', 'blaze_rod', 'golden_sword', 'bow', 'item_frame'];
const load = (src) => new Promise((resolve, reject) => {
  const image = new Image();
  image.onload = () => resolve(image);
  image.onerror = reject;
  image.src = src;
});

function Workshop({ images }) {
  const t = useMemo(() => {
    const tex = (name, repeat) => {
      const texture = pixelTexture(images[name], { repeat: !!repeat });
      if (repeat) texture.repeat.set(...repeat);
      return texture;
    };
    const m = (map, extra = {}) => new THREE.MeshStandardMaterial({ map, roughness: 1, ...extra });
    const sides = (side, top, bottom = top) => [m(side), m(side), m(top), m(bottom), m(side), m(side)];
    return {
      floor: m(tex('spruce_planks', [11, 9])), wall: m(tex('oak_planks', [11, 5])), side: m(tex('oak_planks', [8, 5])),
      beam: [m(tex('stripped_oak_log')), m(tex('stripped_oak_log_top'))],
      crafting: [m(tex('crafting_table_side')), m(tex('crafting_table_side')), m(tex('crafting_table_top')), m(tex('oak_planks')), m(tex('crafting_table_front')), m(tex('crafting_table_side'))],
      smithing: [m(tex('smithing_table_side')), m(tex('smithing_table_side')), m(tex('smithing_table_top')), m(tex('smithing_table_bottom')), m(tex('smithing_table_front')), m(tex('smithing_table_front'))],
      shelf: sides(tex('bookshelf'), tex('oak_planks')), barrel: sides(tex('barrel_side'), tex('barrel_top')),
      glass: m(tex('glass', [2, 2]), { transparent: true, opacity: 0.55, emissive: '#3a5fa8', emissiveIntensity: 0.35 }),
      lantern: m(null, { color: '#ffdc93', emissive: '#ffb45c', emissiveIntensity: 3.2 }), iron: m(null, { color: '#2e3a42', metalness: 0.5, roughness: 0.6 }),
      item: (name) => new THREE.MeshStandardMaterial({ map: pixelTexture(images[name]), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 1, emissiveMap: pixelTexture(images[name]), emissive: '#ffffff', emissiveIntensity: 0.15 }),
      chest: m(pixelTexture(images.chest)),
    };
  }, [images]);
  const unit = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  const plane = useMemo(() => new THREE.PlaneGeometry(1, 1), []);
  const Block = ({ at, material, scale = [1, 1, 1] }) => <mesh geometry={unit} material={material} position={at} scale={scale} castShadow receiveShadow />;
  const Item = ({ name, at, rotation = [0, 0, 0], size = 0.8 }) => <mesh geometry={plane} material={t.item(name)} position={at} rotation={rotation} scale={size} castShadow />;
  const Lantern = ({ at }) => (
    <group position={at}>
      <mesh geometry={unit} material={t.lantern} scale={[0.26, 0.31, 0.26]} />
      <mesh geometry={unit} material={t.iron} scale={[0.36, 0.07, 0.36]} position={[0, -0.2, 0]} />
      <mesh geometry={unit} material={t.iron} scale={[0.36, 0.09, 0.36]} position={[0, 0.21, 0]} />
      <pointLight color="#ff9a4a" intensity={14} distance={10} decay={2} castShadow shadow-mapSize={[512, 512]} shadow-bias={-0.002} />
    </group>
  );
  const chestParts = useMemo(() => ({ bottom: entityBox(14, 10, 14, 0, 19), lid: entityBox(14, 5, 14, 0, 0, { inflate: 0.03 }), lock: entityBox(2, 4, 1, 0, 0) }), []);
  const beam = useMemo(() => logGeometry(11, 0.5, 0.5), []);
  const post = useMemo(() => logGeometry(0.5, 5, 0.5), []);

  return (
    <>
      <color attach="background" args={['#0a1020']} />
      <fogExp2 attach="fog" args={['#1a2440', 0.02]} />
      <ambientLight color="#5a6fae" intensity={0.9} />
      {/* Moonlight pours in through the window on the left. */}
      <directionalLight color="#7f9fff" intensity={1.6} position={[-9, 6, 1]} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-8} shadow-camera-right={8} shadow-camera-top={8} shadow-camera-bottom={-8} shadow-bias={-0.0003} />
      {/* Room shell: spruce floor, plank walls, stripped-log posts and a ceiling beam. */}
      <mesh material={t.floor} rotation-x={-Math.PI / 2} position={[1, 0, 0.5]} receiveShadow><planeGeometry args={[11, 9]} /></mesh>
      <mesh material={t.wall} position={[1, 2.5, -3]} receiveShadow><planeGeometry args={[11, 5]} /></mesh>
      <group position={[-4.5, 2.5, 0.5]} rotation-y={Math.PI / 2}>
        <mesh material={t.side} position={[-2.75, 0, 0]} receiveShadow><planeGeometry args={[3.5, 5]} /></mesh>
        <mesh material={t.side} position={[3, 0, 0]} receiveShadow><planeGeometry args={[3, 5]} /></mesh>
        <mesh material={t.side} position={[0.125, -1.75, 0]} receiveShadow><planeGeometry args={[2.25, 1.5]} /></mesh>
        <mesh material={t.side} position={[0.125, 2.0, 0]} receiveShadow><planeGeometry args={[2.25, 1]} /></mesh>
        <mesh material={t.glass} position={[0.125, 0.25, 0]}><planeGeometry args={[2.25, 2.5]} /></mesh>
      </group>
      {[-4.25, 1, 6.2].map((x) => <mesh key={x} geometry={post} material={t.beam} position={[x, 2.5, -2.75]} castShadow receiveShadow />)}
      <mesh geometry={beam} material={t.beam} position={[1, 4.75, -2.75]} castShadow />
      <mesh geometry={beam} material={t.beam} position={[1, 4.75, 1.5]} castShadow />

      {/* The workbench: a crafting table with a fresh diamond sword on it, a blaze rod beside it. */}
      <Block at={[0.9, 0.5, 1.35]} material={t.crafting} />
      <Item name="diamond_sword" at={[0.85, 1.01, 1.35]} rotation={[-Math.PI / 2, 0, 0.6]} size={0.85} />
      <Item name="blaze_rod" at={[1.9, 1.01, 1.5]} rotation={[-Math.PI / 2, 0, -0.4]} size={0.6} />
      <Block at={[1.9, 0.5, 1.35]} material={t.smithing} />
      {/* Shelves, barrels and a chest along the walls. */}
      {[[3.3, -2.5], [4.3, -2.5]].map(([x, z]) => [0, 1].map((y) => <Block key={`${x}${y}`} at={[x, y + 0.5, z]} material={t.shelf} />))}
      <Block at={[-3.4, 0.5, -2.4]} material={t.barrel} />
      <Block at={[-2.4, 0.5, -2.4]} material={t.barrel} />
      <Block at={[-3.4, 1.5, -2.4]} material={t.barrel} />
      <group position={[5.2, 0, -0.6]} rotation-y={-Math.PI / 2}>
        <mesh geometry={chestParts.bottom} material={t.chest} position={[0, 5 * PX, 0]} castShadow receiveShadow />
        <group position={[0, 9 * PX, -7 * PX]}>
          <mesh geometry={chestParts.lid} material={t.chest} position={[0, 2.5 * PX, 7 * PX]} castShadow />
          <mesh geometry={chestParts.lock} material={t.chest} position={[0, 0, 14.5 * PX]} />
        </group>
      </group>
      {/* Item frames showing finished work on the back wall. */}
      {[['golden_sword', -2.2], ['bow', -0.9], ['iron_axe', 2.7]].map(([name, x]) => (
        <group key={name} position={[x, 2.7, -2.97]}>
          <mesh geometry={plane} material={t.item('item_frame')} scale={0.8} />
          <Item name={name} at={[0, 0, 0.02]} size={0.6} />
        </group>
      ))}
      <Lantern at={[1.5, 3.6, 0.7]} />
      <Lantern at={[3.8, 2.35, -2.5]} />
      <Vaskel images={images} />
      <Framing />
      <PostFX mobile={false} />
    </>
  );
}

// Vaskel mid-craft: left hand steadying the work, right arm raised with an axe, head bent over the table.
function Vaskel({ images }) {
  const materials = useMemo(() => {
    const map = pixelTexture(images.skin);
    const body = new THREE.MeshStandardMaterial({ map, alphaTest: 0.5, roughness: 0.88 });
    const head = body.clone();
    head.emissiveMap = map;
    head.emissive.set('#ffffff');
    head.emissiveIntensity = 0.16;
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
  const axe = useMemo(() => new THREE.MeshStandardMaterial({ map: pixelTexture(images.iron_axe), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 1 }), [images]);
  const part = (pair, y, material) => pair.map((g, i) => <mesh key={i} geometry={g} material={material} position={[0, y, 0]} castShadow receiveShadow />);
  return (
    <group position={[0.9, 0.75, 0.23]} rotation-y={0.25}>
      <group rotation-x={0.12}>
        {part(parts.torso, 6 * PX, materials.body)}
        <group position={[0, 12 * PX, 0]} rotation={[0.38, -0.08, 0.04]}>{part(parts.head, 4 * PX, materials.head)}</group>
        <group position={[-5.5 * PX, 10 * PX, 0]} rotation={[-2.3, 0.2, -0.15]}>
          {part(parts.rightArm, -4 * PX, materials.body)}
          <mesh geometry={new THREE.PlaneGeometry(0.8, 0.8)} material={axe} position={[0, -0.72, 0.18]} rotation={[0, Math.PI / 2, Math.PI * 0.75]} />
        </group>
        <group position={[5.5 * PX, 10 * PX, 0]} rotation={[-1.05, -0.15, 0.1]}>{part(parts.leftArm, -4 * PX, materials.body)}</group>
      </group>
      <group position={[-2 * PX, 0, 0]} rotation={[0.05, 0, -0.03]}>{part(parts.rightLeg, -6 * PX, materials.body)}</group>
      <group position={[2 * PX, 0, 0]} rotation={[-0.05, 0, 0.03]}>{part(parts.leftLeg, -6 * PX, materials.body)}</group>
    </group>
  );
}

function Framing() {
  const camera = useThree((s) => s.camera);
  useEffect(() => {
    camera.position.set(4.2, 3.5, 5.6);
    camera.lookAt(0.7, 1.2, -0.2);
    camera.updateProjectionMatrix();
  }, [camera]);
  return null;
}

Promise.all([...BLOCKS.map((n) => import(`../../assets/minecraft/block/${n}.png`)), ...ITEMS.map((n) => import(`../../assets/minecraft/item/${n}.png`))])
  .then((modules) => Promise.all([...modules.map((m) => load(m.default)), load(skinUrl), load(chestUrl)]))
  .then((loaded) => {
    const names = [...BLOCKS, ...ITEMS, 'skin', 'chest'];
    const images = Object.fromEntries(names.map((n, i) => [n, loaded[i]]));
    createRoot(document.getElementById('root')).render(
      <Canvas shadows flat dpr={1} camera={{ fov: 40, near: 0.1, far: 80 }} gl={{ antialias: false, preserveDrawingBuffer: true }}>
        <Workshop images={images} />
      </Canvas>,
    );
    setTimeout(() => document.body.setAttribute('data-ready', '1'), 6000);
  });
