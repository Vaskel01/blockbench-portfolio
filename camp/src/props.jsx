// The camp's hero props: the vanilla campfire, the chest, the log seat, Vaskel himself, embers and fireflies.
import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { camp, fireBoost, waveEnvelope } from './camp.js';
import { CAMPFIRE_ELEMENTS, PX, blockModel, entityBox, logGeometry, pixelTexture, setFrame } from './minecraft.js';
import { haloMap, heightAt, rng } from './world.js';

export const FIRE_POSITION = [2.35, 0, 1.7];
const register = (key) => (object) => {
  camp.refs[key] = object;
};

// The real Minecraft campfire block (template_campfire.json) with its animated lit-log and fire textures,
// a flickering warm point light inside it, and a little extra flame when it is stoked.
export function Campfire({ images, mobile }) {
  const parts = useMemo(() => blockModel(CAMPFIRE_ELEMENTS), []);
  const textures = useMemo(() => ({
    log: pixelTexture(images.campfire_log),
    lit: pixelTexture(images.campfire_log_lit, { frames: 4 }),
    fire: pixelTexture(images.campfire_fire, { frames: 8 }),
  }), [images]);
  const materials = useMemo(() => {
    const fire = new THREE.MeshBasicMaterial({ map: textures.fire, transparent: true, alphaTest: 0.1, depthWrite: false });
    fire.color.setScalar(2.6); // HDR flame, comfortably above the bloom threshold
    return {
      // A lit campfire is full-bright in the game (light level 15): its faces glow by their own texture rather
      // than going black on the sides its inner light cannot reach. The embers glow hottest.
      log: new THREE.MeshStandardMaterial({ map: textures.log, emissiveMap: textures.log, emissive: '#ffb27a', emissiveIntensity: 0.4, roughness: 1 }),
      lit_log: new THREE.MeshStandardMaterial({ map: textures.lit, emissiveMap: textures.lit, emissive: '#ffffff', emissiveIntensity: 1.2, roughness: 1 }),
      fire,
    };
  }, [textures]);
  const flame = useRef(), light = useRef();

  useFrame(() => {
    const t = camp.ambient, boost = fireBoost();
    setFrame(textures.fire, Math.floor(t * 10) % 8, 8); // frametime 2 ticks
    setFrame(textures.lit, Math.floor(t) % 4, 4); // frametime 20 ticks
    flame.current.scale.set(1 + boost * 0.15, 1 + boost * 0.55, 1 + boost * 0.15);
    const flicker = 1 + Math.sin(t * 9.7) * 0.07 + Math.sin(t * 17.3) * 0.05 + Math.sin(t * 3.1 + 1) * 0.06;
    light.current.intensity = 16 * flicker * (1 + boost * 0.7);
    light.current.position.set(Math.sin(t * 7.1) * 0.03, 0.95 + Math.sin(t * 5.3) * 0.03, Math.cos(t * 6.2) * 0.03);
  });

  return (
    <group ref={register('fire')} position={FIRE_POSITION} userData={{ action: 'fire' }}>
      <group scale={1.15}>
        {/* Like the game, the campfire never shadows its own light. */}
        <mesh geometry={parts.log} material={materials.log} receiveShadow />
        <mesh geometry={parts.lit_log} material={materials.lit_log} receiveShadow />
        <mesh ref={flame} geometry={parts.fire} material={materials.fire} />
      </group>
      <pointLight
        ref={light}
        color="#ff8a3d"
        intensity={16}
        distance={11}
        decay={2}
        castShadow
        shadow-mapSize={mobile ? [256, 256] : [512, 512]}
        shadow-bias={-0.001}
        shadow-normalBias={0.03}
        shadow-camera-near={0.1}
        shadow-camera-far={10}
      />
    </group>
  );
}

// The vanilla single chest entity (entity/chest/normal.png): 14px body, hinged lid and latch.
export function Chest({ image }) {
  const material = useMemo(() => new THREE.MeshStandardMaterial({ map: pixelTexture(image), roughness: 1 }), [image]);
  const parts = useMemo(() => ({
    bottom: entityBox(14, 10, 14, 0, 19),
    lid: entityBox(14, 5, 14, 0, 0, { inflate: 0.03 }),
    lock: entityBox(2, 4, 1, 0, 0),
  }), []);
  const lid = useRef();
  useFrame((_, delta) => {
    const target = camp.chestOpen ? -1.5 : 0, angle = lid.current.rotation.x;
    lid.current.rotation.x += (target - angle) * (1 - Math.exp(-Math.min(delta, 0.25) * 10));
    camp.lidMoving = Math.abs(target - lid.current.rotation.x) > 0.0005;
  });
  return (
    <group ref={register('chest')} position={[3.65, 0, -0.7]} rotation-y={-0.28} userData={{ action: 'chest' }}>
      <mesh geometry={parts.bottom} material={material} position={[0, 5 * PX, 0]} castShadow receiveShadow />
      <group ref={lid} position={[0, 9 * PX, -7 * PX]}>
        <mesh geometry={parts.lid} material={material} position={[0, 2.5 * PX, 7 * PX]} castShadow receiveShadow />
        <mesh geometry={parts.lock} material={material} position={[0, 0, 14.5 * PX]} castShadow />
      </group>
    </group>
  );
}

// A fallen oak log; Vaskel sits on its front edge and leans back on his hands near the far edge.
export const SEAT = { position: [0.9, 0, 0.23], yaw: 0.34, height: 0.5, depth: -0.26 };
export function LogSeat({ oak }) {
  const geometry = useMemo(() => logGeometry(2.8, SEAT.height, SEAT.height), []);
  const materials = useMemo(() => [
    new THREE.MeshStandardMaterial({ map: oak.side, roughness: 1 }),
    new THREE.MeshStandardMaterial({ map: oak.end, roughness: 1 }),
  ], [oak]);
  return (
    <group position={SEAT.position} rotation-y={SEAT.yaw}>
      <mesh geometry={geometry} material={materials} position={[0, SEAT.height / 2, SEAT.depth]} castShadow receiveShadow />
    </group>
  );
}

// Head glances the idle cycles through, [yaw, pitch], relative to the leaned-back torso (which already tips
// the face up a little): toward the fire, up at the sky, across the valley.
const GLANCES = [[0, 0.18], [0.32, 0.24], [0.06, 0.08], [-0.26, 0.2], [0.18, 0.28], [-0.08, 0.12]];

// Slim-arm Minecraft rig with rigid limbs, mapped from Vaskel's 64×64 skin (base layer + 0.5px overlay).
export function Vaskel({ skin }) {
  const materials = useMemo(() => {
    const map = pixelTexture(skin);
    map.generateMipmaps = false;
    map.minFilter = THREE.NearestFilter;
    const body = new THREE.MeshStandardMaterial({ map, alphaTest: 0.5, roughness: 0.88 });
    const head = body.clone();
    head.emissiveMap = map; // the TV screen glows faintly
    head.emissive.set('#ffffff');
    head.emissiveIntensity = 0.14;
    return { body, head };
  }, [skin]);
  const geometry = useMemo(() => {
    const layered = (w, h, d, base, overlay) => [
      entityBox(w, h, d, ...base, { flipSides: false }),
      entityBox(w, h, d, ...overlay, { flipSides: false, inflate: 0.5 }),
    ];
    return {
      torso: layered(8, 12, 4, [16, 16], [16, 32]),
      head: layered(8, 8, 8, [0, 0], [32, 0]),
      rightArm: layered(3, 12, 4, [40, 16], [40, 32]),
      leftArm: layered(3, 12, 4, [32, 48], [48, 48]),
      rightLeg: layered(4, 12, 4, [0, 16], [0, 32]),
      leftLeg: layered(4, 12, 4, [16, 48], [0, 48]),
    };
  }, []);
  const rig = useRef(), torso = useRef(), head = useRef(), rightArm = useRef(), leftArm = useRef(), rightLeg = useRef(), leftLeg = useRef();
  const glance = useRef({ yaw: 0, pitch: 0.06 });
  const camera = useThree((s) => s.camera), toCamera = useMemo(() => new THREE.Vector3(), []);
  useLayoutEffect(() => {
    camp.refs.wave = rig.current;
    camp.refs.head = head.current;
    torso.current.rotation.order = 'YXZ'; // twist about the vertical, then lean back
  }, []);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.25), t = camp.ambient, live = camp.moving ? 1 : 0, wave = waveEnvelope();
    const breath = Math.sin(t * 1.7) * live;
    const bodyYaw = SEAT.yaw + camp.turn;
    rig.current.rotation.y = bodyYaw;
    // To wave, Vaskel turns toward wherever the camera currently is: the shoulders take part of the turn and
    // the head the rest, and the head tips to meet the camera's height.
    camera.getWorldPosition(toCamera).sub(rig.current.position);
    const bearing = Math.atan2(toCamera.x, toCamera.z) - bodyYaw;
    const offset = Math.atan2(Math.sin(bearing), Math.cos(bearing));
    const shoulders = THREE.MathUtils.clamp(offset * 0.45, -0.6, 0.6);
    const elevation = Math.atan2(toCamera.y - 0.85, Math.hypot(toCamera.x, toCamera.z));
    // Laid back: the torso leans away from the fire and rises and falls with each slow breath.
    torso.current.rotation.set(-0.32 + breath * 0.014, shoulders * wave, wave * 0.06);
    // The head drifts between glances every few seconds; while waving it looks straight at the viewer.
    const [yaw, pitch] = wave > 0
      ? [THREE.MathUtils.clamp(offset - shoulders, -0.9, 0.9), 0.32 - elevation]
      : live ? GLANCES[Math.floor(t / 3.4) % GLANCES.length] : GLANCES[0];
    const ease = 1 - Math.exp(-dt * (wave > 0 ? 6 : 2.4));
    glance.current.yaw += (yaw - glance.current.yaw) * ease;
    glance.current.pitch += (pitch - glance.current.pitch) * ease;
    // A lazy sideways tilt of the head sells the relaxed mood.
    head.current.rotation.set(glance.current.pitch + breath * 0.01, glance.current.yaw, 0.07 + Math.sin(t * 0.31) * 0.03 * live);
    // Arms reach back and slightly out, hands planted on the log behind him; the right arm lifts to wave.
    const shake = Math.sin((camp.clock - camp.waveAt) * 12) * 0.22;
    rightArm.current.rotation.set(0.78 - wave * 1.2, 0, -(0.24 + breath * 0.012) - wave * (2.0 + shake));
    leftArm.current.rotation.set(0.78, 0, 0.24 + breath * 0.012);
    // Legs stretched out toward the fire, knees apart and toes turned out, heels idly rocking on the ground.
    rightLeg.current.rotation.set(-(0.92 + 0.04 * (1 + Math.sin(t * 1.25)) * live), 0.14, -0.16);
    leftLeg.current.rotation.set(-(0.86 + 0.04 * (1 + Math.sin(t * 1.25 + 2.4)) * live), -0.14, 0.16);
  });

  const part = (pair, y, material) => pair.map((g, i) => <mesh key={i} geometry={g} material={material} position={[0, y, 0]} castShadow receiveShadow />);
  return (
    <group ref={rig} position={[SEAT.position[0], SEAT.height + 0.04, SEAT.position[2]]} rotation-y={SEAT.yaw} userData={{ action: 'wave' }}>
      <group ref={torso}>
        {part(geometry.torso, 6 * PX, materials.body)}
        <group ref={head} position={[0, 12 * PX, 0]}>{part(geometry.head, 4 * PX, materials.head)}</group>
        <group ref={rightArm} position={[-5.5 * PX, 10 * PX, 0]}>{part(geometry.rightArm, -4 * PX, materials.body)}</group>
        <group ref={leftArm} position={[5.5 * PX, 10 * PX, 0]}>{part(geometry.leftArm, -4 * PX, materials.body)}</group>
      </group>
      <group ref={rightLeg} position={[-2 * PX, 0, 0]}>{part(geometry.rightLeg, -6 * PX, materials.body)}</group>
      <group ref={leftLeg} position={[2 * PX, 0, 0]}>{part(geometry.leftLeg, -6 * PX, materials.body)}</group>
    </group>
  );
}

// Cubic sparks rising from the fire; stoking it resets them into a faster burst.
export function Embers({ count }) {
  const mesh = useRef();
  const sparks = useMemo(() => {
    const r = rng(4401);
    return Array.from({ length: count }, () => ({ life: r(), speed: 0.25 + r() * 0.5, x: r() * 2 - 1, z: r() * 2 - 1 }));
  }, [count]);
  const material = useMemo(() => {
    const m = new THREE.MeshBasicMaterial({ color: '#ffc66c' });
    m.color.multiplyScalar(3);
    return m;
  }, []);
  const dummy = useMemo(() => new THREE.Object3D(), []), burst = useRef(camp.fireAt);
  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.25), boost = fireBoost();
    if (burst.current !== camp.fireAt) {
      burst.current = camp.fireAt;
      sparks.forEach((e) => {
        e.life = Math.random() * 0.35;
        e.speed = 0.7 + Math.random();
      });
    }
    sparks.forEach((e, i) => {
      if (camp.moving || boost) e.life = (e.life + dt * e.speed * 0.38) % 1;
      const p = e.life;
      dummy.position.set(e.x * (0.08 + p * 0.4) + Math.sin(camp.ambient * 1.6 + e.z * 5) * p * 0.12, 0.4 + p * 2.3, e.z * (0.08 + p * 0.4));
      dummy.scale.setScalar(p < 0.93 ? Math.max(0.1, (1 - p) * (1 + boost)) : 0);
      dummy.updateMatrix();
      mesh.current.setMatrixAt(i, dummy.matrix);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, count]} material={material} position={FIRE_POSITION} frustumCulled={false}>
      <boxGeometry args={[0.035, 0.035, 0.035]} />
    </instancedMesh>
  );
}

// Fireflies drifting through the clearing and between the trees.
export function Fireflies() {
  const { geometry, seeds } = useMemo(() => {
    const r = rng(733), seeds = Array.from({ length: 64 }, () => [r() * 28 - 12, 0.3 + r() * 3.5, r() * 22 - 16, r() * 6.28]);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(seeds.length * 3), 3));
    return { geometry, seeds };
  }, []);
  useFrame(() => {
    const t = camp.ambient, positions = geometry.attributes.position.array;
    seeds.forEach(([x, y, z, p], i) => {
      positions[i * 3] = x + Math.sin(t * 0.22 + p) * 0.5;
      positions[i * 3 + 1] = heightAt(x, z) + y + Math.sin(t * 0.5 + p) * 0.25;
      positions[i * 3 + 2] = z + Math.cos(t * 0.27 + p) * 0.4;
    });
    geometry.attributes.position.needsUpdate = true;
  });
  return (
    <points geometry={geometry} frustumCulled={false}>
      <pointsMaterial map={haloMap} color="#cde4a2" size={0.09} transparent blending={THREE.AdditiveBlending} depthWrite={false} />
    </points>
  );
}
