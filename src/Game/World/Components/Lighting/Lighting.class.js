import * as THREE from 'three';
import Game from '../../../Game.class';

export default class Lighting {
  constructor({ helperEnabled = false } = {}) {
    this.game = Game.getInstance();
    this.scene = this.game.scene;
    this.resources = this.game.resources;
    this.helperEnabled = helperEnabled;

    this.setThreeDirectionalLights();
    this.setEnvironmentMapInstance();
  }

  setThreeDirectionalLights() {
    // Key light: primary, bright, positioned in front of the city to illuminate building facades facing the camera
    this.keyLight = new THREE.DirectionalLight(0xfff7e6, 3.5);
    this.keyLight.position.set(15, 25, 20);
    this.keyLight.castShadow = true;
    this.keyLight.shadow.mapSize.set(1024, 1024);
    this.scene.add(this.keyLight);

    // Fill light: soft fill from the front-left
    this.fillLight = new THREE.DirectionalLight(0xd6eaff, 1.2);
    this.fillLight.position.set(-15, 10, 15);
    this.scene.add(this.fillLight);

    // Back (rim) light: highlights edges from behind
    this.backLight = new THREE.DirectionalLight(0xffffff, 0.8);
    this.backLight.position.set(0, 15, -45);
    this.scene.add(this.backLight);

    // Ambient light: soft, warm underwater ambient fill
    this.ambientLight = new THREE.AmbientLight(0x1a334d, 0.6);
    this.scene.add(this.ambientLight);

    if (this.helperEnabled) {
      this.scene.add(new THREE.DirectionalLightHelper(this.keyLight, 0.5));
      this.scene.add(new THREE.DirectionalLightHelper(this.fillLight, 0.5));
      this.scene.add(new THREE.DirectionalLightHelper(this.backLight, 0.5));
    }
  }

  setEnvironmentMapInstance() {
    this.environmentMap = {
      intensity: 2.0,
      texture: this.resources.items.environmentMapTexture,
      updateMaterials: () => {
        this.scene.traverse((child) => {
          if (
            child instanceof THREE.Mesh &&
            child.material instanceof THREE.MeshStandardMaterial
          ) {
            child.material.envMap = this.environmentMap.texture;
            child.material.envMapIntensity = this.environmentMap.intensity;
            child.material.needsUpdate = true;
          }
        });
      },
    };

    // Ensure correct color space
    this.environmentMap.texture.colorSpace = THREE.SRGBColorSpace;
    this.environmentMap.updateMaterials();
    this.scene.environment = this.environmentMap.texture;
  }
}
