import { EVENT_DATA } from './EventData';
import EventPoint from './EventPoint.class';
import EventInfoPanel from './EventInfoPanel.class';

// Coordinates all event points: projection, nearest-event status and temporary route focus.
export default class EventManager {
  constructor(dolphin) {
    this.dolphin = dolphin;
    this.game = dolphin.game;
    this.selected = null;
    this.current = null;
    this.points = EVENT_DATA.map(data => new EventPoint(data, dolphin, point => this.select(point)));
    this.panel = new EventInfoPanel(() => this.close());
    document.addEventListener('keydown', event => { if (event.key === 'Escape') this.close(); });
  }
  select(point) {
    this.selected = point;
    this.dolphin.focusEvent(point.pathProgress);
    this.points.forEach(item => item.setActive(item === point));
    this.panel.show(point);
  }
  close() {
    if (!this.selected) return;
    this.selected = null;
    this.dolphin.resumeJourney();
    this.points.forEach(item => item.setActive(false));
    this.panel.hide();
  }
  update() {
    const camera = this.game.camera.cameraInstance;
    let nearest = null;
    this.points.forEach(point => {
      point.update(camera);
      if (!nearest || point.distance < nearest.distance) nearest = point;
    });
    // Current event is scene-distance based, so forward and reverse scrolling agree.
    this.current = nearest?.distance < 8 ? nearest : null;
    document.body.dataset.currentEvent = this.current?.id || '';
  }
}
