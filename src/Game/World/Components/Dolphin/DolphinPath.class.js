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
    
    // 1. Calculate spline coordinates
    const splinePos = new THREE.Vector3();
    const splineTangent = new THREE.Vector3();
    this.curve.getPointAt(p, splinePos);
    this.curve.getTangentAt(p, splineTangent);
    
    // Standard low-frequency swimming variation on the spline
    const n = Math.sin(elapsed * .45 + p * 15) * .16 + Math.sin(elapsed * .21 + p * 31) * .08;
    splinePos.y += n;
    splinePos.x += Math.sin(elapsed * .31 + p * 20) * .12;
    
    // 2. Define the home-page hero pose. Keep the complete dolphin inside the
    // opening frame; the old far-right placement clipped its tail on load.
    const heroPos = new THREE.Vector3(4.35, 3.65, 3.3);
    // Look left-forward towards the main typography
    const heroTangent = new THREE.Vector3(-0.95, -0.1, -0.3).normalize();
    
    // 3. Blend from hero position to spline trajectory between scroll progress 0.0 and 0.12
    const t = THREE.MathUtils.smoothstep(p, 0.0, 0.12);
    
    this.position.lerpVectors(heroPos, splinePos, t);
    this.tangent.lerpVectors(heroTangent, splineTangent, t).normalize();
    
    // 4. If we are on the homepage or early scroll, add local swim-in-place offsets
    if (t < 1.0) {
      const blendFactor = 1.0 - t;
      const floatX = Math.sin(elapsed * 0.6) * 0.28 * blendFactor;
      const floatY = Math.sin(elapsed * 0.9) * 0.18 * blendFactor;
      const floatZ = Math.cos(elapsed * 0.5) * 0.22 * blendFactor;
      
      this.position.x += floatX;
      this.position.y += floatY;
      this.position.z += floatZ;
      
      // Sway the looking direction (yaw) slightly for organic movement
      const swayAngle = Math.sin(elapsed * 1.2) * 0.1 * blendFactor;
      this.tangent.applyAxisAngle(new THREE.Vector3(0, 1, 0), swayAngle);
    }
    
    return { position: this.position, tangent: this.tangent };
  }
  getWaypoint(progress, offset, target = new THREE.Vector3()) {
    this.curve.getPointAt(progress, target);
    target.x += offset[0]; target.y += offset[1]; target.z += offset[2];
    return target;
  }
}
