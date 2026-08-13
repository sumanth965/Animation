import * as THREE from 'three';
import Game from '../../../Game.class';
import vertexShader from '../../../../Shaders/Building/vertex.glsl';
import fragmentShader from '../../../../Shaders/Building/fragment.glsl';

// A deterministic, scroll-reversible particle architecture landmark.
export default class Building {
  constructor({ floors = 18, floorHeight = 1.05, width = 8, depth = 8, seaFloorY = -12 } = {}) {
    this.game = Game.getInstance();
    this.scene = this.game.scene;
    this.time = this.game.time;
    this.floors = floors; this.floorHeight = floorHeight; this.width = width; this.depth = depth; this.seaFloorY = seaFloorY;
    this.create();
  }
  create() {
    const positions = [], floor = [], random = [], edge = [];
    const linePositions = [], lineFloor = [], lineRandom = [], lineEdge = [];
    const add = (x, z, level, isEdge) => { positions.push(x, 0, z); floor.push(level); random.push(Math.random()); edge.push(isEdge); };
    const addLine = (x1, z1, f1, x2, z2, f2) => {
      linePositions.push(x1, 0, z1, x2, 0, z2);
      lineFloor.push(f1, f2); lineRandom.push(Math.random(), Math.random()); lineEdge.push(1, 1);
    };
    const corners = [[-this.width/2,-this.depth/2],[this.width/2,-this.depth/2],[this.width/2,this.depth/2],[-this.width/2,this.depth/2]];
    corners.forEach(([x,z]) => {
      for (let f=0; f<=this.floors; f++) {
        add(x,z,f/this.floors,1);
        if (f > 0) addLine(x,z,(f-1)/this.floors,x,z,f/this.floors);
      }
    });
    // Ring samples create the readable architectural silhouette with almost no geometry cost.
    for (let f=0; f<=this.floors; f+=3) for (let s=0; s<28; s++) {
      const a=s/28*Math.PI*2, b=((s+1)%28)/28*Math.PI*2, level=f/this.floors;
      add(Math.cos(a)*this.width/2,Math.sin(a)*this.depth/2,level,1);
      addLine(Math.cos(a)*this.width/2,Math.sin(a)*this.depth/2,level,Math.cos(b)*this.width/2,Math.sin(b)*this.depth/2,level);
    }
    const particleCount = innerWidth < 768 ? 500 : 1300;
    for (let i=0; i<particleCount; i++) {
      const t=Math.random(), side=Math.floor(Math.random()*4), along=Math.random()-.5;
      const x = side < 2 ? along*this.width : (side === 2 ? -this.width/2 : this.width/2);
      const z = side < 2 ? (side === 0 ? -this.depth/2 : this.depth/2) : along*this.depth;
      add(x,z,t,0);
    }
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    this.geometry.setAttribute('aFloor',new THREE.Float32BufferAttribute(floor,1));
    this.geometry.setAttribute('aRandom',new THREE.Float32BufferAttribute(random,1));
    this.geometry.setAttribute('aEdge',new THREE.Float32BufferAttribute(edge,1));
    this.material = new THREE.ShaderMaterial({ vertexShader, fragmentShader, transparent:true, depthWrite:false, blending:THREE.AdditiveBlending, uniforms:{ uProgress:{value:0},uTime:{value:0},uSeaFloorY:{value:this.seaFloorY},uBuildingHeight:{value:this.floors*this.floorHeight},uStagger:{value:.58},uColorCore:{value:new THREE.Color(0x26e6ff)},uColorEdge:{value:new THREE.Color(0x0d4d99)},uOpacity:{value:.9} } });
    this.mesh = new THREE.Points(this.geometry,this.material);
    this.lineGeometry = new THREE.BufferGeometry();
    this.lineGeometry.setAttribute('position',new THREE.Float32BufferAttribute(linePositions,3));
    this.lineGeometry.setAttribute('aFloor',new THREE.Float32BufferAttribute(lineFloor,1));
    this.lineGeometry.setAttribute('aRandom',new THREE.Float32BufferAttribute(lineRandom,1));
    this.lineGeometry.setAttribute('aEdge',new THREE.Float32BufferAttribute(lineEdge,1));
    this.lineMaterial = this.material.clone();
    this.lines = new THREE.LineSegments(this.lineGeometry, this.lineMaterial);
    // Its place is centered in the mid-route orbit, directly in the camera's forward travel line.
    this.mesh.position.set(0,0,-26);
    this.lines.position.copy(this.mesh.position);
    this.mesh.frustumCulled = false;
    this.lines.frustumCulled = false;
    this.scene.add(this.mesh, this.lines);
  }
  update() {
    const p = this.game.scroll.progress;
    // Build only through the middle chapter, and exactly reverse when users scroll back.
    this.material.uniforms.uProgress.value = THREE.MathUtils.smoothstep(p,.23,.72);
    this.material.uniforms.uTime.value = this.time.elapsedTime;
    this.lineMaterial.uniforms.uProgress.value = this.material.uniforms.uProgress.value;
    this.lineMaterial.uniforms.uTime.value = this.time.elapsedTime;
  }
  dispose() { this.geometry.dispose(); this.lineGeometry.dispose(); this.material.dispose(); this.lineMaterial.dispose(); this.scene.remove(this.mesh, this.lines); }
}
