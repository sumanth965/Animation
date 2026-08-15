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
    console.log('[Game Initialization] Deterministic startup sequence started.');

    if (this.isDebugEnabled) {
      try {
        this.debug = new DebugPane();
        console.log('[Game Initialization] Stage 1: DebugPane initialized.');
      } catch (e) {
        console.warn('[Game Initialization] Stage 1 Warning: DebugPane setup failed:', e);
      }
    }

    this.canvas = canvas;
    this.resources = resources;

    try {
      this.sizes = new Sizes();
      console.log(`[Game Initialization] Stage 2: Sizes initialized (${this.sizes.width}x${this.sizes.height}, DPR: ${this.sizes.pixelRatio}).`);
    } catch (e) {
      console.error('[Game Initialization] Stage 2 Error: Sizes failed:', e);
    }

    try {
      this.time = new Time();
      console.log('[Game Initialization] Stage 3: Time system initialized.');
    } catch (e) {
      console.error('[Game Initialization] Stage 3 Error: Time failed:', e);
    }

    try {
      this.mouse = new Mouse();
      console.log('[Game Initialization] Stage 4: Mouse input initialized.');
    } catch (e) {
      console.error('[Game Initialization] Stage 4 Error: Mouse failed:', e);
    }

    try {
      this.scene = new THREE.Scene();
      console.log('[Game Initialization] Stage 5: Three.js Scene created.');
    } catch (e) {
      console.error('[Game Initialization] Stage 5 Error: Scene creation failed:', e);
    }

    try {
      this.camera = new Camera();
      console.log('[Game Initialization] Stage 6: Camera created.');
    } catch (e) {
      console.error('[Game Initialization] Stage 6 Error: Camera creation failed:', e);
    }

    try {
      this.renderer = new Renderer();
      console.log('[Game Initialization] Stage 7: Renderer created successfully.');
    } catch (e) {
      console.error('[Game Initialization] Stage 7 Error: Renderer creation failed:', e);
    }

    try {
      this.scroll = new ScrollController();
      console.log('[Game Initialization] Stage 8: ScrollController created.');
    } catch (e) {
      console.error('[Game Initialization] Stage 8 Error: ScrollController failed:', e);
    }

    try {
      this.world = new World();
      console.log('[Game Initialization] Stage 9: World scene created (sea, dolphin, buildings, lighting, events).');
    } catch (e) {
      console.error('[Game Initialization] Stage 9 Error: World scene creation failed:', e);
    }

    try {
      this.postProcessing = new PostProcessing();
      console.log('[Game Initialization] Stage 10: PostProcessing created.');
    } catch (e) {
      console.warn('[Game Initialization] Stage 10 Warning: PostProcessing failed, falling back to direct render:', e);
    }

    try {
      this.time.on('animate', () => {
        this.update();
      });
      this.sizes.on('resize', () => {
        this.resize();
      });
      console.log('[Game Initialization] Stage 11: Animation loop started successfully.');
    } catch (e) {
      console.error('[Game Initialization] Stage 11 Error: Animation loop setup failed:', e);
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
