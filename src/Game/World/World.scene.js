import * as THREE from 'three';
import Game from '../Game.class';
import Lighting from './Components/Lighting/Lighting.class';
import Dolphin from './Components/Dolphin/Dolphin.class';
import Wormhole from './Components/Wormhole/Wormhole.class';
import FlowField from './Components/FlowField/FlowField.class';
import WakeParticles from './Components/WakeParticles/WakeParticles.class';
import Seabed from './Components/Seabed/Seabed.class';
import EventManager from './Components/Events/EventManager.class';
import CityManager from './Components/City/CityManager.class';
import FishSchool from './Components/Fish/FishSchool.class';

export default class World {
  constructor() {
    this.game = Game.getInstance();
    this.scene = this.game.scene;
    this.scene.fog = new THREE.Fog(0x121316, 60, 180);

    this.lighting = new Lighting({ helperEnabled: false });

    this.seabed = new Seabed();
    this.wormhole = new Wormhole();
    this.flowField = new FlowField();
    this.dolphin = new Dolphin();
    this.wakeParticles = new WakeParticles(this.dolphin);
    this.city = new CityManager();
    this.fishSchool = new FishSchool({ buildingPosition: new THREE.Vector3(0, -6.5, -26), fishCount: 20 });
    this.eventManager = new EventManager(this.dolphin, this.city);
  }

  update() {
    const scrollDirty = this.game.scroll.dirty;
    // Get camera frustum for culling
    const camera = this.game.camera.cameraInstance;
    const frustum = new THREE.Frustum();
    const cameraMatrix = new THREE.Matrix4();
    cameraMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(cameraMatrix);

    // Update order optimized: simpler systems first, complex ones last
    if (this.seabed) {
      this.seabed.update();
    }
    if (this.wormhole) {
      this.wormhole.update();
    }
    if (this.city && (scrollDirty || !this.game.scroll.isSettled)) this.city.update();
    if (this.flowField) {
      // Only update FlowField if visible
      if (this.flowField.points && frustum.intersectsObject(this.flowField.points)) {
        this.flowField.update();
      }
    }
    if (this.fishSchool) {
      this.fishSchool.update();
    }
    if (this.dolphin) {
      this.dolphin.update();
      if (scrollDirty || !this.game.scroll.isSettled || this.eventManager.selected) {
        this.updateJourneyCamera();
        this.eventManager.update();
      }
    }
    if (this.wakeParticles) {
      this.wakeParticles.update();
    }
  }

  updateJourneyCamera() {
    const camera = this.game.camera.cameraInstance;
    const progress = this.dolphin.journeyProgress;
    const dolphinPosition = this.dolphin.dolphin.position;
    const overview = THREE.MathUtils.smoothstep(progress, 0, .13);
    const target = new THREE.Vector3(
      THREE.MathUtils.lerp(0, 1.1 + Math.sin(progress * Math.PI * 4) * .55, overview),
      THREE.MathUtils.lerp(10, -3.9, overview),
      THREE.MathUtils.lerp(15, dolphinPosition.z + 8, overview)
    );
    // A little slower than the scroll timeline creates a weightless underwater glide.
    camera.position.lerp(target, 1 - Math.exp(-this.game.time.delta * 1.45));
    const targetFov = THREE.MathUtils.lerp(52, 29, overview);
    if (Math.abs(camera.fov - targetFov) > .01) {
      camera.fov = targetFov;
      camera.updateProjectionMatrix();
    }
    const orbitingBuilding = progress > .13 && this.city;
    const focus = orbitingBuilding
      ? new THREE.Vector3(0, -6.5, dolphinPosition.z - 4).lerp(dolphinPosition, .5)
      : new THREE.Vector3(0, -3, -25);
    camera.lookAt(focus);
  }
}
