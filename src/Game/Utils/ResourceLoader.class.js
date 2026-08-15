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

      console.error(`[ResourceLoader] Load error for asset ${id} at URL: ${urlKey}`);

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
        console.warn('[ResourceLoader] Loading timeout reached. Force starting 3D experience...');
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

      const onLoad = (file) => {
        this.items[id] = file;
        if (id === 'heroBackground') {
          this.debugStatus.textureLoaded = true;
          this.debugStatus.textureError = 'none';
        }
      };

      const onError = (err) => {
        console.warn(`[ResourceLoader] Failed loading primary asset '${id}' from '${path}'. Attempting fallback...`, err);
        if (id === 'heroBackground') {
          this.debugStatus.textureError = `Failed: ${path}`;
        }
        if (fallbackPath) {
          if (this.isDebugMode) {
            console.log(`[ResourceLoader] Loading fallback asset '${id}' from '${fallbackPath}'`);
          }
          if (id === 'heroBackground') {
            this.debugStatus.backgroundUrl = fallbackPath;
          }
          this.loaders.textureLoader.load(
            fallbackPath,
            (fallbackFile) => {
              this.items[id] = fallbackFile;
              if (id === 'heroBackground') {
                this.debugStatus.textureLoaded = true;
                this.debugStatus.textureError = `Fallback active (${fallbackPath})`;
              }
            },
            undefined,
            (fallbackErr) => {
              console.error(`[ResourceLoader] Critical: Fallback asset also failed for '${id}'`, fallbackErr);
              if (id === 'heroBackground') {
                this.debugStatus.textureLoaded = false;
                this.debugStatus.textureError = `Critical: ${fallbackErr?.message || 'Both primary and fallback failed'}`;
              }
            }
          );
        }
      };

      if (id === 'heroBackground') {
        this.debugStatus.backgroundUrl = path;
      }

      if (this.isDebugMode) {
        console.log(`[ResourceLoader] Loading asset '${id}' (${type}) from URL:`, path);
      }

      switch (type) {
        case 'gltfModelCompressed':
          this.loaders.gltfCompressLoader.load(path, onLoad, undefined, onError);
          break;
        case 'gltfModel':
          this.loaders.gltfLoader.load(path, onLoad, undefined, onError);
          break;
        case 'texture':
          this.loaders.textureLoader.load(path, onLoad, undefined, onError);
          break;
        case 'HDRITexture':
          this.loaders.hdriLoader.load(path, onLoad, undefined, onError);
          break;
        case 'cubeMap':
          this.loaders.cubeTextureLoader.load(path, onLoad, undefined, onError);
          break;
        default:
          console.warn(`[ResourceLoader] Unknown asset type: ${type}`);
      }
    }
  }
}
