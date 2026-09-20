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

    // Unique per-instance offsets so multiple jellyfish never move in lockstep
    this.seed = Math.random() * 1000;
    this.phaseOffset = Math.random() * Math.PI * 2;
    this.driftFreqX = 0.15 + Math.random() * 0.1;
    this.driftFreqZ = 0.18 + Math.random() * 0.1;
    this.rotationSpeed = (Math.random() - 0.5) * 0.15;

    this.tentacles = [];
    this.oralArms = [];
    this.createGeometry();
  }

  // Smooth bell-contraction curve: sharp contraction, slow relaxed drift back out
  // (mimics real jellyfish propulsion better than a plain sine)
  pulseEase(t) {
    const s = Math.sin(t);
    return s >= 0 ? Math.pow(s, 0.6) : -Math.pow(-s, 1.8) * 0.4;
  }

  createGeometry() {
    this.group = new THREE.Group();
    this.group.position.copy(this.position);
    this.group.scale.set(this.size, this.size, this.size);
    this.group.rotation.y = Math.random() * Math.PI * 2;

    // 1. Jellyfish Cap (Sphere dome)
    const capGeo = new THREE.SphereGeometry(0.4, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2);
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

    // Faint under-bell ring for extra glow depth
    const ringGeo = new THREE.RingGeometry(0.22, 0.3, 24);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x85e6ff,
      transparent: true,
      opacity: 0.25,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending
    });
    this.ringMesh = new THREE.Mesh(ringGeo, ringMat);
    this.ringMesh.rotation.x = Math.PI / 2;
    this.ringMesh.position.y = 0.02;
    this.group.add(this.ringMesh);

    // 2. Glowing inner core
    const coreGeo = new THREE.SphereGeometry(0.18, 12, 12);
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0xffa0d0,
      transparent: true,
      opacity: 0.8
    });
    this.coreMesh = new THREE.Mesh(coreGeo, coreMat);
    this.coreMesh.position.y = 0.1;
    this.group.add(this.coreMesh);

    // 3. Long outer tentacles
    const tentacleMat = new THREE.LineBasicMaterial({
      color: 0x85e6ff,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending
    });

    const tentacleCount = 8;
    for (let i = 0; i < tentacleCount; i++) {
      const angle = (i / tentacleCount) * Math.PI * 2;
      const radius = 0.3;
      const segmentCount = 14;
      const lengthVariance = 0.85 + Math.random() * 0.4; // varied lengths look more natural

      const points = [];
      for (let s = 0; s < segmentCount; s++) {
        points.push(new THREE.Vector3(
          Math.cos(angle) * radius,
          -s * 0.16 * lengthVariance,
          Math.sin(angle) * radius
        ));
      }

      const tentGeo = new THREE.BufferGeometry().setFromPoints(points);
      const line = new THREE.Line(tentGeo, tentacleMat);
      this.group.add(line);

      this.tentacles.push({
        line,
        angle,
        phase: Math.random() * Math.PI * 2,
        speedMod: 0.8 + Math.random() * 0.5,
        originalPoints: points.map(p => p.clone())
      });
    }

    // 4. Shorter, frillier oral arms near the center (thicker, more curled)
    const oralMat = new THREE.LineBasicMaterial({
      color: 0xffa0d0,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending
    });

    const oralCount = 4;
    for (let i = 0; i < oralCount; i++) {
      const angle = (i / oralCount) * Math.PI * 2 + 0.4;
      const radius = 0.1;
      const segmentCount = 8;

      const points = [];
      for (let s = 0; s < segmentCount; s++) {
        points.push(new THREE.Vector3(
          Math.cos(angle) * radius,
          -s * 0.09,
          Math.sin(angle) * radius
        ));
      }

      const oralGeo = new THREE.BufferGeometry().setFromPoints(points);
      const line = new THREE.Line(oralGeo, oralMat);
      this.group.add(line);

      this.oralArms.push({
        line,
        angle,
        phase: Math.random() * Math.PI * 2,
        originalPoints: points.map(p => p.clone())
      });
    }

    this.scene.add(this.group);
  }

  update() {
    const elapsed = this.time.elapsedTime + this.seed;
    const delta = this.time.delta;

    // --- Propulsion pulse ---
    const pulseCycle = (elapsed * this.speed * 2.0 + this.phaseOffset) % (Math.PI * 2);
    const pulseValue = this.pulseEase(pulseCycle);
    const upwardPulsing = pulseValue * 0.5 + 0.5;

    // --- Vertical drift: slow bob + gentle propulsion kick, layered ---
    this.position.y =
      this.initialY +
      Math.sin(elapsed * 0.4) * 3.0 +
      Math.sin(elapsed * 0.13 + this.phaseOffset) * 0.8 + // slower secondary bob for organic feel
      upwardPulsing * 0.6;

    // --- Horizontal drift: layered sine waves approximate gentle current wander ---
    this.position.x +=
      Math.sin(elapsed * this.driftFreqX + this.initialY) * 0.02 +
      Math.sin(elapsed * this.driftFreqX * 2.3 + this.seed) * 0.008;
    this.position.z +=
      Math.cos(elapsed * this.driftFreqZ + this.initialY) * 0.02 +
      Math.cos(elapsed * this.driftFreqZ * 2.1 + this.seed) * 0.008;

    this.group.position.copy(this.position);

    // Gentle continuous rotation, like slow drifting in the current
    this.group.rotation.y += this.rotationSpeed * delta;

    // --- Bell (cap) contraction/relaxation ---
    const capScale = 1.0 + pulseValue * 0.14;
    this.capMesh.scale.set(capScale, 1.0 - pulseValue * 0.1, capScale);
    this.ringMesh.scale.set(capScale, capScale, 1);
    this.coreMesh.scale.setScalar(1.0 + pulseValue * 0.08);

    // --- Outer tentacles: full-length undulation with drag/lag from propulsion ---
    this.tentacles.forEach((tentacle) => {
      const positions = tentacle.line.geometry.attributes.position.array;
      const tCount = tentacle.originalPoints.length;

      for (let s = 1; s < tCount; s++) {
        const idx = s * 3;
        const orig = tentacle.originalPoints[s];
        const swayFactor = s / tCount;

        // Multi-frequency sway so each segment moves with organic complexity,
        // stronger toward the tentacle tip
        const t = elapsed * tentacle.speedMod;
        const swayX =
          (Math.sin(t * 2.0 + tentacle.angle + tentacle.phase + s * 0.4) * 0.09 +
            Math.sin(t * 0.7 + tentacle.phase) * 0.03) *
          swayFactor;
        const swayZ =
          (Math.cos(t * 1.8 + tentacle.angle + tentacle.phase + s * 0.4) * 0.09 +
            Math.cos(t * 0.65 + tentacle.phase) * 0.03) *
          swayFactor;

        // Tentacles trail/lag behind the bell's contraction, curling up on the
        // power stroke and relaxing back down after
        const lagY = -pulseValue * 0.09 * swayFactor;

        positions[idx] = orig.x + swayX;
        positions[idx + 1] = orig.y + lagY;
        positions[idx + 2] = orig.z + swayZ;
      }
      tentacle.line.geometry.attributes.position.needsUpdate = true;
    });

    // --- Oral arms: quicker, curlier flutter close to the body ---
    this.oralArms.forEach((arm) => {
      const positions = arm.line.geometry.attributes.position.array;
      const tCount = arm.originalPoints.length;

      for (let s = 1; s < tCount; s++) {
        const idx = s * 3;
        const orig = arm.originalPoints[s];
        const swayFactor = s / tCount;

        const t = elapsed * 1.6;
        const swayX = Math.sin(t + arm.angle + arm.phase + s * 0.6) * 0.05 * swayFactor;
        const swayZ = Math.cos(t * 0.9 + arm.angle + arm.phase + s * 0.6) * 0.05 * swayFactor;
        const lagY = -pulseValue * 0.05 * swayFactor;

        positions[idx] = orig.x + swayX;
        positions[idx + 1] = orig.y + lagY;
        positions[idx + 2] = orig.z + swayZ;
      }
      arm.line.geometry.attributes.position.needsUpdate = true;
    });
  }

  dispose() {
    this.capMesh.geometry.dispose();
    this.capMesh.material.dispose();
    if (this.ringMesh) {
      this.ringMesh.geometry.dispose();
      this.ringMesh.material.dispose();
    }
    if (this.coreMesh) {
      this.coreMesh.geometry.dispose();
      this.coreMesh.material.dispose();
    }
    this.tentacles.forEach(t => {
      t.line.geometry.dispose();
      t.line.material.dispose();
    });
    this.oralArms.forEach(a => {
      a.line.geometry.dispose();
      a.line.material.dispose();
    });
    this.scene.remove(this.group);
  }
}
