import * as THREE from 'three';
import Game from '../../../Game.class';
import { EVENT_DATA } from '../Events/EventData';

// Deliberate, concentric city plan around a central landmark at [0, -12, -35].
// Coordinates follow an S-curve corridor weaving between the left and right sectors.
const EVENT_BUILDINGS = [
  ['code-sprint', -12, -10, 7, 5, 7, 'lab'],
  ['hackathon', 13, -18, 8, 6, 11, 'tower'],
  ['web-design', -14, -26, 6, 5, 9, 'college'],
  ['pixel-play', 13, -34, 8, 7, 12, 'tower'],
  ['pulse', -14, -42, 9, 6, 10, 'auditorium'],
  ['quiz', 13, -50, 6, 5, 8, 'college'],
  ['bandwave', -12, -58, 10, 7, 14, 'tower'],
  ['creative-lab', 11, -65, 7, 5, 9, 'lab'],
  ['frame-by-frame', -9, -71, 7, 5, 10, 'gallery'],
];

const SUPPORT_BUILDINGS = [
  // Left side concentric buildings
  [-19, -12, 5, 5, 12],
  [-20, -20, 6, 5, 8],
  [-22, -30, 5, 5, 17],
  [-22, -40, 6, 4, 12],
  [-20, -50, 5, 5, 12],
  [-18, -60, 4, 4, 7],
  [-15, -68, 5, 5, 12],
  
  // Right side concentric buildings
  [19, -12, 4, 5, 15],
  [20, -22, 5, 5, 7],
  [22, -30, 6, 5, 14],
  [22, -42, 7, 6, 16],
  [20, -52, 6, 5, 14],
  [18, -62, 5, 5, 11],
  [15, -70, 4, 4, 8]
];

// Background skyline placed further away (Z <= -80) in the fog layers
const OVERVIEW_SKYLINE = [
  [-30, -80, 5, 5, 28],
  [-15, -85, 3, 3, 20],
  [0, -90, 4, 4, 25],
  [15, -85, 4, 4, 24],
  [30, -80, 5, 5, 28],
  [-25, -100, 3, 3, 22],
  [25, -100, 3, 3, 22]
];

const TIER_PROFILES = {
  tower:[{h:.5,s:1},{h:.3,s:.74},{h:.2,s:.48}],
  lab:[{h:.74,s:1},{h:.26,s:.8}],
  residential:[{h:.62,s:1},{h:.38,s:.8}],
};

export default class CityManager {
  constructor() {
    this.game = Game.getInstance();
    this.scene = this.game.scene;
    this.time = this.game.time;
    
    // Retrained atmospheric fog to let background towers fade into the depths
    this.scene.fog.near = 70;
    this.scene.fog.far = 220;
    
    this.city = new THREE.Group();
    this.city.name = 'Cyber Ocean Planned Metropolis';
    this.scene.add(this.city);
    
    this.buildings = new Map();
    this.windowMatrices = [];
    this.windowColors = [];
    this.roadGroup = new THREE.Group();
    this.infrastructureGroup = new THREE.Group();
    
    // Refined sandstone/beige materials (matching reference image sandstone and gold look)
    this.baseMaterial = new THREE.MeshStandardMaterial({
      color: 0xede6db, // cream sandstone base
      roughness: 0.75,
      metalness: 0.15
    });
    
    this.glassMaterial = new THREE.MeshStandardMaterial({
      color: 0x5abecf, // turquoise/teal glass
      emissive: 0x0c333a,
      emissiveIntensity: 0.4,
      roughness: 0.1,
      metalness: 0.9,
      transparent: true,
      opacity: 0.55
    });
    
    this.roofMaterial = new THREE.MeshStandardMaterial({
      color: 0x93b7be, // light stone/blue-grey slate
      roughness: 0.4,
      metalness: 0.3
    });
    
    this.applyCaustics(this.baseMaterial);
    this.applyCaustics(this.glassMaterial);
    this.applyCaustics(this.roofMaterial);
    
    this.windowMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff, // warm white/golden vertex window light (mapped via colors)
      vertexColors: true,
      transparent: true,
      opacity: 0.96,
      blending: THREE.AdditiveBlending
    });
    
    this.edgeMaterial = new THREE.LineBasicMaterial({
      color: 0xeedcbd, // soft warm beige lines
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    
    this.mullionMaterial = new THREE.MeshBasicMaterial({
      color: 0xd4af37, // golden/bronze structural accents
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending
    });

    // Build the planned concentric metropolis components
    this.createCentralLandmark();
    this.createEnclosingDome();
    this.createRoad();
    
    EVENT_BUILDINGS.forEach(spec => this.createBuilding(...spec, true));
    SUPPORT_BUILDINGS.forEach((spec,index) => this.createBuilding(`support-${index}`, ...spec, 'residential', false));
    OVERVIEW_SKYLINE.forEach((spec,index) => this.createBuilding(`skyline-${index}`, ...spec, 'tower', false, true));
    
    this.createWindows();
    this.createInfrastructure();
    this.createGroundedEnvironment();
    
    this.city.add(this.roadGroup);
    this.city.add(this.infrastructureGroup);
    this.bindEvents();
    
    if (this.game.isDebugEnabled) this.createDebugBounds();
  }

  createCentralLandmark() {
    const group = new THREE.Group();
    group.name = 'central-landmark';
    group.position.set(0, -12, -35); // City core center
    
    // 1. Double-layered circular stepped base
    const baseGeo1 = new THREE.CylinderGeometry(11, 12, 1.5, 32);
    const base1 = new THREE.Mesh(baseGeo1, this.baseMaterial);
    base1.position.y = 0.75;
    group.add(base1);
    
    const baseGeo2 = new THREE.CylinderGeometry(9, 10, 1.2, 32);
    const base2 = new THREE.Mesh(baseGeo2, this.baseMaterial);
    base2.position.y = 1.5 + 0.6;
    group.add(base2);
    
    // Add glowing circular base accent (golden ring)
    const ringGeo = new THREE.TorusGeometry(9.5, 0.1, 8, 48);
    const ring = new THREE.Mesh(ringGeo, this.mullionMaterial);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 1.5 + 1.2;
    group.add(ring);
    
    // 2. Large central glass festival hall dome
    const domeGeo = new THREE.SphereGeometry(7, 32, 20, 0, Math.PI * 2, 0, Math.PI / 2);
    const dome = new THREE.Mesh(domeGeo, this.glassMaterial);
    dome.position.y = 2.7;
    group.add(dome);
    
    // Add structural metal arches / ribs to the dome
    const domeRibsGroup = new THREE.Group();
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI;
      const ribGeo = new THREE.TorusGeometry(7, 0.08, 6, 32, Math.PI);
      const rib = new THREE.Mesh(ribGeo, this.roofMaterial);
      rib.rotation.y = angle;
      rib.position.y = 2.7;
      domeRibsGroup.add(rib);
    }
    group.add(domeRibsGroup);
    
    // 3. Glowing core energy pillar inside the dome (warm gold/amber glow)
    const coreGeo = new THREE.CylinderGeometry(1.2, 1.2, 4.5, 16);
    const core = new THREE.Mesh(coreGeo, this.mullionMaterial);
    core.position.y = 2.7 + 2.25;
    group.add(core);
    
    // 4. Central tall spire reaching upwards
    const spireGeo = new THREE.CylinderGeometry(0.1, 0.3, 4.5, 8);
    const spire = new THREE.Mesh(spireGeo, this.roofMaterial);
    spire.position.y = 2.7 + 7 + 2.25;
    group.add(spire);
    
    const spireBeacon = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 8), this.mullionMaterial);
    spireBeacon.position.y = 2.7 + 7 + 4.5;
    group.add(spireBeacon);
    group.userData.beacon = spireBeacon; // Flashing beacon target
    
    // Soft cinematic amber/gold light inside the dome
    const domeLight = new THREE.PointLight(0xffb85c, 4.5, 25, 1.2);
    domeLight.position.set(0, 4.5, 0);
    group.add(domeLight);
    
    this.city.add(group);
    this.buildings.set('central-landmark', group);
  }

  createEnclosingDome() {
    // Massive dome enclosing the city (radius 45, centered at [0, -12, -35])
    const domeGeo = new THREE.SphereGeometry(45, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2);
    
    // Light teal/cyan transparent glass material matching reference bubble
    const domeMat = new THREE.MeshStandardMaterial({
      color: 0x8be5f5,
      emissive: 0x082530,
      roughness: 0.05,
      metalness: 0.95,
      transparent: true,
      opacity: 0.18,
      side: THREE.DoubleSide
    });
    const dome = new THREE.Mesh(domeGeo, domeMat);
    dome.position.set(0, -12, -35);
    this.city.add(dome);
    
    // Add structural base ring and meridian ribs
    const domeRings = new THREE.Group();
    const baseRingGeo = new THREE.TorusGeometry(45, 0.3, 8, 64);
    const baseRing = new THREE.Mesh(baseRingGeo, this.baseMaterial);
    baseRing.rotation.x = Math.PI / 2;
    baseRing.position.set(0, -12, -35);
    domeRings.add(baseRing);
    
    // 4 vertical meridian arches mapping classical architecture
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI;
      const archGeo = new THREE.TorusGeometry(45, 0.15, 6, 64, Math.PI);
      const arch = new THREE.Mesh(archGeo, this.baseMaterial);
      arch.rotation.y = angle;
      arch.position.set(0, -12, -35);
      domeRings.add(arch);
    }
    this.city.add(domeRings);
  }

  createRoad() {
    const roadMaterial = new THREE.MeshStandardMaterial({
      color: 0xdfd8cb, // Light warm cream stone road
      transparent: true,
      opacity: 0.9,
      roughness: 0.8,
      metalness: 0.1
    });
    this.applyCaustics(roadMaterial);
    
    // 1. Inner Circular Plaza around the dome base
    const innerPlazaGeo = new THREE.RingGeometry(11, 14, 32);
    const innerPlaza = new THREE.Mesh(innerPlazaGeo, roadMaterial);
    innerPlaza.rotation.x = -Math.PI / 2;
    innerPlaza.position.set(0, -11.9, -35);
    this.roadGroup.add(innerPlaza);
    
    // Inner plaza border golden ring
    const innerRingGeo = new THREE.TorusGeometry(12.5, 0.08, 4, 64);
    const innerRing = new THREE.Mesh(innerRingGeo, this.mullionMaterial);
    innerRing.rotation.x = Math.PI / 2;
    innerRing.position.set(0, -11.85, -35);
    this.roadGroup.add(innerRing);

    // 2. Outer Concentric Plaza Road
    const outerPlazaGeo = new THREE.RingGeometry(22, 24, 32);
    const outerPlaza = new THREE.Mesh(outerPlazaGeo, roadMaterial);
    outerPlaza.rotation.x = -Math.PI / 2;
    outerPlaza.position.set(0, -11.9, -35);
    this.roadGroup.add(outerPlaza);
    
    // Outer plaza border golden ring
    const outerRingGeo = new THREE.TorusGeometry(23, 0.08, 4, 64);
    const outerRing = new THREE.Mesh(outerRingGeo, this.mullionMaterial);
    outerRing.rotation.x = Math.PI / 2;
    outerRing.position.set(0, -11.85, -35);
    this.roadGroup.add(outerRing);
    
    // 3. Radial road corridors connecting inner and outer plazas
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2;
      const roadGeo = new THREE.PlaneGeometry(2.5, 8);
      const radRoad = new THREE.Mesh(roadGeo, roadMaterial);
      radRoad.rotation.x = -Math.PI / 2;
      radRoad.rotation.z = -angle;
      radRoad.position.set(
        Math.cos(angle) * 18,
        -11.88,
        -35 + Math.sin(angle) * 18
      );
      this.roadGroup.add(radRoad);
      
      // Glowing golden lane separator striping
      const stripeGeo = new THREE.PlaneGeometry(0.1, 7.8);
      const stripe = new THREE.Mesh(stripeGeo, this.windowMaterial);
      stripe.rotation.x = -Math.PI / 2;
      stripe.rotation.z = -angle;
      stripe.position.set(
        Math.cos(angle) * 18,
        -11.85,
        -35 + Math.sin(angle) * 18
      );
      this.roadGroup.add(stripe);
    }

    // 4. Glowing golden-streetlights along the concentric plazas
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
      const x = Math.cos(a) * 12.5;
      const z = -35 + Math.sin(a) * 12.5;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.5, 6), this.roofMaterial);
      pole.position.set(x, -10.65, z);
      this.roadGroup.add(pole);
      const orb = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), this.mullionMaterial);
      orb.position.set(x, -9.4, z);
      this.roadGroup.add(orb);
    }
  }

  createInfrastructure() {
    const bridgeMaterial = new THREE.MeshStandardMaterial({
      color: 0xede6db,
      metalness: 0.15,
      roughness: 0.75
    });
    this.applyCaustics(bridgeMaterial);
    
    // Connect left and right districts with high-level bridges passing above the corridors
    const connections = [
      [-14, -26, 13, -34],
      [-14, -42, 13, -50]
    ];
    
    connections.forEach(([x1, z1, x2, z2]) => {
      const dx = x2 - x1;
      const dz = z2 - z1;
      const length = Math.hypot(dx, dz);
      
      // Curved classical arch bridge
      const bridge = new THREE.Mesh(new THREE.BoxGeometry(length, 0.22, 1.2), bridgeMaterial);
      bridge.position.set((x1 + x2) / 2, -4.5, (z1 + z2) / 2);
      bridge.rotation.y = -Math.atan2(dz, dx);
      this.infrastructureGroup.add(bridge);
      
      // Golden safety railings
      const rail = new THREE.Mesh(new THREE.BoxGeometry(length, 0.06, 0.05), this.mullionMaterial);
      rail.position.copy(bridge.position).add(new THREE.Vector3(0, 0.32, 0.55));
      rail.rotation.y = bridge.rotation.y;
      this.infrastructureGroup.add(rail);
    });
  }

  createGroundedEnvironment() {
    // 1. Instanced mesh for rocks around building bases
    const rockGeo = new THREE.DodecahedronGeometry(0.5, 1);
    const rockMat = new THREE.MeshStandardMaterial({
      color: 0xa89984, // warm beige sandstone rock
      roughness: 0.85,
      metalness: 0.2
    });
    this.applyCaustics(rockMat);
    const rockCount = 180;
    this.rocksMesh = new THREE.InstancedMesh(rockGeo, rockMat, rockCount);
    
    // 2. Instanced mesh for organic glowing corals/vegetation
    const coralGeo = new THREE.ConeGeometry(0.18, 0.75, 5);
    const coralMat = new THREE.MeshStandardMaterial({
      color: 0xd4af37, // Golden yellow coral
      emissive: 0x4a3b0a,
      emissiveIntensity: 1.6,
      roughness: 0.6
    });
    const coralCount = 180;
    this.coralsMesh = new THREE.InstancedMesh(coralGeo, coralMat, coralCount);

    // 3. Instanced mesh for organic swaying seaweed/kelp
    const seaweedGeo = new THREE.CylinderGeometry(0.015, 0.14, 3.5, 5, 8);
    seaweedGeo.translate(0, 1.75, 0); // Translate base to Y=0
    const seaweedMat = new THREE.MeshStandardMaterial({
      color: 0x054a32, // Dark forest green base
      roughness: 0.65,
      metalness: 0.1,
      side: THREE.DoubleSide
    });
    this.applySeaweedShader(seaweedMat);
    this.applyCaustics(seaweedMat);
    const seaweedCount = 180;
    this.seaweedMesh = new THREE.InstancedMesh(seaweedGeo, seaweedMat, seaweedCount);
    
    let rockIndex = 0;
    let coralIndex = 0;
    let seaweedIndex = 0;
    const dummy = new THREE.Object3D();
    
    const addBaseClutter = (cx, cz, count) => {
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const radius = 2.8 + Math.random() * 3.5;
        const x = cx + Math.cos(angle) * radius;
        const z = cz + Math.sin(angle) * radius;
        const y = -12;
        
        if (rockIndex < rockCount) {
          dummy.position.set(x, y + 0.15, z);
          const scale = 0.45 + Math.random() * 0.75;
          dummy.scale.set(scale, scale * (0.85 + Math.random() * 0.35), scale);
          dummy.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
          dummy.updateMatrix();
          this.rocksMesh.setMatrixAt(rockIndex++, dummy.matrix);
        }
        
        if (coralIndex < coralCount) {
          dummy.position.set(x + (Math.random() - 0.5) * 0.6, y + 0.25, z + (Math.random() - 0.5) * 0.6);
          const scale = 0.35 + Math.random() * 0.55;
          dummy.scale.set(scale, scale * (1.1 + Math.random() * 0.7), scale);
          dummy.rotation.set((Math.random() - 0.5) * 0.25, Math.random() * Math.PI, (Math.random() - 0.5) * 0.25);
          dummy.updateMatrix();
          this.coralsMesh.setMatrixAt(coralIndex++, dummy.matrix);
        }

        if (seaweedIndex < seaweedCount) {
          dummy.position.set(x + (Math.random() - 0.5) * 0.6, y, z + (Math.random() - 0.5) * 0.6);
          const scale = 0.7 + Math.random() * 0.8;
          dummy.scale.set(scale * 0.6, scale * (0.8 + Math.random() * 0.5), scale * 0.6);
          dummy.rotation.set((Math.random() - 0.5) * 0.15, Math.random() * Math.PI, (Math.random() - 0.5) * 0.15);
          dummy.updateMatrix();
          this.seaweedMesh.setMatrixAt(seaweedIndex++, dummy.matrix);
        }
      }
    };
    
    // Add base details around central landmark
    addBaseClutter(0, -35, 30);
    
    // Add base details around all event buildings
    this.buildings.forEach((building, id) => {
      if (id !== 'central-landmark') {
        addBaseClutter(building.position.x, building.position.z, 12);
      }
    });
    
    this.rocksMesh.instanceMatrix.needsUpdate = true;
    this.coralsMesh.instanceMatrix.needsUpdate = true;
    this.seaweedMesh.instanceMatrix.needsUpdate = true;
    this.city.add(this.rocksMesh);
    this.city.add(this.coralsMesh);
    this.city.add(this.seaweedMesh);
    
    // 3. Golden utility pipes running on the sea floor connecting key districts
    const pipeMaterial = new THREE.MeshStandardMaterial({
      color: 0xbfb6a3,
      roughness: 0.5,
      metalness: 0.8
    });
    
    const pipePoints = [
      [-12, -10, -14, -26], // code-sprint to web-design
      [13, -18, 13, -34],  // hackathon to pixel-play
      [-14, -26, -14, -42], // web-design to pulse
      [13, -34, 13, -50],  // pixel-play to quiz
    ];
    
    pipePoints.forEach(([x1, z1, x2, z2]) => {
      const length = Math.abs(z2 - z1);
      const pipeGeo = new THREE.CylinderGeometry(0.18, 0.18, length, 8);
      const pipe = new THREE.Mesh(pipeGeo, pipeMaterial);
      pipe.rotation.x = Math.PI / 2;
      pipe.position.set((x1 + x2) / 2, -11.8, (z1 + z2) / 2);
      this.infrastructureGroup.add(pipe);
      
      // Glowing coupling collars along the pipe line (golden ring collars)
      for (let offset = -length / 2 + 2; offset < length / 2; offset += 5) {
        const collarGeo = new THREE.TorusGeometry(0.24, 0.04, 6, 12);
        const collar = new THREE.Mesh(collarGeo, this.mullionMaterial);
        collar.position.set((x1 + x2) / 2, -11.8, (z1 + z2) / 2 + offset);
        this.infrastructureGroup.add(collar);
      }
    });
  }

  collectTierWindows(x,z,width,depth,yStart,yEnd,important) {
    const rows=Math.max(2,Math.floor((yEnd-yStart)/1.45)), cols=Math.max(2,Math.floor(width/1.25));
    const lit=new THREE.Color(0xffeebb), dim=new THREE.Color(0x3a3126); // warm yellow glowing windows
    for(let row=0;row<rows;row++) for(let col=0;col<cols;col++) {
      const wy=-12+yStart+(row+.5)*((yEnd-yStart)/rows), wx=(col-(cols-1)/2)*(width/(cols+.4));
      const on=Math.random()<(important ? 0.82 : 0.6), color=lit.clone().lerp(dim,on?Math.random()*0.15:0.75+Math.random()*0.2), matrix=new THREE.Matrix4();
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
    const group = new THREE.Group(); group.name = id; group.position.set(x, -12, z); group.rotation.y=((x*13+z*7)%5)*.018; group.userData = { id, height, x, z, background, reveal: THREE.MathUtils.clamp((-z-4)/58, .05, .96), important };
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
    this.addArchitecturalIdentity(group, type, width, depth, height, topY, important);
    if (type === 'tower') { const antenna=new THREE.Mesh(new THREE.CylinderGeometry(.06,.06,3,6),this.mullionMaterial); antenna.position.y=topY+3; group.add(antenna); const beacon=new THREE.Mesh(new THREE.SphereGeometry(.14,8,8),this.mullionMaterial);beacon.position.y=topY+4.4;group.add(beacon);group.userData.beacon=beacon; }
    if (type === 'college' || type === 'gallery') { for (let side=-1;side<=1;side+=2) { const wing=new THREE.Mesh(new THREE.BoxGeometry(width*.35,height*.48,depth*1.35),this.baseMaterial.clone()); wing.position.set(side*width*.58,height*.24,0); group.add(wing); const edges=new THREE.LineSegments(new THREE.EdgesGeometry(wing.geometry),this.edgeMaterial);edges.position.copy(wing.position);group.add(edges); } }
    if (important) { const inward=x<0?1:-1; const canopy=new THREE.Mesh(new THREE.BoxGeometry(2.2,.18,width*.7),this.mullionMaterial);canopy.position.set(inward*(width/2+1),2.4,0);group.add(canopy); const sign=new THREE.Mesh(new THREE.BoxGeometry(.15,1.4,2.4),this.mullionMaterial);sign.position.set(inward*(width/2+.2),2.2,0);group.add(sign); }
    
    // Buildings are 100% static in world space and fully visible from the start
    group.scale.y=1;
    this.city.add(group);
    this.buildings.set(id,group);
    
    if (important) {
      const light = new THREE.PointLight(0xffb85c, 3.2, 16, 2); // warm orange/gold spotlight
      light.position.set(0, topY + 1, 0); group.add(light); group.userData.light = light; group.userData.lightBase = 3.2;
    }
  }

  addArchitecturalIdentity(group,type,width,depth,height,topY,important) {
    const accent=important ? this.mullionMaterial : this.windowMaterial;
    if (type==='tower') {
      const crown=new THREE.Mesh(new THREE.CylinderGeometry(width*.23,width*.32,1.5,16,1,true),this.glassMaterial);crown.position.y=topY+1.7;group.add(crown);
      const ring=new THREE.Mesh(new THREE.TorusGeometry(width*.32,.055,6,24),accent);ring.rotation.x=Math.PI/2;ring.position.y=topY+2.35;group.add(ring);
    } else if (type==='lab') {
      const capsule=new THREE.Mesh(new THREE.CapsuleGeometry(width*.18,Math.max(1,height*.24),8,12),this.glassMaterial);capsule.position.set(0,height*.57,depth*.53);group.add(capsule);
      const band=new THREE.Mesh(new THREE.TorusGeometry(width*.42,.045,6,24),accent);band.rotation.x=Math.PI/2;band.position.y=height*.6;group.add(band);
    } else if (type==='auditorium') {
      const domeRing=new THREE.Mesh(new THREE.TorusGeometry(width*.57,.075,8,32),accent);domeRing.rotation.x=Math.PI/2;domeRing.position.y=height+.12;group.add(domeRing);
      const spire=new THREE.Mesh(new THREE.ConeGeometry(.22,1.8,8),this.roofMaterial);spire.position.y=height+2;group.add(spire);
    } else if (type==='college' || type==='gallery') {
      const facade=new THREE.Mesh(new THREE.BoxGeometry(width*.58,height*.55,.1),this.glassMaterial);facade.position.set(0,height*.5,depth*.51);group.add(facade);
      for(let y=height*.25;y<height*.9;y+=height*.22){const band=new THREE.Mesh(new THREE.BoxGeometry(width*.64,.045,.08),accent);band.position.set(0,y,depth*.57);group.add(band);}
    } else if (type==='residential') {
      const balcony=new THREE.Mesh(new THREE.BoxGeometry(width*.82,.09,depth*1.06),this.glassMaterial);balcony.position.y=height*.6;group.add(balcony);
    }
    if (important) { const blade=new THREE.Mesh(new THREE.BoxGeometry(.09,Math.min(height*.7,6),.12),this.mullionMaterial);blade.position.set(0,Math.min(height*.4,3.2),depth*.55);group.add(blade); }
  }

  createWindows() {
    const geometry=new THREE.BoxGeometry(1,1,1); this.windows=new THREE.InstancedMesh(geometry,this.windowMaterial,this.windowMatrices.length);
    this.windowMatrices.forEach((matrix,index)=>{this.windows.setMatrixAt(index,matrix);this.windowColors[index] && this.windows.setColorAt(index,this.windowColors[index]);}); this.windows.instanceMatrix.needsUpdate=true; if(this.windows.instanceColor)this.windows.instanceColor.needsUpdate=true;this.windows.frustumCulled=false; this.city.add(this.windows);
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
      building.traverse(child=>{ if(child.isMesh && child.material?.emissive) child.material.emissiveIntensity=active ? 3.4 : (key.startsWith('support') ? 0.35 : 1.05); });
      if (building.userData.light) building.userData.lightBase = active ? 7 : 3.2;
    });
  }

  update() {
    // Keep everything static in world space
    this.roadGroup.visible = true;
    this.infrastructureGroup.visible = true;
    
    this.buildings.forEach(building=>{
      building.scale.y=1;
      building.visible=true;
      if (building.userData.light) building.userData.light.intensity = building.userData.lightBase;
      if (building.userData.beacon) building.userData.beacon.material.opacity=.5+Math.sin(this.time.elapsedTime*3+building.userData.x)*.5;
    });
    
    // Windows animate with time breathing, but are independent of scroll progress
    this.windowMaterial.opacity=(.72+Math.sin(this.time.elapsedTime*1.2)*.2);
    this.debugBounds?.forEach(box=>box.update());
  }

  applyCaustics(material) {
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = { get value() { return Game.getInstance().time.elapsedTime; } };
      
      shader.vertexShader = shader.vertexShader.replace(
        '#include <common>',
        `#include <common>
         varying vec3 vWorldPosition;`
      );
      shader.vertexShader = shader.vertexShader.replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>
         vWorldPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;`
      );
      
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <common>',
        `#include <common>
         uniform float uTime;
         varying vec3 vWorldPosition;`
      );
      
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <dithering_fragment>',
        `#include <dithering_fragment>
         
         // Procedural 2D caustic waves projected along Y (xz plane)
         vec2 causticUV = vWorldPosition.xz * 0.18;
         float causticTime = uTime * 0.75;
         
         float wave1 = sin(causticUV.x * 3.5 + causticTime) * cos(causticUV.y * 3.5 + causticTime);
         float wave2 = sin(causticUV.x * 7.5 - causticTime * 1.3) * cos(causticUV.y * 5.5 + causticTime * 1.6);
         
         float caustics = max(0.0, (wave1 + wave2) * 0.5 + 0.35);
         caustics = pow(caustics, 2.5) * 0.38;
         
         // Water flickering factor
         float flicker = sin(uTime * 1.5 + vWorldPosition.x * 0.08) * 0.12 + 0.88;
         caustics *= flicker;
         
         // Depth attenuation (deeper = weaker caustics)
         float depthFade = clamp((vWorldPosition.y + 12.0) / 25.0, 0.0, 1.0);
         caustics *= depthFade;
         
         // Tint with marine color and apply to diffuse
         gl_FragColor.rgb += vec3(0.2, 0.75, 1.0) * caustics * diffuseColor.rgb;`
      );
    };
  }

  applySeaweedShader(material) {
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = { get value() { return Game.getInstance().time.elapsedTime; } };
      
      shader.vertexShader = shader.vertexShader.replace(
        '#include <common>',
        `#include <common>
         uniform float uTime;
         varying float vHeight;`
      );
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         float heightFactor = clamp(position.y / 3.5, 0.0, 1.0);
         // Wave sway based on height and time
         float sway = sin(uTime * 1.5 + transformed.x * 2.0 + transformed.z * 1.5) * 0.45 * pow(heightFactor, 2.0);
         transformed.x += sway;
         transformed.z += sway * 0.35;
         vHeight = heightFactor;`
      );
      
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <common>',
        `#include <common>
         varying float vHeight;`
      );
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <dithering_fragment>',
        `#include <dithering_fragment>
         // Glow teal at the tips
         vec3 glowColor = vec3(0.08, 0.88, 0.72);
         gl_FragColor.rgb = mix(gl_FragColor.rgb, glowColor, vHeight * 0.75);`
      );
    };
  }
}
