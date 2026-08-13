import * as THREE from 'three';

export default class DolphinPath {
  constructor() {
    // A single authored, reversible cinematic route. Buildings are at X ±9;
    // approach nodes remain inside the clear corridor and below roof level.
    this.waypoints = [
      // Opening: dolphin alone at the right of the empty water, alongside the left UI copy.
      ['OVERVIEW','open-water',5,-2,5],['TRAVEL','overview-glide',3,-3.5,3],['TRAVEL','descent',-2,0,2],
      // Building 1: descend to its low front, then peel to the right.
      ['APPROACH','code-sprint',-5,-6.8,-9.5],['TRAVEL','leave-one',-2,-7.2,-12.5],['TRAVEL','arc-to-two',2,-7,-14.5],
      // Building 2, then a deliberately broad LEFT/downward corridor turn.
      ['APPROACH','hackathon',4.6,-6.2,-16.5],['TRAVEL','leave-two',2,-7,-19],['TRAVEL','wide-left',-3.6,-8.1,-22],['TRAVEL','left-depth',-4.8,-8.7,-25],
      // Curve up toward Building 3.
      ['TRAVEL','rise-three',-3.2,-7.4,-27],['APPROACH','web-design',-4.6,-6.2,-29],['TRAVEL','leave-three',-1.5,-7,-31.5],
      // Wide RIGHT/upward return to Building 4.
      ['TRAVEL','wide-right',3.8,-6.4,-34],['TRAVEL','right-rise',4.8,-5.5,-36.5],['APPROACH','pixel-play',4.6,-5.7,-38.5],
      ['TRAVEL','leave-four',1.3,-7,-41],['TRAVEL','left-down',-3.7,-8,-43.5],['APPROACH','pulse',-4.2,-5.8,-45],
      ['TRAVEL','right-up',3.8,-6.1,-48],['APPROACH','quiz',4.6,-6,-49.5],['TRAVEL','left-down',-3.8,-7.8,-52],
      ['APPROACH','bandwave',-4.6,-5.3,-53.5],['TRAVEL','right-rise',4,-6.2,-56],['APPROACH','creative-lab',5,-6,-57.5],
      ['TRAVEL','final-curve',-2.2,-7,-59.5],['APPROACH','frame-by-frame',-4.2,-5.8,-60.5],['TRAVEL','finish',0,-7,-63]
    ];
    this.curve = new THREE.CatmullRomCurve3(this.waypoints.map(([, , x,y,z])=>new THREE.Vector3(x,y,z)), false, 'catmullrom', .3);
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
