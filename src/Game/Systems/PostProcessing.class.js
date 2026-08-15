import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { GammaCorrectionShader } from 'three/examples/jsm/shaders/GammaCorrectionShader.js';

import Game from '../Game.class';

import combinedVertexShader from '../../Shaders/PostProcessing/combined.vert.glsl';
import combinedFragmentShader from '../../Shaders/PostProcessing/combined.frag.glsl';

// Single combined post-processing shader pass (keeps the composer lightweight).
const CombinedShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uGlowIntensity: { value: 0.4 },
    uAberration: { value: 0.003 },
    uMouseInfluence: { value: new THREE.Vector2(0, 0) },
    uGrainIntensity: { value: 0.05 },
    uVignetteStrength: { value: 0.15 },
  },
  vertexShader: combinedVertexShader,
  fragmentShader: combinedFragmentShader,
};

export default class PostProcessing {
  constructor() {
    this.game = Game.getInstance();
    this.scene = this.game.scene;
    this.camera = this.game.camera.cameraInstance;
    this.renderer = this.game.renderer.rendererInstance;
    this.sizes = this.game.sizes;
    this.debug = this.game.debug;
    this.isDebugEnabled = this.game.isDebugEnabled;

    this.mouseVelocity = new THREE.Vector2(0, 0);

    // Store original values for interpolation
    this.baseRGBShift = 0.003;
    this.baseVignetteStrength = 0.15;
    this.baseGlowIntensity = 0.4;

    // Max values when dragging
    this.maxRGBShift = 0.1;
    this.maxVignetteStrength = 0.5;
    this.maxGlowIntensity = 1.0;

    // Current interpolated values
    this.currentRGBShift = this.baseRGBShift;
    this.currentVignetteStrength = this.baseVignetteStrength;
    this.currentGlowIntensity = this.baseGlowIntensity;

    // Lerp speed
    this.easeK = 8.0;
    
    // Drag state
    this.isDragging = false;
    this.enabled = true;

    const t0 = performance.now();
    try {
      this.composer = new EffectComposer(this.renderer);
      this.setupPasses();
      this.setupPointerListeners();
      const duration = performance.now() - t0;
      console.log(`[Diagnostic] [PostProcessing] EffectComposer & passes initialized in ${duration.toFixed(2)}ms`);
    } catch (err) {
      const duration = performance.now() - t0;
      console.warn(`[Diagnostic] [PostProcessing] Setup failed after ${duration.toFixed(2)}ms. Falling back to direct scene rendering. Error:`, err);
      this.enabled = false;
    }

    if (this.isDebugEnabled && this.enabled) {
      this.initTweakPane();
    }
  }

  setupPointerListeners() {
    window.addEventListener('pointerdown', () => {
      this.isDragging = true;
    });
    
    window.addEventListener('pointerup', () => {
      this.isDragging = false;
    });
    
    window.addEventListener('pointercancel', () => {
      this.isDragging = false;
    });
  }

  setupPasses() {
    const renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(renderPass);

    this.combinedPass = new ShaderPass(CombinedShader);
    this.composer.addPass(this.combinedPass);
  }

  initTweakPane() {
    if (!this.debug || !this.combinedPass) return;
    this.debug.add(
      this.combinedPass.uniforms.uGlowIntensity,
      'value',
      { min: 0, max: 2, step: 0.01, label: 'Glow Intensity' },
      'Post Processing'
    );
    this.debug.add(
      this.combinedPass.uniforms.uAberration,
      'value',
      { min: 0, max: 0.1, step: 0.001, label: 'RGB Shift' },
      'Post Processing'
    );
    this.debug.add(
      this.combinedPass.uniforms.uGrainIntensity,
      'value',
      { min: 0, max: 0.3, step: 0.01, label: 'Film Grain' },
      'Post Processing'
    );
    this.debug.add(
      this.combinedPass.uniforms.uVignetteStrength,
      'value',
      { min: 0, max: 0.5, step: 0.01, label: 'Vignette' },
      'Post Processing'
    );
  }

  lerp(a, b, t) {
    return a + (b - a) * t;
  }

  update(elapsedTime, deltaTime) {
    if (!this.enabled || !this.combinedPass) return;
    if (this.game.scroll.state !== 'SCROLLING' && !this.isDragging) return;

    this.combinedPass.uniforms.uTime.value = elapsedTime;
    this.combinedPass.uniforms.uMouseInfluence.value.copy(this.mouseVelocity);

    const targetRGBShift = this.isDragging ? this.maxRGBShift : this.baseRGBShift;
    const targetVignette = this.isDragging ? this.maxVignetteStrength : this.baseVignetteStrength;
    const targetGlow = this.isDragging ? this.maxGlowIntensity : this.baseGlowIntensity;

    const lerpFactor = Math.min(deltaTime * this.easeK, 1.0);

    this.currentRGBShift = this.lerp(this.currentRGBShift, targetRGBShift, lerpFactor);
    this.currentVignetteStrength = this.lerp(this.currentVignetteStrength, targetVignette, lerpFactor);
    this.currentGlowIntensity = this.lerp(this.currentGlowIntensity, targetGlow, lerpFactor);

    this.combinedPass.uniforms.uAberration.value = this.currentRGBShift;
    this.combinedPass.uniforms.uVignetteStrength.value = this.currentVignetteStrength;
    this.combinedPass.uniforms.uGlowIntensity.value = this.currentGlowIntensity;
  }

  setMouseVelocity(velocity) {
    this.mouseVelocity.copy(velocity);
  }

  render() {
    if (this.enabled && this.composer) {
      try {
        this.composer.render();
      } catch (e) {
        console.warn('[PostProcessing] Render error in composer. Disabling post-processing pass.', e);
        this.enabled = false;
      }
    }
  }

  resize() {
    if (this.enabled && this.composer) {
      this.composer.setSize(this.sizes.width, this.sizes.height);
    }
  }

  dispose() {
    if (this.composer) this.composer.dispose();
  }
}
