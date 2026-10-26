// Lighting rig and the cinematic post-processing stack (blue moonlight vs. orange firelight).
import { useLayoutEffect, useMemo, useRef } from 'react';
import { Bloom, DepthOfField, EffectComposer, N8AO, ToneMapping, Vignette } from '@react-three/postprocessing';
import { BlendFunction, Effect, ToneMappingMode } from 'postprocessing';
import * as THREE from 'three';

// Moonlight is the cool key light and the only sky light; the campfire's flickering point light lives in
// <Campfire>. A low ambient term keeps the shadow side deep instead of flat-grey.
export function Lighting({ mobile }) {
  const moon = useRef();
  useLayoutEffect(() => {
    const light = moon.current;
    light.target.position.set(1, 0, -2);
    light.parent.add(light.target);
    light.shadow.camera.updateProjectionMatrix();
    return () => light.target.removeFromParent();
  }, []);
  const map = mobile ? 1024 : 2048;
  return (
    <>
      <ambientLight color="#3f5591" intensity={0.4} />
      <directionalLight
        ref={moon}
        color="#7f9fff"
        intensity={1.9}
        position={[-7, 13, 5]}
        castShadow
        shadow-mapSize={[map, map]}
        shadow-bias={-0.00015}
        shadow-normalBias={0.035}
        shadow-camera-left={-12}
        shadow-camera-right={12}
        shadow-camera-top={11}
        shadow-camera-bottom={-9}
        shadow-camera-near={0.5}
        shadow-camera-far={45}
      />
    </>
  );
}

// Split-tone grade in linear HDR, before tone mapping: shadows lean moonlight blue, highlights lean
// firelight amber, plus a touch of saturation. (ColorAverage would average everything toward grey and
// wash out exactly this blue-vs-orange contrast, so the grade does that job instead.)
const splitToneShader = /* glsl */ `
uniform vec3 shadowTint;
uniform vec3 highlightTint;
uniform float saturation;
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec3 c = inputColor.rgb;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  vec3 tint = mix(shadowTint, highlightTint, smoothstep(0.08, 0.7, l / (l + 0.25)));
  c *= tint;
  float l2 = dot(c, vec3(0.2126, 0.7152, 0.0722));
  outputColor = vec4(max(mix(vec3(l2), c, saturation), 0.0), inputColor.a);
}`;

class SplitToneEffect extends Effect {
  constructor({ shadowTint = [0.86, 0.96, 1.32], highlightTint = [1.22, 1.0, 0.8], saturation = 1.12 } = {}) {
    super('SplitToneEffect', splitToneShader, {
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map([
        ['shadowTint', new THREE.Uniform(new THREE.Vector3(...shadowTint))],
        ['highlightTint', new THREE.Uniform(new THREE.Vector3(...highlightTint))],
        ['saturation', new THREE.Uniform(saturation)],
      ]),
    });
  }
}

// Focus sits on Vaskel; the fire and chest stay crisp while the woods and valley fall away.
export const FOCUS = [0.9, 1.15, 0.23];

export function PostFX({ mobile }) {
  const grade = useMemo(() => new SplitToneEffect(), []);
  return (
    <EffectComposer multisampling={mobile ? 0 : 4} frameBufferType={THREE.HalfFloatType}>
      <N8AO aoRadius={1.1} distanceFalloff={0.6} intensity={3.2} color="#03050c" quality={mobile ? 'low' : 'medium'} halfRes />
      <DepthOfField target={FOCUS} focusRange={7.5} bokehScale={mobile ? 2.2 : 3.2} resolutionScale={0.5} />
      <Bloom mipmapBlur intensity={0.9} luminanceThreshold={0.85} luminanceSmoothing={0.3} radius={0.72} />
      <primitive object={grade} />
      <Vignette offset={0.28} darkness={0.72} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
    </EffectComposer>
  );
}
