import * as THREE from 'three';
import vertexShader from '../../../../Shaders/Dolphin/vertex.glsl';
import fragmentShader from '../../../../Shaders/Dolphin/fragment.glsl';
import sparkleVertexShader from '../../../../Shaders/Dolphin/sparkleVertex.glsl';
import sparkleFragmentShader from '../../../../Shaders/Dolphin/sparkleFragment.glsl';
import Game from '../../../Game.class';
import DolphinPath from './DolphinPath.class';

export const DOLPHIN_STATE = {
  INITIALIZING: 'INITIALIZING',
  IDLE_HERO: 'IDLE_HERO',
  TRANSITION_TO_PATH: 'TRANSITION_TO_PATH',
  SCROLLING: 'SCROLLING',
};

export default class Dolphin {
  constructor() {
    this.game = Game.getInstance();
    this.scene = this.game.scene;
    this.resources = this.game.resources;
    this.time = this.game.time;

    this.modelResource = this.resources.items.dolphinAnimatedModel;

    this.outset = 0.017;
    this._tmpBasePos = new THREE.Vector3();
    this._tmpSkinned = new THREE.Vector3();
    this._tmpLocalOut = new THREE.Vector3();
    this._tmpNormal = new THREE.Vector3();

    // Frame optimization flags
    this._skeletonUpdatedThisFrame = false;
    this._matrixWorldUpdatedThisFrame = false;
    this._frameCount = 0;

    // State machine & controller ownership
    this.state = DOLPHIN_STATE.INITIALIZING;
    this.activeControllerName = 'HeroIdleController';
    this.transitionProgress = 0;
    this.transitionStartPos = new THREE.Vector3();
    this.transitionStartQuat = new THREE.Quaternion();
    this.transitionStartScale = 1.0;

    this.targetQuaternion = new THREE.Quaternion();
    this.forward = new THREE.Vector3(0, 0, 1);
    this.heroTangent = new THREE.Vector3(-0.95, -0.1, -0.3).normalize();

    this.setMaterial();
    this.setModelInstance();
    this.setAnimation();
    this.path = new DolphinPath();
    this.journeyProgress = 0;
    this.focusProgress = null;
    this.updateTimeMs = 0;

    this.calculateHeroLayout();
    this.applyHeroPosition(true);

    this.setupSurfaceSampling();
    this.setPathDebug();
    this.setDebug();

    this.game.sizes.on('resize', () => this.onResize());
  }

  calculateHeroLayout() {
    const isMobile = this.game.sizes.width < 768;

    if (isMobile) {
      // Mobile safe region: scaled to fit right side without text or screen clipping
      this.fixedHeroPos = new THREE.Vector3(3.6, 2.65, 4.3);
      this.heroBounds = {
        minX: 3.0, maxX: 4.2,
        minY: 2.35, maxY: 2.95,
        minZ: 4.0,  maxZ: 4.6,
      };
      this.fixedHeroScale = 1.15;
    } else {
      // Desktop safe region: right side clear of text with larger scale
      this.fixedHeroPos = new THREE.Vector3(6.5, 3.5, 3.5);
      this.heroBounds = {
        minX: 5.8, maxX: 7.2,
        minY: 3.0, maxY: 4.0,
        minZ: 3.0,  maxZ: 4.0,
      };
      this.fixedHeroScale = 1.38;
    }
  }

  applyHeroPosition(isFrameZero = false) {
    this.dolphin.position.copy(this.fixedHeroPos);
    this.targetQuaternion.setFromUnitVectors(this.forward, this.heroTangent);
    this.dolphin.quaternion.copy(this.targetQuaternion);
    this.dolphin.scale.setScalar(this.fixedHeroScale);
    this.dolphin.updateMatrixWorld(true);

    if (isFrameZero && this.sparkles) {
      this.updateSparklePositions();
    }
  }

  onResize() {
    this.calculateHeroLayout();
    if (this.state === DOLPHIN_STATE.INITIALIZING || this.state === DOLPHIN_STATE.IDLE_HERO) {
      this.applyHeroPosition();
    }
  }

  // Kept behind ?mode=debug to verify corridor clearance against real city geometry.
  setPathDebug() {
    if (!this.game.isDebugEnabled) return;
    const curveGeometry = new THREE.BufferGeometry().setFromPoints(this.path.curve.getPoints(240));
    const curveLine = new THREE.Line(curveGeometry, new THREE.LineBasicMaterial({ color: 0x35f1ff }));
    this.scene.add(curveLine);
    this.path.waypoints.forEach(([type, name, x, y, z]) => {
      const color = type === 'APPROACH' ? 0xffc857 : 0x35f1ff;
      const marker = new THREE.Mesh(new THREE.SphereGeometry(.18, 8, 8), new THREE.MeshBasicMaterial({ color }));
      marker.position.set(x, y, z); marker.name = `${type}: ${name}`; this.scene.add(marker);
    });
  }

  setMaterial() {
    this.material = new THREE.ShaderMaterial({
      vertexShader: vertexShader,
      fragmentShader: fragmentShader,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uBaseColor: { value: new THREE.Color(0x6fd3fb) },
        uVelocity: { value: 0 },
      },
    });
  }

  setModelInstance() {
    this.dolphin = this.modelResource.scene;

    this.dolphin.traverse((child) => {
      if (child.isMesh) {
        child.material = this.material;
      }
    });

    this.scene.add(this.dolphin);
  }

  setAnimation() {
    this.animation = {};
    this.animation.mixer = new THREE.AnimationMixer(this.dolphin);

    if (
      this.modelResource.animations &&
      this.modelResource.animations.length > 0
    ) {
      this.animation.action = this.animation.mixer.clipAction(
        this.modelResource.animations[0]
      );
      this.animation.action.play();
    } else {
      console.warn('No animations found in dolphin model');
    }
  }

  setDebug() {
    if (!this.game.isDebugEnabled) return;

    const debug = this.game.debug;
    debug.addMonitor(this, 'updateTimeMs', { label: 'Update Time (ms)', graph: true, min: 0, max: 16 }, 'Dolphin');

    debug.add(
      this.material.uniforms.uBaseColor,
      'value',
      {
        label: 'Base Color',
      },
      'Dolphin'
    );

    if (this.sparklesMaterial) {
      debug.add(
        this.sparklesMaterial.uniforms.uSize,
        'value',
        {
          min: 1,
          max: 50,
          step: 1,
          label: 'Sparkle Size',
        },
        'Dolphin'
      );

      debug.add(
        this.sparklesMaterial.uniforms.uColor1,
        'value',
        {
          label: 'Sparkle Color 1',
        },
        'Dolphin'
      );

      debug.add(
        this.sparklesMaterial.uniforms.uColor2,
        'value',
        {
          label: 'Sparkle Color 2',
        },
        'Dolphin'
      );

      debug.add(
        this,
        'connectionDistance',
        {
          min: 0.1,
          max: 1.0,
          step: 0.05,
          label: 'Connection Dist',
        },
        'Dolphin'
      );

      debug.add(
        this.linesMaterial,
        'opacity',
        {
          min: 0,
          max: 1,
          step: 0.1,
          label: 'Line Opacity',
        },
        'Dolphin'
      );
    }

    const materialSettings = {
      wireframe: false,
      visible: true,
      sparklesVisible: true,
    };

    debug.add(
      materialSettings,
      'wireframe',
      {
        label: 'Wireframe',
        onChange: (value) => {
          this.material.wireframe = value;
        },
      },
      'Dolphin'
    );

    debug.add(
      materialSettings,
      'visible',
      {
        label: 'Visible',
        onChange: (value) => {
          this.dolphin.visible = value;
        },
      },
      'Dolphin'
    );

    debug.add(
      materialSettings,
      'sparklesVisible',
      {
        label: 'Sparkles Visible',
        onChange: (value) => {
          if (this.sparkles) this.sparkles.visible = value;
          if (this.lines) this.lines.visible = value;
        },
      },
      'Dolphin'
    );

    if (this.animation?.action) {
      const animSettings = {
        timeScale: 1,
        paused: false,
      };

      debug.add(
        animSettings,
        'timeScale',
        {
          min: 0,
          max: 3,
          step: 0.1,
          label: 'Anim Speed',
          onChange: (value) => {
            this.animation.action.timeScale = value;
          },
        },
        'Dolphin'
      );

      debug.add(
        animSettings,
        'paused',
        {
          label: 'Pause Anim',
          onChange: (value) => {
            if (value) {
              this.animation.action.paused = true;
            } else {
              this.animation.action.paused = false;
            }
          },
        },
        'Dolphin'
      );
    }

    debug.addButton(
      {
        label: 'Reset Transform',
        onClick: () => {
          this.dolphin.position.set(0, 0.5, 0);
          this.dolphin.rotation.set(0, 0, 0);
          this.dolphin.scale.set(1, 1, 1);
        },
      },
      'Dolphin'
    );
  }

  update() {
    const updateStart = this.game.isDebugEnabled ? performance.now() : 0;
    if (this.animation?.mixer) {
      this.animation.mixer.update(this.time.delta);
    }

    if (this.material.uniforms.uTime) {
      this.material.uniforms.uTime.value = this.time.elapsedTime;
    }

    this.updateJourney();

    const velocityIntensity = THREE.MathUtils.smoothstep(this.game.scroll.sharedVelocity, 0, 1.5);
    if (this.material.uniforms.uVelocity) {
      this.material.uniforms.uVelocity.value = velocityIntensity;
    }
    if (this.sparklesMaterial?.uniforms.uVelocity) {
      this.sparklesMaterial.uniforms.uVelocity.value = velocityIntensity;
    }

    if (this.sparkles && this.dolphinMesh) {
      this.updateSparklePositions();
    }

    if (this.sparklesMaterial?.uniforms.uTime) {
      this.sparklesMaterial.uniforms.uTime.value = this.time.elapsedTime;
    }

    if (this.game.isDebugEnabled) this.updateTimeMs = performance.now() - updateStart;
  }

  updateJourney() {
    const scrollProgress = this.game.scroll.progress;

    if (this.game.scroll.state === 'IDLE_HERO') {
      // Keep the hero alive without evaluating the cinematic spline or camera.
      const elapsed = this.time.elapsedTime;
      this.dolphin.position.set(
        this.fixedHeroPos.x + Math.sin(elapsed * 0.6) * 0.08,
        this.fixedHeroPos.y + Math.sin(elapsed * 0.9) * 0.055,
        this.fixedHeroPos.z + Math.cos(elapsed * 0.5) * 0.06,
      );
      this.dolphin.scale.setScalar(this.fixedHeroScale);
      this.targetQuaternion.setFromUnitVectors(this.forward, this.heroTangent);
      this.dolphin.quaternion.slerp(this.targetQuaternion, 1 - Math.exp(-this.time.delta * 3));
      this.dolphinVelocity = 0;
      return;
    }
    const destination = this.focusProgress === null ? scrollProgress : this.focusProgress;
    
    // Give the hero a slight emphasis without allowing its silhouette to crop
    // at the edge of the opening viewport.
    const scale = THREE.MathUtils.lerp(this.fixedHeroScale, 1.0, THREE.MathUtils.smoothstep(scrollProgress, 0.0, 0.12));
    this.dolphin.scale.set(scale, scale, scale);
    
    const isDolphinSettled = this.game.scroll.isSettled && 
                             (this.focusProgress === null || Math.abs(this.journeyProgress - destination) < 0.0001);
    
    if (isDolphinSettled && this._journeyProgressSettled && scrollProgress >= 0.12) {
      const pulse = Math.sin(this.time.elapsedTime * 4.2) * .025;
      this.dolphin.rotation.z = this._settledRotationZ + pulse;
      this.dolphinVelocity = 0;
      return;
    }

    const beforeJourney = this.journeyProgress;
    const speed = this.focusProgress === null ? 2.7 : 1.25;
    this.journeyProgress = THREE.MathUtils.damp(this.journeyProgress, destination, speed, this.time.delta);
    
    this.dolphinVelocity = this.time.delta > 0 ? (this.journeyProgress - beforeJourney) / this.time.delta : 0;
    
    const { position, tangent } = this.path.getPoint(
      this.journeyProgress,
      this.time.elapsedTime
    );
    this.dolphin.position.copy(position);
    // The model faces +Z; align it to the spline velocity then softly bank into turns.
    this.targetQuaternion.setFromUnitVectors(this.forward, tangent.clone().normalize());
    const bank = Math.sin(this.journeyProgress * Math.PI * 9) * .18;
    this.targetQuaternion.multiply(new THREE.Quaternion().setFromAxisAngle(tangent, bank));
    this.dolphin.quaternion.slerp(this.targetQuaternion, 1 - Math.exp(-this.time.delta * 5));
    const pulse = Math.sin(this.time.elapsedTime * 4.2) * .025;
    this.dolphin.rotation.z += pulse;

    this._settledRotationZ = this.dolphin.rotation.z - pulse;
    this._journeyProgressSettled = isDolphinSettled;
  }

  focusEvent(progress) { this.focusProgress = progress; }
  resumeJourney() { this.focusProgress = null; }

  setupSurfaceSampling() {
    this.dolphinMesh = null;
    this.dolphin.traverse((child) => {
      if (child.isSkinnedMesh) {
        this.dolphinMesh = child;
      }
    });

    if (!this.dolphinMesh) {
      console.warn('No skinned mesh found for surface sampling');
      return;
    }

    // Surface particles are expensive because they follow skinned vertices.
    // Surface sampling runs during the first render. A denser connection radius
    // gives a clear wireframe with far fewer points and much lower CPU cost.
    this.sparkleCount = window.innerWidth < 768 ? 220 : 400;
    this.connectionDistance = 0.28;

    this.sampledData = [];
    const geometry = this.dolphinMesh.geometry;
    const posAttr = geometry.getAttribute('position');
    const normalAttr = geometry.getAttribute('normal');

    for (let i = 0; i < this.sparkleCount; i++) {
      // Cached vertex anchors avoid scanning the whole mesh for each sparkle.
      const vertexIndex = Math.floor(Math.random() * posAttr.count);

      this.sampledData.push({
        vertexIndex,
        offset: new THREE.Vector3(),
        normal: normalAttr ? new THREE.Vector3().fromBufferAttribute(normalAttr, vertexIndex) : null,
        random: Math.random(),
        size: Math.random() * 0.5 + 0.5,
      });
    }

    const positions = new Float32Array(this.sparkleCount * 3);
    const randoms = new Float32Array(this.sparkleCount);
    const sizes = new Float32Array(this.sparkleCount);

    for (let i = 0; i < this.sparkleCount; i++) {
      randoms[i] = this.sampledData[i].random;
      sizes[i] = this.sampledData[i].size;
    }

    this.sparklesGeometry = new THREE.BufferGeometry();
    this.sparklesGeometry.setAttribute(
      'position',
      new THREE.BufferAttribute(positions, 3)
    );
    this.sparklesGeometry.setAttribute(
      'aRandom',
      new THREE.BufferAttribute(randoms, 1)
    );
    this.sparklesGeometry.setAttribute(
      'aSize',
      new THREE.BufferAttribute(sizes, 1)
    );

    this.sparklesMaterial = new THREE.ShaderMaterial({
      vertexShader: sparkleVertexShader,
      fragmentShader: sparkleFragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uSize: { value: 30.0 },
        uColor1: { value: new THREE.Color(0x15dfff) },
        uColor2: { value: new THREE.Color(0x4d8dff) },
        uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
        uVelocity: { value: 0 },
      },
    });

    this.sparkles = new THREE.Points(
      this.sparklesGeometry,
      this.sparklesMaterial
    );
    this.sparkles.frustumCulled = false;

    this.setupConnectionLines();

    this.scene.add(this.sparkles);

    this.updateSparklePositions();
  }

  setupConnectionLines() {
    const maxConnections = this.sparkleCount * 10;
    this.linePositions = new Float32Array(maxConnections * 6);
    this.lineColors = new Float32Array(maxConnections * 6);

    this.linesGeometry = new THREE.BufferGeometry();
    this.linesGeometry.setAttribute(
      'position',
      new THREE.BufferAttribute(this.linePositions, 3)
    );
    this.linesGeometry.setAttribute(
      'color',
      new THREE.BufferAttribute(this.lineColors, 3)
    );
    this.linesGeometry.setDrawRange(0, 0);

    this.linesMaterial = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 1.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.lines = new THREE.LineSegments(this.linesGeometry, this.linesMaterial);
    this.lines.frustumCulled = false;
    this.scene.add(this.lines);
  }

  updateSparklePositions() {
    if (!this.dolphinMesh || !this.sparklesGeometry) return;

    // Throttle updates when settled to save CPU skinning overhead
    const isSettled = this.game.scroll.isSettled && 
                     (this.focusProgress === null || Math.abs(this.journeyProgress - (this.focusProgress === null ? this.game.scroll.progress : this.focusProgress)) < 0.0001);
                     
    if (isSettled) {
      this._sparkleFrameSkip = (this._sparkleFrameSkip || 0) + 1;
      if (this._sparkleFrameSkip < 12) {
        return;
      }
      this._sparkleFrameSkip = 0;
    }

    const positionAttribute = this.sparklesGeometry.getAttribute('position');

    // Only update skeleton if it exists and cache the result
    if (this.dolphinMesh.skeleton && !this._skeletonUpdatedThisFrame) {
      this.dolphinMesh.skeleton.update();
      this._skeletonUpdatedThisFrame = true;
    }
    
    // Only update matrix world if needed
    if (!this._matrixWorldUpdatedThisFrame) {
      this.dolphinMesh.updateMatrixWorld(true);
      this._matrixWorldUpdatedThisFrame = true;
    }

    // Reuse Vector3 objects to avoid allocations
    const basePos = this._tmpBasePos;
    const skinned = this._tmpSkinned;
    const localOut = this._tmpLocalOut;
    const normalV = this._tmpNormal;

    const posAttr = this.dolphinMesh.geometry.getAttribute('position');
    const skinnedPositions = [];

    for (let i = 0; i < this.sparkleCount; i++) {
      const data = this.sampledData[i];

      basePos.fromBufferAttribute(posAttr, data.vertexIndex);

      if (data.normal) {
        normalV.copy(data.normal).normalize();
        localOut.copy(basePos).addScaledVector(normalV, this.outset);
      } else {
        localOut.copy(basePos).add(data.offset);
      }

      // Apply skinning transform
      if (this.dolphinMesh.applyBoneTransform) {
        skinned.copy(localOut);
        this.dolphinMesh.applyBoneTransform(data.vertexIndex, skinned);
        skinned.applyMatrix4(this.dolphinMesh.matrixWorld);
      } else if (this.dolphinMesh.boneTransform) {
        skinned.copy(localOut);
        this.dolphinMesh.boneTransform(data.vertexIndex, skinned);
        skinned.applyMatrix4(this.dolphinMesh.matrixWorld);
      } else {
        skinned.copy(localOut).applyMatrix4(this.dolphinMesh.matrixWorld);
      }

      positionAttribute.array[i * 3] = skinned.x;
      positionAttribute.array[i * 3 + 1] = skinned.y;
      positionAttribute.array[i * 3 + 2] = skinned.z;

      skinnedPositions.push(skinned.clone());
    }

    positionAttribute.needsUpdate = true;

    this.updateConnectionLines(skinnedPositions);
    
    // Reset frame flags for next frame
    this._skeletonUpdatedThisFrame = false;
    this._matrixWorldUpdatedThisFrame = false;
  }

  updateConnectionLines(positions) {
    let lineIndex = 0;
    const color1 = this.sparklesMaterial.uniforms.uColor1.value;
    const color2 = this.sparklesMaterial.uniforms.uColor2.value;
    const connectionDistSq = this.connectionDistance * this.connectionDistance;

    // Dynamic line opacity based on velocity
    const velocityIntensity = THREE.MathUtils.smoothstep(this.game.scroll.sharedVelocity, 0, 1.5);
    this.linesMaterial.opacity = 0.52 + velocityIntensity * 0.38;

    // Simple spatial grid optimization
    const gridSize = this.connectionDistance * 2;
    const grid = new Map();
    
    // Place particles in grid cells
    for (let i = 0; i < positions.length; i++) {
      const pos = positions[i];
      const cellX = Math.floor(pos.x / gridSize);
      const cellY = Math.floor(pos.y / gridSize);
      const cellZ = Math.floor(pos.z / gridSize);
      const cellKey = `${cellX},${cellY},${cellZ}`;
      
      if (!grid.has(cellKey)) {
        grid.set(cellKey, []);
      }
      grid.get(cellKey).push({ index: i, position: pos });
    }

    // Check connections only within neighboring cells
    for (let i = 0; i < positions.length; i++) {
      const pos = positions[i];
      const cellX = Math.floor(pos.x / gridSize);
      const cellY = Math.floor(pos.y / gridSize);
      const cellZ = Math.floor(pos.z / gridSize);
      
      // Check current cell and 26 neighboring cells
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          for (let dz = -1; dz <= 1; dz++) {
            const neighborKey = `${cellX + dx},${cellY + dy},${cellZ + dz}`;
            const neighbors = grid.get(neighborKey);
            
            if (neighbors) {
              for (const neighbor of neighbors) {
                const j = neighbor.index;
                if (j <= i) continue; // Avoid duplicate pairs
                
                const distSq = pos.distanceToSquared(neighbor.position);
                
                if (distSq < connectionDistSq) {
                  const alpha = 1.0 - Math.sqrt(distSq) / this.connectionDistance;

                  this.linePositions[lineIndex * 6] = pos.x;
                  this.linePositions[lineIndex * 6 + 1] = pos.y;
                  this.linePositions[lineIndex * 6 + 2] = pos.z;

                  this.linePositions[lineIndex * 6 + 3] = neighbor.position.x;
                  this.linePositions[lineIndex * 6 + 4] = neighbor.position.y;
                  this.linePositions[lineIndex * 6 + 5] = neighbor.position.z;

                  const mixedColor = color1
                    .clone()
                    .lerp(color2, this.sampledData[i].random);
                  this.lineColors[lineIndex * 6] = mixedColor.r * alpha;
                  this.lineColors[lineIndex * 6 + 1] = mixedColor.g * alpha;
                  this.lineColors[lineIndex * 6 + 2] = mixedColor.b * alpha;

                  this.lineColors[lineIndex * 6 + 3] = mixedColor.r * alpha;
                  this.lineColors[lineIndex * 6 + 4] = mixedColor.g * alpha;
                  this.lineColors[lineIndex * 6 + 5] = mixedColor.b * alpha;

                  lineIndex++;

                  if (lineIndex >= this.linePositions.length / 6) break;
                }
              }
            }
            if (lineIndex >= this.linePositions.length / 6) break;
          }
          if (lineIndex >= this.linePositions.length / 6) break;
        }
        if (lineIndex >= this.linePositions.length / 6) break;
      }
      if (lineIndex >= this.linePositions.length / 6) break;
    }

    this.linesGeometry.attributes.position.needsUpdate = true;
    this.linesGeometry.attributes.color.needsUpdate = true;
    this.linesGeometry.setDrawRange(0, lineIndex * 2);
  }
}
