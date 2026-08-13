import * as THREE from 'three';
import Game from '../../../Game.class';
import { EVENT_DATA } from '../Events/EventData';

// Deliberate, fixed city plan. The clear centre lane is the dolphin's swimming street.
const EVENT_BUILDINGS = [
  ['code-sprint', -10, -10, 7, 5, 7, 'lab'], ['hackathon', 10, -17, 8, 6, 11, 'tower'],
  ['web-design', -9, -23, 6, 5, 9, 'college'], ['pixel-play', 10, -29, 8, 7, 12, 'tower'],
  ['pulse', -10, -34, 9, 6, 10, 'auditorium'], ['quiz', 9, -39, 6, 5, 8, 'college'],
  ['bandwave', -11, -44, 10, 7, 14, 'tower'], ['creative-lab', 10, -49, 7, 5, 9, 'lab'],
  ['frame-by-frame', -9, -54, 7, 5, 10, 'gallery'],
];
const SUPPORT_BUILDINGS = [
  [-19,-7,5,5,12], [19,-12,4,5,15], [-18,-18,6,5,8], [18,-25,5,5,7], [-20,-31,5,5,17],
  [20,-37,6,4,12], [-18,-42,4,4,7], [18,-48,7,6,16], [-19,-55,5,5,12], [19,-59,6,5,14],
  [-28,-23,7,6,21], [28,-40,8,7,24], [-29,-53,5,5,18], [29,-16,6,5,19],
];

export default class CityManager {
  constructor() {
    this.game = Game.getInstance(); this.scene = this.game.scene; this.time = this.game.time;
    // Keep the closest city layer legible; fog takes over only as the boulevard recedes.
    this.scene.fog.near = 34; this.scene.fog.far = 130;
    this.city = new THREE.Group(); this.city.name = 'Aurora Underwater Fest City'; this.scene.add(this.city);
    this.buildings = new Map(); this.windowMatrices = [];
    this.baseMaterial = new THREE.MeshStandardMaterial({ color:0x0b2a48, emissive:0x06192f, emissiveIntensity:.78, roughness:.58, metalness:.62, transparent:true, opacity:1 });
    this.roofMaterial = new THREE.MeshStandardMaterial({ color:0x12608a, emissive:0x0b77ad, emissiveIntensity:1.35, roughness:.4, metalness:.5 });
    this.windowMaterial = new THREE.MeshBasicMaterial({ color:0x6cf4ff, transparent:true, opacity:.96, blending:THREE.AdditiveBlending });
    this.createRoad();
    EVENT_BUILDINGS.forEach(spec => this.createBuilding(...spec, true));
    SUPPORT_BUILDINGS.forEach((spec,index) => this.createBuilding(`support-${index}`, ...spec, 'residential', false));
    this.createWindows();
    this.bindEvents();
  }
  createRoad() {
    const road = new THREE.Mesh(new THREE.PlaneGeometry(11, 74), new THREE.MeshStandardMaterial({ color:0x03101f, emissive:0x06355a, emissiveIntensity:.45, transparent:true, opacity:.8, roughness:.9 }));
    road.rotation.x = -Math.PI/2; road.position.set(0,-11.7,-31); this.city.add(road);
    const stripes = new THREE.Group();
    for (let z=-1; z>-66; z-=5) { const stripe = new THREE.Mesh(new THREE.BoxGeometry(.12,.03,2.2), this.windowMaterial); stripe.position.set(0,-11.65,z); stripes.add(stripe); }
    this.city.add(stripes);
  }
  createBuilding(id, x, z, width, depth, height, type, important) {
    const group = new THREE.Group(); group.name = id; group.position.set(x, -12, z); group.userData = { id, height, reveal: THREE.MathUtils.clamp((-z-4)/58, .05, .96), important };
    const base = new THREE.Mesh(new THREE.BoxGeometry(width,height,depth), this.baseMaterial.clone()); base.position.y=height/2; base.castShadow=false; group.add(base); group.userData.base=base;
    const roof = type === 'auditorium'
      ? new THREE.Mesh(new THREE.SphereGeometry(width*.62,16,10,0,Math.PI*2,0,Math.PI/2), this.roofMaterial)
      : new THREE.Mesh(new THREE.CylinderGeometry(width*.34,width*.48, type==='tower'?2.2:1, 6), this.roofMaterial);
    roof.position.y=height+(type==='auditorium'?0:1); group.add(roof);
    if (type === 'tower') { const antenna=new THREE.Mesh(new THREE.CylinderGeometry(.06,.06,3,6),this.windowMaterial); antenna.position.y=height+3; group.add(antenna); }
    if (type === 'college' || type === 'gallery') { for (let side=-1;side<=1;side+=2) { const wing=new THREE.Mesh(new THREE.BoxGeometry(width*.35,height*.48,depth*1.35),this.baseMaterial.clone()); wing.position.set(side*width*.58,height*.24,0); group.add(wing); } }
    // Window transforms are collected and rendered in a single instanced draw call.
    const rows=Math.max(3,Math.floor(height/1.45)), cols=Math.max(2,Math.floor(width/1.25));
    for(let row=1;row<rows;row++) for(let col=0;col<cols;col++) {
      const matrix=new THREE.Matrix4(); const wx=(col-(cols-1)/2)*(width/(cols+.4));
      matrix.compose(new THREE.Vector3(x+wx,-12+row*(height/rows),z-depth/2-.035),new THREE.Quaternion(),new THREE.Vector3(.32,.22,.03)); this.windowMatrices.push(matrix);
      matrix.compose(new THREE.Vector3(x+wx,-12+row*(height/rows),z+depth/2+.035),new THREE.Quaternion(),new THREE.Vector3(.32,.22,.03)); this.windowMatrices.push(matrix);
    }
    group.scale.y=0; this.city.add(group); this.buildings.set(id,group);
    if (important) {
      const light = new THREE.PointLight(0x36dfff, 3.2, 16, 2);
      light.position.set(0, height + 1, 0); group.add(light); group.userData.light = light; group.userData.lightBase = 3.2;
    }
  }
  createWindows() {
    const geometry=new THREE.BoxGeometry(1,1,1); this.windows=new THREE.InstancedMesh(geometry,this.windowMaterial,this.windowMatrices.length);
    this.windowMatrices.forEach((matrix,index)=>this.windows.setMatrixAt(index,matrix)); this.windows.instanceMatrix.needsUpdate=true; this.windows.frustumCulled=false; this.city.add(this.windows);
  }
  bindEvents() {
    EVENT_DATA.forEach(event => { const building=this.buildings.get(event.id); if (building) { event.building=building; event.worldPosition=building.position.clone(); event.markerPosition=building.position.clone().add(new THREE.Vector3(0,building.userData.height+3,0)); } });
  }
  getEventAnchor(id) { return EVENT_DATA.find(event=>event.id===id)?.markerPosition; }
  setSelected(id) {
    this.buildings.forEach((building,key) => {
      const active=key===id;
      building.traverse(child=>{ if(child.isMesh && child.material?.emissive) child.material.emissiveIntensity=active ? 3.4 : (key.startsWith('support') ? .35 : 1.05); });
      if (building.userData.light) building.userData.lightBase = active ? 7 : 3.2;
    });
  }
  update() {
    const progress=this.game.scroll.progress;
    this.buildings.forEach(building=>{
      const local=THREE.MathUtils.smoothstep(progress,Math.max(0,building.userData.reveal-.17),building.userData.reveal+.12);
      building.scale.y=local;
      building.visible=local>.01;
      if (building.userData.light) building.userData.light.intensity = building.userData.lightBase * local;
    });
    this.windowMaterial.opacity=(.72+Math.sin(this.time.elapsedTime*1.2)*.2)*THREE.MathUtils.smoothstep(progress,.04,.18);
  }
}
