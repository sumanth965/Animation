import Game from './Game/Game.class';
import ResourceLoader from './Game/Utils/ResourceLoader.class';
import ASSETS from './config/assets.js';

// Global error handlers for production runtime diagnosis
window.addEventListener('error', (event) => {
  console.error('[Runtime Error]', event.message, event.filename, event.lineno, event.error);
});
window.addEventListener('unhandledrejection', (event) => {
  console.error('[Unhandled Rejection]', event.reason);
});

// Diagnostic Environment Logger
console.log('[Diagnostic] Environment metadata:', {
  userAgent: navigator.userAgent,
  devicePixelRatio: window.devicePixelRatio,
  screenSize: `${window.innerWidth}x${window.innerHeight}`,
  webgl2Supported: (function() {
    try {
      const c = document.createElement('canvas');
      return !!(window.WebGL2RenderingContext && c.getContext('webgl2'));
    } catch (e) { return false; }
  })(),
  webgl1Supported: (function() {
    try {
      const c = document.createElement('canvas');
      return !!(window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl')));
    } catch (e) { return false; }
  })()
});

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

const setSound = (value) => {
  playing = value;
  if (value) {
    bgm.play().catch((err) => {
      console.warn('[Audio] Autoplay blocked or audio load error. User interaction needed:', err);
    });
  } else {
    bgm.pause();
  }
  if (audioLabel) audioLabel.textContent = value ? 'SOUND ON' : 'SOUND OFF';
};
if (audioToggle) audioToggle.addEventListener('click', () => setSound(!playing));

// HTML Background Image Preloader and Fallback Switcher
const bgPrimary = document.getElementById('bg-primary');
const bgFallback = document.getElementById('bg-fallback');
if (bgPrimary) {
  const primaryImg = new Image();
  primaryImg.src = '/assets/textures/hero-bg.jpg';
  primaryImg.onload = () => {
    bgPrimary.style.opacity = '0.85';
  };
  primaryImg.onerror = (err) => {
    console.warn('[Background Preloader] Primary background image notice. Activating fallback overlay...', err);
    if (bgFallback) bgFallback.style.opacity = '0.85';
    if (bgPrimary) bgPrimary.style.opacity = '0';
  };
}

const debugMode = new URLSearchParams(window.location.search).get('mode') === 'debug';
const resources = new ResourceLoader(ASSETS, debugMode);

resources.on('progress', ({ percent }) => {
  if (loaderStatus) loaderStatus.textContent = `LOADING THE DIVE · ${Math.round(percent)}%`;
});

resources.on('error', ({ id }) => {
  console.warn(`[Asset Warning] Optional asset unavailable: ${id}`);
  if (loaderStatus) loaderStatus.textContent = 'PREPARING EXPERIENCE · 100%';
});

resources.on('loaded', () => {
  console.log('[Startup] All assets finished loading. Initializing Three.js Game Engine...');
  if (loaderStatus) loaderStatus.textContent = 'EXPERIENCE READY · 100%';
  if (enterButton) enterButton.disabled = false;

  try {
    const canvasEl = document.getElementById('three');
    if (!canvasEl) throw new Error('Canvas element #three not found in DOM.');
    new Game(canvasEl, resources, debugMode);
    console.log('[Startup] Three.js Game Engine initialized successfully.');
  } catch (err) {
    console.error('[Startup Error] Critical failure during Game engine initialization:', err);
  }
});

if (enterButton) {
  enterButton.addEventListener('click', () => {
    if (loadingScreen) loadingScreen.classList.add('hidden');
    setSound(true);
  });
}

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

