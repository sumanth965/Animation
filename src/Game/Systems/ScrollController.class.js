import * as THREE from 'three';

// One normalized, reversible timeline shared by camera, dolphin and the HTML UI.
export default class ScrollController {
  constructor() {
    this.progress = 0;
    this.target = 0;
    this.velocity = 0;
    this.isScrolling = false;
    this.isSettled = true;
    this.dirty = true;
    this.lastActivityTime = performance.now();
    this._lastProgress = 0;
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.onScroll = this.onScroll.bind(this);
    window.addEventListener('scroll', this.onScroll, { passive: true });
    this.onScroll();
  }

  onScroll() {
    const max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
    this.target = THREE.MathUtils.clamp(scrollY / max, 0, 1);
    this.isScrolling = true;
    this.isSettled = false;
    this.dirty = true;
    this.lastActivityTime = performance.now();
  }

  update(delta) {
    // Camera/world receive a low-pass version of page travel: smooth even during fast wheel input.
    const ease = this.reducedMotion ? 1.4 : 2.35;
    const before = this.progress;
    this.progress = THREE.MathUtils.damp(this.progress, this.target, ease, delta);
    this.velocity = delta > 0 ? (this.progress - before) / delta : 0;
    const remaining = Math.abs(this.target - this.progress);
    this.isSettled = remaining < .00008 && Math.abs(this.velocity) < .0008;
    this.isScrolling = !this.isSettled;
    this.dirty = Math.abs(this.progress - this._lastProgress) > .00001 || !this.isSettled;
    this._lastProgress = this.progress;
    document.documentElement.style.setProperty('--scroll-progress', this.progress);
    const intro = this.intro || (this.intro = document.querySelector('.experience-copy'));
    if (intro) intro.style.opacity = 1 - THREE.MathUtils.smoothstep(this.progress, .06, .28);
    const phase = this.progress < .33 ? 'DIVE' : this.progress < .7 ? 'EXPLORE' : 'EXPERIENCE';
    document.body.dataset.chapter = phase;
    const label = this.label || (this.label = document.getElementById('current-chapter'));
    if (label) label.textContent = phase;
  }
}
