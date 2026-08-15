import * as THREE from 'three';
import Game from '../../../Game.class';

export default class Jellyfish {
  constructor({ position = new THREE.Vector3(), speed = 0.5, size = 1.0 } = {}) {
    this.game = Game.getInstance();
    this.scene = this.game.scene;
    this.time = this.game.time;

    this.position = position.clone();
    this.initialY = position.y;
    this.speed = speed;
    this.size = size;
    
    this.tentacles = [];
    this.createGeometry();
  }

  createGeometry() {
    this.group = new THREE.Group();
    this.group.position.copy(this.position);
    this.group.scale.set(this.size, this.size, this.size);

    // 1. Jellyfish Cap (Sphere dome)
    const capGeo = new THREE.SphereGeometry(0.4, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2);
    capGeo.scale(1.0, 0.7, 1.0);
    const material = new THREE.MeshStandardMaterial({
      color: 0x85e6ff,
      emissive: 0x0ea8cc,
      emissiveIntensity: 2.5,
      roughness: 0.1,
      metalness: 0.9,
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide
    });
    this.capMesh = new THREE.Mesh(capGeo, material);
    this.group.add(this.capMesh);

    // 2. Glowing inner core
    const coreGeo = new THREE.SphereGeometry(0.18, 8, 8);
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0xffa0d0, // pink bioluminescent core
      transparent: true,
      opacity: 0.8
    });
    this.coreMesh = new THREE.Mesh(coreGeo, coreMat);
    this.coreMesh.position.y = 0.1;
    this.group.add(this.coreMesh);

    // 3. Floating Tentacles
    const tentacleMat = new THREE.LineBasicMaterial({
      color: 0x85e6ff,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending
    });

    const tentacleCount = 5;
    for (let i = 0; i < tentacleCount; i++) {
      const angle = (i / tentacleCount) * Math.PI * 2;
      const radius = 0.28;
      
      const tentGeo = new THREE.BufferGeometry();
      const points = [];
      const segmentCount = 10;
      for (let s = 0; s < segmentCount; s++) {
        points.push(new THREE.Vector3(
          Math.cos(angle) * radius,
          -s * 0.15,
          Math.sin(angle) * radius
        ));
      }
      tentGeo.setFromPoints(points);
      
      const line = new THREE.Line(tentGeo, tentacleMat);
      this.group.add(line);
      
      this.tentacles.push({
        line,
        angle,
        points: points.map(p => p.clone()),
        originalPoints: points.map(p => p.clone())
      });
    }

    this.scene.add(this.group);
  }

  update() {
    const elapsed = this.time.elapsedTime;
    const delta = this.time.delta;

    // Slow upward pulsing movement (propulsion)
    const pulseCycle = (elapsed * this.speed * 2.0) % (Math.PI * 2);
    const isPulsing = Math.sin(pulseCycle) > 0.0;
    
    // Propulsion force
    const upwardPulsing = Math.sin(pulseCycle) * 0.5 + 0.5;
    this.position.y = this.initialY + Math.sin(elapsed * 0.4) * 3.0 + upwardPulsing * 0.6;
    
    // Slight float left/right
    this.position.x += Math.sin(elapsed * 0.2 + this.initialY) * 0.015;
    this.position.z += Math.cos(elapsed * 0.25 + this.initialY) * 0.015;
    
    this.group.position.copy(this.position);

    // Pulse cap scaling
    const capScale = 1.0 + Math.sin(pulseCycle * 2.0) * 0.12;
    this.capMesh.scale.set(capScale, 1.0 - Math.sin(pulseCycle * 2.0) * 0.08, capScale);
    
    // Animate tentacles
    this.tentacles.forEach((tentacle) => {
      const positions = tentacle.line.geometry.attributes.position.array;
      const tCount = tentacle.points.length;
      
      for (let s = 1; s < tCount; s++) {
        const idx = s * 3;
        const orig = tentacle.originalPoints[s];
        
        const swayFactor = (s / tCount);
        const swayX = Math.sin(elapsed * 2.0 + tentacle.angle + s * 0.4) * 0.08 * swayFactor;
        const swayZ = Math.cos(elapsed * 1.8 + tentacle.angle + s * 0.4) * 0.08 * swayFactor;
        
        const lagY = isPulsing ? -Math.sin(pulseCycle) * 0.05 * swayFactor : 0;
        
        positions[idx] = orig.x + swayX;
        positions[idx + 1] = orig.y + lagY;
        positions[idx + 2] = orig.z + swayZ;
      }
      tentacle.line.geometry.attributes.position.needsUpdate = true;
    });
  }

  dispose() {
    this.capMesh.geometry.dispose();
    this.capMesh.material.dispose();
    if (this.coreMesh) {
      this.coreMesh.geometry.dispose();
      this.coreMesh.material.dispose();
    }
    this.tentacles.forEach(t => {
      t.line.geometry.dispose();
      t.line.material.dispose();
    });
    this.scene.remove(this.group);
  }
}
