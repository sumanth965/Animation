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

export default class Game {
  constructor(canvas, resources, debugMode) {
    if (Game.instance) {
      return Game.instance;
    }
    Game.instance = this;

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

    runStage(10, 'PostProcessing', () => {
      this.postProcessing = new PostProcessing();
    }, false);

    runStage(11, 'Animation Loop', () => {
      this.time.on('animate', () => {
        this.update();
      });
      this.sizes.on('resize', () => {
        this.resize();
      });
    });

    const totalInitDuration = performance.now() - gameStartTime;
    console.log(`[Diagnostic] [Game Startup Complete] Total initialization duration: ${totalInitDuration.toFixed(2)}ms`);
    console.log('[Diagnostic] [Game Stage Metrics Summary]:', this.stageMetrics);
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
    if (this.mouse) this.mouse.update(this.time.delta);
    if (this.scroll) this.scroll.update(this.time.delta);
    if (this.camera && this.mouse) this.camera.update(this.mouse, this.time.delta);
    if (this.world) this.world.update();
    if (this.postProcessing && this.postProcessing.enabled) {
      this.postProcessing.update(this.time.elapsed, this.time.delta);
    }
    if (this.renderer) this.renderer.update();
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
