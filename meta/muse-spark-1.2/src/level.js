import * as THREE from 'three';
import { CONFIG } from './config.js';

// 雨涵的程序化关卡 保证可通过 啪嗒啪嗒排好
const LANE_X=[-3.2,0,3.2];

function pick(arr){ return arr[Math.floor(Math.random()*arr.length)]; }
function rand(min,max){ return min+Math.random()*(max-min); }

export class Level{
  constructor(scene){
    this.scene=scene;
    this.chunks=[];
    this.poolObstacles=[];
    this.poolCoins=[];
    this.poolDecor=[];
    this.nextZ=-CONFIG.chunkLen*2;
    this.theme='city'; // city / cave / sky
    this.themeTimer=0;
    this.difficulty=0;
    this.superMode=false; this.crossMode=false;

    // ground material variants
    this.matGroundCity=new THREE.MeshStandardMaterial({color:0x1a1a3a, roughness:0.85, metalness:0.05});
    this.matGroundSuper=new THREE.MeshStandardMaterial({color:0xffd54f, roughness:0.6, emissive:0xff8a00, emissiveIntensity:0.18});
    this.matGroundCross=new THREE.MeshStandardMaterial({color:0x0f1a33, roughness:0.7, emissive:0x00aaff, emissiveIntensity:0.22});
    this.matGroundCave=new THREE.MeshStandardMaterial({color:0x1e1a24, roughness:0.9});

    // obstacle materials
    this.matSpike=new THREE.MeshStandardMaterial({color:0xff3b5a, emissive:0xff1040, emissiveIntensity:0.35, roughness:0.6});
    this.matGate=new THREE.MeshStandardMaterial({color:0x2a3a8a, emissive:0x00aaff, emissiveIntensity:0.25});
    this.matPillar=new THREE.MeshStandardMaterial({color:0x5a4a6a, roughness:0.8});
    this.matMonster=new THREE.MeshStandardMaterial({color:0x3dd68c, emissive:0x0a8a4a, emissiveIntensity:0.3});

    // coin geo
    this.coinGeo=new THREE.CylinderGeometry(0.38,0.38,0.08,12); this.coinGeo.rotateZ(Math.PI/2);
    this.coinMat=new THREE.MeshStandardMaterial({color:0xffd54f, emissive:0xffb300, emissiveIntensity:0.55, metalness:0.6, roughness:0.3});
    this.coinMatSuper=new THREE.MeshStandardMaterial({color:0xfff2a0, emissive:0xffffff, emissiveIntensity:0.6, metalness:0.5, roughness:0.2});
    this.magnetMat=new THREE.MeshStandardMaterial({color:0x00e5ff, emissive:0x00aaff, emissiveIntensity:0.8});
    this.shieldMat=new THREE.MeshStandardMaterial({color:0xffd54f, emissive:0xffaa00, emissiveIntensity:0.7});
    this.dashMat=new THREE.MeshStandardMaterial({color:0xff3b9a, emissive:0xff0066, emissiveIntensity:0.7});
    this.mountMat=new THREE.MeshStandardMaterial({color:0xa890ff, emissive:0xa890ff, emissiveIntensity:0.8});

    // chunk group holder
    this.root=new THREE.Group(); scene.add(this.root);

    // parallax clouds / mountains
    this.bgGroup=new THREE.Group(); scene.add(this.bgGroup);
    this.bgMountains=[];
    for(let i=0;i<7;i++){
      const h=rand(6,12); const w=rand(14,22);
      const geo=new THREE.ConeGeometry(w*0.5,h,5);
      const mat=new THREE.MeshStandardMaterial({color: i%2?0x2a2a6a:0x1e2060, roughness:1, transparent:true, opacity:0.9});
      const m=new THREE.Mesh(geo,mat); m.position.set(rand(-38,38), h*0.5-1, rand(-110,-10)); m.scale.z=0.6; this.bgGroup.add(m); this.bgMountains.push(m);
    }
    // stars for cross
    this.starPoints=null; this.createStars();

    // tunnel for cross mode
    this.tunnel=null; this.createTunnel();

    // pre-create chunks
    for(let i=0;i<CONFIG.chunkCount;i++) this.createChunk(this.nextZ), this.nextZ-=CONFIG.chunkLen;
  }
  createStars(){
    const cnt=400; const geo=new THREE.BufferGeometry(); const pos=new Float32Array(cnt*3);
    for(let i=0;i<cnt;i++){ pos[i*3]=rand(-110,110); pos[i*3+1]=rand(18,50); pos[i*3+2]=rand(-220,20); }
    geo.setAttribute('position', new THREE.BufferAttribute(pos,3));
    const mat=new THREE.PointsMaterial({size:0.35, color:0xffffff, transparent:true, opacity:0.0, sizeAttenuation:true, blending:THREE.AdditiveBlending, depthWrite:false});
    this.starPoints=new THREE.Points(geo,mat); this.starPoints.visible=false; this.scene.add(this.starPoints);
  }
  createTunnel(){
    const geo=new THREE.CylinderGeometry(13,13,240,16,1,true);
    const mat=new THREE.MeshBasicMaterial({color:0x00e5ff, transparent:true, opacity:0.0, side:THREE.DoubleSide, wireframe:false});
    // canvas texture stripes
    const cvs=document.createElement('canvas'); cvs.width=512; cvs.height=512;
    const ctx=cvs.getContext('2d');
    ctx.fillStyle='#061229'; ctx.fillRect(0,0,512,512);
    ctx.strokeStyle='#00e5ff'; ctx.lineWidth=4;
    for(let i=0;i<512;i+=32){ ctx.beginPath(); ctx.moveTo(0,i); ctx.lineTo(512,i); ctx.stroke(); }
    ctx.strokeStyle='#a890ff'; ctx.lineWidth=2; for(let i=0;i<512;i+=64){ ctx.beginPath(); ctx.moveTo(i,0); ctx.lineTo(i,512); ctx.stroke(); }
    const tex=new THREE.CanvasTexture(cvs); tex.wrapS=THREE.RepeatWrapping; tex.wrapT=THREE.RepeatWrapping; tex.repeat.set(1,6);
    mat.map=tex; mat.needsUpdate=true;
    this.tunnel=new THREE.Mesh(geo,mat); this.tunnel.rotation.z=Math.PI/2; this.tunnel.position.set(0,6,-60); this.tunnel.visible=false;
    this.scene.add(this.tunnel); this.tunnelTex=tex;
  }
  setMode(superMode, crossMode){
    this.superMode=superMode; this.crossMode=crossMode;
    if(crossMode){
      this.tunnel.visible=true; this.tunnel.material.opacity=0.55; this.starPoints.visible=true; this.starPoints.material.opacity=0.9;
      this.bgGroup.visible=false;
    } else if(superMode){
      this.tunnel.visible=false; this.starPoints.visible=false; this.bgGroup.visible=true;
    } else {
      this.tunnel.visible=false; this.starPoints.visible=false; this.bgGroup.visible=true;
    }
  }
  createChunk(z){
    const group=new THREE.Group(); group.position.z=z; this.root.add(group);
    const data={group, z, obstacles:[], coins:[], powers:[], decors:[], portal:null};
    this.chunks.push(data);
    this.buildChunk(data, true);
    return data;
  }
  buildChunk(chunk, initial=false){
    const g=chunk.group;
    // clear previous
    chunk.obstacles.forEach(o=>{ g.remove(o.mesh); this.poolObstacles.push(o); });
    chunk.coins.forEach(c=>{ g.remove(c.mesh); this.poolCoins.push(c); });
    chunk.powers.forEach(p=>{ g.remove(p.mesh); });
    chunk.decors.forEach(d=> g.remove(d));
    chunk.obstacles=[]; chunk.coins=[]; chunk.powers=[]; chunk.decors=[]; if(chunk.portal){ g.remove(chunk.portal); chunk.portal=null; }

    const isSuper=this.superMode; const isCross=this.crossMode;
    // theme switch
    this.themeTimer-=CONFIG.chunkLen;
    if(this.themeTimer<=0 && !isSuper && !isCross){
      this.theme= pick(['city','city','cave','sky']); this.themeTimer= rand(90,160);
    }

    // ground
    const groundLen=CONFIG.chunkLen+0.6;
    const groundW= 10.5;
    const groundGeo=new THREE.BoxGeometry(groundW, 0.6, groundLen);
    let mat=this.matGroundCity;
    if(isSuper) mat=this.matGroundSuper; else if(isCross) mat=this.matGroundCross; else if(this.theme==='cave') mat=this.matGroundCave; else if(this.theme==='sky') mat=this.matGroundCity;
    const ground=new THREE.Mesh(groundGeo, mat); ground.position.set(0,-0.3, -groundLen/2+0.3); ground.receiveShadow=true;
    g.add(ground); chunk.decors.push(ground);

    // side walls for cave/city
    if(this.theme==='cave' && !isSuper && !isCross){
      const wallGeo=new THREE.BoxGeometry(0.6, rand(4,6), groundLen);
      const wallMat=new THREE.MeshStandardMaterial({color:0x2a2340});
      const w1=new THREE.Mesh(wallGeo, wallMat); w1.position.set(-5.6, 1.5, -groundLen/2); g.add(w1); chunk.decors.push(w1);
      const w2=w1.clone(); w2.position.x=5.6; g.add(w2); chunk.decors.push(w2);
      // stalactite
      for(let i=0;i<3;i++){ const s=new THREE.Mesh(new THREE.ConeGeometry(0.35, rand(0.8,1.8),6), wallMat); s.position.set(rand(-4,4), rand(3.5,5), rand(-groundLen+2, -2)); s.rotation.x=Math.PI; g.add(s); chunk.decors.push(s); }
    } else if(!isSuper && !isCross){
      // road lines
      const lineMat=new THREE.MeshBasicMaterial({color:0xffffff, transparent:true, opacity:0.12});
      for(let i=0;i<4;i++){ const lm=new THREE.Mesh(new THREE.PlaneGeometry(0.18, 2.2), lineMat); lm.rotation.x=-Math.PI/2; lm.position.set(0,0.01, -i*8 -4); g.add(lm); chunk.decors.push(lm); }
      if(this.theme==='sky'){
        // floating islands deco
        for(let i=0;i<2;i++){ const iso=new THREE.Mesh(new THREE.BoxGeometry(rand(1.5,3),0.4,rand(2,4)), new THREE.MeshStandardMaterial({color:0x1d2060})); iso.position.set(rand(-9,9), rand(5,9), rand(-groundLen+4,-4)); g.add(iso); chunk.decors.push(iso); }
      }
    }

    // lighting deco for super/cross
    if(isSuper){
      const glow=new THREE.Mesh(new THREE.BoxGeometry(groundW,0.08,groundLen), new THREE.MeshBasicMaterial({color:0xfff2a0, transparent:true, opacity:0.18})); glow.position.set(0,0.04, -groundLen/2); g.add(glow); chunk.decors.push(glow);
    }
    if(isCross){
      const ringGeo=new THREE.TorusGeometry(9,0.12,8,20); const ringMat=new THREE.MeshBasicMaterial({color:0x00e5ff, transparent:true, opacity:0.5});
      for(let i=0;i<3;i++){ const ring=new THREE.Mesh(ringGeo, ringMat); ring.position.set(0,6, -i*10 -6); ring.rotation.y=Math.PI/2; g.add(ring); chunk.decors.push(ring); }
    }

    // generate content based on mode
    if(isSuper){
      this.genSuperCoins(chunk);
      // occasional small obstacles that are breakable but not lethal in super (player invincible) -> we skip lethal
      return;
    }
    if(isCross){
      this.genCrossCoins(chunk);
      // light barriers
      if(Math.random()<0.45){
        const lane= Math.floor(Math.random()*3);
        this.addObstacle(chunk, 'pillar', lane, -rand(6, groundLen-6), false);
      }
      // portal exit not needed
      return;
    }

    // NORMAL procedural
    const r=Math.random();
    // decide obstacle pattern ensuring passable
    if(r<0.78){
      // 1-2 obstacles per chunk
      const count= Math.random()<0.55?1:2;
      let lastZ=-4;
      for(let i=0;i<count;i++){
        const laneChoice= Math.random();
        let type, lane;
        if(laneChoice<0.32){
          type='spike'; lane=null; // spans
        } else if(laneChoice<0.55){
          type='gate'; lane=null;
        } else if(laneChoice<0.78){
          type='pillar'; lane=Math.floor(Math.random()*3);
        } else {
          type='monster'; lane=Math.floor(Math.random()*3);
        }
        // ensure spacing
        let zPos= -rand(lastZ+7, groundLen-4);
        if(zPos<-groundLen+2) zPos=-groundLen+4;
        lastZ= -zPos;
        // avoid double spanning too close
        if(type==='spike' || type==='gate'){
          // if previous was spanning, skip
          if(i>0 && (chunk.obstacles[chunk.obstacles.length-1].type==='spike' || chunk.obstacles[chunk.obstacles.length-1].type==='gate')){
            // convert to single lane
            type='pillar'; lane=Math.floor(Math.random()*3);
          }
        }
        this.addObstacle(chunk, type, lane, zPos);
      }
    }
    // coins
    this.genCoins(chunk);

    // power-ups
    if(Math.random()<0.28){
      const pType= pick(['magnet','magnet','shield','dash','mount']);
      const lane=Math.floor(Math.random()*3);
      const zPos=-rand(6, groundLen-6);
      this.addPower(chunk, pType, lane, zPos);
    }
    // portal for cross (rare)
    if(Math.random()<0.07){
      const lane=Math.floor(Math.random()*3);
      const zPos=-rand(8, groundLen-6);
      this.addPortal(chunk, lane, zPos);
    }
  }
  addObstacle(chunk, type, lane, z){
    let mesh, collider;
    const x= lane===null?0: LANE_X[lane];
    const y=0;
    if(type==='spike'){
      // low barrier spanning
      const w=9.8, h=1.0, d=1.0;
      const geo=new THREE.BoxGeometry(w, h, d);
      mesh=new THREE.Mesh(geo, this.matSpike); mesh.position.set(0, h/2, z);
      // spikes top
      for(let i=0;i<7;i++){ const s=new THREE.Mesh(new THREE.ConeGeometry(0.28,0.6,5), this.matSpike); s.position.set(-4.2+i*1.4, h/2+0.3, 0); mesh.add(s); }
      collider={minX:-4.9,maxX:4.9,minY:0,maxY:h,minZ:z-d/2,maxZ:z+d/2, lane:null, type, kill:'touch', stomp:false};
    } else if(type==='gate'){
      const h=3.0, w=9.8, d=0.9;
      mesh=new THREE.Group();
      const top=new THREE.Mesh(new THREE.BoxGeometry(w,0.5,d), this.matGate); top.position.set(0, 2.9, z); mesh.add(top);
      const beam=new THREE.Mesh(new THREE.BoxGeometry(w,0.1,0.2), new THREE.MeshBasicMaterial({color:0x00e5ff})); beam.position.set(0,1.45,z); mesh.add(beam);
      // pillars
      const pilGeo=new THREE.BoxGeometry(0.45,2.9,0.45);
      const p1=new THREE.Mesh(pilGeo, this.matGate); p1.position.set(-4.8,1.45,z); mesh.add(p1);
      const p2=p1.clone(); p2.position.x=4.8; mesh.add(p2);
      mesh.position.set(0,0,0);
      // collider is the top beam + side pillars but gap below 1.45
      collider={minX:-4.9,maxX:4.9,minY:1.45,maxY:3.2,minZ:z-0.45,maxZ:z+0.45, lane:null, type, kill:'gate', stomp:false, gap:1.45};
      mesh.userData.collider=collider;
      // we store mesh pos offset
      collider.minZ+=0; // already
      chunk.group.add(mesh); chunk.obstacles.push({mesh, collider, type, lane, z}); return;
    } else if(type==='pillar'){
      const h=2.2, w=1.0, d=1.0;
      const geo=new THREE.BoxGeometry(w,h,d);
      mesh=new THREE.Mesh(geo, this.matPillar); mesh.position.set(x, h/2, z);
      collider={minX:x-w/2,maxX:x+w/2,minY:0,maxY:h,minZ:z-d/2,maxZ:z+d/2,lane, type, kill:'touch', stomp:false};
    } else if(type==='monster'){
      const h=1.55, w=1.25, d=0.9;
      const grp=new THREE.Group(); grp.position.set(x,0,z);
      const base=new THREE.Mesh(new THREE.CapsuleGeometry(0.55,0.5,4,8), this.matMonster); base.position.y=0.85; base.rotation.z=Math.PI/2; grp.add(base);
      const head=new THREE.Mesh(new THREE.SphereGeometry(0.42,10,10), new THREE.MeshStandardMaterial({color:0x0b5d3a})); head.position.set(0.15,1.2,0.08); grp.add(head);
      const eye=new THREE.Mesh(new THREE.SphereGeometry(0.11,6,6), new THREE.MeshBasicMaterial({color:0xff3b3b})); eye.position.set(0.32,1.24,0.22); grp.add(eye);
      const eye2=eye.clone(); eye2.position.z=-0.22; grp.add(eye2);
      mesh=grp;
      collider={minX:x-w/2,maxX:x+w/2,minY:0,maxY:h,minZ:z-d/2,maxZ:z+d/2,lane, type, kill:'monster', stomp:true, h:h};
    }
    if(mesh){
      chunk.group.add(mesh);
      chunk.obstacles.push({mesh, collider, type, lane, z});
    }
  }
  genCoins(chunk){
    const patterns=pick(['line','arc','wave','stairs','lanePair']);
    const baseZ= -rand(5, 8);
    if(patterns==='line'){
      const lane=Math.floor(Math.random()*3);
      const y=1.0; const x=LANE_X[lane];
      const n=8;
      for(let i=0;i<n;i++) this.addCoin(chunk, x, y, baseZ - i*1.35);
      // second lane sometimes
      if(Math.random()<0.3){
        const lane2=(lane+1)%3; for(let i=0;i<5;i++) this.addCoin(chunk, LANE_X[lane2], 1.0, baseZ -2 - i*1.4);
      }
    } else if(patterns==='arc'){
      const lane=Math.floor(Math.random()*3); const x=LANE_X[lane];
      const n=10;
      for(let i=0;i<n;i++){
        const t=i/(n-1); const zz= baseZ - t*12;
        const yy= 1.0 + Math.sin(Math.PI*t)*2.4;
        this.addCoin(chunk, x, yy, zz);
      }
    } else if(patterns==='wave'){
      const n=9;
      for(let i=0;i<n;i++){
        const t=i/(n-1); const zz= baseZ - t*11;
        const lane= (i%2===0)? -1:1; // alternate lanes
        const x= lane*3.2; const y= 1.0 + Math.sin(t*Math.PI*2)*0.6 +0.4;
        this.addCoin(chunk, x, y, zz);
      }
    } else if(patterns==='stairs'){
      const lane=Math.floor(Math.random()*3); const x=LANE_X[lane];
      for(let i=0;i<7;i++) this.addCoin(chunk, x, 0.7 + i*0.32, baseZ - i*1.5);
    } else if(patterns==='lanePair'){
      const y=1.1;
      for(let lane=0;lane<3;lane++){
        if(Math.random()<0.65){
          for(let i=0;i<4;i++) this.addCoin(chunk, LANE_X[lane], y, baseZ - i*1.8 - lane*0.6);
        }
      }
    }
    // sprinkle extra singles near obstacles to guide
  }
  genSuperCoins(chunk){
    // dense grid floating
    const rows=3, cols=10;
    const startZ=-4;
    for(let r=0;r<rows;r++){
      const x= LANE_X[r];
      for(let c=0;c<cols;c++){
        const z= startZ - c*2.0 - Math.random()*0.4;
        const y= 1.0 + (r===1?1.2:0.6) + Math.sin(c*0.9)*0.35;
        this.addCoin(chunk, x, y, z, true);
      }
    }
    // extra floating clusters
    for(let i=0;i<6;i++) this.addCoin(chunk, pick(LANE_X), 2.2+Math.random()*0.8, -rand(2, 24), true);
  }
  genCrossCoins(chunk){
    const n=12;
    for(let i=0;i<n;i++){
      const lane=Math.floor(Math.random()*3);
      const x=LANE_X[lane] + rand(-0.4,0.4);
      const y= rand(0.9,2.0);
      const z= -rand(3, 28);
      this.addCoin(chunk, x, y, z, false, true);
    }
  }
  addCoin(chunk, x,y,z, isSuper=false, isCross=false){
    let mesh;
    // pool?
    if(this.poolCoins.length>0){
      const p=this.poolCoins.pop(); mesh=p.mesh; mesh.visible=true; mesh.position.set(x,y,z);
      // reset scale
      mesh.scale.set(1,1,1);
    } else {
      const mat= isSuper? this.coinMatSuper.clone(): this.coinMat.clone();
      mesh=new THREE.Mesh(this.coinGeo, mat); mesh.position.set(x,y,z);
      // inner glow
      const glow=new THREE.Mesh(new THREE.CylinderGeometry(0.22,0.22,0.02,12), new THREE.MeshBasicMaterial({color:0xffffff, transparent:true, opacity:0.35}));
      glow.rotateZ(Math.PI/2); glow.position.x=0.02; mesh.add(glow);
    }
    mesh.rotation.z=0;
    mesh.userData={isSuper, isCross, spin: rand(0,Math.PI*2)};
    // ensure material emissive for super
    if(isSuper) mesh.material.emissiveIntensity=0.85;
    chunk.group.add(mesh);
    chunk.coins.push({mesh, x,y,z, isSuper, isCross, collected:false});
  }
  addPower(chunk, type, lane, z){
    const x=LANE_X[lane]; const y=1.05;
    let mesh;
    const geoIcon=new THREE.SphereGeometry(0.42,12,12);
    let mat;
    if(type==='magnet') mat=this.magnetMat;
    else if(type==='shield') mat=this.shieldMat;
    else if(type==='dash') mat=this.dashMat;
    else if(type==='mount') mat=this.mountMat;
    mesh=new THREE.Mesh(geoIcon, mat); mesh.position.set(x,y,z);
    // icon inner
    const innerMat=new THREE.MeshBasicMaterial({color:0xffffff, transparent:true, opacity:0.9});
    let inner;
    if(type==='magnet'){ inner=new THREE.Mesh(new THREE.TorusGeometry(0.22,0.06,8,14), innerMat); inner.rotation.x=Math.PI/2; }
    else if(type==='shield'){ inner=new THREE.Mesh(new THREE.OctahedronGeometry(0.22,0), innerMat); }
    else if(type==='dash'){ inner=new THREE.Mesh(new THREE.ConeGeometry(0.18,0.42,6), innerMat); inner.rotation.z=-Math.PI/2; }
    else if(type==='mount'){ inner=new THREE.Mesh(new THREE.SphereGeometry(0.14,6,6), innerMat); }
    if(inner) mesh.add(inner);
    // floating ring
    const ring=new THREE.Mesh(new THREE.TorusGeometry(0.58,0.04,8,16), new THREE.MeshBasicMaterial({color:0xffffff, transparent:true, opacity:0.55}));
    ring.rotation.x=Math.PI/2; mesh.add(ring);
    mesh.userData={type, lane, z, rot:0};
    chunk.group.add(mesh);
    chunk.powers.push({mesh, type, x,y,z, lane});
  }
  addPortal(chunk, lane, z){
    const x=LANE_X[lane];
    const grp=new THREE.Group(); grp.position.set(x,1.35,z);
    const torus=new THREE.Mesh(new THREE.TorusGeometry(0.95,0.12,12,18), new THREE.MeshBasicMaterial({color:0x00e5ff, transparent:true, opacity:0.9}));
    torus.rotation.y=Math.PI/2; grp.add(torus);
    const inner=new THREE.Mesh(new THREE.CircleGeometry(0.78,16), new THREE.MeshBasicMaterial({color:0xa890ff, transparent:true, opacity:0.72, side:THREE.DoubleSide}));
    inner.rotation.y=Math.PI/2; inner.position.x=0.02; grp.add(inner);
    const spark=new THREE.Mesh(new THREE.SphereGeometry(0.22,8,8), new THREE.MeshBasicMaterial({color:0xffffff, transparent:true, opacity:0.85})); grp.add(spark);
    grp.userData={lane, z, type:'portal'};
    chunk.group.add(grp); chunk.portal=grp;
  }
  update(speed, dt){
    const move= speed * dt;
    this.root.position.z+=move;
    // parallax
    this.bgGroup.position.z+= move*0.18;
    if(this.bgGroup.position.z> 30) this.bgGroup.position.z-=60;
    if(this.tunnel.visible){
      this.tunnelTex.offset.y+= dt*1.8;
      this.tunnel.position.z+= move*0.5;
      if(this.tunnel.position.z> 40) this.tunnel.position.z-=80;
      this.tunnel.rotation.x+= dt*0.6;
    }
    if(this.starPoints.visible){
      const pos=this.starPoints.geometry.attributes.position;
      for(let i=0;i<pos.count;i++){
        const z=pos.getZ(i); let nz=z+ move*0.7;
        if(nz>20) nz-=240;
        pos.setZ(i, nz);
      }
      pos.needsUpdate=true;
    }
    // recycle chunks
    for(const c of this.chunks){
      const worldZ= c.group.position.z + this.root.position.z;
      if(worldZ > 18){
        // recycle to front
        const minZ=Math.min(...this.chunks.map(ch=> ch.group.position.z));
        c.group.position.z= minZ - CONFIG.chunkLen;
        this.buildChunk(c);
      }
    }
    // spin coins / hover powers
    for(const c of this.chunks){
      for(const coin of c.coins){
        if(coin.collected) continue;
        coin.mesh.rotation.y+= dt*3.2;
        if(!coin._pulling){
          coin.mesh.position.y= coin.y + Math.sin(performance.now()*0.003 + coin.x*2 + coin.z)*0.12;
        } else {
          // 被磁铁拉时保持被拉的位置，下一帧重置标记
          coin._pulling=false;
        }
      }
      for(const p of c.powers){
        p.mesh.rotation.y+= dt*1.8;
        if(!p.mesh.userData._pulling){
          p.mesh.position.y= p.y + Math.sin(performance.now()*0.0035 + p.z)*0.18;
        } else {
          p.mesh.userData._pulling=false;
        }
      }
      if(c.portal){
        c.portal.rotation.y+= dt*1.2;
        c.portal.children[0].rotation.z+= dt*2;
        c.portal.position.y=1.35+ Math.sin(performance.now()*0.004 + c.portal.position.z)*0.18;
      }
      // monster bob
      for(const o of c.obstacles){
        if(o.type==='monster'){
          o.mesh.position.y= Math.sin(performance.now()*0.003 + o.z)*0.12;
        }
      }
    }
  }
  // collision helpers: returns world positions for obstacles/coins/powers/portals near player
  getNearby(playerZ){
    // root offset
    const off=this.root.position.z;
    const res={obs:[], coins:[], powers:[], portals:[]};
    for(const c of this.chunks){
      const cz=c.group.position.z+off;
      // chunk spans [cz -len, cz]
      if(cz < -42 || cz> 10) continue;
      for(const o of c.obstacles){
        const wz= o.collider.minZ + off + c.group.position.z - o.z + o.z; // simplified: collider z already relative to chunk origin? we stored absolute local z
        // actually collider minZ is local z minus half, so world = c.group.z+off + collider
        const wMinZ= c.group.position.z+off + o.collider.minZ;
        const wMaxZ= c.group.position.z+off + o.collider.maxZ;
        // quick distance filter
        if(wMaxZ < -2 || wMinZ > 2) continue; // player at 0
        res.obs.push({o, chunk:c, wMinZ,wMaxZ, wCollider:{...o.collider, minZ:wMinZ, maxZ:wMaxZ}});
      }
      for(const coin of c.coins){
        if(coin.collected) continue;
        // 用 mesh 实时位置算世界 Z，支持磁铁远距离吸附 诶嘿
        const wz= c.group.position.z+off + coin.mesh.position.z;
        if(Math.abs(wz)>9) continue;
        res.coins.push({coin, chunk:c, wz, wx:coin.mesh.position.x, wy:coin.mesh.position.y});
      }
      for(const p of c.powers){
        const wz=c.group.position.z+off + p.mesh.position.z;
        if(Math.abs(wz)>9) continue;
        res.powers.push({p, chunk:c, wz, wx:p.mesh.position.x, wy:p.mesh.position.y});
      }
      if(c.portal){
        const wz= c.group.position.z+off + c.portal.position.z;
        if(Math.abs(wz)<3) res.portals.push({portal:c.portal, chunk:c, wz, wx:c.portal.position.x});
      }
    }
    return res;
  }
}
