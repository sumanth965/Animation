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
    this.scene.fog = new THREE.Fog(0x020a16, 5, 28);
    this.scene.background = null;

    this.lighting = new Lighting({ helperEnabled: false });

    this.seabed = new Seabed();
    this.wormhole = new Wormhole();
    this.flowField = new FlowField();
    this.dolphin = new Dolphin();
    this.wakeParticles = new WakeParticles(this.dolphin);
    this.city = new CityManager();
    this.fishSchool = new FishSchool({ buildingPosition: new THREE.Vector3(0, -6.5, -26), fishCount: 20 });
    this.eventManager = new EventManager(this.dolphin, this.city);
    
    // Configurable camera settings for smooth dynamic follow
    this.cameraConfig = {
      baseFollowDistance: 7.5,
      baseHeight: 2.8,
      baseSideOffset: 0.7,
      baseLookAhead: 0.025,
      baseFov: 32,
      dampingSpeed: 1.8,
      targetDampingSpeed: 5.0
    };
    
    this.desiredCameraPos = new THREE.Vector3();
    this.desiredFocusPos = new THREE.Vector3();
  }

  update() {
    const state = this.game.scroll.state;
    const isCinematic = state === 'SCROLLING' || Boolean(this.eventManager.selected);

    // Dynamic fog adjustment based on scroll progress to gradually reveal the city
    if (this.scene.fog) {
      const progress = this.game.scroll.progress;
      if (progress < 0.15) {
        const t = progress / 0.15;
        this.scene.fog.near = THREE.MathUtils.lerp(5, 20, t);
        this.scene.fog.far = THREE.MathUtils.lerp(28, 85, t);
      } else if (progress < 0.45) {
        const t = (progress - 0.15) / 0.3;
        this.scene.fog.near = THREE.MathUtils.lerp(20, 75, t);
        this.scene.fog.far = THREE.MathUtils.lerp(85, 230, t);
      } else {
        this.scene.fog.near = 75;
        this.scene.fog.far = 230;
      }
    }

    const scrollDirty = this.game.scroll.dirty;
    // Get camera frustum for culling
    const camera = this.game.camera.cameraInstance;
    const frustum = new THREE.Frustum();
    const cameraMatrix = new THREE.Matrix4();
    cameraMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(cameraMatrix);

    // Update order optimized: simpler systems first, complex ones last
    if (this.lighting && isCinematic) {
      this.lighting.update();
    }
    // Keep a low-frequency ambient seabed motion in the hero, but avoid
    // updating its uniforms every frame while the view is at rest.
    this._ambientFrame = (this._ambientFrame || 0) + 1;
    if (this.seabed && (isCinematic || this._ambientFrame % 8 === 0)) {
      this.seabed.update();
    }
    if (this.wormhole && isCinematic) {
      this.wormhole.update();
    }
    if (this.city && isCinematic && (scrollDirty || !this.game.scroll.isSettled)) this.city.update();
    if (this.flowField && isCinematic) {
      // Only update FlowField if visible
      if (this.flowField.points && frustum.intersectsObject(this.flowField.points)) {
        this.flowField.update();
      }
    }
    if (this.fishSchool && isCinematic) {
      this.fishSchool.update();
    }
    if (this.dolphin) {
      this.dolphin.update();
      
      const cameraSettled = this.isCameraFullySettled();
      if (isCinematic || !this.cameraReady) {
        this.updateJourneyCamera();
        this.eventManager.update();
        this.cameraReady = true;
      }
    }
    if (this.wakeParticles) {
      this.wakeParticles.particleSystem.visible = isCinematic;
      if (isCinematic) {
      this.wakeParticles.update();
      }
    }
  }

  isCameraFullySettled() {
    if (!this.desiredCameraPos || !this.desiredFocusPos) return true;
    const camera = this.game.camera.cameraInstance;
    const posDist = camera.position.distanceTo(this.desiredCameraPos);
    const focusDist = this.currentFocus ? this.currentFocus.distanceTo(this.desiredFocusPos) : 0;
    return posDist < 0.005 && focusDist < 0.005;
  }

  checkBuildingCollisions(cameraPos, safeMargin = 3.8) {
    if (!this.city || !this.city.buildings) return;
    
    this.city.buildings.forEach((building, id) => {
      // Get building position and height
      const bx = building.position.x;
      const bz = building.position.z;
      const height = building.userData.height || 10;
      
      // Calculate simple bounding cylinder radius based on building width/depth
      const width = building.userData.width || 6;
      const depth = building.userData.depth || 6;
      const radius = Math.max(width, depth) * 0.5;
      
      // Check horizontal XZ distance
      const dx = cameraPos.x - bx;
      const dz = cameraPos.z - bz;
      const distXZ = Math.hypot(dx, dz);
      
      const cylinderHeight = -12 + height;
      if (distXZ < (radius + safeMargin) && cameraPos.y < cylinderHeight + 2) {
        // Push camera radially outwards from the building center
        const pushFactor = (radius + safeMargin) / distXZ;
        cameraPos.x = bx + dx * pushFactor;
        cameraPos.z = bz + dz * pushFactor;
      }
    });
    
    // Clamp coordinates within ground and ceiling limits
    if (cameraPos.y < -10.0) {
      cameraPos.y = -10.0;
    }
    if (cameraPos.y > 25.0) {
      cameraPos.y = 25.0;
    }
  }

  updateJourneyCamera() {
    const camera = this.game.camera.cameraInstance;
    const progress = this.dolphin.journeyProgress;
    const dolphinPosition = this.dolphin.dolphin.position;
    
    // Get tangent and calculate stable position to avoid time-based idle float jitter when settled
    const tangent = this.dolphin.path.tangent.clone().normalize();
    const isSettled = this.game.scroll.isSettled;
    
    const dPos = new THREE.Vector3();
    if (isSettled) {
      this.dolphin.path.curve.getPointAt(progress, dPos);
    } else {
      dPos.copy(dolphinPosition);
    }
    
    // 1. Curvature detection for turns
    const tangentAhead = new THREE.Vector3();
    this.dolphin.path.curve.getTangentAt(THREE.MathUtils.clamp(progress + 0.05, 0, 1), tangentAhead);
    tangentAhead.normalize();
    const angleDiff = tangent.angleTo(tangentAhead);
    const curvature = THREE.MathUtils.clamp(angleDiff * 2.0, 0, 1.5);
    
    // Dynamic FOV and follow distance based on curvature
    const dynamicDistance = this.cameraConfig.baseFollowDistance + curvature * 3.5;
    const dynamicHeight = this.cameraConfig.baseHeight + curvature * 0.8;
    let targetFov = this.cameraConfig.baseFov + curvature * 12;
    
    // 2. Overview / Establishing shot at the start
    const overview = THREE.MathUtils.smoothstep(progress, 0, 0.13);
    const overviewTarget = new THREE.Vector3(4.0, 6.5, 15.0);
    const overviewFocus = new THREE.Vector3(2.5, 1.0, -10.0); // Focus closer to starting dolphin position
    
    // 3. Dynamic follow target calculation
    if (!this.smoothedTangent) {
      this.smoothedTangent = tangent.clone();
    } else {
      // Lag behind turns for a heavy cinematic sweeping orbit around the dolphin
      const slerpSpeed = isSettled ? 5.0 : 2.2;
      this.smoothedTangent.lerp(tangent, 1 - Math.exp(-this.game.time.delta * slerpSpeed)).normalize();
    }
    
    const closeTarget = dPos.clone()
      .addScaledVector(this.smoothedTangent, -dynamicDistance)
      .add(new THREE.Vector3(0, dynamicHeight, 0));
      
    // Apply dynamic lateral offset based on lateral vector
    const rightVec = new THREE.Vector3().crossVectors(tangent, new THREE.Vector3(0, 1, 0)).normalize();
    closeTarget.addScaledVector(rightVec, this.cameraConfig.baseSideOffset);
    
    // Look-ahead focus target slightly ahead on spline
    const lookAheadProgress = THREE.MathUtils.clamp(progress + this.cameraConfig.baseLookAhead, 0, 1);
    const lookAheadPos = new THREE.Vector3();
    this.dolphin.path.curve.getPointAt(lookAheadProgress, lookAheadPos);
    
    const closeFocus = lookAheadPos.clone();
    
    // 4. Override camera targets when approaching Event Buildings
    const selectedEvent = this.eventManager.selected;
    if (selectedEvent && selectedEvent.markerPosition) {
      const markerPos = selectedEvent.markerPosition;
      
      // Calculate midpoint between dolphin and building marker
      const midpoint = new THREE.Vector3().addVectors(dPos, markerPos).multiplyScalar(0.5);
      
      // Calculate horizontal perpendicular direction
      const vectorToMarker = new THREE.Vector3().subVectors(markerPos, dPos);
      const horizontalDist = Math.hypot(vectorToMarker.x, vectorToMarker.z);
      const perpDir = new THREE.Vector3(-vectorToMarker.z, 0, vectorToMarker.x).normalize();
      
      // Orient perpendicular away from metropolis center to keep the city in frame
      const centerToMid = midpoint.clone().sub(new THREE.Vector3(0, midpoint.y, -32));
      if (perpDir.dot(centerToMid) < 0) perpDir.negate();
      
      // Position camera to capture both elements nicely
      const eventDistance = Math.max(7.5, horizontalDist * 1.5);
      const eventTargetPos = midpoint.clone()
        .addScaledVector(perpDir, eventDistance)
        .add(new THREE.Vector3(0, 2.5, 0));
        
      closeTarget.copy(eventTargetPos);
      closeFocus.copy(midpoint);
      
      // Compute ideal event FOV
      targetFov = Math.max(30, Math.min(48, (horizontalDist / eventDistance) * (180 / Math.PI) * 1.2));
    }
    
    // Interpolate targets based on overview/follow phase transition
    this.desiredCameraPos.lerpVectors(overviewTarget, closeTarget, overview);
    this.desiredFocusPos.lerpVectors(overviewFocus, closeFocus, overview);
    
    // 5. Collision Boundary Constraints
    this.checkBuildingCollisions(this.desiredCameraPos, 3.8);
    
    // 6. Smoothly damp the actual camera position and lookAt target
    const dampSpeed = this.game.scroll.isScrolling ? this.cameraConfig.dampingSpeed : 4.0;
    camera.position.lerp(this.desiredCameraPos, 1 - Math.exp(-this.game.time.delta * dampSpeed));
    
    const fovDamp = 1 - Math.exp(-this.game.time.delta * 2.0);
    if (Math.abs(camera.fov - targetFov) > 0.01) {
      camera.fov = THREE.MathUtils.lerp(camera.fov, targetFov, fovDamp);
      camera.updateProjectionMatrix();
    }
    
    if (!this.currentFocus) {
      this.currentFocus = this.desiredFocusPos.clone();
    } else {
      camera.lookAt(this.currentFocus.lerp(this.desiredFocusPos, 1 - Math.exp(-this.game.time.delta * this.cameraConfig.targetDampingSpeed)));
    }
    
    // 7. Debug Camera Overlay and Helpers
    if (this.game.isDebugEnabled) {
      this.updateDebugVisuals(camera.position, this.currentFocus, dPos, tangent, progress);
    } else {
      this.removeDebugVisuals();
    }
  }

  createDebugHUD() {
    this.debugHUD = document.createElement('div');
    this.debugHUD.id = 'camera-debug-hud';
    Object.assign(this.debugHUD.style, {
      position: 'fixed',
      bottom: '20px',
      left: '20px',
      backgroundColor: 'rgba(2, 8, 20, 0.85)',
      border: '1px solid #00f3ff',
      borderRadius: '8px',
      padding: '12px',
      color: '#00f3ff',
      fontFamily: 'monospace',
      fontSize: '11px',
      lineHeight: '1.4',
      zIndex: '9999',
      pointerEvents: 'none',
      boxShadow: '0 0 10px rgba(0, 243, 255, 0.3)'
    });
    document.body.appendChild(this.debugHUD);
    
    // Camera-target helper line (purple)
    const lineMat1 = new THREE.LineBasicMaterial({ color: 0xff00ff, depthWrite: false });
    const lineGeo1 = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    this.debugLineCamTarget = new THREE.Line(lineGeo1, lineMat1);
    this.scene.add(this.debugLineCamTarget);
    
    // Look-ahead direction helper line (green)
    const lineMat2 = new THREE.LineBasicMaterial({ color: 0x00ff00, depthWrite: false });
    const lineGeo2 = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    this.debugLineLookAhead = new THREE.Line(lineGeo2, lineMat2);
    this.scene.add(this.debugLineLookAhead);
  }

  updateDebugVisuals(cameraPos, focusPos, dolphinPos, tangent, progress) {
    if (!this.debugHUD) this.createDebugHUD();
    
    this.debugHUD.innerHTML = `
      <b>[ CAMERA DEBUG HUD ]</b><br>
      Progress: ${progress.toFixed(4)}<br>
      Dolphin Pos: [${dolphinPos.x.toFixed(2)}, ${dolphinPos.y.toFixed(2)}, ${dolphinPos.z.toFixed(2)}]<br>
      Dolphin Dir: [${tangent.x.toFixed(2)}, ${tangent.y.toFixed(2)}, ${tangent.z.toFixed(2)}]<br>
      Camera Pos: [${cameraPos.x.toFixed(2)}, ${cameraPos.y.toFixed(2)}, ${cameraPos.z.toFixed(2)}]<br>
      Target Pos: [${focusPos.x.toFixed(2)}, ${focusPos.y.toFixed(2)}, ${focusPos.z.toFixed(2)}]<br>
      Cam Distance: ${cameraPos.distanceTo(dolphinPos).toFixed(2)}m<br>
      Cam Height: ${(cameraPos.y - dolphinPos.y).toFixed(2)}m
    `;
    
    // Update helper lines
    const points1 = [cameraPos.clone(), focusPos.clone()];
    this.debugLineCamTarget.geometry.setFromPoints(points1);
    this.debugLineCamTarget.geometry.attributes.position.needsUpdate = true;
    
    const lookAheadDir = tangent.clone().normalize().multiplyScalar(4.0);
    const points2 = [dolphinPos.clone(), dolphinPos.clone().add(lookAheadDir)];
    this.debugLineLookAhead.geometry.setFromPoints(points2);
    this.debugLineLookAhead.geometry.attributes.position.needsUpdate = true;
  }

  removeDebugVisuals() {
    if (this.debugHUD) {
      this.debugHUD.remove();
      this.debugHUD = null;
    }
    if (this.debugLineCamTarget) {
      this.scene.remove(this.debugLineCamTarget);
      this.debugLineCamTarget = null;
    }
    if (this.debugLineLookAhead) {
      this.scene.remove(this.debugLineLookAhead);
      this.debugLineLookAhead = null;
    }
  }
}
