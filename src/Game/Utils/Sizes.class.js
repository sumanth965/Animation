import EventEmitter from './EventEmitter.class';

export default class Sizes extends EventEmitter {
  constructor() {
    super();

    this.width = window.innerWidth;
    this.height = window.innerHeight;
    // Keep the post-processed hero smooth on high-DPI screens.
    this.pixelRatio = Math.min(window.devicePixelRatio, 1.5);

    window.addEventListener('resize', () => {
      this.width = window.innerWidth;
      this.height = window.innerHeight;
      this.pixelRatio = Math.min(window.devicePixelRatio, 1.5);

      this.trigger('resize');
    });
  }
}
