import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import * as THREE from 'three';
import EventEmitter from './EventEmitter.class';

export default class ResourceLoader extends EventEmitter {
  constructor(assets, isDebugMode = false) {
    super();

    this.isDebugMode = isDebugMode;
    this.sources = assets;
    this.items = {};
    this.sourceByUrl = {};
    this.isFinished = false;
    this.debugStatus = {
      backgroundUrl: '',
      textureLoaded: false,
      textureError: 'none',
    };

    this.startTime = performance.now();
    this.criticalLoadedTime = null;
    this.assetMetrics = {};

    this.sources.forEach((src) => {
      const paths = Array.isArray(src.path) ? src.path : [src.path];
      paths.forEach((url) => {
        this.sourceByUrl[url] = src;
      });

      try {
        if (typeof window !== 'undefined') {
          const abs = new URL(paths[0], window.location.href).href;
          this.sourceByUrl[abs] = src;
        }
      } catch (e) {
        console.error('[ResourceLoader] Error adding source by URL:', e);
      }
    });

    this.toLoad = Object.keys(this.sourceByUrl).length;
    this.loaded = 0;

    this.manager = new THREE.LoadingManager();

    this.manager.onProgress = (_url, itemsLoaded, itemsTotal) => {
      let urlKey;
      if (typeof _url === 'string') {
        urlKey = _url;
      } else if (Array.isArray(_url) && _url.length) {
        urlKey = _url[0];
      } else if (_url && typeof _url === 'object') {
        urlKey = _url.url || _url.src || JSON.stringify(_url);
      } else {
        urlKey = String(_url);
      }

      const src = this.sourceByUrl[urlKey];
      const id = src ? src.id : urlKey;
      const file =
        typeof urlKey === 'string' && urlKey.indexOf('/') !== -1
          ? urlKey.substring(urlKey.lastIndexOf('/') + 1)
          : urlKey;

      this.loaded = itemsLoaded;

      this.trigger('progress', {
        id: `${id} - ${file}`,
        itemsLoaded,
        itemsTotal,
        percent: (itemsLoaded / itemsTotal) * 100,
      });
    };

    this.manager.onLoad = () => {
      if (this.isFinished) return;
      this.isFinished = true;
      this.criticalLoadedTime = performance.now() - this.startTime;
      console.log(`[Diagnostic] [ResourceLoader] All critical assets finished in ${this.criticalLoadedTime.toFixed(2)}ms`, this.assetMetrics);
      this.trigger('loaded', {
        itemsLoaded: this.toLoad,
        itemsTotal: this.toLoad,
        percent: 100,
      });
    };

    this.manager.onError = (url) => {
      let urlKey;
      if (typeof url === 'string') urlKey = url;
      else if (Array.isArray(url) && url.length) urlKey = url[0];
      else if (url && typeof url === 'object')
        urlKey = url.url || url.src || JSON.stringify(url);
      else urlKey = String(url);

      const src = this.sourceByUrl[urlKey];
      const id = src ? src.id : urlKey;

      console.error(`[Diagnostic] [ResourceLoader] Load error for asset '${id}' at URL: ${urlKey}`);

      this.trigger('error', {
        id,
        url: urlKey,
        itemsLoaded: this.loaded,
        itemsTotal: this.toLoad,
      });

      // Advance progress counter even on error so loading never hangs
      this.loaded++;
      if (this.loaded >= this.toLoad) {
        setTimeout(() => this.manager.onLoad(), 100);
      }
    };

    this.setLoaders();
    this.initLoading();

    if (this.toLoad === 0) {
      setTimeout(() => this.manager.onLoad(), 0);
    }

    // Fail-safe 4.5 second timeout to guarantee page opens even on slow/broken connections
    setTimeout(() => {
      if (!this.isFinished) {
        console.warn('[Diagnostic] [ResourceLoader] Loading timeout reached (4.5s). Force starting 3D experience...');
        this.manager.onLoad();
      }
    }, 4500);
  }

  setLoaders() {
    this.loaders = {};

    const dracoLoader = new DRACOLoader();
    // Use Google CDN versioned Draco decoders to ensure cross-platform WASM compatibility
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
    this.loaders.dracoLoader = dracoLoader;

    this.loaders.gltfCompressLoader = new GLTFLoader(this.manager);
    this.loaders.gltfCompressLoader.setDRACOLoader(dracoLoader);
    this.loaders.gltfLoader = new GLTFLoader(this.manager);

    this.loaders.textureLoader = new THREE.TextureLoader(this.manager);
    this.loaders.hdriLoader = new HDRLoader(this.manager);
    this.loaders.cubeTextureLoader = new THREE.CubeTextureLoader(this.manager);
  }

  initLoading() {
    for (const source of this.sources) {
      const { type, path, id, fallbackPath } = source;
      const assetStartTime = performance.now();

      // Ensure single-asset loaders receive a string path, not an array
      const isMultiPath = Array.isArray(path);
      const primaryPath = type === 'cubeMap' ? path : (isMultiPath ? path[0] : path);
      const activeFallbackPath = fallbackPath || (isMultiPath && path.length > 1 ? path[1] : null);

      const onLoad = (file) => {
        const duration = performance.now() - assetStartTime;
        this.items[id] = file;
        this.assetMetrics[id] = { status: 'SUCCESS', durationMs: duration.toFixed(2), type, path: primaryPath };
        console.log(`[Diagnostic] [ResourceLoader] Asset '${id}' (${type}) loaded successfully in ${duration.toFixed(2)}ms`);

        if (id === 'heroBackground') {
          this.debugStatus.textureLoaded = true;
          this.debugStatus.textureError = 'none';
        }
      };

      const onError = (err) => {
        const duration = performance.now() - assetStartTime;
        console.warn(`[Diagnostic] [ResourceLoader] Failed loading primary asset '${id}' from '${primaryPath}' after ${duration.toFixed(2)}ms. Error:`, err);
        this.assetMetrics[id] = { status: 'FAILED', durationMs: duration.toFixed(2), type, path: primaryPath, error: err?.message || String(err) };

        if (id === 'heroBackground') {
          this.debugStatus.textureError = `Failed: ${primaryPath}`;
        }
        if (activeFallbackPath) {
          console.log(`[Diagnostic] [ResourceLoader] Attempting fallback asset '${id}' from '${activeFallbackPath}'`);
          if (id === 'heroBackground') {
            this.debugStatus.backgroundUrl = activeFallbackPath;
          }
          this.loaders.textureLoader.load(
            activeFallbackPath,
            (fallbackFile) => {
              this.items[id] = fallbackFile;
              this.assetMetrics[id].status = 'FALLBACK_SUCCESS';
              if (id === 'heroBackground') {
                this.debugStatus.textureLoaded = true;
                this.debugStatus.textureError = `Fallback active (${activeFallbackPath})`;
              }
            },
            undefined,
            (fallbackErr) => {
              console.error(`[Diagnostic] [ResourceLoader] Critical: Fallback asset also failed for '${id}'`, fallbackErr);
              this.assetMetrics[id].status = 'CRITICAL_FAILURE';
              if (id === 'heroBackground') {
                this.debugStatus.textureLoaded = false;
                this.debugStatus.textureError = `Critical: ${fallbackErr?.message || 'Both primary and fallback failed'}`;
              }
            }
          );
        }
      };

      if (id === 'heroBackground') {
        this.debugStatus.backgroundUrl = primaryPath;
      }

      console.log(`[Diagnostic] [ResourceLoader] Requesting asset '${id}' (${type}) path:`, primaryPath);

      switch (type) {
        case 'gltfModelCompressed':
          this.loaders.gltfCompressLoader.load(primaryPath, onLoad, undefined, onError);
          break;
        case 'gltfModel':
          this.loaders.gltfLoader.load(primaryPath, onLoad, undefined, onError);
          break;
        case 'texture':
          this.loaders.textureLoader.load(primaryPath, onLoad, undefined, onError);
          break;
        case 'HDRITexture':
          this.loaders.hdriLoader.load(primaryPath, onLoad, undefined, onError);
          break;
        case 'cubeMap':
          this.loaders.cubeTextureLoader.load(primaryPath, onLoad, undefined, onError);
          break;
        default:
          console.warn(`[Diagnostic] [ResourceLoader] Unknown asset type: ${type}`);
      }
    }
  }
}
