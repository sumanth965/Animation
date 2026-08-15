import Game from './Game/Game.class';
import ResourceLoader from './Game/Utils/ResourceLoader.class';
import ASSETS from './config/assets.js';

// Always enter the experience from its authored opening frame, not a browser-restored scroll offset.
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
window.scrollTo(0, 0);
window.addEventListener('pageshow', () => window.scrollTo(0, 0), { once: true });

const loadingScreen = document.getElementById('loading-screen');
const loaderStatus = document.getElementById('loader-status');
const enterButton = document.getElementById('enter-experience');
const audioToggle = document.getElementById('audio-toggle');
const audioLabel = document.getElementById('audio-label');
const bgm = new Audio('/assets/audio/bgm.mp3');
bgm.loop = true; bgm.volume = .38;
let playing = false;
const setSound = (value) => { playing = value; value ? bgm.play().catch(() => {}) : bgm.pause(); audioLabel.textContent = value ? 'SOUND ON' : 'SOUND OFF'; };
audioToggle.addEventListener('click', () => setSound(!playing));

const resources = new ResourceLoader(ASSETS);
resources.on('progress', ({ percent }) => { loaderStatus.textContent = `LOADING THE DIVE · ${Math.round(percent)}%`; });
resources.on('error', ({ id }) => { console.warn(`Fest asset unavailable: ${id}`); loaderStatus.textContent = 'PREPARING EXPERIENCE · 100%'; });
resources.on('loaded', () => {
  loaderStatus.textContent = 'EXPERIENCE READY · 100%';
  enterButton.disabled = false;
  const debugMode = new URLSearchParams(window.location.search).get('mode') === 'debug';
  new Game(document.getElementById('three'), resources, debugMode);
});
enterButton.addEventListener('click', () => { loadingScreen.classList.add('hidden'); setSound(true); });

// Chapter dots are intentional scroll affordances, not separate navigation states.
document.querySelectorAll('[data-rail]').forEach((dot, index) => dot.addEventListener('click', () => {
  document.querySelectorAll('[data-chapter]')[index]?.scrollIntoView({ behavior: 'smooth' });
}));

// Footer navigation & CTA handlers
document.getElementById('nav-overview')?.addEventListener('click', (e) => {
  e.preventDefault();
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

document.getElementById('nav-exhibits')?.addEventListener('click', (e) => {
  e.preventDefault();
  const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
  window.scrollTo({ top: maxScroll * 0.35, behavior: 'smooth' });
});

document.getElementById('nav-events')?.addEventListener('click', (e) => {
  e.preventDefault();
  const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
  window.scrollTo({ top: maxScroll * 0.65, behavior: 'smooth' });
});

document.getElementById('nav-register')?.addEventListener('click', (e) => {
  e.preventDefault();
  const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
  window.scrollTo({ top: maxScroll, behavior: 'smooth' });
});

document.getElementById('footer-cta')?.addEventListener('click', (e) => {
  e.preventDefault();
  const toast = document.createElement('div');
  toast.className = 'hud-toast';
  toast.textContent = 'REGISTRATION IS ONLINE FOR SEMAPHORE ’26! WELCOME ABOARD.';
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 400);
    }, 3500);
  }, 50);
});

