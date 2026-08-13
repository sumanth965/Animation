import EventEmitter from './EventEmitter.class';

export default class Time extends EventEmitter {
  constructor() {
    super();

    this.start = Date.now();
    this.current = this.start;
    this.elapsedTime = 0;
    this.delta = 34;
    this.isVisible = !document.hidden;
    document.addEventListener('visibilitychange', () => {
      this.isVisible = !document.hidden;
      // Avoid a large simulation jump when returning to the tab.
      if (this.isVisible) this.current = Date.now();
    });

    window.requestAnimationFrame(() => {
      this.animate();
    });
  }

  animate() {
    if (!this.isVisible) {
      window.requestAnimationFrame(() => this.animate());
      return;
    }
    const currentTime = Date.now();
    this.delta = Math.min((currentTime - this.current) / 1000, 0.1);
    this.current = currentTime;
    this.elapsedTime = (this.current - this.start) / 1000;

    this.trigger('animate');

    window.requestAnimationFrame(() => {
      this.animate();
    });
  }
}
