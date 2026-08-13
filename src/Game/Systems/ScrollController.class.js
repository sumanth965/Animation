import * as THREE from 'three';

// One normalized, reversible timeline shared by camera, dolphin and the HTML UI.
export default class ScrollController {
  constructor() {
    this.progress = 0;
    this.target = 0;
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.sections = [...document.querySelectorAll('[data-chapter]')];
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
    let active = 0;
    this.sections.forEach((section, index) => {
      const rect = section.getBoundingClientRect();
      const center = Math.abs(rect.top + rect.height / 2 - innerHeight / 2);
      if (center < Math.abs(this.sections[active].getBoundingClientRect().top + this.sections[active].getBoundingClientRect().height / 2 - innerHeight / 2)) active = index;
    });
    document.documentElement.style.setProperty('--scroll-progress', this.progress);
    document.body.dataset.chapter = this.sections[active]?.dataset.chapter || 'HOME';
    document.querySelectorAll('[data-rail]').forEach((el, i) => el.classList.toggle('active', i === active));
    const label = document.getElementById('current-chapter');
    if (label) label.textContent = this.sections[active]?.dataset.chapter || 'HOME';
  }
}
