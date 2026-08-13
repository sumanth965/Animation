import * as THREE from 'three';
import Game from '../../../Game.class';
import Fish from './Fish.class';

export default class FishSchool {
  constructor({ buildingPosition = new THREE.Vector3(0, 0, -26), fishCount = 15 } = {}) {
    this.game = Game.getInstance();
    this.scene = this.game.scene;
    this.time = this.game.time;

    this.buildingPosition = buildingPosition.clone();
    this.fishCount = fishCount;
    this.fish = [];

    this.spawnFish();
  }

  spawnFish() {
    for (let i = 0; i < this.fishCount; i++) {
      // Spawn fish in a radius around the building
      const angle = (i / this.fishCount) * Math.PI * 2;
      const radius = 8 + Math.random() * 6;
      const height = -8 + Math.random() * 12;

      const position = new THREE.Vector3(
        Math.cos(angle) * radius,
        height,
        this.buildingPosition.z - 5 + Math.random() * 10
      );

      const speed = 3 + Math.random() * 2;

      const newFish = new Fish({
        position,
        schoolCenter: this.buildingPosition.clone().add(new THREE.Vector3(0, -4, 0)),
        speed,
      });

      this.fish.push(newFish);
    }
  }

  update() {
    const progress = this.game.scroll.progress;
    // Fish visible during opening DIVE phase (0 to ~0.3)
    const fishVisibility = THREE.MathUtils.smoothstep(progress, 0.25, 0.35);
    
    this.fish.forEach((fish) => {
      fish.update();
      fish.mesh.visible = fishVisibility > 0.01;
      // Fade out opacity
      if (fish.mesh.material.opacity !== undefined) {
        fish.mesh.material.opacity = fishVisibility;
      }
    });
  }

  dispose() {
    this.fish.forEach((fish) => {
      fish.dispose();
    });
    this.fish = [];
  }
}
