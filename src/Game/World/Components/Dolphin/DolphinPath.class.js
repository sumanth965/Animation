import * as THREE from 'three';

export default class DolphinPath {
  constructor() {
    // A single authored, reversible cinematic route.
    // The central landmark is at [0, -12, -35].
    // Event buildings are distributed concentrically around it.
    // Waypoints weave in a smooth S-curve around the central landmark,
    // including vertical dips and climbs.
    this.waypoints = [
      // 1. Large open starting area above the city (Z = 10 down to 0)
      ['OVERVIEW', 'open-water', 4, 4, 10],
      ['TRAVEL', 'overview-glide', 2, 2.5, 6],
      ['TRAVEL', 'descent', 0, 0.5, 2],
      
      // 2. Weave into the city and approach buildings
      ['APPROACH', 'code-sprint', -6, -7, -10],
      ['TRAVEL', 'leave-one', -2, -7.5, -14],
      ['APPROACH', 'hackathon', 7, -6, -18],
      ['TRAVEL', 'leave-two', 2, -8.5, -22],
      ['APPROACH', 'web-design', -8, -6, -26],
      ['TRAVEL', 'leave-three', 0, -4.5, -30],
      ['APPROACH', 'pixel-play', 7.5, -6, -34],
      ['TRAVEL', 'leave-four', -3, -9, -38],
      ['APPROACH', 'pulse', -8.5, -6, -42],
      ['TRAVEL', 'leave-five', 0, -5, -46],
      ['APPROACH', 'quiz', 7.5, -6, -50],
      ['TRAVEL', 'leave-six', 2, -7.5, -54],
      ['APPROACH', 'bandwave', -6.5, -6, -58],
      ['TRAVEL', 'leave-seven', 0, -7.5, -61.5],
      ['APPROACH', 'creative-lab', 6, -6, -65],
      ['TRAVEL', 'leave-eight', 0, -7.5, -68],
      ['APPROACH', 'frame-by-frame', -4.5, -6, -71],
      ['TRAVEL', 'finish', 0, -7, -76]
    ];
    this.curve = new THREE.CatmullRomCurve3(this.waypoints.map(([, , x,y,z])=>new THREE.Vector3(x,y,z)), false, 'catmullrom', .3);
    this.position = new THREE.Vector3();
    this.tangent = new THREE.Vector3();
  }
  getPoint(progress, elapsed) {
    const p = THREE.MathUtils.clamp(progress, 0, 1);
    
    this.curve.getPointAt(p, this.position);
    this.curve.getTangentAt(p, this.tangent);
    
    // Standard low-frequency swimming variation on the spline
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
