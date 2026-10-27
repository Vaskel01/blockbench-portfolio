// Turns a staged scene into a Blockbench project (.bbmodel, free/generic model format), so the render can be opened
// and tweaked by hand. Every box mesh becomes a cube with its world position, size, pivot and rotation;
// flat decal planes become zero-thickness cubes. Named groups in the scene become the outliner's folders, pivoting
// where the scene's groups do (shoulders, hips, the easel's foot), so rotating a folder in Blockbench poses it.
//
// Textures: the images the scene names in `keep` (skins, paintings) keep their own files; every hand-painted prop face
// and paint decal is packed into one atlas, with each cube face pointing at its patch.
import * as THREE from 'three';

const PX_PER_UNIT = 16;
const round = (n) => Math.round(n * 1e4) / 1e4;
const uuid = () => crypto.randomUUID();

// Shelf-packs images into one canvas; returns the canvas and each image's offset.
function pack(images) {
  const width = Math.max(512, ...[...images].map((image) => image.width));
  const sorted = [...images].sort((a, b) => b.height - a.height);
  const at = new Map();
  let [x, y, row] = [0, 0, 0];
  for (const image of sorted) {
    if (x + image.width > width) [x, y, row] = [0, y + row, 0];
    at.set(image, [x, y]);
    x += image.width;
    row = Math.max(row, image.height);
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = Math.ceil((y + row) / 16) * 16;
  const ctx = canvas.getContext('2d');
  for (const [image, [ox, oy]] of at) ctx.drawImage(image, ox, oy);
  return { canvas, at };
}

const textureEntry = (name, source, width, height) => ({
  path: '', name, folder: '', namespace: '', id: '', width, height, uv_width: width, uv_height: height,
  particle: false, render_mode: 'default', render_sides: 'auto', frame_time: 1, frame_order_type: 'loop',
  frame_order: '', frame_interpolate: false, visible: true, internal: true, saved: false, uuid: uuid(), source,
});

// three.js BoxGeometry face groups in order, and the Blockbench face each one is.
const FACES = ['east', 'west', 'up', 'down', 'south', 'north'];

export function exportBBModel(scene, { name, keep }) {
  scene.updateMatrixWorld(true);
  const meshes = [];
  scene.traverse((object) => {
    if (object.isMesh && object.geometry && (object.geometry.type === 'BoxGeometry' || object.geometry.type === 'PlaneGeometry')) meshes.push(object);
  });

  // Gather every image the faces use; the kept ones stay separate, the rest go in the atlas.
  const materialsOf = (mesh) => (Array.isArray(mesh.material) ? mesh.material : [mesh.material]);
  const kept = Object.entries(keep);
  const keptIndex = new Map(kept.map(([, image], i) => [image, i]));
  const painted = new Set();
  for (const mesh of meshes) {
    for (const material of materialsOf(mesh)) {
      const image = material.map?.image;
      if (image && !keptIndex.has(image)) painted.add(image);
    }
  }
  const atlas = pack(painted);
  const sizeOf = (image) => [image.naturalWidth || image.width, image.naturalHeight || image.height];
  const textures = [
    ...kept.map(([label, image]) => textureEntry(`${label}.png`, image.src || image.toDataURL('image/png'), ...sizeOf(image))),
    textureEntry('props.png', atlas.canvas.toDataURL('image/png'), atlas.canvas.width, atlas.canvas.height),
  ];
  textures.forEach((t, i) => { t.id = String(i); });
  // Where an image sits: [texture index, offset x, offset y, width, height].
  const placeOf = (image) => {
    if (keptIndex.has(image)) return [keptIndex.get(image), 0, 0, ...sizeOf(image)];
    const [x, y] = atlas.at.get(image);
    return [kept.length, x, y, image.width, image.height];
  };

  // Outliner folders follow the named groups above each mesh.
  const folders = new Map();
  const outliner = [];
  const folderFor = (object) => {
    if (!object || object === scene) return null;
    if (!object.name) return folderFor(object.parent);
    if (folders.has(object)) return folders.get(object);
    const origin = new THREE.Vector3().setFromMatrixPosition(object.matrixWorld).multiplyScalar(PX_PER_UNIT);
    const folder = {
      name: object.name, origin: origin.toArray().map(round), color: 0, uuid: uuid(), export: true, mirror_uv: false,
      isOpen: false, locked: false, visibility: true, autouv: 0, children: [],
    };
    folders.set(object, folder);
    const parent = folderFor(object.parent);
    (parent ? parent.children : outliner).push(folder);
    return folder;
  };

  const counts = {};
  const elements = meshes.map((mesh) => {
    const geometry = mesh.geometry;
    geometry.computeBoundingBox();
    const box = geometry.boundingBox;
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3()).multiplyScalar(PX_PER_UNIT);
    const world = center.clone().applyMatrix4(mesh.matrixWorld).multiplyScalar(PX_PER_UNIT);
    const rotation = new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromRotationMatrix(mesh.matrixWorld), 'ZYX');
    const materials = materialsOf(mesh);
    const uv = geometry.attributes.uv;
    const faces = {};
    FACES.forEach((face) => { faces[face] = { uv: [0, 0, 0, 0], texture: null }; });
    const groups = geometry.type === 'PlaneGeometry' ? [{ face: 'south', start: 0 }] : FACES.map((face, i) => ({ face, start: i * 4 }));
    groups.forEach(({ face, start }, i) => {
      const material = materials[Math.min(i, materials.length - 1)];
      const image = material.map?.image;
      if (!image) return;
      const [texture, ox, oy, w, h] = placeOf(image);
      // Vertex 0 is the face's top-left corner and vertex 3 its bottom-right, in both three.js and Blockbench.
      const [u0, v0, u1, v1] = [uv.getX(start), uv.getY(start), uv.getX(start + 3), uv.getY(start + 3)];
      faces[face] = { uv: [ox + u0 * w, oy + (1 - v0) * h, ox + u1 * w, oy + (1 - v1) * h].map(round), texture };
    });
    const label = mesh.userData.name || 'part';
    counts[label] = (counts[label] || 0) + 1;
    const half = size.clone().multiplyScalar(0.5);
    const element = {
      name: counts[label] > 1 ? `${label}_${counts[label]}` : label, box_uv: false, rescale: false, locked: false,
      light_emission: 0, render_order: 'default', allow_mirror_modeling: true,
      from: world.clone().sub(half).toArray().map(round), to: world.clone().add(half).toArray().map(round),
      autouv: 0, color: 0, origin: world.toArray().map(round),
      rotation: [rotation.x, rotation.y, rotation.z].map((r) => round(THREE.MathUtils.radToDeg(r))),
      faces, type: 'cube', uuid: uuid(),
    };
    const folder = folderFor(mesh.parent);
    (folder ? folder.children : outliner).push(element.uuid);
    return element;
  });

  return {
    meta: { format_version: '4.10', model_format: 'free', box_uv: false },
    name, model_identifier: '', visible_box: [1, 1, 0], variable_placeholders: '', variable_placeholder_buttons: [],
    timeline_setups: [], unhandled_root_fields: {}, resolution: { width: 64, height: 64 },
    elements, outliner, textures,
  };
}
