import * as THREE from 'three';

export default class DolphinPath {
  constructor() {
    // Alternates close to event façades with safe central crossovers.
    this.curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-7,-1.4,5),new THREE.Vector3(-2,.4,1),new THREE.Vector3(-2,-.4,-3),
      new THREE.Vector3(-5,-.7,-9.5),new THREE.Vector3(.5,1,-13.5),new THREE.Vector3(4.6,.5,-16.5),
      new THREE.Vector3(-.8,1.7,-20.5),new THREE.Vector3(-4.6,.9,-22.5),new THREE.Vector3(.9,1.9,-26.5),
      new THREE.Vector3(4.6,.9,-28.5),new THREE.Vector3(-.8,2.2,-32),new THREE.Vector3(-4.2,1.5,-33.5),
      new THREE.Vector3(.8,2.5,-37),new THREE.Vector3(4.6,1.6,-38.5),new THREE.Vector3(-.8,2.1,-42),
      new THREE.Vector3(-4.6,1.9,-43.5),new THREE.Vector3(.8,1.8,-47),new THREE.Vector3(5,1.3,-48.5),
      new THREE.Vector3(-.8,1.5,-52),new THREE.Vector3(-4.2,1.1,-53.5),new THREE.Vector3(.5,.9,-58),new THREE.Vector3(0,.6,-61)
    ], false, 'catmullrom', .3);
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
  getWaypoint(progress, offset, target = new THREE.Vector3()) {
    this.curve.getPointAt(progress, target);
    target.x += offset[0]; target.y += offset[1]; target.z += offset[2];
    return target;
  }
}
