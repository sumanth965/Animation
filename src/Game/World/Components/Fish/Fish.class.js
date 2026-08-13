import * as THREE from 'three';
import Game from '../../../Game.class';

export default class Fish {
  constructor({ position = new THREE.Vector3(), schoolCenter = new THREE.Vector3(), speed = 0.5 } = {}) {
    this.game = Game.getInstance();
    this.scene = this.game.scene;
    this.time = this.game.time;

    this.position = position.clone();
    this.schoolCenter = schoolCenter.clone();
    this.speed = speed + (Math.random() - 0.5) * 0.2; // Add variation
    this.direction = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
    
    // Behavioral parameters
    this.wanderAngle = Math.random() * Math.PI * 2;
    this.wanderDistance = 15;
    this.separationRadius = 2;
    this.alignmentRadius = 8;
    this.cohesionRadius = 12;
    
    // Time tracking
    this.changeDirectionTimer = 0;
    this.changeDirectionInterval = 2 + Math.random() * 3;
    
    this.createGeometry();
  }

  createGeometry() {
    // Create a simple streamlined fish shape
    const geometry = new THREE.IcosahedronGeometry(0.15, 1);
    geometry.scale(1, 0.6, 2.5); // Make it fish-shaped (longer and thinner)

    const material = new THREE.MeshStandardMaterial({
      color: new THREE.Color().setHSL(0.55 + Math.random() * 0.1, 0.7, 0.5), // Blue-ish tones
      metalness: 0.6,
      roughness: 0.3,
      emissive: new THREE.Color().setHSL(0.55, 0.4, 0.3),
      transparent: true,
      opacity: 1,
    });

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.position.copy(this.position);
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = false;
    this.mesh.frustumCulled = false;
    
    this.scene.add(this.mesh);
  }

  update() {
    this.changeDirectionTimer += this.time.delta;

    // Change direction periodically
    if (this.changeDirectionTimer > this.changeDirectionInterval) {
      this.changeDirectionTimer = 0;
      this.changeDirectionInterval = 2 + Math.random() * 3;
      this.wanderAngle += (Math.random() - 0.5) * Math.PI;
    }

    // Wander behavior
    const wanderForce = new THREE.Vector3(
      Math.cos(this.wanderAngle) * 0.3,
      Math.sin(this.wanderAngle * 0.5) * 0.2,
      Math.cos(this.wanderAngle * 0.7) * 0.3
    ).normalize();

    // Stay near school center (return force)
    const toCenter = this.schoolCenter.clone().sub(this.position);
    const distanceToCenter = toCenter.length();
    let returnForce = new THREE.Vector3();
    
    if (distanceToCenter > this.cohesionRadius) {
      returnForce = toCenter.normalize().multiplyScalar(0.4);
    } else if (distanceToCenter > 0.5) {
      returnForce = toCenter.normalize().multiplyScalar(0.15);
    }

    // Combine forces
    this.direction = this.direction
      .clone()
      .multiplyScalar(0.6)
      .add(wanderForce.multiplyScalar(0.3))
      .add(returnForce.multiplyScalar(0.1))
      .normalize();

    // Update position
    this.position.addScaledVector(this.direction, this.speed * this.time.delta);

    // Boundary constraints (stay relatively near building)
    const MAX_DISTANCE = 20;
    if (this.position.distanceTo(this.schoolCenter) > MAX_DISTANCE) {
      const back = this.schoolCenter.clone().sub(this.position).normalize();
      this.position.addScaledVector(back, this.speed * this.time.delta * 2);
    }

    // Update mesh
    this.mesh.position.copy(this.position);
    
    // Rotate to face direction of movement
    if (this.direction.length() > 0.01) {
      const targetQuaternion = new THREE.Quaternion();
      targetQuaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), this.direction);
      this.mesh.quaternion.slerp(targetQuaternion, 0.1);
    }
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    this.scene.remove(this.mesh);
  }
}
