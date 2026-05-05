import * as THREE from 'three';
import { ColladaLoader } from 'three/examples/jsm/loaders/ColladaLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { LWOLoader } from 'three/examples/jsm/loaders/LWOLoader.js';
import { MD2Loader } from 'three/examples/jsm/loaders/MD2Loader.js';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { TDSLoader } from 'three/examples/jsm/loaders/TDSLoader.js';

import type { DbFile } from '../db/db-schema';
import type { PreviewableModelFormat } from './model-preview';

type ModelResourceFile = Pick<DbFile, 'id' | 'name' | 'parent' | 'type' | 'data'>;

export interface ModelViewerInput {
  container: HTMLElement;
  fileName: string;
  fileParent: number;
  format: PreviewableModelFormat;
  data: Uint8Array;
  files: ModelResourceFile[];
  onStats?(stats: ModelViewerStats): void;
  onError(message: string): void;
}

export interface ModelViewerStats {
  vertices: number;
}

export interface ModelViewerSession {
  dispose(): void;
}

function copyBytes(data: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(data.byteLength);
  new Uint8Array(buffer).set(data);
  return buffer;
}

function normalizeResourceName(value: string): string {
  const withoutHash = value.split('#', 1)[0].split('?', 1)[0];
  const normalizedSlashes = withoutHash.replace(/\\/g, '/');
  try {
    return decodeURIComponent(normalizedSlashes).trim().toLowerCase();
  } catch {
    return normalizedSlashes.trim().toLowerCase();
  }
}

function resourceBasename(value: string): string {
  const normalized = normalizeResourceName(value);
  return normalized.slice(normalized.lastIndexOf('/') + 1);
}

function createResourceResolver(files: ModelResourceFile[], selectedParent: number): {
  manager: THREE.LoadingManager;
  findTextResource(url: string): string | null;
  findResourceUrl(url: string): string | null;
  findResourceFile(url: string): ModelResourceFile | null;
  dispose(): void;
} {
  const byName = new Map<string, ModelResourceFile>();
  const objectUrls = new Map<number, string>();

  function add(file: ModelResourceFile): void {
    const normalizedName = normalizeResourceName(file.name);
    const basename = resourceBasename(file.name);
    if (normalizedName) byName.set(normalizedName, file);
    if (basename) byName.set(basename, file);
  }

  for (const file of files) {
    if (file.parent !== selectedParent) add(file);
  }

  for (const file of files) {
    if (file.parent === selectedParent) add(file);
  }

  function findResource(url: string): ModelResourceFile | null {
    if (!url || url.startsWith('blob:') || url.startsWith('data:')) return null;
    return byName.get(normalizeResourceName(url)) ?? byName.get(resourceBasename(url)) ?? null;
  }

  function objectUrlFor(file: ModelResourceFile): string {
    const existing = objectUrls.get(file.id);
    if (existing) return existing;
    const url = URL.createObjectURL(new Blob([copyBytes(file.data)], { type: file.type || undefined }));
    objectUrls.set(file.id, url);
    return url;
  }

  const manager = new THREE.LoadingManager();
  manager.setURLModifier((url) => {
    const file = findResource(url);
    return file ? objectUrlFor(file) : url;
  });

  return {
    manager,
    findTextResource(url: string): string | null {
      const file = findResource(url);
      return file ? new TextDecoder().decode(file.data) : null;
    },
    findResourceUrl(url: string): string | null {
      const file = findResource(url);
      return file ? objectUrlFor(file) : null;
    },
    findResourceFile(url: string): ModelResourceFile | null {
      return findResource(url);
    },
    dispose(): void {
      for (const url of objectUrls.values()) URL.revokeObjectURL(url);
      objectUrls.clear();
    },
  };
}

function disposeMaterial(material: THREE.Material): void {
  for (const value of Object.values(material)) {
    if (value instanceof THREE.Texture) value.dispose();
  }
  material.dispose();
}

function disposeObject(object: THREE.Object3D): void {
  object.traverse((child) => {
    const mesh = child as THREE.Mesh;
    mesh.geometry?.dispose();
    const material = mesh.material;
    if (Array.isArray(material)) {
      for (const item of material) disposeMaterial(item);
    } else if (material) {
      disposeMaterial(material);
    }
  });
}

function countVertices(object: THREE.Object3D): number {
  let total = 0;

  object.traverse((child) => {
    const mesh = child as THREE.Mesh;
    const geometry = mesh.geometry;
    if (!geometry) return;

    const position = geometry.getAttribute('position');
    if (position) total += position.count;
  });

  return total;
}

function getRenderableObject(result: unknown, format: PreviewableModelFormat): THREE.Object3D {
  if (format === 'glb' || format === 'gltf') {
    return (result as { scene: THREE.Object3D }).scene;
  }

  if (format === 'dae') {
    return (result as { scene: THREE.Object3D }).scene;
  }

  if (format === 'lwo') {
    const group = new THREE.Group();
    group.add(...(result as { meshes: THREE.Object3D[] }).meshes);
    return group;
  }

  return result as THREE.Object3D;
}

function createPreviewMesh(geometry: THREE.BufferGeometry): THREE.Mesh {
  geometry.computeBoundingSphere();
  const material = new THREE.MeshStandardMaterial({
    color: 0xd1d5db,
    roughness: 0.7,
    metalness: 0.05,
    side: THREE.DoubleSide,
  });
  return new THREE.Mesh(geometry, material);
}

function readNullTerminatedString(data: DataView, offset: number, maxLength: number): string {
  const bytes: number[] = [];
  for (let index = 0; index < maxLength; index += 1) {
    const value = data.getUint8(offset + index);
    if (value === 0) break;
    bytes.push(value);
  }
  return new TextDecoder().decode(new Uint8Array(bytes)).trim();
}

function findMd2SkinNames(buffer: ArrayBuffer): string[] {
  const data = new DataView(buffer);
  if (data.byteLength < 68) return [];
  const ident = data.getInt32(0, true);
  const version = data.getInt32(4, true);
  if (ident !== 844121161 || version !== 8) return [];

  const numSkins = data.getInt32(24, true);
  const offsetSkins = data.getInt32(44, true);
  if (numSkins <= 0 || offsetSkins < 0 || offsetSkins >= data.byteLength) return [];

  const skinNames: string[] = [];
  for (let index = 0; index < numSkins; index += 1) {
    const offset = offsetSkins + index * 64;
    if (offset + 64 > data.byteLength) break;
    const skinName = readNullTerminatedString(data, offset, 64);
    if (skinName) skinNames.push(skinName);
  }

  return skinNames;
}

function md2TextureCandidates(skinName: string): string[] {
  const normalized = normalizeResourceName(skinName);
  const withoutExt = normalized.includes('.') ? normalized.slice(0, normalized.lastIndexOf('.')) : normalized;
  const candidates = [skinName, normalized, resourceBasename(skinName)];

  for (const extension of ['jpg', 'jpeg', 'png', 'webp', 'bmp']) {
    candidates.push(`${withoutExt}.${extension}`, `${resourceBasename(withoutExt)}.${extension}`);
  }

  return [...new Set(candidates.filter(Boolean))];
}

function md2ModelTextureCandidates(modelName: string): string[] {
  const normalized = normalizeResourceName(modelName);
  const basename = resourceBasename(normalized);
  const withoutExt = basename.includes('.') ? basename.slice(0, basename.lastIndexOf('.')) : basename;
  return md2TextureCandidates(withoutExt);
}

function extensionFromResourceName(name: string): string {
  const basename = resourceBasename(name);
  const dotIndex = basename.lastIndexOf('.');
  return dotIndex >= 0 ? basename.slice(dotIndex + 1) : '';
}

function loadTexture(url: string, manager: THREE.LoadingManager): Promise<THREE.Texture> {
  return new Promise((resolve, reject) => {
    new THREE.TextureLoader(manager).load(url, resolve, undefined, (err) => {
      reject(err instanceof Error ? err : new Error('Could not load MD2 texture.'));
    });
  });
}

function decodePcxTexture(data: Uint8Array): THREE.Texture | null {
  if (data.byteLength < 897 || data[0] !== 0x0a || data[2] !== 0x01 || data[3] !== 0x08) return null;

  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const xMin = view.getUint16(4, true);
  const yMin = view.getUint16(6, true);
  const xMax = view.getUint16(8, true);
  const yMax = view.getUint16(10, true);
  const planes = data[65];
  const bytesPerLine = view.getUint16(66, true);
  const width = xMax - xMin + 1;
  const height = yMax - yMin + 1;
  const paletteMarkerOffset = data.byteLength - 769;

  if (width <= 0 || height <= 0 || planes !== 1 || data[paletteMarkerOffset] !== 0x0c) return null;

  const indexes = new Uint8Array(width * height);
  let source = 128;
  let target = 0;

  for (let y = 0; y < height && source < paletteMarkerOffset; y += 1) {
    let lineOffset = 0;
    while (lineOffset < bytesPerLine && source < paletteMarkerOffset) {
      const value = data[source];
      source += 1;
      const runLength = (value & 0xc0) === 0xc0 ? value & 0x3f : 1;
      const colorIndex = (value & 0xc0) === 0xc0 ? data[source++] : value;

      for (let run = 0; run < runLength && lineOffset < bytesPerLine; run += 1) {
        if (lineOffset < width && target < indexes.length) indexes[target] = colorIndex;
        lineOffset += 1;
        if (lineOffset <= width) target += 1;
      }
    }
  }

  const rgba = new Uint8Array(width * height * 4);
  const paletteOffset = paletteMarkerOffset + 1;
  for (let index = 0; index < indexes.length; index += 1) {
    const colorIndex = indexes[index];
    const paletteIndex = paletteOffset + colorIndex * 3;
    const rgbaIndex = index * 4;
    rgba[rgbaIndex] = data[paletteIndex];
    rgba[rgbaIndex + 1] = data[paletteIndex + 1];
    rgba[rgbaIndex + 2] = data[paletteIndex + 2];
    rgba[rgbaIndex + 3] = 255;
  }

  const texture = new THREE.DataTexture(rgba, width, height, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.flipY = true;
  texture.needsUpdate = true;
  return texture;
}

async function loadMd2Texture(
  file: ModelResourceFile,
  manager: THREE.LoadingManager,
  findResourceUrl: (url: string) => string | null,
): Promise<THREE.Texture | null> {
  if (extensionFromResourceName(file.name) === 'pcx') return decodePcxTexture(file.data);

  const textureUrl = findResourceUrl(file.name);
  if (!textureUrl) return null;

  try {
    const texture = await loadTexture(textureUrl, manager);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  } catch {
    return null;
  }
}

async function createMd2PreviewMesh(
  geometry: THREE.BufferGeometry,
  buffer: ArrayBuffer,
  modelName: string,
  manager: THREE.LoadingManager,
  findResourceUrl: (url: string) => string | null,
  findResourceFile: (url: string) => ModelResourceFile | null,
): Promise<THREE.Mesh> {
  const skinNames = [...findMd2SkinNames(buffer), modelName];

  for (const skinName of skinNames) {
    const candidates = skinName === modelName ? md2ModelTextureCandidates(modelName) : md2TextureCandidates(skinName);
    const textureFile = candidates.map((candidate) => findResourceFile(candidate)).find(Boolean);
    if (!textureFile) continue;

    const texture = await loadMd2Texture(textureFile, manager, findResourceUrl);
    if (!texture) continue;
    return new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.75,
      metalness: 0.02,
      side: THREE.DoubleSide,
    }));
  }

  return createPreviewMesh(geometry);
}

function findObjMaterialLibraries(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.toLowerCase().startsWith('mtllib '))
    .map((line) => line.slice('mtllib '.length).trim())
    .filter(Boolean);
}

function parseObjWithMaterials(
  data: Uint8Array,
  manager: THREE.LoadingManager,
  findTextResource: (url: string) => string | null,
): THREE.Object3D {
  const text = new TextDecoder().decode(data);
  const objLoader = new OBJLoader(manager);
  const materialLibrary = findObjMaterialLibraries(text)
    .map((name) => findTextResource(name))
    .find((content): content is string => content !== null);

  if (materialLibrary) {
    const materials = new MTLLoader(manager).parse(materialLibrary, '');
    materials.preload();
    objLoader.setMaterials(materials);
  }

  return objLoader.parse(text);
}

function parseWithLoader(
  format: PreviewableModelFormat,
  data: Uint8Array,
  fileName: string,
  manager: THREE.LoadingManager,
  findTextResource: (url: string) => string | null,
  findResourceUrl: (url: string) => string | null,
  findResourceFile: (url: string) => ModelResourceFile | null,
): Promise<THREE.Object3D> {
  const buffer = copyBytes(data);

  return new Promise((resolve, reject) => {
    try {
      if (format === 'glb' || format === 'gltf') {
        new GLTFLoader(manager).parse(buffer, '', (gltf) => resolve(getRenderableObject(gltf, format)), reject);
        return;
      }

      if (format === 'obj') {
        resolve(parseObjWithMaterials(data, manager, findTextResource));
        return;
      }

      if (format === 'fbx') {
        resolve(new FBXLoader(manager).parse(buffer, ''));
        return;
      }

      if (format === 'dae') {
        const text = new TextDecoder().decode(data);
        resolve(getRenderableObject(new ColladaLoader(manager).parse(text, ''), format));
        return;
      }

      if (format === '3ds') {
        resolve(new TDSLoader(manager).parse(buffer, ''));
        return;
      }

      if (format === 'lwo') {
        resolve(getRenderableObject(new LWOLoader(manager).parse(buffer, '', 'model'), format));
        return;
      }

      if (format === 'md2') {
        const geometry = new MD2Loader(manager).parse(buffer);
        if (!geometry) {
          reject(new Error('Invalid MD2 model data.'));
          return;
        }
        void createMd2PreviewMesh(geometry, buffer, fileName, manager, findResourceUrl, findResourceFile).then(resolve, reject);
        return;
      }

      reject(new Error(`Unsupported model format: ${format}`));
    } catch (err) {
      reject(err instanceof Error ? err : new Error('Failed to parse selected model.'));
    }
  });
}

function frameObject(object: THREE.Object3D, camera: THREE.PerspectiveCamera): void {
  const box = new THREE.Box3().setFromObject(object);
  if (box.isEmpty()) return;

  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  object.position.sub(center);

  const maxDim = Math.max(size.x, size.y, size.z, 1);
  const distance = maxDim / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
  camera.position.set(0, maxDim * 0.2, distance * 1.8);
  camera.near = Math.max(distance / 100, 0.01);
  camera.far = distance * 100;
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
}

function zoomCamera(camera: THREE.PerspectiveCamera, multiplier: number, minDistance: number, maxDistance: number): void {
  const direction = camera.position.clone();
  const currentDistance = direction.length();
  if (currentDistance <= 0) return;

  const nextDistance = THREE.MathUtils.clamp(currentDistance * multiplier, minDistance, maxDistance);
  camera.position.copy(direction.normalize().multiplyScalar(nextDistance));
  camera.lookAt(0, 0, 0);
}

function panObject(
  object: THREE.Object3D,
  camera: THREE.PerspectiveCamera,
  viewportHeight: number,
  deltaX: number,
  deltaY: number,
): void {
  const distance = Math.max(camera.position.length(), camera.near);
  const worldHeight = 2 * distance * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const worldPerPixel = worldHeight / Math.max(viewportHeight, 1);
  const right = new THREE.Vector3();
  const up = new THREE.Vector3();

  camera.updateMatrixWorld();
  right.setFromMatrixColumn(camera.matrixWorld, 0);
  up.setFromMatrixColumn(camera.matrixWorld, 1);

  object.position.addScaledVector(right, deltaX * worldPerPixel);
  object.position.addScaledVector(up, -deltaY * worldPerPixel);
}

export function createModelViewer(input: ModelViewerInput): ModelViewerSession {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1f2937);

  const root = new THREE.Group();
  scene.add(root);

  const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 1000);
  camera.position.set(0, 1, 4);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.25;
  renderer.domElement.className = 'inspector__model-canvas';
  input.container.replaceChildren(renderer.domElement);

  const resourceResolver = createResourceResolver(input.files, input.fileParent);

  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  const environmentMap = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = environmentMap;

  const ambient = new THREE.HemisphereLight(0xffffff, 0x94a3b8, 2.4);
  const key = new THREE.DirectionalLight(0xffffff, 2.8);
  const fill = new THREE.DirectionalLight(0xffffff, 1.2);
  key.position.set(3, 5, 4);
  fill.position.set(-4, 2, -3);
  scene.add(ambient, key, fill);

  let animationFrame = 0;
  let disposed = false;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let minZoomDistance = 0.25;
  let maxZoomDistance = 100;

  function resize(): void {
    const rect = input.container.getBoundingClientRect();
    const width = Math.max(1, Math.floor(rect.width));
    const height = Math.max(1, Math.floor(rect.height));
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  }

  function renderLoop(): void {
    if (disposed) return;
    resize();
    renderer.setRenderTarget(null);
    renderer.render(scene, camera);
    animationFrame = window.requestAnimationFrame(renderLoop);
  }

  function onPointerDown(event: PointerEvent): void {
    dragging = true;
    lastX = event.clientX;
    lastY = event.clientY;
    renderer.domElement.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: PointerEvent): void {
    if (!dragging) return;
    const dx = event.clientX - lastX;
    const dy = event.clientY - lastY;
    lastX = event.clientX;
    lastY = event.clientY;

    if (event.shiftKey) {
      panObject(root, camera, renderer.domElement.clientHeight, dx, dy);
      return;
    }

    root.rotation.y += dx * 0.01;
    root.rotation.x = THREE.MathUtils.clamp(root.rotation.x + dy * 0.01, -Math.PI / 2, Math.PI / 2);
  }

  function onPointerUp(event: PointerEvent): void {
    dragging = false;
    if (renderer.domElement.hasPointerCapture(event.pointerId)) {
      renderer.domElement.releasePointerCapture(event.pointerId);
    }
  }

  function onWheel(event: WheelEvent): void {
    event.preventDefault();
    zoomCamera(camera, Math.exp(event.deltaY * 0.001), minZoomDistance, maxZoomDistance);
  }

  renderer.domElement.addEventListener('pointerdown', onPointerDown);
  renderer.domElement.addEventListener('pointermove', onPointerMove);
  renderer.domElement.addEventListener('pointerup', onPointerUp);
  renderer.domElement.addEventListener('pointercancel', onPointerUp);
  renderer.domElement.addEventListener('wheel', onWheel, { passive: false });

  resize();
  renderLoop();

  void parseWithLoader(
    input.format,
    input.data,
    input.fileName,
    resourceResolver.manager,
    resourceResolver.findTextResource,
    resourceResolver.findResourceUrl,
    resourceResolver.findResourceFile,
  )
    .then((model) => {
      if (disposed) {
        disposeObject(model);
        return;
      }

      root.clear();
      root.rotation.set(0, 0, 0);
      root.add(model);
      frameObject(root, camera);
      input.onStats?.({ vertices: countVertices(model) });
      minZoomDistance = Math.max(camera.near * 2, camera.position.length() / 8);
      maxZoomDistance = Math.max(camera.position.length() * 8, minZoomDistance * 2);
    })
    .catch((err: unknown) => {
      if (disposed) return;
      input.onError(err instanceof Error ? err.message : `Could not preview ${input.fileName}.`);
    });

  return {
    dispose(): void {
      if (disposed) return;
      disposed = true;
      window.cancelAnimationFrame(animationFrame);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('pointercancel', onPointerUp);
      renderer.domElement.removeEventListener('wheel', onWheel);
      disposeObject(root);
      resourceResolver.dispose();
      environmentMap.dispose();
      pmremGenerator.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
