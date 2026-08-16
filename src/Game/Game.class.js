import * as THREE from 'three';
import Sizes from './Utils/Sizes.class';
import Time from './Utils/Time.class';
import Mouse from './Input/Mouse.class';
import Camera from './Core/Camera.class';
import Renderer from './Core/Renderer.class';
import PostProcessing from './Systems/PostProcessing.class';
import World from './World/World.scene';
import DebugPane from './Utils/DebugPane.class';
import ScrollController from './Systems/ScrollController.class';
import EventEmitter from './Utils/EventEmitter.class';

export default class Game extends EventEmitter {
  constructor(canvas, resources, debugMode) {
    if (Game.instance) {
      return Game.instance;
    }
    super();
    Game.instance = this;

    this.initialSceneReady = false;
    this.hasFirstRendered = false;
    this.isDebugEnabled = debugMode;
    this.stageMetrics = {};
    const gameStartTime = performance.now();
    console.log('[Game Initialization] Deterministic startup sequence started.');

    const runStage = (stageNumber, stageName, fn, isCritical = true) => {
      const t0 = performance.now();
      try {
        fn();
        const duration = performance.now() - t0;
        this.stageMetrics[`Stage ${stageNumber}: ${stageName}`] = { status: 'SUCCESS', durationMs: duration.toFixed(2) };
        console.log(`[Game Initialization] Stage ${stageNumber}: ${stageName} initialized in ${duration.toFixed(2)}ms`);
      } catch (err) {
        const duration = performance.now() - t0;
        this.stageMetrics[`Stage ${stageNumber}: ${stageName}`] = { status: isCritical ? 'FAILED' : 'WARNING', durationMs: duration.toFixed(2), error: err?.message || String(err) };
        if (isCritical) {
          console.error(`[Game Initialization] Stage ${stageNumber} CRITICAL ERROR: ${stageName} failed after ${duration.toFixed(2)}ms:`, err);
        } else {
          console.warn(`[Game Initialization] Stage ${stageNumber} WARNING: ${stageName} failed after ${duration.toFixed(2)}ms:`, err);
        }
      }
    };

    if (this.isDebugEnabled) {
      runStage(1, 'DebugPane', () => {
        this.debug = new DebugPane();
      }, false);
    }

    this.canvas = canvas;
    this.resources = resources;

    runStage(2, 'Sizes', () => {
      this.sizes = new Sizes();
    });

    runStage(3, 'Time', () => {
      this.time = new Time();
    });

    runStage(4, 'Mouse', () => {
      this.mouse = new Mouse();
    });

    runStage(5, 'Three.js Scene', () => {
      this.scene = new THREE.Scene();
    });

    runStage(6, 'Camera', () => {
      this.camera = new Camera();
    });

    runStage(7, 'Renderer', () => {
      this.renderer = new Renderer();
    });

    runStage(8, 'ScrollController', () => {
      this.scroll = new ScrollController();
    });

    runStage(9, 'World Scene', () => {
      this.world = new World();
    });

    runStage(10, 'PostProcessing (Deferred)', () => {
      this.postProcessing = null;
    }, false);

    runStage(11, 'Initial State & Shader Pre-compilation', () => {
      if (this.world) {
        this.world.update();
      }
      if (this.renderer && this.renderer.rendererInstance && this.scene && this.camera && this.camera.cameraInstance) {
        this.renderer.rendererInstance.compile(this.scene, this.camera.cameraInstance);
      }
    });

    runStage(12, 'First Frame Render & Confirmation', () => {
      this.update();
      this.hasFirstRendered = true;
      this.initialSceneReady = true;
      this.trigger('ready');
    });

    runStage(13, 'Animation Loop', () => {
      this.time.on('animate', () => {
        this.update();
      });
      this.sizes.on('resize', () => {
        this.resize();
      });
    });

    this.gameStartTime = gameStartTime;
    const totalInitDuration = performance.now() - gameStartTime;
    console.log(`[Diagnostic] [Game Startup Synchronous Phase Complete] First frame ready in ${totalInitDuration.toFixed(2)}ms`);
    console.log('[Diagnostic] [Game Stage Metrics Summary]:', this.stageMetrics);
  }

  initPostProcessing() {
    const t0 = performance.now();
    try {
      this.postProcessing = new PostProcessing();
      const duration = performance.now() - t0;
      console.log(`[Diagnostic] [PostProcessing] Initialized after first frame in ${duration.toFixed(2)}ms`);
      return duration;
    } catch (err) {
      console.warn('[Diagnostic] [PostProcessing] Initialization warning:', err);
      return 0;
    }
  }

  static getInstance() {
    if (!Game.instance) {
      Game.instance = new Game();
    }
    return Game.instance;
  }

  resize() {
    if (this.camera) this.camera.resize();
    if (this.renderer) this.renderer.resize();
    if (this.postProcessing) this.postProcessing.resize();
  }

  update() {
    const frameStart = performance.now();

    const tMouse = performance.now();
    if (this.mouse) this.mouse.update(this.time.delta);
    const mouseMs = performance.now() - tMouse;

    const tScroll = performance.now();
    if (this.scroll) this.scroll.update(this.time.delta);
    const scrollMs = performance.now() - tScroll;

    const tCamera = performance.now();
    if (this.camera && this.mouse) this.camera.update(this.mouse, this.time.delta);
    const cameraMs = performance.now() - tCamera;

    const tWorld = performance.now();
    if (this.world) this.world.update();
    const worldMs = performance.now() - tWorld;

    const tPP = performance.now();
    if (this.postProcessing && this.postProcessing.enabled) {
      this.postProcessing.update(this.time.elapsed, this.time.delta);
    }
    const postProcessingMs = performance.now() - tPP;

    const tRender = performance.now();
    if (this.renderer) this.renderer.update();
    const renderMs = performance.now() - tRender;

    if (!this.hasFirstRendered && this.gameStartTime) {
      this.hasFirstRendered = true;
      this.timeToFirstRender = performance.now() - this.gameStartTime;
      console.log(`[Performance Diagnostics] timeToFirstRender: ${this.timeToFirstRender.toFixed(2)}ms`);
    }

    const frameDuration = performance.now() - frameStart;
    this.longestAnimationFrameDuration = Math.max(this.longestAnimationFrameDuration || 0, frameDuration);

    if (frameDuration > 25) {
      console.warn(`[Performance Profile] Long animation frame: ${frameDuration.toFixed(2)}ms`, {
        mouseMs: mouseMs.toFixed(2),
        scrollMs: scrollMs.toFixed(2),
        cameraMs: cameraMs.toFixed(2),
        worldMs: worldMs.toFixed(2),
        postProcessingMs: postProcessingMs.toFixed(2),
        renderMs: renderMs.toFixed(2)
      });
    }
  }

  destroy() {
    this.sizes.off('resize');
    this.time.off('animate');

    this.scene.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();

        for (const key in child.material) {
          const value = child.material[key];

          if (typeof value?.dispose === 'function') {
            value.dispose();
          }
        }
      }
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        const mats = Array.isArray(child.material)
          ? child.material
          : [child.material];
        mats.forEach((m) => {
          for (const key in m) {
            const prop = m[key];
            if (prop && prop.isTexture) prop.dispose();
          }
          m.dispose();
        });
      }
    });

    if (this.scroll && this.scroll.destroy) this.scroll.destroy();
    this.camera.controls.dispose();
    this.renderer.rendererInstance.dispose();
    this.postProcessing.dispose();
    if (this.debug) this.debug.dispose();

    this.canvas = null;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.postProcessing = null;
    this.world = null;
    this.debug = null;
  }
}
