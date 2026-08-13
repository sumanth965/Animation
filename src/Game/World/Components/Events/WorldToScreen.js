import * as THREE from 'three';
const projected = new THREE.Vector3();
export function worldToScreen(position, camera, width, height) {
  projected.copy(position).project(camera);
  return { x:(projected.x * .5 + .5) * width, y:(-projected.y * .5 + .5) * height, visible: projected.z > -1 && projected.z < 1 && Math.abs(projected.x) < 1.12 && Math.abs(projected.y) < 1.12 };
}
