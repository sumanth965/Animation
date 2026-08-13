import * as THREE from 'three';
import { worldToScreen } from './WorldToScreen';

/** A single HTML control anchored to a stable world-space event waypoint. */
export default class EventPoint {
  constructor(data, dolphin, onSelect) {
    Object.assign(this, data);
    this.dolphin = dolphin;
    this.waypoint = new THREE.Vector3();
    this.button = document.createElement('button');
    this.button.className = 'event-marker';
    this.button.type = 'button';
    this.button.setAttribute('aria-label', `Open details for ${this.title}`);
    this.button.innerHTML = `<span class="event-marker__icon">i</span><span class="event-marker__label">${this.title}</span>`;
    this.button.addEventListener('click', () => onSelect(this));
    document.getElementById('event-markers').appendChild(this.button);
  }
  update(camera) {
    this.dolphin.path.getWaypoint(this.pathProgress, this.offset, this.waypoint);
    const screen = worldToScreen(this.waypoint, camera, innerWidth, innerHeight);
    this.distance = this.dolphin.dolphin.position.distanceTo(this.waypoint);
    this.proximity = 1 - THREE.MathUtils.smoothstep(this.distance, 4.5, 18);
    // Keep the persistent title area clear; selected points remain available in the panel.
    const overlapsIntro = screen.x < innerWidth * .52 && screen.y > innerHeight * .18 && screen.y < innerHeight * .82;
    const visible = screen.visible && !overlapsIntro && this.proximity > .03;
    this.button.style.transform = `translate3d(${screen.x}px,${screen.y}px,0) translate(-50%,-50%) scale(${.75 + this.proximity * .45})`;
    this.button.style.opacity = visible ? Math.max(.18, this.proximity) : '0';
    this.button.style.pointerEvents = visible ? 'auto' : 'none';
  }
  setActive(active) { this.button.classList.toggle('active', active); }
}
