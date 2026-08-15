import * as THREE from 'three';
import Game from '../../../Game.class';

export default class Lighting {
  constructor({ helperEnabled = false } = {}) {
    this.game = Game.getInstance();
    this.scene = this.game.scene;
    this.resources = this.game.resources;
    this.helperEnabled = helperEnabled;

    this.setThreeDirectionalLights();
    this.setEnvironmentMapInstance();
    this.createLightRays();
  }

  setThreeDirectionalLights() {
    // Key light: Teal/cyan highlight from the front-right
    this.keyLight = new THREE.DirectionalLight(0x5beefc, 2.0);
    this.keyLight.position.set(15, 25, 20);
    this.keyLight.castShadow = true;
    this.keyLight.shadow.mapSize.set(1024, 1024);
    this.scene.add(this.keyLight);

    // Fill light: front-left fill
    this.fillLight = new THREE.DirectionalLight(0x2a6080, 1.0);
    this.fillLight.position.set(-15, 10, 15);
    this.scene.add(this.fillLight);

    // Back (rim) light: warm gold rim highlight from behind the building
    this.backLight = new THREE.DirectionalLight(0xffdfa9, 1.5);
    this.backLight.position.set(0, 15, -45);
    this.scene.add(this.backLight);

    // Ambient light: soft blue/teal ambient fill
    this.ambientLight = new THREE.AmbientLight(0x0a1d33, 0.8);
    this.scene.add(this.ambientLight);

    if (this.helperEnabled) {
      this.scene.add(new THREE.DirectionalLightHelper(this.keyLight, 0.5));
      this.scene.add(new THREE.DirectionalLightHelper(this.fillLight, 0.5));
      this.scene.add(new THREE.DirectionalLightHelper(this.backLight, 0.5));
    }
  }

  setEnvironmentMapInstance() {
    this.environmentMap = {
      intensity: 1.5,
      texture: this.resources.items.environmentMapTexture,
      updateMaterials: () => {
        this.scene.traverse((child) => {
          if (
            child instanceof THREE.Mesh &&
            child.material instanceof THREE.MeshStandardMaterial
          ) {
            child.material.envMap = this.environmentMap.texture;
            child.material.envMapIntensity = this.environmentMap.intensity;
            child.material.needsUpdate = true;
          }
        });
      },
    };

    // Ensure correct color space
    this.environmentMap.texture.colorSpace = THREE.SRGBColorSpace;
    this.environmentMap.updateMaterials();
    this.scene.environment = this.environmentMap.texture;
  }

  createLightRays() {
    const rayVertexShader = `
      varying vec2 vUv;
      varying float vDepth;
      void main() {
        vUv = uv;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vDepth = -mvPosition.z;
        gl_Position = projectionMatrix * mvPosition;
      }
    `;

    const rayFragmentShader = `
      uniform float uTime;
      uniform vec3 uColor;
      uniform float uOpacity;
      varying vec2 vUv;
      varying float vDepth;

      void main() {
        // High frequency scrolling noise approximation for shifting shafts of light
        float ray1 = sin(vUv.x * 14.0 + uTime * 0.35) * 0.5 + 0.5;
        float ray2 = cos(vUv.x * 26.0 - uTime * 0.55) * 0.5 + 0.5;
        float rays = mix(ray1, ray2, 0.55);

        // Soft borders
        float edgeFade = sin(vUv.x * 3.14159);
        float bottomFade = 1.0 - vUv.y;
        bottomFade = pow(bottomFade, 1.6);

        float finalAlpha = rays * edgeFade * bottomFade * uOpacity;

        // Apply ocean fog attenuation
        float fogFactor = smoothstep(15.0, 160.0, vDepth);
        finalAlpha *= (1.0 - fogFactor);

        gl_FragColor = vec4(uColor, finalAlpha);
      }
    `;

    this.rayMaterial = new THREE.ShaderMaterial({
      vertexShader: rayVertexShader,
      fragmentShader: rayFragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new THREE.Color(0x6eefff) },
        uOpacity: { value: 0 }
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide
    });

    this.lightRays = new THREE.Group();
    this.lightRays.name = 'SunlightRays';

    const rayGeo = new THREE.PlaneGeometry(90, 150);
    // Create 3 parallel angled shafts of light
    for (let i = 0; i < 3; i++) {
      const rayMesh = new THREE.Mesh(rayGeo, this.rayMaterial);
      rayMesh.position.set(-20 + i * 20, 35, -5 - i * 30);
      rayMesh.rotation.x = Math.PI / 3.4; // Tilt down
      rayMesh.rotation.y = Math.PI / 14;  // Slight angle
      this.lightRays.add(rayMesh);
    }

    this.scene.add(this.lightRays);
  }

  update() {
    this.rayMaterial.uniforms.uTime.value = this.game.time.elapsedTime;
    const progress = this.game.scroll.progress;
    // Gradually fade rays in from 0.0 to 0.45 scroll progress, reaching max opacity of 0.28
    this.rayMaterial.uniforms.uOpacity.value = THREE.MathUtils.smoothstep(progress, 0.0, 0.45) * 0.28;
  }
}
