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
// Background skyline: visible in the opening overview, safely beyond the swimming corridor.
const OVERVIEW_SKYLINE = [
  [-12,-70,4,4,18],[-6,-76,3,3,23],[0,-72,4,4,20],[6,-78,3,3,26],
  [12,-74,4,4,24],[-16,-84,5,5,28],[-4,-90,3,3,20],[5,-88,4,4,25],
];
const TIER_PROFILES = {
  tower:[{h:.5,s:1},{h:.3,s:.74},{h:.2,s:.48}],
  lab:[{h:.74,s:1},{h:.26,s:.8}],
  residential:[{h:.62,s:1},{h:.38,s:.8}],
};

export default class CityManager {
  constructor() {
    this.game = Game.getInstance(); this.scene = this.game.scene; this.time = this.game.time;
    // Keep the closest city layer legible; fog takes over only as the boulevard recedes.
    this.scene.fog.near = 34; this.scene.fog.far = 130;
    this.city = new THREE.Group(); this.city.name = 'Aurora Underwater Fest City'; this.scene.add(this.city);
    this.buildings = new Map(); this.windowMatrices = []; this.windowColors = [];
    this.baseMaterial = new THREE.MeshStandardMaterial({ color:0x0b2a48, emissive:0x06192f, emissiveIntensity:.78, roughness:.58, metalness:.62, transparent:true, opacity:1 });
    this.roofMaterial = new THREE.MeshStandardMaterial({ color:0x12608a, emissive:0x0b77ad, emissiveIntensity:1.35, roughness:.4, metalness:.5 });
    this.windowMaterial = new THREE.MeshBasicMaterial({ color:0xffffff, vertexColors:true, transparent:true, opacity:.96, blending:THREE.AdditiveBlending });
    this.edgeMaterial = new THREE.LineBasicMaterial({ color:0x4be8ff, transparent:true, opacity:.55, blending:THREE.AdditiveBlending, depthWrite:false });
    this.mullionMaterial = new THREE.MeshBasicMaterial({ color:0x2fd6ff, transparent:true, opacity:.85, blending:THREE.AdditiveBlending });
    this.createRoad();
    EVENT_BUILDINGS.forEach(spec => this.createBuilding(...spec, true));
    SUPPORT_BUILDINGS.forEach((spec,index) => this.createBuilding(`support-${index}`, ...spec, 'residential', false));
    OVERVIEW_SKYLINE.forEach((spec,index) => this.createBuilding(`skyline-${index}`, ...spec, 'tower', false, true));
    this.createWindows();
    this.bindEvents();
    if (this.game.isDebugEnabled) this.createDebugBounds();
  }
  createRoad() {
    const road = new THREE.Mesh(new THREE.PlaneGeometry(11, 74), new THREE.MeshStandardMaterial({ color:0x03101f, emissive:0x06355a, emissiveIntensity:.45, transparent:true, opacity:.8, roughness:.9 }));
    road.rotation.x = -Math.PI/2; road.position.set(0,-11.7,-31); this.city.add(road);
    const stripes = new THREE.Group();
    for (let z=-1; z>-66; z-=5) { const stripe = new THREE.Mesh(new THREE.BoxGeometry(.12,.03,2.2), this.windowMaterial); stripe.position.set(0,-11.65,z); stripes.add(stripe); }
    this.city.add(stripes);
    const streetlights = new THREE.Group();
    for (let z=-2;z>-64;z-=8) for (const side of [-1,1]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(.05,.05,3.4,6),this.roofMaterial); pole.position.set(side*7,-10,z); streetlights.add(pole);
      const orb = new THREE.Mesh(new THREE.SphereGeometry(.16,8,8),this.mullionMaterial); orb.position.set(side*7,-8.3,z); streetlights.add(orb);
    }
    this.city.add(streetlights);
  }
  collectTierWindows(x,z,width,depth,yStart,yEnd,important) {
    const rows=Math.max(2,Math.floor((yEnd-yStart)/1.45)), cols=Math.max(2,Math.floor(width/1.25));
    const lit=new THREE.Color(0x6cf4ff), dim=new THREE.Color(0x0d2f4a);
    for(let row=0;row<rows;row++) for(let col=0;col<cols;col++) {
      const wy=-12+yStart+(row+.5)*((yEnd-yStart)/rows), wx=(col-(cols-1)/2)*(width/(cols+.4));
      const on=Math.random()<(important ? .82 : .6), color=lit.clone().lerp(dim,on?Math.random()*.15:.75+Math.random()*.2), matrix=new THREE.Matrix4();
      matrix.compose(new THREE.Vector3(x+wx,wy,z-depth/2-.035),new THREE.Quaternion(),new THREE.Vector3(.32,.22,.03)); this.windowMatrices.push(matrix);this.windowColors.push(color.clone());
      matrix.compose(new THREE.Vector3(x+wx,wy,z+depth/2+.035),new THREE.Quaternion(),new THREE.Vector3(.32,.22,.03)); this.windowMatrices.push(matrix);this.windowColors.push(color.clone());
    }
  }
  buildTieredMass(group,width,depth,height,type) {
    let y=0, topWidth=width;
    TIER_PROFILES[type].forEach(tier=>{
      const h=height*tier.h,w=width*tier.s,d=depth*tier.s, mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),this.baseMaterial.clone());
      mesh.position.y=y+h/2;group.add(mesh);
      const edges=new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry),this.edgeMaterial);edges.position.copy(mesh.position);group.add(edges);
      [[-1,-1],[1,-1],[1,1],[-1,1]].forEach(([cx,cz])=>{const m=new THREE.Mesh(new THREE.BoxGeometry(.07,h*.97,.07),this.mullionMaterial);m.position.set(cx*w/2,mesh.position.y,cz*d/2);group.add(m);});
      this.collectTierWindows(group.userData.x,group.userData.z,w,d,y,y+h,group.userData.important); y+=h;topWidth=w;
    });
    return {topY:y,topWidth};
  }
  createBuilding(id, x, z, width, depth, height, type, important, background = false) {
    const group = new THREE.Group(); group.name = id; group.position.set(x, -12, z); group.userData = { id, height, x, z, background, reveal: THREE.MathUtils.clamp((-z-4)/58, .05, .96), important };
    let topY=height, topWidth=width;
    if (TIER_PROFILES[type]) {
      const result=this.buildTieredMass(group,width,depth,height,type); topY=result.topY;topWidth=result.topWidth;
    } else {
      const base = new THREE.Mesh(new THREE.BoxGeometry(width,height,depth), this.baseMaterial.clone()); base.position.y=height/2; group.add(base);
      const edges=new THREE.LineSegments(new THREE.EdgesGeometry(base.geometry),this.edgeMaterial);edges.position.copy(base.position);group.add(edges);
      this.collectTierWindows(x,z,width,depth,0,height,important);
    }
    const roof = type === 'auditorium'
      ? new THREE.Mesh(new THREE.SphereGeometry(width*.62,16,10,0,Math.PI*2,0,Math.PI/2), this.roofMaterial)
      : new THREE.Mesh(new THREE.CylinderGeometry(topWidth*.34,topWidth*.48, type==='tower'?2.2:1, 6), this.roofMaterial);
    roof.position.y=topY+(type==='auditorium'?0:1); group.add(roof);
    if (type === 'tower') { const antenna=new THREE.Mesh(new THREE.CylinderGeometry(.06,.06,3,6),this.mullionMaterial); antenna.position.y=topY+3; group.add(antenna); const beacon=new THREE.Mesh(new THREE.SphereGeometry(.14,8,8),this.mullionMaterial);beacon.position.y=topY+4.4;group.add(beacon);group.userData.beacon=beacon; }
    if (type === 'college' || type === 'gallery') { for (let side=-1;side<=1;side+=2) { const wing=new THREE.Mesh(new THREE.BoxGeometry(width*.35,height*.48,depth*1.35),this.baseMaterial.clone()); wing.position.set(side*width*.58,height*.24,0); group.add(wing); const edges=new THREE.LineSegments(new THREE.EdgesGeometry(wing.geometry),this.edgeMaterial);edges.position.copy(wing.position);group.add(edges); } }
    if (important) { const inward=x<0?1:-1; const canopy=new THREE.Mesh(new THREE.BoxGeometry(2.2,.18,width*.7),this.mullionMaterial);canopy.position.set(inward*(width/2+1),2.4,0);group.add(canopy); const sign=new THREE.Mesh(new THREE.BoxGeometry(.15,1.4,2.4),this.mullionMaterial);sign.position.set(inward*(width/2+.2),2.2,0);group.add(sign); }
    // The city is already present in the opening skyline; scrolling completes its assembly.
    group.scale.y=background ? .55 : .36; this.city.add(group); this.buildings.set(id,group);
    if (important) {
      const light = new THREE.PointLight(0x36dfff, 3.2, 16, 2);
      light.position.set(0, topY + 1, 0); group.add(light); group.userData.light = light; group.userData.lightBase = 3.2;
    }
  }
  createWindows() {
    const geometry=new THREE.BoxGeometry(1,1,1); this.windows=new THREE.InstancedMesh(geometry,this.windowMaterial,this.windowMatrices.length);
    this.windowMatrices.forEach((matrix,index)=>{this.windows.setMatrixAt(index,matrix);this.windows.setColorAt(index,this.windowColors[index]);}); this.windows.instanceMatrix.needsUpdate=true; if(this.windows.instanceColor)this.windows.instanceColor.needsUpdate=true;this.windows.frustumCulled=false; this.city.add(this.windows);
  }
  bindEvents() {
    EVENT_DATA.forEach(event => { const building=this.buildings.get(event.id); if (building) { event.building=building; event.worldPosition=building.position.clone(); event.markerPosition=building.position.clone().add(new THREE.Vector3(0,Math.min(building.userData.height*.62,8),0)); } });
  }
  getEventAnchor(id) { return EVENT_DATA.find(event=>event.id===id)?.markerPosition; }
  createDebugBounds() {
    this.debugBounds=[];
    this.buildings.forEach(building=>{ const box=new THREE.BoxHelper(building,0x507d92); this.city.add(box); this.debugBounds.push(box); });
  }
  setSelected(id) {
    this.buildings.forEach((building,key) => {
      const active=key===id;
      building.traverse(child=>{ if(child.isMesh && child.material?.emissive) child.material.emissiveIntensity=active ? 3.4 : (key.startsWith('support') ? .35 : 1.05); });
      if (building.userData.light) building.userData.lightBase = active ? 7 : 3.2;
    });
  }
  update() {
    if (this.game.scroll.isSettled && this._settledOnce) return;
    const progress=this.game.scroll.progress;
    this.buildings.forEach(building=>{
      const assembled=THREE.MathUtils.smoothstep(progress,Math.max(0,building.userData.reveal-.17),building.userData.reveal+.12);
      const local=(building.userData.background ? .55 : .36)+(building.userData.background ? .45 : .64)*assembled;
      building.scale.y=local;
      building.visible=local>.01;
      if (building.userData.light) building.userData.light.intensity = building.userData.lightBase * local;
      if (building.userData.beacon) building.userData.beacon.material.opacity=.5+Math.sin(this.time.elapsedTime*3+building.userData.x)*.5;
    });
    this.windowMaterial.opacity=(.72+Math.sin(this.time.elapsedTime*1.2)*.2)*THREE.MathUtils.smoothstep(progress,.04,.18);
    this.debugBounds?.forEach(box=>box.update());
    this._settledOnce = this.game.scroll.isSettled;
  }
}
