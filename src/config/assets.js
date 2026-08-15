const ASSETS = [
  {
    id: 'heroBackground',
    type: 'texture',
    priority: 'CRITICAL',
    path: '/assets/textures/hero-bg.jpg',
    fallbackPath: '/assets/textures/hero-bg-fallback.jpg',
  },
  {
    id: 'environmentMapTexture',
    type: 'cubeMap',
    priority: 'CRITICAL',
    path: [
      '/assets/textures/environmentMap/px.png',
      '/assets/textures/environmentMap/nx.png',
      '/assets/textures/environmentMap/py.png',
      '/assets/textures/environmentMap/ny.png',
      '/assets/textures/environmentMap/pz.png',
      '/assets/textures/environmentMap/nz.png',
    ],
  },
  {
    id: 'dolphinAnimatedModel',
    type: 'gltfModelCompressed',
    priority: 'CRITICAL',
    path: '/assets/models/dolphin_anim.glb',
  },
];

export default ASSETS;
