import * as THREE from 'three';
import Lenis from 'lenis';
import Game from '../Game.class';

// One normalized, reversible timeline shared by camera, dolphin and the HTML UI.
export default class ScrollController {
  constructor() {
    this.game = Game.getInstance();
    
    // Initialize Lenis
    this.lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: 'vertical',
      gestureOrientation: 'vertical',
      smoothWheel: true,
      wheelMultiplier: 1.0,
      touchMultiplier: 1.5,
    });
    
    // Scroll-state system
    this.targetScroll = 0;
    this.currentScroll = 0;
    this.scrollVelocity = 0;
    this.dolphinVelocity = 0;
    this.sharedVelocity = 0;
    this.isScrolling = false;
    this.isSettled = true;
    this.state = 'IDLE_HERO';
    this.dirty = true;
    this.lastActivityTime = performance.now();
    
    this._lastProgress = 0;
    this._lastTargetScroll = 0;
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    
    // Compatibility fields
    this.progress = 0;
    this.target = 0;
    this.velocity = 0;
    
    this.lenis.on('scroll', (e) => {
      this.targetScroll = e.progress;
      this.scrollVelocity = e.velocity;
      this.isScrolling = true;
      this.isSettled = false;
      this.dirty = true;
      this.lastActivityTime = performance.now();
    });

    // A second frame handles browsers that restore scroll after module evaluation.
    requestAnimationFrame(() => { 
      this.lenis.scrollTo(0, { immediate: true }); 
    });
    
    if (this.game.isDebugEnabled) {
      this.setupDebug();
    }
  }

  setupDebug() {
    const debug = this.game.debug;
    const folderName = 'Scroll & Velocity Sync';
    
    this.cameraVelocity = 0;
    this.lightVelocity = 0;
    this.lightIntensity = 0;
    
    debug.addMonitor(this, 'progress', { label: 'Scroll Progress', graph: true, min: 0, max: 1 }, folderName);
    debug.addMonitor(this.lenis, 'velocity', { label: 'Lenis Velocity', graph: true }, folderName);
    debug.addMonitor(this, 'dolphinVelocity', { label: 'Dolphin Velocity', graph: true }, folderName);
    debug.addMonitor(this, 'cameraVelocity', { label: 'Camera Velocity', graph: true }, folderName);
    debug.addMonitor(this, 'lightVelocity', { label: 'Light Velocity', graph: true }, folderName);
    debug.addMonitor(this, 'lightIntensity', { label: 'Light Intensity', graph: true }, folderName);
    debug.addMonitor(this, 'isScrolling', { label: 'Is Scrolling' }, folderName);
    debug.addMonitor(this, 'isSettled', { label: 'Is Settled' }, folderName);
    debug.addMonitor(this, 'state', { label: 'Scene State' }, folderName);
  }

  update(delta) {
    if (delta <= 0) return;

    // 1. Advance Lenis simulation
    this.lenis.raf(performance.now());
    
    // 2. Interpolate currentScroll towards targetScroll
    const ease = this.reducedMotion ? 1.4 : 2.35;
    const before = this.currentScroll;
    this.currentScroll = THREE.MathUtils.damp(this.currentScroll, this.targetScroll, ease, delta);
    
    // 3. Compute velocities
    this.dolphinVelocity = (this.currentScroll - before) / delta;
    
    // Calculate sharedVelocity with acceleration and damping
    const targetShared = Math.abs(this.dolphinVelocity);
    this.sharedVelocity = THREE.MathUtils.damp(this.sharedVelocity, targetShared, 1.8, delta);
    this.sharedVelocity = THREE.MathUtils.clamp(this.sharedVelocity, 0, 2.0);
    
    // Compatibility fields mapping
    this.progress = this.currentScroll;
    this.target = this.targetScroll;
    this.velocity = this.dolphinVelocity;
    
    // 4. Update settled/scrolling states
    const remaining = Math.abs(this.targetScroll - this.currentScroll);
    this.isSettled = remaining < 0.0001 && Math.abs(this.dolphinVelocity) < 0.001 && !this.lenis.isScrolling;
    this.isScrolling = !this.isSettled;
    const isAtHero = this.isSettled && this.progress < 0.001 && this.targetScroll < 0.001;
    this.state = !this.isSettled ? 'SCROLLING' : isAtHero ? 'IDLE_HERO' : 'SETTLED';
    this.dirty = Math.abs(this.progress - this._lastProgress) > 0.00001 || !this.isSettled;
    this._lastProgress = this.progress;
    
    // 5. Update Debug variables
    if (this.game.isDebugEnabled) {
      const cameraInstance = this.game.camera?.cameraInstance;
      if (cameraInstance) {
        if (!this._lastCameraPos) {
          this._lastCameraPos = new THREE.Vector3().copy(cameraInstance.position);
        }
        this.cameraVelocity = cameraInstance.position.distanceTo(this._lastCameraPos) / delta;
        this._lastCameraPos.copy(cameraInstance.position);
      }
      
      const wakeParticles = this.game.world?.wakeParticles;
      if (wakeParticles) {
        const intensity = THREE.MathUtils.smoothstep(this.sharedVelocity, 0, 1.5);
        this.lightVelocity = wakeParticles.config.backwardSpeed * (0.3 + intensity * 1.7);
        this.lightIntensity = 0.35 + intensity * 1.25;
      } else {
        this.lightVelocity = 0;
        this.lightIntensity = 0;
      }
    }
    
    // 6. Update HTML properties & chapters
    document.documentElement.style.setProperty('--scroll-progress', this.progress);
    document.body.dataset.sceneState = this.state;
    
    // Update telemetry HUD
    const depth = Math.round(this.progress * 320);
    const depthEl = this.depthEl || (this.depthEl = document.getElementById('telemetry-depth'));
    if (depthEl) depthEl.textContent = depth + 'm';
    
    const statusEl = this.statusEl || (this.statusEl = document.getElementById('telemetry-status'));
    if (statusEl) {
      let statusText = 'STABLE';
      if (document.body.dataset.currentEvent) {
        statusText = 'MARKER ACQUIRED';
      } else if (this.isScrolling) {
        statusText = 'EXPLORING';
      } else {
        statusText = 'DOCKED';
      }
      statusEl.textContent = statusText;
    }

    const intro = this.intro || (this.intro = document.querySelector('.experience-copy'));
    if (intro) intro.style.opacity = 1 - THREE.MathUtils.smoothstep(this.progress, 0.06, 0.28);
    const phase = this.progress < 0.33 ? 'DIVE' : this.progress < 0.7 ? 'EXPLORE' : 'EXPERIENCE';
    document.body.dataset.chapter = phase;
    const label = this.label || (this.label = document.getElementById('current-chapter'));
    if (label) label.textContent = phase;
  }

  destroy() {
    if (this.lenis) {
      this.lenis.destroy();
    }
  }
}
