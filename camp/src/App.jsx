// The camp scene graph: world, lights, props, camera framing, frame clock and post-processing.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { WAVE_TIME, camp, fireBoost } from './camp.js';
import { Lighting, PostFX, FOCUS } from './effects.jsx';
import { Campfire, Chest, Embers, Fireflies, LogSeat, Vaskel } from './props.jsx';
import { buildWorld } from './world.js';

const LOOK = new THREE.Vector3(1.0, 1.05, -0.6), BASE_OFFSET = new THREE.Vector3(4.8, 1.9, 9.7), UP = new THREE.Vector3(0, 1, 0);
const FOCUS_POINT = new THREE.Vector3(...FOCUS);

// Orbit-limited camera that always frames Vaskel at a fixed screen spot beside the menu (via a view offset).
function CameraRig({ moon, overlay }) {
  const camera = useThree((s) => s.camera), size = useThree((s) => s.size);
  const scratch = useMemo(() => ({ offset: new THREE.Vector3(), screen: new THREE.Vector3(), point: new THREE.Vector3() }), []);
  const placeMoon = useRef(true);
  useEffect(() => {
    placeMoon.current = true;
  }, [size.width, size.height]);

  useFrame((_, delta) => {
    const o = camp.orbit, ease = 1 - Math.exp(-Math.min(delta, 0.25) * 9), small = size.width < 901;
    o.yaw += (o.targetYaw - o.yaw) * ease;
    o.pitch += (o.targetPitch - o.pitch) * ease;
    camera.fov = small ? 39 : 36;
    scratch.offset.copy(BASE_OFFSET).applyAxisAngle(UP, o.yaw);
    scratch.offset.y += o.pitch * 7;
    camera.position.copy(LOOK).add(scratch.offset);
    camera.lookAt(LOOK);
    camera.clearViewOffset();
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    const { width: w, height: h } = size, s = scratch.screen.copy(FOCUS_POINT).project(camera);
    camera.setViewOffset(w, h, ((s.x + 1) * w) / 2 - w * (small ? 0.38 : 0.615), ((1 - s.y) * h) / 2 - h * (small ? 0.5 : 0.56), w, h);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    if (placeMoon.current) {
      placeMoon.current = false;
      moon.position.copy(scratch.point.set(0.75, 0.55, 0.95).unproject(camera)).sub(camera.position).normalize().multiplyScalar(64).add(camera.position);
    }
    overlay(camera, size);
  });
  return null;
}

// Advances the camp clocks, ambient loops, audio and throttled shadow updates. While paused (frameloop
// "demand") it keeps requesting frames only until a wave, fire burst, lid swing or camera glide settles.
function Clock({ world, audio, mobile, onFirstFrame }) {
  const frame = useRef(0);
  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.25);
    camp.clock += dt;
    if (camp.moving) camp.ambient += dt;
    camp.turn += (camp.turnTarget - camp.turn) * (1 - Math.exp(-dt * 12));
    world.tick(camp.ambient);
    audio.tick(camp.ambient, 1 + fireBoost());
    state.gl.shadowMap.autoUpdate = frame.current % (mobile ? 4 : 2) === 0;
    if (frame.current++ === 1) onFirstFrame();
    const o = camp.orbit;
    const busy = camp.clock - camp.waveAt < WAVE_TIME || fireBoost() > 0.001 || camp.lidMoving || camp.dragging
      || Math.abs(o.targetYaw - o.yaw) + Math.abs(o.targetPitch - o.pitch) + Math.abs(camp.turnTarget - camp.turn) > 0.0001;
    if (!camp.moving && busy) state.invalidate();
  }, -1);
  return null;
}

export function App({ images, mobile, audio, overlay, onFirstFrame }) {
  const world = useMemo(() => buildWorld(images, { mobile }), [images, mobile]);
  useEffect(() => () => world.dispose(), [world]);
  return (
    <>
      <color attach="background" args={['#1b3360']} />
      <fogExp2 attach="fog" args={['#223f73', 0.025]} />
      <primitive object={world.group} />
      <Lighting mobile={mobile} />
      <LogSeat oak={world.oak} />
      <Vaskel skin={images.skin} />
      <Campfire images={images} mobile={mobile} />
      <Embers count={mobile ? 28 : 44} />
      <Chest image={images.chest} />
      <Fireflies />
      <CameraRig moon={world.moon} overlay={overlay} />
      <Clock world={world} audio={audio} mobile={mobile} onFirstFrame={onFirstFrame} />
      <PostFX mobile={mobile} />
    </>
  );
}
