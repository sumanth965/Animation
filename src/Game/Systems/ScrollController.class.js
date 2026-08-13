import * as THREE from 'three';

// One normalized, reversible timeline shared by camera, dolphin and the HTML UI.
export default class ScrollController {
  constructor() {
    this.progress = 0;
    this.target = 0;
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.onScroll = this.onScroll.bind(this);
    window.addEventListener('scroll', this.onScroll, { passive: true });
    this.onScroll();
  }

  onScroll() {
    const max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
    this.target = THREE.MathUtils.clamp(scrollY / max, 0, 1);
  }

  update(delta) {
    const ease = this.reducedMotion ? 1.4 : 4.2;
    this.progress = THREE.MathUtils.damp(this.progress, this.target, ease, delta);
    document.documentElement.style.setProperty('--scroll-progress', this.progress);
    const intro = document.querySelector('.experience-copy');
    if (intro) intro.style.opacity = 1 - THREE.MathUtils.smoothstep(this.progress, .06, .28);
    const phase = this.progress < .33 ? 'DIVE' : this.progress < .7 ? 'EXPLORE' : 'EXPERIENCE';
    document.body.dataset.chapter = phase;
    const label = document.getElementById('current-chapter');
    if (label) label.textContent = phase;
  }
}
