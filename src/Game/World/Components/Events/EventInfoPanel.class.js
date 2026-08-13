export default class EventInfoPanel {
  constructor(onClose) {
    this.element = document.getElementById('event-panel');
    this.content = document.getElementById('event-panel-content');
    this.element.querySelector('[data-close-event]').addEventListener('click', onClose);
    this.element.addEventListener('click', event => { if (event.target === this.element) onClose(); });
  }
  show(event) {
    this.content.innerHTML = `<img loading="lazy" src="${event.image}" alt="${event.title} event"/><div class="panel-body"><span class="eyebrow">${event.category}</span><h3>${event.title}</h3><p>${event.description}</p><dl><div><dt>DATE</dt><dd>${event.date}</dd></div><div><dt>TIME</dt><dd>${event.time}</dd></div><div><dt>VENUE</dt><dd>${event.venue}</dd></div><div><dt>TEAM</dt><dd>${event.teamSize}</dd></div>${event.prize ? `<div><dt>PRIZE</dt><dd>${event.prize}</dd></div>` : ''}</dl><a class="cta" href="${event.registrationUrl}" aria-label="Register for ${event.title}">REGISTER NOW</a></div>`;
    this.element.classList.add('open'); this.element.setAttribute('aria-hidden', 'false');
  }
  hide() { this.element.classList.remove('open'); this.element.setAttribute('aria-hidden', 'true'); }
}
