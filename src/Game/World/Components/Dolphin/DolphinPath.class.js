import * as THREE from 'three';

export default class DolphinPath {
  constructor() {
    // Deliberately shaped chapters: crossings, dives, arcs, and a final approach.
    this.curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-7, -1.4, 5), new THREE.Vector3(-2, .4, 1),
      new THREE.Vector3(4, 1.7, -2), new THREE.Vector3(7, .2, -7),
      new THREE.Vector3(-2, -1.4, -12), new THREE.Vector3(-7, 2.1, -18),
      new THREE.Vector3(3, 2.8, -25), new THREE.Vector3(8, -.8, -31),
      new THREE.Vector3(-5, .8, -39), new THREE.Vector3(0, 0, -47),
      new THREE.Vector3(2, .6, -56)
    ], false, 'catmullrom', .35);
    this.position = new THREE.Vector3();
    this.tangent = new THREE.Vector3();
  }
  getPoint(progress, elapsed) {
    const p = THREE.MathUtils.clamp(progress, 0, 1);
    this.curve.getPointAt(p, this.position);
    this.curve.getTangentAt(p, this.tangent);
    // Stable low-frequency variation, not random frame movement.
    const n = Math.sin(elapsed * .45 + p * 15) * .16 + Math.sin(elapsed * .21 + p * 31) * .08;
    this.position.y += n;
    this.position.x += Math.sin(elapsed * .31 + p * 20) * .12;
    return { position: this.position, tangent: this.tangent };
  }
}
