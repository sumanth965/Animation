import Game from './Game/Game.class';
import ResourceLoader from './Game/Utils/ResourceLoader.class';
import ASSETS from './config/assets.js';

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
